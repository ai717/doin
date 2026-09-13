import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// 注入可控 window.localStorage，模拟浏览器环境（node 默认缺失）
const langMem = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (langMem.has(k) ? langMem.get(k) : null),
    setItem: (k, v) => langMem.set(k, String(v)),
    removeItem: (k) => langMem.delete(k),
  },
};

import {
  LOCALES,
  LANG_KEY,
  DEFAULT_LOCALE,
  strings,
  isLocale,
  detectLocale,
  loadLocale,
  saveLocale,
  htmlLang,
  format,
} from "../js/i18n.mjs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("中英键完全对齐且无空值/undefined", () => {
  const zh = strings.zh;
  const en = strings.en;
  const zhKeys = Object.keys(zh).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(zhKeys, enKeys, "中英文键必须一一对应");
  for (const k of zhKeys) {
    if (Array.isArray(zh[k])) {
      assert.ok(zh[k].length > 0, `zh.${k} 不得为空`);
      assert.ok(zh[k].every((value) => typeof value === "string" && value.trim() !== ""), `zh.${k} 数组成员不得为空`);
      assert.ok(Array.isArray(en[k]), `en.${k} 必须与中文数组类型一致`);
      assert.equal(en[k].length, zh[k].length, `中英文 ${k} 数组长度必须一致`);
      assert.ok(en[k].every((value) => typeof value === "string" && value.trim() !== ""), `en.${k} 数组成员不得为空`);
    } else {
      assert.ok(typeof zh[k] === "string" && zh[k].trim() !== "", `zh.${k} 不得为空`);
      assert.ok(typeof en[k] === "string" && en[k].trim() !== "", `en.${k} 不得为空`);
    }
  }
});

test("HTML data-i18n 键全部存在，玩法说明不回退硬编码", () => {
  const keys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length > 10);
  for (const key of keys) {
    assert.notEqual(strings.zh[key], undefined, `缺少 zh.${key}`);
    assert.notEqual(strings.en[key], undefined, `缺少 en.${key}`);
  }
  assert.doesNotMatch(html, /data-i18n="howToPlay[1-4]"/);
});

test("语言常量与判断", () => {
  assert.equal(LANG_KEY, "doin.lang");
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.ok(isLocale("zh"));
  assert.ok(isLocale("en"));
  assert.ok(!isLocale("fr"));
  assert.ok(!isLocale(undefined));
  assert.ok(!isLocale(null));
});

test("非法语言回退默认", () => {
  assert.equal(htmlLang("fr"), DEFAULT_LOCALE);
  assert.equal(htmlLang("zh"), "zh");
  assert.equal(htmlLang(undefined), DEFAULT_LOCALE);
});

test("format 变量替换", () => {
  assert.equal(format("第 {level} / {total} 关", { level: 3, total: 50 }), "第 3 / 50 关");
  assert.equal(format("无参数", null), "无参数");
  assert.equal(format("{a}-{b}", { a: 1 }), "1-{b}");
});

test("saveLocale 只接受合法语言", () => {
  saveLocale("en");
  assert.equal(loadLocale(), "en");
  saveLocale("de"); // 非法：不写入
  assert.equal(loadLocale(), "en");
});

test("detectLocale：无存档时回退导航语言/默认", () => {
  langMem.clear();
  assert.ok(["zh", "en"].includes(detectLocale()));
  assert.equal(loadLocale(), detectLocale());
});
