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
  assert.ok(/<a[^>]+href="\/"[^>]*id="back-home"/.test(html) || /<a[^>]+id="back-home"[^>]*href="\/"/.test(html));
  assert.ok(/<noscript/.test(html));
  assert.ok(/<canvas[^>]+id="stage-canvas"/.test(html));
  assert.ok(/rel="icon"/.test(html));
  assert.ok(/<html[^>]+lang="/.test(html));
  assert.ok(/<meta[^>]+name="description"/.test(html));
});

test("markup: local assets carry the ?v=dev cache placeholder", () => {
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((v) => !/^(https?:)?\/\//.test(v) && !v.startsWith("data:") && /\.(mjs|js|css)(\?|$)/.test(v));
  assert.ok(assets.length >= 2);
  for (const asset of assets) {
    assert.ok(asset.includes("?v=dev"), `${asset} 缺少 ?v=dev`);
  }
});

test("markup: entry script is an ES module and there are no external URLs", () => {
  assert.ok(/<script[^>]+type="module"[^>]+src="js\/main\.mjs\?v=dev"/.test(html));
  const urls = [...html.matchAll(/https?:\/\/[^"'\s>]+/g)].map((m) => m[0]);
  assert.equal(urls.length, 0, `HTML 中不得包含外部网络链接: ${urls.join(", ")}`);
});

test("markup: no absolute game paths leak into the source", () => {
  const sources = [html, ...readJsSources().map((f) => f.src)];
  for (const src of sources) {
    assert.ok(!/\/games\/space-defender\//.test(src));
    assert.ok(!/["'`]\/space-defender\//.test(src));
  }
});

test("markup: every id referenced from JS exists in index.html", () => {
  const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const missing = [];
  for (const file of readJsSources()) {
    for (const match of file.src.matchAll(/getElementById\("([^"]+)"\)/g)) {
      if (!htmlIds.has(match[1])) missing.push(`${file.name}:${match[1]}`);
    }
    for (const match of file.src.matchAll(/\bel\("([^"]+)"\)/g)) {
      if (!htmlIds.has(match[1])) missing.push(`${file.name}:el(${match[1]})`);
    }
  }
  assert.deepEqual(missing, [], `JS 引用了不存在的 id: ${missing.join(", ")}`);
});

test("markup: css covers responsive layout, reduced motion and touch guards", () => {
  assert.ok(existsSync(cssPath));
  const css = readFileSync(cssPath, "utf8");
  assert.ok(css.includes("prefers-reduced-motion"));
  assert.ok(/@media\s*\(min-width:\s*900px\)/.test(css));
  assert.ok(/@media\s*\(max-width:\s*899px\)/.test(css));
  assert.ok(/@media\s*\(max-width:\s*560px\)/.test(css));
  assert.ok(css.includes("touch-action: none"));
  assert.ok(css.includes("padding-bottom: max(68px"));
  assert.ok(css.includes("overscroll-behavior: none"));
});

test("markup: rule layers stay DOM-free", () => {
  for (const name of ["engine.mjs", "game.mjs", "levels.mjs", "score.mjs", "storage.mjs", "i18n.mjs"]) {
    const src = readFileSync(resolve(dir, "js", name), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const token of ["document.", "window."]) {
      assert.ok(!src.includes(token), `${name} 不得碰 ${token}`);
    }
  }
});

test("markup: localStorage is confined to storage.mjs and i18n.mjs, both guarded", () => {
  const allowed = new Set(["storage.mjs", "i18n.mjs"]);
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const file of readJsSources()) {
    if (!strip(file.src).includes("localStorage")) continue;
    assert.ok(allowed.has(file.name), `${file.name} 不得裸读写 localStorage`);
    assert.ok(file.src.includes("catch"), `${file.name} 必须带降级 try/catch`);
  }
});
