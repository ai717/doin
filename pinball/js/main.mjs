// 霓虹弹珠台 · 装配入口：绑定事件、启动固定步长主循环、协调 audio/render/ui/存档

import { PinballGame } from "./game.mjs";
import { PinballRenderer } from "./render.mjs";
import { PinballUI } from "./ui.mjs";
import { MODE } from "./engine.mjs";
import { initAudio, setAudioEnabled, playEvent } from "./audio.mjs";
import { loadSave, saveSave, clearSave } from "./storage.mjs";
import { htmlLang } from "./i18n.mjs";

document.documentElement.lang = htmlLang();

const save = loadSave();
const game = new PinballGame({ mode: MODE.STAGE, levelId: Math.min(save.unlockedLevel, 30) });
const canvas = document.getElementById("board");
const renderer = new PinballRenderer(canvas);

const ui = new PinballUI(game, {
  getSave: () => save,
  onSelectLevel: (id) => game.loadLevel(id),
  onStartSurvival: () => game.loadSurvival(Math.floor(Date.now() % 100000)),
  onNextLevel: (levelId) => {
    if (levelId < 30) game.loadLevel(levelId + 1);
    else { ui.buildLevelGrid(); ui.showOverlay("start"); }
  },
  onRetry: (levelId) => game.loadLevel(levelId),
  onToSelect: () => { ui.buildLevelGrid(); ui.showOverlay("start"); },
  onToggleSound: () => {
    save.sound = !save.sound;
    setAudioEnabled(save.sound);
    saveSave(save);
    ui.applyLocale();
  },
  onResetSave: () => {
    if (window.confirm(ui.t("saveResetConfirm"))) {
      clearSave();
      Object.assign(save, {
        sound: true,
        unlockedLevel: 1,
        stars: {},
        bestSurvivalScore: 0,
        bestSurvivalCombo: 0
      });
      setAudioEnabled(true);
      ui.save = save;
      ui.applyLocale();
      ui.buildLevelGrid();
      ui.toast(ui.t("saveCleared"), 1.4);
    }
  }
});

// 重置存档按钮
const resetBtn = document.getElementById("btn-reset-save");
if (resetBtn) resetBtn.addEventListener("click", () => ui.hooks.onResetSave());

// 首次手势解锁音频（音效偏好即时生效）
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

// 事件分发：音效 + 粒子 + UI 浮层 + 存档落盘
game.subscribe((event, state) => {
  playEvent(event.type, event);
  renderer.feed([event]);
  ui.onEvent(event, state);

  if (event.type === "stage_clear") {
    const stars = state.stars;
    if (stars > (save.stars[state.levelId] ?? 0)) save.stars[state.levelId] = stars;
    if (state.levelId < 30 && state.levelId >= save.unlockedLevel) save.unlockedLevel = state.levelId + 1;
    saveSave(save);
  } else if (event.type === "game_over") {
    if (state.score > save.bestSurvivalScore) save.bestSurvivalScore = state.score;
    if (state.maxCombo > save.bestSurvivalCombo) save.bestSurvivalCombo = state.maxCombo;
    saveSave(save);
  }
});

// 固定步长主循环（渲染层 60fps 插值展示，逻辑 120Hz 确定性推进）
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  game.step(dt);
  renderer.tick(dt);
  renderer.render(game.state);
  ui.update(game.state);
  requestAnimationFrame(loop);
}

ui.showOverlay("start");
requestAnimationFrame(loop);
