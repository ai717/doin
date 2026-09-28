import { levelsForSize } from './engine.mjs';

const STORAGE_KEY = 'doin.one-line.v1';

// 关卡成绩键必须是 `${规格}_${关卡}` 复合键，不能退化成单个数字
const LEVEL_STAT_KEY = /^(\d+)_(\d+)$/;

const DEFAULT_STATE = {
  unlocked: {}, // { [规格]: 该规格已解锁到第几关 }
  audioMuted: false,
  levelStats: {}, // { [`${规格}_${关卡}`]: { stars: number, bestTime: number } }
  endlessBest: 0 // 无尽模式已抵达的最高关号（0 = 还没玩过）
};

// 严格数据清洗（Normalize）
export function normalizeState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { unlocked: {}, audioMuted: false, levelStats: {}, endlessBest: 0 };
  }

  const audioMuted = Boolean(raw.audioMuted);

  const unlocked = {};
  if (raw.unlocked && typeof raw.unlocked === 'object' && !Array.isArray(raw.unlocked)) {
    for (const [sizeKey, value] of Object.entries(raw.unlocked)) {
      const size = parseInt(sizeKey, 10);
      const level = parseInt(value, 10);
      if (Number.isFinite(size) && size >= 4 && Number.isFinite(level) && level >= 1) {
        unlocked[String(size)] = Math.min(levelsForSize(size), Math.floor(level));
      }
    }
  }

  const levelStats = {};
  if (raw.levelStats && typeof raw.levelStats === 'object' && !Array.isArray(raw.levelStats)) {
    for (const [key, stat] of Object.entries(raw.levelStats)) {
      const matched = LEVEL_STAT_KEY.exec(key);
      if (!matched || !stat || typeof stat !== 'object') continue;

      levelStats[key] = {
        stars: typeof stat.stars === 'number' && Number.isFinite(stat.stars)
          ? Math.max(0, Math.min(3, Math.floor(stat.stars)))
          : 0,
        bestTime: typeof stat.bestTime === 'number' && Number.isFinite(stat.bestTime)
          ? Math.max(0, Math.floor(stat.bestTime))
          : 0
      };
    }
  }

  const endlessBestRaw = raw.endlessBest;
  const endlessBest = Number.isFinite(endlessBestRaw)
    ? Math.max(0, Math.floor(endlessBestRaw))
    : 0;

  return {
    unlocked,
    audioMuted,
    levelStats,
    endlessBest
  };
}

let memoryCache = { ...DEFAULT_STATE, unlocked: {}, levelStats: {} };

export function loadSaveData() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const item = window.localStorage.getItem(STORAGE_KEY);
      if (item) {
        const parsed = JSON.parse(item);
        memoryCache = normalizeState(parsed);
        return memoryCache;
      }
    }
  } catch {
    // 遇到异常使用当前内存状态兜底
  }
  return memoryCache;
}

export function writeSaveData(updater) {
  const current = loadSaveData();
  const next = typeof updater === 'function' ? updater(current) : updater;
  memoryCache = normalizeState(next);

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryCache));
    }
  } catch {
    // 忽略配额超限或隐私模式报错
  }
  return memoryCache;
}

/** 某规格已解锁到第几关（默认只开放第 1 关） */
export function unlockedLevelFor(saveData, size) {
  const value = saveData && saveData.unlocked ? saveData.unlocked[String(size)] : 0;
  return value >= 1 ? value : 1;
}
