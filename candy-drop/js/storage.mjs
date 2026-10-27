// storage.mjs: 存档唯一口径 doin.candy-drop.v1 —— 集中 try/catch，损坏自动 normalize 退回默认，静默降级内存

import { LEVEL_COUNT, LEVELS_PER_BOX, levelById } from "./levels.mjs";
import { LEVEL_MAX, BOX_UNLOCK_STARS, clampInt, scoreOf } from "./score.mjs";

export const KEY = "doin.candy-drop.v1";
export const VERSION = 1;

export function defaults() {
  return { v: VERSION, levels: {}, muted: false, last: 1 };
}

function normalizeLevels(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (let id = 1; id <= LEVEL_COUNT; id += 1) {
    const rec = raw[id] ?? raw[String(id)];
    if (!rec || typeof rec !== "object") continue;
    const stars = clampInt(rec.stars, 0, 3, 0);
    const cleared = rec.cleared === true || stars > 0;
    out[id] = {
      stars,
      cleared,
      score: clampInt(rec.score, 0, LEVEL_MAX, cleared ? scoreOf(stars, true) : 0),
      best: clampInt(rec.best, 0, LEVEL_MAX, 0),
    };
  }
  return out;
}

/** 任何输入都归一化成合法存档，绝不抛错 */
export function normalize(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const levels = normalizeLevels(src.levels);
  const last = clampInt(src.last, 1, LEVEL_COUNT, 1);
  return {
    v: VERSION,
    levels,
    muted: src.muted === true,
    last,
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
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(KEY, JSON.stringify(safe));
    }
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

/** 记录一次通关/失败结果：只在更优时覆盖星级与得分 */
export function recordResult(data, levelId, { stars, won }) {
  const safe = normalize(data);
  const lvl = levelById(levelId);
  if (!lvl) return { data: safe, improved: false };
  const id = lvl.id;
  const s = clampInt(stars, 0, 3, 0);
  const sc = scoreOf(s, won);
  const prev = safe.levels[id] ?? { stars: 0, cleared: false, score: 0, best: 0 };
  const improved = s > prev.stars || (won && !prev.cleared);
  safe.levels[id] = {
    stars: Math.max(prev.stars, s),
    cleared: prev.cleared || won === true,
    score: Math.max(prev.score, sc),
    best: Math.max(prev.best, sc),
  };
  if (won && id + 1 <= LEVEL_COUNT) safe.last = Math.max(safe.last, id + 1);
  else safe.last = Math.max(safe.last, id);
  save(safe);
  return { data: safe, improved };
}

export function setMuted(data, muted) {
  const safe = normalize(data);
  safe.muted = muted === true;
  save(safe);
  return safe;
}

export function setLast(data, levelId) {
  const safe = normalize(data);
  safe.last = clampInt(levelId, 1, LEVEL_COUNT, 1);
  save(safe);
  return safe;
}

/** 盒是否解锁：第 1 盒恒开，其后要求上一盒至少 BOX_UNLOCK_STARS 星 */
export function isBoxUnlocked(data, box) {
  if (box <= 1) return true;
  const prev = box - 1;
  let sum = 0;
  for (const id of boxLevelIds(prev)) {
    sum += data?.levels?.[id]?.stars ?? 0;
  }
  return sum >= BOX_UNLOCK_STARS;
}

function boxLevelIds(box) {
  const from = (box - 1) * LEVELS_PER_BOX + 1;
  const ids = [];
  for (let i = 0; i < LEVELS_PER_BOX; i += 1) {
    const id = from + i;
    if (id <= LEVEL_COUNT) ids.push(id);
  }
  return ids;
}

/** 关卡是否解锁：所在盒已开 且（本盒第一关 或 前一关已通关） */
export function isLevelUnlocked(data, levelId) {
  const lvl = levelById(levelId);
  if (!lvl) return false;
  if (!isBoxUnlocked(data, lvl.box)) return false;
  if (levelId === 1) return true;
  const prev = data?.levels?.[levelId - 1];
  return prev?.cleared === true;
}

/** 最高的可玩关卡（用于「继续游戏」） */
export function highestUnlocked(data) {
  let best = 1;
  for (let id = 1; id <= LEVEL_COUNT; id += 1) {
    if (isLevelUnlocked(data, id)) best = id;
    else break;
  }
  return best;
}
