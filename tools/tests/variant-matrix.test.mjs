import assert from "node:assert/strict";
import test from "node:test";
import {
  findVanillaVariantIds,
  parseVariantBase,
  validateVariantMatrix,
} from "../lib/variant-matrix.mjs";

test("parses each Atelier variant suffix without swallowing the family name", () => {
  assert.equal(parseVariantBase("dorios_atelier:andesite_slab", "slab"), "andesite");
  assert.equal(parseVariantBase("dorios_atelier:andesite_stairs", "stairs"), "andesite");
  assert.equal(parseVariantBase("dorios_atelier:andesite_vertical_slab", "vertical_slab"), "andesite");
  assert.equal(parseVariantBase("dorios_atelier:andesite_wall", "wall"), "andesite");
});

test("detects direct vanilla slab and stairs equivalents", () => {
  assert.deepEqual(findVanillaVariantIds("andesite", "slab"), ["minecraft:andesite_slab"]);
  assert.deepEqual(findVanillaVariantIds("andesite", "stairs"), ["minecraft:andesite_stairs"]);
});

test("detects singular brick naming used by vanilla", () => {
  assert.ok(findVanillaVariantIds("stone_bricks", "slab").includes("minecraft:stone_brick_slab"));
  assert.ok(findVanillaVariantIds("stone_bricks", "stairs").includes("minecraft:stone_brick_stairs"));
});

test("detects the purpur block naming exception", () => {
  assert.deepEqual(findVanillaVariantIds("purpur_block", "slab"), ["minecraft:purpur_slab"]);
  assert.deepEqual(findVanillaVariantIds("purpur_block", "stairs"), ["minecraft:purpur_stairs"]);
});

test("detects the legacy cobblestone stair identifier", () => {
  assert.deepEqual(findVanillaVariantIds("cobblestone", "slab"), ["minecraft:cobblestone_slab"]);
  assert.deepEqual(findVanillaVariantIds("cobblestone", "stairs"), ["minecraft:stone_stairs"]);
});

test("does not equate quartz bricks with regular quartz stairs", () => {
  assert.deepEqual(findVanillaVariantIds("quartz_bricks", "stairs"), []);
});

test("rejects use_vanilla when the selected family has no detected equivalent", () => {
  const issues = validateVariantMatrix([{
    base: "calcite",
    source: "minecraft:calcite",
    sourceExists: true,
    variants: {
      slab: { decision: "use_vanilla", vanilla: [], current: { present: false } },
      stairs: { decision: "pending", vanilla: [], current: { present: false } },
      vertical_slab: { decision: "pending", vanilla: [], current: { present: false } },
      wall: { decision: "pending", vanilla: [], current: { present: false } },
    },
  }]);
  assert.deepEqual(issues, ["calcite.slab uses vanilla, but no vanilla equivalent was detected."]);
});

test("enforces the reviewed decision against current Atelier files", () => {
  const variants = {
    slab: { decision: "generate", vanilla: [], current: { present: false } },
    stairs: { decision: "use_vanilla", vanilla: ["minecraft:andesite_stairs"], current: { present: true } },
    vertical_slab: { decision: "generate", vanilla: [], current: { present: true } },
    wall: { decision: "skip", vanilla: [], current: { present: true } },
  };
  assert.deepEqual(validateVariantMatrix([{
    base: "andesite",
    source: "minecraft:andesite",
    sourceExists: true,
    variants,
  }]), [
    "andesite.slab is marked for generation, but its Atelier block is missing.",
    "andesite.stairs is marked use_vanilla, but its Atelier block still exists.",
    "andesite.wall is marked skip, but its Atelier block still exists.",
  ]);
});
