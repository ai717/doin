// i18n.test.mjs —— 双语表验收：键集合、占位符、英文表零汉字、源码零裸写中文。
//
// 坑（照抄前务必看）：
//   1) 语言偏好走全站共享 key localStorage["doin.lang"]，这里用假实现覆盖 globalThis.localStorage，
//      每条用例结束必须还原，否则上一条存的 en 会串到下一条。
//   2) zh/en 的 {占位符} 集合必须逐键一致：少一个花括号，英文界面就会把 "{n}" 直接印给玩家。
//   3) 源码扫描要排除 i18n.mjs 自己（zh 表本来就是中文）与 tools/（生成器的诊断输出不在页面上）。

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import {
  LANG_KEY,
  LOCALES,
  DEFAULT_LOCALE,
  GHOST_NAMES,
  GHOST_STATE,
  MAZE_NAME,
  TIP_NAME,
  TIP_DESC,
  isLocale,
  strings,
  ghostName,
  ghostStateName,
  mazeName,
  tipName,
  tipDesc,
  detectLocale,
  loadLocale,
  saveLocale,
  htmlLang,
  format,
  applyLocale,
} from "../js/i18n.mjs";
import { GHOST_IDS } from "../js/engine.mjs";
import { MAZES, SETPIECE_GOALS } from "../js/mazes.mjs";

const ROOT = new URL("../", import.meta.url);
const CJK = /[㐀-䶿一-鿿豈-﫿]/;

// ---------------------------------------------------------------- 假环境

const store = new Map();
let broken = false;

const fake = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => {
    if (broken) throw new Error("SecurityError");
    store.set(k, String(v));
  },
  removeItem: (k) => store.delete(k),
};

function withStorage(body) {
  const prev = globalThis.localStorage;
  globalThis.localStorage = fake;
  store.clear();
  broken = false;
  try {
    return body();
  } finally {
    if (prev === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prev;
    store.clear();
    broken = false;
  }
}

function withNavigator(language, body) {
  const prev = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    value: language === null ? undefined : { language },
    configurable: true,
    writable: true,
  });
  try {
    return body();
  } finally {
    if (prev) Object.defineProperty(globalThis, "navigator", prev);
    else delete globalThis.navigator;
  }
}

function placeholders(v) {
  return (v.match(/\{\w+\}/g) ?? []).sort().join(",");
}

/** 剥掉行注释与块注释：中文注释是允许的，裸写在字符串里的中文才违规 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

/** 英文表唯一允许的汉字：语言切换按钮上写"中文"，否则玩家不知道点它能切回来 */
const EN_CJK_WHITELIST = new Set(["langSwitch"]);

// ---------------------------------------------------------------- 表结构

test("语言口径与全站共享 key 对齐", () => {
  assert.equal(LANG_KEY, "doin.lang", "必须用门户共享 key，不许自造语言 key");
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.ok(LOCALES.includes(DEFAULT_LOCALE));
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(isLocale(undefined), false);
  assert.equal(strings("fr"), strings(DEFAULT_LOCALE), "未知语言回落默认表而不是 undefined");
  assert.equal(htmlLang("en"), "en");
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("nope"), "zh-CN");
});

test("中英两份表逐键对齐：不漏键、不留空、值全是字符串", () => {
  const zh = strings("zh");
  const en = strings("en");
  const zhKeys = Object.keys(zh);
  const enKeys = Object.keys(en);
  assert.ok(zhKeys.length >= 80, `词条太少（${zhKeys.length}），像是漏抄了一整段`);
  assert.deepEqual(zhKeys.filter((k) => !enKeys.includes(k)), [], "zh 有 en 没有");
  assert.deepEqual(enKeys.filter((k) => !zhKeys.includes(k)), [], "en 有 zh 没有");
  for (const [locale, table] of [["zh", zh], ["en", en]]) {
    for (const [k, v] of Object.entries(table)) {
      assert.equal(typeof v, "string", `${locale}.${k} 不是字符串`);
      assert.ok(v.trim().length > 0, `${locale}.${k} 是空串`);
      assert.ok(!/\s$/.test(v), `${locale}.${k} 结尾留了空白`);
    }
  }
});

test("占位符逐键对齐：{n} 这类插值两语必须同集合", () => {
  const zh = strings("zh");
  const en = strings("en");
  for (const k of Object.keys(zh)) {
    assert.equal(
      placeholders(zh[k]),
      placeholders(en[k]),
      `${k} 的占位符不对齐：zh="${placeholders(zh[k])}" en="${placeholders(en[k])}"`,
    );
  }
  const used = Object.keys(zh).filter((k) => placeholders(zh[k]));
  assert.ok(used.length >= 6, "至少该有若干带插值的词条，否则这条闸门形同虚设");
});

test("英文表零汉字（硬性红线：严禁英文界面夹杂中文）", () => {
  const en = strings("en");
  for (const [k, v] of Object.entries(en)) {
    if (EN_CJK_WHITELIST.has(k)) continue;
    assert.equal(CJK.test(v), false, `en.${k} 里出现了汉字：${v}`);
  }
  assert.ok(CJK.test(en.langSwitch), "切换按钮上必须写明「中文」，否则英文站玩家看不懂");
  for (const [k, v] of Object.entries(GHOST_NAMES.en)) {
    assert.equal(CJK.test(v), false, `英文名 ${k} 出现汉字：${v}`);
  }
  for (const [k, v] of Object.entries(GHOST_STATE.en)) {
    assert.equal(CJK.test(v), false, `英文状态名 ${k} 出现汉字：${v}`);
  }
  for (const [k, v] of Object.entries(MAZE_NAME.en)) {
    assert.equal(CJK.test(v), false, `英文迷宫名 ${k} 出现汉字：${v}`);
  }
  for (const [k, v] of Object.entries(TIP_NAME.en)) {
    assert.equal(CJK.test(v), false, `英文机关名 ${k} 出现汉字：${v}`);
  }
  for (const [k, v] of Object.entries(TIP_DESC.en)) {
    assert.equal(CJK.test(v), false, `英文机关说明 ${k} 出现汉字：${v}`);
  }
});

test("幽灵名牌：四只齐备且英文名不撞车", () => {
  assert.deepEqual(Object.keys(GHOST_NAMES.zh).sort(), [...GHOST_IDS].sort(), "名牌键必须就是引擎的幽灵 id");
  assert.deepEqual(Object.keys(GHOST_NAMES.en).sort(), [...GHOST_IDS].sort());
  for (const id of GHOST_IDS) {
    assert.ok(ghostName("zh", id).length > 0, `zh 缺 ${id} 的名字`);
    assert.ok(ghostName("en", id).length > 0, `en 缺 ${id} 的名字`);
  }
  assert.equal(new Set(Object.values(GHOST_NAMES.en)).size, GHOST_IDS.length, "英文名不能撞车");
  assert.equal(ghostName("en", "no-such-ghost", "备用名"), "备用名", "查不到时用引擎带来的名字兜底");
  assert.equal(ghostName("fr", "blinky"), GHOST_NAMES[DEFAULT_LOCALE].blinky, "未知语言回落默认表");
});

test("幽灵状态名覆盖引擎全部 mode，未知键原样回显", () => {
  const modes = ["scatter", "chase", "frightened", "eaten", "caging", "exiting"];
  for (const locale of LOCALES) {
    for (const k of modes) {
      assert.ok(GHOST_STATE[locale][k], `${locale} 缺状态名 ${k}`);
      assert.equal(ghostStateName(locale, k), GHOST_STATE[locale][k]);
    }
  }
  assert.equal(ghostStateName("zh", "未知状态"), "未知状态", "查不到时原样回显，绝不空白");
  assert.equal(ghostStateName("en", "unknown"), "unknown");
});

test("迷宫主题名与 mazes.mjs 的 meta.key 一一对应", () => {
  const keys = new Set(MAZES.map((m) => m.meta.key));
  assert.ok(keys.size >= 7, "七张迷宫应有各自的主题键");
  for (const k of keys) {
    for (const locale of LOCALES) {
      assert.ok(mazeName(locale, k).length > 0, `${locale} 缺迷宫名 ${k}`);
    }
  }
  assert.equal(mazeName("zh", "no-such-key", "备用"), "备用");
  assert.equal(mazeName("fr", MAZES[0].meta.key), MAZE_NAME[DEFAULT_LOCALE][MAZES[0].meta.key]);
});

test("机关名与说明覆盖 mazes.mjs 的全部 tips，外加双巢与永不巡游", () => {
  const tips = new Set(MAZES.flatMap((m) => m.meta.tips ?? []));
  for (const m of MAZES) {
    if (m.nests.length > 1) tips.add("secondNest");
    if (m.id === "maze_7") tips.add("neverScatter");
  }
  assert.ok(tips.size >= 6, `机关种类太少（${tips.size}）`);
  for (const k of tips) {
    for (const locale of LOCALES) {
      assert.ok(tipName(locale, k).length > 0, `${locale} 缺机关名 ${k}`);
      assert.ok(tipDesc(locale, k).length > 0, `${locale} 缺机关说明 ${k}`);
    }
  }
  assert.equal(tipName("zh", "nope", "备用"), "备用");
});

test("三种残局目标都有名字与提示文案", () => {
  for (const goal of SETPIECE_GOALS) {
    const nameKey = `goal${goal[0].toUpperCase()}${goal.slice(1)}`;
    const hintKey = `goalHint${goal[0].toUpperCase()}${goal.slice(1)}`;
    for (const locale of LOCALES) {
      const s = strings(locale);
      assert.ok(s[nameKey], `${locale} 缺残局目标名 ${nameKey}`);
      assert.ok(s[hintKey], `${locale} 缺残局提示 ${hintKey}`);
    }
  }
});

// ---------------------------------------------------------------- 偏好读写

test("语言偏好只走 doin.lang，脏值与不可用都要静默降级", () => {
  return withStorage(() => {
    assert.equal(detectLocale(), DEFAULT_LOCALE, "空档时用默认语言");
    assert.equal(saveLocale("en"), "en");
    assert.equal(store.get(LANG_KEY), "en");
    assert.equal(detectLocale(), "en");
    assert.equal(loadLocale(), "en");
    assert.equal(saveLocale("klingon"), DEFAULT_LOCALE, "非法语言不该写进共享 key");
    assert.equal(store.get(LANG_KEY), "en", "非法值也不能覆盖已存的好值");

    store.set(LANG_KEY, "zh-tw");
    assert.equal(detectLocale(), DEFAULT_LOCALE, "脏值回落默认而不是原样返回");
    store.set(LANG_KEY, "");
    assert.equal(detectLocale(), DEFAULT_LOCALE);

    broken = true;
    assert.equal(saveLocale("en"), "en", "写不进去也要把语言还回去，界面照常切换");
    assert.equal(detectLocale(), DEFAULT_LOCALE, "读异常静默降级");
    broken = false;
  });
});

test("localStorage 整体缺席时靠浏览器语言，最后才回落默认", () => {
  const prev = globalThis.localStorage;
  delete globalThis.localStorage;
  try {
    assert.equal(withNavigator("en-US", detectLocale), "en");
    assert.equal(withNavigator("zh-CN", detectLocale), "zh");
    assert.equal(withNavigator("zh-TW", detectLocale), "zh", "繁体也归到中文表");
    assert.equal(withNavigator("de-DE", detectLocale), "en", "非中文一律按英文站走");
    assert.equal(withNavigator(null, detectLocale), DEFAULT_LOCALE, "连 navigator 都没有时回落默认");
    assert.equal(withNavigator(null, () => saveLocale("zh")), "zh", "存不了也别抛错");
  } finally {
    if (prev === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prev;
  }
});

// ---------------------------------------------------------------- 插值与 DOM

test("format：只替换传进来的占位符，未知的原样留着", () => {
  assert.equal(format(strings("zh").hudLevel, { n: 3 }), "第 3 关");
  assert.equal(format(strings("en").hudLevel, { n: 3 }), "Round 3");
  assert.equal(format("共 {a} 与 {b}", { a: 1 }), "共 1 与 {b}", "缺参数不炸，保留花括号便于排查");
  assert.equal(format("无插值"), "无插值");
  assert.equal(format("值可以是 {n}", { n: "0" }), "值可以是 0", "falsy 的参数也要真的替进去");
  assert.equal(format("自有 {toString}", { toString: "x" }), "自有 x");
  assert.equal(
    format("继承来的 {toString}", Object.create({ toString: "x" })),
    "继承来的 {toString}",
    "只认自有属性，绝不从原型链上白捡值",
  );
  assert.equal(format(undefined, { n: 1 }), "");
  assert.equal(format(42, { n: 1 }), "");
});

test("applyLocale：三类属性各写各的地方，缺键不动 DOM", () => {
  const made = (n) =>
    Array.from({ length: n }, () => ({
      dataset: {},
      textContent: "",
      _attrs: {},
      setAttribute(k, v) {
        this._attrs[k] = v;
      },
    }));
  const text = made(2);
  const title = made(1);
  const aria = made(1);
  text[0].dataset.i18n = "appTitle";
  text[1].dataset.i18n = "no-such-key";
  title[0].dataset.i18nTitle = "sound";
  aria[0].dataset.i18nAria = "back";
  const root = {
    querySelectorAll: (sel) =>
      sel === "[data-i18n]" ? text : sel === "[data-i18n-title]" ? title : sel === "[data-i18n-aria]" ? aria : [],
  };

  const s = applyLocale(root, "en");
  assert.equal(text[0].textContent, strings("en").appTitle);
  assert.equal(text[1].textContent, "", "查不到的键不该把节点清空");
  assert.equal(title[0]._attrs.title, strings("en").sound);
  assert.equal(aria[0]._attrs["aria-label"], strings("en").back);
  assert.equal(s, strings("en"), "顺手把表还回去，省一次查询");

  applyLocale(root, "zh");
  assert.equal(text[0].textContent, strings("zh").appTitle, "原地热更新，不重建节点");

  assert.equal(applyLocale(null, "zh"), strings("zh"), "没有根节点也要把表还回来");
  assert.equal(applyLocale({}, "en"), strings("en"), "根节点不支持查询时静默跳过");
});

// ---------------------------------------------------------------- 源码零裸写中文

test("源码零裸写中文：js/ 下除 i18n.mjs 外，注释以外不得出现汉字", () => {
  const files = readdirSync(new URL("js", ROOT)).filter((f) => f.endsWith(".mjs") && f !== "i18n.mjs");
  assert.ok(files.length >= 3, "扫描到的源码文件太少，像是路径写错了");
  let scanned = 0;
  for (const f of files) {
    const src = stripComments(readFileSync(new URL(`js/${f}`, ROOT), "utf8"));
    scanned += src.length;
    src.split(/\r?\n/).forEach((line, i) => {
      assert.equal(CJK.test(line), false, `${f}:${i + 1} 出现裸写中文：${line.trim().slice(0, 40)}`);
    });
  }
  assert.ok(scanned > 2000, "剥注释后剩下的源码太少，像是正则把整份文件吃掉了");
});

test("数据层零中文：mazes.mjs 与迷宫 meta 里不得有汉字", () => {
  const src = stripComments(readFileSync(new URL("js/mazes.mjs", ROOT), "utf8"));
  assert.equal(CJK.test(src), false, "mazes.mjs 出现汉字");
  for (const m of MAZES) {
    assert.equal(CJK.test(JSON.stringify(m.meta)), false, `${m.id} 的 meta 出现汉字`);
    assert.match(m.meta.key, /^[a-z]+$/, `${m.id} 的主题键必须是纯英文小写`);
  }
});
