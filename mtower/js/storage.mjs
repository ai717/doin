/**
 * @file games/mtower/js/storage.mjs
 * 魔塔 50 层统一持久化层，Key 契约 doin.mtower.v1。
 * 集中 try/catch，内存安全降级，严格归一化。
 */

export const STORAGE_KEY = 'doin.mtower.v1';

let memoryStorage = null;

export function getDefaultStorage() {
  return {
    version: 1,
    bestScore: 0,
    bestFloor: 1,
    bestTitle: 'title_novice',
    classicWon: false,
    fastWon: false,
    totalClears: 0,
  };
}

export function normalizeStorage(data) {
  if (!data || typeof data !== 'object') {
    return getDefaultStorage();
  }

  return {
    version: 1,
    bestScore: typeof data.bestScore === 'number' && Number.isFinite(data.bestScore) ? Math.max(0, data.bestScore) : 0,
    bestFloor: typeof data.bestFloor === 'number' && Number.isFinite(data.bestFloor) ? Math.max(1, data.bestFloor) : 1,
    bestTitle: typeof data.bestTitle === 'string' ? data.bestTitle : 'title_novice',
    classicWon: Boolean(data.classicWon),
    fastWon: Boolean(data.fastWon),
    totalClears: typeof data.totalClears === 'number' && Number.isFinite(data.totalClears) ? Math.max(0, data.totalClears) : 0,
  };
}

export function loadStorage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return normalizeStorage(JSON.parse(raw));
      }
    }
  } catch (err) {}

  if (memoryStorage) {
    return normalizeStorage(memoryStorage);
  }

  memoryStorage = getDefaultStorage();
  return memoryStorage;
}

export function saveStorage(data) {
  const norm = normalizeStorage(data);
  memoryStorage = norm;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(norm));
    }
  } catch (err) {}
  return norm;
}

export function recordVictory(scoreResult, mode = 'classic50') {
  const current = loadStorage();
  const next = {
    ...current,
    bestScore: Math.max(current.bestScore, scoreResult.score || 0),
    bestFloor: Math.max(current.bestFloor, scoreResult.floor || 1),
    classicWon: mode === 'classic50' ? true : current.classicWon,
    fastWon: mode === 'fast25' ? true : current.fastWon,
    totalClears: current.totalClears + 1,
  };
  return saveStorage(next);
}
