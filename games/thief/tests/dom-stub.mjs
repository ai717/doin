// dom-stub.mjs - minimal DOM + window stub so ui.mjs / main.mjs can be run for
// real in node. No CSS engine, no layout: getBoundingClientRect is a zero rect
// whose width falls back to the canvas width in renderer.toStage (1:1 mapping),
// which is exactly what lets us drive pointer events by stage coordinates.

const VOID_TAGS = new Set(["meta", "link", "br", "hr", "img", "input", "source", "col"]);

function camel(text) {
  return text.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

class StubElement {
  constructor(tagName) {
    this.tagName = String(tagName).toLowerCase();
    this.nodeType = 1;
    this.children = [];
    this.parentElement = null;
    this._attrs = new Map();
    this._classes = new Set();
    this._listeners = new Map();
    this.dataset = {};
    this.style = {};
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
    this.title = "";
    this.value = "";
    this.width = 0;
    this.height = 0;
  }

  get id() {
    return this._attrs.get("id") ?? "";
  }

  set id(value) {
    this._attrs.set("id", String(value));
  }

  get classList() {
    const self = this;
    return {
      add: (...names) => names.forEach((name) => self._classes.add(name)),
      remove: (...names) => names.forEach((name) => self._classes.delete(name)),
      toggle: (name, force) => {
        const on = force === undefined ? !self._classes.has(name) : Boolean(force);
        if (on) self._classes.add(name);
        else self._classes.delete(name);
        return on;
      },
      contains: (name) => self._classes.has(name),
    };
  }

  get className() {
    return [...this._classes].join(" ");
  }

  set className(value) {
    this._classes = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  // ui.mjs 用 innerHTML = "" 清空容器，用模板串灌格子。
  set innerHTML(markup) {
    this.children = [];
    this._markup = String(markup);
    if (!markup) return;
    const root = parseHTML(String(markup));
    for (const child of root.children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  get innerHTML() {
    return this._markup ?? "";
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    this.children = this.children.filter((item) => item !== child);
    return child;
  }

  setAttribute(name, value) {
    const key = String(name);
    this._attrs.set(key, String(value));
    if (key === "id") this.id = String(value);
    else if (key === "class") this.className = String(value);
    else if (key === "hidden") this.hidden = true;
    else if (key.startsWith("data-")) this.dataset[camel(key.slice(5))] = String(value);
  }

  getAttribute(name) {
    const key = String(name);
    if (key === "class") return this.className || null;
    if (key.startsWith("data-")) {
      const value = this.dataset[camel(key.slice(5))];
      return value === undefined ? null : value;
    }
    return this._attrs.has(key) ? this._attrs.get(key) : null;
  }

  hasAttribute(name) {
    return this.getAttribute(name) !== null;
  }

  removeAttribute(name) {
    this._attrs.delete(String(name));
  }

  addEventListener(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(fn);
  }

  removeEventListener(type, fn) {
    const list = this._listeners.get(type) ?? [];
    this._listeners.set(type, list.filter((item) => item !== fn));
  }

  dispatch(type, detail = {}) {
    const list = this._listeners.get(type) ?? [];
    const event = {
      type,
      target: detail.target ?? this,
      pointerId: 1,
      button: 0,
      pointerType: "mouse",
      clientX: 0,
      clientY: 0,
      preventDefault() {},
      stopPropagation() {},
      ...detail,
    };
    for (const fn of list.slice()) fn(event);
    return list.length;
  }

  focus() {}

  closest(selector) {
    let node = this;
    while (node) {
      if (node.matches?.(selector)) return node;
      node = node.parentElement;
    }
    return null;
  }

  matches(selector) {
    return matchSelector(this, selector.trim());
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    return queryAll(this, selector);
  }

  getElementById(id) {
    return this.querySelector(`#${id}`);
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }

  setPointerCapture() {}

  releasePointerCapture() {}

  // 2D 上下文：渲染路径只需要"不抛错"，几何断言一律走 engine 测试。
  getContext(kind) {
    if (kind !== "2d") return null;
    if (!this._ctx) this._ctx = createStubContext();
    return this._ctx;
  }
}

function createStubContext() {
  const target = { calls: 0 };
  const handler = {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      // 任何未知方法都返回一个空实现；返回自身保证 createRadialGradient()
      // 之类可以继续链式 .addColorStop()。
      return (...args) => {
        obj.calls += 1;
        if (prop === "measureText") return { width: 10 };
        if (prop === "getImageData") return { data: new Uint8ClampedArray(4) };
        return handlerProxy;
      };
    },
    set(obj, prop, value) {
      obj[prop] = value;
      return true;
    },
  };
  const handlerProxy = new Proxy(target, handler);
  return handlerProxy;
}

function matchSimple(el, selector) {
  if (el.nodeType !== 1) return false;
  const parts = selector.match(/([#.]?[\w-]+|\[[^\]]+\])/g);
  if (!parts) return false;
  for (const part of parts) {
    if (part.startsWith("#")) {
      if (el.id !== part.slice(1)) return false;
    } else if (part.startsWith(".")) {
      if (!el._classes.has(part.slice(1))) return false;
    } else if (part.startsWith("[")) {
      const body = part.slice(1, -1);
      const eq = body.indexOf("=");
      if (eq < 0) {
        if (el.getAttribute(body) === null) return false;
      } else {
        const name = body.slice(0, eq).trim();
        const value = body.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        if (el.getAttribute(name) !== value) return false;
      }
    } else if (el.tagName !== part.toLowerCase()) {
      return false;
    }
  }
  return true;
}

function matchSelector(el, selector) {
  const segments = selector.split(/\s+/).filter(Boolean);
  if (!segments.length) return false;
  if (!matchSimple(el, segments[segments.length - 1])) return false;
  let node = el.parentElement;
  for (let i = segments.length - 2; i >= 0; i -= 1) {
    let found = false;
    while (node) {
      if (matchSimple(node, segments[i])) {
        found = true;
        node = node.parentElement;
        break;
      }
      node = node.parentElement;
    }
    if (!found) return false;
  }
  return true;
}

function queryAll(root, selector) {
  const out = [];
  const walk = (node) => {
    for (const child of node.children) {
      if (child.nodeType !== 1) continue;
      if (matchSelector(child, selector)) out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}

export function parseHTML(html) {
  const root = new StubElement("#root");
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)\/?>|([^<]+)/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    if (match[0].startsWith("<!--")) continue;
    if (match[1]) {
      const tag = match[1].toLowerCase();
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].tagName === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    if (match[2]) {
      const el = new StubElement(match[2]);
      for (const attr of (match[3] ?? "").matchAll(/([:\w-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
        const name = attr[1];
        const value = attr[3] ?? attr[4] ?? attr[5] ?? "";
        el.setAttribute(name, value);
        if (name === "hidden") el.hidden = true;
        if (name === "value") el.value = value;
      }
      stack[stack.length - 1].appendChild(el);
      if (!VOID_TAGS.has(el.tagName) && !match[0].endsWith("/>")) stack.push(el);
      continue;
    }
    const text = (match[4] ?? "").trim();
    if (text) {
      const node = new StubElement("#text");
      node.nodeType = 3;
      node.textContent = text;
      stack[stack.length - 1].appendChild(node);
    }
  }
  return root;
}

export function createDocument(options = {}) {
  const root = parseHTML(options.html ?? "");
  const documentElement = queryAll(root, "html")[0] ?? new StubElement("html");
  const doc = {
    readyState: "complete",
    documentElement,
    title: "",
    hidden: false,
    body: queryAll(root, "body")[0] ?? new StubElement("body"),
    _root: root,
    _listeners: new Map(),
    createElement: (tag) => new StubElement(tag),
    getElementById: (id) => root.getElementById(id),
    querySelector: (selector) => root.querySelector(selector),
    querySelectorAll: (selector) => root.querySelectorAll(selector),
    addEventListener(type, fn) {
      if (!doc._listeners.has(type)) doc._listeners.set(type, []);
      doc._listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = doc._listeners.get(type) ?? [];
      doc._listeners.set(type, list.filter((item) => item !== fn));
    },
    dispatch(type, detail = {}) {
      const list = doc._listeners.get(type) ?? [];
      const event = { type, target: doc.body, preventDefault() {}, stopPropagation() {}, ...detail };
      for (const fn of list.slice()) fn(event);
      return list.length;
    },
    defaultView: { matchMedia: () => ({ matches: false }) },
  };
  return doc;
}

export function createWindow(doc) {
  const listeners = new Map();
  const frames = [];
  const win = {
    parent: null,
    document: doc,
    devicePixelRatio: 2,
    console,
    AudioContext: undefined,
    requestAnimationFrame(fn) {
      frames.push(fn);
      return frames.length;
    },
    cancelAnimationFrame() {},
    setTimeout(fn, ms = 0) {
      const timer = setTimeout(fn, ms);
      timer.unref?.();
      return timer;
    },
    clearTimeout(id) {
      clearTimeout(id);
    },
    matchMedia: () => ({ matches: false }),
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = listeners.get(type) ?? [];
      listeners.set(type, list.filter((item) => item !== fn));
    },
    dispatch(type, detail = {}) {
      const list = listeners.get(type) ?? [];
      const event = { type, target: win, preventDefault() {}, stopPropagation() {}, ...detail };
      for (const fn of list.slice()) fn(event);
      return list.length;
    },
    /** 手动推帧：主循环自递归 rAF，超出队列长度就停。 */
    step(count = 1) {
      let ran = 0;
      for (let i = 0; i < count; i += 1) {
        const next = frames_.shift();
        if (!next) break;
        ran += 1;
        next(globalThis.performance?.now?.() ?? Date.now());
      }
      return ran;
    },
    pendingFrames() {
      return frames_.length;
    },
  };
  win.parent = win;
  const frames_ = frames;
  return win;
}

export function installGlobals(doc, win) {
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    localStorage: globalThis.localStorage,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    performance: globalThis.performance,
  };
  globalThis.document = doc;
  globalThis.window = win;
  globalThis.requestAnimationFrame = win.requestAnimationFrame;
  globalThis.localStorage = createFakeStorage();
  if (!globalThis.performance) globalThis.performance = { now: () => Date.now() };
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  };
}

export function createFakeStorage() {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}
