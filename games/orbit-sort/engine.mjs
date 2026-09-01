// Orbit Dispatch Master: pure game rules.

const MAX_HISTORY = 200;

function cloneOrb(orb) {
  return { id: orb.id, color: orb.color };
}

function cloneTrack(track) {
  return {
    id: track.id,
    orbs: track.orbs.map(cloneOrb),
    mode: track.mode,
    completed: track.completed,
    ...(track.frozenUntilColor === undefined
      ? {}
      : { frozenUntilColor: track.frozenUntilColor }),
  };
}

function cloneDock(dock) {
  return {
    id: dock.id,
    unlocked: dock.unlocked,
    orb: dock.orb ? cloneOrb(dock.orb) : null,
    originTrackId: dock.originTrackId,
  };
}

function cloneSnapshot(snapshot) {
  return {
    tracks: snapshot.tracks.map(cloneTrack),
    docks: snapshot.docks.map(cloneDock),
    selectedDockId: snapshot.selectedDockId,
    moves: snapshot.moves,
    status: snapshot.status,
    ...(snapshot.hintsUsed === undefined ? {} : { hintsUsed: snapshot.hintsUsed }),
  };
}

function snapshotOf(state) {
  return {
    tracks: state.tracks.map(cloneTrack),
    docks: state.docks.map(cloneDock),
    selectedDockId: state.selectedDockId,
    moves: state.moves,
    status: state.status,
    hintsUsed: state.hintsUsed,
  };
}

function trackFor(state, trackId) {
  return state.tracks.find((track) => track.id === trackId) ?? null;
}

function dockFor(state, dockId) {
  return state.docks.find((dock) => dock.id === dockId) ?? null;
}

function isBlockedForExtract(track) {
  return track.mode === "frozen" || track.mode === "in-only";
}

function isBlockedForInsert(track) {
  return track.mode === "frozen" || track.mode === "out-only";
}

function rejection(reason, message) {
  return { valid: false, reason, message };
}

function withStatus(state) {
  const next = { ...state };
  if (isSolved(next)) {
    next.status = "won";
  } else if (isStuck(next)) {
    next.status = "stuck";
  } else {
    next.status = "playing";
  }
  return next;
}

export function createState({ levelId = 1, dateKey, capacity, tracks, dockCount = 1 }) {
  const normalizedTracks = tracks.map((trackOrbs, index) => {
    const source = Array.isArray(trackOrbs) ? { orbs: trackOrbs } : trackOrbs;
    const mode = source.mode ?? "normal";
    return {
      id: source.id ?? index,
      orbs: source.orbs.map((orb, orbIndex) =>
        typeof orb === "number"
          ? { id: `${levelId}:t${source.id ?? index}:o${orbIndex}`, color: orb }
          : cloneOrb(orb),
      ),
      mode,
      completed: source.completed ?? false,
      ...(source.frozenUntilColor === undefined
        ? {}
        : { frozenUntilColor: source.frozenUntilColor }),
    };
  });

  return {
    levelId,
    ...(dateKey === undefined ? {} : { dateKey }),
    capacity,
    tracks: normalizedTracks,
    docks: Array.from({ length: dockCount }, (_, id) => ({
      id,
      unlocked: true,
      orb: null,
      originTrackId: null,
    })),
    selectedDockId: null,
    moves: 0,
    hintsUsed: 0,
    status: "playing",
    history: [],
  };
}

export function cloneState(state) {
  return {
    ...state,
    tracks: state.tracks.map(cloneTrack),
    docks: state.docks.map(cloneDock),
    history: state.history.map(cloneSnapshot),
  };
}

export function isTrackComplete(track, capacity) {
  return (
    track.orbs.length === capacity &&
    track.orbs.length > 0 &&
    track.orbs.every((orb) => orb.color === track.orbs[0].color)
  );
}

export function canExtract(state, trackId) {
  return validateAction(state, { type: "extract", trackId }).valid;
}

export function extractOrb(state, trackId) {
  if (!canExtract(state, trackId)) return state;

  const dock = state.docks.find((item) => item.unlocked && item.orb === null);
  const next = cloneState(state);
  const track = trackFor(next, trackId);
  const nextDock = dockFor(next, dock.id);
  nextDock.orb = track.orbs.pop();
  nextDock.originTrackId = track.id;
  next.selectedDockId = nextDock.id;
  next.moves += 1;
  next.history = [...next.history, snapshotOf(state)].slice(-MAX_HISTORY);
  return withStatus(next);
}

export function canSelectDock(state, dockId) {
  return validateAction(state, { type: "select-dock", dockId }).valid;
}

export function selectDock(state, dockId) {
  if (!canSelectDock(state, dockId)) return state;
  const next = cloneState(state);
  next.selectedDockId = dockId;
  return next;
}

export function clearDockSelection(state) {
  if (state.selectedDockId === null) return state;
  const next = cloneState(state);
  next.selectedDockId = null;
  return next;
}

export function canInsert(state, dockId, trackId) {
  return validateAction(state, { type: "insert", dockId, trackId }).valid;
}

/**
 * The sole legality authority for player and solver actions.
 * `stuck` is derived feedback, never an input lock; only `won` is terminal.
 */
export function validateAction(state, action) {
  if (!action || typeof action !== "object") {
    return rejection("unknown-action", "无法识别这次调度");
  }
  if (action.type === "extract") {
    if (state.status === "won") return rejection("won", "本关已经完成");
    const track = trackFor(state, action.trackId);
    if (!track) return rejection("track-not-found", "找不到这条轨道");
    if (track.completed) return rejection("completed-track", "已完成轨道不能取出星体");
    if (isBlockedForExtract(track)) return rejection("extract-blocked", "这条轨道当前不能取出星体");
    if (track.orbs.length === 0) return rejection("empty-track", "空轨道没有可取出的星体");
    if (!state.docks.some((dock) => dock.unlocked && dock.orb === null)) {
      return rejection("no-empty-dock", "没有空的中转槽");
    }
    return { valid: true };
  }
  if (action.type === "insert") {
    if (state.status === "won") return rejection("won", "本关已经完成");
    const dock = dockFor(state, action.dockId);
    const track = trackFor(state, action.trackId);
    if (!dock) return rejection("dock-not-found", "找不到这个中转槽");
    if (!dock.unlocked) return rejection("dock-locked", "这个中转槽尚未解锁");
    if (!dock.orb) return rejection("empty-dock", "中转槽里没有星体");
    if (!track) return rejection("track-not-found", "找不到这条轨道");
    if (track.completed) return rejection("completed-track", "已完成轨道不能继续落入");
    if (isBlockedForInsert(track)) return rejection("insert-blocked", "这条轨道当前不能落入星体");
    if (track.orbs.length >= state.capacity) return rejection("full-track", "这条轨道已经满了");
    const topOrb = track.orbs.at(-1);
    if (topOrb !== undefined && topOrb.color !== dock.orb.color) {
      return rejection("different-color", "只能将同色星体落入这条轨道");
    }
    return { valid: true };
  }
  if (action.type === "select-dock") {
    if (state.status === "won") return rejection("won", "本关已经完成");
    const dock = dockFor(state, action.dockId);
    if (!dock) return rejection("dock-not-found", "找不到这个中转槽");
    if (!dock.unlocked) return rejection("dock-locked", "这个中转槽尚未解锁");
    if (!dock.orb) return rejection("empty-dock", "中转槽里没有星体");
    return { valid: true };
  }
  if (action.type === "clear-selection") {
    if (state.status === "won") return rejection("won", "本关已经完成");
    if (state.selectedDockId === null) return rejection("no-selection", "当前已经是取出模式");
    return { valid: true };
  }
  return rejection("unknown-action", "无法识别这次调度");
}

export function applyAction(state, action) {
  const result = validateAction(state, action);
  if (!result.valid) return { ...result, state };
  let nextState;
  if (action.type === "extract") nextState = extractOrb(state, action.trackId);
  if (action.type === "insert") nextState = insertOrb(state, action.dockId, action.trackId);
  if (action.type === "select-dock") nextState = selectDock(state, action.dockId);
  if (action.type === "clear-selection") nextState = clearDockSelection(state);
  return { valid: true, action, state: nextState };
}

export function applyIntent(state, intent) {
  if (!intent || typeof intent !== "object") return { ...rejection("unknown-intent", "无法识别这次操作"), state };
  if (intent.target === "track") {
    const selectedDock = state.docks.find((dock) => dock.id === state.selectedDockId && dock.orb);
    const action = selectedDock
      ? { type: "insert", dockId: selectedDock.id, trackId: intent.id }
      : { type: "extract", trackId: intent.id };
    return { ...applyAction(state, action), action };
  }
  if (intent.target === "dock") {
    const dock = dockFor(state, intent.id);
    if (!dock) return { ...rejection("dock-not-found", "找不到这个中转槽"), state };
    const action = dock?.orb
      ? { type: "select-dock", dockId: intent.id }
      : { type: "clear-selection" };
    return { ...applyAction(state, action), action };
  }
  return { ...rejection("unknown-intent", "无法识别这次操作"), state };
}

function unlockFrozenTracks(next, completedColor) {
  for (const track of next.tracks) {
    if (track.mode === "frozen" && track.frozenUntilColor === completedColor) {
      track.mode = "normal";
      delete track.frozenUntilColor;
    }
  }
}

export function insertOrb(state, dockId, trackId) {
  if (!canInsert(state, dockId, trackId)) return state;

  const next = cloneState(state);
  const dock = dockFor(next, dockId);
  const track = trackFor(next, trackId);
  const orb = dock.orb;
  dock.orb = null;
  dock.originTrackId = null;
  track.orbs.push(orb);

  if (isTrackComplete(track, next.capacity)) {
    track.completed = true;
    unlockFrozenTracks(next, orb.color);
  }

  next.selectedDockId = next.docks.find((item) => item.unlocked && item.orb)?.id ?? null;
  return withStatus(next);
}

export function legalActions(state) {
  const actions = [];
  for (const track of state.tracks) {
    if (canExtract(state, track.id)) actions.push({ type: "extract", trackId: track.id });
  }
  for (const dock of state.docks) {
    if (!dock.orb) continue;
    for (const track of state.tracks) {
      if (canInsert(state, dock.id, track.id)) {
        actions.push({ type: "insert", dockId: dock.id, trackId: track.id });
      }
    }
  }
  return actions;
}

export function evaluateState(state) {
  const status = isSolved(state) ? "won" : isStuck(state) ? "stuck" : "playing";
  return { status, legalActions: legalActions({ ...state, status: "playing" }) };
}

export function isSolved(state) {
  if (state.docks.some((dock) => dock.orb !== null)) return false;
  return state.tracks.every(
    (track) => track.orbs.length === 0 || track.completed || isTrackComplete(track, state.capacity),
  );
}

export function isStuck(state) {
  if (isSolved(state)) return false;
  return legalActions({ ...state, status: "playing" }).length === 0;
}

export function undo(state) {
  if (state.history.length === 0) return state;
  const restored = cloneSnapshot(state.history.at(-1));
  restored.levelId = state.levelId;
  if (state.dateKey !== undefined) restored.dateKey = state.dateKey;
  restored.capacity = state.capacity;
  restored.history = state.history.slice(0, -1).map(cloneSnapshot);
  restored.hintsUsed = state.hintsUsed;
  return restored;
}

export function reset(state, initialState) {
  if (state.moves === 0) return state;
  const next = cloneState(initialState);
  next.levelId = state.levelId;
  next.capacity = state.capacity;
  return next;
}
