// Assembly entry: binds DOM events, drives the fixed clock and routes engine events to sound and the scroll UI.

import { createGame } from "./game.mjs";
import { createUi } from "./ui.mjs";
import { createAudio } from "./audio.mjs";
import { GLYPHS } from "./data.mjs";
import { LEVELS } from "./levels.mjs";
import { t, loadLocale, saveLocale, otherLocale } from "./i18n.mjs";
import { allComplete, chapterComplete } from "./score.mjs";
import {
  load as loadProgress,
  save as saveProgress,
  remember,
  recordLevel,
  levelRecord,
} from "./storage.mjs";

const refs = {
  board: document.getElementById("board"),
  linkLayer: document.getElementById("link-layer"),
  oracleGrid: document.getElementById("oracle-grid"),
  charGrid: document.getElementById("char-grid"),
  hudChapter: document.getElementById("hud-chapter"),
  hudLevel: document.getElementById("hud-level"),
  hudPairs: document.getElementById("hud-pairs"),
  hudErrors: document.getElementById("hud-errors"),
  hudTime: document.getElementById("hud-time"),
  hudStars: document.getElementById("hud-stars"),
  levelsBtn: document.getElementById("btn-levels"),
  soundBtn: document.getElementById("btn-sound"),
  langBtn: document.getElementById("btn-lang"),
  helpBtn: document.getElementById("btn-help"),
  keyHint: document.getElementById("key-hint"),
  toast: document.getElementById("toast"),
  levelGroups: document.getElementById("level-groups"),
  selectTotal: document.getElementById("select-total"),
  panelLevels: document.getElementById("panel-levels"),
  panelHelp: document.getElementById("panel-help"),
  panelResult: document.getElementById("panel-result"),
  resultTitle: document.getElementById("result-title"),
  resultStars: document.getElementById("result-stars"),
  resultRows: document.getElementById("result-rows"),
  resultNote: document.getElementById("result-note"),
  resultNext: document.getElementById("btn-result-next"),
  resultReplay: document.getElementById("btn-result-replay"),
  resultSelect: document.getElementById("btn-result-select"),
  evolution: document.getElementById("evolution"),
  evolutionTitle: document.getElementById("evolution-title"),
  evolutionTrack: document.getElementById("evolution-track"),
};

const progress = loadProgress();
let locale = loadLocale();
const game = createGame({ levelIndex: progress.current?.levelIndex ?? 0 });
const audio = createAudio();
const ui = createUi(refs);

let ended = false;
let lastResult = null;
let resultTimer = 0;
let frozenByPanel = false;
let lastHudAt = 0;

function currentSnapshot() {
  return game.snapshot();
}

function renderBoard() {
  ui.buildBoard({
    snapshot: currentSnapshot(),
    handlers: {
      onPick: pickCard,
    },
  });
}

function refresh() {
  const snapshot = currentSnapshot();
  ui.syncBoard(snapshot);
  ui.drawLinks(snapshot);
  ui.updateHud(snapshot, progress);
}

function freezeForPanel() {
  if (game.session.status === "playing" && !game.session.paused) {
    game.pause();
    frozenByPanel = true;
  }
}

function closePanels() {
  ui.closePanels();
  if (frozenByPanel && game.session.status === "playing") game.resume();
  frozenByPanel = false;
}

function startLevel(index) {
  globalThis.clearTimeout(resultTimer);
  resultTimer = 0;
  ended = false;
  lastResult = null;
  frozenByPanel = false;
  game.loadLevel(index);
  remember(progress, game.levelIndex);
  saveProgress(progress);
  ui.closePanels();
  ui.resetEvolution();
  renderBoard();
  ui.updateHud(currentSnapshot(), progress);
}

function resultNextLabel(snapshot) {
  const hasNext = snapshot.levelIndex < LEVELS.length - 1;
  if (!hasNext) return t(locale, "resultSelect");
  return t(locale, "resultNext");
}

function showResultNow() {
  if (!lastResult) return;
  ui.showResult({
    snapshot: lastResult.snapshot,
    progress,
    isNewRecord: lastResult.isNewRecord,
    chapterDone: lastResult.chapterDone,
    allDone: lastResult.allDone,
  });
  ui.setResultNext(resultNextLabel(lastResult.snapshot));
}

function handleClear() {
  if (ended) return;
  ended = true;
  const snapshot = currentSnapshot();
  const previous = levelRecord(progress, snapshot.levelId);
  const isNewRecord = !previous
    || snapshot.stars > previous.stars
    || (snapshot.stars === previous.stars && snapshot.time > 0 && (previous.bestTime <= 0 || snapshot.time < previous.bestTime));
  recordLevel(progress, snapshot.levelId, {
    stars: snapshot.stars,
    time: snapshot.time,
    errors: snapshot.errors,
  });
  remember(progress, snapshot.levelIndex);
  saveProgress(progress);
  const chapterDone = chapterComplete(progress.levels, snapshot.chapterIndex);
  const allDone = allComplete(progress.levels);
  lastResult = { snapshot, isNewRecord, chapterDone, allDone };
  ui.drawLinks(snapshot);
  ui.updateHud(snapshot, progress);
  audio.play("scroll");
  if (allDone) ui.showToast(t(locale, "toastAll"), 2200);
  else if (chapterDone) ui.showToast(t(locale, "toastChapter"), 2000);
  globalThis.clearTimeout(resultTimer);
  resultTimer = globalThis.setTimeout(() => {
    resultTimer = 0;
    showResultNow();
  }, 620);
}

function routeEvents(events) {
  for (const event of events) {
    if (event.type === "pick") {
      audio.play("carve");
    } else if (event.type === "cancel") {
      audio.play("click");
    } else if (event.type === "match") {
      const glyph = GLYPHS[event.glyphId];
      audio.play("rub");
      if (glyph) ui.showEvolution(glyph);
      globalThis.setTimeout(() => audio.play("bell"), 260);
      ui.showToast(t(locale, "toastMatched"), 1100);
    } else if (event.type === "mismatch") {
      audio.play("tap");
      ui.showToast(t(locale, "toastWrong"), 1200);
    } else if (event.type === "clear") {
      handleClear();
    }
  }
}

function pickCard(side, index) {
  if (ended || ui.anyPanelOpen()) return;
  audio.unlock();
  const event = game.select(side, index);
  if (!event) return;
  routeEvents(game.drainEvents());
  refresh();
}

function openLevels() {
  freezeForPanel();
  ui.renderLevels({
    progress,
    currentIndex: game.levelIndex,
    onPick: (index) => {
      audio.play("page");
      startLevel(index);
    },
  });
  ui.openPanel("panel-levels");
  audio.play("page");
}

function openHelp() {
  freezeForPanel();
  ui.openPanel("panel-help");
  audio.play("page");
}

function renderResultIfOpen() {
  if (refs.panelResult && !refs.panelResult.hidden) showResultNow();
}

function switchLocale() {
  locale = otherLocale(locale);
  saveLocale(locale);
  ui.applyStatic(locale);
  ui.setSound(audio.isMuted());
  renderBoard();
  if (refs.panelLevels && !refs.panelLevels.hidden) {
    ui.renderLevels({
      progress,
      currentIndex: game.levelIndex,
      onPick: (index) => {
        audio.play("page");
        startLevel(index);
      },
    });
  }
  renderResultIfOpen();
  ui.updateHud(currentSnapshot(), progress);
}

function toggleSound() {
  const muted = !audio.isMuted();
  audio.setMuted(muted);
  ui.setSound(muted);
  if (!muted) audio.play("click");
}

function focusCard(delta) {
  const cards = [...document.querySelectorAll(".pair-card:not(:disabled)")];
  if (!cards.length) return;
  const active = document.activeElement;
  const index = cards.indexOf(active);
  const next = index < 0 ? (delta > 0 ? 0 : cards.length - 1) : (index + delta + cards.length) % cards.length;
  cards[next].focus();
}

function cancelSelection() {
  if (ended || ui.anyPanelOpen()) return;
  if (!game.session.selected) return;
  game.cancel();
  game.drainEvents();
  refresh();
  audio.play("click");
}

// ---- Controls ----

refs.levelsBtn.addEventListener("click", openLevels);
refs.helpBtn.addEventListener("click", openHelp);
refs.soundBtn.addEventListener("click", toggleSound);
refs.langBtn.addEventListener("click", switchLocale);

for (const button of document.querySelectorAll("[data-close]")) {
  button.addEventListener("click", closePanels);
}

refs.resultNext.addEventListener("click", () => {
  const snapshot = currentSnapshot();
  if (snapshot.status !== "cleared") return;
  if (snapshot.levelIndex < LEVELS.length - 1) {
    startLevel(snapshot.levelIndex + 1);
  } else {
    openLevels();
  }
});

refs.resultReplay.addEventListener("click", () => {
  startLevel(currentSnapshot().levelIndex);
});

refs.resultSelect.addEventListener("click", openLevels);

document.addEventListener("pointerdown", () => audio.unlock(), { once: true });

window.addEventListener("keydown", (event) => {
  if (event.code === "Escape") {
    if (refs.panelResult && !refs.panelResult.hidden) return;
    if (ui.anyPanelOpen()) {
      closePanels();
      return;
    }
    cancelSelection();
    return;
  }
  if (event.code === "KeyR") {
    if (ended || ui.anyPanelOpen()) return;
    startLevel(game.levelIndex);
    return;
  }
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.code)) {
    event.preventDefault();
    focusCard(event.code === "ArrowLeft" || event.code === "ArrowUp" ? -1 : 1);
  }
});

window.addEventListener("resize", () => {
  ui.drawLinks(currentSnapshot());
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (game.session.status === "playing" && !game.session.paused) game.pause();
  } else if (!ui.anyPanelOpen() && game.session.status === "playing" && game.session.paused && !frozenByPanel) {
    game.resume();
  }
});

// ---- Boot ----

ui.applyStatic(locale);
ui.setSound(audio.isMuted());
renderBoard();
ui.updateHud(currentSnapshot(), progress);

let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.25, (now - lastFrame) / 1000);
  lastFrame = now;
  game.tick(dt);
  routeEvents(game.drainEvents());
  if (now - lastHudAt > 180) {
    lastHudAt = now;
    ui.updateHud(currentSnapshot(), progress);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__oracle = {
  snapshot: () => game.snapshot(),
  pick: (side, index) => {
    const event = game.select(side, index);
    routeEvents(game.drainEvents());
    refresh();
    return event;
  },
  solvePair: (pairIndex) => {
    const event = game.debugSolvePair(pairIndex);
    routeEvents(game.drainEvents());
    refresh();
    return event;
  },
  solveAll: () => {
    const event = game.debugSolveAll();
    routeEvents(game.drainEvents());
    refresh();
    return event;
  },
  loadLevel: (index) => {
    startLevel(index);
    return game.snapshot();
  },
  restart: () => {
    startLevel(game.levelIndex);
    return game.snapshot();
  },
  pause: () => game.pause(),
  resume: () => game.resume(),
  cancel: cancelSelection,
  progress,
  get session() {
    return game.session;
  },
  get locale() {
    return locale;
  },
};
