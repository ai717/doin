// 倒退贪吃蛇 Uncoil · 入口装配（绑定事件、驱动渲染循环、初始化文本）
//
// 分层纪律：本文件只做装配。规则在 engine / game，计分在 score，
// 存档在 storage，绘制在 render，DOM 在 ui。

import { UncoilGame, MODE } from "./game.mjs";
import { UncoilRenderer } from "./render.mjs";
import { UncoilUI } from "./ui.mjs";
import { UncoilAudio } from "./audio.mjs";
import { loadSave } from "./storage.mjs";
import { LEVELS } from "./levels.mjs";
import { htmlLang } from "./i18n.mjs";

const canvas = typeof document !== "undefined" ? document.getElementById("board") : null;
const save = loadSave();

const game = new UncoilGame();
const renderer = new UncoilRenderer(canvas);
const audio = new UncoilAudio();
const ui = new UncoilUI(typeof document !== "undefined" ? document : null);

audio.setEnabled(save.sound !== false);
ui.save = save;

const mq = globalThis.window && globalThis.window.matchMedia
  ? globalThis.window.matchMedia("(prefers-reduced-motion: reduce)")
  : null;
renderer.setReduced(!!(mq && mq.matches));

if (typeof document !== "undefined" && document.documentElement) {
  document.documentElement.lang = htmlLang();
}

ui.attach({ game, renderer, audio });

// 开局装载上一次的进度（纯展示，仍旧停在开始屏）
const startIndex = Math.max(0, Math.min(LEVELS.length - 1, save.unlocked - 1));
const first = LEVELS[startIndex] ?? LEVELS[0];
if (first) game.loadLevel(first.id, MODE.STAGE);
ui.resize();

let last = 0;
function frame(now) {
  const dt = last ? now - last : 16;
  last = now;
  renderer.tick(Math.min(64, Math.max(0, dt)));
  renderer.draw();
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(frame);
}
if (typeof requestAnimationFrame === "function") requestAnimationFrame(frame);

// 供无浏览器冒烟测试直接拿到装配好的实例
export { game, renderer, ui, audio };
