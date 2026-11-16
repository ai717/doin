// 魔塔：勇者登顶 · 存档唯一口径
//
// Key 统一 doin.magic-tower.v1；localStorage 不可用或数据损坏时静默降级内存，绝不白屏。
// 读取一律经过引擎归一化（fromSnapshot），坏字段回落到安全值。

import { fromSnapshot, toSnapshot } from "./engine.mjs";

export const STORAGE_KEY = "doin.magic-tower.v1";
export const SAVE_VERSION = 1;

let backend;
let memory = new Map();

function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("__mt_probe__", "1");
      localStorage.removeItem("__mt_probe__");
      backend = localStorage;
      return backend;
    }
  } catch {
    /* 隐私模式或存储受限：静默降级内存 */
  }
  const map = memory;
  backend = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  return backend;
}

// 单测入口：显式重置内存与探针，避免跨用例数据泄漏
export function resetBackendForTests() {
  backend = undefined;
  memory = new Map();
}

function readRaw() {
  try {
    const raw = storage().getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeRaw(data) {
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function emptyMeta() {
  return {
    version: SAVE_VERSION,
    sound: true,
    best: { damage: null, steps: null, clears: 0, trueEnding: false },
    save: null,
  };
}

export function normalizeMeta(raw) {
  const base = emptyMeta();
  if (!raw || typeof raw !== "object") return base;
  const best = raw.best && typeof raw.best === "object" ? raw.best : {};
  const num = (v) => (Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
  return {
    version: SAVE_VERSION,
    sound: raw.sound !== false,
    best: {
      damage: num(best.damage),
      steps: num(best.steps),
      clears: Math.max(0, Math.round(Number(best.clears) || 0)),
      trueEnding: Boolean(best.trueEnding),
    },
    save: raw.save && typeof raw.save === "object" ? raw.save : null,
  };
}

export function loadMeta() {
  return normalizeMeta(readRaw());
}

export function saveMeta(meta) {
  return writeRaw(normalizeMeta(meta));
}

export function loadRun(levels) {
  const meta = loadMeta();
  if (!meta.save) return null;
  const state = fromSnapshot(meta.save, levels);
  if (!state) return null;
  // 已终局的存档不再续玩，但仍可用于展示
  return state.status === "playing" ? state : null;
}

export function saveRun(state) {
  const meta = loadMeta();
  meta.save = toSnapshot(state);
  return saveMeta(meta);
}

export function clearRun() {
  const meta = loadMeta();
  meta.save = null;
  return saveMeta(meta);
}

// 结算：写入本机纪录（最少战损 / 最少步数），返回是否刷新纪录
export function recordClear(state) {
  const meta = loadMeta();
  const damage = Math.max(0, state.stats.damageTaken);
  const steps = Math.max(0, state.stats.steps);
  let improved = false;
  if (meta.best.damage === null || damage < meta.best.damage) {
    meta.best.damage = damage;
    improved = true;
  }
  if (meta.best.steps === null || steps < meta.best.steps) {
    meta.best.steps = steps;
    improved = true;
  }
  meta.best.clears += 1;
  if (state.ending === "true") meta.best.trueEnding = true;
  saveMeta(meta);
  return { improved, best: meta.best };
}

export function recordDefeat(state) {
  const meta = loadMeta();
  meta.best.clears += 0;
  saveMeta(meta);
  return meta.best;
}

export function loadSound() {
  return loadMeta().sound;
}

export function saveSound(on) {
  const meta = loadMeta();
  meta.sound = Boolean(on);
  return saveMeta(meta);
}

// 全站语言偏好（与其余子游戏共用同一个 key，严禁私有 key）
export function loadLocale() {
  try {
    const raw = storage().getItem("doin.lang");
    return raw === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

export function saveLocale(locale) {
  try {
    storage().setItem("doin.lang", locale === "en" ? "en" : "zh");
    return true;
  } catch {
    return false;
  }
}
