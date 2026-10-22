// i18n.test.mjs —— 双表纯净性：en 表零汉字（切换按钮标识白名单除外）、键集对齐、插值占位符对齐。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { STRINGS } from "../js/i18n.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const gameDir = resolve(here, "..");

test("STRINGS.en 零汉字（语言切换按钮标识除外）", () => {
  const whitelist = new Set(["\u4e2d"]); // 轨道切换按钮标识「中」
  const offenders = Object.entries(STRINGS.en)
    .filter(([key, value]) => !whitelist.has(value) && /[\u4e00-\u9fa5]/.test(value))
    .map(([key]) => key);
  assert.deepEqual(offenders, []);
});

test("zh/en 键集完全对齐", () => {
  const zh = new Set(Object.keys(STRINGS.zh));
  const en = new Set(Object.keys(STRINGS.en));
  assert.deepEqual([...zh].filter((k) => !en.has(k)), []);
  assert.deepEqual([...en].filter((k) => !zh.has(k)), []);
});

test("插值占位符 zh/en 对齐", () => {
  const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  for (const key of Object.keys(STRINGS.zh)) {
    assert.equal(ph(STRINGS.zh[key]), ph(STRINGS.en[key]), `占位符不一致: ${key}`);
  }
});

test("index.html 所有 data-i18n / data-i18n-aria 键在双表中存在", () => {
  const html = readFileSync(resolve(gameDir, "index.html"), "utf8");
  const keys = new Set();
  for (const m of html.matchAll(/data-i18n(?:-aria|-title)?="([^"]+)"/g)) keys.add(m[1]);
  assert.ok(keys.size >= 20, `静态标记过少: ${keys.size}`);
  for (const key of keys) {
    assert.ok(key in STRINGS.zh, `zh 缺少 ${key}`);
    assert.ok(key in STRINGS.en, `en 缺少 ${key}`);
  }
});

test("运行源码（除 i18n/wordlists/tests）零硬编码中文", () => {
  const files = ["engine.mjs", "game.mjs", "storage.mjs", "audio.mjs", "ui.mjs", "main.mjs"];
  for (const name of files) {
    const src = readFileSync(resolve(gameDir, "js", name), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const matches = code.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
    assert.equal(matches, null, `${name} 存在硬编码中文: ${matches?.slice(0, 2).join(",")}`);
  }
});

test("全站语言偏好读写走 doin.lang", () => {
  const src = readFileSync(resolve(gameDir, "js", "i18n.mjs"), "utf8");
  assert.ok(src.includes("doin.lang"));
});
