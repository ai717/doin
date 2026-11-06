/**
 * @file games/sleepwalker/js/storage.mjs
 * 存档唯一口径，Key 统一 `doin.sleepwalker.v1`，集中 try/catch 降级内存。
 */

const STORAGE_KEY = 'doin.sleepwalker.v1';

let memoryStore = null;

function getDefaultState() {
  return {
    unlockedLevel: 1,
    currentLevel: 1,
    stars: {},
    bubbles: {},
    sound: true,
    fastSpeed: false,
    masterBadge: false,
  };
}

/**
 * 校验并归一化存档数据
 */
export function normalizeState(raw) {
  const defaults = getDefaultState();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const unlocked = Number.isInteger(raw.unlockedLevel) && raw.unlockedLevel >= 1 && raw.unlockedLevel <= 22
    ? raw.unlockedLevel
    : 1;

  const current = Number.isInteger(raw.currentLevel) && raw.currentLevel >= 1 && raw.currentLevel <= 22
    ? raw.currentLevel
    : 1;

  const stars = {};
  if (raw.stars && typeof raw.stars === 'object') {
    for (const k in raw.stars) {
      const id = parseInt(k, 10);
      const val = parseInt(raw.stars[k], 10);
      if (id >= 1 && id <= 22 && val >= 0 && val <= 3) {
        stars[id] = val;
      }
    }
  }

  const bubbles = {};
  if (raw.bubbles && typeof raw.bubbles === 'object') {
    for (const k in raw.bubbles) {
      const id = parseInt(k, 10);
      const val = parseInt(raw.bubbles[k], 10);
      if (id >= 1 && id <= 22 && val >= 0 && val <= 3) {
        bubbles[id] = val;
      }
    }
  }

  // 计算总星数，是否解锁织梦大师徽章
  let totalStars = 0;
  for (let i = 1; i <= 22; i++) {
    totalStars += (stars[i] || 0);
  }

  return {
    unlockedLevel: unlocked,
    currentLevel: current,
    stars,
    bubbles,
    sound: typeof raw.sound === 'boolean' ? raw.sound : true,
    fastSpeed: typeof raw.fastSpeed === 'boolean' ? raw.fastSpeed : false,
    masterBadge: totalStars >= 66,
  };
}

/**
 * 读取本地存档
 */
export function loadGameData() {
  try {
    if (typeof localStorage !== 'undefined') {
      const str = localStorage.getItem(STORAGE_KEY);
      if (str) {
        const parsed = JSON.parse(str);
        return normalizeState(parsed);
      }
    }
  } catch (err) {
    // 降级使用内存存储
  }

  if (memoryStore) {
    return normalizeState(memoryStore);
  }

  memoryStore = getDefaultState();
  return memoryStore;
}

/**
 * 写入本地存档
 */
export function saveGameData(data) {
  const normalized = normalizeState(data);
  memoryStore = normalized;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      return true;
    }
  } catch (err) {
    // 静默降级
  }
  return false;
}

/**
 * 记录单关通关成就
 * @param {number} levelId
 * @param {number} stars
 * @param {number} bubblesCount
 */
export function recordLevelClear(levelId, stars, bubblesCount) {
  const data = loadGameData();
  const currentBestStars = data.stars[levelId] || 0;
  if (stars > currentBestStars) {
    data.stars[levelId] = stars;
  }

  const currentBestBubbles = data.bubbles[levelId] || 0;
  if (bubblesCount > currentBestBubbles) {
    data.bubbles[levelId] = bubblesCount;
  }

  if (levelId < 22 && data.unlockedLevel < levelId + 1) {
    data.unlockedLevel = levelId + 1;
  }

  saveGameData(data);
  return data;
}

/**
 * 清理测试或重置数据
 */
export function resetGameData() {
  memoryStore = getDefaultState();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    // 静默
  }
  return memoryStore;
}
