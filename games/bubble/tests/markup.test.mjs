import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

describe("markup.test.mjs structural and asset integrity", () => {
  const rootDir = resolve(import.meta.dirname, "..");
  const htmlPath = resolve(rootDir, "index.html");
  const html = readFileSync(htmlPath, "utf8");

  it("index.html contains back-home link and noscript", () => {
    assert.ok(/<a[^>]+href="\/"[^>]*id="back-home"/.test(html));
    assert.ok(/<noscript/.test(html));
  });

  it("local script and css references carry ?v=dev cache placeholder", () => {
    const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((u) => !/^(https?:)?\/\//.test(u) && !u.startsWith("data:") && /\.(mjs|js|css)(\?|$)/.test(u));

    assert.ok(assets.length > 0);
    for (const asset of assets) {
      assert.ok(
        asset.includes("?v=dev"),
        `Asset ${asset} is missing ?v=dev cache placeholder`
      );
    }
  });

  it("every DOM id referenced by JS exists in index.html", () => {
    const jsDir = resolve(rootDir, "js");
    const jsFiles = readdirSync(jsDir).filter((f) => f.endsWith(".mjs"));
    const htmlIds = new Set(
      [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1])
    );

    for (const f of jsFiles) {
      const code = readFileSync(resolve(jsDir, f), "utf8");
      const idMatches = [...code.matchAll(/getElementById\(["']([^"']+)["']\)/g)].map((m) => m[1]);
      for (const id of idMatches) {
        assert.ok(
          htmlIds.has(id),
          `JS file ${f} references missing DOM id: "${id}"`
        );
      }
    }
  });

  it("css covers prefers-reduced-motion and touch-action", () => {
    const cssPath = resolve(rootDir, "css", "style.css");
    const css = readFileSync(cssPath, "utf8");
    assert.ok(css.includes("prefers-reduced-motion"));
    assert.ok(css.includes("touch-action"));
    assert.ok(css.includes("safe-area-inset-bottom"));
  });
});
