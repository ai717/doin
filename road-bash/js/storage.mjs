// 存档唯一口径：key doin.road-bash.v1。localStorage 不可用时静默降级内存。
// 读到的任何值都 normalize，坏值回默认，绝不抛给 UI。

import {
  BIKES,
  LEAGUE_COUNT,
  BRAWL_COUNT,
  GETAWAY_COUNT,
} from "./levels.mjs";

export const STORAGE_KEY = "doin.road-bash.v1";
export const SCHEMA_VERSION = 1;
export const MODES = Object.freeze(["league", "brawl", "getaway"]);

function starsArray(len) {
  return Array.from({ length: len }, () => 0);
}

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: { muted: false, cruise: true },
    progress: {
      cash: 0,
      owned: [0],
      selectedBike: 0,
      leagueStars: starsArray(LEAGUE_COUNT),
      brawlStars: starsArray(BRAWL_COUNT),
      getawayStars: starsArray(GETAWAY_COUNT),
      leagueTier: 0,
      knockouts: 0,
      farthestFly: 0,
      leaguePerfect: 0,
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
      const probe = "__doin_rb__";
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

function clamp(n, lo, hi) {
  return n < lo ? lo : n > hi ? hi : n;
}

function normStars(raw, len) {
  const out = starsArray(len);
  if (!raw) return out;
  const list = Array.isArray(raw) ? raw : [];
  for (let i = 0; i < len; i += 1) {
    out[i] = clamp(int(list[i], 0), 0, 3);
  }
  return out;
}

function normOwned(raw) {
  const set = new Set([0]);
  if (Array.isArray(raw)) {
    for (const id of raw) {
      const n = int(id, -1);
      if (n >= 0 && n < BIKES.length) set.add(n);
    }
  }
  return [...set].sort((a, b) => a - b);
}

function unlockTierFrom(stars) {
  let tier = 0;
  for (let t = 0; t < 4; t += 1) {
    const slice = stars.slice(t * 5, t * 5 + 5);
    if (slice.every((s) => s >= 1)) tier = Math.min(3, t + 1);
    else break;
  }
  return tier;
}

export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  const progress = raw.progress && typeof raw.progress === "object" ? raw.progress : {};
  const owned = normOwned(progress.owned);
  const selected = owned.includes(int(progress.selectedBike)) ? int(progress.selectedBike) : 0;
  const leagueStars = normStars(progress.leagueStars, LEAGUE_COUNT);
  const leagueTier = unlockTierFrom(leagueStars);
  return {
    version: SCHEMA_VERSION,
    prefs: {
      muted: bool(prefs.muted, false),
      cruise: bool(prefs.cruise, true),
    },
    progress: {
      cash: Math.max(0, int(progress.cash)),
      owned,
      selectedBike: selected,
      leagueStars,
      brawlStars: normStars(progress.brawlStars, BRAWL_COUNT),
      getawayStars: normStars(progress.getawayStars, GETAWAY_COUNT),
      leagueTier: clamp(leagueTier, 0, 3),
      knockouts: Math.max(0, int(progress.knockouts)),
      farthestFly: Math.max(0, Number(progress.farthestFly) || 0),
      leaguePerfect: leagueStars.filter((s) => s >= 3).length,
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

export function setCruise(state, cruise) {
  const next = normalize(state);
  next.prefs.cruise = Boolean(cruise);
  return save(next);
}

export function selectBike(state, bikeId) {
  const next = normalize(state);
  const id = int(bikeId, 0);
  if (next.progress.owned.includes(id)) next.progress.selectedBike = id;
  return save(next);
}

export function buyBike(state, bikeId) {
  const next = normalize(state);
  const bike = BIKES[int(bikeId, -1)];
  if (!bike) return { state: next, ok: false };
  if (next.progress.owned.includes(bike.id)) {
    next.progress.selectedBike = bike.id;
    return { state: save(next), ok: true, already: true };
  }
  if (next.progress.cash < bike.cost) return { state: next, ok: false };
  next.progress.cash -= bike.cost;
  next.progress.owned = [...next.progress.owned, bike.id].sort((a, b) => a - b);
  next.progress.selectedBike = bike.id;
  return { state: save(next), ok: true };
}

export function applyResult(state, result) {
  const next = normalize(state);
  if (!result || typeof result !== "object") return { state: next, improved: false };
  const p = next.progress;
  p.knockouts += Math.max(0, int(result.knockouts));
  p.farthestFly = Math.max(p.farthestFly, Number(result.farthestFly) || 0);
  if (result.won) p.cash += Math.max(0, int(result.cash));
  const stars = clamp(int(result.stars), 0, 3);
  let improved = false;
  const id = int(result.raceId, 0);
  if (result.mode === "league" && id >= 0 && id < LEAGUE_COUNT) {
    if (stars > p.leagueStars[id]) {
      p.leagueStars[id] = stars;
      improved = true;
    }
    p.leagueTier = unlockTierFrom(p.leagueStars);
    p.leaguePerfect = p.leagueStars.filter((s) => s >= 3).length;
  } else if (result.mode === "brawl" && id >= 0 && id < BRAWL_COUNT) {
    if (stars > p.brawlStars[id]) {
      p.brawlStars[id] = stars;
      improved = true;
    }
  } else if (result.mode === "getaway" && id >= 0 && id < GETAWAY_COUNT) {
    if (stars > p.getawayStars[id]) {
      p.getawayStars[id] = stars;
      improved = true;
    }
  }
  return { state: save(next), improved };
}

export function isLeagueUnlocked(state, raceId) {
  const data = normalize(state);
  const id = int(raceId, 0);
  const tier = Math.floor(id / 5);
  return tier <= data.progress.leagueTier;
}

export function isBrawlUnlocked(state, raceId) {
  const data = normalize(state);
  const id = int(raceId, 0);
  if (id <= 0) return true;
  return data.progress.brawlStars[id - 1] >= 1;
}

export function isGetawayUnlocked(state, raceId) {
  const data = normalize(state);
  const id = int(raceId, 0);
  if (id <= 0) return true;
  return data.progress.getawayStars[id - 1] >= 1;
}

export function resetAll() {
  try {
    storage().removeItem(STORAGE_KEY);
  } catch {
    // 忽略
  }
  return defaultState();
}
