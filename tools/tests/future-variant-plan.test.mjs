import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { PROJECT_ROOT, readJson, scanProject } from "../lib/project-index.mjs";

const EXPECTED_FAMILIES = [
  "hardened_netherrack",
  "dirt",
  "sand",
  "sandstone",
  "deepslate",
  "prismarine",
  "dark_prismarine",
  "purpur",
  "sulfur",
  "cinnabar",
];

test("future variants remain a texture-gated plan and do not leak into active generation", async () => {
  const plan = await readJson(path.join(PROJECT_ROOT, "content", "future-variant-plan.json"));
  const policy = await readJson(path.join(PROJECT_ROOT, "content", "variant-policy.json"));
  const project = await scanProject();
  const currentBlocks = new Set(project.blocks.map(({ identifier }) => identifier));
  const activeSources = new Set(policy.materials.map(({ source }) => source));
  const plannedIdentifiers = new Set();
  const validShapes = new Set(plan.globalRules.newFullBlockShapes);

  assert.equal(plan.status, "planned_textures_missing");
  assert.equal(plan.implementationGate.generateGameplayFiles, false);
  assert.deepEqual(plan.globalRules.forbiddenShapes, ["three_step_stairs"]);
  assert.deepEqual(plan.families.map(({ id }) => id), EXPECTED_FAMILIES);

  for (const family of plan.families) {
    assert.equal(family.status, "planned_textures_missing", family.id);

    for (const identifier of family.newFullBlocks) {
      assert.ok(!plannedIdentifiers.has(identifier), `Duplicate planned identifier: ${identifier}`);
      plannedIdentifiers.add(identifier);
      assert.ok(!currentBlocks.has(identifier), `${identifier} was generated before its textures were approved.`);
      assert.ok(!activeSources.has(identifier), `${identifier} leaked into the active variant policy.`);
    }

    for (const row of family.shapeCompletion) {
      const groups = [row.reuseVanilla ?? [], row.keepAtelier ?? [], row.createLater ?? []];
      const flattened = groups.flat();
      assert.equal(new Set(flattened).size, flattened.length, `${family.id}:${row.base} repeats a shape decision.`);
      for (const shape of flattened) {
        assert.ok(validShapes.has(shape), `${family.id}:${row.base} uses unknown shape ${shape}.`);
      }
    }
  }
});

test("hardened netherrack keeps the requested four-to-two entry recipe", async () => {
  const plan = await readJson(path.join(PROJECT_ROOT, "content", "future-variant-plan.json"));
  const family = plan.families.find(({ id }) => id === "hardened_netherrack");

  assert.deepEqual(family.entryRecipe, {
    type: "shaped_2x2",
    ingredients: { "minecraft:netherrack": 4 },
    result: { "dorios_atelier:hardened_netherrack": 2 },
  });
});
