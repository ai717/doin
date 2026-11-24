import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");

test("local script and stylesheet carry the dev cache placeholder", () => {
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => !/^(https?:)?\/\//.test(value) && /\.(mjs|js|css)(\?|$)/.test(value));
  assert.ok(assets.length > 0);
  for (const asset of assets) assert.ok(asset.includes("?v=dev"), asset);
});

test("document has portal link, noscript fallback, SEO and language metadata", () => {
  assert.match(html, /<a[^>]+href="\/"[^>]+id="back-home"|<a[^>]+id="back-home"[^>]+href="\/"/);
  assert.match(html, /<noscript/);
  assert.match(html, /<meta[^>]+name="description"/);
  assert.match(html, /<link[^>]+rel="icon"/);
  assert.match(html, /<html[^>]+lang="/);
  assert.match(html, /<script[^>]+type="module"/);
});

test("all Chinese static nodes are translated declaratively", () => {
  const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  const unhandled = [];
  for (const match of clean.matchAll(/<([a-zA-Z0-9\-]+)([^>]*)>([^<]*[\u4e00-\u9fa5]+[^<]*)<\/\1>/g)) {
    if (match[1].toLowerCase() === "title") continue;
    if (match[2].includes("data-i18n")) continue;
    unhandled.push(match[3].trim().slice(0, 12));
  }
  assert.deepEqual(unhandled, []);
});

test("every scripted id and data hook exists in the markup", () => {
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
  const jsDir = resolve(root, "js");
  for (const name of readdirSync(jsDir)) {
    if (!name.endsWith(".mjs")) continue;
    const code = readFileSync(resolve(jsDir, name), "utf8");
    for (const match of code.matchAll(/(?:getElementById\(|\$\()\s*"([a-z][a-z0-9-]*)"\)/g)) {
      assert.ok(ids.has(match[1]), `${name} references missing #${match[1]}`);
    }
  }
  for (const zone of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
    assert.ok(html.includes(`data-zone="${zone}"`), `missing zone ${zone}`);
  }
  for (const power of ["tap", "drive", "blast"]) {
    assert.ok(html.includes(`data-power="${power}"`), `missing power ${power}`);
  }
});

test("responsive safety padding and reduced motion are declared", () => {
  const css = readFileSync(resolve(root, "css", "style.css"), "utf8");
  assert.ok(css.includes("prefers-reduced-motion"));
  assert.ok(css.includes("env(safe-area-inset-bottom)"));
  assert.ok(css.includes("touch-action: none"));
  assert.ok(css.includes("[hidden]"));
});
