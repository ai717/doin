// 状态控制器：DOM-free。只接收 UI 意图，调度 engine 的纯函数，自己只管时间与战绩。

import { CASES, caseById, chapterOf, nextCaseId } from "./cases.mjs";
import {
  STAMP,
  applySeal,
  boardSummary,
  canSeal,
  clearEvidence,
  createBoard,
  cycleStamp,
  relatedEvidence,
  setIndictment,
  setStamp,
  solveCase,
} from "./engine.mjs";
import { betterRecord, formatDuration, starsFor } from "./score.mjs";

export const MAX_FRAME_MS = 250;

export function isUnlocked(progress, id) {
  if (id <= 1) return true;
  return Boolean(progress?.cases?.[id - 1]);
}

export function createGame(options = {}) {
  const {
    loadProgress = () => ({ version: 1, cases: {}, lastCase: 1 }),
    recordCase = (progress) => progress,
    onChange = () => {},
    onWin = () => {},
    onMistake = () => {},
    onEvent = () => {},
    startCaseId = null,
  } = options;

  let progress = loadProgress();
  let caseData = caseById(startCaseId && isUnlocked(progress, startCaseId) ? startCaseId : progress.lastCase ?? 1) ?? CASES[0];
  let board = createBoard(caseData);
  let elapsed = 0;
  let paused = false;
  let running = true;
  let sealedInfo = null;

  function emit() {
    onChange(snapshot());
  }

  function snapshot() {
    const summary = boardSummary(board, caseData);
    return {
      caseId: caseData.id,
      chapter: caseData.chapter,
      caseData,
      stamps: { ...board.stamps },
      guilty: summary.guilty,
      cleared: summary.cleared,
      total: summary.total,
      weapon: board.weapon,
      clue: board.clue,
      mistakes: board.mistakes,
      sealed: board.sealed,
      ready: summary.ready,
      elapsed,
      time: formatDuration(elapsed),
      paused,
      progress,
      result: sealedInfo,
    };
  }

  function loadCase(id, { keepElapsed = false } = {}) {
    const next = caseById(id);
    if (!next) return;
    caseData = next;
    board = createBoard(caseData);
    sealedInfo = null;
    if (!keepElapsed) elapsed = 0;
    paused = false;
    running = true;
    progress = { ...progress, lastCase: caseData.id };
    emit();
  }

  function start(id) {
    if (!isUnlocked(progress, id)) return false;
    loadCase(id);
    return true;
  }

  function restart() {
    loadCase(caseData.id);
  }

  function next() {
    const target = nextCaseId(caseData.id);
    if (target === caseData.id) return false;
    return start(target);
  }

  /** 同一种印章再点一次 = 撤回，避免玩家被困在同一种标记里。 */
  function stamp(who, stampKind) {
    if (board.sealed) return;
    if (!caseData.suspects.includes(who)) return;
    const current = board.stamps[who] ?? STAMP.UNSET;
    board = setStamp(board, caseData, who, current === stampKind ? STAMP.UNSET : stampKind);
    emit();
  }

  function cycle(who) {
    if (board.sealed) return;
    board = cycleStamp(board, caseData, who);
    emit();
  }

  function setWeapon(id) {
    board = setIndictment(board, caseData, { weapon: board.weapon === id ? null : id });
    emit();
  }

  function setClue(id) {
    board = setIndictment(board, caseData, { clue: board.clue === id ? null : id });
    emit();
  }

  function seal() {
    if (board.sealed) return { ok: false, changed: false };
    if (!canSeal(board, caseData)) return { ok: false, changed: false, blocked: true };
    const outcome = applySeal(board, caseData);
    board = outcome.board;
    if (!outcome.verdict) return { ok: false, changed: false };
    if (!outcome.verdict.ok) {
      const payload = {
        ok: false,
        flaws: outcome.verdict.flaws,
        mistakes: board.mistakes,
        caseId: caseData.id,
      };
      onMistake(payload);
      emit();
      return payload;
    }
    const stars = starsFor({ suspectCount: caseData.suspects.length, timeMs: elapsed, mistakes: board.mistakes });
    const record = { timeMs: elapsed, mistakes: board.mistakes, stars };
    const before = progress.cases?.[caseData.id] ?? null;
    const best = betterRecord(before, record);
    progress = recordCase(progress, caseData.id, record);
    sealedInfo = {
      ok: true,
      caseId: caseData.id,
      timeMs: elapsed,
      time: formatDuration(elapsed),
      mistakes: board.mistakes,
      stars,
      best: best ? formatDuration(best.timeMs) : formatDuration(elapsed),
      improved: !before || best === record,
      hasNext: nextCaseId(caseData.id) !== caseData.id,
      chapter: chapterOf(caseData.id).key,
    };
    running = false;
    onWin(sealedInfo);
    onEvent({
      slug: "detective",
      outcome: "WON",
      score: Math.max(0, 30000 - elapsed / 10 - board.mistakes * 800),
      stars,
      timestamp: Date.now(),
      case: caseData.id,
    });
    emit();
    return sealedInfo;
  }

  function tick(dtMs) {
    if (!running || paused || board.sealed) return;
    const dt = Math.max(0, Math.min(MAX_FRAME_MS, Number(dtMs) || 0));
    elapsed += dt;
  }

  function pause() {
    if (paused) return;
    paused = true;
    emit();
  }

  function resume() {
    if (!paused) return;
    paused = false;
    emit();
  }

  function togglePause() {
    if (paused) resume();
    else pause();
  }

  function refreshProgress(nextProgress) {
    progress = nextProgress ?? progress;
    emit();
  }

  return {
    get caseData() {
      return caseData;
    },
    get board() {
      return board;
    },
    get snapshot() {
      return snapshot();
    },
    get paused() {
      return paused;
    },
    get progress() {
      return progress;
    },
    start,
    restart,
    next,
    stamp,
    cycle,
    setWeapon,
    setClue,
    seal,
    tick,
    pause,
    resume,
    togglePause,
    refreshProgress,
    related: (who) => relatedEvidence(caseData, who),
    clearReason: (who) => clearEvidence(caseData, who),
    solution: () => solveCase(caseData),
    canSeal: () => canSeal(board, caseData),
    snapshotFn: snapshot,
  };
}
