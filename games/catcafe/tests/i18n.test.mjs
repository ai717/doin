// i18n.test.mjs — 全站共享语言偏好、双语表对称非空、英文纯净度、源码零未封装中文
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as i18n from "../js/i18n.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("语言键与偏好 key 契约", () => {
  assert.equal(i18n.LANG_KEY, "doin.lang", "共享偏好 key");
  assert.equal(i18n.isLocale("zh"), true);
  assert.equal(i18n.isLocale("en"), true);
  assert.equal(i18n.isLocale("fr"), false);
  assert.equal(i18n.htmlLang("zh"), "zh-CN");
  assert.equal(i18n.htmlLang("en"), "en");
});

test("双语表键完全一致且非空", () => {
  const zh = i18n.strings("zh");
  const en = i18n.strings("en");
  const zhKeys = Object.keys(zh).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(enKeys, zhKeys, "中英键集合完全一致");
  for (const k of zhKeys) {
    assert.ok(zh[k] !== undefined && zh[k] !== "", `zh.${k} 非空`);
    assert.ok(en[k] !== undefined && en[k] !== "", `en.${k} 非空`);
  }
});

test("format 命名占位替换", () => {
  const out = i18n.format("累计出杯：{bowls} 杯", { bowls: 120 });
  assert.equal(out, "累计出杯：120 杯");
  assert.equal(i18n.format("无占位", {}), "无占位");
  // 缺失占位保留原样
  assert.equal(i18n.format("缺 {x}", {}), "缺 {x}");
});

test("t() 函数支持参数化 + 默认 zh 兜底", () => {
  assert.equal(i18n.t("gameTitle"), "迷你猫咖掌柜");
  assert.equal(i18n.t("gameTitle", "en"), "Mini Cat Cafe");
  assert.equal(i18n.t("level", "zh", { lvl: 5 }), "Lv.5");
  assert.equal(i18n.t("cost", "zh", { cost: 100 }), "费用：100 金币");
  // 未知 key 兜底返回 key 本身
  assert.equal(i18n.t("unknown_key"), "unknown_key");
});

test("纯语言铁律：strings.en 除 langSwitch 外绝无汉字", () => {
  const en = i18n.strings("en");
  const cjk = /[\u4e00-\u9fa5]/;
  for (const [k, v] of Object.entries(en)) {
    if (k === "langSwitch") continue;
    assert.ok(!cjk.test(v), `en.${k} 含有汉字: ${v}`);
  }
});

test("源码零未封装中文：除 i18n.mjs 外的 JS 源码严禁出现中文", () => {
  const jsDir = join(ROOT, "js");
  const files = readdirSync(jsDir).filter((f) => f.endsWith(".mjs") || f.endsWith(".js"));

  function stripComments(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  }

  for (const f of files) {
    if (f.startsWith("i18n")) continue;
    const content = readFileSync(join(jsDir, f), "utf8");
    const code = stripComments(content);
    const matches = code.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
    assert.equal(matches, null, `${f} 发现未封装的硬编码中文: ${matches ? matches.join(", ") : ""}`);
  }
});