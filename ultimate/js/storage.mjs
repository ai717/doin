// 本地存档：偏好、战绩、残局星数与未完成的棋局。
// localStorage 在隐私模式下会抛异常，统一降级到内存，保证游戏永远能玩。

import { TIERS } from "./ai.mjs";
import { PUZZLES, PUZZLE_BY_ID } from "./puzzles.mjs";
import { OUTCOME_DRAW, OUTCOME_LOSS, OUTCOME_WIN } from "./score.mjs";

export const STORAGE_KEY = "doin.ultimate.v1";
export const SCHEMA_VERSION = 1;
export const MODES = Object.freeze({ DUEL: "duel", CAMPAIGN: "campaign" });
export const DEFAULT_TIER = "duelist";
export const DEFAULT_PUZZLE = PUZZLES[0]?.id ?? "u01";

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: {
      mode: MODES.DUEL,
      tier: DEFAULT_TIER,
      pvp: false,
      muted: false,
      lastPuzzle: DEFAULT_PUZZLE,
    },
    stats: {
      wins: 0,
      losses: 0,
      draws: 0,
      streak: 0,
      bestStreak: 0,
      totalScore: 0,
    },
    campaign: {},
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
      const probe = "__doin_ultimate__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      backend = localStorage;
      return backend;
    }
  } catch (error) {
    // 隐私模式或存储受限：静默降级
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
  return value === MODES.CAMPAIGN ? MODES.CAMPAIGN : MODES.DUEL;
}

function pickTier(value) {
  return TIERS.includes(value) ? value : DEFAULT_TIER;
}

function pickPuzzle(value) {
  return PUZZLE_BY_ID[value] ? value : DEFAULT_PUZZLE;
}

function normalizeCampaign(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, record] of Object.entries(raw)) {
    if (!PUZZLE_BY_ID[id] || !record || typeof record !== "object") continue;
    const stars = Math.min(3, int(record.stars));
    if (stars <= 0) continue;
    out[id] = {
      stars,
      bestMoves: record.bestMoves === null || record.bestMoves === undefined ? null : int(record.bestMoves, null),
    };
  }
  return out;
}

function normalizeSession(raw) {
  if (!raw || typeof raw !== "object") return null;
  const mode = pickMode(raw.mode);
  if (mode === MODES.CAMPAIGN && !PUZZLE_BY_ID[raw.puzzleId]) return null;
  if (!Array.isArray(raw.moves)) return null;
  const moves = raw.moves.filter((move) => Number.isInteger(move) && move >= 0 && move < 81);
  return {
    mode,
    tier: pickTier(raw.tier),
    pvp: mode === MODES.DUEL ? Boolean(raw.pvp) : false,
    puzzleId: mode === MODES.CAMPAIGN ? raw.puzzleId : null,
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
      mode: pickMode(prefs.mode),
      tier: pickTier(prefs.tier),
      pvp: Boolean(prefs.pvp),
      muted: Boolean(prefs.muted),
      lastPuzzle: pickPuzzle(prefs.lastPuzzle),
    },
    stats: {
      wins: int(stats.wins),
      losses: int(stats.losses),
      draws: int(stats.draws),
      streak: int(stats.streak),
      bestStreak: int(stats.bestStreak),
      totalScore: int(stats.totalScore),
    },
    campaign: normalizeCampaign(raw.campaign),
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

// 平局保留连胜，失败清零；双人同屏不入库。
export function applyOutcome(stats, outcome, gained = 0) {
  const next = {
    wins: stats.wins,
    losses: stats.losses,
    draws: stats.draws,
    streak: stats.streak,
    bestStreak: stats.bestStreak,
    totalScore: int(stats.totalScore) + Math.max(0, Math.trunc(gained)),
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

// 残局记录只进不退：星数取历史最高，步数取历史最少。
export function applyCampaignResult(records, id, result) {
  const next = { ...records };
  if (!PUZZLE_BY_ID[id]) return next;
  const prev = next[id] ?? { stars: 0, bestMoves: null };
  const stars = Math.min(3, int(result?.stars));
  if (stars <= 0 && !prev.stars) return next;
  const moves = result?.used === null || result?.used === undefined ? null : int(result.used, null);
  let bestMoves = prev.bestMoves;
  if (moves !== null && (bestMoves === null || moves < bestMoves)) bestMoves = moves;
  if (stars > prev.stars || bestMoves !== prev.bestMoves) {
    next[id] = { stars: Math.max(prev.stars, stars), bestMoves };
  }
  return next;
}

export function starsFor(records, id) {
  return records?.[id]?.stars ?? 0;
}

export function totalStars(records) {
  let total = 0;
  for (const record of Object.values(records ?? {})) total += int(record?.stars);
  return total;
}
