// 本地存档唯一口径：音效/模式偏好、关卡评级、街机最佳。
// localStorage 不可用或数据损坏时静默降级内存，读取一律归一化。

import { LEVEL_BY_ID, LEVELS, firstLevelId } from "./levels.mjs";

export const STORAGE_KEY = "doin.brawler.v1";
export const SCHEMA_VERSION = 1;

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: { muted: false, mode: "story", players: 1, lastLevel: firstLevelId() },
    progress: {},
    arcade: { bestKo: 0, bestScore: 0, bestBossKills: 0 },
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
      const probe = "__doin_brawler__";
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

function pickMode(value) {
  return value === "arcade" ? "arcade" : "story";
}

function pickPlayers(value) {
  return Number(value) === 2 ? 2 : 1;
}

function pickLevel(value) {
  return LEVEL_BY_ID[value] ? value : firstLevelId();
}

function normalizeProgress(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, record] of Object.entries(raw)) {
    if (!LEVEL_BY_ID[id] || !record || typeof record !== "object") continue;
    const stars = Math.min(3, int(record.stars));
    const bestKo = int(record.bestKo);
    const bestTime = int(record.bestTime);
    const bestScore = int(record.bestScore);
    if (!record.cleared && stars <= 0 && bestKo <= 0) continue;
    out[id] = { cleared: Boolean(record.cleared), stars, bestKo, bestTime, bestScore };
  }
  return out;
}

export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  const arcade = raw.arcade && typeof raw.arcade === "object" ? raw.arcade : {};
  return {
    version: SCHEMA_VERSION,
    prefs: {
      muted: Boolean(prefs.muted),
      mode: pickMode(prefs.mode),
      players: pickPlayers(prefs.players),
      lastLevel: pickLevel(prefs.lastLevel),
    },
    progress: normalizeProgress(raw.progress),
    arcade: {
      bestKo: int(arcade.bestKo),
      bestScore: int(arcade.bestScore),
      bestBossKills: int(arcade.bestBossKills),
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

function bestTime(previous, value) {
  if (value <= 0) return previous;
  return previous > 0 ? Math.min(previous, value) : value;
}

export function recordLevel(store, result) {
  if (!result || result.outcome !== "clear" || !LEVEL_BY_ID[result.levelId]) return store;
  const previous = store.progress[result.levelId] ?? {
    cleared: false,
    stars: 0,
    bestKo: 0,
    bestTime: 0,
    bestScore: 0,
  };
  return {
    ...store,
    prefs: {
      ...store.prefs,
      lastLevel: result.levelId,
    },
    progress: {
      ...store.progress,
      [result.levelId]: {
        cleared: true,
        stars: Math.max(previous.stars, Math.min(3, int(result.stars))),
        bestKo: Math.max(previous.bestKo, int(result.ko)),
        bestTime: bestTime(previous.bestTime, int(result.time)),
        bestScore: Math.max(previous.bestScore, int(result.score)),
      },
    },
  };
}

export function recordArcade(store, result) {
  if (!result || result.outcome !== "clear") return store;
  return {
    ...store,
    arcade: {
      bestKo: Math.max(store.arcade.bestKo, int(result.ko)),
      bestScore: Math.max(store.arcade.bestScore, int(result.score)),
      bestBossKills: Math.max(store.arcade.bestBossKills, int(result.bossKills)),
    },
  };
}

export function remember(store, prefs = {}) {
  return {
    ...store,
    prefs: {
      ...store.prefs,
      muted: typeof prefs.muted === "boolean" ? prefs.muted : store.prefs.muted,
      mode: prefs.mode === undefined ? store.prefs.mode : pickMode(prefs.mode),
      players: prefs.players === undefined ? store.prefs.players : pickPlayers(prefs.players),
      lastLevel: prefs.lastLevel === undefined ? store.prefs.lastLevel : pickLevel(prefs.lastLevel),
    },
  };
}

export function levelRecord(store, levelId) {
  return store?.progress?.[levelId] ?? null;
}

export function totalStars(store) {
  return Object.values(store?.progress ?? {}).reduce((sum, record) => sum + int(record.stars), 0);
}

export function maxStars() {
  return LEVELS.length * 3;
}

export function arcadeBest(store) {
  return store?.arcade ?? { bestKo: 0, bestScore: 0, bestBossKills: 0 };
}
