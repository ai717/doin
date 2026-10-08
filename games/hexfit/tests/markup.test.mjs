// markup.test.mjs — 语义骨架与模块装配契约（T1 门禁 + 装配闭合）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const html = read("index.html");
const engineJs = read("js/engine.mjs");
const gameJs = read("js/game.mjs");
const storageJs = read("js/storage.mjs");
const i18nJs = read("js/i18n.mjs");
const mainJs = read("js/main.mjs");
const css = read("css/style.css");
const htmlIds = () => new Set([...html.matchAll(/id="([^"]+)"/g)].map((x) => x[1]));

test("T1：语义骨架必备件", () => {
  assert.ok(html.includes('<a href="/"'), "返回首页绝对链接");
  assert.ok(/<noscript>[\s\S]*<\/noscript>/.test(html), "noscript 提示");
  assert.ok(/<meta\s+name="description"/.test(html), "SEO 描述");
  assert.ok(html.includes('rel="icon"'), "favicon 链接");
  assert.ok(/<html[^>]+lang="/.test(html), "html lang");
});

test("T1：本地资源全部带 ?v=dev 缓存占位", () => {
  const links = [...html.matchAll(/<(?:link|script)\s+[^>]*(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(links.length >= 2, "至少含 css 与脚本");
  for (const href of links) {
    if (href.startsWith("data:") || href.startsWith("https:")) continue;
    if (!/\.(js|mjs|css)$/.test(href)) continue;
    assert.ok(/\?v=dev$/.test(href), `${href} 必须带 ?v=dev`);
  }
});

test("T1：main.mjs 引用的元素 id 全部存在于 index.html", () => {
  const used = new Set();
  const pat = /getElementById\s*\(\s*"([^"]+)"\s*\)/g;
  let m;
  while ((m = pat.exec(mainJs))) used.add(m[1]);
  const missing = [...used].filter((id) => !htmlIds().has(id));
  assert.deepEqual(missing, [], "main 引用的 id 必须存在");
});

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("八大不变量：engine 纯逻辑 / 共享偏好 / 存档 key / 降级", () => {
  assert.ok(!/document\.|window\.|localStorage|alert\s*\(/.test(stripComments(engineJs)), "engine 纯逻辑不碰 DOM/存储/alert");
  assert.ok(!/document\.|window\.|localStorage|alert\s*\(/.test(stripComments(gameJs)), "game DOM-free");
  assert.ok(storageJs.includes("doin.hexfit.v1"), "存档 key 统一");
  assert.ok(i18nJs.includes("doin.lang"), "语言偏好统一共享 key");
  assert.ok(storageJs.includes("try") && storageJs.includes("catch"), "storage 集中 try/catch");
  assert.ok(!/location\.reload/.test(stripComments(mainJs)), "严禁 location.reload");
  assert.ok(!/alert\s*\(/.test(stripComments(mainJs)), "main 无 alert");
});

test("工程红线：移动端安全区 / 动效降级 / 触摸禁用", () => {
  assert.ok(/overscroll-behavior\s*:\s*none/.test(css), "禁止橡皮筋滚动");
  assert.ok(/touch-action\s*:\s*none/.test(css), "触控区禁用默认手势");
  assert.ok(/max\(68px,\s*calc\(16px\s*\+\s*env\(safe-area-inset-bottom\)\)\)/.test(css), "移动端底部广告安全留白");
  assert.ok(/prefers-reduced-motion/.test(css), "动效降级媒体查询");
});

test("模块分层文件齐备", () => {
  for (const f of ["js/engine.mjs", "js/game.mjs", "js/ui.mjs", "js/render.mjs", "js/storage.mjs", "js/i18n.mjs", "js/audio.mjs", "js/score.mjs", "js/levels.mjs", "js/rng.mjs", "js/main.mjs"]) {
    assert.doesNotThrow(() => read(f), `${f} 存在`);
  }
});
