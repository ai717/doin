// Entry point: wiring between input, simulation, canvas stage and DOM shell.
import { SiegeGame, MODES } from "./game.mjs";
import { createRenderer } from "./render.mjs";
import { createUI } from "./ui.mjs";
import * as audio from "./audio.mjs";
import { getStoredLang, setStoredLang, t } from "./i18n.mjs";
import { STATUS, TOTAL_LEVELS } from "./engine.mjs";

const canvas = document.getElementById("stage-canvas");
const glassWrap = document.getElementById("glass-wrap");
const renderer = createRenderer(canvas);
let lang = getStoredLang();

const game = new SiegeGame({
  onFrame: (state, dt, events) => {
    renderer.draw(state, dt, events);
    ui.updateHud(state);
  },
  onFinish: (report, state) => {
    // The board is decided: nothing this run can resume, and any key or pointer
    // the player is still holding must not bleed into the next sortie.
    runLive = false;
    stopIntent();
    ui.showReport(report, state);
  },
  onChange: (state) => {
    ui.buildHullCells(state.maxHull);
    ui.updateHud(state);
  },
});

const ui = createUI({
  onStart: (mode, levelId) => startRun(mode, levelId),
});

let runLive = false;
let helpReturn = "menu";

const heldKeys = new Set();
let pointerHeld = false;

// A sortie can be resumed while it exists and has not been decided; once it is
// over the after-action report owns the screen instead.
function resumable() {
  const state = game.state;
  if (!runLive || !state) return false;
  return state.status !== STATUS.WON && state.status !== STATUS.LOST;
}

function stopIntent() {
  heldKeys.clear();
  pointerHeld = false;
  game.clearInput();
}

// Single exit for every overlay change, so stale input can never survive into
// a different screen (that is what made "hold a key, pause, resume" drift).
function setOverlay(name) {
  stopIntent();
  ui.showOverlay(name);
  if (name === "menu") ui.setResumable(resumable());
}

function startRun(mode, levelId) {
  audio.initAudioOnGesture();
  game.start({ mode, levelId });
  runLive = true;
  ui.buildHullCells(game.state.maxHull);
  ui.updateHud(game.state);
  setOverlay("none");
}

function resumeRun() {
  if (!resumable()) return;
  if (game.isPaused()) game.togglePause();
  setOverlay("none");
}

function openMenu() {
  if (game.state) game.state.paused = true;
  ui.renderMenu(game.progress);
  setOverlay("menu");
}

// Pause is not available once the board is decided - toggling it there used to
// wipe the report and leave the player staring at a frozen deck.
function togglePauseOverlay() {
  if (!resumable()) return;
  const paused = game.togglePause();
  setOverlay(paused ? "pause" : "none");
}

function retryRun() {
  startRun(game.mode ?? MODES.CAMPAIGN, game.levelId ?? 1);
}

function nextRun() {
  startRun(MODES.CAMPAIGN, Math.min(TOTAL_LEVELS, (game.levelId ?? 1) + 1));
}

function refreshLang(next) {
  lang = setStoredLang(next);
  ui.setLang(lang);
  if (game.state) ui.updateHud(game.state, true);
  ui.renderMenu(game.progress);
  ui.setResumable(resumable());
  document.title = `${t("appTitle", lang)} · DOIN`;
}

function bind(id, handler) {
  const node = document.getElementById(id);
  if (node) node.addEventListener("click", handler);
  return node;
}

// Mode tabs only switch which list the hangar shows - they must never touch the
// run that is currently paused behind the menu.
bind("btn-mode-campaign", () => ui.renderMenu(game.progress, MODES.CAMPAIGN));
bind("btn-mode-survival", () => ui.renderMenu(game.progress, MODES.SURVIVAL));
bind("btn-mode-training", () => ui.renderMenu(game.progress, MODES.TRAINING));
bind("btn-pause", togglePauseOverlay);
bind("btn-resume", resumeRun);
bind("btn-continue", resumeRun);
bind("btn-pause-menu", openMenu);
bind("btn-menu", openMenu);
bind("btn-report-menu", openMenu);
bind("btn-retry", retryRun);
bind("btn-next", nextRun);
bind("btn-help", () => {
  helpReturn = ui.currentOverlay();
  setOverlay("help");
});
bind("btn-help-close", () => {
  setOverlay(helpReturn);
});
bind("btn-sound", () => {
  const muted = game.setMuted(!audio.isMuted());
  ui.setSoundIcon(muted);
  if (!muted) audio.initAudioOnGesture();
});
bind("btn-lang", () => {
  refreshLang(lang === "zh" ? "en" : "zh");
});

// ------------------------------------------------------------------ input

function pointerToLogical(event) {
  return renderer.toLogical(event.clientX, event.clientY);
}

function activePointer() {
  return ui.currentOverlay() === "none";
}

if (glassWrap) {
  glassWrap.addEventListener("pointerdown", (event) => {
    audio.initAudioOnGesture();
    if (!activePointer()) return;
    event.preventDefault();
    pointerHeld = true;
    game.setPointer(pointerToLogical(event).x);
    game.setFiring(true);
    // Touch pointers are captured implicitly, mouse pointers are not: without
    // this a drag that leaves the glass silently stops steering.
    try {
      glassWrap.setPointerCapture(event.pointerId);
    } catch {
      /* capture is best-effort */
    }
  });
  glassWrap.addEventListener("pointermove", (event) => {
    // Only a held pointer steers. A plain hover used to seize the turret and
    // permanently shadow the keyboard - the "cannot move left/right" report.
    if (!pointerHeld || !activePointer()) return;
    game.setPointer(pointerToLogical(event).x);
  });
  const release = () => {
    pointerHeld = false;
    game.setFiring(false);
  };
  glassWrap.addEventListener("pointerup", release);
  glassWrap.addEventListener("pointercancel", release);
  glassWrap.addEventListener("pointerleave", release);
}

function syncKeys() {
  let dir = 0;
  if (heldKeys.has("ArrowLeft") || heldKeys.has("a") || heldKeys.has("A")) dir -= 1;
  if (heldKeys.has("ArrowRight") || heldKeys.has("d") || heldKeys.has("D")) dir += 1;
  game.setMove(dir);
  game.setFiring(heldKeys.has(" "));
}

window.addEventListener("keydown", (event) => {
  const key = event.key;
  if (key === " " || key.startsWith("Arrow")) event.preventDefault();
  const overlay = ui.currentOverlay();
  if (key === "p" || key === "P") {
    if (overlay === "none" || overlay === "pause") togglePauseOverlay();
    return;
  }
  if (key === "r" || key === "R") {
    if (overlay === "none" || overlay === "pause") retryRun();
    return;
  }
  if (key === "Escape") {
    if (overlay === "help") setOverlay(helpReturn);
    else if (overlay === "menu" || overlay === "pause") resumeRun();
    else if (overlay === "none") togglePauseOverlay();
    return;
  }
  if (overlay !== "none") return;
  heldKeys.add(key);
  syncKeys();
});

window.addEventListener("keyup", (event) => {
  heldKeys.delete(event.key);
  syncKeys();
});

// Losing focus mid-hold would otherwise leave a key stuck down forever.
window.addEventListener("blur", () => {
  heldKeys.clear();
  syncKeys();
});

const onResize = () => renderer.resize();
window.addEventListener("resize", onResize);
window.addEventListener("orientationchange", onResize);

// ------------------------------------------------------------------- boot

ui.setLang(lang);
ui.setSoundIcon(game.progress.muted);
audio.setMuted(Boolean(game.progress.muted));
game.start({ mode: MODES.CAMPAIGN, levelId: 1 });
if (game.state) {
  game.state.paused = true;
  ui.buildHullCells(game.state.maxHull);
}
runLive = false;
ui.renderMenu(game.progress, MODES.CAMPAIGN);
setOverlay("menu");
document.title = `${t("appTitle", lang)} · DOIN`;

// Debug handle, same convention as the other DOIN games (`window.__mole`,
// `window.__spaceDefender`, ...): lets a smoke run drive the real controller.
window.__siege = { game, ui, renderer, startRun, resumeRun, openMenu, setOverlay };

export { game, ui, renderer, startRun, openMenu, refreshLang, STATUS };
