// markup.test.mjs —— 标记装配契约：机台红线（静态）+ 把 js/main.mjs 真的跑起来（动态）
//
// 运行前置：无构建步骤，Node >= 20；不启动浏览器、不落任何产物（只有终端 TAP）。
//   单跑：node --test games/lantern-maze/tests/markup.test.mjs
//   全套：npm run test:lantern-maze
//
// 坑位：
//   1) main.mjs 是「导入即启动」的装配层，必须在 await import() 之前把 document / window /
//      requestAnimationFrame / matchMedia / localStorage / AudioContext / navigator 全装好，
//      否则模块顶层直接 ReferenceError，看起来像「游戏打不开」。
//   2) 这里的 DOM 是把 index.html 用微型解析器读出来的真树，getElementById / querySelectorAll /
//      closest 都走这棵树。所以「JS 引用到的节点标记里必须有」不再靠正则猜：缺一个就当场炸。
//      代价是不做样式级验证 —— 布局红线仍然只能查 CSS 里的硬指标（底部安全留白、动效降级）。
//   3) 用例按顺序跑，共享同一个装配后的机台状态（点按钮 = 真改 phase/game），所以别并行、别打乱次序。
//   4) rAF 与 window.setTimeout 都是手动泵的队列：不泵就不动，跑多久由用例说了算。
//      ui.note() 用的是真 setTimeout（4.2s 自动抹掉便签），末尾会让进程多活几秒，属正常。
//   5) Node 24 的 globalThis.navigator 只有 getter，装假剪贴板必须 Object.defineProperty。

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { TEMPLATES } from "../js/levels.mjs";
import { DOT, BRUSHES } from "../js/engine.mjs";
import { encodeRows, normalizeRows } from "../js/code.mjs";
import { createUi, BRUSH_KEY } from "../js/ui.mjs";
import { createAudio } from "../js/audio.mjs";
import { drawBench } from "../js/render.mjs";
import { strings, LANG_KEY } from "../js/i18n.mjs";
import { KEY as SAVE_KEY } from "../js/storage.mjs";

const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const CSS = readFileSync(new URL("../css/style.css", import.meta.url), "utf8");
const JS_URL = new URL("../js/", import.meta.url);
const SRC = {};
for (const f of readdirSync(JS_URL).filter((n) => n.endsWith(".mjs"))) {
  SRC[f] = readFileSync(new URL(f, JS_URL), "utf8");
}
const ALL_JS = Object.values(SRC).join("\n");

/** 去注释：红线扫描不能被注释里的 "document." 误伤 */
function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "")
    .replace(/([^:'"])\/\/[^/]*$/gm, "$1");
}
const CODE = Object.fromEntries(Object.entries(SRC).map(([k, v]) => [k, strip(v)]));
const zh = strings("zh");
const en = strings("en");
const tick = () => new Promise((r) => setImmediate(r));

// ================================================================ 静态红线

test("标记：文档头契约齐全（编码 / 视口 / 主题色 / 描述 / 语言 / 机台皮肤）", () => {
  assert.match(HTML, /<meta charset="utf-8" \/>/i);
  assert.match(HTML, /name="viewport" content="[^"]*width=device-width[^"]*viewport-fit=cover/);
  assert.match(HTML, /name="theme-color" content="#[0-9a-f]{6}"/i);
  assert.match(HTML, /<title>[^<]*灯笼巷[^<]*<\/title>/);
  assert.match(HTML, /<meta\s+name="description"\s+content=".{80,}/s, "description 要写得下玩法，别一句敷衍");
  assert.match(HTML, /<html lang="zh-CN">/);
  assert.match(HTML, /<body data-theme="[a-z]+">/, "机台皮肤得挂在 body 上");
});

test("标记：本地资源全带 ?v=dev，零外链零图片音视频", () => {
  const refs = [...HTML.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const local = refs.filter((v) => !v.startsWith("data:") && v !== "/");
  assert.ok(local.length >= 2, "样式与入口脚本至少要两条");
  const bad = local.filter((v) => !/\.(mjs|js|css)\?v=dev$/.test(v));
  assert.deepEqual(bad, [], "构建脚本靠 ?v=dev 占位换 BUILD_ID，漏一条就缓存不失效");
  assert.ok(/<script type="module" src="js\/main\.mjs\?v=dev"><\/script>/.test(HTML));
  assert.match(HTML, /<link[^>]*rel="icon"[^>]*href="data:image\/svg\+xml/, "favicon 得内联，不许多一次网络请求");

  const urls = [...HTML.matchAll(/https?:\/\/[^"'\s)]+/g)].map((m) => m[0]);
  for (const u of urls) assert.equal(u, "http://www.w3.org/2000/svg", "内联 SVG 命名空间之外不许有任何外部地址");
  for (const tag of ["<img", "<video", "<audio", "<iframe", "<object"]) {
    assert.equal(HTML.toLowerCase().includes(tag), false, `${tag} 违反零外部资源`);
  }
  assert.equal(/@import/.test(CSS), false);
  assert.equal(/url\(\s*['"]?https?:/.test(CSS), false);
});

test("标记：绝对路径只有返回门户一处", () => {
  const hrefs = [...HTML.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, ["/"], "除 back-home 外不许出现站内绝对路径（生产要扁平成 /<slug>/）");
  assert.match(HTML, /<a class="tag" id="back-home" href="\/"/);
  assert.equal(/["']\/games\/|["']\/lantern-maze\//.test(HTML + ALL_JS), false);
  assert.match(HTML, /<noscript>/);
});

test("红线：无 alert 弹窗、无网络与 Worker、无硬编码统计与广告标签", () => {
  const hay = HTML + "\n" + Object.values(CODE).join("\n");
  for (const banned of ["alert(", "confirm(", "prompt(", "fetch(", "XMLHttpRequest", "sendBeacon", "new Worker", "navigator.serviceWorker"]) {
    assert.equal(hay.includes(banned), false, `出现 ${banned}`);
  }
  for (const banned of ["adsbygoogle", "googletagmanager", "G-D67E3XTNSS", "gtag(", "pagead"]) {
    assert.equal(hay.toLowerCase().includes(banned.toLowerCase()), false, `${banned} 由 build-site.mjs 注入，源文件里不能写`);
  }
  assert.equal(/\bimport\(/.test(Object.values(CODE).join("\n").replace(/\bimport \{/g, "")), false, "不许动态 import");
});

test("分层：规则与判定层保持 DOM-free，DOM 与存储各归其位", () => {
  const pure = ["engine.mjs", "game.mjs", "bench.mjs", "bot.mjs", "code.mjs", "validate.mjs", "levels.mjs", "score.mjs"];
  for (const f of pure) {
    const leaks = ["document.", "window.", "localStorage", "sessionStorage", "requestAnimationFrame", "matchMedia"].filter((k) => CODE[f].includes(k));
    assert.deepEqual(leaks, [], `${f} 混入了宿主 API：${leaks.join(", ")}`);
  }
  for (const [f, body] of Object.entries(CODE)) {
    const usesDom = /(?:^|[^A-Za-z$_.])(document|window)\s*\./.test(body);
    if (usesDom) assert.ok(["main.mjs", "ui.mjs", "render.mjs"].includes(f), `${f} 不该碰 DOM`);
    if (body.includes("localStorage") || body.includes("sessionStorage")) {
      assert.ok(["storage.mjs", "i18n.mjs"].includes(f), `${f} 只能经 storage.mjs / i18n.mjs 读写存储`);
    }
  }
  assert.equal(/document\.|window\./.test(CODE["audio.mjs"]), false, "音效层只用 globalThis.AudioContext");
  assert.equal(CODE["main.mjs"].includes("requestAnimationFrame"), true);
});

test("存储与语言：存档 key 与全站共享偏好口径唯一", () => {
  assert.equal(SAVE_KEY, "doin.lantern-maze.v1");
  assert.match(CODE["storage.mjs"], /"doin\.lantern-maze\.v1"/);
  assert.match(CODE["i18n.mjs"], new RegExp(`"${LANG_KEY}"`));
  assert.equal(LANG_KEY, "doin.lang", "语言偏好必须走全站共享 key");
  const others = [...ALL_JS.matchAll(/doin\.[a-z0-9-]+\.v\d+/gi)].map((m) => m[0]);
  assert.deepEqual([...new Set(others)], ["doin.lantern-maze.v1"], "别自造第二个存档 key");
  const langKeys = [...ALL_JS.matchAll(/doin\.[a-z]*lang[a-z._-]*/gi)].map((m) => m[0]);
  assert.deepEqual([...new Set(langKeys.map((k) => k.toLowerCase()))], ["doin.lang"], "语言偏好不许私有化");
});

test("机台排版：系统键收进门匾，四角不挂浮钮", () => {
  const eave = HTML.slice(HTML.indexOf('<header class="eave"'), HTML.indexOf("</header>"));
  assert.ok(eave.length > 100);
  for (const id of ["back-home", "btn-sound", "btn-lang", "btn-help"]) {
    assert.match(eave, new RegExp(`id="${id}"`), `${id} 必须嵌在门匾横匾里`);
    assert.equal(HTML.split(`id="${id}"`).length - 1, 1, `${id} 只能有一个`);
  }
  const outside = HTML.slice(0, HTML.indexOf('<header class="eave"')) + HTML.slice(HTML.indexOf("</header>") + 9);
  assert.equal(/class="[^"]*(fab|floating|corner-badge|overlay-btn)/.test(outside), false, "不许有贴角浮钮");
});

test("机台排版：两翼夹舞台，工坊与玩法整组换装", () => {
  const stage = HTML.slice(HTML.indexOf('<main class="stage"'), HTML.indexOf("</main>"));
  const left = stage.indexOf('class="wing wing--left"');
  const center = stage.indexOf('class="lantern"');
  const right = stage.indexOf('class="wing wing--right"');
  assert.ok(left > -1 && left < center && center < right, "必须左翼—舞台—右翼三段式");
  assert.equal([...stage.matchAll(/<aside class="wing/g)].length, 2);
  assert.equal([...stage.matchAll(/<canvas/g)].length, 2, "主舞台 + 裁铺台各一张画布");
  assert.match(HTML, /<canvas\s+id="board"\s+width="\d+"\s+height="\d+"/s);
  const dirs = [...HTML.matchAll(/data-dir="([a-z]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(dirs, ["down", "left", "right", "up"], "竹笛摇杆四向齐备，不靠手势单腿走路");
  const groups = [...HTML.matchAll(/data-group="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(groups)].sort(), ["play", "work"]);
  assert.ok(groups.filter((g) => g === "play").length >= 4 && groups.filter((g) => g === "work").length >= 5);
});

test("样式：大屏广告避让、移动端底部安全留白与动效降级都在", () => {
  assert.match(CSS, /width: min\(11[0-9]{2}px, 100%\)/, "舞台居中限宽，给两侧广告留出空白");
  assert.match(CSS, /--pad-bottom: max\((\d{2,3})px/, "移动端底部安全留白");
  const pad = Number(CSS.match(/--pad-bottom: max\((\d{2,3})px/)[1]);
  assert.ok(pad >= 68, `底部留白 ${pad}px 太窄，会压住底部横幅广告`);
  assert.match(CSS, /@media \(max-width: 768px\)[\s\S]{0,200}body \{\s*padding: [\s\S]{0,80}var\(--pad-bottom\)/);
  assert.match(CSS, /@media \(min-width: 900px\)[\s\S]{0,220}grid-template-columns: minmax\([\s\S]{0,80}minmax\([\s\S]{0,80}minmax\(/, "≥900px 必须三列（左翼 / 舞台 / 右翼）");
  assert.match(CSS, /@media \(min-width: 900px\)[\s\S]{0,300}\.dpad \{ display: none/, "桌面藏起摇杆");
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)/);
  const fixed = [...CSS.matchAll(/position: *fixed/g)];
  assert.equal(fixed.length, 1, "只允许背景层用 fixed，按键不能贴屏浮着");
  const owner = CSS.slice(Math.max(0, fixed[0].index - 200), fixed[0].index);
  assert.match(owner, /body::after\s*\{[^{]*$/, "唯一的 fixed 应当是环境粒子层");
});

test("样式：el.hidden 换装压得住 author 的 display（幕布绝不能叠在台面上）", () => {
  assert.ok(/\.hidden\s*=/.test(ALL_JS), "装配层靠 el.hidden 换装，这条红线才有意义");
  assert.ok(
    /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/.test(CSS),
    "缺 [hidden]{display:none !important} 守卫：author 的 display 无条件压过 UA 的 [hidden]{display:none}，" +
      "六张幕布会全部叠着、DOM 里最后一张 veil-paused 永久盖住机台，点「继续」还被引擎以未暂停为由回绝"
  );
  for (const cls of ["veil", "bench"]) {
    const block = CSS.match(new RegExp(`\\.${cls}\\s*\\{[\\s\\S]*?\\}`));
    assert.ok(block && /display:/.test(block[0]), `.${cls} 已不带 display，守卫盯的目标变了，红线要跟着改`);
  }
});

test("id 闭合：ui.mjs 清单里每个节点标记都得给", () => {
  const body = SRC["ui.mjs"];
  const m = body.match(/const ids = \[([\s\S]*?)\];\s*\n\s*const el = \{\}/);
  assert.ok(m, "ui.mjs 的 ids 清单结构变了，扫描要跟着改");
  const ids = [...m[1].matchAll(/"([a-z0-9-]+)"/g)].map((x) => x[1]);
  assert.ok(ids.length >= 60, `清单只剩 ${ids.length} 条？`);
  const missing = ids.filter((id) => !HTML.includes(`id="${id}"`));
  assert.deepEqual(missing, []);
  const all = [...HTML.matchAll(/ id="([a-z0-9-]+)"/g)].map((x) => x[1]);
  assert.equal(new Set(all).size, all.length, "id 不许重复");
  assert.ok(all.includes("btn-leave-bench"), "扎巷坊必须有回灯棚的出口键");
});

test("接线：引擎每种事件都有归属，映射表里不留死键", () => {
  const emitted = new Set([...SRC["engine.mjs"].matchAll(/emit\(state, "([a-zA-Z]+)"/g)].map((m) => m[1]));
  const audioMap = {};
  const block = SRC["main.mjs"].match(/const AUDIO_FX = \{([\s\S]*?)\};/);
  assert.ok(block, "AUDIO_FX 表结构变了");
  for (const m of block[1].matchAll(/(\w+):\s*"(\w+)"/g)) audioMap[m[1]] = m[2];
  const renderSet = new Set(
    [...SRC["main.mjs"].match(/const RENDER_FX = new Set\(\[([\s\S]*?)\]\);/)[1].matchAll(/"([a-zA-Z]+)"/g)].map((m) => m[1])
  );
  // 纯信息事件（计分流水、开局提示、影魅风声、流明灯谢幕）不配音效也不配粒子，是有意为之
  const silent = new Set(["score", "go", "dartWind", "fruitOut"]);
  const unhandled = [...emitted].filter((t) => !(t in audioMap) && !renderSet.has(t) && t !== "eatGhost" && !silent.has(t));
  assert.deepEqual(unhandled, [], "新事件忘了接反馈，玩家会觉得这一下没反应");
  const stale = [...Object.keys(audioMap), ...renderSet].filter((t) => !emitted.has(t) && t !== "eatGhost");
  assert.deepEqual(stale, [], "映射表里有条目对应的引擎事件根本不存在（写了却永不触发）");
  assert.ok(emitted.has("pearl"), "吞日曜珠必须派发 pearl 事件，否则锣声与冲击波是死代码");

  const a = createAudio({ muted: true });
  const needed = [...Object.values(audioMap), "eatGhost", "click", "deny", "brush", "curtain", "unlock", "setMuted", "resetDotScale", "won"];
  for (const k of needed) assert.equal(typeof a[k], "function", `audio.${k}() 不存在`);
});

test("i18n：标记与代码引用的键在两套表里都翻成了人话", () => {
  const keys = new Set([...HTML.matchAll(/data-i18n(?:-title|-aria)?="([a-zA-Z0-9]+)"/g)].map((m) => m[1]));
  for (const k of [...SRC["ui.mjs"].matchAll(/\btr\("([a-zA-Z0-9]+)"/g)].map((m) => m[1])) keys.add(k);
  for (const k of [...SRC["main.mjs"].matchAll(/\btr\("([a-zA-Z0-9]+)"/g)].map((m) => m[1])) keys.add(k);
  assert.ok(keys.size >= 60);
  for (const k of keys) {
    assert.equal(typeof zh[k], "string", `zh 缺键 ${k}`);
    assert.equal(typeof en[k], "string", `en 缺键 ${k}`);
    assert.ok(zh[k].length > 0 && en[k].length > 0, `${k} 值为空`);
  }
  assert.equal(en.btnBackBench === undefined, false, "工坊结算的两条去向要各有文案");
});

// ================================================================ 微型 DOM

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const CAMEL = (s) => s.replace(/-([a-z])/g, (mm, c) => c.toUpperCase());

class TextNode {
  constructor(value) {
    this.isText = true;
    this.value = String(value);
    this.parentNode = null;
  }
  get textContent() {
    return this.value;
  }
  set textContent(v) {
    this.value = String(v);
  }
}

function styleDecl() {
  return {
    _p: new Map(),
    setProperty(k, v) {
      this._p.set(k, String(v));
    },
    removeProperty(k) {
      this._p.delete(k);
    },
    getPropertyValue(k) {
      return this._p.get(k) ?? "";
    },
  };
}

function makeCtx() {
  const calls = { fill: 0, stroke: 0, text: 0, gradient: 0, image: 0 };
  const grad = { addColorStop() {} };
  const ctx = {
    canvas: null,
    calls,
    createLinearGradient: () => {
      calls.gradient += 1;
      return grad;
    },
    createRadialGradient: () => {
      calls.gradient += 1;
      return grad;
    },
    drawImage() {
      calls.image += 1;
    },
    measureText: () => ({ width: 10 }),
    fillText() {
      calls.text += 1;
    },
    strokeText() {
      calls.text += 1;
    },
    fill() {
      calls.fill += 1;
    },
    fillRect() {
      calls.fill += 1;
    },
    stroke() {
      calls.stroke += 1;
    },
    strokeRect() {
      calls.stroke += 1;
    },
  };
  for (const m of [
    "beginPath", "closePath", "moveTo", "lineTo", "arc", "arcTo", "ellipse", "rect", "roundRect",
    "quadraticCurveTo", "bezierCurveTo", "clip", "clearRect", "save", "restore", "translate", "rotate", "scale", "setTransform", "resetTransform", "setLineDash",
  ]) ctx[m] = () => {};
  return ctx;
}

class FakeNode {
  constructor(tag, doc) {
    this.tagName = String(tag).toUpperCase();
    this.ownerDoc = doc;
    this.nodes = [];
    this.parentNode = null;
    this.dataset = {};
    this.attrs = new Map();
    this.style = styleDecl();
    this._classes = new Set();
    this.handlers = new Map();
    this.hidden = false;
    this.disabled = false;
    this.value = "";
    this.offsetWidth = 0;
    this._text = "";
    this._cssW = 0;
    this._cssH = 0;
    if (this.tagName === "CANVAS") this._attachCanvas();
  }

  _attachCanvas() {
    const ctx = makeCtx();
    ctx.canvas = this;
    this._ctx = ctx;
    this.width = 300;
    this.height = 150;
    this._cssW = 300;
    this._cssH = 150;
  }

  getContext() {
    return this._ctx ?? null;
  }

  get clientWidth() {
    return this._cssW || this.offsetWidth || 0;
  }

  get clientHeight() {
    return this._cssH || 0;
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, x: 0, y: 0, width: this.clientWidth, height: this.clientHeight, right: this.clientWidth, bottom: this.clientHeight };
  }

  setPointerCapture() {}
  releasePointerCapture() {}
  focus() {}

  get children() {
    return this.nodes.filter((n) => !n.isText);
  }

  get childElementCount() {
    return this.children.length;
  }

  get textContent() {
    return this.nodes.length ? this.nodes.map((n) => n.textContent).join("") : this._text;
  }

  set textContent(v) {
    for (const n of this.nodes) n.parentNode = null;
    this.nodes = [];
    this._text = v === null || v === undefined ? "" : String(v);
  }

  get id() {
    return this.attrs.get("id") ?? "";
  }

  set id(v) {
    this.attrs.set("id", String(v));
    this.ownerDoc?.ids.set(String(v), this);
  }

  get className() {
    return [...this._classes].join(" ");
  }

  get lang() {
    return this.attrs.get("lang") ?? "";
  }

  set lang(v) {
    this.attrs.set("lang", String(v));
  }

  set className(v) {
    this._classes = new Set(String(v ?? "").split(/\s+/).filter(Boolean));
  }

  get classList() {
    const self = this;
    return {
      add: (c) => self._classes.add(c),
      remove: (c) => self._classes.delete(c),
      contains: (c) => self._classes.has(c),
      toggle: (c, force) => {
        const on = force === undefined ? !self._classes.has(c) : Boolean(force);
        if (on) self._classes.add(c);
        else self._classes.delete(c);
        return on;
      },
    };
  }

  setAttribute(k, v) {
    const key = String(k);
    this.attrs.set(key, String(v));
    if (key === "id") this.id = v;
    else if (key === "class") this.className = v;
    else if (key.startsWith("data-")) this.dataset[CAMEL(key.slice(5))] = String(v);
    else if (key === "hidden") this.hidden = true;
    else if (key === "disabled") this.disabled = true;
    else if (key === "width" || key === "height") {
      this[key] = Number(v) || 0;
      if (this.tagName === "CANVAS") {
        if (key === "width") this._cssW = Number(v) || 0;
        else this._cssH = Number(v) || 0;
      }
    }
  }

  getAttribute(k) {
    return this.attrs.has(k) ? this.attrs.get(k) : null;
  }

  hasAttribute(k) {
    return this.attrs.has(k);
  }

  removeAttribute(k) {
    this.attrs.delete(k);
  }

  append(...ns) {
    for (const n of ns) {
      if (n?.parentNode) n.parentNode.nodes.splice(n.parentNode.nodes.indexOf(n), 1);
      n.parentNode = this;
      this.nodes.push(n);
    }
  }

  appendChild(n) {
    this.append(n);
    return n;
  }

  replaceChildren(...ns) {
    for (const n of this.nodes) n.parentNode = null;
    this.nodes = [];
    this._text = "";
    this.append(...ns);
  }

  addEventListener(type, fn, opts) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push({ fn, once: Boolean(opts?.once) });
  }

  removeEventListener(type, fn) {
    const list = this.handlers.get(type);
    if (!list) return;
    const i = list.findIndex((h) => h.fn === fn);
    if (i >= 0) list.splice(i, 1);
  }

  dispatch(type, init = {}) {
    return dispatchEvent(this, type, init);
  }

  click(init = {}) {
    return dispatchEvent(this, "click", init);
  }

  matches(sel) {
    return matchesChain(this, parseSelector(sel)[0]);
  }

  querySelectorAll(sel) {
    return queryAll(this, sel);
  }

  querySelector(sel) {
    return queryAll(this, sel)[0] ?? null;
  }

  closest(sel) {
    const chains = parseSelector(sel);
    for (let cur = this; cur; cur = cur.parentNode) {
      if (chains.some((c) => matchesChain(cur, c))) return cur;
    }
    return null;
  }
}

function parseCompound(part) {
  const out = { tag: null, id: null, cls: [], attrs: [] };
  const re = /([#.]?)([A-Za-z0-9_-]+)|\[([A-Za-z0-9-]+)(?:=(?:"([^"]*)"|([^\]]*)))?\]/g;
  let m;
  while ((m = re.exec(part))) {
    if (m[3] !== undefined) out.attrs.push([m[3], m[4] ?? m[5] ?? null]);
    else if (m[1] === "#") out.id = m[2];
    else if (m[1] === ".") out.cls.push(m[2]);
    else out.tag = m[2].toUpperCase();
  }
  return out;
}

/** 只支持本项目用到的那几种：逗号分组 + 后代 + tag/#id/.class/[attr] */
function parseSelector(sel) {
  return String(sel)
    .split(",")
    .map((s) => s.trim().split(/\s+/).filter(Boolean).map(parseCompound))
    .filter((c) => c.length);
}

function matchesCompound(el, c) {
  if (!el || el.isText) return false;
  if (c.tag && el.tagName !== c.tag) return false;
  if (c.id && el.id !== c.id) return false;
  for (const k of c.cls) if (!el._classes.has(k)) return false;
  for (const [k, v] of c.attrs) {
    if (v === null) {
      if (!el.attrs.has(k)) return false;
    } else if (el.getAttribute(k) !== v) return false;
  }
  return true;
}

function matchesChain(el, chain) {
  if (!matchesCompound(el, chain[chain.length - 1])) return false;
  let i = chain.length - 2;
  let node = el.parentNode;
  while (i >= 0) {
    let hit = false;
    while (node) {
      if (matchesCompound(node, chain[i])) {
        node = node.parentNode;
        hit = true;
        break;
      }
      node = node.parentNode;
    }
    if (!hit) return false;
    i -= 1;
  }
  return true;
}

function* descendants(el) {
  for (const n of el.nodes) {
    if (n.isText) continue;
    yield n;
    yield* descendants(n);
  }
}

function queryAll(root, selector) {
  const chains = parseSelector(selector);
  const out = [];
  for (const node of descendants(root)) {
    if (chains.some((c) => matchesChain(node, c))) out.push(node);
  }
  return out;
}

function dispatchEvent(target, type, init = {}) {
  const ev = {
    type,
    target,
    currentTarget: target,
    defaultPrevented: false,
    _stopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this._stopped = true;
    },
    ...init,
  };
  for (let cur = target; cur; cur = cur.parentNode) {
    ev.currentTarget = cur;
    const inline = cur[`on${type}`];
    if (typeof inline === "function") inline.call(cur, ev);
    const list = cur.handlers?.get(type);
    if (list) {
      for (const h of [...list]) {
        h.fn.call(cur, ev);
        if (h.once) list.splice(list.indexOf(h), 1);
      }
    }
    if (ev._stop) break;
  }
  return ev;
}

const TAG_RE = /<(\/?)([A-Za-z][A-Za-z0-9-]*)((?:"[^"]*"|'[^']'|[^>"'])*?)(\/?)>|([^<]+)/g;

function buildDocument(src) {
  const ids = new Map();
  const docElHandlers = new Map();
  const clean = src.replace(/<!--[\s\S]*?-->/g, "").replace(/<!doctype[^>]*>/i, "");
  const root = new FakeNode("fragment", { ids });
  const doc = {
    ids,
    hidden: false,
    activeElement: new FakeNode("body", { ids }),
    documentElement: null,
    createElement: (tag) => new FakeNode(tag, { ids }),
    getElementById: (id) => ids.get(String(id)) ?? null,
    addEventListener: (type, fn, opts) => {
      if (!docElHandlers.has(type)) docElHandlers.set(type, []);
      docElHandlers.get(type).push({ fn, once: Boolean(opts?.once) });
    },
    removeEventListener: (type, fn) => {
      const list = docElHandlers.get(type);
      if (list) {
        const i = list.findIndex((h) => h.fn === fn);
        if (i >= 0) list.splice(i, 1);
      }
    },
    dispatchDoc: (type, init = {}) => {
      const ev = { type, target: null, preventDefault() {}, ...init };
      const list = docElHandlers.get(type) ?? [];
      for (const h of [...list]) {
        h.fn(ev);
        if (h.once) list.splice(list.indexOf(h), 1);
      }
      return ev;
    },
    querySelectorAll: (sel) => queryAll(root, sel),
    querySelector: (sel) => queryAll(root, sel)[0] ?? null,
    appendChild(node) {
      root.append(node);
      if (node.tagName === "HTML") doc.documentElement = node;
      return node;
    },
  };

  const stack = [root];
  const attrRe = /([A-Za-z_:][-A-Za-z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = TAG_RE.exec(clean))) {
    const [, slash, name, attrText, selfClose, textChunk] = m;
    const top = stack[stack.length - 1];
    if (textChunk !== undefined) {
      if (/\S/.test(textChunk)) top.append(new TextNode(textChunk.replace(/\s+/g, " ")));
      continue;
    }
    const lower = name.toLowerCase();
    if (slash) {
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].tagName === lower.toUpperCase()) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    const el = new FakeNode(lower, { ids });
    for (const a of attrText.matchAll(attrRe)) {
      el.setAttribute(a[1], a[2] ?? a[3] ?? a[4] ?? "");
    }
    if (el.tagName === "CANVAS") {
      el._cssW = Number(el.getAttribute("width")) || 300;
      el._cssH = Number(el.getAttribute("height")) || 150;
    }
    top.append(el);
    if (lower === "html") doc.documentElement = el;
    if (!selfClose && !VOID_TAGS.has(lower)) stack.push(el);
  }
  attrRe.lastIndex = 0;
  if (!doc.documentElement) doc.documentElement = root;
  return doc;
}

// ================================================================ 宿主环境与装配启动

const document = buildDocument(HTML);
const rafQueue = [];
const timerQueue = [];
const winHandlers = new Map();
const audioCalls = { ctx: 0, osc: 0, noise: 0, resume: 0 };
const clipboard = { written: [], writeText: async (t) => void clipboard.written.push(t) };

class FakeAudioCtx {
  constructor() {
    audioCalls.ctx += 1;
    this.currentTime = 0;
    this.sampleRate = 48000;
    this.state = "suspended";
    this.destination = { connect() {} };
  }
  createGain() {
    return { gain: fakeParam(), connect() {}, disconnect() {} };
  }
  createOscillator() {
    audioCalls.osc += 1;
    return { type: "", frequency: fakeParam(), connect() {}, start() {}, stop() {} };
  }
  createBufferSource() {
    audioCalls.noise += 1;
    return { buffer: null, loop: false, connect() {}, start() {}, stop() {} };
  }
  createBuffer(_ch, len) {
    return { getChannelData: () => new Float32Array(len) };
  }
  createBiquadFilter() {
    return { type: "", frequency: fakeParam(), Q: fakeParam(), connect() {} };
  }
  resume() {
    audioCalls.resume += 1;
    this.state = "running";
  }
}

function fakeParam() {
  return { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} };
}

const lsStore = new Map();
const ls = {
  getItem: (k) => (lsStore.has(String(k)) ? lsStore.get(String(k)) : null),
  setItem: (k, v) => void lsStore.set(String(k), String(v)),
  removeItem: (k) => void lsStore.delete(String(k)),
  clear: () => lsStore.clear(),
};

const prevGlobals = {};
function install(key, value) {
  prevGlobals[key] = { present: key in globalThis, value: globalThis[key] };
  Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
}
function restoreGlobals() {
  for (const [k, info] of Object.entries(prevGlobals)) {
    if (info.present) Object.defineProperty(globalThis, k, { value: info.value, writable: true, configurable: true });
    else delete globalThis[k];
  }
}

install("document", document);
install("window", {
  devicePixelRatio: 2,
  innerWidth: 1440,
  innerHeight: 900,
  addEventListener: (type, fn) => {
    if (!winHandlers.has(type)) winHandlers.set(type, []);
    winHandlers.get(type).push(fn);
  },
  removeEventListener: (type, fn) => {
    const list = winHandlers.get(type);
    if (list) list.splice(list.indexOf(fn), 1);
  },
  setTimeout: (fn) => timerQueue.push(fn) - 1,
  clearTimeout: () => {},
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
});
install("localStorage", ls);
install("matchMedia", () => ({ matches: false, addEventListener() {}, addListener() {} }));
install("requestAnimationFrame", (cb) => rafQueue.push(cb) - 1);
install("cancelAnimationFrame", () => {});
install("AudioContext", FakeAudioCtx);
install("navigator", { clipboard, language: "zh-CN", languages: ["zh-CN", "en"] });

let bootError = null;
try {
  await import("../js/main.mjs");
} catch (e) {
  bootError = e;
}

const $ = (id) => {
  const node = document.getElementById(id);
  assert.ok(node, `机台上找不到 id="${id}"`);
  return node;
};
const text = (id) => String($(`${id}`).textContent ?? "").replace(/\s+/g, " ").trim();
const shown = (id) => $(id).hidden === false;
const hidden = (id) => $(id).hidden === true;

let frameTs = 0;
function pump(frames = 1, step = 250) {
  let ran = 0;
  for (let i = 0; i < frames; i += 1) {
    const batch = rafQueue.splice(0, rafQueue.length);
    if (!batch.length) break;
    frameTs += step;
    for (const cb of batch) cb(frameTs);
    ran += 1;
    const timers = timerQueue.splice(0, timerQueue.length);
    for (const fn of timers) fn();
  }
  return ran;
}
function pumpUntil(pred, frames = 5000, step = 250) {
  for (let i = 0; i < frames; i += 1) {
    if (pred()) return i;
    if (pump(1, step) === 0) break;
  }
  return pred() ? frames : -1;
}
function pressKey(key, target = $("board")) {
  const ev = { key, target, type: "keydown", metaKey: false, ctrlKey: false, altKey: false, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
  for (const fn of winHandlers.get("keydown") ?? []) fn(ev);
  return ev;
}
function pointer(id, type, x, y) {
  return $(id).dispatch(type, { clientX: x, clientY: y, pointerId: 1 });
}

test("装配启动：main.mjs 在假机台上跑通，待机幕布与首屏 HUD 都是真数字", () => {
  assert.equal(bootError, null, `装配层启动失败：${bootError?.stack ?? bootError}`);
  pump(4);
  assert.equal(document.documentElement.getAttribute("lang"), "zh-CN");
  assert.ok(shown("veil-ready"));
  for (const v of ["veil-modes", "veil-levels", "veil-result", "veil-help", "veil-paused"]) assert.ok(hidden(v), `${v} 开局不该掀开`);
  assert.match(text("clock-main"), /^\d+:\d\d$/);
  assert.equal(text("score-main"), "000000");
  assert.match(text("wick-note"), /^26 \/ 100$/);
  assert.match(text("dust-note"), /^\d+ \/ \d+$/);
  assert.match(text("tally-total"), /90/);
  assert.equal(text("btn-start"), zh.btnStart);
  assert.equal(text("sound-text"), zh.soundOn);
  assert.ok(text("eave-now").includes(zh.modeCampaign), "门匾情境字要说清现在在玩什么");
  assert.ok($("board").width > 500, "渲染层应当按 dpr 把画布放大过");
  assert.ok($("board").getContext().calls.image > 0, "纸巷屏风要真的合成进画布");
  assert.ok($("ghost-deck").children.length >= 1, "待机也该亮起影魅名册");
  for (const card of $("ghost-deck").children) {
    assert.ok(card.dataset.st, "影魅牌要带状态键");
    assert.equal(card.children.length, 3, "影魅牌 = 脸 + 名 + 状态");
    assert.ok(card.children[1].textContent.length > 0);
  }
  assert.ok($("lamp-row").children.length >= 3);
  assert.ok(["◐", "◑"].includes(text("day-face")));
  assert.ok($("stick-rack").children.every((s) => s.dataset.k), "更签架子得带判定键");
  assert.deepEqual(
    [...document.querySelectorAll("[data-group]")].map((g) => [g.dataset.group, g.hidden]),
    [...document.querySelectorAll("[data-group]")].map((g) => [g.dataset.group, g.dataset.group !== "play"]),
    "待机时玩法组露、工坊组藏"
  );
});

test("装配启动：ui 缓存的节点一个都不缺", () => {
  const probe = createUi(document);
  const missing = Object.entries(probe.el).filter(([, node]) => !node).map(([k]) => k);
  assert.deepEqual(missing, []);
  assert.ok(Object.keys(probe.el).length >= 60);
  assert.equal(typeof probe.mmss(65000), "string");
});

test("灯棚：选择玩法面板解锁状态如实反映进度", () => {
  $("btn-modes").click();
  assert.ok(shown("veil-modes") && hidden("veil-ready"));
  const cards = $("mode-rack").children;
  assert.deepEqual(cards.map((c) => c.dataset.mode), ["campaign", "timed", "survival", "workshop"]);
  assert.equal(cards[0].disabled, false);
  assert.equal(cards[1].disabled, true, "前三更没走透不该放出破晓冲刺");
  assert.equal(cards[2].disabled, true, "五更没走透不该放出百鬼夜巷");
  assert.equal(cards[3].disabled, false);
  assert.ok(text("mode-rack").includes(zh.modeWorkshop));
  assert.ok(cards[1].children.some((c) => c._classes.has("mode-lock")), "锁住的牌得说清解锁条件");
});

test("扎巷坊：进裁铺台即整组换装，五道验收与巷码同步亮出", () => {
  $("mode-rack").children[3].click();
  assert.ok(shown("bench") && hidden("shell"), "纸巷与裁铺台只能同时出现一张");
  assert.ok(hidden("veil-modes"));
  assert.equal($("brush-rack").children.length, BRUSHES.length);
  assert.deepEqual([...$("sheet-rack").children].map((c) => c.dataset.sheet), ["tpl-ring", "tpl-lanes", "tpl-square", "blank"]);
  const expected = encodeRows(normalizeRows(TEMPLATES["tpl-ring"]));
  assert.equal(text("lane-code"), expected);
  const checks = $("check-list").children;
  assert.equal(checks.length, 5);
  for (let i = 0; i < 4; i += 1) assert.match(checks[i].className, /pass/, `第 ${i + 1} 道验收该过：手作模板`);
  assert.equal($("btn-undo").disabled, true);
  assert.equal($("btn-redo").disabled, true);
  assert.ok($("btn-grid").classList.contains("on"));
  assert.ok($("btn-mirror").classList.contains("on"));
  assert.ok(text("lane-name") === "");
  assert.equal(text("console-hint"), zh.handHint, "灯棚台面提示语该是走巷口诀");
  const workHint = document.querySelectorAll('[data-group="work"] .console-hint')[0];
  assert.ok(workHint, "工坊台面必须有自己的说明书");
  assert.equal(String(workHint.textContent).trim(), zh.workshopDesc);
});

test("扎巷坊：落笔—撤回—重做—镜像—网格—清空—换纸样，全链路可逆", () => {
  const rows = normalizeRows(TEMPLATES["tpl-ring"]);
  const box = drawBench($("bench-canvas"), { rows, grid: true, locale: "zh" });
  assert.ok(box.ts >= 8);
  let target = null;
  for (let y = 1; y < box.height - 1 && !target; y += 1) {
    for (let x = 1; x < Math.floor(box.width / 2); x += 1) {
      if (rows[y][x] === DOT) {
        target = { x, y };
        break;
      }
    }
  }
  assert.ok(target, "起手纸样里总该有光尘可涂");
  const at = (t) => [box.ox + (t.x + 0.5) * box.ts, box.oy + (t.y + 0.5) * box.ts];
  const before = text("lane-code");

  $("brush-rack").children.find((c) => c.dataset.brush === "wall").click();
  assert.ok($("brush-rack").children.some((c) => c.dataset.brush === "wall" && c.classList.contains("on")));
  const [px, py] = at(target);
  pointer("bench-canvas", "pointerdown", px, py);
  pointer("bench-canvas", "pointermove", px + box.ts, py);
  pointer("bench-canvas", "pointerup", px + box.ts, py);
  const painted = text("lane-code");
  assert.notEqual(painted, before, "涂了一格墙，巷码必须跟着变");
  assert.equal($("btn-undo").disabled, false);

  $("btn-undo").click();
  assert.equal(text("lane-code"), before, "撤回要回到落笔前");
  assert.equal($("btn-undo").disabled, true);
  $("btn-redo").click();
  assert.equal(text("lane-code"), painted);

  $("btn-mirror").click();
  assert.equal(text("lane-code"), painted, "对称纸样镜像后纹丝不动（一笔涂了两面）");
  $("btn-undo").click();
  assert.equal(text("lane-code"), before, "空镜像不该占历史：一撤就该回到落笔前");
  $("btn-redo").click();
  assert.equal(text("lane-code"), painted, "重做要能回到镜像后的那一档");

  $("btn-grid").click();
  assert.equal($("btn-grid").classList.contains("on"), false);
  $("btn-grid").click();
  assert.equal($("btn-grid").classList.contains("on"), true);

  $("btn-clear-sheet").click();
  assert.notEqual(text("lane-code"), painted);
  assert.match($("check-list").children[0].className, /fail/, "白纸没有巷口，第一道验收该红");
  assert.equal($("btn-undo").disabled, false, "清空纸样也得撤得回来");

  $("sheet-rack").children[1].click();
  assert.equal(text("lane-code"), encodeRows(normalizeRows(TEMPLATES["tpl-lanes"])));
  for (let i = 0; i < 4; i += 1) assert.match($("check-list").children[i].className, /pass/);
});

test("扎巷坊：巷码可复制可粘贴，坏码静默拒绝不白屏", async () => {
  const current = text("lane-code");
  $("btn-copy-code").click();
  await tick();
  assert.deepEqual(clipboard.written, [current]);
  assert.equal(text("bench-note"), zh.codeCopied);

  $("code-input").value = "LM1-zzz-not-a-lane";
  $("btn-load-code").click();
  assert.equal(text("lane-code"), current, "坏码不该动纸样");
  assert.equal(text("bench-note"), zh.codeBad);

  const square = encodeRows(normalizeRows(TEMPLATES["tpl-square"]));
  $("code-input").value = square;
  $("code-input").dispatch("keydown", { key: "Enter" });
  assert.equal(text("lane-code"), square);
  assert.equal(text("bench-note"), zh.codeLoaded);

  $("lane-name").value = "手作巷";
  $("lane-name").dispatch("input");
  assert.equal(text("lane-code"), square, "题名不该改巷码");
  assert.equal($("lane-name").value, "手作巷");
});

test("扎巷坊：影子试跑真跑整局，通过后保存入巷并可删", () => {
  $("btn-rehearse").click();
  assert.equal($("btn-rehearse").disabled, true);
  pump(2);
  assert.equal($("btn-rehearse").disabled, false);
  const fifth = $("check-list").children[4];
  assert.match(fifth.className, /pass|warn/, `试跑报告：${fifth.textContent}`);
  assert.match(fifth.textContent, /\d+%/, "第五道验收要写出吞尘率");
  assert.ok(text("bench-note").length > 0);

  $("btn-save-lane").click();
  const lanes = $("lane-list").children;
  assert.equal(lanes.length, 1);
  assert.ok(lanes[0].textContent.includes("手作巷"));
  const saved = JSON.parse(ls.getItem(SAVE_KEY));
  assert.equal(saved.lanes.length, 1);
  assert.equal(saved.lanes[0].name, "手作巷");
  assert.equal(saved.lanes[0].code, text("lane-code"));
  assert.deepEqual(Object.keys(saved.levels), [], "试跑与保存手作巷不该动主线更签");
  assert.equal(saved.records.highScore, 0, "工坊成绩不记进全局最佳");
});

test("自定义巷：进巷子真跑一局，滑动手势与摇杆都能转向", () => {
  $("btn-play-lane").click();
  assert.ok(shown("shell") && hidden("bench"), "跑自定义巷时纸巷要回到舞台中央");
  assert.ok(hidden("veil-ready") && hidden("veil-result"));
  assert.equal(text("eave-now"), zh.modeWorkshop);
  assert.equal(text("clock-main"), "0:00");

  $("dpad").querySelector('[data-dir="up"]').click();
  pointer("board", "pointerdown", 120, 120);
  pointer("board", "pointerup", 122, 121);
  pointer("board", "pointerdown", 120, 120);
  pointer("board", "pointerup", 120, 190);
  pointer("board", "pointercancel", 120, 190);
  pressKey("ArrowLeft");
  pressKey("d");
  pressKey(" ", $("btn-dash"));
  pump(200);
  assert.notEqual(text("clock-main"), "0:00");
  assert.match(text("score-main"), /^\d{6}$/);
  assert.ok(Number($("day-ring").style.getPropertyValue("--pct")) >= 0);
  assert.ok(text("dash-sub").length > 0);
  assert.equal(typeof $("btn-dash").disabled, "boolean");
});

test("自定义巷：跑不完也一定有出路，结算给三条去向", () => {
  const reached = pumpUntil(() => shown("veil-result"), 6000);
  assert.ok(reached >= 0, "灯芯烧尽或影魅收网，总该在 6000 帧内结算");
  assert.ok(text("result-title").length > 0);
  assert.ok($("result-stats").children.length >= 6);
  assert.deepEqual([...$("result-sticks").children].map((s) => s.dataset.k), ["clear", "noDeath", "fast"]);
  const acts = $("result-actions").children;
  assert.deepEqual(acts.map((a) => a.textContent), [zh.btnRetry, zh.btnBackBench, zh.btnBackStage]);
  const saved = JSON.parse(ls.getItem(SAVE_KEY));
  assert.ok(saved.lanes[0].best.score >= 0);
  assert.ok(saved.lanes[0].best.timeMs > 0, "跑过的成绩要记进擂台簿");

  acts[1].click();
  assert.ok(shown("bench") && hidden("shell"), "回扎巷坊要换回裁铺台");
  assert.equal($("lane-list").children.length, 1);
  $("lane-list").children[0].children[3].click();
  assert.equal(text("lane-list"), zh.arenaEmpty);
  assert.equal(JSON.parse(ls.getItem(SAVE_KEY)).lanes.length, 0);

  $("btn-leave-bench").click();
  assert.ok(shown("veil-ready") && shown("shell"), "工坊必须能走回灯棚（以前是死胡同）");
  assert.ok(hidden("bench"));
  assert.deepEqual([...document.querySelectorAll('[data-group="work"]')].map((g) => g.hidden), new Array(document.querySelectorAll('[data-group="work"]').length).fill(true));
});

test("一夜五更：待机可直接开局，走到结算并落盘", () => {
  $("btn-start").click();
  assert.ok(hidden("veil-ready"));
  assert.ok(text("eave-now").includes(zh.modeCampaign));
  assert.ok(text("eave-now").includes("1"), "门匾要报出第几更");
  const frames = pumpUntil(() => shown("veil-result"), 6000);
  assert.ok(frames >= 0, "站着不动迟早被影魅收网，必须能结算");
  assert.ok($("result-actions").children.length >= 2);
  assert.ok($("result-title").textContent.length > 0);
  const saved = JSON.parse(ls.getItem(SAVE_KEY));
  assert.equal(typeof saved.records.highScore, "number");
  assert.ok(saved.records.highScore >= 0);
  assert.ok(saved.levels && typeof saved.levels === "object" && Object.keys(saved.levels).length <= 30);

  $("result-actions").children[0].click();
  assert.ok(hidden("veil-result"));
  assert.equal(text("clock-main"), "0:00", "再走一遍要归零更漏");
});

test("键盘与幕布：方向、提灯、暂停、说明、重开都认实体键", () => {
  assert.ok(pumpUntil(() => text("clock-main") !== "0:00", 60) >= 0, "待机倒数走完更漏要走起来");
  pressKey("p");
  assert.ok(shown("veil-paused"));
  pump(1);
  assert.equal(text("btn-pause"), zh.btnResume);
  pressKey("Escape");
  assert.ok(shown("veil-help"), "走巷中 Esc 先掀玩法说明");
  pressKey("Escape");
  assert.ok(hidden("veil-help"));
  assert.ok(shown("veil-paused"), "关掉说明该回到帘落的暂停态");
  $("btn-veil-resume").click();
  assert.ok(hidden("veil-paused"));
  pump(1);
  assert.notEqual(text("btn-pause"), zh.btnResume);

  $("btn-help").click();
  assert.ok(shown("veil-help"));
  $("btn-close-help").click();
  assert.ok(hidden("veil-help"));
  assert.ok(shown("veil-paused"), "掀说明时局被顺手停住，关说明要落回暂停帘");
  $("btn-veil-resume").click();
  assert.ok(hidden("veil-paused"));

  const idle = text("clock-main");
  pressKey("ArrowRight", $("lane-name"));
  pressKey("s", $("code-input"));
  pressKey("p", $("lane-name"));
  assert.ok(hidden("veil-paused"), "焦点在输入框里时不该抢走按键");
  pressKey("r");
  assert.equal(text("clock-main"), "0:00", "重开归零更漏");
  assert.notEqual(idle, undefined);

  pressKey("p");
  assert.ok(hidden("veil-paused"), "待机倒数里按暂停，引擎回绝，不许假装帘落");
  assert.ok(pumpUntil(() => text("clock-main") !== "0:00", 60) >= 0);
  document.hidden = true;
  document.dispatchDoc("visibilitychange");
  pump(1);
  assert.ok(shown("veil-paused"), "切到后台要自动落帘");
  document.hidden = false;
  $("btn-veil-restart").click();
  assert.ok(hidden("veil-paused"));
  pump(30);
});

test("更次面板：五更六张一屏，未通关的更次锁着", () => {
  $("btn-open-levels").click();
  assert.ok(shown("veil-levels"));
  assert.equal($("watch-tabs").children.length, 5);
  assert.equal($("level-grid").children.length, 6);
  assert.deepEqual([...$("level-grid").children].map((c) => Number(c.dataset.level)), [1, 2, 3, 4, 5, 6]);
  assert.equal($("level-grid").children[0].disabled, false);
  $("watch-tabs").children[4].click();
  assert.deepEqual([...$("level-grid").children].map((c) => Number(c.dataset.level)), [25, 26, 27, 28, 29, 30]);
  assert.ok($("level-grid").children.every((c) => c.disabled === true), "没通到第五更之前整屏都该锁");
  assert.ok(text("watch-progress").includes("5"));
  $("watch-tabs").children[0].click();
  assert.equal($("level-grid").children[1].disabled, true, "更二还没打通，该锁着");
  $("level-grid").children[0].click();
  assert.ok(hidden("veil-levels") && shown("shell"), "点将更直接开局");
  assert.ok(text("eave-now").includes("1"));
  $("btn-modes").click();
  $("btn-close-modes").click();
  assert.ok(hidden("veil-modes") && hidden("veil-ready"), "走巷中关面板该回到纸巷");
  pump(60);
});

test("双语：切 EN 后满棚文案换字，偏好写进全站共享 key", () => {
  $("btn-lang").click();
  assert.equal(document.documentElement.getAttribute("lang"), "en");
  assert.equal(ls.getItem(LANG_KEY), "en");
  assert.equal(text("sound-text"), en.soundOn);
  assert.ok(text("btn-help").includes(en.help), "说明键要换字，但允许保留 ? 图标");
  assert.equal(text("console-hint"), en.handHint);
  assert.ok(text("eave-now").includes(en.modeCampaign));
  for (const id of ["sound-text", "btn-help", "btn-start", "console-hint", "dust-note", "tally-total"]) {
    assert.equal(/[\u4e00-\u9fff]/.test(text(id)), false, `${id} 还留着中文：${text(id)}`);
  }
  assert.equal(/[a-z]/i.test(text("score-best")), true);

  $("btn-modes").click();
  $("mode-rack").children[3].click();
  assert.deepEqual([...$("brush-rack").children].map((c) => c.textContent), BRUSHES.map((b) => en[BRUSH_KEY[b]]));
  assert.equal(/[\u4e00-\u9fff]/.test(text("check-list")), false);
  $("btn-leave-bench").click();
  $("btn-lang").click();
  assert.equal(ls.getItem(LANG_KEY), "zh");
  assert.equal(text("sound-text"), zh.soundOn);
  pump(10);
});

test("音效与静音：合成器真被点着，静音偏好落盘且按钮如实回显", () => {
  assert.ok(audioCalls.ctx > 0, "WebAudio 上下文该在首次手势时建起来");
  assert.ok(audioCalls.osc + audioCalls.noise > 40, `一整轮点下来合成器该响很多次（实际 osc=${audioCalls.osc} noise=${audioCalls.noise}）`);
  assert.ok(audioCalls.resume > 0);

  $("btn-sound").click();
  assert.equal($("btn-sound").getAttribute("aria-pressed"), "false");
  assert.equal(text("sound-icon"), "✕");
  assert.equal(text("sound-text"), zh.soundOff);
  assert.equal(JSON.parse(ls.getItem(SAVE_KEY)).muted, true);
  const frozen = audioCalls.osc;
  pump(400);
  assert.equal(audioCalls.osc, frozen, "静音时不该再推子");
  $("btn-sound").click();
  assert.equal($("btn-sound").getAttribute("aria-pressed"), "true");
  assert.equal(JSON.parse(ls.getItem(SAVE_KEY)).muted, false);
  $("btn-dash").click();
  $("btn-restart").click();
  pump(60);
  assert.ok(audioCalls.osc > frozen, "解除静音后声音要回来");
});

test("收尾：机台状态自洽，没有悬空幕布与未捕获异常", () => {
  pump(120);
  const veils = ["veil-ready", "veil-modes", "veil-levels", "veil-result", "veil-help", "veil-paused"];
  assert.ok(veils.filter((v) => shown(v)).length <= 1, "同一时刻最多掀开一张幕布");
  assert.ok($("board").getContext().calls.fill > 0);
  assert.ok($("bench-canvas").getContext().calls.fill > 0, "裁铺台也画过");
  assert.match(text("score-main"), /^\d{6}$/);
  assert.equal(Number.isNaN(Number(text("clock-main").replace(":", "."))), false);
  restoreGlobals();
});
