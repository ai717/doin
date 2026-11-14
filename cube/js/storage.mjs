// 本地存档唯一口径：音效偏好、模式记忆、个人最佳、Ao5 与学院星评。
// localStorage 不可用或数据损坏时静默降级内存，读取一律归一化。

import { LEVEL_BY_ID, firstLevelId } from "./levels.mjs";

export const STORAGE_KEY = "doin.cube.v1";
export const SCHEMA_VERSION = 1;

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: { muted: false, size: 2, mode: "free", lastLevel: firstLevelId() },
    progress: {},
    stats: {
      solves: 0,
      best: { "2": 0, "3": 0 },
      ao5: { "2": [], "3": [] },
      daily: { key: "", bestMs: 0 },
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
      const probe = "__doin_cube__";
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

function pickSize(value) {
  return value === 3 ? 3 : 2;
}

function pickLevel(value) {
  return LEVEL_BY_ID[value] ? value : firstLevelId();
}

function normalizeTimes(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((value) => int(value)).filter((value) => value > 0).slice(-5);
}

function normalizeProgress(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, record] of Object.entries(raw)) {
    if (!LEVEL_BY_ID[id] || !record || typeof record !== "object") continue;
    const stars = Math.min(3, int(record.stars));
    const bestMoves = int(record.bestMoves);
    const bestMs = int(record.bestMs);
    const bestScore = int(record.bestScore);
    if (!record.cleared && stars <= 0 && bestMoves <= 0 && bestMs <= 0) continue;
    out[id] = { cleared: Boolean(record.cleared), stars, bestMoves, bestMs, bestScore };
  }
  return out;
}

export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  const stats = raw.stats && typeof raw.stats === "object" ? raw.stats : {};
  const daily = stats.daily && typeof stats.daily === "object" ? stats.daily : {};
  return {
    version: SCHEMA_VERSION,
    prefs: {
      muted: Boolean(prefs.muted),
      size: pickSize(prefs.size),
      mode: prefs.mode === "academy" ? "academy" : "free",
      lastLevel: pickLevel(prefs.lastLevel),
    },
    progress: normalizeProgress(raw.progress),
    stats: {
      solves: int(stats.solves),
      best: { "2": int(stats.best?.["2"]), "3": int(stats.best?.["3"]) },
      ao5: { "2": normalizeTimes(stats.ao5?.["2"]), "3": normalizeTimes(stats.ao5?.["3"]) },
      daily: { key: typeof daily.key === "string" ? daily.key : "", bestMs: int(daily.bestMs) },
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

function bestMin(previous, value) {
  if (value <= 0) return previous;
  return previous > 0 ? Math.min(previous, value) : value;
}

// 记录一次通关：个人最佳取最小，星评/最佳步数/得分取最优历史。
export function recordSolve(store, result) {
  if (!result || result.outcome !== "clear") return store;
  const size = pickSize(result.size);
  const ms = int(result.ms);
  const moves = int(result.moves);
  const score = int(result.score);
  const stars = Math.min(3, int(result.stars));
  const freeRun = result.mode !== "academy";
  const nextBest = freeRun
    ? { ...store.stats.best, [size]: bestMin(store.stats.best[size], ms) }
    : store.stats.best;
  const nextAo5 = freeRun ? {
    ...store.stats.ao5,
    [size]: [...(store.stats.ao5[size] ?? []), ms].filter((value) => value > 0).slice(-5),
  } : store.stats.ao5;
  const dailyKey = typeof result.dailyKey === "string" ? result.dailyKey : "";
  const dailyBest = dailyKey
    ? (store.stats.daily.key === dailyKey ? bestMin(store.stats.daily.bestMs, ms) : ms)
    : store.stats.daily.bestMs;

  const next = {
    ...store,
    prefs: {
      ...store.prefs,
      size: freeRun ? size : store.prefs.size,
      mode: freeRun ? "free" : "academy",
      lastLevel: LEVEL_BY_ID[result.levelId] ? result.levelId : store.prefs.lastLevel,
    },
    stats: {
      ...store.stats,
      solves: store.stats.solves + 1,
      best: nextBest,
      ao5: nextAo5,
      daily: { key: dailyKey || store.stats.daily.key, bestMs: dailyBest },
    },
  };

  if (result.mode === "academy" && LEVEL_BY_ID[result.levelId]) {
    const prev = store.progress[result.levelId] ?? {
      cleared: false,
      stars: 0,
      bestMoves: 0,
      bestMs: 0,
      bestScore: 0,
    };
    next.progress = {
      ...store.progress,
      [result.levelId]: {
        cleared: true,
        stars: Math.max(prev.stars, stars),
        bestMoves: prev.bestMoves > 0 ? Math.min(prev.bestMoves, moves) : moves,
        bestMs: bestMin(prev.bestMs, ms),
        bestScore: Math.max(prev.bestScore, score),
      },
    };
  }

  return next;
}

export function rememberMode(store, { size, mode, levelId }) {
  return {
    ...store,
    prefs: {
      ...store.prefs,
      size: pickSize(size),
      mode: mode === "academy" ? "academy" : "free",
      lastLevel: pickLevel(levelId ?? store.prefs.lastLevel),
    },
  };
}

export function bestMsFor(store, size) {
  return int(store?.stats?.best?.[String(size)]);
}

export function ao5For(store, size) {
  return store?.stats?.ao5?.[String(size)] ?? [];
}

export function levelRecord(store, levelId) {
  return store?.progress?.[levelId] ?? null;
}

export function totalStars(store) {
  return Object.values(store?.progress ?? {}).reduce((sum, record) => sum + int(record.stars), 0);
}

export function clearProgress(store) {
  return { ...store, progress: {}, stats: { ...defaultState().stats } };
}
