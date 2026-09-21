import test from "node:test";
import assert from "node:assert/strict";

import {
  LANG_KEY, LOCALE_ZH, LOCALE_EN, LOCALES, DEFAULT_LOCALE,
  isLocale, loadLocale, saveLocale, strings, format, htmlLang,
} from "../js/i18n.mjs";

const eq = assert.strictEqual;

function installMemoryStorage() {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
  return map;
}

test("LANG_KEY = doin.lang（全站共享）", () => {
  eq(LANG_KEY, "doin.lang");
});

test("LOCALES 顺序 [zh, en]，DEFAULT_LOCALE = zh", () => {
  eq(LOCALES[0], LOCALE_ZH);
  eq(LOCALES[1], LOCALE_EN);
  eq(LOCALES.length, 2);
  eq(DEFAULT_LOCALE, LOCALE_ZH);
});

test("isLocale: 仅接受 zh / en", () => {
  eq(isLocale("zh"), true);
  eq(isLocale("en"), true);
  eq(isLocale("ja"), false);
  eq(isLocale(""), false);
  eq(isLocale(null), false);
  eq(isLocale(undefined), false);
  eq(isLocale(123), false);
});

test("loadLocale: 无存档返回默认 zh", () => {
  installMemoryStorage();
  eq(loadLocale(), LOCALE_ZH);
});

test("saveLocale + loadLocale 往返一致", () => {
  installMemoryStorage();
  saveLocale("en");
  eq(loadLocale(), "en");
  saveLocale("zh");
  eq(loadLocale(), "zh");
});

test("saveLocale: 非法值写入默认 zh", () => {
  installMemoryStorage();
  saveLocale("ja");
  eq(loadLocale(), LOCALE_ZH);
});

test("loadLocale: 损坏值返回默认不抛错", () => {
  const map = installMemoryStorage();
  map.set(LANG_KEY, "garbage");
  eq(loadLocale(), LOCALE_ZH);
});

test("strings: zh/en 双语表对齐非空", () => {
  const zh = strings("zh");
  const en = strings("en");
  assert.ok(typeof zh === "object");
  assert.ok(typeof en === "object");
  // 关键字串应同时存在
  const keys = ["title", "backHome", "newGame", "undo", "resign", "rules", "thinking", "yourTurn", "black", "white", "mode", "difficulty"];
  for (const k of keys) {
    assert.ok(zh[k] && typeof zh[k] === "string" && zh[k].length > 0, `zh.${k} 缺失或空`);
    assert.ok(en[k] && typeof en[k] === "string" && en[k].length > 0, `en.${k} 缺失或空`);
  }
});

test("strings: 非法 locale 退回 zh", () => {
  const s = strings("fr");
  eq(s.title, "五子连珠");
});

test("strings: title/subtitle 双语正确", () => {
  eq(strings("zh").title, "五子连珠");
  eq(strings("en").title, "Gomoku Master");
});

test("format: {n} 占位符替换", () => {
  eq(format("黑先 {n} 手胜", { n: 3 }), "黑先 3 手胜");
  eq(format("Move {n}: blunder", { n: 7 }), "Move 7: blunder");
});

test("format: 缺失变量退空字符串", () => {
  eq(format("黑先 {n} 手胜", {}), "黑先  手胜");
});

test("format: 无占位符原样返回", () => {
  eq(format("hello world"), "hello world");
});

test("htmlLang: 返回合法 locale 或默认", () => {
  eq(htmlLang("zh"), "zh");
  eq(htmlLang("en"), "en");
  eq(htmlLang("ja"), "zh");
  eq(htmlLang(null), "zh");
});
