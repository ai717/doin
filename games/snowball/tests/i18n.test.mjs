import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { strings, t, LANG_KEY, detectLocale, loadLocale, saveLocale, otherLocale, hasKey } from "../js/i18n.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const zhKeys = Object.keys(strings.zh).sort();
const enKeys = Object.keys(strings.en).sort();
const han = /[\u4e00-\u9fa5]/;

test("i18n：中英双表键完全对齐且非空", () => {
  assert.deepEqual(enKeys, zhKeys);
  for (const key of zhKeys) {
    assert.equal(typeof strings.zh[key], "string", key);
    assert.equal(typeof strings.en[key], "string", key);
    assert.ok(strings.zh[key].length > 0, `zh.${key} 为空`);
    assert.ok(strings.en[key].length > 0, `en.${key} 为空`);
  }
});

test("i18n：英文表除语言按钮外零汉字", () => {
  const allowed = new Set(["langShort"]);
  for (const key of enKeys) {
    if (allowed.has(key)) continue;
    assert.ok(!han.test(strings.en[key]), `en.${key} 含汉字`);
  }
});

test("i18n：双表占位符集合一致", () => {
  const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const key of zhKeys) {
    assert.deepEqual(placeholders(strings.en[key]), placeholders(strings.zh[key]), `占位符不一致：${key}`);
  }
});

test("i18n：t 插值与缺省回退", () => {
  assert.equal(t("zh", "levelLabel", { n: 3 }), "第 3 关");
  assert.equal(t("en", "levelLabel", { n: 3 }), "Level 3");
  assert.equal(t("en", "missing-key"), "missing-key");
  assert.equal(t("fr", "appTitle"), strings.zh.appTitle);
  assert.equal(hasKey("en", "help1"), true);
  assert.equal(hasKey("xx", "help1"), false);
});

test("i18n：doin.lang 读写与非法值兜底", () => {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
  assert.equal(LANG_KEY, "doin.lang");
  saveLocale("en");
  assert.equal(loadLocale(), "en");
  assert.equal(detectLocale(), "en");
  saveLocale("zh");
  assert.equal(loadLocale(), "zh");
  map.set(LANG_KEY, "klingon");
  const detected = detectLocale();
  assert.ok(detected === "zh" || detected === "en");
  assert.equal(otherLocale("zh"), "en");
  assert.equal(otherLocale("en"), "zh");
});

test("i18n：源码除 i18n 表外零裸写中文", () => {
  const dir = join(root, "js");
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".mjs") || file === "i18n.mjs") continue;
    const source = readFileSync(join(dir, file), "utf8");
    const match = source.match(han);
    assert.equal(match, null, `${file} 含裸写中文：${match?.[0]}`);
  }
});

test("i18n：关卡数据零中文，题库字段齐备", () => {
  const source = readFileSync(join(root, "js", "levels.mjs"), "utf8");
  assert.equal(han.test(source), false);
  assert.match(source, /STAGE_W\s*=\s*960/);
  assert.match(source, /STAGE_H\s*=\s*540/);
});

test("i18n：HTML 所有 data-i18n 键均在双表存在", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  const keys = new Set();
  for (const match of html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)) keys.add(match[1]);
  assert.ok(keys.size >= 40, `键数量偏少：${keys.size}`);
  for (const key of keys) {
    assert.ok(strings.zh[key], `zh 缺少 ${key}`);
    assert.ok(strings.en[key], `en 缺少 ${key}`);
  }
});

test("i18n：无刷新页面，语言键统一 doin.lang", () => {
  const main = readFileSync(join(root, "js", "main.mjs"), "utf8");
  assert.equal(/location\.reload/.test(main), false);
  const i18n = readFileSync(join(root, "js", "i18n.mjs"), "utf8");
  assert.match(i18n, /doin\.lang/);
});
