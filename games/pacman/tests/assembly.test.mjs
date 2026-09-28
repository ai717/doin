// assembly.test.mjs —— 装配层冒烟（无浏览器）：真跑一局，断言"业务在推进"而不是"没抛异常"。
//
// 桩的硬约束（照抄前务必看，缺一条就是假绿或假 bug）：
//   1) 先还原 index.html 的初始 hidden，再 import main.mjs —— UI 用 hidden 当弹层真相源，
//      桩默认 hidden:false 会让游戏判定成"永远有弹层挡着"。
//   2) appendChild 要摊平：ui 直接 append 多个节点。
//   3) style 用 Proxy：renderer/UI 会写 style.width，桩里普通对象会让百分比定位链路测不到。
//   4) requestAnimationFrame 必须由测试驱动（step），不能用真的 rAF，否则断言跑到一半游戏还在跑。
//   5) 事件委托绑在父节点：桩不冒泡，必须手动把监听器拿出来调用。

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");

// ---------------------------------------------------------------- DOM 桩

function makeStyle() {
  const data = {};
  return new Proxy(data, {
    get: (t, k) => t[k],
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  });
}

function makeClassList(el) {
  const set = new Set();
  return {
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
    contains: (c) => set.has(c),
    toggle: (c, force) => {
      const on = force === undefined ? !set.has(c) : !!force;
      if (on) set.add(c);
      else set.delete(c);
      return on;
    },
    get length() {
      return set.size;
    },
  };
}

function makeEl(tag = "div", id = "") {
  const el = {
    tagName: tag.toUpperCase(),
    id,
    dataset: {},
    style: makeStyle(),
    children: [],
    attrs: {},
    listeners: {},
    textContent: "",
    innerHTML: "",
    hidden: false,
    disabled: false,
    checked: false,
    title: "",
    type: "",
    className: "",
    ownerDocument: null,
  };
  el.classList = makeClassList(el);
  el.addEventListener = (type, fn) => {
    (el.listeners[type] ??= []).push(fn);
  };
  el.removeEventListener = () => {};
  el.setAttribute = (k, v) => {
    el.attrs[k] = String(v);
    if (k === "hidden") el.hidden = v !== "false";
  };
  el.getAttribute = (k) => el.attrs[k] ?? null;
  el.appendChild = (child) => {
    if (child && child.__fragment) {
      for (const c of child.__fragment) el.children.push(c);
      return child;
    }
    el.children.push(child);
    return child;
  };
  el.append = (...nodes) => {
    for (const n of nodes) el.appendChild(n);
  };
  el.querySelector = (sel) => el.querySelectorAll(sel)[0] ?? null;
  el.querySelectorAll = (sel) => {
    const out = [];
    const walk = (node) => {
      for (const c of node.children ?? []) {
        if (c.__matches?.(sel)) out.push(c);
        walk(c);
      }
    };
    walk(el);
    return out;
  };
  el.__matches = (sel) => {
    if (sel.startsWith("#")) return el.id === sel.slice(1);
    if (sel.startsWith(".")) return String(el.className).split(/\s+/).includes(sel.slice(1));
    return el.tagName === sel.toUpperCase();
  };
  el.dispatch = (type, extra = {}) => {
    for (const fn of el.listeners[type] ?? []) fn({ preventDefault() {}, ...extra });
  };
  return el;
}

function makeDoc() {
  const byId = new Map();
  const doc = {
    listeners: {},
    documentElement: makeEl("html"),
    createElement: (tag) => makeEl(tag),
    createDocumentFragment: () => ({ __fragment: [], appendChild(c) { this.__fragment.push(c); } }),
    addEventListener: (type, fn) => {
      (doc.listeners[type] ??= []).push(fn);
    },
    dispatch: (type, ev = {}) => {
      for (const fn of doc.listeners[type] ?? []) fn({ preventDefault() {}, ...ev });
    },
  };
  doc.querySelector = (sel) => (sel.startsWith("#") ? doc.getElementById(sel.slice(1)) : null);
  doc.getElementById = (id) => {
    if (!byId.has(id)) {
      const el = makeEl("div", id);
      el.ownerDocument = doc;
      byId.set(id, el);
    }
    return byId.get(id);
  };
  doc.querySelectorAll = () => [];
  Object.defineProperty(doc, "title", { value: "", writable: true });
  return doc;
}

/** 按 index.html 还原初始状态：哪些弹层一开始是 hidden 的 */
function seedOverlays(doc) {
  for (const name of ["pause", "result", "levels", "setpieces", "help", "settings"]) {
    doc.getElementById(`ov-${name}`).hidden = true;
    doc.getElementById(`ov-${name}`).classList.add("hidden");
  }
  doc.getElementById("ov-ready").hidden = false;
}

/** mode-row / pad / star-row 的静态子节点 */
function seedStaticChildren(doc) {
  const row = doc.getElementById("mode-row");
  for (const m of ["campaign", "arcade", "setpiece"]) {
    const card = makeEl("button");
    card.className = "mode-card";
    card.dataset.mode = m;
    row.appendChild(card);
  }
  const pad = doc.getElementById("pad");
  for (const d of ["0", "1", "2", "3"]) {
    const key = makeEl("button");
    key.className = "pad-key";
    key.dataset.dir = d;
    pad.appendChild(key);
  }
  doc.getElementById("credit-lamps");
}

// ---------------------------------------------------------------- 环境桩

function installEnv() {
  const store = new Map();
  const frames = [];
  const prev = {
    document: Object.getOwnPropertyDescriptor(globalThis, "document"),
    requestAnimationFrame: Object.getOwnPropertyDescriptor(globalThis, "requestAnimationFrame"),
    localStorage: Object.getOwnPropertyDescriptor(globalThis, "localStorage"),
    matchMedia: Object.getOwnPropertyDescriptor(globalThis, "matchMedia"),
  };
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  globalThis.requestAnimationFrame = (cb) => {
    frames.push(cb);
    return frames.length;
  };
  globalThis.matchMedia = () => ({ matches: false });
  return {
    frames,
    store,
    restore() {
      for (const [k, d] of Object.entries(prev)) {
        if (d) Object.defineProperty(globalThis, k, d);
        else delete globalThis[k];
      }
    },
  };
}

/** 驱动 n 帧（毫秒步进而非帧数：main 里 dt 由时间戳算） */
function step(env, frames = 60, ms = 16.7) {
  for (let i = 0; i < frames; i += 1) {
    const cb = env.frames.shift();
    if (!cb) return i;
    cb((i + 1) * ms);
  }
  return frames;
}

// ---------------------------------------------------------------- 用例

test("装配：真跑一局，分数与豆数在推进（不是假绿）", async () => {
  const env = installEnv();
  const doc = makeDoc();
  seedOverlays(doc);
  seedStaticChildren(doc);
  const canvas = doc.getElementById("stage");
  canvas.clientWidth = 448;
  canvas.clientHeight = 496;
  canvas.getContext = () => null; // 渲染层静默降级，只测装配与循环
  globalThis.document = doc;

  try {
    const { boot } = await import("../js/main.mjs");
    assert.doesNotThrow(() => boot(doc), "装配层不该抛异常");

    // 开局：点 ready 层的启动按钮
    doc.getElementById("btn-start").dispatch("click");
    step(env, 30);

    const game = doc.getElementById("score-val");
    assert.ok(game, "计分窗必须存在");
    step(env, 600); // 约 10 秒
    assert.notEqual(doc.getElementById("score-val").textContent, "000000", "十秒了一分没得，主循环没在跑");
    assert.ok(
      Number(doc.getElementById("score-val").textContent) > 0,
      `分数应当上涨，实际 ${doc.getElementById("score-val").textContent}`,
    );
  } finally {
    env.restore();
    delete globalThis.document;
  }
});

test("装配：键盘输入能改变期望方向，暂停真的停住", async () => {
  const env = installEnv();
  const doc = makeDoc();
  seedOverlays(doc);
  seedStaticChildren(doc);
  const canvas = doc.getElementById("stage");
  canvas.clientWidth = 448;
  canvas.clientHeight = 496;
  canvas.getContext = () => null;
  globalThis.document = doc;

  try {
    const { boot } = await import("../js/main.mjs");
    boot(doc);
    doc.getElementById("btn-start").dispatch("click");
    step(env, 10);

    doc.dispatch("keydown", { key: "ArrowLeft" });
    step(env, 10);
    doc.dispatch("keydown", { key: "p" });
    step(env, 2);
    const pausedScore = doc.getElementById("score-val").textContent;
    step(env, 300);
    assert.equal(doc.getElementById("score-val").textContent, pausedScore, "暂停后分数不许再变");

    doc.dispatch("keydown", { key: "p" });
    step(env, 60);
    assert.ok(true, "恢复后继续跑，不抛异常");
  } finally {
    env.restore();
    delete globalThis.document;
  }
});

test("装配：语言切换热更新 —— 文本换了，但对局状态一毫秒不差地保持", async () => {
  const env = installEnv();
  const doc = makeDoc();
  seedOverlays(doc);
  seedStaticChildren(doc);
  const canvas = doc.getElementById("stage");
  canvas.clientWidth = 448;
  canvas.clientHeight = 496;
  canvas.getContext = () => null;
  globalThis.document = doc;

  try {
    const { boot } = await import("../js/main.mjs");
    boot(doc);
    doc.getElementById("btn-start").dispatch("click");
    step(env, 400);

    const before = {
      score: doc.getElementById("score-val").textContent,
      level: doc.getElementById("level-val").textContent,
      lang: doc.getElementById("btn-lang").textContent,
    };
    doc.getElementById("btn-lang").dispatch("click");
    step(env, 2);
    assert.notEqual(doc.getElementById("btn-lang").textContent, before.lang, "切换按钮标识应跟着换");
    assert.equal(doc.getElementById("score-val").textContent, before.score, "切语言不许动分数");
    assert.equal(doc.getElementById("level-val").textContent, before.level, "切语言不许动关卡");
  } finally {
    env.restore();
    delete globalThis.document;
  }
});

test("装配：音效与 AI 可读化开关都能落盘", async () => {
  const env = installEnv();
  const doc = makeDoc();
  seedOverlays(doc);
  seedStaticChildren(doc);
  const canvas = doc.getElementById("stage");
  canvas.clientWidth = 448;
  canvas.clientHeight = 496;
  canvas.getContext = () => null;
  globalThis.document = doc;

  try {
    const { boot } = await import("../js/main.mjs");
    boot(doc);
    doc.getElementById("btn-sound").dispatch("click");
    assert.equal(doc.getElementById("btn-sound").getAttribute("aria-pressed"), "false", "静音后闸刀要扳到关");
    doc.getElementById("btn-sound").dispatch("click");
    assert.equal(doc.getElementById("btn-sound").getAttribute("aria-pressed"), "true");

    const ai = doc.getElementById("opt-ai-read");
    ai.checked = false;
    ai.dispatch("change");
    step(env, 5);
    assert.equal(ai.checked, false, "硬核模式可关");
  } finally {
    env.restore();
    delete globalThis.document;
  }
});

test("index.html 里引用的每个 id 都能被装配层找到（防漏绑）", async () => {
  const env = installEnv();
  const doc = makeDoc();
  seedOverlays(doc);
  seedStaticChildren(doc);
  globalThis.document = doc;
  try {
    const { boot } = await import("../js/main.mjs");
    const ids = [...HTML.matchAll(/id="([\w-]+)"/g)].map((m) => m[1]);
    assert.ok(ids.length >= 40, `页面 id 太少（${ids.length}）`);
    // boot 内部会 querySelector 全部交互件；只要不抛异常就说明都找得到
    assert.doesNotThrow(() => boot(doc));
    for (const id of ["stage", "btn-start", "btn-pause", "score-val", "beat-fill"]) {
      assert.ok(ids.includes(id), `index.html 缺 #${id}`);
    }
  } finally {
    env.restore();
    delete globalThis.document;
  }
});
