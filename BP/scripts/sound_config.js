// Central sound config for all tools.
// Add new sounds here first, then consume from scripts.

export const soundConfig = {
	defaultPlaybackOptions: { volume: 1, pitch: 1 },

	// Tool action sounds (use and break).
	toolUseFallbackEventByKind: {
		hammer: 'dig.wood',
		chisel: 'block.stonecutter.use',
		cutter: 'dig.glass'
	},
	toolBreakEventByKind: {
		hammer: 'random.break',
		chisel: 'random.break'
	},

	// Material resolver defaults.
	defaultMaterialEvent: 'block.stonecutter.use',
	exactMaterialEvents: [
		['minecraft:glass', 'dig.glass'],
		['minecraft:tinted_glass', 'dig.glass'],
		['minecraft:grass_block', 'dig.grass'],
		['minecraft:dirt', 'dig.grass'],
		['minecraft:coarse_dirt', 'dig.grass'],
		['minecraft:dirt_with_roots', 'dig.grass'],
		['minecraft:podzol', 'dig.grass'],
		['minecraft:mycelium', 'dig.grass'],
		['minecraft:farmland', 'dig.grass'],
		['minecraft:sand', 'dig.sand'],
		['minecraft:red_sand', 'dig.sand'],
		['minecraft:gravel', 'dig.gravel'],
		['minecraft:snow', 'dig.snow'],
		['minecraft:snow_block', 'dig.snow']
	],
	tokenMaterialRules: [
		{ event: 'dig.glass', tokens: ['glass'] },
		{
			event: 'dig.wood',
			tokens: [
				'wood',
				'log',
				'planks',
				'stripped',
				'hyphae',
				'stem',
				'bamboo',
				'oak',
				'spruce',
				'birch',
				'jungle',
				'acacia',
				'dark',
				'mangrove',
				'cherry',
				'crimson',
				'warped'
			]
		},
		{ event: 'dig.grass', tokens: ['dirt', 'grass', 'farmland', 'podzol', 'mycelium', 'mud'] },
		{ event: 'dig.sand', tokens: ['sand'] },
		{ event: 'dig.gravel', tokens: ['gravel'] },
		{ event: 'dig.snow', tokens: ['snow'] }
	]
}

const exactMaterialEventMap = new Map(soundConfig.exactMaterialEvents)

const stripNamespace = blockTypeId => {
	const parts = String(blockTypeId ?? '').split(':')
	return parts.length > 1 ? parts.slice(1).join(':') : parts[0]
}

const tokenSetFromTypeId = blockTypeId => {
	const stripped = stripNamespace(blockTypeId)
	return new Set(stripped.split('_').filter(Boolean))
}

export const resolveMaterialSoundEvent = blockTypeId => {
	if (!blockTypeId) return soundConfig.defaultMaterialEvent

	const exact = exactMaterialEventMap.get(blockTypeId)
	if (exact) return exact

	const tokens = tokenSetFromTypeId(blockTypeId)
	for (const rule of soundConfig.tokenMaterialRules) {
		if (rule.tokens.some(token => tokens.has(token))) {
			return rule.event
		}
	}

	return soundConfig.defaultMaterialEvent
}

export const playConfiguredSound = ({ block, source, soundEvent, fallbackSound }) => {
	const fallback = fallbackSound || soundConfig.defaultMaterialEvent
	const eventToPlay = soundEvent || fallback

	try {
		const dimension = block?.dimension
		if (dimension && typeof dimension.playSound === 'function') {
			dimension.playSound(eventToPlay, block.location, soundConfig.defaultPlaybackOptions)
			return eventToPlay
		}
		source?.playSound?.(eventToPlay)
		return eventToPlay
	} catch {
		try {
			source?.playSound?.(fallback)
		} catch {
			// Best effort only.
		}
		return fallback
	}
}

export const playToolMaterialSound = (block, source, fallbackSound = soundConfig.defaultMaterialEvent) => {
	const soundEvent = resolveMaterialSoundEvent(block?.typeId) || fallbackSound
	return playConfiguredSound({ block, source, soundEvent, fallbackSound })
}
