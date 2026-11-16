// 叠叠乐 · 存档唯一口径（key: doin.jenga.v1）
// localStorage 不可用或数据损坏时静默降级内存，读取数据严格归一化。
//
// 极限塔是章节制：记「已解锁到第几关」「每关星级」「历史最好成绩」；
// 对决与解谜各记一组简短战绩；语言偏好统一走全站共享的 doin.lang，不进本存档。

import { TOTAL_LEVELS, RIDDLE_QUESTIONS } from "./levels.mjs";
import { STREAK_CAP } from "./score.mjs";

export const STORAGE_KEY = "doin.jenga.v1";

let backend;

function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("__probe__", "1");
      localStorage.removeItem("__probe__");
      backend = localStorage;
      return backend;
    }
  } catch {
    /* 隐私模式或存储被禁用，静默降级 */
  }
  const map = new Map();
  backend = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
  return backend;
}

export function defaultSave() {
  return {
    sound: true,
    mode: "spire",
    unlocked: 1,
    lastLevel: 1,
    stars: {},
    bestScore: 0,
    bestLayers: 18,
    bestStreak: 0,
    clears: 0,
    duelWins: 0,
    duelPlayed: 0,
    riddleBest: 0,
    riddlePlayed: 0
  };
}

function intClamp(raw, min, max, fallback = min) {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function normalizeStars(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (let i = 1; i <= TOTAL_LEVELS; i += 1) {
    const v = raw[`level_${i}`];
    if (v === undefined) continue;
    out[`level_${i}`] = intClamp(v, 0, 3, 0);
  }
  return out;
}

export function normalize(raw) {
  const out = defaultSave();
  if (!raw || typeof raw !== "object") return out;
  if (typeof raw.sound === "boolean") out.sound = raw.sound;
  out.mode = raw.mode === "duel" || raw.mode === "riddle" ? raw.mode : "spire";
  out.unlocked = intClamp(raw.unlocked, 1, TOTAL_LEVELS);
  out.lastLevel = intClamp(raw.lastLevel, 1, TOTAL_LEVELS, 1);
  out.stars = normalizeStars(raw.stars);
  out.bestScore = intClamp(raw.bestScore, 0, Number.MAX_SAFE_INTEGER);
  out.bestLayers = intClamp(raw.bestLayers, 0, 64, 18);
  out.bestStreak = intClamp(raw.bestStreak, 0, STREAK_CAP);
  out.clears = intClamp(raw.clears, 0, Number.MAX_SAFE_INTEGER);
  out.duelWins = intClamp(raw.duelWins, 0, Number.MAX_SAFE_INTEGER);
  out.duelPlayed = intClamp(raw.duelPlayed, 0, Number.MAX_SAFE_INTEGER);
  out.riddleBest = intClamp(raw.riddleBest, 0, RIDDLE_QUESTIONS);
  out.riddlePlayed = intClamp(raw.riddlePlayed, 0, Number.MAX_SAFE_INTEGER);
  // 上次玩的关卡必须落在已解锁范围内，手改存档也不得越狱
  if (out.lastLevel > out.unlocked) out.lastLevel = out.unlocked;
  return out;
}

export function loadSave() {
  try {
    const raw = storage().getItem(STORAGE_KEY);
    if (!raw) return defaultSave();
    return normalize(JSON.parse(raw));
  } catch {
    return defaultSave();
  }
}

export function saveSave(save) {
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(normalize(save)));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    storage().removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function recordClear(save, level, stars, stats = {}) {
  const next = normalize(save);
  const key = level?.id;
  if (key) next.stars[key] = Math.max(next.stars[key] ?? 0, intClamp(stars, 0, 3, 0));
  const index = intClamp(level?.index, 1, TOTAL_LEVELS, 1);
  next.lastLevel = index;
  if (index >= next.unlocked && index < TOTAL_LEVELS) next.unlocked = index + 1;
  else if (index >= next.unlocked) next.unlocked = TOTAL_LEVELS;
  next.clears += 1;
  next.bestScore = Math.max(next.bestScore, intClamp(stats.score, 0, Number.MAX_SAFE_INTEGER));
  next.bestLayers = Math.max(next.bestLayers, intClamp(stats.layers, 0, 64, 18));
  next.bestStreak = Math.max(next.bestStreak, intClamp(stats.streak, 0, STREAK_CAP));
  return next;
}

// 未达标的一局也更新历史最好成绩，但不解锁关卡、不写星级
export function recordRun(save, stats = {}) {
  const next = normalize(save);
  next.bestScore = Math.max(next.bestScore, intClamp(stats.score, 0, Number.MAX_SAFE_INTEGER));
  next.bestLayers = Math.max(next.bestLayers, intClamp(stats.layers, 0, 64, 18));
  next.bestStreak = Math.max(next.bestStreak, intClamp(stats.streak, 0, STREAK_CAP));
  next.clears += intClamp(stats.attempts, 0, Number.MAX_SAFE_INTEGER);
  return next;
}

export function totalStars(save) {
  const owned = normalize(save).stars;
  return Object.values(owned).reduce((sum, v) => sum + intClamp(v, 0, 3, 0), 0);
}
