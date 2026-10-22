// Pong Neo DOM-free 游戏状态控制器（收发意图，调度 engine，驱动主循环与事件）

import {
  createInitialState,
  stepFrame,
  initServe,
  MODES,
  DIFFICULTIES,
  TARGET_SCORES,
  COURT_WIDTH
} from "./engine.mjs";

export class PongGame {
  constructor(options = {}) {
    this.state = createInitialState(options);
    this.listeners = new Set();
    this.inputs = {
      bottom: { targetX: null, moveDirection: 0 },
      top: { targetX: null, moveDirection: 0 }
    };
    this.isPaused = false;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(event) {
    for (const fn of this.listeners) {
      try {
        fn(event, this.state);
      } catch {
        // 防止监听函数报错阻断逻辑
      }
    }
  }

  setBottomTargetX(x) {
    this.inputs.bottom.targetX = x;
  }

  setBottomMoveDir(dir) {
    this.inputs.bottom.moveDirection = dir;
    if (dir !== 0) {
      this.inputs.bottom.targetX = null;
    }
  }

  setTopTargetX(x) {
    this.inputs.top.targetX = x;
  }

  setTopMoveDir(dir) {
    this.inputs.top.moveDirection = dir;
    if (dir !== 0) {
      this.inputs.top.targetX = null;
    }
  }

  setMode(mode) {
    if (!Object.values(MODES).includes(mode)) return;
    this.state = createInitialState({
      mode,
      difficulty: this.state.difficulty,
      targetScore: this.state.targetScore
    });
    this.emit({ type: "config_changed" });
  }

  setDifficulty(diff) {
    if (!Object.values(DIFFICULTIES).includes(diff)) return;
    this.state.difficulty = diff;
    this.emit({ type: "config_changed" });
  }

  setTargetScore(score) {
    if (!TARGET_SCORES.includes(score)) return;
    this.state.targetScore = score;
    this.emit({ type: "config_changed" });
  }

  restartMatch() {
    this.state = createInitialState({
      mode: this.state.mode,
      difficulty: this.state.difficulty,
      targetScore: this.state.targetScore
    });
    this.isPaused = false;
    this.emit({ type: "match_restarted" });
  }

  serveBall() {
    if (this.state.status === "won") {
      this.restartMatch();
      return;
    }
    initServe(this.state, this.state.serveDirection);
    this.emit({ type: "ball_served" });
  }

  togglePause() {
    if (this.state.status === "won") return;
    this.isPaused = !this.isPaused;
    this.emit({ type: "pause_toggled", isPaused: this.isPaused });
  }

  step(dt) {
    if (this.isPaused) return [];

    const { state: nextState, events } = stepFrame(this.state, dt, this.inputs);
    this.state = nextState;

    for (const ev of events) {
      this.emit(ev);
    }
    return events;
  }
}