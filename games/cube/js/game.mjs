// 魔方状态机控制器：DOM-free，接收 UI 意图调度 engine，绝不运行计时器副作用。

import {
  applyMoves,
  applyTurn,
  createSolved,
  dailySeed,
  generateScrambleFor,
  invertTurn,
  isSolved,
  moveToTurn,
  movesFromText,
  movesToText,
  suggestMove,
} from "./engine.mjs";

import { LEVEL_BY_ID, firstLevelId } from "./levels.mjs";

export const STATUS = Object.freeze({
  READY: "ready",
  RUNNING: "running",
  SOLVED: "solved",
});

export const SCRAMBLE_LENGTH = Object.freeze({ 2: 11, 3: 20 });

export function defaultScramble(seed, size) {
  return generateScrambleFor(size, seed, SCRAMBLE_LENGTH[size] ?? 20);
}

function buildState(config) {
  const size = config.size === 3 ? 3 : 2;
  const scrambleMoves = config.moves
    ?? movesFromText(config.scrambleText ?? "")
    ?? [];
  const cube = applyMoves(createSolved(size), scrambleMoves);
  return {
    size,
    mode: config.mode === "academy" ? "academy" : "free",
    levelId: config.levelId ?? null,
    dailyKey: config.dailyKey ?? null,
    seed: config.seed ?? null,
    cube,
    scramble: scrambleMoves,
    scrambleText: movesToText(scrambleMoves),
    history: [],
    moveCount: 0,
    status: STATUS.READY,
    startedAt: null,
    elapsedMs: 0,
    paused: false,
    solvedAt: null,
    hint: null,
  };
}

export function createFreeGame(options = {}) {
  const size = options.size === 3 ? 3 : 2;
  const seed = options.seed ?? ((Date.now() >>> 0) ^ (size * 7919));
  const scramble = defaultScramble(seed, size);
  return buildState({
    mode: "free",
    size,
    seed,
    moves: scramble.moves,
    dailyKey: options.dailyKey ?? null,
  });
}

export function createDailyGame(size, key, now = Date.now()) {
  const seed = dailySeed(key);
  const scramble = defaultScramble(seed, size);
  return {
    ...buildState({ mode: "free", size, seed, moves: scramble.moves, dailyKey: key, now }),
    dailyKey: key,
  };
}

export function createAcademyGame(levelId = firstLevelId()) {
  const level = LEVEL_BY_ID[levelId] ?? LEVEL_BY_ID[firstLevelId()];
  return buildState({
    mode: "academy",
    size: 3,
    levelId: level.id,
    moves: movesFromText(level.scramble),
  });
}

export function elapsedOf(state, now = Date.now()) {
  if (state.status === STATUS.RUNNING && !state.paused && state.startedAt !== null) {
    return Math.max(0, state.elapsedMs + (now - state.startedAt));
  }
  return Math.max(0, state.elapsedMs);
}

export function startTimer(state, now = Date.now()) {
  if (state.status === STATUS.SOLVED) return state;
  if (state.startedAt !== null && !state.paused) return state;
  return { ...state, startedAt: now, paused: false, status: STATUS.RUNNING };
}

export function pauseTimer(state, now = Date.now()) {
  if (state.status !== STATUS.RUNNING || state.paused) return state;
  return { ...state, elapsedMs: elapsedOf(state, now), startedAt: null, paused: true };
}

export function resumeTimer(state, now = Date.now()) {
  if (state.status !== STATUS.RUNNING || !state.paused || state.startedAt !== null) return state;
  return { ...state, startedAt: now, paused: false };
}

export function playMove(state, move, now = Date.now()) {
  if (!move || state.status === STATUS.SOLVED) return { state, event: "ignored" };
  return playTurn(state, moveToTurn(state.cube, move), now);
}

export function playTurn(state, spec, now = Date.now()) {
  if (!spec || state.status === STATUS.SOLVED) return { state, event: "ignored" };
  const quarters = ((Math.trunc(spec.quarters) % 4) + 4) % 4;
  if (quarters === 0) return { state, event: "ignored" };
  const cube = applyTurn(state.cube, spec);
  const history = [...state.history, { axis: spec.axis, layer: spec.layer, quarters: spec.quarters }];
  const startedAt = state.startedAt === null ? now : state.startedAt;
  const elapsedBefore = state.elapsedMs + (state.startedAt === null ? 0 : Math.max(0, now - state.startedAt));
  const solved = isSolved(cube);
  const next = {
    ...state,
    cube,
    history,
    moveCount: state.moveCount + 1,
    status: solved ? STATUS.SOLVED : STATUS.RUNNING,
    startedAt: solved ? null : startedAt,
    elapsedMs: solved ? Math.max(0, elapsedBefore) : state.elapsedMs,
    paused: false,
    solvedAt: solved ? now : null,
    hint: null,
  };
  return { state: next, event: solved ? "solved" : "turn" };
}

export function undo(state, now = Date.now()) {
  if (!state.history.length || state.status === STATUS.SOLVED) return { state, event: "ignored" };
  const last = state.history[state.history.length - 1];
  const cube = applyTurn(state.cube, invertTurn(last));
  const history = state.history.slice(0, -1);
  const moveCount = Math.max(0, state.moveCount - 1);
  const idle = !history.length;
  const accumulated = elapsedOf(state, now);
  const next = {
    ...state,
    cube,
    history,
    moveCount,
    status: idle ? STATUS.READY : state.status,
    startedAt: idle || state.paused ? null : now,
    elapsedMs: idle ? 0 : accumulated,
    paused: idle ? false : state.paused,
    solvedAt: null,
    hint: null,
  };
  return { state: next, event: "undo" };
}

export function resetGame(state) {
  return buildState({
    size: state.size,
    mode: state.mode,
    levelId: state.levelId,
    dailyKey: state.dailyKey,
    seed: state.seed,
    moves: state.scramble,
  });
}

export function scrambleGame(state, options = {}) {
  const size = options.size ?? state.size;
  const seed = options.seed ?? ((Date.now() >>> 0) ^ (size * 104729));
  const scramble = defaultScramble(seed, size);
  return buildState({
    size,
    mode: options.mode ?? state.mode,
    levelId: options.levelId ?? (options.mode === "academy" ? state.levelId : null),
    seed,
    moves: options.moves ?? scramble.moves,
    dailyKey: options.dailyKey ?? null,
  });
}

export function loadAcademyLevel(state, levelId) {
  const level = LEVEL_BY_ID[levelId];
  if (!level) return state;
  return buildState({
    mode: "academy",
    size: 3,
    levelId: level.id,
    moves: movesFromText(level.scramble),
  });
}

export function requestHint(state) {
  if (state.status === STATUS.SOLVED) return { state, hint: null };
  const suggestion = suggestMove(state.cube);
  return { state: { ...state, hint: suggestion }, hint: suggestion };
}
