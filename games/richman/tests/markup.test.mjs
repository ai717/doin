// 标记契约：?v=dev 缓存占位、#back-home、noscript、module 入口、
// JS 引用的 DOM id 与 HTML 双向闭合（防手滑删节点）。

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const gameDir = resolve(import.meta.dirname, "..");
const html = readFileSync(resolve(gameDir, "index.html"), "utf8");

test("index.html carries the full static skeleton", () => {
  assert.ok(html.includes('href="/"'), "back-home link");
  assert.ok(/<a[^>]+id="back-home"/.test(html), "back-home id");
  assert.ok(/<script[^>]+type="module"/.test(html), "module entry");
  assert.ok(/<noscript/.test(html), "noscript fallback");
  assert.ok(/<meta[^>]+name="description"/.test(html), "meta description");
  assert.ok(/rel="icon"/.test(html), "favicon");
  assert.ok(/<html[^>]+lang="/.test(html), "html lang");
  assert.ok(existsSync(resolve(gameDir, "favicon.svg")), "favicon.svg exists");
});

test("every local script/link carries the ?v=dev cache placeholder", () => {
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => /\.(mjs|js|css)(\?|$)/.test(value) && !/^(https?:)?\/\//.test(value));
  assert.ok(assets.length >= 2, "html must reference local css + js");
  const unversioned = assets.filter((value) => !value.includes("?v=dev"));
  assert.deepEqual(unversioned, []);
});

test("paths are relative (only / is absolute for back-home)", () => {
  const offenders = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => value.startsWith("/") && value !== "/");
  assert.deepEqual(offenders, []);
});

function collectIds(node) {
  const ids = new Set();
  for (const match of node.matchAll(/id="([^"]+)"/g)) ids.add(match[1]);
  return ids;
}

function collectJs() {
  return readdirSync(resolve(gameDir, "js"))
    .filter((name) => name.endsWith(".mjs"))
    .map((name) => readFileSync(resolve(gameDir, "js", name), "utf8"))
    .join("\n");
}

test("every DOM id referenced from JS exists in index.html (no dangling $)", () => {
  const htmlIds = collectIds(html);
  const js = collectJs();
  // ui/main 通过 getElementById("...") 与 $("...") 引用节点
  const referenced = new Set();
  for (const match of js.matchAll(/(?:getElementById|\$\()\s*"([a-zA-Z][\w-]*)"/g)) {
    referenced.add(match[1]);
  }
  for (const match of js.matchAll(/querySelector(?:All)?\("\#([\w-]+)"/g)) {
    referenced.add(match[1]);
  }
  const missing = [...referenced].filter((id) => !htmlIds.has(id));
  assert.deepEqual(missing, [], `JS references missing ids: ${missing.join(", ")}`);
});

test("core interactive ids are present and unique", () => {
  const required = [
    "back-home", "app-title", "brand-tag", "btn-mode", "btn-pause", "btn-sound", "btn-lang", "btn-help",
    "hud", "table-felt", "board", "center-park", "die", "round-label", "log-ticker", "token-layer", "fx",
    "dock", "hand-cards", "action-zone",
    "mode-drawer", "mode-close", "mode-list", "ai-levels", "record-line", "start-match", "mode-hint",
    "help", "help-close",
    "pause-layer", "pause-resume", "pause-restart", "pause-mode",
    "result", "result-title", "result-sub", "result-table", "result-extras", "result-flip", "result-again", "result-mode", "result-recs",
    "confirm-modal", "confirm-title", "confirm-body", "confirm-actions",
    "picker-modal", "picker-title", "picker-list", "picker-cancel",
    "toast",
  ];
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
  const missing = required.filter((id) => !ids.includes(id));
  assert.deepEqual(missing, [], `missing required ids: ${missing.join(", ")}`);
  const counts = {};
  for (const id of ids) counts[id] = (counts[id] ?? 0) + 1;
  const duplicated = required.filter((id) => counts[id] > 1);
  assert.deepEqual(duplicated, [], `duplicated ids: ${duplicated.join(", ")}`);
});

test("overlay panels default to hidden and expose aria roles", () => {
  for (const id of ["mode-drawer", "help", "pause-layer", "result", "confirm-modal", "picker-modal"]) {
    const block = html.slice(html.indexOf(`id="${id}"`));
    const tag = block.slice(0, 200);
    assert.ok(tag.includes("hidden"), `#${id} must start hidden`);
  }
  assert.ok(html.includes('role="status"'), "toast/log aria-live");
});

test("css exists, covers reduced-motion, touch-action and mobile safe-area", () => {
  const css = readFileSync(resolve(gameDir, "css", "style.css"), "utf8");
  assert.ok(css.includes("prefers-reduced-motion"), "reduced-motion fallback");
  assert.ok(css.includes("touch-action"), "board must not scroll");
  assert.ok(css.includes("env(safe-area-inset-bottom)"), "mobile ad-avoidance padding");
  assert.ok(css.includes("@media (max-width: 768px)"), "mobile breakpoints");
});

test("package.json registers test:richman with existing test files", () => {
  const root = resolve(gameDir, "..", "..");
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  assert.ok(pkg.scripts["test:richman"], "root package.json must register test:richman");
  const testFiles = readdirSync(resolve(gameDir, "tests")).filter((name) => name.endsWith(".test.mjs"));
  assert.ok(testFiles.length >= 3, "at least engine/storage/i18n/markup coverage");
});
