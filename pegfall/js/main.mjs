// 装配入口：存档 / 音效 / 固定步长控制器 / Canvas 渲染 / DOM HUD。
// 语言切换与暂停都不重置钉板；只有明确开始新关卡才重建状态。

import { STATUS_AIM, traceAim } from "./engine.mjs";
import { getLevel, nextLevel } from "./levels.mjs";
import { createGameController } from "./game.mjs";
import { createRenderer } from "./render.mjs";
import { createUI } from "./ui.mjs";
import { createAudio } from "./audio.mjs";
import {
  applyLevelResult, bestScoreFor, load, save,
} from "./storage.mjs";
import { loadLocale, saveLocale } from "./i18n.mjs";

let store = load();
let locale = loadLocale();
let recordedResult = null;
let guide = null;
let guideAim = null;
let guideAt = 0;
let pausedByLayer = false;

const audio = createAudio({ muted: store.prefs.muted });

const game = createGameController();

const renderer = createRenderer(document.getElementById("stage"), { locale });

const ui = createUI({
  locale,
  handlers: {
    onAim: (deg) => {
      audio.unlock();
      game.aim(deg);
    },
    onNudge: (delta) => game.nudge(delta),
    onFire: () => {
      audio.unlock();
      game.shoot();
    },
    onFast: (enabled) => game.setFast(enabled),
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
  guide = null;
  guideAim = null;
  pausedByLayer = false;
  ui.hideResult();
  ui.closeLayer("pause");
  ui.closeLayer("help");
  renderer.reset();
  if (!game.start(level.id)) return;
  store.prefs.lastLevel = level.id;
  save(store);
  ui.buildLevels();
}

function togglePause(force) {
  const view = game.view();
  if (!view.state || view.result) return;
  const next = typeof force === "boolean" ? force : !view.paused;
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
    if (event.type === "fire") audio.cannon();
    else if (event.type === "peg") audio.peg(event.combo, event.pegType);
    else if (event.type === "split") {
      audio.green();
      ui.toast(ui.t().powerSplitToast);
    } else if (event.type === "guide") {
      audio.green();
      ui.toast(ui.t().powerGuideToast);
    } else if (event.type === "bucket") {
      audio.bucket();
      ui.toast(ui.t().freeBall);
    } else if (event.type === "pocket") {
      audio.pocket(event.value);
    } else if (event.type === "fever") {
      audio.fever();
      ui.toast(ui.t().feverToast);
    } else if (event.type === "lost") {
      audio.lose();
      ui.toast(ui.t().lostToast);
    }
  }
  renderer.addEvents(events);
}

function updateGuide(view, now) {
  const state = view.state;
  if (!state || state.status !== STATUS_AIM || view.paused || view.result) {
    guide = null;
    guideAim = null;
    return;
  }
  if (!guide || guideAim !== state.aim || now - guideAt > 120) {
    guide = traceAim(state, state.aim, { bounces: state.guideArmed ? 3 : 1 });
    guideAim = state.aim;
    guideAt = now;
  }
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
    ballsLeft: view.result.ballsLeft,
    best: Math.max(beforeBest, view.result.score),
    canNext: clear && Boolean(nextLevel(view.level.id)),
  };
  store = applyLevelResult(store, view.level.id, view.result);
  save(store);
  ui.buildLevels();
  ui.closeLayer("pause");
  ui.showResult(payload);
  reportSession({ won: clear, score: view.result.score, stars: view.result.stars });
}

function reportSession(result) {
  const payload = {
    slug: "pegfall",
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
  updateGuide(view, now);
  renderer.draw(view, { guide, dt });
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
