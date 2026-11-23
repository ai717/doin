import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { strings } from "../js/i18n.mjs";

const gameDir = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", gameDir), "utf8");
const css = readFileSync(new URL("css/style.css", gameDir), "utf8");

function jsSource(name) {
  return readFileSync(new URL(`js/${name}`, gameDir), "utf8");
}

test("local assets all carry the ?v=dev cache placeholder", () => {
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((v) => /\.(mjs|js|css)(\?|$)/.test(v) && !/^(https?:)?\/\//.test(v));
  assert.ok(assets.length >= 2, "expected css + module script");
  for (const asset of assets) {
    assert.ok(asset.includes("?v=dev"), `missing ?v=dev: ${asset}`);
  }
});

test("portal contract: back-home link, noscript, meta, icon, lang, module", () => {
  assert.ok(/<a[^>]+href="\/"[^>]*id="back-home"/.test(html), "back-home link");
  assert.ok(/<noscript/.test(html), "noscript");
  assert.ok(/<meta[^>]+name="description"/.test(html), "meta description");
  assert.ok(/rel="icon"/.test(html), "favicon");
  assert.ok(/<html[^>]+lang="/.test(html), "html lang");
  assert.ok(/<script[^>]+type="module"/.test(html), "module script");
});

test("every data-i18n key exists in both dictionaries", () => {
  const keys = [...html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length >= 10, "expected i18n coverage on static markup");
  for (const key of keys) {
    assert.ok(strings.zh[key] !== undefined, `zh missing ${key}`);
    assert.ok(strings.en[key] !== undefined, `en missing ${key}`);
  }
});

test("ids referenced by scripts exist in markup or are ui-generated", () => {
  const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const uiSource = jsSource("ui.mjs");
  const mainSource = jsSource("main.mjs");
  const refs = new Set();
  for (const src of [uiSource, mainSource]) {
    for (const m of src.matchAll(/\$\("([^"]+)"\)/g)) refs.add(m[1]);
    for (const m of src.matchAll(/getElementById\("([^"]+)"\)/g)) refs.add(m[1]);
  }
  for (const id of refs) {
    if (htmlIds.has(id)) continue;
    assert.ok(
      uiSource.includes(`"${id}"`) && /class=/.test(uiSource),
      `id ${id} referenced but neither in HTML nor dynamically created`,
    );
  }
});

test("no reload anywhere, reduced-motion and touch guards in css", () => {
  for (const name of ["main.mjs", "ui.mjs", "game.mjs", "engine.mjs", "i18n.mjs"]) {
    assert.ok(!jsSource(name).includes("location.reload"), `${name} must not reload`);
  }
  assert.ok(css.includes("prefers-reduced-motion"), "reduced motion media query");
  assert.ok(css.includes("touch-action: none"), "stage touch-action");
  assert.ok(css.includes("env(safe-area-inset-bottom)"), "mobile safe area");
});

test("engine stays DOM-free", () => {
  const src = jsSource("engine.mjs");
  for (const token of ["document.", "window.", "localStorage", "sessionStorage"]) {
    assert.ok(!src.includes(token), `engine must not touch ${token}`);
  }
});
