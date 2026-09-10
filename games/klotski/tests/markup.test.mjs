// filepath: games/klotski/tests/markup.test.mjs
// 静态结构测试：对 index.html / css/style.css / js/*.mjs 做静态断言。
// 目的：保证 DOM id 与 JS 选择器一致、资源全部本地相对路径、移动端与降级样式存在。
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
  "btn-lang",
  "btn-sound",
  "icon-sound-on",
  "icon-sound-off",
  "stage",
  "hud",
  "hud-level",
  "hud-moves",
  "hud-par",
  "hud-time",
  "level-badge",
  "level-name",
  "level-diff",
  "board-wrap",
  "board",
  "toast",
  "toolbar",
  "btn-undo",
  "btn-restart",
  "btn-pause",
  "btn-levels",
  "btn-help",
  "sr-status",
  "ov-start",
  "btn-start",
  "btn-start-levels",
  "btn-start-help",
  "ov-pause",
  "btn-resume",
  "btn-pause-restart",
  "btn-pause-levels",
  "btn-pause-help",
  "ov-win",
  "win-title",
  "win-stars",
  "win-newbest",
  "win-moves",
  "win-par",
  "win-time",
  "win-score",
  "win-best",
  "btn-next",
  "btn-replay",
  "btn-win-levels",
  "ov-levels",
  "levels-title",
  "levels-total",
  "levels-grid",
  "btn-levels-close",
  "ov-help",
  "btn-help-close",
];

test("index.html 结构完整", () => {
  // 首行是 filepath 标注注释，其后才是 <!DOCTYPE html>
  assert.match(html, /^<!-- filepath: games\/klotski\/index\.html -->\n<!DOCTYPE html>\n/i);
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
  const absolute = [...html.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]);
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
  const remote = [...html.matchAll(/https?:\/\/(?!www\.w3\.org)[^\s"'<>]+/g)].map((m) => m[0]);
  assert.deepEqual(remote, [], `发现外链：${remote.join(", ")}`);
  assert.doesNotMatch(html, /\balert\s*\(/);
  assert.doesNotMatch(html, /fonts\.googleapis|cdn\.|unpkg|jsdelivr/i);
});

test("全部 js 模块零外链、无 alert、相对导入均存在", () => {
  for (const [name, source] of Object.entries(jsSources)) {
    const remote = [...source.matchAll(/https?:\/\/(?!www\.w3\.org)[^\s'"`)]+/g)].map((m) => m[0]);
    assert.deepEqual(remote, [], `${name} 含外链：${remote.join(", ")}`);
    assert.doesNotMatch(source, /\balert\s*\(/, `${name} 不应使用 alert`);

    const imports = [...source.matchAll(/from\s+"(\.\/[^"]+|\.\.\/[^"]+)"/g)].map((m) => m[1]);
    for (const spec of imports) {
      const target = resolve(jsDir, spec);
      assert.ok(existsSync(target), `${name} 导入的 ${spec} 不存在`);
    }
  }
});

test("JS 里用到的 DOM id 都在 index.html 中定义", () => {
  const used = new Set();
  for (const [name, source] of Object.entries(jsSources)) {
    for (const match of source.matchAll(/getElementById\(\s*"([^"]+)"\s*\)/g)) used.add(match[1]);
    for (const match of source.matchAll(/\$\(\s*"([^"]+)"\s*\)/g)) used.add(match[1]);
  }
  assert.ok(used.size > 15, "应检出足够多的选择器");
  for (const id of used) {
    assert.ok(HTML_IDS.has(id), `JS 引用了 index.html 中不存在的 id="${id}"`);
  }
});

test("i18n 标记引用的键在中英字典中都存在", () => {
  const keys = new Set();
  for (const match of html.matchAll(/data-i18n(?:-aria|-list)?="([^"]+)"/g)) keys.add(match[1]);
  assert.ok(keys.size > 20, "应检出足够多的文案键");
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

test("样式：移动端断点与横屏适配存在", () => {
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /@media \(max-height: 620px\)/);
  assert.match(css, /@media \(orientation: landscape\)/);
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
  const hoverOnly = /:hover\s*\{[^}]*display:\s*none/;
  assert.doesNotMatch(css, hoverOnly);
});

test("模块清单齐全（engine / game / render / ui / audio / score / storage / i18n / levels / main）", () => {
  for (const name of [
    "engine.mjs",
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

test("每个模块首行都带 filepath 标注", () => {
  for (const [name, source] of Object.entries(jsSources)) {
    const first = source.split("\n")[0];
    assert.match(first, /^\/\/ filepath: games\/klotski\/js\/[a-z0-9]+\.mjs$/, `${name} 首行标注不合规`);
  }
});

test("无 TODO / 占位截断", () => {
  for (const [name, source] of Object.entries(jsSources)) {
    assert.doesNotMatch(source, /\bTODO\b|\bFIXME\b|^\s*\/\/ \.\.\./m, `${name} 含未完成标记`);
  }
});
