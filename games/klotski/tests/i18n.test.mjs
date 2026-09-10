// filepath: games/klotski/tests/i18n.test.mjs
// 国际化测试：node --test games/klotski/tests/
import test from "node:test";
import assert from "node:assert/strict";

import {
  LOCALES,
  LANG_KEY,
  DEFAULT_LOCALE,
  isLocale,
  strings,
  format,
  detectLocale,
  loadLocale,
  saveLocale,
  getLocale,
  htmlLang,
  t,
  altLabel,
} from "../js/i18n.mjs";
import { LEVELS } from "../js/levels.mjs";

test("导出契约齐全，语言 key 为全站共享的 doin.lang", () => {
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.equal(LANG_KEY, "doin.lang");
  assert.equal(DEFAULT_LOCALE, "zh");
  assert.equal(typeof detectLocale, "function");
  assert.equal(typeof loadLocale, "function");
  assert.equal(typeof saveLocale, "function");
  assert.equal(typeof htmlLang, "function");
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("jp"), false);
  assert.equal(isLocale(null), false);
});

test("中英文字典键完全对齐，无缺项无多余", () => {
  const zhKeys = Object.keys(strings.zh).sort();
  const enKeys = Object.keys(strings.en).sort();
  assert.deepEqual(enKeys, zhKeys, "en 与 zh 的键必须一一对应");
  assert.ok(zhKeys.length > 40, "字典规模应覆盖全部 UI 文案");
});

test("所有文案非空", () => {
  for (const locale of LOCALES) {
    for (const [key, value] of Object.entries(strings[locale])) {
      if (Array.isArray(value)) {
        assert.ok(value.length > 0, `${locale}.${key} 不应为空数组`);
        value.forEach((item, index) => {
          assert.equal(typeof item, "string", `${locale}.${key}[${index}] 必须是字符串`);
          assert.ok(item.trim().length > 0, `${locale}.${key}[${index}] 不应为空`);
        });
      } else {
        assert.equal(typeof value, "string", `${locale}.${key} 必须是字符串`);
        assert.ok(value.trim().length > 0, `${locale}.${key} 不应为空`);
      }
    }
  }
});

test("每条关卡都有中英文名字", () => {
  for (const level of LEVELS) {
    for (const locale of LOCALES) {
      const name = strings[locale][`level.${level.id}`];
      assert.equal(typeof name, "string", `${locale} 缺 ${level.id} 的关卡名`);
      assert.ok(name.trim().length > 0);
    }
  }
});

test("format：替换占位符，缺失参数保留原样", () => {
  assert.equal(format("第 {n} 关", { n: 3 }), "第 3 关");
  assert.equal(format("{a}-{b}", { a: 1, b: 2 }), "1-2");
  assert.equal(format("无参数", {}), "无参数");
  assert.equal(format("{x} 缺失", {}), "{x} 缺失");
  assert.equal(format(undefined), "");
});

test("detectLocale 在无 navigator / localStorage 时回落到默认语言", () => {
  assert.equal(detectLocale(), DEFAULT_LOCALE);
  assert.equal(loadLocale(), DEFAULT_LOCALE);
  assert.equal(getLocale(), DEFAULT_LOCALE);
});

test("saveLocale 切换语言并影响 t() 与 htmlLang", () => {
  saveLocale("zh");
  assert.equal(getLocale(), "zh");
  assert.equal(htmlLang(), "zh-CN");
  assert.equal(t("app.title"), strings.zh["app.title"]);
  assert.equal(t("btn.undo"), "撤销");
  assert.equal(altLabel(), "EN");

  saveLocale("en");
  assert.equal(getLocale(), "en");
  assert.equal(htmlLang(), "en");
  assert.equal(t("btn.undo"), "Undo");
  assert.equal(altLabel(), "中");

  saveLocale("zh");
  assert.equal(htmlLang("en"), "en");
  assert.equal(htmlLang("zh"), "zh-CN");
});

test("saveLocale 忽略非法语言值", () => {
  saveLocale("zh");
  saveLocale("klingon");
  assert.equal(getLocale(), "zh");
});

test("t() 对数组型文案返回数组，便于渲染列表", () => {
  saveLocale("zh");
  const rules = t("help.rulesList");
  assert.ok(Array.isArray(rules));
  assert.equal(rules.length, strings.zh["help.rulesList"].length);
});

test("t() 未知 key 不会抛错，返回空串以便安全渲染", () => {
  assert.equal(t("definitely.not.a.key"), "");
  assert.equal(t(undefined), "");
});

test("本地存储不可用时 saveLocale 仍能切换内存态语言", () => {
  // Node 环境无 localStorage，写入失败应被吞掉但语言已切换
  saveLocale("en");
  assert.equal(getLocale(), "en");
  saveLocale("zh");
  assert.equal(getLocale(), "zh");
});
