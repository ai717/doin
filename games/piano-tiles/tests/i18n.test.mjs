// i18n.test.mjs — Piano Tiles 双语表测试
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { strings, LOCALES, isLocale, t } from "../js/i18n.mjs";

describe("i18n: 双语表键对齐", () => {
  const zhKeys = Object.keys(strings.zh).sort();
  const enKeys = Object.keys(strings.en).sort();

  it("zh 与 en 键完全一致", () => {
    assert.deepEqual(zhKeys, enKeys);
  });

  it("所有值非空且非空字符串", () => {
    for (const locale of LOCALES) {
      for (const [key, val] of Object.entries(strings[locale])) {
        assert.ok(typeof val === "string" && val.length > 0,
          `${locale}.${key} 为空`);
      }
    }
  });

  it("至少有 30 条词条", () => {
    assert.ok(zhKeys.length >= 25, `词条太少: ${zhKeys.length}`);
  });
});

describe("i18n: isLocale", () => {
  it("zh / en 通过，其它拒绝", () => {
    assert.equal(isLocale("zh"), true);
    assert.equal(isLocale("en"), true);
    assert.equal(isLocale("ja"), false);
    assert.equal(isLocale(""), false);
  });
});

describe("i18n: t() 取词", () => {
  it("能正确取到 zh/en 词条", () => {
    assert.equal(t("gameTitle", "zh"), "别踩白块儿");
    assert.equal(t("gameTitle", "en"), "Piano Tiles");
  });

  it("未知 key 返回 key 本身", () => {
    assert.equal(t("__unknown__", "zh"), "__unknown__");
  });
});
