// Billiards 8-Ball -- deterministic top-down physics + geometry authority.
// Strictly DOM-free: no document / window / storage access is allowed here.
// World units: 1 unit == 1 ball radius (R). Playing surface is 56 x 28.
// Ball diameter is 3 units -> 3/56 ≈ 5.4% of table width, arcade-legible size.

export const BALL_R = 0.75;
export const TABLE_W = 56;
export const TABLE_H = 28;
export const MIN_X = BALL_R;
export const MAX_X = TABLE_W - BALL_R;
export const MIN_Y = BALL_R;
export const MAX_Y = TABLE_H - BALL_R;
export const CORNER_MOUTH = 2.0;
export const HEAD_STRING_X = TABLE_W / 4;
export const FOOT_SPOT_X = (TABLE_W * 3) / 4;
export const CENTER_Y = TABLE_H / 2;

export const PHYS = Object.freeze({
  dt: 1 / 120,
  slideDecel: 62,
  rollDecel: 16,
  stopEps: 0.55,
  slideEps: 0.05,
  maxSpeed: 170,
  minShotSpeed: 10,
  maxShotSpeed: 120,
  ballRestitution: 0.97,
  railRestitution: 0.8,
  railFriction: 0.985,
  railSpinNormal: 0.35,
  railSpinTangent: 0.9,
  sideRailKick: 0.26,
  sideRailKeep: 0.55,
  sideDecay: 0.35,
  sidePower: 0.85,
  maxSubSteps: 12,
  maxStepsPerFrame: 48,
});

// Corner pockets use a circular capture zone pushed slightly outside the rails.
// Middle pockets use a mouth: the ball must reach the rail line inside the mouth width.
export const POCKETS = Object.freeze([
  { id: "tl", kind: "corner", x: -0.27, y: -0.27, r: 1.72 },
  { id: "tr", kind: "corner", x: TABLE_W + 0.27, y: -0.27, r: 1.72 },
  { id: "bl", kind: "corner", x: -0.27, y: TABLE_H + 0.27, r: 1.72 },
  { id: "br", kind: "corner", x: TABLE_W + 0.27, y: TABLE_H + 0.27, r: 1.72 },
  { id: "mt", kind: "middle", x: TABLE_W / 2, y: MIN_Y, mouth: 1.29 },
  { id: "mb", kind: "middle", x: TABLE_W / 2, y: MAX_Y, mouth: 1.29 },
]);

export const SPINS = Object.freeze(["center", "follow", "draw", "side"]);

// ---------------------------------------------------------------- PRNG ----

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng, min, max) {
  return min + rng() * (max - min);
}

export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function shuffled(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// ------------------------------------------------------------ fixtures ----

export function makeBall(number, x, y) {
  const kind = number === 0 ? "cue" : number === 8 ? "eight" : number < 8 ? "solid" : "stripe";
  return {
    id: number,
    number,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    rvx: 0,
    rvy: 0,
    potted: false,
    side: 0,
  };
}

export function createWorld(balls, options = {}) {
  return {
    balls: balls.map((b) => ({ ...makeBall(b.number, b.x, b.y), ...b, vx: 0, vy: 0, rvx: 0, rvy: 0 })),
    time: 0,
    acc: 0,
    steps: 0,
    events: [],
    seed: options.seed ?? 0,
  };
}

export function cloneWorld(world) {
  return {
    balls: world.balls.map((b) => ({ ...b })),
    time: world.time,
    acc: 0,
    steps: world.steps,
    events: [],
    seed: world.seed,
  };
}

export function cueBall(world) {
  return world.balls.find((b) => b.kind === "cue") ?? null;
}

export function liveBalls(world) {
  return world.balls.filter((b) => !b.potted);
}

/** Rack in the classic triangle apex-first order, 8 on the middle spot. */
export function rackPositions(gap = BALL_R * 2) {
  const rowGap = gap * Math.sqrt(3) / 2;
  const slots = [];
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col <= row; col += 1) {
      slots.push({
        row,
        col,
        x: FOOT_SPOT_X + row * rowGap,
        y: CENTER_Y + (col - row / 2) * gap,
      });
    }
  }
  return slots;
}

export const APEX_SLOT = 0;
export const CENTRE_SLOT = 4;
export const CORNER_SLOTS = Object.freeze([10, 14]);

/** Standard 8-ball rack: apex on the foot spot, 8 dead centre, corners split. */
export function buildRack(seed) {
  const rng = mulberry32(seed);
  const pool = shuffled(rng, [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15]);
  const free = [];
  for (let i = 0; i < 15; i += 1) if (i !== CENTRE_SLOT) free.push(i);
  const order = new Array(15).fill(0);
  order[CENTRE_SLOT] = 8;
  for (let i = 0; i < free.length; i += 1) order[free[i]] = pool[i];
  // Tradition: the two back corners are one solid and one stripe.
  const isSolid = (n) => n > 0 && n < 8;
  if (isSolid(order[CORNER_SLOTS[0]]) === isSolid(order[CORNER_SLOTS[1]])) {
    for (let i = 0; i < 15; i += 1) {
      if (i === CENTRE_SLOT || CORNER_SLOTS.includes(i)) continue;
      if (isSolid(order[i]) !== isSolid(order[CORNER_SLOTS[0]])) {
        const swap = order[i];
        order[i] = order[CORNER_SLOTS[1]];
        order[CORNER_SLOTS[1]] = swap;
        break;
      }
    }
  }
  const balls = [makeBall(0, HEAD_STRING_X, CENTER_Y)];
  const slots = rackPositions();
  for (let i = 0; i < slots.length; i += 1) {
    const num = order[i];
    if (!num) continue;
    balls.push(makeBall(num, slots[i].x, slots[i].y));
  }
  return balls;
}

// ------------------------------------------------------------ geometry ----

export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function inBounds(x, y, pad = 0) {
  return x >= MIN_X + pad && x <= MAX_X - pad && y >= MIN_Y + pad && y <= MAX_Y - pad;
}

export function overlapsAny(balls, x, y, ignore = null, clearance = 0) {
  for (const b of balls) {
    if (b.potted || b === ignore) continue;
    if (Math.hypot(b.x - x, b.y - y) < BALL_R * 2 + clearance) return true;
  }
  return false;
}

export function insidePocketMouth(x, y, pad = 0) {
  for (const p of POCKETS) {
    if (p.kind === "corner") continue;
    if (Math.abs(x - p.x) <= p.mouth + pad && Math.abs(y - p.y) <= 0.6 + pad) return true;
  }
  return false;
}

/** First obstacle met by the cue ball travelling along `angle` from its centre. */
export function traceShot(world, angle, options = {}) {
  const cue = cueBall(world);
  if (!cue || cue.potted) return null;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const maxDist = options.maxDist ?? 200;
  let best = null;

  for (const b of world.balls) {
    if (b.potted || b === cue) continue;
    const ex = b.x - cue.x;
    const ey = b.y - cue.y;
    const proj = ex * dx + ey * dy;
    if (proj <= 0) continue;
    const perp2 = ex * ex + ey * ey - proj * proj;
    const rad = BALL_R * 2;
    if (perp2 > rad * rad) continue;
    const back = Math.sqrt(rad * rad - perp2);
    const t = proj - back;
    if (t < 0 || t > maxDist) continue;
    if (!best || t < best.dist) {
      best = {
        type: "ball",
        dist: t,
        x: cue.x + dx * t,
        y: cue.y + dy * t,
        ball: b,
      };
    }
  }

  // rail hit distance
  let railDist = Infinity;
  if (Math.abs(dx) > 1e-9) {
    const t1 = (dx > 0 ? MAX_X - cue.x : MIN_X - cue.x) / dx;
    if (t1 > 0) railDist = Math.min(railDist, t1);
  }
  if (Math.abs(dy) > 1e-9) {
    const t2 = (dy > 0 ? MAX_Y - cue.y : MIN_Y - cue.y) / dy;
    if (t2 > 0) railDist = Math.min(railDist, t2);
  }
  if (railDist > maxDist) railDist = Infinity;
  const railHit = Number.isFinite(railDist)
    ? { type: "rail", dist: railDist, x: cue.x + dx * railDist, y: cue.y + dy * railDist, ball: null }
    : null;
  if (!best) return railHit;
  if (railHit && railHit.dist < best.dist) return railHit;
  return best;
}

/** Ghost-ball centre for a straight full hit, used by the aim assist. */
export function ghostBallAt(world, angle) {
  const hit = traceShot(world, angle);
  if (!hit || hit.type !== "ball") return null;
  return { x: hit.x, y: hit.y, target: hit.ball };
}

// ------------------------------------------------------------- physics ----

function clampSpeed(ball) {
  const sp = Math.hypot(ball.vx, ball.vy);
  if (sp > PHYS.maxSpeed) {
    const k = PHYS.maxSpeed / sp;
    ball.vx *= k;
    ball.vy *= k;
  }
  const roll = Math.hypot(ball.rvx, ball.rvy);
  if (roll > PHYS.maxSpeed) {
    const k = PHYS.maxSpeed / roll;
    ball.rvx *= k;
    ball.rvy *= k;
  }
}

/** Sliding / rolling friction only: updates linear and rolling velocity. */
function applyFriction(ball, dt) {
  if (ball.side) {
    ball.side *= Math.max(0, 1 - PHYS.sideDecay * dt);
    if (Math.abs(ball.side) < 0.01) ball.side = 0;
  }
  const ux = ball.vx - ball.rvx;
  const uy = ball.vy - ball.rvy;
  const u = Math.hypot(ux, uy);
  if (u > PHYS.slideEps) {
    const dirx = ux / u;
    const diry = uy / u;
    // Sliding friction: |dv| = mu*g*dt, |dRoll| = 2.5 * |dv| toward v,
    // so u shrinks at 3.5 * mu * g and the pair converges on pure rolling.
    const step = Math.min(PHYS.slideDecel * dt, u / 3.5);
    ball.vx -= dirx * step;
    ball.vy -= diry * step;
    ball.rvx += dirx * step * 2.5;
    ball.rvy += diry * step * 2.5;
  } else {
    ball.rvx = ball.vx;
    ball.rvy = ball.vy;
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > 0) {
      const dv = Math.min(sp, PHYS.rollDecel * dt);
      ball.vx -= (ball.vx / sp) * dv;
      ball.vy -= (ball.vy / sp) * dv;
      ball.rvx = ball.vx;
      ball.rvy = ball.vy;
    }
  }
  clampSpeed(ball);
}

function advanceBall(ball, h) {
  ball.x += ball.vx * h;
  ball.y += ball.vy * h;
}

function settleIfStopped(ball) {
  const sp = Math.hypot(ball.vx, ball.vy);
  const roll = Math.hypot(ball.rvx, ball.rvy);
  if (sp < PHYS.stopEps && roll < PHYS.stopEps) {
    ball.vx = 0;
    ball.vy = 0;
    ball.rvx = 0;
    ball.rvy = 0;
  }
}

function pushEvent(world, event) {
  world.events.push(event);
  if (world.events.length > 96) world.events.splice(0, world.events.length - 96);
}

/** Corner jaws also swallow a ball rolling along the cushion into the corner. */
function inCornerMouth(pocket, x, y) {
  const left = pocket.x < TABLE_W / 2;
  const top = pocket.y < TABLE_H / 2;
  const alongRailX = Math.abs(x - (left ? MIN_X : MAX_X));
  const alongRailY = Math.abs(y - (top ? MIN_Y : MAX_Y));
  if (alongRailX <= CORNER_MOUTH && (top ? y <= MIN_Y + 0.45 : y >= MAX_Y - 0.45)) return true;
  if (alongRailY <= CORNER_MOUTH && (left ? x <= MIN_X + 0.45 : x >= MAX_X - 0.45)) return true;
  return false;
}

function capturePockets(world) {
  for (const ball of world.balls) {
    if (ball.potted) continue;
    let captured = false;
    for (const p of POCKETS) {
      if (p.kind === "corner") {
        if (Math.hypot(ball.x - p.x, ball.y - p.y) <= p.r) captured = true;
        else if (inCornerMouth(p, ball.x, ball.y)) captured = true;
      } else if (Math.abs(ball.x - p.x) <= p.mouth) {
        const near = p.y <= MIN_Y ? ball.y <= MIN_Y + 0.18 : ball.y >= MAX_Y - 0.18;
        if (near) captured = true;
      }
      if (captured) break;
    }
    if (!captured) continue;
    ball.potted = true;
    ball.vx = 0;
    ball.vy = 0;
    ball.rvx = 0;
    ball.rvy = 0;
    ball.x = Math.min(MAX_X, Math.max(MIN_X, ball.x));
    ball.y = Math.min(MAX_Y, Math.max(MIN_Y, ball.y));
    pushEvent(world, { type: "pocket", id: ball.id, kind: ball.kind, x: ball.x, y: ball.y });
  }
}

function resolveRails(world, ball) {
  let hit = 0;
  let speed = 0;
  if (ball.x < MIN_X) {
    ball.x = MIN_X;
    if (ball.vx < 0) {
      speed = Math.abs(ball.vx);
      ball.vx = -ball.vx * PHYS.railRestitution;
      ball.vy *= PHYS.railFriction;
      ball.rvx = -ball.rvx * PHYS.railSpinNormal;
      ball.rvy *= PHYS.railSpinTangent;
      hit = 1;
    }
  } else if (ball.x > MAX_X) {
    ball.x = MAX_X;
    if (ball.vx > 0) {
      speed = Math.abs(ball.vx);
      ball.vx = -ball.vx * PHYS.railRestitution;
      ball.vy *= PHYS.railFriction;
      ball.rvx = -ball.rvx * PHYS.railSpinNormal;
      ball.rvy *= PHYS.railSpinTangent;
      hit = 1;
    }
  }
  if (ball.y < MIN_Y) {
    ball.y = MIN_Y;
    if (ball.vy < 0) {
      speed = Math.max(speed, Math.abs(ball.vy));
      ball.vy = -ball.vy * PHYS.railRestitution;
      ball.vx *= PHYS.railFriction;
      ball.rvy = -ball.rvy * PHYS.railSpinNormal;
      ball.rvx *= PHYS.railSpinTangent;
      hit = 1;
    }
  } else if (ball.y > MAX_Y) {
    ball.y = MAX_Y;
    if (ball.vy > 0) {
      speed = Math.max(speed, Math.abs(ball.vy));
      ball.vy = -ball.vy * PHYS.railRestitution;
      ball.vx *= PHYS.railFriction;
      ball.rvy = -ball.rvy * PHYS.railSpinNormal;
      ball.rvx *= PHYS.railSpinTangent;
      hit = 1;
    }
  }
  if (hit) {
    pushEvent(world, { type: "rail", id: ball.id, speed });
    applySideKick(ball);
  }
}

/**
 * English bites at the cushion: the outgoing direction is rotated in a fixed
 * sense (right english widens, left english narrows) and the spin bleeds off.
 */
function applySideKick(ball) {
  if (!ball.side) return;
  const sp = Math.hypot(ball.vx, ball.vy);
  if (sp > 1e-6) {
    const rot = ball.side * PHYS.sideRailKick;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const vx = ball.vx * cos - ball.vy * sin;
    const vy = ball.vx * sin + ball.vy * cos;
    ball.vx = vx;
    ball.vy = vy;
  }
  ball.side *= PHYS.sideRailKeep;
}

function resolveBallPair(world, a, b, order) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let d = Math.hypot(dx, dy);
  if (d === 0) {
    dx = 0.001;
    dy = 0;
    d = 0.001;
  }
  if (d > BALL_R * 2 + 1e-6) return false;
  const nx = dx / d;
  const ny = dy / d;
  const overlap = BALL_R * 2 - d;
  if (overlap > 0) {
    const push = overlap / 2 + 1e-6;
    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;
  }
  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn > 0) return false;
  const j = (-(1 + PHYS.ballRestitution) * vn) / 2;
  a.vx -= j * nx;
  a.vy -= j * ny;
  b.vx += j * nx;
  b.vy += j * ny;
  // Contact slightly bleeds rotation into the table, spin itself persists.
  a.rvx *= 0.995;
  a.rvy *= 0.995;
  b.rvx *= 0.995;
  b.rvy *= 0.995;
  pushEvent(world, {
    type: "clack", a: a.id, b: b.id, speed: Math.abs(vn), order,
    x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
  });
  return true;
}

function maxStepDistance(world) {
  let best = 0;
  for (const b of world.balls) {
    if (b.potted) continue;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > best) best = sp;
  }
  return best * PHYS.dt;
}

/**
 * Earliest contact inside a slice. Solves |p + v t| = 2R for every pair so a
 * collision lands exactly on the contact geometry instead of being detected
 * one discrete hop late - that late detection is what makes long pots slip.
 */
function earliestImpact(world, horizon) {
  const list = [];
  for (const ball of world.balls) if (!ball.potted) list.push(ball);
  const rad = BALL_R * 2;
  let best = null;
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      const px = b.x - a.x;
      const py = b.y - a.y;
      const vx = b.vx - a.vx;
      const vy = b.vy - a.vy;
      const c = px * px + py * py - rad * rad;
      const bDot = px * vx + py * vy;
      // Separating pairs never need an impulse, even while still touching.
      if (bDot >= 0) continue;
      let t = 0;
      if (c > 0) {
        const a2 = vx * vx + vy * vy;
        if (a2 < 1e-12) continue;
        const disc = bDot * bDot - a2 * c;
        if (disc < 0) continue;
        t = (-bDot - Math.sqrt(disc)) / a2;
        if (t > horizon) continue;
      }
      if (t < 0) t = 0;
      if (!best || t < best.t) best = { a, b, t };
    }
  }
  return best;
}

/**
 * Relax every contact present at this instant. A rack is a cluster of touching
 * balls: resolving one pair at a time turns the break into a Newton's cradle,
 * so all contacts are swept repeatedly until the impulse has spread.
 */
function resolveContacts(world) {
  let exchanged = false;
  for (let pass = 0; pass < 10; pass += 1) {
    let touched = false;
    const list = [];
    for (const ball of world.balls) if (!ball.potted) list.push(ball);
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        if (resolveBallPair(world, list[i], list[j], world.steps)) touched = true;
      }
    }
    if (!touched) break;
    exchanged = true;
  }
  return exchanged;
}

function subStep(world, dt) {
  const speedMax = maxStepDistance(world);
  const divisions = Math.max(1, Math.min(PHYS.maxSubSteps, Math.ceil(speedMax / (BALL_R * 0.5))));
  const slice = dt / divisions;
  for (let i = 0; i < divisions; i += 1) {
    for (const ball of world.balls) {
      if (ball.potted) continue;
      applyFriction(ball, slice);
    }
    let remaining = slice;
    let guards = 0;
    while (remaining > 1e-9 && guards < 8) {
      guards += 1;
      const hit = earliestImpact(world, remaining);
      if (!hit) {
        for (const ball of world.balls) if (!ball.potted) advanceBall(ball, remaining);
        remaining = 0;
        break;
      }
      if (hit.t > 1e-9) {
        for (const ball of world.balls) if (!ball.potted) advanceBall(ball, hit.t);
        remaining -= hit.t;
      }
      if (!resolveContacts(world)) {
        // Grazing touch with no exchange: spend the rest of the slice moving.
        for (const ball of world.balls) if (!ball.potted) advanceBall(ball, remaining);
        remaining = 0;
      }
    }
    for (const ball of world.balls) {
      if (ball.potted) continue;
      resolveRails(world, ball);
    }
    capturePockets(world);
    for (const ball of world.balls) {
      if (ball.potted) continue;
      settleIfStopped(ball);
    }
  }
  world.steps += 1;
  world.time += dt;
}

/** True while any ball retains motion intent. */
export function isMoving(world) {
  for (const b of world.balls) {
    if (b.potted) continue;
    if (b.vx !== 0 || b.vy !== 0 || b.rvx !== 0 || b.rvy !== 0) return true;
  }
  return false;
}

export function totalEnergy(world) {
  let sum = 0;
  for (const b of world.balls) {
    if (b.potted) continue;
    sum += Math.hypot(b.vx, b.vy) ** 2 + Math.hypot(b.rvx, b.rvy) ** 2;
  }
  return sum;
}

/** Advance the world by wall-clock seconds using the fixed physics step. */
export function stepWorld(world, seconds) {
  world.acc += Math.min(Math.max(seconds, 0), 0.25);
  let done = 0;
  while (world.acc >= PHYS.dt && done < PHYS.maxStepsPerFrame) {
    subStep(world, PHYS.dt);
    world.acc -= PHYS.dt;
    done += 1;
    if (!isMoving(world)) {
      world.acc = 0;
      break;
    }
  }
  return done;
}

/** Run to rest (headless), returning the collected events. */
export function settle(world, maxFrames = 6000) {
  let frames = 0;
  while (isMoving(world) && frames < maxFrames) {
    stepWorld(world, PHYS.dt);
    frames += 1;
  }
  return { frames, rest: !isMoving(world) };
}

export function strikePowerToSpeed(power) {
  const p = Math.min(1, Math.max(0, power));
  return PHYS.minShotSpeed + (PHYS.maxShotSpeed - PHYS.minShotSpeed) * p;
}

/** Apply a shot to the cue ball. Pure state mutation, deterministic. */
export function strike(world, angle, power, spin = "center", ballId = 0) {
  const cue = ballId === 0 ? cueBall(world) : world.balls.find((b) => b.id === ballId);
  if (!cue || cue.potted) return false;
  const speed = strikePowerToSpeed(power);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  cue.vx = dx * speed;
  cue.vy = dy * speed;
  if (spin === "follow") {
    cue.rvx = dx * speed * 1.5;
    cue.rvy = dy * speed * 1.5;
  } else if (spin === "draw") {
    cue.rvx = -dx * speed * 1.0;
    cue.rvy = -dy * speed * 1.0;
  } else if (spin === "side") {
    cue.side = PHYS.sidePower;
    cue.rvx = dx * speed * 0.55;
    cue.rvy = dy * speed * 0.55;
  } else {
    cue.rvx = 0;
    cue.rvy = 0;
    cue.side = 0;
  }
  pushEvent(world, { type: "strike", power, spin });
  return true;
}

/** Place a ball legally during ball-in-hand. Returns false when illegal. */
export function placeBall(world, ballId, x, y) {
  const ball = world.balls.find((b) => b.id === ballId);
  if (!ball || ball.potted) return false;
  const nx = Math.min(MAX_X, Math.max(MIN_X, x));
  const ny = Math.min(MAX_Y, Math.max(MIN_Y, y));
  if (!inBounds(nx, ny)) return false;
  if (insidePocketMouth(nx, ny, 0.3)) return false;
  if (overlapsAny(world.balls, nx, ny, ball, 0.02)) return false;
  ball.x = nx;
  ball.y = ny;
  ball.vx = 0;
  ball.vy = 0;
  ball.rvx = 0;
  ball.rvy = 0;
  return true;
}
