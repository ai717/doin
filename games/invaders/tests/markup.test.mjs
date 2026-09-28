import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { dict } from "../js/i18n.mjs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/style.css", import.meta.url), "utf8");

test("shell carries the platform contract bits", () => {
  assert.match(html, /<html[^>]+lang="/);
  assert.match(html, /<meta[^>]+name="description"/);
  assert.match(html, /rel="icon"/);
  assert.match(html, /<noscript/);
  assert.match(html, /<a[^>]+href="\/"/);
  assert.match(html, /<script[^>]+type="module"/);
  assert.match(html, /js\/main\.mjs\?v=dev/);
  assert.match(html, /css\/style\.css\?v=dev/);
});

test("every static chinese node is wired for translation", () => {
  const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  const tags = [...clean.matchAll(/<([a-zA-Z0-9\-]+)([^>]*)>([^<]*[\u4e00-\u9fa5]+[^<]*)<\/\1>/g)];
  assert.ok(tags.length > 0);
  for (const tag of tags) {
    const [tagName, attrs, text] = [tag[1].toLowerCase(), tag[2], tag[3].trim()];
    if (tagName === "title" || tagName === "script") continue;
    const ok = attrs.includes("data-i18n") || attrs.includes("data-i18n-aria") || /id="/.test(attrs);
    assert.ok(ok, `untranslated node <${tagName}> ${text.slice(0, 12)}`);
  }
});

test("data-i18n keys all exist in the dictionary", () => {
  const keys = [...html.matchAll(/data-i18n(-aria)?="([^"]+)"/g)].map((match) => match[2]);
  const table = dict("zh");
  for (const key of keys) {
    assert.ok(key in table, `unknown i18n key ${key}`);
  }
});

test("porthole shell parts are present", () => {
  for (const id of [
    "stage-canvas",
    "glass",
    "radar-strip",
    "console",
    "heat-fill",
    "hull-cells",
    "combo-val",
    "score-val",
    "menu-layer",
    "report-layer",
    "help-layer",
    "pause-layer",
    "btn-continue",
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
});

test("the hangar starts with no resumable sortie", () => {
  const button = html.match(/<button[^>]+id="btn-continue"[^>]*>/)[0];
  assert.match(button, /class="[^"]*\bhidden\b/);
  assert.match(button, /data-i18n="btnContinue"/);
});

test("a hover without a held pointer can never seize the turret", () => {
  const main = readFileSync(new URL("../js/main.mjs", import.meta.url), "utf8");
  const handler = main.slice(main.indexOf('addEventListener("pointermove"'));
  assert.match(handler.slice(0, 400), /pointerHeld/, "pointermove must require a held pointer");
});

test("every overlay change funnels through one input-resetting exit", () => {
  const main = readFileSync(new URL("../js/main.mjs", import.meta.url), "utf8");
  assert.match(main, /function setOverlay\(name\)\s*\{\s*stopIntent\(\);/);
  assert.equal(/ui\.showOverlay\(/.test(main.replace(/ui\.showOverlay\(name\)/, "")), false);
});

test("canvas declares touch guards and console reserves the ad gutter", () => {
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /overscroll-behavior:\s*none/);
  assert.match(css, /padding-bottom:\s*max\(68px/);
  assert.match(css, /prefers-reduced-motion/);
});

test("page background is a layered gradient, never a flat slab", () => {
  const blocks = [...css.matchAll(/\nbody\s*\{[\s\S]*?\n\}/g)].map((match) => match[0]);
  const bodyBlock = blocks.find((block) => block.includes("background")) ?? blocks[0];
  assert.match(bodyBlock, /linear-gradient/);
  assert.equal(/background:\s*(#fff|#000|white|black)\b/.test(bodyBlock), false);
});

test("no location.reload anywhere in the shipped sources", () => {
  const files = ["js/main.mjs", "js/ui.mjs", "js/game.mjs", "js/render.mjs", "js/engine.mjs", "js/i18n.mjs", "js/audio.mjs"];
  for (const name of files) {
    const src = readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
    assert.equal(src.includes("location.reload"), false, `${name} reloads the page`);
  }
});
