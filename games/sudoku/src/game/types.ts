import type { Difficulty, Hint } from "@/engine/types";
import type { ScoreParts, StampId } from "./score";
import type { LocaleSetting } from "@/i18n/locale";

export type ThemeMode = "light" | "dark" | "system";
export type InputMode = "cell" | "digit" | "auto";
export type GameKind = "free" | "daily";
export type GameStatus = "playing" | "paused" | "won" | "lost";
export const MAX_MISTAKES = 5;
export const MAX_HINTS = 3;

export interface Settings {
  theme: ThemeMode;
  inputMode: InputMode;
  autoCheck: boolean;
  highlightSame: boolean;
  autoNotes: boolean;
  challengeMode: boolean;
  showTimer: boolean;
  reduceMotion: boolean;
  sound: boolean;
  cheers: boolean;
  locale: LocaleSetting;
}

export interface Cell {
  value: number | null;
  notes: number[];
  given: boolean;
}

export type Action =
  | {
      type: "set";
      cell: number;
      prev: number | null;
      next: number | null;
      prevNotes?: number[];
      prevNotesAll?: number[][];
      nextNotesAll?: number[][];
    }
  | { type: "notes"; cell: number; prev: number[]; next: number[] }
  | { type: "notes-all"; prev: number[][]; next: number[][] };

export interface GameScore extends ScoreParts {
  inkBefore: number;
  inkAfter: number;
  newStamps: StampId[];
}

export interface GameSave {
  kind: GameKind;
  date?: string;
  seed: string;
  difficulty: Difficulty;
  givens: number[];
  solution: number[];
  board: Cell[];
  startedAt: string;
  elapsedMs: number;
  runningSince: number | null;
  hintUsed: number;
  mistakes: number;
  status: GameStatus;
  undo: Action[];
  redo: Action[];
  score?: GameScore;
  cheered?: number[];
}

export interface DiffStat {
  completed: number;
  totalMs: number;
  bestMs: number | null;
  bestNoHintMs: number | null;
  noHintCompleted: number;
}

export interface Stats {
  streak: number;
  bestStreak: number;
  lastDailyCompleted: string | null;
  dailyHistory: Record<string, { ms: number; hints: number }>;
  byDifficulty: Record<Difficulty, DiffStat>;
  ink: number;
  bestScore: number;
  stamps: Partial<Record<StampId, string>>;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  inputMode: "auto",
  autoCheck: true,
  highlightSame: true,
  autoNotes: true,
  challengeMode: false,
  showTimer: true,
  reduceMotion: false,
  sound: true,
  cheers: true,
  locale: "system",
};

export function emptyDiffStat(): DiffStat {
  return {
    completed: 0,
    totalMs: 0,
    bestMs: null,
    bestNoHintMs: null,
    noHintCompleted: 0,
  };
}

export interface CoachTips {
  noteShortcut: boolean;
  keyboard: boolean;
}

export const DEFAULT_TIPS: CoachTips = {
  noteShortcut: false,
  keyboard: false,
};

export interface PersistedV1 {
  version: 1;
  settings: Settings;
  lastDifficulty: Difficulty;
  lastPlayedAt: string;
  onboarded: boolean;
  tips: CoachTips;
  free?: GameSave;
  daily?: GameSave;
  stats: Stats;
  storageOk: boolean;
}

export interface UiState {
  selected: number | null;
  noteMode: boolean;
  digitLock: number | null;
  hint: Hint | null;
  confirmNew: null | { kind: GameKind; difficulty: Difficulty };
  generating: boolean;
  generateError: string | null;
  revealSolution: boolean;
  justUnlocked: StampId[];
  coach: null | "note" | "keyboard";
  cheer: null | 30 | 50 | 80;
  pauseIdle: boolean;
}