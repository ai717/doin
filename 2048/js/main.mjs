import * as audio from "./audio.mjs";
import {
  applyMove,
  continueGame,
  hasProgress,
  highestTile,
  settle as settleTiles,
  startGame,
} from "./engine.mjs";
import { bindKeyboard, bindSwipe } from "./input.mjs";
import { detectLocale, strings } from "./i18n.mjs";
import {
  hasPrefs,
  loadBest,
  loadPrefs,
  loadSave,
  loadStats,
  noteBestTile,
  noteGame,
  noteWin,
  savePrefs,
  writeSave,
} from "./storage.mjs";
import { createUi } from "./ui.mjs";

const SLIDE_MS = 170;

const ui = createUi({
  move,
  undo,
  requestRestart,
  restartNow,
  cancelRestart,
  continueGame: continueRun,
  toggleMute,
  toggleTheme,
  toggleLocale,
  toggleHelp,
});

let copy = strings("zh");
let state = null;
let undoSnapshot = null;
let stats = loadStats();
let prefs = loadPrefs();
let panel = "none";
let locked = false;
let queued = null;
let counted = false;
let settleTimer = 0;

function persist() {
  writeSave(state, undoSnapshot);
}

function isInputOpen() {
  if (panel !== "none") return false;
  if (state.over) return false;
  return !(state.won && !state.keepPlaying);
}

function syncOverlay() {
  if (panel !== "none") ui.setOverlay(panel);
  else if (state.over) ui.setOverlay("lose");
  else if (state.won && !state.keepPlaying) ui.setOverlay("win");
  else ui.setOverlay("none");
}

function refreshStats() {
  stats = noteBestTile(stats, highestTile(state.tiles));
  ui.setStats(stats);
}

function move(dir) {
  audio.unlock();
  if (!isInputOpen()) return;
  if (locked) {
    queued = dir;
    return;
  }

  const before = { won: state.won, over: state.over };
  const result = applyMove(state, dir);
  if (!result.moved) return;

  undoSnapshot = state;
  state = result.state;
  locked = true;

  ui.render(state, { absorbed: result.absorbed, gain: result.gained });
  ui.setUndoEnabled(true);
  persist();
  refreshStats();

  if (result.gained > 0) audio.playMerge(result.topMerge);
  else audio.playMove();

  if (state.won && !before.won) {
    stats = noteWin(stats);
    ui.setStats(stats);
    audio.playWin();
    ui.announce(copy.announceWin);
  } else if (state.over && !before.over) {
    if (!counted) {
      stats = noteGame(stats);
      counted = true;
      ui.setStats(stats);
    }
    audio.playLose();
    ui.announce(copy.announceLose);
  }

  window.clearTimeout(settleTimer);
  settleTimer = window.setTimeout(settle, SLIDE_MS);
}

function settle() {
  locked = false;
  ui.releaseGhosts();
  const next = queued;
  queued = null;
  if (next) window.setTimeout(() => move(next), 0);
  syncOverlay();
}

function countRun() {
  if (counted || !hasProgress(state)) return;
  stats = noteGame(stats);
  counted = true;
}

function restartNow() {
  countRun();
  window.clearTimeout(settleTimer);
  locked = false;
  queued = null;
  counted = false;
  panel = "none";
  undoSnapshot = null;
  state = startGame(state.best);
  ui.setUndoEnabled(false);
  ui.render(state);
  ui.setStats(stats);
  ui.announce(copy.announceNew);
  persist();
  syncOverlay();
}

function requestRestart() {
  if (hasProgress(state) && !state.over) {
    panel = "confirm";
    syncOverlay();
    return;
  }
  restartNow();
}

function cancelRestart() {
  panel = "none";
  syncOverlay();
}

function undo() {
  if (!undoSnapshot) return;
  window.clearTimeout(settleTimer);
  locked = false;
  queued = null;
  state = { ...undoSnapshot, tiles: settleTiles(undoSnapshot.tiles), best: state.best };
  undoSnapshot = null;
  ui.setUndoEnabled(false);
  ui.render(state);
  persist();
  syncOverlay();
}

function continueRun() {
  state = continueGame(state);
  persist();
  syncOverlay();
}

function toggleHelp() {
  panel = panel === "help" ? "none" : "help";
  syncOverlay();
}

function toggleMute() {
  prefs = savePrefs({ muted: !prefs.muted });
  audio.setMuted(prefs.muted);
  ui.setMuted(prefs.muted);
  if (!prefs.muted) audio.unlock();
}

function toggleTheme() {
  prefs = savePrefs({ theme: prefs.theme === "dark" ? "light" : "dark" });
  ui.applyTheme(prefs.theme);
}

function toggleLocale() {
  prefs = savePrefs({ locale: prefs.locale === "zh" ? "en" : "zh" });
  copy = strings(prefs.locale);
  ui.applyLocale(prefs.locale);
}

function flush() {
  if (state) persist();
}

function boot() {
  if (!hasPrefs()) prefs = savePrefs({ locale: detectLocale() });
  copy = strings(prefs.locale);

  const saved = loadSave();
  if (saved) {
    state = saved.state;
    undoSnapshot = saved.undo;
    counted = state.over;
  } else {
    state = startGame(loadBest());
    writeSave(state, null);
  }

  ui.applyLocale(prefs.locale);
  ui.applyTheme(prefs.theme);
  audio.setMuted(prefs.muted);
  ui.setMuted(prefs.muted);
  ui.setUndoEnabled(Boolean(undoSnapshot));
  ui.render(state);
  refreshStats();
  syncOverlay();

  bindKeyboard(move, isInputOpen);
  bindSwipe(document.getElementById("board-wrap"), move, isInputOpen);

  const unlock = () => audio.unlock();
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
}

boot();
