import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  DEFAULT_LOCALE, LANG_KEY, LOCALES, detectLocale, format, htmlLang, isLocale,
  loadLocale, saveLocale, strings,
} from "../js/i18n.mjs";

const eq = assert.strictEqual;
const HAN = /[\u4e00-\u9fa5]/;
const gameRoot = resolve(import.meta.dirname, "..");

function installStorage(entries = []) {
  const store = new Map(entries);
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  return store;
}

function withNavigator(value, fn) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { value, configurable: true, writable: true });
  try {
    return fn();
  } finally {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else delete globalThis.navigator;
  }
}

test("语言偏好使用全站共享 key doin.lang", () => {
  eq(LANG_KEY, "doin.lang");
  eq(DEFAULT_LOCALE, "zh");
  assert.deepEqual(LOCALES, ["zh", "en"]);
  eq(isLocale("zh"), true);
  eq(isLocale("en"), true);
  for (const bad of ["fr", "ZH", "", null, undefined, 0]) eq(isLocale(bad), false);
});

test("detectLocale：zh 开头判中文，其余英文", () => {
  eq(withNavigator({ languages: ["zh-CN"], language: "zh-CN" }, detectLocale), "zh");
  eq(withNavigator({ languages: ["en-US", "zh"], language: "en-US" }, detectLocale), "zh");
  eq(withNavigator({ languages: ["ja-JP"], language: "ja-JP" }, detectLocale), "en");
  eq(withNavigator(undefined, detectLocale), "en");
});

test("loadLocale / saveLocale 的优先级与降级", () => {
  withNavigator({ languages: ["zh-CN"], language: "zh-CN" }, () => {
    installStorage();
    eq(loadLocale(), "zh");
    installStorage([[LANG_KEY, "en"]]);
    eq(loadLocale(), "en");
    installStorage([[LANG_KEY, "garbage"]]);
    eq(loadLocale(), "zh");
  });
  const store = installStorage();
  eq(saveLocale("en"), true);
  eq(store.get(LANG_KEY), "en");
  eq(saveLocale("fr"), false);
  eq(store.get(LANG_KEY), "en");
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
    removeItem: () => {},
  };
  eq(saveLocale("en"), false);
});

test("htmlLang 映射", () => {
  eq(htmlLang("zh"), "zh-CN");
  eq(htmlLang("en"), "en");
  eq(htmlLang("fr"), "en");
});

test("中英双表键完全对齐且非空", () => {
  const zh = strings("zh");
  const en = strings("en");
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  for (const [key, value] of Object.entries(zh)) {
    eq(typeof value, "string", `zh.${key} 必须是字符串`);
    assert.ok(value.length > 0, `zh.${key} 不能为空`);
    eq(typeof en[key], "string", `en.${key} 类型必须一致`);
    assert.ok(en[key].length > 0, `en.${key} 不能为空`);
  }
});

test("strings.en 零汉字（语言切换按钮除外）", () => {
  const offenders = Object.entries(strings("en"))
    .filter(([key, value]) => HAN.test(value) && !/langLabel|langShort/i.test(key))
    .map(([key]) => key);
  assert.deepEqual(offenders, []);
});

test("strings 非法 locale 回落默认语言", () => {
  eq(strings("fr"), strings("zh"));
  eq(strings(undefined), strings("zh"));
  eq(strings(null), strings("zh"));
});

test("format：编号占位符插值，缺参保留原样", () => {
  eq(format("残局 {0} · {1}/{2}", 3, 1, 2), "残局 3 · 1/2");
  eq(format("Puzzle {0}", 7), "Puzzle 7");
  eq(format("no placeholder"), "no placeholder");
  eq(format("keep {0}"), "keep {0}");
  eq(format("zero {0}", 0), "zero 0");
});

function collectSources(directory, out = []) {
  for (const name of readdirSync(directory)) {
    if (name === "node_modules" || name === "dist" || name === "tests") continue;
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      collectSources(path, out);
      continue;
    }
    if (/\.(mjs|js|ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("运行源码零裸写中文：展示文案全部走 i18n 查表", () => {
  const files = collectSources(resolve(gameRoot, "js"));
  assert.ok(files.length >= 7, `扫描到的源码过少（${files.length}）`);
  const offenders = [];
  for (const file of files) {
    const rel = relative(gameRoot, file).replace(/\\/g, "/");
    if (rel === "js/i18n.mjs") continue;
    const code = stripComments(readFileSync(file, "utf8")).replace(/(["'`])中文\1/g, '""');
    const hits = code.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
    if (hits) offenders.push(`${rel}: ${hits.slice(0, 2).join(", ")}`);
  }
  assert.deepEqual(offenders, [], `源码硬编码中文:\n${offenders.join("\n")}`);
});

test("i18n 模块 DOM-free，且不使用 location.reload", () => {
  const source = readFileSync(join(gameRoot, "js", "i18n.mjs"), "utf8");
  assert.ok(!stripComments(source).includes("location.reload"));
  assert.ok(!source.includes("document."));
});
