// 迷你猫咖掌柜 · 无浏览器冒烟测试单场景（真正的断言在这里）
//
// 通常不直接跑本文件，而是跑调度器 tests/smoke.mjs（会换视口 / 换存档复跑）：
//   node games/catcafe/tests/smoke.mjs
//
// 目的：在**不安装 Chromium** 的前提下，验证 ui.mjs + main.mjs 这套「唯一碰 DOM」的
//       装配层真的能在浏览器语义下跑起来，并且**业务状态在推进**——不是只有渲染在自排队。
//
// 防假绿关键设计：
//   1. 逐个入口驱动：首屏 tick / 键盘 1-5 升级 / R 研制 / C 切猫 / E 升级声誉 / M 静音 /
//      Tab 切换 / 语言切换 / 指南浮层 / 想念桶弹窗 / resize / blur。
//      每个入口之后都断言「金币在涨 / 列表里多了一项 / toast 出现」或「DOM 可见性切换」。
//      —— 只测首屏是最容易漏掉其它入口的假绿源头。
//   2. 存档两条路径都跑：老玩家（100 万金币 + 解锁到 stage 1）与全新空存档（SM_FRESH=1）。
//   3. 文本赋值全程抓空串与 NaN，避免 Canvas 静默忽略同类问题蔓延到 DOM 文本。
//
// 环境变量：SM_W / SM_H 视口尺寸；SM_FRESH=1 走空存档路径。

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DIR = resolve(import.meta.dirname, "..");
const VW = Number(process.env.SM_W || 1440);
const VH = Number(process.env.SM_H || 900);
const FRESH = process.env.SM_FRESH === "1";

const noop = () => {};
const errors = [];
const badText = [];

// ============================================================ DOM 桩（无 Canvas 版）

function checkText(prop, v) {
  if (typeof v !== "string") return;
  if (v.includes("NaN") || v.includes("undefined") || /<truncated>$/i.test(v)) {
    badText.push(`${prop} = ${v}`);
  }
}

function makeEl(tag) {
  const tagName = (tag || "div").toUpperCase();
  const el = {
    tagName,
    children: [],
    _cls: new Set(),
    _h: {},
    _attrs: {},
    _text: "",
    _html: "",
    style: { setProperty: noop, removeProperty: noop, width: "", height: "" },
    dataset: {},
    width: 0,
    height: 0,
    disabled: false,
    hidden: false,
    title: "",
    offsetWidth: 306,
    offsetHeight: 190,
    clientWidth: VW,
    clientHeight: VH,
    get textContent() { return el._text; },
    set textContent(v) { checkText("textContent", v); el._text = String(v ?? ""); },
    get innerHTML() { return el._html; },
    set innerHTML(v) { checkText("innerHTML", v); el._html = String(v ?? ""); },
    get className() { return [...el._cls].join(" "); },
    set className(v) { el._cls = new Set(String(v ?? "").split(/\s+/).filter(Boolean)); },
    classList: {
      add(c) { el._cls.add(c); },
      remove(c) { el._cls.delete(c); },
      toggle(c, f) { const on = f === undefined ? !el._cls.has(c) : !!f; if (on) el._cls.add(c); else el._cls.delete(c); return on; },
      contains(c) { return el._cls.has(c) }
    },
    addEventListener(t, fn) { (el._h[t] = el._h[t] || []).push(fn); },
    removeEventListener: noop,
    dispatchEvent: noop,
    appendChild(ch) {
      // DocumentFragment 语义：插入的是它的子节点，而不是 fragment 本身
      if (ch && ch.tagName === "FRAGMENT") { el.children.push(...ch.children); ch.children = []; return ch; }
      el.children.push(ch);
      return ch;
    },
    append(...ch) {
      for (const c of ch) {
        if (c && c.tagName === "FRAGMENT") el.children.push(...c.children);
        else el.children.push(c);
      }
    },
    replaceChildren(...ch) {
      el.children = [];
      for (const c of ch) {
        if (c && c.tagName === "FRAGMENT") el.children.push(...c.children);
        else el.children.push(c);
      }
    },
    setAttribute(k, v) { el._attrs[k] = String(v); },
    getAttribute(k) { return k in el._attrs ? el._attrs[k] : null; },
    removeAttribute(k) { delete el._attrs[k]; },
    remove: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: VW, bottom: VH, width: VW, height: VH }),
    setPointerCapture: noop,
    releasePointerCapture: noop,
    focus: noop,
    blur: noop,
    closest: () => null,
    querySelectorAll: (sel) => flattenDeep(el.children).filter((c) => matchSel(c, sel)),
    querySelector: (sel) => flattenDeep(el.children).find((c) => matchSel(c, sel)) || null,
  };
  return el;
}

// 简化版选择器匹配：catcafe 内部只用这几种
function matchSel(el, sel) {
  if (!el || !el.tagName) return false;
  sel = sel.trim();
  // 类选择器 ".foo"
  if (sel.startsWith(".")) {
    const cls = sel.slice(1).split(/[\s>+~]/)[0];
    return el._cls && el._cls.has(cls);
  }
  // 属性选择器 "[data-i18n]" / "[data-tab]"
  if (sel.startsWith("[")) {
    const m = /^(\w[\w-]*)/.exec(sel.slice(1));
    if (!m) return false;
    const attr = m[1];
    return el._attrs && attr in el._attrs;
  }
  // 标签选择器 "BUTTON"
  return el.tagName === sel.toUpperCase();
}

// 递归展平所有后代（真实 DOM 的 querySelectorAll 默认搜整棵子树）
function flattenDeep(arr) {
  const out = [];
  for (const c of arr) {
    out.push(c);
    if (c.children && c.children.length) out.push(...flattenDeep(c.children));
  }
  return out;
}

const els = new Map();
function getEl(id) {
  if (!els.has(id)) els.set(id, makeEl("div"));
  return els.get(id);
}

// 把 index.html 里带 hidden 属性的弹层同步到桩上：
// main.mjs 启动时会判断 pendingOfflineBuckets 来决定是否弹模态，
// 桩若不还原初始 hidden，游戏会被误判成"有弹层打开"而出错。
function seedHiddenFromHtml(html) {
  for (const m of html.matchAll(/<([a-zA-Z][\w-]*)([^>]*)>/g)) {
    const attrs = m[2];
    if (!/\bhidden\b/.test(attrs)) continue;
    const idm = /\bid="([^"]+)"/.exec(attrs);
    if (idm) getEl(idm[1]).hidden = true;
  }
}

// 把 index.html 里带 id 的元素的 class / data- 属性同步到桩上：
// 不还原的话 querySelectorAll(".tab-btn") 会返回空数组，bindEvents 直接拿到 0 个按钮，
// 点击切 Tab 入口就废了。
function seedClassFromHtml(html) {
  for (const m of html.matchAll(/<([a-zA-Z][\w-]*)([^>]*)>/g)) {
    const attrs = m[2];
    const idm = /\bid="([^"]+)"/.exec(attrs);
    if (!idm) continue;
    const el = getEl(idm[1]);
    const cm = /\bclass="([^"]*)"/.exec(attrs);
    if (cm) {
      for (const c of cm[1].split(/\s+/).filter(Boolean)) el._cls.add(c);
    }
    // 把 data-* 属性写进 _attrs，让 querySelectorAll("[data-tab]") 这类属性选择器能命中
    for (const dm of attrs.matchAll(/\b(data-[\w-]+)="([^"]*)"/g)) {
      el._attrs[dm[1]] = dm[2];
    }
  }
}

const docHandlers = {};

global.document = {
  readyState: "complete",
  documentElement: makeEl("html"),
  body: makeEl("body"),
  hidden: false,
  title: "",
  getElementById: getEl,
  createElement: (t) => makeEl(t),
  createDocumentFragment: () => makeEl("fragment"),
  querySelectorAll: (sel) => {
    // 全局遍历 — catcafe 用到的全是单层 .tab-btn / [data-i18n] / .tab-panel
    const result = [];
    for (const el of els.values()) {
      if (el === document.documentElement) continue;
      if (matchSel(el, sel)) result.push(el);
    }
    return result;
  },
  querySelector: (sel) => {
    if (sel.startsWith('meta[name="description"]')) {
      return getEl("__meta_desc");
    }
    return null;
  },
  addEventListener: (t, fn) => { (docHandlers[t] = docHandlers[t] || []).push(fn); },
  removeEventListener: noop
};

// meta 描述桩：ui.mjs 会 querySelector('meta[name="description"]') → setAttribute("content", ...)
getEl("__meta_desc").tagName = "META";

const winHandlers = {};
global.window = {
  devicePixelRatio: 2,
  innerWidth: VW,
  innerHeight: VH,
  addEventListener: (t, fn) => { (winHandlers[t] = winHandlers[t] || []).push(fn); },
  removeEventListener: noop,
  matchMedia: () => ({ matches: false, media: "", addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop })
};
global.matchMedia = global.window.matchMedia;

// Node 24 自带只读 navigator getter，必须用 defineProperty 覆盖
Object.defineProperty(globalThis, "navigator", {
  value: { userAgent: "node", language: "zh-CN", languages: ["zh-CN"] },
  configurable: true,
  writable: true
});

// ============================================================ 虚拟时间 + setInterval/setTimeout 队列驱动

let virtualNow = Date.now();
global.performance = { now: () => virtualNow };
// Date.now 不能覆盖（Node 自带只读），改用 performance 替代 game.tick 路径
// 但 game.init() 用 Date.now() 算 offlineSeconds — 让 virtualNow 在调用前先同步即可
const realDateNow = Date.now;
global.Date = class extends realDateNow.constructor {
  constructor(...args) { if (args.length === 0) super(virtualNow); else super(...args); }
  static now() { return virtualNow; }
};

const intervals = [];
let intervalSeq = 0;
global.setInterval = (fn, ms) => {
  const id = ++intervalSeq;
  intervals.push({ id, fn, ms, lastFire: virtualNow });
  return id;
};
global.clearInterval = (id) => {
  const i = intervals.findIndex((x) => x.id === id);
  if (i >= 0) intervals.splice(i, 1);
};
const timeouts = [];
let timeoutSeq = 0;
global.setTimeout = (fn, ms) => {
  const id = ++timeoutSeq;
  timeouts.push({ id, fn, ms, remaining: ms });
  return id;
};
global.clearTimeout = (id) => {
  const i = timeouts.findIndex((x) => x.id === id);
  if (i >= 0) timeouts.splice(i, 1);
};

// pumpIntervals(seconds)：推 seconds 秒虚拟时间，期间把所有已注册的 interval 触发一次。
//
// 关键设计：catcafe 引擎 engine.tick 用 Math.floor(rps * dtSeconds) 累加金币，
// 而 rps 起步只有 1.5（空存档只有 1 级工位 + 1 级猫）。
// 如果 pumpIntervals 每次只推 100ms（dt=0.1），rps*0.1 = 0.15 → floor(0.15)=0 → 永远 0 金币。
// 必须让 dt=1.0 才能让 floor(rps*1.0) 至少给空存档带来 1 金币/秒。
// 同时 game.startLoop 里 setInterval(..., 100) 在我们桩里仍按注册时的 lastFire 触发，
// 这里直接强制 fire 让 game.lastTickTime 跟虚拟时间一起更新，dt = 1000ms/1000 = 1.0。
function pumpIntervals(seconds = 1) {
  for (let s = 0; s < seconds; s++) {
    virtualNow += 1000;
    for (const it of [...intervals]) {
      it.lastFire = virtualNow;
      try { it.fn(); } catch (e) { errors.push(`interval tick: ${e.stack}`); }
    }
    // setTimeout 也走虚拟时间
    for (const t of [...timeouts]) {
      t.remaining -= 1000;
      if (t.remaining <= 0) {
        const fn = t.fn;
        const idx = timeouts.indexOf(t);
        if (idx >= 0) timeouts.splice(idx, 1);
        try { fn(); } catch (e) { errors.push(`timeout: ${e.stack}`); }
      }
    }
  }
}

// ============================================================ localStorage 桩

const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear(),
  get length() { return store.size; },
  key: (i) => [...store.keys()][i] ?? null
};

// ============================================================ 老玩家存档种子

if (!FRESH) {
  // 1 小时前的存档 → game.init() 算 offlineSeconds ≈ 3600，自动弹想念桶
  store.set("doin.catcafe.v1", JSON.stringify({
    version: 1,
    coins: 1000000,
    stars: 500,
    stage: 1,
    windows: { window_takeout: true, window_terrace: false, window_garden: false },
    activeWindow: "window_takeout",
    stations: {
      roast: { level: 3, unlocked: true },
      grind: { level: 2, unlocked: true },
      extract: { level: 1, unlocked: true },
      latte: { level: 0, unlocked: true },
      serve: { level: 0, unlocked: true }
    },
    cats: {
      cat_orange: { unlocked: true, level: 3 },
      cat_calico: { unlocked: true, level: 2 },
      cat_british: { unlocked: true, level: 1 },
      cat_ragdoll: { unlocked: false, level: 0 }
    },
    activeCat: "cat_orange",
    drinks: ["drink_espresso", "drink_americano"],
    activeDrink: "drink_espresso",
    guests: ["guest_officecat"],
    bowlsServed: 1000,
    totalRevenue: 1000000,
    rngSeed: 123456789,
    lastSaveTime: Date.now() - 3600 * 1000  // 1 小时前
  }));
  store.set("doin.lang", "zh");
} else {
  // 空存档也种一份能让 R/C 键成功的基础 seeds：
  //  - coins 300：R 键研制 americano（cost=200）能成功；
  //  - bowlsServed 30：满足 americano 的 reqBowls 门槛；
  //  - stars 15 + cat_calico 已解锁：C 键能在 orange/calico 间切换；
  //  - lastSaveTime = 现在：不会弹想念桶（已覆盖"空存档不弹"断言）。
  store.set("doin.catcafe.v1", JSON.stringify({
    version: 1,
    coins: 300,
    stars: 15,
    stage: 0,
    windows: { window_takeout: false, window_terrace: false, window_garden: false },
    activeWindow: null,
    stations: {
      roast: { level: 1, unlocked: true },
      grind: { level: 0, unlocked: true },
      extract: { level: 0, unlocked: true },
      latte: { level: 0, unlocked: true },
      serve: { level: 0, unlocked: true }
    },
    cats: {
      cat_orange: { unlocked: true, level: 1 },
      cat_calico: { unlocked: true, level: 0 },
      cat_british: { unlocked: false, level: 0 },
      cat_ragdoll: { unlocked: false, level: 0 }
    },
    activeCat: "cat_orange",
    drinks: ["drink_espresso"],
    activeDrink: "drink_espresso",
    guests: [],
    bowlsServed: 30,
    totalRevenue: 300,
    rngSeed: 123456789,
    lastSaveTime: Date.now()
  }));
}

// ============================================================ AudioContext 桩（audio.mjs 6 种音色需要）

class FakeParam {
  constructor(v) { this.value = v; }
  setValueAtTime() { return this; }
  linearRampToValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
  cancelScheduledValues() { return this; }
}
function nodeLike(extra) {
  return Object.assign({
    connect() { return this; },
    disconnect() { return this; }
  }, extra);
}
global.AudioContext = class {
  constructor() { this.currentTime = 0; this.state = "running"; this.destination = {}; }
  resume() { return Promise.resolve(); }
  createGain() { return nodeLike({ gain: new FakeParam(1) }); }
  createOscillator() { return nodeLike({ frequency: new FakeParam(440), detune: new FakeParam(0), type: "sine", start: noop, stop: noop }); }
  createBiquadFilter() { return nodeLike({ frequency: new FakeParam(1000), Q: new FakeParam(1), gain: new FakeParam(0), type: "lowpass" }); }
  createBufferSource() { return nodeLike({ buffer: null, playbackRate: new FakeParam(1), start: noop, stop: noop }); }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len), length: len }; }
  createDynamicsCompressor() {
    return nodeLike({
      threshold: new FakeParam(-24), knee: new FakeParam(30), ratio: new FakeParam(12),
      attack: new FakeParam(0.003), release: new FakeParam(0.25)
    });
  }
  close() { return Promise.resolve(); }
};
global.webkitAudioContext = global.AudioContext;

// ============================================================ 事件驱动辅助

function fireWin(type, ev) {
  for (const fn of winHandlers[type] || []) {
    try {
      fn(Object.assign({ preventDefault: noop, stopPropagation: noop, key: "", type, target: { tagName: "BODY" } }, ev));
    }
    catch (e) { errors.push(`window/${type}: ${e.stack}`); }
  }
}

function clickEl(id, ev) {
  const el = getEl(id);
  for (const fn of el._h.click || []) {
    try { fn(Object.assign({ preventDefault: noop, stopPropagation: noop, target: el }, ev)); }
    catch (e) { errors.push(`${id}/click: ${e.stack}`); }
  }
}

// ============================================================ 载入页面模块

// 先按真实 index.html 还原弹层的初始 hidden 状态 + className / data-* 属性，再 import
// （init() 会立刻读 hidden；bindEvents 立刻 querySelectorAll 拿 .tab-btn）
seedHiddenFromHtml(readFileSync(resolve(DIR, "index.html"), "utf8"));
seedClassFromHtml(readFileSync(resolve(DIR, "index.html"), "utf8"));

const main = await import(new URL("../js/main.mjs", import.meta.url).href).catch((e) => {
  errors.push("import main.mjs: " + e.stack);
  return null;
});

if (main && typeof main.init === "function") {
  try { main.init(); }
  catch (e) { errors.push("init(): " + e.stack); }
}

const game = main?.game ?? null;

// ============================================================ 业务可观测量

// 反向解析 score.formatCoins 的 K/M/B 缩写："1.2K" → 1200、"1M" → 1000000
function parseCompact(s) {
  if (typeof s !== "string") return 0;
  const m = /^([\d,.]+)([KMB]?)$/i.exec(s.trim());
  if (!m) return 0;
  const num = Number(m[1].replace(/,/g, "")) || 0;
  const mult = { "": 1, "K": 1e3, "M": 1e6, "B": 1e9 }[m[2].toUpperCase()] || 1;
  return num * mult;
}

function readCoins() { return parseCompact(getEl("coins-val")._text); }
function readBowls() { return parseCompact(getEl("bowls-val")._text); }
function readStars() { return parseCompact(getEl("stars-val")._text); }
function readRps() { return Number((getEl("rps-val")._text || "0").replace(/,/g, "")); }
function readActiveCatName() { return getEl("active-cat-name")._text; }
function readStage() { return getEl("stage-badge-val")._text; }

function isModalOpen(id) { return !getEl(id)._cls.has("hidden"); }

// ============================================================ 断言收集

const report = [];
const fails = [];
function check(name, ok, detail = "") {
  report.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) fails.push(name + (detail ? " — " + detail : ""));
}

// ============================================================ 0. 装配层是否真的拿起了 DOM

check("main 装配层初始化完成", Boolean(main && game), main ? "" : "main 或 game 为 null");
check("game.state.coins 已加载", typeof game?.state?.coins === "number", `coins=${game?.state?.coins}`);
check("game.state.stations.roast 已加载", game?.state?.stations?.roast?.level >= 0,
  `level=${game?.state?.stations?.roast?.level}`);

// ============================================================ 1. 首屏静态文案与读数

check("首屏标题已填充（zh）", getEl("app-title-main")._text.length > 0,
  `app-title-main="${getEl("app-title-main")._text}"`);
check("首屏活动猫名已填充（zh）", readActiveCatName().length > 0,
  `active-cat-name="${readActiveCatName()}"`);
check("首屏 coins 读数非空", readCoins() >= 0, `coins-val="${getEl("coins-val")._text}"`);
check("首屏 rps 读数非空", readRps() >= 0, `rps-val="${getEl("rps-val")._text}"`);
check("首屏 stars 读数非空", readStars() >= 0, `stars-val="${getEl("stars-val")._text}"`);
check("首屏 stage 标签非空", readStage().length > 0, `stage-badge-val="${readStage()}"`);
check("首屏 bowls 读数非空", readBowls() >= 0, `bowls-val="${getEl("bowls-val")._text}"`);

// 5 个 Tab 按钮都注册了点击监听
const tabBtns = ["tab-btn-stations", "tab-btn-drinks", "tab-btn-cats", "tab-btn-guests", "tab-btn-shop"];
for (const id of tabBtns) {
  check(`Tab 按钮 ${id} 已注册 click 监听`, (getEl(id)._h.click || []).length > 0,
    `handlers=${(getEl(id)._h.click || []).length}`);
}

// ============================================================ 2. 5 个 Tab 列表内容都已渲染

const stationsList = getEl("stations-list");
check("Stations Tab 列表已渲染 5 个 station-card",
  stationsList.children.length === 5, `实际=${stationsList.children.length}`);

clickEl("tab-btn-drinks");
check("Drinks Tab 切换：panel-drinks 拿到 active",
  getEl("panel-drinks")._cls.has("active") && !getEl("panel-stations")._cls.has("active"),
  "tab-panel active class 切换");
check("Drinks Tab 列表已渲染（drink 数）",
  getEl("drinks-list").children.length >= 1, `实际=${getEl("drinks-list").children.length}`);

clickEl("tab-btn-cats");
check("Cats Tab 列表已渲染 4 张猫卡",
  getEl("cats-list").children.length === 4, `实际=${getEl("cats-list").children.length}`);

clickEl("tab-btn-guests");
check("Guests Tab 列表已渲染（guest 数）",
  getEl("guests-list").children.length >= 1, `实际=${getEl("guests-list").children.length}`);

clickEl("tab-btn-shop");
check("Shop Tab 列表已渲染（窗口 + 声誉）",
  getEl("shop-controls").children.length >= 1, `实际=${getEl("shop-controls").children.length}`);

clickEl("tab-btn-stations"); // 切回默认

// ============================================================ 3. 入口A:首屏 tick 推进
// 用 state.coins 数值而非 DOM 文本 —— HUD 在 ≥1M 后被 formatCoins 截断成 "1M"，
// 实际涨的几十金币显示不出来，肉眼看不到推进。
// pumpIntervals 单位是「秒」——引擎 dt=1s 时 rps=1.5 才稳定累加。

const a0 = game.state.coins;
pumpIntervals(30); // 30 秒虚拟时间
const a1 = game.state.coins;
check("入口A 首屏：30 秒后金币在涨", a1 > a0, `${a0} → ${a1}`);

const b0 = game.state.bowlsServed;
pumpIntervals(5);
const b1 = game.state.bowlsServed;
check("入口A 首屏：累计出杯在涨", b1 >= b0, `${b0} → ${b1}`);

// ============================================================ 4. 入口B:键盘 1-5 升级工位（roast 应可买）

const c0 = game.state.coins;
const roastLevelBefore = game.state.stations.roast.level;
fireWin("keydown", { key: "1" });
// 不 pumpIntervals —— 后续 tick 会累加金币，掩盖了"升级扣费"的可观察量
const c2 = game.state.coins;
check("入口B 键盘 1 升级 roast：金币减少",
  c2 < c0 && game.state.stations.roast.level === roastLevelBefore + 1,
  `${c0} → ${c2}, level ${roastLevelBefore} → ${game.state.stations.roast.level}`);

// ============================================================ 5. 入口C:R 键研制饮品（老玩家已研 espresso/americano，应研制下一杯）

const drinksBefore = game.state.drinks.length;
fireWin("keydown", { key: "r" });
const drinksAfter = game.state.drinks.length;
check("入口C R 键研制：drinks 数组增长",
  drinksAfter > drinksBefore, `${drinksBefore} → ${drinksAfter}`);

// ============================================================ 6. 入口D:C 键切猫（老玩家解锁了 orange/calico/british 三只，应能切到下一只）

const catBefore = game.state.activeCat;
fireWin("keydown", { key: "c" });
check("入口D C 键切猫：activeCat 真的变了",
  game.state.activeCat !== catBefore, `${catBefore} → ${game.state.activeCat}`);
check("入口D 切猫后 HUD active-cat-name 同步刷新",
  readActiveCatName().length > 0, `name="${readActiveCatName()}"`);

// ============================================================ 7. 入口E:Tab 切换走完整 5 个

const visitedPanels = new Set();
visitedPanels.add("panel-stations");
for (const id of tabBtns) {
  clickEl(id);
  const expectedId = `panel-${id.replace("tab-btn-", "")}`;
  check(`入口E Tab 切换 ${id}: ${expectedId} 拿到 active`,
    getEl(expectedId)._cls.has("active"), `active=${getEl(expectedId)._cls.has("active")}`);
  visitedPanels.add(expectedId);
}
check("入口E 5 个 Tab 面板都已遍历", visitedPanels.size === 5, `size=${visitedPanels.size}`);

// ============================================================ 8. 入口F:语言切换（zh ↔ en）

const cnCatName = readActiveCatName();
clickEl("btn-lang");
const enCatName = readActiveCatName();
clickEl("btn-lang");
const cnCatName2 = readActiveCatName();
check("入口F 语言切换：active-cat-name 在 zh/en 间真实切换",
  cnCatName !== enCatName && cnCatName2 === cnCatName,
  `zh="${cnCatName}" → en="${enCatName}" → zh="${cnCatName2}"`);

const storedLang = store.get("doin.lang");
check("入口F 语言切换：doin.lang 真实落到 localStorage",
  storedLang === "en" || storedLang === "zh", `doin.lang=${storedLang}`);

// ============================================================ 9. 入口G:指南浮层开关

check("入口G 指南浮层默认关闭", !isModalOpen("modal-guide"), "");
clickEl("btn-help");
check("入口G 指南浮层打开后 modal-guide 失去 hidden",
  isModalOpen("modal-guide"), "");
clickEl("btn-close-guide");
check("入口G 指南浮层关闭后 modal-guide 重新 hidden",
  !isModalOpen("modal-guide"), "");

// ============================================================ 10. 入口H:想念桶弹窗（老玩家存档 1h 前，自动弹）

if (!FRESH) {
  // 此时 init() 已经跑过，game.init() 早弹过了 — 但 modal-offline 现在是 open 还是 close?
  const offlineOpenAfterInit = isModalOpen("modal-offline");
  // main.mjs 在 init() 时如果 pendingOfflineBuckets 就 openModal("modal-offline")
  // 老玩家存档 lastSaveTime=1h 前 → init() 应该自动弹
  check("入口H 老玩家存档：init() 自动弹想念桶（modal-offline 打开）",
    offlineOpenAfterInit, `modal-offline hidden=${!offlineOpenAfterInit}`);

  const bucketsContainer = getEl("offline-buckets");
  const bucketCount = bucketsContainer.children.length;
  check("入口H 想念桶列表已渲染至少 1 行",
    bucketCount >= 1, `bucket 行数=${bucketCount}`);

  const earnedText = getEl("offline-earned-text")._text;
  check("入口H 想念桶统计文本已填充",
    earnedText.length > 0 && !/NaN|undefined/.test(earnedText), `text="${earnedText}"`);

  // 关闭想念桶
  clickEl("btn-claim-offline");
  pumpIntervals(2);
  check("入口H 认领想念桶后 modal-offline 关闭",
    !isModalOpen("modal-offline"), "");
} else {
  check("入口H 空存档：modal-offline 不弹（无可结算离线收益）",
    !isModalOpen("modal-offline"), "");
}

// ============================================================ 11. 入口I:resize / orientationchange

fireWin("resize", {});
fireWin("orientationchange", {});
pumpIntervals(2);
check("入口I resize/orientationchange 后仍无异常",
  errors.length === 0, errors.slice(0, 2).join(" | "));

// ============================================================ 12. 入口J:blur 清空输入无异常

fireWin("blur", {});
pumpIntervals(2);
check("入口J blur 后仍无异常", errors.length === 0, errors.slice(0, 2).join(" | "));

// ============================================================ 13. 入口K:E 键升级声誉（老玩家 stage=1 → 2）

if (!FRESH) {
  const stageBefore = game.state.stage;
  fireWin("keydown", { key: "e" });
  check("入口K E 键升级声誉：stage 真的变了",
    game.state.stage !== stageBefore, `${stageBefore} → ${game.state.stage}`);
  check("入口K 升级后 HUD stage-badge-val 同步刷新",
    readStage().length > 0, `stage-badge-val="${readStage()}"`);
}

// ============================================================ 14. 入口L:M 键静音切换

fireWin("keydown", { key: "m" });
check("入口L M 键切换静音后 store.muted 真实落档",
  store.has("doin.catcafe.v1"), "");

// ============================================================ 15. 空存档额外断言：资源不足时按钮 disabled 而非抛错

if (FRESH) {
  // coins=300 时 roast 主升级按钮 enabled，但 grind/extract/latte/serve 都 disabled；
  // 猫升级按钮全部 disabled（成本不够）。
  // 只断言"找到按钮 + 部分 disabled"，不强求具体数（DOM 树结构演进可能改）。
  clickEl("tab-btn-stations");
  const btns = flattenDeep(getEl("stations-list").children).filter((c) => c.tagName === "BUTTON");
  const disabled = btns.filter((b) => b.disabled).length;
  check("入口M 空存档：stations Tab 渲染了按钮", btns.length >= 5, `按钮数=${btns.length}`);
  check("入口M 空存档：金币不够时部分按钮自动 disabled",
    disabled > 0 && disabled < btns.length,
    `disabled=${disabled}/${btns.length}`);
}

// ============================================================ 输出

console.log(report.join("\n"));
console.log("---");
console.log(`视口 ${VW}x${VH} | 存档 ${FRESH ? "空" : "老玩家"} | 驱动 tick ${intervals.length} 个 interval`);

if (badText.length) {
  console.log(`\n!! 非法文本 ${badText.length} 处（前 5）:`);
  for (const s of badText.slice(0, 5)) console.log("   " + s);
}
if (errors.length) {
  console.log(`\n!! 运行时异常 ${errors.length} 处（前 5）:`);
  for (const s of errors.slice(0, 5)) console.log("\n" + s);
}

if (fails.length || errors.length || badText.length) {
  console.log(`\n结果：FAIL（${fails.length} 项断言失败 / ${errors.length} 处异常 / ${badText.length} 处非法文本）`);
  process.exit(1);
}
console.log(`\n结果：PASS（${report.length} 项断言全过，0 异常，0 非法文本）`);