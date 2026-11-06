/**
 * Immortal Box (摸鱼开箱修仙传) - Storage Manager
 * Unified key: doin.immortal.v1
 * Memory fallback on failure, data normalization.
 */

const STORAGE_KEY = 'doin.immortal.v1';

let memoryFallback = null;

export function normalizeStorage(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      realmId: 1,
      exp: 0,
      spiritStones: 200,
      cauldronStones: 50,
      cauldronLevel: 1,
      equipment: {},
      highestAbyssFloor: 0,
      lastSaveTime: Date.now(),
      soundEnabled: true,
      autoSettings: {
        minQuality: 'rare',
        stopOnUpgrade: true
      }
    };
  }

  const realmId = typeof raw.realmId === 'number' && raw.realmId >= 1 ? Math.min(21, Math.floor(raw.realmId)) : 1;
  const exp = typeof raw.exp === 'number' && raw.exp >= 0 ? raw.exp : 0;
  const spiritStones = typeof raw.spiritStones === 'number' && raw.spiritStones >= 0 ? raw.spiritStones : 200;
  const cauldronStones = typeof raw.cauldronStones === 'number' && raw.cauldronStones >= 0 ? raw.cauldronStones : 50;
  const cauldronLevel = typeof raw.cauldronLevel === 'number' && raw.cauldronLevel >= 1 ? Math.min(15, Math.floor(raw.cauldronLevel)) : 1;
  const highestAbyssFloor = typeof raw.highestAbyssFloor === 'number' && raw.highestAbyssFloor >= 0 ? Math.floor(raw.highestAbyssFloor) : 0;
  const lastSaveTime = typeof raw.lastSaveTime === 'number' && raw.lastSaveTime > 0 ? raw.lastSaveTime : Date.now();
  const soundEnabled = raw.soundEnabled !== false;

  const equipment = {};
  if (raw.equipment && typeof raw.equipment === 'object') {
    for (const [slot, item] of Object.entries(raw.equipment)) {
      if (item && typeof item === 'object' && item.uid) {
        equipment[slot] = item;
      }
    }
  }

  const autoSettings = {
    minQuality: raw.autoSettings?.minQuality || 'rare',
    stopOnUpgrade: raw.autoSettings?.stopOnUpgrade !== false
  };

  return {
    realmId,
    exp,
    spiritStones,
    cauldronStones,
    cauldronLevel,
    equipment,
    highestAbyssFloor,
    lastSaveTime,
    soundEnabled,
    autoSettings
  };
}

export function loadGameData() {
  try {
    const rawStr = localStorage.getItem(STORAGE_KEY);
    if (!rawStr) {
      return memoryFallback ? normalizeStorage(memoryFallback) : normalizeStorage(null);
    }
    const parsed = JSON.parse(rawStr);
    return normalizeStorage(parsed);
  } catch (_e) {
    return memoryFallback ? normalizeStorage(memoryFallback) : normalizeStorage(null);
  }
}

export function saveGameData(data) {
  const normalized = normalizeStorage(data);
  normalized.lastSaveTime = Date.now();
  memoryFallback = normalized;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch (_e) {
    // Retain in memory silently
  }
  return normalized;
}
