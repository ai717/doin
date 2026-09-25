/**
 * 游戏状态控制器 (DOM-free)
 * 协调 engine、score 与 storage，管理时间流与撤销栈
 */
import {
  createSolvedBoard,
  shuffleBoard,
  applyMove,
  moveByDirection,
  isSolved,
  createRng,
} from "./engine.mjs";
import { calculateStars, calculateTps, getSpeedRank } from "./score.mjs";

export class GameController {
  constructor(config = {}) {
    this.size = config.size || 4;
    this.mode = config.mode || "speedrun"; // 'ladder' | 'speedrun' | 'daily'
    this.keyMode = config.keyMode || "push-tile";
    this.stage = config.stage || 1;

    this.board = createSolvedBoard(this.size);
    this.initialBoard = [...this.board];
    this.history = []; // [{ board, blank }]
    this.status = "ready"; // 'ready' | 'playing' | 'solved' | 'paused'

    this.moves = 0;
    this.elapsedSeconds = 0;
    this.timerInterval = null;
    this.onStateChange = config.onStateChange || (() => {});
    this.onVictory = config.onVictory || (() => {});
    this.onMoveFeedback = config.onMoveFeedback || (() => {});
  }

  initBoard(shuffle = true, seed = null) {
    this.stopTimer();
    this.moves = 0;
    this.elapsedSeconds = 0;
    this.history = [];

    if (shuffle) {
      const rng = seed ? createRng(seed) : Math.random;
      const stepMap = { 3: 45, 4: 120, 5: 250, 6: 400 };
      const steps = stepMap[this.size] || 100;
      this.board = shuffleBoard(this.size, steps, rng);
    } else {
      this.board = createSolvedBoard(this.size);
    }

    this.initialBoard = [...this.board];
    this.status = "ready";
    this.emitChange();
  }

  startDaily(dateStr) {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = (Math.imul(31, hash) + dateStr.charCodeAt(i)) | 0;
    }
    this.size = 4;
    this.mode = "daily";
    this.initBoard(true, Math.abs(hash) + 1);
  }

  startLadderStage(stageNum) {
    this.stage = stageNum;
    this.mode = "ladder";
    // 关卡规模阶梯
    if (stageNum <= 3) this.size = 3;
    else if (stageNum <= 10) this.size = 4;
    else this.size = 5;

    const seed = 10007 * stageNum + 42;
    this.initBoard(true, seed);
  }

  startTimerIfNeeded() {
    if (this.status === "ready") {
      this.status = "playing";
      this.startTime = Date.now() - this.elapsedSeconds * 1000;
      this.timerInterval = setInterval(() => {
        if (this.status === "playing") {
          this.elapsedSeconds = (Date.now() - this.startTime) / 1000;
          this.emitChange();
        }
      }, 100);
    }
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  makeMove(targetRow, targetCol) {
    if (this.status === "solved" || this.status === "paused") return false;

    const res = applyMove(this.board, this.size, targetRow, targetCol);
    if (!res.success) return false;

    this.startTimerIfNeeded();

    // 压入撤销历史
    this.history.push([...this.board]);
    this.board = res.newBoard;
    this.moves++;

    this.onMoveFeedback(res.movedTiles);

    if (isSolved(this.board, this.size)) {
      this.handleVictory();
    } else {
      this.emitChange();
    }
    return true;
  }

  makeDirectionMove(direction) {
    if (this.status === "solved" || this.status === "paused") return false;

    const res = moveByDirection(this.board, this.size, direction, this.keyMode);
    if (!res.success) return false;

    this.startTimerIfNeeded();

    this.history.push([...this.board]);
    this.board = res.newBoard;
    this.moves++;

    this.onMoveFeedback(res.movedTiles);

    if (isSolved(this.board, this.size)) {
      this.handleVictory();
    } else {
      this.emitChange();
    }
    return true;
  }

  undo() {
    if (this.history.length === 0 || this.status === "solved") return false;
    this.board = this.history.pop();
    this.moves++;
    this.emitChange();
    return true;
  }

  resetCurrent() {
    this.stopTimer();
    this.board = [...this.initialBoard];
    this.history = [];
    this.moves = 0;
    this.elapsedSeconds = 0;
    this.status = "ready";
    this.emitChange();
  }

  handleVictory() {
    this.status = "solved";
    this.stopTimer();

    const tps = calculateTps(this.moves, this.elapsedSeconds);
    const stars = calculateStars(this.size, this.moves);
    const rank = getSpeedRank(this.size, this.elapsedSeconds);

    this.emitChange();
    this.onVictory({
      size: this.size,
      mode: this.mode,
      stage: this.stage,
      moves: this.moves,
      time: this.elapsedSeconds,
      tps,
      stars,
      rank,
    });
  }

  emitChange() {
    this.onStateChange(this.getSnapshot());
  }

  getSnapshot() {
    return {
      size: this.size,
      mode: this.mode,
      stage: this.stage,
      board: [...this.board],
      status: this.status,
      moves: this.moves,
      elapsedSeconds: this.elapsedSeconds,
      canUndo: this.history.length > 0 && this.status !== "solved",
      tps: calculateTps(this.moves, this.elapsedSeconds),
    };
  }
}
