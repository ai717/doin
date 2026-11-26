// Controller for the table: owns world + rules, accepts UI intents.
// DOM-free on purpose so the whole rule + physics chain runs headless in tests.

import {
  createWorld, settle, isMoving, stepWorld, strike, placeBall,
  MIN_X, MAX_X, MIN_Y, MAX_Y, FOOT_SPOT_X, CENTER_Y, HEAD_STRING_X,
  overlapsAny, insidePocketMouth, PHYS, SPINS, TABLE_W,
} from "./engine.mjs";
import {
  buildLayout, getTable, TABLES, nextTableId, versusLayout,
} from "./tables.mjs";
import {
  createRules, resolveShot, analyseShot, legalTargets, liveObjectBalls,
  eightLive, respotEight, groupRemaining,
} from "./rules.mjs";

export const MAX_RUN_FRAMES = 4000;

function freeSpotForEight(balls) {
  const candidates = [
    { x: FOOT_SPOT_X, y: CENTER_Y },
    { x: FOOT_SPOT_X, y: MIN_Y + 2 },
    { x: FOOT_SPOT_X, y: MAX_Y - 2 },
    { x: HEAD_STRING_X, y: CENTER_Y },
  ];
  for (const c of candidates) {
    if (!overlapsAny(balls, c.x, c.y, null, 0.3) && !insidePocketMouth(c.x, c.y, 0.6)) return c;
  }
  for (let ring = 0; ring < 80; ring += 1) {
    const x = MIN_X + 2 + ((ring * 3.7) % (MAX_X - MIN_X - 4));
    const y = MIN_Y + 2 + ((ring * 5.3) % (MAX_Y - MIN_Y - 4));
    if (!overlapsAny(balls, x, y, null, 0.3) && !insidePocketMouth(x, y, 0.6)) return { x, y };
  }
  return { x: FOOT_SPOT_X, y: CENTER_Y };
}

function autoCueSpot(balls) {
  const candidates = [
    { x: HEAD_STRING_X, y: CENTER_Y },
    { x: HEAD_STRING_X, y: MIN_Y + 4 },
    { x: HEAD_STRING_X, y: MAX_Y - 4 },
    { x: HEAD_STRING_X * 0.6, y: CENTER_Y },
  ];
  for (const c of candidates) {
    if (!overlapsAny(balls, c.x, c.y, null, 0.3) && !insidePocketMouth(c.x, c.y, 0.6)) return c;
  }
  return { x: HEAD_STRING_X, y: CENTER_Y };
}

function cueHomeCandidate(balls, prefer) {
  const list = [
    prefer,
    { x: HEAD_STRING_X, y: CENTER_Y },
    { x: HEAD_STRING_X, y: MIN_Y + 4 },
    { x: HEAD_STRING_X, y: MAX_Y - 4 },
    { x: HEAD_STRING_X, y: CENTER_Y - 6 },
    { x: HEAD_STRING_X, y: CENTER_Y + 6 },
    { x: TABLE_W * 0.35, y: CENTER_Y },
    { x: MIN_X + 3, y: CENTER_Y },
  ];
  for (const c of list) {
    if (!c) continue;
    if (!insidePocketMouth(c.x, c.y, 0.6) && !overlapsAny(balls, c.x, c.y, null, 0.25)) return c;
  }
  // Dense table fallback: coarse grid scan, head side first, then anywhere.
  const grid = [];
  for (let x = MIN_X + 1; x <= MAX_X - 1; x += 1) {
    for (let y = MIN_Y + 1; y <= MAX_Y - 1; y += 0.75) {
      grid.push({ x, y });
    }
  }
  grid.sort((a, b) => Math.abs(a.x - HEAD_STRING_X) - Math.abs(b.x - HEAD_STRING_X));
  for (const c of grid) {
    if (!insidePocketMouth(c.x, c.y, 0.6) && !overlapsAny(balls, c.x, c.y, null, 0.25)) return c;
  }
  return { x: HEAD_STRING_X, y: CENTER_Y };
}

export function createGame(options = {}) {
  const mode = options.mode === "duel" ? "duel" : "clear";
  const tableId = mode === "clear" ? (options.tableId ?? TABLES[0].id) : null;
  const seed = options.seed ?? 70001;
  const built = mode === "clear" ? buildLayout(tableId) : null;
  const balls = mode === "clear" ? built.layout.balls : versusLayout(seed);
  const game = {
    mode,
    tableId,
    seed,
    table: mode === "clear" ? built.table : null,
    rules: createRules(mode, { breakPending: true }),
    world: createWorld(balls, { seed }),
    aim: { angle: 0, power: 0.55, spin: "center" },
    phase: "aim",
    pulling: false,
    shotEvents: [],
    pending: [],
    report: null,
    elapse: 0,
    frames: 0,
    history: [],
  };
  return game;
}

export function restart(game) {
  const mode = game.mode;
  if (mode === "clear") {
    const built = buildLayout(game.tableId);
    game.world = createWorld(built.layout.balls, { seed: game.seed });
  } else {
    game.world = createWorld(versusLayout(game.seed), { seed: game.seed });
  }
  game.rules = createRules(mode, { breakPending: true });
  game.phase = "aim";
  game.report = null;
  game.shotEvents = [];
  game.pending = [];
  game.elapse = 0;
  game.frames = 0;
  game.history = [];
  game.aim.power = 0.55;
  game.aim.spin = "center";
  return game;
}

export function loadTable(game, tableId) {
  game.tableId = tableId;
  game.table = getTable(tableId);
  return restart(game);
}

export function advanceTable(game) {
  const next = nextTableId(game.tableId);
  if (!next) return false;
  loadTable(game, next);
  return true;
}

export function setAim(game, angle) {
  if (game.phase !== "aim" && game.phase !== "placing") return false;
  const tau = Math.PI * 2;
  game.aim.angle = ((angle % tau) + tau) % tau;
  return true;
}

export function nudgeAim(game, delta) {
  return setAim(game, game.aim.angle + delta);
}

export function setPower(game, power) {
  game.aim.power = Math.min(1, Math.max(0, power));
  return true;
}

export function nudgePower(game, delta) {
  return setPower(game, game.aim.power + delta);
}

export function cycleSpin(game, step = 1) {
  const i = SPINS.indexOf(game.aim.spin);
  const next = (((i + step) % SPINS.length) + SPINS.length) % SPINS.length;
  game.aim.spin = SPINS[next];
  return game.aim.spin;
}

export function legalTargetsOf(game) {
  return legalTargets(game.rules, game.world.balls);
}

/** Whether a ball-in-hand placement is legal right now. */
export function canPlaceCue(game) {
  return game.rules.ballInHand && (game.phase === "aim" || game.phase === "placing");
}

export function placeCueBall(game, x, y) {
  if (!canPlaceCue(game)) return false;
  const ok = placeBall(game.world, 0, x, y);
  if (ok) {
    game.rules.ballInHand = false;
    game.phase = "aim";
    pushNote(game, { type: "placed" });
  }
  return ok;
}

/** Drag phase of ball-in-hand: keep hold until the player commits. */
export function moveCueBall(game, x, y) {
  if (!game.rules.ballInHand) return false;
  if (game.phase !== "aim" && game.phase !== "placing") return false;
  game.phase = "placing";
  return placeBall(game.world, 0, x, y);
}

export function commitCueBall(game) {
  if (!game.rules.ballInHand) return false;
  const cue = game.world.balls.find((b) => b.id === 0);
  if (!cue || cue.potted) {
    const spot = cueHomeCandidate(game.world.balls, null);
    placeBall(game.world, 0, spot.x, spot.y);
  }
  game.rules.ballInHand = false;
  game.phase = "aim";
  pushNote(game, { type: "placed" });
  return true;
}

export function autoPlaceCue(game) {
  const spot = cueHomeCandidate(game.world.balls, null);
  return placeCueBall(game, spot.x, spot.y);
}

function pushNote(game, note) {
  game.pending.push(note);
}

function collectEvents(game) {
  const fresh = game.world.events.splice(0, game.world.events.length);
  for (const ev of fresh) {
    game.shotEvents.push(ev);
    if (ev.type !== "strike") game.pending.push(ev);
  }
  return fresh;
}

export function canShoot(game) {
  return game.phase === "aim" && game.rules.phase !== "over" && !game.rules.ballInHand;
}

export function shoot(game, options = {}) {
  if (game.phase !== "aim") return false;
  if (game.rules.phase === "over") return false;
  if (game.rules.ballInHand) return false;
  const angle = options.angle ?? game.aim.angle;
  const power = options.power ?? game.aim.power;
  const spin = options.spin ?? game.aim.spin;
  game.aim.angle = angle;
  game.aim.power = power;
  game.aim.spin = spin;
  const ok = strike(game.world, angle, power, spin);
  if (!ok) return false;
  game.shotEvents = [];
  game.phase = "resolving";
  game.report = null;
  return true;
}

function finishShot(game) {
  const facts = analyseShot(game.shotEvents);
  const report = resolveShot(game.rules, facts, game.world.balls);
  game.report = report;
  game.history.push({ ...facts, turn: game.rules.turn });

  if (facts.cuePotted) {
    const spot = autoCueSpot(game.world.balls);
    const cue = game.world.balls.find((b) => b.id === 0);
    if (cue) {
      cue.potted = false;
      cue.x = spot.x;
      cue.y = spot.y;
      cue.vx = 0;
      cue.vy = 0;
      cue.rvx = 0;
      cue.rvy = 0;
    }
  }
  if (report.loseEight && game.mode === "clear") {
    const spot = freeSpotForEight(game.world.balls);
    respotEight(game.world.balls, spot.x, spot.y);
  }
  if (game.rules.phase === "over") {
    // A finished frame never owes a ball-in-hand: stale flags would wedge
    // restart / auto-place flows on the next session.
    game.rules.ballInHand = false;
    game.phase = "over";
  } else if (game.rules.ballInHand) {
    const cue = game.world.balls.find((b) => b.id === 0);
    const spot = cueHomeCandidate(game.world.balls, cue && !cue.potted ? { x: cue.x, y: cue.y } : null);
    if (cue && !cue.potted) {
      cue.x = spot.x;
      cue.y = spot.y;
    }
    game.phase = "placing";
  } else {
    game.phase = "aim";
  }
  pushNote(game, { type: "shot-end", report });
  return report;
}

/** Advance the controller. `dt` is wall-clock seconds since the last frame. */
export function update(game, dt) {
  if (game.phase !== "resolving") {
    // Keep the accumulator drained while aiming so a stale frame never fires.
    stepWorld(game.world, 0);
    return { steps: 0, settled: false };
  }
  const before = game.world.steps;
  const steps = stepWorld(game.world, dt);
  collectEvents(game);
  if (!isMoving(game.world) || game.world.steps - before > PHYS.maxStepsPerFrame) {
    if (!isMoving(game.world)) {
      const r = settle(game.world, 8);
      collectEvents(game);
      void r;
    }
    finishShot(game);
    return { steps, settled: true };
  }
  return { steps, settled: false };
}

export function drainEvents(game) {
  const out = game.pending.slice();
  game.pending.length = 0;
  return out;
}

export function snapshot(game) {
  return {
    mode: game.mode,
    tableId: game.tableId,
    par: game.table?.par ?? null,
    playerTurn: game.rules.turn,
    open: game.rules.open,
    groups: game.rules.groups.slice(),
    phase: game.phase,
    groupRemain: {
      solid: groupRemaining(game.world.balls, "solid"),
      stripe: groupRemaining(game.world.balls, "stripe"),
      eight: eightLive(game.world.balls) ? 1 : 0,
    },
    objectLeft: liveObjectBalls(game.world.balls).length,
    eightLeft: eightLive(game.world.balls),
    run: game.rules.run,
    bestRun: game.rules.bestRun,
    shots: game.rules.shots.slice(),
    fouls: game.rules.fouls.slice(),
    ballInHand: game.rules.ballInHand,
    winner: game.rules.winner,
    lastEvent: game.rules.lastEvent,
    report: game.report,
    elapse: game.elapse,
    aim: { ...game.aim },
  };
}

/** Deterministic helper used by property tests and the practice hint. */
export function randomViableShot(rng, game) {
  const targets = legalTargetsOf(game);
  const cue = game.world.balls.find((b) => b.id === 0 && !b.potted);
  if (!cue || !targets.length) return null;
  const target = targets[Math.floor(rng() * targets.length)];
  const jitter = (rng() - 0.5) * 0.5;
  const angle = Math.atan2(target.y - cue.y, target.x - cue.x) + jitter;
  const power = 0.35 + rng() * 0.65;
  const spin = SPINS[Math.floor(rng() * SPINS.length)];
  return { angle, power, spin, targetId: target.id };
}

/** Run the table to rest headlessly; used by tests and solvability checks. */
export function runUntilRest(game, maxFrames = MAX_RUN_FRAMES) {
  let frames = 0;
  while (game.phase === "resolving" && frames < maxFrames) {
    update(game, PHYS.dt);
    frames += 1;
  }
  return frames;
}
