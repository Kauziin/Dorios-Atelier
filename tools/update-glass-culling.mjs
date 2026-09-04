import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  PROJECT_ROOT,
  projectPath,
  readJson,
  stableJson,
  writeJson,
  writeText,
} from "./lib/project-index.mjs";
import {
  glassBlockName,
  LOCALES,
  localeFileName,
  updateLang,
} from "./lib/localization.mjs";

const WRITE = process.argv.includes("--write");
const CHECK = process.argv.includes("--check");
const NAMESPACE = "dorios_atelier";
const CULLING_ID = "dorios_atelier:custom_glass";
const GEOMETRY_ID = "geometry.dorios_atelier_glass";
const PATHS = Object.freeze({
  textures: path.join(PROJECT_ROOT, "RP", "textures", "blocks", "glass"),
  blocks: path.join(PROJECT_ROOT, "BP", "blocks", "decorative", "entire_blocks", "Base"),
  blocksRegistry: path.join(PROJECT_ROOT, "RP", "blocks.json"),
  terrainTexture: path.join(PROJECT_ROOT, "RP", "textures", "terrain_texture.json"),
  catalog: path.join(PROJECT_ROOT, "BP", "item_catalog", "crafting_item_catalog.json"),
  culling: path.join(PROJECT_ROOT, "RP", "block_culling", "custom_glass.json"),
  geometry: path.join(PROJECT_ROOT, "RP", "models", "blocks", "glass.geo.json"),
  cullingTemplate: path.join(PROJECT_ROOT, "tools", "templates", "utilitycraft", "glass_culling.json"),
  geometryTemplate: path.join(PROJECT_ROOT, "tools", "templates", "utilitycraft", "glass.geo.json"),
  locales: LOCALES.map((locale) => path.join(PROJECT_ROOT, "RP", "texts", localeFileName(locale))),
});

const DURABILITY = Object.freeze({
  tempered: { seconds_to_destroy: 1.2, explosion_resistance: 6 },
  clean: { seconds_to_destroy: 0.12, explosion_resistance: 0.35 },
  clear: { seconds_to_destroy: 0.12, explosion_resistance: 0.35 },
  broadline: { seconds_to_destroy: 0.22, explosion_resistance: 0.7 },
  hitch_cross: { seconds_to_destroy: 0.28, explosion_resistance: 1 },
  stained: { seconds_to_destroy: 0.18, explosion_resistance: 0.5 },
});

const changes = new Map();

function queueJson(file, current, next) {
  if (stableJson(current) !== stableJson(next)) changes.set(file, { type: "json", value: next });
}

function glassProfile(name) {
  const marker = Object.keys(DURABILITY).find((candidate) => name.includes(candidate));
  return DURABILITY[marker] ?? { seconds_to_destroy: 0.2, explosion_resistance: 0.6 };
}

function glassBlock(name) {
  const profile = glassProfile(name);
  return {
    format_version: "1.21.100",
    "minecraft:block": {
      description: {
        identifier: `${NAMESPACE}:${name}`,
        menu_category: { category: "construction" },
      },
      components: {
        "minecraft:geometry": {
          identifier: GEOMETRY_ID,
          culling: CULLING_ID,
        },
        "minecraft:light_dampening": 0,
        "minecraft:light_emission": 0,
        "minecraft:material_instances": {
          "*": {
            texture: `${NAMESPACE}_${name}`,
            ambient_occlusion: 0.9,
            face_dimming: true,
            render_method: "blend",
          },
        },
        "minecraft:destructible_by_mining": { seconds_to_destroy: profile.seconds_to_destroy },
        "minecraft:destructible_by_explosion": { explosion_resistance: profile.explosion_resistance },
        "minecraft:loot": "loot_tables/empty.json",
        "tag:dorios_atelier:breakable_by_cutter": {},
      },
    },
  };
}

const textureNames = (await readdir(PATHS.textures, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".png") && !entry.name.includes("pane"))
  .map((entry) => path.basename(entry.name, ".png"))
  .sort((left, right) => left.localeCompare(right, "en"));

for (const name of textureNames) {
  const file = path.join(PATHS.blocks, `${name}.json`);
  let current = {};
  try { current = await readJson(file); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  queueJson(file, current, glassBlock(name));
}

const blocksRegistry = await readJson(PATHS.blocksRegistry);
const nextBlocksRegistry = structuredClone(blocksRegistry);
for (const name of textureNames) {
  nextBlocksRegistry[`${NAMESPACE}:${name}`] = {
    sound: "glass",
    textures: `${NAMESPACE}_${name}`,
  };
}
queueJson(PATHS.blocksRegistry, blocksRegistry, nextBlocksRegistry);

const terrainTexture = await readJson(PATHS.terrainTexture);
const nextTerrainTexture = structuredClone(terrainTexture);
nextTerrainTexture.texture_data ??= {};
for (const name of textureNames) {
  nextTerrainTexture.texture_data[`${NAMESPACE}_${name}`] = {
    textures: [`textures/blocks/glass/${name}`],
  };
}
queueJson(PATHS.terrainTexture, terrainTexture, nextTerrainTexture);

const culling = await readJson(PATHS.culling);
const nextCulling = await readJson(PATHS.cullingTemplate);
nextCulling["minecraft:block_culling_rules"].description.identifier = CULLING_ID;
queueJson(PATHS.culling, culling, nextCulling);

let geometry = {};
try { geometry = await readJson(PATHS.geometry); } catch (error) { if (error?.code !== "ENOENT") throw error; }
const nextGeometry = await readJson(PATHS.geometryTemplate);
nextGeometry["minecraft:geometry"][0].description.identifier = GEOMETRY_ID;
queueJson(PATHS.geometry, geometry, nextGeometry);

const catalog = await readJson(PATHS.catalog);
const nextCatalog = structuredClone(catalog);
const groups = nextCatalog["minecraft:crafting_items_catalog"]?.categories?.flatMap((category) => category.groups ?? []) ?? [];
const glassGroup = groups.find((group) => group.group_identifier?.name === `${NAMESPACE}:itemGroup.name.customGlass`);
if (!glassGroup) throw new Error("Custom glass catalog group was not found.");
glassGroup.group_identifier.icon = `${NAMESPACE}:clean_glass`;
glassGroup.items = textureNames.map((name) => `${NAMESPACE}:${name}`);
queueJson(PATHS.catalog, catalog, nextCatalog);

const GLASS_GROUP_NAMES = Object.freeze({
  en_US: "Custom Glass",
  pt_BR: "Vidros Personalizados",
  pt_PT: "Vidros Personalizados",
  es_ES: "Cristales Personalizados",
  es_MX: "Vidrios Personalizados",
});

for (const localePath of PATHS.locales) {
  const current = await readFile(localePath, "utf8");
  const locale = path.basename(localePath, ".lang");
  const updates = new Map([
    [`${NAMESPACE}:itemGroup.name.customGlass`, GLASS_GROUP_NAMES[locale]],
  ]);
  for (const name of textureNames) {
    const key = `tile.${NAMESPACE}:${name}.name`;
    updates.set(key, glassBlockName(name, locale));
  }
  const next = updateLang(current, updates);
  if (next !== current.replace(/\r\n/g, "\n")) changes.set(localePath, { type: "text", value: next });
}

console.log(`${WRITE ? "Applying" : "Previewing"} ${textureNames.length} connected-glass variants: ${changes.size} file(s).`);
for (const file of [...changes.keys()].sort()) console.log(`- ${projectPath(file)}`);

if (WRITE) {
  for (const [file, change] of changes) {
    if (change.type === "json") await writeJson(file, change.value);
    else await writeText(file, change.value);
  }
}
if (CHECK && changes.size > 0) process.exitCode = 1;
