import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { PROJECT_ROOT, readJson, scanProject } from "../lib/project-index.mjs";

test("every custom glass block uses the UtilityCraft geometry and same-block culling rule", async () => {
  const project = await scanProject();
  const glassBlocks = project.blocks.filter(
    (entry) => "tag:dorios_atelier:breakable_by_cutter" in entry.components,
  );
  assert.equal(glassBlocks.length, 84);

  for (const entry of glassBlocks) {
    assert.deepEqual(entry.components["minecraft:geometry"], {
      identifier: "geometry.dorios_atelier_glass",
      culling: "dorios_atelier:custom_glass",
    }, entry.identifier);
  }

  const culling = await readJson(path.join(PROJECT_ROOT, "RP", "block_culling", "custom_glass.json"));
  const rules = culling["minecraft:block_culling_rules"].rules;
  assert.deepEqual(rules.map((rule) => rule.direction).sort(), ["down", "east", "north", "south", "up", "west"]);
  for (const rule of rules) {
    assert.equal(rule.condition, "same_block");
    assert.deepEqual(rule.geometry_part, { bone: "block", cube: 0, face: rule.direction });
  }

  const geometry = await readJson(path.join(PROJECT_ROOT, "RP", "models", "blocks", "glass.geo.json"));
  const model = geometry["minecraft:geometry"][0];
  assert.equal(model.description.identifier, "geometry.dorios_atelier_glass");
  assert.equal(model.bones[0].name, "block");
  assert.deepEqual(model.bones[0].cubes[0].size, [16, 16, 16]);
});
