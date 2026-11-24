import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  LOCALES, LANG_KEY, DEFAULT_LOCALE, strings, isLocale, format, htmlLang, detectLocale,
} from "../js/i18n.mjs";
import { LEVELS } from "../js/levels.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const HAN = /[\u4e00-\u9fa5]/;

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("shared language key and defaults", () => {
  assert.equal(LANG_KEY, "doin.lang");
  assert.equal(DEFAULT_LOCALE, "zh");
  assert.deepEqual([...LOCALES], ["zh", "en"]);
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
});

test("zh and en tables have identical non-empty keys", () => {
  const zh = strings("zh");
  const en = strings("en");
  const zhKeys = Object.keys(zh).sort();
  assert.deepEqual(zhKeys, Object.keys(en).sort());
  for (const key of zhKeys) {
    assert.equal(typeof zh[key], "string");
    assert.equal(typeof en[key], "string");
    assert.ok(zh[key].length > 0, `zh key empty: ${key}`);
    assert.ok(en[key].length > 0, `en key empty: ${key}`);
  }
});

test("English table has no Han characters outside the switch-button whitelist", () => {
  const en = strings("en");
  const whitelist = /switchLang|langSwitch|toggleLang|langToggle|langOther|langBtn|langName|langLabel|langShort/i;
  for (const [key, value] of Object.entries(en)) {
    if (whitelist.test(key)) continue;
    assert.equal(HAN.test(value), false, `English string has Han characters: ${key}`);
  }
});

test("level and chapter lookup keys exist in both tables", () => {
  for (const table of [strings("zh"), strings("en")]) {
    for (const rings of [3, 5, 7, 9]) {
      assert.ok(table[`chapter${rings}`]);
    }
    for (const level of LEVELS) {
      assert.ok(table[level.mode === "link" ? "linkShort" : "unlinkShort"]);
      assert.ok(table[level.kind === "mid" ? "midLevel" : "fullLevel"]);
    }
  }
});

test("runtime source has no bare Chinese string literals outside i18n module", () => {
  const jsDir = resolve(root, "js");
  const files = readdirSync(jsDir).filter((name) => name.endsWith(".mjs") && name !== "i18n.mjs");
  for (const name of files) {
    const code = stripComments(readFileSync(resolve(jsDir, name), "utf8"));
    const withoutSwitchLabel = code.replace(/(["'`])中文\1/g, '""');
    const matches = withoutSwitchLabel.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
    assert.equal(matches, null, `${name} has bare Chinese literals: ${matches?.slice(0, 2).join(", ")}`);
  }
});

test("format interpolates placeholders and keeps unknown ones", () => {
  assert.equal(format("用了 {0} 步 · 最优 {1} 步", 12, 5), "用了 12 步 · 最优 5 步");
  assert.equal(format("{0} {2}", "a", "b"), "a {2}");
});

test("detectLocale maps any zh tag to Chinese, otherwise English", () => {
  const original = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", { value: { languages: ["zh-CN", "en"] }, configurable: true });
  assert.equal(detectLocale(), "zh");
  Object.defineProperty(globalThis, "navigator", { value: { languages: ["en-US"], language: "en-US" }, configurable: true });
  assert.equal(detectLocale(), "en");
  Object.defineProperty(globalThis, "navigator", { value: original, configurable: true });
});
