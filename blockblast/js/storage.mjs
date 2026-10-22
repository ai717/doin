// storage.mjs —— 本地持久化：静音偏好、难度记忆、按难度分榜的经典最佳战绩。
// localStorage 在隐私模式 / 禁用 Cookie 下会抛异常，统一降级到内存，
// 保证游戏永远能玩，只是关掉页面后不留痕。读取一律 normalize，坏数据静默回默认。
import { DIFFICULTY_IDS, DEFAULT_DIFFICULTY, pickDifficulty } from "./difficulty.mjs";

export const STORAGE_KEY = "doin.blockblast.v1";
export const SCHEMA_VERSION = 2;

function emptyRecord() {
  return { bestScore: 0, bestRows: 0, bestCombo: 0, plays: 0 };
}

export function defaultState() {
  const best = {};
  for (const id of DIFFICULTY_IDS) best[id] = emptyRecord();
  return {
    version: SCHEMA_VERSION,
    prefs: { muted: false, difficulty: DEFAULT_DIFFICULTY },
    best,
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
      const probe = "__doin_bb__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      backend = localStorage;
      return backend;
    }
  } catch (error) {
    // 隐私模式或存储被禁用：静默降级
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

function normalizeRecord(raw) {
  const base = emptyRecord();
  if (!raw || typeof raw !== "object") return base;
  return {
    bestScore: int(raw.bestScore),
    bestRows: int(raw.bestRows),
    bestCombo: int(raw.bestCombo),
    plays: int(raw.plays),
  };
}

// 任何字段缺失或被手改坏都退回默认值，绝不把异常抛给 UI。
// 旧版（v1 章节进度）数据不含 best/prefs.difficulty，静默回默认，不做迁移。
export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const rawBest = raw.best && typeof raw.best === "object" ? raw.best : null;
  const best = {};
  for (const id of DIFFICULTY_IDS) {
    best[id] = rawBest ? normalizeRecord(rawBest[id]) : emptyRecord();
  }
  return {
    version: SCHEMA_VERSION,
    prefs: {
      muted: Boolean(raw.prefs?.muted),
      difficulty: pickDifficulty(raw.prefs?.difficulty),
    },
    best,
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

// ---------------------------------------------------------------- 纯函数推进

export function setMuted(state, muted) {
  return { ...state, prefs: { ...state.prefs, muted: Boolean(muted) } };
}

export function setDifficulty(state, difficulty) {
  return { ...state, prefs: { ...state.prefs, difficulty: pickDifficulty(difficulty) } };
}

/** 某难度的最佳战绩读取（UI 展示用） */
export function bestOf(state, difficulty) {
  const id = pickDifficulty(difficulty);
  return state.best?.[id] ?? emptyRecord();
}

/** 单难度战绩推进，返回新 state 与破纪录标记（分数只升不降） */
export function recordDifficulty(state, difficulty, { score = 0, rows = 0, combo = 0 } = {}) {
  const id = pickDifficulty(difficulty);
  const prev = state.best?.[id] ?? emptyRecord();
  const next = {
    bestScore: Math.max(prev.bestScore, int(score)),
    bestRows: Math.max(prev.bestRows, int(rows)),
    bestCombo: Math.max(prev.bestCombo, int(combo)),
    plays: prev.plays + 1,
  };
  return {
    state: { ...state, best: { ...state.best, [id]: next } },
    isBestScore: next.bestScore > prev.bestScore,
  };
}
