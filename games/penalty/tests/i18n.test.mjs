import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { LOCALES, strings, format, isLocale, htmlLang, applyLocale, LANG_KEY } from "../js/i18n.mjs";

const HAN = /[\u4e00-\u9fa5]/;
const root = resolve(import.meta.dirname, "..");

test("both locales define the same non-empty keys", () => {
  const zh = strings("zh");
  const en = strings("en");
  const zhKeys = Object.keys(zh).sort();
  assert.deepEqual(Object.keys(en).sort(), zhKeys);
  for (const key of zhKeys) {
    assert.ok(typeof zh[key] === "string" && zh[key].length > 0, `zh ${key}`);
    assert.ok(typeof en[key] === "string" && en[key].length > 0, `en ${key}`);
  }
});

test("English table has no Han characters except the switch marker", () => {
  const en = strings("en");
  for (const [key, value] of Object.entries(en)) {
    if (key === "langLabel" || key === "langShort") continue;
    assert.equal(HAN.test(value), false, `English string has Han characters: ${key}`);
  }
  assert.ok(HAN.test(en.langLabel), "the marker itself may name the other language");
});

test("locale helpers and template formatting", () => {
  assert.deepEqual([...LOCALES], ["zh", "en"]);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(strings("fr").title, strings("zh").title);
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
  assert.equal(format("第 {0} 轮 · {1}", 7, "x"), "第 7 轮 · x");
  assert.equal(format("no placeholders", 1), "no placeholders");
});

test("source files outside i18n contain no raw Chinese string literals", () => {
  const jsDir = resolve(root, "js");
  for (const name of readdirSync(jsDir)) {
    if (!name.endsWith(".mjs") || name === "i18n.mjs") continue;
    const code = readFileSync(resolve(jsDir, name), "utf8");
    const stripped = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const matches = stripped.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
    assert.equal(matches, null, `${name} has untranslated literals: ${matches?.slice(0, 2).join(", ")}`);
  }
});

test("hot update never reloads and uses the shared language key", () => {
  const source = readFileSync(resolve(root, "js", "i18n.mjs"), "utf8");
  const main = readFileSync(resolve(root, "js", "main.mjs"), "utf8");
  assert.equal(/location\s*\.\s*reload/.test(source), false);
  assert.equal(/location\s*\.\s*reload/.test(main), false);
  assert.ok(source.includes(LANG_KEY));
  assert.equal(LANG_KEY, "doin.lang");
  assert.ok(source.includes("data-i18n"));
});
