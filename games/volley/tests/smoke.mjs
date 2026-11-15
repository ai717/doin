// Volley Bombard · 无浏览器冒烟（最小 DOM 桩 + Canvas 桩，跑真实的 main.mjs 装配链路）
//
// 目的：验证「index.html 骨架 ↔ ui.mjs ↔ main.mjs ↔ game.mjs」这条接缝真的能跑起来。
// 线上事故回归点：main 曾把 `game: null` 传给 createUi，boot 在 setLang → renderAll 处抛
// TypeError，后续 bindUi / startLoop 全没执行 —— 页面能看，但任何按钮都点不动。
// 纯逻辑单测抓不到这类接线错误，只能靠这里跑真实装配。

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
      this.width = 1000;
      this.height = 460;
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

  // hidden 属性即唯一事实来源：property 与 attribute 双向同步，否则断言假绿
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
    const payload = { type, target: this, currentTarget: this, clientX: 0, clientY: 0, pointerId: 1, preventDefault: () => {}, stopPropagation: () => {}, ...event };
    for (const fn of this.listeners.get(type) ?? []) fn(payload);
    return payload;
  }

  click() {
    if (this.disabled) return null;
    return this.dispatch("click");
  }

  setPointerCapture() {}

  releasePointerCapture() {}

  getContext() {
    return this._ctx;
  }

  get parentElement() {
    return this.parentNode;
  }

  // 支持 #id / .class / .a.b / [attr] / [attr="v"] 及其组合（volley 源码用到 .console-side.west
  // 与 .flag-pole[data-side="0"]）；后代选择器不支持，源码也没有用到。
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
  const target = { canvas: null, clearRect: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {}, fillRect: () => {} };
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

// 极简 HTML 解析：只处理标签与属性，文本并入父元素的 _text
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
    hidden: false,
    createElement: (tag) => new StubElement(tag),
    getElementById: (id) => doc.byId.get(id) ?? null,
    querySelector: (s) => doc.querySelector(s),
    querySelectorAll: (s) => doc.querySelectorAll(s),
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener: () => {},
    dispatch: (type, event = {}) => {
      for (const fn of listeners.get(type) ?? []) fn({ type, preventDefault: () => {}, ...event });
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
    AudioContext: undefined,
    webkitAudioContext: undefined,
  };

  Object.defineProperty(globalThis, "window", { value: globalThis, writable: true, configurable: true });
  for (const [key, value] of Object.entries(win)) {
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }

  let clock = globalThis.performance.now();

  return {
    document,
    store,
    listeners,
    frames,
    // 虚拟时钟：必须持续递增，否则 main 的 frame 算出 dt≈0，物理永远推不动
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
const doc = env.document;
const $ = (sel) => doc.querySelector(sel);
const volley = globalThis.__volley;

function blockCount() {
  return $("#blocks-layer").children.length;
}

/** 让飞行阶段跑完（受控 rAF 驱动真实 tick） */
function settle(limit = 600) {
  for (let i = 0; i < limit; i += 1) {
    if (volley.game.raw().phase !== "flight") return true;
    env.step(1);
  }
  return volley.game.raw().phase !== "flight";
}

// ---------------------------------------------------------------- 用例

test("装配：boot 完成且不抛错，调试句柄就绪", () => {
  assert.ok(volley, "window.__volley 应存在");
  assert.ok(volley.game, "__volley.game 应拿到 controller（不是 null）");
  assert.equal(volley.game.view().phase, "aim", "首屏直接进入可瞄准状态");
  assert.ok(volley.ui, "__volley.ui 应就绪");
});

test("首屏：盘面与 HUD 真的渲染出来了（不是白板）", () => {
  assert.ok(blockCount() >= 20, `积木应渲染，实际 ${blockCount()}`);
  assert.equal(blockCount(), volley.game.raw().blocks.filter((b) => b.hp > 0).length, "DOM 块数应与引擎一致");
  assert.match($("#angle-0").textContent, /^\d+°$/, "角度读数应有内容");
  assert.ok(Number($("#power-0").textContent) > 0, "力度读数应有内容");
  assert.ok($("#chip-round").textContent.length > 0, "回合徽标应有内容");
  assert.ok($("#weapons-0").children.length > 0, "武器架应生成筹码");
});

test("按钮：模式 / 帮助 / 暂停弹层都能打开，不再「点了没反应」", () => {
  $("#btn-mode").click();
  assert.equal($("#ov-mode").hidden, false, "点「模式」应打开面板");
  $("#btn-apply-mode").click();
  assert.equal($("#ov-mode").hidden, true, "应用后应关闭");

  $("#btn-help").click();
  assert.equal($("#ov-help").hidden, false, "点「玩法」应打开说明");
  $("[data-close]").click();
  assert.equal($("#ov-help").hidden, true, "关闭按钮应生效");

  $("#btn-pause").click();
  assert.equal($("#ov-pause").hidden, false, "点「暂停」应打开暂停层");
  assert.equal(volley.game.isPaused(), true, "暂停应冻结控制器");
  $("#btn-resume").click();
  assert.equal($("#ov-pause").hidden, true, "继续应关闭暂停层");
  assert.equal(volley.game.isPaused(), false);
});

test("开火链路：飞行结束后 HUD / 盘面跟着更新（曾经的死梗：画面对不上 engine）", () => {
  const before = {
    blocks: blockCount(),
    shots: $("#p1-shots").textContent,
    turn: volley.game.raw().turn,
  };
  assert.equal(before.turn, 0, "红方先手");

  // 风是随机量，这里钉成 0 让「45°/90 力命中对面」成为确定事实；
  // 默认瞄准窗口由 engine.test 里的无风扫描保证。
  volley.game.raw().wind = 0;

  $("#btn-fire-0").click();
  assert.equal(volley.game.raw().phase, "flight", "开火应进入飞行");

  assert.ok(settle(), "飞行应在受控帧内结束");
  assert.equal(volley.game.raw().turn, 1, "结束后应换边");
  assert.equal($("#p1-shots").textContent, String(Number(before.shots) + 1), "射击数应写回 DOM");
  assert.equal(blockCount(), volley.game.raw().blocks.filter((b) => b.hp > 0).length, "块数应与引擎同步");
  assert.ok(blockCount() < before.blocks, "默认瞄准应能命中对面阵地（UI 应把掉落同步到 DOM）");
  assert.equal(volley.game.view().turn, 1);
});

test("语言切换：热更新文本且不重置对局状态", () => {
  const shots = $("#p1-shots").textContent;
  const phase = volley.game.raw().phase;
  $("#btn-lang").click();
  assert.equal(doc.documentElement.lang, "en", "应切到英文");
  assert.equal($("#p1-shots").textContent, shots, "射击数不得被重置");
  assert.equal(volley.game.raw().phase, phase, "对局不得重启");
  assert.ok(!/[\u4e00-\u9fa5]/.test($("#chip-round").textContent), "英文表零汉字");
  $("#btn-lang").click();
  assert.ok(/[\u4e00-\u9fa5]/.test($("#chip-round").textContent), "切回中文");
});

test("AI 模式：切模式重开对局，西军控制台锁定、东军可操作", () => {
  $("#btn-mode").click();
  $("#seg-mode-ai").click();
  $("#btn-apply-mode").click();

  assert.equal(volley.game.view().mode, "ai");
  assert.equal(volley.game.raw().turn, 0, "AI 执西军先手");
  assert.equal(blockCount(), volley.game.raw().blocks.filter((b) => b.hp > 0).length, "重开应重绘盘面");

  const west = $(".console-side.west");
  assert.equal(west.classList.contains("is-locked"), true, "AI 侧控制台应有锁定标记");
  assert.equal($("#btn-fire-0").disabled, true, "AI 回合玩家不能抢开炮");
  assert.equal($("#btn-fire-1").disabled, true, "非己回合也不可开炮");

  // AI 应在若干帧内自己开炮
  let fired = false;
  for (let i = 0; i < 400; i += 1) {
    env.step(1);
    if (volley.game.raw().phase === "flight") {
      fired = true;
      break;
    }
  }
  assert.ok(fired, "AI 应自动开火（不再需要玩家替他操作）");
});
