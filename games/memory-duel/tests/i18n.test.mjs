// i18n 测试：全站统一 key、中英键完全对齐且非空、纯净英文、JS 源码零硬编码中文
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LANG_KEY,
  LOCALES,
  DEFAULT_LOCALE,
  strings,
  format,
  isLocale,
} from "../js/i18n.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const gameDir = resolve(__dirname, "..");

test("语言偏好 key 为全站统一 doin.lang", () => {
  assert.equal(LANG_KEY, "doin.lang");
  assert.equal(DEFAULT_LOCALE, "zh");
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("ja"), false);
});

test("中英双表键完全对齐且非空", () => {
  const zh = strings("zh");
  const en = strings("en");
  const zhKeys = Object.keys(zh);
  const enKeys = Object.keys(en);
  assert.deepEqual([...zhKeys].sort(), [...enKeys].sort());

  for (const key of zhKeys) {
    assert.ok(String(zh[key]).length > 0, `zh.${key} 为空`);
    assert.ok(String(en[key]).length > 0, `en.${key} 为空`);
  }
});

test("format 函数占位符正常替换", () => {
  assert.equal(format("回合 {n}", { n: 5 }), "回合 5");
  assert.equal(format("Round {n}", { n: 3 }), "Round 3");
});

test("纯净英文铁律：en 表除了语言切换按钮本身标识外绝无任何汉字", () => {
  const en = strings("en");
  const cjk = /[\u4e00-\u9fa5]/;
  const offenders = [];

  for (const [k, v] of Object.entries(en)) {
    if (k === "btnLang") continue; // 允许语言切换按钮显示 "中"
    if (cjk.test(String(v))) {
      offenders.push(`${k}: ${v}`);
    }
  }

  assert.deepEqual(offenders, [], `en 词典中包含未翻译中文: ${offenders.join("; ")}`);
});

test("源码零未封装中文：js/ 目录下除 i18n.mjs 外的文件严禁裸写中文字符串", () => {
  const jsDir = resolve(gameDir, "js");
  const files = readdirSync(jsDir).filter((name) => name.endsWith(".mjs") && name !== "i18n.mjs");
  const cjk = /(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g;
  const issues = [];

  for (const file of files) {
    const content = readFileSync(resolve(jsDir, file), "utf8");
    // 剥离注释
    const code = content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const matches = code.match(cjk);
    if (matches && matches.length > 0) {
      issues.push(`${file} 含有裸写中文: ${matches.join(", ")}`);
    }
  }

  assert.deepEqual(issues, [], `JS 源码包含硬编码中文: ${issues.join("; ")}`);
});
