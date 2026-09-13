// 唯一本地持久化封装：读取 / 写入 / normalize / 内存降级。
// 存档 Key：doin.pair-link.v1（语言偏好不在此 key 内，统一走全局 doin.lang）。

import { LEVEL_COUNT } from "./engine.mjs";
import { MAX_SCORE } from "./score.mjs";

export const STORAGE_KEY = "doin.pair-link.v1";
export const VERSION = 1;

export const DEFAULT_PROGRESS = Object.freeze({
  v: VERSION,
  unlocked: 1,
  levels: {},
  endlessBest: 0,
  muted: false,
  lastLevel: 1
});

function clampInt(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function defaultProgress() {
  return { v: VERSION, unlocked: 1, levels: {}, endlessBest: 0, muted: false, lastLevel: 1 };
}

/** 严格数据清洗：任何缺失 / 错误类型 / NaN / 越界都回退到安全值。 */
export function normalizeProgress(raw) {
  const out = defaultProgress();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  if (raw.v !== VERSION) return out;

  out.unlocked = clampInt(raw.unlocked, 1, LEVEL_COUNT, 1);
  out.endlessBest = clampInt(raw.endlessBest, 0, MAX_SCORE, 0);
  out.muted = raw.muted === true;

  if (raw.levels && typeof raw.levels === "object" && !Array.isArray(raw.levels)) {
    for (const [key, value] of Object.entries(raw.levels)) {
      if (!/^(?:[1-9]|[12][0-9]|3[0-6])$/.test(String(key))) continue;
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      out.levels[String(key)] = {
        score: clampInt(value.score, 0, MAX_SCORE, 0),
        stars: clampInt(value.stars, 0, 3, 0)
      };
    }
  }

  out.lastLevel = clampInt(raw.lastLevel, 1, out.unlocked, 1);
  return out;
}

let memoryCache = defaultProgress();

/** 读取存档；localStorage 不可用 / 损坏 / 版本不符时静默回退内存默认值。 */
export function loadProgress() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const item = window.localStorage.getItem(STORAGE_KEY);
      if (item) {
        memoryCache = normalizeProgress(JSON.parse(item));
        return memoryCache;
      }
    }
  } catch {
    // 隐私模式 / 坏 JSON / 配额异常 —— 静默降级为内存态
  }
  return memoryCache;
}

/** 写入存档；任何异常都不得外抛。 */
export function saveProgress(next) {
  memoryCache = normalizeProgress(next);
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryCache));
    }
  } catch {
    // 忽略配额超限或隐私模式报错
  }
  return memoryCache;
}

/** 取某关历史最好成绩（无记录时 { score: 0, stars: 0 }）。 */
export function levelStat(progress, level) {
  const key = String(clampInt(level, 1, LEVEL_COUNT, 1));
  const record = progress && progress.levels ? progress.levels[key] : null;
  if (!record) return { score: 0, stars: 0 };
  return { score: record.score, stars: record.stars };
}

/**
 * 记录一次通关：分数取历史最高，星数只增不减，并解锁下一关。
 * 返回新的存档对象（不落盘；调用方决定是否 saveProgress）。
 */
export function recordLevel(progress, level, { score = 0, stars = 0 } = {}) {
  const base = normalizeProgress(progress);
  const L = clampInt(level, 1, LEVEL_COUNT, 1);
  const key = String(L);
  const prev = base.levels[key] || { score: 0, stars: 0 };
  base.levels[key] = {
    score: Math.max(prev.score, clampInt(score, 0, MAX_SCORE, 0)),
    stars: Math.max(prev.stars, clampInt(stars, 0, 3, 0))
  };
  base.unlocked = Math.max(base.unlocked, Math.min(LEVEL_COUNT, L + 1));
  base.lastLevel = L;
  return base;
}

/** 记录无尽最高分。 */
export function recordEndless(progress, score) {
  const base = normalizeProgress(progress);
  base.endlessBest = Math.max(base.endlessBest, clampInt(score, 0, MAX_SCORE, 0));
  return base;
}

/** 清空存档（破坏性操作，调用方负责二次确认）。 */
export function clearProgress() {
  memoryCache = defaultProgress();
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // 忽略
  }
  return memoryCache;
}
