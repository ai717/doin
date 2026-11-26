// Assembly entry: DOM events, fixed-step loop, audio routing and panel flow.

import { createGame } from "./game.mjs";
import { createRenderer } from "./render.mjs";
import { createUi } from "./ui.mjs";
import { createAudio } from "./audio.mjs";
import { CHAPTERS } from "./levels.mjs";
import { t, loadLocale, saveLocale, otherLocale } from "./i18n.mjs";
import {
  load as loadProgress,
  save as saveProgress,
  remember,
  recordLevel,
  recordRush,
  levelRecord,
} from "./storage.mjs";

const refs = {
  stage: document.getElementById("stage"),
  banner: document.getElementById("level-banner"),
  toast: document.getElementById("toast"),
  keyHint: document.getElementById("key-hint"),
  hudChapter: document.getElementById("hud-chapter"),
  hudLevel: document.getElementById("hud-level"),
  hudHearts: document.getElementById("hud-hearts"),
  hudScore: document.getElementById("hud-score"),
  hudTime: document.getElementById("hud-time"),
  hudChain: document.getElementById("hud-chain"),
  hudBoss: document.getElementById("hud-boss"),
  modeBtn: document.getElementById("btn-mode"),
  levelsBtn: document.getElementById("btn-levels"),
  pauseBtn: document.getElementById("btn-pause"),
  soundBtn: document.getElementById("btn-sound"),
  langBtn: document.getElementById("btn-lang"),
  helpBtn: document.getElementById("btn-help"),
  levelGroups: document.getElementById("level-groups"),
  levelTotal: document.getElementById("level-total"),
  resultPanel: document.getElementById("panel-result"),
  resultTitle: document.getElementById("result-title"),
  resultStars: document.getElementById("result-stars"),
  resultRows: document.getElementById("result-rows"),
  resultNext: document.getElementById("btn-result-next"),
  resultReplay: document.getElementById("btn-result-replay"),
  resultLevels: document.getElementById("btn-result-levels"),
  pausePanel: document.getElementById("panel-pause"),
  pauseResume: document.getElementById("btn-pause-resume"),
  pauseRestart: document.getElementById("btn-pause-restart"),
  pauseLevels: document.getElementById("btn-pause-levels"),
  modeLevelBtn: document.getElementById("btn-mode-level"),
  modeRushBtn: document.getElementById("btn-mode-rush"),
  stick: document.getElementById("stick"),
  stickKnob: document.getElementById("stick-knob"),
  sprayBtn: document.getElementById("btn-spray"),
  jumpBtn: document.getElementById("btn-jump"),
};

const progress = loadProgress();
let locale = loadLocale();
const cursor = progress.current ?? { mode: "level", levelIndex: 0 };
const game = createGame({
  mode: cursor.mode,
  levelIndex: cursor.levelIndex,
  lives: 3,
  score: 0,
});
const audio = createAudio();
const ui = createUi(refs);
const renderer = createRenderer({ canvas: refs.stage });

const keys = new Set();
let keySpray = false;
let touchSpray = false;
let stickAxis = 0;
let lastStatus = game.session.status;
let lastHudAt = 0;
let ended = false;
let lastNewBest = false;

function chapterName(session) {
  return t(locale, CHAPTERS[session.chapter]?.nameKey ?? CHAPTERS[0].nameKey);
}

function levelText(snap) {
  if (snap.mode === "rush") return t(locale, "rushClock", { n: Math.ceil(snap.rushTime) });
  return t(locale, "levelLabel", { n: snap.levelNumber });
}

function syncHud() {
  const snap = game.snapshot();
  ui.setHud({
    levelText: levelText(snap),
    chapter: snap.mode === "rush" ? t(locale, "rushTitle") : chapterName(game.session),
    lives: snap.lives,
    score: snap.score,
    time: snap.mode === "rush" ? (90 - snap.rushTime) * 1000 : snap.elapsed * 1000,
    chain: snap.chain,
    bossHp: snap.bossHp,
    bossMax: snap.bossMax,
  });
}

function bannerFor(snap) {
  if (snap.mode === "rush") return t(locale, "rushTitle");
  const chapter = chapterName(game.session);
  if (snap.bossHp > 0) return t(locale, "bossBanner", { chapter });
  return t(locale, "levelBanner", { n: snap.levelNumber, chapter });
}

function applyShell() {
  ui.applyStatic(locale);
  ui.setMode(game.session.mode);
  ui.setPause(game.session.paused);
  ui.setSound(audio.isMuted());
  syncHud();
}

function pushInput() {
  let axis = 0;
  if (stickAxis !== 0) axis = stickAxis;
  else {
    if (keys.has("ArrowLeft") || keys.has("KeyA")) axis -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD")) axis += 1;
  }
  game.setInput({
    axis: Math.max(-1, Math.min(1, axis)),
    spray: keySpray || touchSpray,
  });
}

function sessionStart({ banner = true } = {}) {
  ui.closePanels();
  ended = false;
  lastStatus = "playing";
  ui.setPause(false);
  ui.setMode(game.session.mode);
  remember(progress, game.session.mode, game.session.levelIndex);
  saveProgress(progress);
  syncHud();
  audio.stopAll();
  if (banner) ui.showBanner(bannerFor(game.snapshot()), 1900);
}

function closeOverlays(resume = true) {
  ui.closePanels();
  if (resume && game.session.status === "playing" && game.session.paused) {
    game.resume();
    ui.setPause(false);
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

function pauseForMenu() {
  if (game.session.status === "playing" && !game.session.paused) {
    game.pause();
    ui.setPause(true);
  }
}

function renderLevels() {
  const snap = game.snapshot();
  ui.updateLevels({
    progress,
    current: snap.levelIndex,
    onPick: (index) => {
      game.loadLevel(index);
      sessionStart();
    },
  });
}

function openLevels() {
  pauseForMenu();
  renderLevels();
  ui.openPanel("panel-levels");
}

function openMenu(panelId) {
  pauseForMenu();
  ui.openPanel(panelId);
}

function renderResultPanel(snap, isNewBest) {
  lastNewBest = isNewBest;
  ui.showResult({ snapshot: snap, isNewBest });
  if (snap.mode === "rush") {
    refs.resultNext.hidden = true;
    refs.resultReplay.hidden = false;
    ui.setResultNext(t(locale, "resultReplay"));
  } else if (snap.status === "gameover") {
    refs.resultNext.hidden = false;
    refs.resultReplay.hidden = false;
    ui.setResultNext(t(locale, "resultRetry"));
  } else {
    refs.resultNext.hidden = false;
    refs.resultReplay.hidden = false;
    ui.setResultNext(snap.completed ? t(locale, "resultLevels") : t(locale, "resultNext"));
  }
}

function finish() {
  if (ended) return;
  const snap = game.snapshot();
  if (snap.status === "cleared") {
    ended = true;
    audio.stopAll();
    audio.play("clear");
    if (snap.mode === "level") {
      const before = levelRecord(progress, snap.levelId);
      const isNewBest = !before || snap.stars > before.stars || snap.score > before.score;
      recordLevel(progress, snap.levelId, snap.stars, snap.score, snap.maxChain);
      remember(progress, "level", snap.levelIndex);
      saveProgress(progress);
      ui.setPause(false);
      renderResultPanel(snap, isNewBest);
    } else {
      const isNewBest = snap.score > progress.rush.best;
      recordRush(progress, snap.score, snap.rushKills);
      saveProgress(progress);
      ui.setPause(false);
      renderResultPanel(snap, isNewBest);
    }
  } else if (snap.status === "gameover") {
    ended = true;
    audio.stopAll();
    ui.setPause(false);
    renderResultPanel(snap, false);
  }
}

function switchLocale() {
  locale = otherLocale(locale);
  saveLocale(locale);
  ui.applyStatic(locale);
  ui.setMode(game.session.mode);
  ui.setPause(game.session.paused);
  ui.setSound(audio.isMuted());
  syncHud();
  const snap = game.snapshot();
  if (!refs.resultPanel.hidden) renderResultPanel(snap, lastNewBest);
  if (!document.getElementById("panel-levels").hidden) renderLevels();
}

function chooseMode(mode) {
  if (game.session.mode === mode) {
    closeOverlays();
    return;
  }
  game.setMode(mode);
  sessionStart();
  ui.showToast(t(locale, mode === "rush" ? "toastRush" : "toastLevel"), 2100);
}

function toggleSound() {
  const muted = !audio.isMuted();
  audio.setMuted(muted);
  ui.setSound(muted);
  if (!muted) audio.play("click");
}

// ---- Events ----

refs.modeBtn.addEventListener("click", () => openMenu("panel-mode"));
refs.levelsBtn.addEventListener("click", openLevels);
refs.pauseBtn.addEventListener("click", togglePause);
refs.soundBtn.addEventListener("click", toggleSound);
refs.langBtn.addEventListener("click", switchLocale);
refs.helpBtn.addEventListener("click", () => openMenu("panel-help"));

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
refs.pauseLevels?.addEventListener("click", openLevels);
refs.modeLevelBtn.addEventListener("click", () => chooseMode("level"));
refs.modeRushBtn.addEventListener("click", () => chooseMode("rush"));

refs.resultNext.addEventListener("click", () => {
  const snap = game.snapshot();
  if (snap.status === "gameover") {
    game.restart();
    sessionStart();
    return;
  }
  if (snap.mode === "rush") {
    game.setMode("rush");
    sessionStart();
    return;
  }
  if (snap.completed) {
    openLevels();
    return;
  }
  game.nextLevel();
  sessionStart();
});

refs.resultReplay.addEventListener("click", () => {
  const snap = game.snapshot();
  if (snap.mode === "rush") game.setMode("rush");
  else game.restart();
  sessionStart();
});

refs.resultLevels.addEventListener("click", openLevels);

refs.stage.addEventListener("pointerdown", () => audio.unlock());

// ---- Keyboard ----

window.addEventListener("keydown", (event) => {
  const code = event.code;
  if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "KeyZ", "KeyX", "KeyP", "Escape", "Space"].includes(code)) {
    event.preventDefault();
  }
  audio.unlock();
  if (code === "KeyP" || code === "Escape" || code === "Space") {
    if (!event.repeat) togglePause();
    return;
  }
  if (code === "KeyX") {
    if (!event.repeat) game.pressJump();
    return;
  }
  if (code === "KeyZ") {
    keySpray = true;
    pushInput();
    return;
  }
  if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(code)) {
    keys.add(code);
    pushInput();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "KeyZ") {
    keySpray = false;
    pushInput();
    return;
  }
  if (keys.has(event.code)) {
    keys.delete(event.code);
    pushInput();
  }
});

window.addEventListener("blur", () => {
  keys.clear();
  keySpray = false;
  pushInput();
  doPause();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) doPause();
});

// ---- Touch deck ----

let stickPointer = null;
let stickCenter = { x: 0, y: 0 };

function capturePointer(node, pointerId) {
  try {
    node.setPointerCapture?.(pointerId);
  } catch {
    // synthetic events or a pointer that already ended
  }
}

function updateStick(clientX) {
  const dx = Math.max(-34, Math.min(34, clientX - stickCenter.x));
  if (refs.stickKnob) refs.stickKnob.style.transform = `translateX(${dx}px)`;
  stickAxis = Math.abs(dx) < 8 ? 0 : Math.sign(dx);
  pushInput();
}

refs.stick.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  audio.unlock();
  stickPointer = event.pointerId;
  const rect = refs.stick.getBoundingClientRect();
  stickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  capturePointer(refs.stick, event.pointerId);
  updateStick(event.clientX);
});

refs.stick.addEventListener("pointermove", (event) => {
  if (isStickEvent(event)) updateStick(event.clientX);
});

function isStickEvent(event) {
  return stickPointer !== null && event.pointerId === stickPointer;
}

function releaseStick(event) {
  if (!isStickEvent(event)) return;
  stickPointer = null;
  stickAxis = 0;
  if (refs.stickKnob) refs.stickKnob.style.transform = "translateX(0)";
  pushInput();
}

refs.stick.addEventListener("pointerup", releaseStick);
refs.stick.addEventListener("pointercancel", releaseStick);

refs.sprayBtn.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  audio.unlock();
  touchSpray = true;
  capturePointer(refs.sprayBtn, event.pointerId);
  pushInput();
});

function releaseSpray(event) {
  event.preventDefault();
  touchSpray = false;
  pushInput();
}

refs.sprayBtn.addEventListener("pointerup", releaseSpray);
refs.sprayBtn.addEventListener("pointercancel", releaseSpray);
refs.sprayBtn.addEventListener("pointerleave", (event) => {
  if (event.buttons === 0) {
    touchSpray = false;
    pushInput();
  }
});

refs.jumpBtn.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  audio.unlock();
  game.pressJump();
});

refs.jumpBtn.addEventListener("contextmenu", (event) => event.preventDefault());
refs.stick.addEventListener("contextmenu", (event) => event.preventDefault());

// ---- Loop ----

function routeEvents() {
  for (const event of game.drainEvents()) {
    switch (event.type) {
      case "jump":
        audio.play("jump");
        break;
      case "land":
        audio.play("land");
        break;
      case "spring":
        audio.play("spring");
        break;
      case "freeze":
        audio.play("freeze");
        break;
      case "push":
        audio.play("push");
        break;
      case "kill":
        audio.play("hit");
        if (event.chain >= 3) audio.play("chain", event.chain);
        break;
      case "avalanche":
        ui.showToast(t(locale, "chainShort", { n: event.chain }), 900);
        break;
      case "bounce":
        audio.play("bounce");
        break;
      case "brick":
        audio.play("brick");
        break;
      case "item":
        audio.play("item");
        break;
      case "hurt":
        audio.play("hurt");
        break;
      case "bossHit":
        audio.play("boss");
        break;
      case "throw":
      case "bossThrow":
        audio.play("throw");
        break;
      default:
        break;
    }
  }
}

function updateAudioLoops() {
  const session = game.session;
  const running = session.status === "playing" && !session.paused;
  audio.spray(running && session.world.player.spray);
  const rolling = session.world.snowballs.filter((ball) => ball.rolling);
  if (running && rolling.length > 0) {
    const speed = rolling.reduce((max, ball) => Math.max(max, Math.abs(ball.vx)), 0);
    audio.roll(true, speed);
  } else {
    audio.roll(false);
  }
}

let lastFrame = 0;

function frame(now) {
  const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
  lastFrame = now;
  game.tick(dt);
  routeEvents();
  const session = game.session;
  renderer.draw(session);
  updateAudioLoops();
  if (session.status !== lastStatus) {
    lastStatus = session.status;
    if (session.status !== "playing") finish();
  }
  if (now - lastHudAt > 90) {
    syncHud();
    lastHudAt = now;
  }
  window.requestAnimationFrame(frame);
}

// ---- Boot ----

applyShell();
renderer.resize();
renderer.draw(game.session);
ui.showBanner(bannerFor(game.snapshot()), 2200);
if (game.session.mode === "rush") ui.showToast(t(locale, "toastRush"), 2400);
remember(progress, game.session.mode, game.session.levelIndex);
saveProgress(progress);
window.requestAnimationFrame(frame);

globalThis.__snowball = {
  snapshot: () => game.snapshot(),
  input: (next) => {
    game.setInput(next);
  },
  pressJump: () => game.pressJump(),
  pause: doPause,
  resume: doResume,
  loadLevel: (index) => {
    game.loadLevel(index);
    sessionStart();
  },
  setMode: (mode) => {
    game.setMode(mode);
    sessionStart();
  },
  restart: () => {
    game.restart();
    sessionStart();
  },
  clearLevel: () => game.debugClear(),
  teleport: (x, y) => game.debugTeleport(x, y),
  tick: (seconds) => {
    const steps = Math.max(0, Math.round((Number(seconds) || 0) * 60));
    for (let i = 0; i < steps; i += 1) game.tick(1 / 60);
    routeEvents();
  },
  progress: () => JSON.parse(JSON.stringify(progress)),
  locale: () => locale,
};
