import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { PROJECT_ROOT, readJson } from "../lib/project-index.mjs";

const TIERS = ["wooden", "stone", "copper", "iron", "golden", "diamond", "netherite"];

test("glass cutters use a log block in the center of the handle", async () => {
  for (const tier of TIERS) {
    const file = path.join(
      PROJECT_ROOT,
      "BP",
      "recipes",
      "crafting_table",
      "equipment",
      `${tier}_glass_cutter.json`,
    );
    const recipe = (await readJson(file))["minecraft:recipe_shaped"];

    assert.deepEqual(recipe.pattern, ["  M", " W ", "S  "], tier);
    assert.deepEqual(recipe.key.W, { tag: "minecraft:logs" }, tier);
    assert.deepEqual(recipe.key.S, { item: "minecraft:stick" }, tier);
  }
});
