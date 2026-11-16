// 推币机 · 存档唯一口径（key: doin.coin-pusher.v1）
// localStorage 不可用或数据损坏时静默降级内存，读取数据严格归一化。
//
// 无尽机台没有关卡进度与星级，只记「最好成绩」与「上次选的初始币数」。

import { CREDIT_OPTIONS, DEFAULT_CREDITS } from "./engine.mjs";

export const STORAGE_KEY = "doin.coin-pusher.v1";

let backend;

function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("__probe__", "1");
      localStorage.removeItem("__probe__");
      backend = localStorage;
      return backend;
    }
  } catch {
    /* 隐私模式或存储被禁用，静默降级 */
  }
  const map = new Map();
  backend = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
  return backend;
}

export function defaultSave() {
  return {
    sound: true,
    bestScore: 0,
    bestCascade: 0,
    bestDrops: 0,
    runs: 0,
    lastCredits: DEFAULT_CREDITS
  };
}

function normalizeCount(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

// 初始币数只接受白名单取值，其余一律回落到默认值（防手改存档塞入异常数字）
function normalizeCredits(raw) {
  const n = Math.floor(Number(raw));
  return CREDIT_OPTIONS.includes(n) ? n : DEFAULT_CREDITS;
}

export function normalize(raw) {
  const out = defaultSave();
  if (!raw || typeof raw !== "object") return out;
  if (typeof raw.sound === "boolean") out.sound = raw.sound;
  out.bestScore = normalizeCount(raw.bestScore);
  out.bestCascade = normalizeCount(raw.bestCascade);
  out.bestDrops = normalizeCount(raw.bestDrops);
  out.runs = normalizeCount(raw.runs);
  out.lastCredits = normalizeCredits(raw.lastCredits);
  return out;
}

export function loadSave() {
  try {
    const raw = storage().getItem(STORAGE_KEY);
    if (!raw) return defaultSave();
    return normalize(JSON.parse(raw));
  } catch {
    return defaultSave();
  }
}

export function saveSave(save) {
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(normalize(save)));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    storage().removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
