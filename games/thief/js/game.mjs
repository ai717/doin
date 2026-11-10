// game.mjs - DOM-free heist controller.
// Owns the stage lifecycle, the drag gesture bookkeeping and the retract/
// shock timers; every rule decision still lives in engine.mjs.

import {
  SHOCK_TIME,
  advanceRetract,
  createState,
  dragTo,
  pathClearance,
  tick,
  visiblePath,
} from "./engine.mjs";
import { LEVEL_COUNT, getLevel, isUnlocked, nextLevelId } from "./levels.mjs";
import { alarmFor, starsFor } from "./score.mjs";

export const PHASE = Object.freeze({
  AIM: "aim",
  RETRACT: "retract",
  WON: "won",
  SHOCK: "shock",
});

export function createGame({
  onChange = () => {},
  onWin = () => {},
  onEvent = () => {},
  loadProgress = () => ({ cleared: {}, best: {} }),
  recordLevel = () => ({ improved: false, stars: 1, best: null }),
  autoRestartMs = 1150,
} = {}) {
  let level = null;
  let engine = null;
  let progress = loadProgress();
  let paused = false;
  let drag = null;
  let shockMs = 0;
  let result = null;
  let clearance = Infinity;

  const snapshot = () => ({
    levelId: level?.id ?? 1,
    level,
    phase: engine?.status ?? PHASE.AIM,
    hand: engine?.hand ?? { x: 0, y: 0 },
    path: level ? visiblePath(level, engine) : [],
    travelled: engine?.travelled ?? 0,
    wraps: engine?.wraps?.length ?? 0,
    levers: engine?.levers ?? {},
    time: engine?.time ?? 0,
    paused,
    dragging: Boolean(drag),
    failure: engine?.failure ?? null,
    stars: level ? starsFor(level, engine?.travelled || level.par) : 3,
    best: progress.best?.[level?.id] ?? null,
    cleared: progress.cleared?.[level?.id] ?? 0,
    alarm: alarmFor(clearance, Boolean(drag) && engine?.status === PHASE.AIM),
    result,
    progress: {
      cleared: progress.cleared ?? {},
      best: progress.best ?? {},
      clearedCount: progress.clearedCount ?? 0,
      totalStars: progress.totalStars ?? 0,
      maxStars: progress.maxStars ?? LEVEL_COUNT * 3,
    },
    totalStars: progress.totalStars ?? 0,
    maxStars: progress.maxStars ?? 60,
    clearedCount: progress.clearedCount ?? 0,
  });

  function emit() {
    onChange(snapshot());
  }

  function start(levelId) {
    level = getLevel(levelId) ?? getLevel(1);
    engine = createState(level);
    paused = false;
    drag = null;
    shockMs = 0;
    result = null;
    clearance = Infinity;
    emit();
  }

  function restart() {
    if (!level) {
      start(1);
      return;
    }
    engine = createState(level);
    paused = false;
    drag = null;
    shockMs = 0;
    result = null;
    clearance = Infinity;
    emit();
  }

  function nextLevel() {
    if (!level) {
      start(1);
      return;
    }
    const id = nextLevelId(level.id);
    const unlocked = progress.cleared?.[id - 1] || id === level.id;
    start(unlocked ? id : level.id);
  }

  function pointerDown(point) {
    if (!engine || engine.status !== PHASE.AIM || paused) return false;
    drag = { origin: { x: point.x, y: point.y }, hand: { x: engine.hand.x, y: engine.hand.y } };
    emit();
    return true;
  }

  function announceShock() {
    if (engine.status !== PHASE.SHOCK) return false;
    shockMs = 0;
    drag = null;
    onEvent({ slug: "thief", outcome: "LOST", score: 0, stars: 0, timestamp: Date.now(), level: level.id });
    return true;
  }

  function pointerMove(point) {
    if (!drag || !engine || engine.status !== PHASE.AIM || paused) return;
    const target = {
      x: drag.hand.x + (point.x - drag.origin.x),
      y: drag.hand.y + (point.y - drag.origin.y),
    };
    engine = dragTo(level, engine, target);
    if (engine.status === PHASE.SHOCK) announceShock();
    if (engine.status === PHASE.RETRACT) drag = null;
    clearance = engine.status === PHASE.AIM ? pathClearance(level, engine) : Infinity;
    emit();
  }

  function pointerUp() {
    if (!drag) return;
    drag = null;
    emit();
  }

  function finalize() {
    const stars = starsFor(level, engine.travelled);
    const record = recordLevel(level.id, engine.travelled);
    progress = loadProgress();
    result = {
      won: true,
      levelId: level.id,
      stars,
      travel: Math.round(engine.travelled),
      best: record.best ?? Math.round(engine.travelled),
      improved: Boolean(record.improved),
      hasNext: nextLevelId(level.id) !== level.id,
    };
    onWin(result);
    onEvent({
      slug: "thief",
      outcome: "WON",
      score: Math.round(engine.travelled),
      stars,
      timestamp: Date.now(),
      level: level.id,
    });
    emit();
  }

  function tickFrame(dt) {
    if (!engine || paused) return;
    if (engine.status === PHASE.AIM) {
      engine = tick(level, engine, dt);
      clearance = pathClearance(level, engine);
      announceShock();
      emit();
      return;
    }
    if (engine.status === PHASE.RETRACT) {
      engine = advanceRetract(level, engine, dt);
      if (engine.status === PHASE.WON && !result) finalize();
      emit();
      return;
    }
    if (engine.status === PHASE.SHOCK && (shockMs += dt * 1000) >= autoRestartMs) {
      restart();
    }
  }

  function pause() {
    if (paused) return;
    paused = true;
    drag = null;
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

  function refreshProgress() {
    progress = loadProgress();
    emit();
  }

  return {
    start,
    restart,
    nextLevel,
    pointerDown,
    pointerMove,
    pointerUp,
    tick: tickFrame,
    pause,
    resume,
    togglePause,
    refreshProgress,
    snapshot,
    get level() {
      return level;
    },
    get engine() {
      return engine;
    },
    get paused() {
      return paused;
    },
    get shockTime() {
      return SHOCK_TIME;
    },
  };
}
