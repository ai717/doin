// 森林冰火人 · 多语言与 i18n 测试
// 覆盖：双语表 key 对齐非空、doin.lang 共享 key、locale 读写、格式化

import test from "node:test";
import assert from "node:assert/strict";
import {
  LOCALES,
  LANG_KEY,
  strings,
  format,
  isLocale,
  loadLocale,
  saveLocale,
  htmlLang
} from "../js/i18n.mjs";

// node 环境无 localStorage：mock 最小实现（浏览器端走真实 localStorage）
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
  clear: () => void store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; }
};

test("LANG_KEY 是全站共享的 doin.lang", () => {
  assert.equal(LANG_KEY, "doin.lang");
});

test("zh/en 双语表所有 key 严格对齐且非空", () => {
  const zh = strings("zh");
  const en = strings("en");
  const zhKeys = Object.keys(zh);
  const enKeys = Object.keys(en);
  assert.ok(zhKeys.length > 20, "中文表应有足够词条");
  assert.deepEqual(
    [...zhKeys].sort(),
    [...enKeys].sort(),
    "zh/en 词条集合必须完全一致"
  );
  for (const key of zhKeys) {
    assert.ok(typeof zh[key] === "string" && zh[key].trim().length > 0, `zh.${key} 非空`);
    assert.ok(typeof en[key] === "string" && en[key].trim().length > 0, `en.${key} 非空`);
  }
});

test("locale 读写与校验", () => {
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(loadLocale() === "zh" || loadLocale() === "en", true);
  assert.equal(saveLocale("en"), true);
  assert.equal(loadLocale(), "en");
  assert.equal(saveLocale("fr"), false, "非法 locale 拒绝保存");
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
});

test("format 占位符替换", () => {
  assert.equal(format("关卡 {0}-{1}", 3, 4), "关卡 3-4");
  assert.equal(format("{0} / {1}", 2, 5), "2 / 5");
  assert.equal(format("无占位"), "无占位");
});

test("常用渲染词条抽查", () => {
  const zh = strings("zh");
  const en = strings("en");
  assert.ok(zh.title.length > 0 && en.title.length > 0);
  assert.ok(zh.ruleTitle.includes("操作"), "规则弹窗标题含操作指南");
  assert.ok(en.fireKeys.includes("W"), "英文键位表含 W");
});
