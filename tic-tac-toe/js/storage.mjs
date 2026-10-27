// 本地持久化：战绩、连胜、偏好与未完成的对局。
// localStorage 在隐私模式 / 禁用 Cookie 下会抛异常，这里统一降级到内存，
// 保证游戏永远能玩，只是关掉页面后不留痕。

import { DIFFICULTY_NORMAL, DIFFICULTIES } from "./ai.mjs";
import { OUTCOME_DRAW, OUTCOME_LOSS, OUTCOME_WIN } from "./score.mjs";

export const STORAGE_KEY = "doin.tic-tac-toe.v1";
export const SCHEMA_VERSION = 1;
export const BOARD_SIZES = [3, 4];
export const MODES = { PVE: "pve", PVP: "pvp" };

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: {
      difficulty: DIFFICULTY_NORMAL,
      boardSize: 3,
      mode: MODES.PVE,
      theme: "light",
      muted: false,
    },
    stats: {
      wins: 0,
      draws: 0,
      losses: 0,
      streak: 0,
      bestStreak: 0,
      totalScore: 0,
    },
    session: null,
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
      const probe = "__doin_ttt__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      backend = localStorage;
      return backend;
    }
  } catch (error) {
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
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback;
}

function pickDifficulty(value) {
  return DIFFICULTIES.includes(value) ? value : DIFFICULTY_NORMAL;
}

function normalizeSession(raw) {
  if (!raw || typeof raw !== "object") return null;
  const size = BOARD_SIZES.includes(raw.size) ? raw.size : null;
  if (!size) return null;
  if (!Array.isArray(raw.moves)) return null;
  const moves = raw.moves.filter((m) => Number.isInteger(m) && m >= 0 && m < size * size);
  return {
    size,
    winLength: size,
    mode: raw.mode === MODES.PVP ? MODES.PVP : MODES.PVE,
    difficulty: pickDifficulty(raw.difficulty),
    aiMark: raw.aiMark === 1 ? 1 : 2,
    firstPlayer: raw.firstPlayer === 1 ? 1 : 2,
    moves,
  };
}

// 任何字段缺失或被手改坏都退回默认值，绝不把异常抛给 UI。
export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  const stats = raw.stats && typeof raw.stats === "object" ? raw.stats : {};
  return {
    version: SCHEMA_VERSION,
    prefs: {
      difficulty: pickDifficulty(prefs.difficulty),
      boardSize: BOARD_SIZES.includes(prefs.boardSize) ? prefs.boardSize : 3,
      mode: prefs.mode === MODES.PVP ? MODES.PVP : MODES.PVE,
      theme: prefs.theme === "dark" ? "dark" : "light",
      muted: Boolean(prefs.muted),
    },
    stats: {
      wins: int(stats.wins),
      draws: int(stats.draws),
      losses: int(stats.losses),
      streak: int(stats.streak),
      bestStreak: int(stats.bestStreak),
      totalScore: int(stats.totalScore),
    },
    session: normalizeSession(raw.session),
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

// 战绩推进：平局保留连胜，失败清零，双人同屏不入库。
export function applyOutcome(stats, outcome, gained = 0) {
  const next = {
    wins: stats.wins,
    draws: stats.draws,
    losses: stats.losses,
    streak: stats.streak,
    bestStreak: stats.bestStreak,
    totalScore: stats.totalScore + Math.max(0, Math.trunc(gained)),
  };
  if (outcome === OUTCOME_WIN) {
    next.wins += 1;
    next.streak += 1;
    next.bestStreak = Math.max(next.bestStreak, next.streak);
  } else if (outcome === OUTCOME_DRAW) {
    next.draws += 1;
  } else if (outcome === OUTCOME_LOSS) {
    next.losses += 1;
    next.streak = 0;
  }
  return next;
}

export function winRate(stats) {
  const played = stats.wins + stats.draws + stats.losses;
  return played === 0 ? 0 : Math.round((stats.wins / played) * 100);
}
