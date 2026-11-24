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

test("标记：文档骨架、SEO 与画布齐备", async () => {
  const html = await text("index.html");
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">/);
  assert.match(html, /<meta name="description" content="[^"]{20,}">/);
  assert.match(html, /<canvas id="stage" width="540" height="900"/);
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /favicon\.svg\?v=dev/);
});

test("标记：模块脚本与同源资源缓存占位", async () => {
  const html = await text("index.html");
  assert.match(html, /<script type="module" src="js\/main\.mjs\?v=dev"><\/script>/);
  assert.match(html, /css\/style\.css\?v=dev/);
  assert.equal(/src="https?:\/\//.test(html), false);
  assert.equal(/href="https?:\/\//.test(html), false);
  assert.equal(/\son[a-z]+=/.test(html), false);
});

test("标记：四个浮层默认隐藏且含关闭按钮", async () => {
  const html = await text("index.html");
  for (const id of ["panel-stages", "panel-help", "panel-pause", "panel-result"]) {
    assert.match(html, new RegExp(`<section id="${id}" class="panel" hidden`), id);
  }
  assert.ok((html.match(/data-close/g) ?? []).length >= 3);
});

test("标记：main 引用的所有 DOM id 都真实存在", async () => {
  const main = await text("js/main.mjs");
  const html = await text("index.html");
  const ids = [...main.matchAll(/getElementById\("([^"]+)"\)/g)].map((match) => match[1]);
  assert.ok(ids.length >= 30, `id 数量不足: ${ids.length}`);
  for (const id of new Set(ids)) {
    assert.match(html, new RegExp(`id="${id}"`), `缺少 #${id}`);
  }
});

test("标记：所有 data-i18n 键都在中英双表存在", async () => {
  const html = await text("index.html");
  const keys = [
    ...[...html.matchAll(/data-i18n="([^"]+)"/g)].map((match) => match[1]),
    ...[...html.matchAll(/data-i18n-aria="([^"]+)"/g)].map((match) => match[1]),
  ];
  assert.ok(keys.length >= 20);
  for (const key of keys) {
    assert.ok(strings.zh[key], `zh 缺少 ${key}`);
    assert.ok(strings.en[key], `en 缺少 ${key}`);
  }
});

test("源码：除 i18n 表外零裸写中文", async () => {
  const files = (await readdir(join(GAME, "js"))).filter((name) => name.endsWith(".mjs") && name !== "i18n.mjs");
  assert.ok(files.length >= 8);
  for (const file of files) {
    const source = await readFile(join(GAME, "js", file), "utf8");
    assert.equal(/[\u4e00-\u9fff]/.test(source), false, `${file} 含裸写中文`);
  }
});

test("源码：引擎与计分保持 DOM-free", async () => {
  for (const file of ["engine.mjs", "game.mjs", "levels.mjs", "score.mjs"]) {
    const source = await readFile(join(GAME, "js", file), "utf8");
    assert.equal(/\b(document|window|localStorage)\b/.test(source), false, `${file} 触碰了浏览器对象`);
  }
});

test("源码：存档键与语言键集中且唯一", async () => {
  const storage = await text("js/storage.mjs");
  const i18n = await text("js/i18n.mjs");
  assert.match(storage, /STORAGE_KEY = "doin\.raiden\.v1"/);
  assert.match(i18n, /LANG_KEY = "doin\.lang"/);
  const main = await text("js/main.mjs");
  assert.equal(main.includes("location.reload"), false);
});

test("源码：音色为 WebAudio 程序化合成并含蓄力循环", async () => {
  const audio = await text("js/audio.mjs");
  assert.match(audio, /AudioContext/);
  assert.match(audio, /createGain/);
  assert.match(audio, /charge\(active, level/);
  assert.match(audio, /createBufferSource/);
  assert.match(audio, /laser\(\)/);
  assert.match(audio, /bomb\(\)/);
  assert.equal(/\.mp3|\.ogg|\.wav/.test(audio), false);
});

test("样式：竖版舞台、触控拦截与安全区", async () => {
  const css = await text("css/style.css");
  assert.match(css, /aspect-ratio:\s*3\s*\/\s*5/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /#touch-deck/);
  assert.match(css, /@media \(max-width: 900px\)/);
});

test("门户：games.json 已登记且路径、封面、双语正确", async () => {
  const data = JSON.parse(await readFile(join(ROOT, "games.json"), "utf8"));
  const entry = (data.games ?? data).find((item) => item.slug === "raiden");
  assert.ok(entry, "games.json 缺少 raiden");
  assert.equal(entry.url, "/raiden/");
  assert.equal(entry.cover, "/assets/covers/raiden.webp");
  assert.ok(entry.title);
  assert.ok(entry.desc);
  assert.ok(entry.en?.title);
  assert.ok(entry.en?.desc);
  assert.ok(Array.isArray(entry.tags) && entry.tags.length >= 3);
  assert.ok(existsSync(join(ROOT, "assets", "covers", "raiden.webp")));
});

test("门户：根脚本注册测试与冒烟入口", async () => {
  const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
  assert.match(pkg.scripts["test:raiden"], /games\/raiden\/tests\/.*\.test\.mjs/);
  assert.match(pkg.scripts["smoke:raiden"], /games\/raiden\/tests\/smoke\.mjs/);
});
