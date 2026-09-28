// dom-stub.mjs — 极简 DOM 桩（供无浏览器冒烟测试）
// 关键硬约束（踩过的坑，见 PROJECT_MEMORY）：
//  1. 必须还原 HTML 初始 hidden，否则 UI 层会把弹层当"已打开"
//  2. appendChild 必须摊平 DocumentFragment
//  3. className setter 必须联动 classList
//  4. navigator 在 Node 24 是只读 getter，必须用 defineProperty
//  5. style.setProperty 必须真的存值；直接属性赋值也要能存（Proxy 实现）
//  6. 没有真实动画引擎：animationend 不会自己产生

/** 内联样式桩：自定义属性与普通属性都真实记录 */
function makeInlineStyle() {
  const props = new Map();
  const api = {
    setProperty(name, value) { props.set(String(name), String(value)); },
    removeProperty(name) { props.delete(String(name)); },
    getPropertyValue(name) { return props.get(String(name)) ?? ""; },
    _all() { return Object.fromEntries(props); },
  };
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
    set textContent(value) { this._textContent = String(value); this.children.length = 0; }
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
      if (!this._listeners.has(type)) this._listeners.set(type, new Set());
      this._listeners.get(type).add(fn);
    }
    removeEventListener(type, fn) { this._listeners.get(type)?.delete(fn); }
    dispatch(type, extra = {}) {
      const ev = {
        type, target: this, currentTarget: this,
        defaultPrevented: false, preventDefault() { this.defaultPrevented = true; },
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
      while (node) { if (match(node)) return node; node = node.parentNode; }
      return null;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    querySelectorAll(selector) {
      const out = [];
      const match = (el) => {
        if (selector.startsWith(".")) return el.classList.contains(selector.slice(1));
        if (selector.startsWith("#")) return el.id === selector.slice(1);
        if (selector.startsWith("[") && selector.includes("data-mode=")) {
          const want = selector.match(/data-mode="([^"]+)"/)?.[1];
          return el.dataset.mode === want;
        }
        if (selector.startsWith("[") && selector.includes("data-idx")) {
          return "data-idx" in el.attributes;
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
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 640, height: 480, right: 640, bottom: 480 };
    }
    get innerHTML() { return ""; }
    set innerHTML(value) { if (value === "") this.children.length = 0; }
    focus() {}
    blur() {}
  }

  class Fragment extends El {
    constructor() { super("#fragment"); this.__isFragment = true; }
  }

  const root = new El("html");
  const body = new El("body");
  root.appendChild(body);

  // 解析 HTML 里的 id 元素，建到 body 下
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
    const cls = attrsBlob.match(/class="([^"]*)"/)?.[1];
    if (cls) el.className = cls;
    idElements.set(id, el);
    body.appendChild(el);
  }

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

  let rafQueue = [];
  let rafSeq = 1;
  const requestAnimationFrame = (cb) => { const id = rafSeq++; rafQueue.push({ id, cb }); return id; };
  const cancelAnimationFrame = (id) => { rafQueue = rafQueue.filter((t) => t.id !== id); };

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
  globalThis.location = { reload() { globalThis.__reloaded = true; }, href: "http://127.0.0.1/" };

  return { document, root, body, byId, step, localStorage, clock: () => clock, hiddenIds };
}
