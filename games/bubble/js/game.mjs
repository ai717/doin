/**
 * 极简泡泡堂 · 水泡大作战 (Bubble Arena Lite)
 * 状态机控制器 (DOM-Free, 事件派发, 输入缓冲与对局循环)
 */

import {
  createInitialState,
  stepFrame,
  dropBubble as engineDropBubble,
  useNeedle as engineUseNeedle,
  checkInvariants,
} from "./engine.mjs";

export function createGameController(initialOptions = {}) {
  let state = createInitialState(initialOptions);
  let isPaused = false;
  let listeners = [];
  let eventListeners = [];

  // 玩家输入缓冲
  const inputs = {
    p1: { up: false, down: false, left: false, right: false },
    p2: { up: false, down: false, left: false, right: false },
  };

  function notify() {
    for (let i = 0; i < listeners.length; i++) {
      try {
        listeners[i](state, isPaused);
      } catch (err) {
        // Silent degradation
      }
    }
  }

  function emitEvent(event) {
    for (let i = 0; i < eventListeners.length; i++) {
      try {
        eventListeners[i](event);
      } catch (err) {
        // Silent degradation
      }
    }
  }

  function startMatch(options = {}) {
    state = createInitialState(options);
    isPaused = false;
    inputs.p1 = { up: false, down: false, left: false, right: false };
    inputs.p2 = { up: false, down: false, left: false, right: false };
    emitEvent({ type: "match_start", mapId: state.mapId, mode: state.mode });
    notify();
    return state;
  }

  function tick(dt) {
    if (isPaused || state.status !== "playing") {
      return state;
    }

    const prevBubblesCount = state.bubbles.length;
    const prevStatus = state.status;

    state = stepFrame(state, dt, inputs);
    checkInvariants(state);

    // 检查是否有新日志事件派发
    if (state.logs.length > 0) {
      const latest = state.logs[state.logs.length - 1];
      if (latest) {
        emitEvent(latest);
      }
    }

    if (state.status !== prevStatus) {
      emitEvent({ type: "match_end", status: state.status });
    }

    notify();
    return state;
  }

  function setPlayerInput(playerId, key, value) {
    const target = playerId === 0 ? inputs.p1 : inputs.p2;
    if (target && key in target) {
      target[key] = Boolean(value);
    }
  }

  function drop(playerId = 0) {
    if (isPaused || state.status !== "playing") return state;
    state = engineDropBubble(state, playerId);
    emitEvent({ type: "bubble_placed", playerId });
    notify();
    return state;
  }

  function needle(playerId = 0) {
    if (isPaused || state.status !== "playing") return state;
    state = engineUseNeedle(state, playerId);
    emitEvent({ type: "needle_used", playerId });
    notify();
    return state;
  }

  function pause() {
    if (!isPaused && state.status === "playing") {
      isPaused = true;
      emitEvent({ type: "pause" });
      notify();
    }
  }

  function resume() {
    if (isPaused && state.status === "playing") {
      isPaused = false;
      emitEvent({ type: "resume" });
      notify();
    }
  }

  function togglePause() {
    if (isPaused) {
      resume();
    } else {
      pause();
    }
    return isPaused;
  }

  function subscribe(fn) {
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((l) => l !== fn);
    };
  }

  function onEvent(fn) {
    eventListeners.push(fn);
    return () => {
      eventListeners = eventListeners.filter((l) => l !== fn);
    };
  }

  function getState() {
    return state;
  }

  function getIsPaused() {
    return isPaused;
  }

  return {
    startMatch,
    tick,
    setPlayerInput,
    drop,
    needle,
    pause,
    resume,
    togglePause,
    subscribe,
    onEvent,
    getState,
    getIsPaused,
  };
}
