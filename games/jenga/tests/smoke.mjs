// 叠叠乐 · 无浏览器冒烟（最小 DOM 桩 + Canvas 桩，跑真实的 main.mjs 装配链路）
//
// 目的：验证「HTML 骨架 ↔ ui.mjs ↔ main.mjs ↔ render.mjs」这条接缝真的能跑起来，
// 而不是只验证纯逻辑。断言一律看业务可观测量的推进（分数文本、层数十位、语言热更新后塔局不变）。

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
    this.style = new Proxy({ setProperty: () => {} }, { get: (t, k) => t[k], set: (t, k, v) => (t[k] = v, true) });
    this._text = "";
    this.disabled = false;
    this._hidden = false;
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

  get hidden() {
    return this._hidden;
  }

  set hidden(value) {
    this._hidden = Boolean(value);
    if (this._hidden) this.attributes.set("hidden", "");
    else this.attributes.delete("hidden");
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
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (openTag) {
      const tag = openTag.toLowerCase();
      if (["meta", "link", "br", "img", "input"].includes(tag)) continue;
      const el = new StubElement(tag);
      for (const m of (attrs ?? "").matchAll(/([a-zA-Z-]+)(?:="([^"]*)")?/g)) {
        const name = m[1];
        const value = m[2] ?? "";
        el.attributes.set(name, value);
        if (name === "id") byId.set(value, el);
        if (name === "class") el.classList.set = new Set(value.split(/\s+/).filter(Boolean));
        if (name === "hidden") el._hidden = true;
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
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    ResizeObserver: class {
      observe() {}

      disconnect() {}
    },
    AudioContext: undefined
  };

  // Node 24 里 navigator / performance 是只读 getter，必须 defineProperty 覆盖
  for (const [key, value] of Object.entries(win)) {
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }

  return {
    document,
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

// ---------------------------------------------------------------- 用例

test("装配：main.mjs 在 DOM 桩上完整启动，句柄与塔局就位", async () => {
  const env = installEnv();
  const mod = await import("../js/main.mjs");
  const handle = mod.default;
  assert.ok(handle, "boot() 必须返回句柄");
  assert.ok(globalThis.__jenga, "必须挂 window.__jenga 调试句柄");
  assert.equal(handle.game.state.blocks.length, 54);
  assert.equal(handle.getHud().layers, 18);
  assert.ok(env.step(20), "主循环必须持续排帧");
  assert.ok(handle.game.state.time > 0, "物理时钟必须在推进（防假绿）");
});

test("抽叠链路：点画布抽块 → 黑板分数真的涨了", async () => {
  const env = installEnv();
  const mod = await import("../js/main.mjs?case=pull");
  const handle = mod.default;
  const game = handle.game;
  const canvas = env.document.getElementById("tower");

  const before = Number(env.document.getElementById("hud-score").textContent);
  const pick = handle.pullables()[0];
  game.pull(pick.layer, pick.slot);
  if (game.state.status === "holding") {
    const slots = game.availableSlots();
    game.stack(slots[0]);
  }
  env.step(6);

  const after = Number(env.document.getElementById("hud-score").textContent);
  assert.ok(after > before, `分数没涨：${before} → ${after}`);
  assert.equal(game.state.stackCount, 1);
  // 画布事件链路不报错
  assert.doesNotThrow(() => canvas.dispatch("pointerdown", { clientX: 10, clientY: 10, pointerId: 1 }));
  assert.doesNotThrow(() => canvas.dispatch("pointerup", { clientX: 10, clientY: 10, pointerId: 1 }));
});

test("语言热更新：切到英文后文本变了，塔局毫秒不差", async () => {
  const env = installEnv();
  const mod = await import("../js/main.mjs?case=lang");
  const handle = mod.default;
  const game = handle.game;
  const pick = handle.pullables()[0];
  game.pull(pick.layer, pick.slot);
  if (game.state.status === "holding") game.stack(game.availableSlots()[0]);
  env.step(4);

  const snapshot = {
    layers: game.state.layers.length,
    blocks: game.state.blocks.length,
    stack: game.state.stackCount,
    score: game.score,
    seed: game.state.seed
  };
  const zhLabel = env.document.getElementById("hud-mult").textContent;

  handle.setLang("en");
  env.step(4);

  const enLabel = env.document.getElementById("hud-mult").textContent;
  assert.equal(zhLabel, enLabel, "倍率是数字，语言切换不得改动");
  assert.equal(env.document.getElementById("hud-streak").textContent, String(game.state.streak));
  assert.deepEqual(
    {
      layers: game.state.layers.length,
      blocks: game.state.blocks.length,
      stack: game.state.stackCount,
      score: game.score,
      seed: game.state.seed
    },
    snapshot,
    "语言切换严禁改动当前对局"
  );
  assert.equal(handle.getLang(), "en");
  handle.setLang("zh");
  env.step(2);
});

test("浮层与暂停：help 冻结物理，关掉后恢复；选关抽屉可开合", async () => {
  const env = installEnv();
  const mod = await import("../js/main.mjs?case=overlay");
  const handle = mod.default;
  const ui = handle.ui;
  const game = handle.game;

  ui.setOverlay("help");
  assert.equal(ui.currentOverlay(), "help");
  assert.equal(game.paused, true, "说明浮层必须冻结对局");
  const t = game.state.time;
  env.step(10);
  assert.equal(game.state.time, t, "冻结期间物理不得推进");

  ui.setOverlay("none");
  assert.equal(game.paused, false);
  env.step(10);
  assert.ok(game.state.time > t, "恢复后时钟继续走");

  ui.setOverlay("levels");
  assert.equal(ui.currentOverlay(), "levels");
  assert.ok(ui.el.levels.children.length >= 4, "选关抽屉必须列出 4 个章节");
  ui.setOverlay("none");

  // 结算浮层：给一个假结果也要能弹出来
  ui.showResult({ won: true, stars: 2, score: 300, layers: 20, streak: 3, level: { index: 1 } });
  assert.equal(ui.currentOverlay(), "result");
  assert.ok(env.document.getElementById("result-title").textContent.length > 0);
});

test("选关与模式切换：按钮点击真的换了关卡 / 模式", async () => {
  const env = installEnv();
  const mod = await import("../js/main.mjs?case=mode");
  const handle = mod.default;
  const doc = env.document;

  // 第 1 关默认解锁，直接点抽屉里的第 2 关（未解锁）应被拦下
  handle.ui.refreshLevels();
  const chips = doc.getElementById("levels-list").querySelectorAll("button");
  assert.ok(chips.length >= 24, `选关条目不足：${chips.length}`);

  doc.getElementById("btn-mode-duel").click();
  assert.equal(handle.game.mode, "duel");
  env.step(10);
  doc.getElementById("btn-mode-riddle").click();
  assert.equal(handle.game.mode, "riddle");
  assert.equal(handle.game.riddle.candidates.length, 4);
  env.step(10);
  doc.getElementById("btn-mode-spire").click();
  assert.equal(handle.game.mode, "spire");

  // 重建塔：层数回到 18
  handle.startLevel(1);
  env.step(4);
  assert.equal(handle.getHud().layers, 18);
});
