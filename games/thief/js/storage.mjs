// storage.mjs - single source of truth for the heist save.
// Key: doin.thief.v1. Locale stays on the portal-wide doin.lang key.
//
// Only the shortest cord travel per stage is kept; stars are re-derived from
// levels.mjs so a hand-edited save can never fake a three-star clear.
// Falls back to an in-memory backend when localStorage is blocked.

import { LEVEL_COUNT, getLevel } from "./levels.mjs";
import { starsFor } from "./score.mjs";

export const STORAGE_KEY = "doin.thief.v1";
export const SAVE_VERSION = 1;
export const MAX_TRAVEL = 40000;

let backend;
let memory = new Map();

function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("__th_probe__", "1");
      localStorage.removeItem("__th_probe__");
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

const isLevelId = (value) => Number.isInteger(value) && value >= 1 && value <= LEVEL_COUNT;
const isTravel = (value) => Number.isFinite(value) && value > 0 && value <= MAX_TRAVEL;

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

export function emptyMeta() {
  return { version: SAVE_VERSION, sound: true, last: 1, best: {} };
}

function normalizeBest(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const best = {};
  for (const [key, value] of Object.entries(source)) {
    const id = Number(key);
    if (!isLevelId(id) || !isTravel(value)) continue;
    if (!getLevel(id)) continue;
    best[id] = Math.round(value);
  }
  return best;
}

export function normalizeMeta(raw) {
  const base = emptyMeta();
  if (!raw || typeof raw !== "object") return base;
  return {
    version: SAVE_VERSION,
    sound: raw.sound !== false,
    last: isLevelId(raw.last) ? raw.last : 1,
    best: normalizeBest(raw.best),
  };
}

export function loadMeta() {
  return normalizeMeta(readRaw());
}

export function saveMeta(meta) {
  return writeRaw(normalizeMeta(meta));
}

// cleared: { [id]: stars }, best: { [id]: travel }, totals for the HUD.
export function loadProgress() {
  const meta = loadMeta();
  const cleared = {};
  for (const [key, travel] of Object.entries(meta.best)) {
    const level = getLevel(Number(key));
    if (level) cleared[key] = starsFor(level, travel);
  }
  const ids = Object.keys(cleared).map(Number);
  return {
    cleared,
    best: { ...meta.best },
    clearedCount: ids.length,
    totalStars: ids.reduce((sum, id) => sum + cleared[id], 0),
    maxStars: LEVEL_COUNT * 3,
  };
}

// Returns { improved, stars, best }. Stores the shortest travel seen.
export function recordLevel(id, travelled) {
  const level = getLevel(id);
  if (!level || !isTravel(travelled)) return { improved: false, stars: 0, best: null };
  const meta = loadMeta();
  const rounded = Math.round(travelled);
  const previous = meta.best[id] ?? null;
  const improved = previous === null || rounded < previous;
  if (improved) {
    meta.best[id] = rounded;
    saveMeta(meta);
  }
  const best = improved ? rounded : previous;
  return { improved, stars: starsFor(level, best), best };
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
