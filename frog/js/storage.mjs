// 本地持久化：静音偏好 + 关卡进度（每关最高星级 / 最快通关用时）。
// localStorage 在隐私 / 禁 Cookie 下会抛异常，统一降级内存，保证永远能玩。
import { LEVEL_COUNT } from "./level.mjs";

export const STORAGE_KEY = "doin.frog.v1";
export const SCHEMA_VERSION = 1;

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: { muted: false },
    progress: { unlocked: 1, best: {} },
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
      const probe = "__doin_frog__";
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

function intStars(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(3, Math.max(1, Math.trunc(n))) : 1;
}

function intTimeMs(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.max(0, Math.trunc(n)) : null;
}

function normalizeBest(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const key of Object.keys(raw)) {
    const levelId = Number(key);
    if (!Number.isInteger(levelId) || levelId < 1 || levelId > LEVEL_COUNT) continue;
    const rec = raw[key];
    if (!rec || typeof rec !== "object") continue;
    const stars = intStars(rec.stars);
    const timeMs = intTimeMs(rec.timeMs);
    out[levelId] = { stars, timeMs: timeMs ?? null };
  }
  return out;
}

export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  const muted = Boolean(prefs.muted);
  const progress = raw.progress && typeof raw.progress === "object" ? raw.progress : {};
  const unlocked = Math.max(1, Math.min(LEVEL_COUNT, Math.trunc(progress.unlocked) || 1));
  return {
    version: SCHEMA_VERSION,
    prefs: { muted },
    progress: { unlocked, best: normalizeBest(progress.best) },
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

// 记录一关通关结果（只在更好成绩时更新，返回新 state 与"是否刷新纪录"）。
export function recordResult(state, { levelId, stars, timeMs }) {
  const id = Math.trunc(levelId);
  if (!Number.isInteger(id) || id < 1 || id > LEVEL_COUNT) return { state, isRecord: false };
  const best = { ...state.progress.best };
  const prev = best[id] ?? { stars: 0, timeMs: null };
  const newStars = Math.max(prev.stars || 0, intStars(stars));
  const curTime = intTimeMs(timeMs);
  const prevTime = prev.timeMs;
  const newTime = prevTime == null ? curTime : (curTime == null ? prevTime : Math.min(prevTime, curTime));
  const isRecord = prevTime == null ? curTime != null : curTime != null && curTime < prevTime;

  best[id] = { stars: newStars, timeMs: newTime };
  let unlocked = state.progress.unlocked;
  if (id >= unlocked && id < LEVEL_COUNT && newStars >= 1) {
    unlocked = id + 1;
  }
  return {
    state: {
      ...state,
      progress: { unlocked, best },
    },
    isRecord,
  };
}

export function bestFor(state, levelId) {
  return state.progress.best[levelId] ?? { stars: 0, timeMs: null };
}