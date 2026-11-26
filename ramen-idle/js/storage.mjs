// storage.mjs — 存档唯一口径，集中 try/catch，损坏数据自动归一化，支持内存降级
import { createInitialState, STATION_IDS, WORKER_DEFS, RECIPE_IDS, GUEST_IDS } from "./engine.mjs";

export const STORAGE_KEY = "doin.ramen-idle.v1";

let memoryBackend = null;

export function resetBackendForTests() {
  memoryBackend = null;
}

function getStorage() {
  if (memoryBackend !== null) return memoryBackend;
  try {
    if (typeof localStorage !== "undefined") {
      const testKey = "__ramen_storage_probe__";
      localStorage.setItem(testKey, "1");
      localStorage.removeItem(testKey);
      return localStorage;
    }
  } catch {
    // 隐私模式或无权限
  }
  memoryBackend = {
    _map: new Map(),
    getItem(k) {
      return this._map.get(k) ?? null;
    },
    setItem(k, v) {
      this._map.set(k, String(v));
    },
    removeItem(k) {
      this._map.delete(k);
    },
    clear() {
      this._map.clear();
    },
  };
  return memoryBackend;
}

/**
 * 严格数据归一化
 */
export function normalize(raw) {
  const base = createInitialState();
  if (!raw || typeof raw !== "object") return base;

  const coins = typeof raw.coins === "number" && !isNaN(raw.coins) && raw.coins >= 0 ? Math.floor(raw.coins) : base.coins;
  const totalCoinsEarned = typeof raw.totalCoinsEarned === "number" && !isNaN(raw.totalCoinsEarned) && raw.totalCoinsEarned >= coins ? Math.floor(raw.totalCoinsEarned) : Math.max(coins, base.totalCoinsEarned);
  const bowlsServed = typeof raw.bowlsServed === "number" && !isNaN(raw.bowlsServed) && raw.bowlsServed >= 0 ? Math.floor(raw.bowlsServed) : 0;

  const stations = { ...base.stations };
  if (raw.stations && typeof raw.stations === "object") {
    for (const sid of STATION_IDS) {
      if (raw.stations[sid] && typeof raw.stations[sid].level === "number" && raw.stations[sid].level >= 0) {
        stations[sid] = { level: Math.floor(raw.stations[sid].level) };
      }
    }
  }

  const workers = { ...base.workers };
  if (raw.workers && typeof raw.workers === "object") {
    for (const wid of Object.keys(WORKER_DEFS)) {
      if (raw.workers[wid] && typeof raw.workers[wid].level === "number" && raw.workers[wid].level >= 0) {
        workers[wid] = { level: Math.floor(raw.workers[wid].level) };
      }
    }
  }

  const recipes = Array.isArray(raw.recipes)
    ? [...new Set(raw.recipes.filter((r) => RECIPE_IDS.includes(r)))]
    : ["recipe_shoyu"];
  if (recipes.length === 0) recipes.push("recipe_shoyu");

  const activeRecipe = RECIPE_IDS.includes(raw.activeRecipe) && recipes.includes(raw.activeRecipe) ? raw.activeRecipe : recipes[0];

  const shopTier = typeof raw.shopTier === "number" && raw.shopTier >= 0 && raw.shopTier <= 4 ? Math.floor(raw.shopTier) : 0;

  const guests = Array.isArray(raw.guests)
    ? [...new Set(raw.guests.filter((g) => GUEST_IDS.includes(g)))]
    : [];

  const upgrades = {
    lanterns_lit: Boolean(raw.upgrades?.lanterns_lit),
  };

  const prestigeCount = typeof raw.prestigeCount === "number" && raw.prestigeCount >= 0 ? Math.floor(raw.prestigeCount) : 0;
  const prestigeMultiplier = typeof raw.prestigeMultiplier === "number" && raw.prestigeMultiplier >= 1.0 ? raw.prestigeMultiplier : 1.0;

  const nightNumber = typeof raw.nightNumber === "number" && raw.nightNumber >= 1 ? Math.floor(raw.nightNumber) : 1;
  const shiftIndex = typeof raw.shiftIndex === "number" && raw.shiftIndex >= 0 && raw.shiftIndex <= 4 ? Math.floor(raw.shiftIndex) : 0;
  const shiftElapsedSeconds = typeof raw.shiftElapsedSeconds === "number" && raw.shiftElapsedSeconds >= 0 ? raw.shiftElapsedSeconds : 0;

  const lastSaveTime = typeof raw.lastSaveTime === "number" && raw.lastSaveTime > 0 ? raw.lastSaveTime : Date.now();

  return {
    coins,
    totalCoinsEarned,
    bowlsServed,
    stations,
    workers,
    recipes,
    activeRecipe,
    shopTier,
    guests,
    upgrades,
    prestigeCount,
    prestigeMultiplier,
    nightNumber,
    shiftIndex,
    shiftElapsedSeconds,
    shiftDurationSeconds: 60,
    rushRushActive: false,
    rushRemainingSeconds: 0,
    lastSaveTime,
  };
}

export function load() {
  const store = getStorage();
  try {
    const rawStr = store.getItem(STORAGE_KEY);
    if (!rawStr) return createInitialState();
    const parsed = JSON.parse(rawStr);
    return normalize(parsed);
  } catch {
    return createInitialState();
  }
}

export function save(state) {
  const store = getStorage();
  try {
    const dataToSave = {
      ...state,
      lastSaveTime: Date.now(),
    };
    store.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    return dataToSave;
  } catch {
    // 降级静默忽略
    return state;
  }
}

export function clear() {
  const store = getStorage();
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    // 静默忽略
  }
}
