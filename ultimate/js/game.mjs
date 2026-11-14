// 对局控制器：同屏双人 / 人机对弈 / 21 关残局。DOM-free，调度器可注入，node 可直接测。
// 所有规则判断都交给 engine，所有 AI 决策都交给 ai；这里只负责回合流转、悔棋栈与结算原料。

import {
  MARK_O, MARK_X, STATUS_PLAYING, WILDCARD,
  applyMove, createEmptyState, other, replay,
} from "./engine.mjs";
import { chooseMove } from "./ai.mjs";
import { MODES } from "./storage.mjs";
import { PUZZLE_BY_ID, createPuzzleState } from "./puzzles.mjs";
import { outcomeOf } from "./score.mjs";

export const AI_DELAY_MIN_MS = 260;
export const AI_DELAY_RANGE_MS = 240;
export const DEFENDER_TIER = "master";

export function createGameController(options = {}) {
  const ai = options.ai ?? chooseMove;
  const rng = options.rng ?? Math.random;
  const schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const cancel = options.cancel ?? ((handle) => clearTimeout(handle));

  let onChange = options.onChange ?? (() => {});
  let config = null;
  let state = null;
  let puzzle = null;
  let snapshots = [];
  let thinking = false;
  let timer = null;
  let lastMove = -1;
  let finished = null;
  let used = 0;

  const emit = () => onChange(view());

  function clearTimer() {
    if (timer !== null) {
      cancel(timer);
      timer = null;
    }
  }

  function humanControlled() {
    if (!state || state.status !== STATUS_PLAYING) return false;
    if (config.pvp) return true;
    return state.current === config.humanMark;
  }

  function aiMark() {
    return config.mode === MODES.CAMPAIGN ? MARK_O : other(config.humanMark);
  }

  function finishIfOver() {
    if (!state || state.status === STATUS_PLAYING) return false;
    const outcome = config.pvp ? null : outcomeOf(state, config.humanMark);
    let stars = 0;
    if (config.mode === MODES.CAMPAIGN) {
      if (outcome === "win") {
        stars = used <= puzzle.par ? 3 : used <= puzzle.par + 1 ? 2 : 1;
      }
    }
    finished = {
      outcome,
      winner: state.winner,
      used,
      par: puzzle ? puzzle.par : null,
      stars,
      mode: config.mode,
    };
    return true;
  }

  function scheduleAI() {
    if (!state || state.status !== STATUS_PLAYING) return;
    if (config.pvp) return;
    if (state.current !== aiMark()) return;

    thinking = true;
    emit();
    const delay = config.mode === MODES.CAMPAIGN ? AI_DELAY_MIN_MS : AI_DELAY_MIN_MS + rng() * AI_DELAY_RANGE_MS;
    timer = schedule(() => {
      timer = null;
      thinking = false;
      const tier = config.mode === MODES.CAMPAIGN ? DEFENDER_TIER : config.tier;
      const move = ai(state, { tier, aiMark: aiMark(), rng });
      if (move >= 0) {
        const next = applyMove(state, move);
        if (next !== state) {
          state = next;
          lastMove = move;
          finishIfOver();
        }
      }
      emit();
    }, delay);
  }

  function start(next = {}) {
    clearTimer();
    const mode = next.mode ?? config?.mode ?? MODES.DUEL;
    const tier = next.tier ?? config?.tier ?? "duelist";
    const pvp = mode === MODES.DUEL ? Boolean(next.pvp ?? config?.pvp) : false;
    const puzzleId = next.puzzleId ?? config?.puzzleId ?? null;

    config = {
      mode,
      tier,
      pvp,
      humanMark: MARK_X,
      puzzleId: mode === MODES.CAMPAIGN ? puzzleId ?? PUZZLE_BY_ID.u01?.id ?? null : null,
    };
    puzzle = config.mode === MODES.CAMPAIGN ? PUZZLE_BY_ID[config.puzzleId] ?? null : null;
    state = puzzle ? createPuzzleState(puzzle) : createEmptyState();
    snapshots = [];
    thinking = false;
    lastMove = -1;
    finished = null;
    used = 0;

    emit();
    scheduleAI();
    return view();
  }

  // 从存档恢复：只回放落子序列；非法步被 engine 静默丢弃，坏档最多退化成开局。
  function restore(session) {
    if (!session) return null;
    clearTimer();
    const mode = session.mode === MODES.CAMPAIGN ? MODES.CAMPAIGN : MODES.DUEL;
    const puzzleId = mode === MODES.CAMPAIGN ? session.puzzleId : null;
    const puzzleData = puzzleId ? PUZZLE_BY_ID[puzzleId] : null;
    if (mode === MODES.CAMPAIGN && !puzzleData) return null;

    config = {
      mode,
      tier: session.tier ?? "duelist",
      pvp: mode === MODES.DUEL ? Boolean(session.pvp) : false,
      humanMark: MARK_X,
      puzzleId: puzzleData ? puzzleData.id : null,
    };
    puzzle = puzzleData ?? null;
    const base = puzzle ? createPuzzleState(puzzle) : createEmptyState();
    state = replay(
      { cells: base.cells, active: base.active, current: base.current },
      session.moves ?? [],
    ) ?? base;

    snapshots = [];
    thinking = false;
    lastMove = state.moves.length ? state.moves[state.moves.length - 1] : -1;
    used = countHumanMoves(state, config);
    finished = null;
    finishIfOver();

    emit();
    scheduleAI();
    return view();
  }

  function play(index) {
    if (!state || thinking || !humanControlled()) return false;
    const next = applyMove(state, index);
    if (next === state) return false;

    snapshots.push({ state, used });
    state = next;
    lastMove = index;
    used = countHumanMoves(state, config);
    finishIfOver();

    emit();
    scheduleAI();
    return true;
  }

  // 悔棋：pve / 残局下一次撤销会连同 AI 的应手一起回退，回到玩家上一次决策点。
  function undo() {
    clearTimer();
    thinking = false;
    if (!state || state.status !== STATUS_PLAYING || !snapshots.length) return false;
    const snapshot = snapshots.pop();
    state = snapshot.state;
    used = snapshot.used;
    lastMove = -1;
    finished = null;
    emit();
    return true;
  }

  function hint() {
    if (!state || state.status !== STATUS_PLAYING || !humanControlled()) return -1;
    return ai(state, { tier: "master", aiMark: config.humanMark, rng });
  }

  function view() {
    return {
      state,
      config,
      puzzle,
      thinking,
      canUndo: !thinking && snapshots.length > 0 && Boolean(state) && state.status === STATUS_PLAYING,
      lastMove,
      finished,
      humanTurn: humanControlled(),
      used,
      par: puzzle ? puzzle.par : null,
      active: state ? state.active : WILDCARD,
    };
  }

  return {
    start,
    restore,
    play,
    undo,
    hint,
    view,
    setOnChange(fn) {
      onChange = fn;
    },
    destroy() {
      clearTimer();
    },
  };
}

function countHumanMoves(state, config) {
  if (!state) return 0;
  if (config.mode === MODES.CAMPAIGN) {
    let count = 0;
    for (const index of state.moves) {
      const mark = state.cells[index];
      if (mark === config.humanMark) count += 1;
    }
    return count;
  }
  return state.moves.length;
}
