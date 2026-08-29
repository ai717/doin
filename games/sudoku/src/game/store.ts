import { create } from "zustand";
import type { Difficulty } from "@/engine/types";
import { DIFFICULTIES } from "@/engine/types";
import { generatePuzzleAsync } from "@/engine/generate-async";
import { randomSeed } from "@/engine/generate";
import { nextHint, promoteHint } from "@/engine/hint";
import { isComplete, PEERS, candidatesFromBoard, digitsOf } from "@/engine/grid";
import { todayId } from "@/lib/utils";
import {
  DEFAULT_SETTINGS,
  DEFAULT_TIPS,
  MAX_HINTS,
  MAX_MISTAKES,
  type Action,
  type Cell,
  type CoachTips,
  type GameKind,
  type GameSave,
  type GameStatus,
  type PersistedV1,
  type Settings,
  type UiState,
} from "./types";
import { loadPersisted, savePersisted, clearPersisted, defaultPersisted } from "./persist";
import { crossedCheers, fillRatio } from "./cheer";
import { earnedStamps, monthKeyOf, scoreGame } from "./score";
import { playSfx, setSfxEnabled } from "@/lib/sfx";
import { applyDocumentLocale, t } from "@/i18n/core";

const DAILY_DIFFICULTY: Difficulty = "medium";
let startSeq = 0;

function cellsFromGivens(givens: number[]): Cell[] {
  return givens.map((v) => ({
    value: v === 0 ? null : v,
    notes: [],
    given: v !== 0,
  }));
}

function valuesOf(board: Cell[]): number[] {
  return board.map((c) => c.value ?? 0);
}

function liveElapsed(game: GameSave, now = Date.now()): number {
  if (game.status === "playing" && game.runningSince != null) {
    return game.elapsedMs + Math.max(0, now - game.runningSince);
  }
  return game.elapsedMs;
}

function persistSnapshot(get: () => GameState): void {
  const s = get();
  if (!s.hydrated) return;
  const data: PersistedV1 = {
    version: 1,
    settings: s.settings,
    lastDifficulty: s.lastDifficulty,
    lastPlayedAt: new Date().toISOString(),
    onboarded: s.onboarded,
    tips: s.tips,
    free: s.free,
    daily: s.daily,
    stats: s.stats,
    storageOk: s.storageOk,
  };
  const ok = savePersisted(data);
  if (ok !== s.storageOk) {
    useGame.setState({ storageOk: ok });
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(get: () => GameState) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => persistSnapshot(get), 200);
}

function rollover(data: PersistedV1, today: string): PersistedV1 {
  const daily = data.daily;
  if (!daily?.date || daily.date === today) return data;
  if (daily.status === "playing" || daily.status === "paused") {
    const demoted: GameSave = { ...daily, kind: "free", date: undefined };
    const freeBusy =
      data.free && (data.free.status === "playing" || data.free.status === "paused");
    return { ...data, free: freeBusy ? data.free : demoted, daily: undefined };
  }
  return { ...data, daily: undefined };
}

function stripPeerNotes(board: Cell[], cell: number, digit: number, auto: boolean): Cell[] {
  if (!auto) {
    return board.map((c, i) => (i === cell ? { ...c, notes: [] } : c));
  }
  const peers = PEERS[cell]!;
  return board.map((c, i) => {
    if (i === cell) return { ...c, notes: [] };
    if (peers.includes(i) && c.notes.includes(digit)) {
      return { ...c, notes: c.notes.filter((n) => n !== digit) };
    }
    return c;
  });
}

export interface GameState extends UiState {
  hydrated: boolean;
  settings: Settings;
  lastDifficulty: Difficulty;
  onboarded: boolean;
  tips: CoachTips;
  storageOk: boolean;
  free?: GameSave;
  daily?: GameSave;
  stats: PersistedV1["stats"];
  activeKind: GameKind | null;
  hydrate: () => void;
  setSettings: (patch: Partial<Settings>) => void;
  markOnboarded: () => void;
  dismissCoach: () => void;
  dismissCheer: () => void;
  resolvedInput: () => "cell" | "digit";
  activeGame: () => GameSave | null;
  openGame: (kind: GameKind) => void;
  startGame: (kind: GameKind, difficulty: Difficulty, force?: boolean) => Promise<void>;
  cancelConfirm: () => void;
  confirmPending: () => Promise<void>;
  selectCell: (i: number | null, opts?: { skipFill?: boolean }) => void;
  inputDigit: (d: number) => void;
  toggleNoteDigit: (d: number) => void;
  erase: () => void;
  toggleNoteMode: () => void;
  setDigitLock: (d: number | null) => void;
  undo: () => void;
  redo: () => void;
  pause: (opts?: { idle?: boolean }) => void;
  resumePlay: () => void;
  requestHint: () => void;
  advanceHint: () => void;
  dismissHint: () => void;
  fillHint: () => void;
  fillNotes: () => void;
  viewSolution: () => void;
  moveSelection: (dr: number, dc: number) => void;
  clearAllData: () => void;
  flushSave: () => void;
}

function notesSnapshot(board: Cell[]): number[][] {
  return board.map((c) => c.notes.slice());
}

function applyAction(board: Cell[], action: Action, dir: "do" | "undo"): Cell[] {
  const next = board.slice();
  if (action.type === "set") {
    const value = dir === "do" ? action.next : action.prev;
    const notesAll = dir === "do" ? action.nextNotesAll : action.prevNotesAll;
    if (notesAll) {
      return board.map((c, i) => ({
        ...c,
        value: i === action.cell ? value : c.value,
        notes: notesAll[i]!.slice(),
      }));
    }
    const cell = next[action.cell]!;
    if (dir === "do") {
      next[action.cell] = { ...cell, value: action.next, notes: [] };
    } else {
      next[action.cell] = {
        ...cell,
        value: action.prev,
        notes: action.prevNotes?.slice() ?? cell.notes,
      };
    }
    return next;
  } else if (action.type === "notes-all") {
    const notes = dir === "do" ? action.next : action.prev;
    return board.map((c, i) => ({ ...c, notes: notes[i]!.slice() }));
  } else {
    const cell = next[action.cell]!;
    next[action.cell] = {
      ...cell,
      notes: dir === "do" ? action.next : action.prev,
    };
  }
  return next;
}

export const useGame = create<GameState>((set, get) => ({
  hydrated: false,
  settings: { ...DEFAULT_SETTINGS },
  lastDifficulty: "easy",
  onboarded: false,
  tips: { ...DEFAULT_TIPS },
  storageOk: true,
  stats: defaultPersisted().stats,
  activeKind: null,
  selected: null,
  noteMode: false,
  digitLock: null,
  hint: null,
  confirmNew: null,
  generating: false,
  generateError: null,
  revealSolution: false,
  justUnlocked: [],
  coach: null,
  cheer: null,
  pauseIdle: false,

  hydrate: () => {
    if (get().hydrated) return;
    const today = todayId();
    const data = rollover(loadPersisted(), today);
    set({
      hydrated: true,
      settings: data.settings,
      lastDifficulty: data.lastDifficulty,
      onboarded: data.onboarded,
      tips: data.tips ?? { ...DEFAULT_TIPS },
      storageOk: data.storageOk,
      free: data.free,
      daily: data.daily,
      stats: data.stats,
    });
    setSfxEnabled(data.settings.sound);
    applyDocumentLocale(data.settings.locale);
  },

  setSettings: (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    if (patch.sound != null) {
      setSfxEnabled(patch.sound);
      if (patch.sound) playSfx("place");
    }
    if (patch.locale != null) applyDocumentLocale(next.locale);
    schedulePersist(get);
  },

  markOnboarded: () => {
    set({ onboarded: true });
    schedulePersist(get);
  },

  dismissCoach: () => {
    const s = get();
    if (!s.coach) return;
    const tips = { ...s.tips };
    if (s.coach === "note") {
      tips.noteShortcut = true;
      set({ coach: null, tips, onboarded: true });
    } else {
      tips.keyboard = true;
      set({ coach: null, tips });
    }
    schedulePersist(get);
  },

  dismissCheer: () => set({ cheer: null }),

  resolvedInput: () => {
    const mode = get().settings.inputMode;
    if (mode === "cell" || mode === "digit") return mode;
    if (typeof window !== "undefined" && window.innerWidth >= 900) return "digit";
    return "cell";
  },

  activeGame: () => {
    const { activeKind, free, daily } = get();
    if (activeKind === "daily") return daily ?? null;
    if (activeKind === "free") return free ?? null;
    return null;
  },

  openGame: (kind) => {
    set({
      activeKind: kind,
      selected: null,
      hint: null,
      noteMode: false,
      digitLock: null,
      revealSolution: false,
      justUnlocked: [],
      cheer: null,
      pauseIdle: false,
    });
  },

  startGame: async (kind, difficulty, force = false) => {
    const state = get();
    const existing = kind === "daily" ? state.daily : state.free;
    const today = todayId();
    if (kind === "daily" && existing?.date === today) {
      set({
        activeKind: "daily",
        selected: null,
        hint: null,
        noteMode: false,
        digitLock: null,
        confirmNew: null,
        revealSolution: false,
        justUnlocked: [],
        cheer: null,
        pauseIdle: false,
      });
      return;
    }
    if (
      !force &&
      existing &&
      (existing.status === "playing" || existing.status === "paused") &&
      (kind === "free" || (kind === "daily" && existing.date === today))
    ) {
      set({
        confirmNew: { kind, difficulty },
        activeKind: kind,
      });
      return;
    }
    set({ generating: true, generateError: null, confirmNew: null, hint: null, revealSolution: false, justUnlocked: [], cheer: null, pauseIdle: false });
    const token = ++startSeq;
    try {
      const seed = kind === "daily" ? `daily-${today}` : randomSeed();
      const diff = kind === "daily" ? DAILY_DIFFICULTY : difficulty;
      const puzzle = await generatePuzzleAsync(diff, seed);
      if (token !== startSeq) return;
      const game: GameSave = {
        kind,
        date: kind === "daily" ? today : undefined,
        seed: puzzle.seed,
        difficulty: puzzle.difficulty,
        givens: puzzle.givens,
        solution: puzzle.solution,
        board: cellsFromGivens(puzzle.givens),
        startedAt: new Date().toISOString(),
        elapsedMs: 0,
        runningSince: Date.now(),
        hintUsed: 0,
        mistakes: 0,
        status: "playing",
        undo: [],
        redo: [],
        cheered: [],
      };
      if (kind === "daily") {
        set({
          daily: game,
          activeKind: "daily",
          generating: false,
          selected: null,
          noteMode: false,
          digitLock: null,
          revealSolution: false,
          cheer: null,
          pauseIdle: false,
        });
      } else {
        set({
          free: game,
          activeKind: "free",
          lastDifficulty: difficulty,
          generating: false,
          selected: null,
          noteMode: false,
          digitLock: null,
          revealSolution: false,
          cheer: null,
          pauseIdle: false,
        });
      }
      schedulePersist(get);
    } catch {
      set({ generating: false, generateError: t("play.generateError") });
    }
  },

  cancelConfirm: () => set({ confirmNew: null }),

  confirmPending: async () => {
    const pending = get().confirmNew;
    if (!pending) return;
    await get().startGame(pending.kind, pending.difficulty, true);
  },

  selectCell: (i, opts) => {
    const game = get().activeGame();
    if (!game || game.status !== "playing") return;
    const input = get().resolvedInput();
    const lock = get().digitLock;
    const cell = i != null ? game.board[i] : null;
    const showNote =
      !get().tips.noteShortcut &&
      cell &&
      !cell.given &&
      cell.value == null;
    set({
      selected: i,
      coach: showNote && get().coach !== "keyboard" ? "note" : get().coach,
    });
    if (!opts?.skipFill && input === "digit" && lock != null && i != null) {
      get().inputDigit(lock);
    }
  },

  inputDigit: (d) => {
    const s = get();
    const game = s.activeGame();
    if (!game || game.status !== "playing") return;
    if (s.noteMode) {
      get().toggleNoteDigit(d);
      return;
    }
    const i = s.selected;
    if (i == null) {
      if (s.resolvedInput() === "digit") {
        set({ digitLock: s.digitLock === d ? null : d });
      }
      return;
    }
    const cell = game.board[i]!;
    if (cell.given) return;
    if (cell.value === d) return;

    const prev = cell.value;
    let board = game.board.slice();
    const prevNotesAll = notesSnapshot(board);
    board[i] = { ...cell, value: d, notes: [] };
    board = stripPeerNotes(board, i, d, s.settings.autoNotes);
    const nextNotesAll = notesSnapshot(board);

    const action: Action = {
      type: "set",
      cell: i,
      prev,
      next: d,
      prevNotesAll,
      nextNotesAll,
    };
    let mistakes = game.mistakes;
    let status: GameStatus = game.status;
    if (d !== game.solution[i]) {
      mistakes += 1;
      if (mistakes >= MAX_MISTAKES) status = "lost";
    }

    const values = valuesOf(board);
    if (status === "playing" && isComplete(values)) {
      status = "won";
    }

    const nextGame: GameSave = {
      ...game,
      board,
      undo: [...game.undo, action],
      redo: [],
      mistakes,
      status,
      runningSince: status === "playing" ? game.runningSince : null,
      elapsedMs: status === "playing" ? game.elapsedMs : liveElapsed(game),
    };

    const withCheer = attachCheer(get, set, nextGame, status);
    patchActive(set, get, withCheer);
    if (status === "won") recordWin(get, withCheer);
    else if (status === "lost") playSfx("lose");
    else if (d !== game.solution[i]) playSfx("mistake");
    else playSfx("place");
    if (d === game.solution[i] && status === "playing" && !get().tips.keyboard) {
      set({ coach: "keyboard" });
    }
    schedulePersist(get);
  },

  toggleNoteDigit: (d) => {
    const s = get();
    const game = s.activeGame();
    if (!game || game.status !== "playing") return;
    const i = s.selected;
    if (i == null) return;
    const cell = game.board[i]!;
    if (cell.given || cell.value != null) return;
    const has = cell.notes.includes(d);
    const nextNotes = has ? cell.notes.filter((n) => n !== d) : [...cell.notes, d].sort((a, b) => a - b);
    const action: Action = { type: "notes", cell: i, prev: cell.notes.slice(), next: nextNotes };
    const board = game.board.slice();
    board[i] = { ...cell, notes: nextNotes };
    patchActive(set, get, {
      ...game,
      board,
      undo: [...game.undo, action],
      redo: [],
    });
    schedulePersist(get);
    playSfx("note");
  },

  erase: () => {
    const s = get();
    const game = s.activeGame();
    if (!game || game.status !== "playing") return;
    const i = s.selected;
    if (i == null) return;
    const cell = game.board[i]!;
    if (cell.given) return;
    if (cell.value == null && cell.notes.length === 0) return;
    const prevNotesAll = notesSnapshot(game.board);
    const board = game.board.slice();
    board[i] = { ...cell, value: null, notes: [] };
    const action: Action =
      cell.value != null
        ? {
            type: "set",
            cell: i,
            prev: cell.value,
            next: null,
            prevNotesAll,
            nextNotesAll: notesSnapshot(board),
          }
        : { type: "notes", cell: i, prev: cell.notes.slice(), next: [] };
    patchActive(set, get, {
      ...game,
      board,
      undo: [...game.undo, action],
      redo: [],
    });
    schedulePersist(get);
    playSfx("erase");
  },

  toggleNoteMode: () => {
    set({ noteMode: !get().noteMode });
  },

  setDigitLock: (d) => set({ digitLock: d }),

  undo: () => {
    const game = get().activeGame();
    if (!game || game.status !== "playing" || game.undo.length === 0) return;
    const action = game.undo[game.undo.length - 1]!;
    const board = applyAction(game.board, action, "undo");
    patchActive(set, get, {
      ...game,
      board,
      undo: game.undo.slice(0, -1),
      redo: [...game.redo, action],
    });
    schedulePersist(get);
    playSfx("undo");
  },

  redo: () => {
    const game = get().activeGame();
    if (!game || game.status !== "playing" || game.redo.length === 0) return;
    const action = game.redo[game.redo.length - 1]!;
    const board = applyAction(game.board, action, "do");
    patchActive(set, get, {
      ...game,
      board,
      undo: [...game.undo, action],
      redo: game.redo.slice(0, -1),
    });
    schedulePersist(get);
  },

  pause: (opts) => {
    const game = get().activeGame();
    if (!game || game.status !== "playing") return;
    patchActive(set, get, {
      ...game,
      status: "paused",
      elapsedMs: liveElapsed(game),
      runningSince: null,
    });
    set({ pauseIdle: Boolean(opts?.idle) });
    persistSnapshot(get);
  },

  resumePlay: () => {
    const game = get().activeGame();
    if (!game || game.status !== "paused") return;
    patchActive(set, get, {
      ...game,
      status: "playing",
      runningSince: Date.now(),
    });
    set({ pauseIdle: false });
    schedulePersist(get);
  },

  requestHint: () => {
    const s = get();
    const game = s.activeGame();
    if (!game || game.status !== "playing") return;
    if (s.hint) {
      get().advanceHint();
      return;
    }
    if (game.hintUsed >= MAX_HINTS) return;
    const hint = nextHint(valuesOf(game.board), game.solution);
    if (!hint) return;
    patchActive(set, get, { ...game, hintUsed: game.hintUsed + 1 });
    set({ hint });
    schedulePersist(get);
    playSfx("hint");
  },

  advanceHint: () => {
    const s = get();
    if (!s.hint) return;
    if (s.hint.level === 1) set({ hint: promoteHint(s.hint) });
    else if (s.hint.level === 2) get().fillHint();
  },

  dismissHint: () => set({ hint: null }),

  fillHint: () => {
    const s = get();
    const hint = s.hint;
    const game = s.activeGame();
    if (!hint || !game || game.status !== "playing") return;
    const placement = hint.step.placements[0];
    if (!placement) {
      set({ hint: null });
      return;
    }
    set({ selected: placement.cell, hint: { ...hint, level: 3 }, noteMode: false });
    const i = placement.cell;
    const d = placement.digit;
    const cell = game.board[i]!;
    if (cell.given) {
      set({ hint: null });
      return;
    }
    const prev = cell.value;
    const prevNotesAll = notesSnapshot(game.board);
    let board = game.board.slice();
    board[i] = { ...cell, value: d, notes: [] };
    board = stripPeerNotes(board, i, d, s.settings.autoNotes);
    const action: Action = {
      type: "set",
      cell: i,
      prev,
      next: d,
      prevNotesAll,
      nextNotesAll: notesSnapshot(board),
    };
    let status: GameStatus = game.status;
    const values = valuesOf(board);
    if (isComplete(values)) status = "won";
    const nextGame: GameSave = {
      ...game,
      board,
      undo: [...game.undo, action],
      redo: [],
      status,
      runningSince: status === "playing" ? game.runningSince : null,
      elapsedMs: status === "playing" ? game.elapsedMs : liveElapsed(game),
    };
    const withCheer = attachCheer(get, set, nextGame, status);
    patchActive(set, get, withCheer);
    set({ hint: null });
    if (status === "won") recordWin(get, withCheer);
    schedulePersist(get);
  },

  fillNotes: () => {
    const s = get();
    const game = s.activeGame();
    if (!game || game.status !== "playing") return;
    const values = valuesOf(game.board);
    const cands = candidatesFromBoard(values);
    const prev = game.board.map((c) => c.notes.slice());
    const board = game.board.map((c, i) => {
      if (c.given || c.value != null) return c;
      return { ...c, notes: digitsOf(cands[i]!) };
    });
    const next = board.map((c) => c.notes.slice());
    const same = prev.every((p, i) => p.join(",") === next[i]!.join(","));
    if (same) {
      set({ noteMode: true });
      return;
    }
    const action: Action = { type: "notes-all", prev, next };
    patchActive(set, get, {
      ...game,
      board,
      undo: [...game.undo, action],
      redo: [],
    });
    set({ noteMode: true });
    schedulePersist(get);
  },

  viewSolution: () => {
    const game = get().activeGame();
    if (!game || game.status !== "lost") return;
    set({ revealSolution: true, selected: null, hint: null, noteMode: false, digitLock: null });
  },

  moveSelection: (dr, dc) => {
    const s = get();
    const game = s.activeGame();
    if (!game || game.status !== "playing") return;
    const i = s.selected ?? 0;
    const r = Math.min(8, Math.max(0, ((i / 9) | 0) + dr));
    const c = Math.min(8, Math.max(0, (i % 9) + dc));
    set({ selected: r * 9 + c });
  },

  clearAllData: () => {
    clearPersisted();
    const fresh = defaultPersisted();
    set({
      settings: fresh.settings,
      lastDifficulty: "easy",
      onboarded: true,
      tips: { noteShortcut: true, keyboard: true },
      coach: null,
      free: undefined,
      daily: undefined,
      stats: fresh.stats,
      activeKind: null,
      selected: null,
      hint: null,
      noteMode: false,
      digitLock: null,
      storageOk: true,
      revealSolution: false,
      justUnlocked: [],
      cheer: null,
      pauseIdle: false,
    });
  },

  flushSave: () => persistSnapshot(get),
}));

function patchActive(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
  game: GameSave,
) {
  if (game.kind === "daily") set({ daily: game, activeKind: "daily" });
  else set({ free: game, activeKind: "free" });
}

function attachCheer(
  get: () => GameState,
  set: (partial: Partial<GameState>) => void,
  game: GameSave,
  status: GameStatus,
): GameSave {
  if (status !== "playing") return game;
  if (!get().settings.cheers) return game;
  const already = game.cheered ?? [];
  const crossed = crossedCheers(fillRatio(game.board), already);
  if (crossed.length === 0) return { ...game, cheered: already };
  const show = crossed[crossed.length - 1]!;
  set({ cheer: show });
  playSfx("cheer");
  return { ...game, cheered: [...already, ...crossed] };
}

function recordWin(get: () => GameState, game: GameSave) {
  const { stats } = get();
  const elapsed = liveElapsed(game);
  const d = game.difficulty;
  const cur = stats.byDifficulty[d];
  const noHint = game.hintUsed === 0;
  const wasRecord = cur.bestMs == null || elapsed < cur.bestMs;
  const byDifficulty = { ...stats.byDifficulty };
  byDifficulty[d] = {
    completed: cur.completed + 1,
    totalMs: cur.totalMs + elapsed,
    bestMs: wasRecord ? elapsed : cur.bestMs,
    bestNoHintMs: noHint
      ? cur.bestNoHintMs == null
        ? elapsed
        : Math.min(cur.bestNoHintMs, elapsed)
      : cur.bestNoHintMs,
    noHintCompleted: cur.noHintCompleted + (noHint ? 1 : 0),
  };
  let streak = stats.streak;
  let bestStreak = stats.bestStreak;
  let lastDailyCompleted = stats.lastDailyCompleted;
  const dailyHistory = { ...stats.dailyHistory };
  if (game.kind === "daily" && game.date) {
    const today = game.date;
    if (lastDailyCompleted !== today) {
      const y = yesterdayOf(today);
      streak = lastDailyCompleted === y ? streak + 1 : 1;
      bestStreak = Math.max(bestStreak, streak);
      lastDailyCompleted = today;
    }
    dailyHistory[today] = { ms: elapsed, hints: game.hintUsed };
  }
  const parts = scoreGame({
    difficulty: d,
    elapsedMs: elapsed,
    mistakes: game.mistakes,
    hintUsed: game.hintUsed,
    kind: game.kind,
  });
  const inkBefore = stats.ink ?? 0;
  const ink = inkBefore + parts.total;
  const total = DIFFICULTIES.reduce((n, x) => n + byDifficulty[x].completed, 0);
  const monthKey = monthKeyOf(game.date ?? todayId());
  const completedByDifficulty = {} as Record<(typeof DIFFICULTIES)[number], number>;
  for (const x of DIFFICULTIES) completedByDifficulty[x] = byDifficulty[x].completed;
  const unlocked = earnedStamps({
    total,
    ink,
    streak,
    kind: game.kind,
    difficulty: d,
    elapsedMs: elapsed,
    mistakes: game.mistakes,
    hintUsed: game.hintUsed,
    wasRecord,
    completedByDifficulty,
    dailyHistory,
    monthKey,
    hour: new Date().getHours(),
  });
  const prevStamps = stats.stamps ?? {};
  const newStamps = unlocked.filter((id) => !prevStamps[id]);
  const stamps = { ...prevStamps };
  const at = new Date().toISOString();
  for (const id of newStamps) stamps[id] = at;
  const scored: GameSave = {
    ...game,
    score: { ...parts, inkBefore, inkAfter: ink, newStamps },
  };
  if (game.kind === "daily") useGame.setState({ daily: scored, activeKind: "daily" });
  else useGame.setState({ free: scored, activeKind: "free" });
  useGame.setState({
    stats: {
      streak,
      bestStreak,
      lastDailyCompleted,
      dailyHistory,
      byDifficulty,
      ink,
      bestScore: Math.max(stats.bestScore ?? 0, parts.total),
      stamps,
    },
    justUnlocked: newStamps,
  });
  playSfx("win");
  if (newStamps.length > 0 && typeof window !== "undefined") {
    window.setTimeout(() => playSfx("stamp"), 280);
  }
}

function yesterdayOf(id: string): string {
  const [y, m, d] = id.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() - 1);
  return todayId(dt);
}

export { liveElapsed, DAILY_DIFFICULTY, DIFFICULTIES };
