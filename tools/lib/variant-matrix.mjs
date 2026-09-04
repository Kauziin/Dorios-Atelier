import { readFile } from "node:fs/promises";
import { MinecraftBlockTypes } from "@minecraft/vanilla-data";
import {
  PROJECT_PATHS,
  groupBy,
  pathExists,
  readJson,
  scanProject,
} from "./project-index.mjs";

export const VARIANT_FAMILIES = Object.freeze({
  slab: {
    directory: "BP/blocks/decorative/slabs/",
    suffix: "_slab",
  },
  stairs: {
    directory: "BP/blocks/decorative/stairs/",
    suffix: "_stairs",
  },
  vertical_slab: {
    directory: "BP/blocks/decorative/vertical_slabs/",
    suffix: "_vertical_slab",
  },
  wall: {
    directory: "BP/blocks/decorative/walls/",
    suffix: "_wall",
  },
});

export const DECISION_VALUES = Object.freeze(["pending", "generate", "skip", "use_vanilla"]);

const VANILLA_IDS = new Set(Object.values(MinecraftBlockTypes));
const SOURCE_ALIASES = Object.freeze({
  dripstone: "minecraft:dripstone_block",
});

const VARIANT_NAME_ALIASES = Object.freeze({
  cobblestone: ["stone"],
  purpur_block: ["purpur"],
  stone: ["normal_stone"],
});

export function parseVariantBase(identifier, family) {
  const rule = VARIANT_FAMILIES[family];
  if (!rule || typeof identifier !== "string") return undefined;
  const separator = identifier.indexOf(":");
  const name = separator === -1 ? identifier : identifier.slice(separator + 1);
  return name.endsWith(rule.suffix) ? name.slice(0, -rule.suffix.length) : undefined;
}

function candidateVanillaNames(base, family) {
  const suffix = VARIANT_FAMILIES[family]?.suffix;
  if (!suffix) return [];

  const bases = new Set([base, ...(VARIANT_NAME_ALIASES[base] ?? [])]);
  if (base.endsWith("_bricks")) bases.add(base.slice(0, -1));
  if (base.endsWith("_tiles")) bases.add(base.slice(0, -1));

  return [...bases].map((candidateBase) => `minecraft:${candidateBase}${suffix}`);
}

export function findVanillaVariantIds(base, family) {
  return candidateVanillaNames(base, family)
    .filter((identifier) => VANILLA_IDS.has(identifier))
    .sort((left, right) => left.localeCompare(right, "en"));
}

function resolveSource(base, customBlockIds) {
  const customIdentifier = `dorios_atelier:${base}`;
  if (customBlockIds.has(customIdentifier)) return customIdentifier;

  const vanillaIdentifier = `minecraft:${base}`;
  if (VANILLA_IDS.has(vanillaIdentifier)) return vanillaIdentifier;

  const alias = SOURCE_ALIASES[base];
  return alias && VANILLA_IDS.has(alias) ? alias : null;
}

export async function loadVariantPolicy() {
  if (!(await pathExists(PROJECT_PATHS.variantPolicy))) return null;
  return readJson(PROJECT_PATHS.variantPolicy);
}

export function validateVariantPolicy(policy, expectedBases = []) {
  const issues = [];
  if (!policy || typeof policy !== "object") return ["Variant policy is missing or invalid."];
  if (!Array.isArray(policy.materials)) return ["variant-policy.json must contain a materials array."];

  const seen = new Set();
  for (const material of policy.materials) {
    if (!material?.base || typeof material.base !== "string") {
      issues.push("Every material policy needs a string base.");
      continue;
    }
    if (seen.has(material.base)) issues.push(`Duplicate material policy: ${material.base}`);
    seen.add(material.base);

    for (const family of Object.keys(VARIANT_FAMILIES)) {
      const decision = material.variants?.[family];
      if (!DECISION_VALUES.includes(decision)) {
        issues.push(`${material.base}.${family} has invalid decision: ${String(decision)}`);
      }
    }
  }

  for (const base of expectedBases) {
    if (!seen.has(base)) issues.push(`Missing material policy: ${base}`);
  }
  for (const base of seen) {
    if (expectedBases.length > 0 && !expectedBases.includes(base)) issues.push(`Unknown material policy: ${base}`);
  }
  return issues;
}

export function validateVariantMatrix(rows) {
  const issues = [];
  for (const row of rows) {
    if (!row.sourceExists) issues.push(`Unresolved source block: ${row.base} (${String(row.source)})`);
    for (const family of Object.keys(VARIANT_FAMILIES)) {
      const variant = row.variants[family];
      if (variant.decision === "use_vanilla" && variant.vanilla.length === 0) {
        issues.push(`${row.base}.${family} uses vanilla, but no vanilla equivalent was detected.`);
      }
      if (variant.decision === "generate" && !variant.current.present) {
        issues.push(`${row.base}.${family} is marked for generation, but its Atelier block is missing.`);
      }
      if (["skip", "use_vanilla"].includes(variant.decision) && variant.current.present) {
        issues.push(`${row.base}.${family} is marked ${variant.decision}, but its Atelier block still exists.`);
      }
    }
  }
  return issues;
}

export async function buildVariantMatrix(policy = null) {
  const project = await scanProject();
  const customBlockIds = new Set(project.blocks.map((entry) => entry.identifier));
  const familyRecords = new Map();
  const bases = new Set();

  for (const [family, rule] of Object.entries(VARIANT_FAMILIES)) {
    const matching = project.blocks.filter((entry) => entry.file.startsWith(rule.directory));
    const groups = groupBy(matching, (entry) => entry.identifier);

    for (const [identifier, definitions] of groups) {
      const base = parseVariantBase(identifier, family);
      if (!base) continue;
      bases.add(base);
      familyRecords.set(`${base}:${family}`, {
        present: true,
        identifier,
        definitionCount: definitions.length,
        files: definitions.map((entry) => entry.file).sort((left, right) => left.localeCompare(right, "en")),
        lightDampening: [...new Set(definitions.map((entry) => entry.components["minecraft:light_dampening"] ?? null))],
      });
    }
  }

  const policyByBase = new Map((policy?.materials ?? []).map((entry) => [entry.base, entry]));
  const rows = [...bases]
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((base) => {
      const source = policyByBase.get(base)?.source ?? resolveSource(base, customBlockIds);
      const variants = {};
      for (const family of Object.keys(VARIANT_FAMILIES)) {
        variants[family] = {
          current: familyRecords.get(`${base}:${family}`) ?? {
            present: false,
            identifier: null,
            definitionCount: 0,
            files: [],
            lightDampening: [],
          },
          vanilla: findVanillaVariantIds(base, family),
          decision: policyByBase.get(base)?.variants?.[family] ?? "pending",
        };
      }

      return {
        base,
        source,
        sourceExists: typeof source === "string"
          && (source.startsWith("minecraft:") ? VANILLA_IDS.has(source) : customBlockIds.has(source)),
        notes: policyByBase.get(base)?.notes ?? "",
        variants,
      };
    });

  return { rows, project };
}
