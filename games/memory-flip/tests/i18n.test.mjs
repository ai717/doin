// i18n.test.mjs — 中英双表对齐 + 英文零汉字 + 源码零未封装中文
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  LOCALES, LANG_KEY, DEFAULT_LOCALE, strings, isLocale,
  htmlLang, totemName, chapterName, chapterDesc,
} from "../js/i18n.mjs";

const HAN_RE = /[\u4e00-\u9fff]/;

describe("i18n: 基本契约", () => {
  it("语言 key 是全站共享的 doin.lang", () => {
    assert.equal(LANG_KEY, "doin.lang");
  });
  it("LOCALES 与默认语言合法", () => {
    assert.deepEqual([...LOCALES], ["zh", "en"]);
    assert.ok(LOCALES.includes(DEFAULT_LOCALE));
    assert.equal(isLocale("zh"), true);
    assert.equal(isLocale("jp"), false);
  });
  it("htmlLang 映射正确", () => {
    assert.equal(htmlLang("zh"), "zh-CN");
    assert.equal(htmlLang("en"), "en");
  });
  it("totemName / chapterName 回退到 zh", () => {
    assert.equal(typeof totemName("zh", "octo_pop"), "string");
    assert.equal(typeof chapterName("zh", 1), "string");
    assert.equal(typeof chapterDesc("zh", 1), "string");
    assert.equal(totemName("en", "__missing__"), "__missing__");
  });
});

describe("i18n: 中英键对齐且非空", () => {
  const zhKeys = Object.keys(strings.zh);
  const enKeys = Object.keys(strings.en);
  it("键集合完全一致", () => {
    assert.deepEqual(zhKeys.sort(), enKeys.sort());
  });
  it("所有值非空字符串", () => {
    for (const key of zhKeys) {
      assert.equal(typeof strings.zh[key], "string", `zh.${key} 非字符串`);
      assert.ok(strings.zh[key].trim().length > 0, `zh.${key} 为空`);
      assert.equal(typeof strings.en[key], "string", `en.${key} 非字符串`);
      assert.ok(strings.en[key].trim().length > 0, `en.${key} 为空`);
    }
  });
});

describe("i18n: 英文表零汉字（红线）", () => {
  // 白名单：语言切换按钮标识（AGENTS.md §5.2.4 允许）
  const WHITELIST = new Set(["btnLang"]);
  const enKeys = Object.keys(strings.en);
  for (const key of enKeys) {
    it(`en.${key} 不含汉字`, () => {
      if (WHITELIST.has(key)) return; // 切换按钮标识豁免
      assert.equal(HAN_RE.test(strings.en[key]), false,
        `en.${key} 含汉字：${strings.en[key]}`);
    });
  }
});

describe("i18n: 源码零未封装中文（红线）", () => {
  // 扫描 js/ 下所有 .mjs，i18n.mjs 自身允许中文，其余文件零裸写中文
  const jsDir = join(import.meta.dirname, "..", "js");
  const files = readdirSync(jsDir).filter((f) => f.endsWith(".mjs"));
  for (const file of files) {
    if (file === "i18n.mjs") continue;
    it(`${file} 不含裸写中文`, () => {
      const src = readFileSync(join(jsDir, file), "utf8");
      // 去除注释（// ... 与 /* ... */）后检测
      const noLine = src.replace(/\/\/.*$/gm, "");
      const noBlock = noLine.replace(/\/\*[\s\S]*?\*\//g, "");
      assert.equal(HAN_RE.test(noBlock), false,
        `${file} 含裸写中文，应统一走 i18n`);
    });
  }
});
