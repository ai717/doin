// 本地持久化：战绩 / 残局进度 / 偏好。
// localStorage 在隐私模式 / 禁用 Cookie 下会抛异常，统一降级到内存。

import { DIFFICULTIES, DIFFICULTY_INTERMEDIATE } from "./ai.mjs";

export const STORAGE_KEY = "doin.gomoku.v1";
export const SCHEMA_VERSION = 1;
export const MODES = { PVE: "pve", PVP: "pvp", TSUMEGO: "tsumego", FREE: "free" };

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: {
      difficulty: DIFFICULTY_INTERMEDIATE,
      mode: MODES.PVE,
      theme: "light",
      muted: false,
    },
    stats: {
      wins: 0,
      draws: 0,
      losses: 0,
      byDifficulty: {
        beginner: { w: 0, d: 0, l: 0 },
        intermediate: { w: 0, d: 0, l: 0 },
        advanced: { w: 0, d: 0, l: 0 },
        master: { w: 0, d: 0, l: 0 },
      },
    },
    tsumego: {
      unlocked: [1], // 已解锁关 ID
      stars: {}, // { [puzzleId]: { stars, bestMoves, firstSolve } }
    },
    session: null,
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
      const probe = "__doin_gomoku__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      backend = localStorage;
      return backend;
    }
  } catch (e) {
    // 隐私模式
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
  return DIFFICULTIES.includes(value) ? value : DIFFICULTY_INTERMEDIATE;
}

function normalizeStats(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      wins: 0, draws: 0, losses: 0,
      byDifficulty: {
        beginner: { w: 0, d: 0, l: 0 },
        intermediate: { w: 0, d: 0, l: 0 },
        advanced: { w: 0, d: 0, l: 0 },
        master: { w: 0, d: 0, l: 0 },
      },
    };
  }
  const byDifficulty = {
    beginner: { w: 0, d: 0, l: 0 },
    intermediate: { w: 0, d: 0, l: 0 },
    advanced: { w: 0, d: 0, l: 0 },
    master: { w: 0, d: 0, l: 0 },
  };
  if (raw.byDifficulty && typeof raw.byDifficulty === "object") {
    for (const d of DIFFICULTIES) {
      const src = raw.byDifficulty[d] || {};
      byDifficulty[d] = {
        w: int(src.w),
        d: int(src.d),
        l: int(src.l),
      };
    }
  }
  return {
    wins: int(raw.wins),
    draws: int(raw.draws),
    losses: int(raw.losses),
    byDifficulty,
  };
}

function normalizeTsumego(raw) {
  const out = {
    unlocked: [1],
    stars: {},
  };
  if (!raw || typeof raw !== "object") return out;
  if (Array.isArray(raw.unlocked)) {
    out.unlocked = raw.unlocked.filter((n) => Number.isInteger(n) && n > 0).slice(0, 50);
    if (!out.unlocked.includes(1)) out.unlocked.unshift(1);
  }
  if (raw.stars && typeof raw.stars === "object") {
    for (const [k, v] of Object.entries(raw.stars)) {
      const id = Number(k);
      if (!Number.isInteger(id) || id < 1 || id > 30) continue;
      if (!v || typeof v !== "object") continue;
      out.stars[id] = {
        stars: Math.max(0, Math.min(3, int(v.stars))),
        bestMoves: int(v.bestMoves),
        firstSolve: Boolean(v.firstSolve),
      };
    }
  }
  return out;
}

function normalizeSession(raw) {
  if (!raw || typeof raw !== "object") return null;
  const mode = raw.mode === MODES.PVP || raw.mode === MODES.TSUMEGO || raw.mode === MODES.FREE ? raw.mode : MODES.PVE;
  const difficulty = pickDifficulty(raw.difficulty);
  let firstPlayer = 1;
  if (raw.firstPlayer === 2) firstPlayer = 2;
  if (!Array.isArray(raw.moves)) return null;
  const moves = raw.moves.filter((m) => Number.isInteger(m) && m >= 0 && m < 225);
  let tsumego = null;
  if (mode === MODES.TSUMEGO && raw.tsumego && typeof raw.tsumego === "object") {
    tsumego = {
      id: int(raw.tsumego.id),
      parMoves: int(raw.tsumego.parMoves, 1),
      target: raw.tsumego.target === "draw" ? "draw" : "win",
      firstPlayer: raw.tsumego.firstPlayer === 2 ? 2 : 1,
      presetMovesCount: int(raw.tsumego.presetMovesCount),
    };
  }
  return {
    mode,
    difficulty,
    firstPlayer,
    moves,
    tsumego,
  };
}

export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  return {
    version: SCHEMA_VERSION,
    prefs: {
      difficulty: pickDifficulty(prefs.difficulty),
      mode: prefs.mode === MODES.PVP || prefs.mode === MODES.TSUMEGO || prefs.mode === MODES.FREE
        ? prefs.mode : MODES.PVE,
      theme: prefs.theme === "dark" ? "dark" : "light",
      muted: Boolean(prefs.muted),
    },
    stats: normalizeStats(raw.stats),
    tsumego: normalizeTsumego(raw.tsumego),
    session: normalizeSession(raw.session),
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

export function applyOutcome(stats, outcome, difficulty) {
  const next = JSON.parse(JSON.stringify(stats));
  const d = DIFFICULTIES.includes(difficulty) ? difficulty : DIFFICULTY_INTERMEDIATE;
  if (outcome === "win") {
    next.wins += 1;
    next.byDifficulty[d].w += 1;
  } else if (outcome === "draw") {
    next.draws += 1;
    next.byDifficulty[d].d += 1;
  } else if (outcome === "loss") {
    next.losses += 1;
    next.byDifficulty[d].l += 1;
  }
  return next;
}
