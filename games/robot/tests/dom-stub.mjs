// dom-stub.mjs - minimal DOM sufficient for the robot wiring smoke test.
// Not a browser: no layout, no bubbling, no animation engine. Visibility is
// derived from the hidden attribute (never a separate field) so a toggled
// overlay cannot fake green.

const VOID = new Set(["meta", "link", "br", "img", "input", "hr", "source", "path", "circle", "ellipse", "stop", "use"]);

function parseAttrs(text) {
  const out = {};
  const re = /([a-zA-Z0-9-]+)(?:\s*=\s*"([^"]*)")?/g;
  let m;
  while ((m = re.exec(text)) !== null) out[m[1]] = m[2] === undefined ? "" : m[2];
  return out;
}

export function createDom(html) {
  const byId = new Map();
  const listeners = new Map();

  class ClassList {
    constructor(owner) { this.owner = owner; }
    list() { return (this.owner.getAttribute("class") || "").split(/\s+/).filter(Boolean); }
    contains(name) { return this.list().includes(name); }
    add(...names) {
      const set = new Set(this.list());
      names.forEach((n) => set.add(n));
      this.owner.setAttribute("class", [...set].join(" "));
    }
    remove(...names) {
      const set = new Set(this.list());
      names.forEach((n) => set.delete(n));
      this.owner.setAttribute("class", [...set].join(" "));
    }
    toggle(name, force) {
      const on = force === undefined ? !this.contains(name) : Boolean(force);
      if (on) this.add(name); else this.remove(name);
      return on;
    }
  }

  class El {
    constructor(tag, attrs = {}, namespace = null) {
      this.tagName = String(tag).toLowerCase();
      this.namespace = namespace;
      this.attrs = new Map(Object.entries(attrs));
      this.children = [];
      this.parentNode = null;
      this._text = "";
      // Inline style: real elements expose setProperty; the robot renderer
      // writes custom properties for the tile hue.
      this.style = {
        setProperty(name, value) { this[name] = value; },
        removeProperty(name) { delete this[name]; },
      };
      this.disabled = false;
      this.scrollTop = 0;
      this.listeners = new Map();
      this.classList = new ClassList(this);
      const id = this.attrs.get("id");
      if (id) byId.set(id, this);
    }
    getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; }
    hasAttribute(name) { return this.attrs.has(name); }
    setAttribute(name, value) {
      this.attrs.set(name, String(value));
      if (name === "id") byId.set(String(value), this);
    }
    removeAttribute(name) { this.attrs.delete(name); }
    get id() { return this.getAttribute("id") || ""; }
    get className() { return this.getAttribute("class") || ""; }
    set className(value) { this.setAttribute("class", value); }
    get hidden() { return this.hasAttribute("hidden"); }
    set hidden(value) {
      if (value) this.setAttribute("hidden", "");
      else this.removeAttribute("hidden");
    }
    get textContent() {
      if (this.children.length) return this.children.map((c) => c.textContent).join("");
      return this._text;
    }
    set textContent(value) {
      this._text = String(value);
      for (const child of this.children) child.parentNode = null;
      this.children = [];
    }
    get childNodes() { return this.children; }
    get scrollHeight() { return this.children.length * 20; }
    appendChild(node) {
      if (node.parentNode) node.parentNode.removeChild(node);
      node.parentNode = this;
      this.children.push(node);
      this._text = "";
      return node;
    }
    removeChild(node) {
      const i = this.children.indexOf(node);
      if (i >= 0) this.children.splice(i, 1);
      node.parentNode = null;
      return node;
    }
    replaceChildren(...nodes) {
      for (const child of this.children) child.parentNode = null;
      this.children = [];
      this._text = "";
      for (const node of nodes) this.appendChild(node);
    }
    matches(selector) {
      if (selector.startsWith("[") && selector.endsWith("]")) {
        const m = selector.slice(1, -1).match(/^([\w-]+)(?:="([^"]*)")?$/);
        if (!m) return false;
        const value = this.getAttribute(m[1]);
        return m[2] === undefined ? value !== null : value === m[2];
      }
      if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
      if (selector.startsWith("#")) return this.getAttribute("id") === selector.slice(1);
      return this.tagName === selector.toLowerCase();
    }
    descendants() {
      const out = [];
      const walk = (node) => {
        for (const child of node.children) { out.push(child); walk(child); }
      };
      walk(this);
      return out;
    }
    querySelectorAll(selector) { return this.descendants().filter((n) => n.matches(selector)); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    closest(selector) {
      let node = this;
      while (node) {
        if (node.matches && node.matches(selector)) return node;
        node = node.parentNode;
      }
      return null;
    }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    dispatch(type, event = {}) {
      const evt = { type, target: this, ...event };
      for (const fn of this.listeners.get(type) ?? []) fn(evt);
    }
  }

  const root = new El("#document");
  const stack = [root];
  const token = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<(\/?)([a-zA-Z0-9-]+)([^>]*)|([^<]+)/gi;
  let match;
  while ((match = token.exec(html)) !== null) {
    const chunk = match[0];
    if (chunk.startsWith("<!--") || chunk.startsWith("<!DOCTYPE")) continue;
    if (match[2]) {
      const closing = match[1] === "/";
      const tag = match[2].toLowerCase();
      const raw = match[3] || "";
      if (closing) {
        for (let i = stack.length - 1; i > 0; i -= 1) {
          if (stack[i].tagName === tag) { stack.length = i; break; }
        }
        continue;
      }
      const node = new El(tag, parseAttrs(raw.replace(/\/\s*$/, "")));
      stack[stack.length - 1].appendChild(node);
      const selfClosing = /\/\s*$/.test(raw) || VOID.has(tag);
      if (!selfClosing) stack.push(node);
    } else if (match[4] && match[4].trim()) {
      const top = stack[stack.length - 1];
      if (top !== root && !top.children.length) top._text = match[4].trim();
    }
  }

  const documentElement = new El("html", { lang: "zh-CN" });
  const doc = {
    documentElement,
    title: "",
    defaultView: {
      matchMedia: () => ({ matches: true }),
      confirm: () => true,
    },
    getElementById: (id) => byId.get(id) ?? null,
    createElement: (tag) => new El(tag),
    createElementNS: (ns, tag) => new El(tag, {}, ns),
    querySelector: (selector) => root.querySelector(selector),
    querySelectorAll: (selector) => root.querySelectorAll(selector),
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatch(type, event = {}) {
      const evt = { type, ...event };
      for (const fn of listeners.get(type) ?? []) fn(evt);
    },
  };
  return { doc, root, byId };
}
