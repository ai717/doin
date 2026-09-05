// 0-1 BFS solver for Orbit Dispatch Master.

import {
  canExtract,
  canInsert,
  cloneState,
  extractOrb,
  insertOrb,
  isSolved,
} from "./engine.mjs?v=48f76844757c";

class Deque {
  constructor() {
    this.front = [];
    this.back = [];
    this.backIndex = 0;
  }

  pushFront(value) {
    this.front.push(value);
  }

  pushBack(value) {
    this.back.push(value);
  }

  popFront() {
    if (this.front.length > 0) return this.front.pop();
    if (this.backIndex >= this.back.length) return undefined;
    const value = this.back[this.backIndex];
    this.backIndex += 1;
    return value;
  }

  get length() {
    return this.front.length + this.back.length - this.backIndex;
  }
}

function modeKey(track) {
  return `${track.mode}:${track.completed ? 1 : 0}:${track.frozenUntilColor ?? "-"}`;
}

export function stateKey(state) {
  const tracks = state.tracks.map(
    (track) => `${track.id}:${modeKey(track)}:${track.orbs.map((orb) => orb.color).join(",")}`,
  );
  const docks = state.docks.map(
    (dock) => `${dock.id}:${dock.unlocked ? 1 : 0}:${dock.orb?.color ?? "-"}:${dock.originTrackId ?? "-"}`,
  );
  return `${tracks.join("|")}#${docks.join("|")}`;
}

function cleanSearchState(state) {
  const next = cloneState(state);
  next.history = [];
  next.selectedDockId = null;
  return next;
}

function solverActions(state) {
  const actions = [];
  const hasOpenDock = state.docks.some((dock) => dock.unlocked && dock.orb === null);

  if (hasOpenDock) {
    for (const track of state.tracks) {
      if (canExtract(state, track.id)) actions.push({ type: "extract", trackId: track.id });
    }
  }

  for (const dock of state.docks) {
    if (!dock.orb) continue;
    let usedNormalEmptyTrack = false;
    for (const track of state.tracks) {
      if (!canInsert(state, dock.id, track.id)) continue;
      if (track.mode === "normal" && !track.completed && track.orbs.length === 0) {
        if (usedNormalEmptyTrack) continue;
        usedNormalEmptyTrack = true;
      }
      actions.push({ type: "insert", dockId: dock.id, trackId: track.id });
    }
  }

  return actions;
}

export function applyAction(state, action) {
  const next = action.type === "extract"
    ? extractOrb(state, action.trackId)
    : action.type === "insert"
      ? insertOrb(state, action.dockId, action.trackId)
      : state;
  return next === state ? state : cleanSearchState(next);
}

function reconstructPath(parents, goalKey) {
  const actions = [];
  let key = goalKey;
  while (parents.get(key)?.parentKey !== null) {
    const entry = parents.get(key);
    actions.push(entry.action);
    key = entry.parentKey;
  }
  return actions.reverse();
}

export function solve(initialState, { nodeLimit = 2_000_000, timeLimitMs = 5_000 } = {}) {
  const startedAt = performance.now();
  const start = cleanSearchState(initialState);
  const startKey = stateKey(start);
  const queue = new Deque();
  const parents = new Map([[startKey, { cost: 0, parentKey: null, action: null }]]);
  queue.pushBack({ key: startKey, state: start, cost: 0 });
  let nodes = 0;

  while (queue.length > 0) {
    if (nodes >= nodeLimit) {
      return { status: "timeout", actions: null, par: null, nodes, elapsedMs: performance.now() - startedAt };
    }
    if (performance.now() - startedAt >= timeLimitMs) {
      return { status: "timeout", actions: null, par: null, nodes, elapsedMs: performance.now() - startedAt };
    }

    const current = queue.popFront();
    const best = parents.get(current.key);
    if (!best || best.cost !== current.cost) continue;
    nodes += 1;

    if (isSolved(current.state)) {
      return {
        status: "solved",
        actions: reconstructPath(parents, current.key),
        par: current.cost,
        nodes,
        elapsedMs: performance.now() - startedAt,
      };
    }

    for (const action of solverActions(current.state)) {
      const next = applyAction(current.state, action);
      if (next === current.state) continue;
      const edgeCost = action.type === "extract" ? 1 : 0;
      const nextCost = current.cost + edgeCost;
      const key = stateKey(next);
      const previous = parents.get(key);
      if (previous && previous.cost <= nextCost) continue;

      parents.set(key, { cost: nextCost, parentKey: current.key, action });
      const entry = { key, state: next, cost: nextCost };
      if (edgeCost === 0) queue.pushFront(entry);
      else queue.pushBack(entry);
    }
  }

  return { status: "exhausted", actions: null, par: null, nodes, elapsedMs: performance.now() - startedAt };
}

export function analyzeOptimalFirstActions(initialState, options = {}) {
  const baseline = solve(initialState, options);
  if (baseline.status !== "solved") {
    return { status: baseline.status, par: baseline.par ?? null, actions: [] };
  }
  const firstActions = [];
  for (const action of solverActions(cleanSearchState(initialState))) {
    const next = applyAction(initialState, action);
    if (next === initialState) continue;
    const result = solve(next, options);
    const cost = action.type === "extract" ? 1 : 0;
    if (result.status === "solved" && result.par + cost === baseline.par) firstActions.push(action);
  }
  return { status: "solved", par: baseline.par, actions: firstActions };
}

export function replayActions(initialState, actions) {
  let state = cleanSearchState(initialState);
  for (const action of actions) {
    state = applyAction(state, action);
    if (state === initialState) return null;
  }
  return state;
}
