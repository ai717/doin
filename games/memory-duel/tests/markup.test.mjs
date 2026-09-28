// 装配契约测试：index.html 骨架、缓存占位符、id 引用闭合、动效降级与 DOM-free
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const gameDir = resolve(__dirname, "..");
const indexHtml = readFileSync(resolve(gameDir, "index.html"), "utf8");
const css = readFileSync(resolve(gameDir, "css", "style.css"), "utf8");
const mainSrc = readFileSync(resolve(gameDir, "js", "main.mjs"), "utf8");
const renderSrc = readFileSync(resolve(gameDir, "js", "render.mjs"), "utf8");

test("index.html 结构契约完整", () => {
  assert.ok(indexHtml.includes("<!DOCTYPE html>"));
  assert.ok(indexHtml.includes('<script type="module" src="js/main.mjs?v=dev"></script>'));
  assert.ok(indexHtml.includes('rel="stylesheet" href="css/style.css?v=dev"'));
  assert.ok(indexHtml.includes('rel="icon" href="favicon.svg"'));
  assert.ok(indexHtml.includes('<meta name="description"'));
  assert.ok(indexHtml.includes("<noscript>"));
  assert.ok(indexHtml.includes('lang="zh-CN"'));
  assert.ok(/<a[^>]+href="\/"/.test(indexHtml), "必须含 href=/ 返回首页链接");
});

test("本地静态资源全部带有 ?v=dev 占位符", () => {
  const assets = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const local = assets.filter((v) => /\.(mjs|js|css)(\?|$)/.test(v));
  assert.ok(local.length > 0);
  for (const asset of local) {
    assert.ok(asset.includes("?v=dev"), `${asset} 缺失 ?v=dev 占位符`);
  }
});

test("main.mjs 引用的静态 DOM id 在 index.html 中闭合", () => {
  const ids = ["stage-core", "btn-sound", "btn-lang", "btn-help", "btn-restart", "back-home", "stage-title"];
  for (const id of ids) {
    assert.ok(indexHtml.includes(`id="${id}"`), `index.html 缺失静态 id="${id}"`);
  }
});

test("render.mjs 动态渲染的容器与交互节点在 CSS 或 main 中闭合", () => {
  const dynamicIds = ["cards-grid", "modal-gameover", "modal-modes", "modal-rules", "left-vault-panel"];
  for (const id of dynamicIds) {
    assert.ok(renderSrc.includes(`id="${id}"`), `render.mjs 未产出 id="${id}"`);
  }
});

test("CSS 包含动效降级、移动端适配与广告位安全缓冲区", () => {
  assert.ok(css.includes("prefers-reduced-motion"), "缺少 prefers-reduced-motion 动效降级");
  assert.ok(css.includes("env(safe-area-inset-bottom)"), "缺少 env(safe-area-inset-bottom) 移动端底部广告安全区");
  assert.ok(css.includes("max-width: 768px"), "缺少 768px 移动端断点适配");
  assert.ok(css.includes("overscroll-behavior: none"), "缺少 overscroll-behavior 阻止页面下拉刷新");
});

test("DOM-Free 契约：engine/ai/game/score 绝对不碰 DOM 与原生 Storage", () => {
  const forbidden = ["document.", "window.", "localStorage", "sessionStorage"];
  for (const file of ["engine.mjs", "ai.mjs", "game.mjs", "score.mjs"]) {
    const src = readFileSync(resolve(gameDir, "js", file), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const token of forbidden) {
      assert.ok(!code.includes(token), `${file} 违规触碰 ${token}`);
    }
  }
});

test("核心模块文件齐全存在", () => {
  const requiredFiles = [
    "engine.mjs",
    "ai.mjs",
    "game.mjs",
    "puzzles.mjs",
    "score.mjs",
    "storage.mjs",
    "i18n.mjs",
    "audio.mjs",
    "render.mjs",
    "main.mjs",
  ];
  for (const f of requiredFiles) {
    assert.ok(existsSync(resolve(gameDir, "js", f)), `缺少 js/${f}`);
  }
});
