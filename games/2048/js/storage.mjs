import { SIZE } from "./engine.mjs";

const PREFIX = "doin.2048.";
export const SAVE_KEY = PREFIX + "save";
export const BEST_KEY = PREFIX + "best";
export const STATS_KEY = PREFIX + "stats";
export const PREFS_KEY = PREFIX + "prefs";
export const SAVE_VERSION = 1;

export const THEMES = Object.freeze(["light", "dark"]);
export const LOCALES = Object.freeze(["zh", "en"]);

export const EMPTY_STATS = Object.freeze({ games: 0, wins: 0, bestTile: 0 });
export const DEFAULT_PREFS = Object.freeze({ locale: "zh", theme: "light", muted: false });

const fallback = new Map();
let persistent = true;

function store() {
  if (!persistent) return null;
  const web = globalThis.localStorage;
  if (!web) {
    persistent = false;
    return null;
  }
  return web;
}

function readRaw(key) {
  if (persistent) {
    try {
      const value = store()?.getItem(key);
      return typeof value === "string" ? value : null;
    } catch {
      persistent = false;
    }
  }
  return fallback.get(key) ?? null;
}

function writeRaw(key, value) {
  fallback.set(key, value);
  try {
    store()?.setItem(key, value);
  } catch {
    // Private mode or quota exceeded — the session keeps working from memory.
    persistent = false;
  }
}

function readJSON(key) {
  const raw = readRaw(key);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeJSON(key, value) {
  writeRaw(key, JSON.stringify(value));
}

function count(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function flag(value) {
  return value === true;
}

function isTile(value) {
  if (!value || typeof value !== "object") return false;
  return (
    Number.isInteger(value.id) &&
    Number.isInteger(value.value) &&
    value.value >= 2 &&
    Number.isInteger(value.row) &&
    Number.isInteger(value.col) &&
    value.row >= 0 &&
    value.row < SIZE &&
    value.col >= 0 &&
    value.col < SIZE
  );
}

function readTiles(raw) {
  if (!Array.isArray(raw)) return [];
  const tiles = [];
  const taken = new Set();
  for (const entry of raw) {
    if (!isTile(entry)) continue;
    const cell = entry.row * SIZE + entry.col;
    if (taken.has(cell)) continue;
    taken.add(cell);
    tiles.push({ id: entry.id, value: entry.value, row: entry.row, col: entry.col, kind: "idle" });
  }
  return tiles;
}

function readSnapshot(raw) {
  if (!raw || typeof raw !== "object") return null;
  const tiles = readTiles(raw.tiles);
  if (tiles.length === 0) return null;
  return {
    tiles,
    score: count(raw.score),
    won: flag(raw.won),
    keepPlaying: flag(raw.keepPlaying),
    over: flag(raw.over),
    nextId: Math.max(count(raw.nextId), 1),
  };
}

export function loadBest() {
  const value = Number(readRaw(BEST_KEY));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function writeBest(best) {
  if (best > loadBest()) writeRaw(BEST_KEY, String(best));
}

export function clearSave() {
  fallback.delete(SAVE_KEY);
  try {
    store()?.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

export function loadSave() {
  const blob = readJSON(SAVE_KEY);
  if (!blob) return null;
  const tiles = readTiles(blob.tiles);
  if (tiles.length === 0) return null;
  const undo = readSnapshot(blob.undo);
  const best = Math.max(count(blob.best), loadBest());
  const state = {
    tiles,
    score: count(blob.score),
    best,
    won: flag(blob.won),
    keepPlaying: flag(blob.keepPlaying),
    over: flag(blob.over),
    nextId: Math.max(count(blob.nextId), 1),
  };
  return { state, undo: undo ? { ...undo, best } : null };
}

export function writeSave(state, undo = null) {
  const snapshot = {
    tiles: state.tiles.map((tile) => ({
      id: tile.id,
      value: tile.value,
      row: tile.row,
      col: tile.col,
    })),
    score: state.score,
    won: state.won,
    keepPlaying: state.keepPlaying,
    over: state.over,
    nextId: state.nextId,
  };
  writeJSON(SAVE_KEY, {
    version: SAVE_VERSION,
    ...snapshot,
    best: state.best,
    undo: undo ? snapshotOf(undo) : null,
  });
  writeBest(state.best);
}

function snapshotOf(state) {
  return {
    tiles: state.tiles.map((tile) => ({
      id: tile.id,
      value: tile.value,
      row: tile.row,
      col: tile.col,
    })),
    score: state.score,
    won: state.won,
    keepPlaying: state.keepPlaying,
    over: state.over,
    nextId: state.nextId,
  };
}

export function loadStats() {
  const raw = readJSON(STATS_KEY);
  if (!raw) return { ...EMPTY_STATS };
  return {
    games: count(raw.games),
    wins: count(raw.wins),
    bestTile: count(raw.bestTile),
  };
}

function commitStats(stats) {
  writeJSON(STATS_KEY, stats);
  return stats;
}

export function noteGame(stats) {
  return commitStats({ ...stats, games: stats.games + 1 });
}

export function noteWin(stats) {
  return commitStats({ ...stats, wins: stats.wins + 1 });
}

export function noteBestTile(stats, value) {
  if (!(value > stats.bestTile)) return stats;
  return commitStats({ ...stats, bestTile: value });
}

export function hasPrefs() {
  return readRaw(PREFS_KEY) !== null;
}

export function loadPrefs() {
  const raw = readJSON(PREFS_KEY);
  if (!raw) return { ...DEFAULT_PREFS };
  return {
    locale: LOCALES.includes(raw.locale) ? raw.locale : DEFAULT_PREFS.locale,
    theme: THEMES.includes(raw.theme) ? raw.theme : DEFAULT_PREFS.theme,
    muted: flag(raw.muted),
  };
}

export function savePrefs(patch) {
  const next = { ...loadPrefs(), ...patch };
  if (!LOCALES.includes(next.locale)) next.locale = DEFAULT_PREFS.locale;
  if (!THEMES.includes(next.theme)) next.theme = DEFAULT_PREFS.theme;
  next.muted = flag(next.muted);
  writeJSON(PREFS_KEY, next);
  return next;
}
