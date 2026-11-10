/**
 * @file games/screw/js/storage.mjs
 * 存档唯一口径，Key 统一 doin.screw.v1。
 * 集中 try/catch 降级内存，读取强校验与归一化，绝不白屏崩溃。
 */

import { LEVELS } from './levels.mjs';

export const STORAGE_KEY = 'doin.screw.v1';
export const TOTAL_LEVELS = LEVELS.length;

let memoryBackend = null;

function createMemoryBackend() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

function backend() {
  if (memoryBackend) return memoryBackend;
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__doin_screw_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      memoryBackend = localStorage;
      return memoryBackend;
    }
  } catch (err) {
    // 隐私模式或存储受限：静默降级内存
  }
  memoryBackend = createMemoryBackend();
  return memoryBackend;
}

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

export function normalizeStorage(raw) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const records = {};
  if (safe.records && typeof safe.records === 'object') {
    for (const [key, value] of Object.entries(safe.records)) {
      const levelId = Number(key);
      if (!Number.isInteger(levelId) || levelId < 1 || levelId > TOTAL_LEVELS) continue;
      if (!value || typeof value !== 'object') continue;
      records[levelId] = {
        cleared: Boolean(value.cleared),
        stars: clampInt(value.stars, 0, 3, 0),
        bestTimeMs: clampInt(value.bestTimeMs, 0, Number.MAX_SAFE_INTEGER, 0),
        bestMoves: clampInt(value.bestMoves, 0, 999, 0),
        undos: clampInt(value.undos, 0, 9999, 0),
        recordedAt: clampInt(value.recordedAt, 0, Number.MAX_SAFE_INTEGER, 0),
      };
    }
  }

  return {
    unlockedLevel: clampInt(safe.unlockedLevel, 1, TOTAL_LEVELS, 1),
    lastLevelId: clampInt(safe.lastLevelId, 1, TOTAL_LEVELS, 1),
    records,
    sound: safe.sound === undefined ? true : Boolean(safe.sound),
  };
}

export function loadStorage() {
  try {
    const item = backend().getItem(STORAGE_KEY);
    if (item) return normalizeStorage(JSON.parse(item));
  } catch (err) {
    // 坏数据或无法解析：回退默认存档
  }
  return normalizeStorage(null);
}

export function saveStorage(data) {
  const normalized = normalizeStorage(data);
  try {
    backend().setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch (err) {
    // 静默降级：内存中的值仍然有效
  }
  return normalized;
}

export function recordLevelClear(levelId, result) {
  const current = loadStorage();
  const id = clampInt(levelId, 1, TOTAL_LEVELS, 1);
  const existing = current.records[id] || {
    cleared: false,
    stars: 0,
    bestTimeMs: 0,
    bestMoves: 0,
    undos: 0,
    recordedAt: 0,
  };

  const timeMs = clampInt(result.timeMs, 0, Number.MAX_SAFE_INTEGER, 0);
  const moves = clampInt(result.moves, 0, 999, 0);
  const stars = clampInt(result.stars, 0, 3, 0);
  const undos = clampInt(result.undos, 0, 9999, 0);

  const betterTime = existing.bestTimeMs === 0 || (timeMs > 0 && timeMs < existing.bestTimeMs);
  const betterStars = stars > existing.stars;

  current.records[id] = {
    cleared: true,
    stars: Math.max(existing.stars, stars),
    bestTimeMs: betterTime ? timeMs : existing.bestTimeMs,
    bestMoves: existing.bestMoves === 0 ? moves : Math.min(existing.bestMoves, moves || existing.bestMoves),
    undos: betterStars || betterTime ? undos : existing.undos,
    recordedAt: Date.now(),
  };

  if (id >= current.unlockedLevel && id < TOTAL_LEVELS) {
    current.unlockedLevel = id + 1;
  }
  current.lastLevelId = id;
  return saveStorage(current);
}

export function setLastLevel(levelId) {
  const current = loadStorage();
  current.lastLevelId = clampInt(levelId, 1, TOTAL_LEVELS, 1);
  if (current.lastLevelId > current.unlockedLevel) current.unlockedLevel = current.lastLevelId;
  return saveStorage(current);
}

export function setSoundEnabled(enabled) {
  const current = loadStorage();
  current.sound = Boolean(enabled);
  return saveStorage(current);
}

/** 测试专用：清空内存后端，避免跨用例污染 */
export function resetStorageForTests() {
  memoryBackend = null;
}

/** 测试专用：直接注入原始 JSON 字符串 */
export function writeRawForTests(value) {
  try {
    backend().setItem(STORAGE_KEY, value);
  } catch (err) {
    // ignore
  }
}
