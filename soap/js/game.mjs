// DOM-free controller. Owns the engine state, tool choice and pause flag;
// translates UI intents into engine calls and returns events for ui/audio to consume.

import { applyStroke, createGame, finishCleanup as engineCleanup, isComplete, shapeRatio, remainingRatio, hasCore } from "./engine.mjs";
import { getSoap, TOOLS, SOAP_IDS } from "./soaps.mjs";
import { evennessOf, grade } from "./score.mjs";

export function createController(options = {}) {
  let soapId = SOAP_IDS.includes(options.soapId) ? options.soapId : SOAP_IDS[0];
  let tool = TOOLS[options.tool] ? options.tool : "tool_knife";
  let seed = Number.isFinite(options.seed) ? options.seed >>> 0 : undefined;
  let state = createGame(soapId, seed);
  let paused = false;
  let chipDepths = [];
  let lastResult = null;

  function trimChips() {
    if (chipDepths.length > 900) chipDepths = chipDepths.slice(-600);
  }

  function cut(from, to, speed = 300) {
    if (paused || state.complete) return { state, events: [], changed: false };
    const before = state.removedDepth;
    const result = applyStroke(state, { from, to, speed, tool });
    state = result.state;
    const changed = state.removedDepth > before;
    if (changed) {
      for (const event of result.events) {
        if (event.type === "cut") {
          for (const chip of event.chips) chipDepths.push(chip.depth);
        }
      }
      trimChips();
    }
    return { state, events: result.events, changed };
  }

  function setTool(id) {
    if (!TOOLS[id] || tool === id) return false;
    tool = id;
    return true;
  }

  function loadSoap(id, nextSeed) {
    if (!SOAP_IDS.includes(id)) return false;
    soapId = id;
    seed = Number.isFinite(nextSeed) ? nextSeed >>> 0 : undefined;
    state = createGame(soapId, seed);
    chipDepths = [];
    paused = false;
    lastResult = null;
    return true;
  }

  function nextSoap() {
    const index = SOAP_IDS.indexOf(soapId);
    return loadSoap(SOAP_IDS[(index + 1) % SOAP_IDS.length]);
  }

  function togglePause() {
    paused = !paused;
    return paused;
  }

  function setPaused(value) {
    paused = Boolean(value);
    return paused;
  }

  function finish() {
    if (paused || state.complete) return { state, events: [], changed: false };
    const result = engineCleanup(state);
    state = result.state;
    return { state, events: result.events, changed: result.events.length > 0 };
  }

  function snapshot() {
    if (state.complete && !lastResult) {
      lastResult = grade(state, evennessOf(chipDepths));
    }
    const def = getSoap(soapId);
    return {
      state,
      soapId,
      soap: def,
      tool,
      paused,
      material: def.material,
      hasCore: hasCore(state),
      progress: 1 - remainingRatio(state),
      shape: shapeRatio(state),
      finesse: evennessOf(chipDepths),
      complete: state.complete,
      won: state.won,
      isComplete: isComplete(state),
      result: lastResult,
    };
  }

  return {
    cut,
    setTool,
    loadSoap,
    nextSoap,
    togglePause,
    setPaused,
    finish,
    snapshot,
    get toolId() { return tool; },
    get soapId() { return soapId; },
    get paused() { return paused; },
  };
}
