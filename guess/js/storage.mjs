// storage.mjs —— 存档唯一口径 doin.guess.v1：集中 try/catch，损坏自动 normalize 退回默认，静默降级内存

import { LEVEL_COUNT, MAIN_COUNT, levelById } from "./levels.mjs";
import { STAR_MAX } from "./score.mjs";
import { clampInt } from "./engine.mjs";

export const KEY = "doin.guess.v1";
export const VERSION = 1;

export function defaults() {
  return {
    v: VERSION,
    muted: false,
    last: 1,
    levels: {},
    records: { fewest: 0, aces: 0 },
  };
}

function normalizeLevels(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (let id = 1; id <= LEVEL_COUNT; id += 1) {
    const rec = raw[id] ?? raw[String(id)];
    if (!rec || typeof rec !== "object") continue;
    const lvl = levelById(id);
    if (!lvl) continue;
    const stars = clampInt(rec.stars, 0, STAR_MAX, 0);
    const fewest = clampInt(rec.fewest, 0, lvl.budget, 0);
    out[id] = {
      stars,
      cleared: rec.cleared === true || stars > 0,
      fewest: fewest > 0 ? Math.min(fewest, lvl.budget) : 0,
    };
  }
  return out;
}

/** 任何输入都归一化成合法存档，绝不抛错 */
export function normalize(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    v: VERSION,
    muted: src.muted === true,
    last: clampInt(src.last, 1, LEVEL_COUNT, 1),
    levels: normalizeLevels(src.levels),
    records: {
      fewest: clampInt(src.records?.fewest, 0, 9999, 0),
      aces: clampInt(src.records?.aces, 0, LEVEL_COUNT, 0),
    },
  };
}

function readRaw() {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function load() {
  const raw = readRaw();
  if (!raw) return defaults();
  try {
    return normalize(JSON.parse(raw));
  } catch {
    return defaults();
  }
}

export function save(data) {
  const safe = normalize(data);
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(safe));
  } catch {
    // 配额或隐私模式：静默降级为内存存档
  }
  return safe;
}

export function clear() {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(KEY);
  } catch {
    // 静默
  }
  return defaults();
}

function write(data, mutator) {
  const safe = normalize(data);
  mutator(safe);
  return save(safe);
}

export function levelRecord(data, id) {
  const safe = normalize(data);
  return safe.levels[id] ?? { stars: 0, cleared: false, fewest: 0 };
}

/** 记一次战果：星级取高、投数取少（只在命中时记录） */
export function recordLevel(data, id, { stars = 0, used = 0, cleared = false } = {}) {
  const lvl = levelById(id);
  if (!lvl) return { data: normalize(data), improved: false };
  const s = clampInt(stars, 0, STAR_MAX, 0);
  const prev = levelRecord(data, id);
  const hit = cleared === true && used > 0;
  const fewest = hit ? Math.min(prev.fewest || lvl.budget, clampInt(used, 1, lvl.budget, lvl.budget)) : prev.fewest;
  const improved = s > prev.stars || (hit && fewest < (prev.fewest || Infinity));
  const snapshot = write(data, (draft) => {
    draft.levels[id] = {
      stars: Math.max(prev.stars, s),
      cleared: prev.cleared || hit,
      fewest,
    };
    draft.last = clampInt(hit ? Math.min(id + 1, LEVEL_COUNT) : id, 1, LEVEL_COUNT, draft.last);
    let aces = 0;
    let minFewest = 0;
    for (let i = 1; i <= LEVEL_COUNT; i += 1) {
      const rec = draft.levels[i];
      if (!rec) continue;
      if (rec.stars >= STAR_MAX) aces += 1;
      if (rec.fewest > 0) minFewest = minFewest ? Math.min(minFewest, rec.fewest) : rec.fewest;
    }
    draft.records.aces = aces;
    draft.records.fewest = minFewest;
  });
  return { data: snapshot, improved };
}

/** 主线：过关才解锁下一关；盲猎章需主线 30 关全通 */
export function isUnlocked(data, id) {
  const lvl = levelById(id);
  if (!lvl) return false;
  if (id === 1) return true;
  if (id > MAIN_COUNT) {
    return mainCleared(data) && levelRecord(data, id - 1).cleared === true;
  }
  return levelRecord(data, id - 1).cleared === true;
}

export function mainCleared(data) {
  const safe = normalize(data);
  for (let id = 1; id <= MAIN_COUNT; id += 1) {
    if (!levelRecord(safe, id).cleared) return false;
  }
  return true;
}

export function totalStars(data) {
  const safe = normalize(data);
  let sum = 0;
  for (let id = 1; id <= LEVEL_COUNT; id += 1) sum += levelRecord(safe, id).stars;
  return sum;
}

export function chapterStars(data, ch) {
  const safe = normalize(data);
  let sum = 0;
  for (let id = 1; id <= LEVEL_COUNT; id += 1) {
    const lvl = levelById(id);
    if (lvl && lvl.ch === ch) sum += levelRecord(safe, id).stars;
  }
  return sum;
}

export function highestUnlocked(data) {
  const safe = normalize(data);
  let best = 1;
  for (let id = 1; id <= LEVEL_COUNT; id += 1) {
    if (isUnlocked(safe, id)) best = id;
    else break;
  }
  return best;
}

export function setMuted(data, muted) {
  return write(data, (safe) => {
    safe.muted = muted === true;
  });
}

export function setLast(data, id) {
  return write(data, (safe) => {
    safe.last = clampInt(id, 1, LEVEL_COUNT, safe.last);
  });
}
