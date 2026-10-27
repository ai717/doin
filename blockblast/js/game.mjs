// game.mjs —— DOM-free 对局控制器：接收 UI 意图，调度 engine，处理难度/终局/结算，派发事件。
// UI 永远只读 game.view()，不自行推导盘面；语言切换等 UI 层操作绝不经过本模块。
import {
  MODE,
  STATUS,
  applyIntent,
  createState,
  stepFrame,
  snapshot,
} from "./engine.mjs";
import { randomSeed } from "./rng.mjs";
import { difficultyById, DEFAULT_DIFFICULTY } from "./difficulty.mjs";

export const FIXED_DT = 1 / 120;
const MAX_STEPS = 240;

export function createGame() {
  let state = null;
  let difficulty = DEFAULT_DIFFICULTY;
  const listeners = new Set();

  function emit(type, payload = {}) {
    for (const fn of listeners) {
      try {
        fn(type, payload);
      } catch {
        /* 单个监听器失败不影响其他监听器与对局 */
      }
    }
  }

  function numSeed(seedInput) {
    return Number.isFinite(seedInput) ? seedInput >>> 0 : randomSeed();
  }

  /** 开始一局指定难度的无尽对局；不传种子则随机（同种子重开用于测试与复盘） */
  function startDifficulty(difficultyId, seedInput) {
    const diff = difficultyById(difficultyId) ?? difficultyById(DEFAULT_DIFFICULTY);
    difficulty = diff.id;
    state = createState({ seed: numSeed(seedInput), difficulty: diff.id });
    emit("start", { mode: MODE.CLASSIC, difficulty, view: view() });
    return view();
  }

  /** 重开：默认换新种子开新局；显式传种子则复现同一局（测试用） */
  function restart(seedInput) {
    return startDifficulty(difficulty, seedInput);
  }

  // ------------------------------------------------------------ 放置

  /**
   * 尝试放置队列第 slot 块（rotation 旋转）到锚点 (row, col)。
   * 返回 { ok, rowsCleared, cross, scoreGain }；非法/终局返回 { ok: false, reason }。
   */
  function place(slot, rotation, row, col) {
    if (!state || state.status !== STATUS.PLAYING) return { ok: false, reason: "over" };
    const before = state;
    const { state: next, action } = applyIntent(state, { type: "place", slot, rotation, row, col });
    if (!action) return { ok: false, reason: "illegal" };
    state = next;

    const clearEvent = next.events.find((e) => e.kind === "clear");
    if (clearEvent) {
      emit("clear", {
        rows: clearEvent.rows,
        cols: clearEvent.cols,
        cross: clearEvent.cross,
        lineCount: clearEvent.lineCount,
        scoreGain: clearEvent.gain,
        combo: next.combo,
        view: view(),
      });
    }
    if (before.board !== next.board && !clearEvent) {
      emit("place", { view: view() });
    }
    if (next.status === STATUS.OVER) {
      emit("end", { result: result() });
    }
    return {
      ok: true,
      rowsCleared: clearEvent ? clearEvent.lineCount : 0,
      cross: Boolean(clearEvent?.cross),
      scoreGain: clearEvent ? clearEvent.gain : 0,
      over: next.status === STATUS.OVER,
    };
  }

  // ------------------------------------------------------------ 帧推进

  let acc = 0;
  function tick(dt) {
    if (!state) return;
    const d = Number(dt);
    if (!Number.isFinite(d) || d <= 0) return;
    acc += d;
    let steps = 0;
    while (acc >= FIXED_DT && steps < MAX_STEPS) {
      state = stepFrame(state, FIXED_DT);
      acc -= FIXED_DT;
      steps += 1;
    }
    acc = Math.min(acc, FIXED_DT * MAX_STEPS);
  }

  // ------------------------------------------------------------ 视图与结算

  function view() {
    return state ? snapshot(state) : null;
  }

  function result() {
    if (!state) return null;
    return {
      mode: MODE.CLASSIC,
      difficulty,
      score: state.score,
      rowsCleared: state.rowsCleared,
      crossCount: state.crossCount,
      maxCombo: state.maxCombo,
      piecesPlaced: state.piecesPlaced,
      overReason: state.overReason,
    };
  }

  function diagnose() {
    if (!state) return null;
    return {
      mode: MODE.CLASSIC,
      difficulty,
      seed: state.seed,
      status: state.status,
      overReason: state.overReason,
      score: state.score,
      rowsCleared: state.rowsCleared,
      crossCount: state.crossCount,
      combo: state.combo,
      maxCombo: state.maxCombo,
      piecesPlaced: state.piecesPlaced,
      queue: state.queue.slice(),
      filled: state.board.reduce((n, v) => (v !== 0 ? n + 1 : n), 0),
    };
  }

  return {
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    startDifficulty,
    restart,
    place,
    tick,
    view,
    result,
    diagnose,
    isActive: () => state !== null && state.status === STATUS.PLAYING,
    currentDifficulty: () => difficulty,
  };
}
