// engine.mjs — 是男人就下一百层（shaft）物理与规则的唯一权威。
// 铁律：DOM-free，不引用 document / window / localStorage；node:test 可直接驱动。
// 时序：固定步长 stepFrame(state, dt)，所有移动、碰撞、滚屏与掉血均可重放。

import { floorsPoints, lifePoints } from "./score.mjs";

/* ============================================================
 * 1 · 视窗、机身与手感常量
 * ==========================================================*/
export const VIEW_W = 420;
export const VIEW_H = 680;
export const CEILING_H = 46;
export const PLAYER_W = 26;
export const PLAYER_H = 34;
export const WALL_L = 20;
export const WALL_R = 400;
export const START_Y = 210;
export const SPACING = 110;
export const PLATFORM_H = 14;

export const GRAVITY = 980;
export const FALL_MAX = 600;
export const DIVE_ACCEL = 620;
export const DIVE_MAX = 880;
export const MOVE_MAX = 236;
export const MOVE_ACCEL = 980;
export const AIR_DRAG = 520;
export const GROUND_FRICTION = 1500;
export const WALL_BOUNCE = 0.35;

export const SPRING_POWER = 500;
export const CONVEYOR_ACCEL = 620;
export const CRUMBLE_DELAY = 0.25;
export const MAX_HP = 12;
export const SPIKE_DAMAGE = 5;
export const CEILING_DPS = 10;
export const HEAL_AMOUNT = 1;

export const SCROLL_ACCEL = 30;
export const MAX_STEP = 1 / 30;
export const VOID_MARGIN = 60;
export const MAX_EVENTS = 120;

export const PLATFORM_TYPES = ["normal", "spring", "spike", "conveyorL", "conveyorR", "crumble", "goal", "start"];

/* ============================================================
 * 2 · 确定性 PRNG（mulberry32 + FNV-1a）
 * ==========================================================*/
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ============================================================
 * 3 · 状态构造与平台生成
 * ==========================================================*/
function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function configOf(raw = {}) {
  const weights = raw.weights && typeof raw.weights === "object" ? raw.weights : { normal: 100 };
  const safeWeights = {};
  let total = 0;
  for (const key of ["normal", "spring", "spike", "conveyorL", "conveyorR", "crumble"]) {
    const value = Math.max(0, num(weights[key], 0));
    safeWeights[key] = value;
    total += value;
  }
  if (total <= 0) safeWeights.normal = 100;
  return {
    mode: typeof raw.mode === "string" ? raw.mode : "campaign",
    level: Math.max(0, Math.round(num(raw.level, 0))),
    seed: num(raw.seed, 1) >>> 0,
    goalFloors: Math.max(0, Math.round(num(raw.goalFloors, 0))),
    scrollSpeed: Math.max(20, num(raw.scrollSpeed, 50)),
    speedMax: Math.max(20, num(raw.speedMax, 140)),
    speedRamp: Math.max(0, num(raw.speedRamp, 0.3)),
    width: Math.min(140, Math.max(56, num(raw.width, 90))),
    maxDrift: Math.min(150, Math.max(40, num(raw.maxDrift, 108))),
    safeCount: Math.min(12, Math.max(0, Math.round(num(raw.safeCount, 4)))),
    gapBase: Math.min(150, Math.max(90, num(raw.gapBase, 110))),
    gapJitter: Math.min(30, Math.max(0, num(raw.gapJitter, 16))),
    maxHp: Math.min(30, Math.max(3, Math.round(num(raw.maxHp, MAX_HP)))),
    parTime: Math.max(0, num(raw.parTime, 0)),
    weights: safeWeights,
  };
}

export function makePlatform(id, worldY, x, width, type, dir = 0) {
  return {
    id,
    worldY,
    x,
    width,
    type,
    dir,
    broken: false,
    breaking: false,
    breakTimer: 0,
    healed: type !== "normal",
    landed: false,
  };
}

export function createState(raw = {}) {
  const config = configOf(raw);
  const rng = mulberry32(config.seed);
  const start = makePlatform(0, START_Y, VIEW_W / 2, 132, "normal");
  start.healed = true;

  const state = {
    config,
    seed: config.seed,
    rng,
    time: 0,
    elapsed: 0,
    phase: "playing",
    ended: false,
    endReason: "",
    scrollY: 0,
    scrollSpeed: 0,
    depth: 0,
    maxDepth: 0,
    score: 0,
    player: {
      x: VIEW_W / 2,
      y: START_Y,
      vx: 0,
      vy: 0,
      hp: config.maxHp,
      maxHp: config.maxHp,
      grounded: 0,
      facing: 1,
      squashX: 1,
      squashY: 1,
      hurt: 0,
      dive: false,
      ceiling: false,
      dropId: null,
      dropTimer: 0,
    },
    input: { left: false, right: false, dive: false },
    platforms: [start],
    nextWorldY: START_Y,
    nextId: 1,
    lastType: "start",
    initialSafe: config.safeCount,
    goalPlaced: false,
    goalWorldY: config.goalFloors > 0 ? START_Y + config.goalFloors * SPACING : 0,
    overheated: false,
    ceilingTick: 0,
    stats: { lands: 0, heals: 0, spikes: 0, springs: 0, crumbles: 0, ceiling: 0 },
    events: [],
  };

  state.nextWorldY = START_Y + gapFor(state);
  ensurePlatforms(state, START_Y + VIEW_H + SPACING * 2);
  return state;
}

function gapFor(state) {
  const cfg = state.config;
  const jitter = cfg.gapJitter > 0 ? (state.rng() * 2 - 1) * cfg.gapJitter : 0;
  return Math.min(140, Math.max(88, cfg.gapBase + jitter));
}

function widthFor(state, type) {
  const cfg = state.config;
  const jitter = (state.rng() * 2 - 1) * 6;
  let width = cfg.width + jitter;
  if (type === "spring") width -= 8;
  else if (type === "crumble") width -= 8;
  else if (type === "spike") width -= 4;
  else if (type === "conveyorL" || type === "conveyorR") width += 6;
  return Math.min(132, Math.max(52, Math.round(width)));
}

function pickType(state) {
  const w = state.config.weights;
  const keys = ["normal", "spring", "spike", "conveyorL", "conveyorR", "crumble"];
  let total = 0;
  for (const key of keys) total += w[key] || 0;
  let roll = state.rng() * total;
  let picked = "normal";
  for (const key of keys) {
    roll -= w[key] || 0;
    if (roll <= 0) {
      picked = key;
      break;
    }
  }
  // 成熟范式约束：不连续尖刺、不连续碎裂、不连续弹簧，避免必死墙与无限弹射
  if (picked === "spike" && state.lastType === "spike") picked = "normal";
  if (picked === "crumble" && state.lastType === "crumble") picked = "normal";
  if (picked === "spring" && state.lastType === "spring") picked = "normal";
  return picked;
}

function ensurePlatforms(state, horizon) {
  let guard = 0;
  while (state.nextWorldY < horizon && guard < 80) {
    guard += 1;
    const cfg = state.config;
    if (cfg.goalFloors > 0 && !state.goalPlaced && state.nextWorldY >= state.goalWorldY - SPACING) {
      const goal = makePlatform(state.nextId, state.nextWorldY, VIEW_W / 2, 260, "goal");
      state.platforms.push(goal);
      state.nextId += 1;
      state.goalPlaced = true;
      state.goalWorldY = state.nextWorldY;
      state.lastType = "goal";
      state.nextWorldY += gapFor(state);
      break;
    }
    spawnPlatform(state);
    if (state.goalPlaced) break;
  }
}

function spawnPlatform(state) {
  const cfg = state.config;
  const safe = state.initialSafe > 0;
  const type = safe ? "normal" : pickType(state);
  const width = safe ? Math.max(96, cfg.width + 6) : widthFor(state, type);
  const drift = safe ? Math.min(46, cfg.maxDrift) : cfg.maxDrift;
  const prev = state.platforms[state.platforms.length - 1] || { x: VIEW_W / 2 };
  const minX = WALL_L + width / 2 + 6;
  const maxX = WALL_R - width / 2 - 6;
  let x = prev.x + (state.rng() * 2 - 1) * drift;
  x = Math.min(maxX, Math.max(minX, x));

  const platform = makePlatform(
    state.nextId,
    state.nextWorldY,
    x,
    width,
    type,
    type === "conveyorL" ? -1 : type === "conveyorR" ? 1 : 0
  );
  state.nextId += 1;
  state.platforms.push(platform);
  state.lastType = type;
  if (state.initialSafe > 0) state.initialSafe -= 1;
  state.nextWorldY += gapFor(state);
  return platform;
}

/** 供关卡可解性审计使用：按同一生成器铺出 count 块平台（含起始台）。 */
export function buildRoute(rawConfig, count = 120) {
  const state = createState(rawConfig);
  let guard = 0;
  while (state.platforms.length < count && !state.goalPlaced && guard < 400) {
    ensurePlatforms(state, state.nextWorldY + 1);
    guard += 1;
  }
  return state.platforms.map((p) => ({ ...p }));
}

/* ============================================================
 * 4 · 玩家意图（合法意图执行，非法意图静默返回 null）
 * ==========================================================*/
export function setInput(state, patch = {}) {
  if (!state || state.phase !== "playing") return null;
  const input = state.input;
  const out = {};
  if (typeof patch.left === "boolean" && patch.left !== input.left) {
    input.left = patch.left;
    out.left = patch.left;
    if (patch.left) {
      input.right = false;
      out.right = false;
    }
    pushEvent(state, { type: patch.left ? "move-on" : "move-off", dir: -1 });
  }
  if (typeof patch.right === "boolean" && patch.right !== input.right) {
    input.right = patch.right;
    out.right = patch.right;
    if (patch.right) {
      input.left = false;
      out.left = false;
    }
    pushEvent(state, { type: patch.right ? "move-on" : "move-off", dir: 1 });
  }
  if (typeof patch.dive === "boolean" && patch.dive !== input.dive) {
    input.dive = patch.dive;
    out.dive = patch.dive;
    pushEvent(state, { type: patch.dive ? "dive-on" : "dive-off" });
  }
  return out;
}

export function releaseAll(state) {
  if (!state) return null;
  return setInput(state, { left: false, right: false, dive: false });
}

export function pushEvent(state, event) {
  state.events.push(event);
  if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
}

export function drainEvents(state) {
  const out = state.events.slice();
  state.events.length = 0;
  return out;
}

/* ============================================================
 * 5 · 固定步长推进
 * ==========================================================*/
export function platformScreenY(state, platform) {
  return platform.worldY - state.scrollY;
}

export function playerScreenY(state) {
  return state.player.y - state.scrollY;
}

export function goalProgress(state) {
  const goal = state.config.goalFloors;
  if (goal <= 0) return 0;
  return Math.min(1, state.depth / goal);
}

export function radarScan(state) {
  if (!state) return null;
  const p = state.player;
  let best = null;
  for (const platform of state.platforms) {
    if (platform.broken) continue;
    const dy = platform.worldY - p.y;
    if (dy < 24) continue;
    if (!best || platform.worldY < best.worldY) best = platform;
  }
  if (!best) return null;
  return {
    id: best.id,
    type: best.type,
    width: best.width,
    distance: Math.round(best.worldY - p.y),
    screenY: Math.round(platformScreenY(state, best)),
  };
}

export function stepFrame(state, dt) {
  const step = Math.max(0, Math.min(MAX_STEP, num(dt, 0)));
  if (!state) return [];
  state.time += step;
  if (state.phase !== "playing") return state.events;

  state.elapsed += step;
  updateScroll(state, step);
  updatePlatformTimers(state, step);
  ensurePlatforms(state, Math.max(state.scrollY + VIEW_H + SPACING * 2, state.player.y + VIEW_H));
  updatePlayer(state, step);
  prunePlatforms(state);
  updateScore(state);
  checkDepth(state);
  return state.events;
}

function updateScroll(state, dt) {
  const cfg = state.config;
  const extra = Math.min(cfg.speedMax - cfg.scrollSpeed, Math.max(0, state.depth) * cfg.speedRamp);
  const target = Math.max(0, cfg.scrollSpeed + extra);
  const delta = target - state.scrollSpeed;
  state.scrollSpeed += Math.sign(delta) * Math.min(Math.abs(delta), SCROLL_ACCEL * dt);
  state.scrollY += state.scrollSpeed * dt;
}

function updatePlatformTimers(state, dt) {
  for (const platform of state.platforms) {
    if (!platform.breaking || platform.broken) continue;
    platform.breakTimer -= dt;
    if (platform.breakTimer <= 0) {
      platform.broken = true;
      platform.breaking = false;
      state.stats.crumbles += 1;
      pushEvent(state, { type: "collapse", platformId: platform.id, x: platform.x, y: platform.worldY - state.scrollY });
      if (state.player.grounded === platform.id) state.player.grounded = null;
    }
  }
}

function platformById(state, id) {
  if (id === null || id === undefined) return null;
  return state.platforms.find((platform) => platform.id === id) || null;
}

function updatePlayer(state, dt) {
  const p = state.player;
  const input = state.input;

  p.dropTimer = Math.max(0, p.dropTimer - dt);

  if (p.grounded !== null && p.grounded !== undefined) {
    const platform = platformById(state, p.grounded);
    if (!platform || platform.broken || platform.worldY - state.scrollY < CEILING_H + 10) {
      p.grounded = null;
    } else {
      standOnPlatform(state, platform, dt);
    }
  }
  if (p.grounded === null || p.grounded === undefined) {
    airborne(state, dt);
  }

  applyCeiling(state, dt);

  p.hurt = Math.max(0, p.hurt - dt);
  p.squashX += (1 - p.squashX) * Math.min(1, dt * 11);
  p.squashY += (1 - p.squashY) * Math.min(1, dt * 11);
  p.dive = input.dive && p.grounded === null;
}

function steerX(state, dt, accel, drag) {
  const p = state.player;
  const input = state.input;
  let ax = 0;
  if (input.left && !input.right) ax -= accel;
  if (input.right && !input.left) ax += accel;
  p.vx += ax * dt;
  if (ax === 0) {
    const drop = drag * dt;
    if (Math.abs(p.vx) <= drop) p.vx = 0;
    else p.vx -= Math.sign(p.vx) * drop;
  }
  if (ax > 0) p.facing = 1;
  if (ax < 0) p.facing = -1;
}

function clampX(state) {
  const p = state.player;
  const min = WALL_L + PLAYER_W / 2;
  const max = WALL_R - PLAYER_W / 2;
  if (p.x < min) {
    p.x = min;
    if (p.vx < 0) p.vx = -p.vx * WALL_BOUNCE;
  } else if (p.x > max) {
    p.x = max;
    if (p.vx > 0) p.vx = -p.vx * WALL_BOUNCE;
  }
}

function standOnPlatform(state, platform, dt) {
  const p = state.player;
  p.y = platform.worldY;
  p.vy = 0;

  const conveyor = platform.type === "conveyorL" || platform.type === "conveyorR";
  steerX(state, dt, MOVE_ACCEL, conveyor ? 0 : GROUND_FRICTION);
  if (conveyor) p.vx += platform.dir * CONVEYOR_ACCEL * dt;
  p.vx = Math.max(-MOVE_MAX * 1.5, Math.min(MOVE_MAX * 1.5, p.vx));
  p.x += p.vx * dt;
  clampX(state);

  const edge = platform.width / 2 + 4;
  if (p.x < platform.x - edge || p.x > platform.x + edge) {
    p.grounded = null;
    p.dropId = platform.id;
    p.dropTimer = 0.2;
  }
}

function airborne(state, dt) {
  const p = state.player;
  const input = state.input;
  steerX(state, dt, MOVE_ACCEL, AIR_DRAG);
  p.vx = Math.max(-MOVE_MAX, Math.min(MOVE_MAX, p.vx));
  p.x += p.vx * dt;
  clampX(state);

  const diving = input.dive && p.vy >= 0;
  const gravity = GRAVITY + (diving ? DIVE_ACCEL : 0);
  p.vy += gravity * dt;
  const cap = diving ? DIVE_MAX : FALL_MAX;
  p.vy = Math.min(cap, p.vy);

  const prevY = p.y;
  p.y += p.vy * dt;
  if (p.vy <= 0) return;

  let target = null;
  for (const platform of state.platforms) {
    if (platform.broken) continue;
    if (platform.worldY - state.scrollY < CEILING_H + 4) continue;
    if (p.dropTimer > 0 && p.dropId === platform.id) continue;
    if (prevY > platform.worldY + 2) continue;
    if (p.y < platform.worldY) continue;
    const overlap = Math.abs(p.x - platform.x) <= platform.width / 2 + PLAYER_W * 0.35;
    if (!overlap) continue;
    if (!target || platform.worldY < target.worldY) target = platform;
  }
  if (target) landOn(state, target);
}

function landOn(state, platform) {
  const p = state.player;
  const type = platform.type;
  p.y = platform.worldY;
  p.vy = 0;
  p.grounded = platform.id;
  p.squashY = 0.72;
  p.squashX = 1.24;
  platform.landed = true;
  state.stats.lands += 1;
  pushEvent(state, {
    type: "land",
    platformType: type,
    platformId: platform.id,
    x: p.x,
    y: platform.worldY - state.scrollY,
  });

  if (type === "spring") {
    p.grounded = null;
    p.vy = -SPRING_POWER;
    state.stats.springs += 1;
    pushEvent(state, { type: "spring", x: p.x, y: platform.worldY - state.scrollY });
    return;
  }

  if (type === "spike") {
    p.hp = Math.max(0, p.hp - SPIKE_DAMAGE);
    p.hurt = 0.45;
    state.stats.spikes += 1;
    pushEvent(state, { type: "spike", hp: p.hp, x: p.x, y: platform.worldY - state.scrollY });
    if (p.hp <= 0) {
      lose(state, "hp");
      return;
    }
  } else if (type === "crumble") {
    if (!platform.breaking) {
      platform.breaking = true;
      platform.breakTimer = CRUMBLE_DELAY;
      pushEvent(state, { type: "crumble", platformId: platform.id, x: platform.x, y: platform.worldY - state.scrollY });
    }
  } else if (type === "conveyorL" || type === "conveyorR") {
    pushEvent(state, { type: "conveyor", dir: platform.dir, x: p.x, y: platform.worldY - state.scrollY });
  } else if (type === "goal") {
    p.squashY = 0.8;
    p.squashX = 1.1;
    win(state);
    return;
  } else if (type === "normal") {
    if (!platform.healed && p.hp < p.maxHp) {
      platform.healed = true;
      p.hp = Math.min(p.maxHp, p.hp + HEAL_AMOUNT);
      state.stats.heals += 1;
      pushEvent(state, { type: "heal", hp: p.hp, x: p.x, y: platform.worldY - state.scrollY });
    }
  }
}

function applyCeiling(state, dt) {
  const p = state.player;
  const top = p.y - state.scrollY - PLAYER_H;
  if (top >= CEILING_H) {
    p.ceiling = false;
    return;
  }
  const push = Math.min(8, CEILING_H - top);
  p.y += push;
  if (p.vy < 0) p.vy = 0;
  p.hp = Math.max(0, p.hp - CEILING_DPS * dt);
  state.ceilingTick += dt;
  if (!p.ceiling) {
    p.ceiling = true;
    state.stats.ceiling += 1;
  }
  if (state.ceilingTick >= 0.22) {
    state.ceilingTick = 0;
    pushEvent(state, { type: "ceiling", hp: p.hp });
  }
  if (p.hp <= 0) lose(state, "hp");
}

function prunePlatforms(state) {
  const keep = [];
  for (const platform of state.platforms) {
    if (platform.worldY - state.scrollY < -90) {
      if (state.player.grounded === platform.id) state.player.grounded = null;
      continue;
    }
    keep.push(platform);
  }
  state.platforms = keep;
}

function updateScore(state) {
  const p = state.player;
  state.score = floorsPoints(state.depth) + lifePoints(p.hp);
  if (state.player.y - state.scrollY > VIEW_H + VOID_MARGIN) {
    lose(state, "void");
  }
}

function checkDepth(state) {
  const raw = Math.floor((state.player.y - START_Y) / SPACING);
  const depth = Math.max(0, Math.min(2000, raw));
  if (depth > state.depth) {
    state.depth = depth;
    state.maxDepth = depth;
    if (depth % 5 === 0) pushEvent(state, { type: "floor", floor: depth });
    if (state.config.mode === "endless" && depth >= 100 && !state.overheated) {
      state.overheated = true;
      pushEvent(state, { type: "overheat", floor: depth });
    }
  }
}

function win(state) {
  if (state.phase !== "playing") return;
  state.phase = "won";
  state.ended = true;
  if (state.config.goalFloors > 0) state.depth = state.config.goalFloors;
  state.score = floorsPoints(state.depth) + lifePoints(state.player.hp);
  pushEvent(state, { type: "win", depth: state.depth, hp: state.player.hp, elapsed: state.elapsed });
}

function lose(state, reason) {
  if (state.phase !== "playing") return;
  state.phase = "lost";
  state.ended = true;
  state.endReason = reason;
  pushEvent(state, { type: "lose", reason, depth: state.depth, hp: state.player.hp, elapsed: state.elapsed });
}
