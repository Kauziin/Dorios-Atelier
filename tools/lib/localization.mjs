export const LOCALES = Object.freeze([
  "en_US",
  "pt_BR",
  "pt_PT",
  "es_ES",
  "es_MX",
]);

const LANGUAGE_ORDER = new Map(LOCALES.map((locale, index) => [locale, index]));

const GLASS = Object.freeze({
  en_US: {
    colors: {
      black: "Black", blue: "Blue", brown: "Brown", cyan: "Cyan", gray: "Gray",
      green: "Green", light_blue: "Light Blue", lima: "Lime", magenta: "Magenta",
      orange: "Orange", pink: "Pink", purple: "Purple", red: "Red",
      silver: "Light Gray", white: "White", yellow: "Yellow",
    },
    styles: {
      broadline: "Broadline Glass", clean: "Clean Glass", clear: "Clear Glass",
      hitch_cross: "Cross-Braced Glass", stained: "Stained Glass", tempered: "Tempered Glass",
    },
    colored: (style, color) => `${color} ${style}`,
  },
  pt_BR: {
    colors: {
      black: "Preto", blue: "Azul", brown: "Marrom", cyan: "Ciano", gray: "Cinza",
      green: "Verde", light_blue: "Azul-claro", lima: "Verde-limão", magenta: "Magenta",
      orange: "Laranja", pink: "Rosa", purple: "Roxo", red: "Vermelho",
      silver: "Cinza-claro", white: "Branco", yellow: "Amarelo",
    },
    styles: {
      broadline: "Vidro de Borda Larga", clean: "Vidro Limpo", clear: "Vidro Transparente",
      hitch_cross: "Vidro com Travessas", stained: "Vidro Tingido", tempered: "Vidro Temperado",
    },
    colored: (style, color, styleId) => styleId === "stained" ? `${style} de ${color}` : `${style} ${color}`,
  },
  pt_PT: {
    colors: {
      black: "Preto", blue: "Azul", brown: "Castanho", cyan: "Ciano", gray: "Cinzento",
      green: "Verde", light_blue: "Azul-claro", lima: "Verde-lima", magenta: "Magenta",
      orange: "Cor de Laranja", pink: "Cor-de-rosa", purple: "Roxo", red: "Vermelho",
      silver: "Cinzento-claro", white: "Branco", yellow: "Amarelo",
    },
    styles: {
      broadline: "Vidro de Borda Larga", clean: "Vidro Límpido", clear: "Vidro Transparente",
      hitch_cross: "Vidro com Travessas", stained: "Vidro Tingido", tempered: "Vidro Temperado",
    },
    colored: (style, color, styleId) => styleId === "stained" ? `${style} de ${color}` : `${style} ${color}`,
  },
  es_ES: {
    colors: {
      black: "Negro", blue: "Azul", brown: "Marrón", cyan: "Cian", gray: "Gris",
      green: "Verde", light_blue: "Azul Claro", lima: "Verde Lima", magenta: "Magenta",
      orange: "Naranja", pink: "Rosa", purple: "Morado", red: "Rojo",
      silver: "Gris Claro", white: "Blanco", yellow: "Amarillo",
    },
    styles: {
      broadline: "Cristal de Borde Ancho", clean: "Cristal Limpio", clear: "Cristal Transparente",
      hitch_cross: "Cristal con Travesaños", stained: "Cristal Tintado", tempered: "Cristal Templado",
    },
    colored: (style, color, styleId) => styleId === "stained" ? `${style} de ${color}` : `${style} ${color}`,
  },
  es_MX: {
    colors: {
      black: "Negro", blue: "Azul", brown: "Café", cyan: "Cian", gray: "Gris",
      green: "Verde", light_blue: "Azul Claro", lima: "Verde Lima", magenta: "Magenta",
      orange: "Naranja", pink: "Rosa", purple: "Morado", red: "Rojo",
      silver: "Gris Claro", white: "Blanco", yellow: "Amarillo",
    },
    styles: {
      broadline: "Vidrio de Borde Ancho", clean: "Vidrio Limpio", clear: "Vidrio Transparente",
      hitch_cross: "Vidrio con Travesaños", stained: "Vidrio Teñido", tempered: "Vidrio Templado",
    },
    colored: (style, color, styleId) => styleId === "stained" ? `${style} de ${color}` : `${style} ${color}`,
  },
});

export function localeFileName(locale) {
  if (!LANGUAGE_ORDER.has(locale)) throw new Error(`Unsupported locale: ${locale}`);
  return `${locale}.lang`;
}

export function parseLang(text) {
  const entries = new Map();
  for (const rawLine of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) throw new Error(`Invalid .lang line: ${rawLine}`);
    entries.set(line.slice(0, separator), line.slice(separator + 1));
  }
  return entries;
}

function entrySection(key) {
  if (key.startsWith("item.")) return 0;
  if (key.startsWith("tile.")) return 1;
  return 2;
}

function alphabeticalKey(key) {
  const item = key.match(/^item\.[^:]+:(.+)$/);
  if (item) return item[1];
  const block = key.match(/^tile\.[^:]+:(.+)\.name$/);
  return block?.[1] ?? key;
}

export function serializeLang(entries) {
  const lines = [...entries]
    .sort(([left], [right]) => entrySection(left) - entrySection(right)
      || alphabeticalKey(left).localeCompare(alphabeticalKey(right), "en", { sensitivity: "base" }))
    .map(([key, value]) => `${key}=${value}`);
  return `${lines.join("\n")}\n`;
}

export function updateLang(text, updates, removals = []) {
  const entries = parseLang(text);
  for (const key of removals) entries.delete(key);
  for (const [key, value] of updates) entries.set(key, value.replaceAll("\n", "\\n"));
  return serializeLang(entries);
}

export function glassBlockName(identifier, locale) {
  const match = identifier.match(/^(?:(black|blue|brown|cyan|gray|green|light_blue|lima|magenta|orange|pink|purple|red|silver|white|yellow)_)?(broadline|clean|clear|hitch_cross|stained|tempered)_glass$/);
  if (!match) throw new Error(`Unknown glass identifier: ${identifier}`);
  const [, colorId, styleId] = match;
  const language = GLASS[locale];
  if (!language) throw new Error(`Glass translations are unavailable for ${locale}.`);
  const style = language.styles[styleId];
  return colorId ? language.colored(style, language.colors[colorId], styleId) : style;
}

export const TOOL_TRANSLATIONS = Object.freeze({
  en_US: {
    materials: { wooden: "Wooden", stone: "Stone", copper: "Copper", iron: "Iron", golden: "Golden", diamond: "Diamond", netherite: "Netherite" },
    chisel: "Chisel", glove: "Glove", cutter: "Glass Cutter", hammer: "Furniture Hammer",
    format: (tool, material) => `${material} ${tool}`,
  },
  pt_BR: {
    materials: { wooden: "Madeira", stone: "Pedra", copper: "Cobre", iron: "Ferro", golden: "Ouro", diamond: "Diamante", netherite: "Netherita" },
    chisel: "Cinzel", glove: "Luva", cutter: "Cortador de Vidro", hammer: "Martelo de Móveis",
    format: (tool, material) => `${tool} de ${material}`,
  },
  pt_PT: {
    materials: { wooden: "Madeira", stone: "Pedra", copper: "Cobre", iron: "Ferro", golden: "Ouro", diamond: "Diamante", netherite: "Netherite" },
    chisel: "Cinzel", glove: "Luva", cutter: "Corta-vidros", hammer: "Martelo de Mobiliário",
    format: (tool, material) => `${tool} de ${material}`,
  },
  es_ES: {
    materials: { wooden: "Madera", stone: "Piedra", copper: "Cobre", iron: "Hierro", golden: "Oro", diamond: "Diamante", netherite: "Netherita" },
    chisel: "Cincel", glove: "Guante", cutter: "Cortador de Cristal", hammer: "Martillo de Mobiliario",
    format: (tool, material) => `${tool} de ${material}`,
  },
  es_MX: {
    materials: { wooden: "Madera", stone: "Piedra", copper: "Cobre", iron: "Hierro", golden: "Oro", diamond: "Diamante", netherite: "Netherita" },
    chisel: "Cincel", glove: "Guante", cutter: "Cortador de Vidrio", hammer: "Martillo para Muebles",
    format: (tool, material) => `${tool} de ${material}`,
  },
});

const ITEM_COLORS = Object.freeze({
  copper: "§v",
  diamond: "§b",
  golden: "§g",
  iron: "§i",
  netherite: "§j",
});

export function itemName(identifier, locale) {
  const match = identifier.match(/^(wooden|stone|copper|iron|golden|diamond|netherite)_(chisel|glove|glass_cutter|furniture_hammer)$/);
  if (!match) throw new Error(`No ${locale} item translation rule for ${identifier}.`);
  const [, tier, toolId] = match;
  const language = TOOL_TRANSLATIONS[locale];
  const tool = toolId === "glass_cutter" ? language.cutter
    : toolId === "furniture_hammer" ? language.hammer
      : language[toolId];
  const material = language.materials[tier];
  if (toolId === "glass_cutter" || toolId === "furniture_hammer" || tier === "wooden") {
    return language.format(tool, material);
  }
  const color = tier === "stone" ? (toolId === "chisel" ? "§h" : "§7") : ITEM_COLORS[tier];
  return locale === "en_US"
    ? `${color}${material} §r${tool}`
    : `${tool} de ${color}${material}§r`;
}

export const WALL_TRANSLATIONS = Object.freeze({
  en_US: { group: "Walls", name: (base) => `${base} Wall` },
  pt_BR: { group: "Muros", name: (base) => `Muro de ${base}` },
  pt_PT: { group: "Muros", name: (base) => `Muro de ${base}` },
  es_ES: { group: "Muros", name: (base) => `Muro de ${base}` },
  es_MX: { group: "Muros", name: (base) => `Muro de ${base}` },
});

const BLOCK_LANGUAGES = Object.freeze({
  en_US: {
    materials: {
      andesite: "Andesite", basalt: "Basalt", blackstone: "Blackstone", calcite: "Calcite",
      deepslate: "Deepslate", diorite: "Diorite", dripstone: "Dripstone", granite: "Granite",
      mud: "Mud", nether: "Nether", netherrack: "Netherrack", obsidian: "Obsidian",
      prismarine: "Prismarine", quartz: "Quartz", stone: "Stone", tuff: "Tuff",
    },
    specials: {
      cobblestone: "Cobblestone", cobbled_deepslate: "Cobbled Deepslate",
      dark_prismarine: "Dark Prismarine", packed_mud: "Packed Mud",
      purpur_block: "Purpur Block", snowy_grass_block: "Snowy Grass Block",
    },
    modifiers: {
      carved: "Carved", chiseled: "Chiseled", cracked: "Cracked", gilded: "Gilded",
      glowing: "Glowing", mossy: "Mossy", polished: "Polished", smooth: "Smooth",
    },
    modified: (modifier, base) => ({ text: `${modifier} ${base.text}`, gender: base.gender, plural: base.plural }),
    bricks: (base, stem) => ({ text: stem === "nether" ? "Nether Bricks" : `${base.text} Bricks`, gender: "m", plural: true }),
    tiles: (base) => ({ text: `${base.text} Tiles`, gender: "m", plural: true }),
    pillar: (base) => ({ text: `${base.text} Pillar`, gender: "m", plural: false }),
    shapes: {
      slab: (base) => `${base} Slab`, stairs: (base) => `${base} Stairs`,
      vertical_slab: (base) => `${base} Vertical Slab`, wall: (base) => `${base} Wall`,
    },
    woods: {
      acacia: "Sanded Acacia Wood", bamboo: "Sanded Bamboo Wood", birch: "Sanded Birch Wood",
      cherry: "Sanded Cherry Wood", crimson: "Sanded Crimson Wood", dark_oak: "Sanded Dark Oak Wood",
      jungle: "Sanded Jungle Wood", mangrove: "Sanded Mangrove Wood", oak: "Sanded Oak Wood",
      pale_oak: "Sanded Pale Oak Wood", spruce: "Sanded Spruce Wood", warped: "Sanded Warped Wood",
    },
  },
  pt_BR: {
    materials: {
      andesite: "Andesito", basalt: "Basalto", blackstone: "Pedra-Negra", calcite: "Calcita",
      deepslate: "Ardosiabissal", diorite: "Diorito", dripstone: "Espeleotema", granite: "Granito",
      mud: "Lama", nether: "Nether", netherrack: "Netherrack", obsidian: "Obsidiana",
      prismarine: "Prismarinho", quartz: "Quartzo", stone: "Pedra", tuff: "Tufo",
    },
    genders: { blackstone: "f", calcite: "f", deepslate: "f", mud: "f", obsidian: "f", stone: "f" },
    specials: {
      cobblestone: "Pedregulho", cobbled_deepslate: "Pedregulho de Ardosiabissal",
      dark_prismarine: "Prismarinho Escuro", packed_mud: "Lama Endurecida",
      purpur_block: "Bloco Púrpura", snowy_grass_block: "Bloco de Grama com Neve",
    },
    modifiers: {
      carved: ["Talhado", "Talhada", "Talhados", "Talhadas"],
      chiseled: ["Cinzelado", "Cinzelada", "Cinzelados", "Cinzeladas"],
      cracked: ["Rachado", "Rachada", "Rachados", "Rachadas"],
      gilded: ["Dourado", "Dourada", "Dourados", "Douradas"],
      glowing: ["Luminoso", "Luminosa", "Luminosos", "Luminosas"],
      mossy: ["Musgoso", "Musgosa", "Musgosos", "Musgosas"],
      polished: ["Polido", "Polida", "Polidos", "Polidas"],
      smooth: ["Liso", "Lisa", "Lisos", "Lisas"],
    },
    modified: (modifier, base) => ({ text: `${base.text} ${agree(modifier, base)}`, gender: base.gender, plural: base.plural }),
    bricks: (base, stem) => ({ text: stem === "nether" ? "Tijolos do Nether" : stem === "mud" ? "Tijolos de Barro" : `Tijolos de ${base.text}`, gender: "m", plural: true }),
    tiles: (base) => ({ text: `Ladrilhos de ${base.text}`, gender: "m", plural: true }),
    pillar: (base) => ({ text: `Pilar de ${base.text}`, gender: "m", plural: false }),
    shapes: {
      slab: (base) => `Laje de ${base}`, stairs: (base) => `Escada de ${base}`,
      vertical_slab: (base) => `Laje Vertical de ${base}`, wall: (base) => `Muro de ${base}`,
    },
    woods: {
      acacia: "Madeira de Acácia Lixada", bamboo: "Madeira de Bambu Lixada", birch: "Madeira de Bétula Lixada",
      cherry: "Madeira de Cerejeira Lixada", crimson: "Madeira Carmesim Lixada", dark_oak: "Madeira de Carvalho Escuro Lixada",
      jungle: "Madeira da Selva Lixada", mangrove: "Madeira de Mangue Lixada", oak: "Madeira de Carvalho Lixada",
      pale_oak: "Madeira de Carvalho Pálido Lixada", spruce: "Madeira de Abeto Lixada", warped: "Madeira Distorcida Lixada",
    },
  },
  pt_PT: {
    materials: {
      andesite: "Andesito", basalt: "Basalto", blackstone: "Pedra Negra", calcite: "Calcite",
      deepslate: "Ardósia", diorite: "Diorito", dripstone: "Espeleotema", granite: "Granito",
      mud: "Lama", nether: "Nether", netherrack: "Rocha do Nether", obsidian: "Obsidiana",
      prismarine: "Prismarine", quartz: "Quartzo", stone: "Pedra", tuff: "Tufo",
    },
    genders: { blackstone: "f", calcite: "f", deepslate: "f", mud: "f", obsidian: "f", stone: "f" },
    specials: {
      cobblestone: "Pedra Arredondada", cobbled_deepslate: "Ardósia Apedregulhada",
      dark_prismarine: "Prismarine Escuro", packed_mud: "Lama Embalada",
      purpur_block: "Bloco Púrpura", snowy_grass_block: "Bloco de Erva com Neve",
    },
    modifiers: {
      carved: ["Talhado", "Talhada", "Talhados", "Talhadas"],
      chiseled: ["Cinzelado", "Cinzelada", "Cinzelados", "Cinzeladas"],
      cracked: ["Rachado", "Rachada", "Rachados", "Rachadas"],
      gilded: ["Dourado", "Dourada", "Dourados", "Douradas"],
      glowing: ["Luminoso", "Luminosa", "Luminosos", "Luminosas"],
      mossy: ["Musgoso", "Musgosa", "Musgosos", "Musgosas"],
      polished: ["Polido", "Polida", "Polidos", "Polidas"],
      smooth: ["Liso", "Lisa", "Lisos", "Lisas"],
    },
    modified: (modifier, base) => ({ text: `${base.text} ${agree(modifier, base)}`, gender: base.gender, plural: base.plural }),
    bricks: (base, stem) => ({ text: stem === "nether" ? "Tijolos do Nether" : stem === "mud" ? "Tijolos de Lama" : `Tijolos de ${base.text}`, gender: "m", plural: true }),
    tiles: (base) => ({ text: `Ladrilhos de ${base.text}`, gender: "m", plural: true }),
    pillar: (base) => ({ text: `Pilar de ${base.text}`, gender: "m", plural: false }),
    shapes: {
      slab: (base) => `Laje de ${base}`, stairs: (base) => `Escadas de ${base}`,
      vertical_slab: (base) => `Laje Vertical de ${base}`, wall: (base) => `Muro de ${base}`,
    },
    woods: {
      acacia: "Madeira de Acácia Lixada", bamboo: "Madeira de Bambu Lixada", birch: "Madeira de Bétula Lixada",
      cherry: "Madeira de Cerejeira Lixada", crimson: "Madeira Carmesim Lixada", dark_oak: "Madeira de Carvalho Escuro Lixada",
      jungle: "Madeira da Selva Lixada", mangrove: "Madeira de Mangue Lixada", oak: "Madeira de Carvalho Lixada",
      pale_oak: "Madeira de Carvalho Pálido Lixada", spruce: "Madeira de Abeto Lixada", warped: "Madeira Distorcida Lixada",
    },
  },
  es_ES: spanishBlockLanguage({
    blackstone: "Rocanegra", deepslate: "Pizarra Abismal", grass: "Hierba",
    glass: "Cristal", mud: "Barro Compacto", nether: "Inframundo", tiles: "Baldosas",
  }),
  es_MX: spanishBlockLanguage({
    blackstone: "Piedra Negra", deepslate: "Pizarra Profunda", grass: "Pasto",
    glass: "Vidrio", mud: "Barro Empaquetado", nether: "Nether", tiles: "Losetas",
  }),
});

function agree(forms, base) {
  return forms[(base.plural ? 2 : 0) + (base.gender === "f" ? 1 : 0)];
}

function spanishBlockLanguage(regional) {
  return {
    materials: {
      andesite: "Andesita", basalt: "Basalto", blackstone: regional.blackstone, calcite: "Calcita",
      deepslate: regional.deepslate, diorite: "Diorita", dripstone: "Espeleotema", granite: "Granito",
      mud: "Lodo", nether: regional.nether, netherrack: "Infiedra", obsidian: "Obsidiana",
      prismarine: "Prismarina", quartz: "Cuarzo", stone: "Piedra", tuff: "Toba Volcánica",
    },
    genders: { andesite: "f", blackstone: "f", calcite: "f", deepslate: "f", diorite: "f", mud: "f", obsidian: "f", prismarine: "f", stone: "f", tuff: "f" },
    specials: {
      cobblestone: "Adoquín", cobbled_deepslate: `${regional.deepslate} Empedrada`,
      dark_prismarine: "Prismarina Oscura", packed_mud: regional.mud,
      purpur_block: "Bloque de Púrpura", snowy_grass_block: `Bloque de ${regional.grass} Nevado`,
    },
    modifiers: {
      carved: ["Tallado", "Tallada", "Tallados", "Talladas"],
      chiseled: ["Cincelado", "Cincelada", "Cincelados", "Cinceladas"],
      cracked: ["Agrietado", "Agrietada", "Agrietados", "Agrietadas"],
      gilded: ["Dorado", "Dorada", "Dorados", "Doradas"],
      glowing: ["Luminoso", "Luminosa", "Luminosos", "Luminosas"],
      mossy: ["Musgoso", "Musgosa", "Musgosos", "Musgosas"],
      polished: ["Pulido", "Pulida", "Pulidos", "Pulidas"],
      smooth: ["Liso", "Lisa", "Lisos", "Lisas"],
    },
    modified: (modifier, base) => ({ text: `${base.text} ${agree(modifier, base)}`, gender: base.gender, plural: base.plural }),
    bricks: (base, stem) => ({ text: stem === "nether" ? `Ladrillos del ${regional.nether}` : stem === "mud" ? "Ladrillos de Barro" : `Ladrillos de ${base.text}`, gender: "m", plural: true }),
    tiles: (base) => ({ text: `${regional.tiles} de ${base.text}`, gender: "f", plural: true }),
    pillar: (base) => ({ text: `Pilar de ${base.text}`, gender: "m", plural: false }),
    shapes: {
      slab: (base) => `Losa de ${base}`, stairs: (base) => `Escaleras de ${base}`,
      vertical_slab: (base) => `Losa Vertical de ${base}`, wall: (base) => `Muro de ${base}`,
    },
    woods: {
      acacia: "Madera de Acacia Lijada", bamboo: "Madera de Bambú Lijada", birch: "Madera de Abedul Lijada",
      cherry: "Madera de Cerezo Lijada", crimson: "Madera Carmesí Lijada", dark_oak: "Madera de Roble Oscuro Lijada",
      jungle: "Madera de Jungla Lijada", mangrove: "Madera de Mangle Lijada", oak: "Madera de Roble Lijada",
      pale_oak: "Madera de Roble Pálido Lijada", spruce: "Madera de Abeto Lijada", warped: "Madera Distorsionada Lijada",
    },
  };
}

function semanticBlock(identifier, locale) {
  const language = BLOCK_LANGUAGES[locale];
  if (language.specials[identifier]) return { text: language.specials[identifier], gender: "m", plural: false };

  const wood = identifier.match(/^sanded_(acacia|bamboo|birch|cherry|crimson|dark_oak|jungle|mangrove|oak|pale_oak|spruce|warped)_wood$/);
  if (wood) return { text: language.woods[wood[1]], gender: "f", plural: false };

  for (const modifierId of ["chiseled", "cracked", "polished", "smooth", "gilded", "glowing", "carved", "mossy"]) {
    if (identifier.startsWith(`${modifierId}_`)) {
      return language.modified(language.modifiers[modifierId], semanticBlock(identifier.slice(modifierId.length + 1), locale));
    }
  }

  for (const [suffix, formatter] of [["_bricks", "bricks"], ["_tiles", "tiles"], ["_pillar", "pillar"]]) {
    if (identifier.endsWith(suffix)) {
      const stem = identifier.slice(0, -suffix.length);
      return language[formatter](semanticBlock(stem, locale), stem);
    }
  }

  const material = language.materials[identifier];
  if (material) return { text: material, gender: language.genders?.[identifier] ?? "m", plural: false };
  throw new Error(`No ${locale} block translation rule for ${identifier}.`);
}

export function blockName(identifier, locale) {
  if (identifier.endsWith("_glass")) return glassBlockName(identifier, locale);
  const shapeMatch = identifier.match(/_(vertical_slab|stairs|slab|wall)$/);
  const shape = shapeMatch?.[1];
  const baseId = shape ? identifier.slice(0, -shapeMatch[0].length) : identifier;
  const base = semanticBlock(baseId, locale).text;
  return shape ? BLOCK_LANGUAGES[locale].shapes[shape](base) : base;
}

export const GROUP_TRANSLATIONS = Object.freeze({
  en_US: { chisels: "Chisels", customGlass: "Custom Glass", customVariants: "Custom Variants", furnitureHammers: "Furniture Hammers", glassCutters: "Glass Cutters", gloves: "Gloves", sandedWood: "Sanded Wood", stoneBricks: "Stonework", verticalSlabs: "Vertical Slabs", walls: "Walls" },
  pt_BR: { chisels: "Cinzeis", customGlass: "Vidros Personalizados", customVariants: "Variantes Personalizadas", furnitureHammers: "Martelos de Móveis", glassCutters: "Cortadores de Vidro", gloves: "Luvas de Construção", sandedWood: "Madeiras Lixadas", stoneBricks: "Trabalhos em Pedra", verticalSlabs: "Lajes Verticais", walls: "Muros" },
  pt_PT: { chisels: "Cinzéis", customGlass: "Vidros Personalizados", customVariants: "Variantes Personalizadas", furnitureHammers: "Martelos de Mobiliário", glassCutters: "Corta-vidros", gloves: "Luvas de Construção", sandedWood: "Madeiras Lixadas", stoneBricks: "Cantaria", verticalSlabs: "Lajes Verticais", walls: "Muros" },
  es_ES: { chisels: "Cinceles", customGlass: "Cristales Personalizados", customVariants: "Variantes Personalizadas", furnitureHammers: "Martillos de Mobiliario", glassCutters: "Cortadores de Cristal", gloves: "Guantes de Construcción", sandedWood: "Maderas Lijadas", stoneBricks: "Cantería", verticalSlabs: "Losas Verticales", walls: "Muros" },
  es_MX: { chisels: "Cinceles", customGlass: "Vidrios Personalizados", customVariants: "Variantes Personalizadas", furnitureHammers: "Martillos para Muebles", glassCutters: "Cortadores de Vidrio", gloves: "Guantes de Construcción", sandedWood: "Maderas Lijadas", stoneBricks: "Trabajo en Piedra", verticalSlabs: "Losas Verticales", walls: "Muros" },
});
