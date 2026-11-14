// storage.mjs — 存档唯一口径，集中 try/catch，损坏数据自动归一化，支持内存降级
import {
  createInitialState,
  STATION_IDS,
  CAT_IDS,
  WINDOW_IDS,
  DRINK_IDS,
  GUEST_IDS,
  REPUTATION_STAGES,
} from "./engine.mjs";

export const STORAGE_KEY = "doin.catcafe.v1";

let memoryBackend = null;

export function resetBackendForTests() {
  memoryBackend = null;
}

/**
 * 探测式获取 localStorage，失败降级到内存 Map
 */
function getStorage() {
  if (memoryBackend !== null) return memoryBackend;
  try {
    if (typeof localStorage !== "undefined") {
      const testKey = "__catcafe_storage_probe__";
      localStorage.setItem(testKey, "1");
      localStorage.removeItem(testKey);
      return localStorage;
    }
  } catch {
    // 隐私模式 / 跨域 / 无权限
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

function sanitizePositiveInt(value, fallback) {
  if (typeof value !== "number" || isNaN(value) || value < 0) return fallback;
  return Math.floor(value);
}

function sanitizeIntInRange(value, min, max, fallback) {
  if (typeof value !== "number" || isNaN(value)) return fallback;
  const n = Math.floor(value);
  if (n < min || n > max) return fallback;
  return n;
}

/**
 * 严格归一化：所有字段逐一校验 + 非法值降级默认值
 */
export function normalize(raw) {
  const base = createInitialState();
  if (!raw || typeof raw !== "object") return base;

  const coins = sanitizePositiveInt(raw.coins, base.coins);
  const totalCoinsEarned = sanitizePositiveInt(raw.totalCoinsEarned, Math.max(coins, base.totalCoinsEarned));
  const bowlsServed = sanitizePositiveInt(raw.bowlsServed, 0);
  const stars = sanitizePositiveInt(raw.stars, 0);
  const totalRevenue = sanitizePositiveInt(raw.totalRevenue, 0);
  const stage = sanitizeIntInRange(raw.stage, 0, REPUTATION_STAGES.length - 1, 0);
  const offlineVisits = sanitizePositiveInt(raw.offlineVisits, 0);

  // 工位（level 非法值 → 0，不沿用 base 的开局值 1，避免脏数据污染）
  const stations = {};
  for (const sid of STATION_IDS) {
    const rawStation = raw.stations && raw.stations[sid];
    if (rawStation && typeof rawStation === "object") {
      stations[sid] = {
        level: sanitizePositiveInt(rawStation.level, 0),
      };
    } else {
      stations[sid] = { ...base.stations[sid] };
    }
  }

  // 猫咪（unlocked 沿用 base 默认，level 非法 → 0，awakenUntilTick 非法 → 0）
  const cats = {};
  for (const cid of CAT_IDS) {
    const rawCat = raw.cats && raw.cats[cid];
    if (rawCat && typeof rawCat === "object") {
      cats[cid] = {
        unlocked: Boolean(rawCat.unlocked),
        level: sanitizePositiveInt(rawCat.level, 0),
        awakenUntilTick: sanitizePositiveInt(rawCat.awakenUntilTick, 0),
      };
    } else {
      cats[cid] = { ...base.cats[cid] };
    }
  }
  // 兜底：cat_orange 永远默认解锁（开局猫）
  if (!cats.cat_orange.unlocked) cats.cat_orange.unlocked = true;

  const activeCat = CAT_IDS.includes(raw.activeCat) && cats[raw.activeCat]?.unlocked
    ? raw.activeCat
    : (cats.cat_orange.unlocked ? "cat_orange" : CAT_IDS.find((cid) => cats[cid].unlocked) || "cat_orange");

  // 窗口（object：id → true）
  const windows = {};
  if (raw.windows && typeof raw.windows === "object") {
    for (const wid of WINDOW_IDS) {
      if (raw.windows[wid]) windows[wid] = true;
    }
  }

  // 饮品
  const drinks = Array.isArray(raw.drinks)
    ? [...new Set(raw.drinks.filter((d) => DRINK_IDS.includes(d)))]
    : ["drink_espresso"];
  if (drinks.length === 0) drinks.push("drink_espresso");

  const activeDrink = DRINK_IDS.includes(raw.activeDrink) && drinks.includes(raw.activeDrink)
    ? raw.activeDrink
    : drinks[0];

  // 常客
  const guests = Array.isArray(raw.guests)
    ? [...new Set(raw.guests.filter((g) => GUEST_IDS.includes(g)))]
    : [];

  // PRNG seed
  const rngSeed = typeof raw.rngSeed === "number" && raw.rngSeed > 0
    ? Math.floor(raw.rngSeed)
    : base.rngSeed;

  // 最后保存时间戳
  const lastSaveTime = typeof raw.lastSaveTime === "number" && raw.lastSaveTime > 0
    ? raw.lastSaveTime
    : Date.now();

  return {
    coins,
    totalCoinsEarned,
    bowlsServed,
    stars,
    totalRevenue,
    stage,
    stations,
    cats,
    activeCat,
    windows,
    drinks,
    activeDrink,
    guests,
    offlineVisits,
    rngSeed,
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