import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOCALES,
  LANG_KEY,
  DEFAULT_LOCALE,
  strings,
  isLocale,
  format,
  detectLocale,
  loadLocale,
  htmlLang,
} from "../js/i18n.mjs";

test("LANG_KEY 为全站共享 doin.lang，不含私有前缀", () => {
  assert.equal(LANG_KEY, "doin.lang");
  assert.ok(LOCALES.includes("zh") && LOCALES.includes("en"));
});

test("中英键完全对齐且非空", () => {
  const zh = strings("zh");
  const en = strings("en");
  const zhKeys = Object.keys(zh).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(zhKeys, enKeys);
  for (const key of zhKeys) {
    assert.ok(typeof zh[key] === "string" && zh[key].length > 0, `zh.${key} 非空`);
    assert.ok(typeof en[key] === "string" && en[key].length > 0, `en.${key} 非空`);
  }
});

test("format 插值", () => {
  assert.equal(format("计时 {0} 秒", 12), "计时 12 秒");
  assert.equal(format("a{0}b{1}", 1, 2), "a1b2");
  assert.equal(format("无占位"), "无占位");
});

test("isLocale 与默认语言", () => {
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(strings("fr"), strings(DEFAULT_LOCALE));
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
});

test("detectLocale / loadLocale 始终返回合法语言", () => {
  assert.ok(LOCALES.includes(detectLocale()));
  assert.ok(LOCALES.includes(loadLocale()));
});