// i18n.test.mjs — 双语表严格对齐非空 + 插值 + 语言偏好读写

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  strings, format, isLocale, loadLocale, saveLocale, htmlLang, LANG_KEY, LOCALES,
} from "../js/i18n.mjs";

test("中英表格键集合完全一致", () => {
  const zh = strings("zh");
  const en = strings("en");
  const zhKeys = new Set(Object.keys(zh));
  const enKeys = new Set(Object.keys(en));
  assert.deepEqual(
    [...zhKeys].sort(),
    [...enKeys].sort(),
    "zh / en 键必须严格对齐",
  );
});

test("所有文案非空：字符串非空、数组非空且元素非空", () => {
  for (const locale of LOCALES) {
    const table = strings(locale);
    for (const [key, value] of Object.entries(table)) {
      if (Array.isArray(value)) {
        assert.ok(value.length > 0, `${locale}.${key} 数组不能为空`);
        for (const item of value) {
          assert.ok(typeof item === "string" && item.trim().length > 0, `${locale}.${key} 数组元素非空`);
        }
      } else {
        assert.ok(typeof value === "string" && value.trim().length > 0, `${locale}.${key} 不能为空`);
      }
    }
  }
});

test("插值格式正确", () => {
  assert.equal(format("第 {0} 阶", 3), "第 3 阶");
  assert.equal(format("{0} → {1}", "A", "B"), "A → B");
  assert.equal(format("无参数占位 {0}", undefined), "无参数占位 {0}");
});

test("语言偏好：合法值读写、非法值忽略、htmlLang 映射", () => {
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
  const before = loadLocale();
  assert.ok(LOCALES.includes(before), "当前语言必须是合法值");
  // Node 无 localStorage：注入内存桩验证读写
  const fakeStore = new Map();
  globalThis.localStorage = {
    getItem: (k) => (fakeStore.has(k) ? fakeStore.get(k) : null),
    setItem: (k, v) => fakeStore.set(k, String(v)),
    removeItem: (k) => fakeStore.delete(k),
  };
  try {
    assert.equal(saveLocale("en"), true);
    assert.equal(loadLocale(), "en", "写入后应读回 en");
    assert.equal(saveLocale("xx"), false, "非法语言不写入");
  } finally {
    delete globalThis.localStorage;
  }
  assert.ok(LANG_KEY.length > 0);
});

test("关键界面文案在双语下都存在", () => {
  for (const locale of LOCALES) {
    const t = strings(locale);
    for (const key of ["appTitle", "btnStart", "btnBattle", "shopTitle", "puzzlesTitle", "mirrorTitle", "helpTitle", "noscript", "back"]) {
      assert.ok(t[key]?.trim().length > 0, `${locale}.${key}`);
    }
  }
});
