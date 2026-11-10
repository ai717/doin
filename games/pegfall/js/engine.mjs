// 《弹珠落钉》物理引擎：固定步长圆球刚体 + 圆钉 / 胶囊钉 / 旋转挡板 / 引力场。
// 严格 DOM-free、确定性可重放：同一状态与同一 dt 序列必然得到同一结果。

export const WIDTH = 840;
export const HEIGHT = 560;
export const CANNON_X = 420;
export const CANNON_Y = 46;
export const BALL_RADIUS = 8;
export const PEG_RADIUS = 12;

export const GRAVITY = 900;
export const FIRE_SPEED = 760;
export const PEG_RESTITUTION = 0.86;
export const WALL_RESTITUTION = 0.8;
export const ROTOR_RESTITUTION = 0.74;

export const START_BALLS = 10;
export const AIM_LIMIT = 80;
export const MIN_AIM = -AIM_LIMIT;
export const MAX_AIM = AIM_LIMIT;

export const BUCKET_WIDTH = 120;
export const BUCKET_HEIGHT = 26;
export const BUCKET_Y = HEIGHT - 30;
export const BUCKET_SPEED = 160;
export const BUCKET_AMPLITUDE = WIDTH / 2 - 90;

export const FEVER_DURATION = 2.4;
export const FEVER_BONUS = 100000;
export const FEVER_SCALE = 0.2;

export const POCKET_VALUES = [1000, 5000, 10000, 5000, 1000];

export const PEG_VALUES = Object.freeze({
  blue: 100,
  orange: 500,
  green: 800,
  purple: 1000,
});

export const STATUS_AIM = "aim";
export const STATUS_FLIGHT = "flight";
export const STATUS_FEVER = "fever";
export const STATUS_WON = "won";
export const STATUS_LOST = "lost";

function mulberryStep(seed) {
  let a = (seed + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { seed: a >>> 0, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

function randomOf(state) {
  const { seed, value } = mulberryStep(state.rng);
  state.rng = seed;
  return value;
}

export function clampAim(deg) {
  const value = Number(deg);
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_AIM, Math.max(MIN_AIM, value));
}

export function angleToVector(deg) {
  const rad = (clampAim(deg) * Math.PI) / 180;
  return { x: Math.sin(rad), y: Math.cos(rad) };
}

export function bucketBounds(state) {
  return {
    left: state.bucket.x,
    right: state.bucket.x + BUCKET_WIDTH,
    top: BUCKET_Y,
    bottom: BUCKET_Y + BUCKET_HEIGHT,
  };
}

function pocketAt(x) {
  const slot = Math.min(4, Math.max(0, Math.floor(x / (WIDTH / 5))));
  return { slot, value: POCKET_VALUES[slot] };
}

function clonePeg(peg) {
  return { ...peg };
}

function cloneState(state) {
  return {
    ...state,
    bucket: { ...state.bucket },
    pegs: state.pegs.map(clonePeg),
    rotors: state.rotors.map((rotor) => ({ ...rotor })),
    wells: state.wells.map((well) => ({ ...well })),
    balls: state.balls.map((ball) => ({ ...ball })),
    events: [],
  };
}

export function createState(level, options = {}) {
  if (!level || !Array.isArray(level.pegs)) return null;
  const pegs = level.pegs.map((peg) => ({
    id: peg.id,
    x: peg.x,
    y: peg.y,
    type: peg.type,
    shape: peg.shape ?? "circle",
    radius: peg.shape === "pill" ? (peg.thickness ?? 20) / 2 : (peg.radius ?? PEG_RADIUS),
    length: peg.length ?? 0,
    angle: peg.angle ?? 0,
    hit: false,
    active: true,
  }));
  const orangeTotal = pegs.filter((peg) => peg.type === "orange").length;
  const state = {
    levelId: level.id,
    chapter: level.chapter,
    pegs,
    rotors: (level.rotors ?? []).map((rotor) => ({ ...rotor, angle: rotor.angle ?? 0 })),
    wells: (level.wells ?? []).map((well) => ({ ...well })),
    balls: [],
    aim: 0,
    status: STATUS_AIM,
    ballsLeft: Math.max(1, Math.trunc(options.balls ?? START_BALLS)),
    score: 0,
    combo: 0,
    shotCombo: 0,
    shotHits: 0,
    orangeTotal,
    orangeLeft: orangeTotal,
    bucket: {
      x: WIDTH / 2 - BUCKET_WIDTH / 2,
      phase: options.bucketPhase ?? 0,
    },
    feverElapsed: 0,
    purpleId: null,
    splitUsed: false,
    guideArmed: false,
    shotCount: 0,
    rng: (options.seed ?? 0x9e3779b9) >>> 0,
    events: [],
    tick: 0,
  };
  state.purpleId = pickPurple(state);
  return state;
}

function pickPurple(state) {
  const candidates = state.pegs.filter((peg) => peg.type === "blue" && peg.active && !peg.hit);
  if (!candidates.length) return null;
  const index = Math.floor(randomOf(state) * candidates.length);
  return candidates[index].id;
}

export function setAim(state, deg) {
  if (!state || state.status !== STATUS_AIM) return state;
  const aim = clampAim(deg);
  if (aim === state.aim) return state;
  return { ...state, aim, events: [] };
}

export function adjustAim(state, delta) {
  return setAim(state, (state?.aim ?? 0) + delta);
}

export function fire(state) {
  if (!state || state.status !== STATUS_AIM || state.ballsLeft <= 0) return state;
  const next = cloneState(state);
  next.ballsLeft -= 1;
  next.status = STATUS_FLIGHT;
  next.shotCombo = 0;
  next.shotHits = 0;
  next.shotCount += 1;
  next.splitUsed = false;
  next.guideArmed = false;
  next.feverElapsed = 0;

  const dir = angleToVector(next.aim);
  next.balls.push({
    x: CANNON_X + dir.x * 28,
    y: CANNON_Y + dir.y * 28,
    vx: dir.x * FIRE_SPEED,
    vy: dir.y * FIRE_SPEED,
    radius: BALL_RADIUS,
    alive: true,
  });
  next.purpleId = pickPurple(next);
  next.events.push({ type: "fire", aim: next.aim });
  return next;
}

function closestOnSegment(ball, peg) {
  const rad = (peg.angle * Math.PI) / 180;
  const half = (peg.length || 0) / 2;
  const ax = peg.x - Math.cos(rad) * half;
  const ay = peg.y - Math.sin(rad) * half;
  const bx = peg.x + Math.cos(rad) * half;
  const by = peg.y + Math.sin(rad) * half;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((ball.x - ax) * dx + (ball.y - ay) * dy) / lengthSq));
  return { x: ax + dx * t, y: ay + dy * t };
}

function rotorEndpoints(rotor) {
  const rad = (rotor.angle * Math.PI) / 180;
  const half = (rotor.length ?? 120) / 2;
  return {
    ax: rotor.x - Math.cos(rad) * half,
    ay: rotor.y - Math.sin(rad) * half,
    bx: rotor.x + Math.cos(rad) * half,
    by: rotor.y + Math.sin(rad) * half,
  };
}

function closestOnRotor(ball, rotor) {
  const { ax, ay, bx, by } = rotorEndpoints(rotor);
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((ball.x - ax) * dx + (ball.y - ay) * dy) / lengthSq));
  return { x: ax + dx * t, y: ay + dy * t };
}

// 圆球与静态圆 / 胶囊的弹性反弹；返回是否发生碰撞。
function bounceCircle(ball, cx, cy, radius, restitution, tangentDamping = 0.985) {
  let dx = ball.x - cx;
  let dy = ball.y - cy;
  let dist = Math.hypot(dx, dy);
  const min = ball.radius + radius;
  if (dist >= min) return false;
  if (dist < 0.0001) {
    dx = 0;
    dy = -1;
    dist = 1;
  }
  const nx = dx / dist;
  const ny = dy / dist;
  ball.x = cx + nx * min;
  ball.y = cy + ny * min;
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) {
    ball.vx -= (1 + restitution) * vn * nx;
    ball.vy -= (1 + restitution) * vn * ny;
    const tx = -ny;
    const ty = nx;
    const vt = ball.vx * tx + ball.vy * ty;
    ball.vx += (tangentDamping - 1) * vt * tx;
    ball.vy += (tangentDamping - 1) * vt * ty;
  }
  return true;
}

function markHit(state, peg, ball) {
  if (peg.hit) return;
  peg.hit = true;
  const value = peg.id === state.purpleId ? PEG_VALUES.purple : PEG_VALUES[peg.type] ?? PEG_VALUES.blue;
  state.score += value;
  state.combo += 1;
  state.shotCombo += 1;
  state.shotHits += 1;
  state.events.push({ type: "peg", pegType: peg.type, combo: state.shotCombo, value, x: peg.x, y: peg.y });

  if (peg.type === "orange") {
    state.orangeLeft = Math.max(0, state.orangeLeft - 1);
    if (state.orangeLeft === 0 && state.status === STATUS_FLIGHT) {
      state.status = STATUS_FEVER;
      state.feverElapsed = 0;
      state.events.push({ type: "fever", x: peg.x, y: peg.y });
    }
  } else if (peg.type === "green") {
    if (!state.splitUsed) {
      state.splitUsed = true;
      const speed = Math.hypot(ball.vx, ball.vy) || FIRE_SPEED;
      const angle = Math.atan2(ball.vy, ball.vx) + (Math.PI / 180) * 16;
      state.balls.push({
        x: ball.x,
        y: ball.y,
        vx: Math.cos(angle) * speed * 0.94,
        vy: Math.sin(angle) * speed * 0.94,
        radius: BALL_RADIUS,
        alive: true,
      });
      state.events.push({ type: "split", x: peg.x, y: peg.y });
    } else if (!state.guideArmed) {
      state.guideArmed = true;
      state.events.push({ type: "guide", x: peg.x, y: peg.y });
    }
  }
}

function applyWell(state, ball, dt) {
  for (const well of state.wells) {
    const dx = well.x - ball.x;
    const dy = well.y - ball.y;
    const dist = Math.hypot(dx, dy);
    if (dist > well.radius || dist < 0.001) continue;
    const falloff = 1 - dist / well.radius;
    const force = well.strength * falloff;
    ball.vx += (dx / dist) * force * dt;
    ball.vy += (dy / dist) * force * dt;
  }
}

function collisionPass(state, ball) {
  for (const peg of state.pegs) {
    // 已点亮（hit）的钉子在本次发射中仍然参与碰撞，只有结算后消解（active=false）才移除
    if (!peg.active) continue;
    const closest = peg.shape === "pill" ? closestOnSegment(ball, peg) : { x: peg.x, y: peg.y };
    const hit = bounceCircle(ball, closest.x, closest.y, peg.radius, PEG_RESTITUTION);
    if (hit) markHit(state, peg, ball);
  }
  for (const rotor of state.rotors) {
    const closest = closestOnRotor(ball, rotor);
    bounceCircle(ball, closest.x, closest.y, (rotor.width ?? 14) / 2, ROTOR_RESTITUTION, 0.97);
  }
}

function updateBucket(state, dt) {
  const rate = BUCKET_SPEED / BUCKET_AMPLITUDE;
  state.bucket.phase = (state.bucket.phase + rate * dt) % (Math.PI * 2);
  state.bucket.x = WIDTH / 2 + Math.sin(state.bucket.phase) * BUCKET_AMPLITUDE - BUCKET_WIDTH / 2;
}

function updateRotors(state, dt) {
  for (const rotor of state.rotors) {
    rotor.angle = (rotor.angle + (rotor.speed ?? 0) * dt) % 360;
    if (rotor.angle < 0) rotor.angle += 360;
  }
}

function catchBucket(state, ball) {
  const bounds = bucketBounds(state);
  if (ball.vy <= 0) return false;
  if (ball.y + ball.radius < bounds.top) return false;
  if (ball.y - ball.radius > bounds.bottom) return false;
  return ball.x >= bounds.left && ball.x <= bounds.right;
}

function resolveShot(state) {
  const bonus = state.shotCombo * 50;
  const next = {
    ...state,
    score: state.score + bonus,
    pegs: state.pegs.map((peg) => (peg.hit ? { ...peg, active: false } : peg)),
    balls: [],
    shotCombo: 0,
    shotHits: 0,
    events: [...state.events, { type: "shot-end", hits: state.shotCombo, bonus }],
  };
  if (next.ballsLeft <= 0) {
    next.status = STATUS_LOST;
    next.events.push({ type: "lost" });
  } else {
    next.status = STATUS_AIM;
  }
  return next;
}

// 固定步长物理推进。dt 建议 1/120s；事件数组仅包含本帧。
export function stepFrame(state, dt) {
  if (!state || !Number.isFinite(dt) || dt <= 0) return state;
  if (state.status !== STATUS_FLIGHT && state.status !== STATUS_FEVER) {
    const idle = cloneState(state);
    updateBucket(idle, dt);
    updateRotors(idle, dt);
    idle.tick += 1;
    return idle;
  }

  const next = cloneState(state);
  next.tick += 1;
  updateBucket(next, dt);
  updateRotors(next, dt);

  for (const ball of next.balls) {
    if (!ball.alive) continue;
    applyWell(next, ball, dt);
    ball.vy += GRAVITY * dt;
    ball.vx *= 0.9995;
    ball.vy *= 0.9995;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx) * WALL_RESTITUTION;
    } else if (ball.x + ball.radius > WIDTH) {
      ball.x = WIDTH - ball.radius;
      ball.vx = -Math.abs(ball.vx) * WALL_RESTITUTION;
    }
    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy) * 0.7;
    }

    collisionPass(next, ball);
    collisionPass(next, ball);

    if (next.status === STATUS_FLIGHT || next.status === STATUS_FEVER) {
      if (catchBucket(next, ball)) {
        ball.alive = false;
        next.ballsLeft += 1;
        next.events.push({ type: "bucket", x: ball.x, y: BUCKET_Y });
        continue;
      }
      if (ball.y > HEIGHT + 16) {
        ball.alive = false;
        const pocket = pocketAt(ball.x);
        const value = next.status === STATUS_FEVER ? pocket.value * 10 : pocket.value;
        next.score += value;
        next.events.push({ type: "pocket", slot: pocket.slot, value, x: ball.x, y: HEIGHT - 6 });
      }
    }
  }

  next.balls = next.balls.filter((ball) => ball.alive);

  if (next.status === STATUS_FLIGHT && next.balls.length === 0) {
    return resolveShot(next);
  }
  return next;
}

export function finishFever(state) {
  if (!state || state.status !== STATUS_FEVER) return state;
  return {
    ...state,
    score: state.score + FEVER_BONUS,
    pegs: state.pegs.map((peg) => ({ ...peg, active: false, hit: true })),
    balls: [],
    orangeLeft: 0,
    status: STATUS_WON,
    feverElapsed: FEVER_DURATION,
    events: [...state.events, { type: "fever-end", bonus: FEVER_BONUS }, { type: "win" }],
  };
}

// 狂喜时刻：物理以 0.2 倍速推进，计时按真实秒数累计。
export function advanceFever(state, realDt) {
  if (!state || state.status !== STATUS_FEVER) return state;
  let next = stepFrame(state, realDt * FEVER_SCALE);
  next.feverElapsed = (state.feverElapsed ?? 0) + realDt;
  if (next.feverElapsed >= FEVER_DURATION) next = finishFever(next);
  return next;
}

// 结算一次完整发射，供离线解算与单测复用。返回最终状态（含事件汇总需要时可自行收集）。
export function simulateShot(state, angle, options = {}) {
  const dt = options.dt ?? 1 / 120;
  const maxSteps = options.maxSteps ?? 2400;
  let next = fire(setAim(state, angle));
  if (next === state) return state;
  let steps = 0;
  while (steps < maxSteps && (next.status === STATUS_FLIGHT || next.status === STATUS_FEVER)) {
    next = next.status === STATUS_FEVER ? advanceFever(next, dt) : stepFrame(next, dt);
    steps += 1;
  }
  if (next.status === STATUS_FEVER) next = finishFever(next);
  return next;
}

// 瞄准导轨：以真实弹道推进，返回折线点与第一次反弹点索引。
export function traceAim(state, angle, options = {}) {
  if (!state) return { points: [], firstBounce: -1 };
  const bounces = Math.max(0, Math.trunc(options.bounces ?? 1));
  const dt = 1 / 240;
  const dir = angleToVector(angle);
  const ball = {
    x: CANNON_X + dir.x * 28,
    y: CANNON_Y + dir.y * 28,
    vx: dir.x * FIRE_SPEED,
    vy: dir.y * FIRE_SPEED,
    radius: BALL_RADIUS,
  };
  const points = [{ x: ball.x, y: ball.y }];
  let firstBounce = -1;
  let bouncesLeft = bounces;
  let railAge = 0;
  for (let step = 0; step < 900; step += 1) {
    for (const well of state.wells) {
      const dx = well.x - ball.x;
      const dy = well.y - ball.y;
      const dist = Math.hypot(dx, dy);
      if (dist > well.radius || dist < 0.001) continue;
      const force = well.strength * (1 - dist / well.radius);
      ball.vx += (dx / dist) * force * dt;
      ball.vy += (dy / dist) * force * dt;
    }
    ball.vy += GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx) * WALL_RESTITUTION;
      if (firstBounce < 0) firstBounce = points.length - 1;
    } else if (ball.x + ball.radius > WIDTH) {
      ball.x = WIDTH - ball.radius;
      ball.vx = -Math.abs(ball.vx) * WALL_RESTITUTION;
      if (firstBounce < 0) firstBounce = points.length - 1;
    }
    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy) * 0.7;
      if (firstBounce < 0) firstBounce = points.length - 1;
    }

    let touched = false;
    for (const peg of state.pegs) {
      if (!peg.active) continue;
      const closest = peg.shape === "pill" ? closestOnSegment(ball, peg) : { x: peg.x, y: peg.y };
      if (bounceCircle(ball, closest.x, closest.y, peg.radius, PEG_RESTITUTION)) touched = true;
    }
    for (const rotor of state.rotors) {
      const closest = closestOnRotor(ball, rotor);
      if (bounceCircle(ball, closest.x, closest.y, (rotor.width ?? 14) / 2, ROTOR_RESTITUTION, 0.97)) touched = true;
    }

    if (step % 2 === 0) points.push({ x: ball.x, y: ball.y });

    if (touched) {
      if (firstBounce < 0) firstBounce = points.length - 1;
      if (bouncesLeft <= 0) break;
      bouncesLeft -= 1;
      railAge = 0;
    }
    if (firstBounce >= 0) {
      railAge += dt;
      if (railAge > 0.12 || bouncesLeft < bounces) {
        // 只保留短暂反弹预测段
        if (railAge > 0.28) break;
      }
    }
    if (ball.y > HEIGHT || points.length > 260) break;
  }
  return { points, firstBounce };
}
