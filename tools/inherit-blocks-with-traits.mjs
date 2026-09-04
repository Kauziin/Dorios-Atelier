import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  PROJECT_ROOT,
  projectPath,
  readJson,
  scanProject,
  stableJson,
  writeJson,
  writeText,
} from "./lib/project-index.mjs";
import {
  BLOCKS_WITH_TRAITS_TEMPLATE_ROOT,
  CULLING_TEMPLATE_FILES,
  MODEL_TEMPLATE_FILES,
  adaptCullingTemplate,
  adaptPillarBlock,
  adaptShapeBlock,
  loadShapeTemplates,
  materialInstancesFromRegistry,
  shapeFamily,
} from "./lib/blocks-with-traits.mjs";

const WRITE = process.argv.includes("--write");
const CHECK = process.argv.includes("--check");
const PATHS = Object.freeze({
  models: path.join(PROJECT_ROOT, "RP", "models", "blocks"),
  culling: path.join(PROJECT_ROOT, "RP", "block_culling"),
  blocksRegistry: path.join(PROJECT_ROOT, "RP", "blocks.json"),
  terrainTexture: path.join(PROJECT_ROOT, "RP", "textures", "terrain_texture.json"),
  pillarTemplate: path.join(BLOCKS_WITH_TRAITS_TEMPLATE_ROOT, "blocks", "pillar.json"),
  stairsScript: path.join(PROJECT_ROOT, "BP", "scripts", "stairs.js"),
  mainScript: path.join(PROJECT_ROOT, "BP", "scripts", "main.js"),
});

const [project, templates, blocksRegistry, terrainTexture, pillarTemplate] = await Promise.all([
  scanProject(),
  loadShapeTemplates(),
  readJson(PATHS.blocksRegistry),
  readJson(PATHS.terrainTexture),
  readJson(PATHS.pillarTemplate),
]);
const writes = new Map();
const deletes = new Set();

function queueJson(file, current, next) {
  if (stableJson(current) !== stableJson(next)) writes.set(file, { type: "json", value: next });
}

function registryTexturesFromMaterials(materialInstances) {
  const wildcard = materialInstances?.["*"]?.texture;
  const faces = Object.fromEntries(
    ["up", "down", "north", "south", "east", "west"]
      .map((face) => [face, materialInstances?.[face]?.texture])
      .filter(([, texture]) => typeof texture === "string"),
  );
  if (Object.keys(faces).length === 0) return wildcard;
  if (typeof wildcard === "string") faces.side = wildcard;
  return faces;
}

function sourceIdentifierForVariant(identifier) {
  const family = shapeFamily(identifier);
  if (!family) return undefined;
  const suffix = family === "vertical_slab" ? "_vertical_slab" : `_${family}`;
  return identifier.slice(0, -suffix.length);
}

for (const entry of project.blocks) {
  const family = shapeFamily(entry.identifier);
  if (family) {
    queueJson(entry.absolutePath, entry.document, adaptShapeBlock(templates[family], entry.document));
    continue;
  }

  if (entry.identifier === "dorios_atelier:obsidian_pillar") {
    queueJson(
      entry.absolutePath,
      entry.document,
      adaptPillarBlock(pillarTemplate, entry.document, blocksRegistry[entry.identifier]),
    );
    continue;
  }

  const components = entry.document["minecraft:block"]?.components ?? {};
  const isGlass = "tag:dorios_atelier:breakable_by_cutter" in components;
  const geometry = components["minecraft:geometry"];
  const geometryIdentifier = typeof geometry === "string" ? geometry : geometry?.identifier;
  const isFullCube = geometryIdentifier === "minecraft:geometry.full_block";
  if (isGlass || !isFullCube) continue;

  // Remaining non-shaped Atelier blocks are opaque full cubes. Match the
  // BlocksWithTraits full-block conductivity behavior without changing their
  // material-specific harvesting, flammability or texture setup.
  const next = structuredClone(entry.document);
  next.format_version = "1.26.10";
  const registryMaterialInstances = materialInstancesFromRegistry(blocksRegistry[entry.identifier]);
  if (registryMaterialInstances) {
    next["minecraft:block"].components["minecraft:material_instances"] = registryMaterialInstances;
  }
  next["minecraft:block"].components["minecraft:redstone_conductivity"] = {
    allows_wire_to_step_down: true,
    redstone_conductor: true,
  };
  queueJson(entry.absolutePath, entry.document, next);
}

const nextTerrainTexture = structuredClone(terrainTexture);
for (const entry of Object.values(nextTerrainTexture.texture_data ?? {})) {
  if (typeof entry?.textures === "string") entry.textures = [entry.textures];
}
queueJson(PATHS.terrainTexture, terrainTexture, nextTerrainTexture);

const activeBlockIds = new Set(project.blocks.map((entry) => entry.identifier));
const nextBlocksRegistry = structuredClone(blocksRegistry);
for (const identifier of Object.keys(nextBlocksRegistry)) {
  if (identifier.startsWith("dorios_atelier:") && !activeBlockIds.has(identifier)) {
    delete nextBlocksRegistry[identifier];
  }
}
for (const entry of project.blocks) {
  if (nextBlocksRegistry[entry.identifier]) continue;
  const textures = registryTexturesFromMaterials(entry.components["minecraft:material_instances"]);
  if (!textures) throw new Error(`Cannot derive RP/blocks.json textures for ${entry.identifier}`);
  const sourceIdentifier = sourceIdentifierForVariant(entry.identifier);
  nextBlocksRegistry[entry.identifier] = {
    sound: nextBlocksRegistry[sourceIdentifier]?.sound ?? "stone",
    textures,
  };
}
queueJson(PATHS.blocksRegistry, blocksRegistry, nextBlocksRegistry);

for (const file of MODEL_TEMPLATE_FILES) {
  const templatePath = path.join(BLOCKS_WITH_TRAITS_TEMPLATE_ROOT, "models", file);
  const targetPath = path.join(PATHS.models, file);
  const next = await readJson(templatePath);
  let current = {};
  try { current = await readJson(targetPath); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  queueJson(targetPath, current, next);
}

for (const file of CULLING_TEMPLATE_FILES) {
  const templatePath = path.join(BLOCKS_WITH_TRAITS_TEMPLATE_ROOT, "block_culling", file);
  const targetPath = path.join(PATHS.culling, file);
  const next = adaptCullingTemplate(await readJson(templatePath));
  let current = {};
  try { current = await readJson(targetPath); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  queueJson(targetPath, current, next);
}

for (const file of ["slabs.geo.json", "stairs.geo.json", "vertical_slabs.geo.json"]) {
  deletes.add(path.join(PATHS.models, file));
}
for (const entry of project.culling) {
  if (entry.identifier.startsWith("dorios_atelier:culling.")) deletes.add(entry.absolutePath);
}
deletes.add(PATHS.stairsScript);

const mainSource = await readFile(PATHS.mainScript, "utf8");
const nextMainSource = mainSource
  .split(/\r?\n/)
  .filter((line) => !line.trim().match(/^import ['"]\.\/stairs\.js['"]$/))
  .join("\n");
if (nextMainSource !== mainSource.replaceAll("\r\n", "\n")) {
  writes.set(PATHS.mainScript, { type: "text", value: nextMainSource });
}

for (const file of [...deletes]) {
  try {
    await readFile(file);
  } catch (error) {
    if (error?.code === "ENOENT") deletes.delete(file);
    else throw error;
  }
}

const shapeCounts = Object.fromEntries(
  ["slab", "stairs", "vertical_slab", "wall"].map((family) => [
    family,
    project.blocks.filter((entry) => shapeFamily(entry.identifier) === family).length,
  ]),
);
console.log(`${WRITE ? "Applying" : "Previewing"} BlocksWithTraits inheritance:`);
console.log(`- shapes: ${JSON.stringify(shapeCounts)}`);
console.log(`- ${writes.size} file(s) to write; ${deletes.size} obsolete file(s) to delete`);
for (const file of [...writes.keys()].sort()) console.log(`  W ${projectPath(file)}`);
for (const file of [...deletes].sort()) console.log(`  D ${projectPath(file)}`);

if (WRITE) {
  for (const file of deletes) await rm(file, { force: true });
  for (const [file, change] of writes) {
    if (change.type === "json") await writeJson(file, change.value);
    else await writeText(file, change.value);
  }
}
if (CHECK && (writes.size > 0 || deletes.size > 0)) process.exitCode = 1;
