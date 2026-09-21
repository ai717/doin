// 恶魔迷途 · 无浏览器冒烟测试单场景（真正的断言在这里）
//
// 通常不直接跑本文件，而是跑调度器 tests/smoke.mjs（会换视口 / 换存档复跑）：
//   node games/devil-run/tests/smoke.mjs
//
// 目的：在**不安装 Chromium** 的前提下，验证 ui.mjs + main.mjs 这套「唯一碰 DOM」的
//       装配层真的能在浏览器语义下跑起来，并且**业务状态在推进**——不是只有渲染在自排队。
//
// 防假绿的关键设计：
//   1. 逐个入口驱动：首屏 / 重玩按钮 / R 键 / 键盘 / 虚拟键 / 选关跳转 / 弹层开关 /
//      下一关 / 语言切换 / 音效开关 / 切后台 / resize / blur。
//      每个入口之后都断言「用时在涨」或「关卡索引真的变了」。
//      —— 只测首屏是最容易漏掉其它入口的假绿源头。
//   2. 存档两条路径都跑：老玩家（解锁 27 关 + 有印章）与全新空存档（SM_FRESH=1）。
//   3. 颜色 setter 全程拦截，抓 `rgba(...,NaN)` 这类被 Canvas 静默忽略的赋值。
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
const badColor = [];
const calls = { fill: 0, stroke: 0, fillRect: 0, drawImage: 0, clearRect: 0 };

// ============================================================ Canvas 2D 桩

function checkColor(prop, v) {
  if (typeof v !== "string") return; // 渐变对象，跳过
  if (v.includes("NaN") || v.includes("undefined") || !/^(rgba?\(|#|transparent$|[a-z]+$)/.test(v)) {
    badColor.push(`${prop} = ${v}`);
  }
}

const grad = { addColorStop: noop };

function makeCtx() {
  const c = {};
  for (const m of [
    "fillRect", "clearRect", "beginPath", "fill", "stroke", "save", "restore", "translate",
    "rotate", "scale", "setTransform", "moveTo", "lineTo", "quadraticCurveTo", "bezierCurveTo",
    "arc", "ellipse", "arcTo", "closePath", "clip", "drawImage", "fillText", "strokeText",
    "setLineDash", "transform", "resetTransform", "createImageData", "putImageData", "rect", "roundRect"
  ]) {
    c[m] = function () { if (calls[m] !== undefined) calls[m]++; };
  }
  let _fill = "#000";
  let _stroke = "#000";
  Object.defineProperty(c, "fillStyle", {
    get: () => _fill,
    set: (v) => { checkColor("fillStyle", v); _fill = v; }
  });
  Object.defineProperty(c, "strokeStyle", {
    get: () => _stroke,
    set: (v) => { checkColor("strokeStyle", v); _stroke = v; }
  });
  c.createLinearGradient = () => grad;
  c.createRadialGradient = () => grad;
  c.createPattern = () => null;
  c.measureText = () => ({ width: 10 });
  c.getImageData = () => ({ data: new Uint8ClampedArray(4) });
  return c;
}

// ============================================================ DOM 桩

const els = new Map();

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
    set textContent(v) { el._text = String(v ?? ""); },
    get innerHTML() { return el._html; },
    set innerHTML(v) { el._html = String(v ?? ""); },
    get className() { return [...el._cls].join(" "); },
    set className(v) { el._cls = new Set(String(v ?? "").split(/\s+/).filter(Boolean)); },
    classList: {
      add(c) { el._cls.add(c); },
      remove(c) { el._cls.delete(c); },
      toggle(c, f) { const on = f === undefined ? !el._cls.has(c) : !!f; if (on) el._cls.add(c); else el._cls.delete(c); return on; },
      contains(c) { return el._cls.has(c); }
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
    querySelectorAll: () => [],
    querySelector: () => null,
    getContext: (type) => {
      if (type && type !== "2d") return null;
      if (!el._ctx) el._ctx = makeCtx();
      return el._ctx;
    }
  };
  return el;
}

function getEl(id) {
  if (!els.has(id)) els.set(id, makeEl("div"));
  return els.get(id);
}

// 把 index.html 里带 hidden 属性的弹层同步到桩上：
// anyLayerOpen() 以 el.hidden 为唯一真相源，桩若不还原初始 hidden，
// 游戏会被误判成「有弹层打开」而永久暂停（本测试最初就栽在这里）。
function seedHiddenFromHtml(html) {
  for (const m of html.matchAll(/<([a-zA-Z][\w-]*)([^>]*)>/g)) {
    const attrs = m[2];
    if (!/\bhidden\b/.test(attrs)) continue;
    const idm = /\bid="([^"]+)"/.exec(attrs);
    if (idm) getEl(idm[1]).hidden = true;
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
  querySelectorAll: () => [],
  querySelector: (sel) => {
    // main.mjs 用 ".layer:not([hidden])" 判断是否有弹层打开
    if (sel.startsWith(".layer")) {
      for (const id of ["layer-levels", "layer-result", "layer-rules"]) {
        if (!getEl(id).hidden) return getEl(id);
      }
      return null;
    }
    return null;
  },
  addEventListener: (t, fn) => { (docHandlers[t] = docHandlers[t] || []).push(fn); },
  removeEventListener: noop
};

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
global.performance = { now: () => Date.now() };

let rafQueue = [];
global.requestAnimationFrame = (fn) => { rafQueue.push(fn); return rafQueue.length; };
global.cancelAnimationFrame = noop;

// Node 24 自带只读 navigator getter，必须用 defineProperty 覆盖
Object.defineProperty(globalThis, "navigator", {
  value: { userAgent: "node", language: "zh-CN", languages: ["zh-CN"] },
  configurable: true,
  writable: true
});

// localStorage 桩：先装桩再 import 页面模块（模块可能在首次调用时缓存 backend）
const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear(),
  get length() { return store.size; },
  key: (i) => [...store.keys()][i] ?? null
};

// 种一份「老玩家」存档：解锁到第 27 关（索引 26），前 12 关有点亮的印章。
// 不种的话只有第 1 关解锁，选关层的「跳转」与「锁定态」两条路径都覆盖不到。
const SEEDED_UNLOCKED = 27;
const SEEDED_LEVELS = 12;
const SEEDED_CANDLE = 6;   // i % 2 === 0
const SEEDED_FLAWLESS = 4; // i % 3 === 0
if (!FRESH) {
  const seals = {};
  const bestTime = {};
  const deaths = {};
  for (let i = 0; i < SEEDED_LEVELS; i++) {
    seals[i] = { clear: true, candle: i % 2 === 0, flawless: i % 3 === 0 };
    bestTime[i] = 6 + i * 0.7;
    deaths[i] = i % 4;
  }
  store.set("doin.devil-run.v1", JSON.stringify({
    version: 1,
    prefs: { muted: true },
    progress: { unlocked: SEEDED_UNLOCKED, seals, bestTime, deaths, totalDeaths: 18 }
  }));
}

// AudioContext 桩（audio.mjs 手势解锁后才会创建）
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
  createStereoPanner() { return nodeLike({ pan: new FakeParam(0) }); }
  createWaveShaper() { return nodeLike({ curve: null, oversample: "none" }); }
  createDelay() { return nodeLike({ delayTime: new FakeParam(0) }); }
  createConvolver() { return nodeLike({ buffer: null, normalize: true }); }
  close() { return Promise.resolve(); }
};
global.webkitAudioContext = global.AudioContext;

const timers = [];
global.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
global.clearTimeout = noop;
global.setInterval = () => 0;
global.clearInterval = noop;

// ============================================================ 驱动帧

let t = 0;
let framesRun = 0;
function pump(n, tag) {
  for (let f = 0; f < n; f++) {
    const q = rafQueue;
    if (!q.length) return f;
    rafQueue = [];
    t += 1000 / 60;
    framesRun++;
    for (const fn of q) {
      try { fn(t); } catch (e) { errors.push(`${tag} 第${f}帧: ${e.stack}`); }
    }
  }
  return n;
}

function fireWin(type, ev) {
  for (const fn of winHandlers[type] || []) {
    try { fn(Object.assign({ preventDefault: noop, stopPropagation: noop, key: "", type }, ev)); }
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

function holdEl(id, down) {
  const el = getEl(id);
  const type = down ? "pointerdown" : "pointerup";
  for (const fn of el._h[type] || []) {
    try { fn({ preventDefault: noop, stopPropagation: noop, target: el, pointerId: 1, clientX: 0, clientY: 0 }); }
    catch (e) { errors.push(`${id}/${type}: ${e.stack}`); }
  }
}

// ============================================================ 载入页面模块

// 先按真实 index.html 还原弹层的初始 hidden 状态，再 import（init() 会立刻读它）
seedHiddenFromHtml(readFileSync(resolve(DIR, "index.html"), "utf8"));

const main = await import(new URL("../js/main.mjs", import.meta.url).href).catch((e) => {
  errors.push("import main.mjs: " + e.stack);
  return null;
});

// main.mjs 在 readyState !== "loading" 时自动 boot()
const app = main?.boot?.() ?? null;

// ============================================================ 业务可观测量

function readTime() {
  const m = /^(\d+):(\d+)$/.exec(getEl("time-val").textContent || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

function framesToAdvance(label) {
  const before = readTime();
  pump(90, label);
  const after = readTime();
  return { before, after, advanced: after > before };
}

// ============================================================ 断言收集

const report = [];
const fails = [];

function check(name, ok, detail = "") {
  report.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) fails.push(name + (detail ? " — " + detail : ""));
}

// --- 0. 装配层是否真的拿起了 DOM ---
check("boot() 返回装配对象", Boolean(app && app.game && app.renderer), app ? "" : "boot 未返回");
check("画布拿到了 2D 上下文", Boolean(app?.renderer), "");

// --- 1. 首屏静态文案与读数 ---
check("首屏关卡读数已填充", /^\d+-\d+$/.test(getEl("level-val").textContent), `level-val="${getEl("level-val").textContent}"`);
check("首屏用时读数已填充", /^\d+:\d{2}$/.test(getEl("time-val").textContent), `time-val="${getEl("time-val").textContent}"`);
check("首屏标题已填充", getEl("game-title").textContent.length > 0, `game-title="${getEl("game-title").textContent}"`);
check("首屏章节名已填充", getEl("node-name").textContent.length > 0, `node-name="${getEl("node-name").textContent}"`);
check("规则正文已填充（六句）", getEl("rules-body").children.length >= 6, `rules-body 子节点=${getEl("rules-body").children.length}`);
check("本关印章台分母 = 15", /\/15/.test(getEl("seal-node-count").innerHTML), `seal-node-count="${getEl("seal-node-count").innerHTML}"`);

const overallLit = Number(/<b>(\d+)<\/b>/.exec(getEl("total-count").innerHTML)?.[1] ?? -1);
const EXPECTED_LIT = FRESH ? 0 : SEEDED_LEVELS + SEEDED_CANDLE + SEEDED_FLAWLESS;
check("全部印章分母 = 150 且点亮数读自存档",
  /\/150/.test(getEl("total-count").innerHTML) && overallLit === EXPECTED_LIT,
  `total-count="${getEl("total-count").innerHTML}"（期望点亮 ${EXPECTED_LIT}）`);

// 存档路径：起始关卡语义
check(FRESH ? "空存档：起始关卡为第 1 关" : "老玩家存档：起始关卡恢复到最后已解锁关",
  (app?.game?.levelIndex ?? -1) === (FRESH ? 0 : SEEDED_UNLOCKED - 1),
  `levelIndex=${app?.game?.levelIndex}`);

// --- 2. 选关列表（懒渲染，先开一次选关层）---
clickEl("levels-btn");
const lvChildren = getEl("levels-list").children;
const lvCount = lvChildren.length;
const lvNodes = lvChildren.filter((el) => el._cls.has("lv-node")).length;
const lvBtns = lvChildren.filter((el) => el.tagName === "BUTTON");
const lvUnlocked = lvBtns.filter((el) => !el.disabled).length;
const lvLocked = lvBtns.filter((el) => el.disabled).length;
clickEl("levels-close");

check("选关列表已填充（10 节点 × 5 关 + 10 个章节标题）",
  lvCount >= 60 && lvNodes >= 10 && lvBtns.length === 50,
  `子节点=${lvCount}, 章节标题=${lvNodes}, 关卡按钮=${lvBtns.length}`);
check("选关列表的解锁/锁定分区正确",
  FRESH ? lvUnlocked === 1 && lvLocked === 49 : lvUnlocked === SEEDED_UNLOCKED && lvLocked === 50 - SEEDED_UNLOCKED,
  `已解锁=${lvUnlocked}, 锁定=${lvLocked}`);

if (FRESH) {
  check("空存档：最佳用时为占位符而非 NaN/undefined",
    getEl("best-val").textContent === "--", `best-val="${getEl("best-val").textContent}"`);
}

// --- 3. 入口 A：首屏自动进入后在推进 ---
const a = framesToAdvance("首屏");
check("入口A 首屏：90 帧内用时在推进", a.advanced, `${a.before} → ${a.after}`);

// --- 4. 入口 B：重玩按钮 ---
clickEl("btn-restart");
pump(2, "重玩后");
const b = framesToAdvance("重玩");
check("入口B 重玩：用时从 0 重计并继续推进", b.before <= 1 && b.advanced, `${b.before} → ${b.after}`);

// --- 5. 入口 C：R 键重玩 ---
fireWin("keydown", { key: "r" });
pump(2, "R键后");
const c = framesToAdvance("R键");
check("入口C R键重玩：用时重计并继续推进", c.before <= 1 && c.advanced, `${c.before} → ${c.after}`);

// --- 6. 入口 D：方向键与跳跃输入 ---
fireWin("keydown", { key: "ArrowRight" });
pump(20, "右移");
fireWin("keydown", { key: " " });
pump(20, "跳跃");
fireWin("keyup", { key: " " });
fireWin("keyup", { key: "ArrowRight" });
check("入口D 键盘输入 40 帧无异常", errors.length === 0, errors.slice(0, 2).join(" | "));

// --- 7. 入口 E：虚拟方向键 pointer 长按 ---
holdEl("pad-right", true);
pump(15, "按住右");
holdEl("pad-right", false);
holdEl("pad-jump", true);
pump(10, "按住跳");
holdEl("pad-jump", false);
check("入口E 虚拟键长按无异常", errors.length === 0, errors.slice(0, 2).join(" | "));

// --- 8. 入口 F：选关跳转 ---
const levelBefore = getEl("level-val").textContent;
const levelIdxBefore = app?.game?.levelIndex ?? -1;
const unlockedBtns = lvBtns.filter((el) => !el.disabled);
const target = unlockedBtns.find((el) => !el._cls.has("current")) ?? null;

if (FRESH) {
  check("空存档：选关列表只有当前关可点（其余全部锁定）",
    unlockedBtns.length === 1 && target === null, `已解锁 ${unlockedBtns.length} 个`);
} else {
  check("入口F 前置：存在非当前关的可点按钮", Boolean(target), `已解锁 ${unlockedBtns.length} 个`);
  if (target) {
    for (const fn of target._h.click || []) {
      try { fn({ preventDefault: noop, stopPropagation: noop, target }); }
      catch (e) { errors.push("选关click: " + e.stack); }
    }
  }
  pump(3, "选关后");
  const d = framesToAdvance("选关跳转");
  check("入口F 选关跳转：关卡索引真的变了，且用时在推进",
    (app?.game?.levelIndex ?? -1) !== levelIdxBefore && /^\d+-\d+$/.test(getEl("level-val").textContent) && d.advanced,
    `level ${levelIdxBefore}(${levelBefore}) → ${app?.game?.levelIndex}(${getEl("level-val").textContent}), 用时 ${d.before} → ${d.after}`);
}

// --- 9. 入口 G：弹层开关（规则 / 选关）---
clickEl("btn-rules");
const pausedWhileOpen = app?.game?.isPaused;
clickEl("rules-close");
pump(3, "规则关闭后");
const e = framesToAdvance("弹层关闭后");
check("入口G 规则弹层：打开时暂停，关闭后恢复推进", pausedWhileOpen === true && e.advanced,
  `paused=${pausedWhileOpen}, 用时 ${e.before} → ${e.after}`);

clickEl("levels-btn");
clickEl("levels-close");
pump(3, "选关弹层关闭后");
const f = framesToAdvance("选关弹层关闭后");
check("入口G2 选关弹层关闭后恢复推进", f.advanced, `用时 ${f.before} → ${f.after}`);

// --- 10. 入口 H：下一关 ---
const beforeNext = app?.game?.levelIndex ?? -1;
app?.game?.goNextLevel?.();
pump(3, "下一关后");
const g = framesToAdvance("下一关");
check("入口H 下一关：关卡索引前进且用时在推进",
  (app?.game?.levelIndex ?? -1) === beforeNext + 1 && g.advanced,
  `level ${beforeNext} → ${app?.game?.levelIndex}, 用时 ${g.before} → ${g.after}`);

// --- 11. 入口 I：语言切换（zh ↔ en）---
const cnTitle = getEl("game-title").textContent;
clickEl("btn-lang");
const enTitle = getEl("game-title").textContent;
clickEl("btn-lang");
const cnTitle2 = getEl("game-title").textContent;
check("入口I 语言切换：标题在 zh/en 间真实切换且可切回",
  cnTitle !== enTitle && cnTitle2 === cnTitle,
  `"${cnTitle}" → "${enTitle}" → "${cnTitle2}"`);

// --- 12. 入口 J：音效开关 ---
clickEl("btn-sound");
const mutedAfter = JSON.parse(store.get("doin.devil-run.v1") || "{}")?.prefs?.muted;
clickEl("btn-sound");
check("入口J 音效开关真实落到存档", typeof mutedAfter === "boolean", `muted=${mutedAfter}`);

// --- 13. 入口 K：可见性切换（切后台暂停、回来不补帧）---
document.hidden = true;
for (const fn of docHandlers.visibilitychange || []) {
  try { fn({}); } catch (e2) { errors.push("visibilitychange(hidden): " + e2.stack); }
}
const pausedInBg = app?.game?.isPaused;
document.hidden = false;
for (const fn of docHandlers.visibilitychange || []) {
  try { fn({}); } catch (e2) { errors.push("visibilitychange(visible): " + e2.stack); }
}
pump(3, "回前台");
const bg = framesToAdvance("回前台");
check("入口K 切后台暂停 / 回前台恢复且不补帧", pausedInBg === true && bg.advanced,
  `paused=${pausedInBg}, 用时 ${bg.before} → ${bg.after}, 回前台首帧用时=${bg.before}`);

// --- 14. 入口 L：resize / 方向变化 ---
fireWin("resize", {});
fireWin("orientationchange", {});
pump(5, "resize 后");
check("入口L resize 后仍无异常", errors.length === 0, errors.slice(0, 2).join(" | "));

// --- 15. 入口 M：窗口失焦清空输入 ---
fireWin("blur", {});
pump(5, "blur 后");
check("入口M blur 清空输入无异常", errors.length === 0, errors.slice(0, 2).join(" | "));

// --- 16. 最佳用时读数（老玩家第 1 关有 6.0s 记录）---
app?.game?.startLevel?.(0);
pump(2, "回第1关");
check("最佳用时读数读自存档（第 1 关）",
  getEl("best-val").textContent === (FRESH ? "--" : "0:06"),
  `best-val="${getEl("best-val").textContent}"`);

// ============================================================ 输出

const totalDraw = calls.fill + calls.stroke + calls.fillRect + calls.drawImage;
const perFrame = framesRun ? Math.round(totalDraw / framesRun) : 0;

console.log(report.join("\n"));
console.log("---");
console.log(`视口 ${VW}x${VH} | 存档 ${FRESH ? "空" : "老玩家"} | 驱动帧数 ${framesRun}`);
console.log(`绘制调用：fill ${calls.fill} | stroke ${calls.stroke} | fillRect ${calls.fillRect} | drawImage ${calls.drawImage} | clearRect ${calls.clearRect}`);
console.log(`平均每帧 draw call ≈ ${perFrame}`);

if (perFrame > 800) {
  console.log(`!! 每帧 draw call ${perFrame} 偏高（建议 < 800），低端设备可能掉帧`);
}

if (badColor.length) {
  console.log(`\n!! 非法颜色 ${badColor.length} 处（前 5）:`);
  for (const s of badColor.slice(0, 5)) console.log("   " + s);
}
if (errors.length) {
  console.log(`\n!! 运行时异常 ${errors.length} 处（前 5）:`);
  for (const s of errors.slice(0, 5)) console.log("\n" + s);
}

if (fails.length || errors.length || badColor.length) {
  console.log(`\n结果：FAIL（${fails.length} 项断言失败 / ${errors.length} 处异常 / ${badColor.length} 处非法颜色）`);
  process.exit(1);
}
console.log(`\n结果：PASS（${report.length} 项断言全过，0 异常，0 非法颜色）`);
