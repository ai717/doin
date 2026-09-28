// 极简 DOM 桩 + 受控时钟：让 ui.mjs 能在 node 里被真跑一遍。
//
// 为什么必须真跑（项目铁律）：
//   · "视觉对不对"在没有浏览器的环境里天然测不到，但"DOM 与 state 是否一致""事件流是否驱动了界面"
//     完全可以测，而且这正是最容易出错的地方。
//   · 桩不冒泡、不支持后裔选择器、className 不与 classList 联动 —— 这四条任意一条不对，
//     测试就会静默变成"读常量"或假失败。所以这里全部显式实现。
//
// 已知边界（不假装支持）：无 CSS 引擎、无布局、无动画事件、getBoundingClientRect 恒返零矩形。
// 因此"几何/视觉"断言一律走 tests/layout.mjs，绝不在这里假装能量像素。

const VOID_TAGS = new Set(["meta", "link", "br", "hr", "img", "input", "source", "area", "base", "col", "embed", "param", "track", "wbr"]);

class StubElement {
  constructor(tagName) {
    this.tagName = tagName.toLowerCase();
    this.nodeType = 1;
    this.children = [];
    this.parentElement = null;
    this._attrs = new Map();
    this._classes = new Set();
    this._listeners = new Map();
    this.dataset = {};
    this.style = new Proxy({}, {
      get: (target, key) => (key === "setProperty" ? (name, value) => { target[name] = value; } : target[key]),
      set: (target, key, value) => {
        target[key] = value;
        return true;
      },
    });
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
    this.value = "";
    this.checked = false;
    this.title = "";
    this.focused = false;
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

  get firstElementChild() {
    return this.children.find((child) => child.nodeType === 1) ?? null;
  }

  get childElementCount() {
    return this.children.filter((child) => child.nodeType === 1).length;
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
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
    if (key === "id") return this.id ?? null;
    if (key.startsWith("data-")) return this.dataset[camel(key.slice(5))] ?? null;
    return this._attrs.has(key) ? this._attrs.get(key) : null;
  }

  addEventListener(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(fn);
  }

  removeEventListener(type, fn) {
    const list = this._listeners.get(type);
    if (list) this._listeners.set(type, list.filter((item) => item !== fn));
  }

  // 事件委托的监听器挂在父节点上，而桩不冒泡 —— 调用方必须显式 { target }
  dispatch(type, detail = {}) {
    const list = this._listeners.get(type) ?? [];
    const event = { type, target: detail.target ?? this, preventDefault() {}, stopPropagation() {}, ...detail };
    for (const fn of list) fn(event);
    return list.length;
  }

  focus() {
    this.focused = true;
  }

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
}

function camel(text) {
  return text.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

// ── 选择器：支持 #id / .class / tag / [attr] 与后裔组合（ui.mjs 用了 "#tier-group .seg"）──
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
  if (segments.length === 0) return false;
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

// ── 极简 HTML 解析：够用就好，只为还原 index.html 的真实节点与属性关系 ──
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
  const html = options.html ?? "";
  const root = parseHTML(html);
  const documentElement = queryAll(root, "html")[0] ?? new StubElement("html");
  const doc = {
    documentElement,
    title: "",
    body: queryAll(root, "body")[0] ?? new StubElement("body"),
    _root: root,
    _listeners: new Map(),
    createElement: (tag) => new StubElement(tag),
    getElementById: (id) => root.getElementById(id),
    querySelector: (sel) => root.querySelector(sel),
    querySelectorAll: (sel) => root.querySelectorAll(sel),
    addEventListener(type, fn) {
      if (!doc._listeners.has(type)) doc._listeners.set(type, []);
      doc._listeners.get(type).push(fn);
    },
    dispatch(type, detail = {}) {
      const list = doc._listeners.get(type) ?? [];
      const event = { type, target: doc.body, preventDefault() {}, stopPropagation() {}, ...detail };
      for (const fn of list) fn(event);
      return list.length;
    },
    defaultView: {
      matchMedia: (query) => ({
        media: query,
        matches: Boolean(options.reducedMotion) && query.includes("prefers-reduced-motion"),
      }),
    },
  };
  return doc;
}

// 受控时钟：把定时器变成可 flush 的队列，测试因此完全确定（不靠 sleep 也不靠真实时长）。
export function installClock() {
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  let seq = 0;
  let jobs = [];
  globalThis.setTimeout = (fn, ms = 0) => {
    seq += 1;
    jobs.push({ id: seq, ms: Number(ms) || 0, fn });
    return seq;
  };
  globalThis.clearTimeout = (id) => {
    jobs = jobs.filter((job) => job.id !== id);
  };
  return {
    get pending() {
      return jobs.length;
    },
    // 当前已排程的延迟列表（升序）。用来验证"波次节奏"是否存在、
    // 以及 reduced-motion 下所有递延是否真的归零。
    msList() {
      return jobs.map((job) => job.ms).sort((a, b) => a - b);
    },
    flush(limit = 400) {
      let guard = 0;
      while (jobs.length && guard < limit) {
        guard += 1;
        jobs.sort((a, b) => a.ms - b.ms || a.id - b.id);
        const job = jobs.shift();
        job.fn();
      }
      return guard;
    },
    restore() {
      globalThis.setTimeout = realSetTimeout;
      globalThis.clearTimeout = realClearTimeout;
    },
  };
}

export function installDocument(doc) {
  const previous = globalThis.document;
  globalThis.document = doc;
  return () => {
    globalThis.document = previous;
  };
}
