// i18n 契约：双表键完全对齐且非空、英文表零汉字（平台硬性红线）、
// translate 参数插值与回退、源码零裸写中文、HTML 静态中文全覆盖。

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { htmlLang, strings, translate } from "../js/i18n.mjs";

const gameDir = resolve(import.meta.dirname, "..");

test("zh/en tables have identical non-empty key sets", () => {
  const zhKeys = Object.keys(strings.zh).sort();
  const enKeys = Object.keys(strings.en).sort();
  assert.deepEqual(enKeys, zhKeys);
  for (const key of zhKeys) {
    assert.ok(strings.zh[key].length > 0, `zh.${key} empty`);
    assert.ok(strings.en[key].length > 0, `en.${key} empty`);
  }
});

test("strings.en contains zero CJK characters (hard gate)", () => {
  const bad = Object.entries(strings.en)
    .filter(([, value]) => /[\u4e00-\u9fff]/.test(value))
    .map(([key]) => key);
  assert.deepEqual(bad, []);
});

test("translate interpolates params and falls back to zh", () => {
  assert.equal(translate("zh", "roundLabel", { n: 3, m: 30 }), "回合 3/30");
  assert.equal(translate("en", "roundLabel", { n: 3, m: 30 }), "Round 3/30");
  assert.equal(translate("en", "roundLabel", { n: 7 }), "Round 7/{m}");
  assert.equal(translate("fr", "appTitle"), strings.zh.appTitle);
  assert.equal(translate("en", "__missing__"), "__missing__");
  assert.equal(htmlLang("en"), "en");
  assert.equal(htmlLang("zh"), "zh-CN");
});

test("every engine log key and tile/card key exists in both tables", () => {
  const engine = readFileSync(resolve(gameDir, "js", "engine.mjs"), "utf8");
  const zhKeys = new Set(Object.keys(strings.zh));
  // 所有 pushLog 的 key
  const logKeys = [...engine.matchAll(/pushLog\(state,\s*"([a-z_]+)"/g)].map((m) => m[1]);
  assert.ok(logKeys.length >= 40, `expected plenty of log keys, got ${logKeys.length}`);
  for (const key of logKeys) assert.ok(zhKeys.has(key), `missing i18n key ${key}`);
  // 地块与卡片命名键
  for (const group of ["blue", "green", "yellow", "red"]) {
    assert.ok(zhKeys.has(`group_${group}`));
    for (let i = 1; i <= 3; i += 1) assert.ok(zhKeys.has(`tile_p_${group}_${i}`));
  }
  for (const tile of ["start", "rest", "shop", "bank", "chance", "fate", "trap"]) {
    assert.ok(zhKeys.has(`tile_${tile}`));
  }
  for (const card of ["rentfree", "roadblock", "dice", "tax", "equal", "swap"]) {
    assert.ok(zhKeys.has(`card_${card}`));
    assert.ok(zhKeys.has(`card_${card}Desc`));
  }
});

test("runtime source files contain no bare Chinese strings", () => {
  const skip = new Set(["i18n.mjs"]);
  const files = readdirSync(resolve(gameDir, "js"))
    .filter((name) => name.endsWith(".mjs") && !skip.has(name))
    .map((name) => ({ name, code: readFileSync(resolve(gameDir, "js", name), "utf8") }));
  assert.ok(files.length >= 7);
  for (const file of files) {
    // 去掉注释后再查：字符串字面量里的中文 = 违规。
    // 与 check-game 对齐：语言切换按钮的 "中文" 标识在白名单内。
    const stripped = file.code
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      .replace(/(["'`])中文\1/g, '""');
    const hits = stripped.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fff]+[^"'`\r\n]*\1/g) ?? [];
    assert.deepEqual(hits, [], `${file.name} has bare Chinese strings: ${hits.join(", ")}`);
  }
});

test("index.html static Chinese nodes all declare data-i18n", () => {
  const html = readFileSync(resolve(gameDir, "index.html"), "utf8");
  const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  const offenders = [];
  for (const match of clean.matchAll(/<([a-zA-Z0-9-]+)([^>]*)>([^<]*[\u4e00-\u9fff]+[^<]*)<\/\1>/g)) {
    if (["title", "script"].includes(match[1].toLowerCase())) continue;
    if (!match[2].includes("data-i18n")) offenders.push(`<${match[1]}> ${match[3].trim().slice(0, 20)}`);
  }
  assert.deepEqual(offenders, [], `unhandled Chinese nodes: ${offenders.join(" | ")}`);
});

test("no location.reload anywhere in runtime modules", () => {
  for (const name of readdirSync(resolve(gameDir, "js"))) {
    if (!name.endsWith(".mjs")) continue;
    const code = readFileSync(resolve(gameDir, "js", name), "utf8");
    assert.ok(!code.includes("location.reload"), `${name} must never reload`);
  }
});
