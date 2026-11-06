/**
 * @file games/bumper/js/storage.mjs
 * 纯静态本地持久化封装，Key 统一 `doin.bumper.v1`。
 * 集中 try/catch，隐私模式或无存储环境平滑降级内存，读取带强校验。
 */

export const STORAGE_KEY = 'doin.bumper.v1';

let memoryFallback = null;

/**
 * 默认初始存档数据结构
 */
export function getDefaultStorage() {
  return {
    version: 1,
    unlockedLevel: 1,
    stars: {}, // { [levelId]: 1..3 }
    bestKills: 0,
    wins1p: 0,
    wins2pRed: 0,
    wins2pBlue: 0,
    sound: true,
    lastLevel: 1,
  };
}

/**
 * 归一化校验存档数据
 */
export function normalizeStorage(raw) {
  const base = getDefaultStorage();
  if (!raw || typeof raw !== 'object') return base;

  const unlockedLevel = typeof raw.unlockedLevel === 'number' && raw.unlockedLevel >= 1 && raw.unlockedLevel <= 23
    ? Math.floor(raw.unlockedLevel)
    : 1;

  const stars = {};
  if (raw.stars && typeof raw.stars === 'object') {
    for (const k in raw.stars) {
      const numK = Number(k);
      const val = Number(raw.stars[k]);
      if (numK >= 1 && numK <= 23 && val >= 1 && val <= 3) {
        stars[numK] = Math.floor(val);
      }
    }
  }

  return {
    version: 1,
    unlockedLevel,
    stars,
    bestKills: typeof raw.bestKills === 'number' && raw.bestKills >= 0 ? Math.floor(raw.bestKills) : 0,
    wins1p: typeof raw.wins1p === 'number' && raw.wins1p >= 0 ? Math.floor(raw.wins1p) : 0,
    wins2pRed: typeof raw.wins2pRed === 'number' && raw.wins2pRed >= 0 ? Math.floor(raw.wins2pRed) : 0,
    wins2pBlue: typeof raw.wins2pBlue === 'number' && raw.wins2pBlue >= 0 ? Math.floor(raw.wins2pBlue) : 0,
    sound: raw.sound !== false,
    lastLevel: typeof raw.lastLevel === 'number' && raw.lastLevel >= 1 && raw.lastLevel <= 23
      ? Math.floor(raw.lastLevel)
      : unlockedLevel,
  };
}

/**
 * 读取本地存档
 */
export function loadStorage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const item = localStorage.getItem(STORAGE_KEY);
      if (item) {
        const parsed = JSON.parse(item);
        return normalizeStorage(parsed);
      }
    }
  } catch {
    // 降级内存
  }

  if (!memoryFallback) {
    memoryFallback = getDefaultStorage();
  }
  return normalizeStorage(memoryFallback);
}

/**
 * 保存本地存档
 */
export function saveStorage(data) {
  const normalized = normalizeStorage(data);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
  } catch {
    // 降级内存
  }
  memoryFallback = normalized;
  return normalized;
}

/**
 * 记录单人闯关结算
 */
export function recordLevelClear(levelId, starsAchieved, roundKills = 5) {
  const data = loadStorage();

  const prevStars = data.stars[levelId] || 0;
  if (starsAchieved > prevStars) {
    data.stars[levelId] = starsAchieved;
  }

  if (levelId === data.unlockedLevel && levelId < 23) {
    data.unlockedLevel = levelId + 1;
  }

  data.bestKills += roundKills;
  data.wins1p += 1;
  data.lastLevel = Math.min(23, levelId + 1);

  return saveStorage(data);
}
