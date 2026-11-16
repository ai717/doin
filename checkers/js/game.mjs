// game.mjs - DOM-free game controller: mode flow, AI scheduling, undo,
// move log, statistics and result. All side effects are injected so the
// controller can be exercised directly in node.

import {
  RED, BLUE, HOLE_COUNT,
  createInitialState, applyMove, applySoloMove, legalMoves, legalMovesFrom,
  otherPlayer, campCount,
} from "./engine.mjs";
import { chooseMoveAsync, DIFFICULTY_META, DIFFICULTY_INTERMEDIATE } from "./ai.mjs";

export const MODES = Object.freeze({ PVE: "pve", PVP: "pvp", PUZZLE: "puzzle" });
export const OUTCOME = Object.freeze({ WIN: "win", LOSS: "loss" });

function cloneState(s) {
  return {
    board: s.board.slice(),
    turn: s.turn,
    status: s.status,
    winner: s.winner,
    moveCount: s.moveCount,
    history: s.history.map((m) => ({ ...m })),
  };
}

export function createGameController(options = {}) {
  const ai = options.ai ?? chooseMoveAsync;
  const rng = options.rng ?? Math.random;
  const schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const cancel = options.cancel ?? ((handle) => clearTimeout(handle));
  const onChange = options.onChange ?? (() => {});

  let config = null;
  let state = null;
  let snapshots = [];
  let thinking = false;
  let thinkingProgress = null;
  let timer = null;
  let aiToken = 0;
  let finished = null;
  let puzzleDone = null;
  let undoCount = 0;
  let initialState = null;

  function emit() { onChange(view()); }

  function clearTimer() {
    if (timer !== null) {
      cancel(timer);
      timer = null;
    }
  }

  function invalidateAI() {
    clearTimer();
    aiToken += 1;
    thinking = false;
    thinkingProgress = null;
  }

  function isHumanTurn() {
    if (!state || state.status !== "playing" || thinking) return false;
    if (config.mode === MODES.PUZZLE) return puzzleDone === null;
    if (config.mode === MODES.PVP) return true;
    return state.turn === config.humanSide;
  }

  function stats() {
    const log = state ? state.history : [];
    let maxHops = 0;
    for (const m of log) if (m.hops > maxHops) maxHops = m.hops;
    return {
      plies: log.length,
      maxHops,
      lastHops: log.length ? log[log.length - 1].hops : 0,
      redInCamp: state ? campCount(state.board, RED) : 0,
      blueInCamp: state ? campCount(state.board, BLUE) : 0,
    };
  }

  function finish() {
    const humanOutcome = config.mode === MODES.PUZZLE
      ? (puzzleDone?.solved ? OUTCOME.WIN : OUTCOME.LOSS)
      : config.mode === MODES.PVE
        ? (state.winner === config.humanSide ? OUTCOME.WIN : OUTCOME.LOSS)
        : null;
    finished = {
      mode: config.mode,
      winner: config.mode === MODES.PUZZLE ? (puzzleDone?.solved ? RED : 0) : state.winner,
      humanOutcome,
      plies: state.moveCount,
      maxHops: stats().maxHops,
      difficulty: config.difficulty,
      puzzle: puzzleDone ? { ...puzzleDone } : null,
    };
  }

  function commit(next) {
    snapshots.push(state);
    state = next;
    if (config.mode !== MODES.PUZZLE && state.status !== "playing") finish();
  }

  // A study is cleared when a red marble first reaches the golden hole. Using
  // more than par moves is a failure, but undo always reopens the position.
  function evaluatePuzzle() {
    const used = state.history.length;
    const solved = state.board[config.puzzle.goal] === RED;
    if (!solved && used < config.puzzle.par) return;
    puzzleDone = {
      ...config.puzzle,
      used,
      solved,
      stars: solved ? Math.max(1, 3 - Math.min(2, undoCount)) : 0,
    };
    finish();
  }

  async function scheduleAI() {
    if (config.mode !== MODES.PVE) return;
    if (state.status !== "playing") return;
    if (state.turn !== config.aiSide) return;

    thinking = true;
    thinkingProgress = null;
    aiToken += 1;
    const token = aiToken;
    emit();

    const profile = DIFFICULTY_META[config.difficulty];
    const thinkMs = profile.minThinkMs + rng() * (profile.maxThinkMs - profile.minThinkMs);
    const started = Date.now();

    let move = null;
    try {
      move = await ai(state, {
        difficulty: config.difficulty,
        aiPlayer: config.aiSide,
        rng,
        onProgress: (candidates) => {
          if (token !== aiToken) return;
          thinkingProgress = candidates;
          emit();
        },
      });
    } catch {
      move = null;
    }

    if (token !== aiToken) return;

    const remaining = Math.max(0, thinkMs - (Date.now() - started));
    timer = schedule(() => {
      timer = null;
      if (token !== aiToken) return;
      thinking = false;
      thinkingProgress = null;
      if (move && state.status === "playing" && state.turn === config.aiSide) {
        const next = applyMove(state, move);
        if (next !== state) commit(next);
      }
      emit();
    }, remaining);
  }

  function start(next = {}) {
    invalidateAI();
    const puzzleValid = next.mode === MODES.PUZZLE && next.engineState && next.puzzle
      && Number.isInteger(next.puzzle.par) && next.puzzle.par >= 1 && next.puzzle.par <= 3
      && Number.isInteger(next.puzzle.goal)
      && next.puzzle.goal >= 0 && next.puzzle.goal < HOLE_COUNT;
    const mode = puzzleValid ? MODES.PUZZLE
      : (next.mode === MODES.PVP ? MODES.PVP : MODES.PVE);
    const difficulty = DIFFICULTY_META[next.difficulty]
      ? next.difficulty
      : (config?.difficulty ?? DIFFICULTY_INTERMEDIATE);
    const humanSide = next.humanSide === BLUE ? BLUE : RED;

    config = {
      mode,
      difficulty,
      humanSide,
      aiSide: otherPlayer(humanSide),
      puzzle: puzzleValid ? { ...next.puzzle } : null,
    };
    state = next.engineState ? cloneState(next.engineState) : createInitialState();
    initialState = cloneState(state);
    snapshots = [];
    finished = null;
    puzzleDone = null;
    undoCount = 0;
    if (mode !== MODES.PUZZLE && state.status !== "playing") finish();

    emit();
    scheduleAI();
    return view();
  }

  function restart() {
    if (config?.mode === MODES.PUZZLE && config.puzzle && initialState) {
      return start({
        mode: MODES.PUZZLE,
        difficulty: config.difficulty,
        humanSide: config.humanSide,
        engineState: initialState,
        puzzle: config.puzzle,
      });
    }
    return start();
  }

  // Replay a saved move list through the engine so a corrupt entry cannot
  // desynchronise the board; illegal entries are silently dropped.
  function restore(session) {
    if (!session) return null;
    invalidateAI();
    const mode = session.mode === MODES.PVP ? MODES.PVP : MODES.PVE;
    const difficulty = DIFFICULTY_META[session.difficulty]
      ? session.difficulty
      : DIFFICULTY_INTERMEDIATE;
    const humanSide = session.humanSide === BLUE ? BLUE : RED;
    config = { mode, difficulty, humanSide, aiSide: otherPlayer(humanSide), puzzle: null };
    state = session.engineState ? cloneState(session.engineState) : createInitialState();
    initialState = cloneState(state);
    snapshots = [];
    finished = null;
    puzzleDone = null;
    undoCount = 0;

    for (const move of session.moves ?? []) {
      const nextState = applyMove(state, move);
      if (nextState === state) break;
      commit(nextState);
    }
    if (state.status !== "playing") finish();
    emit();
    scheduleAI();
    return view();
  }

  function play(move) {
    if (!isHumanTurn() || !move) return false;
    if (typeof move.from !== "number" || typeof move.to !== "number") return false;
    if (config.mode === MODES.PUZZLE) {
      const nextState = applySoloMove(state, move, RED);
      if (nextState === state) return false;
      commit(nextState);
      evaluatePuzzle();
      emit();
      return true;
    }
    const nextState = applyMove(state, move);
    if (nextState === state) return false;
    commit(nextState);
    emit();
    scheduleAI();
    return true;
  }

  // In PVE one undo rolls back the player's move AND the AI reply, so the
  // player never ends up controlling the AI's marbles. While the AI is still
  // thinking there is no reply yet, so only one snapshot is popped.
  function undo() {
    if (!state) return false;
    if (config.mode === MODES.PUZZLE) {
      if (!snapshots.length) return false;
      invalidateAI();
      state = snapshots.pop();
      finished = null;
      puzzleDone = null;
      undoCount += 1;
      emit();
      return true;
    }
    if (state.status !== "playing") return false;
    const pending = thinking;
    const needed = pending ? 1 : (config.mode === MODES.PVE ? 2 : 1);
    if (snapshots.length < needed) return false;
    invalidateAI();
    let restored = null;
    for (let i = 0; i < needed; i += 1) restored = snapshots.pop();
    state = restored;
    finished = null;
    emit();
    return true;
  }

  function setDifficulty(difficulty) {
    if (!config || config.mode === MODES.PUZZLE || !DIFFICULTY_META[difficulty]) return false;
    config.difficulty = difficulty;
    emit();
    return true;
  }

  function targetsFrom(hole) {
    if (!isHumanTurn()) return [];
    if (hole < 0 || hole >= HOLE_COUNT) return [];
    if (state.board[hole] !== state.turn) return [];
    return legalMovesFrom(state, hole);
  }

  function currentMoves() {
    if (!isHumanTurn()) return [];
    return legalMoves(state, state.turn);
  }

  function getMoveLog() {
    if (!state) return [];
    return state.history.map((m, i) => ({ ply: i + 1, ...m }));
  }

  function view() {
    const puzzle = config?.mode === MODES.PUZZLE && config.puzzle
      ? {
        ...config.puzzle,
        used: state ? state.history.length : 0,
        left: Math.max(0, config.puzzle.par - (state ? state.history.length : 0)),
        solved: puzzleDone?.solved ?? false,
        failed: puzzleDone ? !puzzleDone.solved : false,
        stars: puzzleDone?.stars ?? 0,
        undoCount,
      }
      : null;
    return {
      state,
      config: config ? { ...config } : null,
      puzzle,
      thinking,
      thinkingProgress,
      humanTurn: isHumanTurn(),
      canUndo: config?.mode === MODES.PUZZLE
        ? snapshots.length >= 1
        : (!thinking && state?.status === "playing"
          && snapshots.length >= (config.mode === MODES.PVE ? 2 : 1)),
      finished: finished ? { ...finished } : null,
      lastMove: state?.history.length ? state.history[state.history.length - 1] : null,
      stats: stats(),
    };
  }

  function result() {
    return finished ? { ...finished } : null;
  }

  function destroy() { invalidateAI(); }

  return {
    start,
    restart,
    restore,
    play,
    undo,
    setDifficulty,
    targetsFrom,
    currentMoves,
    getMoveLog,
    view,
    result,
    destroy,
  };
}
