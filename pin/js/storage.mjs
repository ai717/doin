/**
 * @file games/pin/js/storage.mjs
 * 本地持久化与内存降级模块。
 * 遵循契约：统一 Key 为 doin.pin.v1，集中 try/catch 防御，绝不抛错。
 */

export const STORAGE_KEY = 'doin.pin.v1';

let memoryStorage = null;

/**
 * 校验并归一化存档数据
 */
export function normalizeStorage(raw) {
  if (!raw || typeof raw !== 'object') {
    return createDefaultStorage();
  }

  const unlockedLevel = Math.max(1, Math.min(23, Number(raw.unlockedLevel) || 1));
  const currentLevel = Math.max(1, Math.min(23, Number(raw.currentLevel) || 1));
  const endlessHighScore = Math.max(0, Number(raw.endlessHighScore) || 0);
  const soundEnabled = raw.soundEnabled !== false;

  const records = {};
  if (raw.records && typeof raw.records === 'object') {
    for (let i = 1; i <= 23; i++) {
      const rec = raw.records[i];
      if (rec && typeof rec === 'object') {
        records[i] = {
          stars: Math.max(0, Math.min(3, Number(rec.stars) || 0)),
          bestTime: Math.max(0, Number(rec.bestTime) || 0),
          maxCombo: Math.max(0, Number(rec.maxCombo) || 0),
        };
      }
    }
  }

  return {
    unlockedLevel,
    currentLevel,
    endlessHighScore,
    soundEnabled,
    records,
  };
}

export function createDefaultStorage() {
  return {
    unlockedLevel: 1,
    currentLevel: 1,
    endlessHighScore: 0,
    soundEnabled: true,
    records: {},
  };
}

/**
 * 读取本地存档
 */
export function loadStorage() {
  if (memoryStorage !== null) {
    return normalizeStorage(memoryStorage);
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const serialized = localStorage.getItem(STORAGE_KEY);
      if (serialized) {
        const parsed = JSON.parse(serialized);
        return normalizeStorage(parsed);
      }
    }
  } catch (err) {
    // 降级使用内存
  }

  return createDefaultStorage();
}

/**
 * 写入本地存档
 */
export function saveStorage(data) {
  const normalized = normalizeStorage(data);
  memoryStorage = normalized;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
  } catch (err) {
    // 静默降级内存
  }

  return normalized;
}

/**
 * 记录单关通关成就
 */
export function recordLevelClear(levelId, stats = {}) {
  const data = loadStorage();
  const id = Number(levelId);
  const stars = Math.max(1, Math.min(3, Number(stats.stars) || 1));
  const time = Math.max(0, Number(stats.time) || 0);
  const maxCombo = Math.max(0, Number(stats.maxCombo) || 0);

  const prevRec = data.records[id] || { stars: 0, bestTime: 99999, maxCombo: 0 };
  data.records[id] = {
    stars: Math.max(prevRec.stars, stars),
    bestTime: prevRec.bestTime > 0 ? Math.min(prevRec.bestTime, time) : time,
    maxCombo: Math.max(prevRec.maxCombo, maxCombo),
  };

  // 解锁下一关 (最多 23 关)
  if (id >= data.unlockedLevel && id < 23) {
    data.unlockedLevel = id + 1;
  }

  return saveStorage(data);
}

/**
 * 更新无尽模式最高分
 */
export function recordEndlessScore(score) {
  const data = loadStorage();
  const sc = Math.max(0, Number(score) || 0);
  if (sc > data.endlessHighScore) {
    data.endlessHighScore = sc;
    saveStorage(data);
  }
  return data.endlessHighScore;
}
