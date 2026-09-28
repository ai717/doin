import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dict, t, format, normalizeLang, otherLang, langLabel } from "../js/i18n.mjs";

function sourceFiles() {
  const dir = new URL("../js/", import.meta.url);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".mjs"))
    .map((name) => ({ name, code: readFileSync(new URL(name, dir), "utf8") }));
}

test("english table carries no CJK beyond the switch label", () => {
  const en = dict("en");
  for (const [key, value] of Object.entries(en)) {
    if (key === "langName") continue; // the 中文 / EN switch label is whitelisted
    assert.equal(/[一-龥]/.test(String(value)), false, `en.${key} leaked CJK`);
  }
});

test("both tables expose the same keys", () => {
  const zhKeys = Object.keys(dict("zh")).sort();
  const enKeys = Object.keys(dict("en")).sort();
  assert.deepEqual(zhKeys, enKeys);
  assert.ok(zhKeys.length >= 60, `dictionary covers the whole shell (${zhKeys.length})`);
});

test("format interpolates counters", () => {
  assert.equal(format("stage", "en", { n: 7 }), "Stage 7");
  assert.equal(format("stage", "zh", { n: 7 }), "第 7 关");
  assert.equal(format("tapeKill", "en", { type: "Scout", score: 120 }), "Scout destroyed +120");
  assert.equal(normalizeLang("de"), "zh");
  assert.equal(otherLang("zh"), "en");
  assert.equal(otherLang("en"), "zh");
  assert.equal(langLabel("zh"), "EN");
  assert.equal(t("missing_key", "en"), "missing_key");
});

test("every enemy / powerup / order / chapter has a label", () => {
  const zh = dict("zh");
  const en = dict("en");
  for (const type of ["scout", "standard", "rapid", "armor", "sapper", "sniper"]) {
    assert.ok(zh[`e_${type}`] && en[`e_${type}`], `e_${type}`);
  }
  for (const kind of ["star", "helmet", "grenade", "shovel", "extra_life", "clock"]) {
    assert.ok(zh[`p_${kind}`] && en[`p_${kind}`], `p_${kind}`);
  }
  for (const order of ["artillery", "fortify", "jam"]) {
    assert.ok(zh[`o_${order}`] && en[`o_${order}`], `o_${order}`);
  }
  for (let ch = 1; ch <= 6; ch += 1) {
    assert.ok(zh[`chapter_${ch}`] && en[`chapter_${ch}`], `chapter_${ch}`);
  }
});

test("runtime sources never hard-code Chinese", () => {
  for (const file of sourceFiles()) {
    if (file.name === "i18n.mjs") continue;
    const cleaned = file.code
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      .replace(/(["'`])中文\1/g, '""');
    const hits = cleaned.match(/(["'`])[^"'`\r\n]*[一-龥]+[^"'`\r\n]*\1/g);
    assert.equal(hits, null, `${file.name} hard-codes Chinese: ${hits ? hits.join(", ") : ""}`);
  }
});

test("html static Chinese is always claimed by data-i18n", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const body = /<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "";
  const TRANSLATABLE = ["title", "aria-label", "placeholder", "alt"];
  const hits = [];
  for (const line of body.split(/\r?\n/)) {
    const tag = /<(\w+)([^>]*)>([^<]*)</.exec(line);
    if (tag && /[一-龥]/.test(tag[3] ?? "") && !/data-i18n/.test(tag[2] ?? "")) {
      hits.push(`text ${(tag[3] ?? "").trim()}`);
    }
    // an attribute written in Chinese must be listed in data-i18n-attr, or it stays
    // Chinese forever while the rest of the page reads English
    const attrs = tag?.[2] ?? "";
    const claimed = /data-i18n-attr="([^"]*)"/.exec(attrs)?.[1] ?? "";
    for (const attr of TRANSLATABLE) {
      const m = new RegExp(`${attr}="([^"]*)"`).exec(attrs);
      if (m && /[一-龥]/.test(m[1]) && !claimed.split(/[,:]/).includes(attr)) {
        hits.push(`${attr}="${m[1]}"`);
      }
    }
  }
  assert.deepEqual(hits, [], `HTML leaks untranslated Chinese: ${hits.join(" | ")}`);
});

test("the document title follows the language", () => {
  const zh = dict("zh");
  const en = dict("en");
  assert.ok(zh.docTitle && en.docTitle, "docTitle");
  assert.equal(/[一-龥]/.test(en.docTitle), false);
  const ui = readFileSync(new URL("../js/ui.mjs", import.meta.url), "utf8");
  assert.match(ui, /document\.title\s*=\s*this\.tr\("docTitle"\)/);
});

test("i18n uses the shared language preference key", () => {
  const code = readFileSync(new URL("../js/i18n.mjs", import.meta.url), "utf8");
  assert.match(code, /doin\.lang/);
});
