// i18n 测试：全站统一 key、中英键完全对齐且非空、format 占位符。
import { test } from "node:test";
import assert from "node:assert/strict";
import { strings, format, LANG_KEY, LOCALES, DEFAULT_LOCALE, isLocale, loadLocale, saveLocale } from "../js/i18n.mjs";

test("语言偏好 key 为全站统一 doin.lang", () => {
  assert.equal(LANG_KEY, "doin.lang");
});

test("中英双表键完全对齐且非空", () => {
  const zh = strings("zh");
  const en = strings("en");
  const zhKeys = Object.keys(zh);
  const enKeys = Object.keys(en);
  assert.deepEqual([...zhKeys].sort(), [...enKeys].sort());
  for (const key of zhKeys) {
    assert.ok(String(zh[key]).length > 0, `zh.${key} 为空`);
    assert.ok(String(en[key]).length > 0, `en.${key} 为空`);
  }
});

test("isLocale / loadLocale 行为", () => {
  assert.ok(isLocale("zh") && isLocale("en"));
  assert.equal(isLocale("fr"), false);
  // node 无 localStorage → 回默认
  assert.equal(loadLocale(), DEFAULT_LOCALE);
  // saveLocale 不应抛错
  saveLocale("en");
});

test("format 替换占位符", () => {
  assert.equal(format("第 {n} 回合 / 共 5 回合", { n: 3 }), "第 3 回合 / 共 5 回合");
  assert.equal(format("Round {n} / 5", { n: 2 }), "Round 2 / 5");
  assert.equal(format("no vars", {}), "no vars");
});

test("关键文案覆盖（回合/行情/截胡/评级/徽章）", () => {
  const zh = strings("zh");
  for (const key of ["roundOf", "marketTitle", "snipeLabel", "ratingS", "badgeSnip", "rulesText", "challenge12", "charHoarderDesc"]) {
    assert.ok(zh[key], `缺键 ${key}`);
  }
});
