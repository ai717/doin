import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { CASES } from "../js/cases.mjs";
import { LOCALE_STORAGE_KEY, LOCALES, hasKey, htmlLang, normalizeLocale, strings, translate } from "../js/i18n.mjs";

const gameDir = resolve(import.meta.dirname, "..");
const HAN = /[\u4e00-\u9fa5]/;

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function sources(directory = resolve(gameDir, "js")) {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".mjs"))
    .map((name) => ({ name, code: readFileSync(resolve(directory, name), "utf8") }));
}

test("双表键集合完全一致且无空值", () => {
  const zh = Object.keys(strings.zh);
  const en = Object.keys(strings.en);
  assert.deepEqual([...en].sort(), [...zh].sort());
  assert.ok(zh.length >= 480, `词条只有 ${zh.length} 条，内容显然没写全`);
  for (const locale of LOCALES) {
    for (const [key, value] of Object.entries(strings[locale])) {
      assert.equal(typeof value, "string", `${locale}.${key} 必须是字符串`);
      assert.ok(value.trim().length > 0, `${locale}.${key} 为空`);
    }
  }
});

test("英文表零汉字（语言切换按钮自身除外）", () => {
  for (const [key, value] of Object.entries(strings.en)) {
    if (key === "langSwitch") continue;
    assert.equal(HAN.test(value), false, `en.${key} 含中文: ${value}`);
  }
});

test("案件数据引用的每个键都存在于双表", () => {
  const need = new Set();
  for (const caseData of CASES) {
    need.add(`case${caseData.id}_title`);
    need.add(`case${caseData.id}_hook`);
    need.add(`victim_${caseData.victim}`);
    need.add(`scene_${caseData.scene}`);
    for (const who of caseData.suspects) {
      need.add(`role_${who}`);
      need.add(`c${caseData.id}_${who}`);
    }
    for (const weapon of caseData.weapons) need.add(`weapon_${weapon}`);
    for (const item of caseData.evidence) {
      need.add(`ev_${item.id}`);
      need.add(`ev_${item.id}_d`);
    }
    for (const fact of caseData.facts) {
      need.add(`ev_${fact.why}`);
      need.add(`ev_${fact.why}_d`);
    }
  }
  const missing = [...need].filter((key) => !hasKey("zh", key) || !hasKey("en", key));
  assert.deepEqual(missing, [], `缺少词条: ${missing.slice(0, 8).join(", ")}`);
});

test("界面词条齐备：印章、判词、评级、帮助与无障碍标签", () => {
  const required = [
    "appTitle",
    "docTitle",
    "cases",
    "pause",
    "resume",
    "stampUnset",
    "stampClear",
    "stampGuilty",
    "slotKiller",
    "slotWeapon",
    "slotClue",
    "seal",
    "wrongTitle",
    "winTitle",
    "rank1",
    "rank2",
    "rank3",
    "help1",
    "pauseTitle",
    "ariaSuspect",
    "ariaEvidence",
    "case1_title",
    "chapter1",
    "chapter2",
    "chapter3",
  ];
  for (const key of required) {
    assert.ok(hasKey("zh", key) && hasKey("en", key), `缺词条 ${key}`);
  }
});

test("插值：{n} 被替换，缺变量时保留占位符", () => {
  assert.equal(translate("zh", "caseLabel", { n: 7 }), "第 7 案");
  assert.equal(translate("en", "caseLabel", { n: 7 }), "Case 7");
  assert.equal(translate("zh", "caseNo", { n: "01" }), "案卷 #01");
  assert.equal(translate("zh", "lockCleared").includes("{n}"), true);
  assert.equal(translate("zh", "lockCleared", { n: 2 }), "还有 2 名嫌疑人未排除");
});

test("未知键与未知语言都优雅回退，绝不抛错", () => {
  assert.equal(translate("zh", "definitely_not_a_key"), "definitely_not_a_key");
  assert.equal(translate("fr", "appTitle"), strings.zh.appTitle);
  assert.equal(hasKey("zh", "nope"), false);
  assert.equal(normalizeLocale("en"), "en");
  assert.equal(normalizeLocale("fr"), "zh");
  assert.equal(normalizeLocale(undefined), "zh");
  assert.equal(htmlLang("en"), "en");
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(LOCALE_STORAGE_KEY, "doin.lang");
});

test("运行源码零裸写中文（i18n.mjs 之外）", () => {
  const offenders = [];
  for (const file of sources()) {
    if (file.name === "i18n.mjs") continue;
    const code = stripComments(file.code).replace(/(["'`])中文\1/g, '""');
    const hits = code.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
    if (hits) offenders.push(`${file.name}: ${hits.slice(0, 2).join(", ")}`);
  }
  assert.deepEqual(offenders, []);
});

test("index.html 的静态中文节点都有 data-i18n 或由 JS 写入", () => {
  const html = readFileSync(resolve(gameDir, "index.html"), "utf8");
  const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  const allJs = sources().map((file) => file.code).join("\n");
  const unhandled = [];
  for (const match of clean.matchAll(/<([a-zA-Z0-9-]+)([^>]*)>([^<]*[\u4e00-\u9fa5]+[^<]*)<\/\1>/g)) {
    const [, tag, attrs, text] = match;
    if (tag.toLowerCase() === "title" || tag.toLowerCase() === "script") continue;
    if (attrs.includes("data-i18n")) continue;
    const id = attrs.match(/id="([^"]+)"/)?.[1];
    if (id && allJs.includes(`"${id}"`)) continue;
    unhandled.push(`<${tag}> ${text.trim().slice(0, 12)}`);
  }
  assert.deepEqual(unhandled, []);
});

test("i18n 是本作唯一文本入口：其它模块不直接 import strings", () => {
  for (const file of sources()) {
    if (file.name === "i18n.mjs") continue;
    assert.equal(/from "\.\/i18n\.mjs"/.test(file.code) && /\bstrings\b/.test(file.code), false, `${file.name} 直接使用了双表`);
  }
});
