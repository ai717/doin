import test from "node:test";
import assert from "node:assert/strict";

import {
  LOCALES,
  LANG_KEY,
  DEFAULT_LOCALE,
  isLocale,
  strings,
  format,
  htmlLang,
} from "../js/i18n.mjs";

test("shared language preference key is doin.lang", () => {
  assert.equal(LANG_KEY, "doin.lang");
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.equal(DEFAULT_LOCALE, "zh");
});

test("zh and en dictionaries have identical, non-empty keys", () => {
  const zh = strings("zh");
  const en = strings("en");
  const zhKeys = Object.keys(zh).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(zhKeys, enKeys, "中英文键必须严格对齐");
  for (const key of zhKeys) {
    assert.equal(typeof zh[key], "string");
    assert.equal(typeof en[key], "string");
    assert.ok(zh[key].trim().length > 0, `zh.${key} 不得为空`);
    assert.ok(en[key].trim().length > 0, `en.${key} 不得为空`);
  }
  assert.ok(zhKeys.length > 60);
});

test("isLocale validates and strings() falls back to the default", () => {
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(strings("fr"), strings("zh"));
});

test("format substitutes named params", () => {
  assert.equal(format("P{n}", { n: 2 }), "P2");
  assert.equal(format("{n} / {need}", { n: 3, need: 6 }), "3 / 6");
  assert.equal(format("{missing}", {}), "{missing}");
  assert.equal(format(null), "");
});

test("htmlLang maps locale to a valid lang attribute", () => {
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
  assert.equal(htmlLang("xx"), "zh-CN");
});
