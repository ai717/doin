import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { strings } from "../js/i18n.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const gameDir = resolve(here, "..");
const read = (relative) => readFileSync(join(gameDir, relative), "utf8");

const html = read("index.html");
const css = read("css/style.css");

const jsDir = join(gameDir, "js");
const jsFiles = readdirSync(jsDir).filter((name) => name.endsWith(".mjs"));
const jsSources = new Map(jsFiles.map((name) => [name, read(join("js", name))]));
const allJs = Array.from(jsSources.values()).join("\n");

test("目录结构完整", () => {
  assert.ok(existsSync(join(gameDir, "index.html")), "缺 index.html");
  assert.ok(existsSync(join(gameDir, "favicon.svg")), "缺 favicon.svg");
  assert.ok(existsSync(join(gameDir, "css", "style.css")), "缺 css/style.css");
  assert.ok(existsSync(join(gameDir, "js", "engine.mjs")), "缺 js/engine.mjs");
  assert.ok(existsSync(join(gameDir, "js", "main.mjs")), "缺 js/main.mjs");
});

test("index.html 基本契约", () => {
  assert.match(html, /^<!DOCTYPE html>/i, "缺 DOCTYPE");
  assert.match(html, /<html[^>]+lang=/, "缺 html lang");
  assert.match(html, /name="viewport"/, "缺 viewport");
  assert.match(html, /name="description"/, "缺 meta description");
  assert.match(html, /rel="icon"[^>]+favicon\.svg\?v=dev/, "缺 favicon 相对链接");
  assert.match(html, /<noscript>/, "缺 noscript 兜底");
  assert.match(html, /<a[^>]+id="back-home"[^>]+href="\/"/, "缺 href=\"/\" 返回门户链接");
  assert.doesNotMatch(html, /\balert\s*\(/, "禁止使用 alert");
});

test("本地资源全部带 ?v=dev，且没有外链", () => {
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const local = refs.filter((v) => !/^(https?:)?\/\//.test(v) && !v.startsWith("data:") && /\.(mjs|js|css|svg)(\?|$)/.test(v));
  assert.ok(local.length >= 3, "本地资源引用过少");
  for (const value of local) {
    assert.ok(value.includes("?v=dev"), `本地资源缺少 ?v=dev: ${value}`);
    assert.ok(!value.startsWith("/"), `不得使用绝对路径: ${value}`);
  }

  assert.doesNotMatch(html, /https?:\/\//, "index.html 不得出现外部链接");
  assert.doesNotMatch(css, /https?:\/\//, "CSS 不得出现外部链接");
  assert.doesNotMatch(allJs, /https?:\/\/(?!www\.w3\.org)/, "JS 不得请求远程资源");
  assert.doesNotMatch(html, /@import|fonts\.googleapis|cdn\./, "不得引入外链字体或 CDN");
  assert.doesNotMatch(css, /@font-face/, "不得加载 WebFont");
  assert.doesNotMatch(html, /<img[^>]+src="https?:/, "不得使用外部图片");
});

test("JS import 全部为相对路径且文件真实存在", () => {
  for (const [name, src] of jsSources) {
    const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    for (const spec of imports) {
      assert.ok(spec.startsWith("./"), `${name} 的 import 必须是相对路径: ${spec}`);
      assert.ok(spec.includes("?v=dev"), `${name} 的 import 缺少 ?v=dev: ${spec}`);
      const target = spec.split("?")[0];
      assert.ok(existsSync(join(jsDir, target)), `${name} 引用了不存在的模块: ${spec}`);
    }
  }
});

test("DOM id 与 JS 选择器闭合", () => {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const used = new Set();
  for (const src of jsSources.values()) {
    for (const m of src.matchAll(/getElementById\("([^"]+)"\)/g)) used.add(m[1]);
    for (const m of src.matchAll(/byId\("([^"]+)"\)/g)) used.add(m[1]);
  }
  assert.ok(used.size > 10, "JS 引用的 DOM id 过少，选择器可能未解析");
  for (const id of used) {
    assert.ok(ids.has(id), `index.html 缺少 JS 使用的 id: #${id}`);
  }

  for (const id of ["board", "overlay", "chain-pop", "stat-score", "stat-best", "stat-tier", "stat-chain",
    "btn-pulse", "pulse-count", "btn-pause", "btn-restart", "btn-help", "btn-mode-standard",
    "btn-mode-daily", "daily-note", "cv-current", "cv-next", "txt-current", "txt-next", "codex",
    "hint", "modal", "modal-title", "modal-body", "modal-primary", "modal-secondary", "toast",
    "btn-sound", "btn-lang", "back-home"]) {
    assert.ok(ids.has(id), `index.html 缺少关键 id: #${id}`);
  }
});

test("data-i18n 键全部存在于语言表", () => {
  const keys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length > 10, "data-i18n 过少，语言切换可能没接上");
  for (const key of keys) {
    assert.ok(strings.zh[key], `中文表缺少 ${key}`);
    assert.ok(strings.en[key], `英文表缺少 ${key}`);
  }
});

test("样式：系统字体栈、移动端适配、动效降级", () => {
  assert.match(css, /-apple-system|system-ui|sans-serif/, "未使用系统字体栈");
  assert.match(css, /@media \(max-width:\s*768px\)/, "缺少移动端断点");
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/, "缺少 prefers-reduced-motion 降级");
  assert.match(css, /:focus-visible/, "缺少键盘焦点样式");
  assert.match(css, /touch-action:\s*none/, "Canvas 未处理触摸手势");
});

test("桌面端是宽屏游戏舞台，不是手机竖屏模拟", () => {
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\)/, "桌面端缺少双栏舞台");
  assert.match(css, /aspect-ratio:\s*480\s*\/\s*720/, "玻璃舱未固定 480:720 比例");
  assert.doesNotMatch(css, /width:\s*390px;/, "不得把页面锁死为 390px 手机宽度");
  assert.doesNotMatch(html, /<footer|class="site-header"/, "不得出现门户式页头页尾");
});

test("渲染分层：engine 保持 DOM-free", () => {
  const engine = jsSources.get("engine.mjs") || "";
  for (const banned of ["document", "window", "localStorage", "requestAnimationFrame", "canvas"]) {
    assert.doesNotMatch(engine, new RegExp(`\\b${banned}\\b`), `engine.mjs 不得触碰 ${banned}`);
  }
  assert.match(engine, /export function step/, "engine 缺少固定步长入口");
  assert.match(engine, /export function createState/, "engine 缺少状态构造入口");
  assert.match(engine, /PHASE/, "engine 缺少流程状态定义");
});

test("存档与语言 Key 符合全局约定", () => {
  const storage = jsSources.get("storage.mjs") || "";
  assert.match(storage, /doin\.bubble-bloom\.v1/, "存档 Key 必须为 doin.bubble-bloom.v1");
  assert.match(allJs, /doin\.lang/, "必须读写全站共享语言 Key doin.lang");
  const storageUsers = Array.from(jsSources.entries()).filter(([, src]) => src.includes("localStorage"));
  for (const [name, src] of storageUsers) {
    assert.ok(src.includes("catch"), `${name} 使用 localStorage 但无 try/catch`);
  }
});

test("零外链图片与音频：素材均为自包含", () => {
  const favicon = read("favicon.svg");
  // xmlns 是 XML 命名空间声明，不是外部资源引用
  const body = favicon.replace(/xmlns="[^"]*"/g, "");
  assert.doesNotMatch(body, /https?:\/\//, "favicon 不得引用外部资源");
  assert.doesNotMatch(favicon, /<image[^>]+href="(?!data:)/, "favicon 不得嵌入外部位图");
  assert.match(favicon, /<svg[\s\S]*<\/svg>/, "favicon 必须是自包含 SVG");
});
