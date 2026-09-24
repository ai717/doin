import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_LOCALE,
  LANG_KEY,
  LOCALES,
  format,
  htmlLang,
  isLocale,
  strings,
} from "../js/i18n.mjs";

test("uses the shared doin.lang key and the two-locale contract", () => {
  assert.equal(LANG_KEY, "doin.lang");
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.equal(DEFAULT_LOCALE, "zh");
});

test("isLocale validates membership", () => {
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(isLocale(""), false);
  assert.equal(isLocale(null), false);
  assert.equal(isLocale(42), false);
});

test("zh / en dictionaries have identical, non-empty string keys", () => {
  const zh = strings("zh");
  const en = strings("en");
  const zhKeys = Object.keys(zh).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(zhKeys, enKeys, "key sets must align across locales");
  assert.ok(zhKeys.length > 0);
  for (const k of zhKeys) {
    assert.equal(typeof zh[k], "string", `zh.${k} must be a string`);
    assert.equal(typeof en[k], "string", `en.${k} must be a string`);
    assert.ok(zh[k].trim().length > 0, `zh.${k} must be non-empty`);
    assert.ok(en[k].trim().length > 0, `en.${k} must be non-empty`);
  }
});

test("strings falls back to the default locale for unknown input", () => {
  assert.equal(strings("fr"), strings(DEFAULT_LOCALE));
  assert.equal(strings(undefined), strings(DEFAULT_LOCALE));
  assert.equal(strings(null), strings(DEFAULT_LOCALE));
});

test("htmlLang maps locales to BCP-47 tags", () => {
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
  assert.equal(htmlLang("fr"), "zh-CN"); // 非法 → 默认
});

test("format substitutes {placeholders} and is null-safe", () => {
  assert.equal(format("最高分 {n}", { n: 1280 }), "最高分 1280");
  assert.equal(format("距大西瓜还差 {n} 级", { n: 9 }), "距大西瓜还差 9 级");
  assert.equal(format("当前 {c} · 下一个 {n}", { c: 2, n: 4 }), "当前 2 · 下一个 4");
  assert.equal(format("Daily {date}", { date: "2026-09-14" }), "Daily 2026-09-14");
  // 缺失参数：保留占位符原样
  assert.equal(format("Best {n}", {}), "Best {n}");
  // 无参数 / 非字符串
  assert.equal(format("plain"), "plain");
  assert.equal(format(null, { n: 1 }), "");
  assert.equal(format(123, { n: 1 }), "");
});

test("every locale exposes the gameplay-critical keys", () => {
  const required = [
    "docTitle",
    "appTitle",
    "start",
    "pause",
    "resume",
    "restart",
    "playAgain",
    "score",
    "chain",
    "harvested",
    "best",
    "previewHint",
    "modeEndless",
    "modeDaily",
    "codexRemain",
    "toastBlocked",
    "toastNoHarvest",
    "toastCooldown",
    "toastModeLocked",
    "resultHarvested",
    "medal2048",
    "help1",
    "help5",
  ];
  for (const loc of LOCALES) {
    const dict = strings(loc);
    for (const key of required) {
      assert.ok(key in dict, `${loc} missing key ${key}`);
      assert.ok(String(dict[key]).trim().length > 0, `${loc}.${key} empty`);
    }
  }
});
