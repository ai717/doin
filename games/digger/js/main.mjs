// 装配入口：存档 / 音效 / 固定步长控制器 / Canvas 渲染 / DOM HUD。
// 语言切换与暂停都绝不重置地层；只有明确开始新关卡才重建状态。

import { getLevel, nextLevel } from "./levels.mjs";
import { createGameController } from "./game.mjs";
import { createRenderer } from "./render.mjs";
import { createUI } from "./ui.mjs";
import { createAudio } from "./audio.mjs";
import { applyLevelResult, bestScoreFor, load, save } from "./storage.mjs";
import { loadLocale, saveLocale } from "./i18n.mjs";

let store = load();
let locale = loadLocale();
let recordedResult = null;
let pausedByLayer = false;

const audio = createAudio({ muted: store.prefs.muted });
const game = createGameController();
const renderer = createRenderer(document.getElementById("stage"), { locale });

const ui = createUI({
  locale,
  handlers: {
    onMove: (dir) => {
      audio.unlock();
      game.move(dir);
    },
    onStop: (dir) => game.stop(dir),
    onPump: () => {
      audio.unlock();
      game.firePump();
    },
    onPause: () => togglePause(),
    onRestart: () => startLevel(game.levelId ?? store.prefs.lastLevel),
    onLevels: () => ui.openLayer("levels"),
    onNext: () => {
      const next = nextLevel(game.levelId);
      if (next) startLevel(next.id);
    },
    onPickLevel: (id) => startLevel(id),
    onSound: () => toggleSound(),
    onLang: () => toggleLang(),
    onResize: () => renderer.resize(),
    onLayerOpen: (name) => {
      if (name === "levels" || name === "help") {
        pausedByLayer = !game.view().paused;
        game.pause(true);
      }
    },
    onLayerClose: (name) => {
      if (name === "levels" || name === "help") {
        if (pausedByLayer && !game.view().result) game.pause(false);
        pausedByLayer = false;
      }
    },
    onAutoPause: () => {
      const view = game.view();
      if (view.result || view.paused) return;
      togglePause(true);
    },
  },
});

ui.setMuted(store.prefs.muted);
audio.setMuted(store.prefs.muted);

function startLevel(id) {
  const level = getLevel(id);
  if (!level) return;
  recordedResult = null;
  pausedByLayer = false;
  ui.hideResult();
  ui.closeLayer("pause");
  ui.closeLayer("help");
  ui.closeLayer("levels");
  renderer.reset();
  if (!game.start(level.id)) return;
  store.prefs.lastLevel = level.id;
  save(store);
  ui.buildLevels();
  ui.render(game.view(), store);
}

function togglePause(force) {
  const view = game.view();
  if (!view.state || view.result) return;
  const next = typeof force === "boolean" ? force : !view.paused;
  if (next === view.paused) return;
  game.pause(next);
  if (next) {
    audio.pause();
    ui.openLayer("pause");
  } else {
    ui.closeLayer("pause");
  }
}

function toggleSound() {
  const muted = !audio.isMuted();
  audio.setMuted(muted);
  store.prefs.muted = muted;
  save(store);
  ui.setMuted(muted);
  if (!muted) {
    audio.unlock();
    audio.click();
  }
}

function toggleLang() {
  locale = locale === "zh" ? "en" : "zh";
  saveLocale(locale);
  ui.setLocale(locale);
  renderer.setLocale(locale);
  ui.render(game.view(), store);
}

function handleEvents(events) {
  for (const event of events) {
    if (event.type === "dig") audio.dig();
    else if (event.type === "fossil") {
      audio.fossil();
      ui.toast(ui.t().fossilToast);
    } else if (event.type === "pump-miss") audio.pumpShoot();
    else if (event.type === "pump-hit") audio.pumpHit(event.inflation);
    else if (event.type === "burst") {
      audio.burst();
      ui.toast(ui.t().burstToast);
    } else if (event.type === "rock-fall") audio.rockCreak();
    else if (event.type === "rock-shatter") audio.rockCrash();
    else if (event.type === "rock-kill") {
      audio.crush();
      ui.toast(ui.t().crushedToast);
    } else if (event.type === "charge") audio.charge();
    else if (event.type === "flame") audio.flame();
    else if (event.type === "ghost" || event.type === "escape") audio.ghost();
    else if (event.type === "panic") audio.charge();
    else if (event.type === "death") {
      audio.death();
      ui.toast(ui.t().deathToast);
    } else if (event.type === "won") {
      audio.clear();
      ui.toast(ui.t().clearToast);
    } else if (event.type === "lost") {
      audio.lose();
      ui.toast(ui.t().lostToast);
    }
  }
  renderer.addEvents(events);
}

function handleResult(view) {
  if (!view.result || !view.level || recordedResult === view.state) return;
  recordedResult = view.state;
  const beforeBest = bestScoreFor(store, view.level.id);
  const clear = view.result.outcome === "clear";
  const payload = {
    clear,
    stars: view.result.stars,
    score: view.result.score,
    fossils: view.result.fossils,
    best: Math.max(beforeBest, view.result.score),
    canNext: clear && Boolean(nextLevel(view.level.id)),
  };
  store = applyLevelResult(store, view.level.id, view.result);
  save(store);
  ui.buildLevels();
  ui.closeLayer("pause");
  ui.closeLayer("help");
  ui.closeLayer("levels");
  ui.showResult(payload);
  reportSession({ won: clear, score: view.result.score, stars: view.result.stars });
}

function reportSession(result) {
  const payload = {
    slug: "digger",
    outcome: result.won ? "WON" : "LOST",
    score: result.score ?? 0,
    stars: result.stars ?? 0,
    timestamp: Date.now(),
  };
  try {
    const meta = JSON.parse(localStorage.getItem("doin.meta.v1") || "{}");
    meta.recentlyPlayed = [payload.slug, ...(meta.recentlyPlayed || []).filter((slug) => slug !== payload.slug)].slice(0, 8);
    meta.totalStars = (meta.totalStars || 0) + (payload.stars || 0);
    localStorage.setItem("doin.meta.v1", JSON.stringify(meta));
  } catch (error) {
    // 存储不可用时静默
  }
  if (typeof window !== "undefined" && window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "DOIN_GAME_EVENT", payload }, "*");
  }
}

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  game.tick(dt * 1000);
  const events = game.drainEvents();
  if (events.length) handleEvents(events);

  const view = game.view();
  renderer.draw(view, { dt });
  ui.render(view, store);
  handleResult(view);
  requestAnimationFrame(frame);
}

function bootstrap() {
  renderer.setLocale(locale);
  ui.setMuted(store.prefs.muted);
  startLevel(store.prefs.lastLevel);
  requestAnimationFrame(frame);
}

bootstrap();
