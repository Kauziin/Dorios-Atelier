import { readFile } from "node:fs/promises";
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
  LOCALES,
  localeFileName,
  TOOL_TRANSLATIONS,
  updateLang,
} from "./lib/localization.mjs";

const WRITE = process.argv.includes("--write");
const CHECK = process.argv.includes("--check");
const NAMESPACE = "dorios_atelier";

const TIERS = Object.freeze([
  { name: "wooden", material: { tag: "minecraft:planks" }, unlock: "minecraft:stick", durability: 59, enchantability: 15, speed: 6 },
  { name: "stone", material: { item: "minecraft:cobblestone" }, unlock: "minecraft:cobblestone", durability: 131, enchantability: 5, speed: 7 },
  { name: "copper", material: { item: "minecraft:copper_ingot" }, unlock: "minecraft:copper_ingot", durability: 191, enchantability: 14, speed: 8 },
  { name: "iron", material: { item: "minecraft:iron_ingot" }, unlock: "minecraft:iron_ingot", durability: 250, enchantability: 12, speed: 8 },
  { name: "golden", material: { item: "minecraft:gold_ingot" }, unlock: "minecraft:gold_ingot", durability: 32, enchantability: 22, speed: 12, textureTier: "gold" },
  { name: "diamond", material: { item: "minecraft:diamond" }, unlock: "minecraft:diamond", durability: 1561, enchantability: 10, speed: 10 },
  { name: "netherite", material: { item: "minecraft:netherite_ingot" }, unlock: "minecraft:netherite_ingot", durability: 2031, enchantability: 15, speed: 11 },
]);

const PATHS = Object.freeze({
  itemTexture: path.join(PROJECT_ROOT, "RP", "textures", "item_texture.json"),
  itemCatalog: path.join(PROJECT_ROOT, "BP", "item_catalog", "crafting_item_catalog.json"),
  locales: LOCALES.map((locale) => path.join(PROJECT_ROOT, "RP", "texts", localeFileName(locale))),
});

const changes = new Map();

function queueJson(file, current, next) {
  if (stableJson(current) !== stableJson(next)) changes.set(file, { type: "json", value: next });
}

function cutterItem(tier) {
  return {
    format_version: "1.21.100",
    "minecraft:item": {
      description: {
        identifier: `${NAMESPACE}:${tier.name}_glass_cutter`,
        menu_category: { category: "equipment" },
      },
      components: {
        "minecraft:max_stack_size": 1,
        "minecraft:hand_equipped": true,
        "minecraft:enchantable": { slot: "g_tool", value: tier.enchantability },
        "minecraft:durability": { max_durability: tier.durability },
        "minecraft:icon": `utilitycraft_${tier.name}_glass_cutter`,
        "dorios_atelier:glass_cutter": {},
        "minecraft:digger": {
          use_efficiency: true,
          destroy_speeds: [
            {
              block: { tags: "q.any_tag('dorios_atelier:breakable_by_cutter')" },
              speed: tier.speed,
            },
            { block: { tags: "q.any_tag('glass')" }, speed: tier.speed },
            { block: "minecraft:glass", speed: tier.speed },
            { block: "minecraft:glass_pane", speed: tier.speed },
            { block: "minecraft:tinted_glass", speed: tier.speed },
            { block: "minecraft:stained_glass", speed: tier.speed },
            { block: "minecraft:stained_glass_pane", speed: tier.speed },
          ],
        },
      },
    },
  };
}

function shapedRecipe(identifier, pattern, key, result, unlock) {
  return {
    format_version: "1.21.100",
    "minecraft:recipe_shaped": {
      description: { identifier },
      tags: ["crafting_table"],
      pattern,
      key,
      result: { item: result },
      unlock: [{ item: unlock }],
    },
  };
}

for (const tier of TIERS) {
  const cutterPath = path.join(PROJECT_ROOT, "BP", "items", "glass_cutter", `${tier.name}_glass_cutter.json`);
  let currentCutter = {};
  try { currentCutter = await readJson(cutterPath); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  queueJson(cutterPath, currentCutter, cutterItem(tier));

  const hammerPath = path.join(PROJECT_ROOT, "BP", "items", "furniture_hammer", `${tier.name}_furniture_hammer.json`);
  const hammer = await readJson(hammerPath);
  const nextHammer = structuredClone(hammer);
  nextHammer["minecraft:item"].components["minecraft:icon"] = `utilitycraft_${tier.name}_furniture_hammer`;
  queueJson(hammerPath, hammer, nextHammer);

  const cutterRecipePath = path.join(PROJECT_ROOT, "BP", "recipes", "crafting_table", "equipment", `${tier.name}_glass_cutter.json`);
  const cutterRecipe = shapedRecipe(
    `${NAMESPACE}:craft_${tier.name}_glass_cutter`,
    ["  M", " W ", "S  "],
    {
      M: tier.material,
      W: { tag: "minecraft:logs" },
      S: { item: "minecraft:stick" },
    },
    `${NAMESPACE}:${tier.name}_glass_cutter`,
    tier.unlock,
  );
  let oldCutterRecipe = {};
  try { oldCutterRecipe = await readJson(cutterRecipePath); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  queueJson(cutterRecipePath, oldCutterRecipe, cutterRecipe);

  const hammerRecipePath = path.join(PROJECT_ROOT, "BP", "recipes", "crafting_table", "equipment", `${tier.name}_furniture_hammer.json`);
  const hammerRecipe = shapedRecipe(
    `${NAMESPACE}:craft_${tier.name}_furniture_hammer`,
    ["MMM", "MSM", " S "],
    { M: tier.material, S: { item: "minecraft:stick" } },
    `${NAMESPACE}:${tier.name}_furniture_hammer`,
    tier.unlock,
  );
  let oldHammerRecipe = {};
  try { oldHammerRecipe = await readJson(hammerRecipePath); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  queueJson(hammerRecipePath, oldHammerRecipe, hammerRecipe);
}

const textureAtlas = await readJson(PATHS.itemTexture);
const nextTextureAtlas = structuredClone(textureAtlas);
for (const tier of TIERS) {
  const textureTier = tier.textureTier ?? tier.name;
  nextTextureAtlas.texture_data[`utilitycraft_${tier.name}_glass_cutter`] = {
    textures: `textures/items/${textureTier}_glass_cutter`,
  };
  nextTextureAtlas.texture_data[`utilitycraft_${tier.name}_furniture_hammer`] = {
    textures: `textures/items/${textureTier}_furniture_hammer`,
  };
}
queueJson(PATHS.itemTexture, textureAtlas, nextTextureAtlas);

const catalog = await readJson(PATHS.itemCatalog);
const nextCatalog = structuredClone(catalog);
const groups = nextCatalog["minecraft:crafting_items_catalog"]?.categories?.flatMap((category) => category.groups ?? []) ?? [];
const cutterGroup = groups.find((group) => group.group_identifier?.name === "dorios_atelier:itemGroup.name.glassCutters");
const hammerGroup = groups.find((group) => group.group_identifier?.name === "dorios_atelier:itemGroup.name.furnitureHammers");
if (!cutterGroup || !hammerGroup) throw new Error("Tool catalog groups were not found.");
const catalogTiers = [...TIERS].reverse();
cutterGroup.items = catalogTiers.map((tier) => `${NAMESPACE}:${tier.name}_glass_cutter`);
hammerGroup.items = catalogTiers.map((tier) => `${NAMESPACE}:${tier.name}_furniture_hammer`);
queueJson(PATHS.itemCatalog, catalog, nextCatalog);

for (const localePath of PATHS.locales) {
  const locale = path.basename(localePath, ".lang");
  const translation = TOOL_TRANSLATIONS[locale];
  const current = await readFile(localePath, "utf8");
  const updates = new Map();
  for (const tier of TIERS) {
    updates.set(`item.${NAMESPACE}:${tier.name}_glass_cutter`, translation.format(translation.cutter, translation.materials[tier.name]));
  }
  for (const tier of TIERS) {
    updates.set(`item.${NAMESPACE}:${tier.name}_furniture_hammer`, translation.format(translation.hammer, translation.materials[tier.name]));
  }
  const next = updateLang(current, updates);
  if (next !== current.replace(/\r\n/g, "\n")) changes.set(localePath, { type: "text", value: next });
}

console.log(`${WRITE ? "Applying" : "Previewing"} tool generation: ${changes.size} file(s).`);
for (const file of [...changes.keys()].sort()) console.log(`- ${projectPath(file)}`);

if (WRITE) {
  for (const [file, change] of changes) {
    if (change.type === "json") await writeJson(file, change.value);
    else await writeText(file, change.value);
  }
}
if (CHECK && changes.size > 0) process.exitCode = 1;
