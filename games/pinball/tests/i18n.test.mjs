// 霓虹弹珠台 · 国际化单元测试
// 覆盖：全站共享语言键 doin.lang / 中英双语表严格对齐非空 / 占位格式化 / 语言探测与持久化
import test from "node:test";
import assert from "node:assert/strict";
import {
  LANG_KEY, DEFAULT_LOCALE, LOCALES, isLocale, strings, format, saveLocale, loadLocale
} from "../js/i18n.mjs";

// 注入受控内存 localStorage（Node 无该全局）
globalThis.localStorage = (() => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
})();

test("语言键为全站共享 doin.lang，默认 zh", () => {
  assert.equal(LANG_KEY, "doin.lang");
  assert.equal(DEFAULT_LOCALE, "zh");
});

test("中英双语表键集合严格一致", () => {
  const zh = Object.keys(LOCALES.zh);
  const en = Object.keys(LOCALES.en);
  assert.deepEqual([...zh].sort(), [...en].sort(), "中英键集合必须完全对齐");
});

test("双语表所有值非空（无遗漏翻译）", () => {
  for (const locale of ["zh", "en"]) {
    for (const [key, value] of Object.entries(LOCALES[locale])) {
      assert.ok(typeof value === "string" && value.trim().length > 0, `${locale}.${key} 为空`);
    }
  }
});

test("isLocale 只认 zh / en", () => {
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(isLocale(null), false);
  assert.equal(isLocale(undefined), false);
});

test("strings 对非法 locale 回退默认", () => {
  assert.equal(strings("zh"), LOCALES.zh);
  assert.equal(strings("en"), LOCALES.en);
  assert.equal(strings("de"), LOCALES.zh, "非法 locale 应回退 zh");
});

test("占位格式化 {n}/{t}/{s}/{c}/{b}/{m} 正确替换", () => {
  assert.equal(format("zh", "level", { n: 7 }), "第 7 关");
  assert.equal(format("en", "goalTime", { t: 120 }), "Time goal 120s");
  assert.equal(format("zh", "mult", { m: 5 }), "×5");
  assert.equal(format("zh", "clearLine1", { t: 33, c: 12 }), "用时 33 秒 · 最高连击 12");
});

test("缺失键回退为键名本身（不抛错）", () => {
  assert.equal(format("zh", "noSuchKey"), "noSuchKey");
});

test("saveLocale/loadLocale 读写全站共享键", () => {
  localStorage.removeItem(LANG_KEY);
  saveLocale("en");
  assert.equal(loadLocale(), "en");
  assert.equal(localStorage.getItem(LANG_KEY), "en");
  saveLocale("fr"); // 非法值忽略
  assert.equal(loadLocale(), "en");
});

test("语言持久化与恢复", () => {
  saveLocale("zh");
  assert.equal(loadLocale(), "zh");
  assert.equal(strings(loadLocale()).title, "霓虹弹珠台");
  saveLocale("en");
  assert.equal(strings(loadLocale()).title, "Neon Pinball");
});
