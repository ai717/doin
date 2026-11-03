import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(import.meta.dirname, "..");
const html = readFileSync(resolve(dir, "index.html"), "utf8");
const css = readFileSync(resolve(dir, "css", "style.css"), "utf8");

function jsSources() {
  return readdirSync(resolve(dir, "js"))
    .filter((name) => name.endsWith(".mjs"))
    .map((name) => ({ name, src: readFileSync(resolve(dir, "js", name), "utf8") }));
}

function strip(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("markup: navigation, noscript, canvas, favicon and meta are present", () => {
  assert.ok(/<a[^>]+href="\/"[^>]*id="back-home"/.test(html) || /<a[^>]+id="back-home"[^>]*href="\/"/.test(html), "必须包含返回门户链接");
  assert.ok(/<noscript/.test(html), "必须包含 noscript 兜底");
  assert.ok(/<canvas[^>]+id="stage-canvas"/.test(html), "必须包含主画布");
  assert.ok(/rel="icon"/.test(html), "必须声明 favicon");
  assert.ok(/<html[^>]+lang="/.test(html), "html 必须带 lang");
  assert.ok(/<meta[^>]+name="description"/.test(html), "必须带 meta description");
});

test("markup: all local script/link assets carry ?v=dev", () => {
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => !/^(https?:)?\/\//.test(value) && !value.startsWith("data:") && /\.(mjs|js|css)(\?|$)/.test(value));
  assert.ok(assets.length >= 2);
  for (const asset of assets) assert.ok(asset.includes("?v=dev"), `${asset} 缺少缓存占位`);
});

test("markup: entry script is an ES module and there are no external URLs", () => {
  assert.ok(/<script[^>]+type="module"[^>]+src="js\/main\.mjs\?v=dev"/.test(html));
  const urls = [...html.matchAll(/https?:\/\/[^"'\s>]+/g)].map((match) => match[0]);
  assert.deepEqual(urls, [], "HTML 不得包含外部网络链接");
});

test("markup: no absolute game paths leak into sources", () => {
  const sources = [html, ...jsSources().map((file) => file.src)];
  for (const source of sources) {
    assert.ok(!/\/games\/shaft\//.test(source), "源码禁止写本地绝对路径");
    assert.ok(!/["'`]\/shaft\//.test(source), "源码禁止写生产绝对路径");
  }
});

test("markup: every id referenced from JS exists in index.html", () => {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
  const missing = [];
  for (const file of jsSources()) {
    for (const match of file.src.matchAll(/getElementById\("([^"]+)"\)/g)) {
      if (!ids.has(match[1])) missing.push(`${file.name}:${match[1]}`);
    }
    for (const match of file.src.matchAll(/\bel\("([^"]+)"\)/g)) {
      if (!ids.has(match[1])) missing.push(`${file.name}:el(${match[1]})`);
    }
  }
  assert.deepEqual(missing, [], `JS 引用了不存在的 id: ${missing.join(", ")}`);
});

test("markup: css covers desktop wings, mobile single column and reduced motion", () => {
  assert.ok(existsSync(resolve(dir, "css", "style.css")));
  assert.ok(css.includes("prefers-reduced-motion"));
  assert.ok(/@media\s*\(min-width:\s*900px\)/.test(css), "桌面端 ≥900px 双翼舞台");
  assert.ok(/@media\s*\(max-width:\s*899px\)/.test(css), "移动端单列适配");
  assert.ok(/@media\s*\(max-width:\s*560px\)/.test(css), "覆盖 390px 窄视口");
  assert.ok(css.includes("touch-action: none"), "画布必须声明 touch-action: none");
  assert.ok(css.includes("env(safe-area-inset-bottom)"), "移动端底部必须预留广告避让区");
});

test("markup: engine / controller / data layers stay DOM-free", () => {
  for (const name of ["engine.mjs", "game.mjs", "levels.mjs", "score.mjs"]) {
    const src = strip(readFileSync(resolve(dir, "js", name), "utf8"));
    for (const token of ["document.", "window.", "localStorage", "sessionStorage"]) {
      assert.ok(!src.includes(token), `${name} 不得触碰 ${token}`);
    }
  }
});

test("markup: module graph has no missing relative imports", () => {
  for (const file of jsSources()) {
    for (const match of file.src.matchAll(/from\s+"(\.\/[^"]+)"/g)) {
      const target = resolve(dir, "js", match[1]);
      assert.ok(existsSync(target), `${file.name} 引用了不存在的模块 ${match[1]}`);
    }
  }
});

test("markup: localStorage is centralized in storage.mjs (i18n may read the shared lang key)", () => {
  const others = jsSources()
    .filter((file) => file.name !== "i18n.mjs")
    .filter((file) => strip(file.src).includes("localStorage"));
  assert.deepEqual(others.map((file) => file.name), ["storage.mjs"], "除 i18n 外 localStorage 只能出现在 storage.mjs");
  const storage = readFileSync(resolve(dir, "js", "storage.mjs"), "utf8");
  assert.ok(storage.includes("catch"), "存储必须集中 try/catch 降级");
});

test("markup: instant play structure exists with a persistent stage entry", () => {
  assert.ok(html.includes('id="panel-levels"'), "必须有可随时呼出的选关抽屉");
  assert.ok(html.includes('id="btn-levels"'), "顶栏必须常驻选关按钮");
  assert.ok(!/panel-ready/.test(html), "首屏不得有强制开局的模式大遮罩");
  assert.ok(html.includes('id="mode-bar"'), "模式入口必须常驻可见");
  assert.ok(html.includes('id="touch-controls"'), "移动端必须提供虚拟按键");
});

test("markup: pause entry and resume/restart/levels controls are wired", () => {
  assert.ok(html.includes('id="btn-pause"'), "顶栏必须常驻暂停按钮");
  assert.ok(html.includes('id="panel-pause"'), "必须有暂停浮层");
  assert.ok(html.includes('id="btn-resume"'), "暂停浮层必须提供继续按钮");
  assert.ok(html.includes('id="btn-pause-restart"'), "暂停浮层必须提供重来按钮");
  assert.ok(html.includes('id="btn-pause-levels"'), "暂停浮层必须提供选关入口");
  assert.ok(/KeyP/.test(readFileSync(resolve(dir, "js", "main.mjs"), "utf8")), "必须支持 P 键暂停");
  assert.ok(/Escape/.test(readFileSync(resolve(dir, "js", "main.mjs"), "utf8")), "必须支持 Esc 暂停/返回");
});
