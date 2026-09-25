// 盲盒竞拍 · 存档唯一口径
// localStorage 在隐私模式 / 禁用 Cookie 下会抛异常，统一集中一处 try/catch 降级到内存。
// 存档 key：doin.blind-auction.v1（全站统一前缀，禁止私有命名）。

import { DIFFICULTIES } from "./engine.mjs";
import { CHARACTERS } from "./engine.mjs";
import { RATING_ORDER } from "./score.mjs";

export const STORAGE_KEY = "doin.blind-auction.v1";
export const SCHEMA_VERSION = 1;

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: {
      difficulty: "standard",
      character: "detective",
      muted: false,
    },
    stats: {
      gamesPlayed: 0,
      bestAsset: 0,
      bestRating: null,
      badges: [],
    },
    challenges: {
      unlocked: [1],
      stars: {},
    },
  };
}

function createMemoryFallback() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

let backend;

function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      const probe = "__doin_blind_auction__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      backend = localStorage;
      return backend;
    }
  } catch (e) {
    // 隐私模式 / 存储被禁用
  }
  backend = createMemoryFallback();
  return backend;
}

export function resetBackendForTests() {
  backend = undefined;
}

function pickDifficulty(value) {
  return DIFFICULTIES.includes(value) ? value : "standard";
}

function pickCharacter(value) {
  return CHARACTERS.includes(value) ? value : "detective";
}

function normalizeStats(raw) {
  const out = { gamesPlayed: 0, bestAsset: 0, bestRating: null, badges: [] };
  if (!raw || typeof raw !== "object") return out;
  out.gamesPlayed = Math.max(0, Math.trunc(Number(raw.gamesPlayed) || 0));
  out.bestAsset = Math.max(0, Math.trunc(Number(raw.bestAsset) || 0));
  out.bestRating = RATING_ORDER.includes(raw.bestRating) ? raw.bestRating : null;
  if (Array.isArray(raw.badges)) {
    out.badges = [...new Set(raw.badges.filter((b) => typeof b === "string"))].slice(0, 12);
  }
  return out;
}

function normalizeChallenges(raw) {
  const out = { unlocked: [1], stars: {} };
  if (!raw || typeof raw !== "object") return out;
  if (Array.isArray(raw.unlocked)) {
    out.unlocked = [...new Set(raw.unlocked.filter((n) => Number.isInteger(n) && n >= 1 && n <= 12))].sort((a, b) => a - b);
    if (!out.unlocked.includes(1)) out.unlocked.unshift(1);
  }
  if (raw.stars && typeof raw.stars === "object") {
    for (const [k, v] of Object.entries(raw.stars)) {
      const id = Number(k);
      if (!Number.isInteger(id) || id < 1 || id > 12) continue;
      out.stars[id] = Math.max(1, Math.min(3, Math.trunc(Number(v) || 1)));
    }
  }
  return out;
}

export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  return {
    version: SCHEMA_VERSION,
    prefs: {
      difficulty: pickDifficulty(prefs.difficulty),
      character: pickCharacter(prefs.character),
      muted: prefs.muted === true,
    },
    stats: normalizeStats(raw.stats),
    challenges: normalizeChallenges(raw.challenges),
  };
}

export function load() {
  try {
    const raw = storage().getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return normalize(JSON.parse(raw));
  } catch (e) {
    return defaultState();
  }
}

export function save(state) {
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(normalize(state)));
    return true;
  } catch (e) {
    return false;
  }
}

export function savePrefs(prefs) {
  const state = load();
  state.prefs = {
    difficulty: pickDifficulty(prefs.difficulty),
    character: pickCharacter(prefs.character),
    muted: Boolean(prefs.muted),
  };
  return save(state);
}

export function recordOutcome(outcome) {
  const state = load();
  state.stats = normalizeStats({
    ...state.stats,
    ...outcome,
  });
  return save(state);
}
