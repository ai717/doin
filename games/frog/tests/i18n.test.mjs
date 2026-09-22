import { test } from "node:test";
import assert from "node:assert/strict";
import * as i18n from "../js/i18n.mjs";

test("中英键完全对齐且非空", () => {
  const zh = i18n.strings("zh");
  const en = i18n.strings("en");
  const zhKeys = Object.keys(zh).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(zhKeys, enKeys, "中英表键不一致");
  for (const key of zhKeys) {
    assert.ok(typeof zh[key] === "string" && zh[key].length > 0, `zh.${key} 为空`);
    assert.ok(typeof en[key] === "string" && en[key].length > 0, `en.${key} 为空`);
  }
});

test("isLocale / strings 回退", () => {
  assert.equal(i18n.isLocale("zh"), true);
  assert.equal(i18n.isLocale("en"), true);
  assert.equal(i18n.isLocale("fr"), false);
  assert.equal(i18n.strings("fr"), i18n.strings(i18n.DEFAULT_LOCALE));
});

test("format 占位替换", () => {
  assert.equal(i18n.format("第 {0} 章", 3), "第 3 章");
  assert.equal(i18n.format("{0} 秒", 1.5), "1.5 秒");
  assert.equal(i18n.format("无占位"), "无占位");
  assert.equal(i18n.format("缺失 {1}", 0), "缺失 {1}");
});

test("语言偏好 key 为全站共享 doin.lang", () => {
  assert.equal(i18n.LANG_KEY, "doin.lang");
});

test("htmlLang 映射", () => {
  assert.equal(i18n.htmlLang("zh"), "zh-CN");
  assert.equal(i18n.htmlLang("en"), "en");
});

test("章节标题键存在", () => {
  const zh = i18n.strings("zh");
  for (let i = 1; i <= 5; i += 1) {
    assert.ok(zh[`chapter${i}`], `缺少 chapter${i}`);
  }
});