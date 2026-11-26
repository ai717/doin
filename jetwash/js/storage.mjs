// Single storage authority for Jet Wash. Key: doin.jetwash.v1.
// Corrupt data normalizes to defaults; restricted storage falls back to memory.

import { LEVEL_IDS } from "./levels.mjs";

const KEY = "doin.jetwash.v1";

let memoryBackend = null;

function defaults() {
  return {
    version: 1,
    levelId: LEVEL_IDS[0],
    unlocked: [LEVEL_IDS[0]],
    stars: {},
    bestTime: {},
    muted: false,
    record: { cleaned: 0, totalTime: 0 },
  };
}

function backend() {
  if (memoryBackend) return memoryBackend;
  try {
    if (typeof globalThis.localStorage !== "undefined") {
      globalThis.localStorage.setItem("__jetwash_probe__", "1");
      globalThis.localStorage.removeItem("__jetwash_probe__");
      return globalThis.localStorage;
    }
  } catch (error) { /* restricted storage: use memory */ }
  const map = new Map();
  memoryBackend = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
  return memoryBackend;
}

function clampStars(value) {
  return Number.isFinite(value) ? Math.min(3, Math.max(0, Math.floor(value))) : 0;
}

export function normalize(input) {
  const base = defaults();
  if (!input || typeof input !== "object" || Array.isArray(input)) return base;
  const levelId = LEVEL_IDS.includes(input.levelId) ? input.levelId : base.levelId;
  const unlockedRaw = Array.isArray(input.unlocked) ? input.unlocked.filter((id) => LEVEL_IDS.includes(id)) : [];
  const unlocked = [...new Set([LEVEL_IDS[0], levelId, ...unlockedRaw])];
  const stars = {};
  const bestTime = {};
  const srcStars = input.stars && typeof input.stars === "object" ? input.stars : {};
  const srcTime = input.bestTime && typeof input.bestTime === "object" ? input.bestTime : {};
  for (const id of LEVEL_IDS) {
    if (srcStars[id] !== undefined) stars[id] = clampStars(srcStars[id]);
    if (Number.isFinite(srcTime[id]) && srcTime[id] > 0) bestTime[id] = srcTime[id];
  }
  const positive = (value, fallback) => (Number.isFinite(value) && value >= 0 ? value : fallback);
  const recordRaw = input.record && typeof input.record === "object" ? input.record : {};
  return {
    version: 1,
    levelId,
    unlocked,
    stars,
    bestTime,
    muted: Boolean(input.muted),
    record: {
      cleaned: Math.floor(positive(recordRaw.cleaned, 0)),
      totalTime: positive(recordRaw.totalTime, 0),
    },
  };
}

export function load() {
  try {
    const raw = backend().getItem(KEY);
    return normalize(raw ? JSON.parse(raw) : null);
  } catch (error) {
    return defaults();
  }
}

export function save(state) {
  const normalized = normalize(state);
  try {
    backend().setItem(KEY, JSON.stringify(normalized));
    return true;
  } catch (error) {
    return false;
  }
}

export function recordFinish(state, levelId, stars, time) {
  const next = normalize(state);
  if (!LEVEL_IDS.includes(levelId)) return next;
  next.levelId = levelId;
  next.stars[levelId] = Math.max(clampStars(next.stars[levelId]), clampStars(stars));
  if (Number.isFinite(time) && time > 0) {
    next.bestTime[levelId] = next.bestTime[levelId] ? Math.min(next.bestTime[levelId], time) : time;
  }
  const idx = LEVEL_IDS.indexOf(levelId);
  if (idx >= 0 && idx + 1 < LEVEL_IDS.length && !next.unlocked.includes(LEVEL_IDS[idx + 1])) {
    next.unlocked.push(LEVEL_IDS[idx + 1]);
  }
  next.record.cleaned += 1;
  if (Number.isFinite(time) && time > 0) next.record.totalTime += time;
  save(next);
  return next;
}

export function isUnlocked(state, levelId) {
  return (state.unlocked ?? []).includes(levelId);
}

export function resetBackendForTests() {
  memoryBackend = null;
}
