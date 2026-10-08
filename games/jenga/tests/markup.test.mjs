// 叠叠乐 · 标记与样式契约测试（页面骨架 / 模块分层 / 交互件齐备度）
//   1. 页面契约：返回首页、noscript、meta、favicon、?v=dev、广告避让区
//   2. JS 引用的 DOM id 与 HTML 一一对应（防改了 JS 忘了改 HTML）
//   3. 分层铁律：engine 严格 DOM-free，main.mjs 挂 window.__jenga 调试句柄
//   4. 样式：reduced-motion 降级、touch-action、工具槽与浮层件齐全

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const gameDir = resolve(here, "..");
const read = (rel) => readFileSync(resolve(gameDir, rel), "utf8");

const HTML = read("index.html");
const CSS = read("css/jenga.css");
const JS_FILES = readdirSync(resolve(gameDir, "js"));
const JS = JS_FILES.map((name) => read(`js/${name}`)).join("\n");

test("页面骨架：返回首页 / noscript / meta / favicon / 缓存占位", () => {
  assert.match(HTML, /<a[^>]+href="\/"/, "必须有返回首页链接");
  assert.match(HTML, /id="back-home"/);
  assert.match(HTML, /<noscript/);
  assert.match(HTML, /<meta[^>]+name="description"/);
  assert.match(HTML, /rel="icon"/);
  assert.match(HTML, /<html[^>]+lang="zh-CN"/);

  const assets = [...HTML.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((v) => !/^(https?:)?\/\//.test(v) && /\.(mjs|js|css)(\?|$)/.test(v));
  assert.ok(assets.length >= 2, "至少要引入脚本与样式");
  for (const asset of assets) {
    assert.ok(asset.includes("?v=dev"), `${asset} 缺缓存占位 ?v=dev`);
  }
  assert.match(HTML, /<script[^>]+type="module"/, "入口必须是 ES module");
});

test("即开即玩：首屏不得被任何浮层遮挡，工具槽与黑板常驻", () => {
  const overlays = [...HTML.matchAll(/class="overlay[^"]*" id="([^"]+)"([^>]*)>/g)];
  assert.ok(overlays.length >= 4, "帮助 / 暂停 / 结算 / 选关四类浮层都要有");
  for (const [, id, attrs] of overlays) {
    assert.ok(attrs.includes("hidden"), `浮层 ${id} 必须默认 hidden（即开即玩铁律）`);
  }
  for (const id of ["hud-score", "hud-streak", "hud-mult", "hud-layers", "hud-danger"]) {
    assert.ok(HTML.includes(`id="${id}"`), `黑板缺 ${id}`);
  }
  for (const id of ["btn-slot-0", "btn-slot-1", "btn-slot-2", "btn-cancel", "btn-rebuild", "btn-levels"]) {
    assert.ok(HTML.includes(`id="${id}"`), `工具槽缺 ${id}`);
  }
  assert.ok(HTML.includes('id="tower"'), "必须有木塔画布");
});

test("JS 引用的 DOM id 在 HTML 中都存在", () => {
  const ids = new Set();
  for (const m of JS.matchAll(/getElementById\("([^"]+)"\)/g)) ids.add(m[1]);
  for (const m of JS.matchAll(/\$\("([^"]+)"\)/g)) ids.add(m[1]);
  assert.ok(ids.size > 20, "至少需要绑定几十个节点");
  const missing = [...ids].filter((id) => !HTML.includes(`id="${id}"`));
  assert.deepEqual(missing, [], `HTML 缺少这些 id: ${missing.join(", ")}`);
});

test("模块分层齐备，engine 严格 DOM-free", () => {
  for (const name of ["engine.mjs", "score.mjs", "levels.mjs", "storage.mjs", "i18n.mjs", "audio.mjs", "game.mjs", "render.mjs", "ui.mjs", "main.mjs"]) {
    assert.ok(existsSync(resolve(gameDir, "js", name)), `缺 ${name}`);
  }
  const engine = read("js/engine.mjs");
  for (const token of ["document.", "window.", "localStorage", "sessionStorage", "requestAnimationFrame"]) {
    assert.ok(!engine.includes(token), `engine 不得碰 ${token}`);
  }
  assert.ok(read("js/game.mjs").includes("import"), "控制器必须走模块导入而不是自造状态");
  assert.ok(!read("js/game.mjs").includes("document."), "控制器同样保持 DOM-free");
});

test("调试句柄：main.mjs 挂 window.__jenga，且 game 用 getter 暴露", () => {
  const main = read("js/main.mjs");
  assert.ok(main.includes("globalThis.__jenga"), "缺调试句柄 __jenga");
  assert.match(main, /get game\(\)/, "game 必须写成 getter，否则重开局后句柄指向旧对象");
  assert.ok(main.includes("getView"), "至少要暴露相机视图便于真机核验");
});

test("语言热更新：源码零 location.reload", () => {
  const offenders = JS_FILES.filter((name) => {
    const code = read(`js/${name}`).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    return code.includes("location.reload");
  });
  assert.deepEqual(offenders, [], "语言切换必须原地热更新，严禁刷新页面");
});

test("移动端与降级：广告避让区、touch-action、reduced-motion", () => {
  assert.match(CSS, /padding-bottom:\s*max\(68px,\s*calc\(16px \+ env\(safe-area-inset-bottom\)\)\)/, "底部必须预留广告安全避让区");
  assert.match(CSS, /touch-action:\s*none/, "画布必须禁用手势滚动");
  assert.match(CSS, /overscroll-behavior:\s*none/);
  assert.match(CSS, /prefers-reduced-motion/, "动效必须有降级分支");
  assert.match(CSS, /@media \(max-width: 768px\)/, "必须有移动端分支");
});

test("实体质感：径向柔光与按下位移，禁硬边描边圈", () => {
  assert.match(CSS, /radial-gradient/, "高亮必须走无边界径向柔光");
  assert.match(CSS, /translateY\(2px\)|translateY\(3px\)/, "实体按键要有按下下沉位移");
  assert.match(CSS, /box-shadow/, "实体微浮雕靠阴影表达");
  assert.ok(!/\.level-chip:focus\s*\{[^}]*outline:\s*2px solid/.test(CSS), "可读性标记禁用硬边描边圈");
});
