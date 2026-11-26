// Assembly entry: owns locale, storage, audio, the animation frame loop and
// all event wiring. Locale changes repaint in place and never reset the match.

import { createController } from "./game.mjs";
import { createUI } from "./ui.mjs";
import { createAudio } from "./audio.mjs";
import * as storage from "./storage.mjs";
import { loadLocale, applyLocale, strings, format } from "./i18n.mjs";
import { reportMatch } from "./portal.mjs";
import { rate } from "./score.mjs";

const store = storage.load();
let locale = loadLocale();
const audio = createAudio();
audio.setMuted(store.muted);

const controller = createController({
  mode: store.mode,
  difficulty: store.difficulty,
  firstShooter: store.firstShooter,
  seed: (Date.now() ^ 0x9e3779b9) >>> 0,
});
const ui = createUI();
let drawerOpen = false;
let resultShown = false;
let lastTime = 0;
let lastTaken = 0;
let focusPaused = false;

function render() {
  ui.render(controller.snapshot(), locale);
}

applyLocale(locale, render);

function persistPreferences() {
  storage.save({
    ...store,
    mode: controller.snapshot().mode,
    difficulty: controller.snapshot().difficulty,
    firstShooter: controller.snapshot().firstShooter,
    muted: audio.muted,
  });
}

function setPause(value, fromFocus = false) {
  const next = controller.setPaused(value);
  if (next) audio.suspend();
  else if (!controller.snapshot().finished && !drawerOpen) audio.resume();
  if (fromFocus) focusPaused = next;
  render();
  return next;
}

function openDrawer() {
  if (drawerOpen) return;
  drawerOpen = true;
  if (!controller.snapshot().paused) setPause(true);
  ui.showDrawer(true);
}

function closeDrawer() {
  drawerOpen = false;
  ui.showDrawer(false);
  if (focusPaused || document.hidden) return;
  if (!controller.snapshot().finished && controller.snapshot().paused) setPause(false);
}

function changeSetup(partial) {
  Object.assign(store, partial);
  controller.reset(partial);
  persistPreferences();
  resultShown = false;
  lastTaken = 0;
  ui.showResult(false);
  closeDrawer();
  render();
}

function handleFinish(snap) {
  if (resultShown || !snap.finished) return;
  resultShown = true;
  const updated = storage.recordMatch(store, snap.summary);
  Object.assign(store, updated);
  audio.crowd(Boolean(snap.winner));
  reportMatch(snap.summary, rate(snap.summary));
  ui.showResult(true);
}

function playResultSounds(snap) {
  if (snap.taken <= lastTaken) return;
  lastTaken = snap.taken;
  const result = snap.lastShot?.result;
  if (result === "goal") {
    audio.net();
    audio.crowd(true);
  } else if (result === "save") {
    audio.save();
    audio.crowd(false);
  } else if (result === "wide") {
    audio.wide();
    audio.crowd(false);
  }
}

function frame(now) {
  if (!lastTime) lastTime = now;
  const dt = Math.min(Math.max(now - lastTime, 0), 100);
  lastTime = now;
  controller.tick(dt);
  const snap = controller.snapshot();
  ui.render(snap, locale);
  playResultSounds(snap);
  if (snap.finished) handleFinish(snap);
  globalThis.requestAnimationFrame(frame);
}
globalThis.requestAnimationFrame(frame);

// Zone buttons: shooter picks a target, keeper picks a dive.
ui.elements.zones.forEach((button) => {
  button.addEventListener("click", () => {
    audio.unlock();
    const zone = Number(button.dataset.zone);
    const snap = controller.snapshot();
    if (snap.phase === "keeper" && (snap.mode === "mode_duo" || snap.shooter === "side_b")) {
      controller.keeperDive(zone);
    } else if (snap.phase === "shooter") {
      controller.chooseTarget(zone);
    }
    render();
  });
});

ui.elements.powers.forEach((button) => {
  button.addEventListener("click", () => {
    audio.unlock();
    controller.choosePower(button.dataset.power);
    render();
  });
});

function primaryAction() {
  audio.unlock();
  const snap = controller.snapshot();
  if (snap.finished) {
    controller.reset();
    resultShown = false;
    lastTaken = 0;
    ui.showResult(false);
  } else if (snap.revealDone) {
    controller.continueMatch();
  } else if (snap.phase === "shooter") {
    if (controller.shoot()) {
      audio.steps();
      globalThis.setTimeout(() => audio.kick(snap.power ?? "drive"), 190);
    }
  } else if (snap.phase === "handoff") {
    controller.confirmKeeper();
  }
  render();
}

ui.elements.shoot.addEventListener("click", primaryAction);
document.getElementById("btn-undo").addEventListener("click", () => {
  controller.undoSelection();
  render();
});
document.getElementById("btn-handoff").addEventListener("click", primaryAction);
document.getElementById("btn-resume").addEventListener("click", () => setPause(false));
document.getElementById("btn-restart-pause").addEventListener("click", () => {
  controller.reset();
  resultShown = false;
  lastTaken = 0;
  ui.showResult(false);
  setPause(false);
});
document.getElementById("btn-replay").addEventListener("click", () => {
  controller.reset();
  resultShown = false;
  lastTaken = 0;
  ui.showResult(false);
  render();
});
document.getElementById("btn-close-result").addEventListener("click", () => ui.showResult(false));

document.getElementById("btn-modes").addEventListener("click", openDrawer);
document.getElementById("btn-close-drawer").addEventListener("click", closeDrawer);
ui.elements.modes.forEach((button) => {
  button.addEventListener("click", () => changeSetup({ mode: button.dataset.mode }));
});
ui.elements.diffs.forEach((button) => {
  button.addEventListener("click", () => changeSetup({ mode: "mode_solo", difficulty: button.dataset.diff }));
});
ui.elements.firsts.forEach((button) => {
  button.addEventListener("click", () => changeSetup({ firstShooter: button.dataset.first }));
});

document.getElementById("btn-pause").addEventListener("click", () => setPause(!controller.snapshot().paused));
document.getElementById("btn-sound").addEventListener("click", () => {
  const muted = audio.setMuted(!audio.muted);
  store.muted = muted;
  persistPreferences();
});
document.getElementById("btn-lang").addEventListener("click", () => {
  locale = locale === "zh" ? "en" : "zh";
  applyLocale(locale, render);
  render();
});

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "p" || key === "escape") {
    event.preventDefault();
    if (!drawerOpen && !controller.snapshot().finished) setPause(!controller.snapshot().paused);
    return;
  }
  if (controller.snapshot().paused || drawerOpen) return;
  if (/^[1-9]$/.test(key)) {
    const zone = Number(key) - 1;
    const snap = controller.snapshot();
    if (snap.phase === "keeper" && (snap.mode === "mode_duo" || snap.shooter === "side_b")) controller.keeperDive(zone);
    else if (snap.phase === "shooter") controller.chooseTarget(zone);
    render();
  } else if (key === "q") { controller.choosePower("tap"); render(); }
  else if (key === "w") { controller.choosePower("drive"); render(); }
  else if (key === "e") { controller.choosePower("blast"); render(); }
  else if (key.startsWith("arrow")) {
    const snap = controller.snapshot();
    if (snap.phase === "keeper" && (snap.mode === "mode_duo" || snap.shooter === "side_b")) {
      const current = snap.target ?? 4;
      const delta = key === "arrowleft" ? -1 : key === "arrowright" ? 1 : key === "arrowup" ? -3 : 3;
      controller.keeperDive(Math.max(0, Math.min(8, current + delta)));
      render();
    }
  } else if (key === "enter" || key === " ") {
    event.preventDefault();
    primaryAction();
  }
});

// Visibility and blur must be paired with a resume, or an iframe/headless
// session stays stuck behind the paused layer forever.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) setPause(true, true);
  else if (focusPaused && !drawerOpen) {
    setPause(false, true);
  }
});
window.addEventListener("blur", () => setPause(true, true));
window.addEventListener("focus", () => {
  if (focusPaused && !document.hidden && !drawerOpen) setPause(false, true);
});

globalThis.__penalty = {
  get snapshot() { return controller.snapshot(); },
  get controller() { return controller; },
  get locale() { return locale; },
  get store() { return store; },
  get strings() { return strings(locale); },
  get drawerOpen() { return drawerOpen; },
  format,
};
