import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "css", "style.css"), "utf8");
const main = readFileSync(join(root, "js", "main.mjs"), "utf8");
const audio = readFileSync(join(root, "js", "audio.mjs"), "utf8");
const games = JSON.parse(readFileSync(join(root, "..", "..", "games.json"), "utf8"));
const pkg = JSON.parse(readFileSync(join(root, "..", "..", "package.json"), "utf8"));

test("标记：文档骨架、SEO 与可访问性齐备", () => {
  assert.match(html, /^<!DOCTYPE html>/i);
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /name="viewport"[^>]*viewport-fit=cover/);
  assert.match(html, /name="description"/);
  assert.match(html, /rel="icon"[^>]*favicon\.svg/);
  assert.match(html, /<noscript>/);
  assert.match(html, /<title>雪人兄弟/);
});

test("标记：返回门户、模块脚本与缓存占位齐全", () => {
  assert.match(html, /<a href="\/" id="back-home"/);
  assert.match(html, /<script type="module" src="js\/main\.mjs\?v=dev"><\/script>/);
  assert.match(html, /css\/style\.css\?v=dev/);
  const assets = [...html.matchAll(/(?:src|href)="(?!\/|#|data:)([^"]+)"/g)].map((match) => match[1]);
  for (const asset of assets) {
    if (asset.startsWith("../")) continue;
    assert.match(asset, /\?v=dev$/, `资源缺少 ?v=dev：${asset}`);
  }
});

test("标记：五个浮层均为隐藏纸页，含关卡册与结算", () => {
  const panels = [...html.matchAll(/<section id="(panel-[a-z]+)" class="panel" hidden/g)].map((match) => match[1]);
  assert.deepEqual(panels.sort(), ["panel-help", "panel-levels", "panel-mode", "panel-pause", "panel-result"]);
  assert.equal((html.match(/class="sheet/g) ?? []).length, 5);
  assert.match(html, /id="level-groups"/);
  assert.match(html, /id="result-rows"/);
  assert.match(html, /id="btn-mode-level"/);
  assert.match(html, /id="btn-mode-rush"/);
});

test("标记：main 引用的所有 DOM id 都真实存在", () => {
  const ids = new Set([...main.matchAll(/getElementById\("([^"]+)"\)/g)].map((match) => match[1]));
  assert.ok(ids.size >= 35, `引用的 id 数量异常：${ids.size}`);
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`), `HTML 缺少 #${id}`);
});

test("标记：舞台与移动端操作区齐备", () => {
  assert.match(html, /<canvas id="stage"[^>]*width="960"[^>]*height="540"/);
  assert.match(html, /id="btn-spray"/);
  assert.match(html, /id="btn-jump"/);
  assert.match(html, /id="stick"/);
  assert.match(html, /id="key-hint"/);
  assert.match(html, /data-i18n="spray"/);
  assert.match(html, /data-i18n="jump"/);
});

test("标记：无外链资源、无内联事件、无 alert", () => {
  assert.equal(/https?:\/\//.test(html), false);
  assert.equal(/\son[a-z]+=/.test(html), false);
  assert.equal(/alert\(/.test(main), false);
  assert.equal(/new Audio\(/.test(audio), false);
});

test("样式：沉浸机台、触控拦截与动效降级", () => {
  assert.match(css, /100dvh/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /overscroll-behavior:\s*none/);
  assert.match(css, /env\(safe-area-inset-bottom/);
  assert.match(css, /max\(70px,\s*calc\(env\(safe-area-inset-bottom/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /translateY\(2px\)/);
  assert.match(css, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(css, /\.panel\s*\{[^}]*position:\s*fixed/s);
});

test("音色：WebAudio 程序化合成，喷雪与滚动均为连续循环", () => {
  assert.match(audio, /AudioContext/);
  assert.match(audio, /createBiquadFilter/);
  assert.match(audio, /createBuffer/);
  assert.match(audio, /spray\(/);
  assert.match(audio, /roll\(/);
  const sounds = ["jump", "land", "freeze", "push", "hit", "bounce", "chain", "clear", "hurt", "item", "brick", "spring", "boss"];
  for (const name of sounds) {
    assert.match(audio, new RegExp(`\\b${name}\\s*\\(`), `缺少音色 ${name}`);
  }
});

test("门户：games.json 已登记且路径、封面、双语正确", () => {
  const entry = games.games.find((game) => game.slug === "snowball" || game.url === "/snowball/");
  assert.ok(entry, "games.json 缺少 snowball");
  assert.equal(entry.url, "/snowball/");
  assert.equal(entry.cover, "/assets/covers/snowball.webp");
  assert.ok(entry.en && entry.en.title && entry.en.desc);
});

test("门户：根脚本注册测试与冒烟入口", () => {
  assert.match(pkg.scripts["test:snowball"] ?? "", /games\/snowball\/tests/);
  assert.match(pkg.scripts["smoke:snowball"] ?? "", /tests\/smoke\.mjs/);
});

test("存档：唯一键为 doin.snowball.v1 且集中封装", () => {
  const storage = readFileSync(join(root, "js", "storage.mjs"), "utf8");
  assert.match(storage, /doin\.snowball\.v1/);
  assert.match(storage, /try\s*\{/);
  assert.match(storage, /catch/);
});
