// 对局控制器：模式 / 回合流转 / AI 调度 / 悔棋 / 结算原料。
// 完全不碰 DOM、不读写 storage —— 依赖全部靠注入，因此可以在 node 里直接测。

import { PLAYER_O, PLAYER_X, STATUS_PLAYING, applyMove, createState, other, replay } from "./engine.mjs";
import { chooseMove } from "./ai.mjs";
import { MODES } from "./storage.mjs";
import { countEmpty, outcomeOf, scoreResult } from "./score.mjs";

export const THINK_MIN_MS = 250;
export const THINK_RANGE_MS = 300;
export const THINK_MAX_MS = THINK_MIN_MS + THINK_RANGE_MS;

export function createGameController(options = {}) {
  const ai = options.ai ?? chooseMove;
  const rng = options.rng ?? Math.random;
  const schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const cancel = options.cancel ?? ((handle) => clearTimeout(handle));

  let onChange = options.onChange ?? (() => {});
  let config = null;
  let state = null;
  let snapshots = [];
  let thinking = false;
  let timer = null;
  let lastMove = -1;
  let finished = null;

  function emit() {
    onChange(view());
  }

  function clearTimer() {
    if (timer !== null) {
      cancel(timer);
      timer = null;
    }
  }

  function isHumanTurn() {
    if (!state || state.status !== STATUS_PLAYING) return false;
    return config.mode === MODES.PVP || state.current === config.humanMark;
  }

  function finish() {
    const outcome = config.mode === MODES.PVP ? null : outcomeOf(state, config.humanMark);
    finished = { outcome, empty: countEmpty(state), difficulty: config.difficulty };
  }

  function scheduleAI() {
    if (config.mode !== MODES.PVE) return;
    if (state.status !== STATUS_PLAYING) return;
    if (state.current !== config.aiMark) return;

    thinking = true;
    emit();
    timer = schedule(() => {
      timer = null;
      thinking = false;
      const move = ai(state, { difficulty: config.difficulty, aiPlayer: config.aiMark, rng });
      if (move >= 0) {
        const next = applyMove(state, move);
        if (next !== state) {
          state = next;
          lastMove = move;
          if (state.status !== STATUS_PLAYING) finish();
        }
      }
      emit();
    }, THINK_MIN_MS + rng() * THINK_RANGE_MS);
  }

  // 未显式指定先手时，每局自动轮换 —— 4x4 先手优势极大，固定先手会让连胜退化成掷硬币。
  function start(next = {}) {
    clearTimer();
    const size = next.size ?? config?.size ?? 3;
    const mode = next.mode ?? config?.mode ?? MODES.PVE;
    const difficulty = next.difficulty ?? config?.difficulty ?? "normal";
    const firstPlayer =
      next.firstPlayer ?? (config?.firstPlayer ? other(config.firstPlayer) : PLAYER_X);

    config = { size, winLength: size, mode, difficulty, humanMark: PLAYER_X, aiMark: PLAYER_O, firstPlayer };
    state = createState(config);
    snapshots = [];
    thinking = false;
    lastMove = -1;
    finished = null;

    emit();
    scheduleAI();
    return view();
  }

  // 从存档恢复：落子序列回放。非法步由 engine.replay 静默丢弃。
  function restore(session) {
    if (!session) return null;
    clearTimer();
    config = {
      size: session.size,
      winLength: session.winLength ?? session.size,
      mode: session.mode ?? MODES.PVE,
      difficulty: session.difficulty ?? "normal",
      humanMark: PLAYER_X,
      aiMark: session.aiMark === PLAYER_X ? PLAYER_X : PLAYER_O,
      firstPlayer: session.firstPlayer ?? PLAYER_X,
    };
    state = replay(config, session.moves ?? []);
    snapshots = [];
    thinking = false;
    lastMove = state.moves.length ? state.moves[state.moves.length - 1] : -1;
    finished = state.status === STATUS_PLAYING ? null : { outcome: outcomeOf(state, config.humanMark), empty: countEmpty(state), difficulty: config.difficulty };

    emit();
    scheduleAI();
    return view();
  }

  function play(index) {
    if (!state || thinking || !isHumanTurn()) return false;
    const next = applyMove(state, index);
    if (next === state) return false;

    snapshots.push(state);
    state = next;
    lastMove = index;
    if (state.status !== STATUS_PLAYING) finish();

    emit();
    scheduleAI();
    return true;
  }

  // 悔棋栈里只压"等待人类决策"的局面，所以 pve 下弹一次正好撤销
  // "玩家那一手 + AI 的回应"，不会把 AI 的回合拆开。
  function undo() {
    clearTimer();
    // 与 canUndo 保持一致：终局后想重来就开新局，不允许把已经结算的一局拆回去
    if (!state || state.status !== STATUS_PLAYING) return false;
    if (!snapshots.length) return false;
    state = snapshots.pop();
    lastMove = -1;
    thinking = false;
    finished = null;
    emit();
    return true;
  }

  function view() {
    return {
      state,
      config,
      thinking,
      canUndo: !thinking && snapshots.length > 0 && Boolean(state) && state.status === STATUS_PLAYING,
      lastMove,
      finished,
      humanTurn: isHumanTurn(),
    };
  }

  // 结算：双人同屏不计分，人机按 outcome 出分。
  function result(streakBefore = 0) {
    if (!finished || !finished.outcome) return null;
    return {
      outcome: finished.outcome,
      score: scoreResult({
        outcome: finished.outcome,
        empty: finished.empty,
        streakBefore,
        difficulty: finished.difficulty,
      }),
    };
  }

  return {
    start,
    restore,
    play,
    undo,
    view,
    result,
    setOnChange(fn) {
      onChange = fn;
    },
    destroy() {
      clearTimer();
    },
  };
}
