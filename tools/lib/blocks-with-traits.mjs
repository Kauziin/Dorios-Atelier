import path from "node:path";
import { PROJECT_ROOT, readJson } from "./project-index.mjs";

export const BLOCKS_WITH_TRAITS_TEMPLATE_ROOT = path.join(
  PROJECT_ROOT,
  "tools",
  "templates",
  "blocks-with-traits",
);

export const SHAPE_TEMPLATE_FILES = Object.freeze({
  slab: "slab.json",
  stairs: "stairs.json",
  vertical_slab: "vertical_slab.json",
  wall: "wall.json",
});

export const MODEL_TEMPLATE_FILES = Object.freeze([
  "slab.geo.json",
  "stairs_up.geo.json",
  "stairs_down.geo.json",
  "vertical_slab.geo.json",
  "wall.geo.json",
  "wall_icon.geo.json",
]);

export const CULLING_TEMPLATE_FILES = Object.freeze([
  "slab_culling.json",
  "stairs_up_culling.json",
  "stairs_down_culling.json",
  "vertical_slab_culling.json",
]);

const MATERIAL_COMPONENTS = new Set([
  "minecraft:destructible_by_mining",
  "minecraft:destructible_by_explosion",
  "minecraft:light_emission",
  "minecraft:loot",
  "minecraft:map_color",
]);

export function shapeFamily(identifier) {
  if (identifier.endsWith("_vertical_slab")) return "vertical_slab";
  if (identifier.endsWith("_stairs")) return "stairs";
  if (identifier.endsWith("_slab")) return "slab";
  if (identifier.endsWith("_wall")) return "wall";
  return undefined;
}

export function replaceTemplateStrings(value, replacements) {
  if (typeof value === "string") return replacements.get(value) ?? value;
  if (Array.isArray(value)) return value.map((entry) => replaceTemplateStrings(entry, replacements));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, replaceTemplateStrings(entry, replacements)]),
  );
}

function targetTexture(targetDocument) {
  const texture = targetDocument["minecraft:block"]?.components?.["minecraft:material_instances"]?.["*"]?.texture;
  if (typeof texture !== "string") {
    throw new Error(`Block has no single wildcard texture: ${targetDocument["minecraft:block"]?.description?.identifier}`);
  }
  return texture;
}

function mergeMaterialComponents(templateComponents, targetComponents) {
  const next = structuredClone(templateComponents);

  // Destruction, emission, loot and map color belong to the material rather
  // than to the inherited shape. Preserve them when the Atelier defines them.
  for (const key of MATERIAL_COMPONENTS) {
    if (key in targetComponents) next[key] = structuredClone(targetComponents[key]);
    else if (key === "minecraft:map_color" || key === "minecraft:light_emission" || key === "minecraft:loot") delete next[key];
  }

  // Preserve Atelier harvesting tiers while retaining structural tags from
  // the BlocksWithTraits template (cornerable stairs and fence connections).
  for (const [key, value] of Object.entries(targetComponents)) {
    if (key.startsWith("tag:")) next[key] = structuredClone(value);
  }
  return next;
}

export function adaptShapeBlock(templateDocument, targetDocument) {
  const targetBlock = targetDocument["minecraft:block"];
  const targetComponents = targetBlock.components ?? {};
  const replacements = new Map([
    ["blue_stone_brick", targetTexture(targetDocument)],
    ["custom:slab_culling", "dorios_atelier:slab_culling"],
    ["custom:stairs_up_culling", "dorios_atelier:stairs_up_culling"],
    ["custom:stairs_down_culling", "dorios_atelier:stairs_down_culling"],
    ["custom:vertical_slab_culling", "dorios_atelier:vertical_slab_culling"],
  ]);
  const next = replaceTemplateStrings(structuredClone(templateDocument), replacements);
  const nextBlock = next["minecraft:block"];

  nextBlock.description.identifier = targetBlock.description.identifier;
  nextBlock.description.menu_category = structuredClone(targetBlock.description.menu_category);
  nextBlock.components = mergeMaterialComponents(nextBlock.components, targetComponents);
  return next;
}

export function adaptPillarBlock(templateDocument, targetDocument, textureRegistryEntry) {
  const textures = textureRegistryEntry?.textures;
  if (!textures || typeof textures !== "object") throw new Error("Pillar texture registry must expose up/side/down textures.");
  const replacements = new Map([
    ["blue_stone_pillar_top", textures.up ?? textures.down],
    ["blue_stone_pillar", textures.side],
  ]);
  const next = replaceTemplateStrings(structuredClone(templateDocument), replacements);
  const targetBlock = targetDocument["minecraft:block"];
  const nextBlock = next["minecraft:block"];
  nextBlock.description.identifier = targetBlock.description.identifier;
  nextBlock.description.menu_category = structuredClone(targetBlock.description.menu_category);
  nextBlock.components = mergeMaterialComponents(nextBlock.components, targetBlock.components ?? {});
  return next;
}

export function adaptCullingTemplate(templateDocument) {
  const next = structuredClone(templateDocument);
  const description = next["minecraft:block_culling_rules"]?.description;
  if (description?.identifier?.startsWith("custom:")) {
    description.identifier = `dorios_atelier:${description.identifier.slice("custom:".length)}`;
  }
  return next;
}

function registryTextureName(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.find((entry) => typeof entry === "string");
  return undefined;
}

export function materialInstancesFromRegistry(textureRegistryEntry) {
  const textures = textureRegistryEntry?.textures;
  if (!textures || typeof textures !== "object" || Array.isArray(textures)) return undefined;

  const side = registryTextureName(textures["*"] ?? textures.side);
  const instances = {};
  if (side) {
    instances["*"] = {
      texture: side,
      ambient_occlusion: true,
      face_dimming: true,
      render_method: "opaque",
    };
  }
  for (const face of ["up", "down", "north", "south", "east", "west"]) {
    const texture = registryTextureName(textures[face]);
    if (!texture || texture === side) continue;
    instances[face] = {
      texture,
      ambient_occlusion: true,
      face_dimming: true,
      render_method: "opaque",
    };
  }
  return Object.keys(instances).length > 0 ? instances : undefined;
}

export async function loadShapeTemplates() {
  return Object.fromEntries(await Promise.all(
    Object.entries(SHAPE_TEMPLATE_FILES).map(async ([family, file]) => [
      family,
      await readJson(path.join(BLOCKS_WITH_TRAITS_TEMPLATE_ROOT, "blocks", file)),
    ]),
  ));
}
