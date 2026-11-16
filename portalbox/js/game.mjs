// 对局控制器：回合制推箱、无限撤销栈、重置与结算出站。DOM-free。

import { STATUS_PLAYING, createState, restore, snapshot, step } from "./engine.mjs";
import { getLevel } from "./levels.mjs";
import { levelResult } from "./score.mjs";

export function createGameController(options = {}) {
  const onChange = options.onChange ?? (() => {});

  let state = null;
  let level = null;
  let history = [];
  let outbox = [];
  let result = null;
  let recordedState = null;

  function collect() {
    if (state?.events?.length) outbox.push(...state.events);
  }

  function emit() {
    onChange(view());
  }

  function start(levelId) {
    const data = getLevel(levelId);
    if (!data) return false;
    level = data;
    state = createState(data);
    history = [];
    outbox = [];
    result = null;
    recordedState = null;
    emit();
    return true;
  }

  function move(dir) {
    if (!state || state.solved) return false;
    const before = state;
    const next = step(state, dir);
    if (!next) return false;
    if (next.lastMove?.moved) history.push(snapshot(before));
    state = next;
    collect();
    if (state.solved && recordedState !== state) {
      recordedState = state;
      result = levelResult(state, level);
    }
    emit();
    return true;
  }

  function undo() {
    if (!state || history.length === 0) return false;
    const saved = history.pop();
    state = restore(state, saved);
    outbox.push({ type: "undo" });
    result = null;
    recordedState = null;
    emit();
    return true;
  }

  function reset() {
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
      result,
      canMove: Boolean(state) && state.status === STATUS_PLAYING && !state.solved,
      canUndo: history.length > 0,
      undoDepth: history.length,
      optimal: level?.optimal ?? 0,
    };
  }

  return {
    start,
    move,
    undo,
    reset,
    drainEvents,
    view,
    get levelId() {
      return level?.id ?? null;
    },
  };
}
