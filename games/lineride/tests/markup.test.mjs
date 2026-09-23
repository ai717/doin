// tests/markup.test.mjs — HTML 标记装配契约测试
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, "..", "index.html"), "utf-8");

describe("index.html markup contract", () => {
  it("has back-home link to /", () => {
    assert.ok(html.includes('href="/"'));
    assert.ok(html.includes('id="back-home"'));
  });

  it("has noscript fallback", () => {
    assert.ok(html.includes("<noscript>"));
  });

  it("has ?v=dev on local resources", () => {
    assert.ok(html.includes("css/style.css?v=dev"));
    assert.ok(html.includes("js/main.mjs?v=dev"));
  });

  it("has no CDN or external resources", () => {
    assert.ok(!html.includes("https://cdn"));
    assert.ok(!html.includes("https://fonts.googleapis.com"));
    assert.ok(!html.includes("http://"));
  });

  it("has all required interaction IDs", () => {
    const ids = [
      "game-canvas", "stage-bar", "stage-title", "back-home",
      "btn-sound", "btn-lang", "btn-help", "btn-play", "btn-reset",
      "tool-normal", "tool-boost", "tool-slow", "tool-scenery",
      "tool-eraser", "tool-undo", "mode-freestyle", "mode-puzzle",
      "puzzle-panel", "puzzle-level", "puzzle-stars", "puzzle-ink",
      "puzzle-prev", "puzzle-next", "overlay", "toast",
    ];
    for (const id of ids) {
      assert.ok(html.includes(`id="${id}"`), `missing id="${id}"`);
    }
  });

  it("has mobile-safe viewport meta", () => {
    assert.ok(html.includes("viewport"));
    assert.ok(html.includes("maximum-scale=1.0"));
    assert.ok(html.includes("user-scalable=no"));
  });

  it("uses module script entry", () => {
    assert.ok(html.includes('type="module"'));
  });
});

describe("css style contract", () => {
  const css = readFileSync(join(__dirname, "..", "css", "style.css"), "utf-8");

  it("has reduced-motion support", () => {
    assert.ok(css.includes("prefers-reduced-motion"));
  });

  it("has touch-action:none on canvas", () => {
    assert.ok(css.includes("touch-action: none"));
  });

  it("has mobile bottom padding for ads", () => {
    assert.ok(css.includes("padding-bottom"));
    assert.ok(css.includes("safe-area-inset-bottom"));
  });

  it("has overscroll-behavior:none", () => {
    assert.ok(css.includes("overscroll-behavior: none"));
  });
});