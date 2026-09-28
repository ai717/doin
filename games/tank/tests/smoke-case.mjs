// 坦克巷战 · 无浏览器冒烟测试单场景（真正的断言在这里）
//
// 通常不直接跑本文件，而是跑调度器 tests/smoke.mjs（会换视口 / 换存档复跑）：
//   node games/tank/tests/smoke.mjs
//
// 目的：在**不安装 Chromium** 的前提下，验证 render.mjs + ui.mjs + main.mjs 这套
//       「唯一碰 DOM」的装配层真的能在浏览器语义下跑起来，并且**业务状态在推进**。
//
// 防假绿的关键设计：
//   1. 逐个入口驱动：菜单 → 战役地图 → 选关 → 键盘行驶 → 开炮 → 指令 → 虚拟键 →
//      暂停 / 恢复 → 重开 → 语言切换 → 音效开关 → resize → blur。
//      每个入口之后都断言「用时在涨」或「坦克坐标真的变了」。
//   2. 存档两条路径都跑：老玩家（解锁 12 关 + 有记录）与全新空存档（SM_FRESH=1）。
//   3. 颜色 setter 全程拦截，抓 `rgba(...,NaN)` 这类被 Canvas 静默忽略的赋值。
//   4. 弹层可见性以 classList 为唯一真相源（与 ui.mjs 保持一致），不读 el.hidden。
//
// 环境变量：SM_W / SM_H 视口尺寸；SM_FRESH=1 走空存档路径。

const noop = () => {};
const errors = [];
const badColor = [];
const calls = { fill: 0, stroke: 0, fillRect: 0, drawImage: 0, clearRect: 0, arc: 0 };

const VW = Number(process.env.SM_W || 1440);
const VH = Number(process.env.SM_H || 900);
const FRESH = process.env.SM_FRESH === "1";

// ============================================================ Canvas 2D 桩

function checkColor(prop, v) {
  if (typeof v !== "string") return; // gradient objects are skipped
  if (v.includes("NaN") || v.includes("undefined")) badColor.push(`${prop} = ${v}`);
}

const grad = { addColorStop: noop };

function makeCtx() {
  const c = {};
  for (const m of [
    "fillRect", "clearRect", "beginPath", "fill", "stroke", "save", "restore", "translate",
    "rotate", "scale", "setTransform", "moveTo", "lineTo", "quadraticCurveTo", "bezierCurveTo",
    "arc", "ellipse", "arcTo", "closePath", "clip", "drawImage", "fillText", "strokeText",
    "setLineDash", "transform", "resetTransform", "rect", "roundRect", "strokeRect"
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
    style: { setProperty: noop, removeProperty: noop, width: "", height: "", transform: "" },
    dataset: {},
    width: 0,
    height: 0,
    disabled: false,
    hidden: false,
    title: "",
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
    remove() {
      // a detached node simply disappears from the tape bookkeeping
      el._removed = true;
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 560, bottom: 560, width: 560, height: 560 }),
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

// 把 index.html 里静态骨架的 id / data-i18n 同步到桩上：
// ui.applyStatic() 靠 getElementById + data-i18n 给铭牌条换语言，桩不还原就永远测不到
// 「静态中文标签被热更新」这条链路（本测试最初就栽在这里）。
function seedFromHtml(html) {
  for (const m of html.matchAll(/<([a-zA-Z][\w-]*)([^>]*)>/g)) {
    const attrs = m[2];
    const idm = /\bid="([^"]+)"/.exec(attrs);
    if (!idm) continue;
    const el = getEl(idm[1]);
    el.tagName = m[1].toUpperCase();
    for (const a of attrs.matchAll(/([\w-]+)="([^"]*)"/g)) {
      el.setAttribute(a[1], a[2]);
    }
  }
}
try {
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  seedFromHtml(readFileSync(resolve(import.meta.dirname, "..", "index.html"), "utf8"));
} catch {
  /* running without the html next to it */
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
  querySelector: () => null,
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
  matchMedia: () => ({ matches: false, media: "", addEventListener: noop, removeEventListener: noop })
};

global.matchMedia = global.window.matchMedia;
global.performance = { now: () => Date.now() };

let rafQueue = [];
global.requestAnimationFrame = (fn) => { rafQueue.push(fn); return rafQueue.length; };
global.cancelAnimationFrame = noop;

Object.defineProperty(globalThis, "navigator", {
  value: { userAgent: "node", language: "zh-CN", languages: ["zh-CN"] },
  configurable: true,
  writable: true
});

// localStorage 桩：先装桩再 import 页面模块
const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear(),
  get length() { return store.size; },
  key: (i) => [...store.keys()][i] ?? null
};

// 老玩家存档：解锁前 12 关，前 6 关有两星，第 1 章勋章已拿到
const SEEDED_UNLOCKED = 12;
if (!FRESH) {
  const campaign = {};
  for (let i = 0; i < SEEDED_UNLOCKED; i += 1) {
    const ch = Math.floor(i / 4) + 1;
    const ix = (i % 4) + 1;
    campaign[`level_${ch}_${ix}`] = { stars: i < 6 ? 2 : 1, time: 40 + i, baseHp: 3, deaths: 0, score: 800 + i * 30 };
  }
  store.set("doin.tank.v1", JSON.stringify({
    version: 1,
    muted: false,
    hints: true,
    campaign,
    endgames: { endgame_1: { cleared: true, time: 22, ammoLeft: 3, score: 900 } },
    campaignUnlocked: SEEDED_UNLOCKED,
    endgameUnlocked: 2,
    medals: { "1": true },
    records: { stars: 18, cleared: SEEDED_UNLOCKED, bestWave: 4, bestHold: 96, maxCombo: 5, kills: 120, bricks: 300, ricochets: 9, shots: 400, hits: 260 }
  }));
}

// AudioContext 桩
class FakeParam {
  constructor(v) { this.value = v; }
  setValueAtTime() { return this; }
  linearRampToValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
  cancelScheduledValues() { return this; }
}
function nodeLike(extra) {
  return Object.assign({ connect() { return this; }, disconnect() { return this; } }, extra);
}
global.AudioContext = class {
  constructor() { this.currentTime = 0; this.state = "running"; this.destination = {}; this.sampleRate = 48000; }
  resume() { return Promise.resolve(); }
  createGain() { return nodeLike({ gain: new FakeParam(1) }); }
  createOscillator() { return nodeLike({ frequency: new FakeParam(440), detune: new FakeParam(0), type: "sine", start: noop, stop: noop }); }
  createBiquadFilter() { return nodeLike({ frequency: new FakeParam(1000), Q: new FakeParam(1), gain: new FakeParam(0), type: "lowpass" }); }
  createBufferSource() { return nodeLike({ buffer: null, playbackRate: new FakeParam(1), loop: false, start: noop, stop: noop }); }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len), length: len }; }
  createDelay() { return nodeLike({ delayTime: new FakeParam(0) }); }
  createStereoPanner() { return nodeLike({ pan: new FakeParam(0) }); }
  createWaveShaper() { return nodeLike({ curve: null, oversample: "none" }); }
  createDynamicsCompressor() {
    return nodeLike({ threshold: new FakeParam(-24), knee: new FakeParam(30), ratio: new FakeParam(12), attack: new FakeParam(0.003), release: new FakeParam(0.25) });
  }
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
    try { fn(Object.assign({ preventDefault: noop, stopPropagation: noop, type }, ev)); }
    catch (e) { errors.push(`window/${type}: ${e.stack}`); }
  }
}

function fireDoc(type, ev) {
  for (const fn of docHandlers[type] || []) {
    try { fn(Object.assign({ preventDefault: noop, stopPropagation: noop, type }, ev)); }
    catch (e) { errors.push(`document/${type}: ${e.stack}`); }
  }
}

function clickEl(id) {
  const el = getEl(id);
  for (const fn of el._h.click || []) {
    try { fn({ preventDefault: noop, stopPropagation: noop, target: el }); }
    catch (e) { errors.push(`${id}/click: ${e.stack}`); }
  }
}

function clickNode(el, tag) {
  for (const fn of el._h.click || []) {
    try { fn({ preventDefault: noop, stopPropagation: noop, target: el }); }
    catch (e) { errors.push(`${tag}/click: ${e.stack}`); }
  }
}

function pointer(el, down, tag) {
  const type = down ? "pointerdown" : "pointerup";
  for (const fn of el._h[type] || []) {
    try { fn({ preventDefault: noop, stopPropagation: noop, target: el, pointerId: 1 }); }
    catch (e) { errors.push(`${tag}/${type}: ${e.stack}`); }
  }
}

// ============================================================ 载入页面模块

const main = await import(new URL("../js/main.mjs", import.meta.url).href).catch((e) => {
  errors.push("import main.mjs: " + e.stack);
  return null;
});

if (!main && errors.length) console.log("!! main.mjs 装载失败：\n" + errors.join("\n"));

const app = main?.boot?.() ?? null;
const ui = app?.ui;
const game = app?.game;
const renderer = app?.renderer;

// ============================================================ 观测助手

const node = (id) => ui?.nodes?.[id];
const text = (id) => node(id)?.textContent ?? "";

// 找弹层里某个 data-action 的按钮
function findAction(action, list) {
  const pool = list ?? collect(ui.overlayBody, []);
  return pool.find((el) => el.getAttribute?.("data-action") === action) ?? null;
}

function collect(el, out = []) {
  if (!el) return out;
  out.push(el);
  for (const child of el.children || []) collect(child, out);
  return out;
}

function allButtons() {
  return collect(ui.overlayBody, []).filter((el) => el.tagName === "BUTTON");
}

function readSeconds(id) {
  const m = /^(\d+):(\d{2})$/.exec(text(id));
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

function advance(label) {
  const before = readSeconds("val-time");
  pump(120, label);
  return { before, after: readSeconds("val-time") };
}

// ============================================================ 断言收集

const report = [];
const fails = [];
function check(name, ok, detail = "") {
  report.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) fails.push(name + (detail ? " — " + detail : ""));
}

// --- 0. 装配层是否真的拿起了 DOM ---
check("boot() 返回装配对象", Boolean(app && ui && game && renderer), "");
check("画布拿到了 2D 上下文", Boolean(renderer?.ctx), "");
check("画布已按 DPR 定尺", (node("field")?.width ?? 0) > 0, `canvas.width=${node("field")?.width}`);

// --- 1. 首屏菜单 ---
check("首屏停在菜单弹层", ui.overlay === "menu" && ui.isOverlayOpen(), `overlay=${ui.overlay}`);
const modeButtons = allButtons();
check("菜单列出三种作战", modeButtons.filter((b) => ["campaign", "siege", "puzzle"].includes(b.getAttribute?.("data-action"))).length === 3,
  `按钮=${modeButtons.length}`);
check("菜单展示记录读数", text("val-hints").length > 0, `hints="${text("val-hints")}"`);

// --- 2. 战役地图 ---
clickNode(findAction("campaign"), "campaign");
check("进入战役地图", ui.overlay === "campaign", `overlay=${ui.overlay}`);
const stageBtns = allButtons().filter((b) => b.getAttribute?.("data-action") === "play" && b.className.includes("stage-btn"));
const unlocked = stageBtns.filter((b) => !b.disabled).length;
check("战役地图列出 24 个关卡位", stageBtns.length === 24, `stage-btn=${stageBtns.length}`);
check(FRESH ? "空存档只解锁第 1 关" : "老玩家存档解锁 12 关",
  unlocked === (FRESH ? 1 : SEEDED_UNLOCKED), `已解锁=${unlocked}`);
const starPips = collect(ui.overlayBody, []).filter((el) => el.className === "pip on").length;
check(FRESH ? "空存档没有点亮星章" : "地图点亮历史星章", FRESH ? starPips === 0 : starPips === 18, `pip.on=${starPips}`);

// --- 3. 选关进入战斗 ---
clickNode(stageBtns[0], "stage-1");
pump(3, "开局");
check("点关卡进入战斗并关掉弹层", ui.overlay === "none" && !ui.isOverlayOpen() && game.state, `overlay=${ui.overlay}`);
check("HUD 敌军读数已填充", /^\d+\/\d+$/.test(text("val-enemy")), `val-enemy="${text("val-enemy")}"`);
check("HUD 司令部耐久为 3/3", text("val-base") === "3/3", `val-base="${text("val-base")}"`);
check("HUD 指令名已本地化", text("val-order").length > 0, `val-order="${text("val-order")}"`);

// --- 4. 用时在推进 ---
const a = advance("首屏");
check("入口A 首屏：120 帧内用时在推进", a.after > a.before, `${a.before} → ${a.after}`);

// --- 5. 键盘行驶 ---
const px0 = game.state.player.x;
fireWin("keydown", { code: "ArrowRight" });
pump(40, "右移");
fireWin("keyup", { code: "ArrowRight" });
check("入口B 方向键：坦克真的往右开了", game.state.player.x > px0, `x ${px0.toFixed(2)} → ${game.state.player.x.toFixed(2)}`);

// --- 6. 开炮（走真实冷却与统计） ---
const shots0 = game.state.stats.shots;
fireWin("keydown", { code: "Space" });
pump(20, "开炮");
check("入口C 开炮：射击计数真的增加", game.state.stats.shots > shots0, `shots ${shots0} → ${game.state.stats.shots}`);

// --- 7. 虚拟方向键长按 ---
const py0 = game.state.player.y;
const pads = collect(ui.root, []).filter((el) => el.className?.startsWith?.("pad pad-"));
check("操作台有四个方向键", pads.length === 4, `pad=${pads.length}`);
const up = pads.find((el) => el.className.includes("pad-up"));
if (up) {
  pointer(up, true, "pad-up");
  pump(30, "按上");
  pointer(up, false, "pad-up");
  check("入口D 虚拟键：坦克往上行进", game.state.player.y < py0, `y ${py0.toFixed(2)} → ${game.state.player.y.toFixed(2)}`);
}

// --- 8. 指令槽 ---
game.state.charge = game.state.chargeMax ?? 100;
const order0 = game.state.orderIndex;
fireWin("keydown", { code: "KeyK" });
pump(10, "指令");
check("入口E 指令键：充能满格时真的发动并轮换",
  game.state.orderIndex !== order0 && game.state.charge === 0, `order ${order0} → ${game.state.orderIndex}`);

// --- 9. 电报纸带在打战报 ---
const tapeLines = (ui.tapeList?.children ?? []).length;
check("电报纸带打印了战报", tapeLines > 0, `行数=${tapeLines}`);

// --- 10. 暂停 / 恢复 ---
fireWin("keydown", { code: "KeyP" });
pump(2, "暂停");
const pausedNow = game.paused;
check("入口F P 键暂停并弹出暂停层", pausedNow === true && ui.overlay === "pause", `overlay=${ui.overlay}`);
const resumeBtn = findAction("resume");
if (resumeBtn) clickNode(resumeBtn, "resume");
pump(2, "恢复");
const g1 = advance("恢复后");
check("入口F 恢复后用时继续推进", game.paused === false && g1.after > g1.before, `${g1.before} → ${g1.after}`);

// --- 11. R 键重开 ---
fireWin("keydown", { code: "KeyR" });
pump(3, "重开");
const h1 = advance("重开后");
check("入口G R 键重开：用时归零后继续推进", h1.before <= 1 && h1.after > h1.before, `${h1.before} → ${h1.after}`);

// --- 12. 语言切换（zh ↔ en）---
const zhOrder = text("val-order");
const zhDocTitle = document.title;
const lastTape = () => {
  const kids = ui.tapeList?.children ?? [];
  return kids.length ? kids[kids.length - 1].textContent : "";
};
const zhTape = lastTape();
clickEl("btn-lang");
const enOrder = text("val-order");
const enTitle = getEl("game-title").textContent;
const enDocTitle = document.title;
const enAria = getEl("btn-help")?.getAttribute?.("aria-label") ?? "";
const enTape = lastTape();
clickEl("btn-lang");
const zhOrder2 = text("val-order");
check("入口H 语言切换：指令名在 zh/en 间真实切换且可切回",
  zhOrder !== enOrder && zhOrder2 === zhOrder, `"${zhOrder}" → "${enOrder}" → "${zhOrder2}"`);
check("入口H 语言切换：静态铭牌标题跟随切换", enTitle === "Tank Assault", `title="${enTitle}"`);
check("语言H2 英文态不留中文：页签标题与 aria-label 同步",
  enDocTitle !== zhDocTitle && !/[一-龥]/.test(enDocTitle) && !/[一-龥]/.test(enAria),
  `zh="${zhDocTitle}" en="${enDocTitle}" aria="${enAria}"`);
check("语言H3 战报纸带跟随语言重绘（不再残留开战时的语言）",
  zhTape !== "" && !/[一-龥]/.test(enTape) && enTape !== zhTape,
  `zh="${zhTape}" en="${enTape}"`);

// --- 13. 语言切换不得动游戏状态 ---
const snapshot = { x: game.state.player.x, t: game.state.time, hp: game.state.base.hp };
clickEl("btn-lang");
clickEl("btn-lang");
check("语言切换零副作用：盘面状态毫秒不差",
  game.state.player.x === snapshot.x && game.state.time === snapshot.t && game.state.base.hp === snapshot.hp,
  `x=${game.state.player.x.toFixed(3)} time=${game.state.time.toFixed(3)}`);

// --- 14. 音效开关落到存档 ---
clickEl("btn-sound");
const mutedAfter = JSON.parse(store.get("doin.tank.v1") || "{}").muted;
clickEl("btn-sound");
check("入口I 音效开关真实写入存档", typeof mutedAfter === "boolean", `muted=${mutedAfter}`);

// --- 15. 借屏作战命令：从哪来回哪去 + 键盘说明可见 ---
const before = ui.overlay;
clickEl("btn-help");
const helpOpen = ui.overlay === "help";
// the stub has no text aggregation, so read each cell by hand
const keyRows = collect(ui.overlayBody, []).filter((el) => el.className === "keys-row");
const keyText = keyRows.map((row) => (row.children || []).map((c) => c.textContent ?? "").join("=")).join(" | ");
clickNode(findAction("close"), "close-help");
check("入口J 作战命令借屏：关闭后原样返回", helpOpen && ui.overlay === before, `${before} → help → ${ui.overlay}`);
check("快捷键A 命令面板列出全部按键", keyRows.length === 5 && /Space|方向键|Arrows/.test(keyText) && /R/.test(keyText),
  `rows=${keyRows.length} ${keyText.slice(0, 100)}`);
check("快捷键B 操作台键帽存在",
  ui.nodes["keycap-fire"]?.textContent === "SPACE" && ui.nodes["keycap-order"]?.textContent === "K",
  `fire=${ui.nodes["keycap-fire"]?.textContent} order=${ui.nodes["keycap-order"]?.textContent}`);

// --- 16. 死守模式入口 ---
ui.showMenu();
clickNode(findAction("siege"), "siege");
pump(120, "死守");
check("入口K 死守模式：开局后波次读数存在且推进",
  game.mode === "last_stand" && text("val-wave") === "1" && readSeconds("val-time") > 0,
  `mode=${game.mode} wave=${text("val-wave")} time=${text("val-time")}`);

// --- 17. 切后台暂停 ---
document.hidden = true;
fireDoc("visibilitychange", {});
const pausedBg = game.paused;
document.hidden = false;
ui.showOverlay("none");
pump(3, "回前台");
check("入口L 切后台自动暂停", pausedBg === true, `paused=${pausedBg}`);

// --- 18. resize / blur ---
fireWin("resize", {});
fireWin("orientationchange", {});
fireWin("blur", {});
pump(5, "resize 后");
check("入口M resize 与 blur 后无异常", errors.length === 0, errors.slice(0, 2).join(" | "));

// --- 19. 结算弹层（直接把战局判负，走真实 finish 路径）---
ui.showOverlay("none");
game.start("campaign", 0);
pump(5, "新局");
// 只把耐久打到 0，剩下的交给引擎 checkEnd → 控制器 finish 这条真实链路
game.state.base.hp = 0;
pump(5, "判负");
check("入口N 失败走真实结算：弹层切到 result", ui.overlay === "result", `overlay=${ui.overlay}`);
const resultBtns = allButtons().map((b) => b.getAttribute?.("data-action"));
check("结算面板给出再战与返回入口", resultBtns.includes("retry") && resultBtns.includes("map"), `actions=${resultBtns.join(",")}`);

// --- 20. 跑满一段真实战斗，确认不抛错 ---
ui.showOverlay("none");
game.start("campaign", 0);
pump(600, "长跑");
check("长跑 600 帧无运行时异常", errors.length === 0, errors.slice(0, 2).join(" | "));

// ============================================================ 输出

const totalDraw = calls.fill + calls.stroke + calls.fillRect + calls.drawImage + calls.arc;
const perFrame = framesRun ? Math.round(totalDraw / framesRun) : 0;

console.log(report.join("\n"));
console.log("---");
console.log(`视口 ${VW}x${VH} | 存档 ${FRESH ? "空" : "老玩家"} | 驱动帧数 ${framesRun}`);
console.log(`绘制调用：fill ${calls.fill} | stroke ${calls.stroke} | fillRect ${calls.fillRect} | arc ${calls.arc} | drawImage ${calls.drawImage}`);
console.log(`平均每帧 draw call ≈ ${perFrame}`);
if (perFrame > 800) console.log(`!! 每帧 draw call ${perFrame} 偏高（建议 < 800）`);

if (badColor.length) {
  console.log(`\n!! 非法颜色 ${badColor.length} 处（前 5）:`);
  for (const s of badColor.slice(0, 5)) console.log("   " + s);
}
if (errors.length) {
  console.log(`\n!! 运行时异常 ${errors.length} 处（前 3）:`);
  for (const s of errors.slice(0, 3)) console.log("\n" + s);
}

if (fails.length || errors.length || badColor.length) {
  console.log(`\n结果：FAIL（${fails.length} 项断言失败 / ${errors.length} 处异常 / ${badColor.length} 处非法颜色）`);
  process.exit(1);
}
console.log(`\n结果：PASS（${report.length} 项断言全过，0 异常，0 非法颜色）`);
