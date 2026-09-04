import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_LOCALE,
  LANG_KEY,
  LOCALES,
  detectLocale,
  engineMessage,
  format,
  htmlLang,
  isLocale,
  loadLocale,
  saveLocale,
  strings,
} from "../js/i18n.mjs";

test("语言表：仅 zh / en，默认 zh", () => {
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.equal(DEFAULT_LOCALE, "zh");
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(isLocale(""), false);
  assert.equal(isLocale(null), false);
});

test("字符串表：zh/en 键完全对齐，除有意留空外不允许空翻译", () => {
  const zh = strings("zh");
  const en = strings("en");
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  const ALLOW_EMPTY_EN = new Set(["hudStep"]); // 英文无量词，有意留空
  for (const [key, value] of Object.entries(zh)) {
    assert.ok(String(value).length > 0, `zh.${key} 不能是空串`);
    if (!ALLOW_EMPTY_EN.has(key)) {
      assert.ok(String(en[key]).length > 0, `en.${key} 不能是空串`);
    }
  }
});

test("章节文案：5 章标题与描述成对出现", () => {
  const zh = strings("zh");
  const en = strings("en");
  for (let i = 1; i <= 5; i += 1) {
    assert.ok(zh[`ch${i}Title`] && zh[`ch${i}Desc`], `zh 缺第 ${i} 章文案`);
    assert.ok(en[`ch${i}Title`] && en[`ch${i}Desc`], `en 缺第 ${i} 章文案`);
  }
});

test("format：按序号插值，缺参保留占位符", () => {
  assert.equal(format("第 {0} 关 · 目标 {1} 步", 3, 7), "第 3 关 · 目标 7 步");
  assert.equal(format("Level {0} / {1}", 2), "Level 2 / {1}");
  assert.equal(format("no placeholders"), "no placeholders");
});

test("detectLocale：任意 zh* 语言 → zh，否则 en", () => {
  // Node 22 自带全局 navigator（语言随机器而定），测试前先固定为受控桩。
  const original = globalThis.navigator;
  const stub = (value) =>
    Object.defineProperty(globalThis, "navigator", { value, configurable: true });
  const restore = () => stub(original);
  try {
    stub({ languages: [], language: "en-US" });
    assert.equal(detectLocale(), "en");
    stub({ languages: ["en-US", "fr-FR"], language: "en-US" });
    assert.equal(detectLocale(), "en");
    stub({ languages: ["en-US", "zh-CN"], language: "en-US" });
    assert.equal(detectLocale(), "zh"); // 任意一项 zh* 即中文
    stub({ languages: [], language: "zh-Hans" });
    assert.equal(detectLocale(), "zh");
  } finally {
    restore();
  }
});

test("loadLocale：doin.lang 优先于浏览器语言，非法值回落", () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const original = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: { languages: [], language: "en-US" },
    configurable: true,
  });
  try {
    assert.equal(loadLocale(), "en"); // 无偏好 → 检测（桩固定 en）
    store.set(LANG_KEY, "zh");
    assert.equal(loadLocale(), "zh");
    store.set(LANG_KEY, "xx");
    assert.equal(loadLocale(), "en"); // 非法 → 重新检测
    store.delete(LANG_KEY);
    assert.equal(loadLocale(), "en");
  } finally {
    Object.defineProperty(globalThis, "navigator", { value: original, configurable: true });
    delete globalThis.localStorage;
  }
});

test("saveLocale：合法写入并返回 true，非法拒绝", () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    assert.equal(saveLocale("en"), true);
    assert.equal(store.get(LANG_KEY), "en");
    assert.equal(saveLocale("jp"), false);
    assert.equal(store.get(LANG_KEY), "en"); // 未被覆盖
  } finally {
    delete globalThis.localStorage;
  }
});

test("htmlLang：zh → zh-CN，en → en", () => {
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
});

test("engineMessage：en 按原文映射，zh 原样透传，未知文案不吞", () => {
  assert.equal(engineMessage("无法识别这次调度"), "Unrecognized move");
  assert.equal(engineMessage("已完成轨道不能取出星体"), "Completed lanes are locked");
  assert.equal(engineMessage("这条轨道当前不能落入星体"), "This lane can't take an orb right now");
  assert.equal(engineMessage("自定义消息"), "自定义消息");
  assert.equal(engineMessage(null), null);
});
