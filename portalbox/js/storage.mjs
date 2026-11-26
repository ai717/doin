// 本地存档：音效偏好、关卡星评与最少步数。localStorage 不可用时静默降级内存。

import { LEVELS, LEVEL_BY_ID } from "./levels.mjs";

export const STORAGE_KEY = "doin.portalbox.v1";
export const SCHEMA_VERSION = 1;
export const DEFAULT_LEVEL = LEVELS[0]?.id ?? "p01";

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: { muted: false, lastLevel: DEFAULT_LEVEL },
    progress: {},
    stats: { clears: 0, bestScore: 0 },
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
      const probe = "__doin_portalbox__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      backend = localStorage;
      return backend;
    }
  } catch (error) {
    // 隐私模式 / 存储受限：静默降级
  }
  backend = createMemoryFallback();
  return backend;
}

export function resetBackendForTests() {
  backend = undefined;
}

function int(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : fallback;
}

function pickLevel(value) {
  return LEVEL_BY_ID[value] ? value : DEFAULT_LEVEL;
}

function normalizeProgress(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, record] of Object.entries(raw)) {
    if (!LEVEL_BY_ID[id] || !record || typeof record !== "object") continue;
    const stars = Math.min(3, int(record.stars));
    const bestSteps = int(record.bestSteps);
    const bestScore = int(record.bestScore);
    const cleared = Boolean(record.cleared);
    if (stars <= 0 && bestSteps <= 0 && bestScore <= 0 && !cleared) continue;
    out[id] = { stars, bestSteps, bestScore, cleared };
  }
  return out;
}

export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  const stats = raw.stats && typeof raw.stats === "object" ? raw.stats : {};
  return {
    version: SCHEMA_VERSION,
    prefs: {
      muted: Boolean(prefs.muted),
      lastLevel: pickLevel(prefs.lastLevel),
    },
    progress: normalizeProgress(raw.progress),
    stats: {
      clears: int(stats.clears),
      bestScore: int(stats.bestScore),
    },
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

// 星评与最高分取历史最大，最少步数取历史最小。
export function applyLevelResult(store, levelId, result) {
  if (!LEVEL_BY_ID[levelId] || !result) return store;
  const prev = store.progress[levelId] ?? { stars: 0, bestSteps: 0, bestScore: 0, cleared: false };
  const steps = Math.max(0, int(result.steps));
  const bestSteps = steps > 0 ? (prev.bestSteps > 0 ? Math.min(prev.bestSteps, steps) : steps) : prev.bestSteps;
  return {
    ...store,
    progress: {
      ...store.progress,
      [levelId]: {
        stars: Math.max(prev.stars, Math.min(3, int(result.stars))),
        bestSteps,
        bestScore: Math.max(prev.bestScore, int(result.score)),
        cleared: prev.cleared || result.outcome === "clear",
      },
    },
    stats: {
      clears: store.stats.clears + (result.outcome === "clear" ? 1 : 0),
      bestScore: Math.max(store.stats.bestScore, int(result.score)),
    },
    prefs: { ...store.prefs, lastLevel: levelId },
  };
}

export function starsFor(store, levelId) {
  return store?.progress?.[levelId]?.stars ?? 0;
}

export function bestStepsFor(store, levelId) {
  return store?.progress?.[levelId]?.bestSteps ?? 0;
}

export function bestScoreFor(store, levelId) {
  return store?.progress?.[levelId]?.bestScore ?? 0;
}

export function totalStars(store) {
  let total = 0;
  for (const record of Object.values(store?.progress ?? {})) total += int(record.stars);
  return total;
}

export function clearProgress(store) {
  return { ...store, progress: {}, stats: { clears: 0, bestScore: 0 } };
}
