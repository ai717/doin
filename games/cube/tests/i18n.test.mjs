import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_LOCALE,
  LANG_KEY,
  LOCALES,
  format,
  htmlLang,
  isLocale,
  loadLocale,
  saveLocale,
  strings,
} from "../js/i18n.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWED_EN_HAN = new Set(["langLabel", "langShort"]);

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

test("both locales expose the same non-empty keys", () => {
  const zh = strings("zh");
  const en = strings("en");
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
  for (const key of Object.keys(zh)) {
    assert.ok(String(zh[key]).trim().length > 0, `zh.${key} empty`);
    assert.ok(String(en[key]).trim().length > 0, `en.${key} empty`);
  }
  assert.deepEqual([...LOCALES], ["zh", "en"]);
  assert.equal(DEFAULT_LOCALE, "zh");
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
  assert.equal(isLocale("fr"), false);
});

test("English strings never contain Han characters", () => {
  const en = strings("en");
  for (const [key, value] of Object.entries(en)) {
    if (ALLOWED_EN_HAN.has(key)) continue;
    assert.equal(/[\u4e00-\u9fa5]/.test(value), false, `en.${key} contains Han: ${value.slice(0, 40)}`);
  }
});

test("format replaces indexed placeholders", () => {
  assert.equal(format("Stage {0} · {1}", 3, "ok"), "Stage 3 · ok");
  assert.equal(format("{0} {0}", "x"), "x x");
  assert.equal(format("{0} {1}", "only"), "only {1}");
});

test("locale preference uses the shared doin.lang key", () => {
  const storage = fakeStorage({ [LANG_KEY]: "en" });
  globalThis.localStorage = storage;
  assert.equal(LANG_KEY, "doin.lang");
  assert.equal(loadLocale(), "en");
  assert.equal(saveLocale("zh"), true);
  assert.equal(storage.getItem(LANG_KEY), "zh");
  assert.equal(saveLocale("xx"), false);
});

test("runtime sources keep Chinese inside i18n.mjs only", () => {
  const files = readdirSync(resolve(root, "js")).filter((name) => name.endsWith(".mjs") && name !== "i18n.mjs");
  for (const name of files) {
    const source = readFileSync(resolve(root, "js", name), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      .replace(/(["'`])中文\1/g, '""');
    const matches = source.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
    assert.equal(matches, null, `${name} hardcodes Chinese: ${matches?.slice(0, 2).join(", ")}`);
  }
});

test("index.html declares keys that exist in both dictionaries", () => {
  const html = readFileSync(resolve(root, "index.html"), "utf8");
  const keys = new Set();
  for (const match of html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)) keys.add(match[1]);
  assert.ok(keys.size > 20);
  for (const key of keys) {
    assert.ok(strings("zh")[key] !== undefined, `missing zh.${key}`);
    assert.ok(strings("en")[key] !== undefined, `missing en.${key}`);
  }
});
