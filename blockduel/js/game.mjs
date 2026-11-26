// 方块对轰 · DOM-free 双矩阵对局控制器。
// 负责两位选手的棋盘、重力与锁延时、垃圾行缓冲、攻防抵消、KO 与赛制流转，
// 以及单人天梯 AI 的“逐步操作”节奏。UI 只通过 input() / snapshot() / subscribe() 交互。

import {
  createBoard,
  spawnNext,
  holdPiece,
  moveSide,
  moveDown,
  hardDrop,
  rotatePiece,
  lockPiece,
  cancelPending,
  addIncoming,
  flushGarbage,
  ghostOf,
  LOCK_DELAY,
  mulberry32,
} from "./engine.mjs";
import { planPlacement, nextAiAction } from "./ai.mjs";
import { findStage, VERSUS_GRAVITY, winsNeeded } from "./levels.mjs";

export const MODE = Object.freeze({ SOLO: "solo", VERSUS: "versus" });
export const PHASE = Object.freeze({ PLAYING: "playing", ROUND_END: "round_end", SERIES_END: "series_end" });

const SOFT_INTERVAL = 55;

export class DuelGame {
  constructor(options = {}) {
    this.mode = options.mode === MODE.VERSUS ? MODE.VERSUS : MODE.SOLO;
    this.stageIndex = Number.isFinite(options.stage) ? Math.max(0, Math.min(21, Math.floor(options.stage))) : 0;
    this.bestOf = options.bestOf === 5 ? 5 : 3;
    this.baseSeed = Number.isFinite(options.seed) ? Math.floor(options.seed) : 1;
    this.listeners = [];
    this.paused = false;
    this.boards = [];
    this.ai = [{ plan: null, timer: 0, profile: null }, { plan: null, timer: 0, profile: null }];
    this.seriesWins = [0, 0];
    this.round = 1;
    this.phase = PHASE.PLAYING;
    this.winner = null;
    this.aiRng = mulberry32(this.baseSeed + 7919);
    this.resetSeries();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((fn) => fn !== listener);
    };
  }

  emit(event) {
    for (let i = 0; i < this.listeners.length; i += 1) {
      try {
        this.listeners[i](event);
      } catch {
        /* 监听器异常不得打断对局 */
      }
    }
  }

  get stage() {
    return findStage(this.stageIndex);
  }

  get targetWins() {
    return this.mode === MODE.SOLO ? 1 : winsNeeded(this.bestOf);
  }

  isAi(player) {
    return this.mode === MODE.SOLO && player === 1;
  }

  // ---------------------------------------------------------- 赛制

  resetSeries() {
    this.seriesWins = [0, 0];
    this.round = 1;
    this.winner = null;
    this.phase = PHASE.PLAYING;
    this.paused = false;
    this.resetBoards();
    this.emit({ type: "series_start", mode: this.mode, stage: this.stageIndex, bestOf: this.bestOf });
  }

  resetBoards() {
    const profile = this.stage;
    const humanGravity = this.mode === MODE.SOLO
      ? Math.max(160, Math.min(900, Math.round(profile.dropMs * 1.18)))
      : VERSUS_GRAVITY;
    const rivalGravity = this.mode === MODE.SOLO ? profile.dropMs : VERSUS_GRAVITY;
    this.boards = [
      createBoard({ seed: this.baseSeed + this.round * 131 + 11, gravity: humanGravity }),
      createBoard({ seed: this.baseSeed + this.round * 131 + 977, gravity: rivalGravity }),
    ];
    this.ai[0] = { plan: null, timer: 0, profile: null };
    this.ai[1] = {
      plan: null,
      timer: 0,
      profile: this.mode === MODE.SOLO ? profile : null,
    };
    this.boards.forEach((board) => {
      board.alarmSent = false;
      spawnNext(board);
    });
    if (this.ai[1].profile) this.planAi(1);
    this.emit({ type: "round_start", round: this.round });
  }

  setMode(mode) {
    const next = mode === MODE.VERSUS ? MODE.VERSUS : MODE.SOLO;
    if (next === this.mode) return;
    this.mode = next;
    this.resetSeries();
  }

  setStage(index) {
    const next = Math.max(0, Math.min(21, Math.floor(index)));
    if (next === this.stageIndex && this.phase === PHASE.PLAYING) return;
    this.stageIndex = next;
    this.resetSeries();
  }

  setBestOf(value) {
    this.bestOf = value === 5 ? 5 : 3;
    this.resetSeries();
  }

  togglePause(force) {
    const next = typeof force === "boolean" ? force : !this.paused;
    this.paused = next;
    return this.paused;
  }

  nextRound() {
    if (this.phase !== PHASE.ROUND_END) return false;
    this.round += 1;
    this.phase = PHASE.PLAYING;
    this.resetBoards();
    return true;
  }

  rematch() {
    this.resetSeries();
  }

  // ---------------------------------------------------------- 输入

  input(player, action) {
    if (this.phase !== PHASE.PLAYING || this.paused) return false;
    if (this.isAi(player)) return false;
    const board = this.boards[player];
    if (!board || board.ko || !board.active) return false;

    switch (action) {
      case "left":
      case "right": {
        const moved = moveSide(board, action === "left" ? -1 : 1);
        if (moved) this.emit({ type: "move", player });
        return moved;
      }
      case "rotateCW":
      case "rotateCCW": {
        const result = rotatePiece(board, action === "rotateCW" ? 1 : -1);
        if (result.ok) this.emit({ type: "rotate", player, kick: result.kick });
        return result.ok;
      }
      case "soft": {
        board.softHeld = true;
        return true;
      }
      case "hard": {
        const distance = hardDrop(board);
        this.emit({ type: "hard", player, distance });
        this.resolveLock(player);
        return true;
      }
      case "hold": {
        const ok = holdPiece(board);
        if (ok) {
          this.emit({ type: "hold", player });
          if (this.isAi(player)) this.planAi(player);
        }
        return ok;
      }
      case "softRelease": {
        board.softHeld = false;
        return true;
      }
      default:
        return false;
    }
  }

  setSoft(player, held) {
    const board = this.boards[player];
    if (!board) return;
    board.softHeld = Boolean(held);
  }

  // ---------------------------------------------------------- 锁定 / 抵消 / 垃圾行

  resolveLock(player) {
    if (this.phase !== PHASE.PLAYING) return;
    const board = this.boards[player];
    const rival = this.boards[1 - player];
    if (!board || !board.active) return;

    const result = lockPiece(board);
    this.emit({ type: "lock", player, lines: result.lines, tspin: result.tspin });
    if (result.lines > 0) {
      this.emit({
        type: "clear",
        player,
        lines: result.lines,
        tspin: result.tspin,
        combo: result.combo,
        b2b: result.b2bTriggered,
        rows: result.rows,
      });
    }

    // 攻防抵消：任何有效攻击优先从缓冲槽等量扣除，剩余火力才反轰对手。
    let cancelled = 0;
    let sent = 0;
    if (result.attack > 0) {
      cancelled = Math.min(result.attack, board.pending.length);
      if (cancelled > 0) cancelPending(board, cancelled);
      sent = result.attack - cancelled;
      board.stats.sent += sent;
      this.emit({ type: "attack", player, rows: result.attack, cancelled, sent });
      if (sent > 0) this.receiveAttack(1 - player, player, sent);
    }

    if (result.ko || board.ko) {
      this.endRound(player);
      return;
    }

    // 锁定下一块，缓冲槽里的垃圾行立即升起（IRL 规则），可能直接顶穿。
    if (board.pending.length > 0) {
      const flushed = flushGarbage(board);
      if (flushed.rows > 0) this.emit({ type: "garbage", player, rows: flushed.rows });
      if (flushed.ko || board.ko) {
        this.endRound(player);
        return;
      }
    }

    const alive = spawnNext(board);
    if (!alive) {
      this.endRound(player);
      return;
    }
    this.emit({ type: "spawn", player });
    if (this.isAi(player)) this.planAi(player);
  }

  receiveAttack(target, from, rows) {
    const board = this.boards[target];
    if (!board || rows <= 0) return;
    addIncoming(board, rows, board.rng);
    board.alarmSent = false;
    this.emit({ type: "incoming", player: target, from, rows });
  }

  applyPending(player) {
    const board = this.boards[player];
    if (!board || !board.pending.length) return false;
    const flushed = flushGarbage(board);
    if (flushed.rows > 0) this.emit({ type: "garbage", player, rows: flushed.rows });
    if (flushed.ko || board.ko) {
      this.endRound(player);
      return true;
    }
    return false;
  }

  endRound(loser) {
    if (this.phase !== PHASE.PLAYING) return;
    const winner = 1 - loser;
    this.seriesWins[winner] += 1;
    this.emit({ type: "ko", loser, winner, seriesWins: this.seriesWins.slice() });
    if (this.seriesWins[winner] >= this.targetWins) {
      this.phase = PHASE.SERIES_END;
      this.winner = winner;
      this.emit({ type: "series_end", winner, seriesWins: this.seriesWins.slice() });
    } else {
      this.phase = PHASE.ROUND_END;
      this.emit({ type: "round_end", winner, seriesWins: this.seriesWins.slice() });
    }
  }

  // ---------------------------------------------------------- AI

  planAi(player) {
    const board = this.boards[player];
    const ai = this.ai[player];
    if (!ai?.profile || !board?.active) return;
    ai.plan = planPlacement(board, ai.profile, this.aiRng);
    ai.timer = 0;
  }

  stepAi(player, dt) {
    const board = this.boards[player];
    const ai = this.ai[player];
    if (!board || !ai.profile || board.ko || !board.active) return;
    if (!ai.plan) this.planAi(player);
    if (!ai.plan) return;

    ai.timer += dt;
    if (ai.timer < ai.profile.moveMs / 1000) return;
    ai.timer = 0;

    if (ai.plan.useHold) {
      ai.plan.useHold = false;
      if (holdPiece(board)) {
        this.emit({ type: "hold", player });
        return;
      }
    }

    const action = nextAiAction(ai.plan, board);
    if (action === "rotate") {
      if (!rotatePiece(board, 1).ok) ai.plan.rotations = 0;
      return;
    }
    if (action === "left" || action === "right") {
      const dx = action === "left" ? -1 : 1;
      if (!moveSide(board, dx)) {
        ai.plan.targetX = board.active.x;
      }
      return;
    }
    hardDrop(board);
    this.emit({ type: "hard", player, distance: 0 });
    this.resolveLock(player);
  }

  // ---------------------------------------------------------- 主循环

  step(dt) {
    if (this.paused || this.phase !== PHASE.PLAYING) return;
    const elapsed = Math.min(Math.max(dt, 0), 0.05);
    for (let i = 0; i < 2; i += 1) {
      if (this.phase !== PHASE.PLAYING) return;
      const board = this.boards[i];
      if (!board || board.ko) continue;

      if (this.isAi(i)) {
        this.stepAi(i, elapsed);
        if (this.phase !== PHASE.PLAYING) return;
        if (!this.boards[i]?.active && !this.boards[i]?.ko) continue;
      }

      // 垃圾行缓冲倒计时：1.5 秒到点自动升起。
      if (board.pending.length > 0) {
        board.garbageTimer -= elapsed;
        if (
          board.garbageTimer > 0 &&
          board.garbageTimer < 0.5 &&
          board.pending.length >= 6 &&
          !board.alarmSent
        ) {
          board.alarmSent = true;
          this.emit({ type: "alarm", player: i });
        }
        if (board.garbageTimer <= 0) {
          this.applyPending(i);
          if (this.phase !== PHASE.PLAYING) return;
          if (!this.boards[i]?.active) continue;
        }
      }

      if (!board.active) continue;
      if (board.grounded) {
        board.lockTimer += elapsed;
        if (board.lockTimer >= LOCK_DELAY) {
          this.resolveLock(i);
          if (this.phase !== PHASE.PLAYING) return;
        }
        continue;
      }
      const interval = (board.softHeld ? SOFT_INTERVAL : board.gravityMs) / 1000;
      board.gravityAcc += elapsed;
      let guard = 0;
      while (board.gravityAcc >= interval && guard < 8) {
        guard += 1;
        board.gravityAcc -= interval;
        if (!moveDown(board)) {
          board.grounded = true;
          board.lockTimer = 0;
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------- 视图快照

  snapshot() {
    return {
      mode: this.mode,
      phase: this.phase,
      paused: this.paused,
      stage: this.stageIndex,
      stageData: this.stage,
      bestOf: this.bestOf,
      targetWins: this.targetWins,
      round: this.round,
      seriesWins: this.seriesWins.slice(),
      winner: this.winner,
      boards: this.boards.map((board, index) => ({
        grid: board.grid,
        active: board.active,
        ghost: ghostOf(board),
        hold: board.hold,
        holdUsed: board.holdUsed,
        queue: board.queue.slice(0, 4),
        score: board.score,
        lines: board.lines,
        combo: board.combo,
        b2b: board.b2b,
        pending: board.pending.length,
        pendingTimer: board.garbageTimer,
        ko: board.ko,
        isAi: this.isAi(index),
      })),
    };
  }
}

export function createGame(options) {
  return new DuelGame(options);
}
