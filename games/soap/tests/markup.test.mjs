import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const jsDir = resolve(root, "js");
const sources = readdirSync(jsDir)
  .filter((name) => name.endsWith(".mjs"))
  .map((name) => ({ name, src: readFileSync(resolve(jsDir, name), "utf8") }));
const allJs = sources.map((file) => file.src).join("\n");

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("index.html exists and declares a valid document shell", () => {
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<html[^>]+lang="/);
  assert.match(html, /<meta[^>]+charset=/i);
  assert.match(html, /<meta[^>]+name="viewport"/);
  assert.match(html, /<meta[^>]+name="description"/);
  assert.match(html, /<link[^>]+rel="icon"/);
  assert.match(html, /<noscript/);
});

test("local stylesheet and entry script carry ?v=dev cache placeholder", () => {
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => !/^(https?:)?\/\//.test(value) && /\.((mjs|js|css)(\?|$))/.test(value));
  assert.ok(assets.length >= 2);
  for (const asset of assets) {
    assert.match(asset, /\?v=dev$/, asset);
  }
});

test("back-home link and module entry script are wired", () => {
  assert.match(html, /<a[^>]+href="\/"[^>]+id="back-home"/);
  assert.match(html, /<script[^>]+type="module"[^>]+src="js\/main\.mjs\?v=dev"/);
});

test("every getElementById target exists in the markup", () => {
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
  const used = new Set([...allJs.matchAll(/\$\("([^"]+)"\)/g)].map((match) => match[1]));
  assert.ok(used.size > 10);
  for (const id of used) {
    assert.equal(ids.has(id), true, `missing DOM id: ${id}`);
  }
});

test("no location.reload and shared language key are present", () => {
  for (const file of sources) {
    const code = stripComments(file.src);
    assert.equal(code.includes("location.reload"), false, `${file.name} uses location.reload`);
  }
  assert.ok(allJs.includes("doin.lang"));
});

test("storage is wrapped and namespaced", () => {
  const storage = sources.find((file) => file.name === "storage.mjs");
  assert.ok(storage);
  assert.match(storage.src, /doin\.soap\.v1/);
  assert.match(storage.src, /catch/);
});

test("engine stays DOM-free", () => {
  const engine = sources.find((file) => file.name === "engine.mjs");
  assert.ok(engine);
  const code = stripComments(engine.src);
  for (const token of ["document.", "window.", "localStorage", "sessionStorage"]) {
    assert.equal(code.includes(token), false, `engine leaked ${token}`);
  }
});

test("CSS declares reduced-motion fallback and safe-area padding", () => {
  const css = readFileSync(resolve(root, "css", "style.css"), "utf8");
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /overscroll-behavior:\s*none/);
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
});

test("favicon exists and the canvas is declared", () => {
  assert.equal(existsSync(resolve(root, "favicon.svg")), true);
  assert.match(html, /<canvas[^>]+id="board"/);
});
