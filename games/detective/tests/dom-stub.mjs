// 极简 DOM 桩：够跑本作的语义标记与事件流即可。
// 只实现 ui.mjs / main.mjs 真正用到的 API，避免把测试写成浏览器模拟器。

const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link", "source", "use"]);

function camel(name) {
  return name.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

class ClassList {
  constructor(node) {
    this.node = node;
  }

  get _set() {
    return new Set(String(this.node.className || "").split(/\s+/).filter(Boolean));
  }

  _write(set) {
    this.node.className = [...set].join(" ");
  }

  add(...names) {
    const set = this._set;
    names.forEach((name) => set.add(name));
    this._write(set);
  }

  remove(...names) {
    const set = this._set;
    names.forEach((name) => set.delete(name));
    this._write(set);
  }

  contains(name) {
    return this._set.has(name);
  }

  toggle(name, force) {
    const set = this._set;
    const has = set.has(name);
    const next = force === undefined ? !has : Boolean(force);
    if (next) set.add(name);
    else set.delete(name);
    this._write(set);
    return next;
  }
}

class StubText {
  constructor(text) {
    this.nodeType = 3;
    this.textContent = text;
    this.parentNode = null;
  }
}

export class StubElement {
  constructor(tagName) {
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.localName = String(tagName).toLowerCase();
    this.className = "";
    this.id = "";
    this.dataset = {};
    this.attributes = {};
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.hidden = false;
    this.disabled = false;
    this.tabIndex = -1;
    this.type = "";
    this.value = "";
    this.isContentEditable = false;
    this.classList = new ClassList(this);
  }

  get classListRef() {
    return this.classList;
  }

  get textContent() {
    if (!this.children.length) return this._text ?? "";
    return this.children.map((child) => child.textContent).join("");
  }

  set textContent(value) {
    this.children = [];
    this._text = String(value ?? "");
  }

  get innerHTML() {
    return this.children.map((child) => child._raw ?? child.textContent).join("");
  }

  set innerHTML(html) {
    this.children = [];
    this._text = "";
    for (const node of parseNodes(String(html))) {
      node.parentNode = this;
      this.children.push(node);
    }
  }

  appendChild(node) {
    node.parentNode = this;
    this.children.push(node);
    return node;
  }

  removeChild(node) {
    const index = this.children.indexOf(node);
    if (index >= 0) this.children.splice(index, 1);
    node.parentNode = null;
    return node;
  }

  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "hidden") this.hidden = true;
    if (name === "disabled") this.disabled = true;
    if (name === "id") this.id = String(value);
    if (name === "class") this.className = String(value);
    if (name === "aria-label" || name === "aria-pressed") this.attributes[name] = String(value);
    if (name.startsWith("data-")) this.dataset[camel(name.slice(5))] = String(value);
  }

  getAttribute(name) {
    if (name === "id") return this.id || null;
    if (name === "class") return this.className || null;
    if (name.startsWith("data-")) {
      const key = camel(name.slice(5));
      return key in this.dataset ? this.dataset[key] : null;
    }
    return name in this.attributes ? this.attributes[name] : null;
  }

  hasAttribute(name) {
    return this.getAttribute(name) !== null;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  removeEventListener(type, handler) {
    const list = this.listeners.get(type) ?? [];
    const index = list.indexOf(handler);
    if (index >= 0) list.splice(index, 1);
  }

  dispatchEvent(event) {
    const evt = {
      type: event.type,
      target: event.target ?? this,
      currentTarget: this,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {
        this._stopped = true;
      },
      key: event.key,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    let node = event.target ?? this;
    const path = [];
    while (node) {
      path.push(node);
      node = node.parentNode;
    }
    for (const current of path) {
      evt.currentTarget = current;
      for (const handler of current.listeners?.get(evt.type) ?? []) {
        handler(evt);
        if (evt._stopped) return evt;
      }
      if (evt._stopped) return evt;
    }
    return evt;
  }

  dispatch(type, extra = {}) {
    return this.dispatchEvent({ type, target: this, ...extra });
  }

  matches(selector) {
    const sel = selector.trim();
    if (!sel) return false;
    if (sel.startsWith("#")) return this.id === sel.slice(1);
    if (sel.startsWith(".")) return this.classList.contains(sel.slice(1));
    if (sel.startsWith("[")) {
      const attr = sel.slice(1, -1).split("=")[0];
      return this.getAttribute(attr) !== null;
    }
    return this.localName === sel.toLowerCase();
  }

  _walk(result = []) {
    for (const child of this.children) {
      if (child.nodeType === 1) {
        result.push(child);
        child._walk(result);
      }
    }
    return result;
  }

  querySelector(selector) {
    const parts = selector.split(",").map((part) => part.trim());
    return this._walk().find((node) => parts.some((part) => node.matches(part))) ?? null;
  }

  querySelectorAll(selector) {
    const parts = selector.split(",").map((part) => part.trim());
    return this._walk().filter((node) => parts.some((part) => node.matches(part)));
  }

  closest(selector) {
    const parts = selector.split(",").map((part) => part.trim());
    let node = this;
    while (node && node.nodeType === 1) {
      if (parts.some((part) => node.matches(part))) return node;
      node = node.parentNode;
    }
    return null;
  }

  focus() {
    this.ownerDocument?.activeElement && (this.ownerDocument.activeElement = this);
  }
}

/** 只解析本作用到的子集：元素嵌元素、自闭合、属性、文本节点。 */
export function parseNodes(html) {
  const root = [];
  const stack = [{ node: null, children: root }];
  let i = 0;
  while (i < html.length) {
    if (html[i] === "<") {
      if (html.startsWith("<!--", i)) {
        const end = html.indexOf("-->", i);
        i = end === -1 ? html.length : end + 3;
        continue;
      }
      const end = html.indexOf(">", i);
      if (end === -1) break;
      const raw = html.slice(i + 1, end).trim();
      if (raw.startsWith("/")) {
        stack.pop();
        i = end + 1;
        continue;
      }
      const selfClose = raw.endsWith("/");
      const body = selfClose ? raw.slice(0, -1) : raw;
      const tag = (body.match(/^[a-zA-Z0-9-]+/) ?? ["div"])[0];
      const node = new StubElement(tag);
      const attrPart = body.slice(tag.length);
      for (const match of attrPart.matchAll(/([a-zA-Z0-9-]+)="([^"]*)"/g)) {
        node.setAttribute(match[1], match[2]);
      }
      // 布尔属性（hidden / disabled / selected）没有等号，也要吃进去。
      for (const name of attrPart.replace(/[a-zA-Z0-9-]+="[^"]*"/g, " ").split(/\s+/)) {
        if (/^[a-zA-Z0-9-]+$/.test(name)) node.setAttribute(name, "");
      }
      const parent = stack[stack.length - 1].children;
      parent.push(node);
      if (!selfClose && !VOID_TAGS.has(tag.toLowerCase())) {
        stack.push({ node, children: node.children });
      }
      i = end + 1;
      continue;
    }
    const next = html.indexOf("<", i);
    const text = html.slice(i, next === -1 ? html.length : next);
    if (text.trim()) {
      stack[stack.length - 1].children.push(new StubText(text.trim()));
    }
    i = next === -1 ? html.length : next;
  }
  // 回填 parentNode
  const link = (nodes, parent) => {
    for (const node of nodes) {
      node.parentNode = parent;
      if (node.nodeType === 1 && node.children.length) link(node.children, node);
    }
  };
  link(root, null);
  return root;
}

export function createDocument() {
  const documentElement = new StubElement("html");
  documentElement.setAttribute("lang", "zh-CN");
  const head = new StubElement("head");
  const body = new StubElement("body");
  documentElement.appendChild(head);
  documentElement.appendChild(body);

  const doc = {
    documentElement,
    head,
    body,
    hidden: false,
    visibilityState: "visible",
    title: "",
    activeElement: null,
    _listeners: new Map(),
    createElement(tag) {
      const node = new StubElement(tag);
      node.ownerDocument = doc;
      return node;
    },
    createTextNode(text) {
      return new StubText(String(text));
    },
    getElementById(id) {
      return documentElement._walk().find((node) => node.id === id) ?? null;
    },
    querySelector(selector) {
      return documentElement.querySelector(selector);
    },
    querySelectorAll(selector) {
      return documentElement.querySelectorAll(selector);
    },
    addEventListener(type, handler) {
      if (!this._listeners.has(type)) this._listeners.set(type, []);
      this._listeners.get(type).push(handler);
    },
    removeEventListener(type, handler) {
      const list = this._listeners.get(type) ?? [];
      const index = list.indexOf(handler);
      if (index >= 0) list.splice(index, 1);
    },
    dispatchEvent(event) {
      const evt = {
        type: event.type,
        target: event.target,
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        stopPropagation() {},
        key: event.key,
      };
      for (const handler of this._listeners.get(evt.type) ?? []) handler(evt);
      return evt;
    },
  };
  documentElement.ownerDocument = doc;
  body.ownerDocument = doc;
  return doc;
}

export function createWindow() {
  const frames = [];
  const win = {
    listeners: new Map(),
    parent: null,
    _messages: [],
    addEventListener(type, handler) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(handler);
    },
    removeEventListener(type, handler) {
      const list = this.listeners.get(type) ?? [];
      const index = list.indexOf(handler);
      if (index >= 0) list.splice(index, 1);
    },
    dispatch(type, extra = {}) {
      for (const handler of this.listeners.get(type) ?? []) handler({ type, ...extra });
    },
    postMessage(message) {
      this._messages.push(message);
    },
    requestAnimationFrame(callback) {
      frames.push(callback);
      return frames.length;
    },
    /** 手动推帧：主循环是自递归 rAF，推一帧才会排队下一帧。 */
    step(times = 1) {
      let ran = 0;
      for (let i = 0; i < times; i += 1) {
        const next = frames.shift();
        if (!next) break;
        next(performance.now());
        ran += 1;
      }
      return ran;
    },
    pendingFrames() {
      return frames.length;
    },
  };
  win.parent = win;
  return win;
}

export function createStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
    _map: map,
  };
}

export function installGlobals(html) {
  const document = createDocument();
  const window = createWindow();
  const localStorage = createStorage();
  document.body.innerHTML = html ?? "";
  for (const node of document.body.children) node.parentNode = document.body;

  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    localStorage: globalThis.localStorage,
    requestAnimationFrame: globalThis.requestAnimationFrame,
  };

  globalThis.document = document;
  globalThis.window = window;
  globalThis.localStorage = localStorage;
  globalThis.requestAnimationFrame = (callback) => window.requestAnimationFrame(callback);

  return {
    document,
    window,
    localStorage,
    byId: (id) => document.getElementById(id),
    restore() {
      globalThis.document = previous.document;
      globalThis.window = previous.window;
      globalThis.localStorage = previous.localStorage;
      globalThis.requestAnimationFrame = previous.requestAnimationFrame;
    },
  };
}

export { StubText };
