import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const css = readFileSync(resolve(root, "css", "style.css"), "utf8");
const main = readFileSync(resolve(root, "js", "main.mjs"), "utf8");
const engine = readFileSync(resolve(root, "js", "engine.mjs"), "utf8");
const render = readFileSync(resolve(root, "js", "render.mjs"), "utf8");
const ui = readFileSync(resolve(root, "js", "ui.mjs"), "utf8");
const audio = readFileSync(resolve(root, "js", "audio.mjs"), "utf8");
const storage = readFileSync(resolve(root, "js", "storage.mjs"), "utf8");
const i18nSource = readFileSync(resolve(root, "js", "i18n.mjs"), "utf8");

test("HTML 元信息与平台契约齐全", () => {
  assert.match(html, /<meta charset="UTF-8">/i);
  assert.match(html, /name="viewport"[^>]*viewport-fit=cover/);
  assert.match(html, /name="description"/);
  assert.match(html, /rel="icon"/);
  assert.match(html, /<html[^>]+lang="zh-CN"/);
  assert.match(html, /<noscript[\s\S]*<\/noscript>/);
  assert.match(html, /id="back-home"/);
  assert.match(html, /href="\/"/);
  assert.match(html, /favicon\.svg/);
});

test("缓存占位：CSS 与入口脚本都带 ?v=dev，且不使用 location.reload", () => {
  assert.match(html, /css\/style\.css\?v=dev/);
  assert.match(html, /js\/main\.mjs\?v=dev/);
  const sources = [main, ui, engine, render, storage].join("\n");
  assert.equal(sources.includes("location.reload"), false);
  assert.equal(sources.includes("window.location.reload"), false);
});

test("引擎保持 DOM-free，渲染层才允许触碰 document/Canvas", () => {
  for (const token of ["document.", "window.", "localStorage", "sessionStorage", "requestAnimationFrame"]) {
    assert.equal(engine.includes(token), false, `engine 混入 ${token}`);
  }
  assert.match(render, /getContext\("2d"\)/);
  assert.match(render, /document\.createElement/);
});

test("不使用第三方库、WebGL 或外链字体", () => {
  const all = [html, css, main, engine, render, ui, audio].join("\n");
  assert.equal(/<script[^>]+src="https?:/i.test(html), false);
  assert.equal(/@import\s+url\(/i.test(css), false);
  assert.equal(/fonts\.googleapis|use\.typekit|cdn\./i.test(all), false);
  assert.equal(/webgl|three\.js|pixi/i.test(all), false);
});

test("舞台采用 16:9 缩放容器，移动端有底部安全区与触控约束", () => {
  assert.match(css, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(css, /--stage-scale/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /overscroll-behavior:\s*none/);
  assert.match(css, /translateY\(2px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /radial-gradient/);
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
});

test("JS 引用的所有 id 都真实存在于 HTML", () => {
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
  const referenced = new Set();
  for (const source of [main, ui, render]) {
    for (const match of source.matchAll(/(?:must|\$|getElementById)\("([a-zA-Z0-9-]+)"\)/g)) {
      referenced.add(match[1]);
    }
  }
  const missing = [...referenced].filter((id) => !ids.has(id) && id !== "sound-glyph");
  assert.deepEqual(missing, []);
  assert.ok(ids.has("sound-glyph"));
  assert.ok(ids.has("hud-chapter"));
  assert.ok(ids.has("panel-levels"));
  assert.ok(ids.has("panel-result"));
});

test("人物由 DOM 骨架与 CSS 3D 造型构成，Canvas 仅负责粒子层", () => {
  assert.match(render, /fig-torso/);
  assert.match(render, /fig-head/);
  assert.match(render, /fig-arm/);
  assert.match(render, /fig-leg/);
  assert.match(render, /world-item/);
  assert.match(css, /\.fig-head/);
  assert.match(css, /\.fig-torso/);
  assert.match(css, /\.fig-arm/);
  assert.match(css, /preserve-3d|translateZ/);
  assert.match(css, /#fx[\s\S]*?pointer-events:\s*none/);
});

test("音效至少 8 种且全部由 WebAudio 合成", () => {
  assert.match(audio, /AudioContext/);
  assert.match(audio, /createBufferSource/);
  assert.match(audio, /createBiquadFilter/);
  assert.match(audio, /createOscillator/);
  const methods = ["light", "heavy", "launch", "land", "pickup", "heal", "special", "boss", "ko", "star", "clear", "lose", "click", "pause"];
  for (const method of methods) assert.match(audio, new RegExp(`\\b${method}\\(`), `缺少音效 ${method}`);
  assert.match(audio, /setMuted/);
  assert.match(audio, /unlock/);
});

test("语言偏好使用 doin.lang，存档读写有 try/catch 兜底", () => {
  assert.match(i18nSource, /LANG_KEY\s*=\s*"doin\.lang"/);
  assert.match(storage, /try\s*\{/);
  assert.match(storage, /catch/);
  assert.match(storage, /createMemoryFallback/);
  assert.match(main, /loadLocale/);
  assert.match(main, /saveLocale/);
  assert.match(main, /applyStatic/);
});

test("顶栏、HUD、选关与结算面板的结构齐备", () => {
  for (const id of [
    "top-bar", "mode-strip", "chalk-hud", "stage", "control-deck",
    "panel-levels", "panel-pause", "panel-result", "panel-continue", "panel-help",
    "hud-ko", "hud-wave", "hud-time", "hp-row-p1", "hp-row-p2",
    "result-stars", "res-ko", "res-score", "levels-body",
  ]) {
    assert.ok(html.includes(`id="${id}"`), `缺少 #${id}`);
  }
  assert.match(html, /data-i18n="levels"/);
  assert.match(html, /id="stick-pad"/);
  for (const action of ["light", "heavy", "jump", "use", "special"]) {
    assert.ok(html.includes(`id="act-${action}"`), `缺少 act-${action}`);
  }
});

test("所有运行脚本都在 js/ 目录且被 index.html 引用", () => {
  const files = readdirSync(resolve(root, "js")).filter((name) => name.endsWith(".mjs"));
  for (const name of ["main.mjs", "engine.mjs", "levels.mjs", "score.mjs", "render.mjs", "ui.mjs", "audio.mjs", "storage.mjs", "i18n.mjs"]) {
    assert.ok(files.includes(name), `缺少 js/${name}`);
  }
  assert.ok(html.includes("js/main.mjs"));
});
