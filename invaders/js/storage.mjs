// Persistence layer: single key, defensive normalisation, in-memory fallback.
import { TOTAL_LEVELS } from "./levels.mjs";

export const STORAGE_KEY = "doin.invaders.v1";

function memoryStore() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

let backend = null;

export function getStorage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined" && localStorage) {
      const probe = "__doin_probe__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      backend = localStorage;
      return backend;
    }
  } catch {
    // storage blocked (private mode / disabled): fall through to memory
  }
  backend = memoryStore();
  return backend;
}

export function defaultProgress() {
  return {
    unlocked: 1,
    stars: {},
    best: {},
    survival: { wave: 0, score: 0, combo: 0 },
    training: {},
    muted: false,
  };
}

function intOr(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return Math.min(max, Math.max(min, i));
}

export function normalize(raw) {
  const base = defaultProgress();
  if (!raw || typeof raw !== "object") return base;
  const stars = {};
  if (raw.stars && typeof raw.stars === "object") {
    for (const [key, value] of Object.entries(raw.stars)) {
      const id = Number(key);
      if (!Number.isFinite(id) || id < 1 || id > TOTAL_LEVELS) continue;
      stars[id] = intOr(value, 0, 0, 3);
    }
  }
  const best = {};
  if (raw.best && typeof raw.best === "object") {
    for (const [key, value] of Object.entries(raw.best)) {
      const id = Number(key);
      if (!Number.isFinite(id) || id < 1 || id > TOTAL_LEVELS) continue;
      best[id] = intOr(value, 0, 0, Number.MAX_SAFE_INTEGER);
    }
  }
  const training = {};
  if (raw.training && typeof raw.training === "object") {
    for (const [key, value] of Object.entries(raw.training)) {
      const id = Number(key);
      if (!Number.isFinite(id)) continue;
      training[id] = value === true;
    }
  }
  const survival = raw.survival && typeof raw.survival === "object" ? raw.survival : {};
  return {
    unlocked: intOr(raw.unlocked, 1, 1, TOTAL_LEVELS),
    stars,
    best,
    survival: {
      wave: intOr(survival.wave, 0, 0, 9999),
      score: intOr(survival.score, 0, 0, Number.MAX_SAFE_INTEGER),
      combo: intOr(survival.combo, 0, 0, 9999),
    },
    training,
    muted: raw.muted === true,
  };
}

export function load() {
  try {
    const raw = getStorage().getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    return normalize(JSON.parse(raw));
  } catch {
    return defaultProgress();
  }
}

export function save(progress) {
  try {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(normalize(progress)));
    return true;
  } catch {
    return false;
  }
}

export function recordLevel(progress, levelId, stars, score) {
  const next = normalize(progress);
  const id = intOr(levelId, 1, 1, TOTAL_LEVELS);
  next.stars[id] = Math.max(next.stars[id] ?? 0, intOr(stars, 0, 0, 3));
  next.best[id] = Math.max(next.best[id] ?? 0, intOr(score, 0, 0, Number.MAX_SAFE_INTEGER));
  if (id + 1 <= TOTAL_LEVELS) next.unlocked = Math.max(next.unlocked, id + 1);
  return next;
}

export function recordSurvival(progress, wave, score, combo) {
  const next = normalize(progress);
  next.survival = {
    wave: Math.max(next.survival.wave, intOr(wave, 0, 0, 9999)),
    score: Math.max(next.survival.score, intOr(score, 0, 0, Number.MAX_SAFE_INTEGER)),
    combo: Math.max(next.survival.combo, intOr(combo, 0, 0, 9999)),
  };
  return next;
}

export function recordTraining(progress, levelId) {
  const next = normalize(progress);
  next.training[intOr(levelId, 101, 1, 9999)] = true;
  return next;
}

export function clear() {
  try {
    getStorage().removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
