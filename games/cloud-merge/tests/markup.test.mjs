import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(import.meta.dirname, "..");
const htmlPath = resolve(dir, "index.html");
const cssPath = resolve(dir, "css", "style.css");
const enginePath = resolve(dir, "js", "engine.mjs");

test("markup: index.html contract (back-home, noscript, canvas)", () => {
  assert.ok(existsSync(htmlPath), "index.html 必须存在");
  const html = readFileSync(htmlPath, "utf8");

  assert.ok(/<a[^>]+href="\/"[^>]*id="back-home"/.test(html) || /<a[^>]+id="back-home"[^>]*href="\/"/.test(html), "必须包含 id='back-home' 且 href='/' 的返回首页链接");
  assert.ok(/<noscript/.test(html), "必须包含 <noscript> 标签兜底");
  assert.ok(/<canvas[^>]+id="game-canvas"/.test(html), "必须包含 id='game-canvas' 的 canvas 画布");
});

test("markup: versioned dev assets and module script", () => {
  const html = readFileSync(htmlPath, "utf8");
  assert.ok(/<script[^>]+type="module"[^>]+src="js\/main\.mjs\?v=dev"/.test(html), "主脚本必须带 ?v=dev 占位符且为 module 类型");
  assert.ok(/<link[^>]+rel="stylesheet"[^>]+href="css\/style\.css\?v=dev"/.test(html), "样式表必须带 ?v=dev 占位符");
});

test("markup: zero external network dependencies", () => {
  const html = readFileSync(htmlPath, "utf8");
  const urls = [...html.matchAll(/https?:\/\/[^"'\s>]+/g)].map((m) => m[0]);
  assert.equal(urls.length, 0, `HTML 中不得包含外部网络链接: ${urls.join(", ")}`);
});

test("markup: css includes prefers-reduced-motion", () => {
  assert.ok(existsSync(cssPath), "style.css 必须存在");
  const css = readFileSync(cssPath, "utf8");
  assert.ok(css.includes("prefers-reduced-motion"), "CSS 必须包含 prefers-reduced-motion 降级");
});

test("markup: engine.mjs is pure and DOM-free", () => {
  assert.ok(existsSync(enginePath), "engine.mjs 必须存在");
  const engineSrc = readFileSync(enginePath, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  assert.ok(!engineSrc.includes("document."), "engine 中严禁使用 document");
  assert.ok(!engineSrc.includes("window."), "engine 中严禁使用 window");
  assert.ok(!engineSrc.includes("localStorage"), "engine 中严禁使用 localStorage");
});
