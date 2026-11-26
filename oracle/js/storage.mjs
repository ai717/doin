// Single persistence authority for Oracle Glyph Match, with silent memory fallback.

import { LEVELS } from "./levels.mjs";

export const STORAGE_KEY = "doin.oracle.v1";

let backend = null;

function memoryBackend() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("__oracle_probe__", "1");
      localStorage.removeItem("__oracle_probe__");
      backend = localStorage;
      return backend;
    }
  } catch {
    // Private mode or restricted frame: fall back to memory.
  }
  backend = memoryBackend();
  return backend;
}

export function defaultProgress() {
  return {
    version: 1,
    levels: {},
    current: { levelIndex: 0 },
  };
}

function safeInt(value, min, max) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function safeTime(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.round(Math.min(number, 86400) * 10) / 10;
}

const LEVEL_IDS = new Set(LEVELS.map((level) => level.id));

export function normalize(raw) {
  const base = defaultProgress();
  if (!raw || typeof raw !== "object") return base;
  const levels = {};
  if (raw.levels && typeof raw.levels === "object") {
    for (const [key, value] of Object.entries(raw.levels)) {
      if (!LEVEL_IDS.has(key) || !value || typeof value !== "object") continue;
      levels[key] = {
        stars: safeInt(value.stars, 0, 3),
        bestTime: safeTime(value.bestTime, 0),
        errors: safeInt(value.errors, 0, 999),
      };
    }
  }
  const currentRaw = raw.current && typeof raw.current === "object" ? raw.current : {};
  return {
    version: 1,
    levels,
    current: {
      levelIndex: safeInt(currentRaw.levelIndex, 0, LEVELS.length - 1),
    },
  };
}

export function load() {
  try {
    const text = storage().getItem(STORAGE_KEY);
    if (!text) return defaultProgress();
    return normalize(JSON.parse(text));
  } catch {
    return defaultProgress();
  }
}

export function save(progress) {
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(normalize(progress)));
    return true;
  } catch {
    return false;
  }
}

export function remember(progress, levelIndex) {
  if (!progress) return progress;
  progress.current = {
    levelIndex: safeInt(levelIndex, 0, LEVELS.length - 1),
  };
  return progress;
}

export function recordLevel(progress, levelId, result = {}) {
  const target = progress ?? defaultProgress();
  if (!LEVEL_IDS.has(levelId)) return target;
  const next = {
    stars: safeInt(result.stars, 0, 3),
    bestTime: safeTime(result.time, 0),
    errors: safeInt(result.errors, 0, 999),
  };
  const existing = target.levels[levelId];
  if (!existing) {
    target.levels[levelId] = next;
    return target;
  }
  target.levels[levelId] = {
    stars: Math.max(existing.stars, next.stars),
    bestTime: existing.bestTime > 0 && next.bestTime > 0
      ? Math.min(existing.bestTime, next.bestTime)
      : Math.max(existing.bestTime, next.bestTime),
    errors: Math.min(existing.errors, next.errors),
  };
  return target;
}

export function levelRecord(progress, levelId) {
  return progress?.levels?.[levelId] ?? null;
}

export function setBackendForTests(nextBackend) {
  backend = nextBackend ?? null;
}

export function resetBackendForTests() {
  backend = null;
}
