import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { strings } from "../js/i18n.mjs";
import { LEVELS, CHAPTERS } from "../js/levels.mjs";

describe("Picross i18n & Pure English Purity Tests", () => {
  it("zh and en dictionaries have matching keys", () => {
    const zhKeys = Object.keys(strings.zh).sort();
    const enKeys = Object.keys(strings.en).sort();
    assert.deepEqual(zhKeys, enKeys, "All keys must be mirrored between zh and en");
  });

  it("strings.en contains ZERO Chinese characters (Pure English Invariant)", () => {
    const chineseRegex = /[\u4e00-\u9fa5]/;
    const badKeys = [];

    for (const [key, val] of Object.entries(strings.en)) {
      if (typeof val === "string" && chineseRegex.test(val)) {
        // langBtn can be '中' to indicate switching to Chinese
        if (key === "langBtn") continue;
        badKeys.push(`${key}: "${val}"`);
      }
    }

    assert.equal(
      badKeys.length,
      0,
      `Chinese characters found in strings.en: ${badKeys.join("; ")}`
    );
  });

  it("all 40 levels and 5 chapters have localized titles", () => {
    CHAPTERS.forEach((ch) => {
      assert.ok(strings.zh[ch.key], `Missing zh chapter string: ${ch.key}`);
      assert.ok(strings.en[ch.key], `Missing en chapter string: ${ch.key}`);
    });

    LEVELS.forEach((lvl) => {
      assert.ok(strings.zh[lvl.titleKey], `Missing zh level string: ${lvl.titleKey}`);
      assert.ok(strings.en[lvl.titleKey], `Missing en level string: ${lvl.titleKey}`);
    });
  });

  it("all JS source files (except i18n.mjs) contain ZERO hardcoded Chinese", () => {
    const jsDir = resolve("games/picross/js");
    const files = readdirSync(jsDir).filter((name) => name.endsWith(".mjs") && name !== "i18n.mjs");
    const chineseRegex = /(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g;
    const violations = [];

    files.forEach((file) => {
      const fullPath = resolve(jsDir, file);
      const code = readFileSync(fullPath, "utf8");
      // strip comments
      const stripped = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      const matches = stripped.match(chineseRegex);
      if (matches && matches.length > 0) {
        violations.push(`${file}: ${matches.join(", ")}`);
      }
    });

    assert.equal(
      violations.length,
      0,
      `Hardcoded Chinese found in JS files: ${violations.join(" | ")}`
    );
  });
});
