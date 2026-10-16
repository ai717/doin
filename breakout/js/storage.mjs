// storage.mjs — 存档唯一口径：key doin.breakout.v1。
// localStorage 不可用静默降级内存；读到的任何值都 normalize，坏值回默认。

export const STORAGE_KEY = "doin.breakout.v1";
export const SCHEMA_VERSION = 1;

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: { muted: false },
    progress: {
      bestScore: 0,
      bestLayer: 1,
      totalRuns: 0,
      wins: 0,
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
      const probe = "__doin_bt__";
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

export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  const progress = raw.progress && typeof raw.progress === "object" ? raw.progress : {};
  return {
    version: SCHEMA_VERSION,
    prefs: {
      muted: bool(prefs.muted, false),
    },
    progress: {
      bestScore: Math.max(0, int(progress.bestScore)),
      bestLayer: Math.max(1, int(progress.bestLayer)),
      totalRuns: Math.max(0, int(progress.totalRuns)),
      wins: Math.max(0, int(progress.wins)),
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

export function applyResult(state, result) {
  const next = normalize(state);
  if (!result || typeof result !== "object") return { state: next, improved: false };
  const p = next.progress;
  p.totalRuns += 1;
  if (result.won) p.wins += 1;
  let improved = false;
  const score = Math.max(0, int(result.score));
  const layer = Math.max(1, int(result.layer));
  if (score > p.bestScore) {
    p.bestScore = score;
    improved = true;
  }
  if (layer > p.bestLayer) {
    p.bestLayer = layer;
    improved = true;
  }
  return { state: save(next), improved };
}

export function resetAll() {
  try {
    storage().removeItem(STORAGE_KEY);
  } catch {
    // 忽略
  }
  return defaultState();
}
