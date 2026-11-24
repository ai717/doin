import test from "node:test";
import assert from "node:assert/strict";
import { LANG_KEY, hasKey, loadLocale, otherLocale, saveLocale, strings, t } from "../js/i18n.mjs";

function keys(table) {
  return Object.keys(table).sort();
}

function placeholders(value) {
  return new Set([...String(value).matchAll(/\{(\w+)\}/g)].map((match) => match[1]));
}

test("i18n：中英双表键完全对齐且非空", () => {
  assert.deepEqual(keys(strings.zh), keys(strings.en));
  for (const key of keys(strings.zh)) {
    assert.ok(String(strings.zh[key]).length > 0, `zh.${key} 为空`);
    assert.ok(String(strings.en[key]).length > 0, `en.${key} 为空`);
  }
});

test("i18n：英文表除语言按钮外零汉字", () => {
  for (const [key, value] of Object.entries(strings.en)) {
    if (key === "langShort" || key === "htmlLang") continue;
    assert.equal(/[\u4e00-\u9fff]/.test(String(value)), false, `en.${key} 含汉字`);
  }
});

test("i18n：双表占位符集合一致", () => {
  for (const key of keys(strings.zh)) {
    assert.deepEqual([...placeholders(strings.zh[key])].sort(), [...placeholders(strings.en[key])].sort(), key);
  }
});

test("i18n：t 支持插值、数字与缺省回退", () => {
  assert.equal(t("zh", "stageLabel", { n: 3 }), "第 3 面");
  assert.equal(t("en", "stageLabel", { n: 3 }), "Stage 3");
  assert.equal(t("en", "missing-key"), "missing-key");
  assert.equal(t("fr", "pause"), strings.zh.pause);
  assert.equal(hasKey("en", "stageCloud"), true);
  assert.equal(hasKey("en", "nope"), false);
});

test("i18n：otherLocale 双向切换", () => {
  assert.equal(otherLocale("zh"), "en");
  assert.equal(otherLocale("en"), "zh");
});

test("i18n：doin.lang 读写与非法值兜底", () => {
  const original = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  try {
    saveLocale("en");
    assert.equal(store.get(LANG_KEY), "en");
    assert.equal(loadLocale(), "en");
    saveLocale("zh");
    assert.equal(loadLocale(), "zh");
    store.set(LANG_KEY, "klingon");
    assert.ok(["zh", "en"].includes(loadLocale()));
  } finally {
    globalThis.localStorage = original;
  }
});

test("i18n：文档语言标签随表切换", () => {
  assert.equal(t("zh", "htmlLang"), "zh-CN");
  assert.equal(t("en", "htmlLang"), "en");
  assert.equal(t("en", "langShort"), "中文");
});
