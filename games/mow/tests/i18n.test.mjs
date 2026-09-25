// i18n.test.mjs — 全站共享语言偏好与双语表严格对齐。
import { test } from "node:test";
import assert from "node:assert/strict";
import * as i18n from "../js/i18n.mjs";

test("语言键与偏好 key 契约", () => {
  assert.equal(i18n.LANG_KEY, "doin.lang", "共享偏好 key");
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
  const zh = i18n.strings("zh");
  const out = i18n.format("击杀 {n} 只！", { n: 3 });
  assert.equal(out, "击杀 3 只！");
  assert.equal(i18n.format("无占位", {}), "无占位");
  const ev = i18n.format(zh.toastEvolve, { name: "黄金割草盘" });
  assert.ok(ev.includes("黄金割草盘"), "进化 toast 可替换");
});

test("纯语言铁律：strings.en 除 langSwitch 外绝无汉字", () => {
  const en = i18n.strings("en");
  const cjk = /[\u4e00-\u9fa5]/;
  for (const [k, v] of Object.entries(en)) {
    if (k === "langSwitch") continue; // 语言切换钮显示目标语言，全站惯例
    assert.ok(!cjk.test(v), `en.${k} 含汉字：${v}`);
  }
});

test("纯语言铁律：strings.zh 除品牌/键位/占位外无拉丁字母", () => {
  const zh = i18n.strings("zh");
  const allow = new Set([
    "langSwitch", // 切换钮显示目标语言 EN
    "docTitle", // DOIN 平台名
    "metaDesc", // Mow! 品牌名
    "keyHint", // WASD / Shift / P 键位
    "panelStartKicker", // MOW! 品牌 kicker
    "bossBadge", // BOSS 通用游戏术语
    "modeStandardDesc", // Boss 通用游戏术语
    "noscript", // JavaScript 专名
  ]);
  const latin = /[A-Za-z]/;
  for (const [k, v] of Object.entries(zh)) {
    if (allow.has(k)) continue;
    const cleaned = v.replace(/\{[a-zA-Z]+\}/g, ""); // 占位符 {base}/{n} 非显示文案
    assert.ok(!latin.test(cleaned), `zh.${k} 含拉丁字母：${v}`);
  }
});

test("saveLocale 落共享偏好，loadLocale 取回", () => {
  // node 无 localStorage：注入 shim 验证持久化路径
  globalThis.localStorage = {
    _map: new Map(),
    setItem(k, v) {
      this._map.set(k, String(v));
    },
    getItem(k) {
      return this._map.get(k) ?? null;
    },
    removeItem(k) {
      this._map.delete(k);
    },
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
