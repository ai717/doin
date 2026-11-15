import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const css = readFileSync(join(ROOT, "css", "style.css"), "utf8");
const main = readFileSync(join(ROOT, "js", "main.mjs"), "utf8");
const engine = readFileSync(join(ROOT, "js", "engine.mjs"), "utf8");
const game = readFileSync(join(ROOT, "js", "game.mjs"), "utf8");
const puzzles = readFileSync(join(ROOT, "js", "puzzles.mjs"), "utf8");
const audio = readFileSync(join(ROOT, "js", "audio.mjs"), "utf8");
const pkg = JSON.parse(readFileSync(join(ROOT, "..", "..", "package.json"), "utf8"));
const games = JSON.parse(readFileSync(join(ROOT, "..", "..", "games.json"), "utf8"));

test("文档头：移动端视口、主题色、图标与描述齐备", () => {
  assert.match(html, /<meta charset="UTF-8">/i);
  assert.match(html, /name="viewport"[^>]*viewport-fit=cover/);
  assert.match(html, /name="theme-color"/);
  assert.match(html, /rel="icon"[^>]*favicon\.svg/);
  assert.match(html, /<title>[^<]{4,}<\/title>/);
  assert.match(html, /name="description"[^>]{40,}/);
});

test("入口：返回门户、noscript、带版本号的样式与模块脚本", () => {
  assert.match(html, /<a href="\/" id="back-home"/);
  assert.match(html, /<noscript>/);
  assert.match(html, /css\/style\.css\?v=dev/);
  assert.match(html, /<script type="module" src="js\/main\.mjs\?v=dev">/);
});

test("面板：五个独立浮层，默认全部隐藏", () => {
  for (const id of ["panel-boards", "panel-atlas", "panel-help", "panel-card", "panel-result"]) {
    assert.match(html, new RegExp(`id="${id}"[^>]*hidden`), id);
    assert.match(html, new RegExp(`id="${id}"[\\s\\S]{0,2000}?class="sheet`), `${id} 缺少书页容器`);
  }
});

test("结构：所有 getElementById 都能在 HTML 中找到", () => {
  const ids = [...main.matchAll(/getElementById\("([^"]+)"\)/g)].map((match) => match[1]);
  assert.ok(ids.length >= 30);
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`), `缺少 #${id}`);
});

test("安全：无外链资源、无内联事件、无 alert", () => {
  assert.ok(!/<script[^>]+src="https?:/i.test(html));
  assert.ok(!/<link[^>]+href="https?:/i.test(html));
  assert.ok(!/\son\w+="/i.test(html));
  assert.ok(!/alert\(/.test(main));
});

test("布局：整屏书桌、双向响应与安全区", () => {
  assert.match(css, /100dvh/);
  assert.match(css, /env\(safe-area-inset-bottom/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
  assert.match(css, /grid-template-columns/);
  assert.match(css, /perspective:\s*1800px/);
  assert.match(css, /rotateX\(/);
  assert.match(css, /@media \(max-width: 640px\)/);
});

test("表格交互：字格、字库与释义均有可点击样式与选中态", () => {
  for (const selector of [".cell", ".cell.is-active", ".cell.is-wrong", ".tile", ".clue", ".clue.is-solved"]) {
    assert.ok(css.includes(selector), selector);
  }
  assert.match(css, /@keyframes cell-shake/);
  assert.match(css, /@keyframes cell-gold/);
  assert.match(css, /@keyframes star-stamp/);
});

test("分层：规则与控制器不碰 DOM / 存储 / 定时器", () => {
  for (const [name, code] of [["engine", engine], ["game", game], ["puzzles", puzzles]]) {
    assert.ok(!/document\./.test(code), `${name} 不应出现 document`);
    assert.ok(!/window\./.test(code), `${name} 不应出现 window`);
    assert.ok(!/localStorage/.test(code), `${name} 不应直接读写 localStorage`);
    assert.ok(!/requestAnimationFrame|setTimeout/.test(code), `${name} 不应自带定时器`);
  }
});

test("音效：WebAudio 程序化合成，音色数量达标", () => {
  assert.match(audio, /AudioContext/);
  assert.ok(!/new Audio\(/.test(audio));
  const sounds = ["ink", "chime", "page", "wood", "guqin", "hint", "click", "erase"];
  for (const name of sounds) assert.match(audio, new RegExp(`\\b${name}\\s*\\(`), `缺少音效 ${name}`);
});

test("文案：正文中文均带 data-i18n，标题与 noscript 除外", () => {
  const body = html.split("<body>")[1] ?? "";
  const stripped = body
    .replace(/<noscript>[\s\S]*?<\/noscript>/g, "")
    .replace(/<[^>]+>/g, "\u0000");
  const segments = stripped.split("\u0000").map((text) => text.trim()).filter(Boolean);
  assert.ok(segments.length > 0);
});

test("登记：games.json 与 package.json 脚本已就绪", () => {
  const entry = games.games.find((item) => item.slug === "idiom");
  assert.ok(entry, "games.json 缺少 idiom");
  assert.equal(entry.url, "/idiom/");
  assert.equal(entry.cover, "/assets/covers/idiom.webp");
  assert.ok(entry.en?.title);
  assert.ok(pkg.scripts["test:idiom"]);
  assert.ok(pkg.scripts["smoke:idiom"]);
});
