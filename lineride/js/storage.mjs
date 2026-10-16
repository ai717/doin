// storage：存档唯一口径，key doin.lineride.v1。
// localStorage 不可用时静默降级内存，坏值回默认。
// 结构：{ version, prefs:{ muted, locale }, puzzleProgress:{}, canvases:[] }

export const STORAGE_KEY = "doin.lineride.v1";
export const SCHEMA_VERSION = 1;
export const MAX_CANVAS_SLOTS = 5;

export function defaultPrefs() {
  return { muted: false, locale: null };
}

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: defaultPrefs(),
    puzzleProgress: {},
    canvases: [],
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
      const probe = "__doin_lr__";
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

function bool(value) {
  return value === true || value === "true" || value === 1;
}

function int(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback;
}

function normalizeStr(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

/** 规范化任意存档数据，绝不抛异常 */
export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  const puzzleProgress = raw.puzzleProgress && typeof raw.puzzleProgress === "object" ? raw.puzzleProgress : {};
  const canvases = Array.isArray(raw.canvases) ? raw.canvases : [];

  return {
    version: SCHEMA_VERSION,
    prefs: {
      muted: bool(prefs.muted),
      locale: normalizeStr(prefs.locale, null),
    },
    puzzleProgress,
    canvases: canvases.slice(0, MAX_CANVAS_SLOTS),
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
    // 写失败不影响游玩
  }
  return next;
}

export function setMuted(state, muted) {
  const next = normalize(state);
  next.prefs.muted = Boolean(muted);
  return next;
}

/** 保存拼图进度 */
export function savePuzzleProgress(state, puzzleId, stars) {
  const next = normalize(state);
  const current = next.puzzleProgress[puzzleId] || { stars: 0 };
  next.puzzleProgress[puzzleId] = { stars: Math.max(current.stars, stars || 0) };
  return next;
}

/** 保存画布槽（槽位越界时原样返回，绝不写坏结构） */
export function saveCanvas(state, slotIndex, canvasData) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= MAX_CANVAS_SLOTS) {
    return state;
  }
  const next = normalize(state);
  next.canvases[slotIndex] = canvasData;
  return next;
}

/** 删除画布槽 */
export function removeCanvas(state, slotIndex) {
  const next = normalize(state);
  next.canvases[slotIndex] = null;
  return next;
}

export function resetAll() {
  try {
    storage().removeItem(STORAGE_KEY);
  } catch {
    // 忽略
  }
  return defaultState();
}