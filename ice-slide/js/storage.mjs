// filepath: games/ice-slide/js/storage.mjs
// 唯一本地持久化封装。所有读写都在 try/catch 内；损坏/缺失/不可用时回退内存默认值。
// 存档 key：doin.ice-slide.v1（语言偏好是全站共享的 doin.lang，不放在这里）。
// 记录口径：每关 { cleared, stars, bestMoves }（stars 取最大、bestMoves 取最小）；
// 每日一局 { date, done, moves }（当日只此一局、错过不补，跨日期自动重置）。

import { LEVELS } from "./levels.mjs";
import { MAX_STARS } from "./score.mjs";

export const STORAGE_KEY = "doin.ice-slide.v1";
const VERSION = 1;

const KNOWN_IDS = new Set(LEVELS.map((level) => level.id));

function defaults() {
  return {
    version: VERSION,
    unlocked: 1,
    current: 0,
    muted: false,
    levels: {},
    daily: { date: null, done: false, moves: 0 },
  };
}

function toInt(value, fallback, min, max) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  const rounded = Math.floor(num);
  return Math.min(max, Math.max(min, rounded));
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const cleared = raw.cleared === true;
  if (!cleared) return null;
  const stars = toInt(raw.stars, 1, 1, MAX_STARS);
  const bestMoves = toInt(raw.bestMoves, 0, 0, 100000);
  return { cleared: true, stars, bestMoves };
}

/** 严格清洗：未知字段丢弃、数值越界钳制、非法类型回落默认 */
export function normalize(raw) {
  const base = defaults();
  if (!raw || typeof raw !== "object") return base;

  const unlocked = toInt(raw.unlocked, 1, 1, LEVELS.length);
  const current = toInt(raw.current, 0, 0, LEVELS.length - 1);
  const levels = {};
  if (raw.levels && typeof raw.levels === "object") {
    for (const id of Object.keys(raw.levels)) {
      if (!KNOWN_IDS.has(id)) continue;
      const entry = normalizeEntry(raw.levels[id]);
      if (entry) levels[id] = entry;
    }
  }
  const daily =
    raw.daily && typeof raw.daily === "object"
      ? {
          date: typeof raw.daily.date === "string" ? raw.daily.date.slice(0, 10) : null,
          done: raw.daily.done === true,
          moves: toInt(raw.daily.moves, 0, 0, 100000),
        }
      : base.daily;

  // 解锁进度不得落后于"已通关的最大关"+1，也不得越界
  let derived = unlocked;
  for (let i = 0; i < LEVELS.length; i++) {
    if (levels[LEVELS[i].id]?.cleared) derived = Math.max(derived, Math.min(LEVELS.length, i + 2));
  }
  derived = Math.min(LEVELS.length, Math.max(1, derived));

  return {
    version: VERSION,
    unlocked: derived,
    current: Math.min(current, derived - 1),
    muted: raw.muted === true,
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
    if (!raw) return normalize(memory);
    const parsed = JSON.parse(raw);
    memory = normalize(parsed);
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

/** 记录一次通关，只在更优时覆盖纪录；返回是否刷新纪录 */
export function recordResult(levelId, { moves, stars }) {
  const data = normalize(memory);
  if (!KNOWN_IDS.has(levelId)) return { data, isNewBest: false };
  const safeMoves = toInt(moves, 0, 0, 100000);
  const safeStars = toInt(stars, 1, 1, MAX_STARS);

  const prev = data.levels[levelId];
  const isNewBest = !prev || !prev.cleared || safeMoves < prev.bestMoves || safeStars > prev.stars;
  data.levels[levelId] = {
    cleared: true,
    stars: Math.max(safeStars, prev?.stars ?? 0),
    bestMoves: prev?.cleared ? Math.min(safeMoves, prev.bestMoves) : safeMoves,
  };

  const index = LEVELS.findIndex((level) => level.id === levelId);
  if (index >= 0) data.unlocked = Math.min(LEVELS.length, Math.max(data.unlocked, index + 2));

  save(data);
  return { data: memory, isNewBest };
}

/** 每日一局完成记录（跨日期自动作废，当日只此一局、错过不补） */
export function recordDaily(dateKey, moves) {
  const data = normalize(memory);
  if (data.daily.date === dateKey && data.daily.done) return { data, isNew: false }; // 当日已做
  data.daily = { date: dateKey, done: true, moves: toInt(moves, 0, 0, 100000) };
  save(data);
  return { data: memory, isNew: true };
}

/** 当日每日一局是否已完成 */
export function isDailyDone(dateKey) {
  const data = normalize(memory);
  return data.daily.date === dateKey && data.daily.done;
}

export function setMuted(muted) {
  const data = normalize(memory);
  data.muted = muted === true;
  save(data);
  return memory;
}

export function setCurrent(index) {
  const data = normalize(memory);
  data.current = toInt(index, 0, 0, data.unlocked - 1);
  save(data);
  return memory;
}

export function isUnlocked(index) {
  const data = normalize(memory);
  return index >= 0 && index < data.unlocked;
}

export function reset() {
  memory = defaults();
  save(memory);
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
