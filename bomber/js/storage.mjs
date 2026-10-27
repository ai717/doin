// Bomber - save data. Single owner of the storage key, always degrades to memory.
export const STORAGE_KEY = "doin.bomber.v1";

const memory = new Map();

function getStorage() {
  try {
    const probe = "__doin_probe__";
    globalThis.localStorage.setItem(probe, "1");
    globalThis.localStorage.removeItem(probe);
    return globalThis.localStorage;
  } catch {
    return {
      getItem: (key) => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => memory.set(key, String(value)),
      removeItem: (key) => memory.delete(key),
    };
  }
}

export function defaults() {
  return {
    version: 1,
    campaign: {},
    puzzles: {},
    campaignUnlocked: 1,
    puzzleUnlocked: 1,
    parts: 0,
    unlocks: { bomb: false, fire: false, shield: false },
    records: { maxChain: 0, bestDemo: 0, stars: 0, cleared: 0 },
    muted: false,
    assist: true,
    skin: 0,
  };
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const stars = Math.max(0, Math.min(3, Math.floor(num(raw.stars, 0))));
  const entry = { stars };
  if (Number.isFinite(num(raw.time, NaN))) entry.time = Math.max(0, num(raw.time, 0));
  if (Number.isFinite(num(raw.demo, NaN))) entry.demo = Math.max(0, Math.min(1, num(raw.demo, 0)));
  if (Number.isFinite(num(raw.bombs, NaN))) entry.bombs = Math.max(0, Math.floor(num(raw.bombs, 0)));
  return entry;
}

export function normalize(raw) {
  const base = defaults();
  if (!raw || typeof raw !== "object") return base;
  const out = base;
  if (raw.campaign && typeof raw.campaign === "object") {
    for (const [id, value] of Object.entries(raw.campaign)) {
      const entry = normalizeEntry(value);
      if (entry) out.campaign[id] = entry;
    }
  }
  if (raw.puzzles && typeof raw.puzzles === "object") {
    for (const [id, value] of Object.entries(raw.puzzles)) {
      const entry = normalizeEntry(value);
      if (entry) out.puzzles[id] = entry;
    }
  }
  out.campaignUnlocked = Math.max(1, Math.min(40, Math.floor(num(raw.campaignUnlocked, 1))));
  out.puzzleUnlocked = Math.max(1, Math.min(24, Math.floor(num(raw.puzzleUnlocked, 1))));
  out.parts = Math.max(0, Math.floor(num(raw.parts, 0)));
  if (raw.unlocks && typeof raw.unlocks === "object") {
    out.unlocks = {
      bomb: Boolean(raw.unlocks.bomb),
      fire: Boolean(raw.unlocks.fire),
      shield: Boolean(raw.unlocks.shield),
    };
  }
  if (raw.records && typeof raw.records === "object") {
    out.records = {
      maxChain: Math.max(0, Math.floor(num(raw.records.maxChain, 0))),
      bestDemo: Math.max(0, Math.min(1, num(raw.records.bestDemo, 0))),
      stars: Math.max(0, Math.floor(num(raw.records.stars, 0))),
      cleared: Math.max(0, Math.floor(num(raw.records.cleared, 0))),
    };
  }
  out.muted = Boolean(raw.muted);
  out.assist = raw.assist === undefined ? true : Boolean(raw.assist);
  out.skin = Math.max(0, Math.min(5, Math.floor(num(raw.skin, 0))));
  return out;
}

export function load() {
  try {
    const raw = getStorage().getItem(STORAGE_KEY);
    if (!raw) return defaults();
    return normalize(JSON.parse(raw));
  } catch {
    return defaults();
  }
}

export function save(state) {
  try {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(normalize(state)));
    return true;
  } catch {
    return false;
  }
}

export function clear() {
  try {
    getStorage().removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return defaults();
}

export function isCampaignUnlocked(data, index) {
  return index + 1 <= data.campaignUnlocked;
}

export function isPuzzleUnlocked(data, index) {
  return index + 1 <= data.puzzleUnlocked;
}
