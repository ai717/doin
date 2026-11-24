// DOM-free controller. Owns engine state, tool/nozzle choices and pause flag.
// Translates pointer frames into dwell-time engine calls and returns events for
// ui/audio. Pause freezes the clock and forbids all washing.

import { applyWash, cleanliness, createGame, resetGame, setNozzle, setTool, toggleNozzle } from "./engine.mjs";
import { LEVEL_IDS, levelById, TOOLS } from "./levels.mjs";
import { rate } from "./score.mjs";

export function createController(options = {}) {
  let levelId = LEVEL_IDS.includes(options.levelId) ? options.levelId : LEVEL_IDS[0];
  let state = createGame(levelId, Number.isFinite(options.seed) ? options.seed >>> 0 : undefined);
  let paused = false;
  let pointerDown = false;
  let lastPointer = null;
  let sprayActive = false;
  let lastResult = null;
  let pointerSpeed = 0;

  function loadLevel(id, seed) {
    if (!LEVEL_IDS.includes(id)) return false;
    levelId = id;
    state = createGame(id, Number.isFinite(seed) ? seed >>> 0 : undefined);
    paused = false;
    pointerDown = false;
    lastPointer = null;
    sprayActive = false;
    lastResult = null;
    pointerSpeed = 0;
    return true;
  }

  function nextLevel() {
    const idx = LEVEL_IDS.indexOf(levelId);
    if (idx < 0 || idx + 1 >= LEVEL_IDS.length) return null;
    const next = LEVEL_IDS[idx + 1];
    return loadLevel(next) ? next : null;
  }

  function chooseTool(id) {
    if (paused || !TOOLS.includes(id)) return false;
    const result = setTool(state, id);
    if (!result.ok) return false;
    state = result.state;
    return true;
  }

  function chooseNozzle(nozzle) {
    if (paused) return false;
    const result = setNozzle(state, nozzle);
    if (!result.ok) return false;
    state = result.state;
    return true;
  }

  function switchNozzle() {
    if (paused) return false;
    const result = toggleNozzle(state);
    if (!result.ok) return false;
    state = result.state;
    return true;
  }

  function beginPointer(pointer) {
    if (paused || state.complete || !pointer) return false;
    pointerDown = true;
    lastPointer = { x: pointer.x, y: pointer.y };
    pointerSpeed = 0;
    return true;
  }

  function endPointer() {
    pointerDown = false;
    lastPointer = null;
    pointerSpeed = 0;
    const wasActive = sprayActive;
    sprayActive = false;
    return wasActive;
  }

  // dt in seconds from the render loop. Washing accrues by dwell time: the
  // pointer position for this frame is stamped for `dt` regardless of travel.
  function tick(dt, pointer) {
    if (paused || state.complete) return { events: [], changed: false, tool: state.tool };
    const step = Math.min(0.05, Math.max(0, Number.isFinite(dt) ? dt : 0));
    const target = pointer ?? lastPointer;
    if (!pointerDown || !target) return { events: [], changed: false, tool: state.tool, spray: false };

    const dx = lastPointer ? target.x - lastPointer.x : 0;
    const dy = lastPointer ? target.y - lastPointer.y : 0;
    pointerSpeed = step > 0 ? Math.min(1, Math.hypot(dx, dy) / step / 1.2) : 0;
    lastPointer = { x: target.x, y: target.y };

    const before = state.totalRemaining;
    const result = applyWash(state, target, step);
    state = result.state;
    const changed = state.totalRemaining < before - 1e-9;
    const events = [];
    if (result.cells.length) events.push({ type: "sparkle", cells: result.cells });
    if (result.event === "complete" && !lastResult) {
      lastResult = { stars: rate(state.elapsed), time: state.elapsed, levelId };
      events.push({ type: "complete", result: lastResult });
    }
    sprayActive = true;
    return { events, changed, tool: state.tool, spray: true, speed: pointerSpeed };
  }

  function setPaused(value) {
    const next = Boolean(value);
    if (next === paused) return paused;
    paused = next;
    if (paused) {
      pointerDown = false;
      sprayActive = false;
      lastPointer = null;
    }
    return paused;
  }

  function togglePause() {
    return setPaused(!paused);
  }

  function rewash() {
    state = resetGame(state);
    paused = false;
    pointerDown = false;
    lastPointer = null;
    sprayActive = false;
    lastResult = null;
    pointerSpeed = 0;
    return true;
  }

  function snapshot() {
    return {
      state,
      levelId,
      level: levelById(levelId),
      tool: state.tool,
      nozzle: state.nozzle,
      paused,
      pointerDown,
      sprayActive,
      progress: cleanliness(state),
      complete: state.complete,
      result: lastResult,
      pointerSpeed,
    };
  }

  return {
    loadLevel, nextLevel, chooseTool, chooseNozzle, switchNozzle,
    beginPointer, endPointer, tick, setPaused, togglePause, rewash, snapshot,
    get paused() { return paused; },
    get levelId() { return levelId; },
    get complete() { return state.complete; },
  };
}
