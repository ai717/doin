import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dict, t, format, normalizeLang, otherLang } from "../js/i18n.mjs";

const gameDir = new URL("..", import.meta.url);

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
    assert.equal(/[\u4e00-\u9fa5]/.test(String(value)), false, `en.${key} leaked CJK`);
  }
});

test("both tables expose the same keys", () => {
  const zhKeys = Object.keys(dict("zh")).sort();
  const enKeys = Object.keys(dict("en")).sort();
  assert.deepEqual(zhKeys, enKeys);
  assert.ok(zhKeys.length >= 50, "dictionary covers the whole shell");
});

test("format interpolates counters", () => {
  assert.equal(format("stage", "en", { n: 7 }), "Stage 7");
  assert.equal(format("stage", "zh", { n: 7 }), "第 7 关");
  assert.equal(normalizeLang("de"), "zh");
  assert.equal(otherLang("zh"), "en");
  assert.equal(otherLang("en"), "zh");
  assert.equal(t("missing_key", "en"), "missing_key");
});

test("runtime sources never hard-code Chinese", () => {
  for (const file of sourceFiles()) {
    if (file.name === "i18n.mjs") continue;
    const cleaned = file.code
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      .replace(/(["'`])中文\1/g, '""');
    const hits = cleaned.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
    assert.equal(hits, null, `${file.name} hard-codes Chinese: ${hits ? hits.join(", ") : ""}`);
  }
});

test("i18n uses the shared language preference key", () => {
  const code = readFileSync(new URL("../js/i18n.mjs", import.meta.url), "utf8");
  assert.match(code, /doin\.lang/);
  assert.equal(gameDir.href.includes("games/bomber"), true);
});
