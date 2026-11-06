// 泡泡射手 · 装配入口：绑定输入、固定刷新主循环、协调 audio/render/ui/存档

import { BobbleGame } from "./game.mjs";
import { BobbleRenderer } from "./render.mjs";
import { BobbleUI } from "./ui.mjs";
import { MODE, AIM } from "./engine.mjs";
import { dateSeed } from "./levels.mjs";
import { initAudio, setAudioEnabled, playEvent } from "./audio.mjs";
import { loadSave, saveSave, clearSave, defaultSave } from "./storage.mjs";
import { htmlLang, loadLocale } from "./i18n.mjs";
import { starsFor } from "./score.mjs";

document.documentElement.lang = htmlLang();

const save = loadSave();
const game = new BobbleGame();
const canvas = document.getElementById("board");
const renderer = new BobbleRenderer(canvas);
renderer.setAssist(save.assist);
game.loadStage(Math.min(save.stageUnlocked ?? 1, 30));
game.setAimTier(save.aim ?? AIM.EXTENDED);

const ui = new BobbleUI(game, save, {
  onSelectLevel: (id) => startStage(id),
  onSelectPuzzle: (id) => startPuzzle(id),
  onStartEndless: () => startEndless(),
  onStartDaily: () => startDaily(),
  onRetry: () => {
    const m = game.state?.mode;
    if (m === MODE.ENDLESS) startEndless();
    else if (m === MODE.DAILY) startDaily();
    else {
      game.restart();
      hideAll();
    }
  },
  onNextLevel: () => {
    const id = Math.min(30, (game.state.levelId ?? 1) + 1);
    startStage(id);
  },
  onToSelect: () => {
    ui.buildLevelGrid("stage");
    ui.showOverlay("start");
  },
  onToggleSound: () => {
    save.sound = !save.sound;
    setAudioEnabled(save.sound);
    saveSave(save);
    ui.applyLocale();
  },
  onAim: (tier) => {
    save.aim = tier;
    game.setAimTier(tier);
    saveSave(save);
    ui.applyAimChips();
  },
  onAssist: () => {
    save.assist = !save.assist;
    renderer.setAssist(save.assist);
    saveSave(save);
    ui.applyAssistChip();
  },
  onResetSave: () => {
    if (window.confirm(ui.t("saveResetConfirm"))) {
      clearSave();
      Object.assign(save, defaultSave());
      setAudioEnabled(true);
      renderer.setAssist(false);
      game.setAimTier(save.aim);
      ui.applyLocale();
      ui.buildLevelGrid("stage");
      ui.toast(ui.t("saveCleared"), 1.4);
      startStage(1);
    }
  },
  onLocale: () => ui.update(game.state)
});

// 隐藏所有浮层回到对局：必须走 ui 的统一入口，否则 ui.currentOverlay 与 DOM 双真相源打架
function hideAll() {
  ui.showOverlay("none");
}

function startStage(id) {
  game.loadStage(id);
  game.setAimTier(save.aim ?? AIM.EXTENDED);
  hideAll();
  ui.applyLocale();
}

function startPuzzle(id) {
  game.loadPuzzle(id);
  game.setAimTier(save.aim ?? AIM.EXTENDED);
  hideAll();
  ui.applyLocale();
}

function startEndless() {
  game.loadEndless((Date.now() ^ (save.endlessShots * 7919)) >>> 0);
  game.setAimTier(save.aim ?? AIM.EXTENDED);
  hideAll();
  ui.applyLocale();
}

function startDaily() {
  game.loadDaily(dateSeed(new Date()));
  game.setAimTier(save.aim ?? AIM.EXTENDED);
  hideAll();
  ui.applyLocale();
}

// 首次手势解锁音频
let audioReady = false;
function unlockAudio() {
  if (audioReady) return;
  audioReady = true;
  initAudio();
  setAudioEnabled(save.sound);
  window.removeEventListener("pointerdown", unlockAudio);
  window.removeEventListener("keydown", unlockAudio);
}
window.addEventListener("pointerdown", unlockAudio, { passive: true });
window.addEventListener("keydown", unlockAudio);

// ---------- 输入：鼠标 / 键盘 / 触屏 ----------
let dragging = false;
function pointerAim(evt) {
  const p = renderer.toLogical(evt.clientX, evt.clientY);
  game.aimAt(p.x, p.y);
}
canvas.addEventListener("pointerdown", (evt) => {
  dragging = true;
  canvas.setPointerCapture?.(evt.pointerId);
  pointerAim(evt);
  evt.preventDefault();
});
canvas.addEventListener("pointermove", (evt) => {
  if (!dragging) return;
  pointerAim(evt);
});
canvas.addEventListener("pointerup", (evt) => {
  if (!dragging) return;
  dragging = false;
  pointerAim(evt);
  game.fire();
});
canvas.addEventListener("pointercancel", () => {
  dragging = false;
});
canvas.addEventListener("contextmenu", (evt) => {
  evt.preventDefault();
  game.swap();
});

window.addEventListener("keydown", (evt) => {
  // 暂停时只放行暂停切换键，其余操作一律忽略（game.fire/swap/togglePick/setAngle 也已 guarded）
  if (game.paused) {
    if (evt.key === "p" || evt.key === "P" || evt.key === "Escape") {
      ui.togglePause();
      evt.preventDefault();
    }
    return;
  }
  const fine = evt.shiftKey ? 0.004 : 0.022;
  if (evt.key === "ArrowLeft") {
    game.nudge(-fine);
    evt.preventDefault();
  } else if (evt.key === "ArrowRight") {
    game.nudge(fine);
    evt.preventDefault();
  } else if (evt.key === " " || evt.key === "ArrowUp" || evt.key === "Enter") {
    game.fire();
    evt.preventDefault();
  } else if (evt.key === "s" || evt.key === "S") {
    game.swap();
  } else if (evt.key === "k" || evt.key === "K") {
    game.togglePick();
  } else if (evt.key === "r" || evt.key === "R") {
    game.restart();
    hideAll();
  } else if (evt.key === "p" || evt.key === "P" || evt.key === "Escape") {
    ui.togglePause();
    evt.preventDefault();
  }
});

window.addEventListener("resize", () => renderer.resize());
window.addEventListener("orientationchange", () => setTimeout(() => renderer.resize(), 120));

// ---------- 事件分发：音效 + 粒子 + UI + 存档 ----------
game.subscribe((event, state) => {
  playEvent(event.type, event);
  renderer.feed([event], state);
  ui.onEvent(event, state);

  if (event.type === "win") {
    if (state.mode === MODE.STAGE) {
      const stars = starsFor(state.shots, state.target || 1);
      if (stars > (save.stars[state.levelId] ?? 0)) save.stars[state.levelId] = stars;
      if (state.levelId >= (save.stageUnlocked ?? 1) && state.levelId < 30) save.stageUnlocked = state.levelId + 1;
    } else if (state.mode === MODE.PUZZLE) {
      if (!save.puzzleSolved.includes(state.puzzleId)) save.puzzleSolved.push(state.puzzleId);
      save.puzzleSolved.sort((a, b) => a - b);
    } else if (state.mode === MODE.ENDLESS) {
      save.endlessShots = Math.max(save.endlessShots, state.shots);
      save.endlessChain = Math.max(save.endlessChain, state.maxChain);
      save.endlessScore = Math.max(save.endlessScore, state.score);
    } else if (state.mode === MODE.DAILY) {
      const seed = dateSeed(new Date());
      if (save.dailyDate !== seed) {
        save.dailyDate = seed;
        save.dailyShots = state.shots;
        save.dailyChain = state.maxChain;
      } else {
        save.dailyShots = Math.min(save.dailyShots || state.shots, state.shots);
        save.dailyChain = Math.max(save.dailyChain, state.maxChain);
      }
    }
    saveSave(save);
  } else if (event.type === "lose") {
    if (state.mode === MODE.ENDLESS) {
      save.endlessShots = Math.max(save.endlessShots, state.shots);
      save.endlessChain = Math.max(save.endlessChain, state.maxChain);
      save.endlessScore = Math.max(save.endlessScore, state.score);
      saveSave(save);
    }
  }
});

// ---------- 主循环 ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  game.step(dt);
  if (game.state) {
    game.state.preview = game.path();
  }
  renderer.tick(dt);
  renderer.render(game.state);
  ui.update(game.state);
  requestAnimationFrame(loop);
}

ui.showOverlay("start");
ui.update(game.state);
requestAnimationFrame(loop);

// 调试句柄（门户约定：每款游戏挂 window.__<slug>，方便排查与自动化）
if (typeof globalThis !== "undefined") {
  globalThis.__bobble = { game, ui, renderer };
}
