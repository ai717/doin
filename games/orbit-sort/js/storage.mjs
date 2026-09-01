const KEY = "doin.orbit-sort.progress.v1";

function freshDaily() {
  return { dateKey: null, completed: false, bestMoves: null, currentGame: null, streak: 0, bestStreak: 0, lastCompletedDate: null };
}

function fresh() { return { version: 1, settings: { soundOn: true }, unlockedLevel: 1, bestByLevel: {}, currentGame: null, daily: freshDaily() }; }

function normalizeDaily(value) {
  const base = freshDaily();
  if (!value || typeof value !== "object") return base;
  return {
    dateKey: typeof value.dateKey === "string" ? value.dateKey : null,
    completed: value.completed === true,
    bestMoves: Number.isInteger(value.bestMoves) ? value.bestMoves : null,
    currentGame: value.currentGame ?? null,
    streak: Number.isInteger(value.streak) ? Math.max(0, value.streak) : 0,
    bestStreak: Number.isInteger(value.bestStreak) ? Math.max(0, value.bestStreak) : 0,
    lastCompletedDate: typeof value.lastCompletedDate === "string" ? value.lastCompletedDate : null,
  };
}

function write(progress) {
  try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch { /* Playing remains available without storage. */ }
}

export function isValidStoredState(state, level) {
  if (!state || state.status !== "playing" || state.capacity !== level.capacity) return false;
  if (!Array.isArray(state.tracks) || state.tracks.length !== level.tracks.length) return false;
  if (!Array.isArray(state.docks) || state.docks.length !== level.dockCount) return false;
  if (!Array.isArray(state.history) || state.history.length > 200) return false;
  if (!state.tracks.every((track, index) => track.id === index && Array.isArray(track.orbs) && track.orbs.length <= level.capacity)) return false;
  if (!state.docks.every((dock, index) => dock.id === index && typeof dock.unlocked === "boolean" && (dock.orb === null || typeof dock.orb === "object"))) return false;
  const colorCount = Math.max(...level.tracks.flat()) + 1;
  const ids = new Set();
  const orbs = [...state.tracks.flatMap((track) => track.orbs), ...state.docks.map((dock) => dock.orb).filter(Boolean)];
  if (orbs.length !== level.tracks.flat().length) return false;
  for (const orb of orbs) {
    if (!orb || typeof orb.id !== "string" || !Number.isInteger(orb.color) || orb.color < 0 || orb.color >= colorCount || ids.has(orb.id)) return false;
    ids.add(orb.id);
  }
  return state.selectedDockId === null || state.docks.some((dock) => dock.id === state.selectedDockId && dock.orb);
}

export function loadProgress() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    if (!value || value.version !== 1 || !Number.isInteger(value.unlockedLevel)) return fresh();
    return {
      version: 1,
      settings: { soundOn: value.settings?.soundOn !== false },
      unlockedLevel: Math.max(1, value.unlockedLevel),
      bestByLevel: value.bestByLevel ?? {},
      currentGame: value.currentGame ?? null,
      daily: normalizeDaily(value.daily),
    };
  } catch { return fresh(); }
}

export function recordCompletion(progress, level, moves) {
  const stars = moves <= level.par ? 3 : moves <= level.par + 3 ? 2 : 1;
  const previous = progress.bestByLevel[level.id];
  const best = !previous || stars > previous.stars || (stars === previous.stars && moves < previous.moves)
    ? { stars, moves }
    : previous;
  const next = {
    version: 1,
    settings: { soundOn: progress.settings?.soundOn !== false },
    unlockedLevel: Math.max(progress.unlockedLevel, Math.min(30, level.id + 1)),
    bestByLevel: { ...progress.bestByLevel, [level.id]: best }, currentGame: null,
    daily: progress.daily ?? freshDaily(),
  };
  write(next);
  return { progress: next, stars, isNewBest: best === previous ? false : true };
}

export function saveCurrentGame(progress, state) {
  if (state.levelId === "daily") {
    const next = {
      ...progress,
      daily: { ...progress.daily, dateKey: state.dateKey, completed: false, currentGame: state },
    };
    write(next);
    return next;
  }
  const next = { ...progress, currentGame: { levelId: state.levelId, state } };
  write(next);
  return next;
}

export function saveSoundPreference(progress, soundOn) {
  const next = { ...progress, settings: { ...progress.settings, soundOn: Boolean(soundOn) } };
  write(next);
  return next;
}

function previousDateKey(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() - 1);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function recordDailyCompletion(progress, dateKey, moves) {
  const previous = progress.daily;
  const firstCompletionToday = previous.dateKey !== dateKey || !previous.completed;
  const streak = firstCompletionToday
    ? previous.lastCompletedDate === previousDateKey(dateKey) ? previous.streak + 1 : 1
    : previous.streak;
  const bestMoves = previous.dateKey === dateKey && previous.bestMoves !== null
    ? Math.min(previous.bestMoves, moves)
    : moves;
  const next = {
    ...progress,
    daily: {
      ...previous,
      dateKey,
      completed: true,
      bestMoves,
      currentGame: null,
      streak,
      bestStreak: Math.max(previous.bestStreak, streak),
      lastCompletedDate: firstCompletionToday ? dateKey : previous.lastCompletedDate,
    },
  };
  write(next);
  return { progress: next, isNewBest: previous.dateKey !== dateKey || previous.bestMoves === null || moves < previous.bestMoves };
}
