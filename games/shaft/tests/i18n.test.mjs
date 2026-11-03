import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  LOCALES,
  LANG_KEY,
  DEFAULT_LOCALE,
  isLocale,
  strings,
  format,
  htmlLang,
  saveLocale,
  loadLocale,
} from "../js/i18n.mjs";

const dir = resolve(import.meta.dirname, "..");

test("i18n: shared preference key is doin.lang with zh/en only", () => {
  assert.equal(LANG_KEY, "doin.lang");
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.equal(DEFAULT_LOCALE, "zh");
});

test("i18n: zh and en dictionaries share identical, non-empty keys", () => {
  const zh = strings("zh");
  const en = strings("en");
  const zhKeys = Object.keys(zh).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(zhKeys, enKeys, "中英文键必须严格对齐");
  for (const key of zhKeys) {
    assert.equal(typeof zh[key], "string", `zh.${key} 必须是字符串`);
    assert.equal(typeof en[key], "string", `en.${key} 必须是字符串`);
    assert.ok(zh[key].trim().length > 0, `zh.${key} 不得为空`);
    assert.ok(en[key].trim().length > 0, `en.${key} 不得为空`);
  }
  assert.ok(zhKeys.length > 70, "词条必须覆盖全部界面文案");
});

test("i18n: English table contains zero Han characters", () => {
  const en = strings("en");
  const bad = [];
  for (const [key, value] of Object.entries(en)) {
    if (key === "langSwitch") continue;
    if (/[\u4e00-\u9fa5]/.test(value)) bad.push(`${key}: ${value}`);
  }
  assert.deepEqual(bad, [], `英文表不得残留中文: ${bad.join(" | ")}`);
});

test("i18n: placeholder formatting and locale validation", () => {
  assert.equal(format("第 {n} 章", { n: 3 }), "第 3 章");
  assert.equal(format("生命 {hp} / {max}", { hp: 2, max: 12 }), "生命 2 / 12");
  assert.equal(format("无参数"), "无参数");
  assert.equal(format("{missing}", {}), "{missing}");
  assert.equal(format(null, { a: 1 }), "");
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(strings("fr"), strings("zh"));
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
});

test("i18n: saveLocale never throws and loadLocale always returns a legal locale", () => {
  saveLocale("en");
  saveLocale("bogus");
  assert.ok(LOCALES.includes(loadLocale()));
});

test("i18n: runtime sources contain no hard-coded Chinese strings", () => {
  const jsDir = resolve(dir, "js");
  const files = readdirSync(jsDir).filter((name) => name.endsWith(".mjs") && name !== "i18n.mjs");
  const issues = [];
  for (const name of files) {
    const src = readFileSync(resolve(jsDir, name), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      .replace(/(["'`])中文\1/g, '""');
    const matches = src.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
    if (matches) issues.push(`${name}: ${matches.slice(0, 2).join(", ")}`);
  }
  assert.deepEqual(issues, [], `源码不得裸写中文: ${issues.join(" | ")}`);

  const levels = readFileSync(resolve(jsDir, "levels.mjs"), "utf8");
  assert.ok(!/[\u4e00-\u9fa5]/.test(levels.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")), "关卡数据必须零中文");
});

test("i18n: index.html static Chinese is fully covered by data-i18n or JS ids", () => {
  const html = readFileSync(resolve(dir, "index.html"), "utf8")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  const jsSources = readdirSync(resolve(dir, "js"))
    .filter((name) => name.endsWith(".mjs"))
    .map((name) => readFileSync(resolve(dir, "js", name), "utf8"))
    .join("\n");
  const unhandled = [];
  for (const match of html.matchAll(/<([a-zA-Z0-9\-]+)([^>]*)>([^<]*[\u4e00-\u9fa5]+[^<]*)<\/\1>/g)) {
    const tag = match[1].toLowerCase();
    if (tag === "title" || tag === "script") continue;
    const attrs = match[2];
    if (attrs.includes("data-i18n")) continue;
    const id = attrs.match(/id="([^"]+)"/);
    if (id && jsSources.includes(`"${id[1]}"`)) continue;
    unhandled.push(`<${tag}> ${match[3].trim().slice(0, 12)}`);
  }
  assert.deepEqual(unhandled, [], `遗漏未覆盖的中文节点: ${unhandled.join(", ")}`);
});

test("i18n: no module loads external resources and no language switch reloads", () => {
  const jsDir = resolve(dir, "js");
  for (const name of readdirSync(jsDir).filter((file) => file.endsWith(".mjs"))) {
    const src = readFileSync(resolve(jsDir, name), "utf8");
    assert.ok(!/location\.reload/.test(src), `${name} 严禁 reload 打断游戏`);
    assert.ok(!/https?:\/\//.test(src), `${name} 不得引用外部网络资源`);
  }
  assert.ok(existsSync(resolve(dir, "favicon.svg")));
});
