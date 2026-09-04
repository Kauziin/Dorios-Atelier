import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PROJECT_ROOT,
  projectPath,
  readJson,
  stableJson,
  writeJson,
  writeText,
} from "./lib/project-index.mjs";
import {
  blockName,
  GROUP_TRANSLATIONS,
  itemName,
  LOCALES,
  localeFileName,
  parseLang,
  serializeLang,
} from "./lib/localization.mjs";

const WRITE = process.argv.includes("--write");
const CHECK = process.argv.includes("--check");
const textDirectory = path.join(PROJECT_ROOT, "RP", "texts");
const changes = new Map();
const localeKeys = new Map();
const retiredKeys = new Set([
  "item.dorios_atelier:steel_chisel",
  "item.dorios_atelier:steel_glove",
]);

for (const locale of LOCALES) {
  const file = path.join(textDirectory, localeFileName(locale));
  const current = await readFile(file, "utf8");
  const entries = parseLang(current);
  for (const key of retiredKeys) entries.delete(key);
  for (const key of entries.keys()) {
    const itemMatch = key.match(/^item\.dorios_atelier:([^=]+)$/);
    if (itemMatch) entries.set(key, itemName(itemMatch[1], locale));

    const blockMatch = key.match(/^tile\.dorios_atelier:([^=]+)\.name$/);
    if (blockMatch) entries.set(key, blockName(blockMatch[1], locale));

    const groupMatch = key.match(/^dorios_atelier:itemGroup\.name\.([^=]+)$/);
    if (groupMatch) {
      const translation = GROUP_TRANSLATIONS[locale][groupMatch[1]];
      if (!translation) throw new Error(`No ${locale} item-group translation for ${groupMatch[1]}.`);
      entries.set(key, translation);
    }
  }
  localeKeys.set(locale, new Set(entries.keys()));
  const next = serializeLang(entries);
  if (next !== current.replace(/\r\n/g, "\n")) changes.set(file, { type: "text", value: next });
}

const referenceKeys = localeKeys.get("en_US");
for (const [locale, keys] of localeKeys) {
  const missing = [...referenceKeys].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !referenceKeys.has(key));
  if (missing.length || extra.length) {
    throw new Error(`${locale} key mismatch: ${missing.length} missing, ${extra.length} extra.`);
  }
}

const languagesPath = path.join(textDirectory, "languages.json");
const languages = await readJson(languagesPath);
if (stableJson(languages) !== stableJson(LOCALES)) {
  changes.set(languagesPath, { type: "json", value: LOCALES });
}

console.log(`${WRITE ? "Applying" : "Previewing"} localization normalization: ${changes.size} file(s).`);
for (const file of [...changes.keys()].sort()) console.log(`- ${projectPath(file)}`);

if (WRITE) {
  for (const [file, change] of changes) {
    if (change.type === "json") await writeJson(file, change.value);
    else await writeText(file, change.value);
  }
}
if (CHECK && changes.size > 0) process.exitCode = 1;
