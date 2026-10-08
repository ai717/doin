// i18n.test.mjs — 全站共享语言偏好、双语表对齐、纯净语言铁律。
import { test } from "node:test";
import assert from "node:assert/strict";
import * as i18n from "../js/i18n.mjs";

test("语言键与偏好 key 契约", () => {
  assert.equal(i18n.LANG_KEY, "doin.lang");
  assert.equal(i18n.isLocale("zh"), true);
  assert.equal(i18n.isLocale("en"), true);
  assert.equal(i18n.isLocale("fr"), false);
  assert.equal(i18n.htmlLang("zh"), "zh-CN");
  assert.equal(i18n.htmlLang("en"), "en");
});

test("双语表键完全一致且非空", () => {
  const zh = i18n.strings("zh");
  const en = i18n.strings("en");
  const zhKeys = Object.keys(zh).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(enKeys, zhKeys, "中英键集合一致");
  for (const k of zhKeys) {
    assert.ok(zh[k] !== undefined && zh[k] !== "", `zh.${k} 非空`);
    assert.ok(en[k] !== undefined && en[k] !== "", `en.${k} 非空`);
  }
});

test("format 命名占位替换", () => {
  assert.equal(i18n.format("消 {n} 行", { n: 10 }), "消 10 行");
  assert.equal(i18n.format("无占位", {}), "无占位");
  const zh = i18n.strings("zh");
  assert.ok(i18n.format(zh.lv1_desc, { n: 10 }).includes("10"));
});

test("纯语言铁律：strings.en 除 langSwitch 外绝无汉字", () => {
  const en = i18n.strings("en");
  const cjk = /[\u4e00-\u9fa5]/;
  for (const [k, v] of Object.entries(en)) {
    if (k === "langSwitch") continue;
    assert.ok(!cjk.test(v), `en.${k} 含汉字：${v}`);
  }
});

test("saveLocale 落共享偏好，loadLocale 取回", () => {
  globalThis.localStorage = {
    _map: new Map(),
    setItem(k, v) { this._map.set(k, String(v)); },
    getItem(k) { return this._map.get(k) ?? null; },
    removeItem(k) { this._map.delete(k); },
  };
  try {
    i18n.saveLocale("en");
    assert.equal(i18n.loadLocale(), "en");
    assert.equal(globalThis.localStorage.getItem(i18n.LANG_KEY), "en");
    i18n.saveLocale("zh");
    assert.equal(i18n.loadLocale(), "zh");
  } finally {
    delete globalThis.localStorage;
  }
});

test("核心玩法键存在", () => {
  const zh = i18n.strings("zh");
  const required = ["appTitle", "modeCampaign", "modeSurvival", "modeDuel", "hudScore", "hudMult", "hudRush", "help1", "help8"];
  for (const k of required) assert.ok(zh[k], `zh.${k} 存在`);
});
