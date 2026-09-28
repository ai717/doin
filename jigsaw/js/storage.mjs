// filepath: games/jigsaw/js/storage.mjs
// 唯一本地持久化封装。所有读写都在 try/catch 内；损坏 / 缺失 / 不可用时回退内存默认值。
// 存档 key：doin.jigsaw.v1（语言偏好是全站共享的 doin.lang，不放在这里）
//
// 结构（PRD §4）：
//   { version, prefs:{ muted }, unlocked, current:{ levelId, state }, levels:{...}, daily:{ dateKey, bestScore } }
// 说明：`prefers-reduced-motion` 直接跟随系统媒体查询，不做用户偏好存档（避免出现没人读的死字段）。

import { LEVELS, LEVEL_COUNT, levelById } from "./levels.mjs";
import { PERFECT, DAILY_PERFECT } from "./score.mjs";
import { validateSnapshot, restore, isSolved, snapshot } from "./engine.mjs";

export const STORAGE_KEY = "doin.jigsaw.v1";
const VERSION = 1;
const MAX_MOVES = 100000;
const MAX_TIME_MS = 1000 * 60 * 60 * 24;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const KNOWN_IDS = new Set(LEVELS.map((level) => level.id));

function defaults() {
  return {
    version: VERSION,
    prefs: { muted: false },
    unlocked: 1,
    current: { levelId: LEVELS[0].id, state: null },
    levels: {},
    daily: { dateKey: "", bestScore: 0 },
  };
}

function toInt(value, fallback, min, max) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  const rounded = Math.floor(num);
  return Math.min(max, Math.max(min, rounded));
}

function normalizeLevelEntry(raw) {
  if (!raw || typeof raw !== "object" || raw.cleared !== true) return null;
  return {
    cleared: true,
    bestScore: toInt(raw.bestScore, 0, 0, PERFECT),
    bestMoves: toInt(raw.bestMoves, 0, 0, MAX_MOVES),
    bestTimeMs: toInt(raw.bestTimeMs, 0, 0, MAX_TIME_MS),
  };
}

/** 进行中进度：关卡合法 + 快照可还原 + 未拼完，否则丢弃（宁可从关卡开头重来，也不给坏局面） */
function normalizeCurrent(raw, unlocked) {
  const fallback = { levelId: LEVELS[0].id, state: null };
  if (!raw || typeof raw !== "object") return fallback;
  const level = levelById(raw.levelId);
  if (!level || level.index >= unlocked) return fallback;
  if (!validateSnapshot(level, raw.state)) return fallback;
  const restored = restore(level, raw.state);
  if (isSolved(restored)) return fallback;
  return { levelId: level.id, state: snapshot(restored) };
}

/** 严格清洗：未知字段丢弃、数值越界钳制、非法类型回落默认 */
export function normalize(raw) {
  const base = defaults();
  if (!raw || typeof raw !== "object") return base;

  const unlocked = toInt(raw.unlocked, 1, 1, LEVEL_COUNT);
  const levels = {};
  if (raw.levels && typeof raw.levels === "object") {
    for (const id of Object.keys(raw.levels)) {
      if (!KNOWN_IDS.has(id)) continue;
      const entry = normalizeLevelEntry(raw.levels[id]);
      if (entry) levels[id] = entry;
    }
  }

  // 解锁进度不得落后于"已通关的最大关 + 1"
  let derived = unlocked;
  for (let i = 0; i < LEVELS.length; i++) {
    if (levels[LEVELS[i].id]) derived = Math.max(derived, Math.min(LEVEL_COUNT, i + 2));
  }
  derived = Math.min(LEVEL_COUNT, Math.max(1, derived));

  let daily = { dateKey: "", bestScore: 0 };
  if (raw.daily && typeof raw.daily === "object" && DATE_PATTERN.test(raw.daily.dateKey ?? "")) {
    daily = {
      dateKey: raw.daily.dateKey,
      bestScore: toInt(raw.daily.bestScore, 0, 0, DAILY_PERFECT),
    };
  }

  return {
    version: VERSION,
    prefs: { muted: raw.prefs?.muted === true },
    unlocked: derived,
    current: normalizeCurrent(raw.current, derived),
    levels,
    daily,
  };
}

let memory = defaults();
let usable = true;

function backend() {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function load() {
  const store = backend();
  if (!store) {
    usable = false;
    return normalize(memory);
  }
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) {
      usable = true;
      return normalize(memory);
    }
    memory = normalize(JSON.parse(raw));
    usable = true;
    return memory;
  } catch {
    usable = false;
    return normalize(memory);
  }
}

export function save(data = memory) {
  memory = normalize(data);
  const store = backend();
  if (!store) {
    usable = false;
    return false;
  }
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(memory));
    usable = true;
    return true;
  } catch {
    usable = false;
    return false;
  }
}

export function isPersistent() {
  return usable;
}

export function current() {
  return memory;
}

/** 记录一次主线通关，只在更优时覆盖；返回是否刷新纪录 */
export function recordResult(levelId, { score, moves, timeMs }) {
  const data = normalize(memory);
  if (!KNOWN_IDS.has(levelId)) return { data, isNewBest: false };

  const total = toInt(score, 0, 0, PERFECT);
  const safeMoves = toInt(moves, 0, 0, MAX_MOVES);
  const safeTime = toInt(timeMs, 0, 0, MAX_TIME_MS);
  const prev = data.levels[levelId];
  const isNewBest = !prev || total > prev.bestScore;

  data.levels[levelId] = {
    cleared: true,
    bestScore: Math.max(total, prev?.bestScore ?? 0),
    bestMoves: prev ? Math.min(safeMoves, prev.bestMoves) : safeMoves,
    bestTimeMs: prev ? Math.min(safeTime, prev.bestTimeMs) : safeTime,
  };

  const index = LEVELS.findIndex((level) => level.id === levelId);
  if (index >= 0) data.unlocked = Math.min(LEVEL_COUNT, Math.max(data.unlocked, index + 2));

  data.current = { levelId: LEVELS[0].id, state: null };
  save(data);
  return { data: memory, isNewBest };
}

/** 记录今日精选成绩：只在同一天且更高分时覆盖 */
export function recordDaily(dateKeyValue, { score }) {
  const data = normalize(memory);
  if (!DATE_PATTERN.test(dateKeyValue ?? "")) return { data, isNewBest: false };
  const total = toInt(score, 0, 0, DAILY_PERFECT);
  const sameDay = data.daily.dateKey === dateKeyValue;
  const isNewBest = !sameDay || total > data.daily.bestScore;
  data.daily = {
    dateKey: dateKeyValue,
    bestScore: sameDay ? Math.max(total, data.daily.bestScore) : total,
  };
  save(data);
  return { data: memory, isNewBest };
}

/** 保存进行中局面；state 传 null 表示清空 */
export function setCurrent(levelId, state = null) {
  const data = normalize(memory);
  const level = levelById(levelId);
  data.current = level && validateSnapshot(level, state) ? { levelId, state } : { levelId: data.current.levelId, state: null };
  save(data);
  return memory;
}

export function setMuted(muted) {
  const data = normalize(memory);
  data.prefs.muted = muted === true;
  save(data);
  return memory;
}

export function isUnlocked(index) {
  const data = normalize(memory);
  return Number.isInteger(index) && index >= 0 && index < data.unlocked;
}

export function reset() {
  memory = defaults();
  const store = backend();
  if (store) {
    try {
      store.removeItem(STORAGE_KEY);
    } catch {
      usable = false;
    }
  }
  return memory;
}
