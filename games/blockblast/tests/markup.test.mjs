// markup.test.mjs —— 标记契约：?v=dev 占位、返回首页、noscript/meta/favicon、
// JS 引用的全部 DOM id 在 HTML 中存在、data-i18n 键在双语表中存在、Canvas 触控与降级声明。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { strings } from "../js/i18n.mjs";
import { DIFFICULTY_IDS } from "../js/difficulty.mjs";

const gameDir = resolve(import.meta.dirname, "..");
const html = readFileSync(resolve(gameDir, "index.html"), "utf8");
const uiSource = readFileSync(resolve(gameDir, "js", "ui.mjs"), "utf8");
const mainSource = readFileSync(resolve(gameDir, "js", "main.mjs"), "utf8");
const css = readFileSync(resolve(gameDir, "css", "style.css"), "utf8");

test("markup: local assets carry the ?v=dev cache-busting placeholder", () => {
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((v) => !/^(https?:)?\/\//.test(v) && !v.startsWith("data:") && /\.(mjs|js|css)(\?|$)/.test(v));
  assert.ok(assets.length >= 2, "expected stylesheet + module script");
  for (const asset of assets) {
    assert.ok(asset.includes("?v=dev"), `${asset} missing ?v=dev`);
  }
});

test("markup: back-home link and noscript fallback", () => {
  assert.match(html, /<a[^>]+href="\/"[^>]*id="back-home"/);
  assert.match(html, /<noscript>/);
  assert.match(html, /<meta[^>]+name="description"/);
  assert.match(html, /rel="icon"/);
  assert.match(html, /<html[^>]+lang="/);
  assert.match(html, /<script[^>]+type="module"/);
});

test("markup: every DOM id referenced by ui.mjs exists in index.html", () => {
  const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const referenced = new Set();
  // 字面量：$("btn-help")
  for (const m of uiSource.matchAll(/\$\("([^"]+)"\)/g)) referenced.add(m[1]);
  // 模板：$(`diff-${diff.id}`) —— 按难度 id 展开
  for (const m of uiSource.matchAll(/\$\(`([^`]+)`\)/g)) {
    const tpl = m[1];
    if (tpl.includes("${")) {
      for (const id of DIFFICULTY_IDS) referenced.add(tpl.replace(/\$\{[^}]+\}/g, id));
    } else {
      referenced.add(tpl);
    }
  }
  assert.ok(referenced.size >= 20, "expected ui.mjs to reference many elements");
  for (const id of referenced) {
    assert.ok(htmlIds.has(id), `ui.mjs references #${id} but index.html has no such id`);
  }
});

test("markup: every data-i18n key in HTML exists in both locale tables", () => {
  const keys = [...html.matchAll(/data-i18n(?:-title|-aria)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length >= 20, "expected rich i18n coverage");
  for (const key of keys) {
    assert.ok(strings("zh")[key], `zh table missing ${key}`);
    assert.ok(strings("en")[key], `en table missing ${key}`);
  }
});

test("markup: toast keys used by code exist in both tables", () => {
  for (const key of ["toastNoPlace", "toastCross", "toastCombo", "toastRecord", "toastRotOnTray"]) {
    assert.ok(strings("zh")[key], `zh missing ${key}`);
    assert.ok(strings("en")[key], `en missing ${key}`);
  }
});

test("markup: static Chinese nodes are covered by data-i18n", () => {
  const clean = html.replace(/<!--[\s\S]*?-->/, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  const nodes = [...clean.matchAll(/<([a-zA-Z0-9\-]+)([^>]*)>([^<]*[\u4e00-\u9fa5]+[^<]*)<\/\1>/g)];
  assert.ok(nodes.length > 0, "expected static Chinese labels");
  for (const m of nodes) {
    const tag = m[1].toLowerCase();
    if (tag === "title" || tag === "script") continue;
    assert.ok(m[2].includes("data-i18n"), `<${tag}> "${m[3].trim().slice(0, 12)}" lacks data-i18n`);
  }
});

test("markup: no location.reload anywhere in runtime sources", () => {
  // 与 check-game 门禁一致：先剥离注释再扫描
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const src of [uiSource, mainSource]) {
    assert.ok(!strip(src).includes("location.reload"), "language switch must hot-update in place");
  }
});

test("markup: canvas declares touch-action none and CSS carries reduced-motion", () => {
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /overscroll-behavior:\s*none/);
  assert.match(css, /prefers-reduced-motion/);
  // 移动端底部广告安全避让
  assert.match(css, /max\(68px/);
});

test("markup: engine module stays DOM-free", () => {
  const engine = readFileSync(resolve(gameDir, "js", "engine.mjs"), "utf8");
  for (const token of ["document.", "window.", "localStorage", "sessionStorage"]) {
    assert.ok(!engine.includes(token), `engine references ${token}`);
  }
});
