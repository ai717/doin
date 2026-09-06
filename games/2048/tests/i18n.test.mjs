import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  DEFAULT_LOCALE,
  LANG_KEY,
  LOCALES,
  detectLocale,
  format,
  htmlLang,
  isLocale,
  loadLocale,
  saveLocale,
  strings,
} from "../js/i18n.mjs";

const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function installNavigator(value) {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value });
}

function installStorage(initial = new Map()) {
  const store = new Map(initial);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    },
  });
  return store;
}

afterEach(() => {
  if (original) Object.defineProperty(globalThis, "navigator", original);
  else delete globalThis.navigator;
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete globalThis.localStorage;
});

describe("copy catalog", () => {
  it("exposes the same keys in every locale", () => {
    const [first, ...rest] = LOCALES;
    const expected = Object.keys(strings(first)).sort();
    assert.ok(expected.length > 20);
    for (const locale of rest) {
      assert.deepEqual(Object.keys(strings(locale)).sort(), expected);
    }
  });

  it("has no blank or padded copy", () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(strings(locale))) {
        assert.equal(typeof value, "string", `${locale}.${key} is not a string`);
        assert.equal(value.trim(), value, `${locale}.${key} has stray whitespace`);
        assert.ok(value.length > 0, `${locale}.${key} is empty`);
      }
    }
  });

  it("falls back to the default locale", () => {
    assert.equal(strings("fr"), strings(DEFAULT_LOCALE));
    assert.equal(isLocale(DEFAULT_LOCALE), true);
    assert.equal(isLocale("fr"), false);
    assert.equal(htmlLang("zh"), "zh-CN");
    assert.equal(htmlLang("en"), "en");
  });
});

describe("format helper", () => {
  it("interpolates positional parameters", () => {
    assert.equal(format("Score: {0}", 100), "Score: 100");
    assert.equal(format("{0} + {1} = {2}", 1, 2, 3), "1 + 2 = 3");
    assert.equal(format("Keep {0} and {1}", "A"), "Keep A and {1}");
  });
});

describe("locale detection", () => {
  it("picks Chinese for any zh tag", () => {
    installNavigator({ languages: ["zh-Hans-CN", "en"], language: "zh-Hans-CN" });
    assert.equal(detectLocale(), "zh");
    installNavigator({ language: "zh-TW" });
    assert.equal(detectLocale(), "zh");
  });

  it("picks English otherwise", () => {
    installNavigator({ languages: ["ja-JP", "en-US"], language: "ja-JP" });
    assert.equal(detectLocale(), "en");
    installNavigator(undefined);
    assert.equal(detectLocale(), "en");
  });
});

describe("shared preference doin.lang", () => {
  it("uses the unified constant doin.lang", () => {
    assert.equal(LANG_KEY, "doin.lang");
  });

  it("prioritizes explicit doin.lang preference over navigator", () => {
    installNavigator({ language: "en-US", languages: ["en-US"] });
    installStorage(new Map([[LANG_KEY, "zh"]]));
    assert.equal(loadLocale(), "zh");

    installNavigator({ language: "zh-CN", languages: ["zh-CN"] });
    installStorage(new Map([[LANG_KEY, "en"]]));
    assert.equal(loadLocale(), "en");
  });

  it("falls back to detection when doin.lang is invalid or missing", () => {
    installNavigator({ language: "zh-CN", languages: ["zh-CN"] });
    installStorage(new Map([[LANG_KEY, "invalid-lang"]]));
    assert.equal(loadLocale(), "zh");

    installStorage();
    assert.equal(loadLocale(), "zh");
  });

  it("writes valid locale and rejects invalid ones", () => {
    const store = installStorage();
    assert.equal(saveLocale("en"), true);
    assert.equal(store.get(LANG_KEY), "en");
    assert.equal(saveLocale("zh"), true);
    assert.equal(store.get(LANG_KEY), "zh");
    assert.equal(saveLocale("fr"), false);
    assert.equal(store.get(LANG_KEY), "zh");
  });

  it("gracefully degrades when localStorage throws", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("QuotaExceededError");
      },
    });
    installNavigator({ language: "zh-CN", languages: ["zh-CN"] });
    assert.equal(loadLocale(), "zh");
    assert.equal(saveLocale("en"), true);
  });
});

