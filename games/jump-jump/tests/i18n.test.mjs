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
  saveLocale,
  loadLocale,
} from "../js/i18n.mjs";

test("shared language preference key is doin.lang", () => {
  assert.equal(LANG_KEY, "doin.lang", "禁止私有语言 key，必须读写全站共享偏好");
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
    assert.equal(typeof zh[key], "string", `zh.${key} 必须是字符串`);
    assert.equal(typeof en[key], "string", `en.${key} 必须是字符串`);
    assert.ok(zh[key].trim().length > 0, `zh.${key} 不得为空`);
    assert.ok(en[key].trim().length > 0, `en.${key} 不得为空`);
  }
  assert.ok(zhKeys.length > 60, "词条数量应覆盖全部 UI 文案");
});

test("isLocale validates and strings() falls back to the default", () => {
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(isLocale(null), false);
  assert.equal(strings("fr"), strings("zh"));
  assert.equal(strings(undefined), strings("zh"));
});

test("format substitutes named params and leaves unknown ones intact", () => {
  assert.equal(format("得分 {n}", { n: 12 }), "得分 12");
  assert.equal(format("第 {n} / {total} 靶", { n: 2, total: 10 }), "第 2 / 10 靶");
  assert.equal(format("无参数"), "无参数");
  assert.equal(format("{missing}", {}), "{missing}");
  assert.equal(format(null, { a: 1 }), "");
});

test("htmlLang maps locale to a valid lang attribute", () => {
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
  assert.equal(htmlLang("xx"), "zh-CN");
});

test("saveLocale only accepts known locales and loadLocale never throws", () => {
  saveLocale("en");
  saveLocale("bogus");
  assert.ok(LOCALES.includes(loadLocale()), "loadLocale 必须总是返回合法语言");
});
