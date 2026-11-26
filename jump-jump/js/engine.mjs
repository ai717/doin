// engine.mjs — 跳一跳（jump-jump）规则与物理唯一权威
// 铁律：DOM-free。不引用 document / window / localStorage，规则可被 node:test 直接验证。
// 时序模型：固定步长 stepFrame(state, dt)，物理可测试、可重放。

import {
  SAFE_POINTS,
  TRAMPOLINE_POINTS,
  VINYL_BONUS,
  bullseyeGain,
  sniperRing,
  sniperRank,
  accuracyOf,
  computeStars as computeStarsRule,
} from "./score.mjs";

// 计分口径由 score.mjs 唯一持有，此处透明转发，避免调用方 import 两个模块
export {
  SAFE_POINTS,
  TRAMPOLINE_POINTS,
  VINYL_BONUS,
  SNIPER_MAX,
  bullseyeGain,
  sniperRing,
  sniperRank,
} from "./score.mjs";

export const TAU = Math.PI * 2;

/* ============================================================
 * 1 · 蓄力 — 距离标定（严格线性 + 起步阈值）
 *    distance(charge) = DIST_BASE + charge * DIST_SPEED
 *    合法蓄力区间 [CHARGE_MIN, CHARGE_MAX] 覆盖所有平台间距；
 *    CHARGE_CAP 为蓄力上限（满蓄力对应最远跳跃再冗余约 15%），杜绝数值失控。
 * ==========================================================*/
export const CHARGE_MIN = 0.25;
export const CHARGE_MAX = 1.5;
export const CHARGE_CAP = 1.8;
export const DIST_BASE = 60;
export const DIST_SPEED = 230;

export function distAt(charge) {
  const c = Math.max(0, Math.min(CHARGE_CAP, Number(charge) || 0));
  return DIST_BASE + c * DIST_SPEED;
}

export function chargeFor(dist) {
  return Math.max(0, Math.min(CHARGE_CAP, (dist - DIST_BASE) / DIST_SPEED));
}

/* ============================================================
 * 2 · 平台类型与落地判定
 * ==========================================================*/
export const PLATFORM_TYPES = ["plain", "trampoline", "vinyl", "moving", "thin", "goal", "start"];

export const PLATFORM_RADIUS = {
  start: 46,
  plain: 42,
  trampoline: 40,
  vinyl: 44,
  moving: 40,
  thin: 22,
  goal: 46,
};

// 平台中心 25% 半径 = 黄金靶心；78% 以外 = 边缘险着（摇晃后站稳）
export const BULLSEYE_RATIO = 0.25;
export const WOBBLE_RATIO = 0.78;
// 落脚点相对平台中心的最大保留偏移（超过则夹到 85%，避免棋子半悬空）
export const LAND_CLAMP = 0.85;

export const LANDING = {
  PERFECT: "perfect",
  SAFE: "safe",
  WOBBLE: "wobble",
  MISS: "miss",
  TRAMPOLINE: "trampoline",
};

/* ---- 特种平台参数 ---- */
export const MOVING_AMP = 26;          // 浮动岛振幅（沿跳跃轴线来回）
export const MOVING_PERIOD = 3.2;      // 浮动岛周期（秒）
export const VINYL_HOLD = 1.5;         // 黑胶台静止奖赏所需停留时长
export const TRAMPOLINE_GAP_MIN = 420; // 跳床后的超远间距（只能靠跳床跨越）
export const TRAMPOLINE_GAP_MAX = 500;

/* ---- 生成器安全区间（保证 100% 可解） ---- */
export const PLATFORM_DIST_MIN = 180;
export const PLATFORM_DIST_MAX = 340;
export const SAFE_MARGIN = 10;

/* ---- 计时常量 ---- */
export const SETTLE_TIME = 0.22;
export const WOBBLE_TIME = 0.5;
export const TRAMPOLINE_WINDUP = 0.4;
export const FALL_TIME = 0.95;
// 靶心试炼脱靶后「托举复位」的升起时长（从台面下方归位，避免凭空闪现）
export const LIFT_TIME = 0.42;
export const LIFT_FROM = -190;

export function makePlatform(id, x, y, type, motion = null) {
  return {
    id,
    x,
    y,
    type,
    radius: PLATFORM_RADIUS[type] ?? PLATFORM_RADIUS.plain,
    motion, // { amp, period, phase, ax, ay }
    visited: false,
  };
}

export function platformPos(platform, time) {
  if (!platform || !platform.motion) return { x: platform.x, y: platform.y };
  const m = platform.motion;
  const off = m.amp * Math.sin((time / m.period) * TAU + m.phase);
  return { x: platform.x + m.ax * off, y: platform.y + m.ay * off };
}

/**
 * 给定「间距 gap / 目标平台类型」，返回该间距在「最坏落脚偏移 + 浮动岛相位」下
 * 实际需要的跳跃距离区间。用于数学可解性校验。
 */
export function gapReach(gap, type) {
  const r = PLATFORM_RADIUS[type] ?? PLATFORM_RADIUS.plain;
  const amp = type === "moving" ? MOVING_AMP : 0;
  return [gap - amp - r, gap + amp + r];
}

export function isGapSolvable(gap, type) {
  const [lo, hi] = gapReach(gap, type);
  return lo >= distAt(CHARGE_MIN) && hi <= distAt(CHARGE_MAX);
}

/** 按平台类型推导「合法中心间距」生成窗口（已含最坏偏移与振幅冗余）。 */
export function legalGapRange(type) {
  const r = PLATFORM_RADIUS[type] ?? PLATFORM_RADIUS.plain;
  const amp = type === "moving" ? MOVING_AMP : 0;
  const lo = Math.max(PLATFORM_DIST_MIN, distAt(CHARGE_MIN) + r + amp + SAFE_MARGIN);
  const hi = Math.min(PLATFORM_DIST_MAX, distAt(CHARGE_MAX) - r - amp - SAFE_MARGIN);
  return hi > lo ? [lo, hi] : [lo, lo];
}

export function clampGapRange(range, type) {
  const [llo, lhi] = legalGapRange(type);
  const lo = Math.max(range[0], llo);
  const hi = Math.min(range[1], lhi);
  return hi > lo ? [lo, hi] : [llo, lhi];
}

/* ============================================================
 * 3 · 确定性 PRNG（mulberry32 + FNV-1a）
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
 * 4 · 状态构造
 * ==========================================================*/
export const MODES = ["odyssey", "endless", "sniper"];

// 靶心试炼：10 轮固定靶距（同全球同题，纯拼目测精度）
export const SNIPER_DISTANCES = [185, 215, 250, 285, 320, 200, 265, 300, 235, 275];
export const SNIPER_SHOTS = SNIPER_DISTANCES.length;

function baseState(mode) {
  return {
    mode,
    level: 1,
    seed: 1,
    rng: mulberry32(1),
    time: 0,
    // aiming | charging | flying | settling | wobble | windup | lift | falling | won | lost
    phase: "aiming",
    platforms: [],
    index: 0,
    nextAxis: 0, // 0 => 沿 +x 前进，1 => 沿 +y 前进（等轴测下表现为右上 / 左上交替）
    char: { offX: 0, offY: 0, z: 0, rot: 0, squashX: 1, squashY: 1 },
    charge: 0,
    flight: null,
    fall: null,
    lift: null,
    timer: 0,
    vinylTimer: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    bullseyes: 0,
    jumps: 0,
    wobbles: 0,
    lands: 0,
    maxDistance: 0,
    sniper: null,
    ended: false,
    events: [],
  };
}

export function createState({ mode = "endless", level = 1, seed = 1, route = null } = {}) {
  const state = baseState(mode);
  state.level = level;
  state.seed = seed;
  state.rng = mulberry32(seed);

  if (mode === "odyssey") {
    const list = Array.isArray(route) && route.length > 1 ? route : null;
    if (!list) throw new Error("odyssey mode requires a prebuilt route");
    state.platforms = list.map((p, i) => ({ ...p, id: i, visited: i === 0 }));
  } else if (mode === "sniper") {
    buildSniperRoute(state);
  } else {
    state.platforms = [makePlatform(0, 0, 0, "start")];
    ensureEndlessNext(state);
  }
  return state;
}

function buildSniperRoute(state) {
  const platforms = [makePlatform(0, 0, 0, "start")];
  let x = 0;
  let y = 0;
  let axis = 0;
  for (let i = 0; i < SNIPER_SHOTS; i += 1) {
    const d = SNIPER_DISTANCES[i];
    if (axis === 0) x += d;
    else y += d;
    platforms.push(makePlatform(i + 1, x, y, "plain"));
    axis = 1 - axis;
  }
  state.platforms = platforms;
  state.sniper = { shots: 0, total: 0, rings: [] };
}

/* ============================================================
 * 5 · 无尽模式：随分数爬升的确定性平台生成
 * ==========================================================*/
function endlessDifficulty(jumps) {
  if (jumps < 4) return { types: ["plain"], dist: [190, 250] };
  if (jumps < 9) return { types: ["plain", "plain", "vinyl", "thin"], dist: [190, 285] };
  if (jumps < 16) return { types: ["plain", "plain", "vinyl", "thin", "moving", "moving"], dist: [195, 315] };
  return { types: ["plain", "vinyl", "thin", "moving", "moving", "trampoline"], dist: [200, 340] };
}

function pickEndlessType(state, diff, rng) {
  const prev = state.platforms[state.platforms.length - 1];
  // 跳床之后必须是可被精确自动落点的平台（浮动/薄块会破坏跳床的必中保证）
  if (prev.type === "trampoline") return rng() < 0.35 ? "vinyl" : "plain";
  let type = diff.types[Math.floor(rng() * diff.types.length) % diff.types.length];
  if (type === "trampoline" && prev.type === "trampoline") type = "plain";
  return type;
}

export function ensureEndlessNext(state) {
  if (state.platforms.length > state.index + 1) return;
  const rng = state.rng;
  const diff = endlessDifficulty(state.jumps);
  const prev = state.platforms[state.platforms.length - 1];
  const type = pickEndlessType(state, diff, rng);

  let gap;
  if (prev.type === "trampoline") {
    gap = TRAMPOLINE_GAP_MIN + rng() * (TRAMPOLINE_GAP_MAX - TRAMPOLINE_GAP_MIN);
  } else {
    const [lo, hi] = clampGapRange(diff.dist, type);
    gap = lo + rng() * (hi - lo);
  }
  appendPlatform(state, type, gap);
}

function appendPlatform(state, type, gap) {
  const prev = state.platforms[state.platforms.length - 1];
  const axis = state.nextAxis;
  const x = axis === 0 ? prev.x + gap : prev.x;
  const y = axis === 0 ? prev.y : prev.y + gap;

  let motion = null;
  if (type === "moving") {
    motion = {
      amp: MOVING_AMP,
      period: MOVING_PERIOD,
      phase: state.rng() * TAU,
      ax: axis === 0 ? 1 : 0,
      ay: axis === 0 ? 0 : 1,
    };
  }
  state.platforms.push(makePlatform(state.platforms.length, x, y, type, motion));
  state.nextAxis = 1 - axis;
  return state.platforms[state.platforms.length - 1];
}

/* ============================================================
 * 6 · 玩家意图（意图 → 动作）
 * ==========================================================*/
export function canCharge(state) {
  return !state.ended && (state.phase === "aiming" || state.phase === "wobble");
}

export function startCharge(state) {
  if (!canCharge(state)) return null;
  state.phase = "charging";
  state.charge = 0;
  state.vinylTimer = 0;
  state.events.push({ type: "charge-start" });
  return { type: "charge-start" };
}

export function currentCharge(state) {
  return state.phase === "charging" ? state.charge : 0;
}

export function chargeRatio(state) {
  return Math.min(1, currentCharge(state) / CHARGE_MAX);
}

export function releaseCharge(state) {
  if (state.phase !== "charging") return null;
  const dist = distAt(state.charge);
  const next = state.platforms[state.index + 1];
  if (!next) {
    state.phase = "aiming";
    state.charge = 0;
    return null;
  }
  launch(state, dist, { high: false, trampoline: false });
  state.events.push({ type: "launch", dist, charge: state.charge });
  return { type: "launch", dist };
}

function launch(state, dist, { high, trampoline }) {
  const from = charPos(state);
  const target = state.platforms[state.index + 1];
  const tp = platformPos(target, state.time);
  let dx = tp.x - from.x;
  let dy = tp.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;

  state.jumps += 1;
  state.spinDir = state.jumps % 2 === 0 ? 1 : -1;
  state.flight = {
    fromX: from.x,
    fromY: from.y,
    dirX: dx,
    dirY: dy,
    dist,
    t: 0,
    dur: flightDuration(dist, high),
    peak: peakHeight(dist, high),
    high: !!high,
    trampoline: !!trampoline,
    targetIndex: state.index + 1,
  };
  state.phase = "flying";
  state.charge = 0;
  state.vinylTimer = 0;
  state.char.rot = 0;
}

function flightDuration(dist, high) {
  return (high ? 0.5 : 0.34) + dist * 0.0013;
}

function peakHeight(dist, high) {
  return high ? 240 + dist * 0.55 : 64 + dist * 0.33;
}

/* ============================================================
 * 7 · 固定步长推进
 * ==========================================================*/
export function charPos(state) {
  if (state.flight) {
    const f = state.flight;
    const p = f.dur > 0 ? Math.min(1, Math.max(0, f.t / f.dur)) : 1;
    return { x: f.fromX + f.dirX * f.dist * p, y: f.fromY + f.dirY * f.dist * p };
  }
  // 坠落中：停在落空点并保留一点前冲惯性，避免瞬间弹回起跳台
  if (state.fall) {
    const f = state.fall;
    return { x: f.x + f.vx * f.t, y: f.y + f.vy * f.t };
  }
  const p = state.platforms[state.index];
  const pp = platformPos(p, state.time);
  return { x: pp.x + state.char.offX, y: pp.y + state.char.offY };
}

export function stepFrame(state, dt) {
  const step = Math.max(0, Math.min(0.05, Number(dt) || 0));
  state.time += step;

  switch (state.phase) {
    case "charging":
      stepCharging(state, step);
      break;
    case "flying":
      stepFlying(state, step);
      break;
    case "settling":
    case "wobble":
    case "windup":
      stepSettle(state, step);
      break;
    case "falling":
      stepFalling(state, step);
      break;
    case "lift":
      stepLift(state, step);
      break;
    default:
      stepIdle(state, step);
      break;
  }
  return state.events;
}

function stepCharging(state, dt) {
  state.charge = Math.min(CHARGE_CAP, state.charge + dt);
  const p = Math.min(1, state.charge / CHARGE_CAP);
  state.char.squashY = 1 - 0.6 * p;
  state.char.squashX = 1 + 0.25 * p;
  state.char.z = 0;
}

function stepFlying(state, dt) {
  const f = state.flight;
  f.t += dt;
  const p = Math.min(1, f.t / f.dur);
  // 抛物线：z = 4H·p(1-p)，p=0.5 时达到峰值 H
  state.char.z = 4 * f.peak * p * (1 - p);
  state.char.rot = p * TAU * (state.spinDir || 1);
  // 滞空拉伸 120%，随落地收敛
  const stretch = Math.sin(Math.PI * p);
  state.char.squashY = 1 + 0.2 * stretch;
  state.char.squashX = 1 - 0.1 * stretch;
  if (p >= 1) {
    state.char.z = 0;
    state.char.rot = 0;
    resolveLanding(state);
  }
}

function stepSettle(state, dt) {
  state.timer -= dt;
  const total = state.phase === "wobble" ? WOBBLE_TIME : state.phase === "windup" ? TRAMPOLINE_WINDUP : SETTLE_TIME;
  const p = 1 - Math.max(0, state.timer) / total;

  if (state.phase === "windup") {
    // 跳床蓄势：深压后爆发
    const s = Math.sin(Math.PI * Math.min(1, p));
    state.char.squashY = 1 - 0.45 * s;
    state.char.squashX = 1 + 0.2 * s;
  } else if (state.phase === "wobble") {
    // 边缘险着：阻尼晃动
    const damp = Math.max(0, 1 - p);
    state.char.squashX = 1 + 0.16 * Math.sin(p * 22) * damp;
    state.char.squashY = 1 - 0.08 * Math.sin(p * 22) * damp;
  } else {
    // 落地顿挫：压缩 10% 后迅速回弹
    const s = Math.sin(Math.PI * Math.min(1, p));
    state.char.squashY = 1 - 0.1 * s + 0.05 * s;
    state.char.squashX = 1 + 0.08 * s;
  }

  if (state.timer <= 0) {
    state.char.squashX = 1;
    state.char.squashY = 1;
    if (state.phase === "windup") {
      const target = state.platforms[state.index + 1];
      const tp = platformPos(target, state.time);
      const from = charPos(state);
      const exact = Math.hypot(tp.x - from.x, tp.y - from.y);
      launch(state, exact, { high: true, trampoline: true });
      state.events.push({ type: "trampoline", dist: exact });
      return;
    }
    state.phase = "aiming";
    state.vinylTimer = 0;
  }
}

function stepFalling(state, dt) {
  const f = state.fall;
  f.t += dt;
  const p = Math.min(1, f.t / f.dur);
  state.char.z = f.fromZ - 620 * p * p;
  state.char.rot = f.spin * p * 3.2;
  state.char.squashY = 1;
  state.char.squashX = 1;
  if (p >= 1) finishFall(state);
}

// 靶心试炼脱靶后：棋子从目标台下方被托举回台面，而不是凭空闪现
function stepLift(state, dt) {
  const l = state.lift;
  l.t += dt;
  const p = Math.min(1, l.t / l.dur);
  const e = 1 - (1 - p) * (1 - p); // ease-out：出地快、落定柔
  state.char.z = LIFT_FROM * (1 - e);
  state.char.rot = 0;
  const s = Math.sin(Math.PI * p);
  state.char.squashY = 1 + 0.12 * s;
  state.char.squashX = 1 - 0.06 * s;
  if (p >= 1) {
    state.char.z = 0;
    state.char.squashX = 1;
    state.char.squashY = 1;
    state.lift = null;
    state.phase = "settling";
    state.timer = SETTLE_TIME;
  }
}

function stepIdle(state, dt) {
  state.char.squashX += (1 - state.char.squashX) * Math.min(1, dt * 12);
  state.char.squashY += (1 - state.char.squashY) * Math.min(1, dt * 12);
  if (state.phase !== "aiming") return;

  const p = state.platforms[state.index];
  if (p && p.type === "vinyl" && !p.awarded) {
    state.vinylTimer += dt;
    if (state.vinylTimer >= VINYL_HOLD) {
      p.awarded = true;
      state.score += VINYL_BONUS;
      state.events.push({ type: "vinyl", gain: VINYL_BONUS });
    }
  }
}

/* ============================================================
 * 8 · 落地判定
 * ==========================================================*/
export function classifyLanding(distance, radius) {
  if (distance > radius) return LANDING.MISS;
  if (distance <= radius * BULLSEYE_RATIO) return LANDING.PERFECT;
  if (distance >= radius * WOBBLE_RATIO) return LANDING.WOBBLE;
  return LANDING.SAFE;
}

function resolveLanding(state) {
  const f = state.flight;
  const target = state.platforms[f.targetIndex];
  const tp = platformPos(target, state.time);
  const lx = f.fromX + f.dirX * f.dist;
  const ly = f.fromY + f.dirY * f.dist;
  let dx = lx - tp.x;
  let dy = ly - tp.y;
  const d = Math.hypot(dx, dy);
  const r = target.radius;
  const kind = f.trampoline ? LANDING.TRAMPOLINE : classifyLanding(d, r);

  if (kind === LANDING.MISS) {
    // 从落空点（而非起跳台）开始坠落，并保留 35% 前冲惯性
    const drift = (f.dist / Math.max(1e-6, f.dur)) * 0.35;
    state.fall = {
      t: 0,
      dur: FALL_TIME,
      fromZ: 0,
      spin: state.spinDir || 1,
      x: lx,
      y: ly,
      vx: f.dirX * drift,
      vy: f.dirY * drift,
    };
    state.phase = "falling";
    state.flight = null;
    state.combo = 0;
    state.events.push({ type: "fall", distance: d, radius: r });
    return;
  }

  const clamped = Math.min(d, r * LAND_CLAMP);
  if (d > 1e-6) {
    dx = (dx / d) * clamped;
    dy = (dy / d) * clamped;
  } else {
    dx = 0;
    dy = 0;
  }
  state.char.offX = dx;
  state.char.offY = dy;
  state.char.z = 0;
  state.index = f.targetIndex;
  target.visited = true;
  state.flight = null;
  state.lands += 1;
  state.maxDistance = Math.max(state.maxDistance, f.dist);

  const gain = applyLandingScore(state, kind, d, f.targetIndex);

  if (kind === LANDING.PERFECT) state.bullseyes += 1;
  if (kind === LANDING.WOBBLE) state.wobbles += 1;

  state.events.push({
    type: "landed",
    kind,
    gain,
    combo: state.combo,
    distance: d,
    platformIndex: f.targetIndex,
    platformType: target.type,
  });

  if (state.mode === "sniper") {
    advanceSniper(state);
    return;
  }

  if (state.mode === "odyssey") {
    if (target.type === "goal") {
      state.phase = "won";
      state.ended = true;
      state.events.push({ type: "win" });
      return;
    }
  } else {
    // 必须先补出下一块平台：跳床蓄势（windup）也要读它做精确落点
    ensureEndlessNext(state);
  }

  if (target.type === "trampoline") {
    state.phase = "windup";
    state.timer = TRAMPOLINE_WINDUP;
    return;
  }

  state.phase = kind === LANDING.WOBBLE ? "wobble" : "settling";
  state.timer = kind === LANDING.WOBBLE ? WOBBLE_TIME : SETTLE_TIME;
}

function applyLandingScore(state, kind, distance, platformIndex) {
  if (state.mode === "sniper") {
    const ring = sniperRing(distance, state.platforms[platformIndex].radius);
    state.sniper.rings.push(ring);
    state.sniper.total += ring.points;
    state.sniper.shots += 1;
    state.score = state.sniper.total;
    return ring.points;
  }
  if (kind === LANDING.PERFECT) {
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const gain = bullseyeGain(state.combo);
    state.score += gain;
    return gain;
  }
  state.combo = 0;
  const gain = kind === LANDING.TRAMPOLINE ? TRAMPOLINE_POINTS : SAFE_POINTS;
  state.score += gain;
  return gain;
}

/* ============================================================
 * 9 · 靶心试炼
 * ==========================================================*/
function advanceSniper(state) {
  if (state.sniper.shots >= SNIPER_SHOTS) {
    state.phase = "won";
    state.ended = true;
    state.events.push({
      type: "sniper-end",
      total: state.sniper.total,
      rank: sniperRank(state.sniper.total),
    });
    return;
  }
  state.phase = "settling";
  state.timer = SETTLE_TIME;
}

// 试炼场落空不结束：本次记 0 分，棋子被托举回目标平台继续下一轮
function finishFall(state) {
  state.char.rot = 0;
  if (state.mode === "sniper") {
    const target = state.platforms[state.index + 1];
    if (target) {
      // 试炼场：切到目标平台后从台面下方升起（lift），不再凭空出现
      state.fall = null;
      state.index += 1;
      state.char.offX = 0;
      state.char.offY = 0;
      state.char.z = LIFT_FROM;
      state.char.rot = 0;
      state.sniper.rings.push({ ring: "miss", points: 0, distance: Infinity });
      state.sniper.shots += 1;
      state.events.push({ type: "recover" });
      if (state.sniper.shots >= SNIPER_SHOTS) {
        // 最后一枪直接结算：不必再演一遍归位动画
        state.char.z = 0;
        state.phase = "won";
        state.ended = true;
        state.events.push({
          type: "sniper-end",
          total: state.sniper.total,
          rank: sniperRank(state.sniper.total),
        });
        return;
      }
      state.phase = "lift";
      state.lift = { t: 0, dur: LIFT_TIME };
      return;
    }
  }
  // 败局：保留 state.fall，棋子停在深渊里的落空点，不再一帧弹回起跳台
  state.phase = "lost";
  state.ended = true;
  state.events.push({ type: "lose", score: state.score });
}

/* ============================================================
 * 10 · 关卡星级
 * ==========================================================*/
export function computeStars(state) {
  return computeStarsRule({
    jumps: state.jumps,
    bullseyes: state.bullseyes,
    bestCombo: state.bestCombo,
    wobbles: state.wobbles,
    won: state.mode === "odyssey" && state.phase === "won",
  });
}

export function accuracy(state) {
  return accuracyOf(state.jumps, state.bullseyes);
}

export function drainEvents(state) {
  const out = state.events.slice();
  state.events.length = 0;
  return out;
}
