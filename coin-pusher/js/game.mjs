// 推币机 · DOM-free 游戏状态控制器
// 收 UI 意图 → 固定步长累加调度 engine（120Hz 确定性推进）→ 派发事件给监听层。
//
// 无尽机台：投币不接受落点/力度参数——投币口固定，落点由挡杆阵物理决定。

import {
  createInitialState, stepFrame, insertCoin, restartStage, canInsert,
  FIXED_DT, MODE, STATUS, DEFAULT_CREDITS
} from "./engine.mjs";

export class CoinPusherGame {
  constructor(options = {}) {
    this.state = createInitialState(options);
    this.listeners = new Set();
    this.accumulator = 0;
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
        // 监听层异常不得阻断对局逻辑
      }
    }
  }

  // 投币：合法操作必执行；非法意图（暂停中 / 账户无币 / 台面已满）静默忽略（绝不 alert）
  fire() {
    if (this.isPaused || !canInsert(this.state)) return false;
    const res = insertCoin(this.state);
    if (res.state === this.state) return false;
    this.state = res.state;
    for (const ev of res.events) this.emit(ev);
    return true;
  }

  togglePause() {
    if (this.state.status === STATUS.WON || this.state.status === STATUS.LOST) return false;
    this.isPaused = !this.isPaused;
    this.emit({ type: "pause_toggled", isPaused: this.isPaused });
    return this.isPaused;
  }

  // 重开本局：沿用本次选择的初始币数与同一 seed
  restart() {
    this.state = restartStage(this.state);
    this.accumulator = 0;
    this.isPaused = false;
    this.emit({ type: "stage_restarted" });
  }

  // 开新的一局：指定初始币数
  start(credits, seed) {
    this.state = createInitialState({ credits: credits ?? DEFAULT_CREDITS, seed });
    this.accumulator = 0;
    this.isPaused = false;
    this.emit({ type: "stage_loaded", credits: this.state.credits });
  }

  canFire() {
    return canInsert(this.state) && !this.isPaused;
  }

  // 主循环入口：固定步长累加（120Hz），确定性推进
  step(realDt) {
    if (this.isPaused) return [];
    const dt = Math.min(Math.max(realDt, 0), 0.1);
    this.accumulator += dt;

    const events = [];
    let guard = 0;
    while (this.accumulator >= FIXED_DT && guard < 240) {
      const { state, events: evs } = stepFrame(this.state, FIXED_DT, {});
      this.state = state;
      events.push(...evs);
      this.accumulator -= FIXED_DT;
      guard += 1;
    }
    for (const ev of events) this.emit(ev);
    return events;
  }
}

export { MODE, STATUS };
