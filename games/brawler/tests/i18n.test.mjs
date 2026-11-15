import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  DEFAULT_LOCALE,
  LANG_KEY,
  LOCALES,
  STRINGS,
  detectLocale,
  format,
  htmlLang,
  isLocale,
  loadLocale,
  saveLocale,
  strings,
  t,
} from "../js/i18n.mjs";

const root = resolve(import.meta.dirname, "..");

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}

test("中英词表 key 完全对齐，英文表无汉字", () => {
  const zhKeys = Object.keys(STRINGS.zh).sort();
  const enKeys = Object.keys(STRINGS.en).sort();
  assert.deepEqual(enKeys, zhKeys);
  const allowedChinese = new Set(["langShort"]);
  for (const [key, value] of Object.entries(STRINGS.en)) {
    if (allowedChinese.has(key)) continue;
    assert.equal(typeof value, "string");
    assert.equal(/[\u4e00-\u9fff]/.test(value), false, `${key} 混入中文: ${value}`);
  }
});

test("所有占位符在两个语言中数量一致", () => {
  for (const key of Object.keys(STRINGS.zh)) {
    const zh = STRINGS.zh[key];
    const en = STRINGS.en[key];
    if (typeof zh !== "string" || typeof en !== "string") continue;
    const zhSlots = (zh.match(/\{\d+\}/g) ?? []).sort();
    const enSlots = (en.match(/\{\d+\}/g) ?? []).sort();
    assert.deepEqual(enSlots, zhSlots, `${key} 占位符不一致`);
  }
});

test("format 安全替换占位符，缺参保持原样", () => {
  assert.equal(format("第 {0} 波 / {1}", 2, 3), "第 2 波 / 3");
  assert.equal(format("{0} {0}", "x"), "x x");
  assert.equal(format("{0}", undefined), "{0}");
  assert.equal(format("", 1), "");
  assert.equal(format(null), "");
});

test("语言工具：识别、默认值与 html lang", () => {
  assert.deepEqual([...LOCALES], ["zh", "en"]);
  assert.equal(DEFAULT_LOCALE, "zh");
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(strings("fr"), STRINGS.zh);
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
  assert.equal(t("en", "resultKo"), STRINGS.en.resultKo);
  assert.equal(t("en", "missing-key"), "missing-key");
  assert.equal(t("zh", "waveBanner", 3), format(STRINGS.zh.waveBanner, 3));
});

test("语言偏好写入 doin.lang，并能读回", () => {
  const map = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
  try {
    assert.equal(saveLocale("en"), true);
    assert.equal(map.get(LANG_KEY), "en");
    assert.equal(loadLocale(), "en");
    assert.equal(saveLocale("xx"), false);
    assert.equal(map.get(LANG_KEY), "en");
    map.set(LANG_KEY, "fr");
    assert.ok(["zh", "en"].includes(loadLocale()));
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});

test("detectLocale 对中文浏览器返回 zh，其余返回 en", () => {
  const previous = globalThis.navigator;
  try {
    Object.defineProperty(globalThis, "navigator", { value: { languages: ["zh-CN", "en"] }, configurable: true });
    assert.equal(detectLocale(), "zh");
    Object.defineProperty(globalThis, "navigator", { value: { language: "en-US" }, configurable: true });
    assert.equal(detectLocale(), "en");
  } finally {
    Object.defineProperty(globalThis, "navigator", { value: previous, configurable: true });
  }
});

test("除 i18n.mjs 外的运行源码不得出现硬编码中文字符串", () => {
  const dir = resolve(root, "js");
  const files = readdirSync(dir).filter((name) => name.endsWith(".mjs") && name !== "i18n.mjs");
  const offenders = [];
  for (const name of files) {
    const source = stripComments(readFileSync(resolve(dir, name), "utf8"))
      .replace(/(["'`])中文\1/g, '""');
    const matches = source.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
    if (matches) offenders.push(`${name}: ${matches.slice(0, 2).join(", ")}`);
  }
  assert.deepEqual(offenders, []);
});

test("index.html 中所有静态中文节点都有 data-i18n 或由 JS 动态覆盖", () => {
  const html = readFileSync(resolve(root, "index.html"), "utf8");
  const allJs = readdirSync(resolve(root, "js"))
    .filter((name) => name.endsWith(".mjs"))
    .map((name) => readFileSync(resolve(root, "js", name), "utf8"))
    .join("\n");
  const clean = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  const matches = [...clean.matchAll(/<([a-zA-Z0-9-]+)([^>]*)>([^<]*[\u4e00-\u9fa5]+[^<]*)<\/\1>/g)];
  const unhandled = [];
  for (const match of matches) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];
    if (tag === "title" || tag === "script") continue;
    if (attrs.includes("data-i18n")) continue;
    const id = attrs.match(/id="([^"]+)"/)?.[1];
    if (id && allJs.includes(`"${id}"`)) continue;
    unhandled.push(`<${tag}> ${match[3].trim().slice(0, 16)}`);
  }
  assert.deepEqual(unhandled, []);
});

test("HTML 中出现的 data-i18n 与 data-i18n-aria key 全部有译文", () => {
  const html = readFileSync(resolve(root, "index.html"), "utf8");
  const keys = [
    ...html.matchAll(/data-i18n="([^"]+)"/g),
    ...html.matchAll(/data-i18n-aria="([^"]+)"/g),
  ].map((match) => match[1]);
  assert.ok(keys.length > 40);
  for (const key of keys) {
    assert.equal(typeof STRINGS.zh[key], "string", `zh 缺 ${key}`);
    assert.equal(typeof STRINGS.en[key], "string", `en 缺 ${key}`);
  }
});
