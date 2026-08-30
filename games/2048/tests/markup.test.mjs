import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { LOCALES, strings } from "../js/i18n.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const css = readFileSync(resolve(root, "css/style.css"), "utf8");
const uiSource = readFileSync(resolve(root, "js/ui.mjs"), "utf8");

const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));

describe("markup contract", () => {
  it("declares every element the view looks up by id", () => {
    const wanted = [...uiSource.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]);
    assert.ok(wanted.length >= 10);
    for (const id of wanted) {
      assert.ok(htmlIds.has(id), `index.html is missing id="${id}"`);
    }
  });

  it("keeps the four pad directions", () => {
    const dirs = [...html.matchAll(/data-dir="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(dirs.sort(), ["down", "left", "right", "up"]);
  });

  it("only points at copy keys that exist", () => {
    const keys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(keys.length >= 8);
    for (const locale of LOCALES) {
      const table = strings(locale);
      for (const key of keys) assert.ok(key in table, `${locale} is missing "${key}"`);
    }
  });

  it("links local assets that are on disk", () => {
    const local = [...html.matchAll(/(?:href|src)="(\/[^"]*|[^":#]+\.(?:css|mjs|svg|png))"/g)];
    assert.ok(local.length >= 2);
    for (const [, href] of local) {
      if (href.startsWith("/") || href.startsWith("http")) continue;
      assert.ok(existsSync(resolve(root, href)), `missing asset ${href}`);
    }
  });
});

describe("offline guarantees", () => {
  it("loads no remote script or stylesheet", () => {
    assert.equal(/<script[^>]+\bsrc="https?:/.test(html), false);
    for (const tag of html.match(/<link[^>]*>/g) ?? []) {
      if (!/rel="stylesheet"/.test(tag)) continue;
      assert.equal(/href="https?:/.test(tag), false, `remote stylesheet: ${tag}`);
    }
  });

  it("imports no remote font or image", () => {
    assert.equal(/@import\s+url\(\s*["']?https?:/.test(css), false);
    assert.equal(/url\(\s*["']?https?:/.test(css), false);
  });

  it("starts from the light theme and stays scriptable", () => {
    assert.match(html, /<html[^>]+data-theme="light"/);
    assert.match(html, /<script type="module" src="js\/main\.mjs"><\/script>/);
    assert.match(html, /<noscript>/);
  });
});
