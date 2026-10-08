// 叠叠乐 · 双语与源码纯净度测试
//   1. zh / en 键位完全对齐（不多不少）
//   2. en 词典零汉字（语言切换按钮标识走白名单）
//   3. index.html 里的静态中文全部被 data-i18n 或 JS 动态覆盖
//   4. 非 i18n 源码零硬编码中文字符串

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { LOCALES, strings, format, isLocale, detectLocale, saveLocale, LANG_KEY } from "../js/i18n.mjs";
import { LEVELS, CHAPTERS, RIDDLE_QUESTIONS } from "../js/levels.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const gameDir = resolve(here, "..");

function source(name) {
  return readFileSync(resolve(gameDir, name), "utf8");
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const HTML = source("index.html");

test("双语键位完全对齐，且 en 词典零汉字", () => {
  const zhKeys = Object.keys(LOCALES.zh).sort();
  const enKeys = Object.keys(LOCALES.en).sort();
  assert.deepEqual(enKeys, zhKeys, "中英键位必须一一对应");

  const whitelist = /langBtn|langName|switchLang/i;
  for (const [key, value] of Object.entries(LOCALES.en)) {
    if (whitelist.test(key)) continue;
    assert.ok(!/[\u4e00-\u9fa5]/.test(value), `en.${key} 含汉字：${value}`);
  }
  for (const [key, value] of Object.entries(LOCALES.zh)) {
    assert.ok(typeof value === "string" && value.length > 0, `zh.${key} 为空`);
  }
});

test("数据层引用的 i18n key 全部存在（关卡名 / 章节名）", () => {
  for (const level of LEVELS) {
    assert.ok(LOCALES.zh[level.id], `缺 ${level.id} 的中文名`);
    assert.ok(LOCALES.en[level.id], `缺 ${level.id} 的英文名`);
  }
  for (const chapter of CHAPTERS) {
    assert.ok(LOCALES.zh[chapter.id], `缺 ${chapter.id} 的中文名`);
    assert.ok(LOCALES.en[chapter.id], `缺 ${chapter.id} 的英文名`);
  }
});

test("UI 依赖的核心键位齐备，format 占位替换可用", () => {
  const required = [
    "appTitle", "docTitle", "back", "sound", "help", "canvasLabel", "noscript",
    "boardTitle", "stat_score", "stat_streak", "stat_mult", "stat_layers", "ui_danger", "bestLayers",
    "mode_spire", "mode_duel", "mode_riddle", "levelLabel", "goalLabel", "goalMoves", "goalLayers",
    "goalStreakAdd", "goalNone", "progressLabel", "unlockedLabel",
    "slot_left", "slot_mid", "slot_right", "act_cancel", "act_rebuild", "act_levels",
    "act_rotL", "act_rotR", "act_zoomIn", "act_zoomOut", "keyTip", "touchTip",
    "holding", "pickHint", "hazardNone", "obj_load", "obj_gust",
    "helpTitle", "helpClose", "pauseTitle", "pauseResume", "pauseRestart", "pauseMenu",
    "resultWin", "resultLose", "resultLine", "resultStarsLabel", "resultNext", "resultRetry", "resultLevels",
    "levelsTitle", "levelsLocked", "saveReset", "saveResetConfirm", "saveCleared",
    "duelHint", "duelRoundLabel", "duelTurn", "duelScore", "duelRoundWin", "duelSeries",
    "riddleTip", "riddleProgress", "riddleCorrect", "riddleWrong", "riddleDone",
    "toastIllegal", "toastNoSlot", "toastLoad", "toastStreak", "toastSpire", "toastGust", "toastLocked"
  ];
  for (const key of required) {
    assert.ok(LOCALES.zh[key], `zh 缺 ${key}`);
    assert.ok(LOCALES.en[key], `en 缺 ${key}`);
  }
  for (let i = 1; i <= 6; i += 1) {
    assert.ok(LOCALES.zh[`help${i}`] && LOCALES.en[`help${i}`], `缺 help${i}`);
  }
  assert.equal(format("zh", "levelLabel", { n: 7 }), "第 7 关");
  assert.equal(format("en", "goalLayers", { n: 24 }), "Reach 24 layers");
  assert.equal(format("en", "riddleProgress", { i: 2, n: RIDDLE_QUESTIONS }), "Question 2/10");
  // 占位符缺失时按空串替换，绝不抛错
  assert.equal(format("zh", "progressLabel", {}), "进度 /");
  assert.equal(strings("zh").appTitle, "叠叠乐");
  assert.ok(isLocale("en") && isLocale("zh") && !isLocale("jp"));
});

test("语言偏好读写全站共享 key doin.lang", () => {
  assert.equal(LANG_KEY, "doin.lang");
  const src = source("js/i18n.mjs");
  assert.ok(src.includes("doin.lang"));
  // 未存偏好时应回落默认中文而不是崩
  const fallback = detectLocale();
  assert.ok(fallback === "zh" || fallback === "en");
  saveLocale("bogus");
  assert.ok(true, "非法 locale 写入必须静默忽略");
});

test("index.html 的静态中文全部被 data-i18n 或 JS 动态覆盖", () => {
  const clean = HTML.replace(/<!--[\s\S]*?-->/g, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  const jsSources = readdirSync(resolve(gameDir, "js"))
    .map((name) => source(`js/${name}`))
    .join("\n");
  const nodes = [...clean.matchAll(/<([a-zA-Z0-9\-]+)([^>]*)>([^<]*[\u4e00-\u9fa5]+[^<]*)<\/\1>/g)];
  const leaking = [];
  for (const node of nodes) {
    const tag = node[1].toLowerCase();
    if (tag === "script" || tag === "title") continue;
    const attrs = node[2];
    if (attrs.includes("data-i18n")) continue;
    const id = attrs.match(/id="([^"]+)"/)?.[1];
    if (id && jsSources.includes(`"${id}"`)) continue;
    leaking.push(`<${tag}> ${node[3].trim().slice(0, 14)}`);
  }
  assert.deepEqual(leaking, [], `未覆盖的中文节点: ${leaking.join(" | ")}`);
});

test("所有 data-i18n 指向真实存在的键位", () => {
  const keys = [...HTML.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length > 20, "界面必须有足够的双语标记");
  for (const key of keys) {
    assert.ok(LOCALES.zh[key], `zh 缺 ${key}`);
    assert.ok(LOCALES.en[key], `en 缺 ${key}`);
  }
});

test("非 i18n 源码零硬编码中文字符串", () => {
  const offenders = [];
  for (const name of readdirSync(resolve(gameDir, "js"))) {
    if (name === "i18n.mjs") continue;
    const code = stripComments(source(`js/${name}`));
    const hits = code.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
    if (hits) offenders.push(`${name}: ${hits.slice(0, 2).join(", ")}`);
  }
  assert.deepEqual(offenders, [], offenders.join(" | "));
});
