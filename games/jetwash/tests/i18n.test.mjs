import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { strings, isLocale, levelName, format, htmlLang, LOCALES } from "../js/i18n.mjs";
import { LEVEL_IDS } from "../js/levels.mjs";

const HAN = /[\u4e00-\u9fa5]/;
const root = resolve(import.meta.dirname, "..");

test("locale guards and html language tags", () => {
  assert.deepEqual([...LOCALES], ["zh", "en"]);
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
});

test("English table has no Han characters except the switch marker", () => {
  const en = strings("en");
  for (const [key, value] of Object.entries(en)) {
    if (key === "langLabel") continue;
    assert.equal(HAN.test(value), false, `English string has Han characters: ${key}`);
  }
  assert.equal(typeof en.langLabel, "string");
});

test("Chinese and English tables share the exact same keys", () => {
  const zh = strings("zh");
  const en = strings("en");
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
  assert.ok(HAN.test(zh.title));
});

test("every level id resolves to a localized name in both locales", () => {
  for (const id of LEVEL_IDS) {
    assert.ok(levelName("zh", id) && levelName("en", id));
    assert.equal(HAN.test(levelName("en", id)), false, id);
  }
});

test("format substitutes indexed placeholders and leaves unknown tokens", () => {
  assert.equal(format("{0} / {1}", "a", "b"), "a / b");
  assert.equal(format("{0} {2}", "x"), "x {2}");
});

test("data layer source files have no bare Chinese strings", () => {
  const jsDir = resolve(root, "js");
  for (const name of readdirSync(jsDir)) {
    if (!name.endsWith(".mjs") || name === "i18n.mjs") continue;
    const code = readFileSync(resolve(jsDir, name), "utf8");
    assert.equal(HAN.test(code), false, `${name} contains bare Chinese`);
  }
});
