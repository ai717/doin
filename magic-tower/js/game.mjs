// 魔塔：勇者登顶 · 控制器（DOM-free 状态机，接收 UI 意图调度 engine）
//
// 职责：撤销栈（最近 30 步）、楼层初入快照、点击寻路、商店与罗盘调度、状态订阅。
// 不碰任何 DOM：渲染由 ui.mjs 订阅本模块的状态变化完成。

import { createState, findPath, step } from "./engine.mjs";
import { TOTAL_FLOORS } from "./data.mjs";

export const UNDO_LIMIT = 30;

export function createGame(levels, options = {}) {
  let state = options.state || createState(levels);
  let undoStack = [];
  let snapshots = new Map();
  let listeners = new Set();
  let lastEvents = [];

  snapshots.set(state.floor, state);

  function emit() {
    for (const fn of listeners) {
      try {
        fn(state);
      } catch {
        /* 单个订阅者出错不影响其余 */
      }
    }
    if (options.onChange) {
      try {
        options.onChange(state);
      } catch {
        /* 存档失败不阻断游戏 */
      }
    }
  }

  function pushUndo(before) {
    undoStack.push(before);
    if (undoStack.length > UNDO_LIMIT) undoStack = undoStack.slice(undoStack.length - UNDO_LIMIT);
  }

  function apply(intent) {
    const before = state;
    const result = step(state, intent);
    lastEvents = result.events;
    if (result.state && result.state !== before) {
      state = result.state;
      if (!snapshots.has(state.floor)) snapshots.set(state.floor, state);
      if (result.action) pushUndo(before);
    }
    emit();
    return { action: result.action, events: result.events };
  }

  function move(dx, dy) {
    return apply({ type: "move", dx, dy });
  }

  function moveKey(key) {
    const map = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const dir = map[key];
    if (!dir) return { action: null, events: [] };
    return move(dir[0], dir[1]);
  }

  // 点击空地：整段寻路一次走完（逐格入撤销栈），遇到切层或终局立即停下
  function pathTo(tx, ty) {
    const path = findPath(state, tx, ty);
    if (!path || !path.length) return { action: null, events: [{ type: "blocked", reason: "nopath" }], steps: 0 };
    let steps = 0;
    const events = [];
    for (const key of path) {
      if (state.status !== "playing") break;
      const floorBefore = state.floor;
      const result = moveKey(key);
      events.push(...result.events);
      if (!result.action) break;
      steps += 1;
      if (state.floor !== floorBefore) break;
    }
    return { action: steps ? { type: "path", steps } : null, events, steps };
  }

  function use() {
    return apply({ type: "use" });
  }

  function buy(kind) {
    return apply({ type: "buy", kind });
  }

  function travel(floor) {
    return apply({ type: "travel", floor });
  }

  function undo() {
    if (!undoStack.length) return { action: null, events: [] };
    const prev = undoStack.pop();
    const before = state;
    state = prev;
    // 撤销跨越楼层时，同步回滚楼层快照之外的瞬时状态（快照本身保留，供「重返本层」使用）
    lastEvents = [{ type: "undo" }];
    emit();
    return { action: { type: "undo", restoredFloor: before.floor }, events: lastEvents };
  }

  function canUndo() {
    return undoStack.length > 0;
  }

  function undoDepth() {
    return undoStack.length;
  }

  // 回到本层刚踏入时的状态（保留撤销能力）
  function restoreFloor() {
    const snapshot = snapshots.get(state.floor);
    if (!snapshot) return { action: null, events: [] };
    const before = state;
    const prev = snapshot;
    state = prev;
    pushUndo(before);
    lastEvents = [{ type: "restore" }];
    emit();
    return { action: { type: "restore", floor: state.floor }, events: lastEvents };
  }

  function restart() {
    state = createState(levels);
    undoStack = [];
    snapshots = new Map();
    snapshots.set(state.floor, state);
    lastEvents = [{ type: "restart" }];
    emit();
    return state;
  }

  function loadState(next) {
    if (!next) return;
    state = next;
    undoStack = [];
    snapshots = new Map();
    snapshots.set(state.floor, state);
    lastEvents = [];
    emit();
  }

  function visitedFloors() {
    const list = [];
    for (let i = 1; i <= TOTAL_FLOORS; i += 1) {
      const floor = state.floors[i - 1];
      if (floor && floor.visited) list.push(i);
    }
    return list;
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return {
    levels,
    getState: () => state,
    subscribe,
    move,
    moveKey,
    pathTo,
    use,
    buy,
    travel,
    undo,
    canUndo,
    undoDepth,
    restoreFloor,
    restart,
    loadState,
    visitedFloors,
    getLastEvents: () => lastEvents,
  };
}
