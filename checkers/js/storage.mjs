// storage.mjs - single source of truth for persistence.
// Key: doin.checkers.v1. Locale stays on the portal-wide doin.lang key.
// Every read is replayed through the engine, so a corrupt move list can never
// desynchronise the board or white-screen the page. Falls back to memory when
// localStorage is unavailable.

import { RED, BLUE, HOLE_COUNT, createInitialState, applyMove } from "./engine.mjs";
import { DIFFICULTY_META, DIFFICULTY_INTERMEDIATE } from "./ai.mjs";
import { MODES, OUTCOME } from "./game.mjs";
import { PUZZLE_COUNT } from "./puzzles.mjs";

export const STORAGE_KEY = "doin.checkers.v1";
export const SAVE_VERSION = 1;
export const MAX_SAVED_PLIES = 1000;

let backend;
let memory = new Map();

function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("__cc_probe__", "1");
      localStorage.removeItem("__cc_probe__");
      backend = localStorage;
      return backend;
    }
  } catch {
    // Private mode or restricted storage: degrade to memory silently.
  }
  const map = memory;
  backend = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  return backend;
}

export function resetBackendForTests() {
  backend = undefined;
  memory = new Map();
}

function readRaw() {
  try {
    const raw = storage().getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeRaw(data) {
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

const nonNegInt = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
const positiveIntOrNull = (v) => (Number.isInteger(v) && v > 0 ? v : null);

export function emptyMeta() {
  return {
    version: SAVE_VERSION,
    sound: true,
    best: { wins: 0, losses: 0, fewestPlies: null, maxHops: 0 },
    save: null,
    puzzle: { cleared: {} },
  };
}

function normalizeCleared(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw)
    && raw.cleared && typeof raw.cleared === "object" ? raw.cleared : {};
  const cleared = {};
  for (const [key, value] of Object.entries(source)) {
    const id = Number(key);
    if (Number.isInteger(id) && id >= 1 && id <= PUZZLE_COUNT
      && Number.isInteger(value) && value >= 1 && value <= 3) cleared[id] = value;
  }
  return { cleared };
}

export function normalizeMeta(raw) {
  const base = emptyMeta();
  if (!raw || typeof raw !== "object") return base;
  const best = raw.best && typeof raw.best === "object" ? raw.best : {};
  return {
    version: SAVE_VERSION,
    sound: raw.sound !== false,
    best: {
      wins: nonNegInt(best.wins),
      losses: nonNegInt(best.losses),
      fewestPlies: positiveIntOrNull(best.fewestPlies),
      maxHops: nonNegInt(best.maxHops),
    },
    save: raw.save && typeof raw.save === "object" ? raw.save : null,
    puzzle: normalizeCleared(raw.puzzle),
  };
}

export function loadMeta() {
  return normalizeMeta(readRaw());
}

export function saveMeta(meta) {
  return writeRaw(normalizeMeta(meta));
}

function isHole(v) {
  return Number.isInteger(v) && v >= 0 && v < HOLE_COUNT;
}

// Replay from a clean board. applyMove re-derives each move from the rules,
// so only {from, to} needs to be stored; paths and hop counts are rebuilt.
function replay(moves) {
  let state = createInitialState();
  for (const move of moves) {
    const next = applyMove(state, move);
    if (next === state) return false;
    state = next;
  }
  return state.status === "playing";
}

export function normalizeRun(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.moves)) return null;
  if (raw.moves.length > MAX_SAVED_PLIES) return null;
  const moves = [];
  for (const move of raw.moves) {
    if (!move || typeof move !== "object" || !isHole(move.from) || !isHole(move.to)) return null;
    if (move.from === move.to) return null;
    moves.push({ from: move.from, to: move.to });
  }
  const session = {
    mode: raw.mode === MODES.PVP ? MODES.PVP : MODES.PVE,
    difficulty: DIFFICULTY_META[raw.difficulty] ? raw.difficulty : DIFFICULTY_INTERMEDIATE,
    humanSide: raw.humanSide === BLUE ? BLUE : RED,
    moves,
  };
  return replay(moves) ? session : null;
}

// Returns a session ready for game.restore(), or null for a corrupt/finished run.
export function loadRun() {
  const meta = loadMeta();
  return meta.save ? normalizeRun(meta.save) : null;
}

export function saveRun(session) {
  const normalized = normalizeRun(session);
  if (!normalized) return false;
  const meta = loadMeta();
  meta.save = normalized;
  return saveMeta(meta);
}

export function clearRun() {
  const meta = loadMeta();
  meta.save = null;
  return saveMeta(meta);
}

// result comes from controller.result(). PVP has no humanOutcome, so only the
// longest-chain record is shared across modes.
export function recordResult(result) {
  const meta = loadMeta();
  let improved = false;
  if (result && typeof result === "object") {
    const plies = positiveIntOrNull(result.plies);
    if (result.humanOutcome === OUTCOME.WIN) {
      meta.best.wins += 1;
      if (plies !== null && (meta.best.fewestPlies === null || plies < meta.best.fewestPlies)) {
        meta.best.fewestPlies = plies;
        improved = true;
      }
    } else if (result.humanOutcome === OUTCOME.LOSS) {
      meta.best.losses += 1;
    }
    const hops = nonNegInt(result.maxHops);
    if (hops > meta.best.maxHops) {
      meta.best.maxHops = hops;
      improved = true;
    }
  }
  saveMeta(meta);
  return { improved, best: meta.best };
}

export function loadPuzzleProgress() {
  const cleared = loadMeta().puzzle.cleared;
  const ids = Object.keys(cleared).map(Number);
  return {
    cleared,
    clearedCount: ids.length,
    totalStars: ids.reduce((sum, id) => sum + cleared[id], 0),
    maxStars: PUZZLE_COUNT * 3,
  };
}

// Studies never touch the duel record book: they have their own star tally.
export function recordPuzzle(id, stars) {
  const meta = loadMeta();
  const valid = Number.isInteger(id) && id >= 1 && id <= PUZZLE_COUNT
    && Number.isInteger(stars) && stars >= 1 && stars <= 3;
  const improved = valid && stars > (meta.puzzle.cleared[id] ?? 0);
  if (improved) {
    meta.puzzle.cleared[id] = stars;
    saveMeta(meta);
  }
  const progress = loadPuzzleProgress();
  return { improved, ...progress };
}

export function loadSound() {
  return loadMeta().sound;
}

export function saveSound(on) {
  const meta = loadMeta();
  meta.sound = Boolean(on);
  return saveMeta(meta);
}

export function loadLocale() {
  try {
    return storage().getItem("doin.lang") === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

export function saveLocale(locale) {
  try {
    storage().setItem("doin.lang", locale === "en" ? "en" : "zh");
    return true;
  } catch {
    return false;
  }
}
