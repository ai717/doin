// 森林冰火人 · DOM-free 游戏状态控制器
// 接收 UI 意图（输入、关卡切换），调度 engine，派发事件
// 绝对禁止访问 window / document / localStorage

import {
  createInitialState,
  stepFrame,
  computeStars
} from "./engine.mjs";
import { getLevel, LEVEL_COUNT } from "./levels.mjs";

export const CONTROL_MODES = Object.freeze({
  DUAL: "dual",      // 双人同屏：WASD + 方向键
  SOLO: "solo"       // 单人：Tab 焦点切换当前角色
});

export class FireIceGame {
  constructor(options = {}) {
    this.levelIndex = options.levelIndex ?? 0;
    this.controlMode = options.controlMode ?? CONTROL_MODES.DUAL;
    this.focused = "fire"; // solo 模式下当前受控角色
    this.listeners = new Set();
    this.inputs = {
      fire: { left: false, right: false, jump: false },
      ice: { left: false, right: false, jump: false },
      freeze: false
    };
    this.state = this.buildState(this.levelIndex);
    this.phase = "playing"; // playing | won
    this.winAt = -1;
    this.isPaused = false;
  }

  buildState(levelIndex) {
    const level = getLevel(levelIndex);
    if (!level) return null;
    return createInitialState(level, { levelIndex });
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
        // 监听函数报错不阻断逻辑
      }
    }
  }

  // ---- 输入意图 ----
  setInput(kind, name, value) {
    this.inputs[kind][name] = Boolean(value);
  }

  setFreeze(value) {
    this.inputs.freeze = Boolean(value);
  }

  // ---- 模式 ----
  setControlMode(mode) {
    if (!Object.values(CONTROL_MODES).includes(mode)) return;
    this.controlMode = mode;
    this.emit({ type: "mode_changed", mode });
  }

  setFocused(kind) {
    if (kind !== "fire" && kind !== "ice") return;
    this.focused = kind;
    this.emit({ type: "focus_changed", kind });
  }

  toggleFocus() {
    this.setFocused(this.focused === "fire" ? "ice" : "fire");
  }

  // ---- 关卡流程 ----
  startLevel(index) {
    if (index < 0 || index >= LEVEL_COUNT) return;
    this.levelIndex = index;
    this.state = this.buildState(index);
    this.phase = "playing";
    this.winAt = -1;
    this.isPaused = false;
    this.inputs = {
      fire: { left: false, right: false, jump: false },
      ice: { left: false, right: false, jump: false },
      freeze: false
    };
    this.emit({ type: "level_started", levelIndex: index });
  }

  restartLevel() {
    this.startLevel(this.levelIndex);
  }

  goNextLevel() {
    this.startLevel(Math.min(LEVEL_COUNT - 1, this.levelIndex + 1));
  }

  togglePause() {
    if (this.phase === "won") return;
    this.isPaused = !this.isPaused;
    this.emit({ type: "pause_toggled", isPaused: this.isPaused });
  }

  // ---- 主循环 ----
  step(dt) {
    if (this.isPaused || this.phase === "won" || !this.state) return [];

    const { state: nextState, events } = stepFrame(this.state, dt, this.inputs);
    this.state = nextState;

    for (const ev of events) {
      this.emit(ev);
    }

    if (nextState.status === "won" && this.phase !== "won") {
      this.phase = "won";
      this.winAt = nextState.elapsed;
      const stars = this.computeCurrentStars();
      this.emit({
        type: "win",
        stars,
        levelIndex: this.levelIndex,
        stats: nextState.stats,
        elapsed: nextState.elapsed
      });
    }
    return events;
  }

  computeCurrentStars() {
    if (!this.state) return 1;
    return computeStars(this.state.stats);
  }

  getCurrentSummary() {
    if (!this.state) return null;
    return {
      levelIndex: this.levelIndex,
      name: this.state.levelName,
      elapsed: this.state.elapsed,
      stats: this.state.stats,
      gems: this.state.stats.gems,
      gemsLeft: this.state.gems.filter((g) => !g.taken).length,
      deaths: this.state.stats.deaths,
      syncCount: this.state.stats.syncCount,
      stars: this.computeCurrentStars()
    };
  }
}
