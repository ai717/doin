const KEY = "doin.orbit-sort.progress.v1";

// ---- 积分系统数据结构说明 -------------------------------------------------
// progress.bestScoresByLevel :: { [levelKey]: {
//   score: number,    // 单局合计 (base + move + time)
//   base:  number, move: number, time: number,
//   stars: 1..3,
//   movesPlayed: number, elapsedMs: number,
//   recordedAt: number (timestamp ms)
// } }
// levelKey = 主线关 id 字符串；今日星轨 = `daily:${dateKey}`
//
// progress.totalScore   :: Σ bestScoresByLevel[*].score（用户累计总积分 =
//                          所有关卡单局最高分之和；单局取最高分）
// progress.totalMoves   :: 累计完成关操作步数 (movesPlayed 总和，每关只取其
//                          最佳分数那次的 movesPlayed)
// progress.daily        :: 今日星轨数据，额外记录 bestScore
// -------------------------------------------------------------------------

function freshDaily() {
  return {
    dateKey: null,
    completed: false,
    bestMoves: null,
    bestScore: null, // 今日星轨最佳得分 (完整 score 明细)
    currentGame: null,
    streak: 0,
    bestStreak: 0,
    lastCompletedDate: null,
  };
}

function fresh() {
  return {
    version: 1,
    settings: { soundOn: true },
    unlockedLevel: 1,
    bestByLevel: {},
    bestScoresByLevel: {},
    totalScore: 0,
    totalMoves: 0,
    currentGame: null,
    daily: freshDaily(),
  };
}

function normalizeDaily(value) {
  const base = freshDaily();
  if (!value || typeof value !== "object") return base;
  return {
    dateKey: typeof value.dateKey === "string" ? value.dateKey : null,
    completed: value.completed === true,
    bestMoves: Number.isInteger(value.bestMoves) ? value.bestMoves : null,
    bestScore: isScoreDetail(value.bestScore) ? value.bestScore : null,
    currentGame: value.currentGame ?? null,
    streak: Number.isInteger(value.streak) ? Math.max(0, value.streak) : 0,
    bestStreak: Number.isInteger(value.bestStreak) ? Math.max(0, value.bestStreak) : 0,
    lastCompletedDate: typeof value.lastCompletedDate === "string" ? value.lastCompletedDate : null,
  };
}

function isScoreDetail(v) {
  return v && typeof v === "object" &&
    Number.isFinite(v.score) && Number.isFinite(v.base) &&
    Number.isFinite(v.move) && Number.isFinite(v.time) &&
    Number.isFinite(v.stars);
}

function normalizeScoreMap(value) {
  if (!value || typeof value !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(value)) if (isScoreDetail(v)) out[k] = v;
  return out;
}

function recomputeTotals(bestScoresByLevel) {
  let totalScore = 0;
  let totalMoves = 0;
  for (const detail of Object.values(bestScoresByLevel)) {
    if (!isScoreDetail(detail)) continue;
    totalScore += detail.score | 0;
    totalMoves += Number.isInteger(detail.movesPlayed) ? detail.movesPlayed : 0;
  }
  return { totalScore, totalMoves };
}

function write(progress) {
  try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch { /* Playing remains available without storage. */ }
}

export function isValidStoredState(state, level) {
  if (!state || state.status !== "playing" || state.capacity !== level.capacity) return false;
  if (state.levelSeed !== level.seed) return false;
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
    const bestScoresByLevel = normalizeScoreMap(value.bestScoresByLevel);
    const { totalScore, totalMoves } = recomputeTotals(bestScoresByLevel);
    return {
      version: 1,
      settings: { soundOn: value.settings?.soundOn !== false },
      unlockedLevel: Math.max(1, value.unlockedLevel),
      bestByLevel: value.bestByLevel ?? {},
      bestScoresByLevel,
      totalScore,
      totalMoves,
      currentGame: value.currentGame ?? null,
      daily: normalizeDaily(value.daily),
    };
  } catch { return fresh(); }
}

// 返回 { progress, stars, isNewBest, scoreDetail, isNewHighScore }
// 兼容旧调用 (progress, level, moves) — 此时视为未提供详细分数, 走历史旧星评
export function recordCompletion(progress, level, movesOrDetail) {
  const detailGiven = movesOrDetail && typeof movesOrDetail === "object";
  const moves = detailGiven ? (movesOrDetail.movesPlayed | 0 || movesOrDetail.moves | 0 || 0) : (movesOrDetail | 0);
  const scoreDetail = detailGiven && movesOrDetail.scoreDetail ? movesOrDetail.scoreDetail : null;
  const stars = scoreDetail ? (scoreDetail.stars | 0) : (moves <= level.par ? 3 : moves <= level.par + 3 ? 2 : 1);

  // —— 三星 bestByLevel 更新（保持原逻辑）
  const prevStar = progress.bestByLevel[level.id];
  const starBest = !prevStar || stars > prevStar.stars || (stars === prevStar.stars && moves < prevStar.moves)
    ? { stars, moves }
    : prevStar;
  const starImproved = starBest !== prevStar;

  // —— 积分 bestScoresByLevel 更新（用户需求：单局取最高分）
  const prevScore = progress.bestScoresByLevel[level.id] ?? null;
  let scoreBest = prevScore;
  let scoreImproved = false;
  if (scoreDetail) {
    const stored = {
      score: scoreDetail.total | 0,
      base: scoreDetail.base | 0,
      move: scoreDetail.move | 0,
      time: scoreDetail.time | 0,
      stars,
      movesPlayed: detailGiven && Number.isInteger(movesOrDetail.movesPlayed) ? movesOrDetail.movesPlayed : moves,
      elapsedMs: detailGiven && Number.isInteger(movesOrDetail.elapsedMs) ? movesOrDetail.elapsedMs : 0,
      recordedAt: Date.now(),
    };
    if (!prevScore || stored.score > prevScore.score) {
      scoreBest = stored;
      scoreImproved = true;
    } else {
      scoreBest = prevScore;
    }
  }
  const nextScores = scoreBest
    ? { ...progress.bestScoresByLevel, [level.id]: scoreBest }
    : progress.bestScoresByLevel;
  const { totalScore, totalMoves } = recomputeTotals(nextScores);

  const next = {
    version: 1,
    settings: { soundOn: progress.settings?.soundOn !== false },
    unlockedLevel: Math.max(progress.unlockedLevel, Math.min(100, level.id + 1)),
    bestByLevel: { ...progress.bestByLevel, [level.id]: starBest },
    bestScoresByLevel: nextScores,
    totalScore,
    totalMoves,
    currentGame: null,
    daily: progress.daily ?? freshDaily(),
  };
  write(next);
  return {
    progress: next,
    stars,
    isNewBest: starImproved,
    scoreDetail: scoreBest,
    isNewHighScore: scoreImproved,
    totalScore,
  };
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

export function recordDailyCompletion(progress, dateKey, movesOrDetail) {
  const detailGiven = movesOrDetail && typeof movesOrDetail === "object";
  const moves = detailGiven ? (movesOrDetail.movesPlayed | 0 || movesOrDetail.moves | 0 || 0) : (movesOrDetail | 0);
  const scoreDetail = detailGiven && movesOrDetail.scoreDetail ? movesOrDetail.scoreDetail : null;

  const previous = progress.daily;
  const firstCompletionToday = previous.dateKey !== dateKey || !previous.completed;
  const streak = firstCompletionToday
    ? previous.lastCompletedDate === previousDateKey(dateKey) ? previous.streak + 1 : 1
    : previous.streak;
  const bestMoves = previous.dateKey === dateKey && previous.bestMoves !== null
    ? Math.min(previous.bestMoves, moves)
    : moves;

  // —— 今日星轨：单局取最高分（isDaily 含 +50 基础分加成）；结果写入 bestScoresByLevel["daily:$dateKey"]
  const scoreKey = `daily:${dateKey}`;
  const prevScore = progress.bestScoresByLevel[scoreKey] ?? null;
  let scoreBest = prevScore;
  let scoreImproved = false;
  if (scoreDetail) {
    const stored = {
      score: scoreDetail.total | 0,
      base: scoreDetail.base | 0,
      move: scoreDetail.move | 0,
      time: scoreDetail.time | 0,
      stars: Number.isFinite(scoreDetail.stars) ? scoreDetail.stars | 0 : (moves <= scoreDetail.par ? 3 : 1),
      movesPlayed: detailGiven && Number.isInteger(movesOrDetail.movesPlayed) ? movesOrDetail.movesPlayed : moves,
      elapsedMs: detailGiven && Number.isInteger(movesOrDetail.elapsedMs) ? movesOrDetail.elapsedMs : 0,
      recordedAt: Date.now(),
    };
    if (!prevScore || stored.score > prevScore.score) {
      scoreBest = stored;
      scoreImproved = true;
    }
  }
  const nextScores = scoreBest
    ? { ...progress.bestScoresByLevel, [scoreKey]: scoreBest }
    : progress.bestScoresByLevel;
  const { totalScore, totalMoves } = recomputeTotals(nextScores);

  const dailyBestScore = (!previous.bestScore || (scoreBest && scoreBest.score > previous.bestScore.score))
    ? scoreBest || previous.bestScore
    : previous.bestScore;

  const next = {
    ...progress,
    bestScoresByLevel: nextScores,
    totalScore,
    totalMoves,
    daily: {
      ...previous,
      dateKey,
      completed: true,
      bestMoves,
      bestScore: dailyBestScore,
      currentGame: null,
      streak,
      bestStreak: Math.max(previous.bestStreak, streak),
      lastCompletedDate: firstCompletionToday ? dateKey : previous.lastCompletedDate,
    },
  };
  write(next);
  return {
    progress: next,
    isNewBest: previous.dateKey !== dateKey || previous.bestMoves === null || moves < previous.bestMoves,
    isNewHighScore: scoreImproved,
    scoreDetail: scoreBest,
    totalScore,
  };
}
