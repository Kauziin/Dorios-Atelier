import path from "node:path";
import {
  PROJECT_ROOT,
  PROJECT_PATHS,
  projectPath,
  scanProject,
  stableJson,
  writeJson,
} from "./lib/project-index.mjs";
import { loadVariantPolicy } from "./lib/variant-matrix.mjs";

const WRITE = process.argv.includes("--write");
const CHECK = process.argv.includes("--check");
const NAMESPACE = "dorios_atelier";
const FAMILY_FILENAME = Object.freeze({
  slab: "slab",
  stairs: "str",
  vertical_slab: "vslab",
  wall: "wall",
});
const OUTPUT_COUNT = Object.freeze({ slab: 2, stairs: 1, vertical_slab: 2, wall: 1 });
const RESET_INPUT_COUNT = Object.freeze({ slab: 2, stairs: 1, vertical_slab: 2, wall: 1 });

function recipeRoot(document) {
  const key = Object.keys(document).find((entry) => entry.startsWith("minecraft:recipe_"));
  return key ? document[key] : undefined;
}

function resultOf(document) {
  const result = recipeRoot(document)?.result;
  return Array.isArray(result) ? result[0] : result;
}

function ingredientsOf(document) {
  const ingredients = recipeRoot(document)?.ingredients;
  if (!Array.isArray(ingredients)) return [];
  return ingredients.flatMap((ingredient) => {
    const count = ingredient.count ?? 1;
    return Array.from({ length: count }, () => ingredient.item ?? `#${ingredient.tag}`);
  }).sort();
}

function transformationKey(inputItems, outputItem, outputCount = 1) {
  return `${[...inputItems].sort().join("+")}=>${outputItem}*${outputCount}`;
}

function recipeTransformation(document) {
  const result = resultOf(document);
  if (!result?.item) return undefined;
  return transformationKey(ingredientsOf(document), result.item, result.count ?? 1);
}

function makeStonecutterRecipe(identifier, inputItem, inputCount, outputItem, outputCount) {
  return {
    format_version: "1.21.100",
    "minecraft:recipe_shapeless": {
      description: { identifier },
      tags: ["stonecutter"],
      ingredients: Array.from({ length: inputCount }, () => ({ item: inputItem })),
      result: { item: outputItem, count: outputCount },
      unlock: [{ item: inputItem }],
    },
  };
}

const [policy, project] = await Promise.all([loadVariantPolicy(), scanProject()]);
const blockIds = new Set(project.blocks.map((entry) => entry.identifier));
const recipesByTransformation = new Map();
for (const entry of project.recipes) {
  const key = recipeTransformation(entry.document);
  if (!key) continue;
  if (!recipesByTransformation.has(key)) recipesByTransformation.set(key, []);
  recipesByTransformation.get(key).push(entry);
}

const desired = [];
for (const material of policy.materials) {
  for (const [family, decision] of Object.entries(material.variants)) {
    if (decision !== "generate") continue;
    const variantId = `${NAMESPACE}:${material.base}_${family}`;
    if (!blockIds.has(variantId)) throw new Error(`Policy-generated block is missing: ${variantId}`);

    desired.push({
      kind: "subtype",
      base: material.base,
      family,
      inputItem: material.source,
      inputCount: 1,
      outputItem: variantId,
      outputCount: OUTPUT_COUNT[family],
      identifier: `${NAMESPACE}:sc_${material.base}_${FAMILY_FILENAME[family]}_from_${material.base}`,
    });
    desired.push({
      kind: "reset",
      base: material.base,
      family,
      inputItem: variantId,
      inputCount: RESET_INPUT_COUNT[family],
      outputItem: material.source,
      outputCount: 1,
      identifier: `${NAMESPACE}:sc_${material.base}_from_${material.base}_${family}`,
    });
  }
}

const changes = new Map();
const coverage = { subtype: 0, reset: 0 };
for (const target of desired) {
  const key = transformationKey(
    Array.from({ length: target.inputCount }, () => target.inputItem),
    target.outputItem,
    target.outputCount,
  );
  const existing = recipesByTransformation.get(key) ?? [];
  if (existing.length > 1) {
    throw new Error(`Duplicate recipe transformation ${key}: ${existing.map((entry) => entry.file).join(", ")}`);
  }

  const document = makeStonecutterRecipe(
    existing[0]?.identifier ?? target.identifier,
    target.inputItem,
    target.inputCount,
    target.outputItem,
    target.outputCount,
  );
  const file = existing[0]?.absolutePath ?? path.join(
    PROJECT_PATHS.recipes,
    "stonecutter",
    target.kind === "reset" ? "reset" : "subtypes",
    target.kind === "reset"
      ? `${target.base}_from_${target.base}_${target.family}.json`
      : `${target.base}_${target.family}_from_${target.base}.json`,
  );
  const current = existing[0]?.document ?? {};
  if (stableJson(current) !== stableJson(document)) changes.set(file, document);
  coverage[target.kind] += 1;
}

console.log(
  `${WRITE ? "Applying" : "Previewing"} variant recipes: ` +
  `${coverage.subtype} subtype + ${coverage.reset} full-reset recipes; ${changes.size} file(s) to write.`,
);
for (const file of [...changes.keys()].sort()) console.log(`- ${projectPath(file)}`);

if (WRITE) {
  for (const [file, document] of changes) await writeJson(file, document);
}
if (CHECK && changes.size > 0) process.exitCode = 1;
