import { system, world } from '@minecraft/server'
import { readToolLockFromItem, registerToolLockResolver } from './toolMemory.js'
import { playConfiguredSound, soundConfig } from './soundConfig.js'

const TOOL_NAMESPACES = ['dorios_atelier', 'utilitycraft']
const GLASS_CUTTER_COMPONENT_ID = 'dorios_atelier:glass_cutter'
const GLASS_CUTTER_ID_SUFFIX = '_glass_cutter'

const NAMESPACE = 'dorios_atelier'
const CUTTER_LOCK_KIND = 'cutter'

const COLOR_MAPPINGS = [
	{ vanilla: 'white', custom: 'white' },
	{ vanilla: 'light_gray', custom: 'silver' },
	{ vanilla: 'gray', custom: 'gray' },
	{ vanilla: 'black', custom: 'black' },
	{ vanilla: 'brown', custom: 'brown' },
	{ vanilla: 'red', custom: 'red' },
	{ vanilla: 'orange', custom: 'orange' },
	{ vanilla: 'yellow', custom: 'yellow' },
	{ vanilla: 'lime', custom: 'lima' },
	{ vanilla: 'green', custom: 'green' },
	{ vanilla: 'cyan', custom: 'cyan' },
	{ vanilla: 'light_blue', custom: 'light_blue' },
	{ vanilla: 'blue', custom: 'blue' },
	{ vanilla: 'purple', custom: 'purple' },
	{ vanilla: 'magenta', custom: 'magenta' },
	{ vanilla: 'pink', custom: 'pink' }
]

const CYCLE_BY_ID = new Map()

const styleFromTypeId = typeId => {
	const raw = String(typeId ?? '').split(':').slice(1).join(':') || String(typeId ?? '')
	if (raw.endsWith('_tempered_glass')) return 'tempered'
	if (raw.endsWith('_hitch_cross_glass')) return 'hitch_cross'
	if (raw.endsWith('_broadline_glass')) return 'broadline'
	if (raw.endsWith('_clean_glass') || raw.endsWith('_clear_glass')) return 'clean'
	if (raw.endsWith('_stained_glass') || raw === 'glass') return 'stained'
	return 'stained'
}

const formatStyleLabel = style => {
	if (!style) return 'Stained'
	if (style === 'hitch_cross') return 'Hitch Cross'
	return style.charAt(0).toUpperCase() + style.slice(1)
}

const registerCycle = cycle => {
	for (let index = 0; index < cycle.length; index += 1) {
		CYCLE_BY_ID.set(cycle[index], { cycle, index })
	}
}

registerCycle([
	'minecraft:glass',
	`${NAMESPACE}:clean_glass`,
	`${NAMESPACE}:broadline_glass`,
	`${NAMESPACE}:hitch_cross_glass`,
	`${NAMESPACE}:tempered_glass`
])

for (const { vanilla, custom } of COLOR_MAPPINGS) {
	const cycle = [
		`minecraft:${vanilla}_stained_glass`,
		`${NAMESPACE}:${custom}_stained_glass`,
		custom === 'brown' ? `${NAMESPACE}:brown_clear_glass` : `${NAMESPACE}:${custom}_clean_glass`,
		`${NAMESPACE}:${custom}_broadline_glass`,
		`${NAMESPACE}:${custom}_hitch_cross_glass`,
		`${NAMESPACE}:${custom}_tempered_glass`
	]
	registerCycle(cycle)
}

const playGlassSound = (block, source) => {
	playConfiguredSound({
		block,
		source,
		soundEvent: soundConfig.toolUseFallbackEventByKind.cutter,
		fallbackSound: soundConfig.defaultMaterialEvent
	})
}

const damageHeldCutter = (player, eventItemStack) => {
	system.run(() => {
		try {
			const container = player?.getComponent?.('minecraft:inventory')?.container
			if (!container) return

			let slot = typeof player.selectedSlot === 'number'
				? player.selectedSlot
				: player.selectedSlotIndex
			let stack = typeof slot === 'number' ? container.getItem(slot) : undefined

			if (!stack || stack.typeId !== eventItemStack?.typeId) {
				for (let index = 0; index < container.size; index += 1) {
					const candidate = container.getItem(index)
					if (candidate?.typeId !== eventItemStack?.typeId) continue
					slot = index
					stack = candidate
					break
				}
			}

			if (!stack || typeof slot !== 'number') return
			const durability = stack.getComponent?.('minecraft:durability')
			if (!durability) return

			const nextDamage = durability.damage + 1
			const broke = nextDamage >= durability.maxDurability
			durability.damage = Math.min(nextDamage, durability.maxDurability)
			if (broke) {
				try {
					player.playSound?.(soundConfig.toolBreakEventByKind.cutter)
				} catch {}
			}
			container.setItem(slot, broke ? undefined : stack)
		} catch {
			// Durability feedback must never undo an already-applied block change.
		}
	})
}

const rotateGlassBlock = (block, source) => {
	const current = CYCLE_BY_ID.get(block?.typeId)
	if (!current) return false

	for (let step = 1; step <= current.cycle.length; step += 1) {
		const nextIndex = (current.index + step) % current.cycle.length
		const candidate = current.cycle[nextIndex]
		try {
			block.setType(candidate)
			playGlassSound(block, source)
			return true
		} catch {
			// Try next candidate.
		}
	}

	return false
}

const stripNamespace = typeId => {
	const parts = String(typeId ?? '').split(':')
	return parts.length > 1 ? parts.slice(1).join(':') : parts[0]
}

const applyLockedGlassVariant = (block, source, lock) => {
	if (!lock?.variant) return false

	const current = CYCLE_BY_ID.get(block?.typeId)
	if (!current) return false

	for (let step = 1; step <= current.cycle.length; step += 1) {
		const index = (current.index + step) % current.cycle.length
		const candidate = current.cycle[index]
		if (styleFromTypeId(candidate) !== lock.variant) continue
		if (candidate === block.typeId) return false
		try {
			block.setType(candidate)
			playGlassSound(block, source)
			return true
		} catch {
			// Try next candidate.
		}
	}

	return false
}

registerToolLockResolver(CUTTER_LOCK_KIND, viewedBlock => {
	const entry = CYCLE_BY_ID.get(viewedBlock?.typeId)
	if (!entry) return undefined

	const variant = styleFromTypeId(viewedBlock.typeId)
	return {
		kind: CUTTER_LOCK_KIND,
		variant,
		state: variant,
		label: formatStyleLabel(variant)
	}
})

system.beforeEvents.startup.subscribe(initEvent => {
	const handlers = {
		onUseOn(event) {
			const { block, source, itemStack } = event ?? {}
			if (!block) return

			const lock = readToolLockFromItem(itemStack, CUTTER_LOCK_KIND)
			let changed = false
			if (lock) {
				changed = applyLockedGlassVariant(block, source, lock)
			} else {
				changed = rotateGlassBlock(block, source)
			}

			if (changed) damageHeldCutter(source, itemStack)
		}
	}

	try {
		initEvent.itemComponentRegistry.registerCustomComponent(GLASS_CUTTER_COMPONENT_ID, handlers)
	} catch {
		// Ignore duplicated registration in hot-reload scenarios.
	}
})

// Digger durability is handled manually so a style change consumes exactly one use.
world?.beforeEvents?.itemComponentBeforeDurabilityDamage?.subscribe?.(event => {
	const stack = event?.itemStack
	if (!stack?.typeId?.endsWith(GLASS_CUTTER_ID_SUFFIX)) return
	if (!TOOL_NAMESPACES.some(namespace => stack.typeId.startsWith(`${namespace}:`))) return
	event.cancel = true
})
