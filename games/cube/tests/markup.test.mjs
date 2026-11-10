import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const css = readFileSync(resolve(root, "css", "style.css"), "utf8");
const engine = readFileSync(resolve(root, "js", "engine.mjs"), "utf8");
const storage = readFileSync(resolve(root, "js", "storage.mjs"), "utf8");

test("index.html keeps the portal contract", () => {
  assert.match(html, /<a[^>]+href="\/"[^>]*id="back-home"/);
  assert.match(html, /<noscript>/);
  assert.match(html, /<script[^>]+type="module"[^>]+src="js\/main\.mjs\?v=dev"/);
  assert.match(html, /<link[^>]+rel="stylesheet"[^>]+href="css\/style\.css\?v=dev"/);
  assert.match(html, /<meta[^>]+name="description"/);
  assert.match(html, /rel="icon"/);
  assert.match(html, /<html[^>]+lang="/);
  assert.match(html, /id="stage"/);
  assert.match(html, /id="levels-btn"/);
  assert.match(html, /id="levels-layer"/);
  assert.match(html, /id="result-layer"/);
});

test("all local script and style references carry the dev cache bust", () => {
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => !/^(https?:)?\/\//.test(value) && /\.(mjs|js|css)(\?|$)/.test(value));
  assert.ok(refs.length >= 2);
  for (const ref of refs) assert.ok(ref.includes("?v=dev"), `${ref} missing ?v=dev`);
});

test("no page-break, alert or external runtime dependency", () => {
  const sources = readdirSync(resolve(root, "js"))
    .filter((name) => name.endsWith(".mjs"))
    .map((name) => readFileSync(resolve(root, "js", name), "utf8"))
    .join("\n");
  assert.equal(sources.includes("location.reload"), false);
  assert.equal(sources.includes("document.write"), false);
  assert.equal(/\balert\s*\(/.test(sources), false);
  assert.equal(/<script[^>]+src="https?:/.test(html), false);
  assert.equal(/@import\s+url\(\s*["']?https?:/.test(css), false);
});

test("canvas blocks native scroll and touch gestures", () => {
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /overscroll-behavior:\s*none/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("engine stays DOM-free and storage is guarded", () => {
  for (const token of ["document.", "window.", "localStorage", "sessionStorage"]) {
    assert.equal(engine.includes(token), false, `engine leaks ${token}`);
  }
  assert.ok(storage.includes("doin.cube.v1"));
  assert.ok(storage.includes("catch"));
});

test("every Chinese text node in the HTML is translatable", () => {
  const clean = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  const matches = clean.matchAll(/<([a-zA-Z0-9-]+)([^>]*)>([^<]*[\u4e00-\u9fa5]+[^<]*)<\/\1>/g);
  const missing = [];
  for (const match of matches) {
    const tag = match[1].toLowerCase();
    if (tag === "title" || tag === "script") continue;
    if (!match[2].includes("data-i18n")) missing.push(match[3].trim().slice(0, 20));
  }
  assert.deepEqual(missing, []);
});

test("favicon and test entry exist", () => {
  assert.ok(existsSync(resolve(root, "favicon.svg")));
  const tests = readdirSync(resolve(root, "tests")).filter((name) => name.endsWith(".test.mjs"));
  assert.ok(tests.length >= 3);
});
