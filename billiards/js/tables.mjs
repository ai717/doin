// Layout tables for the single-player clear run.
// Everything is keyed by table id; no display text lives in this file.
// Layouts are generated from a deterministic seed and audited for solvability.

import {
  BALL_R, MIN_X, MAX_X, MIN_Y, MAX_Y, POCKETS, TABLE_W, TABLE_H,
  mulberry32, shuffled, randRange, makeBall, createWorld, cueBall,
  traceShot, distToSegment, overlapsAny, insidePocketMouth, buildRack,
} from "./engine.mjs";

const POOL = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];

export const TABLES = Object.freeze([
  { id: "table_1", kind: "rack", seed: 61001, par: 24, count: 15 },
  { id: "table_2", kind: "spread", seed: 61002, par: 16, count: 9, rail: 0 },
  { id: "table_3", kind: "spread", seed: 61003, par: 17, count: 10, rail: 0.3 },
  { id: "table_4", kind: "cluster", seed: 61004, par: 16, count: 9, cluster: 4 },
  { id: "table_5", kind: "spread", seed: 61005, par: 16, count: 9, rail: 0.15 },
  { id: "table_6", kind: "rail", seed: 61006, par: 15, count: 8, rail: 0.6 },
  { id: "table_7", kind: "cluster", seed: 61007, par: 15, count: 8, cluster: 5 },
  { id: "table_8", kind: "spread", seed: 61008, par: 15, count: 8, rail: 0.25 },
  { id: "table_9", kind: "rail", seed: 61009, par: 14, count: 7, rail: 0.7 },
  { id: "table_10", kind: "cluster", seed: 61010, par: 14, count: 7, cluster: 4, eightOnRail: true },
]);

export const DEFAULT_TABLE = "table_1";

export function getTable(id) {
  return TABLES.find((t) => t.id === id) ?? TABLES[0];
}

export function tableIndex(id) {
  const i = TABLES.findIndex((t) => t.id === id);
  return i < 0 ? 0 : i;
}

export function nextTableId(id) {
  const i = tableIndex(id);
  return i + 1 < TABLES.length ? TABLES[i + 1].id : null;
}

function pickNumbers(rng, count) {
  const pool = shuffled(rng, POOL);
  const chosen = pool.slice(0, Math.max(0, count - 1));
  chosen.push(8);
  return shuffled(rng, chosen);
}

function legalFreeSpot(cue, placed, x, y) {
  if (x < MIN_X + 1.2 || x > MAX_X - 1.2 || y < MIN_Y + 1.2 || y > MAX_Y - 1.2) return false;
  if (insidePocketMouth(x, y, 1.6)) return false;
  if (Math.hypot(cue.x - x, cue.y - y) < 5) return false;
  return !overlapsAny(placed, x, y, null, 0.55);
}

function scatter(rng, cue, placed, x0, x1, y0, y1, tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    const x = randRange(rng, x0, x1);
    const y = randRange(rng, y0, y1);
    if (legalFreeSpot(cue, placed, x, y)) return { x, y };
  }
  return null;
}

function railSpot(rng, cue, placed) {
  for (let i = 0; i < 80; i += 1) {
    const side = Math.floor(rng() * 4);
    if (side === 0) {
      const x = randRange(rng, MIN_X + 5, MAX_X - 5);
      const y = MIN_Y;
      if (legalFreeSpot(cue, placed, x, y)) return { x, y };
    } else if (side === 1) {
      const x = randRange(rng, MIN_X + 5, MAX_X - 5);
      const y = MAX_Y;
      if (legalFreeSpot(cue, placed, x, y)) return { x, y };
    } else if (side === 2) {
      const x = MIN_X;
      const y = randRange(rng, MIN_Y + 4, MAX_Y - 4);
      if (legalFreeSpot(cue, placed, x, y)) return { x, y };
    } else {
      const x = MAX_X;
      const y = randRange(rng, MIN_Y + 4, MAX_Y - 4);
      if (legalFreeSpot(cue, placed, x, y)) return { x, y };
    }
  }
  return null;
}

function buildRackLayout(table) {
  const balls = buildRack(table.seed);
  if (table.count >= 15) return { cue: { x: balls[0].x, y: balls[0].y }, balls };
  // Trim to a lighter break while keeping the apex ball and the 8.
  const keep = new Set([0, 8]);
  const rest = shuffled(mulberry32(table.seed ^ 0x5f3a), POOL);
  for (const n of rest) {
    if (keep.size >= table.count + 1) break;
    keep.add(n);
  }
  return { cue: { x: balls[0].x, y: balls[0].y }, balls: balls.filter((b) => keep.has(b.number)) };
}

function generateCandidate(rng, table) {
  if (table.kind === "rack") return buildRackLayout(table);
  const cue = { x: randRange(rng, MIN_X + 4, TABLE_W * 0.42), y: randRange(rng, MIN_Y + 4, MAX_Y - 4) };
  const numbers = pickNumbers(rng, table.count);
  const placed = [];
  const railShare = table.rail ?? 0;
  const railCount = Math.floor(numbers.length * railShare);
  let failures = 0;

  if (table.kind === "cluster") {
    const cx = randRange(rng, TABLE_W * 0.5, MAX_X - 6);
    const cy = randRange(rng, MIN_Y + 5, MAX_Y - 5);
    const groupSize = Math.min(table.cluster ?? 4, numbers.length);
    let placedInCluster = 0;
    for (let i = 0; i < numbers.length; i += 1) {
      let spot = null;
      if (placedInCluster < groupSize) {
        for (let tries = 0; tries < 60 && !spot; tries += 1) {
          const ang = rng() * Math.PI * 2;
          const rad = randRange(rng, 1.05, 1.05 + groupSize * 0.55);
          const x = Math.min(MAX_X - 1.3, Math.max(MIN_X + 1.3, cx + Math.cos(ang) * rad));
          const y = Math.min(MAX_Y - 1.3, Math.max(MIN_Y + 1.3, cy + Math.sin(ang) * rad));
          if (legalFreeSpot(cue, placed, x, y)) spot = { x, y };
        }
        if (spot) placedInCluster += 1;
      }
      if (!spot) spot = scatter(rng, cue, placed, MIN_X + 3, MAX_X - 3, MIN_Y + 3, MAX_Y - 3);
      if (!spot) { failures += 1; continue; }
      placed.push(makeBall(numbers[i], spot.x, spot.y));
    }
  } else {
    for (let i = 0; i < numbers.length; i += 1) {
      const useRail = i < railCount;
      let spot = useRail ? railSpot(rng, cue, placed) : null;
      if (!spot) spot = scatter(rng, cue, placed, MIN_X + 3, MAX_X - 3, MIN_Y + 3, MAX_Y - 3);
      if (!spot) { failures += 1; continue; }
      placed.push(makeBall(numbers[i], spot.x, spot.y));
    }
  }

  if (table.eightOnRail) {
    const eight = placed.find((b) => b.number === 8);
    if (eight) {
      const spot = railSpot(rng, cue, placed.filter((b) => b !== eight));
      if (spot) {
        eight.x = spot.x;
        eight.y = spot.y;
      }
    }
  }
  if (failures > 2 || placed.length < Math.max(3, numbers.length - 2)) return null;
  return { cue, balls: [makeBall(0, cue.x, cue.y), ...placed] };
}

function layoutIsClean(layout) {
  for (const b of layout.balls) {
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) return false;
    if (b.x < MIN_X || b.x > MAX_X || b.y < MIN_Y || b.y > MAX_Y) return false;
    if (insidePocketMouth(b.x, b.y, 0.25)) return false;
  }
  for (let i = 0; i < layout.balls.length; i += 1) {
    for (let j = i + 1; j < layout.balls.length; j += 1) {
      const a = layout.balls[i];
      const b = layout.balls[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) < BALL_R * 2 - 1e-6) return false;
    }
  }
  return true;
}

export function firstContactSet(layout, samples = 720) {
  const world = createWorld(layout.balls);
  const cue = cueBall(world);
  if (!cue) return [];
  const found = new Map();
  for (let i = 0; i < samples; i += 1) {
    const angle = (i / samples) * Math.PI * 2;
    const hit = traceShot(world, angle, { maxDist: 220 });
    if (hit && hit.type === "ball") found.set(hit.ball.id, hit.ball);
  }
  return [...found.values()];
}

function pathClear(layout, from, to, ignoreIds) {
  for (const b of layout.balls) {
    if (ignoreIds.includes(b.id)) continue;
    if (distToSegment(b.x, b.y, from.x, from.y, to.x, to.y) < BALL_R * 2 - 0.01) return false;
  }
  return true;
}

export function pocketPoint(pocket) {
  if (pocket.kind === "corner") return { x: pocket.x, y: pocket.y };
  return { x: pocket.x, y: pocket.y <= TABLE_H / 2 ? MIN_Y - 0.2 : MAX_Y + 0.2 };
}

/** Straight pot lines available right now (ball -> pocket, reachable from cue). */
export function pottableShots(layout) {
  const world = createWorld(layout.balls);
  const cue = cueBall(world);
  if (!cue) return [];
  const out = [];
  for (const ball of world.balls) {
    if (ball.id === 0) continue;
    for (const pocket of POCKETS) {
      const target = pocketPoint(pocket);
      const dxT = target.x - ball.x;
      const dyT = target.y - ball.y;
      const len = Math.hypot(dxT, dyT);
      if (len < 1e-6) continue;
      const nx = dxT / len;
      const ny = dyT / len;
      if (!pathClear(layout, ball, target, [ball.id])) continue;
      // Ghost-ball spot must be reachable by the cue along a straight line.
      const ghost = { x: ball.x - nx * BALL_R * 2, y: ball.y - ny * BALL_R * 2 };
      if (ghost.x < MIN_X || ghost.x > MAX_X || ghost.y < MIN_Y || ghost.y > MAX_Y) continue;
      if (!pathClear(layout, cue, ghost, [0, ball.id])) continue;
      // The cue must sit behind the object ball (-1 == dead straight), or the
      // object can only be driven away from the pocket.
      const toCueX = cue.x - ball.x;
      const toCueY = cue.y - ball.y;
      const cueLen = Math.hypot(toCueX, toCueY) || 1;
      const behind = (-nx * toCueX - ny * toCueY) / cueLen;
      if (behind < 0.08) continue;
      out.push({ ball: ball.id, pocket: pocket.id, cut: behind });
    }
  }
  return out;
}

export function auditLayout(layout) {
  const contact = firstContactSet(layout).length;
  const pots = pottableShots(layout).length;
  return { contact, pots, ok: contact > 0 && pots > 0 };
}

/** Deterministic layout for a table id, audited before it is handed out. */
export function buildLayout(tableId) {
  const table = getTable(tableId);
  if (table.kind === "rack") {
    const layout = buildRackLayout(table);
    return { table, layout, attempt: 0, audit: { contact: firstContactSet(layout).length, pots: 0, ok: true } };
  }
  let fallback = null;
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const rng = mulberry32(table.seed + attempt * 7919);
    const layout = generateCandidate(rng, table);
    if (!layout || !layoutIsClean(layout)) continue;
    const audit = auditLayout(layout);
    if (!fallback) fallback = { table, layout, attempt, audit };
    if (audit.ok) return { table, layout, attempt, audit };
  }
  return fallback ?? { table, layout: generateCandidate(mulberry32(table.seed), table), attempt: -1, audit: { contact: 0, pots: 0, ok: false } };
}

/** Full 15-ball rack used by the versus mode. */
export function versusLayout(seed = 70001) {
  return buildRack(seed);
}
