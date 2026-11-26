// Shot planning for the AI side. Pure math with an injected PRNG, no DOM access.

import { WORLD, CENTER_Y, gateIndexAt } from "./engine.mjs";
import { getDifficulty } from "./levels.mjs";

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lengthSquared;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function powerForDistance(distance) {
  const travel = distance * 1.24 + 42;
  const speed = travel * WORLD.damping;
  return clamp((speed - WORLD.minFlickSpeed) / (WORLD.maxFlickSpeed - WORLD.minFlickSpeed), 0.12, 0.98);
}

function blockedBetween(pucks, self, targetX, targetY, clearance) {
  for (const puck of pucks) {
    if (puck.id === self.id) continue;
    if (distanceToSegment(puck.x, puck.y, self.x, self.y, targetX, targetY) < clearance) return true;
  }
  return false;
}

/** Choose the cleanest puck-to-gate line, then add the difficulty's human error. */
export function planShot(state, difficultyId, random = Math.random) {
  if (state.status !== "playing" || state.phase !== "aim" || state.paused) return null;
  const own = state.pucks.filter((puck) => puck.side === state.turn && puck.vx === 0 && puck.vy === 0);
  if (own.length === 0) return null;
  const difficulty = getDifficulty(difficultyId);
  const clearance = WORLD.puckRadius * 2 + 6;

  let best = null;
  for (const puck of own) {
    for (let gateIndex = 0; gateIndex < state.gates.length; gateIndex += 1) {
      const gate = state.gates[gateIndex];
      const distance = Math.hypot(gate.x - puck.x, CENTER_Y - puck.y);
      if (distance < 1) continue;
      const blocked = blockedBetween(state.pucks, puck, gate.x, CENTER_Y, clearance);
      const score = (blocked ? 900 : 0) + distance;
      if (!best || score < best.score) {
        best = { puck, gate, gateIndex, distance, score, blocked };
      }
    }
  }
  if (!best) return null;

  // Aim a touch beyond the seam so the puck carries fully across the gate.
  const overshoot = state.turn === "south" ? -26 : 26;
  const targetX = best.gate.x;
  const targetY = CENTER_Y + overshoot;
  let angle = Math.atan2(targetY - best.puck.y, targetX - best.puck.x);
  let power = powerForDistance(best.distance);

  const errorRoll = (random() * 2 - 1);
  const powerRoll = (random() * 2 - 1);
  angle += errorRoll * difficulty.aimError;
  power *= 1 + powerRoll * difficulty.powerError;

  return {
    puckId: best.puck.id,
    gateIndex: best.gateIndex,
    dirX: Math.cos(angle),
    dirY: Math.sin(angle),
    power: clamp(power, 0.1, 0.99),
  };
}

/** Nearest gate that a given puck can line up with, used by the aim assist. */
export function bestGateFor(state, puck) {
  let best = 0;
  let bestDistance = Infinity;
  state.gates.forEach((gate, index) => {
    const distance = Math.abs(gate.x - puck.x) + Math.abs(CENTER_Y - puck.y) * 0.2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

export function gateIndexForPosition(state, x) {
  return gateIndexAt(state, x);
}
