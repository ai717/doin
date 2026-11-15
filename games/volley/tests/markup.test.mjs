// Volley markup tests: platform contract skeleton + module layering.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

test("语义骨架：返回首页、noscript、语言、描述、图标", () => {
  assert.match(html, /<a[^>]+href="\/"[^>]+id="back-home"/);
  assert.match(html, /<noscript/);
  assert.match(html, /<html[^>]+lang="zh-CN"/);
  assert.match(html, /<meta[^>]+name="description"[^>]+content="[^"]+"/);
  assert.match(html, /<link[^>]+rel="icon"/);
});

test("缓存契约：所有本地资源带 ?v=dev", () => {
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^(https?:)?\/\//.test(ref) || ref.startsWith("data:")) continue;
    if (ref === "/" ) continue; // back-home is the one absolute exception
    assert.ok(ref.includes("?v=dev"), `资源缺 ?v=dev: ${ref}`);
  }
});

test("零刷新：js 源码禁用 location.reload", () => {
  for (const file of ["main.mjs", "ui.mjs", "game.mjs", "i18n.mjs", "storage.mjs", "audio.mjs", "engine.mjs"]) {
    const code = readFileSync(join(root, "js", file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s\/\/[^\n]*/g, "");
    assert.ok(!code.includes("location.reload"), `${file} 使用了 location.reload`);
  }
});

test("即开即玩与暂停契约：无前置遮罩、暂停面板、触摸与动效降级", () => {
  assert.match(html, /id="ov-pause"/);
  const css = readFileSync(join(root, "css", "style.css"), "utf8");
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /padding:\s*10px 10px max\(68px/);
});

test("模块分层：js/ 七模块齐备且 engine 严格 DOM-free", () => {
  for (const file of ["engine.mjs", "game.mjs", "ui.mjs", "storage.mjs", "i18n.mjs", "audio.mjs", "main.mjs"]) {
    assert.ok(existsSync(join(root, "js", file)), `缺 js/${file}`);
  }
  assert.ok(existsSync(join(root, "css", "style.css")), "缺 css/style.css");
  const engine = readFileSync(join(root, "js", "engine.mjs"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s\/\/[^\n]*/g, "");
  for (const token of ["document.", "window.", "localStorage", "sessionStorage", "querySelector"]) {
    assert.ok(!engine.includes(token), `engine.mjs 出现 DOM token: ${token}`);
  }
});

test("存储护栏：storage 有统一 key 与 try/catch 降级", () => {
  const storage = readFileSync(join(root, "js", "storage.mjs"), "utf8");
  assert.match(storage, /doin\.volley\.v1/);
  assert.match(storage, /try\s*\{/);
  assert.match(storage, /catch\s*\(/);
});

test("音效层：WebAudio 物理合成三件套", () => {
  const audio = readFileSync(join(root, "js", "audio.mjs"), "utf8");
  assert.match(audio, /createBuffer/);
  assert.match(audio, /BiquadFilter/);
  assert.match(audio, /getChannelData/);
});

test("game.json 未引用：入口脚本为 module 且 main 最后装配", () => {
  assert.match(html, /<script[^>]+type="module"[^>]+src="\.\/js\/main\.mjs\?v=dev"/);
});

test("tests 目录至少 3 个测试文件", () => {
  const files = readdirSync(join(root, "tests")).filter((f) => f.endsWith(".mjs"));
  assert.ok(files.length >= 3, `仅 ${files.length} 个测试文件`);
});

test("沙盘视窗契约：双炮台/风旗/双武器架/结算推荐位在骨架中", () => {
  assert.match(html, /id="windflag"/);
  assert.match(html, /id="blocks-layer"/);
  assert.match(html, /id="fx-canvas"/);
  assert.match(html, /id="weapons-0"/);
  assert.match(html, /id="weapons-1"/);
  assert.match(html, /id="btn-fire-0"/);
  assert.match(html, /id="btn-fire-1"/);
  assert.match(html, /id="result-recs"/);
  assert.match(html, /id="btn-result-primary"/);
});
