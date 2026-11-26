// engine.mjs - pure rules for the rubber-arm heist.
// DOM-free: no document / window / storage / rng dependency inside.
//
// Rope model
// ----------
// The arm is a taut rubber cord pinned at the thief shoulder. When the arm
// segment that reaches for the hand would cut through a pillar, the cord is
// forced to pivot around it: we record that pillar with the side the cord
// leans on, then the visible path becomes tangent -> arc -> tangent.
// The pivot releases as soon as the hand brings the pillar back to the other
// side of the incoming segment (the cord slips off), which is what makes
// "pull back to unwind" work without any hidden state.
//
// Everything is a pure function of (level, state, input); the controller owns
// time, the UI owns pixels.

export const STAGE = Object.freeze({ width: 840, height: 560 });
export const TAU = Math.PI * 2;
export const DRAG_STEP = 5;
export const HAND_RADIUS = 14;
export const GRAB_RADIUS = 22;
export const LEVER_RADIUS = 26;
export const RETRACT_SPEED = 1500;
export const SHOCK_TIME = 0.55;
export const EDGE_MARGIN = 16;
export const MAX_PIVOTS = 6;

const EPS = 1e-6;

export const cross = (ax, ay, bx, by) => ax * by - ay * bx;

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function segmentPointDistance(a, b, p) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < EPS) return { distance: dist(a, p), t: 0 };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return { distance: Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y), t };
}

// Entry / exit parameters of the segment vs circle, or null when it misses.
export function segmentCircle(a, b, center, radius) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const fx = a.x - center.x;
  const fy = a.y - center.y;
  const qa = dx * dx + dy * dy;
  const qb = 2 * (fx * dx + fy * dy);
  const qc = fx * fx + fy * fy - radius * radius;
  if (qa < EPS) return qc <= 0 ? { t0: 0, t1: 0 } : null;
  const disc = qb * qb - 4 * qa * qc;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const t0 = (-qb - root) / (2 * qa);
  const t1 = (-qb + root) / (2 * qa);
  if (t1 < 0 || t0 > 1) return null;
  return { t0: Math.max(0, t0), t1: Math.min(1, t1) };
}

export function segmentIntersection(a, b, c, d) {
  const rX = b.x - a.x;
  const rY = b.y - a.y;
  const sX = d.x - c.x;
  const sY = d.y - c.y;
  const denom = cross(rX, rY, sX, sY);
  if (Math.abs(denom) < EPS) return null;
  const t = cross(c.x - a.x, c.y - a.y, sX, sY) / denom;
  const u = cross(c.x - a.x, c.y - a.y, rX, rY) / denom;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return { x: a.x + rX * t, y: a.y + rY * t, t };
}

export function segmentSegmentDistance(a, b, c, d) {
  if (segmentIntersection(a, b, c, d)) return 0;
  return Math.min(
    segmentPointDistance(a, b, c).distance,
    segmentPointDistance(a, b, d).distance,
    segmentPointDistance(c, d, a).distance,
    segmentPointDistance(c, d, b).distance,
  );
}

// Tangent point from an external anchor, `side` picks the winding hand.
// side +1 -> angle + alpha, side -1 -> angle - alpha.
export function tangentPoint(from, center, radius, side) {
  const dx = from.x - center.x;
  const dy = from.y - center.y;
  const d = Math.hypot(dx, dy);
  if (d <= radius + 0.01) {
    const angle = d < EPS ? 0 : Math.atan2(dy, dx);
    return {
      x: center.x + Math.cos(angle) * (radius + 0.01),
      y: center.y + Math.sin(angle) * (radius + 0.01),
      degenerate: true,
    };
  }
  const base = Math.atan2(dy, dx);
  const alpha = Math.acos(Math.min(1, radius / d));
  const angle = base + side * alpha;
  return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
}

export function normalize01(angle) {
  return ((angle % TAU) + TAU) % TAU;
}

export function normalizeSigned(angle) {
  const wrapped = normalize01(angle);
  return wrapped > Math.PI ? wrapped - TAU : wrapped;
}

// Which side the cord leans on: the one with the shorter detour.
// Ties (a dead-centre crossing) resolve to +1 so the fold is deterministic.
export function chooseSide(from, hand, peg) {
  const probe = (side) => {
    const entry = tangentPoint(from, peg, peg.r, side);
    const exit = tangentPoint(hand, peg, peg.r, -side);
    const a0 = Math.atan2(entry.y - peg.y, entry.x - peg.x);
    const a1 = Math.atan2(exit.y - peg.y, exit.x - peg.x);
    const sweep = normalize01(side * (a1 - a0));
    return dist(from, entry) + peg.r * sweep + dist(exit, hand);
  };
  const plus = probe(1);
  const minus = probe(-1);
  return plus <= minus + EPS ? 1 : -1;
}

export function clampToStage(point, margin = EDGE_MARGIN) {
  return {
    x: Math.max(margin, Math.min(STAGE.width - margin, point.x)),
    y: Math.max(margin, Math.min(STAGE.height - margin, point.y)),
  };
}

export function pointInCircle(point, center, radius) {
  return dist(point, center) <= radius;
}

// ---------------------------------------------------------------------------
// Path building
// ---------------------------------------------------------------------------

// Returns { points, pivots, length } where `points` is a dense polyline
// (arcs already sampled) and `pivots[i].from` is the anchor the i-th pivot
// hangs from - used by the release test.
export function buildPath(level, hand, pivots) {
  const origin = level.origin;
  const points = [{ x: origin.x, y: origin.y }];
  const list = [];
  let anchor = points[0];

  for (let i = 0; i < pivots.length; i += 1) {
    const pv = pivots[i];
    const peg = level.pegs[pv.peg];
    if (!peg) {
      list.push({ from: anchor, skipped: true });
      continue;
    }
    const entry = tangentPoint(anchor, peg, peg.r, pv.side);
    const isLast = i === pivots.length - 1;
    let sweep;
    let exit;
    if (isLast && Number.isFinite(pv.sweep)) {
      // The cord wraps the pillar by exactly the accumulated angle, so pulling
      // the glove back walks the contact point around until it slips off.
      sweep = Math.max(0.001, Math.min(TAU, pv.sweep));
      const a0 = Math.atan2(entry.y - peg.y, entry.x - peg.x);
      const a1 = a0 + pv.side * sweep;
      exit = { x: peg.x + Math.cos(a1) * peg.r, y: peg.y + Math.sin(a1) * peg.r };
    } else {
      const nextPeg = i + 1 < pivots.length ? level.pegs[pivots[i + 1].peg] : null;
      const reference = nextPeg ?? hand;
      exit = tangentPoint(reference, peg, peg.r, -pv.side);
      const a0 = Math.atan2(entry.y - peg.y, entry.x - peg.x);
      const a1 = Math.atan2(exit.y - peg.y, exit.x - peg.x);
      sweep = normalize01(pv.side * (a1 - a0));
    }

    points.push({ x: entry.x, y: entry.y });
    const steps = Math.max(2, Math.ceil(sweep / (Math.PI / 18)));
    for (let k = 1; k < steps; k += 1) {
      const angle = Math.atan2(entry.y - peg.y, entry.x - peg.x) + pv.side * (sweep * k) / steps;
      points.push({ x: peg.x + Math.cos(angle) * peg.r, y: peg.y + Math.sin(angle) * peg.r });
    }
    points.push({ x: exit.x, y: exit.y });
    list.push({ from: anchor, peg: pv.peg, side: pv.side, sweep, entry, exit });
    anchor = { x: exit.x, y: exit.y };
  }

  points.push({ x: hand.x, y: hand.y });
  let length = 0;
  for (let i = 1; i < points.length; i += 1) length += dist(points[i - 1], points[i]);
  return { points, pivots: list, length };
}

// Re-derive the hanging angle of the pivot touching the glove, and release it
// once the cord has unwound (sweep <= 0). Pulling back therefore peels the arm
// off the pillar one turn at a time instead of leaving it snagged forever.
function syncPivots(level, hand, pivots) {
  let guard = 0;
  while (pivots.length && guard < 12) {
    guard += 1;
    const index = pivots.length - 1;
    const pv = pivots[index];
    const peg = level.pegs[pv.peg];
    if (!peg) {
      pivots.pop();
      continue;
    }
    const path = buildPath(level, hand, pivots);
    const info = path.pivots[index];
    if (!info || info.skipped) {
      pivots.pop();
      continue;
    }
    const exit = tangentPoint(hand, peg, peg.r, -pv.side);
    const a0 = Math.atan2(info.entry.y - peg.y, info.entry.x - peg.x);
    const a1 = Math.atan2(exit.y - peg.y, exit.x - peg.x);
    const raw = pv.side * (a1 - a0);
    // The cord only hangs on the pillar while the direct line still cuts it.
    if (!segmentCircle(info.from, hand, peg, peg.r * 0.999)) {
      pivots.pop();
      continue;
    }
    if (!Number.isFinite(pv.raw)) {
      pv.raw = raw;
      pv.sweep = normalize01(raw);
    } else {
      pv.sweep += normalizeSigned(raw - pv.raw);
      pv.raw = raw;
    }
    if (pv.sweep <= 0.02) {
      pivots.pop();
      continue;
    }
    if (pv.sweep > TAU) pv.sweep = TAU;
    return;
  }
}

function pushOutOfPegs(level, point) {
  let p = point;
  for (const peg of level.pegs) {
    const d = dist(p, peg);
    const limit = peg.r + HAND_RADIUS * 0.5;
    if (d < limit) {
      const angle = d < EPS ? 0 : Math.atan2(p.y - peg.y, p.x - peg.x);
      p = { x: peg.x + Math.cos(angle) * limit, y: peg.y + Math.sin(angle) * limit };
    }
  }
  return p;
}

// First pillar the new segment would cut through, skipping pillars already
// hooked and pillars the glove starts inside.
function findPivot(level, from, hand, pivots) {
  let best = null;
  for (let i = 0; i < level.pegs.length; i += 1) {
    if (pivots.some((pv) => pv.peg === i)) continue;
    const peg = level.pegs[i];
    if (dist(from, peg) < peg.r + EPS) continue;
    const hit = segmentCircle(from, hand, peg, peg.r);
    if (!hit) continue;
    const side = chooseSide(from, hand, peg);
    if (!best || hit.t0 < best.t0) best = { peg: i, side, t0: hit.t0 };
  }
  return best;
}

function insertPivot(level, hand, pivots) {
  const path = buildPath(level, hand, pivots);
  const anchor = path.points[path.points.length - 2] ?? level.origin;
  const found = findPivot(level, anchor, hand, pivots);
  if (!found) return false;
  const peg = level.pegs[found.peg];
  const entry = tangentPoint(anchor, peg, peg.r, found.side);
  const exit = tangentPoint(hand, peg, peg.r, -found.side);
  const a0 = Math.atan2(entry.y - peg.y, entry.x - peg.x);
  const a1 = Math.atan2(exit.y - peg.y, exit.x - peg.x);
  const raw = found.side * (a1 - a0);
  const sweep = normalize01(raw);
  // A graze (or an almost complete turn) must not turn into a snag: the cord
  // simply slides past the pillar in those two cases.
  if (sweep < 0.05 || sweep > TAU - 0.2) return false;
  pivots.push({ peg: found.peg, side: found.side, raw, sweep });
  return true;
}

// ---------------------------------------------------------------------------
// Hazard geometry
// ---------------------------------------------------------------------------

export function spotlightAngle(spot, time) {
  if (spot.mode === "sway" || spot.amplitude !== undefined) {
    const period = spot.period || 6;
    const phase = spot.phase || 0;
    return spot.angle + (spot.amplitude ?? 0.7) * Math.sin((TAU * time) / period + phase);
  }
  return spot.angle + (spot.speed || 0) * time;
}

export function spotlightWedge(spot, time) {
  const angle = spotlightAngle(spot, time);
  const spread = spot.spread ?? 0.34;
  const length = spot.length ?? 240;
  const points = [{ x: spot.x, y: spot.y }];
  const steps = 8;
  for (let i = 0; i <= steps; i += 1) {
    const a = angle - spread + (spread * 2 * i) / steps;
    points.push({ x: spot.x + Math.cos(a) * length, y: spot.y + Math.sin(a) * length });
  }
  return { points, angle, spread, length, x: spot.x, y: spot.y };
}

export function leverOn(state, id) {
  return Boolean(state.levers && state.levers[id]);
}

function laserActive(laser, state) {
  return !(laser.group && leverOn(state, laser.group));
}

// Hazard shapes normalised into { kind, segments, circles, time }
export function hazardShapes(level, state) {
  const lasers = [];
  for (const laser of level.lasers ?? []) {
    if (!laserActive(laser, state)) continue;
    lasers.push({ kind: "laser", a: { x: laser.x1, y: laser.y1 }, b: { x: laser.x2, y: laser.y2 } });
  }

  const wires = [];
  for (const wire of level.wires ?? []) {
    if (wire.group && leverOn(state, wire.group)) continue;
    const x2 = wire.x + wire.w;
    const y2 = wire.y + wire.h;
    wires.push({
      kind: "wire",
      rect: { x: wire.x, y: wire.y, w: wire.w, h: wire.h },
      corners: [
        { x: wire.x, y: wire.y },
        { x: x2, y: wire.y },
        { x: x2, y: y2 },
        { x: wire.x, y: y2 },
      ],
    });
  }

  const dogs = (level.dogs ?? []).map((dog) => ({
    kind: "dog",
    center: { x: dog.x, y: dog.y },
    radius: dog.r ?? 46,
  }));

  const wedges = (level.spotlights ?? []).map((spot) => ({
    kind: "spot",
    source: spot,
    ...spotlightWedge(spot, state.time ?? 0),
  }));

  return { lasers, wires, dogs, wedges };
}

function pathPoints(level, state) {
  if (state.status === "retract" && state.flight?.length) {
    return trimPath(state.flight, state.flightRemain ?? 0);
  }
  if (state.flight?.points && state.status === "won") return state.flight.points;
  return buildPath(level, state.hand, state.wraps).points;
}

// Walk along a polyline and keep only the prefix measured from its start.
export function trimPath(points, remain) {
  if (!points.length) return [];
  if (remain <= 0) return [{ x: points[0].x, y: points[0].y }];
  const out = [{ x: points[0].x, y: points[0].y }];
  let left = remain;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const d = dist(a, b);
    if (d < EPS) continue;
    if (left >= d) {
      out.push({ x: b.x, y: b.y });
      left -= d;
    } else {
      const t = left / d;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      return out;
    }
  }
  return out;
}

function pointInWedge(point, wedge) {
  const dx = point.x - wedge.x;
  const dy = point.y - wedge.y;
  if (Math.hypot(dx, dy) > wedge.length) return false;
  let delta = Math.atan2(dy, dx) - wedge.angle;
  delta = ((delta % TAU) + TAU) % TAU;
  if (delta > Math.PI) delta -= TAU;
  return Math.abs(delta) <= wedge.spread;
}

// Does the current arm touch anything lethal?
export function detectHazard(level, state) {
  const shapes = hazardShapes(level, state);
  const pts = pathPoints(level, state);
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    for (const laser of shapes.lasers) {
      if (segmentIntersection(a, b, laser.a, laser.b)) {
        return { kind: "laser", at: segmentIntersection(a, b, laser.a, laser.b) };
      }
    }
    for (const wire of shapes.wires) {
      for (let k = 0; k < 4; k += 1) {
        if (segmentIntersection(a, b, wire.corners[k], wire.corners[(k + 1) % 4])) {
          return { kind: "wire", at: segmentIntersection(a, b, wire.corners[k], wire.corners[(k + 1) % 4]) };
        }
      }
    }
    for (const dog of shapes.dogs) {
      if (segmentCircle(a, b, dog.center, dog.radius)) return { kind: "dog", at: { x: dog.center.x, y: dog.center.y } };
    }
  }
  // A guard's torch catches the glove, not the cord: only the hand has to stay
  // out of the beam, which is what makes a sweeping light a timing puzzle
  // rather than an unwinnable wall.
  const hand = state.hand;
  for (const wedge of shapes.wedges) {
    if (pointInWedge(hand, wedge)) return { kind: "spot", at: { x: hand.x, y: hand.y } };
    if (Math.hypot(hand.x - wedge.x, hand.y - wedge.y) < HAND_RADIUS) return { kind: "spot", at: { x: hand.x, y: hand.y } };
  }
  return null;
}

// Smallest distance between the arm and anything that can end the run.
export function pathClearance(level, state) {
  const shapes = hazardShapes(level, state);
  const pts = pathPoints(level, state);
  let best = Infinity;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    for (const laser of shapes.lasers) best = Math.min(best, segmentSegmentDistance(a, b, laser.a, laser.b));
    for (const wire of shapes.wires) {
      for (let k = 0; k < 4; k += 1) {
        best = Math.min(best, segmentSegmentDistance(a, b, wire.corners[k], wire.corners[(k + 1) % 4]));
      }
    }
    for (const dog of shapes.dogs) best = Math.min(best, Math.max(0, segmentPointDistance(a, b, dog.center).distance - dog.radius));
  }
  for (const wedge of shapes.wedges) {
    if (pointInWedge(state.hand, wedge)) return 0;
    best = Math.min(best, Math.max(0, Math.hypot(state.hand.x - wedge.x, state.hand.y - wedge.y) - wedge.length));
  }
  return Number.isFinite(best) ? Math.max(0, best) : Infinity;
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export function createState(level, { time = 0 } = {}) {
  const start = level.handStart ?? level.origin;
  return {
    levelId: level.id ?? 0,
    hand: { x: start.x, y: start.y },
    wraps: [],
    levers: {},
    time,
    status: "aim",
    failure: null,
    travelled: 0,
    shockTimer: 0,
    flight: null,
    flightRemain: 0,
    grabbed: false,
  };
}

function withStatus(state, status) {
  return { ...state, status };
}

function shock(state, hit) {
  return { ...state, status: "shock", failure: hit, shockTimer: 0 };
}

// Drag the glove towards `point`, folding the cord around any pillar it meets.
export function dragTo(level, state, point) {
  if (state.status !== "aim") return state;
  const target = clampToStage(point);
  const from = state.hand;
  const travel = dist(from, target);
  if (travel < EPS) return state;
  const steps = Math.max(1, Math.ceil(travel / DRAG_STEP));
  let hand = { x: from.x, y: from.y };
  let wraps = state.wraps.map((w) => ({ ...w }));
  let travelled = state.travelled ?? 0;
  let levers = { ...state.levers };

  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const next = pushOutOfPegs(level, {
      x: from.x + (target.x - from.x) * t,
      y: from.y + (target.y - from.y) * t,
    });
    travelled += dist(hand, next);
    hand = next;

    syncPivots(level, hand, wraps);

    let guard = 0;
    while (guard < MAX_PIVOTS) {
      guard += 1;
      if (!insertPivot(level, hand, wraps)) break;
    }
  }

  for (const lever of level.levers ?? []) {
    if (!lever.group) continue;
    if (dist(hand, lever) <= LEVER_RADIUS) levers = { ...levers, [lever.group]: true };
  }

  let next = { ...state, hand, wraps, levers, travelled };
  const hit = detectHazard(level, next);
  if (hit) return shock(next, hit);
  if (level.target && dist(hand, level.target) <= GRAB_RADIUS + (level.target.r ?? 0)) {
    return startRetract(level, { ...next, grabbed: true });
  }
  return next;
}

export function tick(level, state, dt) {
  if (state.status !== "aim") {
    if (state.status === "shock") return { ...state, shockTimer: (state.shockTimer ?? 0) + dt };
    return state;
  }
  if (!(level.spotlights?.length > 0)) return state;
  const next = { ...state, time: (state.time ?? 0) + dt };
  const hit = detectHazard(level, next);
  if (hit) return shock(next, hit);
  return next;
}

export function startRetract(level, state) {
  const path = buildPath(level, state.hand, state.wraps);
  return {
    ...state,
    status: "retract",
    flight: { points: path.points, total: path.length },
    flightRemain: path.length,
  };
}

export function advanceRetract(level, state, dt) {
  if (state.status !== "retract" || !state.flight) return state;
  const remain = Math.max(0, (state.flightRemain ?? 0) - RETRACT_SPEED * dt);
  const path = trimPath(state.flight.points, remain);
  const hand = path[path.length - 1] ?? { x: level.origin.x, y: level.origin.y };
  if (remain <= 0.001) {
    return {
      ...state,
      status: "won",
      hand: { x: level.origin.x, y: level.origin.y },
      flightRemain: 0,
      flight: { points: [{ x: level.origin.x, y: level.origin.y }], total: state.flight.total },
    };
  }
  return { ...state, hand, flightRemain: remain };
}

export function visiblePath(level, state) {
  return pathPoints(level, state);
}

export function armLength(level, state) {
  return buildPath(level, state.hand, state.wraps).length;
}

// Replays an authored waypoint list; used by the level verifier and tests.
// `time` picks the sweep phase the run starts at, which is how a spotlight
// stage proves it has a timing window at all.
export function playSolution(level, { time = 0 } = {}) {
  let state = createState(level, { time });
  const waypoints = level.solution ?? [];
  for (const wp of waypoints) {
    state = dragTo(level, state, wp);
    if (state.status !== "aim") break;
  }
  return state;
}

export function wrapCount(state) {
  return state.wraps?.length ?? 0;
}
