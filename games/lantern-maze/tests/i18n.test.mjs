// i18n.test.mjs —— 双语表对齐验收：键集合、占位符、空值，以及"页面/代码里引用的每个键都真的存在"。
//
// 用法（在项目根跑）：
//   node --test games/lantern-maze/tests/i18n.test.mjs
// 坑：
//   1) 语言偏好必须走全站共享 key localStorage["doin.lang"]，本文件用假实现覆盖 globalThis.localStorage，
//      绝不碰真机浏览器存储；用例之间要 reset，否则上一条存的 en 会串到下一条的 detectLocale。
//   2) zh 与 en 的 {占位符} 集合必须逐键一致 —— 少一个花括号，英文界面就会把 "{n}" 直接印给玩家。
//   3) 页面引用扫描是"读源码"而不是"跑 DOM"：ui.mjs 里动态拼出来的 key 扫不到，那种一律走 strings(locale) 取值。

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import {
  LANG_KEY,
  LOCALES,
  DEFAULT_LOCALE,
  GHOST_NAMES,
  GHOST_STATE,
  isLocale,
  strings,
  ghostName,
  ghostStateName,
  detectLocale,
  loadLocale,
  saveLocale,
  htmlLang,
  format,
  applyLocale,
} from "../js/i18n.mjs";
import { ROSTERS, LAYOUTS } from "../js/levels.mjs";
import { ghostStateKey, createState, intent, stepFrame } from "../js/engine.mjs";

const ROOT = new URL("../", import.meta.url);

// ---------------------------------------------------------------- 假 localStorage

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
  const prevLs = globalThis.localStorage;
  globalThis.localStorage = fake;
  store.clear();
  broken = false;
  try {
    return body();
  } finally {
    if (prevLs === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevLs;
    store.clear();
    broken = false;
  }
}

/** Node 里 navigator 是只读访问器，只能用 defineProperty 换掉，测完按原描述符装回去 */
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

/** zh/en 两份表：{ key: 值 } */
function bothLocaleTables() {
  return LOCALES.map((l) => [l, strings(l)]);
}

function placeholders(v) {
  return (v.match(/\{\w+\}/g) ?? []).sort().join(",");
}

// ---------------------------------------------------------------- 表结构

test("语言口径与全站共享 key 对齐", () => {
  assert.equal(LANG_KEY, "doin.lang", "必须用门户共享 key，不许自造语言 key");
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.ok(LOCALES.includes(DEFAULT_LOCALE));
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(isLocale(undefined), false);
  assert.equal(isLocale(null), false);
  assert.equal(strings("fr"), strings(DEFAULT_LOCALE), "未知语言回落到默认表而不是 undefined");
  assert.equal(strings(undefined), strings(DEFAULT_LOCALE));
  assert.equal(htmlLang("en"), "en");
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("nope"), "zh-CN");
});

test("中英两份表逐键对齐：不漏键、不留空、值全是字符串", () => {
  const tables = bothLocaleTables();
  const [zhKey, zh] = tables[0];
  const en = tables[1][1];
  const zhKeys = Object.keys(zh);
  const enKeys = Object.keys(en);
  assert.ok(zhKeys.length >= 100, `词条太少（${zhKeys.length}），像是漏抄了一整段`);
  assert.deepEqual(
    zhKeys.filter((k) => !enKeys.includes(k)),
    [],
    "zh 有 en 没有"
  );
  assert.deepEqual(
    enKeys.filter((k) => !zhKeys.includes(k)),
    [],
    "en 有 zh 没有"
  );
  for (const [locale, table] of tables) {
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
      `${k} 的占位符不对齐：zh="${placeholders(zh[k])}" en="${placeholders(en[k])}"`
    );
  }
  const used = Object.keys(zh).filter((k) => placeholders(zh[k]));
  assert.ok(used.length >= 6, "至少该有若干带插值的词条，否则这条闸门形同虚设");
});

test("影魅名牌：颜色齐全，且覆盖关卡表与巡游追加用到的每一种颜色", () => {
  const zh = GHOST_NAMES.zh;
  const en = GHOST_NAMES.en;
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
  const inRosters = new Set(Object.values(ROSTERS).flat().map((g) => g.color));
  for (const color of inRosters) {
    assert.ok(zh[color], `关卡表用到 ${color}，zh 名牌却缺`);
    assert.ok(en[color], `关卡表用到 ${color}，en 名牌却缺`);
  }
  assert.ok(inRosters.size >= 6, "影魅配色样本太少，像是关卡表退化");
  assert.equal(ghostName("zh", "red"), zh.red);
  assert.equal(ghostName("en", "red"), en.red);
  assert.equal(ghostName("en", "unknown-color", "备用名"), "备用名", "查不到颜色时用引擎带来的名字兜底");
  assert.equal(ghostName("fr", "cyan"), GHOST_NAMES[DEFAULT_LOCALE].cyan, "未知语言回落默认表");
  const enNames = new Set(Object.values(en));
  assert.equal(enNames.size, Object.keys(en).length, "英文名不能撞车");
});

test("影魅状态名：与 engine.ghostStateKey() 的口径一一对应", () => {
  const state = createState({ rows: LAYOUTS.alley, seed: 3, mode: "campaign" });
  const roamed = makeSt(state, "normal");
  const keys = [
    ghostStateKey(state, makeSt(state, "house")),
    ghostStateKey(state, makeSt(state, "exiting")),
    ghostStateKey(state, makeSt(state, "eyes")),
    ghostStateKey(state, makeSt(state, "fright")),
    ghostStateKey({ ...state, phaseKind: "scatter" }, roamed),
    ghostStateKey({ ...state, phaseKind: "chase" }, roamed),
  ];
  const expect = ["house", "exiting", "eyes", "fright", "scatter", "chase"];
  assert.deepEqual([...new Set(keys)].sort(), expect.sort(), "引擎产出的状态键与 i18n 表必须严格对齐");
  assert.equal(ghostStateKey(state, state.ghosts.find((g) => g.st === "house")), "house");
  for (const locale of LOCALES) {
    for (const k of expect) {
      assert.ok(GHOST_STATE[locale][k], `${locale} 缺状态名 ${k}`);
      assert.equal(ghostStateName(locale, k), GHOST_STATE[locale][k]);
    }
  }
  assert.equal(ghostStateName("zh", "未知状态"), "未知状态", "查不到时原样回显，绝不空白");
});

/** 借一只真影魅改状态，只为了问 ghostStateKey 要一个键 */
function makeSt(state, st) {
  const g = state.ghosts[0];
  const prev = g.st;
  g.st = st;
  const probe = { ...g };
  g.st = prev;
  return probe;
}

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
  const prevLs = globalThis.localStorage;
  delete globalThis.localStorage;
  try {
    assert.equal(withNavigator("en-US", detectLocale), "en");
    assert.equal(withNavigator("zh-CN", detectLocale), "zh");
    assert.equal(withNavigator("zh-TW", detectLocale), "zh", "繁体也归到中文表");
    assert.equal(withNavigator("de-DE", detectLocale), "en", "非中文一律按英文站走");
    assert.equal(withNavigator(null, detectLocale), DEFAULT_LOCALE, "连 navigator 都没有时回落默认");
    assert.equal(withNavigator(null, () => saveLocale("zh")), "zh", "存不了也别抛错");
  } finally {
    if (prevLs === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevLs;
  }
});

// ---------------------------------------------------------------- 插值

test("format：只替换传进来的占位符，未知的原样留着", () => {
  assert.equal(format(strings("zh").hudLevel, { n: 3 }), "第 3 更");
  assert.equal(format(strings("en").hudLevel, { n: 3 }), "Watch 3");
  assert.equal(format("共 {a} 与 {b}", { a: 1 }), "共 1 与 {b}", "缺参数不炸，保留花括号便于排查");
  assert.equal(format("无插值", { a: 1 }), "无插值");
  assert.equal(format("无插值"), "无插值");
  assert.equal(format("值可以是 {n}", { n: "0" }), "值可以是 0", "falsy 的参数也要真的替进去");
  assert.equal(format("自有 {toString}", { toString: "x" }), "自有 x");
  assert.equal(
    format("继承来的 {toString}", Object.create({ toString: "x" })),
    "继承来的 {toString}",
    "只认自有属性，绝不从原型链上白捡值"
  );
  assert.equal(format(undefined, { n: 1 }), "");
  assert.equal(format(42, { n: 1 }), "");
});

// ---------------------------------------------------------------- DOM 契约

test("index.html 里每个 data-i18n* 键都能在两份表里查到", () => {
  const html = readFileSync(new URL("index.html", ROOT), "utf8");
  const hits = [...html.matchAll(/data-i18n(-title|-aria)?="([^"]+)"/g)].map((m) => m[2]);
  assert.ok(hits.length >= 60, `页面挂的翻译键太少（${hits.length}），像是正则没扫到`);
  const zh = strings("zh");
  const en = strings("en");
  for (const k of new Set(hits)) {
    assert.ok(k in zh, `index.html 引用了 zh 表里没有的键：${k}`);
    assert.ok(k in en, `index.html 引用了 en 表里没有的键：${k}`);
  }
});

test("js 代码里 tr(\"key\") 引用的键同样两语齐备", () => {
  const files = readdirSync(new URL("js", ROOT)).filter((f) => f.endsWith(".mjs"));
  const zh = strings("zh");
  const en = strings("en");
  let total = 0;
  for (const f of files) {
    const src = readFileSync(new URL(`js/${f}`, ROOT), "utf8");
    for (const m of src.matchAll(/\b(?:tr|t)\("([a-zA-Z0-9]+)"\)/g)) {
      total += 1;
      assert.ok(m[1] in zh, `${f} 引用了 zh 表里没有的键：${m[1]}`);
      assert.ok(m[1] in en, `${f} 引用了 en 表里没有的键：${m[1]}`);
    }
  }
  assert.ok(total >= 20, `代码里查到的翻译键太少（${total}），像是引用写法变了`);
});

test("applyLocale：三类属性各写各的地方，缺键不动 DOM", () => {
  const made = (n) => Array.from({ length: n }, () => ({ dataset: {}, textContent: "", _attrs: {}, setAttribute(k, v) { this._attrs[k] = v; } }));
  const text = made(2);
  const title = made(1);
  const aria = made(1);
  text[0].dataset.i18n = "appTitle";
  text[1].dataset.i18n = "no-such-key";
  title[0].dataset.i18nTitle = "sound";
  aria[0].dataset.i18nAria = "back";
  const roots = {
    querySelectorAll: (sel) =>
      sel === "[data-i18n]" ? text : sel === "[data-i18n-title]" ? title : sel === "[data-i18n-aria]" ? aria : [],
  };

  const s = applyLocale(roots, "en");
  assert.equal(text[0].textContent, strings("en").appTitle);
  assert.equal(text[1].textContent, "", "查不到的键不该把节点清空");
  assert.equal(title[0]._attrs.title, strings("en").sound);
  assert.equal(aria[0]._attrs.ariaLabel ?? aria[0]._attrs["aria-label"], strings("en").back);
  assert.equal(s, strings("en"), "顺手把表还回去，省一次查询");

  applyLocale(roots, "zh");
  assert.equal(text[0].textContent, strings("zh").appTitle);

  assert.equal(applyLocale(null, "zh"), strings("zh"), "没有根节点也要把表还回来");
  assert.equal(applyLocale({}, "en"), strings("en"), "根节点不支持查询时静默跳过");
});

test("整站切换语言后，引擎与界面口径仍然自洽（影子冒烟）", () => {
  return withStorage(() => {
    saveLocale("en");
    const locale = loadLocale();
    assert.equal(locale, "en");
    const s = strings(locale);
    const state = createState({ rows: LAYOUTS.alley, seed: 9, mode: "campaign" });
    state.status = "running";
    state.readyMs = 0;
    intent(state, { type: "turn", dir: "left" });
    for (let t = 0; t < 600; t += 1) stepFrame(state, 1000 / 60);
    assert.equal(s.appTitle, "Lantern Lane");
    for (const g of state.ghosts) {
      const name = ghostName(locale, g.color, g.name);
      assert.ok(name && !/[一-龥]/.test(name), `英文界面漏出中文名：${name}`);
      assert.ok(ghostStateName(locale, ghostStateKey(state, g)).length > 0);
    }
  });
});
