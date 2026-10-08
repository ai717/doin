// game.mjs —— DOM-free 状态控制器：接收 UI 意图，调度 engine，处理模式/计分/终局，派发事件。
import {
  createState,
  drawPiece,
  placeAndClear,
  isBoardStuck,
  shapeCells,
  cellKey,
  inBoard,
  MODE,
  RADIUS,
  snapshot,
} from "./engine.mjs";
import { randomSeed } from "./rng.mjs";
import { levelById, seedForLevel, starsForLevel, STAR_MAX } from "./levels.mjs";
import { totalMultiplier, scoreFor } from "./score.mjs";

export const FIXED_DT = 1 / 120;
const MAX_STEPS = 240;

export function createGame() {
  let state = null;
  let mode = MODE.SURVIVAL;
  let level = null;
  let lastClearRows = 0;
  const listeners = new Set();

  function emit(type, payload = {}) {
    for (const fn of listeners) {
      try { fn(type, payload); } catch { /* single listener fail-safe */ }
    }
  }

  function numSeed(seedInput) {
    return Number.isFinite(seedInput) ? seedInput >>> 0 : randomSeed();
  }

  function startCampaign(levelId, seedInput) {
    const lvl = levelById(levelId);
    if (!lvl) return null;
    mode = MODE.CAMPAIGN;
    level = lvl;
    state = createState({
      seed: numSeed(seedInput ?? seedForLevel(levelId)),
      mode,
      level: { id: lvl.id, pieces: lvl.pieces, goalRows: lvl.goalRows },
    });
    drawPiece(state);
    emit("start", { mode, view: view() });
    return view();
  }

  function startSurvival(seedInput) {
    mode = MODE.SURVIVAL;
    level = null;
    state = createState({ seed: numSeed(seedInput), mode });
    drawPiece(state);
    emit("start", { mode, view: view() });
    return view();
  }

  function startDuel(seedInput) {
    mode = MODE.DUEL;
    level = null;
    state = createState({ seed: numSeed(seedInput), mode });
    state.currentPlayer = 1;
    drawPiece(state);
    emit("start", { mode, view: view() });
    return view();
  }

  // ------------------------------------------------------------ 放置

  /**
   * 尝试在 (q, r) 放置当前块（anchor 为形状首格）。
   * 返回 { ok, rowsCleared, scoreGain, rushTriggered }
   */
  function place(q, r) {
    if (!state || state.gameOver || !state.current) return { ok: false };
    const { shapeId, rotation } = state.current;
    const res = placeAndClear(state, shapeId, rotation, q, r);
    if (!res.placed) return { ok: false };
    lastClearRows = res.rowsCleared;
    if (res.rowsCleared > 0) {
      emit("clear", { rows: res.rowsCleared, scoreGain: res.scoreGain, rushTriggered: res.rushTriggered, view: view() });
    }
    if (state.gameOver) {
      emit("end", { result: result() });
    } else if (isBoardStuck(state)) {
      state.gameOver = true;
      if (mode === MODE.DUEL) {
        state.winner = state.currentPlayer === 1 ? 2 : 1;
      }
      emit("end", { result: result() });
    }
    return { ok: true, ...res };
  }

  function rotate(dir = 1) {
    if (!state || state.gameOver || !state.current) return false;
    const step = dir === -1 ? -1 : 1;
    state.current.rotation = ((state.current.rotation + step) % 6 + 6) % 6;
    emit("rotate", { view: view() });
    return true;
  }

  /** 预览某位置放置是否合法（不改变状态） */
  function canPlaceAt(q, r) {
    if (!state || !state.current) return false;
    const cells = shapeCells(state.current.shapeId, state.current.rotation);
    for (const [dq, dr] of cells) {
      const qq = q + dq;
      const rr = r + dr;
      if (!inBoard(qq, rr) || state.occupied[cellKey(qq, rr)]) return false;
    }
    return true;
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
      // engine stepFrame 只推进粒子/事件
      acc -= FIXED_DT;
      steps += 1;
    }
    acc = Math.min(acc, FIXED_DT * MAX_STEPS);
  }

  // ------------------------------------------------------------ 视图

  function view() {
    if (!state) return null;
    return snapshot(state);
  }

  function result() {
    if (!state) return null;
    if (mode === MODE.CAMPAIGN) {
      const stars = state.goalMet ? starsForLevel(level, state.piecesRemaining, true) : 0;
      return {
        mode,
        levelId: level?.id,
        goalMet: state.goalMet,
        rowsCleared: state.rowsCleared,
        score: state.score,
        maxMultiplier: state.maxMultiplier,
        piecesRemaining: state.piecesRemaining,
        stars,
      };
    }
    if (mode === MODE.DUEL) {
      return {
        mode,
        winner: state.winner,
        score: state.score,
        rowsCleared: state.rowsCleared,
        maxMultiplier: state.maxMultiplier,
      };
    }
    return {
      mode,
      score: state.score,
      rowsCleared: state.rowsCleared,
      maxMultiplier: state.maxMultiplier,
    };
  }

  function diagnose() {
    if (!state) return null;
    return {
      mode,
      seed: state.seed,
      score: state.score,
      rowsCleared: state.rowsCleared,
      multiplier: state.multiplier,
      rushActive: state.rushActive,
      rushCombo: state.rushCombo,
      piecesPlaced: state.piecesPlaced,
      gameOver: state.gameOver,
      occupiedCount: Object.keys(state.occupied).length,
    };
  }

  return {
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    startCampaign,
    startSurvival,
    startDuel,
    tick,
    place,
    rotate,
    canPlaceAt,
    view,
    result,
    diagnose,
    isActive: () => state !== null && !state.gameOver,
  };
}
