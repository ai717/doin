// i18n.test.mjs — 双表键对齐 / 英文表零汉字 / 怪物与区域名全覆盖
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LANG_KEY, LOCALES, htmlLang, monsterName, normalizeLocale, strings, translate, zoneName } from "../js/i18n.mjs";
import { MONSTERS } from "../js/data.mjs";

const HAN = /[\u4e00-\u9fa5]/;
const kindOf = (value) => (value && typeof value === "object" ? "object" : "text");

describe("i18n: 表结构", () => {
  it("中英双表都存在且顶层键一一对应", () => {
    assert.deepEqual(LOCALES, ["zh", "en"]);
    const zhKeys = Object.keys(strings.zh).sort();
    const enKeys = Object.keys(strings.en).sort();
    assert.deepEqual(enKeys, zhKeys);
  });

  it("同类型键的取值类型一致，且非空", () => {
    for (const key of Object.keys(strings.zh)) {
      assert.equal(kindOf(strings.en[key]), kindOf(strings.zh[key]), `键 ${key} 类型不一致`);
      if (typeof strings.zh[key] === "string") {
        assert.ok(strings.zh[key].trim().length > 0, `zh.${key} 为空`);
        assert.ok(strings.en[key].trim().length > 0, `en.${key} 为空`);
      }
    }
  });

  it("英文表除语言切换按钮外零汉字", () => {
    for (const [key, value] of Object.entries(strings.en)) {
      if (typeof value !== "string") continue;
      if (/langBtn/i.test(key)) continue;
      assert.ok(!HAN.test(value), `en.${key} 含中文：${value}`);
    }
  });

  it("怪物名与区域名两表齐全", () => {
    for (const id of Object.keys(MONSTERS)) {
      assert.ok(strings.zh.mon[id], `zh 缺怪物名 ${id}`);
      assert.ok(strings.en.mon[id], `en 缺怪物名 ${id}`);
      assert.ok(!HAN.test(strings.en.mon[id]), `en 怪物名含中文 ${id}`);
    }
    assert.deepEqual(Object.keys(strings.en.mon).sort(), Object.keys(strings.zh.mon).sort());
    assert.deepEqual(Object.keys(strings.en.zone).sort(), Object.keys(strings.zh.zone).sort());
  });
});

describe("i18n: 取值", () => {
  it("translate 支持占位符替换与回退", () => {
    assert.equal(translate("zh", "stairsUp", { n: 7 }), "登上 7 层");
    assert.equal(translate("en", "stairsUp", { n: 7 }), "Ascend to floor 7");
    assert.equal(translate("zh", "不存在的键"), "不存在的键");
    assert.equal(translate("xx", "hp"), "生命");
  });

  it("语言别名归一化与 html lang 映射", () => {
    assert.equal(normalizeLocale("en"), "en");
    assert.equal(normalizeLocale("EN"), "zh");
    assert.equal(normalizeLocale(null), "zh");
    assert.equal(htmlLang("en"), "en");
    assert.equal(htmlLang("zh"), "zh-CN");
  });

  it("怪物名与区域名按语言取，未知 id 兜底", () => {
    assert.equal(monsterName("zh", "trueDemon"), "真·魔王");
    assert.equal(monsterName("en", "trueDemon"), "True Demon");
    assert.equal(monsterName("en", "unknown"), "unknown");
    assert.equal(zoneName("en", 4), "Molten Abyss");
    assert.equal(zoneName("zh", 1), "苔痕石厅");
  });

  it("语言偏好 key 与全站共享约定一致", () => {
    assert.equal(LANG_KEY, "doin.lang");
  });
});
