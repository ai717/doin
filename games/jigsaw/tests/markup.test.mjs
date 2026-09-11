// filepath: games/jigsaw/tests/markup.test.mjs
// 静态结构测试：对 index.html / css/style.css / js/*.mjs 做静态断言。
// 目的：DOM id 与 JS 选择器双向闭合、资源全本地相对路径、移动端与降级样式在位。
// 注意：本文件只做静态检查，不涉及任何浏览器运行。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import { strings } from "../js/i18n.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

const html = read("index.html");
const css = read("css/style.css");
const jsDir = join(root, "js");
const jsFiles = readdirSync(jsDir).filter((name) => name.endsWith(".mjs"));
const jsSources = Object.fromEntries(jsFiles.map((name) => [name, read(join("js", name))]));

const HTML_IDS = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));

const REQUIRED_IDS = [
  "app",
  "topbar",
  "btn-home",
  "game-title",
  "game-sub",
  "btn-lang",
  "btn-sound",
  "icon-sound-on",
  "icon-sound-off",
  "stage",
  "level-badge",
  "level-name",
  "level-chapter",
  "hud",
  "hud-level",
  "hud-moves",
  "hud-par",
  "hud-score",
  "hud-time",
  "board-wrap",
  "board",
  "toast",
  "toolbar",
  "btn-preview",
  "btn-reshuffle",
  "shuffle-count",
  "btn-restart",
  "btn-levels",
  "btn-help",
  "sr-status",
  "ov-start",
  "btn-start",
  "btn-start-daily",
  "btn-start-levels",
  "btn-start-help",
  "ov-win",
  "win-title",
  "win-newbest",
  "win-moves",
  "win-par",
  "win-time",
  "win-score",
  "win-perfect",
  "win-best",
  "btn-next",
  "btn-replay",
  "btn-win-levels",
  "ov-levels",
  "levels-title",
  "levels-total",
  "daily-label",
  "daily-hint",
  "btn-daily",
  "levels-grid",
  "btn-levels-close",
  "ov-help",
  "help-title",
  "btn-help-close",
];

test("index.html 结构完整", () => {
  // 首行是 filepath 标注注释，其后才是 <!DOCTYPE html>
  // 用 \r?\n 兼容 core.autocrlf=true 的检出（否则重新 clone 后本测试会失败）
  assert.match(html, /^<!-- filepath: games\/jigsaw\/index\.html -->\r?\n<!DOCTYPE html>\r?\n/i);
  assert.match(html, /<html lang="[^"]+"/);
  assert.match(html, /<meta charset="utf-8">/i);
  assert.match(html, /<meta name="viewport"[^>]+width=device-width/);
  assert.match(html, /<meta name="description"[^>]+content="[^"]{20,}"/);
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /<noscript>/i);
  assert.match(html, /<link rel="icon" href="favicon\.svg"/);
});

test("必需 DOM id 全部存在", () => {
  for (const id of REQUIRED_IDS) {
    assert.ok(HTML_IDS.has(id), `index.html 缺少 id="${id}"`);
  }
});

test("返回门户链接是唯一的绝对路径，且指向 /", () => {
  assert.match(html, /<a id="btn-home"[^>]*href="\/"/);
  const absolute = [...html.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((match) => match[1]);
  assert.deepEqual(absolute, ["/"], "除返回门户外不应出现其它绝对路径");
});

test("本地样式与脚本保持 ?v=dev，且路径相对", () => {
  assert.match(html, /<link rel="stylesheet" href="css\/style\.css\?v=dev">/);
  assert.match(html, /<script type="module" src="js\/main\.mjs\?v=dev"><\/script>/);
  assert.ok(existsSync(join(root, "css/style.css")));
  assert.ok(existsSync(join(root, "js/main.mjs")));
  assert.ok(existsSync(join(root, "favicon.svg")));
});

test("index.html 零外链：无远程地址、无 CDN、无 alert", () => {
  const remote = [...html.matchAll(/https?:\/\/(?!www\.w3\.org)[^\s"'<>]+/g)].map((match) => match[0]);
  assert.deepEqual(remote, [], `发现外链：${remote.join(", ")}`);
  assert.doesNotMatch(html, /\balert\s*\(/);
  assert.doesNotMatch(html, /fonts\.googleapis|cdn\.|unpkg|jsdelivr/i);
});

test("全部 js 模块零外链、无 alert、相对导入均存在", () => {
  for (const [name, source] of Object.entries(jsSources)) {
    const remote = [...source.matchAll(/https?:\/\/(?!www\.w3\.org)[^\s'"`)]+/g)].map((match) => match[0]);
    assert.deepEqual(remote, [], `${name} 含外链：${remote.join(", ")}`);
    assert.doesNotMatch(source, /\balert\s*\(/, `${name} 不应使用 alert`);

    const imports = [...source.matchAll(/from\s+"(\.\/[^"]+|\.\.\/[^"]+)"/g)].map((match) => match[1]);
    for (const spec of imports) {
      assert.ok(existsSync(resolve(jsDir, spec)), `${name} 导入的 ${spec} 不存在`);
    }
  }
});

test("JS 里用到的 DOM id 都在 index.html 中定义", () => {
  const used = new Set();
  for (const [name, source] of Object.entries(jsSources)) {
    for (const match of source.matchAll(/getElementById\(\s*"([^"]+)"\s*\)/g)) used.add(match[1]);
    for (const match of source.matchAll(/\$\(\s*"([^"]+)"\s*\)/g)) used.add(match[1]);
  }
  assert.ok(used.size > 20, `应检出足够多的选择器，当前 ${used.size}`);
  for (const id of used) {
    assert.ok(HTML_IDS.has(id), `JS 引用了 index.html 中不存在的 id="${id}"`);
  }
});

test("overlay 的 id 与 ui.mjs 的 OVERLAY_IDS 表一致", () => {
  const source = jsSources["ui.mjs"];
  const declared = [...source.matchAll(/const OVERLAY_IDS = \[([^\]]+)\]/g)][0][1]
    .split(",")
    .map((item) => item.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
  assert.ok(declared.length >= 4);
  for (const id of declared) {
    assert.ok(HTML_IDS.has(id), `OVERLAY_IDS 里的 ${id} 在 index.html 中不存在`);
  }
});

test("i18n 标记引用的键在中英字典中都存在", () => {
  const keys = new Set();
  for (const match of html.matchAll(/data-i18n(?:-aria|-list)?="([^"]+)"/g)) keys.add(match[1]);
  assert.ok(keys.size > 25, `应检出足够多的文案键，当前 ${keys.size}`);
  for (const key of keys) {
    assert.ok(strings.zh[key] !== undefined, `zh 缺键 ${key}`);
    assert.ok(strings.en[key] !== undefined, `en 缺键 ${key}`);
  }
});

test("样式：系统字体栈、无远程字体、无 @import", () => {
  assert.match(css, /-apple-system[\s\S]*sans-serif/);
  assert.doesNotMatch(css, /@font-face/);
  assert.doesNotMatch(css, /@import/);
  assert.doesNotMatch(css, /https?:\/\/(?!www\.w3\.org)/);
  assert.match(css, /PingFang SC|Microsoft YaHei|Noto Sans CJK SC/);
});

test("样式：移动端断点、桌面双栏与横屏适配存在", () => {
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /@media \(max-height: 620px\)/);
  assert.match(css, /@media \(orientation: landscape\)/);
  assert.match(css, /@media \(min-width: 900px\)/);
});

test("样式：尊重 prefers-reduced-motion", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation-duration: 0\.001ms !important/);
  assert.match(css, /transition-duration: 0\.001ms !important/);
});

test("棋盘画布可聚焦、可键盘操作、禁用手势滚动", () => {
  assert.match(html, /<canvas id="board"[^>]*tabindex="0"/);
  assert.match(html, /<canvas id="board"[^>]*role="application"/);
  assert.match(css, /#board\s*\{[\s\S]*?touch-action:\s*none/);
  assert.match(css, /#board:focus-visible/);
});

test("无悬停依赖：所有交互元素有可见焦点样式", () => {
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /:hover\s*\{[^}]*display:\s*none/);
});

test("模块清单齐全（engine / artwork / levels / score / storage / i18n / audio / game / render / ui / main）", () => {
  for (const name of [
    "engine.mjs",
    "artwork.mjs",
    "levels.mjs",
    "score.mjs",
    "storage.mjs",
    "i18n.mjs",
    "audio.mjs",
    "game.mjs",
    "render.mjs",
    "ui.mjs",
    "main.mjs",
  ]) {
    assert.ok(existsSync(join(jsDir, name)), `缺少 ${name}`);
  }
});

test("规则层不碰 DOM / 存储（engine.mjs 必须能被 node:test 直接跑）", () => {
  const stripped = jsSources["engine.mjs"]
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const token of ["document.", "window.", "localStorage", "sessionStorage"]) {
    assert.ok(!stripped.includes(token), `engine.mjs 混入 ${token}`);
  }
});

test("localStorage 只出现在 storage.mjs / i18n.mjs，且都带 try/catch 降级", () => {
  const strip = (source) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const users = Object.entries(jsSources).filter(([, source]) => strip(source).includes("localStorage"));
  const names = users.map(([name]) => name).sort();
  assert.deepEqual(names, ["i18n.mjs", "storage.mjs"], `localStorage 出现在意外模块：${names.join(", ")}`);
  for (const [name, source] of users) {
    assert.match(source, /catch/, `${name} 读写 localStorage 必须有 try/catch 降级`);
  }
});

test("每个模块首行都带 filepath 标注", () => {
  for (const [name, source] of Object.entries(jsSources)) {
    const first = source.split(/\r?\n/)[0];
    assert.match(first, /^\/\/ filepath: games\/jigsaw\/js\/[a-z0-9]+\.mjs$/, `${name} 首行标注不合规`);
  }
});

test("无 TODO / 占位截断", () => {
  for (const [name, source] of Object.entries(jsSources)) {
    assert.doesNotMatch(source, /\bTODO\b|\bFIXME\b|^\s*\/\/ \.\.\./m, `${name} 含未完成标记`);
  }
});
