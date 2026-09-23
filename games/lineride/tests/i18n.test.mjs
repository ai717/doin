// tests/i18n.test.mjs — i18n 模块测试
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isLocale, strings, format, detectLocale, loadLocale, saveLocale,
  htmlLang, LOCALES, LANG_KEY, DEFAULT_LOCALE,
} from "../js/i18n.mjs";

describe("locale validation", () => {
  it("isLocale accepts zh and en", () => {
    assert.equal(isLocale("zh"), true);
    assert.equal(isLocale("en"), true);
  });

  it("isLocale rejects invalid", () => {
    assert.equal(isLocale("fr"), false);
    assert.equal(isLocale(""), false);
    assert.equal(isLocale(null), false);
  });
});

describe("strings and format", () => {
  it("strings returns object for valid locale", () => {
    const zh = strings("zh");
    assert.equal(typeof zh, "object");
    assert.ok(zh.title.length > 0);
  });

  it("strings falls back to default for invalid locale", () => {
    const invalid = strings("xx");
    assert.equal(invalid.title, strings(DEFAULT_LOCALE).title);
  });

  it("format substitutes placeholders", () => {
    assert.equal(format("第 {0} 关", 3), "第 3 关");
    assert.equal(format("{0} x {1}", "A", 5), "A x 5");
  });

  it("format returns original for missing args", () => {
    assert.equal(format("第 {0} 关"), "第 {0} 关");
  });

  it("zh and en keys are aligned", () => {
    const zh = strings("zh");
    const en = strings("en");
    const zhKeys = Object.keys(zh).sort();
    const enKeys = Object.keys(en).sort();
    assert.deepEqual(zhKeys, enKeys);
  });

  it("all string values are non-empty", () => {
    for (const loc of LOCALES) {
      const s = strings(loc);
      for (const [key, val] of Object.entries(s)) {
        assert.ok(String(val).length > 0, `${loc}.${key} should not be empty`);
      }
    }
  });
});

describe("htmlLang", () => {
  it("returns zh-CN for zh locale", () => {
    assert.equal(htmlLang("zh"), "zh-CN");
  });

  it("returns en for en locale", () => {
    assert.equal(htmlLang("en"), "en");
  });
});

describe("detectLocale", () => {
  it("returns a valid locale", () => {
    const loc = detectLocale();
    assert.ok(isLocale(loc));
  });
});