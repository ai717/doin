// engine.mjs — 割绳子 · 物理与规则唯一权威
// 纯函数式帧步进（stepFrame），DOM-free：不碰 document / window / localStorage。
// 物理模型：糖果是唯一自由质点（Verlet + PBD 位置约束），绳是"只拉不推"的距离约束，
// 弹性绳用极低刚度的位置修正等效弹簧（ω = sqrt(g / stretch)），切断瞬间按拉伸量补一次弹射冲量。

export const WORLD = { w: 900, h: 620 };
export const CANDY_R = 15;
export const STAR_R = 16;
export const GRAVITY = 1500;
export const FIXED_DT = 1 / 120;

const AIR_DRAG = 0.05; // 空气阻尼（每秒，线性）
const BUBBLE_LIFT = 1.28; // 气泡浮力相对重力的倍数（净上浮 0.28g，终速约 350px/s）
const BUBBLE_DRAG = 1.2; // 糖膜阻尼：上升稳、横向余速还能再飘一段
const ELASTIC_IMPULSE = 6.2; // 弹射冲量 = 拉伸量 × 该系数（px/s per px）
const ELASTIC_IMPULSE_MAX = 980;
const REST_SPEED = 26; // 盒底静止判定速度
const REST_TIME = 1.5;
const IDLE_SPEED = 11; // 全局发呆判定（兜底防挂机）
const IDLE_TIME = 5.5;
const PUFF_TIME = 0.5;
const PUFF_COOL = 1;
const MAX_SPEED = 2600; // 速度安全上限，任何情况下都不许把糖甩成光速
const CONSTRAINT_ITERATIONS = 14;

function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

/** 点到线段最近点 */
export function closestOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return { x: x1, y: y1, t: 0 };
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return { x: x1 + t * dx, y: y1 + t * dy, t };
}

/** 两线段是否相交（用于划刀切绳） */
export function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = cross(cx, cy, dx, dy, ax, ay);
  const d2 = cross(cx, cy, dx, dy, bx, by);
  const d3 = cross(ax, ay, bx, by, cx, cy);
  const d4 = cross(ax, ay, bx, by, dx, dy);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function cross(ax, ay, bx, by, px, py) {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

/** 弹性绳的每步位置修正系数：由"重力下预期拉伸量"反解弹簧角频率 */
function elasticFactor(stretch) {
  const s = Math.max(8, stretch);
  const omega = Math.sqrt(GRAVITY / s); // 静止拉伸 s 时 ω = sqrt(g/s)
  return Math.min(0.2, (omega * FIXED_DT) ** 2);
}

function buildRopes(level) {
  return (level.ropes ?? []).map((raw, index) => {
    const rope = {
      index,
      cut: false,
      len: raw.len ?? 120,
      targetLen: raw.len ?? 120,
      elastic: Boolean(raw.elastic),
      stretch: raw.elastic?.stretch ?? 60,
      rest: raw.elastic?.rest ?? raw.len ?? 120,
      auto: raw.auto ? { at: raw.auto.at ?? 1, grow: raw.auto.grow ?? 0.45 } : null,
      active: !raw.auto,
    };
    if (raw.rail) {
      rope.rail = { from: [raw.rail.from[0], raw.rail.from[1]], to: [raw.rail.to[0], raw.rail.to[1]], t: raw.rail.t ?? 0.5 };
    } else {
      rope.anchor = [raw.a?.[0] ?? raw.ax ?? 0, raw.a?.[1] ?? raw.ay ?? 0];
    }
    return rope;
  });
}

/** 绳的当前锚点（滑动锚轨会随 t 变化） */
export function ropeAnchor(rope) {
  if (!rope.rail) return { x: rope.anchor[0], y: rope.anchor[1] };
  const t = Math.max(0, Math.min(1, rope.rail.t));
  return {
    x: rope.rail.from[0] + (rope.rail.to[0] - rope.rail.from[0]) * t,
    y: rope.rail.from[1] + (rope.rail.to[1] - rope.rail.from[1]) * t,
  };
}

export function createState(level) {
  const state = {
    level,
    t: 0,
    candy: {
      x: level.candy[0],
      y: level.candy[1],
      px: level.candy[0],
      py: level.candy[1],
      vx: 0,
      vy: 0,
    },
    ropes: buildRopes(level),
    stars: (level.stars ?? []).map((s) => ({ x: s[0], y: s[1], taken: false })),
    bubbles: (level.bubbles ?? []).map((b) => ({
      x: b.at[0],
      y: b.at[1],
      r: b.r ?? 44,
      alive: true,
    })),
    cushions: (level.cushions ?? []).map((c) => ({
      x: c.at[0],
      y: c.at[1],
      dx: c.dir[0],
      dy: c.dir[1],
      power: c.power ?? 1900,
      range: c.range ?? 170,
      active: 0,
      cool: 0,
      uses: 0,
    })),
    spikes: (level.spikes ?? []).map((s) => ({
      x1: s.from[0],
      y1: s.from[1],
      x2: s.to[0],
      y2: s.to[1],
    })),
    walls: (level.walls ?? []).map((w) => ({
      x1: w.from[0],
      y1: w.from[1],
      x2: w.to[0],
      y2: w.to[1],
      bounce: w.bounce ?? 0.42,
    })),
    monster: {
      x: level.monster.at[0],
      y: level.monster.at[1],
      r: level.monster.r ?? 34,
      move: level.monster.move
        ? {
            to: [level.monster.move.to[0], level.monster.move.to[1]],
            period: level.monster.move.period ?? 4,
            phase: level.monster.move.phase ?? 0,
          }
        : null,
      origin: [level.monster.at[0], level.monster.at[1]],
    },
    attached: -1, // 附着的气泡下标，-1 为无
    status: "playing",
    reason: null,
    starsTaken: 0,
    cuts: 0,
    restTime: 0,
    idleTime: 0,
    events: [],
  };
  if (state.bubbles.length && level.candyInBubble) {
    state.attached = 0;
    state.events.push({ type: "capture", index: 0 });
  }
  return state;
}

export function isPlaying(state) {
  return state.status === "playing";
}

export function activeRopes(state) {
  return state.ropes.filter((r) => !r.cut && r.active);
}

function emit(state, event) {
  state.events.push(event);
}

function updateMonster(state) {
  const m = state.monster;
  if (!m.move) return;
  const k = 0.5 - 0.5 * Math.cos((state.t / m.move.period + m.move.phase) * Math.PI * 2);
  m.x = m.origin[0] + (m.move.to[0] - m.origin[0]) * k;
  m.y = m.origin[1] + (m.move.to[1] - m.origin[1]) * k;
}

function updateCushions(state, dt) {
  for (const c of state.cushions) {
    if (c.active > 0) c.active = Math.max(0, c.active - dt);
    if (c.cool > 0) c.cool = Math.max(0, c.cool - dt);
  }
}

/** 气垫吹风：在锥形范围内给糖果一个方向加速度 */
function cushionAccel(state, out) {
  for (const c of state.cushions) {
    if (c.active <= 0) continue;
    const len2 = Math.hypot(c.dx, c.dy) || 1;
    const nx = c.dx / len2;
    const ny = c.dy / len2;
    const rx = state.candy.x - c.x;
    const ry = state.candy.y - c.y;
    const along = rx * nx + ry * ny;
    if (along < -20 || along > c.range) continue;
    const lateral = Math.abs(rx * -ny + ry * nx);
    const spread = 42 + along * 0.5;
    if (lateral > spread) continue;
    // 风力随距离衰减但保留 55% 底劲，否则远处的气垫形同虚设
    const falloff = 0.55 + 0.45 * (1 - along / c.range);
    out.x += nx * c.power * falloff;
    out.y += ny * c.power * falloff;
  }
}

function integrate(state, dt) {
  const c = state.candy;
  const acc = { x: 0, y: GRAVITY };
  if (state.attached >= 0) {
    acc.y -= GRAVITY * BUBBLE_LIFT;
  }
  cushionAccel(state, acc);

  c.vx += acc.x * dt;
  c.vy += acc.y * dt;
  const drag = state.attached >= 0 ? BUBBLE_DRAG : AIR_DRAG;
  const k = Math.max(0, 1 - drag * dt);
  c.vx *= k;
  c.vy *= k;

  c.px = c.x;
  c.py = c.y;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
}

/** 第 0 次迭代处理弹性绳（每步只修正一次，否则刚度被迭代次数放大） */
function solveConstraints(state, dt, iteration) {
  const c = state.candy;
  for (const rope of state.ropes) {
    if (rope.cut || !rope.active) continue;
    const a = ropeAnchor(rope);
    const d = dist(a.x, a.y, c.x, c.y);
    if (rope.elastic) {
      if (iteration !== 0) continue;
      const rest = rope.rest;
      if (d > rest && d > 1e-6) {
        const f = elasticFactor(rope.stretch);
        const pull = Math.min(1, f) * (d - rest);
        c.x -= ((c.x - a.x) / d) * pull;
        c.y -= ((c.y - a.y) / d) * pull;
      }
      continue;
    }
    if (d > rope.len && d > 1e-6) {
      c.x = a.x + ((c.x - a.x) / d) * rope.len;
      c.y = a.y + ((c.y - a.y) / d) * rope.len;
    }
  }
}

function finalizeVelocity(state, dt) {
  const c = state.candy;
  c.vx = (c.x - c.px) / dt;
  c.vy = (c.y - c.py) / dt;
  const sp = Math.hypot(c.vx, c.vy);
  if (sp > MAX_SPEED) {
    c.vx = (c.vx / sp) * MAX_SPEED;
    c.vy = (c.vy / sp) * MAX_SPEED;
  }
}

function collideWalls(state) {
  const c = state.candy;
  for (const w of state.walls) {
    const p = closestOnSegment(c.x, c.y, w.x1, w.y1, w.x2, w.y2);
    let dx = c.x - p.x;
    let dy = c.y - p.y;
    let d = Math.hypot(dx, dy);
    if (d >= CANDY_R) continue;
    if (d < 1e-6) {
      dx = 0;
      dy = -1;
      d = 1;
    }
    const nx = dx / d;
    const ny = dy / d;
    c.x = p.x + nx * CANDY_R;
    c.y = p.y + ny * CANDY_R;
    const vn = c.vx * nx + c.vy * ny;
    if (vn < 0) {
      c.vx -= (1 + w.bounce) * vn * nx;
      c.vy -= (1 + w.bounce) * vn * ny;
      c.vx *= 0.985;
      c.vy *= 0.985;
      emit(state, { type: "bounce", x: c.x, y: c.y, speed: Math.abs(vn) });
    }
  }
}

function clampToBox(state) {
  const c = state.candy;
  const top = 26;
  if (c.y - CANDY_R < top) {
    c.y = top + CANDY_R;
    if (c.vy < 0) c.vy *= -0.24;
  }
  if (c.x - CANDY_R < 12) {
    c.x = 12 + CANDY_R;
    if (c.vx < 0) c.vx *= -0.35;
  }
  if (c.x + CANDY_R > WORLD.w - 12) {
    c.x = WORLD.w - 12 - CANDY_R;
    if (c.vx > 0) c.vx *= -0.35;
  }
}

function checkSpikes(state) {
  const c = state.candy;
  for (const s of state.spikes) {
    const p = closestOnSegment(c.x, c.y, s.x1, s.y1, s.x2, s.y2);
    if (Math.hypot(c.x - p.x, c.y - p.y) < CANDY_R + 5) return true;
  }
  return false;
}

function updateBubbles(state) {
  const c = state.candy;
  for (let i = 0; i < state.bubbles.length; i += 1) {
    const b = state.bubbles[i];
    if (!b.alive) continue;
    if (state.attached < 0) {
      // 气泡中心固定，糖果飘入即被捕获（判定略宽于视觉）
      if (dist(c.x, c.y, b.x, b.y) < b.r * 0.86) {
        state.attached = i;
        // 被泡泡"接住"：动能被糖膜吃掉大半，但保留一点横向余速（飘行手感）
        c.vx *= 0.25;
        c.vy *= 0.25;
        emit(state, { type: "capture", index: i });
      }
    }
  }
  if (state.attached >= 0) {
    const b = state.bubbles[state.attached];
    b.x = c.x;
    b.y = c.y;
  }
}

function updateStars(state) {
  const c = state.candy;
  for (let i = 0; i < state.stars.length; i += 1) {
    const s = state.stars[i];
    if (s.taken) continue;
    if (dist(c.x, c.y, s.x, s.y) < STAR_R + CANDY_R * 0.75) {
      s.taken = true;
      state.starsTaken += 1;
      emit(state, { type: "star", index: i, total: state.starsTaken });
    }
  }
}

function checkMouth(state) {
  const c = state.candy;
  const m = state.monster;
  // 进嘴判定略大于视觉口腔，避免"擦嘴失败"
  if (dist(c.x, c.y, m.x, m.y) < m.r + CANDY_R * 0.35) {
    state.status = "won";
    state.reason = "eaten";
    emit(state, { type: "win", stars: state.starsTaken });
    return true;
  }
  return false;
}

function lose(state, reason) {
  if (state.status !== "playing") return;
  state.status = "lost";
  state.reason = reason;
  emit(state, { type: "lose", reason, stars: state.starsTaken });
}

/** 推进一帧。终止态上调用为 no-op（永不抛错）。 */
export function stepFrame(state, dt = FIXED_DT) {
  if (state.status !== "playing") return state;
  state.t += dt;

  for (const rope of state.ropes) {
    if (rope.auto && !rope.active && state.t >= rope.auto.at) {
      rope.active = true;
      // 自动绳是"伸出去抓住再往回收"：激活瞬间以当前距离挂上，绝不能把糖瞬移过来
      const a = ropeAnchor(rope);
      rope.len = Math.max(rope.targetLen, dist(a.x, a.y, state.candy.x, state.candy.y));
      emit(state, { type: "rope-auto", index: rope.index });
    }
    if (rope.active && rope.len > rope.targetLen) {
      rope.len = Math.max(rope.targetLen, rope.len - 260 * dt);
    }
  }
  updateMonster(state);
  updateCushions(state, dt);

  integrate(state, dt);
  for (let i = 0; i < CONSTRAINT_ITERATIONS; i += 1) solveConstraints(state, dt, i);
  finalizeVelocity(state, dt);
  collideWalls(state);
  clampToBox(state);

  if (checkSpikes(state)) {
    lose(state, "spike");
    return state;
  }
  updateBubbles(state);
  updateStars(state);

  const c = state.candy;
  if (c.y > WORLD.h + 70 || c.x < -60 || c.x > WORLD.w + 60 || c.y < -600) {
    lose(state, "out");
    return state;
  }
  if (checkMouth(state)) return state;

  const speed = Math.hypot(c.vx, c.vy);
  const held = activeRopes(state).length > 0;
  if (!held && state.attached < 0 && speed < REST_SPEED && c.y > WORLD.h * 0.55) {
    state.restTime += dt;
    if (state.restTime > REST_TIME) {
      lose(state, "settled");
      return state;
    }
  } else {
    state.restTime = 0;
  }
  if (!held && speed < IDLE_SPEED) {
    state.idleTime += dt;
    if (state.idleTime > IDLE_TIME) lose(state, "settled");
  } else {
    state.idleTime = 0;
  }
  return state;
}

/** 模拟到某个时刻（供关卡求解器与测试使用） */
export function simulate(state, seconds, onStep) {
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i += 1) {
    stepFrame(state, FIXED_DT);
    if (onStep) onStep(state, i);
    if (state.status !== "playing") break;
  }
  return state;
}

/** 切绳：返回被切断的绳下标数组 */
export function cutRopes(state, ropeIndices) {
  const cut = [];
  for (const idx of ropeIndices) {
    const rope = state.ropes[idx];
    if (!rope || rope.cut || !rope.active) continue;
    const a = ropeAnchor(rope);
    const d = dist(a.x, a.y, state.candy.x, state.candy.y);
    rope.cut = true;
    cut.push(idx);
    if (rope.elastic && d > rope.rest) {
      const imp = Math.min(ELASTIC_IMPULSE_MAX, (d - rope.rest) * ELASTIC_IMPULSE);
      state.candy.vx += ((a.x - state.candy.x) / d) * imp;
      state.candy.vy += ((a.y - state.candy.y) / d) * imp;
      emit(state, { type: "launch", index: idx, power: imp });
    }
    emit(state, { type: "cut", index: idx, x: state.candy.x, y: state.candy.y });
  }
  if (cut.length) {
    state.cuts += cut.length;
  }
  return cut;
}

/** 划刀：给出屏幕/世界坐标下的一条线段，切断所有与之相交的绳 */
export function swipeCut(state, x1, y1, x2, y2, tolerance = 6) {
  const hits = [];
  const c = state.candy;
  for (const rope of state.ropes) {
    if (rope.cut || !rope.active) continue;
    const a = ropeAnchor(rope);
    // 判定带宽略宽于视觉线：线段两侧各外扩 tolerance
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * tolerance;
    const ny = (dx / l) * tolerance;
    const hit =
      segmentsIntersect(a.x, a.y, c.x, c.y, x1, y1, x2, y2) ||
      segmentsIntersect(a.x + nx, a.y + ny, c.x + nx, c.y + ny, x1, y1, x2, y2) ||
      segmentsIntersect(a.x - nx, a.y - ny, c.x - nx, c.y - ny, x1, y1, x2, y2);
    if (hit) hits.push(rope.index);
  }
  return cutRopes(state, hits);
}

/**
 * 施加一个玩家意图。返回 { ok, detail }：非法意图静默返回 ok:false，绝不抛错。
 * 支持：cut / pop / puff / slide
 */
export function applyIntent(state, intent) {
  if (state.status !== "playing") return { ok: false, detail: "terminal" };
  if (!intent || typeof intent.type !== "string") return { ok: false, detail: "empty" };
  if (intent.type === "cut") {
    const cut = swipeCut(state, intent.x1, intent.y1, intent.x2, intent.y2, intent.tolerance ?? 6);
    return { ok: cut.length > 0, detail: "cut", cut };
  }
  if (intent.type === "cutRopes") {
    // 按索引直接切断（求解器与测试用；玩家实际走 swipeCut）
    const cut = cutRopes(state, intent.indices ?? []);
    return { ok: cut.length > 0, detail: "cut", cut };
  }
  if (intent.type === "popBubble") {
    if (state.attached < 0) return { ok: false, detail: "no-bubble" };
    const idx = state.attached;
    state.bubbles[idx].alive = false;
    state.attached = -1;
    emit(state, { type: "pop", index: idx, x: state.candy.x, y: state.candy.y });
    return { ok: true, detail: "pop" };
  }
  if (intent.type === "puff") {
    const c = state.cushions[intent.index];
    if (!c || c.cool > 0) return { ok: false, detail: "cooling" };
    c.active = PUFF_TIME;
    c.cool = PUFF_COOL;
    c.uses += 1;
    emit(state, { type: "puff", index: intent.index });
    return { ok: true, detail: "puff" };
  }
  if (intent.type === "slide") {
    const rope = state.ropes[intent.index];
    if (!rope || !rope.rail || rope.cut) return { ok: false, detail: "no-rail" };
    rope.rail.t = Math.max(0, Math.min(1, intent.t));
    emit(state, { type: "slide", index: intent.index, t: rope.rail.t });
    return { ok: true, detail: "slide" };
  }
  return { ok: false, detail: "unknown" };
}

/** 取出并清空事件队列 */
export function drainEvents(state) {
  const out = state.events;
  state.events = [];
  return out;
}

/** 渲染与求解共用的绳几何：锚点 → 糖果，含松弛下垂量 */
export function ropeGeometry(state, rope) {
  const a = ropeAnchor(rope);
  const c = state.candy;
  const d = dist(a.x, a.y, c.x, c.y);
  const slack = Math.max(0, (rope.elastic ? rope.rest : rope.len) - d);
  const sag = Math.min(slack * 0.55, 90);
  return { ax: a.x, ay: a.y, bx: c.x, by: c.y, sag, tension: rope.elastic ? d - rope.rest : 0, d };
}

/** 星级：仅由收星数决定，UI 不得自算 */
export function starsOf(state) {
  return state.starsTaken;
}
