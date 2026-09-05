import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const css = readFileSync(new URL("css/style.css", root), "utf8");

test("entry markup keeps the portal, cache, and accessibility contracts", () => {
  assert.match(html, /<a id="back-home" class="home-link" href="\//);
  assert.match(html, /<link rel="stylesheet" href="css\/style\.css\?v=dev">/);
  assert.match(html, /<script type="module" src="js\/main\.mjs\?v=dev"><\/script>/);
  assert.match(html, /<noscript>/);
  assert.match(html, /id="game-canvas"/);
});

test("responsive and reduced-motion styles stay present", () => {
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
