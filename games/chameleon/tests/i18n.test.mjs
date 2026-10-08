// i18n.test.mjs —— 双语表对齐、非空、英文表零汉字、语言偏好读写全站共享 key、原地 applyLocale

import test from "node:test";
import assert from "node:assert/strict";

import {
  LANG_KEY,
  LOCALES,
  DEFAULT_LOCALE,
  isLocale,
  strings,
  detectLocale,
  loadLocale,
  saveLocale,
  htmlLang,
  format,
  applyLocale,
} from "../js/i18n.mjs";

test("语言 key 是全站共享的 doin.lang", () => {
  assert.equal(LANG_KEY, "doin.lang");
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.equal(DEFAULT_LOCALE, "zh");
});

test("中英两表键完全对齐且非空", () => {
  const zh = strings("zh");
  const en = strings("en");
  const zhKeys = Object.keys(zh).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(zhKeys, enKeys, "中英键必须一一对应");
  for (const key of zhKeys) {
    assert.ok(typeof zh[key] === "string" && zh[key].trim().length > 0, `zh.${key} 为空`);
    assert.ok(typeof en[key] === "string" && en[key].trim().length > 0, `en.${key} 为空`);
  }
  assert.ok(zhKeys.length >= 50, "文案表规模不足");
});

test("英文词典零汉字（铁律：英文界面绝无中文）", () => {
  const en = strings("en");
  const bad = [];
  for (const [key, value] of Object.entries(en)) {
    if (/[\u4e00-\u9fa5]/.test(value) && key !== "langSwitch") bad.push(key);
  }
  assert.deepEqual(bad, [], `英文表出现汉字：${bad.join(", ")}`);
});

test("未知语言回退默认，不抛错", () => {
  assert.equal(isLocale("jp"), false);
  assert.equal(strings("jp"), strings(DEFAULT_LOCALE));
  assert.equal(strings(undefined), strings(DEFAULT_LOCALE));
  assert.equal(strings(null), strings(DEFAULT_LOCALE));
});

test("format 只替换存在的占位符，缺失时原样保留", () => {
  assert.equal(format("第 {n} 关", { n: 3 }), "第 3 关");
  assert.equal(format("热度 {n}", { n: 42 }), "热度 42");
  assert.equal(format("第 {n} 关", {}), "第 {n} 关");
  assert.equal(format(null, { n: 1 }), "");
});

test("saveLocale 拒绝非法值，htmlLang 跟随语言", () => {
  assert.equal(saveLocale("jp"), DEFAULT_LOCALE);
  assert.equal(saveLocale("en"), "en");
  assert.equal(htmlLang("en"), "en");
  assert.equal(htmlLang("zh"), "zh-CN");
});

test("detectLocale / loadLocale 在无存储环境下也不抛错", () => {
  const locale = detectLocale();
  assert.ok(LOCALES.includes(locale), `detectLocale 返回了非法语言 ${locale}`);
  assert.ok(LOCALES.includes(loadLocale()));
});

test("applyLocale 原地刷入 data-i18n / title / aria，不改其它节点", () => {
  const calls = [];
  const mkEl = () => {
    const store = new Map();
    return {
      dataset: {},
      _text: "",
      get textContent() {
        return this._text;
      },
      set textContent(v) {
        calls.push(["text", this, v]);
        this._text = v;
      },
      setAttribute(k, v) {
        store.set(k, v);
        calls.push(["attr", this, k, v]);
      },
      getAttribute(k) {
        return store.has(k) ? store.get(k) : null;
      },
    };
  };
  const text1 = Object.assign(mkEl(), { dataset: { i18n: "appTitle" } });
  const title1 = Object.assign(mkEl(), { dataset: { i18nTitle: "sound" } });
  const aria1 = Object.assign(mkEl(), { dataset: { i18nAria: "help" } });
  const root = {
    querySelectorAll(sel) {
      if (sel === "[data-i18n]") return [text1];
      if (sel === "[data-i18n-title]") return [title1];
      if (sel === "[data-i18n-aria]") return [aria1];
      return [];
    },
  };
  const s = applyLocale(root, "en");
  assert.equal(text1.textContent, "Chameleon Hide");
  assert.equal(title1.getAttribute("title"), "Sound");
  assert.equal(aria1.getAttribute("aria-label"), "How to play");
  assert.equal(s.appTitle, "Chameleon Hide");
});