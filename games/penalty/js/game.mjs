// DOM-free match controller. Translates UI intents into engine transitions,
// owns the reveal clock and the AI thinking delay, and never touches the DOM.

import {
  advance, aiDecideDive, aiDecideShot, chooseDive, commitShot, confirmHandoff,
  createMatch, matchSummary, isMode, isDifficulty, isPower, isZone,
  resetMatch, undoShot, SAVE_CHANCE, WIDE_CHANCE,
} from "./engine.mjs";

const REVEAL_MS = 1500;
const AI_DELAY_MS = 520;

export function createController(options = {}) {
  let match = createMatch(options);
  let paused = false;
  let target = null;
  let power = null;
  let revealT = 0;
  let aiTimer = 0;
  let aiPending = null;

  function armAi() {
    if (match.mode !== "mode_solo" || match.phase === "over") {
      aiPending = null;
      return;
    }
    if (match.phase === "keeper" && match.shooter === "side_a") aiPending = "dive";
    else if (match.phase === "shooter" && match.shooter === "side_b") aiPending = "shot";
    else aiPending = null;
    aiTimer = 0;
  }

  armAi();

  function chooseTarget(zone) {
    if (paused || match.phase !== "shooter" || !isZone(zone)) return false;
    if (match.mode === "mode_solo" && match.shooter === "side_b") return false;
    target = zone;
    return true;
  }

  function choosePower(value) {
    if (paused || match.phase !== "shooter" || !isPower(value)) return false;
    if (match.mode === "mode_solo" && match.shooter === "side_b") return false;
    power = value;
    return true;
  }

  function shoot() {
    if (paused || match.phase !== "shooter" || target === null || !power) return false;
    const result = commitShot(match, target, power);
    if (!result.ok) return false;
    match = result.state;
    revealT = 0;
    armAi();
    return true;
  }

  function confirmKeeper() {
    if (paused || match.phase !== "handoff") return false;
    const result = confirmHandoff(match);
    if (!result.ok) return false;
    match = result.state;
    armAi();
    return true;
  }

  function keeperDive(zone) {
    if (paused || match.phase !== "keeper" || !isZone(zone)) return false;
    if (match.mode === "mode_solo" && match.shooter === "side_a") return false;
    const result = chooseDive(match, zone);
    if (!result.ok) return false;
    match = result.state;
    revealT = 0;
    aiPending = null;
    return true;
  }

  function undoSelection() {
    if (paused) return false;
    const result = undoShot(match);
    if (!result.ok) return false;
    match = result.state;
    target = null;
    power = null;
    revealT = 0;
    aiPending = null;
    return true;
  }

  // Fixed-step clock: paused freezes both the AI delay and the reveal frame.
  function tick(dtMs) {
    if (paused || !Number.isFinite(dtMs) || dtMs <= 0) return;
    const dt = Math.min(dtMs, 100);
    if (aiPending) {
      aiTimer += dt;
      if (aiTimer >= AI_DELAY_MS) {
        aiTimer = 0;
        if (aiPending === "dive") {
          const result = aiDecideDive(match);
          if (result.ok) {
            match = result.state;
            revealT = 0;
          }
        } else if (aiPending === "shot") {
          const result = aiDecideShot(match);
          if (result.ok) {
            match = result.state;
            target = result.zone;
            power = result.power;
          }
        }
        aiPending = null;
      }
      return;
    }
    if (match.phase === "reveal" && revealT < 1) {
      revealT = Math.min(1, revealT + dt / REVEAL_MS);
    }
  }

  function revealDone() {
    return match.phase === "reveal" && revealT >= 1;
  }

  function continueMatch() {
    if (paused || !revealDone()) return false;
    const result = advance(match);
    if (!result.ok) return false;
    match = result.state;
    revealT = 0;
    target = null;
    power = null;
    aiPending = null;
    armAi();
    return true;
  }

  function setPaused(value) {
    paused = Boolean(value);
    return paused;
  }

  function reset(options = {}) {
    const mode = isMode(options.mode) ? options.mode : match.mode;
    const difficulty = isDifficulty(options.difficulty) ? options.difficulty : match.difficulty;
    match = resetMatch(match, {
      mode,
      difficulty: difficulty || "ai_novice",
      firstShooter: options.firstShooter || match.firstShooter,
      seed: options.seed,
    });
    target = null;
    power = null;
    revealT = 0;
    aiTimer = 0;
    aiPending = null;
    armAi();
    return true;
  }

  function snapshot() {
    const summary = matchSummary(match);
    return {
      mode: match.mode,
      difficulty: match.difficulty,
      firstShooter: match.firstShooter,
      phase: match.phase,
      round: match.round,
      suddenDeath: match.suddenDeath,
      shooter: match.shooter,
      score: { ...match.score },
      results: summary.results,
      taken: summary.taken,
      winner: match.winner,
      finished: match.phase === "over",
      target,
      power,
      lockedZone: match.zone,
      lockedPower: match.power,
      dive: match.dive,
      lastShot: match.lastShot,
      revealT,
      revealDone: revealDone(),
      aiPending,
      paused,
      summary,
      odds: { save: { ...SAVE_CHANCE }, wide: { ...WIDE_CHANCE } },
    };
  }

  return {
    chooseTarget,
    choosePower,
    shoot,
    confirmKeeper,
    keeperDive,
    undoSelection,
    tick,
    continueMatch,
    setPaused,
    reset,
    snapshot,
    get paused() { return paused; },
    get phase() { return match.phase; },
    get finished() { return match.phase === "over"; },
  };
}
