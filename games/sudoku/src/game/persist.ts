import type { Difficulty } from "@/engine/types";
import { DIFFICULTIES } from "@/engine/types";
import {
  DEFAULT_SETTINGS,
  DEFAULT_TIPS,
  emptyDiffStat,
  type GameSave,
  type PersistedV1,
  type Stats,
} from "./types";

export const STORAGE_KEY = "jiugong.v1";

function emptyStats(): Stats {
  const byDifficulty = {} as Stats["byDifficulty"];
  for (const d of DIFFICULTIES) byDifficulty[d] = emptyDiffStat();
  return {
    streak: 0,
    bestStreak: 0,
    lastDailyCompleted: null,
    dailyHistory: {},
    byDifficulty,
    ink: 0,
    bestScore: 0,
    stamps: {},
  };
}

export function defaultPersisted(): PersistedV1 {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    lastDifficulty: "easy",
    lastPlayedAt: new Date().toISOString(),
    onboarded: false,
    tips: { ...DEFAULT_TIPS },
    stats: emptyStats(),
    storageOk: true,
  };
}

function reviveGame(raw: unknown): GameSave | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const g = raw as GameSave;
  if (!Array.isArray(g.board) || g.board.length !== 81) return undefined;
  if (!Array.isArray(g.givens) || !Array.isArray(g.solution)) return undefined;
  return {
    ...g,
    undo: Array.isArray(g.undo) ? g.undo : [],
    redo: Array.isArray(g.redo) ? g.redo : [],
    cheered: Array.isArray(g.cheered) ? g.cheered.filter((n) => n === 30 || n === 50 || n === 80) : [],
    runningSince: g.status === "playing" ? Date.now() : null,
  };
}

export function loadPersisted(): PersistedV1 {
  const fallback = defaultPersisted();
  try {
    if (typeof localStorage === "undefined") {
      return { ...fallback, storageOk: false };
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedV1>;
    if (parsed.version !== 1) return fallback;
    const base = defaultPersisted();
    const stats: Stats = {
      ...emptyStats(),
      ...(parsed.stats ?? {}),
      byDifficulty: { ...emptyStats().byDifficulty, ...(parsed.stats?.byDifficulty ?? {}) },
      dailyHistory: parsed.stats?.dailyHistory ?? {},
      ink: typeof parsed.stats?.ink === "number" ? parsed.stats.ink : 0,
      bestScore: typeof parsed.stats?.bestScore === "number" ? parsed.stats.bestScore : 0,
      stamps: parsed.stats?.stamps ?? {},
    };
    for (const d of DIFFICULTIES) {
      stats.byDifficulty[d] = { ...emptyDiffStat(), ...stats.byDifficulty[d] };
    }
    const free = reviveGame(parsed.free);
    const daily = reviveGame(parsed.daily);
    const completed = DIFFICULTIES.reduce(
      (n, d) => n + stats.byDifficulty[d].completed,
      0,
    );
    if (stats.bestScore === 0 && completed === 1 && stats.ink > 0) {
      stats.bestScore = stats.ink;
    }
    stats.bestScore = Math.max(
      stats.bestScore,
      free?.score?.total ?? 0,
      daily?.score?.total ?? 0,
    );
    return {
      version: 1,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      lastDifficulty: (parsed.lastDifficulty as Difficulty) ?? "easy",
      lastPlayedAt: parsed.lastPlayedAt ?? base.lastPlayedAt,
      onboarded: Boolean(parsed.onboarded),
      tips: {
        noteShortcut: Boolean(parsed.tips?.noteShortcut),
        keyboard: Boolean(parsed.tips?.keyboard),
      },
      free,
      daily,
      stats,
      storageOk: true,
    };
  } catch {
    return { ...fallback, storageOk: false };
  }
}

export function savePersisted(data: PersistedV1): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    const copy: PersistedV1 = {
      ...data,
      free: freezeRunning(data.free),
      daily: freezeRunning(data.daily),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
    return true;
  } catch {
    return false;
  }
}

function freezeRunning(game?: GameSave): GameSave | undefined {
  if (!game) return game;
  if (game.status !== "playing" || game.runningSince == null) return game;
  const elapsed = game.elapsedMs + Math.max(0, Date.now() - game.runningSince);
  return { ...game, elapsedMs: elapsed, runningSince: Date.now() };
}

export function clearPersisted(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
