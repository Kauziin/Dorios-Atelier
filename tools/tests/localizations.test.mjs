import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { PROJECT_ROOT, readJson } from "../lib/project-index.mjs";
import { LOCALES, parseLang, serializeLang } from "../lib/localization.mjs";

const textDirectory = path.join(PROJECT_ROOT, "RP", "texts");

test("all supported locales have the same complete and canonically ordered key set", async () => {
  assert.deepEqual(await readJson(path.join(textDirectory, "languages.json")), LOCALES);
  let referenceKeys;

  for (const locale of LOCALES) {
    const text = (await readFile(path.join(textDirectory, `${locale}.lang`), "utf8")).replace(/\r\n/g, "\n");
    const entries = parseLang(text);
    assert.equal(text, serializeLang(entries), locale);

    const keys = [...entries.keys()].sort();
    referenceKeys ??= keys;
    assert.deepEqual(keys, referenceKeys, locale);

    const orderedKeys = [...entries.keys()];
    const lastItem = orderedKeys.findLastIndex((key) => key.startsWith("item."));
    const firstBlock = orderedKeys.findIndex((key) => key.startsWith("tile."));
    const lastBlock = orderedKeys.findLastIndex((key) => key.startsWith("tile."));
    assert.ok(lastItem >= 0 && firstBlock > lastItem, `${locale}: items must precede blocks.`);
    assert.ok(orderedKeys.slice(0, firstBlock).every((key) => key.startsWith("item.")), locale);
    assert.ok(orderedKeys.slice(firstBlock, lastBlock + 1).every((key) => key.startsWith("tile.")), locale);
    assert.ok(orderedKeys.slice(lastBlock + 1).every((key) => !key.startsWith("item.") && !key.startsWith("tile.")), locale);
  }
});

test("regional locales use real dialect-specific block and glass names", async () => {
  const languages = Object.fromEntries(await Promise.all(LOCALES.map(async (locale) => [
    locale,
    parseLang(await readFile(path.join(textDirectory, `${locale}.lang`), "utf8")),
  ])));
  const get = (locale, identifier) => languages[locale].get(`tile.dorios_atelier:${identifier}.name`);
  const getItem = (locale, identifier) => languages[locale].get(`item.dorios_atelier:${identifier}`);

  assert.equal(get("pt_BR", "brown_broadline_glass"), "Vidro de Borda Larga Marrom");
  assert.equal(get("pt_PT", "brown_broadline_glass"), "Vidro de Borda Larga Castanho");
  assert.equal(get("pt_PT", "chiseled_deepslate"), "Ardósia Cinzelada");
  assert.equal(get("pt_PT", "snowy_grass_block"), "Bloco de Erva com Neve");
  assert.equal(get("es_ES", "brown_broadline_glass"), "Cristal de Borde Ancho Marrón");
  assert.equal(get("es_ES", "blackstone_tiles"), "Baldosas de Rocanegra");
  assert.equal(get("es_MX", "brown_broadline_glass"), "Vidrio de Borde Ancho Café");
  assert.equal(get("es_MX", "blackstone_tiles"), "Losetas de Piedra Negra");
  assert.equal(getItem("pt_PT", "copper_glove"), "Luva de §vCobre§r");
  assert.equal(getItem("es_ES", "copper_glove"), "Guante de §vCobre§r");
  assert.equal(getItem("es_MX", "stone_chisel"), "Cincel de §hPiedra§r");

  const glassKeys = [...languages.en_US.keys()].filter((key) => key.endsWith("_glass.name"));
  for (const locale of ["pt_BR", "pt_PT", "es_ES", "es_MX"]) {
    for (const key of glassKeys) assert.notEqual(languages[locale].get(key), languages.en_US.get(key), `${locale}:${key}`);
  }
});
