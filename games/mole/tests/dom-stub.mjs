// dom-stub.mjs — 极简 DOM 桩（供无浏览器冒烟测试）
// 关键硬约束（踩过的坑）：
//  1. 必须还原 HTML 初始 hidden，否则 UI 层会把弹层当"已打开"，游戏被判定为永久暂停
//  2. appendChild 必须摊平 DocumentFragment（插的是子节点，不是 fragment 本身）
//  3. className setter 必须联动 classList
//  4. navigator 在 Node 24 是只读 getter，必须用 defineProperty
//  5. style.setProperty 必须真的存值，否则内联自定义属性（如 --duck-ms）在桩里凭空消失

import { readFileSync } from "node:fs";

/** 内联样式桩：把自定义属性与普通属性都真实记录下来，供断言读取 */
function makeInlineStyle() {
  const props = new Map();
  const api = {
    setProperty(name, value) {
      props.set(String(name), String(value));
    },
    removeProperty(name) {
      props.delete(String(name));
    },
    getPropertyValue(name) {
      return props.get(String(name)) ?? "";
    },
    /** 供测试用：拿到全部内联属性 */
    _all() {
      return Object.fromEntries(props);
    },
  };
  // 真实 CSSStyleDeclaration 支持 `el.style.left = "10px"` 这种直接赋值。
  // 只实现 setProperty 会漏掉直接赋值路径 —— 曾经 moveHammer 用的就是
  // `style.left=...`，桩里读到的却是空字符串，导致"木槌定位"完全测不到。
  // 用 Proxy 把任意属性读写都映射到同一份 props。
  return new Proxy(api, {
    get(target, key) {
      if (key in target) return target[key];
      if (typeof key !== "string") return undefined;
      return props.get(key) ?? "";
    },
    set(target, key, value) {
      if (typeof key === "string" && !(key in target)) {
        props.set(key, String(value));
        return true;
      }
      target[key] = value;
      return true;
    },
  });
}

const HIDDEN_RE = /<[^>]*\bid="([^"]+)"[^>]*\bhidden\b[^>]*>|<[^>]*\bhidden\b[^>]*\bid="([^"]+)"[^>]*>/g;

function parseHiddenIds(html) {
  const ids = new Set();
  for (const m of html.matchAll(HIDDEN_RE)) {
    if (m[1]) ids.add(m[1]);
    if (m[2]) ids.add(m[2]);
  }
  // 兼容 class="modal-layer hidden" 这类写法
  for (const m of html.matchAll(/id="([^"]+)"[^>]*class="([^"]*)"/g)) {
    if (/\bhidden\b/.test(m[2])) ids.add(m[1]);
  }
  for (const m of html.matchAll(/class="([^"]*)"[^>]*id="([^"]+)"/g)) {
    if (/\bhidden\b/.test(m[1])) ids.add(m[2]);
  }
  return ids;
}

export function installDom(html) {
  const hiddenIds = parseHiddenIds(html);
  const byId = new Map();
  const listeners = new Map();
  let idSeq = 0;

  class ClassList {
    constructor(el) { this.el = el; this.set = new Set(); }
    add(...names) { for (const n of names) if (n) this.set.add(n); this.sync(); }
    remove(...names) { for (const n of names) this.set.delete(n); this.sync(); }
    toggle(name, force) {
      const on = force === undefined ? !this.set.has(name) : Boolean(force);
      if (on) this.set.add(name); else this.set.delete(name);
      this.sync();
      return on;
    }
    contains(name) { return this.set.has(name); }
    sync() { this.el._className = [...this.set].join(" "); }
  }

  class El {
    constructor(tag = "div") {
      this.tagName = String(tag).toUpperCase();
      this.children = [];
      this.childNodes = this.children;
      this.parentNode = null;
      this.attributes = {};
      this.dataset = {};
      // 内联样式：必须真的存下来。曾经 setProperty 是 no-op，
      // 于是 ui.mjs 写的 `--duck-ms` 在桩里凭空消失、断言全看不到 ——
      // 又一个"桩量不到所以测不出来"的盲区。
      this.style = makeInlineStyle();
      this._className = "";
      this._textContent = "";
      this._id = "";
      this._listeners = new Map();
      this.classList = new ClassList(this);
      this.hidden = false;
    }

    get id() { return this._id; }
    set id(value) {
      this._id = String(value);
      if (this._id) byId.set(this._id, this);
    }

    get className() { return this._className; }
    set className(value) {
      this._className = String(value);
      this.classList.set = new Set(this._className.split(/\s+/).filter(Boolean));
    }

    get textContent() { return this._textContent; }
    set textContent(value) {
      this._textContent = String(value);
      this.children.length = 0;
    }

    get offsetWidth() { return 100; }

    setAttribute(k, v) {
      this.attributes[k] = String(v);
      if (k === "id") this.id = v;
    }
    getAttribute(k) { return this.attributes[k] ?? null; }
    removeAttribute(k) { delete this.attributes[k]; }
    hasAttribute(k) { return k in this.attributes; }

    appendChild(node) {
      if (!node) return node;
      if (node.__isFragment) {
        for (const child of [...node.children]) this.appendChild(child);
        node.children.length = 0;
        return node;
      }
      node.parentNode = this;
      this.children.push(node);
      return node;
    }

    append(...nodes) { for (const n of nodes) this.appendChild(n); }
    replaceChildren(...nodes) {
      this.children.length = 0;
      for (const n of nodes) this.appendChild(n);
    }
    removeChild(node) {
      const i = this.children.indexOf(node);
      if (i >= 0) this.children.splice(i, 1);
      return node;
    }
    remove() { this.parentNode?.removeChild(this); }

    addEventListener(type, fn) {
      const key = `${type}`;
      if (!this._listeners.has(key)) this._listeners.set(key, new Set());
      this._listeners.get(key).add(fn);
    }
    removeEventListener(type, fn) { this._listeners.get(type)?.delete(fn); }

    /** 派发合成事件（不冒泡，测试里显式逐级调用） */
    dispatch(type, extra = {}) {
      const ev = {
        type,
        target: this,
        currentTarget: this,
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
        ...extra,
      };
      for (const fn of this._listeners.get(type) ?? []) fn(ev);
      return ev;
    }

    closest(selector) {
      let node = this;
      const match = (el) => {
        if (selector.startsWith(".")) return el.classList.contains(selector.slice(1));
        if (selector.startsWith("#")) return el.id === selector.slice(1);
        return el.tagName === selector.toUpperCase();
      };
      while (node) {
        if (match(node)) return node;
        node = node.parentNode;
      }
      return null;
    }

    querySelector(selector) {
      return this.querySelectorAll(selector)[0] ?? null;
    }

    querySelectorAll(selector) {
      const out = [];
      const match = (el) => {
        if (selector.startsWith(".")) return el.classList.contains(selector.slice(1));
        if (selector.startsWith("#")) return el.id === selector.slice(1);
        if (selector.startsWith("[") && selector.includes("data-mode=")) {
          const want = selector.match(/data-mode="([^"]+)"/)?.[1];
          return el.dataset.mode === want;
        }
        if (selector === "[data-i18n]") return "data-i18n" in el.attributes;
        return el.tagName === selector.toUpperCase();
      };
      const walk = (el) => {
        for (const child of el.children) {
          if (match(child)) out.push(child);
          walk(child);
        }
      };
      walk(this);
      return out;
    }

    // 桩没有真实排版引擎，rect 只能是常量 —— 但可以按元素类型给一个"像样"的值，
    // 让依赖 rect 的坐标换算至少能算出稳定、可断言的数。
    // 注意 #garden 故意给非零 left/top：若代码用 `x - rect.left` 做换算，
    // 桩里就会得到与视口坐标不同的结果，断言能立刻发现换算被改回去了。
    getBoundingClientRect() {
      if (this.id === "garden") {
        return { left: 40, top: 90, width: 720, height: 520, right: 760, bottom: 610 };
      }
      return { left: 0, top: 0, width: 640, height: 480, right: 640, bottom: 480 };
    }

    /* eslint-disable no-unused-vars */
    get innerHTML() { return ""; }
    set innerHTML(value) { if (value === "") this.children.length = 0; }
    /* eslint-enable no-unused-vars */

    focus() {}
    blur() {}
  }

  class Fragment extends El {
    constructor() {
      super("#fragment");
      this.__isFragment = true;
    }
  }

  const root = new El("html");
  const body = new El("body");
  root.appendChild(body);

  const idElements = new Map();
  for (const m of html.matchAll(/<(\w+)([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    const tag = m[1];
    const id = m[3];
    if (idElements.has(id)) continue;
    const el = new El(tag);
    el.id = id;
    const attrsBlob = m[2];
    for (const a of attrsBlob.matchAll(/(\w[\w-]*)="([^"]*)"/g)) {
      el.attributes[a[1]] = a[2];
      if (a[1].startsWith("data-")) {
        const camel = a[1].slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        el.dataset[camel] = a[2];
      }
    }
    if (/\bhidden\b/.test(attrsBlob)) el.hidden = true;
    // class 解析
    const cls = attrsBlob.match(/class="([^"]*)"/)?.[1];
    if (cls) el.className = cls;
    idElements.set(id, el);
    body.appendChild(el);
  }

  // 文本节点里带 data-i18n 的也建出来
  for (const m of html.matchAll(/<(\w+)([^>]*\bdata-i18n="([^"]+)"[^>]*)>/g)) {
    const id = `i18n-${idSeq++}`;
    const el = new El(m[1]);
    el.id = id;
    el.attributes["data-i18n"] = m[3];
    el.dataset.i18n = m[3];
    const cls = m[2].match(/class="([^"]*)"/)?.[1];
    if (cls) el.className = cls;
    body.appendChild(el);
  }

  // 弹层初始 hidden
  for (const id of hiddenIds) {
    const el = idElements.get(id);
    if (el) el.hidden = true;
  }

  const document = {
    documentElement: root,
    body,
    hidden: false,
    createElement: (tag) => new El(tag),
    createDocumentFragment: () => new Fragment(),
    getElementById: (id) => byId.get(id) ?? null,
    querySelector: (sel) => body.querySelector(sel),
    querySelectorAll: (sel) => body.querySelectorAll(sel),
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    dispatch(type, extra = {}) {
      const ev = { type, target: document, preventDefault() {}, ...extra };
      for (const fn of listeners.get(type) ?? []) fn(ev);
      return ev;
    },
  };

  // rAF 受控队列
  let rafQueue = [];
  let rafSeq = 1;
  const requestAnimationFrame = (cb) => {
    const id = rafSeq++;
    rafQueue.push({ id, cb });
    return id;
  };
  const cancelAnimationFrame = (id) => { rafQueue = rafQueue.filter((t) => t.id !== id); };

  /** 手动步进 n 帧：每帧给一个递增的高精度时间戳 */
  let clock = 0;
  const step = (frames = 1, dtMs = 16) => {
    for (let i = 0; i < frames; i += 1) {
      clock += dtMs;
      const pending = rafQueue;
      rafQueue = [];
      for (const task of pending) task.cb(clock);
    }
  };

  const localStorage = (() => {
    const map = new Map();
    return {
      getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
      setItem: (k, v) => map.set(String(k), String(v)),
      removeItem: (k) => map.delete(String(k)),
      clear: () => map.clear(),
      get length() { return map.size; },
    };
  })();

  const navigatorStub = { language: "zh-CN", userAgent: "node-smoke" };
  Object.defineProperty(globalThis, "navigator", {
    value: navigatorStub, configurable: true, writable: true,
  });

  globalThis.window = {
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener: (type, fn) => document.addEventListener(type, fn),
    removeEventListener: (type, fn) => document.removeEventListener(type, fn),
    requestAnimationFrame,
    cancelAnimationFrame,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  globalThis.document = document;
  globalThis.localStorage = localStorage;
  globalThis.requestAnimationFrame = requestAnimationFrame;
  globalThis.cancelAnimationFrame = cancelAnimationFrame;
  globalThis.setTimeout = globalThis.setTimeout;
  globalThis.location = { reload() { globalThis.__reloaded = true; }, href: "http://127.0.0.1/" };

  return { document, root, body, byId, step, localStorage, clock: () => clock, hiddenIds };
}
