// filepath: games/sokoban/tests/markup.test.mjs
// index.html 标记契约测试（门禁 T1/T2 相关）：返回首页链接、noscript、资源带 ?v=dev、
// 关键 id 存在、双语 data 属性、模块脚本、doin.lang 读写、存储 key 集中。
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css", "style.css"), "utf8");

test("markup: 返回首页链接 href=\"/\" 且 id=back-home 或 btn-home", () => {
  assert.match(html, /href="\/"/);
  assert.match(html, /id="(back-home|btn-home)"/);
});

test("markup: 包含 noscript 提示", () => {
  assert.match(html, /<noscript>/);
});

test("markup: 本地资源引用一律带 ?v=dev 占位", () => {
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const local = refs.filter((r) => !r.startsWith("http") && !r.startsWith("/"));
  assert.ok(local.length >= 3, "至少 3 个本地资源");
  for (const r of local) {
    assert.ok(r.includes("?v=dev"), `本地资源缺 ?v=dev: ${r}`);
  }
});

test("markup: 关键交互 id 齐备（含推箱子专属）", () => {
  for (const id of [
    "board", "btn-undo", "btn-hint", "btn-restart", "btn-pause", "btn-levels", "btn-help",
    "hud-level", "hud-moves", "hud-par", "hud-time", "progress-fill", "progress-label",
    "btn-start", "ov-start", "ov-pause", "ov-win", "ov-levels", "ov-help",
    "win-pushes", "win-par", "win-score", "levels-grid", "sr-status",
  ]) {
    assert.ok(html.includes(`id="${id}"`), `缺 id=${id}`);
  }
});

test("markup: lang 属性、meta description、viewport-fit", () => {
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<meta name="description" content="[^"]{20,}">/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /<link rel="icon" href="favicon\.svg/);
});

test("markup: 模块脚本入口为 js/main.mjs", () => {
  assert.match(html, /<script type="module" src="js\/main\.mjs\?v=dev">/);
});

test("markup: 双语 data-i18n / data-i18n-list / data-i18n-aria 属性存在", () => {
  assert.match(html, /data-i18n="/);
  assert.match(html, /data-i18n-list="/);
  assert.match(html, /data-i18n-aria="/);
});

test("markup: CSS 移动端底部安全区（广告避让）与动效降级", () => {
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /max-width: 768px/);
  assert.match(css, /min-width: 900px/);
});

test("markup: engine/game/score 模块无 DOM 与 localStorage 使用（T2 契约）", () => {
  for (const f of ["js/engine.mjs", "js/game.mjs", "js/score.mjs"]) {
    const src = fs.readFileSync(path.join(root, f), "utf8");
    // 只查真实调用，忽略注释里的字面提及
    assert.ok(!/document\.(querySelector|getElementById|createElement|addEventListener|body)/.test(src), `${f} 碰 DOM`);
    assert.ok(!/localStorage\.(getItem|setItem|removeItem)/.test(src), `${f} 直接读写存储`);
  }
});

test("markup: 存储 key 集中唯一（doin.sokoban.v1）且 i18n 用共享 doin.lang", () => {
  const storage = fs.readFileSync(path.join(root, "js", "storage.mjs"), "utf8");
  assert.match(storage, /doin\.sokoban\.v1/);
  assert.ok(!/localStorage\.(setItem|getItem|removeItem)\(["'](?!doin\.(sokoban\.v1|lang))/.test(storage), "storage.mjs 出现非白名单 key 直接读写");
  const i18n = fs.readFileSync(path.join(root, "js", "i18n.mjs"), "utf8");
  assert.match(i18n, /doin\.lang/);
});
