import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/style.css", import.meta.url), "utf8");

test("shell exposes the portal contracts", () => {
  assert.match(html, /<a[^>]+href="\/"/, "back-home link");
  assert.match(html, /<noscript/);
  assert.match(html, /<meta[^>]+name="description"/);
  assert.match(html, /rel="icon"/);
  assert.match(html, /<html[^>]+lang="/);
  assert.match(html, /type="module"/);
});

test("local assets carry the cache placeholder", () => {
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => !/^(https?:)?\/\//.test(value) && /\.(mjs|js|css|svg)(\?|$)/.test(value));
  assert.ok(assets.length >= 3);
  for (const asset of assets) assert.match(asset, /\?v=dev/, `${asset} lacks the build placeholder`);
});

test("every static Chinese label is i18n covered", () => {
  const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  const nodes = [...clean.matchAll(/<([a-zA-Z0-9-]+)([^>]*)>([^<]*[一-龥]+[^<]*)<\/\1>/g)];
  for (const node of nodes) {
    const tag = node[1].toLowerCase();
    if (tag === "title" || tag === "script") continue;
    assert.match(node[2], /data-i18n/, `<${tag}> ${node[3].trim()} has no data-i18n`);
  }
});

test("modules exist and the rules layer stays DOM free", () => {
  for (const name of [
    "engine.mjs",
    "game.mjs",
    "ui.mjs",
    "render.mjs",
    "main.mjs",
    "score.mjs",
    "storage.mjs",
    "audio.mjs",
    "i18n.mjs",
    "levels.mjs",
  ]) {
    assert.equal(existsSync(new URL(`../js/${name}`, import.meta.url)), true, `${name} missing`);
  }
  for (const name of ["engine.mjs", "game.mjs", "score.mjs"]) {
    const code = readFileSync(new URL(`../js/${name}`, import.meta.url), "utf8");
    for (const token of ["document.", "window.", "localStorage", "sessionStorage"]) {
      assert.equal(code.includes(token), false, `${name} must not touch ${token}`);
    }
  }
});

test("no page reload anywhere in the assembly layer", () => {
  for (const name of ["main.mjs", "ui.mjs"]) {
    const code = readFileSync(new URL(`../js/${name}`, import.meta.url), "utf8");
    assert.equal(/location\.reload/.test(code), false, `${name} reloads the page`);
  }
});

test("styling keeps the mobile safe area and motion fallback", () => {
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /linear-gradient/);
});

test("stylesheet braces stay balanced", () => {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let depth = 0;
  for (const ch of stripped) {
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    assert.ok(depth >= 0, "unbalanced closing brace");
  }
  assert.equal(depth, 0, "stylesheet has unclosed blocks");
});

test("reduced motion never hides a control", () => {
  const blocks = [...css.matchAll(/@media\s*\(prefers-reduced-motion[^)]*\)\s*\{([\s\S]*?)\n\}/g)];
  assert.ok(blocks.length >= 1, "no reduced-motion block");
  for (const block of blocks) {
    assert.equal(/display:\s*none/.test(block[1]), false, "reduced motion must not hide core controls");
  }
});
