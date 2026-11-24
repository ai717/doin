/**
 * 中华客栈 · 跑堂点菜 (Inn Master)
 * 状态机控制器 (DOM-Free, 事件派发, 定时器管理)
 */

import {
  createInitialState,
  stepFrame,
  enqueueAction as engineEnqueueAction,
  cancelAction as engineCancelAction,
  solveAbacus as engineSolveAbacus,
  quickPay as engineQuickPay,
  checkInvariants,
} from "./engine.mjs";

export function createGameController(initialOptions = {}) {
  let state = createInitialState(initialOptions);
  let isPaused = false;
  let listeners = [];
  let eventListeners = [];

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
    emitEvent({ type: "match_start", shiftId: state.shiftId });
    notify();
    return state;
  }

  function tick(dt) {
    if (isPaused || state.status !== "playing") {
      return state;
    }

    const prevServed = state.servedCount;
    const prevLost = state.lostGuests;
    const prevSilver = state.silver;

    state = stepFrame(state, dt);
    checkInvariants(state);

    if (state.servedCount > prevServed) {
      emitEvent({ type: "served", total: state.servedCount, combo: state.combo });
    }
    if (state.lostGuests > prevLost) {
      emitEvent({ type: "guest_lost", total: state.lostGuests });
    }
    if (state.silver > prevSilver) {
      emitEvent({ type: "coin_gain", amount: state.silver - prevSilver });
    }
    if (state.status !== "playing") {
      emitEvent({ type: "game_over", result: state.status, silver: state.silver });
    }

    notify();
    return state;
  }

  function enqueue(action) {
    if (isPaused || state.status !== "playing") return state;
    state = engineEnqueueAction(state, action);
    emitEvent({ type: "action_enqueued", action });
    notify();
    return state;
  }

  function cancel(actionId) {
    state = engineCancelAction(state, actionId);
    emitEvent({ type: "action_cancelled", actionId });
    notify();
    return state;
  }

  function pay(tableId, enteredSilver = null) {
    if (isPaused || state.status !== "playing") return state;
    if (enteredSilver !== null) {
      state = engineSolveAbacus(state, { tableId, enteredSilver });
    } else {
      state = engineQuickPay(state, { tableId });
    }
    emitEvent({ type: "checkout_complete", tableId });
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
    enqueue,
    cancel,
    pay,
    pause,
    resume,
    togglePause,
    subscribe,
    onEvent,
    getState,
    getIsPaused,
  };
}
