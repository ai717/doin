// unravel main — assembly entry. Binds controller, UI, audio, storage and the
// portal bridge. Instant play: a ready board is on screen the moment the module
// loads; the levels drawer is a lightweight overlay, never a blocking mask.

import { freeStrands, isFree } from "./engine.mjs";
import { createController } from "./game.mjs";
import { LEVEL_COUNT } from "./levels.mjs";
import { translate } from "./i18n.mjs";
import * as audio from "./audio.mjs";
import { formatTime, computeStars } from "./score.mjs";
import { loadProgress, patchProgress } from "./storage.mjs";
import { createUi, displaySortedStrands } from "./ui.mjs";

let progress = loadProgress();
const ctrl = createController();
let hudInterval = null;
let endTimer = null;

function syncHudTimer() {
  if (!ctrl.ctrl.state) return;
  ui.setTimerText(translate("hudTime", { t: formatTime(ctrl.getElapsedMs()) }));
}

function reportGameSession(outcome) {
  try {
    const meta = JSON.parse(localStorage.getItem("doin.meta.v1") || "{}");
    meta.recentlyPlayed = ["unravel", ...(meta.recentlyPlayed || []).filter((s) => s !== "unravel")].slice(0, 8);
    meta.totalStars = (meta.totalStars || 0) + (outcome.stars || 0);
    localStorage.setItem("doin.meta.v1", JSON.stringify(meta));
  } catch {
    /* storage unavailable */
  }
  if (typeof window !== "undefined" && window.parent && window.parent !== window) {
    window.parent.postMessage({
      type: "DOIN_GAME_EVENT",
      payload: {
        slug: "unravel",
        outcome: outcome.won ? "WON" : "LOST",
        score: outcome.score || 0,
        stars: outcome.stars || 0,
        timestamp: Date.now(),
      },
    }, "*");
  }
}

function startLevel(id) {
  clearTimeout(endTimer);
  ctrl.loadLevel(id);
  if (typeof ui !== "undefined") {
    ui.hideEnd();
    ui.setContext(ctrl.ctrl.board, ctrl.ctrl.state);
    syncHudTimer();
  }
}

function startRelax() {
  clearTimeout(endTimer);
  const seed = (Date.now() ^ Math.imul(progress.relaxCount + 1, 2654435761)) >>> 0;
  ctrl.startRelax(seed);
  progress = patchProgress({ relaxCount: progress.relaxCount + 1 });
  if (typeof ui !== "undefined") {
    ui.hideEnd();
    ui.setContext(ctrl.ctrl.board, ctrl.ctrl.state);
    syncHudTimer();
  }
}

function finishWin() {
  ctrl.pauseTimer();
  const elapsed = ctrl.getElapsedMs();
  const stats = ctrl.ctrl.state.stats;
  let stars = 0;
  if (ctrl.ctrl.state.mode === "level") {
    stars = computeStars({
      won: true,
      elapsedMs: elapsed,
      undoCount: ctrl.ctrl.undoCount,
      slotPeak: stats.slotPeak,
      parMs: ctrl.ctrl.board.parMs,
      cap: ctrl.ctrl.board.cap,
    });
    const starsMap = { ...progress.stars };
    const key = String(ctrl.ctrl.levelId);
    starsMap[key] = Math.max(starsMap[key] || 0, stars);
    progress = patchProgress({
      stars: starsMap,
      maxLevel: Math.min(LEVEL_COUNT, Math.max(progress.maxLevel, ctrl.ctrl.levelId + 1)),
      mode: "level",
    });
  }
  reportGameSession({
    won: true,
    stars,
    score: Math.max(0, Math.round(1000 - elapsed / 100)),
  });
  audio.playWin();
  endTimer = setTimeout(() => {
    ui.showEnd(ctrl.ctrl.state.mode === "relax" ? "relax" : "won", {
      stars,
      timeText: formatTime(elapsed),
      undos: ctrl.ctrl.undoCount,
      peak: stats.slotPeak,
    });
  }, 900);
}

function finishLose() {
  ctrl.pauseTimer();
  reportGameSession({ won: false, stars: 0, score: 0 });
  audio.playReject();
  endTimer = setTimeout(() => ui.showEnd("lost", {}), 500);
}

function handleEvent(event) {
  if (!event) return;
  ui.setContext(ctrl.ctrl.board, ctrl.ctrl.state, ctrl.ctrl.undoCount);
  if (event.type === "collect") {
    audio.playPull(ctrl.ctrl.state.stats.collects % 7);
    if (event.merges && event.merges.length) {
      audio.playMerge(event.merges.length + Math.floor(ctrl.ctrl.state.stats.collects / 9));
    }
  } else if (event.type === "untie") {
    audio.playUntie();
  } else if (event.type === "undo") {
    audio.playTick();
  }
  ui.onEvent(event);
  if (event.status === "won") finishWin();
  else if (event.status === "lost") finishLose();
}

function refreshLevelsDrawer() {
  ui.renderLevels(ctrl.ctrl.state && ctrl.ctrl.state.mode === "relax" ? 0 : ctrl.ctrl.levelId, progress.maxLevel, progress.stars);
}

function selectFreeTarget(index) {
  const state = ctrl.ctrl.state;
  if (!state || state.status !== "playing") return;
  const targets = displaySortedStrands(ctrl.ctrl.board).filter((s) => {
    if (state.collected.includes(s.id)) return false;
    if (!isFree(ctrl.ctrl.board, state, s.id)) return false;
    return !s.knot || state.untied[s.id];
  });
  const target = targets[index];
  if (!target) return;
  handleEvent(ctrl.collect(target.id));
}

const hooks = {
  collect(id) {
    handleEvent(ctrl.collect(id));
  },
  untie(id) {
    handleEvent(ctrl.untie(id));
  },
  undo() {
    const event = ctrl.undo();
    if (!event) {
      ui.toast("toastNoUndo");
      return;
    }
    ui.hideEnd();
    handleEvent(event);
  },
  undoFromEnd() {
    hooks.undo();
  },
  hint() {
    const h = ctrl.hint();
    if (!h) {
      ui.toast("toastNoFree");
      return;
    }
    audio.playTick();
    ui.glowHint(h);
  },
  restart() {
    clearTimeout(endTimer);
    ctrl.restart();
    ui.hideEnd();
    ui.setContext(ctrl.ctrl.board, ctrl.ctrl.state);
    syncHudTimer();
  },
  next() {
    if (ctrl.ctrl.state.mode === "relax") {
      startRelax();
      return;
    }
    if (ctrl.ctrl.levelId < LEVEL_COUNT) startLevel(ctrl.ctrl.levelId + 1);
    else hooks.openLevels();
  },
  replay() {
    hooks.restart();
  },
  openLevels() {
    ctrl.pauseTimer();
    refreshLevelsDrawer();
    ui.showLevels();
  },
  closeLevels() {
    ui.hideLevels();
    ctrl.resumeTimer();
  },
  selectLevel(n) {
    ui.hideLevels();
    ctrl.resumeTimer();
    if (n === ctrl.ctrl.levelId && ctrl.ctrl.state.status === "playing") return;
    startLevel(n);
  },
  toggleMode() {
    clearTimeout(endTimer);
    if (ctrl.ctrl.state && ctrl.ctrl.state.mode === "relax") {
      progress = patchProgress({ mode: "level" });
      startLevel(Math.min(LEVEL_COUNT, progress.maxLevel));
    } else {
      progress = patchProgress({ mode: "relax" });
      startRelax();
    }
  },
  toggleSound() {
    audio.setMuted(!audio.isMuted());
    progress = patchProgress({ sound: !audio.isMuted() });
    ui.applyStaticText();
    audio.playTick();
  },
  openHelp() {
    ctrl.pauseTimer();
    ui.showHelp();
  },
  closeHelp() {
    ui.hideHelp();
    ctrl.resumeTimer();
  },
  closeEnd() {
    ui.hideEnd();
  },
  reject() {
    audio.playReject();
  },
  refreshLevels: refreshLevelsDrawer,
  afterLangChange() {
    syncHudTimer();
    if (ui.isDrawerOpen()) refreshLevelsDrawer();
  },
  soundMuted() {
    return audio.isMuted();
  },
};

const ui = createUi(hooks);

function bindKeyboard() {
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented) return;
    const tag = (e.target && e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    const key = e.key.toLowerCase();
    if (key === "escape") {
      if (ui.isDrawerOpen()) hooks.closeLevels();
      else hooks.closeHelp();
      return;
    }
    if (key === "l") {
      hooks.openLevels();
      return;
    }
    if (key === "u") {
      hooks.undo();
      return;
    }
    if (key === "h") {
      hooks.hint();
      return;
    }
    if (key === "r") {
      hooks.restart();
      return;
    }
    if (/^[1-9]$/.test(key)) {
      selectFreeTarget(Number(key) - 1);
    }
  });
}

function bindLifecycle() {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) ctrl.pauseTimer();
    else if (!ui.isDrawerOpen()) ctrl.resumeTimer();
  });
  window.addEventListener("blur", () => ctrl.pauseTimer());
  window.addEventListener("focus", () => {
    if (!ui.isDrawerOpen()) ctrl.resumeTimer();
  });
}

function boot() {
  audio.setMuted(!progress.sound);
  if (progress.mode === "relax") startRelax();
  else startLevel(Math.min(LEVEL_COUNT, progress.maxLevel));
  ui.init({ board: ctrl.ctrl.board, state: ctrl.ctrl.state, undoCount: 0 });
  syncHudTimer();
  bindKeyboard();
  bindLifecycle();
  clearInterval(hudInterval);
  hudInterval = setInterval(syncHudTimer, 500);
}

boot();
