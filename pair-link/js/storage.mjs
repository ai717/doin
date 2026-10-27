// 唯一本地持久化封装：读取 / 写入 / normalize / 内存降级。
// 存档 Key：doin.pair-link.v1（语言偏好不在此 key 内，统一走全局 doin.lang）。
//
// 关于 VERSION：每日一盘是**追加字段**（daily），不是破坏性变更，所以 v 保持 1 ——
// 老存档里没有 daily 时由 normalizeProgress 补默认值，玩家不会丢主线进度。

import { LEVEL_COUNT, isDateKey } from "./engine.mjs";
import { MAX_SCORE } from "./score.mjs";

export const STORAGE_KEY = "doin.pair-link.v1";
export const VERSION = 1;

export const DEFAULT_PROGRESS = Object.freeze({
  v: VERSION,
  unlocked: 1,
  levels: {},
  endlessBest: 0,
  daily: { dateKey: "", bestScore: 0 },
  muted: false,
  lastLevel: 1
});

function clampInt(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function defaultProgress() {
  return {
    v: VERSION,
    unlocked: 1,
    levels: {},
    endlessBest: 0,
    daily: { dateKey: "", bestScore: 0 },
    muted: false,
    lastLevel: 1
  };
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

  // 每日一盘：日期键必须合法，否则整条回退（避免出现"某个不存在的日期的最佳分"）
  if (raw.daily && typeof raw.daily === "object" && !Array.isArray(raw.daily)) {
    if (isDateKey(raw.daily.dateKey)) {
      out.daily = {
        dateKey: raw.daily.dateKey,
        bestScore: clampInt(raw.daily.bestScore, 0, MAX_SCORE, 0)
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

/**
 * 取某个日期的最佳分；日期不是"存档里那一天"时返回 0。
 * （跨天后旧记录要失效 —— 每日挑战比的是今天。）
 */
export function dailyBest(progress, dateKey) {
  const record = progress && progress.daily ? progress.daily : null;
  if (!record || !isDateKey(dateKey) || record.dateKey !== dateKey) return 0;
  return clampInt(record.bestScore, 0, MAX_SCORE, 0);
}

/**
 * 记录一次每日一盘的成绩：跨天则重置为今天的成绩，同一天取最高。
 * **不触碰** unlocked / levels / lastLevel —— 每日挑战与主线进度完全解耦。
 * 返回 { progress, isNewBest }。
 */
export function recordDaily(progress, dateKey, score) {
  const base = normalizeProgress(progress);
  if (!isDateKey(dateKey)) return { progress: base, isNewBest: false };
  const total = clampInt(score, 0, MAX_SCORE, 0);
  const sameDay = base.daily.dateKey === dateKey;
  const isNewBest = !sameDay || total > base.daily.bestScore;
  base.daily = {
    dateKey: dateKey,
    bestScore: sameDay ? Math.max(total, base.daily.bestScore) : total
  };
  return { progress: base, isNewBest: isNewBest };
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
