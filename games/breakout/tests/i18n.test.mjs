import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  LANG_KEY,
  LOCALES,
  DEFAULT_LOCALE,
  strings,
  isLocale,
  format,
  htmlLang,
} from "../js/i18n.mjs";
import { RELICS } from "../js/relics.mjs";

const dir = resolve(import.meta.dirname, "..");

function readJsSources() {
  const jsDir = resolve(dir, "js");
  return readdirSync(jsDir)
    .filter((name) => name.endsWith(".mjs"))
    .map((name) => ({ name, src: readFileSync(resolve(jsDir, name), "utf8") }));
}

const CHINESE = /[\u4e00-\u9fa5]/;

test("i18n: shared preference key is doin.lang", () => {
  assert.equal(LANG_KEY, "doin.lang");
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("fr"), false);
});

test("i18n: zh and en tables are aligned and non-empty", () => {
  const zh = strings("zh");
  const en = strings("en");
  const zhKeys = Object.keys(zh);
  const enKeys = Object.keys(en);
  assert.deepEqual(zhKeys, enKeys);
  assert.ok(zhKeys.length > 30);
  for (const key of zhKeys) {
    assert.ok(typeof zh[key] === "string" && zh[key].trim().length > 0, `zh.${key} 为空`);
    assert.ok(typeof en[key] === "string" && en[key].trim().length > 0, `en.${key} 为空`);
  }
});

test("i18n: strings.en contains zero Chinese characters (langSwitch whitelisted)", () => {
  const en = strings("en");
  // 语言切换按钮自身标识是白名单例外
  const whitelist = new Set(["langSwitch"]);
  for (const key of Object.keys(en)) {
    if (whitelist.has(key)) continue;
    assert.ok(!CHINESE.test(en[key]), `en.${key} 含汉字: ${en[key]}`);
  }
});

test("i18n: relic data has zero Chinese in English name/desc", () => {
  for (const id of Object.keys(RELICS)) {
    assert.ok(!CHINESE.test(RELICS[id].nameEn), `relic ${id} nameEn 含汉字`);
    assert.ok(!CHINESE.test(RELICS[id].descEn), `relic ${id} descEn 含汉字`);
  }
});

test("i18n: JS logic sources (levels, relics, score, engine, game) have no bare Chinese strings outside i18n", () => {
  const allowed = new Set(["i18n.mjs"]);
  for (const file of readJsSources()) {
    if (allowed.has(file.name)) continue;
    // 允许注释中的中文说明
    const stripped = file.src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    // 允许 emoji 和符号，但检查裸写中文字符串
    const chineseMatches = stripped.match(CHINESE);
    assert.ok(!chineseMatches, `${file.name} 含未封装中文`);
  }
});

test("i18n: unknown locale falls back to default", () => {
  assert.equal(strings("klingon"), strings(DEFAULT_LOCALE));
});

test("i18n: format fills placeholders", () => {
  assert.equal(format("{n} / {max}", { n: 3, max: 15 }), "3 / 15");
  assert.equal(format("{n}", { n: 99 }), "99");
  assert.equal(format("{missing}", {}), "{missing}");
  assert.equal(format(undefined, { n: 1 }), "");
});

test("i18n: html lang mapping", () => {
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
});
