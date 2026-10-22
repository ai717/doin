// filepath: games/ice-slide/tests/i18n.test.mjs
// 双语字典测试：zh/en key 对齐非空、英文词典零汉字、运行源码零未封装中文、
// doin.lang 共享 key、语言切换、插值、列表、章名/关名查表。
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LOCALES,
  LANG_KEY,
  DEFAULT_LOCALE,
  isLocale,
  t,
  tList,
  toggleLocale,
  saveLocale,
  getLocale,
  chapterName,
  levelName,
} from "../js/i18n.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");
const i18nSrc = fs.readFileSync(path.join(root, "js", "i18n.mjs"), "utf8");

const ZH_RE = /[\u4e00-\u9fa5]/;

/** 从源码中切出 const ZH = { ... }; 与 const EN = { ... }; 两个字典块 */
function dictBlock(name) {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`);
  const m = i18nSrc.match(re);
  assert.ok(m, `i18n.mjs 缺 ${name} 字典块`);
  return m[1];
}

function keysOf(block) {
  return [...block.matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]);
}

test("i18n: 共享 key 为 doin.lang，语言集合含 zh/en", () => {
  assert.equal(LANG_KEY, "doin.lang");
  assert.equal(DEFAULT_LOCALE, "zh");
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
});

test("i18n: zh/en 字典 key 完全对齐且均非空", () => {
  const zhKeys = keysOf(dictBlock("ZH"));
  const enKeys = keysOf(dictBlock("EN"));
  assert.ok(zhKeys.length >= 80, `zh 字典过小：${zhKeys.length}`);
  assert.deepEqual([...enKeys].sort(), [...zhKeys].sort());
  // 每个 key 双语都能取到非空字符串（列表型除外）
  for (const key of zhKeys) {
    saveLocale("zh");
    const z = t(key);
    saveLocale("en");
    const e = t(key);
    const nonEmpty = Array.isArray(z) ? z.length > 0 && z.every((s) => typeof s === "string" && s.length > 0) : typeof z === "string" && z.length > 0;
    assert.ok(nonEmpty, `zh 键 ${key} 为空`);
    const enNonEmpty = Array.isArray(e) ? e.length > 0 && e.every((s) => typeof s === "string" && s.length > 0) : typeof e === "string" && e.length > 0;
    assert.ok(enNonEmpty, `en 键 ${key} 为空`);
  }
});

test("i18n: 英文词典零汉字", () => {
  const enBlock = dictBlock("EN");
  const badLines = enBlock.split("\n").filter((line) => ZH_RE.test(line));
  assert.deepEqual(badLines, [], `英文表含中文: ${badLines.slice(0, 3).join("; ")}`);
});

test("i18n: 运行源码（i18n.mjs 除外）零未封装中文字符串", () => {
  const files = ["engine.mjs", "solver.mjs", "levels.mjs", "score.mjs", "storage.mjs", "game.mjs", "audio.mjs", "ui.mjs", "main.mjs"]
    .map((name) => ({ name, src: fs.existsSync(path.join(root, "js", name)) ? fs.readFileSync(path.join(root, "js", name), "utf8") : "" }))
    .filter((f) => f.src.length > 0);
  assert.ok(files.length >= 6, "运行源码文件过少");
  for (const file of files) {
    // 去掉注释后再查字符串字面量中的汉字；"中文" 是语言切换按钮的官方白名单字面量
    const code = file.src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/(["'`])中文\1/g, '""');
    const matches = code.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g) ?? [];
    assert.deepEqual(matches, [], `${file.name} 硬编码中文: ${matches.slice(0, 2).join(", ")}`);
  }
});

test("i18n: 60 关名 + 5 章名齐备且双语非空", () => {
  for (let i = 1; i <= 60; i++) {
    saveLocale("zh");
    assert.ok(typeof levelName(`level_${i}`) === "string" && levelName(`level_${i}`).length > 0, `level_${i} zh 缺失`);
    saveLocale("en");
    assert.ok(typeof levelName(`level_${i}`) === "string" && levelName(`level_${i}`).length > 0, `level_${i} en 缺失`);
  }
  for (let c = 1; c <= 5; c++) {
    saveLocale("zh");
    assert.ok(chapterName(c).includes(String(c)), `chapter_${c} zh 缺章号`);
    saveLocale("en");
    assert.ok(chapterName(c).toLowerCase().includes(String(c)), `chapter_${c} en 缺章号`);
  }
});

test("i18n: t() 插值正确", () => {
  saveLocale("zh");
  assert.equal(t("aria.levelCard", { n: 7, name: "回旋角" }), "第 7 关：回旋角");
  assert.equal(t("sr.moved", { level: 3, moves: 12, pushes: 5 }), "第 3 关：滑了 12 步，推箱 5 次");
  saveLocale("en");
  assert.equal(t("win.bestLine", { moves: 9, stars: 3 }), "Best: 9 moves - 3 stars");
});

test("i18n: 未知 key 回退原文不崩溃", () => {
  saveLocale("zh");
  assert.equal(t("no.such.key"), "no.such.key");
  assert.deepEqual(tList("no.such.list"), []);
});

test("i18n: 帮助列表 zh/en 长度一致且非空", () => {
  const keys = ["help.rulesList", "help.ctrlList", "help.keysList"];
  saveLocale("zh");
  const zhLens = keys.map((k) => tList(k).length);
  saveLocale("en");
  const enLens = keys.map((k) => tList(k).length);
  assert.deepEqual(zhLens, enLens);
  assert.ok(zhLens.every((n) => n >= 3));
});

test("i18n: 语言切换往返且可保存", () => {
  const l0 = getLocale();
  toggleLocale();
  assert.notEqual(getLocale(), l0);
  toggleLocale();
  assert.equal(getLocale(), l0);
  saveLocale("en");
  assert.equal(getLocale(), "en");
  saveLocale("zh");
});
