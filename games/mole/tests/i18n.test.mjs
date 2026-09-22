// i18n.test.mjs — 中英双表对齐与共享语言偏好
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  LOCALES, LANG_KEY, DEFAULT_LOCALE, strings, isLocale,
  format, htmlLang, t,
} from "../js/i18n.mjs";

describe("i18n: 基本契约", () => {
  it("语言 key 是全站共享的 doin.lang", () => {
    assert.equal(LANG_KEY, "doin.lang");
  });

  it("LOCALES 与默认语言合法", () => {
    assert.deepEqual([...LOCALES], ["zh", "en"]);
    assert.ok(LOCALES.includes(DEFAULT_LOCALE));
    assert.equal(isLocale("zh"), true);
    assert.equal(isLocale("jp"), false);
  });

  it("htmlLang 映射正确", () => {
    assert.equal(htmlLang("zh"), "zh-CN");
    assert.equal(htmlLang("en"), "en");
  });
});

describe("i18n: 中英键对齐且非空", () => {
  const zhKeys = Object.keys(strings.zh);
  const enKeys = Object.keys(strings.en);

  it("键集合完全一致", () => {
    assert.deepEqual(zhKeys.sort(), enKeys.sort());
  });

  it("所有值非空字符串", () => {
    for (const key of zhKeys) {
      assert.equal(typeof strings.zh[key], "string", `zh.${key} 非字符串`);
      assert.ok(strings.zh[key].trim().length > 0, `zh.${key} 为空`);
      assert.equal(typeof strings.en[key], "string", `en.${key} 非字符串`);
      assert.ok(strings.en[key].trim().length > 0, `en.${key} 为空`);
    }
  });

  it("未翻译回退不崩", () => {
    assert.equal(t("gameTitle", "zh"), "莓园打地鼠");
    assert.equal(t("gameTitle", "en"), "Berry Bash");
    assert.equal(typeof t("__missing__", "en"), "string");
  });
});

describe("i18n: format 占位符", () => {
  it("替换已知占位符", () => {
    assert.equal(format("得分 {score}", { score: 12 }), "得分 12");
  });

  it("缺失占位符保持原样且不抛错", () => {
    assert.equal(format("得分 {score}"), "得分 {score}");
    assert.equal(format(null), "");
  });
});
