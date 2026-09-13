// filepath: games/bubble-bloom/js/main.mjs

// 装配入口：i18n / storage / audio / render / ui / game 的绑定与事件分发。

import { createAudio } from "./audio.mjs?v=dev";
import { PHASE, WORLD, hashSeed } from "./engine.mjs?v=dev";
import { createGame } from "./game.mjs?v=dev";
import { detectLocale, saveLocale } from "./i18n.mjs?v=dev";
import { createRenderer } from "./render.mjs?v=dev";
import { loadData, recordRun, saveData, setSound, unlockTier } from "./storage.mjs?v=dev";
import { createUI } from "./ui.mjs?v=dev";

function todayKey() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const board = document.getElementById("board");
const chamberWrap = document.getElementById("chamber-wrap");
const cvCurrent = document.getElementById("cv-current");
const cvNext = document.getElementById("cv-next");

let data = loadData();
let locale = detectLocale();
let mode = "standard";
let dateKey = todayKey();
let lastCurrent = 0;
let lastNext = 0;

const audio = createAudio();
audio.setMuted(!data.sound);

const renderer = createRenderer({ board, current: cvCurrent, next: cvNext });

const ui = createUI({
  onStart: handleStart,
  onMode: handleMode,
  onPulse: handlePulse,
  onPauseToggle: handlePauseToggle,
  onRestart: handleRestart,
  onHelp: () => {
    audio.unlock();
    ui.showHelp();
  },
  onSound: handleSound,
  onLang: handleLang
});

const game = createGame({
  onFrame: handleFrame,
  onEvents: handleEvents
});

function bestFor(currentMode) {
  if (currentMode === "daily") {
    return data.daily.date === dateKey ? data.daily.score : 0;
  }
  return data.best.score;
}

function syncSpecimens(force) {
  const state = game.getState();
  if (force || state.current !== lastCurrent) {
    renderer.drawSpecimen(cvCurrent, state.current);
    lastCurrent = state.current;
  }
  if (force || state.next !== lastNext) {
    renderer.drawSpecimen(cvNext, state.next);
    lastNext = state.next;
  }
  ui.setSpecimenText(state.current, state.next);
}

function newRun(nextMode) {
  mode = nextMode === "daily" ? "daily" : "standard";
  dateKey = todayKey();
  const seed =
    mode === "daily"
      ? hashSeed(`bubble-bloom-${dateKey}`)
      : ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  game.newRun(mode, seed);
  renderer.reset();
  lastCurrent = 0;
  lastNext = 0;
  ui.hideModal();
  ui.setMode(mode, dateKey);
  ui.showOverlay("ready");
  syncSpecimens(true);
  ui.updateHud(game.getState(), bestFor(mode));
}

function handleStart() {
  audio.unlock();
  const state = game.getState();
  if (state.phase === PHASE.ready) {
    game.beginRun();
    ui.hideOverlay();
  } else if (state.phase === PHASE.paused) {
    game.resumeRun();
    ui.hideOverlay();
  }
}

function handleMode(next) {
  audio.unlock();
  if (next === mode) return;
  newRun(next);
}

function handleRestart() {
  audio.unlock();
  newRun(mode);
}

function handlePauseToggle() {
  audio.unlock();
  const state = game.getState();
  if (state.phase === PHASE.playing) {
    game.pauseRun();
    ui.showOverlay("pause");
  } else if (state.phase === PHASE.paused) {
    game.resumeRun();
    ui.hideOverlay();
  }
}

function handlePulse() {
  audio.unlock();
  const state = game.getState();
  if (state.phase !== PHASE.playing) return;
  if (state.pulses <= 0) {
    ui.toast("toast.pulseEmpty");
    return;
  }
  if (state.pulseCooldown > 0) {
    ui.toast("toast.pulseCd", { s: Math.ceil(state.pulseCooldown) });
    return;
  }
  game.pulse();
}

function handleSound() {
  const next = audio.isMuted();
  audio.setMuted(!next);
  data = saveData(setSound(data, !audio.isMuted()));
  ui.setSound(!audio.isMuted());
  if (!audio.isMuted()) audio.play("ui");
}

function handleLang() {
  locale = locale === "zh" ? "en" : "zh";
  saveLocale(locale);
  ui.setLocale(locale);
  ui.setMode(mode, dateKey);
  ui.setSound(!audio.isMuted());
  ui.renderCodex(data.codex);
  const state = game.getState();
  if (state.phase !== PHASE.playing) {
    ui.showOverlay(state.phase === PHASE.paused ? "pause" : "ready");
  }
  syncSpecimens(true);
  audio.play("ui");
}

function persistCodex(tier) {
  const result = unlockTier(data, tier);
  if (!result.changed) return;
  data = result.data;
  data = saveData(data);
  ui.renderCodex(data.codex);
}

function handleEvents(events) {
  renderer.handleEvents(events);
  for (let i = 0; i < events.length; i += 1) {
    const ev = events[i];
    if (ev.type === "drop") {
      audio.play("drop");
    } else if (ev.type === "merge") {
      audio.play("merge", { tier: ev.tier, chain: ev.chain });
      if (ev.chain >= 2) ui.showChain(ev.chain);
      persistCodex(ev.tier);
    } else if (ev.type === "bloom") {
      audio.play("bloom");
      ui.showChain(Math.max(ev.chain, 2));
      if (!data.badges.bloom) {
        data.badges.bloom = true;
        data = saveData(data);
      }
    } else if (ev.type === "pulse") {
      audio.play("pulse");
      ui.toast("toast.pulseOk", { left: ev.left });
    } else if (ev.type === "over") {
      audio.play("over");
      handleOver(ev.result);
    }
  }
}

function handleOver(result) {
  if (!result) return;
  const recorded = recordRun(data, {
    mode: result.mode,
    date: dateKey,
    score: result.score,
    tier: result.maxTier,
    chain: result.maxChain,
    drops: result.drops,
    bloomed: result.bloomed
  });
  data = recorded.data;
  if (result.maxChain >= 3) data.badges.chain3 = true;
  if (result.maxTier >= 10) data.badges.king = true;
  data = saveData(data);
  ui.renderCodex(data.codex);
  ui.showResult(result, { isRecord: recorded.isRecord });
}

function handleFrame(state, dt) {
  renderer.render(state, dt);
  ui.updateHud(state, bestFor(state.mode));
  if (state.current !== lastCurrent || state.next !== lastNext) syncSpecimens(false);
}

function toWorldX(clientX) {
  const rect = board.getBoundingClientRect();
  if (!rect.width) return WORLD.width / 2;
  return ((clientX - rect.left) / rect.width) * WORLD.width;
}

let aiming = false;

if (board) {
  board.addEventListener("pointerdown", (event) => {
    if (ui.isModalOpen()) return;
    audio.unlock();
    const state = game.getState();
    if (state.phase === PHASE.ready || state.phase === PHASE.paused) {
      handleStart();
      return;
    }
    if (state.phase !== PHASE.playing) return;
    aiming = true;
    if (board.setPointerCapture && event.pointerId != null) {
      try {
        board.setPointerCapture(event.pointerId);
      } catch (error) {
        /* 某些浏览器不支持指针捕获，忽略 */
      }
    }
    game.aim(toWorldX(event.clientX));
  });

  board.addEventListener("pointermove", (event) => {
    if (!aiming) return;
    game.aim(toWorldX(event.clientX));
  });

  board.addEventListener("pointerup", (event) => {
    if (!aiming) return;
    aiming = false;
    game.aim(toWorldX(event.clientX));
    game.drop();
  });

  board.addEventListener("pointercancel", () => {
    aiming = false;
  });

  board.addEventListener("contextmenu", (event) => event.preventDefault());
}

window.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const state = game.getState();
  const key = event.key;

  if (key === "ArrowLeft" || key === "ArrowRight") {
    if (state.phase !== PHASE.playing) return;
    const delta = (event.shiftKey ? 26 : 11) * (key === "ArrowLeft" ? -1 : 1);
    game.nudge(delta);
    event.preventDefault();
    return;
  }

  if (key === " " || key === "Enter" || key === "Spacebar") {
    if (ui.isModalOpen()) return;
    audio.unlock();
    if (state.phase === PHASE.ready || state.phase === PHASE.paused) handleStart();
    else if (state.phase === PHASE.playing) game.drop();
    event.preventDefault();
    return;
  }

  if (key === "t" || key === "T") {
    handlePulse();
    return;
  }
  if (key === "p" || key === "P") {
    handlePauseToggle();
    return;
  }
  if (key === "r" || key === "R") {
    handleRestart();
    return;
  }
  if (key === "h" || key === "H") {
    ui.showHelp();
    return;
  }
  if (key === "m" || key === "M") {
    handleSound();
    return;
  }
  if (key === "Escape") {
    ui.hideModal();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.isPlaying()) {
    game.pauseRun();
    ui.showOverlay("pause");
  }
});

function handleResize() {
  renderer.resize();
  syncSpecimens(true);
}

window.addEventListener("resize", handleResize);
if (chamberWrap && typeof ResizeObserver === "function") {
  new ResizeObserver(handleResize).observe(chamberWrap);
}

ui.setLocale(locale);
ui.setMode(mode, dateKey);
ui.setSound(!audio.isMuted());
ui.renderCodex(data.codex);
renderer.resize();
newRun("standard");
game.startLoop();
