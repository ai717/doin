// 森林冰火人 · 页面标记与模块契约测试
// 覆盖：index.html 资源版本占位、返回链接、noscript、ES module、meta/favicon
//       CSS 动效降级、engine 纯规则层无 DOM/存储泄漏

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null);

const indexHtml = read(resolve(root, "index.html"));
const css = read(resolve(root, "css", "style.css"));
const engine = read(resolve(root, "js", "engine.mjs"));

test("index.html 存在且含语义骨架", () => {
  assert.ok(indexHtml, "index.html 缺失");
  assert.match(indexHtml, /<html[^>]+lang="/, "html lang");
  assert.match(indexHtml, /<meta[^>]+name="description"/, "meta description");
  assert.match(indexHtml, /<noscript/, "noscript 兜底");
  assert.match(indexHtml, /<script[^>]+type="module"/, "入口用 ES module");
  assert.match(indexHtml, /rel="icon"/, "favicon 链接");
  assert.match(indexHtml, /<canvas[^>]+id="stage-canvas"/, "舞台 canvas");
});

test("本地资源一律带 ?v=dev 占位", () => {
  const assets = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((v) => /\.(mjs|js|css)(\?|$)/.test(v) && !/^(https?:)?\/\//.test(v));
  assert.ok(assets.length >= 2, "应有 js/css 本地资源");
  for (const a of assets) {
    assert.ok(a.includes("?v=dev"), `${a} 必须带 ?v=dev`);
  }
});

test("返回首页链接使用绝对根路径", () => {
  assert.match(indexHtml, /<a[^>]+href="\/"/, "back-home 链接");
});

test("选关采用弹层：modal-levels 存在、底部通栏已移除、有选关按钮", () => {
  assert.match(indexHtml, /id="modal-levels"/, "选关弹层");
  assert.match(indexHtml, /id="level-select"/, "选关容器");
  assert.match(indexHtml, /id="btn-levels"/, "选关按钮");
  assert.doesNotMatch(indexHtml, /id="chapter-list"/, "不得再平铺底部通栏");
  assert.match(css, /\.level-card/, "弹层卡片样式");
});

test("CSS 含动效降级与底部安全留白", () => {
  assert.ok(css, "style.css 缺失");
  assert.match(css, /prefers-reduced-motion/, "动效降级");
  assert.match(css, /safe-area-inset-bottom/, "移动端安全区");
  assert.match(css, /max\(68px/, "底部 Banner 安全留白");
});

test("engine 纯规则层：无 document/window/localStorage", () => {
  assert.ok(engine, "engine.mjs 缺失");
  const code = engine
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const token of ["document.", "window.", "localStorage", "sessionStorage"]) {
    assert.ok(!code.includes(token), `engine 不得引用 ${token}`);
  }
});
