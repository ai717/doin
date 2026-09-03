import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const css = readFileSync(resolve(root, "css/style.css"), "utf8");
const main = readFileSync(resolve(root, "js/main.mjs"), "utf8");
const ui = readFileSync(resolve(root, "js/ui.mjs"), "utf8");

const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));

describe("markup contract", () => {
  it("declares every element main.mjs looks up by id", () => {
    const wanted = [...main.matchAll(/byId\("([^"]+)"\)/g)].map((match) => match[1]);
    assert.ok(wanted.length >= 20, "expected the wiring to bind a full board");
    for (const id of wanted) {
      assert.ok(htmlIds.has(id), `index.html is missing id="${id}"`);
    }
  });

  it("keeps the three difficulty levels and both board sizes", () => {
    assert.deepEqual(
      [...html.matchAll(/data-difficulty="([^"]+)"/g)].map((m) => m[1]),
      ["easy", "normal", "master"],
    );
    assert.deepEqual(
      [...html.matchAll(/data-size="([^"]+)"/g)].map((m) => m[1]),
      ["3", "4"],
    );
    assert.deepEqual(
      [...html.matchAll(/data-mode="([^"]+)"/g)].map((m) => m[1]),
      ["pve", "pvp"],
    );
  });

  it("exposes the ids the DOM layer expects from refs", () => {
    for (const id of ["board", "win-line", "status", "undo", "restart", "sound", "theme"]) {
      assert.ok(htmlIds.has(id), `missing core id="${id}"`);
    }
    assert.match(ui, /refs\.board/);
    assert.match(ui, /refs\.winLine/);
  });

  it("links local assets that are on disk", () => {
    // 资源带 ?v=dev 占位（生产构建时统一替换为 BUILD_ID），比对前先剥掉查询串
    const local = [...html.matchAll(/(?:href|src)="(\/[^"]*|[^":#]+\.(?:css|mjs|svg|png)(?:\?[^"]*)?)"/g)];
    assert.ok(local.length >= 3);
    for (const [, href] of local) {
      if (href.startsWith("/") || href.startsWith("http")) continue;
      const path = href.split("?")[0];
      assert.ok(existsSync(resolve(root, path)), `missing asset ${path}`);
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
    assert.equal(/@font-face/.test(css), false, "webfonts are not allowed on this site");
  });

  it("starts from the light theme and degrades without javascript", () => {
    assert.match(html, /<html[^>]+data-theme="light"/);
    assert.match(html, /<script type="module" src="js\/main\.mjs\?v=dev"><\/script>/);
    assert.match(html, /<noscript>/);
  });

  it("carries canonical url and social metadata", () => {
    assert.match(html, /rel="canonical" href="https:\/\/doin\.win\/tic-tac-toe\/"/);
    assert.match(html, /property="og:title"/);
    assert.match(html, /name="twitter:card"/);
    assert.match(html, /name="description"/);
  });
});
