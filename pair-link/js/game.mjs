// 流程控制器：持有 engine state、跑主循环、派发 UI 意图。
// 不直接操作 DOM；只通过 handlers 回调把变化交给装配层。

import {
  applyPick,
  createState,
  pauseGame,
  restartLevel,
  resumeGame,
  startGame,
  tick,
  useHint,
  useShuffle
} from "./engine.mjs";

const MAX_FRAME_MS = 100;

function rafSupported() {
  return typeof requestAnimationFrame === "function" && typeof cancelAnimationFrame === "function";
}

export function createGame(initialState, handlers = {}) {
  let state = initialState || createState(1);
  let raf = 0;
  let lastTs = 0;
  let destroyed = false;

  function emit(name, payload) {
    const fn = handlers[name];
    if (typeof fn === "function") fn(payload);
  }

  function commit(next, source, extra) {
    state = next;
    emit("onState", Object.assign({ state: state, source: source }, extra || {}));
  }

  function endCheck(before) {
    if (before.phase === "playing" && state.phase === "won") {
      emit("onEnd", { state: state, reason: "win" });
    } else if (before.phase === "playing" && state.phase === "lost") {
      emit("onEnd", { state: state, reason: state.failReason || "lost" });
    }
  }

  function loop(ts) {
    if (destroyed) return;
    const dt = lastTs ? Math.min(MAX_FRAME_MS, ts - lastTs) : 16;
    lastTs = ts;

    if (state.phase === "playing") {
      const before = state;
      const next = tick(before, dt);
      if (next.phase !== before.phase) {
        commit(next, "tick");
        endCheck(before);
      } else {
        state = next;
        emit("onTick", { state: state });
      }
    }

    raf = requestAnimationFrame(loop);
  }

  function doPick(cell) {
    const before = state;
    const result = applyPick(before, cell);
    if (!result.action) return null;
    commit(result.state, result.action.type);
    emit("onAction", { action: result.action, state: state });
    endCheck(before);
    return result.action;
  }

  function doHint() {
    const result = useHint(state);
    if (!result.action) {
      emit("onRefused", { reason: "hint" });
      return null;
    }
    commit(result.state, "hint");
    emit("onAction", { action: result.action, state: state });
    return result.action;
  }

  function doShuffle() {
    const result = useShuffle(state);
    if (!result.action) {
      emit("onRefused", { reason: "shuffle" });
      return null;
    }
    commit(result.state, "shuffle");
    emit("onAction", { action: result.action, state: state });
    return result.action;
  }

  function startNew(level, mode) {
    const fresh = createState(level, { mode: mode });
    commit(startGame(fresh), "newGame");
  }

  function dispatch(intent) {
    if (!intent || typeof intent !== "object" || destroyed) return null;
    switch (intent.type) {
      case "pick":
        return doPick(intent.cell);
      case "hint":
        return doHint();
      case "shuffle":
        return doShuffle();
      case "start":
        commit(startGame(state), "start");
        return null;
      case "pause":
        commit(pauseGame(state), "pause");
        return null;
      case "resume":
        commit(resumeGame(state), "resume");
        return null;
      case "restart":
        commit(startGame(restartLevel(state)), "restart");
        return null;
      case "newGame":
        startNew(intent.level, intent.mode);
        return null;
      default:
        return null;
    }
  }

  if (rafSupported()) raf = requestAnimationFrame(loop);

  return {
    dispatch: dispatch,
    getState: () => state,
    destroy: () => {
      destroyed = true;
      if (raf && rafSupported()) cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}
