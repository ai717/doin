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

export function createState({ levelId = 1, capacity, tracks, dockCount = 1 }) {
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
  if (state.status !== "playing") return false;
  const track = trackFor(state, trackId);
  if (!track || track.completed || isBlockedForExtract(track) || track.orbs.length === 0) {
    return false;
  }
  return state.docks.some((dock) => dock.unlocked && dock.orb === null);
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
  const dock = dockFor(state, dockId);
  return Boolean(dock?.unlocked && dock.orb);
}

export function selectDock(state, dockId) {
  if (!canSelectDock(state, dockId)) return state;
  const next = cloneState(state);
  next.selectedDockId = dockId;
  return next;
}

export function canInsert(state, dockId, trackId) {
  if (state.status !== "playing") return false;
  const dock = dockFor(state, dockId);
  const track = trackFor(state, trackId);
  if (
    !dock || !dock.unlocked || !dock.orb ||
    !track || track.completed || isBlockedForInsert(track) ||
    track.orbs.length >= state.capacity
  ) {
    return false;
  }
  const topOrb = track.orbs.at(-1);
  return topOrb === undefined || topOrb.color === dock.orb.color;
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

export function isSolved(state) {
  if (state.docks.some((dock) => dock.orb !== null)) return false;
  return state.tracks.every(
    (track) => track.orbs.length === 0 || track.completed || isTrackComplete(track, state.capacity),
  );
}

export function isStuck(state) {
  if (isSolved(state)) return false;
  return legalActions(state).length === 0;
}

export function undo(state) {
  if (state.history.length === 0) return state;
  const restored = cloneSnapshot(state.history.at(-1));
  restored.levelId = state.levelId;
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
