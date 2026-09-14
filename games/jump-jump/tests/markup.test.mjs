import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(import.meta.dirname, "..");
const htmlPath = resolve(dir, "index.html");
const cssPath = resolve(dir, "css", "style.css");
const html = readFileSync(htmlPath, "utf8");

function readJsSources() {
  const jsDir = resolve(dir, "js");
  return readdirSync(jsDir)
    .filter((name) => name.endsWith(".mjs"))
    .map((name) => ({ name, src: readFileSync(resolve(jsDir, name), "utf8") }));
}

test("markup: back-home, noscript, canvas and favicon are present", () => {
  assert.ok(/<a[^>]+href="\/"[^>]*id="back-home"/.test(html) || /<a[^>]+id="back-home"[^>]*href="\/"/.test(html), "必须包含 id='back-home' 且 href='/' 的返回首页链接");
  assert.ok(/<noscript/.test(html), "必须包含 <noscript> 兜底");
  assert.ok(/<canvas[^>]+id="stage-canvas"/.test(html), "必须包含 id='stage-canvas' 的画布");
  assert.ok(/rel="icon"/.test(html), "必须声明 favicon");
  assert.ok(/<html[^>]+lang="/.test(html), "html 必须带 lang 属性");
  assert.ok(/<meta[^>]+name="description"/.test(html), "必须带 meta description");
});

test("markup: local assets carry the ?v=dev cache placeholder", () => {
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((v) => !/^(https?:)?\/\//.test(v) && !v.startsWith("data:") && /\.(mjs|js|css)(\?|$)/.test(v));
  assert.ok(assets.length >= 2, "应至少外链样式与入口脚本");
  for (const asset of assets) {
    assert.ok(asset.includes("?v=dev"), `${asset} 缺少 ?v=dev 占位符`);
  }
});

test("markup: entry script is an ES module and there are no external URLs", () => {
  assert.ok(/<script[^>]+type="module"[^>]+src="js\/main\.mjs\?v=dev"/.test(html), "入口必须是 module 类型脚本");
  const urls = [...html.matchAll(/https?:\/\/[^"'\s>]+/g)].map((m) => m[0]);
  assert.equal(urls.length, 0, `HTML 中不得包含外部网络链接: ${urls.join(", ")}`);
});

test("markup: no absolute game paths leak into the source", () => {
  const sources = [html, ...readJsSources().map((f) => f.src)];
  for (const src of sources) {
    assert.ok(!/\/games\/jump-jump\//.test(src), "源码内禁止写本地绝对路径 /games/<slug>/");
    assert.ok(!/["'`]\/jump-jump\//.test(src), "源码内禁止写生产绝对路径 /<slug>/");
  }
});

test("markup: every id referenced from JS exists in index.html", () => {
  const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const missing = [];
  for (const file of readJsSources()) {
    for (const match of file.src.matchAll(/getElementById\("([^"]+)"\)/g)) {
      if (!htmlIds.has(match[1])) missing.push(`${file.name}:${match[1]}`);
    }
    // ui.mjs 用 el("x") 简写
    for (const match of file.src.matchAll(/\bel\("([^"]+)"\)/g)) {
      if (!htmlIds.has(match[1])) missing.push(`${file.name}:el(${match[1]})`);
    }
  }
  assert.deepEqual(missing, [], `JS 引用了 index.html 中不存在的 id: ${missing.join(", ")}`);
});

test("markup: css covers responsive layout and reduced motion", () => {
  assert.ok(existsSync(cssPath), "style.css 必须存在");
  const css = readFileSync(cssPath, "utf8");
  assert.ok(css.includes("prefers-reduced-motion"), "必须带 prefers-reduced-motion 降级");
  assert.ok(/@media\s*\(min-width:\s*900px\)/.test(css), "桌面端必须走 ≥900px 双翼沉浸舞台");
  assert.ok(/@media\s*\(max-width:\s*899px\)/.test(css), "移动端必须单列适配");
  assert.ok(/@media\s*\(max-width:\s*560px\)/.test(css), "应覆盖 390px 窄视口");
});

test("markup: engine and game layers stay DOM-free", () => {
  for (const name of ["engine.mjs", "game.mjs", "levels.mjs", "score.mjs"]) {
    const src = readFileSync(resolve(dir, "js", name), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const token of ["document.", "window.", "localStorage", "sessionStorage"]) {
      assert.ok(!src.includes(token), `${name} 不得触碰 ${token}`);
    }
  }
});

test("markup: module graph has no missing relative imports", () => {
  for (const file of readJsSources()) {
    for (const match of file.src.matchAll(/from\s+"(\.\/[^"]+)"/g)) {
      const target = resolve(dir, "js", match[1]);
      assert.ok(existsSync(target), `${file.name} 引用了不存在的模块 ${match[1]}`);
    }
  }
});

test("markup: language preference uses the shared doin.lang key", () => {
  const i18n = readFileSync(resolve(dir, "js", "i18n.mjs"), "utf8");
  assert.ok(i18n.includes("doin.lang"), "i18n 必须读写全站共享 key");

  // 判"谁真的在读写 localStorage"前先剥注释：说明性注释里提到它不算违规
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const others = readJsSources()
    .filter((f) => f.name !== "i18n.mjs")
    .filter((f) => strip(f.src).includes("localStorage"));
  assert.deepEqual(
    others.map((f) => f.name),
    ["storage.mjs"],
    "除 i18n 外，localStorage 只允许集中在 storage.mjs"
  );
});
