// 存档唯一口径：doin.idiom.v1，读取必归一化，localStorage 不可用时静默降级内存。
import { BOARDS, LEVELS_PER_BOARD } from "./boards.mjs";

export const STORAGE_KEY = "doin.idiom.v1";
export const VERSION = 1;

const LANGS = ["zh", "en"];
const BOARD_IDS = BOARDS.map((board) => board.id);

let backend;

function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("__idiom_probe__", "1");
      localStorage.removeItem("__idiom_probe__");
      backend = localStorage;
      return backend;
    }
  } catch {
    // 隐私模式或存储受限：静默降级到内存。
  }
  const map = new Map();
  backend = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
  return backend;
}

export function defaultProgress() {
  const boards = {};
  for (const lang of LANGS) {
    boards[lang] = {};
    for (const boardId of BOARD_IDS) boards[lang][boardId] = { levels: {}, atlas: {} };
  }
  return {
    version: VERSION,
    current: {
      zh: { boardId: BOARD_IDS[0], levelIndex: 0 },
      en: { boardId: BOARD_IDS[0], levelIndex: 0 },
    },
    boards,
  };
}

function clampInt(value, lo, hi, fallback = lo) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(number)));
}

function normalizeLevels(raw) {
  const levels = {};
  if (!raw || typeof raw !== "object") return levels;
  for (let index = 0; index < LEVELS_PER_BOARD; index += 1) {
    const record = raw[String(index)] ?? raw[index];
    if (!record || typeof record !== "object") continue;
    const stars = clampInt(record.stars, 0, 3, 0);
    if (stars <= 0) continue;
    const ms = Number(record.ms);
    levels[String(index)] = {
      stars,
      hintsUsed: clampInt(record.hintsUsed, 0, 3, 0),
      ms: Number.isFinite(ms) && ms >= 0 ? Math.round(ms) : 0,
      clearedAt: Number.isFinite(Number(record.clearedAt)) ? Math.round(Number(record.clearedAt)) : 0,
    };
  }
  return levels;
}

function normalizeAtlas(raw) {
  const atlas = {};
  if (!raw || typeof raw !== "object") return atlas;
  for (const [id, value] of Object.entries(raw)) {
    if (value && typeof id === "string" && id.length > 0 && id.length < 64) atlas[id] = true;
  }
  return atlas;
}

export function normalize(raw) {
  const base = defaultProgress();
  if (!raw || typeof raw !== "object") return base;
  for (const lang of LANGS) {
    const source = raw.boards?.[lang];
    if (!source || typeof source !== "object") continue;
    for (const boardId of BOARD_IDS) {
      const entry = source[boardId];
      if (!entry || typeof entry !== "object") continue;
      base.boards[lang][boardId] = {
        levels: normalizeLevels(entry.levels),
        atlas: normalizeAtlas(entry.atlas),
      };
    }
    const current = raw.current?.[lang];
    if (current && BOARD_IDS.includes(current.boardId)) {
      base.current[lang] = {
        boardId: current.boardId,
        levelIndex: clampInt(current.levelIndex, 0, LEVELS_PER_BOARD - 1, 0),
      };
    }
  }
  return base;
}

export function load() {
  try {
    const raw = storage().getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    return normalize(JSON.parse(raw));
  } catch {
    return defaultProgress();
  }
}

export function save(progress) {
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(normalize(progress)));
    return true;
  } catch {
    return false;
  }
}

export function remember(progress, lang, boardId, levelIndex) {
  if (!LANGS.includes(lang) || !BOARD_IDS.includes(boardId)) return progress;
  progress.current[lang] = {
    boardId,
    levelIndex: clampInt(levelIndex, 0, LEVELS_PER_BOARD - 1, 0),
  };
  return progress;
}

export function recordClear(progress, { lang, boardId, levelIndex, stars, hintsUsed, ms, entries = [] }) {
  if (!LANGS.includes(lang) || !BOARD_IDS.includes(boardId)) return progress;
  const index = clampInt(levelIndex, 0, LEVELS_PER_BOARD - 1, 0);
  const bucket = progress.boards[lang][boardId];
  const key = String(index);
  const previous = bucket.levels[key];
  const nextStars = clampInt(stars, 0, 3, 0);
  const nextMs = Number.isFinite(Number(ms)) && Number(ms) >= 0 ? Math.round(Number(ms)) : 0;
  bucket.levels[key] = {
    stars: Math.max(previous?.stars ?? 0, nextStars),
    hintsUsed: previous ? Math.min(previous.hintsUsed, clampInt(hintsUsed, 0, 3, 0)) : clampInt(hintsUsed, 0, 3, 0),
    ms: previous && previous.ms > 0 ? Math.min(previous.ms, nextMs) : nextMs,
    clearedAt: Date.now(),
  };
  for (const id of entries) {
    if (typeof id === "string" && id.length > 0 && id.length < 64) bucket.atlas[id] = true;
  }
  return progress;
}

export function unlockCard(progress, lang, boardId, entryId) {
  if (!LANGS.includes(lang) || !BOARD_IDS.includes(boardId)) return progress;
  if (typeof entryId !== "string" || !entryId || entryId.length >= 64) return progress;
  progress.boards[lang][boardId].atlas[entryId] = true;
  return progress;
}

export function levelRecord(progress, lang, boardId, levelIndex) {
  return progress?.boards?.[lang]?.[boardId]?.levels?.[String(levelIndex)] ?? null;
}

export function hasCard(progress, lang, boardId, entryId) {
  return Boolean(progress?.boards?.[lang]?.[boardId]?.atlas?.[entryId]);
}

export function resetBackendForTests() {
  backend = undefined;
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略受限环境。
  }
}
