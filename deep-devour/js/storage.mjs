// storage.mjs — 存档唯一口径：key doin.deep-devour.v1
// 结构 { version, prefs:{muted}, progress:{stars, lastLevel, abyss:{meters,score}} }
// localStorage 不可用（隐私模式 / 存储被禁）时静默降级到内存，读到的任何坏值都退回默认。

import { LEVELS } from "./levels.mjs";
import { clampPearls } from "./score.mjs";

export const STORAGE_KEY = "doin.deep-devour.v1";
export const SCHEMA_VERSION = 1;

const VALID_IDS = new Set(LEVELS.map((level) => level.id));

export function defaultProgress() {
  return {
    stars: {},
    lastLevel: LEVELS[0].id,
    abyss: { meters: 0, score: 0 },
  };
}

export function defaultState() {
  return { version: SCHEMA_VERSION, prefs: { muted: false }, progress: defaultProgress() };
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
      const probe = "__doin_dd__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      backend = localStorage;
      return backend;
    }
  } catch (error) {
    // 隐私模式或存储被禁用 → 内存兜底
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

function bool(value) {
  return value === true || value === "true" || value === 1;
}

// 任何字段缺失、被手改坏、或引用了不存在的关卡 id，都静默丢弃，绝不把异常抛给 UI。
export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const progress = raw.progress && typeof raw.progress === "object" ? raw.progress : {};
  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  const rawStars = progress.stars && typeof progress.stars === "object" ? progress.stars : {};
  const stars = {};
  for (const [id, value] of Object.entries(rawStars)) {
    if (!VALID_IDS.has(id)) continue;
    const pearls = clampPearls(value);
    if (pearls > 0) stars[id] = pearls;
  }
  const abyss = progress.abyss && typeof progress.abyss === "object" ? progress.abyss : {};
  const lastLevel = VALID_IDS.has(progress.lastLevel) ? progress.lastLevel : base.progress.lastLevel;
  return {
    version: SCHEMA_VERSION,
    prefs: { muted: bool(prefs.muted) },
    progress: {
      stars,
      lastLevel,
      abyss: { meters: int(abyss.meters), score: int(abyss.score) },
    },
  };
}

export function load() {
  try {
    const raw = storage().getItem(STORAGE_KEY);
    return normalize(raw ? JSON.parse(raw) : null);
  } catch (error) {
    return defaultState();
  }
}

export function save(state) {
  const next = normalize(state);
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    // 写失败不影响本局游戏
  }
  return next;
}

// 珍珠只增不减：记录本关历史最佳评级。
export function recordLevel(state, { levelId, pearls }) {
  const next = normalize(state);
  if (!VALID_IDS.has(levelId)) return { state: next, improved: false };
  const best = clampPearls(pearls);
  const before = next.progress.stars[levelId] ?? 0;
  if (best > before) next.progress.stars[levelId] = best;
  next.progress.lastLevel = levelId;
  return { state: next, improved: best > before };
}

export function recordAbyss(state, { meters, score }) {
  const next = normalize(state);
  const isRecord = int(meters) > next.progress.abyss.meters || int(score) > next.progress.abyss.score;
  next.progress.abyss = {
    meters: Math.max(next.progress.abyss.meters, int(meters)),
    score: Math.max(next.progress.abyss.score, int(score)),
  };
  return { state: next, isRecord };
}

export function setLastLevel(state, levelId) {
  const next = normalize(state);
  if (VALID_IDS.has(levelId)) next.progress.lastLevel = levelId;
  return next;
}

export function setMuted(state, muted) {
  const next = normalize(state);
  next.prefs.muted = Boolean(muted);
  return next;
}

export function resetAll() {
  try {
    storage().removeItem(STORAGE_KEY);
  } catch (error) {
    // 忽略
  }
  return defaultState();
}
