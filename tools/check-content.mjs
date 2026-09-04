import { duplicateGroups, scanProject } from "./lib/project-index.mjs";
import {
  VARIANT_FAMILIES,
  buildVariantMatrix,
  loadVariantPolicy,
  validateVariantMatrix,
  validateVariantPolicy,
} from "./lib/variant-matrix.mjs";

const requireDecisions = process.argv.includes("--require-decisions");
const project = await scanProject();
const errors = [];

for (const parseError of project.parseErrors) {
  errors.push(`Invalid JSON: ${parseError.file}: ${parseError.message}`);
}

for (const [label, entries] of [
  ["block", project.blocks],
  ["recipe", project.recipes],
  ["culling rule", project.culling],
]) {
  for (const duplicate of duplicateGroups(entries)) {
    errors.push(`Duplicate ${label} identifier ${duplicate.identifier}: ${duplicate.definitions.map((entry) => entry.file).join(", ")}`);
  }
}

const policy = await loadVariantPolicy();
const { rows } = await buildVariantMatrix(policy);
errors.push(...validateVariantPolicy(policy, rows.map((row) => row.base)));
errors.push(...validateVariantMatrix(rows));

if (requireDecisions) {
  for (const row of rows) {
    for (const family of Object.keys(VARIANT_FAMILIES)) {
      if (row.variants[family].decision === "pending") errors.push(`Pending decision: ${row.base}.${family}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Content check failed with ${errors.length} issue(s):`);
  const visibleErrors = errors.slice(0, 25);
  for (const error of visibleErrors) console.error(`- ${error}`);
  if (errors.length > visibleErrors.length) {
    console.error(`- ... ${errors.length - visibleErrors.length} additional issue(s) omitted.`);
  }
  process.exitCode = 1;
} else {
  console.log("Content check passed.");
}
