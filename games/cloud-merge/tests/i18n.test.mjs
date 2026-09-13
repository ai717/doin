import test from "node:test";
import assert from "node:assert/strict";

import {
  LANG_KEY,
  DEFAULT_LOCALE,
  LOCALES,
  isLocale,
  strings,
  htmlLang,
  format,
} from "../js/i18n.mjs?v=dev";

test("i18n: shared key is doin.lang and locales are zh and en", () => {
  assert.equal(LANG_KEY, "doin.lang");
  assert.equal(DEFAULT_LOCALE, "zh");
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
});

test("i18n: zh and en dictionaries have 100% identical and non-empty string keys", () => {
  const zh = strings("zh");
  const en = strings("en");

  const zhKeys = Object.keys(zh).sort();
  const enKeys = Object.keys(en).sort();

  assert.deepEqual(zhKeys, enKeys, "zh 和 en 字典键必须完全一致");

  for (const k of zhKeys) {
    assert.equal(typeof zh[k], "string", `zh[${k}] 必须为字符串`);
    assert.ok(zh[k].trim().length > 0, `zh[${k}] 不得为空`);
    assert.equal(typeof en[k], "string", `en[${k}] 必须为字符串`);
    assert.ok(en[k].trim().length > 0, `en[${k}] 不得为空`);
  }
});

test("i18n: htmlLang maps locales to BCP-47 tags", () => {
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
  assert.equal(htmlLang("invalid"), "zh-CN");
});

test("i18n: format replaces placeholders safely", () => {
  assert.equal(format("Hello {name}!", { name: "Cloud" }), "Hello Cloud!");
  assert.equal(format("Score: {points}", { points: 15 }), "Score: 15");
  assert.equal(format("No placeholder", {}), "No placeholder");
  assert.equal(format(null, {}), "");
});
