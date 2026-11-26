// Persistence for Nine Rings. Key: doin.rings.v1. Never throws; normalizes on read.
import { LEVEL_IDS, levelById } from "./levels.mjs";
import { isMode } from "./engine.mjs";

export const STORAGE_KEY = "doin.rings.v1";
export const SCHEMA_VERSION = 1;

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: { mode: "unlink", hint: true, muted: false },
    progress: {
      lastLevel: LEVEL_IDS[0],
      cleared: [],
      bestMoves: {},
      bestStars: {},
    },
  };
}

function createMemoryFallback() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

let backend;

function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      const probe = "__doin_rings__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      backend = localStorage;
      return backend;
    }
  } catch (error) {
    // Restricted environment: fall through to memory.
  }
  backend = createMemoryFallback();
  return backend;
}

export function resetBackendForTests() {
  backend = undefined;
}

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function starCount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.trunc(n))) : 0;
}

function moveCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.max(1, Math.trunc(n)) : 0;
}

export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  const progress = raw.progress && typeof raw.progress === "object" ? raw.progress : {};
  const cleared = Array.isArray(progress.cleared)
    ? [...new Set(progress.cleared.filter((id) => LEVEL_IDS.includes(id)))]
    : [];
  const bestMoves = {};
  const bestStars = {};
  if (progress.bestMoves && typeof progress.bestMoves === "object") {
    for (const id of LEVEL_IDS) {
      const value = moveCount(progress.bestMoves[id]);
      if (value) bestMoves[id] = value;
    }
  }
  if (progress.bestStars && typeof progress.bestStars === "object") {
    for (const id of LEVEL_IDS) {
      const value = starCount(progress.bestStars[id]);
      if (value) bestStars[id] = value;
    }
  }
  const lastLevel = pick(progress.lastLevel, LEVEL_IDS, base.progress.lastLevel);
  const storedMode = prefs.mode;
  return {
    version: SCHEMA_VERSION,
    prefs: {
      mode: isMode(storedMode) ? storedMode : levelById(lastLevel).mode,
      hint: prefs.hint === undefined ? true : Boolean(prefs.hint),
      muted: Boolean(prefs.muted),
    },
    progress: { lastLevel, cleared, bestMoves, bestStars },
  };
}

export function load() {
  try {
    const raw = storage().getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return normalize(JSON.parse(raw));
  } catch (error) {
    return defaultState();
  }
}

export function save(state) {
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(normalize(state)));
    return true;
  } catch (error) {
    return false;
  }
}

export function recordMeta(payload) {
  try {
    const raw = storage().getItem("doin.meta.v1");
    const meta = raw ? JSON.parse(raw) : {};
    const safe = meta && typeof meta === "object" ? meta : {};
    const slug = String(payload?.slug ?? "");
    safe.recentlyPlayed = [slug, ...(Array.isArray(safe.recentlyPlayed) ? safe.recentlyPlayed.filter((s) => s !== slug) : [])].slice(0, 8);
    safe.totalStars = (Number.isFinite(safe.totalStars) ? safe.totalStars : 0) + Math.max(0, Math.trunc(payload?.stars ?? 0));
    storage().setItem("doin.meta.v1", JSON.stringify(safe));
    return true;
  } catch (error) {
    return false;
  }
}

// Record a cleared level. Returns new state + whether records were beaten.
export function recordClear(state, levelId, moves, stars) {
  const next = normalize(state);
  const id = pick(levelId, LEVEL_IDS, next.progress.lastLevel);
  const value = moveCount(moves);
  const rated = starCount(stars);
  const prevMoves = next.progress.bestMoves[id] ?? 0;
  const prevStars = next.progress.bestStars[id] ?? 0;
  const isBestMoves = value > 0 && (!prevMoves || value < prevMoves);
  const isBestStars = rated > prevStars;
  return {
    state: {
      ...next,
      progress: {
        ...next.progress,
        cleared: [...new Set([...next.progress.cleared, id])],
        bestMoves: value ? { ...next.progress.bestMoves, [id]: isBestMoves ? value : prevMoves } : next.progress.bestMoves,
        bestStars: { ...next.progress.bestStars, [id]: Math.max(prevStars, rated) },
      },
    },
    isBestMoves,
    isBestStars,
  };
}
