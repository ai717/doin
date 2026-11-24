import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { strings, translate, setLocale } from "../js/i18n.mjs";

describe("i18n.mjs bilingual purity and coverage", () => {
  it("zh and en dictionaries have identical keys", () => {
    const zhKeys = Object.keys(strings.zh).sort();
    const enKeys = Object.keys(strings.en).sort();
    assert.deepEqual(zhKeys, enKeys);
  });

  it("strings.en contains zero CJK characters (except whitelisted langToggle)", () => {
    const cjkRegex = /[\u4e00-\u9fa5]/;
    for (const [key, value] of Object.entries(strings.en)) {
      if (key === "langToggle") continue; // Whitelisted toggle button indicator
      assert.ok(
        !cjkRegex.test(value),
        `strings.en[${key}] contains Chinese characters: "${value}"`
      );
    }
  });

  it("translate interpolates params and falls back to zh", () => {
    setLocale("zh");
    assert.equal(translate("table_label", { n: 3 }), "第 3 号桌");
    assert.equal(translate("non_existent_key"), "non_existent_key");

    setLocale("en");
    assert.equal(translate("table_label", { n: 3 }), "Table 3");
  });

  it("runtime JS files contain zero bare Chinese strings outside i18n", () => {
    const jsDir = resolve(import.meta.dirname, "../js");
    const files = readdirSync(jsDir).filter((name) => name.endsWith(".mjs"));

    const cjkRegex = /(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g;

    for (const file of files) {
      if (file === "i18n.mjs") continue;
      const content = readFileSync(resolve(jsDir, file), "utf8");
      // Strip comments
      const clean = content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      const matches = clean.match(cjkRegex);
      assert.ok(
        !matches || matches.length === 0,
        `File ${file} has hardcoded Chinese string literals: ${matches ? matches.join(", ") : ""}`
      );
    }
  });

  it("index.html static Chinese tags declare data-i18n", () => {
    const htmlPath = resolve(import.meta.dirname, "../index.html");
    const html = readFileSync(htmlPath, "utf8");
    const cleanHtml = html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

    const tagMatches = [...cleanHtml.matchAll(/<([a-zA-Z0-9\-]+)([^>]*)>([^<]*[\u4e00-\u9fa5]+[^<]*)<\/\1>/g)];
    const missing = [];

    for (const m of tagMatches) {
      const tag = m[1].toLowerCase();
      if (tag === "title" || tag === "script") continue;
      const attrs = m[2];
      const text = m[3].trim();
      if (!attrs.includes("data-i18n")) {
        missing.push(`<${tag}>: "${text}"`);
      }
    }

    assert.equal(
      missing.length,
      0,
      `index.html tags missing data-i18n: ${missing.join("; ")}`
    );
  });
});
