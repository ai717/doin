// Tenpai King · 无浏览器冒烟（DOM 桩 + Canvas 桩，跑真实的 main.mjs 装配链路）
//
// 线上事故回归点：
// 1) ui.renderTilePicker 里 `TILES[k].suit === g.key` 用了未定义变量 → 抛 ReferenceError，
//    34 张候选牌一张都渲染不出来，玩家「无法点选」。
// 2) game.update() 每帧调 onStateChange，而它重建 13+34 个牌面 DOM。点击落在被替换的节点上
//    会被吞掉，同样表现为「点不动」。
// 纯逻辑单测（engine/game/score）对这两类接线错误完全无感，只能靠真实装配冒烟兜住。

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const gameDir = resolve(here, "..");
const HTML = readFileSync(resolve(gameDir, "index.html"), "utf8");

// ---------------------------------------------------------------- DOM 桩

class StubClassList {
  constructor(owner) {
    this.owner = owner;
    this.set = new Set();
  }

  add(...names) {
    for (const n of names) if (n) this.set.add(n);
    this.owner._syncClass();
  }

  remove(...names) {
    for (const n of names) this.set.delete(n);
    this.owner._syncClass();
  }

  contains(name) {
    return this.set.has(name);
  }

  toggle(name, force) {
    const on = force === undefined ? !this.set.has(name) : Boolean(force);
    if (on) this.set.add(name);
    else this.set.delete(name);
    this.owner._syncClass();
    return on;
  }
}

class StubElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.dataset = {};
    this.classList = new StubClassList(this);
    this.listeners = new Map();
    this.style = new Proxy({ setProperty: () => {} }, { get: (t, k) => t[k], set: (t, k, v) => ((t[k] = v), true) });
    this._text = "";
    this.disabled = false;
    if (this.tagName === "CANVAS") {
      this.width = 0;
      this.height = 0;
      this._ctx = makeCtx();
    }
  }

  _syncClass() {
    this.attributes.set("class", [...this.classList.set].join(" "));
  }

  get className() {
    return this.attributes.get("class") ?? "";
  }

  set className(value) {
    this.classList.set = new Set(String(value).split(/\s+/).filter(Boolean));
    this._syncClass();
  }

  get id() {
    return this.attributes.get("id") ?? "";
  }

  set id(value) {
    this.attributes.set("id", value);
  }

  get hidden() {
    return this.attributes.has("hidden");
  }

  set hidden(value) {
    this.toggleAttribute("hidden", Boolean(value));
  }

  get textContent() {
    return this._text;
  }

  set textContent(value) {
    this._text = String(value);
    this.children = [];
  }

  // tenpai 的 UI 完全靠模板字符串灌 innerHTML 再 querySelector 找回来，
  // 桩必须真解析，否则所有 .mahjong-tile / 章节节点都查不到。
  set innerHTML(value) {
    this.children = [];
    this._text = "";
    const raw = String(value ?? "");
    if (!raw.trim()) return;
    const frag = parseHtml(raw);
    for (const child of [...frag.children]) {
      child.parentNode = this;
      this.children.push(child);
    }
  }

  get innerHTML() {
    return "";
  }

  appendChild(node) {
    node.parentNode = this;
    this.children.push(node);
    return node;
  }

  removeChild(node) {
    const i = this.children.indexOf(node);
    if (i >= 0) this.children.splice(i, 1);
    return node;
  }

  remove() {
    this.parentNode?.removeChild(this);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name.startsWith("data-")) this.dataset[camel(name.slice(5))] = String(value);
    if (name === "disabled") this.disabled = true;
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  toggleAttribute(name, force) {
    const on = force === undefined ? !this.attributes.has(name) : Boolean(force);
    if (on) this.attributes.set(name, "");
    else this.attributes.delete(name);
    return on;
  }

  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }

  removeEventListener() {}

  dispatch(type, event = {}) {
    const payload = { type, target: this, currentTarget: this, preventDefault: () => {}, stopPropagation: () => {}, ...event };
    for (const fn of this.listeners.get(type) ?? []) fn(payload);
    return payload;
  }

  click() {
    if (this.disabled) return null;
    return this.dispatch("click");
  }

  getBoundingClientRect() {
    return { x: 0, y: 0, left: 100, top: 100, width: 800, height: 600, right: 900, bottom: 700 };
  }

  getContext() {
    return this._ctx;
  }

  get parentElement() {
    return this.parentNode;
  }

  matches(selector) {
    const sel = String(selector).trim();
    if (!sel || /[\s>,+~]/.test(sel)) return false;
    const re = /([a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g;
    let m;
    let pos = 0;
    while ((m = re.exec(sel))) {
      if (m.index !== pos) return false;
      pos = re.lastIndex;
      if (m[1] && this.tagName !== m[1].toUpperCase()) return false;
      if (m[2] && this.id !== m[2]) return false;
      if (m[3] && !this.classList.contains(m[3])) return false;
      if (m[4]) {
        if (!this.attributes.has(m[4])) return false;
        if (m[5] !== undefined && this.attributes.get(m[4]) !== m[5]) return false;
      }
    }
    return pos === sel.length;
  }

  querySelector(selector) {
    return this.descendants().find((node) => node.matches(selector)) ?? null;
  }

  querySelectorAll(selector) {
    return this.descendants().filter((node) => node.matches(selector));
  }

  descendants() {
    const out = [];
    const walk = (node) => {
      for (const child of node.children) {
        out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }
}

function camel(name) {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function makeCtx() {
  const target = { canvas: null, clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, save: () => {}, restore: () => {}, scale: () => {} };
  return new Proxy(target, {
    get(obj, key) {
      if (key in obj) return obj[key];
      return () => undefined;
    },
    set(obj, key, value) {
      obj[key] = value;
      return true;
    },
  });
}

function parseHtml(html) {
  const doc = new StubElement("document");
  const stack = [doc];
  const token = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\/([a-zA-Z0-9]+)\s*>|<([a-zA-Z0-9]+)([^>]*?)(\/?)>|([^<]+)/g;
  let match;
  let pendingText = "";

  while ((match = token.exec(html))) {
    const [full, closeTag, openTag, attrs, selfClose, text] = match;
    if (full.startsWith("<!")) continue;
    if (closeTag) {
      if (pendingText.trim() && stack.length > 1) stack[stack.length - 1]._text = pendingText.trim();
      pendingText = "";
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (openTag) {
      const tag = openTag.toLowerCase();
      if (["meta", "link", "br", "img", "input"].includes(tag)) continue;
      const el = new StubElement(tag);
      for (const m of (attrs ?? "").matchAll(/([a-zA-Z0-9-]+)(?:="([^"]*)")?/g)) {
        const name = m[1];
        const value = m[2] ?? "";
        el.attributes.set(name, value);
        if (name === "class") el.classList.set = new Set(value.split(/\s+/).filter(Boolean));
        if (name.startsWith("data-")) el.dataset[camel(name.slice(5))] = value;
      }
      const parent = stack[stack.length - 1];
      el.parentNode = parent;
      parent.children.push(el);
      if (pendingText.trim()) parent._text = pendingText.trim();
      pendingText = "";
      if (!selfClose && tag !== "script" && tag !== "title") stack.push(el);
      continue;
    }
    if (text) pendingText += text;
  }

  return doc;
}

// ---------------------------------------------------------------- 环境装配

function installEnv() {
  const doc = parseHtml(HTML);
  const winListeners = new Map();
  const docListeners = new Map();
  const frames = [];

  const document = {
    documentElement: doc.querySelector("html") ?? new StubElement("html"),
    body: doc.querySelector("body") ?? new StubElement("body"),
    title: "",
    hidden: false,
    createElement: (tag) => new StubElement(tag),
    getElementById: (id) => doc.descendants().find((n) => n.id === id) ?? null,
    querySelector: (s) => doc.querySelector(s),
    querySelectorAll: (s) => doc.querySelectorAll(s),
    addEventListener: (type, fn) => {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
    removeEventListener: () => {},
    dispatch: (type, event = {}) => {
      for (const fn of docListeners.get(type) ?? []) fn({ type, preventDefault: () => {}, ...event });
    },
  };

  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };

  const win = {
    document,
    localStorage,
    devicePixelRatio: 1,
    performance: { now: () => 0 },
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    requestAnimationFrame: (fn) => {
      frames.push(fn);
      return frames.length;
    },
    cancelAnimationFrame: () => {},
    addEventListener: (type, fn) => {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    removeEventListener: () => {},
    dispatch: (type, event = {}) => {
      for (const fn of winListeners.get(type) ?? []) fn({ type, preventDefault: () => {}, ...event });
    },
    AudioContext: undefined,
    webkitAudioContext: undefined,
  };

  Object.defineProperty(globalThis, "window", { value: globalThis, writable: true, configurable: true });
  for (const [key, value] of Object.entries(win)) {
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }

  let clock = 1000;
  return {
    document,
    store,
    winListeners,
    frames,
    // 虚拟时钟必须递增：main 的 loop 用 (now - lastTime)/1000 算 dt
    step(n = 1, dtMs = 16) {
      for (let i = 0; i < n; i += 1) {
        const fn = frames.shift();
        if (!fn) return false;
        clock += dtMs;
        fn(clock);
      }
      return true;
    },
  };
}

// ---------------------------------------------------------------- boot

const env = installEnv();
await import("../js/main.mjs");
globalThis.dispatch("DOMContentLoaded");

const doc = env.document;
const $ = (sel) => doc.querySelector(sel);
const tp = globalThis.__tenpai;

const pickerNodes = () => $("#tile-picker").querySelectorAll(".picker-tile-wrap");
const tileIdOf = (node) => node.querySelector(".mahjong-tile")?.dataset.tile;

// ---------------------------------------------------------------- 用例

test("装配：init 完成且不抛错，调试句柄就绪", () => {
  assert.ok(tp, "window.__tenpai 应存在");
  assert.ok(tp.game, "__tenpai.game 应拿到 controller");
  assert.equal(tp.game.getState().status, "answering", "首屏直接进入可作答状态");
});

test("牌面渲染：13 张手牌 + 34 张候选牌 + 4 个花色行（g.key 崩溃的回归点）", () => {
  assert.equal($("#hand-tiles").querySelectorAll(".mahjong-tile").length, 13, "手牌应 13 张");
  assert.equal($("#tile-picker").querySelectorAll(".picker-suit-row").length, 4, "应分万/筒/条/字四行");
  assert.equal(pickerNodes().length, 34, "候选牌应 34 张，一张都不能少");
  const ids = pickerNodes().map(tileIdOf);
  assert.ok(ids.every(Boolean), "每张候选牌都要带 data-tile");
  assert.equal(new Set(ids).size, 34, "34 张候选牌不得重复");
});

test("点选：点一张即选中，提交按钮解禁", () => {
  const target = pickerNodes().find((n) => tileIdOf(n) === "1m");
  assert.ok(target, "应能定位到 1m 候选牌");
  assert.equal($("#btn-submit").disabled, true, "未选时不能提交");

  target.click();
  assert.deepEqual(tp.game.getState().userPicks, ["1m"], "点选应写入 userPicks");
  assert.equal(pickerNodes().find((n) => tileIdOf(n) === "1m").classList.contains("selected"), true, "应带 selected 态");
  assert.equal($("#btn-submit").disabled, false, "选了就能提交");
});

test("点选：对同一张再点一次设为主攻，第三次取消", () => {
  pickerNodes().find((n) => tileIdOf(n) === "1m").click();
  assert.equal(tp.game.getState().userTarget, "1m", "第二击应设为主攻听牌");
  assert.equal(pickerNodes().find((n) => tileIdOf(n) === "1m").classList.contains("is-target"), true, "应带 is-target 态");

  pickerNodes().find((n) => tileIdOf(n) === "1m").click();
  assert.deepEqual(tp.game.getState().userPicks, [], "第三击应取消");
  assert.equal(tp.game.getState().userTarget, null);
});

test("重选：清空所有选择并禁用提交", () => {
  pickerNodes().find((n) => tileIdOf(n) === "2p").click();
  assert.equal($("#btn-submit").disabled, false);
  $("#btn-clear").click();
  assert.deepEqual(tp.game.getState().userPicks, []);
  assert.equal($("#btn-submit").disabled, true, "清空后不能提交");
});

test("逐帧刷新不得重建牌面 DOM（点击被替换节点吞掉的回归点）", () => {
  const before = pickerNodes()[0];
  const handBefore = $("#hand-tiles").querySelectorAll(".mahjong-tile")[0];
  assert.ok(env.step(12), "rAF 循环应持续排帧");
  assert.equal(pickerNodes()[0], before, "候选牌节点必须保持同一引用");
  assert.equal($("#hand-tiles").querySelectorAll(".mahjong-tile")[0], handBefore, "手牌节点必须保持同一引用");
});

test("倒计时：逐帧递减且在 HUD 上刷新", () => {
  const t0 = tp.game.getState().remainingSec;
  env.step(60, 16);
  const t1 = tp.game.getState().remainingSec;
  assert.ok(t1 < t0, "计时应递减");
  assert.match($("#hud-timer").textContent, /^\d+s$/, "HUD 应显示秒数");
});

test("结算：选全正确听牌 → 提交 → 面板展开并给出番型拆解", () => {
  const waits = tp.game.getState().levelConfig.waits;
  for (const node of pickerNodes()) {
    if (waits.includes(tileIdOf(node))) node.click();
  }
  assert.equal(tp.game.getState().userPicks.length, waits.length, "应能选全全部听牌");

  $("#btn-submit").click();
  const state = tp.game.getState();
  assert.equal(state.status, "submitted");
  assert.equal(state.lastEvalResult.isPerfect, true, "选全即满分");
  assert.equal($("#result-panel").classList.contains("visible"), true, "结算抽屉应展开");
  assert.equal($("#result-waits-list").querySelectorAll(".reveal-tile-box").length, waits.length, "应逐张揭示听牌");

  // 提交后不能再改选
  const pickBefore = [...state.userPicks];
  pickerNodes()[0].click();
  assert.deepEqual(tp.game.getState().userPicks, pickBefore, "提交后点选应被忽略");
});

test("下一题：重置盘面回到可作答态", () => {
  $("#btn-next").click();
  const state = tp.game.getState();
  assert.equal(state.status, "answering");
  assert.deepEqual(state.userPicks, []);
  assert.equal($("#result-panel").classList.contains("visible"), false);
  assert.equal(pickerNodes().length, 34, "新题应重绘完整候选牌");
  assert.equal($("#hand-tiles").querySelectorAll(".mahjong-tile").length, 13);
});
