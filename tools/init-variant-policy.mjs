import { PROJECT_PATHS, pathExists, writeJson } from "./lib/project-index.mjs";
import { VARIANT_FAMILIES, buildVariantMatrix } from "./lib/variant-matrix.mjs";

if (await pathExists(PROJECT_PATHS.variantPolicy)) {
  throw new Error("content/variant-policy.json already exists; refusing to overwrite review decisions.");
}

const { rows } = await buildVariantMatrix();
const families = Object.keys(VARIANT_FAMILIES);
const policy = {
  $schema: "./variant-policy.schema.json",
  schemaVersion: 1,
  decisionValues: ["pending", "generate", "skip", "use_vanilla"],
  materials: rows.map((row) => ({
    base: row.base,
    source: row.source,
    variants: Object.fromEntries(families.map((family) => [family, "pending"])),
    notes: "",
  })),
};

await writeJson(PROJECT_PATHS.variantPolicy, policy);
console.log(`Created content/variant-policy.json with ${policy.materials.length} material families.`);
