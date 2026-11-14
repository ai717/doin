// Pong Neo 本地持久化：战绩、最高连拍、偏好配置
// localStorage 不可用或抛错时自动静默降级为内存对象

import { DIFFICULTIES, MODES, TARGET_SCORES } from "./engine.mjs";

export const STORAGE_KEY = "doin.pong.v1";
export const SCHEMA_VERSION = 1;

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: {
      mode: MODES.PVE,
      difficulty: DIFFICULTIES.NORMAL,
      targetScore: 5,
      muted: false
    },
    stats: {
      pveWins: 0,
      pveLosses: 0,
      pvpMatches: 0,
      maxRally: 0,
      totalHits: 0
    }
  };
}

function createMemoryFallback() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
}

let backend;

function getStorage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      const probe = "__doin_pong_probe__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      backend = localStorage;
      return backend;
    }
  } catch {
    // 降级
  }
  backend = createMemoryFallback();
  return backend;
}

export function resetBackendForTests() {
  backend = undefined;
}

function int(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback;
}

export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;

  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  const stats = raw.stats && typeof raw.stats === "object" ? raw.stats : {};

  return {
    version: SCHEMA_VERSION,
    prefs: {
      mode: Object.values(MODES).includes(prefs.mode) ? prefs.mode : MODES.PVE,
      difficulty: Object.values(DIFFICULTIES).includes(prefs.difficulty) ? prefs.difficulty : DIFFICULTIES.NORMAL,
      targetScore: TARGET_SCORES.includes(prefs.targetScore) ? prefs.targetScore : 5,
      muted: Boolean(prefs.muted)
    },
    stats: {
      pveWins: int(stats.pveWins),
      pveLosses: int(stats.pveLosses),
      pvpMatches: int(stats.pvpMatches),
      maxRally: int(stats.maxRally),
      totalHits: int(stats.totalHits)
    }
  };
}

export function load() {
  try {
    const raw = getStorage().getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return normalize(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function save(state) {
  try {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(normalize(state)));
    return true;
  } catch {
    return false;
  }
}

export function updateStats(stats, result) {
  const next = { ...stats };
  if (result.mode === MODES.PVE) {
    if (result.winner === "bottom") {
      next.pveWins += 1;
    } else if (result.winner === "top") {
      next.pveLosses += 1;
    }
  } else if (result.mode === MODES.PVP) {
    next.pvpMatches += 1;
  }

  if (typeof result.maxRally === "number") {
    next.maxRally = Math.max(next.maxRally, result.maxRally);
  }
  if (typeof result.rallies === "number") {
    next.totalHits += result.rallies;
  }
  return next;
}