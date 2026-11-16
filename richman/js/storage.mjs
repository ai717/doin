// 存档唯一口径：doin.richman.v1 是本作战绩，doin.lang 是全站共享语言偏好。
// localStorage 不可用时静默降级内存后端，读取必须归一化，绝不抛错、绝不白屏。

export const STORAGE_KEY = "doin.richman.v1";
export const LANG_KEY = "doin.lang";
export const SAVE_VERSION = 1;

export const MODES = ["quick", "duo", "2p"];
export const AI_LEVELS = ["novice", "skilled", "master"];
export const WINS_FOR_SKILLED = 1;
export const WINS_FOR_MASTER = 3;

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
      localStorage.setItem("__richman_probe__", "1");
      localStorage.removeItem("__richman_probe__");
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
  return { version: SAVE_VERSION, wins: 0, losses: 0, lastMode: "quick", lastAi: "novice" };
}

function clampCount(value, fallback = 0) {
  const num = Math.round(Number(value));
  if (!Number.isFinite(num) || num < 0 || num > 99999) return fallback;
  return num;
}

/** 读取必须归一化：坏字段逐项丢弃而不是让整份存档失效。 */
export function normalizeProgress(raw) {
  const base = emptyProgress();
  if (!raw || typeof raw !== "object") return base;
  if (raw.version !== SAVE_VERSION) return base;
  return {
    version: SAVE_VERSION,
    wins: clampCount(raw.wins),
    losses: clampCount(raw.losses),
    lastMode: MODES.includes(raw.lastMode) ? raw.lastMode : "quick",
    lastAi: AI_LEVELS.includes(raw.lastAi) ? raw.lastAi : "novice",
  };
}

export function loadProgress() {
  return normalizeProgress(readJson(STORAGE_KEY));
}

export function saveProgress(progress) {
  return writeJson(STORAGE_KEY, normalizeProgress(progress));
}

export function recordMatchResult(progress, won) {
  const next = normalizeProgress(progress);
  if (won === true) next.wins += 1;
  else if (won === false) next.losses += 1;
  return next;
}

/** AI 阶梯解锁：胜 1 场解锁进阶，胜 3 场解锁大师。 */
export function aiUnlocked(progress, level) {
  const wins = progress?.wins ?? 0;
  if (level === "novice") return true;
  if (level === "skilled") return wins >= WINS_FOR_SKILLED;
  if (level === "master") return wins >= WINS_FOR_MASTER;
  return false;
}

export function loadSound() {
  const raw = readJson("doin.richman.sound");
  if (typeof raw === "boolean") return raw;
  if (raw && typeof raw === "object" && typeof raw.on === "boolean") return raw.on;
  return true;
}

export function saveSound(on) {
  return writeJson("doin.richman.sound", Boolean(on));
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
