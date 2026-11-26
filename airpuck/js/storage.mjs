/**
 * @file games/airpuck/js/storage.mjs
 * 存档唯一口径，Key 统一 doin.airpuck.v1。
 * 集中 try/catch 降级内存，读取强校验与数据归一化，绝不白屏崩溃。
 */

export const STORAGE_KEY = 'doin.airpuck.v1';

let memoryFallback = null;

export function normalizeStorage(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      unlockedLevel: 1,
      records: {},
      vsModeStats: { p1Wins: 0, p2Wins: 0 },
    };
  }

  const unlockedLevel = Math.max(1, Math.min(22, typeof raw.unlockedLevel === 'number' ? raw.unlockedLevel : 1));
  const records = {};
  if (raw.records && typeof raw.records === 'object') {
    for (const [lvlId, rec] of Object.entries(raw.records)) {
      if (rec && typeof rec === 'object') {
        records[lvlId] = {
          won: Boolean(rec.won),
          stars: Math.max(0, Math.min(3, typeof rec.stars === 'number' ? rec.stars : 0)),
          bestTime: typeof rec.bestTime === 'number' ? Math.max(1, rec.bestTime) : 999,
          minConceded: typeof rec.minConceded === 'number' ? Math.max(0, rec.minConceded) : 5,
        };
      }
    }
  }

  const vsModeStats = {
    p1Wins: Math.max(0, raw.vsModeStats?.p1Wins || 0),
    p2Wins: Math.max(0, raw.vsModeStats?.p2Wins || 0),
  };

  return {
    unlockedLevel,
    records,
    vsModeStats,
  };
}

export function loadStorage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const item = localStorage.getItem(STORAGE_KEY);
      if (item) {
        return normalizeStorage(JSON.parse(item));
      }
    }
  } catch (err) {
    // 降级使用内存存储
  }

  if (!memoryFallback) {
    memoryFallback = normalizeStorage(null);
  }
  return memoryFallback;
}

export function saveStorage(data) {
  const normalized = normalizeStorage(data);
  memoryFallback = normalized;

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
 * 记录单人天梯单关战绩
 */
export function recordLevelClear(levelId, starsResult, elapsedTime) {
  const current = loadStorage();
  const existing = current.records[levelId] || { won: false, stars: 0, bestTime: 999, minConceded: 5 };

  const updatedStars = Math.max(existing.stars, starsResult.stars);
  const updatedBestTime = Math.min(existing.bestTime, elapsedTime);
  const updatedMinConceded = Math.min(existing.minConceded, starsResult.goalsConceded);

  current.records[levelId] = {
    won: true,
    stars: updatedStars,
    bestTime: updatedBestTime,
    minConceded: updatedMinConceded,
  };

  if (starsResult.won && levelId >= current.unlockedLevel && levelId < 22) {
    current.unlockedLevel = levelId + 1;
  }

  return saveStorage(current);
}

/**
 * 记录双人对决获胜统计
 */
export function recordVsMatch(winner) {
  const current = loadStorage();
  if (winner === 'p1') {
    current.vsModeStats.p1Wins += 1;
  } else if (winner === 'p2') {
    current.vsModeStats.p2Wins += 1;
  }
  return saveStorage(current);
}
