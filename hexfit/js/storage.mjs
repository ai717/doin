// storage.mjs —— 存档唯一口径 doin.hexfit.v1：集中 try/catch，损坏自动 normalize 退回默认，静默降级内存

import { LEVEL_COUNT } from "./levels.mjs";
import { STAR_MAX } from "./levels.mjs";

export const KEY = "doin.hexfit.v1";
export const VERSION = 1;

export function defaults() {
  return {
    v: VERSION,
    muted: false,
    last: 1,
    levels: {},
    records: { stars: 0, cleared: 0 },
    bestSurvival: 0,
  };
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalizeLevels(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (let id = 1; id <= LEVEL_COUNT; id += 1) {
    const rec = raw[id] ?? raw[String(id)];
    if (!rec || typeof rec !== "object") continue;
    const stars = clampInt(rec.stars, 0, STAR_MAX, 0);
    out[id] = {
      stars,
      cleared: rec.cleared === true || stars > 0,
    };
  }
  return out;
}

export function normalize(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const levels = normalizeLevels(src.levels);
  let stars = 0;
  let cleared = 0;
  for (let id = 1; id <= LEVEL_COUNT; id += 1) {
    const rec = levels[id];
    if (!rec) continue;
    stars += rec.stars;
    if (rec.cleared) cleared += 1;
  }
  return {
    v: VERSION,
    muted: src.muted === true,
    last: clampInt(src.last, 1, LEVEL_COUNT, 1),
    levels,
    records: {
      stars,
      cleared,
    },
    bestSurvival: clampInt(src.bestSurvival, 0, 99999999, 0),
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
  } catch { /* 静默降级 */ }
  return safe;
}

export function clear() {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(KEY);
  } catch { /* ignore */ }
  return defaults();
}

function write(data, mutator) {
  const safe = normalize(data);
  mutator(safe);
  return save(safe);
}

export function levelRecord(data, id) {
  const safe = normalize(data);
  return safe.levels[id] ?? { stars: 0, cleared: false };
}

export function recordLevel(data, id, { stars = 0, cleared = false } = {}) {
  if (id < 1 || id > LEVEL_COUNT) return { data: normalize(data), improved: false };
  const s = clampInt(stars, 0, STAR_MAX, 0);
  const prev = levelRecord(data, id);
  const nextStars = cleared ? Math.max(prev.stars, s) : prev.stars;
  const improved = cleared && nextStars > prev.stars;
  const snapshot = write(data, (draft) => {
    draft.levels[id] = { stars: nextStars, cleared: prev.cleared || cleared };
    draft.last = clampInt(cleared ? Math.min(id + 1, LEVEL_COUNT) : id, 1, LEVEL_COUNT, draft.last);
    let st = 0;
    let cl = 0;
    for (let i = 1; i <= LEVEL_COUNT; i += 1) {
      const rec = draft.levels[i];
      if (!rec) continue;
      st += rec.stars;
      if (rec.cleared) cl += 1;
    }
    draft.records.stars = st;
    draft.records.cleared = cl;
  });
  return { data: snapshot, improved };
}

export function isUnlocked(data, id) {
  if (id <= 1) return true;
  return levelRecord(data, id - 1).cleared === true;
}

export function totalStars(data) {
  return normalize(data).records.stars;
}

export function clearedCount(data) {
  return normalize(data).records.cleared;
}

export function setMuted(data, muted) {
  return write(data, (safe) => { safe.muted = muted === true; });
}

export function setLast(data, id) {
  return write(data, (safe) => { safe.last = clampInt(id, 1, LEVEL_COUNT, safe.last); });
}

export function recordSurvival(data, score) {
  const s = clampInt(score, 0, 99999999, 0);
  const prev = normalize(data).bestSurvival;
  if (s <= prev) return { data: normalize(data), improved: false };
  const snapshot = write(data, (safe) => { safe.bestSurvival = s; });
  return { data: snapshot, improved: true };
}

export function bestSurvival(data) {
  return normalize(data).bestSurvival;
}
