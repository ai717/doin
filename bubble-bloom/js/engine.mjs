// filepath: games/bubble-bloom/js/engine.mjs

// 核心规则与连续物理：纯逻辑、DOM-free、可注入种子、固定步长可重放。

import { BLOOM_BONUS, mergeScore } from "./score.mjs?v=35ad794d8cf9";

export const WORLD = { width: 480, height: 720 };

export const WALL_LEFT = 0;
export const WALL_RIGHT = WORLD.width;
export const FLOOR_Y = WORLD.height;
export const CEIL_Y = 0;

export const WARN_Y = 96;
export const DROP_Y = 44;

export const STEP = 1 / 120;
export const MAX_SUBSTEPS = 8;
export const MAX_FRAME_DT = 0.1;

export const GRAVITY = 1600;
export const RESTITUTION = 0.12;
export const WALL_RESTITUTION = 0.2;
export const AIR_DRAG = 0.9992;
export const FLOOR_FRICTION = 0.86;
export const TANGENT_FRICTION = 0.12;
export const POSITION_RELAX = 0.8;
export const SOLVER_ITERATIONS = 3;
export const REST_SPEED = 18;

export const CONTACT_EPS = 1.5;
export const MERGE_DELAY = 0.12;
export const CHAIN_WINDOW = 1.2;
export const WARN_GRACE = 1.25;

export const PULSE_MAX = 2;
export const PULSE_COOLDOWN = 6;
export const PULSE_PUSH = 90;
export const PULSE_LIFT = 40;

export const TIER_COUNT = 10;
export const TIER_RADIUS = [18, 24, 31, 39, 48, 58, 69, 81, 94, 108];

export const SPAWN_BAG = [1, 1, 2, 2, 3, 3, 4, 4];
export const SPAWN_PREAMBLE = [1, 1, 2];
export const MAX_SPAWN_TIER = 4;

// 彩虹绽放除了双王，额外净化这一阶及以下的所有泡。
export const BLOOM_CLEAR_TIER = 3;

export const PHASE = {
  ready: "ready",
  playing: "playing",
  paused: "paused",
  over: "over"
};

export function tierRadius(tier) {
  const index = Math.min(Math.max(Math.round(tier), 1), TIER_COUNT) - 1;
  return TIER_RADIUS[index];
}

export function hashSeed(text) {
  const str = String(text == null ? "" : text);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let state = (Number.isFinite(seed) ? Math.floor(seed) : 0) >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nextRandom(state) {
  state.rngState = (state.rngState + 0x6d2b79f5) >>> 0;
  let t = state.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function refillQueue(state) {
  const bag = SPAWN_BAG.slice();
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextRandom(state) * (i + 1));
    const tmp = bag[i];
    bag[i] = bag[j];
    bag[j] = tmp;
  }
  for (let i = 0; i < bag.length; i += 1) state.queue.push(bag[i]);
}

function takeTier(state) {
  if (!state.queue.length) refillQueue(state);
  return state.queue.shift();
}

function makeBubble(state, tier, x, y) {
  state.nextId += 1;
  return {
    id: state.nextId,
    tier,
    x,
    y,
    vx: 0,
    vy: 0,
    r: tierRadius(tier),
    landed: false,
    merging: false,
    born: state.time
  };
}

export function createState(options) {
  const opts = options && typeof options === "object" ? options : {};
  const mode = opts.mode === "daily" ? "daily" : "standard";
  const seed = Number.isFinite(opts.seed) ? Math.floor(opts.seed) >>> 0 : (Date.now() >>> 0);

  const state = {
    mode,
    seed,
    rngState: seed >>> 0,
    queue: SPAWN_PREAMBLE.slice(),
    current: 0,
    next: 0,
    aimX: WORLD.width / 2,
    bubbles: [],
    pending: [],
    phase: PHASE.ready,
    score: 0,
    drops: 0,
    maxTier: 0,
    maxChain: 0,
    chain: 0,
    chainTimer: 0,
    pulses: PULSE_MAX,
    pulseCooldown: 0,
    overTime: 0,
    danger: false,
    time: 0,
    accumulator: 0,
    nextId: 0,
    bloomed: false,
    events: [],
    result: null
  };

  refillQueue(state);
  state.current = takeTier(state);
  state.next = takeTier(state);
  state.aimX = clampAim(state, WORLD.width / 2);
  return state;
}

function clampAim(state, x) {
  const r = tierRadius(state.current || 1);
  const value = Number.isFinite(x) ? x : WORLD.width / 2;
  return Math.min(WALL_RIGHT - r, Math.max(WALL_LEFT + r, value));
}

function push(state, event) {
  state.events.push(event);
}

export function aimTo(state, x) {
  if (!state || state.phase !== PHASE.playing) return false;
  state.aimX = clampAim(state, x);
  return true;
}

export function nudgeAim(state, delta) {
  if (!state || state.phase !== PHASE.playing) return false;
  state.aimX = clampAim(state, state.aimX + (Number.isFinite(delta) ? delta : 0));
  return true;
}

export function begin(state) {
  if (!state || state.phase !== PHASE.ready) return false;
  state.phase = PHASE.playing;
  push(state, { type: "begin" });
  return true;
}

export function pause(state) {
  if (!state || state.phase !== PHASE.playing) return false;
  state.phase = PHASE.paused;
  push(state, { type: "pause" });
  return true;
}

export function resume(state) {
  if (!state || state.phase !== PHASE.paused) return false;
  state.phase = PHASE.playing;
  state.accumulator = 0;
  push(state, { type: "resume" });
  return true;
}

export function dropBubble(state) {
  if (!state || state.phase !== PHASE.playing) return false;
  const tier = state.current;
  if (!tier) return false;

  const bubble = makeBubble(state, tier, state.aimX, DROP_Y);
  bubble.vy = 60;
  state.bubbles.push(bubble);
  state.drops += 1;
  state.chain = 0;
  state.chainTimer = 0;
  state.current = state.next;
  state.next = takeTier(state);
  state.aimX = clampAim(state, state.aimX);
  push(state, { type: "drop", tier, x: bubble.x });
  return true;
}

export function usePulse(state) {
  if (!state || state.phase !== PHASE.playing) return false;
  if (state.pulses <= 0) return false;
  if (state.pulseCooldown > 0) return false;

  state.pulses -= 1;
  state.pulseCooldown = PULSE_COOLDOWN;
  for (let i = 0; i < state.bubbles.length; i += 1) {
    const b = state.bubbles[i];
    if (b.merging) continue;
    const row = Math.floor(b.y / 64);
    b.vx += (row % 2 === 0 ? 1 : -1) * PULSE_PUSH;
    b.vy -= PULSE_LIFT;
  }
  push(state, { type: "pulse", left: state.pulses });
  return true;
}

function clampBounds(b) {
  const r = b.r;
  if (b.x - r < WALL_LEFT) {
    b.x = WALL_LEFT + r;
    if (b.vx < 0) b.vx = -b.vx * WALL_RESTITUTION;
    b.landed = true;
  }
  if (b.x + r > WALL_RIGHT) {
    b.x = WALL_RIGHT - r;
    if (b.vx > 0) b.vx = -b.vx * WALL_RESTITUTION;
    b.landed = true;
  }
  if (b.y + r > FLOOR_Y) {
    b.y = FLOOR_Y - r;
    if (b.vy > 0) b.vy = -b.vy * RESTITUTION;
    if (Math.abs(b.vy) < REST_SPEED) b.vy = 0;
    b.vx *= FLOOR_FRICTION;
    b.landed = true;
  }
  if (b.y - r < CEIL_Y) {
    b.y = CEIL_Y + r;
    if (b.vy < 0) b.vy = 0;
  }
}

function resolvePairs(state) {
  const list = state.bubbles;
  for (let i = 0; i < list.length; i += 1) {
    const a = list[i];
    for (let j = i + 1; j < list.length; j += 1) {
      const b = list[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const rs = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rs * rs) continue;

      const d = Math.sqrt(d2);
      const nx = d < 0.0001 ? 0 : dx / d;
      const ny = d < 0.0001 ? -1 : dy / d;
      const pushOut = (rs - d) * 0.5 * POSITION_RELAX;
      a.x -= nx * pushOut;
      a.y -= ny * pushOut;
      b.x += nx * pushOut;
      b.y += ny * pushOut;

      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn < 0) {
        const impulse = (-(1 + RESTITUTION) * vn) * 0.5;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;

        const tx = -ny;
        const ty = nx;
        const vt = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty;
        const damp = vt * TANGENT_FRICTION * 0.5;
        a.vx += damp * tx;
        a.vy += damp * ty;
        b.vx -= damp * tx;
        b.vy -= damp * ty;
      }

      if (!a.merging) a.landed = true;
      if (!b.merging) b.landed = true;
    }
  }
}

function detectMerges(state) {
  const list = state.bubbles;
  for (let i = 0; i < list.length; i += 1) {
    const a = list[i];
    if (a.merging) continue;
    for (let j = i + 1; j < list.length; j += 1) {
      const b = list[j];
      if (b.merging || b.tier !== a.tier) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const reach = a.r + b.r + CONTACT_EPS;
      if (dx * dx + dy * dy > reach * reach) continue;
      a.merging = true;
      b.merging = true;
      state.pending.push({ a: a.id, b: b.id, tier: a.tier, t: MERGE_DELAY });
      break;
    }
  }
}

function findBubble(state, id) {
  for (let i = 0; i < state.bubbles.length; i += 1) {
    if (state.bubbles[i].id === id) return state.bubbles[i];
  }
  return null;
}

function removeBubble(state, bubble) {
  const index = state.bubbles.indexOf(bubble);
  if (index !== -1) state.bubbles.splice(index, 1);
}

function finishMerge(state, pair) {
  const a = findBubble(state, pair.a);
  const b = findBubble(state, pair.b);
  if (!a || !b) {
    if (a) a.merging = false;
    if (b) b.merging = false;
    return;
  }

  const x = (a.x + b.x) / 2;
  const y = (a.y + b.y) / 2;
  removeBubble(state, a);
  removeBubble(state, b);

  state.chain += 1;
  if (state.chain > state.maxChain) state.maxChain = state.chain;
  state.chainTimer = CHAIN_WINDOW;

  if (pair.tier >= TIER_COUNT) {
    let cleared = 0;
    for (let i = state.bubbles.length - 1; i >= 0; i -= 1) {
      const bubble = state.bubbles[i];
      if (bubble.tier <= BLOOM_CLEAR_TIER) {
        state.bubbles.splice(i, 1);
        cleared += 1;
      }
    }
    state.bloomed = true;
    state.score += BLOOM_BONUS;
    push(state, { type: "bloom", x, y, score: BLOOM_BONUS, chain: state.chain, cleared });
    return;
  }

  const tier = pair.tier + 1;
  const gained = mergeScore(tier, state.chain);
  state.score += gained;
  const bubble = makeBubble(state, tier, x, y);
  clampBounds(bubble);
  bubble.landed = true;
  state.bubbles.push(bubble);
  if (tier > state.maxTier) state.maxTier = tier;
  push(state, { type: "merge", tier, x, y, chain: state.chain, score: gained });
}

function updateTimers(state) {
  if (state.pulseCooldown > 0) state.pulseCooldown = Math.max(0, state.pulseCooldown - STEP);
  if (state.chainTimer > 0) {
    state.chainTimer -= STEP;
    if (state.chainTimer <= 0) state.chain = 0;
  }

  let over = false;
  for (let i = 0; i < state.bubbles.length; i += 1) {
    const b = state.bubbles[i];
    if (b.merging || !b.landed) continue;
    if (b.y - b.r < WARN_Y) {
      over = true;
      break;
    }
  }
  state.danger = over;
  if (over) state.overTime += STEP;
  else state.overTime = 0;

  if (state.overTime >= WARN_GRACE && state.phase === PHASE.playing) {
    state.phase = PHASE.over;
    state.result = buildResult(state);
    push(state, { type: "over", result: state.result });
  }
}

function substep(state) {
  const list = state.bubbles;

  for (let i = 0; i < list.length; i += 1) {
    const b = list[i];
    if (b.merging) continue;
    b.vy += GRAVITY * STEP;
    b.vx *= AIR_DRAG;
    b.vy *= AIR_DRAG;
    b.x += b.vx * STEP;
    b.y += b.vy * STEP;
  }

  for (let iter = 0; iter < SOLVER_ITERATIONS; iter += 1) {
    for (let i = 0; i < list.length; i += 1) {
      if (!list[i].merging) clampBounds(list[i]);
    }
    resolvePairs(state);
  }

  // 收尾再夹一次边界：配对解算可能把泡（含合成中的泡）挤出舱外
  for (let i = 0; i < list.length; i += 1) {
    clampBounds(list[i]);
  }

  detectMerges(state);

  for (let i = state.pending.length - 1; i >= 0; i -= 1) {
    const pair = state.pending[i];
    pair.t -= STEP;
    if (pair.t > 0) continue;
    state.pending.splice(i, 1);
    finishMerge(state, pair);
  }

  state.time += STEP;
  updateTimers(state);
}

export function step(state, dt) {
  if (!state || state.phase !== PHASE.playing) return state;
  const raw = Number.isFinite(dt) ? dt : 0;
  const frame = Math.min(Math.max(raw, 0), MAX_FRAME_DT);
  state.accumulator += frame;

  let count = 0;
  while (state.accumulator >= STEP && count < MAX_SUBSTEPS) {
    state.accumulator -= STEP;
    count += 1;
    substep(state);
    if (state.phase !== PHASE.playing) break;
  }
  if (count >= MAX_SUBSTEPS) state.accumulator = 0;
  return state;
}

export function drainEvents(state) {
  if (!state || !state.events.length) return [];
  const out = state.events.slice();
  state.events.length = 0;
  return out;
}

export function isPlaying(state) {
  return Boolean(state) && state.phase === PHASE.playing;
}

export function isOver(state) {
  return Boolean(state) && state.phase === PHASE.over;
}

export function buildResult(state) {
  if (!state) return null;
  return {
    mode: state.mode,
    seed: state.seed,
    score: state.score,
    maxTier: state.maxTier,
    maxChain: state.maxChain,
    drops: state.drops,
    bloomed: state.bloomed
  };
}

// 供渲染与 UI 读取：当前越过警戒线且已落定的泡数。
export function overLineCount(state) {
  if (!state) return 0;
  let count = 0;
  for (let i = 0; i < state.bubbles.length; i += 1) {
    const b = state.bubbles[i];
    if (b.merging || !b.landed) continue;
    if (b.y - b.r < WARN_Y) count += 1;
  }
  return count;
}

// 供渲染判断堆是否接近静止。
export function stackSpeed(state) {
  if (!state) return 0;
  let peak = 0;
  for (let i = 0; i < state.bubbles.length; i += 1) {
    const b = state.bubbles[i];
    if (b.merging) continue;
    const speed = Math.abs(b.vx) + Math.abs(b.vy);
    if (speed > peak) peak = speed;
  }
  return peak;
}
