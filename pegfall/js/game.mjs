// 对局控制器：固定步长推进、暂停、快进、狂喜慢动作与事件出站。DOM-free。

import {
  AIM_LIMIT, STATUS_AIM, STATUS_FEVER, STATUS_FLIGHT, STATUS_LOST, STATUS_WON,
  advanceFever, adjustAim, createState, fire, setAim, stepFrame,
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
  let fast = false;
  let accumulator = 0;
  let outbox = [];
  let result = null;
  let recordedState = null;

  function emit() {
    onChange(view());
  }

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

  function start(levelId) {
    const data = getLevel(levelId);
    if (!data) return false;
    level = data;
    state = createState(data, { seed: 0x51ed + data.index });
    paused = false;
    fast = false;
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
    accumulator = Math.min(MAX_ACCUM, accumulator + seconds * (fast ? 2 : 1));

    let guard = 0;
    while (accumulator >= STEP && guard < 16) {
      guard += 1;
      accumulator -= STEP;
      if (state.status === STATUS_AIM || state.status === STATUS_FLIGHT) {
        commit(stepFrame(state, STEP));
      } else if (state.status === STATUS_FEVER) {
        commit(advanceFever(state, STEP));
      } else {
        break;
      }
      if (state.status === STATUS_WON || state.status === STATUS_LOST) break;
    }
    emit();
  }

  function aim(deg) {
    if (!state || paused || state.status !== STATUS_AIM) return false;
    const next = setAim(state, deg);
    if (next === state) return false;
    state = next;
    emit();
    return true;
  }

  function nudge(delta) {
    if (!state || paused || state.status !== STATUS_AIM) return false;
    const next = adjustAim(state, delta);
    if (next === state) return false;
    state = next;
    emit();
    return true;
  }

  function shoot() {
    if (!state || paused || state.status !== STATUS_AIM || state.ballsLeft <= 0) return false;
    commit(fire(state));
    accumulator = 0;
    emit();
    return true;
  }

  function setFast(enabled) {
    const value = Boolean(enabled) && Boolean(state) && state.status !== STATUS_AIM;
    if (value === fast) return;
    fast = value;
    emit();
  }

  function pause(enabled = true) {
    if (!state) return;
    const next = Boolean(enabled);
    if (paused === next) return;
    paused = next;
    fast = false;
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
      fastForward: fast,
      result,
      canFire: Boolean(state) && state.status === STATUS_AIM && !paused && state.ballsLeft > 0,
      aimLimit: AIM_LIMIT,
    };
  }

  return {
    start,
    tick,
    aim,
    nudge,
    shoot,
    setFast,
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
