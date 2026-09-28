// i18n.test.mjs：双表键对齐且非空、英文表绝无汉字、源码零裸写中文。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { strings, LOCALES, format } from "../js/i18n.mjs";

const zh = strings("zh");
const en = strings("en");

test("双表键完全对齐", () => {
  const zhKeys = Object.keys(zh).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(zhKeys, enKeys);
});

test("所有词条非空", () => {
  for (const key of Object.keys(zh)) {
    assert.ok(String(zh[key]).length > 0, `zh.${key} 为空`);
    assert.ok(String(en[key]).length > 0, `en.${key} 为空`);
  }
});

test("英文表绝无汉字", () => {
  for (const [key, value] of Object.entries(en)) {
    const hasHan = /[\u4e00-\u9fa5]/.test(String(value));
    // 白名单：语言切换按钮标识
    if (key === "langShort" || key === "langLabel") continue;
    assert.equal(hasHan, false, `en.${key} 含汉字: ${value}`);
  }
});

test("format 插值", () => {
  assert.equal(format("第 {0} 关", 5), "第 5 关");
  assert.equal(format("Moves {0} · Par {1}", 3, 2), "Moves 3 · Par 2");
});

// 运行源码零裸写中文（除 i18n.mjs 本身）
test("运行源码零未封装中文", () => {
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "js");
  const files = readdirSync(dir).filter((f) => f.endsWith(".mjs"));
  for (const f of files) {
    if (f === "i18n.mjs") continue;
    const code = readFileSync(resolve(dir, f), "utf8");
    // 去除注释
    const stripped = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    // 匹配字符串字面量中的中文
    const matches = stripped.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
    if (matches && matches.length > 0) {
      assert.fail(`${f} 含裸写中文: ${matches.slice(0, 3).join(", ")}`);
    }
  }
});
