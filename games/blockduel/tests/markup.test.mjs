import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const css = readFileSync(resolve(root, "css", "style.css"), "utf8");

test("语义骨架：返回首页、noscript、语言、描述、图标", () => {
  assert.match(html, /<a[^>]+href="\/"[^>]+id="back-home"/);
  assert.match(html, /<noscript/);
  assert.match(html, /<html[^>]+lang="zh-CN"/);
  assert.match(html, /<meta[^>]+name="description"/);
  assert.match(html, /rel="icon"/);
});

test("所有本地脚本与样式带 ?v=dev 占位", () => {
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((value) => !/^(https?:)?\/\//.test(value) && !value.startsWith("data:") && /\.(mjs|js|css)(\?|$)/.test(value));
  assert.ok(assets.length >= 2);
  for (const asset of assets) assert.ok(asset.includes("?v=dev"), asset);
});

test("禁止 location.reload，语言切换必须原地热更新", () => {
  assert.ok(!html.includes("location.reload"));
  const jsSources = ["main.mjs", "ui.mjs", "i18n.mjs"].map((name) => readFileSync(resolve(root, "js", name), "utf8"));
  for (const source of jsSources) assert.ok(!source.includes("location.reload"));
});

test("HTML 中文节点必须带 data-i18n 或由 JS 按 id 覆盖", () => {
  const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  const nodes = [...clean.matchAll(/<([a-zA-Z0-9-]+)([^>]*)>([^<]*[\u4e00-\u9fa5]+[^<]*)<\/\1>/g)];
  const unhandled = [];
  for (const [, tag, attrs, text] of nodes) {
    const hasI18n = /data-i18n(?:-attr)?=/.test(attrs);
    const idMatch = attrs.match(/id="([^"]+)"/);
    const knownId = idMatch && idMatch[1] &&
      ["chip-stage", "chip-round", "level-progress", "result-eyebrow", "result-title", "result-detail"].includes(idMatch[1]);
    if (!hasI18n && !knownId) unhandled.push(`<${tag}> ${text.trim().slice(0, 16)}`);
  }
  assert.deepEqual(unhandled, []);
});

test("实时游戏必备：暂停遮罩、触控手柄与减少动态", () => {
  assert.match(html, /id="ov-pause"/);
  assert.match(html, /id="touch"/);
  assert.match(html, /data-act="hard"/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /max\(78px/);
});

test("模块文件齐备且引擎不碰 DOM", () => {
  const required = ["engine.mjs", "game.mjs", "ui.mjs", "i18n.mjs", "storage.mjs", "audio.mjs", "main.mjs"];
  for (const file of required) assert.ok(existsSync(resolve(root, "js", file)), file);
  const engine = readFileSync(resolve(root, "js", "engine.mjs"), "utf8");
  const code = engine.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/[^\n]*/gm, "");
  for (const token of ["document.", "window.", "localStorage", "sessionStorage"]) {
    assert.ok(!code.includes(token), `engine 不得出现 ${token}`);
  }
});

test("存档 Key 唯一且集中降级", () => {
  const storage = readFileSync(resolve(root, "js", "storage.mjs"), "utf8");
  assert.match(storage, /doin\.blockduel\.v1/);
  assert.match(storage, /try/);
  assert.match(storage, /catch/);
});

test("音色设计使用噪声缓冲与滤波器，而非单一蜂鸣", () => {
  const audio = readFileSync(resolve(root, "js", "audio.mjs"), "utf8");
  assert.match(audio, /createBuffer/);
  assert.match(audio, /BiquadFilter/);
  assert.match(audio, /getChannelData/);
});
