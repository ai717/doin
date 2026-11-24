// Assembly entry for Flick Duel: binds DOM events, drives the fixed clock,
// routes engine events to sound and the table UI.

import { WORLD } from "./engine.mjs";
import { createGame } from "./game.mjs";
import { createUi } from "./ui.mjs";
import { createAudio } from "./audio.mjs";
import { mulberry32 } from "./ai.mjs";
import { getDifficulty, normalizeSettings } from "./levels.mjs";
import { t, loadLocale, saveLocale, otherLocale } from "./i18n.mjs";
import { load as loadProgress, save as saveProgress, recordMatch, rememberSettings } from "./storage.mjs";

const refs = {
  canvas: document.getElementById("table-canvas"),
  hudTurn: document.getElementById("hud-turn"),
  hudSouth: document.getElementById("hud-south"),
  hudNorth: document.getElementById("hud-north"),
  hudRound: document.getElementById("hud-round"),
  hudTime: document.getElementById("hud-time"),
  hudSouthKicker: document.getElementById("hud-south-kicker"),
  hudNorthKicker: document.getElementById("hud-north-kicker"),
  modeBtn: document.getElementById("btn-mode"),
  pauseBtn: document.getElementById("btn-pause"),
  soundBtn: document.getElementById("btn-sound"),
  langBtn: document.getElementById("btn-lang"),
  helpBtn: document.getElementById("btn-help"),
  keyHint: document.getElementById("key-hint"),
  toast: document.getElementById("toast"),
  pauseVeil: document.getElementById("pause-veil"),
  resumeBtn: document.getElementById("btn-resume"),
  restartPauseBtn: document.getElementById("btn-restart-pause"),
  modeGroup: document.getElementById("mode-group"),
  diffGroup: document.getElementById("diff-group"),
  boardGroup: document.getElementById("board-group"),
  sideGroup: document.getElementById("side-group"),
  diffRow: document.getElementById("diff-row"),
  startMatchBtn: document.getElementById("btn-start-match"),
  resultTitle: document.getElementById("result-title"),
  resultRows: document.getElementById("result-rows"),
  resultNote: document.getElementById("result-note"),
  resultStats: document.getElementById("result-stats"),
  resultReplay: document.getElementById("btn-result-replay"),
  resultMode: document.getElementById("btn-result-mode"),
};

let progress = loadProgress();
let locale = loadLocale();
let settings = normalizeSettings(progress.settings);
let draft = { ...settings };

const game = createGame({ ...settings, seed: 20261124 });
const audio = createAudio();
const ui = createUi(refs);
const rng = mulberry32(20261124);

let ended = false;
let resultShown = false;
let lastResult = null;
let resultTimer = 0;
let autoPaused = false;
let aiTimer = 0;
let acc = 0;
let lastFrame = performance.now();
let lastTurn = "south";
let lastPhase = "aim";
let lastSlideSound = 0;
let lastClack = 0;
let lastKnock = 0;
let lastGateToast = 0;

let drag = null;
const keyAim = { puckId: null, angle: -Math.PI / 2, power: 0.55, charging: false };

function humanTurn(snapshot) {
  return snapshot.mode === "duel" || snapshot.turn === snapshot.humanSide;
}

function canHumanPlay() {
  const snapshot = game.snapshot();
  return snapshot.status === "playing"
    && snapshot.phase === "aim"
    && !snapshot.paused
    && !ui.anyPanelOpen()
    && humanTurn(snapshot);
}

function nearestGate(snapshot, puck) {
  let best = snapshot.gates[0];
  let bestDistance = Infinity;
  for (const gate of snapshot.gates) {
    const distance = Math.hypot(gate.x - puck.x, gate.y - puck.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = gate;
    }
  }
  return best;
}

function ownPucks(snapshot) {
  return snapshot.pucks.filter((puck) => puck.side === snapshot.turn && puck.vx === 0 && puck.vy === 0);
}

function syncSelection(force) {
  const snapshot = game.snapshot();
  keyAim.charging = false;
  if (!humanTurn(snapshot) || snapshot.phase !== "aim" || snapshot.status !== "playing") {
    keyAim.puckId = null;
    return;
  }
  const own = ownPucks(snapshot);
  if (own.length === 0) {
    keyAim.puckId = null;
    return;
  }
  let current = own.find((puck) => puck.id === keyAim.puckId) ?? null;
  if (!current || force) {
    current = own.reduce((best, puck) => {
      const gate = nearestGate(snapshot, puck);
      const score = Math.abs(puck.x - gate.x) + Math.abs(puck.y - gate.y) * 0.12;
      if (!best || score < best.score) return { puck, score };
      return best;
    }, null).puck;
  }
  keyAim.puckId = current.id;
  if (force) {
    const gate = nearestGate(snapshot, current);
    keyAim.angle = Math.atan2(gate.y - current.y, gate.x - current.x);
    keyAim.power = 0.55;
  }
}

function routeEvents(events) {
  const now = performance.now();
  for (const event of events) {
    if (event.type === "flick") {
      audio.play("flick");
    } else if (event.type === "gate") {
      audio.play("gate");
      ui.flashGate(event.gateIndex ?? 0);
      if (now - lastGateToast > 900) {
        lastGateToast = now;
        ui.showToast(t(locale, "toastGate"), 1100);
      }
    } else if (event.type === "clack") {
      if (now - lastClack > 55) {
        lastClack = now;
        audio.play("clack");
      }
    } else if (event.type === "rail" || event.type === "post") {
      if (now - lastKnock > 70) {
        lastKnock = now;
        audio.play("knock");
      }
    } else if (event.type === "turn") {
      audio.play("turn");
    } else if (event.type === "end") {
      handleEnd(event);
    }
  }
}

function handleEnd(event) {
  if (resultShown) return;
  resultShown = true;
  ended = true;
  keyAim.charging = false;
  const snapshot = game.snapshot();
  const outcome = recordMatch(progress, {
    mode: snapshot.mode,
    difficulty: snapshot.difficulty,
    boardId: snapshot.boardId,
    humanSide: snapshot.humanSide,
    winner: event.winner,
    reason: event.reason,
    round: event.round,
    time: event.time,
  });
  progress = outcome.progress;
  saveProgress(progress);
  lastResult = {
    snapshot: {
      ...snapshot,
      winner: event.winner,
      reason: event.reason,
      round: event.round,
      time: event.time,
    },
    newBest: outcome.newBest,
  };
  audio.play("win");
  globalThis.clearTimeout(resultTimer);
  resultTimer = globalThis.setTimeout(() => {
    if (!resultShown || !lastResult) return;
    ui.showResult(lastResult.snapshot, progress, lastResult.newBest);
  }, 720);
}

function startMatch(nextSettings) {
  globalThis.clearTimeout(resultTimer);
  resultTimer = 0;
  settings = normalizeSettings(nextSettings);
  draft = { ...settings };
  rememberSettings(progress, settings);
  saveProgress(progress);
  game.configure(settings);
  ended = false;
  resultShown = false;
  lastResult = null;
  autoPaused = false;
  aiTimer = 0;
  acc = 0;
  drag = null;
  ui.reset();
  ui.closePanels();
  ui.setPaused(false);
  const snapshot = game.snapshot();
  lastTurn = snapshot.turn;
  lastPhase = snapshot.phase;
  syncSelection(true);
  ui.updateHud(snapshot);
  ui.renderModePanel(settings);
}

function togglePause() {
  const snapshot = game.snapshot();
  if (snapshot.status !== "playing") return;
  if (snapshot.paused) {
    game.resume();
    ui.setPaused(false);
  } else {
    game.pause();
    ui.setPaused(true);
  }
  audio.play("click");
}

function openModePanel() {
  draft = { ...settings };
  ui.renderModePanel(draft);
  ui.openPanel("panel-mode");
  audio.play("page");
}

function switchLocale() {
  locale = otherLocale(locale);
  saveLocale(locale);
  ui.applyStatic(locale);
  ui.setSound(audio.isMuted());
  const snapshot = game.snapshot();
  ui.setPaused(snapshot.paused);
  ui.updateHud(snapshot);
  if (!document.getElementById("panel-mode").hidden) ui.renderModePanel(draft);
  if (!document.getElementById("panel-result").hidden && lastResult) {
    ui.showResult(lastResult.snapshot, progress, lastResult.newBest);
  }
  audio.play("page");
}

function toggleSound() {
  const muted = !audio.isMuted();
  audio.setMuted(muted);
  ui.setSound(muted);
  if (!muted) audio.play("click");
}

// ---------------------------------------------------------------- pointer ----

function toLogical(event) {
  const rect = refs.canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * WORLD.width,
    y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * WORLD.height,
  };
}

function onPointerDown(event) {
  if (!canHumanPlay()) return;
  audio.unlock();
  const point = toLogical(event);
  const snapshot = game.snapshot();
  let hit = null;
  let best = Infinity;
  const hitRadius = WORLD.puckRadius * (event.pointerType === "touch" ? 2.7 : 1.75);
  for (const puck of snapshot.pucks) {
    if (puck.side !== snapshot.turn) continue;
    const distance = Math.hypot(puck.x - point.x, puck.y - point.y);
    if (distance <= hitRadius && distance < best) {
      best = distance;
      hit = puck;
    }
  }
  if (!hit) return;
  drag = { puckId: hit.id, x: point.x, y: point.y };
  keyAim.puckId = hit.id;
  keyAim.charging = false;
  try {
    refs.canvas.setPointerCapture(event.pointerId);
  } catch {
    // pointer capture is optional
  }
  event.preventDefault();
}

function onPointerMove(event) {
  if (!drag) return;
  const point = toLogical(event);
  drag.x = point.x;
  drag.y = point.y;
  event.preventDefault();
}

function onPointerUp(event) {
  if (!drag) return;
  const point = toLogical(event);
  const snapshot = game.snapshot();
  const puck = snapshot.pucks.find((item) => item.id === drag.puckId);
  const current = drag;
  drag = null;
  if (!puck) return;
  const dx = puck.x - point.x;
  const dy = puck.y - point.y;
  const length = Math.hypot(dx, dy);
  if (!canHumanPlay() || length < 14) {
    audio.play("click");
    return;
  }
  const power = Math.min(1, length / WORLD.maxPull);
  game.flick(puck.id, dx / length, dy / length, power);
  keyAim.puckId = current.puckId;
  aiTimer = 0;
}

function onPointerCancel() {
  drag = null;
}

// ---------------------------------------------------------------- keyboard ----

function cyclePuck() {
  const snapshot = game.snapshot();
  if (!humanTurn(snapshot) || snapshot.phase !== "aim") return;
  const own = ownPucks(snapshot);
  if (own.length === 0) return;
  const index = own.findIndex((puck) => puck.id === keyAim.puckId);
  const next = own[(index + 1) % own.length];
  keyAim.puckId = next.id;
  const gate = nearestGate(snapshot, next);
  keyAim.angle = Math.atan2(gate.y - next.y, gate.x - next.x);
  keyAim.charging = false;
  audio.play("click");
}

function fireKeyboardShot() {
  const snapshot = game.snapshot();
  if (!humanTurn(snapshot) || snapshot.phase !== "aim" || snapshot.status !== "playing" || snapshot.paused) return;
  if (ui.anyPanelOpen()) return;
  const puck = snapshot.pucks.find((item) => item.id === keyAim.puckId);
  if (!puck || puck.side !== snapshot.turn) return;
  game.flick(puck.id, Math.cos(keyAim.angle), Math.sin(keyAim.angle), keyAim.power);
  aiTimer = 0;
}

// -------------------------------------------------------------------- AI ----

function maybeAi(dt) {
  const snapshot = game.snapshot();
  if (snapshot.mode !== "solo" || snapshot.turn === snapshot.humanSide) {
    aiTimer = 0;
    return;
  }
  if (snapshot.status !== "playing" || snapshot.phase !== "aim" || snapshot.paused) return;
  if (ui.anyPanelOpen()) return;
  aiTimer += dt;
  const think = getDifficulty(snapshot.difficulty).thinkMs / 1000;
  if (aiTimer < think) return;
  aiTimer = 0;
  const shot = game.planAiShot(rng);
  if (shot) game.flick(shot.puckId, shot.dirX, shot.dirY, shot.power);
}

// ------------------------------------------------------------------ frame ----

function frame(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  const snapshot = game.snapshot();
  const frozen = snapshot.paused || snapshot.status !== "playing" || ui.anyPanelOpen();
  if (!frozen) {
    if (keyAim.charging && humanTurn(snapshot) && snapshot.phase === "aim") {
      keyAim.power = Math.min(1, keyAim.power + dt * 1.05);
    }
    acc += dt;
    let guard = 0;
    while (acc >= 1 / 60 && guard < 12) {
      game.tick(1 / 60);
      maybeAi(1 / 60);
      acc -= 1 / 60;
      guard += 1;
    }
    if (guard >= 12) acc = 0;
  } else {
    acc = 0;
  }

  routeEvents(game.drainEvents());

  const current = game.snapshot();
  if (current.turn !== lastTurn || current.phase !== lastPhase) {
    lastTurn = current.turn;
    lastPhase = current.phase;
    if (current.phase === "aim") syncSelection(true);
  }
  if (current.phase === "slide" && now - lastSlideSound > 210) {
    lastSlideSound = now;
    audio.play("slide");
  }

  const active = humanTurn(current)
    && current.phase === "aim"
    && current.status === "playing"
    && !current.paused;
  if (active && (!keyAim.puckId || !current.pucks.some((puck) => puck.id === keyAim.puckId && puck.side === current.turn))) {
    syncSelection(true);
  }

  ui.updateHud(current);
  ui.render(current, {
    drag,
    keyAim: active ? keyAim : null,
    selectedPuckId: active ? (drag?.puckId ?? keyAim.puckId) : null,
    humanTurn: active,
  });

  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------- boot ----

ui.setupCanvas();
ui.applyStatic(locale);
ui.setSound(audio.isMuted());
ui.setPaused(false);
ui.renderModePanel(settings);
syncSelection(true);
ui.updateHud(game.snapshot());
lastTurn = game.snapshot().turn;
lastPhase = game.snapshot().phase;

refs.modeBtn.addEventListener("click", openModePanel);
refs.pauseBtn.addEventListener("click", togglePause);
refs.soundBtn.addEventListener("click", toggleSound);
refs.langBtn.addEventListener("click", switchLocale);
refs.helpBtn.addEventListener("click", () => {
  ui.openPanel("panel-help");
  audio.play("page");
});
refs.resumeBtn.addEventListener("click", togglePause);
refs.restartPauseBtn.addEventListener("click", () => startMatch(settings));
refs.startMatchBtn.addEventListener("click", () => {
  startMatch(draft);
  audio.play("page");
});
refs.resultReplay.addEventListener("click", () => startMatch(settings));
refs.resultMode.addEventListener("click", openModePanel);

for (const button of document.querySelectorAll("[data-close]")) {
  button.addEventListener("click", () => {
    ui.closePanels();
    audio.play("click");
  });
}

function bindOptions(group, key) {
  group.addEventListener("click", (event) => {
    const button = event.target.closest("[data-value]");
    if (!button) return;
    draft = { ...draft, [key]: button.dataset.value };
    ui.renderModePanel(draft);
    audio.play("click");
  });
}

bindOptions(refs.modeGroup, "mode");
bindOptions(refs.diffGroup, "difficulty");
bindOptions(refs.boardGroup, "boardId");
bindOptions(refs.sideGroup, "humanSide");

refs.canvas.addEventListener("pointerdown", onPointerDown);
refs.canvas.addEventListener("pointermove", onPointerMove);
refs.canvas.addEventListener("pointerup", onPointerUp);
refs.canvas.addEventListener("pointercancel", onPointerCancel);
refs.canvas.addEventListener("contextmenu", (event) => event.preventDefault());

globalThis.addEventListener("keydown", (event) => {
  const code = event.code;
  if (code === "Escape") {
    if (ui.anyPanelOpen()) {
      ui.closePanels();
    } else {
      togglePause();
    }
    event.preventDefault();
    return;
  }
  if (code === "KeyP") {
    if (!ui.anyPanelOpen()) togglePause();
    event.preventDefault();
    return;
  }
  if (ui.anyPanelOpen()) return;
  const snapshot = game.snapshot();
  if (!humanTurn(snapshot) || snapshot.status !== "playing" || snapshot.phase !== "aim" || snapshot.paused) return;

  if (code === "Tab") {
    event.preventDefault();
    cyclePuck();
    return;
  }
  if (code === "Space") {
    event.preventDefault();
    if (!event.repeat && !keyAim.charging) {
      keyAim.charging = true;
      keyAim.power = 0.08;
    }
    return;
  }
  if (code === "ArrowLeft" || code === "ArrowRight" || code === "ArrowUp" || code === "ArrowDown") {
    event.preventDefault();
    const step = event.shiftKey ? 0.012 : 0.045;
    if (code === "ArrowLeft") keyAim.angle -= step;
    else if (code === "ArrowRight") keyAim.angle += step;
    else if (code === "ArrowUp") keyAim.power = Math.min(1, keyAim.power + 0.05);
    else keyAim.power = Math.max(0.08, keyAim.power - 0.05);
    return;
  }
  if (code === "KeyR") {
    startMatch(settings);
  }
});

globalThis.addEventListener("keyup", (event) => {
  if (event.code !== "Space" || !keyAim.charging) return;
  keyAim.charging = false;
  event.preventDefault();
  fireKeyboardShot();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    const snapshot = game.snapshot();
    if (snapshot.status === "playing" && !snapshot.paused && !ui.anyPanelOpen()) {
      game.pause();
      autoPaused = true;
      ui.setPaused(true);
    }
  } else if (autoPaused) {
    autoPaused = false;
    if (!ui.anyPanelOpen()) {
      game.resume();
      ui.setPaused(false);
    }
  }
});

globalThis.addEventListener("blur", () => {
  const snapshot = game.snapshot();
  if (snapshot.status === "playing" && !snapshot.paused && !ui.anyPanelOpen()) {
    game.pause();
    autoPaused = true;
    ui.setPaused(true);
  }
});

globalThis.addEventListener("focus", () => {
  if (!autoPaused) return;
  autoPaused = false;
  if (!ui.anyPanelOpen()) {
    game.resume();
    ui.setPaused(false);
  }
});

requestAnimationFrame(frame);

window.__flick = {
  snapshot: () => game.snapshot(),
  flick: (puckId, dirX, dirY, power) => game.flick(puckId, dirX, dirY, power),
  aimAt: (puckId, gateIndex = 0, power = 0.42) => {
    const snapshot = game.snapshot();
    const puck = snapshot.pucks.find((item) => item.id === puckId);
    const gate = snapshot.gates[gateIndex] ?? snapshot.gates[0];
    if (!puck || !gate) return null;
    const overshoot = snapshot.turn === "south" ? -28 : 28;
    const dx = gate.x - puck.x;
    const dy = gate.y + overshoot - puck.y;
    const length = Math.hypot(dx, dy) || 1;
    return game.flick(puckId, dx / length, dy / length, power);
  },
  advance: (seconds) => {
    let left = Math.max(0, Number(seconds) || 0);
    let guard = 0;
    while (left > 1e-6 && guard < 2000) {
      game.tick(Math.min(1 / 60, left));
      left -= 1 / 60;
      guard += 1;
    }
    return game.snapshot();
  },
  settle: () => {
    game.settle();
    return game.snapshot();
  },
  pause: () => {
    game.pause();
    ui.setPaused(true);
    return game.snapshot();
  },
  resume: () => {
    game.resume();
    ui.setPaused(false);
    return game.snapshot();
  },
  restart: () => {
    startMatch(settings);
    return game.snapshot();
  },
  configure: (next) => {
    startMatch({ ...settings, ...next });
    return game.snapshot();
  },
  debugClear: (side) => {
    const moved = game.debugCrossAll(side);
    game.settle();
    return moved;
  },
  hidePanels: () => ui.closePanels(),
  get progress() {
    return progress;
  },
  get locale() {
    return locale;
  },
  get settings() {
    return { ...settings };
  },
};
