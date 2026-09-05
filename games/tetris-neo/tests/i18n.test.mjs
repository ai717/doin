import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  DEFAULT_LOCALE,
  LANG_KEY,
  LOCALES,
  detectLocale,
  format,
  htmlLang,
  isLocale,
  loadLocale,
  saveLocale,
  strings,
} from "../js/i18n.mjs";

const here = dirname(fileURLToPath(import.meta.url));

function installStorage(initial = new Map()) {
  const store = new Map(initial);
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  return store;
}

const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");

// Node 的 navigator 是只读 getter，必须用 defineProperty 覆盖。
function setNavigator(language, languages) {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { language, languages } });
}

function clearNavigator() {
  if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
  else delete globalThis.navigator;
}

test("全站统一常量：doin.lang / zh / en，默认中文", () => {
  assert.equal(LANG_KEY, "doin.lang");
  assert.deepEqual([...LOCALES], ["zh", "en"]);
  assert.equal(DEFAULT_LOCALE, "zh");
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  for (const bad of ["fr", "ZH", "", null, undefined, 1]) assert.equal(isLocale(bad), false);
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
});

test("中英字符串表键完全对齐且非空", () => {
  const zh = strings("zh");
  const en = strings("en");
  const zhKeys = Object.keys(zh).sort();
  const enKeys = Object.keys(en).sort();
  assert.ok(zhKeys.length >= 25, `字符串表应覆盖全部界面文案，实际 ${zhKeys.length} 条`);
  assert.deepEqual(enKeys, zhKeys, "两张表键必须一一对应");
  for (const key of zhKeys) {
    assert.equal(typeof zh[key], "string", `zh.${key} 必须是字符串`);
    assert.equal(typeof en[key], "string", `en.${key} 必须是字符串`);
    assert.ok(zh[key].trim().length > 0, `zh.${key} 不得为空`);
    assert.ok(en[key].trim().length > 0, `en.${key} 不得为空`);
  }
  assert.equal(strings("fr"), zh, "未知语言回退默认表");
  assert.equal(strings(undefined), zh);
});

test("index.html 的每个 data-i18n 键都在两张表里有文案", () => {
  const html = readFileSync(resolve(here, "../index.html"), "utf8");
  const keys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(keys.length >= 8, "HUD 与选择器文案应走 i18n");
  for (const key of keys) {
    assert.ok(strings("zh")[key], `zh 表缺 ${key}`);
    assert.ok(strings("en")[key], `en 表缺 ${key}`);
  }
});

test("format 用 {0} 位置插值，缺参数时保留占位符", () => {
  assert.equal(format("终局得分: {0}", 1500), "终局得分: 1500");
  assert.equal(format("{0} × {1} = {2}", 3, 4, 12), "3 × 4 = 12");
  assert.equal(format("重复 {0} 和 {0}", "x"), "重复 x 和 x");
  assert.equal(format("缺 {1}", "x"), "缺 {1}");
  assert.equal(format(strings("en").msgOver, 0), "Final Score: 0");
  assert.equal(format(42), "42");
});

test("detectLocale：浏览器语言 zh* → 中文，其余 → 英文", () => {
  setNavigator("zh-CN", ["zh-CN", "zh", "en-US"]);
  assert.equal(detectLocale(), "zh");
  setNavigator("zh-TW", ["zh-TW"]);
  assert.equal(detectLocale(), "zh");
  setNavigator("en-US", ["en-US", "en"]);
  assert.equal(detectLocale(), "en");
  setNavigator("ja", ["ja"]);
  assert.equal(detectLocale(), "en");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: undefined });
  assert.equal(detectLocale(), "en", "拿不到 navigator 也不抛异常");
  clearNavigator();
});

test("loadLocale：显式偏好优先于浏览器语言，坏偏好回退检测", () => {
  setNavigator("en-US", ["en-US"]);
  installStorage(new Map([[LANG_KEY, "zh"]]));
  assert.equal(loadLocale(), "zh", "偏好覆盖浏览器语言");

  installStorage(new Map([[LANG_KEY, "en"]]));
  assert.equal(loadLocale(), "en");

  installStorage(new Map([[LANG_KEY, "klingon"]]));
  assert.equal(loadLocale(), "en", "非法偏好 → 浏览器语言");

  installStorage();
  assert.equal(loadLocale(), "en", "无偏好 → 浏览器语言");

  setNavigator("zh-CN", ["zh-CN"]);
  installStorage();
  assert.equal(loadLocale(), "zh");
});

test("saveLocale：合法值写入全站共享 key，非法值拒写", () => {
  const store = installStorage();
  assert.equal(saveLocale("en"), true);
  assert.equal(store.get(LANG_KEY), "en");
  assert.equal(loadLocale(), "en");
  assert.equal(saveLocale("zh"), true);
  assert.equal(store.get(LANG_KEY), "zh");
  assert.equal(saveLocale("fr"), false);
  assert.equal(store.get(LANG_KEY), "zh", "非法值不得污染偏好");
});

test("localStorage 取用即抛错（隐私模式）时静默降级，不影响取文案", () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("隐私模式");
    },
  });
  setNavigator("zh-CN", ["zh-CN"]);
  assert.equal(loadLocale(), "zh", "拿不到偏好 → 回浏览器语言，不抛异常");
  assert.equal(saveLocale("en"), true, "写失败也不抛给 UI");
  assert.equal(loadLocale(), "zh", "偏好没落盘，语言不变");
  assert.equal(strings(loadLocale()).btnStart, "启动核心");
  delete globalThis.localStorage;
});
