// markup.test.mjs - the page is a contract: every id the DOM layer asks for
// must exist, every i18n key must be translated, and nothing may reach outside
// the folder.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { strings } from "../js/i18n.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...parts) => readFileSync(join(ROOT, ...parts), "utf8");
const html = read("index.html");
const css = read("css", "style.css");
const ui = read("js", "ui.mjs");
const main = read("js", "main.mjs");

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const attrKeys = [...html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map((match) => match[1]);
const scriptIds = [...`${ui}\n${main}`.matchAll(/getElementById\("([^"]+)"\)/g)].map((match) => match[1]);

test("标记: id 唯一", () => {
  const seen = new Set();
  for (const id of ids) {
    assert.ok(!seen.has(id), `重复 id: ${id}`);
    seen.add(id);
  }
  assert.ok(ids.length > 20, `id 太少：${ids.length}`);
});

test("标记: 舞台画布尺寸与引擎一致", () => {
  const canvas = html.match(/<canvas[^>]*id="stage"[^>]*>/);
  assert.ok(canvas, "缺 #stage 画布");
  assert.match(canvas[0], /width="840"/);
  assert.match(canvas[0], /height="560"/);
  assert.match(canvas[0], /aria-label="/);
});

test("标记: 样式与模块脚本都带 ?v=dev，且文件真实存在", () => {
  const cssLink = html.match(/<link[^>]*rel="stylesheet"[^>]*>/);
  assert.ok(cssLink && cssLink[0].includes("?v=dev"), "样式必须带版本号");
  const script = html.match(/<script[^>]*src="([^"]+)"[^>]*>/);
  assert.ok(script, "缺主脚本");
  assert.match(script[0], /type="module"/);
  assert.match(script[1], /\?v=dev$/);
  const target = script[1].split("?")[0];
  assert.ok(existsSync(join(ROOT, target)), `脚本不存在: ${target}`);
  assert.ok(existsSync(join(ROOT, "favicon.svg")), "缺 favicon.svg");
});

test("标记: 门户回链、noscript、meta description 齐备", () => {
  assert.match(html, /<a[^>]*href="\/"[^>]*id="back-home"/);
  assert.match(html, /<noscript>[\s\S]*<\/noscript>/);
  assert.match(html, /<meta name="description" content="[^"]{20,}"/);
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /name="viewport"[^>]*viewport-fit=cover/);
});

test("标记: 零外链，所有资源都在游戏目录内", () => {
  const externals = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(externals, [], `不允许外链: ${externals.join(", ")}`);
  assert.ok(!/location\.reload/.test(html) && !/location\.reload/.test(`${ui}${main}`));
});

test("i18n: 页面上每个 data-i18n 键都有中英词条", () => {
  const seen = new Set();
  for (const key of attrKeys) {
    seen.add(key);
    assert.ok(strings.zh[key], `缺中文词条: ${key}`);
    assert.ok(strings.en[key], `缺英文词条: ${key}`);
  }
  assert.ok(seen.size >= 20, `只翻译了 ${seen.size} 个键`);
});

test("i18n: DOM 层引用的 id 全在页面里", () => {
  const known = new Set(ids);
  for (const id of new Set(scriptIds)) {
    assert.ok(known.has(id), `ui/main 引用了不存在的 id: ${id}`);
  }
  assert.ok(scriptIds.length >= 25, `id 引用太少：${scriptIds.length}`);
});

test("样式: 触屏拖动与减少动效都有兜底", () => {
  assert.match(css, /touch-action:\s*none/, "画布必须禁用滚动接管手势");
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  const block = css.slice(css.indexOf("prefers-reduced-motion: reduce"));
  assert.ok(!/display:\s*none/.test(block), "减少动效时不许直接藏掉元素");
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media[^{]*max-width/, "缺移动端断点");
});
