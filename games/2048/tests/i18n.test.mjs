import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  DEFAULT_LOCALE,
  LOCALES,
  detectLocale,
  htmlLang,
  isLocale,
  strings,
} from "../js/i18n.mjs";

const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");

function installNavigator(value) {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value });
}

afterEach(() => {
  if (original) Object.defineProperty(globalThis, "navigator", original);
  else delete globalThis.navigator;
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
