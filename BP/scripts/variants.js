/**
 * Variants - variants.js
 * Contains the material cycle definitions for the chisel and stairs, as well as the block alias map for Insight.
 */
const BASE_CYCLES = [
  [
    // Andesite
    "minecraft:polished_andesite",
    "dorios_atelier:andesite_bricks",
    "dorios_atelier:andesite_tiles",
    "dorios_atelier:chiseled_andesite",
    "dorios_atelier:chiseled_andesite_bricks"
  ],
  [
    // Basalt
    "minecraft:polished_basalt",
    "dorios_atelier:basalt_bricks",
    "dorios_atelier:basalt_tiles",
    "dorios_atelier:chiseled_basalt",
    "dorios_atelier:carved_basalt"
  ],
  [
    // Blackstone
    "minecraft:polished_blackstone",
    "minecraft:polished_blackstone_bricks",
    "minecraft:chiseled_blackstone",
    "dorios_atelier:blackstone_tiles",
    "dorios_atelier:chiseled_blackstone"
  ],
  [
    // Calcite
    "dorios_atelier:polished_calcite",
    "dorios_atelier:calcite_bricks",
    "dorios_atelier:calcite_tiles",
    "dorios_atelier:chiseled_calcite",
    "dorios_atelier:chiseled_calcite_bricks"
  ],
  [
    // Deepslate
    "minecraft:polished_deepslate",
    "minecraft:deepslate_bricks",
    "minecraft:deepslate_tiles",
    "minecraft:chiseled_deepslate"
  ],
  [
    // Diorite
    "minecraft:polished_diorite",
    "dorios_atelier:diorite_bricks",
    "dorios_atelier:diorite_tiles",
    "dorios_atelier:chiseled_diorite",
    "dorios_atelier:chiseled_diorite_bricks"
  ],
  [
    // Dripstone
    "dorios_atelier:polished_dripstone",
    "dorios_atelier:dripstone_bricks",
    "dorios_atelier:dripstone_tiles",
    "dorios_atelier:chiseled_dripstone",
    "dorios_atelier:chiseled_dripstone_bricks"
  ],
  [
    // Granite
    "minecraft:polished_granite",
    "dorios_atelier:granite_bricks",
    "dorios_atelier:granite_tiles",
    "dorios_atelier:chiseled_granite",
    "dorios_atelier:chiseled_granite_bricks"
  ],
  [
    // Stone
    "minecraft:stone",
    "minecraft:stone_bricks",
    "minecraft:chiseled_stone_bricks"
  ],
  [
    // Tuff
    "minecraft:polished_tuff",
    "minecraft:tuff_bricks",
    "dorios_atelier:tuff_tiles",
    "minecraft:chiseled_tuff",
    "minecraft:chiseled_tuff_bricks"
  ],
  [
    // Dirt
    "minecraft:dirt",
    "minecraft:coarse_dirt",
    "minecraft:dirt_with_roots",
  ],
  [
    // Grass
    "minecraft:grass_block",
    "dorios_atelier:snowy_grass_block",
    "minecraft:grass_path",
    "minecraft:farmland",
    "minecraft:podzol",
    "minecraft:mycelium"
  ]
];

const OBSIDIAN_CYCLE = [
  "minecraft:obsidian",
  "dorios_atelier:polished_obsidian",
  "dorios_atelier:obsidian_bricks",
  "dorios_atelier:obsidian_tiles",
  "dorios_atelier:obsidian_pillar",
  "dorios_atelier:chiseled_obsidian",
  "dorios_atelier:glowing_obsidian"
];

const WOOD_VARIANTS = [
  {
    log: "minecraft:stripped_acacia_log",
    wood: "minecraft:stripped_acacia_wood",
    sanded: "dorios_atelier:sanded_acacia_wood"
  },
  {
    log: "minecraft:stripped_bamboo_block",
    wood: "minecraft:stripped_bamboo_block",
    sanded: "dorios_atelier:sanded_bamboo_wood"
  },
  {
    log: "minecraft:stripped_birch_log",
    wood: "minecraft:stripped_birch_wood",
    sanded: "dorios_atelier:sanded_birch_wood"
  },
  {
    log: "minecraft:stripped_cherry_log",
    wood: "minecraft:stripped_cherry_wood",
    sanded: "dorios_atelier:sanded_cherry_wood"
  },
  {
    log: "minecraft:stripped_crimson_stem",
    wood: "minecraft:stripped_crimson_hyphae",
    sanded: "dorios_atelier:sanded_crimson_wood"
  },
  {
    log: "minecraft:stripped_dark_oak_log",
    wood: "minecraft:stripped_dark_oak_wood",
    sanded: "dorios_atelier:sanded_dark_oak_wood"
  },
  {
    log: "minecraft:stripped_jungle_log",
    wood: "minecraft:stripped_jungle_wood",
    sanded: "dorios_atelier:sanded_jungle_wood"
  },
  {
    log: "minecraft:stripped_mangrove_log",
    wood: "minecraft:stripped_mangrove_wood",
    sanded: "dorios_atelier:sanded_mangrove_wood"
  },
  {
    log: "minecraft:stripped_oak_log",
    wood: "minecraft:stripped_oak_wood",
    sanded: "dorios_atelier:sanded_oak_wood"
  },
  {
    log: "minecraft:stripped_pale_oak_log",
    wood: "minecraft:stripped_pale_oak_wood",
    sanded: "dorios_atelier:sanded_pale_oak_wood"
  },
  {
    log: "minecraft:stripped_spruce_log",
    wood: "minecraft:stripped_spruce_wood",
    sanded: "dorios_atelier:sanded_spruce_wood"
  },
  {
    log: "minecraft:stripped_warped_stem",
    wood: "minecraft:stripped_warped_hyphae",
    sanded: "dorios_atelier:sanded_warped_wood"
  }
];

const WOOD_CYCLES = WOOD_VARIANTS.map(({ log, wood, sanded }) => [log, wood, sanded]);

export const MATERIAL_CYCLES = [...BASE_CYCLES, OBSIDIAN_CYCLE, ...WOOD_CYCLES];

export const BLOCK_ALIAS = new Map([
  ["minecraft:calcite", "dorios_atelier:polished_calcite"],
  ["minecraft:dripstone_block", "dorios_atelier:polished_dripstone"],
  ["minecraft:tuff", "minecraft:polished_tuff"],
  ["minecraft:tuff_bricks", "dorios_atelier:tuff_bricks"],
  ["dorios_atelier:tuff_tiles", "dorios_atelier:tuff_tiles"],
  ["minecraft:chiseled_tuff", "dorios_atelier:chiseled_tuff"],
  ["minecraft:chiseled_polished_blackstone", "dorios_atelier:chiseled_blackstone"]
]);

globalThis.InsightAtelierVariants = Object.freeze({
  MATERIAL_CYCLES,
  BLOCK_ALIAS
});
