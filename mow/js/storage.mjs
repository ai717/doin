// storage.mjs — 存档唯一口径：key doin.mow.v1。
// localStorage 不可用静默降级内存；读到的任何值都 normalize，坏值回默认，绝不抛给 UI。

import { bestOf } from "./score.mjs";

export const STORAGE_KEY = "doin.mow.v1";
export const SCHEMA_VERSION = 1;
export const BASE_CHARACTERS = Object.freeze(["mower", "sprinkler", "ladybug"]);
export const UNLOCK_CHARACTER = "rabbit";

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: { muted: false },
    unlocked: [...BASE_CHARACTERS],
    best: { standard: null, endless: null },
    codex: { weapons: [], passives: [], evolutions: [] },
    stats: { runs: 0, totalKills: 0, bursts: 0 },
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
      const probe = "__doin_mow_probe__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      backend = localStorage;
      return backend;
    }
  } catch {
    // 隐私模式或存储被禁用
  }
  backend = createMemoryFallback();
  return backend;
}

export function resetBackendForTests() {
  backend = undefined;
}

function int(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function bool(value, fallback = false) {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

function strArray(raw, allowed) {
  const out = [];
  const list = Array.isArray(raw) ? raw : [];
  for (const item of list) {
    if (typeof item === "string" && (!allowed || allowed.includes(item)) && !out.includes(item)) out.push(item);
  }
  return out;
}

function normRecord(raw) {
  if (!raw || typeof raw !== "object") return null;
  const time = Math.max(0, int(raw.time));
  const kills = Math.max(0, int(raw.kills));
  const score = Math.max(0, int(raw.score));
  const stars = Math.max(0, Math.min(3, int(raw.stars, 0)));
  const maxCombo = Math.max(0, int(raw.maxCombo));
  const won = bool(raw.won, false);
  if (time <= 0 && kills <= 0 && score <= 0) return null;
  return { mode: raw.mode === "endless" ? "endless" : "standard", won, stars, kills, maxCombo, score, time };
}

export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  const codex = raw.codex && typeof raw.codex === "object" ? raw.codex : {};
  const stats = raw.stats && typeof raw.stats === "object" ? raw.stats : {};
  const bestRaw = raw.best && typeof raw.best === "object" ? raw.best : {};
  const unlocked = strArray(raw.unlocked, [...BASE_CHARACTERS, UNLOCK_CHARACTER]);
  if (!unlocked.includes("mower")) unlocked.unshift("mower");
  return {
    version: SCHEMA_VERSION,
    prefs: { muted: bool(prefs.muted, false) },
    unlocked,
    best: {
      standard: normRecord(bestRaw.standard),
      endless: normRecord(bestRaw.endless),
    },
    codex: {
      weapons: strArray(codex.weapons),
      passives: strArray(codex.passives),
      evolutions: strArray(codex.evolutions),
    },
    stats: {
      runs: Math.max(0, int(stats.runs)),
      totalKills: Math.max(0, int(stats.totalKills)),
      bursts: Math.max(0, int(stats.bursts)),
    },
  };
}

export function load() {
  try {
    const raw = storage().getItem(STORAGE_KEY);
    return normalize(raw ? JSON.parse(raw) : null);
  } catch {
    return defaultState();
  }
}

export function save(state) {
  const next = normalize(state);
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 写失败不影响本局
  }
  return next;
}

export function setMuted(state, muted) {
  const next = normalize(state);
  next.prefs.muted = Boolean(muted);
  return save(next);
}

export function isUnlocked(state, character) {
  return normalize(state).unlocked.includes(character);
}

/**
 * 结算归档：合并最佳战绩（bestOf）、合并图鉴、累计统计、通关解锁圆锯兔。
 * 返回 { state, improved, newUnlock }。
 */
export function applyResult(state, result) {
  const next = normalize(state);
  if (!result || typeof result !== "object") return { state: next, improved: false, newUnlock: false };
  next.stats.runs += 1;
  next.stats.totalKills += Math.max(0, int(result.kills));
  next.stats.bursts += Math.max(0, int(result.burstCount));
  const record = normRecord({
    mode: result.mode,
    won: Boolean(result.won),
    stars: result.stars,
    kills: result.kills,
    maxCombo: result.maxCombo,
    score: result.score,
    time: result.time,
  });
  let improved = false;
  if (record) {
    const key = result.mode === "endless" ? "endless" : "standard";
    const merged = bestOf(next.best[key], record);
    if (merged !== next.best[key]) {
      next.best[key] = merged;
      improved = true;
    }
  }
  const codex = result.codex || {};
  for (const key of ["weapons", "passives", "evolutions"]) {
    const list = Array.isArray(codex[key]) ? codex[key] : [];
    for (const item of list) {
      if (typeof item === "string" && !next.codex[key].includes(item)) {
        next.codex[key].push(item);
        improved = true;
      }
    }
  }
  let newUnlock = false;
  if (result.won && !next.unlocked.includes(UNLOCK_CHARACTER)) {
    next.unlocked.push(UNLOCK_CHARACTER);
    improved = true;
    newUnlock = true;
  }
  return { state: save(next), improved, newUnlock };
}

export function resetAll() {
  try {
    storage().removeItem(STORAGE_KEY);
  } catch {
    // 忽略
  }
  return defaultState();
}
