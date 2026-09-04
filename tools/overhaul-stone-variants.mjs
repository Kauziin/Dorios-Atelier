import { readFile, rm, rmdir } from "node:fs/promises";
import path from "node:path";
import {
  PROJECT_ROOT,
  PROJECT_PATHS,
  duplicateGroups,
  pathExists,
  projectPath,
  readJson,
  scanProject,
  stableJson,
  writeJson,
  writeText,
} from "./lib/project-index.mjs";
import {
  buildVariantMatrix,
  findVanillaVariantIds,
  loadVariantPolicy,
  parseVariantBase,
} from "./lib/variant-matrix.mjs";
import { adaptShapeBlock, loadShapeTemplates } from "./lib/blocks-with-traits.mjs";
import {
  LOCALES,
  localeFileName,
  parseLang,
  updateLang,
  WALL_TRANSLATIONS,
} from "./lib/localization.mjs";

const WRITE = process.argv.includes("--write");
const PATHS = Object.freeze({
  blocksRegistry: path.join(PROJECT_ROOT, "RP", "blocks.json"),
  itemCatalog: path.join(PROJECT_ROOT, "BP", "item_catalog", "crafting_item_catalog.json"),
  threeStepGeometry: path.join(PROJECT_ROOT, "RP", "models", "blocks", "three_steps_stairs.geo.json"),
  uniqueStairsDirectory: path.join(PROJECT_ROOT, "BP", "blocks", "decorative", "unique_stairs"),
  wallsDirectory: path.join(PROJECT_ROOT, "BP", "blocks", "decorative", "walls"),
  stonecutterRecipes: path.join(PROJECT_ROOT, "BP", "recipes", "stonecutter"),
});

const LEGACY_TOOL_PATHS = [
  "tools/gen_custom_variants.py",
  "tools/generate_custom_variants.py",
  "tools/gen_uniform_variants.py",
  "tools/generate_uniform_variants.py",
  "tools/rename_variant_filenames.py",
  "tools/generated/uniform_variant_targets.json",
].map((relativePath) => path.join(PROJECT_ROOT, relativePath));

function clone(value) {
  return structuredClone(value);
}

function blockName(identifier) {
  return identifier.slice(identifier.indexOf(":") + 1);
}

function referencesAny(value, identifiers) {
  if (typeof value === "string") return identifiers.has(value);
  if (Array.isArray(value)) return value.some((entry) => referencesAny(entry, identifiers));
  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, entry]) => identifiers.has(key) || referencesAny(entry, identifiers));
  }
  return false;
}

function canonicalDefinition(definitions) {
  return [...definitions].sort((left, right) => {
    const leftName = path.basename(left.file, ".json");
    const rightName = path.basename(right.file, ".json");
    return rightName.length - leftName.length || left.file.localeCompare(right.file, "en");
  })[0];
}

function normalizedBlockSignature(entry) {
  const document = clone(entry.document);
  const components = document["minecraft:block"]?.components;
  if (components && "minecraft:light_dampening" in components) components["minecraft:light_dampening"] = 0;
  return stableJson(document);
}

function createWallBlock(base, sourceEntry) {
  return {
    format_version: "1.26.10",
    "minecraft:block": {
      description: {
        identifier: `dorios_atelier:${base}_wall`,
        menu_category: {
          category: "construction",
          group: "dorios_atelier:itemGroup.name.walls",
        },
      },
      components: clone(sourceEntry.components),
    },
  };
}

function createStonecutterRecipe(base) {
  return {
    format_version: "1.21.100",
    "minecraft:recipe_shapeless": {
      description: { identifier: `dorios_atelier:sc_${base}_wall_from_${base}` },
      tags: ["stonecutter"],
      ingredients: [{ item: `dorios_atelier:${base}` }],
      result: { item: `dorios_atelier:${base}_wall`, count: 1 },
      unlock: [{ item: `dorios_atelier:${base}` }],
    },
  };
}

function updateCatalog(document, deletedIds, wallIds) {
  const categories = document["minecraft:crafting_items_catalog"].categories;
  for (const category of categories) {
    category.groups = category.groups
      .filter((group) => group.group_identifier?.name !== "dorios_atelier:itemGroup.name.threeStepStairs")
      .map((group) => ({
        ...group,
        items: group.items?.filter((identifier) => !deletedIds.has(identifier)) ?? [],
      }))
      .filter((group) => group.items.length > 0);
  }

  const construction = categories.find((category) => category.category_name === "construction");
  construction.groups = construction.groups.filter(
    (group) => group.group_identifier?.name !== "dorios_atelier:itemGroup.name.walls",
  );
  const stoneIndex = construction.groups.findIndex(
    (group) => group.group_identifier?.name === "dorios_atelier:itemGroup.name.stoneBricks",
  );
  construction.groups.splice(stoneIndex + 1, 0, {
    group_identifier: {
      icon: wallIds[0],
      name: "dorios_atelier:itemGroup.name.walls",
    },
    items: wallIds,
  });
  return document;
}

function updateWallLang(text, locale, deletedIds, wallBases) {
  const settings = WALL_TRANSLATIONS[locale];
  const labels = parseLang(text);
  const removals = [...labels.keys()].filter((key) =>
    key === "dorios_atelier:itemGroup.name.threeStepStairs"
    || key === "dorios_atelier:itemGroup.name.walls"
    || key.includes("_wall.name")
    || [...deletedIds].some((identifier) => key.includes(identifier)));
  const updates = new Map([
    ["dorios_atelier:itemGroup.name.walls", settings.group],
  ]);
  for (const base of wallBases) {
    const baseKey = `tile.dorios_atelier:${base}.name`;
    const fallback = base.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
    const label = (labels.get(baseKey) ?? fallback).replaceAll("\\n", " ");
    updates.set(`tile.dorios_atelier:${base}_wall.name`, settings.name(label));
  }
  return updateLang(text, updates, removals);
}

function assertInsideProject(targetPath) {
  const relative = path.relative(PROJECT_ROOT, targetPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Refusing to mutate outside project: ${targetPath}`);
}

const project = await scanProject();
const policy = await loadVariantPolicy();
const inheritedShapeTemplates = await loadShapeTemplates();
const { rows } = await buildVariantMatrix(policy);
const blockById = new Map(project.blocks.map((entry) => [entry.identifier, entry]));
const deletedIds = new Set();

for (const entry of project.blocks) {
  if (entry.identifier.endsWith("_three_steps_stairs")) deletedIds.add(entry.identifier);
  for (const family of ["slab", "stairs"]) {
    const base = parseVariantBase(entry.identifier, family);
    if (base && findVanillaVariantIds(base, family).length > 0) deletedIds.add(entry.identifier);
  }
}

const wallRows = rows.filter((row) => row.source?.startsWith("dorios_atelier:"));
const wallBases = wallRows.map((row) => row.base).sort((left, right) => left.localeCompare(right, "en"));
const wallIds = wallBases.map((base) => `dorios_atelier:${base}_wall`);
const wallIdSet = new Set(wallIds);
const deletedCullingIds = new Set([...deletedIds].map((identifier) => `dorios_atelier:culling.${blockName(identifier)}`));
const deletePaths = new Set();
const jsonWrites = new Map();
const textWrites = new Map();

for (const entry of project.blocks) {
  if (deletedIds.has(entry.identifier)) deletePaths.add(entry.absolutePath);
}

const remainingBlocks = project.blocks.filter((entry) => !deletePaths.has(entry.absolutePath));
for (const duplicate of duplicateGroups(remainingBlocks)) {
  if (new Set(duplicate.definitions.map(normalizedBlockSignature)).size !== 1) {
    throw new Error(`Conflicting duplicate block cannot be normalized automatically: ${duplicate.identifier}`);
  }
  const keeper = canonicalDefinition(duplicate.definitions);
  const document = clone(keeper.document);
  const components = document["minecraft:block"].components;
  if ("minecraft:light_dampening" in components) components["minecraft:light_dampening"] = 0;
  jsonWrites.set(keeper.absolutePath, document);
  for (const entry of duplicate.definitions) if (entry !== keeper) deletePaths.add(entry.absolutePath);
}

for (const entry of project.culling) {
  if (deletedCullingIds.has(entry.identifier)) deletePaths.add(entry.absolutePath);
}
const remainingCulling = project.culling.filter((entry) => !deletePaths.has(entry.absolutePath));
for (const duplicate of duplicateGroups(remainingCulling)) {
  if (duplicate.semanticVariantCount !== 1) throw new Error(`Conflicting duplicate culling rule: ${duplicate.identifier}`);
  const keeper = canonicalDefinition(duplicate.definitions);
  for (const entry of duplicate.definitions) if (entry !== keeper) deletePaths.add(entry.absolutePath);
}

for (const entry of project.recipes) {
  if (referencesAny(entry.document, deletedIds)) deletePaths.add(entry.absolutePath);
}
const remainingRecipes = project.recipes.filter((entry) => !deletePaths.has(entry.absolutePath));
for (const duplicate of duplicateGroups(remainingRecipes)) {
  if (duplicate.semanticVariantCount !== 1) throw new Error(`Conflicting duplicate recipe: ${duplicate.identifier}`);
  const keeper = canonicalDefinition(duplicate.definitions);
  for (const entry of duplicate.definitions) if (entry !== keeper) deletePaths.add(entry.absolutePath);
}

for (const base of wallBases) {
  const source = blockById.get(`dorios_atelier:${base}`);
  if (!source?.components?.["minecraft:material_instances"]) throw new Error(`Wall source has no material: ${base}`);
  const wallTarget = createWallBlock(base, source);
  jsonWrites.set(
    path.join(PATHS.wallsDirectory, `${base}_wall.json`),
    adaptShapeBlock(inheritedShapeTemplates.wall, wallTarget),
  );
  jsonWrites.set(path.join(PATHS.stonecutterRecipes, `${base}_wall_from_${base}.json`), createStonecutterRecipe(base));
}

const blocksRegistry = await readJson(PATHS.blocksRegistry);
for (const identifier of deletedIds) delete blocksRegistry[identifier];
for (const row of wallRows) {
  const wallId = `dorios_atelier:${row.base}_wall`;
  const sourceRegistry = blocksRegistry[row.source];
  if (!sourceRegistry) throw new Error(`RP/blocks.json has no source entry for ${row.source}`);
  blocksRegistry[wallId] = clone(sourceRegistry);
}
jsonWrites.set(PATHS.blocksRegistry, blocksRegistry);

jsonWrites.set(
  PATHS.itemCatalog,
  updateCatalog(await readJson(PATHS.itemCatalog), deletedIds, wallIds),
);

for (const locale of LOCALES) {
  const languagePath = path.join(PROJECT_ROOT, "RP", "texts", localeFileName(locale));
  textWrites.set(
    languagePath,
    updateWallLang(await readFile(languagePath, "utf8"), locale, deletedIds, wallBases),
  );
}

const nextPolicy = {
  $schema: "./variant-policy.schema.json",
  schemaVersion: 1,
  decisionValues: ["pending", "generate", "skip", "use_vanilla"],
  materials: rows.map((row) => ({
    base: row.base,
    source: row.source,
    variants: {
      slab: row.variants.slab.vanilla.length > 0 ? "use_vanilla" : "generate",
      stairs: row.variants.stairs.vanilla.length > 0 ? "use_vanilla" : "generate",
      vertical_slab: "generate",
      wall: row.source?.startsWith("dorios_atelier:") ? "generate" : "skip",
    },
    notes: row.notes ?? "",
  })),
};
jsonWrites.set(PROJECT_PATHS.variantPolicy, nextPolicy);

if (await pathExists(PATHS.threeStepGeometry)) deletePaths.add(PATHS.threeStepGeometry);
for (const legacyPath of LEGACY_TOOL_PATHS) {
  if (await pathExists(legacyPath)) deletePaths.add(legacyPath);
}

for (const [targetPath, document] of jsonWrites) {
  if (!(await pathExists(targetPath))) continue;
  const current = await readJson(targetPath);
  if (stableJson(current) === stableJson(document)) jsonWrites.delete(targetPath);
}
for (const [targetPath, nextText] of textWrites) {
  if (!(await pathExists(targetPath))) continue;
  const currentText = await readFile(targetPath, "utf8");
  const normalizeNewlines = (value) => value.replaceAll("\r\n", "\n");
  if (normalizeNewlines(currentText) === normalizeNewlines(nextText)) textWrites.delete(targetPath);
}

const report = {
  schemaVersion: 1,
  mode: WRITE ? "write" : "dry-run",
  removedBlockIdentifiers: [...deletedIds].sort((left, right) => left.localeCompare(right, "en")),
  removedBlockIdentifierCounts: {
    threeStepStairs: [...deletedIds].filter((identifier) => identifier.endsWith("_three_steps_stairs")).length,
    vanillaSlabs: [...deletedIds].filter((identifier) => identifier.endsWith("_slab") && !identifier.endsWith("_vertical_slab")).length,
    vanillaStairs: [...deletedIds].filter((identifier) => identifier.endsWith("_stairs") && !identifier.endsWith("_three_steps_stairs")).length,
  },
  generatedWalls: wallIds,
  deletedFiles: [...deletePaths].map(projectPath).sort((left, right) => left.localeCompare(right, "en")),
  jsonWrites: [...jsonWrites.keys()].map(projectPath).sort((left, right) => left.localeCompare(right, "en")),
  textWrites: [...textWrites.keys()].map(projectPath).sort((left, right) => left.localeCompare(right, "en")),
};
report.deletedFilesByArea = Object.fromEntries(
  Object.entries(report.deletedFiles.reduce((counts, file) => {
    const area = file.startsWith("BP/blocks/") ? "BP/blocks"
      : file.startsWith("BP/recipes/") ? "BP/recipes"
        : file.startsWith("RP/block_culling/") ? "RP/block_culling"
          : file.startsWith("RP/models/") ? "RP/models"
            : file.startsWith("tools/") ? "tools/legacy"
              : file.split("/")[0];
    counts[area] = (counts[area] ?? 0) + 1;
    return counts;
  }, {})).sort(([left], [right]) => left.localeCompare(right, "en")),
);

console.log(`${WRITE ? "Applying" : "Planning"} stone variant overhaul:`);
console.log(`- remove ${report.removedBlockIdentifierCounts.threeStepStairs} three-step identifiers`);
console.log(`- replace ${report.removedBlockIdentifierCounts.vanillaSlabs} slabs and ${report.removedBlockIdentifierCounts.vanillaStairs} stairs with vanilla`);
console.log(`- generate ${report.generatedWalls.length} walls`);
console.log(`- delete ${report.deletedFiles.length} files; write ${report.jsonWrites.length + report.textWrites.length} files`);
for (const [area, count] of Object.entries(report.deletedFilesByArea)) console.log(`  - ${area}: ${count}`);
for (const file of report.jsonWrites) console.log(`  W ${file}`);
for (const file of report.textWrites) console.log(`  W ${file}`);

if (WRITE) {
  for (const targetPath of deletePaths) {
    assertInsideProject(targetPath);
    await rm(targetPath, { force: true });
  }
  for (const [targetPath, document] of jsonWrites) {
    assertInsideProject(targetPath);
    await writeText(targetPath, JSON.stringify(document, null, 4));
  }
  for (const [targetPath, text] of textWrites) {
    assertInsideProject(targetPath);
    await writeText(targetPath, text);
  }
  try {
    await rmdir(PATHS.uniqueStairsDirectory);
  } catch (error) {
    if (!["ENOENT", "ENOTEMPTY"].includes(error?.code)) throw error;
  }
  await writeJson(path.join(PROJECT_PATHS.generated, "stone-variant-overhaul.json"), report);
  console.log("Applied. Report: tools/generated/stone-variant-overhaul.json");
} else {
  console.log("Dry run only. Use npm run content:overhaul:apply to apply these changes.");
}
