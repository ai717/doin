// filepath: games/bubble-bloom/js/storage.mjs

// 存档唯一口径：所有 localStorage 读写集中在本模块。

import { TIER_COUNT } from "./engine.mjs?v=79c518024932";

export const STORAGE_KEY = "doin.bubble-bloom.v1";
export const DATA_VERSION = 1;

const memory = new Map();
const memoryStore = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => {
    memory.set(key, String(value));
  },
  removeItem: (key) => {
    memory.delete(key);
  }
};

let usingMemory = false;
let forcedStore = null;

export function setStore(store) {
  forcedStore = store || null;
}

export function isUsingMemory() {
  return usingMemory;
}

function resolveStore() {
  if (forcedStore) return forcedStore;
  try {
    const store = typeof localStorage === "undefined" ? null : localStorage;
    if (store) {
      usingMemory = false;
      return store;
    }
  } catch (error) {
    /* 隐私模式等场景下 localStorage 访问直接抛错 */
  }
  usingMemory = true;
  return memoryStore;
}

function int(value, fallback, min, max) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function bool(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function codexOf(value) {
  const list = [];
  for (let i = 0; i < TIER_COUNT; i += 1) {
    list.push(Array.isArray(value) ? bool(value[i], false) : false);
  }
  return list;
}

export function defaultData() {
  return {
    version: DATA_VERSION,
    sound: true,
    best: { score: 0, tier: 0, chain: 0, drops: 0 },
    daily: { date: "", score: 0, tier: 0, chain: 0, drops: 0 },
    codex: codexOf(null),
    badges: { chain3: false, king: false, bloom: false }
  };
}

function entryOf(value) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    score: int(raw.score, 0, 0, 99999999),
    tier: int(raw.tier, 0, 0, TIER_COUNT),
    chain: int(raw.chain, 0, 0, 9999),
    drops: int(raw.drops, 0, 0, 999999)
  };
}

export function normalize(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaultData();
  const base = defaultData();
  const dailyRaw = raw.daily && typeof raw.daily === "object" ? raw.daily : {};
  const badgesRaw = raw.badges && typeof raw.badges === "object" ? raw.badges : {};
  return {
    version: DATA_VERSION,
    sound: bool(raw.sound, base.sound),
    best: entryOf(raw.best),
    daily: Object.assign(entryOf(dailyRaw), {
      date: typeof dailyRaw.date === "string" ? dailyRaw.date.slice(0, 10) : ""
    }),
    codex: codexOf(raw.codex),
    badges: {
      chain3: bool(badgesRaw.chain3, false),
      king: bool(badgesRaw.king, false),
      bloom: bool(badgesRaw.bloom, false)
    }
  };
}

export function loadData() {
  try {
    const store = resolveStore();
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    return normalize(JSON.parse(raw));
  } catch (error) {
    return defaultData();
  }
}

export function saveData(data) {
  const clean = normalize(data);
  try {
    const store = resolveStore();
    store.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch (error) {
    /* 配额或隐私模式：静默降级为内存存档 */
  }
  return clean;
}

export function unlockTier(data, tier) {
  const clean = normalize(data);
  const value = Math.round(Number(tier));
  if (!Number.isFinite(value) || value < 1 || value > TIER_COUNT) return { data: clean, changed: false };
  const index = value - 1;
  if (clean.codex[index]) return { data: clean, changed: false };
  clean.codex[index] = true;
  return { data: clean, changed: true };
}

export function setSound(data, on) {
  const clean = normalize(data);
  clean.sound = bool(on, true);
  return clean;
}

// run: { mode, date, score, tier, chain, drops, bloomed }
export function recordRun(data, run) {
  const clean = normalize(data);
  const source = run && typeof run === "object" ? run : {};
  const entry = {
    score: int(source.score, 0, 0, 99999999),
    tier: int(source.tier, 0, 0, TIER_COUNT),
    chain: int(source.chain, 0, 0, 9999),
    drops: int(source.drops, 0, 0, 999999)
  };

  if (source.mode === "daily") {
    const date = typeof source.date === "string" ? source.date.slice(0, 10) : "";
    if (clean.daily.date !== date) {
      clean.daily = Object.assign({ date }, entry);
      return { data: clean, isRecord: true };
    }
    const isRecord = entry.score > clean.daily.score;
    if (isRecord) {
      clean.daily = Object.assign({ date }, entry);
    } else {
      clean.daily.tier = Math.max(clean.daily.tier, entry.tier);
      clean.daily.chain = Math.max(clean.daily.chain, entry.chain);
    }
    return { data: clean, isRecord };
  }

  const isRecord = entry.score > clean.best.score;
  if (isRecord) {
    clean.best = Object.assign({}, entry);
  } else {
    clean.best.tier = Math.max(clean.best.tier, entry.tier);
    clean.best.chain = Math.max(clean.best.chain, entry.chain);
  }
  return { data: clean, isRecord };
}
