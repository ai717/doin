import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { t, dict, normalizeLang, LANGS, LANG_KEY } from "../js/i18n.mjs";

const HAN = /[\u4e00-\u9fa5]/;

test("language preference uses the shared platform key", () => {
  assert.equal(LANG_KEY, "doin.lang");
  assert.deepEqual(LANGS, ["zh", "en"]);
  assert.equal(normalizeLang("en"), "en");
  assert.equal(normalizeLang("klingon"), "zh");
});

test("both dictionaries cover exactly the same keys", () => {
  const zh = dict("zh");
  const en = dict("en");
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
  for (const key of Object.keys(zh)) {
    assert.ok(en[key] && en[key].length > 0, `missing en value for ${key}`);
  }
});

test("english dictionary is free of han characters except the switch label", () => {
  const en = dict("en");
  for (const [key, value] of Object.entries(en)) {
    if (key === "langBtn") continue;
    assert.equal(HAN.test(value), false, `en.${key} contains chinese characters`);
  }
});

test("unknown keys fall back to the key itself", () => {
  assert.equal(t("nope", "en"), "nope");
  assert.equal(t("appTitle", "en"), "Starport Siege");
  assert.equal(t("appTitle", "zh"), "舷窗防线");
});

test("running sources carry no hardcoded display text", () => {
  const dir = new URL("../js/", import.meta.url);
  const files = readdirSync(dir).filter((name) => name.endsWith(".mjs") && name !== "i18n.mjs");
  for (const name of files) {
    const src = readFileSync(new URL(name, dir), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const matches = code.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
    assert.equal(matches, null, `${name} hardcodes chinese: ${matches?.slice(0, 2).join(", ")}`);
  }
});

test("level and data tables keep display text out", () => {
  for (const name of ["levels.mjs", "data.mjs"]) {
    const src = readFileSync(new URL(`../js/${name}`, import.meta.url), "utf8");
    const matches = src.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
    assert.equal(matches, null, `${name} hardcodes chinese`);
  }
});
