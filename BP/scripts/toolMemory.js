import { system, world } from '@minecraft/server'

const TOOL_NAMESPACES = ['dorios_atelier', 'utilitycraft']
const TOOL_KIND_BY_SUFFIX = new Map([
	['_chisel', 'chisel'],
	['_furniture_hammer', 'hammer'],
	['_glass_cutter', 'cutter']
])

const LOCK_PREFIX = '§8DA_LOCK:'
const LOCK_LABEL_PREFIX = 'Lock: '
const LOCK_DYNAMIC_PROPERTY_PREFIX = 'dorios_atelier:lock:'
const DOUBLE_SNEAK_WINDOW_TICKS = 10
const VIEW_DISTANCE = 8

const SNEAK_STATE = new Map()
const LOCK_RESOLVERS = new Map()
let tickCounter = 0

const unique = values => Array.from(new Set(values.filter(Boolean)))

const getPlayerKey = player => player?.id ?? player?.nameTag ?? 'unknown-player'

const getSelectedSlotIndex = player => {
	if (typeof player?.selectedSlot === 'number') return player.selectedSlot
	if (typeof player?.selectedSlotIndex === 'number') return player.selectedSlotIndex
	return undefined
}

const getHeldItemContext = player => {
	const container = player?.getComponent?.('minecraft:inventory')?.container
	if (!container) return undefined

	const slot = getSelectedSlotIndex(player)
	if (slot === undefined) return undefined

	const stack = container.getItem(slot)
	if (!stack) return undefined

	return { container, slot, stack }
}

const parseToolKind = typeId => {
	if (!typeId) return undefined
	for (const [suffix, kind] of TOOL_KIND_BY_SUFFIX.entries()) {
		if (!typeId.endsWith(suffix)) continue

		const hasKnownNamespace = TOOL_NAMESPACES.some(namespace => typeId.startsWith(`${namespace}:`))
		if (hasKnownNamespace) return kind

		// Compatibility mode: if suffix matches, allow third-party namespaces.
		return kind
	}
	return undefined
}

const stateFromBlockTypeId = typeId => {
	if (!typeId) return 'default'
	const name = typeId.includes(':') ? typeId.split(':')[1] : typeId
	if (name.endsWith('_vertical_slab')) return 'vertical_slab'
	if (name.endsWith('_wall')) return 'wall'
	if (name.endsWith('_stairs')) return 'stairs'
	if (name.endsWith('_slab')) return 'slab'
	return 'default'
}

const getViewedBlock = player => {
	try {
		return player?.getBlockFromViewDirection?.({ maxDistance: VIEW_DISTANCE })?.block
	} catch {
		return undefined
	}
}

const normalizeLock = lock => {
	if (!lock || typeof lock !== 'object') return undefined
	return {
		kind: String(lock.kind ?? ''),
		state: lock.state ? String(lock.state) : undefined,
		variant: lock.variant ? String(lock.variant) : undefined,
		targetId: lock.targetId ? String(lock.targetId) : undefined,
		label: lock.label ? String(lock.label) : undefined
	}
}

const dynamicPropertyIdForKind = kind => `${LOCK_DYNAMIC_PROPERTY_PREFIX}${kind}`

const isSameLockTarget = (a, b) => {
	if (!a || !b) return false
	if (a.kind !== b.kind) return false

	if (a.variant && b.variant) {
		return a.variant === b.variant
	}

	if (a.state && b.state && !a.variant && !b.variant) {
		return a.state === b.state
	}

	if (a.targetId && b.targetId) {
		return a.targetId === b.targetId
	}

	return false
}

const parseLockLine = (line, expectedKind) => {
	if (!line?.startsWith(LOCK_PREFIX)) return undefined
	const payload = line.slice(LOCK_PREFIX.length).trim()

	if (payload.startsWith('{')) {
		try {
			const parsed = JSON.parse(payload)
			if (parsed?.kind !== expectedKind) return undefined
			return normalizeLock(parsed)
		} catch {
			return undefined
		}
	}

	// Legacy format fallback: kind|state|targetId
	const [kind, state, targetId] = payload.split('|')
	if (kind !== expectedKind) return undefined
	if (!state || !targetId) return undefined
	return normalizeLock({ kind, state, targetId, variant: state })
}

const readDynamicLockFromItem = (itemStack, kind) => {
	try {
		const raw = itemStack?.getDynamicProperty?.(dynamicPropertyIdForKind(kind))
		if (typeof raw !== 'string' || !raw) return undefined
		const parsed = JSON.parse(raw)
		if (parsed?.kind !== kind) return undefined
		return normalizeLock(parsed)
	} catch {
		return undefined
	}
}

export const readToolLockFromItem = (itemStack, kind) => {
	const lore = itemStack?.getLore?.() ?? []
	for (const line of lore) {
		const parsed = parseLockLine(line, kind)
		if (parsed) return parsed
	}

	return readDynamicLockFromItem(itemStack, kind)
}

const removeLockLines = (lore, kind) => lore.filter(line => {
	if (line.startsWith(LOCK_PREFIX)) {
		const payload = line.slice(LOCK_PREFIX.length).trim()
		if (payload.startsWith('{')) {
			try {
				if (JSON.parse(payload)?.kind === kind) return false
			} catch {
				// Ignore malformed JSON lock lines and keep them untouched.
			}
		}
		if (payload.startsWith(`${kind}|`)) return false
	}
	const plainLine = String(line ?? '').replace(/§./g, '')
	if (plainLine.startsWith(LOCK_LABEL_PREFIX)) return false
	return true
})

const writeLockToLore = (itemStack, kind, lock) => {
	const lore = itemStack?.getLore?.() ?? []
	const cleaned = removeLockLines(lore, kind)

	if (!lock) {
		itemStack?.setLore?.(cleaned)
		try {
			itemStack?.setDynamicProperty?.(dynamicPropertyIdForKind(kind), undefined)
		} catch {
			// Best-effort cleanup only.
		}
		return
	}

	const normalized = normalizeLock({ ...lock, kind })
	const fallbackLabel = normalized.variant ?? normalized.state ?? normalized.targetId ?? 'custom'
	const labelLine = `§r§6${LOCK_LABEL_PREFIX}§7${normalized.label ?? fallbackLabel}`
	itemStack?.setLore?.([...cleaned, labelLine])

	try {
		itemStack?.setDynamicProperty?.(dynamicPropertyIdForKind(kind), JSON.stringify(normalized))
	} catch {
		// Best-effort dynamic property mirror only.
	}
}

const setHeldToolLock = (player, kind, lock) => {
	const context = getHeldItemContext(player)
	if (!context) return false

	const heldKind = parseToolKind(context.stack.typeId)
	if (heldKind !== kind) return false

	writeLockToLore(context.stack, kind, lock)
	context.container.setItem(context.slot, context.stack)
	return true
}

const toggleLockFromSneak = player => {
	const context = getHeldItemContext(player)
	if (!context) return

	const kind = parseToolKind(context.stack.typeId)
	if (!kind) return

	const viewedBlock = getViewedBlock(player)
	const currentLock = readToolLockFromItem(context.stack, kind)

	if (!viewedBlock) {
		setHeldToolLock(player, kind, undefined)
		return
	}

	const resolver = LOCK_RESOLVERS.get(kind)
	const nextLock = normalizeLock(
		resolver ? resolver(viewedBlock, player) : {
			kind,
			state: stateFromBlockTypeId(viewedBlock.typeId),
			variant: stateFromBlockTypeId(viewedBlock.typeId),
			targetId: viewedBlock.typeId,
			label: stateFromBlockTypeId(viewedBlock.typeId)
		}
	)

	if (!nextLock) return

	if (currentLock && isSameLockTarget(currentLock, nextLock)) {
		setHeldToolLock(player, kind, undefined)
		return
	}

	const saved = setHeldToolLock(player, kind, nextLock)
	if (!saved) return

	const variant = nextLock.label ?? nextLock.variant ?? nextLock.state ?? 'custom'
	try {
		player?.onScreenDisplay?.setActionBar?.(`§6Locked §f${variant} §6variant!`)
	} catch {
		// Best effort feedback only.
	}
}

const updateSneakMemory = player => {
	const key = getPlayerKey(player)
	const current = Boolean(player?.isSneaking)
	const previous = SNEAK_STATE.get(key) ?? { wasSneaking: false, lastSneakTick: -9999 }

	const risingEdge = current && !previous.wasSneaking
	if (risingEdge) {
		if (tickCounter - previous.lastSneakTick <= DOUBLE_SNEAK_WINDOW_TICKS) {
			toggleLockFromSneak(player)
		}
		previous.lastSneakTick = tickCounter
	}

	previous.wasSneaking = current
	SNEAK_STATE.set(key, previous)
}

const initializeSneakWatcher = () => {
	if (globalThis.__doriosToolLockWatcherInitialized) return
	globalThis.__doriosToolLockWatcherInitialized = true

	system.runInterval(() => {
		tickCounter += 1
		for (const player of world.getAllPlayers()) {
			updateSneakMemory(player)
		}
	}, 1)
}

initializeSneakWatcher()

export const getToolKindFromTypeId = parseToolKind
export const getLockStateFromBlockTypeId = stateFromBlockTypeId
export const registerToolLockResolver = (kind, resolver) => {
	if (!kind || typeof resolver !== 'function') return
	LOCK_RESOLVERS.set(kind, resolver)
}
export const getCompatibleNamespaces = currentNamespace => unique([
	currentNamespace,
	'dorios_atelier',
	'utilitycraft',
	'minecraft'
])
