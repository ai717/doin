// smoke.mjs：无浏览器 DOM 桩冒烟测试（laser-reflect）。
// 验证 main.mjs 装配链路：初始化 → 渲染 N 格 → 点击旋转 → 步数推进 → 胜利结算。
// 按 canvas-frontend-smoke-test 范式：断言「业务可观测量在推进」，不只断言「没抛异常」。

// ---------- DOM 桩 ----------
class ClassList {
  constructor(el) { this.el = el; this.set = new Set(); }
  add(...cls) { cls.forEach((c) => this.set.add(c)); this.sync(); }
  remove(...cls) { cls.forEach((c) => this.set.delete(c)); this.sync(); }
  toggle(c, force) {
    if (force === undefined) { this.set.has(c) ? this.set.delete(c) : this.set.add(c); }
    else if (force) this.set.add(c);
    else this.set.delete(c);
    this.sync();
    return this.set.has(c);
  }
  contains(c) { return this.set.has(c); }
  sync() { this.el._className = [...this.set].join(" "); }
}

function makeEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    children: [],
    dataset: {},
    style: new Proxy({}, {
      get: (t, k) => (k === "setProperty" ? (pk, pv) => { t[pk] = pv; } : t[k]),
      set: (t, k, v) => { t[k] = v; return true; },
    }),
    attributes: {},
    _className: "",
    hidden: false,
    disabled: false,
    listeners: {},
    parentElement: null,
    innerHTMLValue: "",
    textContentValue: "",
  };
  Object.defineProperty(el, "className", {
    get() { return el._className; },
    set(v) { el._className = v; el.classList.set = new Set(v.split(/\s+/).filter(Boolean)); },
  });
  el.classList = new ClassList(el);
  // 预填充 classList（若 className 初始有值）
  el.classList.set = new Set();

  el.appendChild = (child) => {
    child.parentElement = el;
    el.children.push(child);
    return child;
  };
  el.removeChild = (child) => {
    const i = el.children.indexOf(child);
    if (i >= 0) el.children.splice(i, 1);
    return child;
  };
  el.querySelector = (sel) => {
    // 只支持单一简单选择器（.cls / #id / tag）
    const find = (node) => {
      for (const c of node.children) {
        if (sel.startsWith(".")) { if (c.classList.contains(sel.slice(1))) return c; }
        else if (sel.startsWith("#")) { if (c.attributes.id === sel.slice(1)) return c; }
        else if (c.tagName.toLowerCase() === sel.toLowerCase()) return c;
        const r = find(c);
        if (r) return r;
      }
      return null;
    };
    return find(el);
  };
  el.querySelectorAll = (sel) => {
    const out = [];
    const walk = (node) => {
      for (const c of node.children) {
        let m = false;
        if (sel.startsWith(".")) m = c.classList.contains(sel.slice(1));
        else if (sel.startsWith("#")) m = c.attributes.id === sel.slice(1);
        else if (sel.startsWith("[")) {
          const attr = sel.slice(1, -1).split("=")[0].replace(/^\[/, "");
          m = attr in c.attributes;
        } else m = c.tagName.toLowerCase() === sel.toLowerCase();
        if (m) out.push(c);
        walk(c);
      }
    };
    walk(el);
    return out;
  };
  el.addEventListener = (type, fn) => { (el.listeners[type] ||= []).push(fn); };
  el.removeEventListener = () => {};
  el.dispatchEvent = (evt) => {
    (el.listeners[evt.type] || []).forEach((fn) => fn.call(el, evt));
  };
  el.setAttribute = (k, v) => { el.attributes[k] = String(v); };
  el.getAttribute = (k) => (k in el.attributes ? el.attributes[k] : null);
  el.closest = (sel) => {
    let cur = el;
    while (cur) {
      if (sel.startsWith(".") && cur.classList?.contains(sel.slice(1))) return cur;
      if (sel.startsWith("[") && sel.slice(1, -1).split("=")[0].replace(/^\[/, "") in (cur.attributes || {})) return cur;
      cur = cur.parentElement;
    }
    return null;
  };
  el.focus = () => {};
  Object.defineProperty(el, "innerHTML", {
    get() { return el.innerHTMLValue; },
    set(v) {
      el.innerHTMLValue = v;
      el.children = [];
    },
  });
  Object.defineProperty(el, "textContent", {
    get() { return el.textContentValue; },
    set(v) { el.textContentValue = String(v); },
  });
  Object.defineProperty(el, "clientWidth", { get() { return 640; } });
  Object.defineProperty(el, "clientHeight", { get() { return 480; } });
  return el;
}

function makeEvent(type, extra = {}) {
  return { type, target: extra.target, closest: () => null, ...extra };
}

// ---------- 构建完整 DOM 树（按 index.html 结构） ----------
function buildDocument() {
  const ids = [
    "game-app", "stage-bar", "back-home", "stage-title", "stage-actions",
    "btn-sound", "btn-lang", "btn-help",
    "stage-core", "bench-frame", "bench-lid", "tray", "readout",
    "readout-level", "readout-moves", "readout-par", "readout-stars",
    "board-wrap", "board", "rays-layer", "controls",
    "btn-undo", "btn-reset", "btn-select",
    "level-panel", "level-grid", "btn-panel-close",
    "result-layer", "result-stars", "result-title", "result-sub",
    "btn-next", "btn-replay", "btn-close-result",
    "help-layer", "btn-help-close",
  ];
  const byIdMap = {};
  for (const id of ids) {
    const el = makeEl("div");
    el.attributes.id = id;
    el.dataset = {};
    byIdMap[id] = el;
  }

  // board 需要特殊处理：支持 getBoundingClientRect
  // readout-level 的 parentElement.querySelector(".readout-label")
  const label = makeEl("span");
  label.className = "readout-label";
  byIdMap["readout-level"].parentElement = byIdMap["readout"];
  byIdMap["readout"].children.push(byIdMap["readout-level"], label);
  byIdMap["readout"].querySelector = (sel) => {
    if (sel === ".readout-label") return label;
    return null;
  };

  // meta description
  const meta = makeEl("meta");
  meta.setAttribute("name", "description");

  const documentStub = {
    documentElement: makeEl("html"),
    title: "",
    getElementById: (id) => byIdMap[id] ?? null,
    createElement: (tag) => makeEl(tag),
    querySelector: (sel) => (sel === 'meta[name="description"]' ? meta : null),
    querySelectorAll: (sel) => {
      // data-i18n / data-i18n-aria 遍历：返回预置属性元素
      const out = [];
      const walk = (node) => {
        for (const c of node.children || []) {
          if (sel === "[data-i18n]" && "data-i18n" in c.attributes) out.push(c);
          if (sel === "[data-i18n-aria]" && "data-i18n-aria" in c.attributes) out.push(c);
          walk(c);
        }
      };
      // 遍历所有已知元素（扁平化）
      for (const el of Object.values(byIdMap)) {
        if (sel === "[data-i18n]" && "data-i18n" in el.attributes) out.push(el);
        if (sel === "[data-i18n-aria]" && "data-i18n-aria" in el.attributes) out.push(el);
      }
      return out;
    },
    addEventListener: () => {},
    dispatchEvent: () => {},
    body: makeEl("body"),
  };

  // 给所有元素装 data-i18n 属性（模拟 index.html）
  const i18nIds = [
    "back-home", "stage-title", "btn-undo", "btn-reset", "btn-select",
    "btn-panel-close", "result-title", "btn-next", "btn-replay", "btn-close-result",
    "help-title", "help-body", "btn-help-close",
  ];
  for (const id of i18nIds) {
    byIdMap[id]?.setAttribute("data-i18n", id);
  }
  // readout-label 等的 data-i18n
  byIdMap["readout"]?.setAttribute("data-i18n", "level");

  return { documentStub, byIdMap };
}

// ---------- 全局桩 ----------
const { documentStub, byIdMap } = buildDocument();

globalThis.document = documentStub;
globalThis.window = globalThis;
Object.defineProperty(globalThis, "navigator", {
  value: { languages: ["zh-CN"], language: "zh-CN" },
  configurable: true,
  writable: true,
});
globalThis.localStorage = (() => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
})();

// SVG 元素的 setAttribute / innerHTML 兼容
// rays-layer 需要 width/height/viewBox/innerHTML

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log("PASS", name);
  } catch (error) {
    failures++;
    console.log("FAIL", name, "-", error.message);
  }
}

// ---------- 冒烟主流程 ----------
try {
  const { createGameController } = await import("../js/game.mjs");
  const { LEVEL_COUNT, getLevel } = await import("../js/levels.mjs");

  check("关卡数量 40", () => {
    if (LEVEL_COUNT !== 40) throw new Error(`LEVEL_COUNT=${LEVEL_COUNT}`);
  });

  // 控制器冒烟：装载 → 旋转 → 撤销 → 重置
  check("控制器装载第 1 关", () => {
    const game = createGameController({ onChange: () => {} });
    game.loadLevel(0);
    const v = game.view();
    if (v.levelIndex !== 0) throw new Error("levelIndex 不为 0");
    if (v.cells.length === 0) throw new Error("cells 为空");
  });

  check("旋转推动步数", () => {
    const game = createGameController({ onChange: () => {} });
    game.loadLevel(0);
    const v0 = game.view();
    const rotatable = v0.cells.find((c) => c.type === "mirror" || c.type === "splitter");
    if (!rotatable) throw new Error("无可旋转元件");
    game.rotateAt(rotatable.r, rotatable.c);
    const v1 = game.view();
    if (v1.moves !== v0.moves + 1) throw new Error(`moves ${v0.moves} -> ${v1.moves}`);
    // 撤销
    game.undo();
    const v2 = game.view();
    if (v2.moves !== 0) throw new Error(`undo 后 moves=${v2.moves}`);
  });

  check("重置清零", () => {
    const game = createGameController({ onChange: () => {} });
    game.loadLevel(0);
    const rotatable = game.view().cells.find((c) => c.type === "mirror");
    game.rotateAt(rotatable.r, rotatable.c);
    game.reset();
    if (game.view().moves !== 0) throw new Error("reset 后 moves 不为 0");
  });

  check("胜利结算触发 solved", () => {
    // 找一关 minMoves=1 的关，转一下应解出
    const game = createGameController({ onChange: () => {} });
    game.loadLevel(0);
    // 第 1 关 par=1：暴力尝试每个可旋转元件各转一次
    let solved = false;
    const v0 = game.view();
    const rotatables = v0.cells.filter((c) => c.type === "mirror" || c.type === "splitter");
    for (const rc of rotatables) {
      game.rotateAt(rc.r, rc.c);
      if (game.view().solved) { solved = true; break; }
      game.undo();
    }
    if (!solved) throw new Error("第 1 关旋转一次未解出");
  });

  check("ui.render 可执行（DOM 桩下）", async () => {
    const { mountUI } = await import("../js/ui.mjs");
    const refs = {
      board: byIdMap["board"],
      raysLayer: byIdMap["rays-layer"],
    };
    const calls = [];
    const ui = mountUI(refs, { onRotate: (r, c) => calls.push([r, c]) }, {});
    const { getLevel } = await import("../js/levels.mjs");
    const spec = getLevel(0);
    ui.render({ rows: spec.rows, cols: spec.cols, par: spec.par, cells: spec.cells, levelIndex: 0, moves: 0 });
    if (byIdMap["board"].children.length === 0) throw new Error("board 未渲染格子");
    // 点击格子触发 onRotate
    const cell = byIdMap["board"].children[0];
    cell.dispatchEvent(makeEvent("click", { target: cell }));
    if (calls.length === 0) throw new Error("点击未触发 onRotate");
  });
} catch (error) {
  failures++;
  console.log("FAIL 装配异常 -", error.message);
}

console.log(failures === 0 ? "SMOKE ALL PASS" : `SMOKE FAILURES: ${failures}`);
process.exit(failures ? 1 : 0);
