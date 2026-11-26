// Pure rules engine for a five-round penalty shootout with sudden death.
// DOM-free and deterministic: every random draw advances an integer seed
// carried on the state, so the same seed plus the same inputs replays exactly.

import { chooseDive as aiPolicyDive, chooseShot as aiPolicyShot } from "./ai.mjs";

export const MODES = Object.freeze(["mode_solo", "mode_duo"]);
export const DIFFICULTIES = Object.freeze(["ai_novice", "ai_skilled", "ai_master"]);
export const POWERS = Object.freeze(["tap", "drive", "blast"]);
export const SIDES = Object.freeze(["side_a", "side_b"]);

// Fixed, published odds. Two draws per shot: one for wide, one for the save.
export const SAVE_CHANCE = Object.freeze({ tap: 1, drive: 0.5, blast: 0.2 });
export const WIDE_CHANCE = Object.freeze({ tap: 0, drive: 0, blast: 0.25 });

const REGULATION_SHOTS = 10; // five per side

export function isMode(value) {
  return MODES.includes(value);
}

export function isDifficulty(value) {
  return value === null || DIFFICULTIES.includes(value);
}

export function isPower(value) {
  return POWERS.includes(value);
}

export function isZone(value) {
  return Number.isInteger(value) && value >= 0 && value <= 8;
}

export function opposite(side) {
  return side === "side_a" ? "side_b" : "side_a";
}

export function shooterOf(state) {
  const order = state.firstShooter === "side_a" ? SIDES : [SIDES[1], SIDES[0]];
  return order[state.shotIndex % 2];
}

// Returns a value in [0,1) and the next seed. Never mutates the input.
export function nextRandom(state) {
  let a = (state.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return {
    value: ((t ^ (t >>> 14)) >>> 0) / 4294967296,
    rng: a >>> 0,
  };
}

export function createMatch(options = {}) {
  const mode = isMode(options.mode) ? options.mode : "mode_solo";
  const difficulty = mode === "mode_solo"
    ? (isDifficulty(options.difficulty) && options.difficulty ? options.difficulty : "ai_novice")
    : null;
  const firstShooter = options.firstShooter === "side_b" ? "side_b" : "side_a";
  const seed = Number.isFinite(options.seed) ? (options.seed >>> 0) : 1;
  return {
    mode,
    difficulty,
    firstShooter,
    seed,
    rng: seed,
    phase: "shooter",
    shotIndex: 0,
    round: 1,
    suddenDeath: false,
    shooter: firstShooter,
    zone: null,
    power: null,
    dive: null,
    lastShot: null,
    shots: [],
    score: { side_a: 0, side_b: 0 },
    winner: null,
  };
}

function clone(state) {
  return {
    ...state,
    score: { ...state.score },
    shots: state.shots.slice(),
  };
}

function fail(state, event) {
  return { ok: false, state, event };
}

// Shooter locks zone and power. In same-screen mode a hand-off confirmation
// is required before the goalkeeper may see the choice.
export function commitShot(state, zone, power) {
  if (state.phase !== "shooter" || state.winner) return fail(state, "noop");
  if (!isZone(zone) || !isPower(power)) return fail(state, "invalid");
  const next = clone(state);
  next.zone = zone;
  next.power = power;
  next.phase = state.mode === "mode_duo" ? "handoff" : "keeper";
  return { ok: true, state: next, event: "shot_locked" };
}

export function confirmHandoff(state) {
  if (state.phase !== "handoff") return fail(state, "noop");
  const next = clone(state);
  next.phase = "keeper";
  return { ok: true, state: next, event: "handoff_done" };
}

export function undoShot(state) {
  if (state.phase !== "handoff" && state.phase !== "keeper") return fail(state, "noop");
  const next = clone(state);
  next.zone = null;
  next.power = null;
  next.dive = null;
  next.phase = "shooter";
  return { ok: true, state: next, event: "shot_unlocked" };
}

// Resolve the locked shot against a goalkeeper dive. Both random draws are
// consumed regardless of outcome so seeds advance identically on every path.
export function chooseDive(state, dive) {
  if (state.phase !== "keeper" || !isZone(dive)) return fail(state, "noop");
  const wideDraw = nextRandom(state);
  const saveDraw = nextRandom({ rng: wideDraw.rng });
  const wide = wideDraw.value < WIDE_CHANCE[state.power];
  const matched = dive === state.zone;
  const saved = !wide && matched && saveDraw.value < SAVE_CHANCE[state.power];
  const result = wide ? "wide" : saved ? "save" : "goal";
  const scoredBy = result === "goal" ? state.shooter : null;
  const shot = {
    index: state.shotIndex,
    round: state.round,
    shooter: state.shooter,
    zone: state.zone,
    power: state.power,
    dive,
    result,
    scoredBy,
    suddenDeath: state.suddenDeath,
  };
  const next = clone(state);
  next.rng = saveDraw.rng;
  next.dive = dive;
  next.lastShot = shot;
  next.shots.push(shot);
  if (scoredBy) next.score[scoredBy] += 1;
  next.phase = "reveal";
  return { ok: true, state: next, event: result };
}

// Move past the reveal animation. Ends regulation, enters or resolves sudden
// death, otherwise advances to the next shooter.
function startNextShot(state, overrides = {}) {
  const next = clone(state);
  next.shotIndex += 1;
  next.zone = null;
  next.power = null;
  next.dive = null;
  next.lastShot = null;
  next.phase = "shooter";
  next.shooter = shooterOf({ ...next, ...overrides });
  next.round = next.suddenDeath
    ? 5 + Math.floor((next.shotIndex - REGULATION_SHOTS) / 2) + 1
    : Math.floor(next.shotIndex / 2) + 1;
  return next;
}

export function advance(state) {
  if (state.phase !== "reveal") return fail(state, "noop");
  const a = state.score.side_a;
  const b = state.score.side_b;

  if (!state.suddenDeath && state.shotIndex + 1 >= REGULATION_SHOTS) {
    if (a !== b) {
      const next = clone(state);
      next.winner = a > b ? "side_a" : "side_b";
      next.phase = "over";
      return { ok: true, state: next, event: "match_over" };
    }
    const next = startNextShot(state, { suddenDeath: true });
    next.suddenDeath = true;
    return { ok: true, state: next, event: "sudden_death" };
  }

  if (state.suddenDeath && state.shooter === "side_b") {
    const pair = state.shots.slice(-2);
    const first = pair.find((shot) => shot.shooter !== "side_b");
    const second = pair.find((shot) => shot.shooter === "side_b");
    if (first && second && first.result === "goal" && second.result !== "goal") {
      const next = clone(state);
      next.winner = first.shooter;
      next.phase = "over";
      return { ok: true, state: next, event: "match_over" };
    }
    if (first && second && first.result !== "goal" && second.result === "goal") {
      const next = clone(state);
      next.winner = second.shooter;
      next.phase = "over";
      return { ok: true, state: next, event: "match_over" };
    }
  }

  return { ok: true, state: startNextShot(state), event: "next_shot" };
}

// Draws three values from the shared seed and hands them to the policy.
// The policy never calls Math.random, so AI decisions replay identically.
function policyDraws(state) {
  let rng = state.rng;
  const values = [];
  for (let i = 0; i < 3; i += 1) {
    const draw = nextRandom({ rng });
    values.push(draw.value);
    rng = draw.rng;
  }
  return { values, rng };
}

// AI keeper draws a dive and resolves the shot in one step, so callers can
// never forget to follow the decision with a separate chooseDive call.
export function aiDecideDive(state) {
  if (state.phase !== "keeper") return fail(state, "noop");
  const draw = policyDraws(state);
  const decision = aiPolicyDive(state, draw.values);
  const ready = clone(state);
  ready.rng = draw.rng;
  const result = chooseDive(ready, decision.zone);
  return { ...result, dive: decision.zone, event: result.event };
}

// AI striker draws zone and power and commits the shot in one step.
export function aiDecideShot(state) {
  if (state.phase !== "shooter" || state.shooter !== "side_b" || state.mode !== "mode_solo") return fail(state, "noop");
  const draw = policyDraws(state);
  const decision = aiPolicyShot(state, draw.values);
  const ready = clone(state);
  ready.rng = draw.rng;
  const result = commitShot(ready, decision.zone, decision.power);
  return { ...result, zone: decision.zone, power: decision.power, event: result.event };
}

export function resetMatch(state, options = {}) {
  const mode = isMode(options.mode) ? options.mode : state.mode;
  const difficulty = mode === "mode_solo"
    ? (isDifficulty(options.difficulty) && options.difficulty ? options.difficulty : state.difficulty || "ai_novice")
    : null;
  return createMatch({
    mode,
    difficulty,
    firstShooter: options.firstShooter || state.firstShooter,
    seed: options.seed === undefined ? state.seed : options.seed,
  });
}

export function matchSummary(state) {
  const counts = { side_a: 0, side_b: 0 };
  for (const shot of state.shots) counts[shot.shooter] += 1;
  return {
    mode: state.mode,
    difficulty: state.difficulty,
    score: { ...state.score },
    shots: counts,
    taken: state.shots.length,
    winner: state.winner,
    suddenDeath: state.suddenDeath,
    round: state.round,
    phase: state.phase,
    results: state.shots.map((shot) => ({ shooter: shot.shooter, result: shot.result })),
  };
}

// Invariants used by the long random-walk test.
export function checkInvariants(state) {
  if (!MODES.includes(state.mode)) return "mode";
  if (!["shooter", "handoff", "keeper", "reveal", "over"].includes(state.phase)) return "phase";
  if (state.shotIndex < 0) return "shotIndex";
  if (state.shots.length !== state.shotIndex + (state.phase === "reveal" || state.phase === "over" ? 1 : 0)) return "shotCount";
  const taken = { side_a: 0, side_b: 0 };
  for (const shot of state.shots) {
    if (!isZone(shot.zone) || !isZone(shot.dive) || !isPower(shot.power)) return "shotFields";
    if (!["goal", "save", "wide"].includes(shot.result)) return "shotResult";
    taken[shot.shooter] += 1;
  }
  for (const side of SIDES) {
    if (state.score[side] < 0 || state.score[side] > taken[side]) return "score";
  }
  if (state.phase === "over" && ! SIDES.includes(state.winner)) return "winner";
  if (state.phase !== "over" && state.winner) return "earlyWinner";
  return null;
}
