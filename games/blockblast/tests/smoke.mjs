// 积木爆破 · 无浏览器冒烟（最小 DOM 桩 + Canvas 桩，跑真实的 main.mjs 装配链路）
//
// 目的：验证「HTML 骨架 ↔ ui.mjs ↔ main.mjs ↔ render.mjs ↔ game.mjs」这条接缝真的能跑起来，
// 而不是只验证纯逻辑。断言一律看业务可观测量的推进（计分牌文本、盘面占用、吐司、弹层 hidden）。

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { GRID, canPlace, pieceCells, grabCell } from "../js/engine.mjs";
import * as i18n from "../js/i18n.mjs";
import { STORAGE_KEY, resetBackendForTests } from "../js/storage.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const gameDir = resolve(here, "..");
const HTML = readFileSync(resolve(gameDir, "index.html"), "utf8");

// Node 真定时器先捕获：桩挂上全局 setTimeout 后，箭头里再写 setTimeout 会自引用爆栈
const nodeSetTimeout = setTimeout;
const nodeClearTimeout = clearTimeout;

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
    this.style = new Proxy({ setProperty: () => {} }, { get: (t, k) => t[k], set: (t, k, v) => (t[k] = v, true) });
    this._text = "";
    this.disabled = false;
    if (this.tagName === "CANVAS") {
      this.width = 720;
      this.height = 560;
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

  // hidden 属性即唯一事实来源（与真实 DOM 一致）：property 与 attribute 双向同步，
  // 否则 toggleAttribute 改了 attribute、property 还读旧值，断言会假绿。
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

  set innerHTML(value) {
    this.children = [];
    if (value !== "") return;
  }

  get innerHTML() {
    return "";
  }

  get firstChild() {
    return this.children[0] ?? null;
  }

  appendChild(node) {
    if (node?.__fragment) {
      for (const child of node.children) this.appendChild(child);
      return node;
    }
    node.parentNode = this;
    this.children.push(node);
    return node;
  }

  append(...nodes) {
    for (const node of nodes) this.appendChild(node);
  }

  removeChild(node) {
    const i = this.children.indexOf(node);
    if (i >= 0) this.children.splice(i, 1);
    return node;
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

  removeEventListener(type, fn) {
    const list = this.listeners.get(type) ?? [];
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }

  dispatch(type, event = {}) {
    const list = this.listeners.get(type) ?? [];
    const payload = { type, target: this, currentTarget: this, preventDefault: () => {}, stopPropagation: () => {}, ...event };
    for (const fn of list) fn(payload);
    return payload;
  }

  click() {
    return this.dispatch("click");
  }

  getBoundingClientRect() {
    return { x: 0, y: 0, left: 0, top: 0, width: this.width ?? 720, height: this.height ?? 560, right: this.width ?? 720, bottom: this.height ?? 560 };
  }

  setPointerCapture() {}

  releasePointerCapture() {}

  getContext() {
    return this._ctx;
  }

  matches(selector) {
    if (selector.startsWith("#")) return this.id === selector.slice(1);
    if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
    if (selector.startsWith("[")) {
      const name = selector.slice(1, -1);
      return this.attributes.has(name);
    }
    return this.tagName === selector.toUpperCase();
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

  get parentElement() {
    return this.parentNode;
  }

  get ownerDocument() {
    return globalThis.document;
  }
}

function camel(name) {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function makeCtx() {
  const gradient = { addColorStop: () => {} };
  const target = {
    canvas: null,
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    globalAlpha: 1,
    font: "10px sans-serif",
    textAlign: "left",
    textBaseline: "alphabetic",
    shadowBlur: 0,
    shadowColor: "#000",
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => null,
    measureText: () => ({ width: 0 })
  };
  return new Proxy(target, {
    get(obj, key) {
      if (key in obj) return obj[key];
      return () => undefined;
    },
    set(obj, key, value) {
      obj[key] = value;
      return true;
    }
  });
}

// 极简 HTML 解析：只处理标签与属性，文本节点并入父元素的 _text
function parseHtml(html) {
  const doc = new StubElement("document");
  const byId = new Map();
  const stack = [doc];
  const token = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\/([a-zA-Z0-9]+)\s*>|<([a-zA-Z0-9]+)([^>]*?)(\/?)>|([^<]+)/g;
  let match;
  let pendingText = "";

  while ((match = token.exec(html))) {
    const [full, closeTag, openTag, attrs, selfClose, text] = match;
    if (full.startsWith("<!")) continue;
    if (closeTag) {
      // 叶子元素的静态文本在闭合时归位（否则「返回门户」这类无子节点文本会丢）
      if (pendingText.trim() && stack.length > 1) stack[stack.length - 1]._text = pendingText.trim();
      pendingText = "";
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (openTag) {
      const tag = openTag.toLowerCase();
      if (["meta", "link", "br", "img", "input"].includes(tag)) continue;
      const el = new StubElement(tag);
      // 属性名必须含数字：data-i18n / data-i18n-title / data-i18n-aria 全靠它
      for (const m of (attrs ?? "").matchAll(/([a-zA-Z0-9-]+)(?:="([^"]*)")?/g)) {
        const name = m[1];
        const value = m[2] ?? "";
        el.attributes.set(name, value);
        if (name === "id") byId.set(value, el);
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

  doc.byId = byId;
  return doc;
}

// ---------------------------------------------------------------- 环境装配

function installEnv() {
  const doc = parseHtml(HTML);
  const listeners = new Map();
  const frames = [];

  const document = {
    documentElement: doc.querySelector("html") ?? new StubElement("html"),
    body: doc.querySelector("body") ?? new StubElement("body"),
    title: "",
    byId: doc.byId,
    createElement: (tag) => new StubElement(tag),
    createElementNS: (_ns, tag) => new StubElement(tag),
    createDocumentFragment: () => {
      const frag = new StubElement("fragment");
      frag.__fragment = true;
      return frag;
    },
    createTextNode: (text) => {
      const node = new StubElement("#text");
      node._text = text;
      return node;
    },
    getElementById: (id) => doc.byId.get(id) ?? null,
    querySelector: (selector) => doc.querySelector(selector),
    querySelectorAll: (selector) => doc.querySelectorAll(selector),
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener: () => {},
    dispatch: (type, event = {}) => {
      for (const fn of listeners.get(type) ?? []) fn({ type, preventDefault: () => {}, ...event });
    }
  };

  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };

  const win = {
    document,
    localStorage,
    devicePixelRatio: 1,
    navigator: { language: "zh-CN", maxTouchPoints: 0 },
    performance: { now: () => Date.now() },
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    requestAnimationFrame: (fn) => {
      frames.push(fn);
      return frames.length;
    },
    cancelAnimationFrame: () => {},
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener: () => {},
    setTimeout: (fn, ms) => nodeSetTimeout(fn, ms),
    clearTimeout: (id) => nodeClearTimeout(id),
    ResizeObserver: class {
      observe() {}

      disconnect() {}
    },
    AudioContext: undefined
  };

  // 浏览器语义：window 即全局对象本身——window.__x 与 globalThis.__x 等价，
  // 调试句柄两种读法都能拿到（Node 24 的 navigator/performance 是只读 getter，
  // 必须 defineProperty 覆盖）。
  Object.defineProperty(globalThis, "window", { value: globalThis, writable: true, configurable: true });
  for (const [key, value] of Object.entries(win)) {
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }

  // storage.mjs 的 backend 有模块级缓存：不清就会一直读上一个用例的 localStorage 桩，
  // 预置存档静默失效（每个用例都换新桩，必须重新探测）。
  resetBackendForTests();

  return {
    document,
    store,
    listeners,
    step(n = 1) {
      for (let i = 0; i < n; i += 1) {
        const fn = frames.shift();
        if (!fn) return false;
        fn(Date.now() + i * 16);
      }
      return true;
    },
    frames
  };
}

/** 预置存档（必须在 import main.mjs 之前，模块顶层即读档） */
function seedSave(env, save) {
  env.store.set(STORAGE_KEY, JSON.stringify({ version: 2, prefs: { muted: false, difficulty: "normal" }, best: {}, ...save }));
}

// ---------------------------------------------------------------- 几何助手
// 桩画布固定 720x560，render.mjs 的 computeLayout 由此推出确定几何：
// 队列托盘 y∈[18,106]、三槽 x 起点 185 步长 120；棋盘 422px 于 (149,124)，格宽 52.75。
const L = { slot0: { x: 240, y: 60 }, bx: 149, by: 124, cell: 422 / GRID };

function cellPoint(row, col) {
  return { x: L.bx + col * L.cell + 2, y: L.by + row * L.cell + 2 };
}

function filled(view) {
  return view.board.reduce((n, v) => (v !== 0 ? n + 1 : n), 0);
}

// 从队列槽拖一块到棋盘格（走真实 pointer 事件链）
function dragTo(env, slotIndex, row, col) {
  const canvas = env.document.getElementById("stage");
  const from = { x: L.slot0.x + slotIndex * 120, y: L.slot0.y };
  const to = cellPoint(row, col);
  canvas.dispatch("pointerdown", { clientX: from.x, clientY: from.y, pointerId: 1 });
  canvas.dispatch("pointermove", { clientX: to.x, clientY: to.y, pointerId: 1 });
  canvas.dispatch("pointerup", { clientX: to.x, clientY: to.y, pointerId: 1 });
}

// 与 anchorFor 同公式（cursor - grabCell）暴力扫描光标格
function findLegalSpot(view, slot, rot) {
  const pieceId = view.queue[slot];
  const [gr, gc] = grabCell(pieceId, rot);
  for (let r = 0; r < GRID; r += 1) {
    for (let c = 0; c < GRID; c += 1) {
      if (canPlace(view.board, pieceId, rot, r - gr, c - gc)) return { row: r, col: c };
    }
  }
  return null;
}

function findIllegalSpot(view, slot, rot) {
  const pieceId = view.queue[slot];
  const [gr, gc] = grabCell(pieceId, rot);
  for (let r = 0; r < GRID; r += 1) {
    for (let c = 0; c < GRID; c += 1) {
      if (!canPlace(view.board, pieceId, rot, r - gr, c - gc)) return { row: r, col: c };
    }
  }
  return null;
}

// 用方向键把光标导航到目标格（键盘链路助手）
function navTo(env, handle, row, col) {
  const key = (k) => env.document.dispatch("keydown", { key: k });
  for (let i = 0; i < 40; i += 1) {
    const cur = handle.ui().cursor;
    if (cur.row === row && cur.col === col) return true;
    if (cur.row < row) key("ArrowDown");
    else if (cur.row > row) key("ArrowUp");
    if (cur.col < col) key("ArrowRight");
    else if (cur.col > col) key("ArrowLeft");
  }
  return false;
}

// ---------------------------------------------------------------- 用例

test("audio 调用面闭合：ui/main 调用的每个音效都真实导出", () => {
  // playReject 曾「被两处调用但 audio.mjs 从未导出」，非法落子直接 TypeError、
  // 吐司路径整个崩掉——静态对账，防再犯。
  const audioSrc = readFileSync(resolve(gameDir, "js/audio.mjs"), "utf8");
  const exported = new Set([...audioSrc.matchAll(/export function (\w+)/g)].map((m) => m[1]));
  for (const file of ["js/ui.mjs", "js/main.mjs"]) {
    const src = readFileSync(resolve(gameDir, file), "utf8");
    const used = new Set([...src.matchAll(/\baudio\.(\w+)\s*\(/g)].map((m) => m[1]));
    for (const name of used) {
      assert.ok(exported.has(name), `${file} 调用了 audio.${name}()，但 audio.mjs 没有导出它`);
    }
  }
  assert.ok(exported.has("playReject"), "拒绝落子音效必须存在");
});

test("装配：main.mjs 在 DOM 桩上完整启动，即开即玩与主循环就位", async () => {
  const env = installEnv();
  await import("../js/main.mjs?case=boot");
  const handle = globalThis.__blockblast;
  assert.ok(handle, "必须挂 window.__blockblast 调试句柄");

  const v = handle.view();
  assert.ok(v, "boot 后必须有视图");
  assert.equal(v.difficulty, "normal", "默认载入存档记忆的难度");
  assert.equal(v.status, "playing");
  assert.equal(v.queue.length, 3, "队列必须补满三块");

  env.step(1); // 首帧渲染 HUD
  const doc = env.document;
  assert.equal(doc.getElementById("led-score").textContent, "0");
  assert.equal(doc.getElementById("led-best").textContent, "0", "最高分卡常显");
  assert.equal(doc.getElementById("led-difficulty").textContent, "标准", "当前难度必须上牌");
  assert.equal(doc.getElementById("led-best-card").hidden, false, "无尽模式最高分卡必须常显");
  assert.equal(doc.getElementById("help-layer").hidden, true, "即开即玩：任何浮层都不得遮挡");

  assert.ok(env.step(30), "主循环必须持续排帧");

  // 防假绿：无粒子无事件时 tick 是恒等变换，规则快照一字节不动
  const before = JSON.stringify(handle.view());
  handle.tick(1 / 60);
  assert.equal(JSON.stringify(handle.view()), before, "空动画期 tick 不得改动规则状态");
});

test("放置链路：拖放落子穿过 ui→main→game，计分牌与盘面真的同步", async () => {
  const env = installEnv();
  await import("../js/main.mjs?case=place");
  const handle = globalThis.__blockblast;
  env.step(1);

  const canvas = env.document.getElementById("stage");
  const v0 = handle.view();
  const spot = findLegalSpot(v0, 0, 0);
  assert.ok(spot, "首队列必有合法落点");
  const pieceId = v0.queue[0];
  const cellCount = pieceCells(pieceId, 0).length;
  const filled0 = filled(v0);

  // 取第 0 槽 → 悬停棋盘 spot → 松手落子
  canvas.dispatch("pointerdown", { clientX: L.slot0.x, clientY: L.slot0.y, pointerId: 1 });
  assert.equal(handle.ui().selected, 0, "按下队列槽必须选中该槽");
  const to = cellPoint(spot.row, spot.col);
  canvas.dispatch("pointermove", { clientX: to.x, clientY: to.y, pointerId: 1 });
  assert.deepEqual(handle.ui().cursor, spot, "悬停棋盘必须更新光标格");
  canvas.dispatch("pointerup", { clientX: to.x, clientY: to.y, pointerId: 1 });
  env.step(1); // 帧循环刷新 HUD

  const v1 = handle.view();
  assert.equal(v1.piecesPlaced, 1, "必须真的落子");
  assert.equal(filled(v1), filled0 + cellCount, `占用格数必须 +${cellCount}`);
  assert.equal(v1.score, cellCount, "首落无消行，每格 1 分");
  assert.equal(v1.rowsCleared, 0);
  assert.equal(env.document.getElementById("led-score").textContent, String(v1.score), "计分牌必须同步");
  assert.equal(handle.ui().selected, null, "落子后必须取消选择");

  // 非法放置（越界锚点）被拒且零副作用
  const res = handle.place(0, 0, -1, -1);
  assert.equal(res.ok, false);
  assert.equal(JSON.stringify(handle.view()), JSON.stringify(v1), "非法落子不得改动任何状态");
});

test("非法拖放：拖到放不下的位置吐司警示，且不落子", async () => {
  const env = installEnv();
  await import("../js/main.mjs?case=reject");
  const handle = globalThis.__blockblast;
  env.step(1);

  const spot = findLegalSpot(handle.view(), 0, 0);
  dragTo(env, 0, spot.row, spot.col); // 先合法放一块，盘面出现占领格
  env.step(1);
  const v1 = handle.view();
  assert.equal(v1.piecesPlaced, 1);

  // 为当前队列头块找一个非法落点：与 anchorFor 同公式暴力扫全部光标格
  const bad = findIllegalSpot(v1, 0, 0);
  assert.ok(bad, "放了一块之后必存在非法落点");

  dragTo(env, 0, bad.row, bad.col);
  env.step(1);
  const v2 = handle.view();
  assert.equal(v2.piecesPlaced, 1, "非法拖放不得落子");
  assert.equal(JSON.stringify(v2.board), JSON.stringify(v1.board), "非法拖放不得改动盘面");

  const toast = env.document.getElementById("toast");
  assert.equal(toast.hidden, false, "拒绝落子必须吐司警示");
  assert.ok(toast.textContent.length > 0);
  assert.ok(toast.classList.contains("show"));
});

test("旋转移出网格：拖入棋盘后锁定朝向，托盘区滚轮/右键才转", async () => {
  const env = installEnv();
  await import("../js/main.mjs?case=rotate");
  const handle = globalThis.__blockblast;
  env.step(1);
  const canvas = env.document.getElementById("stage");

  // 托盘区滚轮：旋转该槽（顺带选中）
  canvas.dispatch("wheel", { clientX: L.slot0.x, clientY: L.slot0.y, deltaY: 120, preventDefault: () => {} });
  assert.equal(handle.ui().selected, 0, "托盘滚轮必须选中该槽");
  assert.equal(handle.ui().rotations[0], 1, "托盘滚轮必须旋转");

  // 拖拽进入网格：滚轮/右键一律不转（旋转移出网格）
  const spot = findLegalSpot(handle.view(), 0, 1);
  canvas.dispatch("pointerdown", { clientX: L.slot0.x, clientY: L.slot0.y, pointerId: 1 });
  const to = cellPoint(spot.row, spot.col);
  canvas.dispatch("pointermove", { clientX: to.x, clientY: to.y, pointerId: 1 });
  canvas.dispatch("wheel", { clientX: to.x, clientY: to.y, deltaY: 120, preventDefault: () => {} });
  assert.equal(handle.ui().rotations[0], 1, "网格内滚轮不得旋转");
  canvas.dispatch("contextmenu", { clientX: to.x, clientY: to.y, preventDefault: () => {} });
  assert.equal(handle.ui().rotations[0], 1, "网格内右键不得旋转");

  // 落子后（非拖拽态）滚轮悬停托盘仍可转
  canvas.dispatch("pointerup", { clientX: to.x, clientY: to.y, pointerId: 1 });
  env.step(1);
  assert.equal(handle.view().piecesPlaced, 1, "拖放必须落子");
  canvas.dispatch("wheel", { clientX: L.slot0.x + 120, clientY: L.slot0.y, deltaY: 120, preventDefault: () => {} });
  assert.equal(handle.ui().selected, 1, "悬停哪个槽转哪个槽");
  assert.equal(handle.ui().rotations[1], 1);
});

test("托盘交互不点亮网格：点击取块 / 滚轮 / 右键 / R 旋转都不画幽灵", async () => {
  // 用户反馈（截图）：点击或旋转顶部拼块时，棋盘中央亮出一块半透明预览，
  // 会被误认为拼块已经落进网格。契约：预览只由「拖入棋盘 / 方向键 / 非法落点」产生。
  const env = installEnv();
  seedSave(env, { prefs: { muted: false, difficulty: "easy" } }); // 空盘
  await import("../js/main.mjs?case=noghost");
  const handle = globalThis.__blockblast;
  env.step(1);
  const canvas = env.document.getElementById("stage");

  // 点击托盘槽取块（按下即松手，不拖动）：选中但不得点亮棋盘光标
  canvas.dispatch("pointerdown", { clientX: L.slot0.x, clientY: L.slot0.y, pointerId: 1 });
  assert.equal(handle.ui().cursor, null, "按下托盘瞬间不得点亮棋盘预览");
  canvas.dispatch("pointerup", { clientX: L.slot0.x, clientY: L.slot0.y, pointerId: 1 });
  assert.equal(handle.ui().selected, 0, "点击托盘必须选中该槽");
  assert.equal(handle.ui().cursor, null, "点击取块不得在网格里画预览");

  // 托盘滚轮旋转：仍然不点亮
  canvas.dispatch("wheel", { clientX: L.slot0.x, clientY: L.slot0.y, deltaY: 120, preventDefault: () => {} });
  assert.equal(handle.ui().rotations[0], 1, "托盘滚轮必须旋转");
  assert.equal(handle.ui().cursor, null, "托盘旋转不得在网格里画预览");

  // 托盘右键旋转：仍然不点亮
  canvas.dispatch("contextmenu", { clientX: L.slot0.x, clientY: L.slot0.y, preventDefault: () => {} });
  assert.equal(handle.ui().rotations[0], 2, "托盘右键必须旋转");
  assert.equal(handle.ui().cursor, null, "托盘右键不得在网格里画预览");

  // R 键旋转：仍然不点亮
  env.document.dispatch("keydown", { key: "r" });
  assert.equal(handle.ui().rotations[0], 3, "R 键必须旋转");
  assert.equal(handle.ui().cursor, null, "R 旋转不得在网格里画预览");

  // 拖入棋盘才点亮预览（拖拽反馈），拖回托盘立即收回
  const spot = findLegalSpot(handle.view(), 0, 3);
  assert.ok(spot, "旋转 3 必有合法落点");
  const to = cellPoint(spot.row, spot.col);
  canvas.dispatch("pointerdown", { clientX: L.slot0.x, clientY: L.slot0.y, pointerId: 1 });
  canvas.dispatch("pointermove", { clientX: to.x, clientY: to.y, pointerId: 1 });
  assert.deepEqual(handle.ui().cursor, spot, "拖入棋盘必须点亮预览");
  canvas.dispatch("pointermove", { clientX: L.slot0.x, clientY: L.slot0.y, pointerId: 1 });
  assert.equal(handle.ui().cursor, null, "拖出棋盘必须立即收回预览");

  // 松手回托盘：不落子、不残留幽灵、保持已取块
  canvas.dispatch("pointerup", { clientX: L.slot0.x, clientY: L.slot0.y, pointerId: 1 });
  assert.equal(handle.ui().cursor, null, "松手不在棋盘不得残留幽灵");
  assert.equal(handle.ui().selected, 0, "松手回托盘保持已取块");
  assert.equal(handle.view().piecesPlaced, 0, "不得误落子");
});

test("键盘链路：数字键取块 / 方向键移光标 / R 旋转 / 空格落子 / Esc 取消", async () => {
  const env = installEnv();
  seedSave(env, { prefs: { muted: false, difficulty: "easy" } }); // 空盘，落点必合法
  await import("../js/main.mjs?case=keys");
  const handle = globalThis.__blockblast;
  env.step(1);
  const key = (k) => env.document.dispatch("keydown", { key: k });

  key("1");
  assert.equal(handle.ui().selected, 0, "数字键 1 必须选中第 0 槽");
  assert.equal(handle.ui().cursor, null, "取块不得在网格里画预览（防误认落子）");

  key("ArrowDown");
  assert.deepEqual(handle.ui().cursor, { row: 4, col: 3 }, "首个方向键从盘心武装光标");
  key("ArrowRight");
  assert.deepEqual(handle.ui().cursor, { row: 4, col: 4 }, "方向键必须移动光标");

  key("r");
  assert.equal(handle.ui().rotations[0], 1, "R 必须旋转预览");

  // 导航到旋转 1 的合法光标再落子（空盘必然存在）
  const spot = findLegalSpot(handle.view(), 0, 1);
  assert.ok(spot, "空盘 + 旋转 1 必有合法落点");
  assert.ok(navTo(env, handle, spot.row, spot.col), "方向键必须能导航到目标格");
  assert.deepEqual(handle.ui().cursor, spot);

  key(" ");
  env.step(1);
  assert.equal(handle.view().piecesPlaced, 1, "空格必须落子");
  assert.equal(handle.ui().selected, null, "落子后取消选择");

  key("2");
  assert.equal(handle.ui().selected, 1, "数字键 2 必须选中第 1 槽");
  key("Escape");
  assert.equal(handle.ui().selected, null, "Esc 必须取消选择");
});

test("语言热更新：btn-lang 切换后静态文本全换，对局快照毫发无损", async () => {
  const env = installEnv();
  await import("../js/main.mjs?case=lang");
  const handle = globalThis.__blockblast;
  env.step(1);
  const spot = findLegalSpot(handle.view(), 0, 0);
  dragTo(env, 0, spot.row, spot.col); // 制造非初始对局
  env.step(1);

  const snap = (() => {
    const v = handle.view();
    const d = handle.diagnose();
    return { score: v.score, board: v.board.join(","), queue: v.queue.join(","), seed: d.seed, placed: v.piecesPlaced };
  })();
  const doc = env.document;
  const zhTitle = doc.title;

  doc.getElementById("btn-lang").click();
  const en = i18n.strings("en");
  assert.equal(doc.title, en.docTitle, "document.title 必须换成英文");
  assert.equal(doc.getElementById("btn-lang").textContent, en.langSwitch, "语言按钮文案必须换成「中文」");
  assert.equal(doc.documentElement.lang, "en", "html lang 必须同步");
  assert.equal(doc.getElementById("back-home").textContent, en.back, "data-i18n 元素必须原地热更新");
  assert.equal(globalThis.localStorage.getItem("doin.lang"), "en", "locale 必须落存档");

  // 对局毫秒不差
  const v = handle.view();
  const d = handle.diagnose();
  assert.deepEqual(
    { score: v.score, board: v.board.join(","), queue: v.queue.join(","), seed: d.seed, placed: v.piecesPlaced },
    snap,
    "语言切换严禁改动当前对局"
  );

  // 切回中文
  doc.getElementById("btn-lang").click();
  assert.equal(doc.title, zhTitle, "再切必须回到中文标题");
  assert.equal(doc.documentElement.lang, "zh-CN");
  assert.equal(globalThis.localStorage.getItem("doin.lang"), "zh");
});

test("浮层与难度：三层 hidden 真的翻转，难度切换真的换档", async () => {
  const env = installEnv();
  seedSave(env, {
    prefs: { muted: false, difficulty: "easy" },
    best: { easy: { bestScore: 88, bestRows: 7, bestCombo: 2, plays: 3 } },
  });
  await import("../js/main.mjs?case=overlay");
  const handle = globalThis.__blockblast;
  env.step(1);
  const doc = env.document;
  const layer = (id) => doc.getElementById(id);
  const allHidden = () =>
    ["help-layer", "difficulty-layer", "result-layer"].every((id) => layer(id).hidden === true);

  // help：内部状态切了不算数，DOM 的 hidden 必须真的翻转
  doc.getElementById("btn-help").click();
  assert.equal(layer("help-layer").hidden, false, "help 浮层必须真的显示");
  assert.equal(layer("difficulty-layer").hidden, true);
  doc.getElementById("help-close").click();
  assert.ok(allHidden(), "关闭后三层必须全隐");

  // 存档记忆难度 = easy：boot 即开即玩，无需前置遮罩
  assert.equal(handle.view().difficulty, "easy");
  assert.equal(layer("led-difficulty").textContent, "休闲", "当前难度必须上牌");

  // 难度层：三张卡 + 当前档高亮 + 各档最高分
  doc.getElementById("btn-difficulty").click();
  assert.equal(layer("difficulty-layer").hidden, false, "难度浮层必须真的显示");
  assert.ok(layer("diff-easy").classList.contains("current"), "当前档必须高亮");
  assert.equal(layer("diff-easy-best").textContent, "最高分 88", "最高分必须按档展示");
  assert.equal(layer("diff-normal-best").textContent, "最高分 0");

  // 点大师卡：换档开局（预填 12 格）+ 层收起
  layer("diff-hard").click();
  env.step(1);
  assert.ok(allHidden(), "选定难度后浮层必须收起");
  assert.equal(handle.view().difficulty, "hard");
  assert.equal(filled(handle.view()), 12, "大师档必须预填 12 格");
  assert.equal(layer("led-difficulty").textContent, "大师");

  // 再开难度层：current 移到 hard
  doc.getElementById("btn-difficulty").click();
  assert.ok(layer("diff-hard").classList.contains("current"), "当前档高亮必须跟随");
  assert.ok(!layer("diff-easy").classList.contains("current"));
  doc.getElementById("difficulty-close").click();
  assert.ok(allHidden(), "关闭按钮必须收起浮层");
});

test("结算层：showResult 真的弹出，按钮显隐与语言热重铸正确", async () => {
  const env = installEnv();
  const { createUi } = await import("../js/ui.mjs?case=result");
  const silentAudio = new Proxy({}, { get: () => () => {} });
  const ui = createUi({
    audio: silentAudio,
    strings: i18n.strings("zh"),
    onPlace: () => {},
    onReset: () => {},
    onStartDifficulty: () => {},
    onRequestDifficulty: () => {},
    onSound: () => {},
    onLang: () => {}
  });
  const doc = env.document;
  const layer = (id) => doc.getElementById(id);

  // 破纪录终局：纪录徽章 + 4 行数据 + 难度标注
  ui.showResult(
    { mode: "classic", difficulty: "hard", score: 320, rowsCleared: 14, crossCount: 2, maxCombo: 4, piecesPlaced: 40, overReason: "stuck" },
    { isRecord: true }
  );
  assert.equal(layer("result-layer").hidden, false, "结算浮层必须真的弹出");
  assert.ok(layer("result-badge").textContent.includes("新纪录"), "破纪录必须显示纪录徽章");
  assert.equal(layer("result-rows").children.length, 4, "无尽结算必须 4 行数据");
  assert.ok(layer("result-sub").textContent.includes("大师"), "副标题必须标注难度");

  // 非纪录局：徽章换成放不下文案
  ui.showResult(
    { mode: "classic", difficulty: "normal", score: 100, rowsCleared: 5, crossCount: 0, maxCombo: 1, piecesPlaced: 20, overReason: "stuck" },
    { isRecord: false }
  );
  assert.ok(!layer("result-badge").textContent.includes("新纪录"), "非纪录局不得显示纪录徽章");
  assert.ok(layer("result-badge").textContent.length > 0, "普通终局也要有徽章文案");

  // 结果层打开时切语言：按既定行为直接关闭（showResult 全量重建，重铸会双源）
  ui.applyStrings(i18n.strings("en"));
  assert.equal(layer("result-layer").hidden, true, "结果层在语言切换时应关闭");

  // 难度层打开时切语言：必须保持打开并按新语言重铸
  ui.showDifficulties();
  assert.equal(layer("difficulty-layer").hidden, false, "难度浮层必须真的显示");
  ui.applyStrings(i18n.strings("en"));
  assert.equal(layer("difficulty-layer").hidden, false, "难度层语言切换必须保持打开");
  assert.equal(layer("diff-easy").querySelector("span").textContent, i18n.strings("en").diffEasyDesc, "难度描述必须按新语言重铸");

  ui.closeOverlay();
  assert.equal(layer("difficulty-layer").hidden, true);
});
