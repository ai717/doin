import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getLang, htmlLang, setLang, strings, translate } from "../js/i18n.mjs";

const CJK = /[\u4e00-\u9fa5]/;

test("zh and en dictionaries share the same key set", () => {
  const zhKeys = Object.keys(strings.zh).sort();
  const enKeys = Object.keys(strings.en).sort();
  assert.deepEqual(enKeys, zhKeys);
  assert.ok(zhKeys.length >= 30, "dictionary should be substantial");
  for (const key of zhKeys) {
    assert.ok(String(strings.zh[key]).length > 0, `zh ${key} empty`);
    assert.ok(String(strings.en[key]).length > 0, `en ${key} empty`);
  }
});

test("english dictionary contains zero Chinese characters", () => {
  for (const [key, value] of Object.entries(strings.en)) {
    assert.ok(!CJK.test(String(value)), `en ${key} contains CJK: ${value}`);
  }
});

test("translate resolves keys and interpolates vars", () => {
  setLang("zh");
  assert.equal(translate("hudLevel", { n: 7 }), "第 7 关");
  setLang("en");
  assert.equal(translate("hudLevel", { n: 7 }), "Level 7");
  assert.equal(translate("no_such_key"), "no_such_key");
  setLang("zh");
});

test("language preference round trips through the shared store", () => {
  delete globalThis.localStorage;
  setLang("en");
  assert.equal(getLang(), "en");
  setLang("zh");
  assert.equal(getLang(), "zh");
  globalThis.localStorage = {
    _map: new Map(),
    getItem(k) {
      return this._map.has(k) ? this._map.get(k) : null;
    },
    setItem(k, v) {
      this._map.set(k, String(v));
    },
    removeItem(k) {
      this._map.delete(k);
    },
  };
  setLang("en");
  assert.equal(globalThis.localStorage.getItem("doin.lang"), "en");
  delete globalThis.localStorage;
});

test("htmlLang maps locales", () => {
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
});

test("runtime sources carry zero unwrapped Chinese", () => {
  const files = [
    "engine.mjs",
    "game.mjs",
    "levels.mjs",
    "score.mjs",
    "storage.mjs",
    "audio.mjs",
    "ui.mjs",
    "main.mjs",
  ];
  for (const name of files) {
    const src = readFileSync(new URL(`../js/${name}`, import.meta.url), "utf8");
    const cleaned = src.replace(/(["'`])中文\1/g, '""');
    assert.ok(!CJK.test(cleaned), `${name} contains hardcoded Chinese`);
  }
});
