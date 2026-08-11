import { system, world } from '@minecraft/server'
import { getCompatibleNamespaces, readToolLockFromItem, registerToolLockResolver } from './tool_lock_memory.js'
import { playToolMaterialSound, soundConfig } from './sound_config.js'

// Supported namespaces for custom components and durability filtering.
const TOOL_NAMESPACES = ['dorios_atelier', 'utilitycraft']
const FURNITURE_HAMMER_COMPONENT_IDS = TOOL_NAMESPACES.map(namespace => `${namespace}:furniture_hammer`)
const FURNITURE_HAMMER_ID_SUFFIX = '_furniture_hammer'

// Lock metadata and variant state mapping.
const HAMMER_LOCK_KIND = 'hammer'
const STATE_ORDER = ['default', 'stairs', 'slab', 'vertical_slab']
const STATE_SUFFIX = {
    default: '',
    stairs: '_stairs',
    slab: '_slab',
    vertical_slab: '_vertical_slab'
}

// Rotation sequences used when player is sneaking.
const CARDINAL_ORDER = ['north', 'east', 'south', 'west']
const ROTATION_ORDER = [0, 1, 2, 3, 4, 5, 6, 7]
const weirdoDirection = [0, 1, 2, 3]
const WOOD_BASE_TOKENS = [
    'oak',
    'spruce',
    'birch',
    'jungle',
    'acacia',
    'dark_oak',
    'mangrove',
    'cherry',
    'bamboo',
    'crimson',
    'warped'
]
const STONE_TYPE_ALIAS = {
    stone: 'stone',
    granite: 'granite',
    smooth_granite: 'smooth_granite',
    granite_smooth: 'smooth_granite',
    diorite: 'diorite',
    smooth_diorite: 'smooth_diorite',
    diorite_smooth: 'smooth_diorite',
    andesite: 'andesite',
    smooth_andesite: 'smooth_andesite',
    andesite_smooth: 'smooth_andesite'
}

const TITLE_BY_STATE = {
    default: 'Default',
    stairs: 'Stairs',
    slab: 'Slab',
    vertical_slab: 'Vertical Slab'
}

const isLikelyWoodBaseName = name => WOOD_BASE_TOKENS.some(token => name === token || name.includes(token))

// Applies manual durability consumption and breaks the tool when needed.
const damageHeldHammer = (player, eventItemStack) => {
    system.run(() => {
        try {
            const container = player.getComponent('minecraft:inventory')?.container
            if (!container) return

            let slot
            if (typeof player.selectedSlot === 'number') slot = player.selectedSlot
            else if (typeof player.selectedSlotIndex === 'number') slot = player.selectedSlotIndex

            // Try selected slot first.
            let stack = slot !== undefined ? container.getItem(slot) : undefined

            // Fallback to first matching stack when selected slot changed.
            if (!stack || (eventItemStack && stack.typeId !== eventItemStack.typeId)) {
                const size = typeof container.size === 'number' ? container.size : 36
                for (let i = 0; i < size; i += 1) {
                    const candidate = container.getItem(i)
                    if (candidate && (!eventItemStack?.typeId || candidate.typeId === eventItemStack.typeId)) {
                        slot = i
                        stack = candidate
                        break
                    }
                }
            }

            if (!stack || slot === undefined) return

            // Increase durability damage by 1 on successful use.
            const durability = stack.getComponent?.('minecraft:durability')
            if (!durability) return

            const current = typeof durability.damage === 'number' ? durability.damage : 0
            const max = typeof durability.maxDurability === 'number' ? durability.maxDurability : undefined
            const next = Math.min(current + 1, max ?? current + 1)
            durability.damage = next
            const broke = typeof max === 'number' && max > 0 && next >= max
            if (broke) {
                try {
                    player.playSound?.(soundConfig.toolBreakEventByKind.hammer)
                } catch {
                    // best effort
                }
            }
            container.setItem(slot, broke ? undefined : stack)
        } catch {
            // best effort only
        }
    })
}

// Register item behavior for all supported furniture hammer component IDs.
registerToolLockResolver(HAMMER_LOCK_KIND, viewedBlock => {
    const typeId = viewedBlock?.typeId
    if (!typeId) return undefined

    const rawName = typeId.includes(':') ? typeId.split(':').slice(1).join(':') : typeId
    const state = rawName.endsWith('_vertical_slab')
        ? 'vertical_slab'
        : rawName.endsWith('_stairs')
            ? 'stairs'
            : rawName.endsWith('_slab')
                ? 'slab'
                : 'default'

    return {
        kind: HAMMER_LOCK_KIND,
        state,
        variant: state,
        label: TITLE_BY_STATE[state] ?? 'Default'
    }
})

system.beforeEvents.startup.subscribe(initEvent => {
    const handlers = {
        onUseOn(event) {
            const { block, source, itemStack } = event ?? {}
            if (!block) return

            // Resolve lock from lore (if user recorded a target).
            const interactedTypeId = block.typeId
            const lock = readToolLockFromItem(itemStack, HAMMER_LOCK_KIND)
            let changed = false

            // Sneaking rotates block facing instead of changing variant state.
            if (source?.isSneaking) {
                const permutation = block.permutation
                if (!permutation) return

                const readState = (namespacedKey, plainKey) => {
                    try {
                        const value = permutation.getState(namespacedKey)
                        if (value !== undefined && value !== null) return value
                    } catch {
                        // Try plain key fallback.
                    }
                    try {
                        return permutation.getState(plainKey)
                    } catch {
                        return undefined
                    }
                }

                const trySetState = (namespacedKey, plainKey, value) => {
                    try {
                        block.setPermutation(permutation.withState(namespacedKey, value))
                        return true
                    } catch {
                        // Try plain key fallback.
                    }
                    try {
                        block.setPermutation(permutation.withState(plainKey, value))
                        return true
                    } catch {
                        return false
                    }
                }

                const cardinal = readState('minecraft:cardinal_direction', 'cardinal_direction')
                const cardinalIndex = CARDINAL_ORDER.indexOf(cardinal)
                if (cardinalIndex !== -1) {
                    const next = CARDINAL_ORDER[(cardinalIndex + 1) % CARDINAL_ORDER.length]
                    if (trySetState('minecraft:cardinal_direction', 'cardinal_direction', next)) {
                        changed = true
                    } else {
                        // Continue trying facing_direction fallback.
                    }
                }

                if (!changed) {
                    const facing = readState('minecraft:facing_direction', 'facing_direction')
                    if (facing === undefined || facing === null || facing === 'undefined') {
                        const directionRaw = readState('minecraft:weirdo_direction', 'weirdo_direction')
                        if (directionRaw !== undefined && directionRaw !== null) {
                            const direction = typeof directionRaw === 'string' ? Number(directionRaw) : directionRaw
                            const currentIndex = weirdoDirection.indexOf(direction)
                            const safeIndex = currentIndex === -1 ? 0 : currentIndex
                            const next = weirdoDirection[(safeIndex + 1) % weirdoDirection.length]
                            if (trySetState('minecraft:weirdo_direction', 'weirdo_direction', next)) {
                                changed = true
                            }
                        }
                        if (!changed) {
                            // No valid weirdo_direction rotation.
                        }
                    }
                    const facingIndex = ROTATION_ORDER.indexOf(facing)
                    if (!changed && facingIndex !== -1) {
                        const next = ROTATION_ORDER[(facingIndex + 1) % ROTATION_ORDER.length]
                        if (trySetState('minecraft:facing_direction', 'facing_direction', next)) {
                            changed = true
                        } else {
                            // No valid rotation.
                        }
                    }
                }
            } else {
                // Parse current block variant state from suffix.
                const currentTypeId = block.typeId
                const currentNamespace = currentTypeId?.includes(':') ? currentTypeId.split(':')[0] : 'minecraft'
                let rawName = currentTypeId?.includes(':') ? currentTypeId.split(':').slice(1).join(':') : String(currentTypeId)

                // Exception: vanilla stone stores subtype in state/data, so read and map a virtual base name.
                if (currentTypeId === 'minecraft:stone') {
                    const stoneTypeState = block.permutation?.getState('stone_type')
                        ?? block.permutation?.getState('minecraft:stone_type')
                    const mappedStoneName = STONE_TYPE_ALIAS[String(stoneTypeState ?? '').toLowerCase()]
                    if (!mappedStoneName) {
                        return
                    }
                    rawName = mappedStoneName
                }

                let currentState = 'default'
                let baseName = rawName
                if (rawName.endsWith('_vertical_slab')) {
                    currentState = 'vertical_slab'
                    baseName = rawName.slice(0, -'_vertical_slab'.length)
                } else if (rawName.endsWith('_stairs')) {
                    currentState = 'stairs'
                    baseName = rawName.slice(0, -'_stairs'.length)
                } else if (rawName.endsWith('_slab')) {
                    currentState = 'slab'
                    baseName = rawName.slice(0, -'_slab'.length)
                }

                // Build target state sequence (locked state or normal cycle order).
                const stateSequence = lock?.state
                    ? [lock.state]
                    : (() => {
                        const index = STATE_ORDER.indexOf(currentState)
                        if (index < 0) return STATE_ORDER.slice()
                        const nextStates = []
                        for (let offset = 1; offset <= STATE_ORDER.length; offset += 1) {
                            nextStates.push(STATE_ORDER[(index + offset) % STATE_ORDER.length])
                        }
                        return nextStates
                    })()

                // Try every candidate and skip invalid variants automatically.
                for (const targetState of stateSequence) {
                    const suffix = STATE_SUFFIX[targetState] ?? ''
                    const namespaces = getCompatibleNamespaces(currentNamespace)
                    const candidates = []
                    const seen = new Set()
                    const nameCandidates = []
                    const pushName = value => {
                        if (!value || nameCandidates.includes(value)) return
                        nameCandidates.push(value)
                    }

                    // Default path for all materials.
                    pushName(`${baseName}${suffix}`)

                    // Wood special-case: many blocks are *_planks but variants are *_stairs/*_slab.
                    if (baseName.endsWith('_planks')) {
                        const planksFreeBase = baseName.slice(0, -'_planks'.length)
                        pushName(`${planksFreeBase}${suffix}`)
                    }

                    // Reverse wood fallback: from stairs/slabs back to *_planks on default state.
                    if (targetState === 'default' && !baseName.endsWith('_planks') && isLikelyWoodBaseName(baseName)) {
                        pushName(`${baseName}_planks`)
                    }

                    const push = value => {
                        if (!value || seen.has(value)) return
                        seen.add(value)
                        candidates.push(value)
                    }

                    for (const targetName of nameCandidates) {
                        for (const ns of namespaces) {
                            push(`${ns}:${targetName}`)
                        }
                    }

                    if (targetState === 'vertical_slab') {
                        for (const targetName of nameCandidates) {
                            push(`dorios_atelier:${targetName}`)
                            push(`utilitycraft:${targetName}`)
                        }
                    }

                    for (const candidate of candidates) {
                        if (candidate === block.typeId) continue
                        try {
                            block.setType(candidate)
                            changed = true
                            break
                        } catch {
                            // Try next candidate.
                        }
                    }

                    if (changed) break
                }
            }

            // Play feedback + durability only when a change was applied.
            if (changed) {
                playToolMaterialSound({
                    typeId: interactedTypeId,
                    dimension: block.dimension,
                    location: block.location
                }, source, soundConfig.toolUseFallbackEventByKind.hammer)
                damageHeldHammer(source, itemStack)
            }
        }
    }

    for (const componentId of FURNITURE_HAMMER_COMPONENT_IDS) {
        try {
            initEvent.itemComponentRegistry.registerCustomComponent(componentId, handlers)
        } catch {
            // Ignore duplicated registration in hot-reload scenarios.
        }
    }
})

// Cancel native durability damage because this tool handles durability manually.
world?.beforeEvents?.itemComponentBeforeDurabilityDamage?.subscribe?.(event => {
    const stack = event?.itemStack
    if (!stack?.typeId || !stack.typeId.endsWith(FURNITURE_HAMMER_ID_SUFFIX)) {
        return
    }

    const hasKnownNamespace = TOOL_NAMESPACES.some(namespace => stack.typeId.startsWith(`${namespace}:`))
    if (!hasKnownNamespace) {
        return
    }

    event.cancel = true
})
