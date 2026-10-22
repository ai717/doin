// 多语言纯净性测试：zh/en 键对齐、英文表零汉字、t() 参数替换、源码零未封装中文。
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { strings, t, getLocale, setLocale, htmlLang } from "../js/i18n.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const gameDir = resolve(here, "..");

test("zh/en 词典键集合完全对齐", () => {
  const zhKeys = Object.keys(strings.zh).sort();
  const enKeys = Object.keys(strings.en).sort();
  assert.deepEqual(enKeys, zhKeys);
  assert.ok(zhKeys.length >= 30, `词典过小：${zhKeys.length}`);
});

test("英文表零汉字（硬性红线）", () => {
  const blob = JSON.stringify(strings.en);
  const hits = blob.match(/[\u4e00-\u9fa5]/g);
  assert.equal(hits, null, `en 表混入汉字：${hits?.join("")}`);
});

test("中文表完整覆盖棋子名（红黑各七种）", () => {
  for (let type = 1; type <= 7; type += 1) {
    assert.ok(strings.zh[`piece_red_${type}`], `缺 piece_red_${type}`);
    assert.ok(strings.zh[`piece_black_${type}`], `缺 piece_black_${type}`);
  }
});

test("t()：{n} 参数替换与未知键回退", () => {
  setLocale("en");
  assert.equal(t("__nope__"), "__nope__", "未知键回退键名");
  const zhValue = Object.entries(strings.zh).find(([, v]) => v.includes("{n}"));
  if (zhValue) {
    const [key] = zhValue;
    setLocale("zh");
    assert.ok(!t(key, { n: 7 }).includes("{n}"), "参数未被替换");
  }
  setLocale("zh");
});

test("setLocale/htmlLang：只接受 zh/en", () => {
  assert.equal(setLocale("en"), "en");
  assert.equal(getLocale(), "en");
  assert.equal(htmlLang("en"), "en");
  assert.equal(setLocale("fr"), "zh", "非法语言回退中文");
  assert.equal(htmlLang("zh"), "zh-CN");
});

test("源码零未封装中文（i18n.mjs 豁免，注释豁免）", () => {
  const stripComments = (source) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const files = ["js", "tools"].flatMap((dir) =>
    readdirSync(resolve(gameDir, dir))
      .filter((name) => name.endsWith(".mjs") && name !== "i18n.mjs")
      .map((name) => resolve(gameDir, dir, name)),
  );
  const offenders = [];
  for (const path of files) {
    const code = stripComments(readFileSync(path, "utf8")).replace(/(["'`])中文\1/g, '""');
    const matches = code.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
    if (matches) offenders.push(`${path.slice(gameDir.length + 1)}: ${matches[0].slice(0, 40)}`);
  }
  assert.deepEqual(offenders, []);
});
