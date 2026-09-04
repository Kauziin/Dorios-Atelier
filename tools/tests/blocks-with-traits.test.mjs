import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  BLOCKS_WITH_TRAITS_TEMPLATE_ROOT,
  CULLING_TEMPLATE_FILES,
  MODEL_TEMPLATE_FILES,
  adaptCullingTemplate,
  shapeFamily,
} from "../lib/blocks-with-traits.mjs";
import { PROJECT_ROOT, readJson, scanProject } from "../lib/project-index.mjs";

const EXPECTED = Object.freeze({
  slab: {
    count: 57,
    permutations: 1,
    geometry: "geometry.slab",
    trait: "minecraft:placement_position",
    states: ["minecraft:vertical_half"],
  },
  stairs: {
    count: 58,
    permutations: 44,
    geometry: "geometry.stairs_up",
    trait: "minecraft:placement_direction",
    states: ["minecraft:corner_and_cardinal_direction"],
  },
  vertical_slab: {
    count: 84,
    permutations: 20,
    geometry: "geometry.vertical_slab",
    trait: "minecraft:placement_direction",
    states: ["minecraft:corner_and_cardinal_direction"],
  },
  wall: {
    count: 42,
    permutations: 15,
    geometry: "geometry.wall",
    trait: "minecraft:connection",
    states: ["minecraft:cardinal_connections"],
  },
});

test("every shaped block uses the native BlocksWithTraits state model", async () => {
  const project = await scanProject();
  for (const [family, expected] of Object.entries(EXPECTED)) {
    const entries = project.blocks.filter((entry) => shapeFamily(entry.identifier) === family);
    assert.equal(entries.length, expected.count, `${family} count`);

    for (const entry of entries) {
      const block = entry.document["minecraft:block"];
      const traits = block.description.traits ?? {};
      const placement = traits[expected.trait];
      assert.deepEqual(placement.enabled_states, expected.states, entry.identifier);
      assert.equal(block.components["minecraft:geometry"].identifier, expected.geometry, entry.identifier);
      assert.equal(block.permutations.length, expected.permutations, entry.identifier);
      assert.equal(JSON.stringify(entry.document).includes("dorios_atelier:stair_shape"), false, entry.identifier);
    }
  }
});

test("installed geometry and culling data remain identical to the vendored source", async () => {
  for (const file of MODEL_TEMPLATE_FILES) {
    const source = await readJson(path.join(BLOCKS_WITH_TRAITS_TEMPLATE_ROOT, "models", file));
    const installed = await readJson(path.join(PROJECT_ROOT, "RP", "models", "blocks", file));
    assert.deepEqual(installed, source, file);
  }
  for (const file of CULLING_TEMPLATE_FILES) {
    const source = adaptCullingTemplate(
      await readJson(path.join(BLOCKS_WITH_TRAITS_TEMPLATE_ROOT, "block_culling", file)),
    );
    const installed = await readJson(path.join(PROJECT_ROOT, "RP", "block_culling", file));
    assert.deepEqual(installed, source, file);
  }
});

test("opaque full cubes conduct redstone and partial shapes do not", async () => {
  const project = await scanProject();
  let solidCount = 0;
  for (const entry of project.blocks) {
    const components = entry.components;
    const geometry = components["minecraft:geometry"];
    const geometryIdentifier = typeof geometry === "string" ? geometry : geometry?.identifier;
    const isGlass = "tag:dorios_atelier:breakable_by_cutter" in components;
    const conductivity = components["minecraft:redstone_conductivity"];

    if (!shapeFamily(entry.identifier) && !isGlass && geometryIdentifier === "minecraft:geometry.full_block") {
      solidCount += 1;
      assert.deepEqual(conductivity, {
        allows_wire_to_step_down: true,
        redstone_conductor: true,
      }, entry.identifier);
    }
    if (shapeFamily(entry.identifier)) assert.equal(conductivity?.redstone_conductor, false, entry.identifier);
  }
  assert.equal(solidCount, 70);
});

test("every rendered block has both geometry and material instances", async () => {
  const project = await scanProject();
  for (const entry of project.blocks) {
    const components = entry.components;
    const hasGeometry = "minecraft:geometry" in components;
    const hasMaterials = "minecraft:material_instances" in components;
    assert.equal(hasGeometry, hasMaterials, entry.identifier);
    assert.equal(hasGeometry, true, entry.identifier);
  }
});

test("terrain atlas textures use string arrays and snowy grass has valid face materials", async () => {
  const terrain = await readJson(path.join(PROJECT_ROOT, "RP", "textures", "terrain_texture.json"));
  for (const [identifier, entry] of Object.entries(terrain.texture_data)) {
    assert.ok(Array.isArray(entry.textures), `${identifier} textures must be an array`);
    assert.ok(entry.textures.length > 0, `${identifier} textures must not be empty`);
    assert.ok(entry.textures.every((texture) => typeof texture === "string"), identifier);
  }

  const snowyGrass = (await scanProject()).blocks
    .find((entry) => entry.identifier === "dorios_atelier:snowy_grass_block");
  assert.deepEqual(terrain.texture_data.dorios_atelier_grass_side_snowed, {
    textures: ["textures/blocks/grass_side_snowed"],
  });
  assert.deepEqual(
    Object.fromEntries(Object.entries(snowyGrass.components["minecraft:material_instances"])
      .map(([face, material]) => [face, material.texture])),
    { "*": "dorios_atelier_grass_side_snowed", up: "snow", down: "dirt" },
  );
  assert.equal("minecraft:tags" in snowyGrass.components, false);
  assert.deepEqual(snowyGrass.components["tag:minecraft:is_shovel_item_destructible"], {});
  assert.deepEqual(snowyGrass.components["tag:minecraft:grass"], {});
});

test("RP blocks registry matches the active behavior-pack block identifiers", async () => {
  const project = await scanProject();
  const registry = await readJson(path.join(PROJECT_ROOT, "RP", "blocks.json"));
  const activeIds = project.blocks.map((entry) => entry.identifier).sort();
  const registeredIds = Object.keys(registry)
    .filter((identifier) => identifier !== "format_version")
    .sort();
  assert.deepEqual(registeredIds, activeIds);
});

test("legacy slabToBlock behavior stays inactive under the BlocksWithTraits slab model", async () => {
  const main = await readFile(path.join(PROJECT_ROOT, "BP", "scripts", "main.js"), "utf8");
  assert.equal(main.includes("./slabToBlock.js"), false);
});

test("legacy stair placement and inferior geometry files stay retired", async () => {
  for (const relativePath of [
    "BP/scripts/stairs.js",
    "RP/models/blocks/slabs.geo.json",
    "RP/models/blocks/stairs.geo.json",
    "RP/models/blocks/vertical_slabs.geo.json",
  ]) {
    await assert.rejects(access(path.join(PROJECT_ROOT, relativePath)), { code: "ENOENT" });
  }
});
