import test from "node:test";
import assert from "node:assert/strict";

import {
  LANG_KEY,
  LOCALES,
  DEFAULT_LOCALE,
  strings,
  isLocale,
  detectLocale,
  saveLocale,
  htmlLang,
  format,
} from "../js/i18n.mjs";

test("i18n: shared preference key is doin.lang", () => {
  assert.equal(LANG_KEY, "doin.lang");
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("fr"), false);
});

test("i18n: zh and en tables are aligned and non-empty", () => {
  const zh = strings("zh");
  const en = strings("en");
  const zhKeys = Object.keys(zh);
  const enKeys = Object.keys(en);
  assert.deepEqual(zhKeys, enKeys);
  assert.ok(zhKeys.length > 40);
  for (const key of zhKeys) {
    assert.ok(typeof zh[key] === "string" && zh[key].trim().length > 0, `zh.${key} 为空`);
    assert.ok(typeof en[key] === "string" && en[key].trim().length > 0, `en.${key} 为空`);
  }
});

test("i18n: unknown locale falls back to the default table", () => {
  assert.equal(strings("klingon"), strings(DEFAULT_LOCALE));
});

test("i18n: format fills placeholders and leaves unknown ones intact", () => {
  assert.equal(format(strings("zh").waveValue, { n: 3, max: 30 }), "3 / 30");
  assert.equal(format(strings("en").accValue, { n: 87 }), "87%");
  assert.equal(format("{n} {missing}", { n: 1 }), "1 {missing}");
  assert.equal(format(undefined, { n: 1 }), "");
});

test("i18n: html lang mapping and persistence helpers", () => {
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
  assert.equal(htmlLang("xx"), "zh-CN");
  saveLocale("nope"); // 非法值静默忽略
  saveLocale("en");
  assert.ok(["zh", "en"].includes(detectLocale()));
});
