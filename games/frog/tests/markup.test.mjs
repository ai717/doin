import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const html = read("index.html");
const css = read("css/style.css");
const mainSrc = read("js/main.mjs");
const uiSrc = read("js/ui.mjs");
const engineSrc = read("js/engine.mjs");

test("index.html 含返回首页链接与 noscript 兜底", () => {
  assert.match(html, /<a[^>]+href="\/"[^>]*>/);
  assert.match(html, /<noscript/);
  assert.match(html, /lang="zh-CN"/);
  assert.match(html, /name="description"/);
  assert.match(html, /rel="icon"/);
});

test("本地脚本与样式都带 ?v=dev", () => {
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const local = refs.filter((v) => /\.(mjs|js|css)(\?|$)/.test(v) && !/^https?:/.test(v));
  assert.ok(local.length > 0, "应存在本地资源引用");
  for (const v of local) assert.ok(v.includes("?v=dev"), `缺少缓存占位: ${v}`);
});

test("入口脚本为 module", () => {
  assert.match(html, /<script[^>]+type="module"/);
});

test("移动端触控与动效降级样式在位", () => {
  assert.ok(css.includes("touch-action"), "缺 touch-action");
  assert.ok(css.includes("overscroll-behavior"), "缺 overscroll-behavior");
  assert.ok(css.includes("prefers-reduced-motion"), "缺 reduced-motion");
  assert.ok(css.includes("env(safe-area-inset-bottom)"), "缺底部安全区");
});

test("装配表 id 双向闭合：ui/main 引用的 id 都在 index.html 存在", () => {
  const ids = new Set();
  for (const src of [uiSrc, mainSrc]) {
    for (const m of src.matchAll(/#([a-zA-Z][\w-]*)/g)) ids.add(m[1]);
  }
  for (const id of ids) {
    assert.ok(html.includes(`id="${id}"`), `引用但未定义的元素 id: ${id}`);
  }
});

test("语言偏好读写全站共享 key doin.lang", () => {
  const i18n = read("js/i18n.mjs");
  assert.ok(i18n.includes('"doin.lang"'));
});

test("引擎纯函数：不触碰 DOM / storage", () => {
  const stripped = engineSrc
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  assert.ok(!stripped.includes("document."), "engine 引用 document");
  assert.ok(!stripped.includes("window."), "engine 引用 window");
  assert.ok(!stripped.includes("localStorage"), "engine 引用 localStorage");
});