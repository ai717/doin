// i18n.test.mjs —— 双语表：键对齐且非空、英文表零汉字、源码零裸写中文、
// format 占位替换、applyLocale 原地热更新语义、共享语言 key。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  LANG_KEY,
  LOCALES,
  DEFAULT_LOCALE,
  strings,
  format,
  detectLocale,
  saveLocale,
  loadLocale,
  htmlLang,
  isLocale,
  applyLocale,
} from "../js/i18n.mjs";

const gameDir = resolve(import.meta.dirname, "..");

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("i18n: zh and en tables share the same non-empty keys", () => {
  const zh = strings("zh");
  const en = strings("en");
  const zhKeys = Object.keys(zh).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(enKeys, zhKeys);
  for (const key of zhKeys) {
    assert.ok(typeof zh[key] === "string" && zh[key].length > 0, `zh.${key} empty`);
    assert.ok(typeof en[key] === "string" && en[key].length > 0, `en.${key} empty`);
  }
});

test("i18n: english table has no Chinese characters", () => {
  const en = strings("en");
  // 白名单：语言切换按钮自身标识
  const whitelist = /langSwitch/i;
  for (const [key, value] of Object.entries(en)) {
    if (whitelist.test(key)) continue;
    assert.ok(!/[\u4e00-\u9fa5]/.test(value), `en.${key} contains Chinese: ${value}`);
  }
});

test("i18n: runtime sources carry no hardcoded Chinese outside i18n.mjs", () => {
  const jsDir = resolve(gameDir, "js");
  for (const name of readdirSync(jsDir)) {
    const path = resolve(jsDir, name);
    if (!statSync(path).isFile() || !name.endsWith(".mjs")) continue;
    if (name === "i18n.mjs") continue;
    const code = stripComments(readFileSync(path, "utf8"));
    const matches = code.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
    assert.ok(!matches, `${name} hardcodes Chinese: ${matches?.slice(0, 2).join(", ")}`);
  }
});

test("i18n: format replaces named placeholders", () => {
  assert.equal(format("Clear {n} rows", { n: 12 }), "Clear 12 rows");
  assert.equal(format("{n} 连击！", { n: 3 }), "3 连击！");
  assert.equal(format("no params"), "no params");
  assert.equal(format("keep {missing}", { n: 1 }), "keep {missing}");
  assert.equal(format(null, { n: 1 }), "");
});

test("i18n: locale helpers", () => {
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.equal(DEFAULT_LOCALE, "zh");
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(isLocale(null), false);
  assert.equal(htmlLang("en"), "en");
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("nope"), "zh-CN");
  assert.equal(strings("fr"), strings("zh")); // 未知回落中文
});

test("i18n: detect/save use the shared doin.lang key", () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    assert.equal(saveLocale("en"), "en");
    assert.equal(store.get(LANG_KEY), "en");
    assert.equal(detectLocale(), "en");
    assert.equal(loadLocale(), "en");
    store.set(LANG_KEY, "garbage");
    assert.equal(detectLocale(), DEFAULT_LOCALE);
    saveLocale("zh");
    assert.equal(detectLocale(), "zh");
    saveLocale("nope"); // 非法值不落盘
    assert.equal(store.get(LANG_KEY), "zh");
  } finally {
    delete globalThis.localStorage;
  }
});

test("i18n: applyLocale hot-updates a fake DOM without touching game state", () => {
  const elements = [];
  function datasetKey(attr) {
    const rest = attr.replace(/^data-i18n/, ""); // "" | "-aria" | "-title"
    return "i18n" + rest.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  }
  function el(attrs) {
    return {
      attrs,
      dataset: Object.fromEntries(
        Object.entries(attrs)
          .filter(([k]) => k.startsWith("data-i18n"))
          .map(([k, v]) => [datasetKey(k), v])
      ),
      textContent: "",
      setAttribute(k, v) {
        this.attrs[k] = v;
      },
    };
  }
  const a = el({ "data-i18n": "appTitle" });
  const b = el({ "data-i18n": "hudScore" });
  const c = el({ "data-i18n-aria": "actRotate" });
  const d = el({ "data-i18n-title": "help" });
  const root = {
    querySelectorAll(sel) {
      if (sel === "[data-i18n]") return [a, b];
      if (sel === "[data-i18n-aria]") return [c];
      if (sel === "[data-i18n-title]") return [d];
      return [];
    },
  };
  applyLocale(root, "zh");
  assert.equal(a.textContent, "积木爆破");
  assert.equal(b.textContent, "总分");
  assert.equal(c.attrs["aria-label"], "旋转");
  assert.equal(d.attrs.title, "玩法");
  applyLocale(root, "en");
  assert.equal(a.textContent, "Block Blast");
  assert.equal(b.textContent, "Score");
  assert.equal(c.attrs["aria-label"], "Rotate");
  assert.equal(d.attrs.title, "How to play");
  // 未知 key 不动
  const e = el({ "data-i18n": "nope" });
  const root2 = { querySelectorAll: (sel) => (sel === "[data-i18n]" ? [e] : []) };
  applyLocale(root2, "en");
  assert.equal(e.textContent, "");
});

test("i18n: difficulty keys exist for every tier", () => {
  const zh = strings("zh");
  const en = strings("en");
  for (const key of [
    "diffEasy", "diffNormal", "diffHard",
    "diffEasyDesc", "diffNormalDesc", "diffHardDesc",
    "hudDifficulty", "actDifficulty", "difficultyTitle", "difficultyNote",
    "resultDifficulty", "btnDifficulty", "toastRotOnTray", "statBest",
  ]) {
    assert.ok(zh[key], `zh.${key}`);
    assert.ok(en[key], `en.${key}`);
  }
  assert.equal(format(zh.statBest, { n: 100 }), "最高分 100");
  assert.equal(format(en.statBest, { n: 100 }), "Best 100");
});
