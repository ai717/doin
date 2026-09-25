// main.mjs: 云朵合成装配入口，协调输入、渲染、音频、存储与界面。

import { CloudGame } from "./game.mjs?v=79c518024932";
import { CloudRenderer } from "./render.mjs?v=79c518024932";
import { mountUI } from "./ui.mjs?v=79c518024932";
import { WORLD, MAX_LEVEL } from "./engine.mjs?v=79c518024932";
import {
  loadLocale,
  saveLocale,
  strings,
  htmlLang,
  format,
} from "./i18n.mjs?v=79c518024932";
import {
  load as loadStorage,
  recordResult,
  setSound as saveSound,
} from "./storage.mjs?v=79c518024932";
import * as audio from "./audio.mjs?v=79c518024932";

function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

window.addEventListener("DOMContentLoaded", () => {
  let locale = loadLocale();
  let t = strings(locale);
  document.documentElement.lang = htmlLang(locale);
  document.title = t.docTitle;

  const storageData = loadStorage();
  let isMuted = !storageData.sound;
  audio.setMuted(isMuted);

  const canvas = document.getElementById("game-canvas");
  canvas.width = WORLD.width;
  canvas.height = WORLD.height;

  const renderer = new CloudRenderer(canvas);
  const ui = mountUI(t);

  let currentMode = "endless";
  const game = new CloudGame({
    mode: currentMode,
    dateStr: getTodayStr(),
  });
  renderer.setLocale(locale);

  function getBestInfo() {
    const data = loadStorage();
    if (currentMode === "daily") {
      const today = getTodayStr();
      const daily = data.daily?.date === today ? data.daily : { best: 0, maxLevel: 1 };
      return { best: daily.best, bestLevel: daily.maxLevel };
    }
    return { best: data.endless.best, bestLevel: data.endless.maxLevel };
  }

  function refreshAllUI() {
    const st = game.getState();
    ui.applyTexts(st, { locale, muted: isMuted, t });
    ui.renderHud(st, getBestInfo());
    ui.renderCodex(st);
    ui.renderPreview(st);
    ui.setModeTabs(currentMode, game.isPlaying());
    ui.setDanger(st.isDanger);
  }

  // 监听游戏核心事件
  game.on("drop", () => {
    audio.playDrop();
    const st = game.getState();
    ui.renderPreview(st);
    ui.setModeTabs(currentMode, true);
  });

  game.on("merge", (evt) => {
    audio.playMerge(evt.level, evt.chain);
    renderer.addMergePuff(evt.cloud.x, evt.cloud.y, evt.level);
    const st = game.getState();
    ui.renderHud(st, getBestInfo());
    ui.renderCodex(st);
  });

  game.on("rain_clear", (evt) => {
    audio.playRain();
    audio.playThunder();
    for (const c of evt.cleared) {
      renderer.addRainSplash(c.x, c.y);
    }
    ui.toast(format(t.rainToast, { points: evt.points }));
    const st = game.getState();
    ui.renderHud(st, getBestInfo());
  });

  game.on("rainbow_collected", (evt) => {
    audio.playRainbow();
    renderer.addRainbowCelebration(evt.cloud.x, evt.cloud.y);
    ui.toast(format(t.rainbowToast, { points: evt.points }));
    const st = game.getState();
    ui.renderHud(st, getBestInfo());
  });

  game.on("game_over", (evt) => {
    audio.playGameOver();
    const curData = loadStorage();
    const saveRes = recordResult(curData, {
      kind: currentMode,
      score: evt.score,
      maxLevel: evt.maxLevel,
      maxChain: evt.maxChain,
      rainbows: evt.rainbows,
      date: getTodayStr(),
    });

    const tip =
      currentMode === "daily"
        ? format(t.resultTipDaily, { date: getTodayStr() })
        : t.resultTipEndless;

    ui.showResult(game.getState(), {
      best: saveRes.data[currentMode]?.best || evt.score,
      isNewBest: saveRes.isNewBest,
      tip,
    });
    ui.setModeTabs(currentMode, false);
  });

  game.on("state_change", () => {
    const st = game.getState();
    ui.setDanger(st.isDanger);
  });

  game.on("pause_change", ({ paused }) => {
    ui.setPauseLabel(paused);
    ui.showPause(paused);
  });

  // 指针与点击交互
  let isPointerDown = false;

  function getCanvasLogicalPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = WORLD.width / rect.width;
    const scaleY = WORLD.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (game.isPaused() || game.isGameOver()) return;

    const pos = getCanvasLogicalPos(e);
    // 优先判定是否点击了场上的 L10 彩虹云以进行收集
    const clouds = game.getState().clouds;
    for (let i = clouds.length - 1; i >= 0; i -= 1) {
      const c = clouds[i];
      if (c.level === MAX_LEVEL) {
        const dx = pos.x - c.x;
        const dy = pos.y - c.y;
        if (dx * dx + dy * dy <= (c.radius * 1.25) * (c.radius * 1.25)) {
          game.collectRainbow(c.id);
          return;
        }
      }
    }

    isPointerDown = true;
    game.setAim(pos.x);
  });

  window.addEventListener("pointermove", (e) => {
    if (!isPointerDown) return;
    const pos = getCanvasLogicalPos(e);
    game.setAim(pos.x);
  });

  window.addEventListener("pointerup", (e) => {
    if (!isPointerDown) return;
    isPointerDown = false;
    const pos = getCanvasLogicalPos(e);
    game.drop(pos.x);
  });

  // 键盘支持
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") return;
    if (e.key === "ArrowLeft") {
      game.setAim(game.getState().aimX - 16);
    } else if (e.key === "ArrowRight") {
      game.setAim(game.getState().aimX + 16);
    } else if (e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      game.drop();
    } else if (e.key === "Escape" || e.key === "p" || e.key === "P") {
      game.togglePause();
    }
  });

  // 界面按钮绑定
  ui.refs.soundBtn?.addEventListener("click", () => {
    isMuted = !isMuted;
    audio.setMuted(isMuted);
    saveSound(!isMuted);
    ui.setSoundLabel(isMuted);
  });

  ui.refs.langBtn?.addEventListener("click", () => {
    locale = locale === "zh" ? "en" : "zh";
    saveLocale(locale);
    t = strings(locale);
    renderer.setLocale(locale);
    document.documentElement.lang = htmlLang(locale);
    document.title = t.docTitle;
    refreshAllUI();
  });

  ui.refs.helpBtn?.addEventListener("click", () => {
    ui.showHelp(true);
  });
  ui.refs.helpCloseBtn?.addEventListener("click", () => {
    ui.showHelp(false);
  });

  ui.refs.modeEndless?.addEventListener("click", () => {
    if (game.isPlaying()) {
      ui.toast(t.toastModeLocked);
      return;
    }
    currentMode = "endless";
    game.restart("endless");
    refreshAllUI();
  });

  ui.refs.modeDaily?.addEventListener("click", () => {
    if (game.isPlaying()) {
      ui.toast(t.toastModeLocked);
      return;
    }
    currentMode = "daily";
    game.restart("daily", { dateStr: getTodayStr() });
    refreshAllUI();
  });

  ui.refs.pauseBtn?.addEventListener("click", () => {
    game.togglePause();
  });
  ui.refs.resumeBtn?.addEventListener("click", () => {
    game.setPause(false);
  });

  ui.refs.restartBtn?.addEventListener("click", () => {
    game.restart(currentMode, { dateStr: getTodayStr() });
    ui.hideModals();
    refreshAllUI();
  });

  ui.refs.readyStartBtn?.addEventListener("click", () => {
    ui.showReady(false);
    refreshAllUI();
  });

  ui.refs.startBtn?.addEventListener("click", () => {
    ui.showReady(false);
    if (!game.isPlaying()) {
      game.drop();
    }
  });

  ui.refs.resultRestartBtn?.addEventListener("click", () => {
    ui.showResult0();
    game.restart(currentMode, { dateStr: getTodayStr() });
    refreshAllUI();
  });

  // 渲染主循环
  let lastTime = performance.now();
  function loop(now) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    game.update(dt);
    renderer.render(game.getState(), dt);

    requestAnimationFrame(loop);
  }

  refreshAllUI();
  ui.showReady(true);
  requestAnimationFrame(loop);
});
