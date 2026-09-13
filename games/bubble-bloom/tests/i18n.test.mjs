import assert from "node:assert/strict";
import test from "node:test";

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
  t
} from "../js/i18n.mjs";

function fakeStorage() {
  const map = new Map();
  return {
    map,
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    }
  };
}

function withStorage(fn) {
  const original = globalThis.localStorage;
  const store = fakeStorage();
  let configurable = true;
  try {
    Object.defineProperty(globalThis, "localStorage", { value: store, configurable: true, writable: true });
  } catch (error) {
    configurable = false;
  }
  try {
    fn(store);
  } finally {
    if (configurable) {
      try {
        Object.defineProperty(globalThis, "localStorage", {
          value: original,
          configurable: true,
          writable: true
        });
      } catch (error) {
        /* 环境不允许恢复时忽略 */
      }
    }
  }
}

test("共享语言 Key 与常量", () => {
  assert.equal(LANG_KEY, "doin.lang");
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.equal(DEFAULT_LOCALE, "en");
});

test("中英文键完全对齐", () => {
  const zh = Object.keys(strings.zh).sort();
  const en = Object.keys(strings.en).sort();
  assert.deepEqual(zh, en);
  assert.ok(zh.length > 40);
});

test("没有空值或 undefined", () => {
  for (const locale of LOCALES) {
    for (const [key, value] of Object.entries(strings[locale])) {
      assert.equal(typeof value, "string", `${locale}.${key} 不是字符串`);
      assert.ok(value.trim().length > 0, `${locale}.${key} 是空字符串`);
      assert.notEqual(value, "undefined");
    }
  }
});

test("十阶泡名与三档称号齐全", () => {
  for (const locale of LOCALES) {
    for (let i = 1; i <= 10; i += 1) {
      assert.ok(strings[locale][`tier.${i}`], `${locale} 缺少 tier.${i}`);
    }
    for (let i = 1; i <= 3; i += 1) {
      assert.ok(strings[locale][`rank.${i}`], `${locale} 缺少 rank.${i}`);
    }
  }
});

test("format 变量替换与缺失变量保底", () => {
  assert.equal(format("每日种子 {date}", { date: "2026-09-13" }), "每日种子 2026-09-13");
  assert.equal(format("剩余 {left} 次 · {s} 秒", { left: 1, s: 3 }), "剩余 1 次 · 3 秒");
  assert.equal(format("无变量", null), "无变量");
  assert.equal(format("{missing}", {}), "{missing}");
});

test("isLocale 与非法语言回退", () => {
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(isLocale("zh-CN"), false);
  assert.equal(isLocale(null), false);
  assert.equal(isLocale(3), false);
  assert.equal(t("fr", "app.nameZh"), "Bubble Bloom", "非法语言回退到英文表");
  assert.equal(t("zh", "不存在的键"), "不存在的键");
});

test("htmlLang 映射", () => {
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
  assert.equal(htmlLang("xx"), "en");
});

test("t() 读取中文与英文", () => {
  assert.equal(t("zh", "tool.pulse"), "潮汐脉冲");
  assert.equal(t("en", "tool.pulse"), "Tide Pulse");
  assert.equal(t("zh", "chain.pop", { n: 4 }), "压力连锁 ×4");
});

test("存档读写与语言探测优先级", () => {
  withStorage((store) => {
    assert.equal(loadLocale(), null);
    saveLocale("zh");
    assert.equal(store.map.get("doin.lang"), "zh");
    assert.equal(loadLocale(), "zh");
    assert.equal(detectLocale(), "zh");

    saveLocale("en");
    assert.equal(loadLocale(), "en");
    assert.equal(detectLocale(), "en");

    // 非法语言不写入，也不覆盖已有的合法值
    saveLocale("bogus");
    assert.equal(loadLocale(), "en");
    assert.equal(detectLocale(), "en");

    store.removeItem("doin.lang");
    assert.equal(loadLocale(), null);
    assert.ok(LOCALES.includes(detectLocale()));
  });
});

test("存储不可用时语言探测不抛错", () => {
  const original = globalThis.localStorage;
  try {
    Object.defineProperty(globalThis, "localStorage", {
      get() {
        throw new Error("blocked");
      },
      configurable: true
    });
  } catch (error) {
    /* 环境不允许覆写时跳过 */
  }
  assert.doesNotThrow(() => {
    const locale = detectLocale();
    assert.ok(LOCALES.includes(locale));
  });
  try {
    Object.defineProperty(globalThis, "localStorage", { value: original, configurable: true, writable: true });
  } catch (error) {
    /* 忽略 */
  }
});
