// game.mjs — DOM-free 状态控制器：收 UI 意图、按固定步长调度 engine、派发事件。
// 绝不碰 document / window / localStorage；暂停与推进流程在这里，规则仍在 engine。

import {
  createGame,
  startWave,
  stepFrame,
  applyIntent,
  drainEvents,
  isTerminal,
  resultOf,
  MODES,
  PHASES,
} from "./engine.mjs";
import { TOTAL_WAVES, SECTOR_COUNT } from "./levels.mjs";

export const FIXED_DT = 1 / 120;
export const MAX_STEPS = 8;

export function createController(options = {}) {
  const mode = MODES.includes(options.mode) ? options.mode : "campaign";
  let state = createGame({ mode, seed: options.seed, waveIndex: options.waveIndex ?? 0 });
  let paused = false;
  let accumulator = 0;
  const listeners = new Set();

  function emit(type, payload) {
    for (const listener of listeners) listener(type, payload);
  }

  function flush() {
    const events = drainEvents(state);
    for (const event of events) emit(event.type, event);
  }

  return {
    get state() {
      return state;
    },
    get paused() {
      return paused;
    },
    get mode() {
      return state.mode;
    },
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** 开一波：mode 可切换，waveIndex 按模式取值。 */
    launch(nextMode, waveIndex = 0) {
      const next = MODES.includes(nextMode) ? nextMode : state.mode;
      const index = Math.max(0, Math.floor(waveIndex));
      if (next === state.mode) {
        startWave(state, index);
      } else {
        state = createGame({ mode: next, seed: options.seed, waveIndex: index });
      }
      state.lives = next === "survival" ? 1 : 3;
      if (next === "rush") state.rushTime = 0;
      paused = false;
      accumulator = 0;
      flush();
      emit("launched", { mode: next, wave: index });
      return state;
    },
    /** 下一波（战役 / 突袭 / 生存共用）；生存模式索引持续增长。 */
    nextWave() {
      const index = state.mode === "survival" ? state.waveIndex + 1 : state.waveIndex + 1;
      if (state.mode === "campaign" && index >= TOTAL_WAVES) return null;
      if (state.mode === "rush" && index >= SECTOR_COUNT) return null;
      startWave(state, index);
      paused = false;
      accumulator = 0;
      flush();
      emit("launched", { mode: state.mode, wave: index });
      return state;
    },
    /** 固定步长推进：多余时间累积，掉帧时最多补 8 步，绝不螺旋爆炸。 */
    frame(dt, input = {}) {
      if (paused) return state;
      accumulator += Math.max(0, Math.min(0.25, Number(dt) || 0));
      let steps = 0;
      while (accumulator >= FIXED_DT && steps < MAX_STEPS) {
        stepFrame(state, FIXED_DT, input);
        accumulator -= FIXED_DT;
        steps += 1;
      }
      if (steps === MAX_STEPS) accumulator = 0;
      if (steps > 0) flush();
      if (isTerminal(state)) emit("terminal", { phase: state.phase, result: resultOf(state) });
      return state;
    },
    intent(name) {
      const action = applyIntent(state, name);
      if (action) flush();
      return action;
    },
    pause() {
      if (isTerminal(state)) return false;
      paused = true;
      emit("pause", null);
      return true;
    },
    resume() {
      paused = false;
      accumulator = 0;
      emit("resume", null);
      return true;
    },
    togglePause() {
      return paused ? this.resume() : this.pause();
    },
    result() {
      return resultOf(state);
    },
    phase() {
      return state.phase;
    },
    isTerminal() {
      return isTerminal(state);
    },
    isPausedPhase() {
      return paused;
    },
  };
}

export { MODES, PHASES };
