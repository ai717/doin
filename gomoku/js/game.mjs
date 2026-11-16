// DOM-free 状态控制器：模式流转 / AI 调度 / 悔棋 / 残局正解校验 / 结算。
// 不碰 DOM，不读写 storage —— 依赖注入。

import {
  BLACK, EMPTY, WHITE, STATUS_PLAYING, STATUS_WON, STATUS_FORBIDDEN, STATUS_DRAW,
  applyMove, createState, other,
} from "./engine.mjs";
import { chooseMoveAsync, DIFFICULTY_META } from "./ai.mjs";
import { MODES } from "./storage.mjs";
import { TSUMEGO } from "./tsumego.mjs";
import {
  OUTCOME_WIN, OUTCOME_LOSS, OUTCOME_DRAW,
  tsumegoStars, emptyCount, movesPlayed,
} from "./score.mjs";

export const THINK_MIN_MS = 400;
export const THINK_RANGE_MS = 600;

let tsumegoDB = TSUMEGO;
export function setTsumegoDatabase(db) { tsumegoDB = db; }
export function getTsumego(id) {
  return tsumegoDB.find((p) => p.id === id) || null;
}

export function createGameController(options = {}) {
  const ai = options.ai ?? chooseMoveAsync;
  const rng = options.rng ?? Math.random;
  const schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const cancel = options.cancel ?? ((h) => clearTimeout(h));

  let onChange = options.onChange ?? (() => {});
  let config = null;
  let state = null;
  let snapshots = [];
  let thinking = false;
  let thinkingProgress = null;
  let timer = null;
  let aiToken = 0;
  let finished = null;
  let wrongRetryCount = 0;
  let solvedFlag = false;
  let currentPuzzle = null;

  function emit() { onChange(view()); }
  function clearTimer() {
    if (timer !== null) { cancel(timer); timer = null; }
  }

  function isHumanTurn() {
    if (!state || state.status !== STATUS_PLAYING) return false;
    if (config.mode === MODES.PVP || config.mode === MODES.FREE) return true;
    if (config.mode === MODES.TSUMEGO) return state.current === config.tsumego.firstPlayer;
    return state.current === config.humanMark;
  }

  function finish() {
    if (config.mode === MODES.TSUMEGO) {
      finished = {
        mode: "tsumego",
        solved: solvedFlag,
        movesUsed: state.moves.length,
        par: config.tsumego?.parMoves || 1,
        wrongRetryCount,
        target: config.tsumego?.target || "win",
      };
      return;
    }
    if (config.mode === MODES.PVP || config.mode === MODES.FREE) {
      finished = { mode: config.mode, outcome: null };
      return;
    }
    const outcome = outcomeOf(state, config.humanMark);
    finished = {
      mode: "pve",
      outcome,
      empty: emptyCount(state),
      difficulty: config.difficulty,
    };
  }

  function outcomeOf(s, human) {
    if (s.status === STATUS_WON || s.status === STATUS_FORBIDDEN) {
      return s.winner === human ? OUTCOME_WIN : OUTCOME_LOSS;
    }
    if (s.status === STATUS_DRAW) return OUTCOME_DRAW;
    return null;
  }

  async function scheduleAI() {
    if (config.mode !== MODES.PVE) return;
    if (state.status !== STATUS_PLAYING) return;
    if (state.current !== config.aiMark) return;

    thinking = true;
    thinkingProgress = null;
    aiToken += 1;
    const token = aiToken;
    emit();

    const profile = DIFFICULTY_META[config.difficulty];
    const thinkMs = profile.minThinkMs + rng() * (profile.maxThinkMs - profile.minThinkMs);
    const startStamp = Date.now();

    // 立即启动 AI 异步分块运算，实时派发思考进度
    let move;
    try {
      move = await ai(state, {
        difficulty: config.difficulty,
        aiPlayer: config.aiMark,
        rng,
        onProgress: (p) => {
          if (token !== aiToken) return;
          thinkingProgress = p;
          emit();
        },
      });
    } catch {
      move = -1;
    }

    if (token !== aiToken) return;

    // 维持最小思考时长，呈现思考微动感
    const elapsed = Date.now() - startStamp;
    const remaining = Math.max(0, thinkMs - elapsed);

    timer = schedule(() => {
      timer = null;
      if (token !== aiToken) return;

      thinking = false;
      thinkingProgress = null;

      if (move >= 0 && state.status === STATUS_PLAYING && state.current === config.aiMark) {
        const next = applyMove(state, move);
        if (next !== state) {
          snapshots.push(state);
          state = next;
          if (state.status !== STATUS_PLAYING) finish();
        }
      }
      emit();
    }, remaining);
  }

  function start(next = {}) {
    clearTimer();
    aiToken += 1;
    thinking = false;
    thinkingProgress = null;
    finished = null;
    wrongRetryCount = 0;
    solvedFlag = false;
    currentPuzzle = null;

    const mode = next.mode ?? config?.mode ?? MODES.PVE;
    const difficulty = next.difficulty ?? config?.difficulty ?? "intermediate";
    const humanMark = next.humanMark ?? BLACK;
    const aiMark = other(humanMark);
    const firstPlayer = next.firstPlayer ?? BLACK;

    if (mode === MODES.TSUMEGO) {
      const puzzle = getTsumego(next.puzzleId ?? 1);
      if (!puzzle) {
        config = { mode, difficulty, humanMark, aiMark, firstPlayer, tsumego: null };
        state = createState({ firstPlayer });
      } else {
        currentPuzzle = puzzle;
        config = {
          mode, difficulty, humanMark, aiMark,
          firstPlayer: puzzle.firstPlayer,
          tsumego: {
            id: puzzle.id,
            parMoves: puzzle.parMoves,
            target: puzzle.target,
            firstPlayer: puzzle.firstPlayer,
            presetMovesCount: puzzle.preset.length,
          },
        };
        state = createState({
          preset: puzzle.preset,
          firstPlayer: puzzle.firstPlayer,
          current: puzzle.firstPlayer,
          tsumego: config.tsumego,
        });
      }
      snapshots = [];
      emit();
      return view();
    }

    config = { mode, difficulty, humanMark, aiMark, firstPlayer, tsumego: null };
    state = createState({ firstPlayer });
    snapshots = [];
    emit();
    scheduleAI();
    return view();
  }

  function restore(session) {
    if (!session) return null;
    clearTimer();
    aiToken += 1;
    thinking = false;
    thinkingProgress = null;
    finished = null;
    wrongRetryCount = 0;
    solvedFlag = false;
    currentPuzzle = null;

    config = {
      mode: session.mode ?? MODES.PVE,
      difficulty: session.difficulty ?? "intermediate",
      humanMark: session.firstPlayer === 2 ? WHITE : BLACK,
      aiMark: session.firstPlayer === 2 ? BLACK : WHITE,
      firstPlayer: session.firstPlayer ?? BLACK,
      tsumego: session.tsumego ?? null,
    };

    if (config.mode === MODES.TSUMEGO && session.tsumego) {
      const puzzle = getTsumego(session.tsumego.id);
      if (puzzle) {
        currentPuzzle = puzzle;
        config.tsumego = { ...session.tsumego, firstPlayer: puzzle.firstPlayer };
        state = createState({
          preset: puzzle.preset,
          firstPlayer: puzzle.firstPlayer,
          current: puzzle.firstPlayer,
          tsumego: config.tsumego,
        });
        // 回放 moves
        const moves = Array.isArray(session.moves) ? session.moves : [];
        for (const m of moves) {
          const n = applyMove(state, m);
          if (n !== state) state = n;
        }
      } else {
        state = createState({ firstPlayer: config.firstPlayer });
      }
    } else {
      state = createState({
        firstPlayer: config.firstPlayer,
        moves: Array.isArray(session.moves) ? session.moves : [],
      });
    }

    snapshots = [];
    if (state.status !== STATUS_PLAYING) finish();
    emit();
    scheduleAI();
    return view();
  }

  function play(index) {
    if (!state || thinking || !isHumanTurn()) return false;

    if (config.mode === MODES.TSUMEGO && currentPuzzle) {
      return playTsumego(index);
    }

    const next = applyMove(state, index);
    if (next === state) return false;

    snapshots.push(state);
    state = next;
    if (state.status !== STATUS_PLAYING) finish();
    emit();
    scheduleAI();
    return true;
  }

  function playTsumego(index) {
    const puzzle = currentPuzzle;
    const expectedIdx = state.moves.length;
    const expectedMove = puzzle.mainLine[expectedIdx];

    if (index !== expectedMove) {
      // 错着：不实际落子，提示"此手不利"，可重选
      wrongRetryCount += 1;
      emit();
      return "wrong";
    }

    // 应用黑方（玩家）正解
    const after = applyMove(state, index);
    if (after === state) return false;
    snapshots.push(state);
    state = after;

    // 检查是否制胜（win 题）
    if (state.status === STATUS_WON && state.winner === puzzle.firstPlayer) {
      solvedFlag = true;
      finish();
      emit();
      return true;
    }
    if (state.status === STATUS_FORBIDDEN && state.winner === puzzle.firstPlayer) {
      solvedFlag = true;
      finish();
      emit();
      return true;
    }
    if (state.status !== STATUS_PLAYING) {
      // 异常结束（非预期）
      finish();
      emit();
      return true;
    }

    // 自动应用白方应着
    const whiteMove = puzzle.mainLine[expectedIdx + 1];
    if (whiteMove !== undefined) {
      const afterWhite = applyMove(state, whiteMove);
      if (afterWhite !== state) {
        state = afterWhite;
        if (state.status !== STATUS_PLAYING) {
          // 白方应着后结束（可能白方失着或意外结果）
          if (puzzle.target === "win" && state.winner === puzzle.firstPlayer) {
            solvedFlag = true;
          }
          finish();
          emit();
          return true;
        }
      }
    } else {
      // mainLine 已走完，但状态未结束
      if (puzzle.target === "draw") {
        solvedFlag = true;
      }
      finish();
      emit();
      return true;
    }

    emit();
    return true;
  }

  function undo() {
    clearTimer();
    if (!state || state.status !== STATUS_PLAYING) return false;
    if (config.mode === MODES.TSUMEGO) return false;
    if (config.mode === MODES.PVE) {
      if (snapshots.length < 2) return false;
      snapshots.pop();
      state = snapshots.pop();
    } else {
      if (!snapshots.length) return false;
      state = snapshots.pop();
    }
    thinking = false;
    thinkingProgress = null;
    finished = null;
    aiToken += 1;
    emit();
    return true;
  }

  function resign() {
    if (!state || state.status !== STATUS_PLAYING) return false;
    if (config.mode === MODES.TSUMEGO) {
      finished = {
        mode: "tsumego",
        solved: false,
        movesUsed: state.moves.length,
        par: config.tsumego?.parMoves || 1,
        wrongRetryCount,
        target: config.tsumego?.target || "win",
      };
    } else if (config.mode === MODES.PVE) {
      state = { ...state, status: STATUS_WON, winner: config.aiMark, current: EMPTY };
      finished = {
        mode: "pve",
        outcome: OUTCOME_LOSS,
        empty: emptyCount(state),
        difficulty: config.difficulty,
      };
    } else {
      const loser = state.current;
      state = { ...state, status: STATUS_WON, winner: other(loser), current: EMPTY };
      finished = { mode: config.mode, outcome: null };
    }
    aiToken += 1;
    emit();
    return true;
  }

  function view() {
    return {
      state,
      config,
      thinking,
      thinkingProgress,
      canUndo: !thinking && snapshots.length > 0 && Boolean(state) && state.status === STATUS_PLAYING && config.mode !== MODES.TSUMEGO,
      lastMove: state ? state.lastMove : -1,
      finished,
      humanTurn: isHumanTurn(),
      wrongRetryCount,
      solvedFlag,
      currentPuzzle,
    };
  }

  function result() {
    if (!finished) return null;
    if (finished.mode === "tsumego") {
      return {
        mode: "tsumego",
        solved: finished.solved,
        stars: finished.solved
          ? tsumegoStars(true, finished.movesUsed, finished.par, finished.wrongRetryCount > 0)
          : 0,
        movesUsed: finished.movesUsed,
        par: finished.par,
        wrongRetryCount: finished.wrongRetryCount,
      };
    }
    if (finished.mode === "pve") {
      return { mode: "pve", outcome: finished.outcome, difficulty: finished.difficulty };
    }
    return { mode: finished.mode };
  }

  function getSolution() {
    if (config?.mode === MODES.TSUMEGO && currentPuzzle) {
      return currentPuzzle.mainLine || [];
    }
    return [];
  }

  return {
    start, restore, play, undo, resign, view, result, getSolution,
    setOnChange(fn) { onChange = fn; },
    destroy() { clearTimer(); },
  };
}
