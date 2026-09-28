// 泡泡射手 · 国际化单元测试
// 覆盖：全站共享语言键 doin.lang / 中英键严格对齐 / 英文表零汉字 / 运行源码零裸写中文 / 占位格式化
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

globalThis.localStorage = (() => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
})();

const { LANG_KEY, DEFAULT_LOCALE, LOCALES, isLocale, strings, format, saveLocale, loadLocale } = await import(
  "../js/i18n.mjs"
);

const jsDir = resolve(import.meta.dirname, "..", "js");

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("语言键为全站共享 doin.lang，默认 zh", () => {
  assert.equal(LANG_KEY, "doin.lang");
  assert.equal(DEFAULT_LOCALE, "zh");
});

test("中英双语表键集合严格一致", () => {
  assert.deepEqual([...Object.keys(LOCALES.zh)].sort(), [...Object.keys(LOCALES.en)].sort());
});

test("双语表所有值非空", () => {
  for (const locale of ["zh", "en"]) {
    for (const [key, value] of Object.entries(LOCALES[locale])) {
      assert.ok(typeof value === "string" && value.trim().length > 0, `${locale}.${key} 为空`);
    }
  }
});

test("英文表绝无汉字（语言切换按钮白名单除外）", () => {
  const whitelist = /langBtn|langName/i;
  for (const [key, value] of Object.entries(LOCALES.en)) {
    if (whitelist.test(key)) continue;
    assert.ok(!/[\u4e00-\u9fa5]/.test(value), `en.${key} 含汉字: ${value}`);
  }
});

test("运行源码零裸写中文（i18n.mjs 除外的字符串常量）", () => {
  const offenders = [];
  for (const name of readdirSync(jsDir)) {
    if (!name.endsWith(".mjs") || name === "i18n.mjs") continue;
    const code = stripComments(readFileSync(resolve(jsDir, name), "utf8")).replace(/(["'`])中文\1/g, '""');
    const matches = code.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
    if (matches) offenders.push(`${name}: ${matches.slice(0, 2).join(", ")}`);
  }
  assert.deepEqual(offenders, [], `源码硬编码中文: ${offenders.join(" | ")}`);
});

test("关卡与题板数据零中文（mask/道具/模式均为英文或数字符号）", () => {
  const levels = stripComments(readFileSync(resolve(jsDir, "levels.mjs"), "utf8"));
  const strings = levels.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
  assert.equal(strings, null, `levels.mjs 硬编码中文: ${strings?.slice(0, 2).join(", ")}`);
});

test("isLocale 只认 zh / en", () => {
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("jp"), false);
  assert.equal(isLocale(undefined), false);
});

test("strings 对非法 locale 回退默认", () => {
  assert.equal(strings("de"), LOCALES.zh);
  assert.equal(strings("en"), LOCALES.en);
});

test("占位格式化 {n}/{s}/{t}/{c}/{p} 正确替换", () => {
  assert.equal(format("zh", "level", { n: 7 }), "第 7 关");
  assert.equal(format("en", "level", { n: 7 }), "Level 7");
  assert.equal(format("zh", "clearStats", { s: 12, t: 20, c: 9 }), "用弹 12 · 目标 20 · 最大连锁 9");
  assert.equal(format("en", "overStats", { s: 21, c: 6, p: 3400 }), "Survived 21 shots · Max chain 6 · Score 3400");
});

test("缺失键回退键名本身（不抛错）", () => {
  assert.equal(format("zh", "nope"), "nope");
});

test("语言持久化走全站共享键", () => {
  saveLocale("en");
  assert.equal(localStorage.getItem(LANG_KEY), "en");
  assert.equal(loadLocale(), "en");
  saveLocale("fr");
  assert.equal(loadLocale(), "en", "非法值忽略");
  saveLocale("zh");
  assert.equal(loadLocale(), "zh");
});

test("模式与道具名具备中英对照（断柱残局 / 冰镐弹 / 棱镜泡）", () => {
  assert.equal(LOCALES.zh.modePuzzle, "断柱残局");
  assert.equal(LOCALES.en.modePuzzle, "One-Shot Puzzle");
  assert.equal(LOCALES.zh.icePick, "冰镐弹");
  assert.equal(LOCALES.en.icePick, "Ice pick");
  assert.equal(LOCALES.zh.prism, "棱镜泡");
  assert.equal(LOCALES.en.prism, "Prism");
});
