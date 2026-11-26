// DOM-free state controller for a single oracle tracing run.

import {
  createSession,
  debugSolveAll,
  debugSolvePair,
  drainEvents,
  select,
  setPaused,
  snapshot,
  step,
} from "./engine.mjs";
import { LEVELS } from "./levels.mjs";

export function createGame(options = {}) {
  let session = createSession({
    levelIndex: options.levelIndex,
    seed: options.seed,
  });

  function load(index) {
    session = createSession({
      levelIndex: index,
      seed: 9100 + Math.max(0, Math.floor(Number(index) || 0)) * 137,
    });
    return session;
  }

  return {
    select(side, index) {
      return select(session, side, index);
    },
    cancel() {
      session.selected = null;
    },
    tick(dt) {
      step(session, dt);
    },
    pause() {
      setPaused(session, true);
    },
    resume() {
      setPaused(session, false);
    },
    restart() {
      const current = session.levelIndex;
      session = createSession({ levelIndex: current, seed: session.seed + 1 });
      return session;
    },
    loadLevel(index) {
      return load(index);
    },
    nextLevel() {
      if (session.levelIndex >= LEVELS.length - 1) return false;
      load(session.levelIndex + 1);
      return true;
    },
    hasNext() {
      return session.levelIndex < LEVELS.length - 1;
    },
    drainEvents() {
      return drainEvents(session);
    },
    snapshot() {
      return snapshot(session);
    },
    debugSolveAll() {
      return debugSolveAll(session);
    },
    debugSolvePair(pairIndex) {
      return debugSolvePair(session, pairIndex);
    },
    get session() {
      return session;
    },
    get levelIndex() {
      return session.levelIndex;
    },
  };
}
