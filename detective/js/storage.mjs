// 存档唯一口径：doin.detective.v1 是本作私有进度，doin.lang 是全站共享语言偏好。
// localStorage 不可用（隐私模式 / 内嵌受限）时静默降级为内存后端，绝不抛错、绝不白屏。

import { CASES } from "./cases.mjs";
import { betterRecord } from "./score.mjs";

export const STORAGE_KEY = "doin.detective.v1";
export const LANG_KEY = "doin.lang";
export const SAVE_VERSION = 1;
export const MAX_CASE_ID = CASES.length;

let backend = null;

function memoryBackend() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

function store() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined" && localStorage) {
      localStorage.setItem("__detective_probe__", "1");
      localStorage.removeItem("__detective_probe__");
      backend = localStorage;
      return backend;
    }
  } catch {
    // 隐私模式或存储受限：走内存后端。
  }
  backend = memoryBackend();
  return backend;
}

export function resetBackendForTests() {
  backend = null;
}

function readJson(key) {
  try {
    const raw = store().getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    store().setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function emptyProgress() {
  return { version: SAVE_VERSION, cases: {}, lastCase: 1 };
}

function clampCaseId(value) {
  const id = Math.round(Number(value));
  if (!Number.isFinite(id) || id < 1) return 1;
  return Math.min(id, MAX_CASE_ID);
}

function normalizeRecord(raw) {
  if (!raw || typeof raw !== "object") return null;
  const timeMs = Math.round(Number(raw.timeMs));
  const mistakes = Math.round(Number(raw.mistakes));
  const stars = Math.round(Number(raw.stars));
  if (!Number.isFinite(timeMs) || timeMs < 0 || timeMs > 24 * 3600 * 1000) return null;
  if (!Number.isFinite(mistakes) || mistakes < 0 || mistakes > 99) return null;
  if (!Number.isFinite(stars) || stars < 1 || stars > 3) return null;
  return { timeMs, mistakes, stars };
}

/** 读取必须归一化：坏数据丢弃而不是让整份存档失效。 */
export function normalizeProgress(raw) {
  const base = emptyProgress();
  if (!raw || typeof raw !== "object") return base;
  if (raw.version !== SAVE_VERSION) return base;
  const cases = {};
  if (raw.cases && typeof raw.cases === "object") {
    for (const [key, value] of Object.entries(raw.cases)) {
      const id = Number(key);
      if (!Number.isFinite(id) || id < 1 || id > MAX_CASE_ID) continue;
      const record = normalizeRecord(value);
      if (record) cases[id] = record;
    }
  }
  return { version: SAVE_VERSION, cases, lastCase: clampCaseId(raw.lastCase) };
}

export function loadProgress() {
  return normalizeProgress(readJson(STORAGE_KEY));
}

export function saveProgress(progress) {
  return writeJson(STORAGE_KEY, normalizeProgress(progress));
}

export function recordCase(progress, id, record) {
  const next = normalizeProgress(progress);
  const key = clampCaseId(id);
  const clean = normalizeRecord(record);
  if (!clean) return next;
  next.cases[key] = betterRecord(next.cases[key], clean);
  next.lastCase = key;
  return next;
}

export function loadLastCase() {
  return loadProgress().lastCase;
}

export function saveLastCase(id) {
  const progress = loadProgress();
  progress.lastCase = clampCaseId(id);
  return saveProgress(progress);
}

export function loadSound() {
  const raw = readJson("doin.detective.sound");
  if (typeof raw === "boolean") return raw;
  if (raw && typeof raw === "object" && typeof raw.on === "boolean") return raw.on;
  return true;
}

export function saveSound(on) {
  return writeJson("doin.detective.sound", Boolean(on));
}

/** 全站共享语言偏好，键名固定 doin.lang（check-game 硬门禁）。 */
export function loadLocale() {
  try {
    const raw = store().getItem(LANG_KEY);
    return raw === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

export function saveLocale(locale) {
  try {
    store().setItem(LANG_KEY, locale === "en" ? "en" : "zh");
    return true;
  } catch {
    return false;
  }
}
