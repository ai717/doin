import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { hasKey } from "../js/i18n.mjs";

const gameDir = resolve(import.meta.dirname, "..");
const html = readFileSync(resolve(gameDir, "index.html"), "utf8");
const css = readFileSync(resolve(gameDir, "css", "style.css"), "utf8");

function jsSources() {
  return readdirSync(resolve(gameDir, "js"))
    .filter((name) => name.endsWith(".mjs"))
    .map((name) => ({ name, code: readFileSync(resolve(gameDir, "js", name), "utf8") }));
}

test("语义骨架齐备：返回首页、noscript、描述、图标、html lang", () => {
  assert.match(html, /<a[^>]*id="back-home"[^>]*>/);
  assert.match(html, /<a[^>]*href="\/"[^>]*id="back-home"/);
  assert.match(html, /<noscript>/);
  assert.match(html, /<meta[^>]+name="description"[^>]+content="[^"]{10,}"/);
  assert.match(html, /<link[^>]+rel="icon"[^>]+href="favicon\.svg"/);
  assert.match(html, /<html[^>]+lang="zh-CN"/);
  assert.match(html, /<script[^>]+type="module"[^>]+src="js\/main\.mjs\?v=dev"/);
  assert.match(html, /viewport-fit=cover/);
});

test("本地资源一律带 ?v=dev 占位", () => {
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => !/^(https?:)?\/\//.test(value) && !value.startsWith("data:") && /\.(mjs|css)(\?|$)/.test(value));
  assert.ok(assets.length >= 2);
  for (const asset of assets) {
    assert.ok(asset.includes("?v=dev"), `${asset} 缺少缓存占位`);
  }
});

test("零外部依赖：没有任何 http(s) 资源引用", () => {
  const files = [html, css, ...jsSources().map((file) => file.code)];
  for (const content of files) {
    assert.equal(/(?:src|href)="https?:\/\//.test(content), false, "禁止 CDN / 外链");
    assert.equal(/@import\s+url\(/.test(content), false);
    assert.equal(/url\(\s*["']?https?:/.test(content), false);
  }
});

test("DOM 与脚本双向闭合：脚本里取的每个 id 都在标记中存在", () => {
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
  const referenced = new Set();
  for (const file of jsSources()) {
    for (const match of file.code.matchAll(/getElementById\("([^"]+)"\)/g)) referenced.add(match[1]);
  }
  const missing = [...referenced].filter((id) => !ids.has(id));
  assert.deepEqual(missing, [], `标记缺少这些 id: ${missing.join(", ")}`);
  assert.ok(referenced.size >= 25, `脚本引用的元素只有 ${referenced.size} 个，疑似漏接`);
});

test("静态 data-i18n 与 data-i18n-aria 全部能在词典中解析", () => {
  const keys = [
    ...html.matchAll(/data-i18n="([^"]+)"/g),
    ...html.matchAll(/data-i18n-aria="([^"]+)"/g),
  ].map((match) => match[1]);
  assert.ok(keys.length >= 20, `静态词条只有 ${keys.length} 条`);
  for (const key of keys) {
    assert.ok(hasKey("zh", key), `index.html 引用了不存在的词条 ${key}`);
    assert.ok(hasKey("en", key), `index.html 引用了英文表缺失的词条 ${key}`);
  }
});

test("动态注入的 class 在样式表里都有落脚点", () => {
  const ui = jsSources().find((file) => file.name === "ui.mjs").code;
  const injected = new Set([
    ...[...ui.matchAll(/class="([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/)),
    ...[...ui.matchAll(/el\("[a-z]+", "([a-z-]+)"/g)].map((match) => match[1]),
  ]);
  const missing = [...injected].filter((name) => name && !css.includes(`.${name}`));
  assert.deepEqual(missing, [], `样式表缺少: ${missing.join(", ")}`);
});

test("样式表覆盖强制体验项：hidden、动效降级、安全避让、滚动拦截", () => {
  assert.match(css, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /max\(68px,\s*calc\(14px \+ env\(safe-area-inset-bottom\)\)\)/);
  assert.match(css, /overscroll-behavior:\s*none/);
  assert.match(css, /:active\s*\{[^}]*translateY\(2px\)/s, "实体按键需要按下位移");
});

test("无 canvas：本作是纯语义 DOM + CSS 3D 路线", () => {
  assert.equal(/<canvas/.test(html), false);
  assert.equal(/getContext\(/.test(jsSources().map((file) => file.code).join("\n")), false);
});
