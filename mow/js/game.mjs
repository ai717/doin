// game.mjs — DOM-free 状态控制器：接收 UI 意图，驱动固定步长引擎，派发事件，归档战绩。
// 不碰 DOM / localStorage（存档走 storage.mjs），可被 node:test 直接测试。

import {
  createGame,
  stepFrame,
  applyIntent,
  drainEvents,
  snapshot,
  resultOf,
  PHASES,
  isTerminal,
} from "./engine.mjs";
import * as storage from "./storage.mjs";

export const FIXED_STEP = 1 / 120;

export class MowGame {
  constructor() {
    this.state = null;
    this.save = storage.load();
    this.listeners = [];
    this.accum = 0;
    this.input = { dx: 0, dy: 0, burst: false };
    this.lastResult = null;
  }

  on(fn) {
    if (typeof fn === "function") this.listeners.push(fn);
  }

  emit(type, payload = {}) {
    for (const fn of this.listeners) {
      try {
        fn({ type, ...payload });
      } catch {
        // 监听器异常不影响游戏循环
      }
    }
  }

  /** 新开一局（ready 态），返回 engine state */
  newRun(mode, character, seed) {
    this.state = createGame({ mode, character, seed });
    this.accum = 0;
    this.input = { dx: 0, dy: 0, burst: false };
    this.lastResult = null;
    return this.state;
  }

  getMode() {
    return this.state ? this.state.mode : "standard";
  }

  getCharacter() {
    return this.state ? this.state.character : "mower";
  }

  start() {
    if (!this.state) return null;
    const r = applyIntent(this.state, "start");
    if (r) this.flushEvents();
    return r;
  }

  setMove(dx, dy) {
    this.input.dx = dx;
    this.input.dy = dy;
  }

  /** 单次触发（引擎侧每次 step 后自动复位） */
  pressBurst() {
    this.input.burst = true;
  }

  togglePause() {
    if (!this.state) return null;
    const r = this.state.phase === PHASES.playing ? applyIntent(this.state, "pause") : applyIntent(this.state, "resume");
    if (r) this.flushEvents();
    return r;
  }

  burst() {
    if (!this.state) return null;
    const r = applyIntent(this.state, "burst");
    if (r) this.flushEvents();
    return r;
  }

  choose(index) {
    if (!this.state) return null;
    const r = applyIntent(this.state, "choose", index);
    if (r) this.flushEvents();
    return r;
  }

  /** 主循环驱动：固定步长累加器，一次最多补偿 30 步（防螺旋） */
  step(deltaMs) {
    if (!this.state) return;
    this.accum += Math.min(0.1, (Number(deltaMs) || 0) / 1000);
    let steps = 0;
    while (this.accum >= FIXED_STEP && steps < 30) {
      stepFrame(this.state, FIXED_STEP, this.input);
      this.accum -= FIXED_STEP;
      steps += 1;
      if (this.state.phase !== PHASES.playing) break;
    }
    this.input.burst = false;
    if (isTerminal(this.state) && !this.lastResult) this.finishRun();
    this.flushEvents();
  }

  flushEvents() {
    if (!this.state) return;
    const events = drainEvents(this.state);
    for (const ev of events) this.emit(ev.type, ev);
  }

  finishRun() {
    const result = resultOf(this.state);
    const applied = storage.applyResult(this.save, result);
    this.save = applied.state;
    this.lastResult = {
      result,
      improved: applied.improved,
      newUnlock: applied.newUnlock,
      best: this.save.best,
    };
    this.emit("runEnd", this.lastResult);
  }

  snapshot() {
    return this.state ? snapshot(this.state) : null;
  }

  getSave() {
    return storage.normalize(this.save);
  }

  resetSave() {
    this.save = storage.resetAll();
    return this.save;
  }
}
