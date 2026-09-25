// filepath: games/bubble-bloom/js/game.mjs

// 流程状态机与主循环：不直接操作 DOM，只调度 engine 并向外派发状态与事件。

import {
  PHASE,
  aimTo,
  begin,
  createState,
  drainEvents,
  dropBubble,
  nudgeAim,
  pause,
  resume,
  step,
  usePulse
} from "./engine.mjs?v=79c518024932";

export function createGame(options) {
  const opts = options || {};
  const onFrame = typeof opts.onFrame === "function" ? opts.onFrame : null;
  const onEvents = typeof opts.onEvents === "function" ? opts.onEvents : null;

  let state = createState({ mode: "standard" });
  let raf = 0;
  let last = 0;

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;

    if (state.phase === PHASE.playing) {
      step(state, dt);
      const events = drainEvents(state);
      if (events.length && onEvents) onEvents(events, state);
    }

    if (onFrame) onFrame(state, dt);
  }

  function startLoop() {
    if (raf) return;
    last = 0;
    if (typeof requestAnimationFrame === "function") raf = requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
    raf = 0;
  }

  return {
    getState() {
      return state;
    },
    newRun(mode, seed) {
      state = createState({ mode: mode === "daily" ? "daily" : "standard", seed });
    },
    startLoop,
    stopLoop,
    beginRun() {
      return begin(state);
    },
    pauseRun() {
      return pause(state);
    },
    resumeRun() {
      return resume(state);
    },
    aim(x) {
      return aimTo(state, x);
    },
    nudge(delta) {
      return nudgeAim(state, delta);
    },
    drop() {
      return dropBubble(state);
    },
    pulse() {
      return usePulse(state);
    },
    isPlaying() {
      return state.phase === PHASE.playing;
    }
  };
}
