// Assembly entry: DOM events, fixed-step loop, audio routing and panel flow.

import { createGame } from "./game.mjs";
import { createRenderer } from "./render.mjs";
import { createUi } from "./ui.mjs";
import { createAudio } from "./audio.mjs";
import { STAGES, TRAINING } from "./levels.mjs";
import { t, loadLocale, saveLocale, otherLocale } from "./i18n.mjs";
import {
  load as loadProgress,
  save as saveProgress,
  remember,
  recordStage,
  recordTraining,
  stageRecord,
} from "./storage.mjs";

const refs = {
  stage: document.getElementById("stage"),
  banner: document.getElementById("level-banner"),
  toast: document.getElementById("toast"),
  keyHint: document.getElementById("key-hint"),
  hudStage: document.getElementById("hud-stage"),
  hudName: document.getElementById("hud-name"),
  hudLives: document.getElementById("hud-lives"),
  hudBombs: document.getElementById("hud-bombs"),
  hudBombEnergy: document.getElementById("hud-bomb-energy"),
  hudScore: document.getElementById("hud-score"),
  hudGraze: document.getElementById("hud-graze"),
  hudWeapon: document.getElementById("hud-weapon"),
  hudCharge: document.getElementById("hud-charge"),
  hudBoss: document.getElementById("hud-boss"),
  hudBossFill: document.getElementById("hud-boss-fill"),
  stagesBtn: document.getElementById("btn-stages"),
  pauseBtn: document.getElementById("btn-pause"),
  soundBtn: document.getElementById("btn-sound"),
  langBtn: document.getElementById("btn-lang"),
  helpBtn: document.getElementById("btn-help"),
  stageGrid: document.getElementById("stage-grid"),
  stageTotal: document.getElementById("stage-total"),
  trainingCard: document.getElementById("training-card"),
  trainingBest: document.getElementById("training-best"),
  trainingStars: document.getElementById("training-stars"),
  resultPanel: document.getElementById("panel-result"),
  resultTitle: document.getElementById("result-title"),
  resultStars: document.getElementById("result-stars"),
  resultRows: document.getElementById("result-rows"),
  resultNext: document.getElementById("btn-result-next"),
  resultReplay: document.getElementById("btn-result-replay"),
  resultStages: document.getElementById("btn-result-stages"),
  pausePanel: document.getElementById("panel-pause"),
  pauseResume: document.getElementById("btn-pause-resume"),
  pauseRestart: document.getElementById("btn-pause-restart"),
  pauseStages: document.getElementById("btn-pause-stages"),
  chargeBtn: document.getElementById("btn-charge"),
  bombBtn: document.getElementById("btn-bomb"),
};

const progress = loadProgress();
let locale = loadLocale();
const cursor = progress.current ?? { mode: "stage", stageIndex: 0 };
const game = createGame({
  mode: cursor.mode,
  stageIndex: cursor.stageIndex,
  lives: 3,
  bombs: 2,
  weapon: 1,
});
const audio = createAudio();
const ui = createUi(refs);
const renderer = createRenderer({ canvas: refs.stage });

const keys = new Set();
let chargeHeld = false;
let ended = false;
let lastResult = null;
let lastHudAt = 0;
let lastShotAt = 0;
let lastGrazeAt = 0;
let dragging = false;
let dragX = 0;
let dragY = 0;
let lastTapAt = 0;

function stageName(snap) {
  return snap.mode === "training" ? t(locale, "modeTraining") : t(locale, STAGES[snap.stageIndex]?.nameKey ?? "stageCloud");
}

function bannerFor(snap) {
  if (snap.mode === "training") return t(locale, "trainingBanner");
  const name = stageName(snap);
  if (snap.bossMax > 0) return t(locale, "bossBanner", { name });
  return t(locale, "stageBanner", { n: snap.stageNumber, name });
}

function syncHud() {
  const snap = game.snapshot();
  ui.setHud(snap);
  if (refs.banner?.classList.contains("is-visible")) ui.setBannerText(bannerFor(snap));
}

function pushInput() {
  let x = 0;
  let y = 0;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) x -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) x += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) y -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) y += 1;
  game.setAxis(x, y);
  game.setSlow(keys.has("ShiftLeft") || keys.has("ShiftRight"));
  game.setCharge(chargeHeld || keys.has("KeyX"));
}

function sessionStart({ banner = true } = {}) {
  ui.closePanels();
  ended = false;
  lastResult = null;
  ui.setPause(false);
  remember(progress, game.mode, game.stageIndex);
  saveProgress(progress);
  syncHud();
  audio.stopAll();
  if (banner) ui.showBanner(bannerFor(game.snapshot()), 1800);
}

function pauseForMenu() {
  if (game.session.status === "playing" && !game.session.paused) {
    game.pause();
    ui.setPause(true);
    audio.stopAll();
  }
}

function doPause() {
  if (game.session.status !== "playing" || game.session.paused) return;
  game.pause();
  ui.setPause(true);
  ui.openPanel("panel-pause");
  audio.stopAll();
  ui.showToast(t(locale, "toastPaused"), 900);
}

function doResume() {
  if (game.session.status !== "playing") return;
  game.resume();
  ui.setPause(false);
  ui.closePanels();
  pushInput();
}

function togglePause() {
  if (game.session.status !== "playing") return;
  if (game.session.paused) doResume();
  else doPause();
}

function closeOverlays() {
  ui.closePanels();
  if (game.session.status === "playing" && game.session.paused) doResume();
}

function renderStages() {
  const snap = game.snapshot();
  ui.updateStages({
    progress,
    current: snap.stageIndex,
    mode: snap.mode,
    onPick: (index) => {
      game.loadStage(index);
      sessionStart();
    },
  });
}

function openStages() {
  pauseForMenu();
  renderStages();
  ui.openPanel("panel-stages");
}

function renderResultPanel() {
  if (!lastResult) return;
  ui.showResult({ snapshot: lastResult.snapshot, isNewBest: lastResult.isNewBest, best: lastResult.best });
  const snap = lastResult.snapshot;
  if (snap.status === "gameover") ui.setResultNext(t(locale, "resultRetry"));
  else if (snap.mode === "training") ui.setResultNext(t(locale, "resultReplay"));
  else if (snap.completed) ui.setResultNext(t(locale, "resultStages"));
  else ui.setResultNext(t(locale, "resultNext"));
}

function finish() {
  if (ended) return;
  const snap = game.snapshot();
  if (snap.status === "cleared") {
    ended = true;
    audio.stopAll();
    audio.play("clear");
    if (snap.mode === "training") {
      const previous = progress.training.bestGraze;
      const isNewBest = snap.graze > previous;
      recordTraining(progress, snap.graze, snap.stars);
      remember(progress, "training", 0);
      saveProgress(progress);
      lastResult = { snapshot: snap, isNewBest, best: Math.max(previous, snap.graze) };
    } else {
      const previous = stageRecord(progress, snap.stageId);
      const isNewBest = !previous || snap.stars > previous.stars || snap.score > previous.best;
      recordStage(progress, snap.stageId, snap.stars, snap.score, snap.graze);
      remember(progress, "stage", snap.stageIndex);
      saveProgress(progress);
      lastResult = { snapshot: snap, isNewBest, best: Math.max(previous?.best ?? 0, snap.score) };
    }
    ui.setPause(false);
    renderResultPanel();
  } else if (snap.status === "gameover") {
    ended = true;
    audio.stopAll();
    remember(progress, "stage", snap.stageIndex);
    saveProgress(progress);
    lastResult = { snapshot: snap, isNewBest: false, best: stageRecord(progress, snap.stageId)?.best ?? 0 };
    ui.setPause(false);
    renderResultPanel();
  }
}

function switchLocale() {
  locale = otherLocale(locale);
  saveLocale(locale);
  ui.applyStatic(locale);
  ui.setPause(game.session.paused);
  ui.setSound(audio.isMuted());
  syncHud();
  if (!document.getElementById("panel-stages").hidden) renderStages();
  if (!refs.resultPanel.hidden) renderResultPanel();
  if (refs.banner?.classList.contains("is-visible")) ui.setBannerText(bannerFor(game.snapshot()));
}

function toggleSound() {
  const muted = !audio.isMuted();
  audio.setMuted(muted);
  ui.setSound(muted);
  if (!muted) audio.play("click");
}

function routeEvents(events) {
  for (const event of events) {
    if (event.type === "kill") {
      audio.play("explode", event.kind === "heavy" ? 2 : 1);
    } else if (event.type === "bossHit") {
      audio.play("graze");
    } else if (event.type === "laser") {
      audio.play("laser");
    } else if (event.type === "bomb") {
      audio.play("bomb");
    } else if (event.type === "hurt" || event.type === "trainingHit") {
      audio.play("hurt");
    } else if (event.type === "item") {
      audio.play(event.kind === "power" ? "power" : "item");
    } else if (event.type === "bombReady") {
      audio.play("ready");
      ui.showToast(t(locale, "toastBombReady"), 1600);
    } else if (event.type === "graze") {
      const now = performance.now();
      if (now - lastGrazeAt > 55) {
        lastGrazeAt = now;
        audio.play("graze");
      }
    } else if (event.type === "bossWarn") {
      audio.play("boss");
      ui.showBanner(bannerFor(game.snapshot()), 1600);
      ui.showToast(t(locale, "toastBoss"), 1500);
    } else if (event.type === "bossDown") {
      audio.play("explode", 3);
    } else if (event.type === "gameover") {
      audio.play("hurt");
      finish();
    } else if (event.type === "clear") {
      finish();
    }
  }
}

function updateAudio() {
  const session = game.session;
  const playing = session.status === "playing" && !session.paused;
  audio.charge(playing && session.world.player.charging, session.world.player.charge);
  if (!playing || session.world.player.charging) return;
  const now = performance.now();
  if (now - lastShotAt > 95) {
    lastShotAt = now;
    audio.play("shot");
  }
}

function capturePointer(target, event) {
  try {
    target.setPointerCapture?.(event.pointerId);
  } catch {
    // Synthetic events can lack an active pointer; dragging still works.
  }
}

// ---- Controls ----

refs.stagesBtn.addEventListener("click", openStages);
refs.pauseBtn.addEventListener("click", togglePause);
refs.soundBtn.addEventListener("click", toggleSound);
refs.langBtn.addEventListener("click", switchLocale);
refs.helpBtn.addEventListener("click", () => {
  pauseForMenu();
  ui.openPanel("panel-help");
});

for (const button of document.querySelectorAll("[data-close]")) {
  button.addEventListener("click", () => {
    const panel = button.closest(".panel");
    if (panel?.id === "panel-pause") doResume();
    else closeOverlays();
  });
}

refs.pauseResume.addEventListener("click", doResume);
refs.pauseRestart.addEventListener("click", () => {
  game.restart();
  sessionStart();
});
refs.pauseStages.addEventListener("click", openStages);
refs.trainingCard.addEventListener("click", () => {
  game.loadTraining();
  sessionStart();
  ui.showToast(t(locale, "toastTraining"), 1800);
});

refs.resultNext.addEventListener("click", () => {
  const snap = game.snapshot();
  if (snap.status === "gameover") {
    game.restart();
    sessionStart();
    return;
  }
  if (snap.mode === "training") {
    game.loadTraining();
    sessionStart();
    return;
  }
  if (snap.completed) {
    openStages();
    return;
  }
  if (!game.nextStage()) {
    openStages();
    return;
  }
  sessionStart();
});

refs.resultReplay.addEventListener("click", () => {
  if (game.session.mode === "training") game.loadTraining();
  else game.restart();
  sessionStart();
});

refs.resultStages.addEventListener("click", openStages);

// ---- Canvas pointer: relative drag + double-tap bomb ----

refs.stage.addEventListener("pointerdown", (event) => {
  audio.unlock();
  const now = performance.now();
  if (now - lastTapAt < 320) {
    game.pressBomb();
    lastTapAt = 0;
  } else {
    lastTapAt = now;
  }
  dragging = true;
  dragX = event.clientX;
  dragY = event.clientY;
  capturePointer(refs.stage, event);
  event.preventDefault();
});

refs.stage.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  const rect = refs.stage.getBoundingClientRect();
  const scaleX = 540 / Math.max(1, rect.width);
  const scaleY = 900 / Math.max(1, rect.height);
  game.dragBy((event.clientX - dragX) * scaleX, (event.clientY - dragY) * scaleY);
  dragX = event.clientX;
  dragY = event.clientY;
  event.preventDefault();
});

for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
  refs.stage.addEventListener(type, () => {
    dragging = false;
  });
}

refs.chargeBtn.addEventListener("pointerdown", (event) => {
  audio.unlock();
  chargeHeld = true;
  pushInput();
  capturePointer(refs.chargeBtn, event);
  event.preventDefault();
});
for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
  refs.chargeBtn.addEventListener(type, () => {
    chargeHeld = false;
    pushInput();
  });
}

refs.bombBtn.addEventListener("pointerdown", (event) => {
  audio.unlock();
  game.pressBomb();
  event.preventDefault();
});

// ---- Keyboard ----

const tracked = new Set([
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  "KeyA", "KeyD", "KeyW", "KeyS",
  "KeyX", "KeyC", "ShiftLeft", "ShiftRight",
]);

window.addEventListener("keydown", (event) => {
  const code = event.code;
  if (code === "KeyP" || code === "Escape" || code === "Space") {
    if (code === "Space") event.preventDefault();
    if (!event.repeat) togglePause();
    return;
  }
  if (code === "KeyC") {
    if (!event.repeat) game.pressBomb();
    return;
  }
  if (tracked.has(code)) {
    event.preventDefault();
    keys.add(code);
    pushInput();
  }
});

window.addEventListener("keyup", (event) => {
  const code = event.code;
  if (tracked.has(code)) {
    keys.delete(code);
    pushInput();
  }
});

window.addEventListener("blur", () => {
  if (game.session.status === "playing" && !game.session.paused) doPause();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.session.status === "playing" && !game.session.paused) doPause();
});

// ---- Boot ----

ui.applyStatic(locale);
ui.setPause(false);
ui.setSound(audio.isMuted());
syncHud();
ui.showBanner(bannerFor(game.snapshot()), 1900);

let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.25, (now - lastFrame) / 1000);
  lastFrame = now;
  game.tick(dt);
  routeEvents(game.drainEvents());
  renderer.draw(game.session);
  updateAudio();
  if (now - lastHudAt > 90) {
    lastHudAt = now;
    syncHud();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__raiden = {
  snapshot: () => game.snapshot(),
  setAxis: (x, y) => {
    game.setAxis(x, y);
    pushInput();
  },
  setCharge: (active) => {
    game.setCharge(active);
    chargeHeld = Boolean(active);
  },
  bomb: () => game.pressBomb(),
  dragBy: (dx, dy) => game.dragBy(dx, dy),
  pause: () => game.pause(),
  resume: () => game.resume(),
  togglePause,
  loadStage: (index) => {
    game.loadStage(index);
    sessionStart();
  },
  loadTraining: () => {
    game.loadTraining();
    sessionStart();
  },
  restart: () => {
    game.restart();
    sessionStart();
  },
  debugWin: () => game.debugWin(),
  debugSpawnBoss: () => game.debugSpawnBoss(),
  debugTeleport: (x, y) => game.debugTeleport(x, y),
  debugCharge: (value) => game.debugCharge(value),
  tick: (dt) => game.tick(dt),
  progress,
  get session() {
    return game.session;
  },
  get locale() {
    return locale;
  },
};
