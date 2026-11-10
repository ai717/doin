// i18n.test.mjs - both dictionaries must be complete, and the English one must
// actually be English (the portal gate checks for CJK leakage too).

import test from "node:test";
import assert from "node:assert/strict";
import { LOCALES, htmlLang, strings, translate } from "../js/i18n.mjs";
import { LEVELS, CHAPTERS } from "../js/levels.mjs";

const CJK = /[\u4e00-\u9fff]/;
// langSwitch 是「切换到另一种语言」的按钮文案，必须用对方语言写，属于唯一例外。
const CJK_ALLOWED = new Set(["langSwitch"]);

test("字典: 中英词条一一对应，没有空值", () => {
  const zh = Object.keys(strings.zh).sort();
  const en = Object.keys(strings.en).sort();
  assert.deepEqual(en, zh, "两种语言的键必须完全一致");
  assert.ok(zh.length >= 80, `词条只有 ${zh.length} 条`);
  for (const locale of LOCALES) {
    for (const [key, value] of Object.entries(strings[locale])) {
      assert.equal(typeof value, "string", `${locale}.${key} 必须是字符串`);
      assert.ok(value.trim().length > 0, `${locale}.${key} 不能为空`);
    }
  }
});

test("字典: 英文表里没有中文残留", () => {
  for (const [key, value] of Object.entries(strings.en)) {
    if (CJK_ALLOWED.has(key)) continue;
    assert.ok(!CJK.test(value), `en.${key} 混入了中文：${value}`);
  }
});

test("字典: 插值占位符两种语言保持一致", () => {
  const placeholders = (text) => (String(text).match(/\{(\w+)\}/g) ?? []).sort();
  for (const key of Object.keys(strings.zh)) {
    assert.deepEqual(
      placeholders(strings.en[key]),
      placeholders(strings.zh[key]),
      `${key} 的占位符不一致`,
    );
  }
});

test("字典: 20 件战利品与 5 卷标题齐备，且与关卡数据对齐", () => {
  for (const level of LEVELS) {
    const key = `loot_${level.target.key}`;
    assert.ok(strings.zh[key], `缺中文词条 ${key}`);
    assert.ok(strings.en[key], `缺英文词条 ${key}`);
  }
  for (const chapter of CHAPTERS) {
    assert.ok(strings.zh[`chapter${chapter.id}`], `缺卷名 chapter${chapter.id}`);
    assert.ok(strings.en[`chapter${chapter.id}`], `缺英文卷名 chapter${chapter.id}`);
  }
  for (const kind of ["Laser", "Wire", "Dog", "Spot"]) {
    assert.ok(strings.zh[`fail${kind}`], `缺失败文案 fail${kind}`);
  }
});

test("translate: 插值、缺变量、未知键、未知语言都有确定行为", () => {
  assert.equal(translate("zh", "starsOf", { n: 2 }), "2/3");
  assert.equal(translate("en", "starsOf", { n: 2 }), "2/3");
  assert.equal(translate("zh", "levelTag", { n: 7 }), "第 7 关");
  assert.equal(translate("en", "levelTag", { n: 7 }), "Stage 7");
  assert.equal(translate("zh", "starsOf"), "{n}/3", "缺变量时保留占位符");
  assert.equal(translate("zh", "noSuchKey"), "noSuchKey", "未知键回落键名");
  assert.equal(translate("fr", "appTitle"), strings.zh.appTitle, "未知语言回落中文");
  assert.equal(translate("zh", "appTitle"), "神偷手臂");
});

test("htmlLang: 只产出 zh-CN / en", () => {
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
  assert.equal(htmlLang("fr"), "zh-CN");
  assert.deepEqual(LOCALES, ["zh", "en"]);
});

test("不变式: 每种语言的键数量与中文完全一致", () => {
  const zh = Object.keys(strings.zh);
  for (const locale of LOCALES) {
    assert.equal(Object.keys(strings[locale]).length, zh.length, `${locale} 词条数量不符`);
    for (const key of zh) assert.ok(key in strings[locale], `${locale} 缺 ${key}`);
  }
});
