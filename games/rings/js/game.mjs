// DOM-free controller. Owns the current level state and timer;
// translates UI intents into engine calls and returns events for ui/audio.

import { applyMove, isSolved, movableRings, solve } from "./engine.mjs";
import { LEVEL_IDS, levelById, nextLevelId } from "./levels.mjs";
import { rate } from "./score.mjs";

export function createController(options = {}) {
  let levelId = LEVEL_IDS.includes(options.levelId) ? options.levelId : LEVEL_IDS[0];
  let level = levelById(levelId);
  let rings = level.start.slice();
  let hint = options.hint === undefined ? true : Boolean(options.hint);
  let paused = false;
  let moves = 0;
  let undos = 0;
  let elapsedMs = 0;
  let history = [];
  let finished = false;

  function moveRing(index) {
    if (paused || finished) return { changed: false, event: "noop" };
    const result = applyMove(rings, index);
    if (!result.ok) return { changed: false, event: "illegal", ring: index };
    history.push(rings.slice());
    rings = result.state;
    moves += 1;
    if (isSolved(rings, level.mode)) {
      finished = true;
      return { changed: true, event: "win", ring: index };
    }
    return { changed: true, event: "move", ring: index };
  }

  function undo() {
    if (paused || finished || !history.length) return { changed: false, event: "noop" };
    rings = history.pop();
    moves += 1; // undo costs one move, like a real pick-up and put-back
    undos += 1;
    return { changed: true, event: "undo" };
  }

  function reset(force = false) {
    if (paused && !force) return { changed: false, event: "noop" };
    rings = level.start.slice();
    moves = 0;
    undos = 0;
    elapsedMs = 0;
    history = [];
    finished = false;
    return { changed: true, event: "reset" };
  }

  function loadLevel(id) {
    if (!LEVEL_IDS.includes(id)) return false;
    levelId = id;
    level = levelById(id);
    // Loading a level from the paused level drawer must still rebuild the board.
    return reset(true).changed;
  }

  function loadNext() {
    const next = nextLevelId(levelId);
    return next ? loadLevel(next) : false;
  }

  function setHint(value) {
    hint = Boolean(value);
    return hint;
  }

  function togglePause() {
    paused = !paused;
    return paused;
  }

  function setPaused(value) {
    paused = Boolean(value);
    return paused;
  }

  // Only called while running and not paused; keeps timer off menus / background.
  function tick(dtMs) {
    if (paused || finished || !Number.isFinite(dtMs) || dtMs <= 0) return;
    elapsedMs += Math.min(dtMs, 1000);
  }

  function snapshot() {
    const stars = finished ? rate(level, moves) : 0;
    return {
      rings: rings.slice(),
      ringCount: rings.length,
      levelId,
      level,
      mode: level.mode,
      moves,
      undos,
      elapsedMs,
      hint,
      paused,
      finished,
      legal: frozenLegal(),
      hintPath: hint && !finished ? solve(rings, level.mode).moves : [],
      stars,
      optimal: level.optimal,
    };
  }

  function frozenLegal() {
    return movableRings(rings).slice();
  }

  return {
    moveRing,
    undo,
    reset,
    loadLevel,
    loadNext,
    setHint,
    togglePause,
    setPaused,
    tick,
    snapshot,
    get levelId() { return levelId; },
    get moves() { return moves; },
    get paused() { return paused; },
    get finished() { return finished; },
  };
}
