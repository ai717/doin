import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

describe("Picross Markup & Contract Tests", () => {
  const htmlPath = resolve("games/picross/index.html");
  const cssPath = resolve("games/picross/css/style.css");
  const enginePath = resolve("games/picross/js/engine.mjs");

  it("index.html exists and is readable", () => {
    assert.ok(existsSync(htmlPath), "index.html must exist");
  });

  const html = readFileSync(htmlPath, "utf8");

  it("has back-to-home link to root", () => {
    assert.match(html, /<a[^>]+href="\/"[^>]*id="back-home"/, "Must have #back-home link to /");
  });

  it("has noscript fallback", () => {
    assert.match(html, /<noscript>/, "Must contain <noscript>");
  });

  it("all local script and css links contain ?v=dev cache placeholder", () => {
    const localAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((v) => !/^(https?:)?\/\//.test(v) && !v.startsWith("data:") && /\.(mjs|js|css)(\?|$)/.test(v));

    assert.ok(localAssets.length >= 2, "Must reference at least css and js");
    localAssets.forEach((url) => {
      assert.ok(url.includes("?v=dev"), `Asset missing ?v=dev: ${url}`);
    });
  });

  it("has meta description and favicon", () => {
    assert.match(html, /<meta[^>]+name="description"/, "Must have meta description");
    assert.match(html, /rel="icon"/, "Must have favicon link");
  });

  it("css includes prefers-reduced-motion and mobile bottom safe area", () => {
    const css = readFileSync(cssPath, "utf8");
    assert.ok(css.includes("prefers-reduced-motion"), "Must support prefers-reduced-motion");
    assert.ok(
      css.includes("safe-area-inset-bottom") || css.includes("68px"),
      "Must reserve mobile ad safety buffer"
    );
  });

  it("engine.mjs is 100% DOM-free and storage-free", () => {
    const engineCode = readFileSync(enginePath, "utf8");
    const stripped = engineCode.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const forbidden = ["document.", "window.", "localStorage", "sessionStorage"];
    forbidden.forEach((term) => {
      assert.equal(stripped.includes(term), false, `engine.mjs must not contain ${term}`);
    });
  });
});
