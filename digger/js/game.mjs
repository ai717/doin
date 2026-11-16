// 对局控制器：固定步长推进、方向输入、暂停与结算出站。DOM-free。

import {
  STATUS_LOST, STATUS_PLAYING, STATUS_WON,
  clearDirection, createState, pump, setDirection, stepFrame,
} from "./engine.mjs";
import { getLevel } from "./levels.mjs";
import { levelResult } from "./score.mjs";

export const STEP = 1 / 120;
export const MAX_ACCUM = 0.12;

export function createGameController(options = {}) {
  const onChange = options.onChange ?? (() => {});

  let state = null;
  let level = null;
  let paused = false;
  let accumulator = 0;
  let outbox = [];
  let result = null;
  let recordedState = null;

  function collect() {
    if (state?.events?.length) outbox.push(...state.events);
  }

  function commit(next) {
    state = next;
    collect();
    if ((state.status === STATUS_WON || state.status === STATUS_LOST) && recordedState !== state) {
      recordedState = state;
      result = levelResult(state);
    }
  }

  function emit() {
    onChange(view());
  }

  function start(levelId) {
    const data = getLevel(levelId);
    if (!data) return false;
    level = data;
    state = createState(data, { seed: data.seed });
    paused = false;
    accumulator = 0;
    outbox = [];
    result = null;
    recordedState = null;
    emit();
    return true;
  }

  function tick(dtMs) {
    if (!state || paused) return;
    const seconds = Math.min(0.08, Math.max(0, Number(dtMs) / 1000));
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    accumulator = Math.min(MAX_ACCUM, accumulator + seconds);

    let guard = 0;
    while (accumulator >= STEP && guard < 16 && state.status === STATUS_PLAYING) {
      guard += 1;
      accumulator -= STEP;
      commit(stepFrame(state, STEP));
    }
    emit();
  }

  function move(dir) {
    if (!state || paused || state.status !== STATUS_PLAYING) return false;
    const next = setDirection(state, dir);
    if (next === state) return false;
    state = next;
    emit();
    return true;
  }

  function stop(dir) {
    if (!state || state.status !== STATUS_PLAYING) return false;
    const next = clearDirection(state, dir);
    if (next === state) return false;
    state = next;
    emit();
    return true;
  }

  function firePump() {
    if (!state || paused || state.status !== STATUS_PLAYING) return false;
    commit(pump(state));
    emit();
    return true;
  }

  function pause(enabled = true) {
    if (!state) return;
    const next = Boolean(enabled);
    if (paused === next) return;
    paused = next;
    emit();
  }

  function togglePause() {
    pause(!paused);
  }

  function restart() {
    if (!level) return false;
    return start(level.id);
  }

  function drainEvents() {
    const events = outbox;
    outbox = [];
    return events;
  }

  function view() {
    return {
      state,
      level,
      paused,
      result,
      canPump: Boolean(state) && state.status === STATUS_PLAYING && !paused,
      canMove: Boolean(state) && state.status === STATUS_PLAYING && !paused,
    };
  }

  return {
    start,
    tick,
    move,
    stop,
    firePump,
    pause,
    togglePause,
    restart,
    drainEvents,
    view,
    get levelId() {
      return level?.id ?? null;
    },
  };
}
