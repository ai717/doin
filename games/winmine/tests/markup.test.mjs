import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const css = readFileSync(resolve(root, "css", "style.css"), "utf8");
const main = readFileSync(resolve(root, "js", "main.mjs"), "utf8");
const ui = readFileSync(resolve(root, "js", "ui.mjs"), "utf8");
const allJS = main + "\n" + ui;

function idsOf(source) {
  return [...source.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
}

test("index.html 结构契约", () => {
  assert.ok(html.includes('lang="zh-CN"'), "html lang");
  assert.ok(html.includes('href="/"'), "返回首页链接");
  assert.ok(html.includes("<noscript"), "noscript 兜底");
  assert.ok(html.includes('name="description"'), "meta description");
  assert.ok(html.includes("rel=\"icon\""), "favicon");
  assert.ok(/<script[^>]+type="module"/.test(html), "入口为 ES module");
});

test("本地资源全部带 ?v=dev 且零外链", () => {
  const locals = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((v) => !v.startsWith("data:") && /\/(css|js|mjs)(\?|$)|\.(css|mjs)(\?|$)/.test(v));
  assert.ok(locals.length > 0, "存在本地资源引用");
  for (const v of locals) assert.ok(v.includes("?v=dev"), `带缓存占位: ${v}`);
  assert.ok(!html.includes("https://"), "无外部 http 资源");
});

test("关键交互 id 在 HTML 与装配层双向闭合", () => {
  const ids = new Set(idsOf(html));
  // 动态拼接引用的 id（el("menu-" + id) / el("diff-" + id)），只需出现在 HTML
  const dynamic = [
    "menu-beginner", "menu-intermediate", "menu-expert",
    "diff-beginner", "diff-intermediate", "diff-expert",
  ];
  // 必须同时出现在 HTML 且被 JS 字面引用
  const literal = [
    "board", "smiley", "led-mines", "led-time",
    "menu-game", "menu-help", "menu-game-drop", "menu-help-drop",
    "menu-new", "menu-custom", "menu-best", "menu-rules", "menu-about",
    "diff-custom",
    "overlay", "dlg-record", "record-name", "record-save", "record-skip",
    "dlg-custom", "custom-width", "custom-height", "custom-mines", "custom-ok", "custom-err",
    "dlg-rules", "rules-body", "dlg-about", "about-body",
    "best-list", "best-empty", "best-title", "status",
    "btn-sound", "btn-lang", "btn-help",
  ];
  for (const id of [...dynamic, ...literal]) {
    assert.ok(ids.has(id), `HTML 应包含 id=${id}`);
  }
  for (const id of literal) {
    assert.ok(allJS.includes(`"${id}"`), `JS 应引用 id=${id}`);
  }
});

test("CSS 含动效降级与移动端触控/广告安全", () => {
  assert.ok(css.includes("prefers-reduced-motion"), "动效降级");
  assert.ok(css.includes("touch-action"), "棋盘触控拦截");
  assert.ok(css.includes("safe-area-inset-bottom"), "iOS 安全区");
  assert.ok(css.includes("env("), "底部广告安全避让");
});