// tests/smoke.mjs — 无浏览器装配冒烟：验证 main.mjs 在桩环境里能装配、
// 渲染循环推进、画线与播放的真实链路活着。防"语法全绿但页面白屏"。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// —— 元素桩 ——
function makeEl(id) {
  const listeners = {};
  const classes = new Set();
  const el = {
    id,
    listeners,
    style: {},
    hidden: false,
    disabled: false,
    title: "",
    width: 800,
    height: 500,
    clientWidth: 800,
    clientHeight: 500,
    classList: {
      add: (...c) => c.forEach(x => classes.add(x)),
      remove: (...c) => c.forEach(x => classes.delete(x)),
      toggle: (c, force) => {
        const on = force === undefined ? !classes.has(c) : Boolean(force);
        if (on) classes.add(c); else classes.delete(c);
        return on;
      },
      contains: c => classes.has(c),
    },
    setAttribute() {},
    getAttribute: () => null,
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener() {},
    appendChild() {},
    replaceChildren() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 500, width: 800, height: 500 }),
    dispatch(type, ev = {}) {
      for (const fn of listeners[type] || []) {
        fn({
          target: el, clientX: 0, clientY: 0, button: 0, pointerId: 1,
          pointerType: "mouse", preventDefault() {}, stopPropagation() {},
          ...ev,
        });
      }
    },
  };
  let text = "";
  Object.defineProperty(el, "textContent", { get: () => text, set: v => { text = String(v); } });
  return el;
}

// —— Canvas 2D 记录型桩 ——
function makeCtx() {
  const calls = [];
  const gradient = { addColorStop: (...a) => calls.push({ name: "addColorStop", args: a }) };
  const base = {
    calls,
    canvas: null, // 由宿主回填
    save: () => calls.push({ name: "save", args: [] }),
    restore: () => calls.push({ name: "restore", args: [] }),
    translate: (...a) => calls.push({ name: "translate", args: a }),
    scale: (...a) => calls.push({ name: "scale", args: a }),
    setTransform: (...a) => calls.push({ name: "setTransform", args: a }),
    clearRect: () => calls.push({ name: "clearRect", args: [] }),
    fillRect: () => calls.push({ name: "fillRect", args: [] }),
    beginPath: () => calls.push({ name: "beginPath", args: [] }),
    moveTo: (...a) => calls.push({ name: "moveTo", args: a }),
    lineTo: (...a) => calls.push({ name: "lineTo", args: a }),
    stroke: () => calls.push({ name: "stroke", args: [] }),
    fill: () => calls.push({ name: "fill", args: [] }),
    arc: () => calls.push({ name: "arc", args: [] }),
    ellipse: () => calls.push({ name: "ellipse", args: [] }),
    closePath: () => calls.push({ name: "closePath", args: [] }),
    fillText: () => calls.push({ name: "fillText", args: [] }),
    createLinearGradient: () => { calls.push({ name: "createLinearGradient", args: [] }); return gradient; },
    createRadialGradient: () => { calls.push({ name: "createRadialGradient", args: [] }); return gradient; },
  };
  // Proxy 兜底：render 层新增任何方法都不再让冒烟假红
  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      target[prop] = (...a) => { calls.push({ name: String(prop), args: a }); return gradient; };
      return target[prop];
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
}

// —— 全局环境桩 ——
const html = readFileSync(join(__dirname, "..", "index.html"), "utf-8");
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
const dupCheck = new Set();
const dom = {};
for (const id of ids) {
  if (dupCheck.has(id)) throw new Error(`duplicate id in index.html: ${id}`);
  dupCheck.add(id);
  dom[id] = makeEl(id);
}
// 从 index.html 抽带 hidden 的元素，还原初始隐藏态（防"弹层假开"）
for (const m of html.matchAll(/<(?:nav|div|span|p)[^>]*class="[^"]*\bhidden\b[^"]*"[^>]*id="([^"]+)"/g)) {
  dom[m[1]]?.classList.add("hidden");
}

const canvas = dom["game-canvas"];
const ctx = makeCtx();
ctx.canvas = canvas;
canvas.getContext = () => ctx;

let rafQueue = [];
const raf = (fn) => { rafQueue.push(fn); return rafQueue.length; };

function installGlobals() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  };
  const winListeners = {};
  globalThis.__wbWindowListeners = winListeners;
  globalThis.window = globalThis;
  globalThis.addEventListener = (t, fn) => { (winListeners[t] ||= []).push(fn); };
  globalThis.removeEventListener = () => {};
  globalThis.devicePixelRatio = 1;
  globalThis.requestAnimationFrame = raf;
  globalThis.performance = { now: () => Date.now() };
  globalThis.prompt = () => null;
  globalThis.confirm = () => false;
  globalThis.document = {
    title: "",
    documentElement: { lang: "" },
    getElementById: id => dom[id] || null,
    querySelector: () => makeEl("meta"),
    addEventListener() {},
    visibilityState: "visible",
  };
  // Node 22/24 的 navigator 是只读 getter，必须 defineProperty 覆盖
  const navStub = { languages: ["zh-CN"], language: "zh-CN", userAgent: "smoke" };
  Object.defineProperty(globalThis, "navigator", {
    value: navStub, configurable: true, writable: true,
  });
}

function stepFrames(n, dt = 16) {
  for (let i = 0; i < n; i++) {
    const queue = rafQueue;
    rafQueue = [];
    for (const fn of queue) fn(performance.now() + i * dt);
  }
}

// —— 用例 ——
test("main.mjs assembles in a stub DOM without throwing", async () => {
  installGlobals();
  await import("../js/main.mjs");
  stepFrames(3);
  assert.ok(ctx.calls.length > 0, "renderer should have painted frames");
});

test("draw stroke -> play -> rider moves down (whole chain alive)", async () => {
  const canvas2 = dom["game-canvas"];
  // 画一条下坡线（viewScale=1, offset=0：client 坐标减画布中心得世界坐标）
  canvas2.dispatch("pointerdown", { clientX: 100, clientY: 200, button: 0 });
  canvas2.dispatch("pointermove", { clientX: 400, clientY: 400 });
  canvas2.dispatch("pointermove", { clientX: 700, clientY: 480 });
  for (const fn of globalThis.__wbWindowListeners.pointerup || []) {
    fn({ button: 0, clientX: 700, clientY: 480, preventDefault() {} });
  }

  // 播放：小人瞬移到线起点，所以基准取"播放后第 1 帧"，与 30 帧后比较
  dom["btn-play"].dispatch("click");
  ctx.calls.length = 0;
  stepFrames(1);
  const before = riderYFromCalls(ctx.calls, true);
  assert.notEqual(before, null, "rider should be drawn (translate of rider position)");
  ctx.calls.length = 0;
  stepFrames(30);
  const after = riderYFromCalls(ctx.calls, true);
  assert.ok(after > before, `rider should slide downhill (translate y ${before} -> ${after})`);
});

// 从 ctx 调用里抽 drawRider 的 translate(x, y)。
// applyView 的 translate 是画布中心 (400, 250)，必须排除；剩余即小人位置。
function riderYFromCalls(calls, tail = false) {
  const list = calls.filter(
    c => c.name === "translate" && !(c.args[0] === 400 && c.args[1] === 250),
  );
  if (list.length === 0) return null;
  const item = tail ? list[list.length - 1] : list[0];
  return item.args[1];
}
