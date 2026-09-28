// 双语表与语言偏好契约。
// 这里有一条与 check-game 门禁同构的独立断言：strings.en 零汉字 + 运行源码零裸写中文。
// 门禁是"发布闸门"，这里是"开发期即时报警"，两边同时守着同一份硬约束。

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  LANG_KEY, LOCALES, LOCALE_ZH, LOCALE_EN, DEFAULT_LOCALE,
  CHAPTER_I18N, chapterTitleKey, chapterDescKey,
  isLocale, loadLocale, saveLocale, strings, format, htmlLang, detectLocale,
} from "../js/i18n.mjs";
import { TIER_KEYS } from "../js/ai.mjs";
import { CHAPTERS } from "../js/puzzles.mjs";

const eq = assert.strictEqual;
const here = dirname(fileURLToPath(import.meta.url));
const gameRoot = resolve(here, "..");

const HAN = /[\u4e00-\u9fa5]/;

// 语言切换按钮上的"中文"二字是唯一允许出现在非 i18n 文件里的汉字
// （check-game.mjs 的 i18n-clean 检查里带同一条白名单，别删）。
const LANG_TOKEN = /(["'`])中文\1/g;

function installStorage(entries = []) {
  const store = new Map(entries);
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  return store;
}

function withNavigator(value, fn) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { value, configurable: true, writable: true });
  try {
    return fn();
  } finally {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else delete globalThis.navigator;
  }
}

// ─── 语言偏好（全站共享 key）──────────────────────────────────────
test("LANG_KEY 是全站共享的 doin.lang，严禁私有 key", () => {
  eq(LANG_KEY, "doin.lang");
  eq(LOCALES.length, 2);
  eq(LOCALES[0], LOCALE_ZH);
  eq(LOCALES[1], LOCALE_EN);
  eq(DEFAULT_LOCALE, LOCALE_ZH);
});

test("isLocale 只认 zh / en", () => {
  eq(isLocale("zh"), true);
  eq(isLocale("en"), true);
  for (const bad of ["fr", "ZH", "", null, undefined, 0, {}, ["zh"]]) eq(isLocale(bad), false);
});

test("detectLocale：任何 zh 开头判中文，其余判英文", () => {
  eq(withNavigator({ languages: ["zh-CN", "en"], language: "zh-CN" }, detectLocale), LOCALE_ZH);
  eq(withNavigator({ languages: ["en-US", "zh"], language: "en-US" }, detectLocale), LOCALE_ZH);
  eq(withNavigator({ languages: ["zh-Hant-TW"], language: "zh-Hant-TW" }, detectLocale), LOCALE_ZH);
  eq(withNavigator({ languages: ["ja-JP"], language: "ja-JP" }, detectLocale), LOCALE_EN);
  eq(withNavigator({ languages: [], language: "" }, detectLocale), LOCALE_EN);
  eq(withNavigator(undefined, detectLocale), LOCALE_EN);
});

test("loadLocale：全站偏好优先于浏览器语言，损坏值回落浏览器语言", () => {
  withNavigator({ languages: ["zh-CN"], language: "zh-CN" }, () => {
    installStorage();
    eq(loadLocale(), LOCALE_ZH);

    installStorage([[LANG_KEY, "en"]]);
    eq(loadLocale(), LOCALE_EN);

    installStorage([[LANG_KEY, "garbage"]]);
    eq(loadLocale(), LOCALE_ZH);
  });
  withNavigator({ languages: ["en-US"], language: "en-US" }, () => {
    installStorage();
    eq(loadLocale(), LOCALE_EN);
  });
});

test("saveLocale：非法值拒绝写入；localStorage 抛错时静默返回 false", () => {
  const store = installStorage();
  eq(saveLocale("en"), true);
  eq(store.get(LANG_KEY), "en");
  eq(saveLocale("fr"), false);
  eq(store.get(LANG_KEY), "en"); // 非法值绝不覆盖既有偏好

  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => { throw new Error("quota exceeded"); },
    removeItem: () => {},
  };
  eq(saveLocale("en"), false);
});

test("htmlLang：zh → zh-CN，其余 → en", () => {
  eq(htmlLang("zh"), "zh-CN");
  eq(htmlLang("en"), "en");
  eq(htmlLang("ja"), "en");
  eq(htmlLang(null), "en");
});

// ─── 双表完整性 ───────────────────────────────────────────────────
test("zh / en 键完全对齐、类型一致、均非空", () => {
  const zh = strings("zh");
  const en = strings("en");
  assert.deepStrictEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  for (const [key, value] of Object.entries(zh)) {
    eq(typeof value, "string", `zh.${key} 必须是非空字符串`);
    assert.ok(value.length > 0, `zh.${key} 不能是空串`);
    eq(typeof en[key], "string", `en.${key} 必须与 zh.${key} 同为字符串`);
    assert.ok(en[key].length > 0, `en.${key} 不能是空串`);
  }
});

test("strings.en 零汉字（语言切换按钮除外）", () => {
  const offenders = Object.entries(strings("en"))
    .filter(([key, value]) => HAN.test(value) && !/langLabel|langShort/i.test(key))
    .map(([key]) => key);
  assert.deepStrictEqual(offenders, []);
});

test("strings：非法 locale 一律回落默认语言", () => {
  eq(strings("fr"), strings(DEFAULT_LOCALE));
  eq(strings(undefined), strings(DEFAULT_LOCALE));
  eq(strings(null), strings(DEFAULT_LOCALE));
});

test("PRD §3.7 词汇表的数据键在两语表里都齐全", () => {
  const vocab = [
    "mode_play", "mode_puzzle", "mode_rush", "mode_setup",
    "ai_novice", "ai_duelist", "ai_virtuoso", "ai_infallible",
    "open_standard", "open_diagonal", "open_perp", "open_parallel", "open_random",
    "ch_corner", "ch_trap", "ch_starve", "ch_cascade", "ch_comeback", "ch_endgame",
    "disc_black", "disc_white",
    "sq_corner", "sq_x", "sq_c", "sq_edge", "sq_inner",
    "st_pass", "st_end", "st_draw", "st_perfect",
    "stat_maxflip", "stat_swing", "stat_combo",
    "ach_flip_eye",
  ];
  const zh = strings("zh");
  const en = strings("en");
  for (const key of vocab) {
    assert.ok(typeof zh[key] === "string" && zh[key].length > 0, `zh.${key} 缺失`);
    assert.ok(typeof en[key] === "string" && en[key].length > 0, `en.${key} 缺失`);
  }
});

test("AI 档位键与 engine 的棋格类型都能查到文案（跨模块契约）", () => {
  const zh = strings("zh");
  const en = strings("en");
  for (const tier of TIER_KEYS) {
    assert.ok(zh[`ai_${tier}`] && en[`ai_${tier}`], `档位 ${tier} 缺 ai_${tier}`);
  }
  for (const kind of ["corner", "x", "c", "edge", "inner"]) {
    assert.ok(zh[`sq_${kind}`] && en[`sq_${kind}`], `棋格类型 ${kind} 缺 sq_${kind}`);
  }
});

test("章节桥接表：题库的每个 chapterKey 都有标题与教学说明", () => {
  const zh = strings("zh");
  const en = strings("en");
  eq(Object.keys(CHAPTER_I18N).length, CHAPTERS.length);
  for (const chapter of CHAPTERS) {
    const titleKey = chapterTitleKey(chapter.key);
    const descKey = chapterDescKey(chapter.key);
    assert.ok(titleKey, `chapterKey ${chapter.key} 未登记文案`);
    assert.ok(zh[titleKey] && en[titleKey], `${titleKey} 缺翻译`);
    assert.ok(zh[descKey] && en[descKey], `${descKey} 缺翻译`);
  }
  eq(chapterTitleKey("nope"), null);
  eq(chapterDescKey("nope"), null);
});

// ─── 插值 ─────────────────────────────────────────────────────────
test("format：命名占位符插值，缺参退空串，无占位符原样返回", () => {
  eq(format("第 {n} 手", { n: 3 }), "第 3 手");
  eq(format("Move {n} of {total}", { n: 2, total: 9 }), "Move 2 of 9");
  eq(format("第 {n} 手"), "第  手");
  eq(format("第 {n} 手", {}), "第  手");
  eq(format("hello world"), "hello world");
  eq(format("+{n}", { n: 0 }), "+0"); // 0 是合法取值，不能被当成缺参
});

// ─── 源码零裸写中文（与门禁 i18n-clean 同构）──────────────────────
function collectSources(directory, out = []) {
  for (const name of readdirSync(directory)) {
    if (name === "node_modules" || name === "dist" || name === "tests") continue;
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      collectSources(path, out);
      continue;
    }
    if (/\.(mjs|js|ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

// 与 check-game.mjs 完全一致的注释剥离（中文注释允许存在，只有字符串字面量受约束）。
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("运行源码零裸写中文：展示文案必须全部走 i18n 查表", () => {
  const files = collectSources(gameRoot);
  assert.ok(files.length >= 8, `扫描到的源码文件过少（${files.length}），路径可能写错`);
  const offenders = [];
  for (const file of files) {
    const rel = relative(gameRoot, file).replace(/\\/g, "/");
    if (rel === "js/i18n.mjs") continue; // 双语表的正文就是文案
    const code = stripComments(readFileSync(file, "utf8")).replace(LANG_TOKEN, '""');
    const hits = code.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
    if (hits) offenders.push(`${rel}: ${hits.slice(0, 2).join(", ")}`);
  }
  assert.deepStrictEqual(offenders, []);
});

test("i18n 模块自身也必须 DOM-free：不用 location.reload 打断对局", () => {
  const source = readFileSync(join(gameRoot, "js", "i18n.mjs"), "utf8");
  assert.ok(!stripComments(source).includes("location.reload"));
});
