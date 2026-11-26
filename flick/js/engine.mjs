// Deterministic top-down flick physics and match rules for Flick Duel.
// Strictly DOM-free: no browser globals or storage access is allowed here.
// World units are logical table pixels: 960 x 620 with the seam on y = 310.

import {
  MAX_ROUNDS,
  PUCKS_PER_SIDE,
  START,
  getBoard,
  getDifficulty,
  normalizeSettings,
  otherSide,
} from "./levels.mjs";

export const WORLD = Object.freeze({
  width: 960,
  height: 620,
  margin: 34,
  puckRadius: 18,
  dividerHalf: 7,
  gateRadius: 28,
  gatePass: 19,
  wallRestitution: 0.8,
  dividerRestitution: 0.58,
  puckRestitution: 0.94,
  damping: 1.35,
  stopSpeed: 14,
  minFlickSpeed: 250,
  maxFlickSpeed: 1320,
  maxPull: 150,
});

export const CENTER_Y = WORLD.height / 2;
export const DIVIDER_BAND = WORLD.dividerHalf + WORLD.puckRadius;
export const PLAY_MIN_X = WORLD.margin + WORLD.puckRadius;
export const PLAY_MAX_X = WORLD.width - WORLD.margin - WORLD.puckRadius;
export const PLAY_MIN_Y = WORLD.margin + WORLD.puckRadius;
export const PLAY_MAX_Y = WORLD.height - WORLD.margin - WORLD.puckRadius;

const FIXED_STEP = 1 / 180;
const MAX_EVENT_LOG = 120;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sideOfY(y) {
  return y >= CENTER_Y ? "south" : "north";
}

function pushEvent(state, event) {
  state.events.push(event);
  if (state.events.length > MAX_EVENT_LOG) {
    state.events.splice(0, state.events.length - MAX_EVENT_LOG);
  }
}

export function gateIndexAt(state, x) {
  for (let index = 0; index < state.gates.length; index += 1) {
    if (Math.abs(x - state.gates[index].x) <= WORLD.gatePass) return index;
  }
  return -1;
}

export function createMatch(options = {}) {
  const settings = normalizeSettings(options);
  const board = getBoard(settings.boardId);
  const difficulty = getDifficulty(settings.difficulty);
  const gates = board.gates.map((fraction) => ({
    x: WORLD.width * fraction,
    y: CENTER_Y,
  }));

  const northY = WORLD.margin + START.baselineInset;
  const southY = WORLD.height - WORLD.margin - START.baselineInset;
  const pucks = [];
  START.offsets.forEach((offset, index) => {
    pucks.push({
      id: index,
      side: "south",
      x: WORLD.width / 2 + offset,
      y: southY,
      vx: 0,
      vy: 0,
    });
  });
  START.offsets.forEach((offset, index) => {
    pucks.push({
      id: START.offsets.length + index,
      side: "north",
      x: WORLD.width / 2 + offset,
      y: northY,
      vx: 0,
      vy: 0,
    });
  });
  if (pucks.length !== PUCKS_PER_SIDE * 2) throw new Error("flick: puck layout mismatch");

  return {
    boardId: board.id,
    mode: settings.mode,
    difficulty: difficulty.id,
    humanSide: settings.humanSide,
    gates,
    pucks,
    turn: "south",
    phase: "aim",
    status: "playing",
    winner: null,
    reason: null,
    round: 0,
    maxRounds: MAX_ROUNDS,
    time: 0,
    paused: false,
    settleTimer: 0,
    events: [],
    lastShot: null,
    seed: Number.isFinite(options.seed) ? Math.floor(options.seed) : 1,
  };
}

export function puckSpeed(puck) {
  return Math.hypot(puck.vx, puck.vy);
}

export function anyMoving(state) {
  return state.pucks.some((puck) => puck.vx !== 0 || puck.vy !== 0);
}

export function sideCounts(state) {
  const counts = { south: 0, north: 0 };
  for (const puck of state.pucks) {
    if (puck.side === "south") counts.south += 1;
    else if (puck.side === "north") counts.north += 1;
  }
  return counts;
}

export function canFlick(state, puckId) {
  if (state.status !== "playing" || state.paused || state.phase !== "aim") return false;
  const puck = state.pucks.find((item) => item.id === puckId);
  if (!puck) return false;
  if (puck.side !== state.turn) return false;
  return puckSpeed(puck) === 0;
}

/**
 * Fire a puck for the side whose turn it is. Direction is a unit vector
 * pointing away from the finger; power is 0..1 from the pull distance.
 */
export function flick(state, puckId, dirX, dirY, power) {
  if (!canFlick(state, puckId)) return null;
  const length = Math.hypot(dirX, dirY);
  if (!Number.isFinite(length) || length < 1e-6) return null;
  const clamped = clamp(Number(power) || 0, 0.05, 1);
  const speed = WORLD.minFlickSpeed + (WORLD.maxFlickSpeed - WORLD.minFlickSpeed) * clamped;
  const puck = state.pucks.find((item) => item.id === puckId);
  puck.vx = (dirX / length) * speed;
  puck.vy = (dirY / length) * speed;
  state.phase = "slide";
  state.settleTimer = 0;
  state.round += 1;
  state.lastShot = {
    puckId,
    side: state.turn,
    power: clamped,
    speed,
    dirX: puck.vx / speed,
    dirY: puck.vy / speed,
  };
  pushEvent(state, {
    type: "flick",
    puckId,
    side: state.turn,
    power: clamped,
    speed,
  });
  return state.lastShot;
}

function resolveWalls(state, puck) {
  let hitSpeed = 0;
  if (puck.x < PLAY_MIN_X) {
    puck.x = PLAY_MIN_X;
    if (puck.vx < 0) {
      hitSpeed = Math.max(hitSpeed, Math.abs(puck.vx));
      puck.vx = -puck.vx * WORLD.wallRestitution;
      puck.vy *= 0.94;
    }
  } else if (puck.x > PLAY_MAX_X) {
    puck.x = PLAY_MAX_X;
    if (puck.vx > 0) {
      hitSpeed = Math.max(hitSpeed, Math.abs(puck.vx));
      puck.vx = -puck.vx * WORLD.wallRestitution;
      puck.vy *= 0.94;
    }
  }
  if (puck.y < PLAY_MIN_Y) {
    puck.y = PLAY_MIN_Y;
    if (puck.vy < 0) {
      hitSpeed = Math.max(hitSpeed, Math.abs(puck.vy));
      puck.vy = -puck.vy * WORLD.wallRestitution;
      puck.vx *= 0.94;
    }
  } else if (puck.y > PLAY_MAX_Y) {
    puck.y = PLAY_MAX_Y;
    if (puck.vy > 0) {
      hitSpeed = Math.max(hitSpeed, Math.abs(puck.vy));
      puck.vy = -puck.vy * WORLD.wallRestitution;
      puck.vx *= 0.94;
    }
  }
  if (hitSpeed > 32) {
    pushEvent(state, { type: "rail", puckId: puck.id, speed: hitSpeed, x: puck.x, y: puck.y });
  }
}

function resolveDivider(state, puck) {
  const gateIndex = gateIndexAt(state, puck.x);
  if (gateIndex < 0) {
    if (puck.side === "south" && puck.y < CENTER_Y + DIVIDER_BAND) {
      puck.y = CENTER_Y + DIVIDER_BAND;
      if (puck.vy < 0) {
        const speed = Math.abs(puck.vy);
        puck.vy = -puck.vy * WORLD.dividerRestitution;
        puck.vx *= 0.86;
        if (speed > 40) {
          pushEvent(state, { type: "post", puckId: puck.id, speed, x: puck.x, y: CENTER_Y });
        }
      }
    } else if (puck.side === "north" && puck.y > CENTER_Y - DIVIDER_BAND) {
      puck.y = CENTER_Y - DIVIDER_BAND;
      if (puck.vy > 0) {
        const speed = Math.abs(puck.vy);
        puck.vy = -puck.vy * WORLD.dividerRestitution;
        puck.vx *= 0.86;
        if (speed > 40) {
          pushEvent(state, { type: "post", puckId: puck.id, speed, x: puck.x, y: CENTER_Y });
        }
      }
    }
    return;
  }

  if (puck.side === "south" && puck.y < CENTER_Y) {
    puck.side = "north";
    pushEvent(state, {
      type: "gate",
      puckId: puck.id,
      gateIndex,
      from: "south",
      to: "north",
      x: puck.x,
      y: CENTER_Y,
    });
  } else if (puck.side === "north" && puck.y > CENTER_Y) {
    puck.side = "south";
    pushEvent(state, {
      type: "gate",
      puckId: puck.id,
      gateIndex,
      from: "north",
      to: "south",
      x: puck.x,
      y: CENTER_Y,
    });
  }
}

function collidePucks(state) {
  const list = state.pucks;
  const minDistance = WORLD.puckRadius * 2;
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let distance = Math.hypot(dx, dy);
      if (distance === 0) {
        dx = 0.01;
        dy = 0;
        distance = 0.01;
      }
      if (distance >= minDistance) continue;
      const nx = dx / distance;
      const ny = dy / distance;
      const overlap = minDistance - distance;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;

      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn < 0) {
        const impulse = (-(1 + WORLD.puckRestitution) * vn) / 2;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;
        if (-vn > 36) {
          pushEvent(state, {
            type: "clack",
            a: a.id,
            b: b.id,
            speed: -vn,
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
          });
        }
      }
    }
  }
}

function substep(state, h) {
  const damp = Math.exp(-WORLD.damping * h);
  for (const puck of state.pucks) {
    if (puck.vx === 0 && puck.vy === 0) continue;
    puck.vx *= damp;
    puck.vy *= damp;
    puck.x += puck.vx * h;
    puck.y += puck.vy * h;
    if (puckSpeed(puck) < WORLD.stopSpeed) {
      puck.vx = 0;
      puck.vy = 0;
    }
  }
  for (const puck of state.pucks) {
    resolveWalls(state, puck);
    resolveDivider(state, puck);
  }
  collidePucks(state);
  for (const puck of state.pucks) {
    resolveWalls(state, puck);
    resolveDivider(state, puck);
  }
}

function endMatch(state, winner, reason) {
  state.status = "ended";
  state.phase = "ended";
  state.winner = winner;
  state.reason = reason;
  state.settleTimer = 0;
  pushEvent(state, {
    type: "end",
    winner,
    reason,
    round: state.round,
    time: Math.round(state.time * 10) / 10,
    counts: sideCounts(state),
  });
}

function resolveTurn(state) {
  const counts = sideCounts(state);
  const foe = otherSide(state.turn);
  if (counts[state.turn] === 0) {
    endMatch(state, state.turn, "cleared");
    return;
  }
  if (counts[foe] === 0) {
    endMatch(state, foe, "cleared");
    return;
  }
  if (state.round >= state.maxRounds) {
    if (counts.south < counts.north) endMatch(state, "south", "limit");
    else if (counts.north < counts.south) endMatch(state, "north", "limit");
    else endMatch(state, "draw", "limit");
    return;
  }
  state.turn = foe;
  state.phase = "aim";
  state.settleTimer = 0;
  pushEvent(state, { type: "turn", turn: state.turn, round: state.round });
}

/** Advance the match by wall-clock seconds with a fixed 1/180 internal step. */
export function advance(state, dt) {
  if (state.status !== "playing" || state.paused) return 0;
  const seconds = clamp(Number(dt) || 0, 0, 0.25);
  if (seconds === 0) return 0;
  let remaining = seconds;
  while (remaining > 1e-9) {
    const slice = Math.min(FIXED_STEP, remaining);
    substep(state, slice);
    remaining -= slice;
  }
  state.time += seconds;
  if (state.phase === "slide") {
    if (anyMoving(state)) {
      state.settleTimer = 0;
    } else {
      state.settleTimer += seconds;
      if (state.settleTimer >= 0.16) resolveTurn(state);
    }
  }
  return seconds;
}

/** Headless run until the current shot settles (or the match ends). */
export function settleShot(state, maxSeconds = 8) {
  let elapsed = 0;
  while (state.status === "playing" && state.phase === "slide" && elapsed < maxSeconds) {
    advance(state, 1 / 60);
    elapsed += 1 / 60;
  }
  if (state.status === "playing" && state.phase === "slide" && !anyMoving(state)) {
    advance(state, 0.2);
  }
  return elapsed;
}

export function setPaused(state, value) {
  if (state.status !== "playing") {
    state.paused = false;
    return false;
  }
  state.paused = Boolean(value);
  return state.paused;
}

export function drainEvents(state) {
  const events = state.events.slice();
  state.events.length = 0;
  return events;
}

export function snapshot(state) {
  const counts = sideCounts(state);
  const difficulty = getDifficulty(state.difficulty);
  return {
    boardId: state.boardId,
    mode: state.mode,
    difficulty: state.difficulty,
    humanSide: state.humanSide,
    status: state.status,
    phase: state.phase,
    paused: state.paused,
    turn: state.turn,
    winner: state.winner,
    reason: state.reason,
    round: state.round,
    maxRounds: state.maxRounds,
    time: Math.round(state.time * 10) / 10,
    counts,
    gates: state.gates.map((gate) => ({ x: Math.round(gate.x * 10) / 10, y: gate.y })),
    pucks: state.pucks.map((puck) => ({
      id: puck.id,
      side: puck.side,
      x: Math.round(puck.x * 100) / 100,
      y: Math.round(puck.y * 100) / 100,
      vx: Math.round(puck.vx * 10) / 10,
      vy: Math.round(puck.vy * 10) / 10,
    })),
    lastShot: state.lastShot ? { ...state.lastShot } : null,
    aimError: difficulty.aimError,
  };
}

/** Test / smoke helper: teleport every puck of a side through the gate. */
export function debugCrossAll(state, side) {
  if (state.status !== "playing") return 0;
  if (side !== "south" && side !== "north") return 0;
  const target = otherSide(side);
  const y = target === "north" ? CENTER_Y - DIVIDER_BAND - 10 : CENTER_Y + DIVIDER_BAND + 10;
  let moved = 0;
  for (const puck of state.pucks) {
    if (puck.side !== side) continue;
    puck.side = target;
    puck.y = y;
    puck.vx = 0;
    puck.vy = 0;
    moved += 1;
    pushEvent(state, {
      type: "gate",
      puckId: puck.id,
      gateIndex: 0,
      from: side,
      to: target,
      x: puck.x,
      y: CENTER_Y,
    });
  }
  if (moved > 0) {
    state.phase = "slide";
    state.settleTimer = 0.2;
  }
  return moved;
}
