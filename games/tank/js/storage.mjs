// Tank Assault - save data. Single owner of the storage key, always degrades to memory.
export const STORAGE_KEY = "doin.tank.v1";

export const CAMPAIGN_SIZE = 24;
export const ENDGAME_SIZE = 8;

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
    endgames: {},
    campaignUnlocked: 1,
    endgameUnlocked: 1,
    medals: {},
    records: {
      stars: 0,
      cleared: 0,
      bestWave: 0,
      bestHold: 0,
      maxCombo: 0,
      kills: 0,
      bricks: 0,
      ricochets: 0,
      shots: 0,
      hits: 0,
    },
    hints: true,
    muted: false,
  };
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampInt(value, min, max, fallback = min) {
  return Math.max(min, Math.min(max, Math.floor(num(value, fallback))));
}

const STAGE_ID = /^level_[1-6]_[1-4]$/;
const PUZZLE_ID = /^endgame_[1-8]$/;

function normalizeStage(raw) {
  if (!raw || typeof raw !== "object") return null;
  const entry = { stars: clampInt(raw.stars, 0, 3) };
  if (Number.isFinite(num(raw.time, NaN))) entry.time = Math.max(0, num(raw.time, 0));
  if (Number.isFinite(num(raw.baseHp, NaN))) entry.baseHp = clampInt(raw.baseHp, 0, 3);
  if (Number.isFinite(num(raw.deaths, NaN))) entry.deaths = clampInt(raw.deaths, 0, 99);
  if (Number.isFinite(num(raw.score, NaN))) entry.score = clampInt(raw.score, 0, 9999999);
  return entry;
}

function normalizePuzzle(raw) {
  if (!raw || typeof raw !== "object") return null;
  const entry = { cleared: Boolean(raw.cleared) };
  if (Number.isFinite(num(raw.time, NaN))) entry.time = Math.max(0, num(raw.time, 0));
  if (Number.isFinite(num(raw.ammoLeft, NaN))) entry.ammoLeft = clampInt(raw.ammoLeft, 0, 99);
  if (Number.isFinite(num(raw.score, NaN))) entry.score = clampInt(raw.score, 0, 9999999);
  return entry;
}

export function normalize(raw) {
  const out = defaults();
  if (!raw || typeof raw !== "object") return out;
  if (raw.campaign && typeof raw.campaign === "object") {
    for (const [id, value] of Object.entries(raw.campaign)) {
      if (!STAGE_ID.test(id)) continue;
      const entry = normalizeStage(value);
      if (entry) out.campaign[id] = entry;
    }
  }
  if (raw.endgames && typeof raw.endgames === "object") {
    for (const [id, value] of Object.entries(raw.endgames)) {
      if (!PUZZLE_ID.test(id)) continue;
      const entry = normalizePuzzle(value);
      if (entry) out.endgames[id] = entry;
    }
  }
  if (raw.medals && typeof raw.medals === "object") {
    for (const [key, value] of Object.entries(raw.medals)) {
      const chapter = Number(key);
      // No clamping here: an out-of-range chapter is junk and must be dropped,
      // never folded onto a real chapter.
      if (!Number.isInteger(chapter) || chapter < 1 || chapter > 6) continue;
      if (value) out.medals[String(chapter)] = true;
    }
  }
  out.campaignUnlocked = clampInt(raw.campaignUnlocked, 1, CAMPAIGN_SIZE);
  out.endgameUnlocked = clampInt(raw.endgameUnlocked, 1, ENDGAME_SIZE);
  if (raw.records && typeof raw.records === "object") {
    const r = raw.records;
    out.records = {
      stars: clampInt(r.stars, 0, CAMPAIGN_SIZE * 3),
      cleared: clampInt(r.cleared, 0, CAMPAIGN_SIZE),
      bestWave: clampInt(r.bestWave, 0, 9999),
      bestHold: Math.max(0, num(r.bestHold, 0)),
      maxCombo: clampInt(r.maxCombo, 0, 9999),
      kills: clampInt(r.kills, 0, 999999),
      bricks: clampInt(r.bricks, 0, 999999),
      ricochets: clampInt(r.ricochets, 0, 999999),
      shots: clampInt(r.shots, 0, 9999999),
      hits: clampInt(r.hits, 0, 9999999),
    };
  }
  out.hints = raw.hints === undefined ? true : Boolean(raw.hints);
  out.muted = Boolean(raw.muted);
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

/* ------------------------------------------------------------------ queries */

export function isCampaignUnlocked(data, index) {
  return index + 1 <= data.campaignUnlocked;
}

export function isEndgameUnlocked(data, index) {
  return index + 1 <= data.endgameUnlocked;
}

export function stageEntry(data, id) {
  return data.campaign[id] ?? null;
}

export function puzzleEntry(data, id) {
  return data.endgames[id] ?? null;
}

export function totalStars(data) {
  return Object.values(data.campaign).reduce((n, e) => n + (e.stars ?? 0), 0);
}

export function clearedCount(data) {
  return Object.keys(data.campaign).length;
}

export function chapterCleared(data, chapter, levels) {
  const own = levels.filter((lv) => lv.chapter === chapter);
  if (own.length === 0) return false;
  return own.every((lv) => Boolean(data.campaign[lv.id]));
}

export function accuracy(data) {
  const { shots = 0, hits = 0 } = data.records ?? {};
  if (shots <= 0) return 0;
  return Math.max(0, Math.min(1, hits / shots));
}
