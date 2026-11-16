// 装配入口：存档 / 音效 / 回合制控制器 / Canvas 渲染 / DOM HUD。
// 语言切换原地热更新，绝不重置当前测试舱。

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
let ui = null;
let lastView = null;

const audio = createAudio({ muted: store.prefs.muted });
const renderer = createRenderer(document.getElementById("stage"), { locale });

const game = createGameController({
  onChange: (view) => {
    lastView = view;
    if (ui) {
      ui.render(view, store);
      handleResult(view);
    }
  },
});

ui = createUI({
  locale,
  handlers: {
    onMove: (dir) => {
      audio.unlock();
      game.move(dir);
      processEvents();
    },
    onUndo: () => {
      if (game.undo()) audio.undo();
      processEvents();
    },
    onReset: () => restartLevel(),
    onLevels: () => ui.openLayer("levels"),
    onNext: () => {
      const next = nextLevel(game.levelId);
      if (next) startLevel(next.id);
    },
    onRestart: () => restartLevel(),
    onPickLevel: (id) => startLevel(id),
    onSound: () => toggleSound(),
    onLang: () => toggleLang(),
    onResize: () => renderer.resize(),
  },
});

ui.setMuted(store.prefs.muted);
audio.setMuted(store.prefs.muted);

function startLevel(id) {
  const level = getLevel(id);
  if (!level) return;
  recordedResult = null;
  ui.hideResult();
  ui.closeLayer("levels");
  ui.closeLayer("help");
  renderer.reset();
  if (!game.start(level.id)) return;
  store.prefs.lastLevel = level.id;
  save(store);
  ui.buildLevels();
  ui.render(game.view(), store);
}

function restartLevel() {
  if (!game.levelId) return;
  startLevel(game.levelId);
  audio.reset();
  ui.toast(ui.t().resetToast);
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
  ui.hideToast();
  ui.setLocale(locale);
  renderer.setLocale(locale);
  ui.render(game.view(), store);
}

function processEvents() {
  const events = game.drainEvents();
  for (const event of events) {
    if (event.type === "push") audio.push();
    else if (event.type === "portal") audio.portal();
    else if (event.type === "blocked") {
      audio.bump();
      if (event.reason === "impedance") ui.toast(ui.t().blockedToast);
    } else if (event.type === "solved") {
      audio.clear();
      ui.toast(ui.t().clearToast);
    } else if (event.type === "undo") audio.undo();
  }
  renderer.addEvents(events);
}

function handleResult(view) {
  if (!view?.result || !view.level || recordedResult === view.state) return;
  recordedResult = view.state;
  const beforeBest = bestScoreFor(store, view.level.id);
  const payload = {
    stars: view.result.stars,
    steps: view.result.steps,
    optimal: view.result.optimal,
    score: view.result.score,
    best: Math.max(beforeBest, view.result.score),
    canNext: Boolean(nextLevel(view.level.id)),
  };
  store = applyLevelResult(store, view.level.id, view.result);
  save(store);
  ui.buildLevels();
  ui.closeLayer("levels");
  ui.closeLayer("help");
  ui.showResult(payload);
  reportSession({ score: view.result.score, stars: view.result.stars });
}

function reportSession(result) {
  const payload = {
    slug: "portalbox",
    outcome: "WON",
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
  const view = lastView ?? game.view();
  renderer.draw(view, { dt });
  requestAnimationFrame(frame);
}

function bootstrap() {
  renderer.setLocale(locale);
  ui.setMuted(store.prefs.muted);
  startLevel(store.prefs.lastLevel);
  requestAnimationFrame(frame);
}

bootstrap();
