// game.mjs — DOM-free 状态控制器：收 UI 意图、按固定步长调度 engine、派发事件。

import {
  createGame,
  stepFrame,
  applyIntent,
  drainEvents,
  isTerminal,
  resultOf,
  MODES,
  PHASES,
} from "./engine.mjs";

export const FIXED_DT = 1 / 120;
export const MAX_STEPS = 8;

export function createController(options = {}) {
  const mode = MODES.includes(options.mode) ? options.mode : "rogue";
  let state = createGame({ mode, seed: options.seed });
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
    launch() {
      const action = applyIntent(state, "launch");
      if (action) flush();
      return action;
    },
    pickRelic(id) {
      const action = applyIntent(state, `pick:${id}`);
      if (action) {
        flush();
        emit("relicPicked", { id });
      }
      return action;
    },
    restart(nextMode) {
      const m = MODES.includes(nextMode) ? nextMode : state.mode;
      state = createGame({ mode: m, seed: Date.now() ^ (Math.random() * 1e9) });
      paused = false;
      accumulator = 0;
      flush();
      emit("restart", { mode: m });
      return state;
    },
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
      if (state.phase === PHASES.relic) return false;
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
