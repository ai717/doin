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
  const nodes = [...clean.matchAll(/<([a-zA-Z0-9\-]+)([^>]*)>([^<]*[\u4e00-\u9fa5]+[^<]*)<\/\1>/g)];
  for (const node of nodes) {
    const tag = node[1].toLowerCase();
    if (tag === "title" || tag === "script") continue;
    assert.match(node[2], /data-i18n/, `<${tag}> ${node[3].trim()} has no data-i18n`);
  }
});

test("modules exist and the rules layer stays DOM free", () => {
  for (const name of ["engine.mjs", "game.mjs", "ui.mjs", "render.mjs", "main.mjs", "score.mjs", "storage.mjs", "audio.mjs", "i18n.mjs", "levels.mjs"]) {
    assert.equal(existsSync(new URL(`../js/${name}`, import.meta.url)), true, `${name} missing`);
  }
  const engine = readFileSync(new URL("../js/engine.mjs", import.meta.url), "utf8");
  for (const token of ["document.", "window.", "localStorage", "sessionStorage"]) {
    assert.equal(engine.includes(token), false, `engine must not touch ${token}`);
  }
});

test("styling keeps the mobile safe area and motion fallback", () => {
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /linear-gradient/);
});
