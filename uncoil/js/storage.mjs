// 倒退贪吃蛇 Uncoil · 存档唯一口径（key: doin.uncoil.v1）
// localStorage 不可用或数据损坏时静默降级内存，读取数据严格归一化。

export const STORAGE_KEY = "doin.uncoil.v1";
export const STAGE_COUNT = 40;
export const ENDGAME_COUNT = 12;
export const MAX_STEPS = 9999;

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
    /* 隐私模式或存储被禁用 */
  }
  const map = new Map();
  backend = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
  return backend;
}

// 测试用：把后端换成内存实现（真实页面无需调用）
export function useMemoryBackend(map = new Map()) {
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
    unlocked: 1,        // 主线已解锁到第几关（1..40）
    stars: {},          // { [levelId]: bestStars }
    best: {},           // { [levelId]: bestSteps }
    endgameBest: {},    // { [endgameId]: bestSteps }
    dailyDate: 0,       // YYYYMMDD
    dailySteps: 0,
    dailyDone: false
  };
}

function int(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function cleanMap(raw, max, isId) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!isId(key)) continue;
    const v = int(value, 0, max, 0);
    if (v > 0) out[key] = v;
  }
  return out;
}

const isLevelId = (k) => typeof k === "string" && /^[a-z0-9_]{1,24}$/.test(k);

export function normalize(raw) {
  const out = defaultSave();
  if (!raw || typeof raw !== "object") return out;
  if (typeof raw.sound === "boolean") out.sound = raw.sound;
  out.unlocked = int(raw.unlocked, 1, STAGE_COUNT, 1);
  out.stars = cleanMap(raw.stars, 3, isLevelId);
  out.best = cleanMap(raw.best, MAX_STEPS, isLevelId);
  out.endgameBest = cleanMap(raw.endgameBest, MAX_STEPS, isLevelId);
  out.dailyDate = int(raw.dailyDate, 0, 99999999, 0);
  out.dailySteps = int(raw.dailySteps, 0, MAX_STEPS, 0);
  out.dailyDone = raw.dailyDone === true;
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

export function totalStars(save) {
  return Object.values(save.stars ?? {}).reduce((a, b) => a + b, 0);
}

export function solvedEndgames(save) {
  return Object.keys(save.endgameBest ?? {}).length;
}

// 记录一次通关：只在更好时覆盖，并顺带解锁下一关
export function recordClear(save, { id, mode, steps, stars, index, dateKey }) {
  const next = normalize(save);
  if (mode === "endgame") {
    const prev = next.endgameBest[id];
    if (prev === undefined || steps < prev) next.endgameBest[id] = steps;
  } else if (mode === "daily") {
    next.dailyDate = dateKey;
    if (!next.dailyDone || steps < next.dailySteps || next.dailySteps === 0) {
      next.dailySteps = steps;
      next.dailyDone = true;
    }
  } else {
    const prev = next.best[id];
    if (prev === undefined || steps < prev) next.best[id] = steps;
    const prevStars = next.stars[id] ?? 0;
    if (stars > prevStars) next.stars[id] = stars;
    if (typeof index === "number" && index + 2 > next.unlocked) {
      next.unlocked = Math.min(STAGE_COUNT, index + 2);
    }
  }
  return next;
}
