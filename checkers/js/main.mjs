// main.mjs - wiring only: preferences, controller, view, persistence and
// the portal handshake. No game rules and no rendering logic live here.

import { RED, BLUE, createState } from "./engine.mjs";
import { MODES, createGameController } from "./game.mjs";
import { DIFFICULTY_INTERMEDIATE } from "./ai.mjs";
import { createUi } from "./ui.mjs";
import { DEFAULT_LOCALE, htmlLang, normalizeLocale, translate } from "./i18n.mjs";
import { setMuted, sfx } from "./audio.mjs";
import { getPuzzle, PUZZLES, puzzleBoard } from "./puzzles.mjs";
import {
  clearRun, loadLocale, loadMeta, loadPuzzleProgress, loadRun, loadSound,
  recordPuzzle, recordResult, saveLocale, saveRun, saveSound,
} from "./storage.mjs";

const PORTAL_META_KEY = "doin.meta.v1";

function reportSession(result, config) {
  const won = result.humanOutcome
    ? result.humanOutcome === "win"
    : result.winner === config?.humanSide;
  const payload = {
    slug: "checkers",
    outcome: won ? "WON" : "LOST",
    score: result.puzzle ? result.puzzle.stars * 100 : Math.max(0, 1000 - result.plies),
    stars: result.puzzle ? result.puzzle.stars : (won ? (result.maxHops >= 4 ? 3 : 2) : 1),
    timestamp: Date.now(),
  };
  try {
    const raw = localStorage.getItem(PORTAL_META_KEY);
    const meta = raw ? JSON.parse(raw) : {};
    meta.recentlyPlayed = [
      payload.slug,
      ...(Array.isArray(meta.recentlyPlayed) ? meta.recentlyPlayed.filter((s) => s !== payload.slug) : []),
    ].slice(0, 8);
    meta.totalStars = (Number(meta.totalStars) || 0) + payload.stars;
    localStorage.setItem(PORTAL_META_KEY, JSON.stringify(meta));
  } catch {
    // Storage may be blocked; the game itself is unaffected.
  }
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "DOIN_GAME_EVENT", payload }, "*");
    }
  } catch {
    // Cross-origin sandbox: ignore.
  }
}

export function boot(doc = globalThis.document) {
  let locale = normalizeLocale(loadLocale() || DEFAULT_LOCALE);
  let soundOn = loadSound();
  setMuted(!soundOn);

  const savedRun = loadRun();
  let ui = null;
  let resultShown = false;
  let lastSavedPly = -1;

  const controller = createGameController({
    onChange(view) {
      ui?.render(view);
      const ply = view.stats?.plies ?? 0;
      if (ply !== lastSavedPly) {
        lastSavedPly = ply;
        if (view.config?.mode !== MODES.PUZZLE && view.state?.status === "playing" && view.config) {
          saveRun({
            mode: view.config.mode,
            difficulty: view.config.difficulty,
            humanSide: view.config.humanSide,
            moves: controller.getMoveLog().map((m) => ({ from: m.from, to: m.to })),
          });
        }
      }
      if (!view.finished) resultShown = false;
      if (view.finished && !resultShown) settle();
    },
  });

  function settle() {
    resultShown = true;
    const result = controller.result();
    if (!result) return;
    if (result.mode === MODES.PUZZLE) {
      if (!result.puzzle?.solved) {
        ui.toast(translate(locale, "puzzleFailed"));
        return; // keep the board: undo reopens the study
      }
      const outcome = recordPuzzle(result.puzzle.id, result.puzzle.stars);
      ui.renderProgress(loadPuzzleProgress());
      ui.showResult(result, outcome);
      reportSession(result, controller.view().config);
      return;
    }
    const outcome = recordResult(result);
    clearRun();
    ui.renderRecords(loadMeta());
    ui.showResult(result, outcome);
    reportSession(result, controller.view().config);
  }

  function currentConfig() {
    return controller.view().config ?? {
      mode: MODES.PVE,
      difficulty: DIFFICULTY_INTERMEDIATE,
      humanSide: RED,
      puzzle: null,
    };
  }

  function startRun(overrides = {}) {
    const current = currentConfig();
    resultShown = false;
    lastSavedPly = -1;
    clearRun();
    ui.hideResult();
    ui.hideLevels();
    ui.clearSelection();
    const mode = overrides.mode ?? current.mode;
    const next = {
      mode,
      difficulty: overrides.difficulty ?? current.difficulty,
      humanSide: overrides.humanSide ?? current.humanSide,
    };
    if (mode === MODES.PUZZLE) {
      const level = overrides.puzzle
        ?? (current.puzzle ? getPuzzle(current.puzzle.id) : null)
        ?? PUZZLES[0];
      next.puzzle = { id: level.id, chapter: level.chapter, par: level.par, goal: level.goal };
      next.engineState = createState(puzzleBoard(level), RED);
    }
    controller.start(next);
    return controller.view();
  }

  function onAction(name, value) {
    switch (name) {
      case "mode":
        if (value === MODES.PUZZLE) {
          ui.showLevels(loadPuzzleProgress());
          break;
        }
        if (value !== currentConfig().mode) startRun({ mode: value === MODES.PVP ? MODES.PVP : MODES.PVE });
        break;
      case "puzzle": {
        const level = getPuzzle(Number(value));
        if (level) startRun({ mode: MODES.PUZZLE, puzzle: level });
        break;
      }
      case "closeLevels":
        ui.hideLevels();
        break;
      case "nextLevel": {
        const id = controller.view().puzzle?.id ?? 0;
        const next = getPuzzle(id + 1) ?? PUZZLES[0];
        startRun({ mode: MODES.PUZZLE, puzzle: next });
        break;
      }
      case "difficulty":
        controller.setDifficulty(value);
        break;
      case "side":
        startRun({ humanSide: value === "blue" ? BLUE : RED });
        break;
      case "undo":
        if (controller.undo()) sfx.undo();
        else sfx.blocked();
        break;
      case "restart": {
        const confirmed = doc.defaultView?.confirm
          ? doc.defaultView.confirm(translate(locale, "restartConfirm"))
          : true;
        if (!confirmed) break;
        startRun();
        ui.toast(translate(locale, "restartDone"));
        break;
      }
      case "sound":
        soundOn = !soundOn;
        setMuted(!soundOn);
        saveSound(soundOn);
        ui.syncSound(soundOn);
        if (soundOn) sfx.select();
        break;
      case "lang":
        locale = locale === "en" ? "zh" : "en";
        saveLocale(locale);
        ui.applyLocale(locale);
        ui.syncSound(soundOn);
        break;
      case "help":
        ui.showHelp();
        break;
      case "closeHelp":
        ui.hideHelp();
        break;
      case "again":
        startRun();
        break;
      default:
        break;
    }
  }

  ui = createUi({
    doc,
    controller,
    onAction,
    onSfx(name, arg) {
      const fn = sfx[name];
      if (typeof fn === "function") fn(arg);
    },
  });

  ui.applyLocale(locale);
  ui.syncSound(soundOn);
  ui.start();
  ui.renderRecords(loadMeta());

  if (savedRun) controller.restore(savedRun);
  else controller.start({ mode: MODES.PVE, difficulty: DIFFICULTY_INTERMEDIATE, humanSide: RED });

  // Portal debug handle. `game` must be a getter so it never points at a
  // stale controller instance.
  const handle = {
    get game() { return controller; },
    ui,
    view: () => controller.view(),
    state: () => controller.view().state,
    startRun,
    startPuzzle: (id) => startRun({ mode: MODES.PUZZLE, puzzle: getPuzzle(Number(id)) }),
    openLevels: () => ui.showLevels(loadPuzzleProgress()),
    progress: () => loadPuzzleProgress(),
    play: (move) => controller.play(move),
    select: (hole) => ui.select(hole),
    overlay: () => ui.currentOverlay(),
    applyLocale(next) {
      locale = normalizeLocale(next);
      saveLocale(locale);
      ui.applyLocale(locale);
      return locale;
    },
    htmlLang: () => htmlLang(locale),
  };
  globalThis.__checkers = handle;
  return handle;
}

if (globalThis.document?.querySelector?.("#tea-room")) {
  boot(globalThis.document);
}
