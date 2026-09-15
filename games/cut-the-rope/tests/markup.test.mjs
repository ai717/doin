import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const indexHtmlPath = resolve(root, "index.html");
const cssPath = resolve(root, "css", "style.css");

test("markup: index.html meets DOIN platform contracts", () => {
  assert.ok(existsSync(indexHtmlPath), "index.html must exist");
  const html = readFileSync(indexHtmlPath, "utf8");

  assert.match(html, /<html[^>]+lang="zh-CN"/, "must have html lang='zh-CN'");
  assert.match(html, /<meta[^>]+name="description"/, "must have meta description");
  assert.match(html, /<link[^>]+rel="icon"[^>]+href="favicon.svg"/, "must have favicon.svg");
  assert.match(html, /href="css\/style\.css\?v=dev"/, "must link css with ?v=dev");
  assert.match(html, /src="js\/main\.mjs\?v=dev"/, "must link main.mjs with ?v=dev");
  assert.match(html, /<a[^>]+href="\/"[^>]+id="back-home"/, "must have back-home link to /");
  assert.match(html, /<canvas[^>]+id="stage-canvas"/, "must have canvas #stage-canvas");
  assert.match(html, /<noscript>/, "must have noscript fallback");
});

test("markup: css includes prefers-reduced-motion", () => {
  assert.ok(existsSync(cssPath), "style.css must exist");
  const css = readFileSync(cssPath, "utf8");
  assert.ok(css.includes("prefers-reduced-motion"), "css must support prefers-reduced-motion");
});
