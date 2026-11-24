import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { strings } from "../js/i18n.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");
const GAME = resolve(import.meta.dirname, "..");

async function text(relative) {
  return readFile(join(GAME, relative), "utf8");
}

test("标记：文档骨架、SEO、图标与样式占位齐备", async () => {
  const html = await text("index.html");
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">/);
  assert.match(html, /<meta name="description" content="[^"]{30,}">/);
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /favicon\.svg\?v=dev/);
  assert.match(html, /css\/style\.css\?v=dev/);
});

test("标记：模块入口、同源资源与零外链", async () => {
  const html = await text("index.html");
  assert.match(html, /<script type="module" src="js\/main\.mjs\?v=dev"><\/script>/);
  assert.equal(/src="https?:\/\//.test(html), false);
  assert.equal(/href="https?:\/\//.test(html), false);
  assert.equal(/\son[a-z]+=/.test(html), false);
});

test("标记：即开即玩，首屏无阻塞面板", async () => {
  const html = await text("index.html");
  for (const id of ["panel-levels", "panel-help", "panel-result"]) {
    assert.match(html, new RegExp(`<section id="${id}" class="panel" hidden`), id);
  }
  assert.match(html, /id="oracle-grid"/);
  assert.match(html, /id="char-grid"/);
  assert.match(html, /id="board"/);
  assert.match(html, /id="link-layer"/);
  assert.ok((html.match(/data-close/g) ?? []).length >= 2);
});

test("标记：main 引用的 DOM id 全部存在", async () => {
  const main = await text("js/main.mjs");
  const html = await text("index.html");
  const ids = [...main.matchAll(/getElementById\("([^"]+)"\)/g)].map((match) => match[1]);
  assert.ok(ids.length >= 30, `id 数量不足: ${ids.length}`);
  for (const id of new Set(ids)) {
    assert.match(html, new RegExp(`id="${id}"`), `缺少 #${id}`);
  }
});

test("标记：所有 data-i18n 键在双表存在", async () => {
  const html = await text("index.html");
  const keys = [
    ...[...html.matchAll(/data-i18n="([^"]+)"/g)].map((match) => match[1]),
    ...[...html.matchAll(/data-i18n-aria="([^"]+)"/g)].map((match) => match[1]),
  ];
  assert.ok(keys.length >= 24);
  for (const key of keys) {
    assert.ok(strings.zh[key], `zh 缺少 ${key}`);
    assert.ok(strings.en[key], `en 缺少 ${key}`);
  }
});

test("源码：除 i18n 与题库外零裸写中文", async () => {
  const files = (await readdir(join(GAME, "js"))).filter((name) => name.endsWith(".mjs") && name !== "i18n.mjs" && name !== "data.mjs");
  assert.ok(files.length >= 8);
  for (const file of files) {
    const source = await readFile(join(GAME, "js", file), "utf8");
    assert.equal(/[\u4e00-\u9fa5]/.test(source), false, `${file} 含裸写中文`);
  }
});

test("源码：规则层保持 DOM-free", async () => {
  for (const file of ["data.mjs", "levels.mjs", "score.mjs", "engine.mjs", "game.mjs"]) {
    const source = await readFile(join(GAME, "js", file), "utf8");
    assert.equal(/\b(document|window|localStorage|sessionStorage)\b/.test(source), false, `${file} 触碰了浏览器对象`);
  }
});

test("源码：存档键、语言键唯一且无 location.reload", async () => {
  const storage = await text("js/storage.mjs");
  const i18n = await text("js/i18n.mjs");
  const main = await text("js/main.mjs");
  assert.match(storage, /STORAGE_KEY = "doin\.oracle\.v1"/);
  assert.match(storage, /catch/);
  assert.match(i18n, /LANG_KEY = "doin\.lang"/);
  assert.equal(main.includes("location.reload"), false);
});

test("源码：音色为程序化 WebAudio 且五种材质声齐备", async () => {
  const audio = await text("js/audio.mjs");
  assert.match(audio, /AudioContext/);
  assert.match(audio, /createGain/);
  assert.match(audio, /createBufferSource/);
  assert.match(audio, /createBiquadFilter/);
  for (const name of ["carve", "rub", "bell", "tap", "scroll"]) {
    assert.match(audio, new RegExp(`${name}\\(`), `缺少 ${name} 音色`);
  }
  assert.equal(/\.mp3|\.ogg|\.wav/.test(audio), false);
});

test("样式：触控拦截、移动端安全区与动效降级齐备", async () => {
  const css = await text("css/style.css");
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /overscroll-behavior:\s*none/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /#scroll-paper/);
  assert.match(css, /\.evolution/);
});

test("门户：games.json 已登记且路径、封面、双语正确", async () => {
  const data = JSON.parse(await readFile(join(ROOT, "games.json"), "utf8"));
  const entry = (data.games ?? data).find((item) => item.slug === "oracle");
  assert.ok(entry, "games.json 缺少 oracle");
  assert.equal(entry.url, "/oracle/");
  assert.equal(entry.cover, "/assets/covers/oracle.webp");
  assert.ok(entry.title);
  assert.ok(entry.desc);
  assert.ok(entry.en?.title);
  assert.ok(entry.en?.desc);
  assert.ok(Array.isArray(entry.tags) && entry.tags.length >= 3);
  assert.ok(existsSync(join(ROOT, "assets", "covers", "oracle.webp")));
});

test("门户：根脚本注册测试与冒烟入口", async () => {
  const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
  assert.match(pkg.scripts["test:oracle"], /games\/oracle\/tests\/.*\.test\.mjs/);
  assert.match(pkg.scripts["smoke:oracle"], /games\/oracle\/tests\/smoke\.mjs/);
});
