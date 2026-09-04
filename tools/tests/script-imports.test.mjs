import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { PROJECT_ROOT } from "../lib/project-index.mjs";

const SCRIPTS_ROOT = path.join(PROJECT_ROOT, "BP", "scripts");
const IMPORT_PATTERN = /\bimport\s+(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g;

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(absolutePath);
    return entry.isFile() && entry.name.endsWith(".js") ? [absolutePath] : [];
  }));
  return nested.flat();
}

test("all relative behavior-pack imports resolve with exact filename casing", async () => {
  for (const sourcePath of await javascriptFiles(SCRIPTS_ROOT)) {
    const source = await readFile(sourcePath, "utf8");
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1];
      if (!specifier.startsWith(".")) continue;

      const targetPath = path.resolve(path.dirname(sourcePath), specifier);
      const targetNames = await readdir(path.dirname(targetPath));
      assert.ok(
        targetNames.includes(path.basename(targetPath)),
        `${path.relative(PROJECT_ROOT, sourcePath)} imports missing or mis-cased path ${specifier}`,
      );
    }
  }
});

test("tool scripts register only custom components used by Atelier items", async () => {
  const registrations = {
    "chisel.js": "dorios_atelier:chisel",
    "glassCutter.js": "dorios_atelier:glass_cutter",
    "furnitureHammer.js": "dorios_atelier:furniture_hammer",
  };

  for (const [fileName, componentId] of Object.entries(registrations)) {
    const source = await readFile(path.join(SCRIPTS_ROOT, fileName), "utf8");
    assert.ok(source.includes(componentId), fileName);
    assert.equal(source.includes("utilitycraft:chisel"), false, fileName);
    assert.equal(source.includes("utilitycraft:glass_cutter"), false, fileName);
    assert.equal(source.includes("utilitycraft:furniture_hammer"), false, fileName);
  }
});
