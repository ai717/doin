// i18n.test.mjs —— 双语表对齐、非空、语言偏好读写全站共享 key

import test from "node:test";
import assert from "node:assert/strict";

import {
  LANG_KEY,
  LOCALES,
  DEFAULT_LOCALE,
  isLocale,
  strings,
  detectLocale,
  saveLocale,
  htmlLang,
  format,
} from "../js/i18n.mjs";

test("语言 key 是全站共享的 doin.lang", () => {
  assert.equal(LANG_KEY, "doin.lang");
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.equal(DEFAULT_LOCALE, "zh");
});

test("中英两表键完全对齐且非空", () => {
  const zh = strings("zh");
  const en = strings("en");
  const zhKeys = Object.keys(zh).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(zhKeys, enKeys, "中英键必须一一对应");
  for (const key of zhKeys) {
    assert.ok(typeof zh[key] === "string" && zh[key].trim().length > 0, `zh.${key} 为空`);
    assert.ok(typeof en[key] === "string" && en[key].trim().length > 0, `en.${key} 为空`);
  }
  assert.ok(zhKeys.length >= 50, "文案表规模不足");
});

test("未知语言回退默认，不抛错", () => {
  assert.equal(isLocale("jp"), false);
  assert.equal(strings("jp"), strings(DEFAULT_LOCALE));
  assert.equal(strings(undefined), strings(DEFAULT_LOCALE));
});

test("format 只替换存在的占位符，缺失时原样保留", () => {
  assert.equal(format("第 {n} 关", { n: 3 }), "第 3 关");
  assert.equal(format("第 {n} 关", {}), "第 {n} 关");
  assert.equal(format(null, { n: 1 }), "");
});

test("saveLocale 拒绝非法值，htmlLang 跟随语言", () => {
  assert.equal(saveLocale("jp"), DEFAULT_LOCALE);
  assert.equal(saveLocale("en"), "en");
  assert.equal(htmlLang("en"), "en");
  assert.equal(htmlLang("zh"), "zh-CN");
});

test("detectLocale 在无存储环境下也不抛错", () => {
  const locale = detectLocale();
  assert.ok(LOCALES.includes(locale), `detectLocale 返回了非法语言 ${locale}`);
});
