// i18n.test.mjs: 双语表严格对齐、非空、占位符一致、全站共享 key

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

test("语言 key 必须是全站共享的 doin.lang", () => {
  assert.equal(LANG_KEY, "doin.lang");
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.equal(DEFAULT_LOCALE, "zh");
});

test("zh / en 键集合完全一致且无空值", () => {
  const zh = strings("zh");
  const en = strings("en");
  const zhKeys = Object.keys(zh).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(zhKeys, enKeys, "双语键不一致");
  for (const key of zhKeys) {
    assert.equal(typeof zh[key], "string");
    assert.ok(zh[key].trim().length > 0, `zh.${key} 为空`);
    assert.ok(en[key].trim().length > 0, `en.${key} 为空`);
  }
});

test("占位符在两种语言里一一对应", () => {
  const zh = strings("zh");
  const en = strings("en");
  const ph = (s) => (s.match(/\{(\w+)\}/g) ?? []).sort().join(",");
  for (const key of Object.keys(zh)) {
    assert.equal(ph(zh[key]), ph(en[key]), `占位符不一致：${key}`);
  }
});

test("未知语言退回默认表", () => {
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("jp"), false);
  assert.equal(isLocale(null), false);
  assert.equal(strings("jp"), strings("zh"));
  assert.equal(strings(), strings("zh"));
});

test("format 替换具名占位符，缺失时保留原样", () => {
  assert.equal(format("第 {n} 关", { n: 7 }), "第 7 关");
  assert.equal(format("{a} + {b}", { a: 1, b: 2 }), "1 + 2");
  assert.equal(format("{a} {b}", { a: 1 }), "1 {b}");
  assert.equal(format("{a}", null), "{a}");
  assert.equal(format(null, { a: 1 }), "");
});

test("htmlLang 输出合法语言标签", () => {
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
  assert.equal(htmlLang("xx"), "zh-CN");
});

test("detectLocale：无存储时按浏览器语言，中文归 zh", () => {
  const hadLS = "localStorage" in globalThis;
  const hadNav = "navigator" in globalThis;
  const prevLS = globalThis.localStorage;
  const prevNav = globalThis.navigator;
  const setLS = (value) => {
    if (value === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, "localStorage", { value, configurable: true, writable: true });
  };
  const setNav = (value) => {
    if (value === undefined) delete globalThis.navigator;
    else Object.defineProperty(globalThis, "navigator", { value, configurable: true, writable: true });
  };
  try {
    // 1) 存储里有 zh → 直接采用
    setLS({ getItem: (k) => (k === LANG_KEY ? "en" : null), setItem() {} });
    assert.equal(detectLocale(), "en");

    // 2) 存储里是非法值 → 走浏览器语言
    setLS({ getItem: () => "klingon", setItem() {} });
    setNav({ language: "en-US" });
    assert.equal(detectLocale(), "en");
    setNav({ language: "zh-Hans-CN" });
    assert.equal(detectLocale(), "zh");

    // 3) 什么都没有 → 默认 zh
    setLS(undefined);
    setNav(undefined);
    assert.equal(detectLocale(), DEFAULT_LOCALE);
  } finally {
    if (hadLS) Object.defineProperty(globalThis, "localStorage", { value: prevLS, configurable: true, writable: true });
    else delete globalThis.localStorage;
    if (hadNav) Object.defineProperty(globalThis, "navigator", { value: prevNav, configurable: true, writable: true });
    else delete globalThis.navigator;
  }
});

test("saveLocale 写入全站共享 key，非法值不写", () => {
  const writes = [];
  Object.defineProperty(globalThis, "localStorage", {
    value: { getItem: () => null, setItem: (k, v) => writes.push([k, v]) },
    configurable: true,
    writable: true,
  });
  try {
    saveLocale("en");
    assert.deepEqual(writes.at(-1), [LANG_KEY, "en"]);
    saveLocale("jp");
    assert.equal(writes.length, 1, "非法语言不应写入");
  } finally {
    delete globalThis.localStorage;
  }
});

test("saveLocale 在存储不可用时静默降级", () => {
  assert.doesNotThrow(() => saveLocale("en"));
});
