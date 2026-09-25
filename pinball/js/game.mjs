// 霓虹弹珠台 · DOM-free 游戏状态控制器
// 收 UI 意图 → 缓冲输入 → 固定步长累加调度 engine → 派发事件给监听层。

import {
  createInitialState, stepFrame, launchBall, restartStage, FIXED_DT, MODE
} from "./engine.mjs";

export class PinballGame {
  constructor(options = {}) {
    this.state = createInitialState(options);
    this.listeners = new Set();
    this.inputs = { flipL: false, flipR: false, nudge: 0 };
    this.accumulator = 0;
    this.isPaused = false;
    this.power = 0; // 发射蓄力 0..1
    this.charging = false;
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
        // 监听层异常不得阻断对局逻辑
      }
    }
  }

  // ---- 输入意图（UI 只发意图，规则只在 engine）----
  setFlip(side, pressed) {
    if (side === "L") this.inputs.flipL = Boolean(pressed);
    else if (side === "R") this.inputs.flipR = Boolean(pressed);
  }

  nudge() {
    this.inputs.nudge = 1;
  }

  clearNudge() {
    this.inputs.nudge = 0;
  }

  // 发射：按住蓄力（≥0.15s 充电），松开发射
  startCharge() {
    if (this.state.status !== "serving") return;
    this.charging = true;
    this.power = 0.35;
  }

  releaseLaunch() {
    if (!this.charging) return;
    this.charging = false;
    if (this.state.status !== "serving") return;
    const ok = launchBall(this.state, this.power);
    if (ok) this.emit({ type: "launched", power: this.power });
    this.power = 0;
  }

  togglePause() {
    if (this.state.status === "cleared" || this.state.status === "failed" || this.state.status === "over") return;
    this.isPaused = !this.isPaused;
    this.emit({ type: "pause_toggled", isPaused: this.isPaused });
  }

  restart() {
    this.state = restartStage(this.state);
    this.isPaused = false;
    this.accumulator = 0;
    this.charging = false;
    this.power = 0;
    this.emit({ type: "stage_restarted" });
  }

  loadLevel(levelId) {
    this.state = createInitialState({ mode: MODE.STAGE, levelId, seed: this.seedFor(levelId) });
    this.accumulator = 0;
    this.charging = false;
    this.power = 0;
    this.emit({ type: "stage_loaded", levelId });
  }

  loadSurvival(seed) {
    this.state = createInitialState({ mode: MODE.SURVIVAL, seed: seed ?? 777 });
    this.accumulator = 0;
    this.charging = false;
    this.power = 0;
    this.emit({ type: "survival_loaded" });
  }

  seedFor(levelId) {
    return 1000 + levelId * 7;
  }

  // 主循环入口：固定步长累加（120Hz），确定性推进
  step(realDt) {
    if (this.isPaused) return [];
    const dt = Math.min(realDt, 0.1);
    this.accumulator += dt;

    if (this.charging && this.state.status === "serving") {
      this.power = Math.min(1, this.power + dt * 1.1);
    }

    const events = [];
    let guard = 0;
    while (this.accumulator >= FIXED_DT && guard < 240) {
      const { state, events: evs } = stepFrame(this.state, FIXED_DT, this.inputs);
      this.state = state;
      events.push(...evs);
      this.accumulator -= FIXED_DT;
      guard += 1;
    }
    if (this.inputs.nudge) this.inputs.nudge = 0;

    for (const ev of events) this.emit(ev);
    return events;
  }
}
