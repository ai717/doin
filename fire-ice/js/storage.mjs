// 森林冰火人 · 存档唯一口径
// Key: doin.fire-ice.v1；localStorage 不可用或数据损坏时静默降级内存
// 读取数据严格归一化校验，绝不白屏

import { LEVEL_COUNT, CHAPTERS } from "./levels.mjs";

export const STORAGE_KEY = "doin.fire-ice.v1";
export const SCHEMA_VERSION = 1;

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: {
      muted: false
    },
    progress: {
      unlocked: 1,                      // 已解锁关卡数（1 起）
      stars: {},                        // { [levelIndex]: 1|2|3 }
      bestTime: {},                     // { [levelIndex]: 秒 }
      plays: {}                         // { [levelIndex]: 游玩次数 }
    }
  };
}

function createMemoryFallback() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
}

let backend;

function getStorage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      const probe = "__doin_fire_ice_probe__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      backend = localStorage;
      return backend;
    }
  } catch {
    // 降级
  }
  backend = createMemoryFallback();
  return backend;
}

export function resetBackendForTests() {
  backend = undefined;
}

function int(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback;
}

function starVal(val) {
  const n = Math.trunc(Number(val));
  return Number.isFinite(n) ? Math.max(1, Math.min(3, n)) : 1;
}

function normalizeProgress(progress) {
  const base = {};
  const stars = {};
  const bestTime = {};
  const plays = {};
  if (progress && typeof progress === "object") {
    const s = progress.stars ?? {};
    const t = progress.bestTime ?? {};
    const p = progress.plays ?? {};
    for (let i = 0; i < LEVEL_COUNT; i++) {
      if (s[i] !== undefined && s[i] !== null) stars[i] = starVal(s[i]);
      if (t[i] !== undefined && t[i] !== null) {
        const v = Number(t[i]);
        if (Number.isFinite(v) && v >= 0) bestTime[i] = v;
      }
      if (p[i] !== undefined && p[i] !== null) plays[i] = int(p[i]);
    }
  }
  const unlocked = int(progress?.unlocked ?? 1, 1);
  return {
    unlocked: Math.max(1, Math.min(LEVEL_COUNT, unlocked)),
    stars,
    bestTime,
    plays
  };
}

export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  return {
    version: SCHEMA_VERSION,
    prefs: {
      muted: Boolean(raw.prefs?.muted)
    },
    progress: normalizeProgress(raw.progress)
  };
}

export function load() {
  try {
    const raw = getStorage().getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return normalize(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function save(state) {
  try {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(normalize(state)));
    return true;
  } catch {
    return false;
  }
}

// 通关结算：解锁下一关、记录星级与最佳用时
export function recordClear(store, result) {
  const next = normalize(store);
  const idx = int(result.levelIndex);
  const stars = starVal(result.stars);
  const time = Number(result.elapsed);

  if (idx >= 0 && idx < LEVEL_COUNT) {
    next.progress.stars[idx] = Math.max(next.progress.stars[idx] ?? 1, stars);
    if (Number.isFinite(time) && time >= 0) {
      const prev = next.progress.bestTime[idx];
      if (prev === undefined || time < prev) next.progress.bestTime[idx] = time;
    }
    next.progress.plays[idx] = (next.progress.plays[idx] ?? 0) + 1;
    // 解锁下一关
    if (idx + 1 < LEVEL_COUNT) {
      next.progress.unlocked = Math.max(next.progress.unlocked, idx + 2);
    }
  }
  return next;
}

export function recordPlay(store, idx) {
  const next = normalize(store);
  const n = int(idx);
  if (n >= 0 && n < LEVEL_COUNT) {
    next.progress.plays[n] = (next.progress.plays[n] ?? 0) + 1;
  }
  return next;
}

// 章节已解锁判定：章节首关索引 <= unlocked
export function chapterUnlocked(store, chapter) {
  const unlocked = normalize(store).progress.unlocked;
  return chapter.from < unlocked;
}

export function chapterStars(store, chapter) {
  const prog = normalize(store).progress;
  let total = 0;
  for (let i = chapter.from; i <= chapter.to; i++) {
    total += prog.stars[i] ?? 0;
  }
  return total;
}

export { LEVEL_COUNT, CHAPTERS };
