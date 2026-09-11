// filepath: games/jigsaw/tests/i18n.test.mjs
// 文案层回归：中英键必须完全对齐且非空，列表型文案长度一致，语言偏好走全站共享 key。
import test from "node:test";
import assert from "node:assert/strict";

import {
  LOCALES,
  LANG_KEY,
  DEFAULT_LOCALE,
  isLocale,
  strings,
  format,
  t,
  htmlLang,
  altLabel,
  detectLocale,
  loadLocale,
  saveLocale,
  getLocale,
} from "../js/i18n.mjs";
import { LEVELS, CHAPTERS } from "../js/levels.mjs";

test("语言常量与全站约定一致", () => {
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.equal(LANG_KEY, "doin.lang", "必须读写全站共享 key");
  assert.equal(DEFAULT_LOCALE, "zh");
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(isLocale(null), false);
  assert.equal(isLocale(1), false);
});

test("中英字典键完全对齐", () => {
  const zh = Object.keys(strings.zh).sort();
  const en = Object.keys(strings.en).sort();
  assert.deepEqual(zh, en, "中英键集合不一致");
  assert.ok(zh.length > 100, `键数量偏少：${zh.length}`);
});

test("每条文案在两种语言下都非空", () => {
  for (const locale of LOCALES) {
    for (const [key, value] of Object.entries(strings[locale])) {
      if (Array.isArray(value)) {
        assert.ok(value.length > 0, `${locale}.${key} 是空列表`);
        for (const item of value) {
          assert.equal(typeof item, "string");
          assert.ok(item.trim().length > 0, `${locale}.${key} 含空条目`);
        }
        continue;
      }
      assert.equal(typeof value, "string", `${locale}.${key} 不是字符串`);
      assert.ok(value.trim().length > 0, `${locale}.${key} 为空`);
    }
  }
});

test("列表型文案中英长度一致", () => {
  for (const key of Object.keys(strings.zh)) {
    if (!Array.isArray(strings.zh[key])) continue;
    assert.ok(Array.isArray(strings.en[key]), `en.${key} 应为列表`);
    assert.equal(strings.zh[key].length, strings.en[key].length, `${key} 中英条目数不一致`);
  }
});

test("50 关 + 5 章的名称中英齐全", () => {
  for (const level of LEVELS) {
    const key = `level.${level.id}`;
    assert.ok(strings.zh[key], `zh 缺 ${key}`);
    assert.ok(strings.en[key], `en 缺 ${key}`);
    assert.ok(strings.zh[key].length <= 12, `${key} 中文名过长，选关卡片会溢出`);
  }
  for (const chapter of CHAPTERS) {
    assert.ok(strings.zh[`chapter.${chapter.id}`], `zh 缺 chapter.${chapter.id}`);
    assert.ok(strings.en[`chapter.${chapter.id}`], `en 缺 chapter.${chapter.id}`);
  }
});

test("英文文案必须是 ASCII（避免中英混排的字体回退问题）", () => {
  for (const [key, value] of Object.entries(strings.en)) {
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      // 允许 {name} 这类占位符与常见标点
      assert.ok(/^[\x20-\x7E]*$/.test(item), `en.${key} 含非 ASCII 字符: ${item}`);
    }
  }
});

test("format 做模板替换，缺参时保留占位符", () => {
  assert.equal(format("第 {n} 关", { n: 7 }), "第 7 关");
  assert.equal(format("{a}-{b}", { a: "x", b: "y" }), "x-y");
  assert.equal(format("{missing}", {}), "{missing}");
  assert.equal(format("无占位", { n: 1 }), "无占位");
  assert.equal(format(null, {}), "");
  assert.equal(format("x", null), "x");
});

test("t 取当前语言文案，未知键返回空串", () => {
  loadLocale();
  const locale = getLocale();
  assert.ok(LOCALES.includes(locale));
  assert.equal(t("app.title"), strings[locale]["app.title"]);
  assert.equal(t("不存在的键"), "");
  assert.deepEqual(t("help.rulesList"), strings[locale]["help.rulesList"]);
});

test("列表型文案支持占位符替换", () => {
  const zh = t("help.rulesList");
  assert.ok(Array.isArray(zh));
  assert.equal(zh.length, strings.zh["help.rulesList"].length);
});

test("htmlLang / altLabel 随语言变化", () => {
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
  assert.equal(htmlLang("fr"), "zh-CN");
  saveLocale("zh");
  assert.equal(altLabel(), "EN");
  saveLocale("en");
  assert.equal(altLabel(), "中");
  saveLocale(DEFAULT_LOCALE);
  assert.equal(getLocale(), DEFAULT_LOCALE);
});

test("saveLocale 拒绝非法值，detectLocale 永远返回合法语言", () => {
  saveLocale("zh");
  assert.equal(saveLocale("klingon"), "zh");
  assert.ok(LOCALES.includes(detectLocale()));
});
