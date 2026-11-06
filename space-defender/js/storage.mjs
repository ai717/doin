// storage.mjs — 存档唯一口径：key doin.space-defender.v1。
// localStorage 不可用静默降级内存；读到的任何值都 normalize，坏值回默认，绝不抛给 UI。

import { TOTAL_WAVES, SECTOR_COUNT } from "./levels.mjs";

export const STORAGE_KEY = "doin.space-defender.v1";
export const SCHEMA_VERSION = 1;
export const MODES = Object.freeze(["campaign", "rush", "survival"]);

function starsArray(len) {
  return Array.from({ length: len }, () => 0);
}

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: { muted: false, autoFire: true },
    progress: {
      campaignStars: starsArray(TOTAL_WAVES),
      unlockedWave: 0,
      bestScore: 0,
      bestCombo: 0,
      totalKills: 0,
      totalRescues: 0,
      rushBestMs: 0,
      rushCleared: 0,
      survivalBestWave: 0,
      campaignCleared: false,
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
      const probe = "__doin_sd__";
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

function normStars(raw) {
  const out = starsArray(TOTAL_WAVES);
  const list = Array.isArray(raw) ? raw : [];
  for (let i = 0; i < TOTAL_WAVES; i += 1) out[i] = clamp(int(list[i], 0), 0, 3);
  return out;
}

function unlockFrom(stars) {
  let wave = 0;
  for (let i = 0; i < TOTAL_WAVES; i += 1) {
    if (stars[i] >= 1) wave = Math.min(TOTAL_WAVES - 1, i + 1);
    else break;
  }
  return wave;
}

export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  const progress = raw.progress && typeof raw.progress === "object" ? raw.progress : {};
  const stars = normStars(progress.campaignStars);
  const unlocked = clamp(int(progress.unlockedWave, unlockFrom(stars)), 0, TOTAL_WAVES - 1);
  return {
    version: SCHEMA_VERSION,
    prefs: {
      muted: bool(prefs.muted, false),
      autoFire: bool(prefs.autoFire, true),
    },
    progress: {
      campaignStars: stars,
      unlockedWave: unlocked,
      bestScore: Math.max(0, int(progress.bestScore)),
      bestCombo: clamp(int(progress.bestCombo), 0, 8),
      totalKills: Math.max(0, int(progress.totalKills)),
      totalRescues: Math.max(0, int(progress.totalRescues)),
      rushBestMs: Math.max(0, int(progress.rushBestMs)),
      rushCleared: clamp(int(progress.rushCleared), 0, SECTOR_COUNT),
      survivalBestWave: Math.max(0, int(progress.survivalBestWave)),
      campaignCleared: bool(progress.campaignCleared, false),
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

export function setAutoFire(state, autoFire) {
  const next = normalize(state);
  next.prefs.autoFire = Boolean(autoFire);
  return save(next);
}

export function applyResult(state, result) {
  const next = normalize(state);
  if (!result || typeof result !== "object") return { state: next, improved: false };
  const p = next.progress;
  p.bestScore = Math.max(p.bestScore, Math.max(0, int(result.score)));
  p.bestCombo = clamp(Math.max(p.bestCombo, int(result.bestCombo)), 0, 8);
  p.totalKills += Math.max(0, int(result.kills));
  p.totalRescues += Math.max(0, int(result.rescued));
  let improved = false;
  const wave = int(result.wave, -1);
  if (result.mode === "campaign" && wave >= 0 && wave < TOTAL_WAVES && !result.lost) {
    const stars = clamp(int(result.stars), 0, 3);
    if (stars > p.campaignStars[wave]) {
      p.campaignStars[wave] = stars;
      improved = true;
    }
    if (wave + 1 < TOTAL_WAVES && wave + 1 > p.unlockedWave) p.unlockedWave = wave + 1;
    if (wave === TOTAL_WAVES - 1 && result.won) p.campaignCleared = true;
  }
  if (result.mode === "rush" && !result.lost && result.won) {
    const ms = Math.max(1, Math.round((Number(result.time) || 0) * 1000));
    if (p.rushBestMs === 0 || ms < p.rushBestMs) {
      p.rushBestMs = ms;
      improved = true;
    }
    p.rushCleared = Math.max(p.rushCleared, SECTOR_COUNT);
  }
  if (result.mode === "survival") {
    const reached = Math.max(0, int(result.wave));
    if (reached > p.survivalBestWave) {
      p.survivalBestWave = reached;
      improved = true;
    }
  }
  return { state: save(next), improved };
}

export function isWaveUnlocked(state, waveIndex) {
  const data = normalize(state);
  return clamp(int(waveIndex), 0, TOTAL_WAVES - 1) <= data.progress.unlockedWave;
}

export function resetAll() {
  try {
    storage().removeItem(STORAGE_KEY);
  } catch {
    // 忽略
  }
  return defaultState();
}
