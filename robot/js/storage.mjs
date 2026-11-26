// storage.mjs - single source of truth for persistence.
// Key: doin.robot.v1. Locale stays on the portal-wide doin.lang key.
//
// Only the best line count per stage is stored; stars are re-derived from
// levels.mjs, so a hand-edited save can never fake a three-star clear.
// Draft programs are re-normalised through the engine codec on read, so an
// invalid tile code degrades to an empty slot instead of breaking the UI.
// Falls back to memory when localStorage is unavailable.

import { normalizeProgram, countInstructions } from "./engine.mjs";
import { LEVEL_COUNT, getLevel, starsFor } from "./levels.mjs";

export const STORAGE_KEY = "doin.robot.v1";
export const SAVE_VERSION = 1;
export const MAX_LINES = 64;

let backend;
let memory = new Map();

function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("__rb_probe__", "1");
      localStorage.removeItem("__rb_probe__");
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

const isLevelId = (v) => Number.isInteger(v) && v >= 1 && v <= LEVEL_COUNT;
const isLineCount = (v) => Number.isInteger(v) && v >= 1 && v <= MAX_LINES;

export function emptyMeta() {
  return {
    version: SAVE_VERSION,
    sound: true,
    last: 1,
    progress: {},
    drafts: {},
  };
}

function normalizeProgress(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const progress = {};
  for (const [key, value] of Object.entries(source)) {
    const id = Number(key);
    if (!isLevelId(id) || !isLineCount(value)) continue;
    const entry = getLevel(id);
    if (!entry) continue;
    // A clear can never take fewer lines than the proven optimum.
    progress[id] = Math.max(value, entry.par);
  }
  return progress;
}

function normalizeDrafts(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const drafts = {};
  for (const [key, value] of Object.entries(source)) {
    const id = Number(key);
    if (!isLevelId(id) || !value || typeof value !== "object") continue;
    const entry = getLevel(id);
    if (!entry) continue;
    const program = normalizeProgram(value, entry.spec.slots);
    if (countInstructions(program) === 0) continue;
    drafts[id] = program;
  }
  return drafts;
}

export function normalizeMeta(raw) {
  const base = emptyMeta();
  if (!raw || typeof raw !== "object") return base;
  return {
    version: SAVE_VERSION,
    sound: raw.sound !== false,
    last: isLevelId(raw.last) ? raw.last : 1,
    progress: normalizeProgress(raw.progress),
    drafts: normalizeDrafts(raw.drafts),
  };
}

export function loadMeta() {
  return normalizeMeta(readRaw());
}

export function saveMeta(meta) {
  return writeRaw(normalizeMeta(meta));
}

// cleared: { [id]: stars } for the level grid; bestLines: { [id]: lines }.
export function loadProgress() {
  const progress = loadMeta().progress;
  const cleared = {};
  for (const [id, lines] of Object.entries(progress)) {
    const entry = getLevel(Number(id));
    if (entry) cleared[id] = starsFor(entry, lines);
  }
  const ids = Object.keys(cleared).map(Number);
  return {
    cleared,
    bestLines: { ...progress },
    clearedCount: ids.length,
    totalStars: ids.reduce((sum, id) => sum + cleared[id], 0),
    maxStars: LEVEL_COUNT * 3,
  };
}

// Returns { improved, stars, best }. The stored count is floored at the proven
// par so a hand-written save can never claim an impossible line count, and so
// recordLevel() always agrees with what a later load reports.
export function recordLevel(id, lines) {
  const entry = getLevel(id);
  if (!entry || !isLineCount(lines)) {
    return { improved: false, stars: 0, best: null };
  }
  const meta = loadMeta();
  const best = Math.max(lines, entry.par);
  const previous = meta.progress[id] ?? null;
  const improved = previous === null || best < previous;
  if (improved) {
    meta.progress[id] = best;
    saveMeta(meta);
  }
  const recorded = improved ? best : previous;
  return { improved, stars: starsFor(entry, recorded), best: recorded };
}

export function loadDraft(id) {
  if (!isLevelId(id)) return null;
  return loadMeta().drafts[id] ?? null;
}

export function saveDraft(id, program) {
  const entry = getLevel(id);
  if (!entry) return false;
  const meta = loadMeta();
  const normalized = normalizeProgram(program, entry.spec.slots);
  if (countInstructions(normalized) === 0) {
    delete meta.drafts[id];
  } else {
    meta.drafts[id] = normalized;
  }
  return saveMeta(meta);
}

export function clearDraft(id) {
  if (!isLevelId(id)) return false;
  const meta = loadMeta();
  if (!(id in meta.drafts)) return saveMeta(meta);
  delete meta.drafts[id];
  return saveMeta(meta);
}

export function loadLastLevel() {
  return loadMeta().last;
}

export function saveLastLevel(id) {
  if (!isLevelId(id)) return false;
  const meta = loadMeta();
  meta.last = id;
  return saveMeta(meta);
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
