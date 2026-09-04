import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

export const PROJECT_PATHS = Object.freeze({
  blocks: path.join(PROJECT_ROOT, "BP", "blocks"),
  recipes: path.join(PROJECT_ROOT, "BP", "recipes"),
  culling: path.join(PROJECT_ROOT, "RP", "block_culling"),
  generated: path.join(PROJECT_ROOT, "tools", "generated"),
  variantPolicy: path.join(PROJECT_ROOT, "content", "variant-policy.json"),
});

export function projectPath(absolutePath) {
  return path.relative(PROJECT_ROOT, absolutePath).split(path.sep).join("/");
}

export async function pathExists(targetPath) {
  try {
    await readFile(targetPath);
    return true;
  } catch (error) {
    if (error?.code === "EISDIR") return true;
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function walkJsonFiles(root) {
  const files = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolutePath);
      else if (entry.isFile() && entry.name.endsWith(".json")) files.push(absolutePath);
    }
  }

  await visit(root);
  return files;
}

export async function readJson(absolutePath) {
  return JSON.parse(await readFile(absolutePath, "utf8"));
}

function normalizeForStableJson(value) {
  if (Array.isArray(value)) return value.map(normalizeForStableJson);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((key) => [key, normalizeForStableJson(value[key])]),
  );
}

export function stableJson(value, indentation = 0) {
  return JSON.stringify(normalizeForStableJson(value), null, indentation);
}

export function groupBy(values, keySelector) {
  const groups = new Map();
  for (const value of values) {
    const key = keySelector(value);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(value);
  }
  return groups;
}

async function scanDefinitions(root, extractDefinition) {
  const definitions = [];
  const parseErrors = [];

  for (const absolutePath of await walkJsonFiles(root)) {
    let document;
    try {
      document = await readJson(absolutePath);
    } catch (error) {
      parseErrors.push({ file: projectPath(absolutePath), message: error.message });
      continue;
    }

    const extracted = extractDefinition(document);
    if (!extracted?.identifier) continue;

    definitions.push({
      ...extracted,
      file: projectPath(absolutePath),
      absolutePath,
      formatVersion: String(document.format_version ?? ""),
      document,
      signature: stableJson(document),
    });
  }

  return { definitions, parseErrors };
}

function extractBlock(document) {
  const block = document["minecraft:block"];
  if (!block) return undefined;
  return {
    identifier: block.description?.identifier,
    components: block.components ?? {},
    description: block.description ?? {},
  };
}

function extractRecipe(document) {
  const rootKey = Object.keys(document).find((key) => key.startsWith("minecraft:recipe_"));
  if (!rootKey) return undefined;
  const recipe = document[rootKey];
  return {
    identifier: recipe.description?.identifier,
    recipeType: rootKey,
  };
}

function extractCulling(document) {
  const culling = document["minecraft:block_culling_rules"];
  if (!culling) return undefined;
  return {
    identifier: culling.description?.identifier,
    rules: culling.rules ?? [],
  };
}

export async function scanProject() {
  const [blocks, recipes, culling] = await Promise.all([
    scanDefinitions(PROJECT_PATHS.blocks, extractBlock),
    scanDefinitions(PROJECT_PATHS.recipes, extractRecipe),
    scanDefinitions(PROJECT_PATHS.culling, extractCulling),
  ]);

  return {
    blocks: blocks.definitions,
    recipes: recipes.definitions,
    culling: culling.definitions,
    parseErrors: [...blocks.parseErrors, ...recipes.parseErrors, ...culling.parseErrors],
  };
}

export function duplicateGroups(definitions) {
  return [...groupBy(definitions, (entry) => entry.identifier).entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([identifier, entries]) => ({
      identifier,
      definitions: entries,
      semanticVariantCount: new Set(entries.map((entry) => entry.signature)).size,
    }))
    .sort((left, right) => left.identifier.localeCompare(right.identifier, "en"));
}

export function countValues(values) {
  return Object.fromEntries(
    [...groupBy(values, (value) => value).entries()]
      .map(([key, entries]) => [key, entries.length])
      .sort(([left], [right]) => left.localeCompare(right, "en")),
  );
}

export async function writeJson(targetPath, value) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(targetPath, value) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, value.endsWith("\n") ? value : `${value}\n`, "utf8");
}
