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
  const manualSolved = isSolved(next);
  const manualLa = legalActions({ ...next, status: "playing" });
  const manualStuck = !manualSolved && manualLa.length === 0;
  if (manualSolved) {
    next.status = "won";
  } else if (manualStuck) {
    next.status = "stuck";
  } else {
    next.status = "playing";
  }
  // Defensive self-check: any divergence between the 2-step if/else above and
  // the pure manual predicates must never ship silently — fall back to the
  // manual result so the player is never locked out of a legal move.
  // (Silent console warn keeps game playable without crashing the UI thread.)
  const expected = manualSolved ? "won" : manualStuck ? "stuck" : "playing";
  if (next.status !== expected) {
    if (typeof console !== "undefined") {
      console.warn("[orbit-sort] withStatus divergence, forced to", expected,
        "tracks=", next.tracks.map(t => t.orbs.map(o => o.color).join(",")),
        "docks=", next.docks.map(d => d.orb?.color ?? "_"),
        "selected=", next.selectedDockId, "legal=", manualLa.length);
    }
    next.status = expected;
  }
  return next;
}

export function createState({ levelId = 1, dateKey, capacity, tracks, dockCount = 1, levelSeed = null }) {
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
    levelSeed,
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
    // stats.startedAt : 首次造成位移的动作发生时间戳(毫秒)，0表示还没动过
    // stats.movesPlayed : 真正发生过位移的动作计数(extract/insert结果valid的情况下++)，撤回和重置不会使这个数减少
    stats: { startedAt: 0, movesPlayed: 0 },
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
  // stats: 首次发生位移记录 startedAt，movesPlayed 只加不减
  next.stats = { ...next.stats };
  next.stats.movesPlayed = (next.stats.movesPlayed | 0) + 1;
  if (!next.stats.startedAt) next.stats.startedAt = Date.now();
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
    // Resolve the currently selected dock.
    // Use numeric id comparison to guard against storage/runtime id type drift
    // (string vs number). Never fall back to another dock: if the selected
    // pointer is null or targets an empty dock the user is in extraction mode.
    let selectedDock = null;
    if (state.selectedDockId !== null && state.selectedDockId !== undefined) {
      const wantId = Number(state.selectedDockId);
      const target = state.docks.find((dock) => Number(dock.id) === wantId);
      if (target && target.orb) {
        selectedDock = target;
      } else if (target && typeof console !== "undefined") {
        console.warn(
          "[orbit-sort] applyIntent: selectedDockId=",
          state.selectedDockId,
          "points to dock",
          target.id,
          "whose orb is falsy:",
          target.orb,
          " — routing to extract; docks snapshot =",
          state.docks.map((d) => ({ id: d.id, orb: d.orb?.color ?? null, origin: d.originTrackId, unlocked: d.unlocked })),
        );
      }
    }
    const trackId = intent.id;
    // Primary action: insert if a dock is currently selected+occupied, else extract.
    let primary;
    if (selectedDock) {
      primary = { type: "insert", dockId: selectedDock.id, trackId };
    } else {
      primary = { type: "extract", trackId };
    }
    const primaryRes = applyAction(state, primary);
    if (primaryRes.valid) return { ...primaryRes, action: primary };

    // --- Ambiguous-intent fallback for multi-dock / mixed-mode flows ---
    // When users have multiple docks they expect one action to "just work":
    //  * In placement mode (selectedDock occupied) but they click a fresh
    //    extractable track, they probably want to load another orb into an
    //    idle dock instead of inserting.
    //  * In extraction mode (no dock selected) but they click an empty /
    //    wrong-color track that happens to accept an occupied dock's orb,
    //    they probably want to place that orb, not get an extract error.
    if (selectedDock) {
      // Primary was INSERT and failed. Try EXTRACT into an idle unlocked dock.
      const idleDock = state.docks.find((d) => d.unlocked && !d.orb);
      if (idleDock && canExtract(state, trackId)) {
        const altAction = { type: "extract", trackId, dockId: idleDock.id };
        const altRes = applyAction(state, altAction);
        if (altRes.valid) return { ...altRes, action: altAction };
      }
      // Secondary: even if there is no idle dock (or the track cannot be
      // extracted while in placement mode because of completed/blocked), if
      // the user explicitly clicks an *extractable* track while a dock is
      // currently occupied, they are effectively asking us to cancel the
      // placement intent and extract instead. Clear selection and re-run the
      // extract. This preserves the "click track = act on that track" model.
      if (canExtract(state, trackId)) {
        const cleared = clearDockSelection(state);
        const action = { type: "extract", trackId };
        const res = applyAction(cleared, action);
        if (res.valid) return { ...res, action };
      }
      // Tertiary: primary dock's orb mismatches the clicked track's top, but
      // ANOTHER occupied unlocked dock has an orb that DOES match (i.e. the
      // player picked the wrong slot earlier and now expects the game to
      // route the correct color). If exactly one alternative dock qualifies,
      // implicitly select that dock and perform the insert. This keeps the
      // same "click track = drop orb" expectation and eliminates the huge
      // class of false "different-color" rule violations the player sees
      // when the correct-colored orb is literally sitting one dock over.
      const altDocks = state.docks.filter(
        (d) => d.unlocked && d.orb && Number(d.id) !== Number(selectedDock.id) && canInsert(state, d.id, trackId),
      );
      if (altDocks.length >= 1) {
        // If exactly one qualifies: just run it. When multiple match we
        // prefer the one whose orb color actually matches (always true per
        // filter), then the lowest numeric id to remain deterministic.
        // When ≥2 docks have identically-colored orbs this is still
        // unambiguous since either insert lands at the same destination.
        const pick = altDocks[0];
        // Two-step: select dock, then insert (both must succeed). We model
        // this as a single successful "insert" return for UI (with the real
        // dock id used so renderer/tracker logs the correct source).
        const selRes = applyAction(state, { type: "select-dock", dockId: pick.id });
        if (!selRes.valid) {
          // Fall through to original rejection below if something weird
          // blocked the dock selection (e.g. an unlocked mismatch).
        } else {
          const ins = { type: "insert", dockId: pick.id, trackId };
          const insRes = applyAction(selRes.state, ins);
          if (insRes.valid) return { ...insRes, action: ins };
        }
      }
    } else {
      // Primary was EXTRACT and failed. Try INSERT: find any unlocked
      // occupied dock that can legally place into the clicked track.
      // When ≥1 dock qualifies we route it deterministically: we pick the
      // lowest-numeric-id qualifying dock. Result-equivalence is guaranteed
      // by construction: the target track accepts them all via same-color
      // matching, so regardless of which source dock we pick the landing
      // state (completed tracks, top colors, new orb position) is identical
      // — only the selectedDock pointer / remaining-in-dock layout differs,
      // which never locks the player out of a future legal action. This
      // eliminates the "two docks happen to hold the same color" false
      // negative the player constantly sees.
      const candidates = state.docks.filter(
        (d) => d.unlocked && d.orb && canInsert(state, d.id, trackId),
      );
      if (candidates.length === 1) {
        const altAction = { type: "insert", dockId: candidates[0].id, trackId };
        const altRes = applyAction(state, altAction);
        if (altRes.valid) return { ...altRes, action: altAction };
      } else if (candidates.length > 1) {
        // For multi-dock matches we still want click-to-place. Select the
        // chosen dock first, then run insert — same "two actions routed as
        // one successful insert" pattern used on the placement-mode side.
        const pick = candidates[0];
        const selRes = applyAction(state, { type: "select-dock", dockId: pick.id });
        if (selRes.valid) {
          const ins = { type: "insert", dockId: pick.id, trackId };
          const insRes = applyAction(selRes.state, ins);
          if (insRes.valid) return { ...insRes, action: ins };
        }
      }
      // Tertiary: even though extract failed and we have zero (or still
      // failed) insert candidates, if the click target is itself a legal
      // extractable track after clearing the selection we already cover that
      // above for placement mode — here the user is in extraction mode
      // (nothing selected) so that isn't needed.
    }
    // No secondary match: return the primary result (its error/reason is the
    // most descriptive of what the player would have expected to happen).
    return { ...primaryRes, action: primary };
  }
  if (intent.target === "dock") {
    const dock = dockFor(state, intent.id);
    if (!dock) return { ...rejection("dock-not-found", "找不到这个中转槽"), state };
    const same = state.selectedDockId !== null && Number(state.selectedDockId) === Number(dock.id);
    const action = dock.orb
      ? (same ? { type: "clear-selection" } : { type: "select-dock", dockId: intent.id })
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
  // --- 积分系统：撤回不能减少 movesPlayed / startedAt（用户已经做过的操作永远算数）
  const prev = state.stats || { startedAt: 0, movesPlayed: 0 };
  const cur = restored.stats || { startedAt: 0, movesPlayed: 0 };
  restored.stats = {
    startedAt: prev.startedAt > 0 && cur.startedAt > 0 ? Math.min(prev.startedAt, cur.startedAt) : (prev.startedAt || cur.startedAt || 0),
    movesPlayed: Math.max(prev.movesPlayed | 0, cur.movesPlayed | 0),
  };
  // Snapshots carry the status from before their next move, but the world can
  // be re-evaluated with a newer reconcile / safety net — always recompute.
  return withStatus(restored);
}

export function reset(state, initialState) {
  if (state.moves === 0) return state;
  const next = cloneState(initialState);
  next.levelId = state.levelId;
  next.capacity = state.capacity;
  // --- 积分系统：重置本局不会清空累计的 movesPlayed / 最早开始时间（"撤回/重置"按需求都不算减少操作已累计步数）
  const prev = state.stats || { startedAt: 0, movesPlayed: 0 };
  next.stats = {
    startedAt: prev.startedAt || 0,
    movesPlayed: prev.movesPlayed | 0,
  };
  return withStatus(next);
}
