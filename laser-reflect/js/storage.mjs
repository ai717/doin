// 本地持久化：关卡进度（已通关最高关）、每关星级、偏好（音效）。
// localStorage 在隐私模式 / 禁用 Cookie 下会抛异常，统一降级到内存。

export const STORAGE_KEY = "doin.laser-reflect.v1";
export const SCHEMA_VERSION = 1;

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: { muted: false },
    progress: {
      cleared: 0, // 已通关最高关（0 = 未通关任何关；第 1 关始终解锁）
      stars: {}, // { "0": 3, "1": 2, ... } 关卡下标 -> 星级
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
      const probe = "__doin_laser__";
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

function star(value) {
  const n = Number(value);
  return n >= 1 && n <= 3 ? Math.trunc(n) : null;
}

// 归一化：任何字段缺失或被手改坏都退回默认值，绝不把异常抛给 UI。
export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  const progress = raw.progress && typeof raw.progress === "object" ? raw.progress : {};
  const stars = {};
  if (progress.stars && typeof progress.stars === "object") {
    for (const [key, value] of Object.entries(progress.stars)) {
      const s = star(value);
      if (s !== null) stars[key] = s;
    }
  }
  return {
    version: SCHEMA_VERSION,
    prefs: { muted: Boolean(prefs.muted) },
    progress: {
      cleared: int(progress.cleared),
      stars,
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

// 记录通关：levelIndex 从 0 开始。更新 cleared 与星级（取历史最高）。
export function recordClear(progress, levelIndex, totalLevels, gainedStars) {
  const next = {
    cleared: Math.max(progress.cleared, levelIndex + 1),
    stars: { ...progress.stars },
  };
  const key = String(levelIndex);
  next.stars[key] = Math.max(next.stars[key] ?? 0, gainedStars ?? 0);
  // cleared 不超过总关数（全部通关后 cleared = totalLevels，最后一关之后没有"下一关"）
  if (next.cleared > totalLevels) next.cleared = totalLevels;
  return next;
}

// 判断关卡是否解锁：第 1 关（index 0）恒解锁；其余需 cleared >= index。
export function isUnlocked(progress, levelIndex) {
  return levelIndex === 0 || progress.cleared >= levelIndex;
}
