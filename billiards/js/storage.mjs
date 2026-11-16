// Persistence single source of truth. Key: doin.billiards.v1
// Every read is normalised and every write is guarded; storage failure
// silently degrades to an in-memory copy.

import { TABLES } from "./tables.mjs";

export const STORAGE_KEY = "doin.billiards.v1";

const DEFAULT_STATE = Object.freeze({
  tables: Object.freeze({}),      // { [tableId]: { cleared, stars, bestShots, bestMs, fouls } }
  duelWins: Object.freeze([0, 0]),
  soundEnabled: true,
  aimAssist: true,
  spinPreview: true,
  lastMode: "clear",
  lastTable: TABLES[0].id,
  gamesPlayed: 0,
});

let memoryFallback = {
  ...DEFAULT_STATE,
  tables: {},
  duelWins: [0, 0],
};

const clampInt = (value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.min(max, Math.max(min, n));
};

function normalizeTables(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const valid = new Set(TABLES.map((t) => t.id));
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key !== "string" || !valid.has(key)) continue;
    if (!value || typeof value !== "object") continue;
    out[key] = {
      cleared: typeof value.cleared === "boolean" ? value.cleared : false,
      stars: clampInt(value.stars, 0, 0, 3),
      bestShots: clampInt(value.bestShots, Number.MAX_SAFE_INTEGER, 0),
      bestMs: clampInt(value.bestMs, Number.MAX_SAFE_INTEGER, 0),
      fouls: clampInt(value.fouls, Number.MAX_SAFE_INTEGER, 0),
    };
  }
  return out;
}

function normalizeWins(raw) {
  const out = [0, 0];
  if (Array.isArray(raw)) {
    out[0] = clampInt(raw[0], 0, 0, 9999);
    out[1] = clampInt(raw[1], 0, 0, 9999);
  }
  return out;
}

export function normalizeStorageData(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_STATE, tables: {}, duelWins: [0, 0] };
  }
  const lastTable = TABLES.some((t) => t.id === raw.lastTable) ? raw.lastTable : DEFAULT_STATE.lastTable;
  return {
    tables: normalizeTables(raw.tables),
    duelWins: normalizeWins(raw.duelWins),
    soundEnabled: typeof raw.soundEnabled === "boolean" ? raw.soundEnabled : true,
    aimAssist: typeof raw.aimAssist === "boolean" ? raw.aimAssist : true,
    spinPreview: typeof raw.spinPreview === "boolean" ? raw.spinPreview : true,
    lastMode: raw.lastMode === "duel" ? "duel" : "clear",
    lastTable,
    gamesPlayed: clampInt(raw.gamesPlayed, 0),
  };
}

export function loadGameData() {
  try {
    if (typeof localStorage === "undefined") return { ...memoryFallback };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE, tables: {}, duelWins: [0, 0] };
    const cleaned = normalizeStorageData(JSON.parse(raw));
    memoryFallback = { ...cleaned };
    return cleaned;
  } catch {
    return { ...memoryFallback };
  }
}

export function saveGameData(data) {
  const cleaned = normalizeStorageData(data);
  memoryFallback = { ...cleaned };
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
  } catch {
    /* degraded to memory */
  }
  return cleaned;
}

export function toggleFlag(data, flag) {
  const base = normalizeStorageData(data);
  if (!(flag in base) || typeof base[flag] !== "boolean") return base;
  return { ...base, [flag]: !base[flag] };
}

/** Merge a finished solo run, keeping the best of each metric. */
export function recordClearRun(prev, run) {
  const base = normalizeStorageData(prev);
  const next = {
    ...base,
    tables: { ...base.tables },
    gamesPlayed: base.gamesPlayed + 1,
    lastMode: "clear",
  };
  next.lastTable = typeof run?.tableId === "string" ? run.tableId : base.lastTable;
  if (!run || typeof run !== "object" || typeof run.tableId !== "string") return next;
  if (!TABLES.some((t) => t.id === run.tableId)) return next;
  const existing = base.tables[run.tableId] ?? null;
  const candidate = {
    cleared: Boolean(run.cleared) || Boolean(existing?.cleared),
    stars: clampInt(run.stars, 0, 0, 3),
    bestShots: clampInt(run.shots, Number.MAX_SAFE_INTEGER, 0),
    bestMs: clampInt(run.timeMs, Number.MAX_SAFE_INTEGER, 0),
    fouls: clampInt(run.fouls, Number.MAX_SAFE_INTEGER, 0),
  };
  if (!existing) {
    next.tables[run.tableId] = candidate;
    return next;
  }
  next.tables[run.tableId] = {
    cleared: existing.cleared || candidate.cleared,
    stars: Math.max(existing.stars, candidate.stars),
    bestShots: Math.min(existing.bestShots, candidate.bestShots),
    bestMs: Math.min(existing.bestMs, candidate.bestMs),
    fouls: Math.min(existing.fouls, candidate.fouls),
  };
  return next;
}

export function recordDuelResult(prev, winner) {
  const base = normalizeStorageData(prev);
  const duelWins = base.duelWins.slice();
  if (winner === 0 || winner === 1) duelWins[winner] += 1;
  return { ...base, duelWins, gamesPlayed: base.gamesPlayed + 1, lastMode: "duel" };
}

export function bestOf(data, tableId) {
  return normalizeStorageData(data).tables[tableId] ?? null;
}

export function totalStarsOf(data) {
  const tables = normalizeStorageData(data).tables;
  return Object.values(tables).reduce((sum, r) => sum + (r?.stars ?? 0), 0);
}

export function isUnlocked(data, tableId) {
  const tables = normalizeStorageData(data).tables;
  const idx = TABLES.findIndex((t) => t.id === tableId);
  if (idx <= 0) return true;
  return Boolean(tables[TABLES[idx - 1].id]?.cleared);
}
