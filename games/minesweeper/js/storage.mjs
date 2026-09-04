// 本地持久化：难度偏好、静音偏好与各难度最佳战绩。
// localStorage 在隐私模式 / 禁用 Cookie 下会抛异常，这里统一降级到内存，
// 保证游戏永远能玩，只是关掉页面后不留痕。
//
// 历史迁移：早期版本只存了 { difficulty } 扁平结构，normalize 会同时读
// 顶层与 prefs 包装层，避免老用户丢偏好。

export const STORAGE_KEY = "doin.minesweeper.v1";
export const SCHEMA_VERSION = 1;
export const DIFFICULTY_IDS = ["beginner", "intermediate", "expert"];

export function defaultBest() {
  return { bestScore: 0, bestTimeMs: null, plays: 0, wins: 0 };
}

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: { difficulty: "beginner", muted: false },
    best: {
      beginner: defaultBest(),
      intermediate: defaultBest(),
      expert: defaultBest(),
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
      const probe = "__doin_ms__";
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
  return DIFFICULTY_IDS.includes(value) ? value : "beginner";
}

function normalizeBest(raw) {
  if (!raw || typeof raw !== "object") return defaultBest();
  // 负时间不可能存在，视为损坏 → null
  const bestTimeMs =
    Number.isFinite(raw.bestTimeMs) && raw.bestTimeMs >= 0 ? Math.max(0, Math.trunc(raw.bestTimeMs)) : null;
  return {
    bestScore: int(raw.bestScore),
    bestTimeMs,
    plays: int(raw.plays),
    wins: int(raw.wins),
  };
}

// 任何字段缺失或被手改坏都退回默认值，绝不把异常抛给 UI。
export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  // 兼容早期扁平 { difficulty } 与现行 { prefs: {...} } 两种结构
  const legacy = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : raw;
  const difficulty = pickDifficulty(legacy.difficulty || raw.difficulty);
  const muted = Boolean(legacy.muted ?? raw.muted);
  return {
    version: SCHEMA_VERSION,
    prefs: { difficulty, muted },
    best: {
      beginner: normalizeBest(raw.best && raw.best.beginner),
      intermediate: normalizeBest(raw.best && raw.best.intermediate),
      expert: normalizeBest(raw.best && raw.best.expert),
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

// 一局结束后推进战绩，返回新的整体 state 与两个破纪录标记（纯函数，不改动入参）。
export function recordResult(state, params = {}) {
  const difficulty = pickDifficulty(params.difficulty);
  const won = Boolean(params.won);
  const score = Math.max(0, Math.trunc(params.score ?? 0));
  const timeMs = Math.max(0, Math.trunc(params.timeMs ?? 0));

  const prev = state.best[difficulty] ? { ...state.best[difficulty] } : defaultBest();
  const next = { ...prev, plays: prev.plays + 1 };
  let isBestScore = false;
  let isBestTime = false;

  if (won) {
    next.wins = prev.wins + 1;
    isBestScore = score > prev.bestScore;
    isBestTime = prev.bestTimeMs == null || timeMs < prev.bestTimeMs;
    if (isBestScore) next.bestScore = score;
    if (isBestTime) next.bestTimeMs = timeMs;
  }

  return {
    state: { ...state, best: { ...state.best, [difficulty]: next } },
    isBestScore,
    isBestTime,
  };
}
