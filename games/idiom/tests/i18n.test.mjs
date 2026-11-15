import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { strings, t, detectLocale, loadLocale, saveLocale, LANG_KEY, htmlLang } from "../js/i18n.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

function fakeLocalStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  };
}

function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test.beforeEach(() => {
  globalThis.localStorage = fakeLocalStorage();
});

test.afterEach(() => {
  delete globalThis.localStorage;
});

test("词表：中英键完全对齐", () => {
  const zhKeys = Object.keys(strings.zh).sort();
  const enKeys = Object.keys(strings.en).sort();
  assert.deepEqual(enKeys, zhKeys);
  assert.ok(zhKeys.length >= 70);
});

test("词表：英文表零汉字（语言切换按钮除外）", () => {
  for (const [key, value] of Object.entries(strings.en)) {
    if (key === "langShort") continue;
    assert.ok(!CJK.test(value), `en.${key} 含汉字: ${value}`);
  }
  assert.equal(strings.en.langShort, "中文");
});

test("词表：占位符两侧一致", () => {
  for (const key of Object.keys(strings.zh)) {
    const zhVars = [...strings.zh[key].matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    const enVars = [...strings.en[key].matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    assert.deepEqual(enVars, zhVars, key);
  }
});

test("取词：插值与未知键回退", () => {
  assert.equal(t("zh", "levelLabel", { n: 3 }), "第 3 关");
  assert.equal(t("en", "levelLabel", { n: 3 }), "Level 3");
  assert.equal(t("zh", "noSuchKey"), "noSuchKey");
  assert.equal(htmlLang("en"), "en");
  assert.equal(htmlLang("zh"), "zh-CN");
});

test("语言偏好：读写 doin.lang，非法值回退系统语言", () => {
  saveLocale("en");
  assert.equal(globalThis.localStorage.getItem(LANG_KEY), "en");
  assert.equal(loadLocale(), "en");
  saveLocale("zh");
  assert.equal(detectLocale(), "zh");
  globalThis.localStorage.setItem(LANG_KEY, "fr");
  assert.ok(["zh", "en"].includes(detectLocale()));
});

test("HTML：所有 data-i18n 键都在词表里", () => {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const keys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(keys.length >= 25);
  for (const key of keys) {
    assert.ok(key in strings.zh, `缺少中文键 ${key}`);
    assert.ok(key in strings.en, `缺少英文键 ${key}`);
  }
  const ariaKeys = [...html.matchAll(/data-i18n-aria="([^"]+)"/g)].map((match) => match[1]);
  for (const key of ariaKeys) assert.ok(key in strings.zh, `缺少 aria 键 ${key}`);
});

test("源码：i18n 与题库之外零裸写中文", () => {
  const dir = join(ROOT, "js");
  const files = readdirSync(dir).filter((file) => file.endsWith(".mjs"));
  assert.ok(files.length >= 8);
  for (const file of files) {
    if (file === "i18n.mjs" || file.endsWith("data.mjs")) continue;
    const code = stripComments(readFileSync(join(dir, file), "utf8"));
    const found = code.match(CJK);
    assert.ok(!found, `${file} 裸写中文: ${found?.[0]}`);
  }
});

test("题库：中文典故字段完整，英文题库无汉字", () => {
  return import("../js/zh.data.mjs").then(async (zh) => {
    const en = await import("../js/en.data.mjs");
    assert.equal(zh.FACTIONS_ZH.length, 8);
    assert.equal(en.FACTIONS_EN.length, 8);
    for (const faction of zh.FACTIONS_ZH) {
      for (const entry of faction.entries) {
        assert.ok(CJK.test(entry.zh));
        assert.ok(entry.zhDef.length >= 6);
        assert.ok(entry.zhSource.length >= 2);
        assert.ok(entry.zhStory.length >= 8);
        assert.ok(entry.zhExample.length >= 4);
      }
    }
    for (const faction of en.FACTIONS_EN) {
      for (const entry of faction.entries) {
        assert.ok(!CJK.test(entry.en));
        assert.equal(entry.en, entry.en.toUpperCase());
        assert.ok(entry.enDef.length >= 8);
        assert.ok(entry.enOrigin.length >= 5);
      }
    }
  });
});
