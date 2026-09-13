import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ROOT = new URL("../", import.meta.url);

function read(rel) {
  return fs.readFileSync(new URL(rel, ROOT), "utf8");
}

const html = read("index.html");
const css = read("css/style.css");
const main = read("js/main.mjs");
const ui = read("js/ui.mjs");
const game = read("js/game.mjs");
const engine = read("js/engine.mjs");
const storage = read("js/storage.mjs");
const i18n = read("js/i18n.mjs");
const jsFiles = [main, ui, game, engine, storage, i18n].join("\n");

test("index.html 基础骨架", () => {
  assert.match(html, /<!DOCTYPE html>/i);
  assert.match(html, /<html lang="zh"/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /name="description"/);
  assert.match(html, /<link rel="icon"/);
  assert.match(html, /<noscript>/);
  assert.match(html, /href="\/"/); // 返回门户唯一绝对路径例外
});

test("本地 CSS/JS 引用全部带 ?v=dev", () => {
  const refs = [...html.matchAll(/<(?:link|script)[^>]+(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 2);
  for (const ref of refs) {
    assert.ok(ref.startsWith("css/") || ref.startsWith("js/") || ref.startsWith("favicon"), `意外引用: ${ref}`);
    assert.match(ref, /\?v=dev$/, `本地引用必须带 ?v=dev: ${ref}`);
  }
});

test("JS 模块 import 全为相对路径且带 ?v=dev", () => {
  const imports = [...jsFiles.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
  assert.ok(imports.length > 0);
  for (const imp of imports) {
    assert.ok(imp.startsWith("./"), `import 必须相对: ${imp}`);
    assert.match(imp, /\?v=dev$/, `import 必须带 ?v=dev: ${imp}`);
  }
});

test("零外部资源：无 CDN / 远程 API / 外链字体 / 远程图片", () => {
  assert.ok(!/https?:\/\//.test(html + css + jsFiles));
  assert.ok(!/\/\/cdn\./.test(html + css + jsFiles));
  assert.ok(!/url\(/.test(css));
  assert.ok(!/@import/.test(css));
  assert.ok(!/@font-face/.test(css));
  assert.ok(!/<img/.test(html));
  assert.ok(!/three\.module\.js/.test(jsFiles)); // 未预置 Three.js，不得引用
});

test("无绝对游戏路径（/games/ 或 /link-up/）", () => {
  assert.ok(!/\/games\//.test(html + jsFiles));
  assert.ok(!/\/link-up\//.test(html + jsFiles));
});

test("禁止 alert() 反馈", () => {
  assert.ok(!/alert\s*\(/.test(jsFiles));
});

test("存储 Key 统一 doin.link-up.v1", () => {
  assert.match(storage, /doin\.link-up\.v1/);
});

test("engine.mjs 保持 DOM-free", () => {
  assert.ok(!/\bdocument\b/.test(engine));
  assert.ok(!/\bwindow\b/.test(engine));
  assert.ok(!/localStorage/.test(engine));
});

test("DOM id 双向闭合：JS 引用的 id 均存在于 index.html", () => {
  const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const used = new Set(
    [...(ui + main).matchAll(/\$\("([^"]+)"\)|getElementById\("([^"]+)"\)/g)].map((m) => m[1] || m[2])
  );
  assert.ok(used.size > 20, `应引用大量 id，实际 ${used.size}`);
  for (const id of used) {
    assert.ok(htmlIds.has(id), `JS 引用但 HTML 缺失的 id: #${id}`);
  }
});

test("css 满足桌面宽屏舞台 / 系统字体 / 移动 390px / 减少动效", () => {
  assert.match(css, /font-family/);
  assert.match(css, /sans-serif/);
  assert.match(css, /@media\s*\(max-width/); // 移动端收缩（覆盖 390px）
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.stage-body/); // 双栏骨架
  assert.match(css, /\.hud-panel/); // 侧边 HUD
  assert.match(css, /\.board-grid/);
  assert.ok(!/<footer/.test(html), "无传统页脚营销布局");
});

test("可访问性：棋盘、按钮、暂停状态具备语义属性", () => {
  assert.match(html, /role="grid"/);
  assert.match(html, /aria-label/);
  assert.match(html, /id="pause-overlay"[^>]+role="status"/);
  assert.match(ui, /aria-label/);
  assert.match(ui, /removeAttribute\(\"aria-label\"\)/);
  assert.match(ui, /aria-pressed/);
  assert.match(ui, /tabIndex = -1/);
  assert.match(ui, /firstFilledCell/);
  assert.match(ui, /tileArt/);
  assert.match(ui, /tile-art/);
  assert.match(ui, /replaceChildren\(tileArt/);
  assert.match(ui, /setAttribute\("aria-hidden", "true"\)/);
  assert.match(ui, /tileNames/);
  assert.match(ui, /openModal\.querySelectorAll/);
});
