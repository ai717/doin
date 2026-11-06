// 霓虹弹珠台 · 核心规则与固定步长物理引擎（DOM-free 纯逻辑）
// 绝对禁止访问 window / document / localStorage。
// 物理契约：固定步长 FIXED_DT 纯函数帧步进 stepFrame(state, dt, inputs)，
// 状态完全由「输入序列 + 随机种子」决定，同种子可逐帧重放；高速球 CCD 子步进防穿模。

import { COLS, BRICK_CELL_W, BRICK_CELL_H, WALL_TOP, LEVELS, SURVIVAL_ROWS } from "./levels.mjs";

// ---- 机台几何 ----
export const W = 600;
export const H = 800;
export const CX = W / 2;
export const BALL_R = 9;
export const FIXED_DT = 1 / 120;

// ---- 物理参数 ----
export const GRAVITY = 900;
export const MAX_BALL_SPEED = 1100;
export const LAUNCH_SPEED = 880;
export const WALL_RESTITUTION = 0.85;
export const APRON_RESTITUTION = 0.72;
export const FLIPPER_RESTITUTION = 0.9;
export const FLIPPER_LIVE_KICK = 1120;   // 按下挡板即弹射的向上活踢速度 px/s（足以上到砖墙）
export const FLIPPER_KICK_COOLDOWN = 0.25; // 活踢冷却，防止球停在板上抖动连踢
export const RAMP_RESTITUTION = 0.55;

// ---- 挡板（双挡板：左右独立短打，绕外端枢轴旋转）----
export const FLIPPER_LEN = 96;
export const FLIPPER_PIVOT_Y = H - 34;
export const FLIPPER_PIVOT_DX = 84;
export const FLIPPER_REST_ANGLE = 0.9;    // 弧度，待机位板尖下探成排水 V 口（经典弹珠台）
export const FLIPPER_RAISED_ANGLE = -0.62; // 弧度，抬升位板尖近贴合护中（弹射）
export const FLIPPER_PRESS_RATE = 16;     // 按下抬升角速度 rad/s（约 71ms 抬起到位）
export const FLIPPER_RELEASE_RATE = 7.6;  // 松手回落角速度 rad/s（约 150ms 自然回落）
export const FLIPPER_BOOST_EXTRA = 14;    // 「挡板伸长」奖励加长 px
export const FLIPPER_BOOST_DURATION = 8;  // 秒

// ---- 连击与计分 ----
export const COMBO_WINDOW = 3.0;           // 命中间隔超过则连击中断
export const COMBO_MULT_BASE = 0.5;        // 倍率 = 1 + 连击 × 0.5
export const COMBO_MULT_CAP = 10;
export const BRICK_HP = { G: 1, S: 2, A: 3 };
export const BRICK_SCORE = { G: 10, S: 25, A: 50 };
export const MECH_SCORE = { bumper: 15, sling: 20, target: 30, spinner: 10, rollover: 25, ramp: 100, allTargets: 200 };
export const STORM_COMBO = 10;             // 10 连击触发砖块风暴
export const SLING_IGNITE_COMBO = 5;       // 5 连击点燃侧弹射器
export const SLING_KICK = 430;
export const SLING_KICK_IGNITED = 645;
export const BUMPER_KICK = 620;
export const FRENZY_DURATION = 5;          // 缓冲狂潮秒数（缓冲得分 ×2）

// ---- 排水区几何（空白区陷阱）----
export const DRAIN_Y = H - 4;
export const APRON_Y = H - 14;
export const CENTER_GAP_HALF = 34;
export const OUTLANE_W = 36;
export const OUTLANE_POST_R = 8; // 出球口挡柱：把贴墙滚珠弹回挡板区（经典弹珠台设计）

// ---- 模式 ----
export const MODE = { STAGE: "stage", SURVIVAL: "survival" };

export const MAX_BALLS = 2; // 双球乱舞上限

// 确定性种子 PRNG（mulberry32，状态为纯数据可 JSON 克隆/重放）
// 兼容传整个 state（读 state.rng）或直接传 rng 对象
export function rngNext(state) {
  const r = state.rng ?? state;
  let a = (r.a | 0) + 0x6d2b79f5;
  r.a = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function mulberrySeed(seed) {
  return { a: (seed ^ 0x9e3779b9) >>> 0 };
}

// 可解性校验：行模板每列至少存在一个空位（垂直通道），弹珠必可达全部砖区
export function checkLevelSolvable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, reason: "empty rows" };
  let brickCount = 0;
  for (const row of rows) {
    if (typeof row !== "string" || row.length !== COLS) return { ok: false, reason: `bad row length: ${row}` };
    for (const ch of row) if (ch !== ".") brickCount += 1;
  }
  if (brickCount === 0) return { ok: false, reason: "no bricks" };
  for (let col = 0; col < COLS; col++) {
    let hasGap = false;
    for (const row of rows) if (row[col] === ".") { hasGap = true; break; }
    if (!hasGap) return { ok: false, reason: `column ${col} fully sealed` };
  }
  return { ok: true, reason: "ok" };
}

// 行模板 → 砖块对象 + 簇统计（簇 = 同一行的连续砖块段，清空一簇触发随机奖励）
function buildBricks(rows) {
  const bricks = [];
  const wallX = (W - COLS * BRICK_CELL_W) / 2;
  const clusters = {};
  let id = 0;
  rows.forEach((row, r) => {
    let runStart = -1;
    for (let c = 0; c <= row.length; c++) {
      const ch = c < row.length ? row[c] : ".";
      const inBrick = ch !== ".";
      if (inBrick && runStart < 0) runStart = c;
      if (!inBrick && runStart >= 0) {
        const cluster = `${r}:${runStart}`;
        clusters[cluster] = (clusters[cluster] || 0) + (c - runStart);
        for (let cc = runStart; cc < c; cc++) {
          const tier = row[cc];
          bricks.push({
            id: id++,
            col: cc,
            row: r,
            x: wallX + cc * BRICK_CELL_W + 2,
            y: WALL_TOP + r * BRICK_CELL_H + 2,
            w: BRICK_CELL_W - 4,
            h: BRICK_CELL_H - 4,
            tier,
            hp: BRICK_HP[tier],
            score: BRICK_SCORE[tier],
            cluster,
            flash: 0
          });
        }
        runStart = -1;
      }
    }
  });
  return { bricks, clusters, bricksRemaining: bricks.length };
}

// 关卡机关实例（按章节配置固定摆放，sling 侧弹射器为常驻机件）
function buildMechanisms(mechs) {
  return {
    bumpers: (mechs.bumpers || []).map(([x, y]) => ({ x, y, r: 16, cool: 0, flash: 0 })),
    targets: (mechs.targets || []).map(([x, y]) => ({ x, y, w: 16, h: 54, down: false, cool: 0, flash: 0 })),
    spinner: mechs.spinner ? { x: mechs.spinner[0], y: mechs.spinner[1], r: 20, cool: 0, flash: 0 } : null,
    ramp: mechs.ramp
      ? { p1: { x: mechs.ramp.p1[0], y: mechs.ramp.p1[1] }, p2: { x: mechs.ramp.p2[0], y: mechs.ramp.p2[1] }, zone: { x: mechs.ramp.zone[0], y: mechs.ramp.zone[1] }, cool: 0, used: false }
      : null,
    rollovers: mechs.rollovers ? { y: mechs.rollovers.y, left: mechs.rollovers.left, right: mechs.rollovers.right, cool: 0 } : null,
    slings: [
      { x: 78, y: H - 122, r: 14, side: "L", cool: 0, flash: 0 },
      { x: W - 78, y: H - 122, r: 14, side: "R", cool: 0, flash: 0 }
    ]
  };
}

function buildFlippers() {
  return [
    { side: "L", pivot: { x: CX - FLIPPER_PIVOT_DX, y: FLIPPER_PIVOT_Y }, len: FLIPPER_LEN, angle: FLIPPER_REST_ANGLE, prevAngle: FLIPPER_REST_ANGLE, pressed: false, prevPressed: false, kickCool: 0, kickedThisPress: false },
    { side: "R", pivot: { x: CX + FLIPPER_PIVOT_DX, y: FLIPPER_PIVOT_Y }, len: FLIPPER_LEN, angle: FLIPPER_REST_ANGLE, prevAngle: FLIPPER_REST_ANGLE, pressed: false, prevPressed: false, kickCool: 0, kickedThisPress: false }
  ];
}

// 出球口弹射挡柱（每侧三根纵向布防，贴墙布置在挡板上方，防贴墙滚珠与斜穿沟口）
export const OUTLANE_POSTS = [
  { side: "L", x: 18, y: H - 92 },
  { side: "L", x: 18, y: H - 52 },
  { side: "L", x: 18, y: H - 24 },
  { side: "R", x: W - 18, y: H - 92 },
  { side: "R", x: W - 18, y: H - 52 },
  { side: "R", x: W - 18, y: H - 24 }
];

// 街机生存模式：确定性生成 7 行砖墙（60% 玻璃 / 30% 钢铁 / 10% 黄金，25% 空位，保证列通道）
function fillSurvivalRows(rngState) {
  const rows = [];
  const colEmpty = new Array(COLS).fill(false);
  const grid = [];
  for (let r = 0; r < SURVIVAL_ROWS; r++) {
    const line = [];
    for (let c = 0; c < COLS; c++) {
      const roll = rngNext(rngState);
      let ch = ".";
      if (roll > 0.25) {
        const tier = rngNext(rngState);
        ch = tier < 0.6 ? "G" : tier < 0.9 ? "S" : "A";
      } else {
        colEmpty[c] = true;
      }
      line.push(ch);
    }
    grid.push(line);
  }
  // 通道保证：任一列全填则把随机一格改空（确定性）
  for (let c = 0; c < COLS; c++) {
    if (!colEmpty[c]) {
      const r = Math.floor(rngNext(rngState) * SURVIVAL_ROWS);
      grid[r][c] = ".";
    }
  }
  return grid.map((line) => line.join(""));
}

// ---- 初始状态 ----
export function createInitialState(options = {}) {
  const mode = options.mode === MODE.SURVIVAL ? MODE.SURVIVAL : MODE.STAGE;
  const seed = Number.isFinite(options.seed) ? options.seed : 42;
  const rng = mulberrySeed(seed);

  let level = null;
  let rows;
  let mechs;
  if (mode === MODE.STAGE) {
    const levelId = Number.isInteger(options.levelId) && options.levelId >= 1 && options.levelId <= LEVELS.length ? options.levelId : 1;
    level = LEVELS[levelId - 1];
    const solvable = checkLevelSolvable(level.rows);
    if (!solvable.ok) throw new Error(`level ${levelId} not solvable: ${solvable.reason}`);
    rows = level.rows;
    mechs = level.mechs;
  } else {
    rows = fillSurvivalRows(rng);
    mechs = { bumpers: [[240, 310], [360, 310]], targets: [[260, 380], [300, 380], [340, 380]], spinner: null, ramp: null, rollovers: null };
  }

  const built = buildBricks(rows);
  return {
    mode,
    seed,
    rng,
    levelId: level ? level.id : 0,
    level,
    status: "serving", // 'serving' | 'playing' | 'cleared' | 'failed' | 'over'
    ballsRemaining: options.balls ?? 3,
    balls: [],
    bricks: built.bricks,
    clusters: built.clusters,
    bricksRemaining: built.bricksRemaining,
    mechs: buildMechanisms(mechs),
    flippers: buildFlippers(),
    score: 0,
    combo: 0,
    maxCombo: 0,
    comboTimer: 0,
    stageTimer: 0,
    frenzyTimer: 0,
    flipperBoostTimer: 0,
    flipperBoost: 0,
    speedBoost: 0,
    ballSave: false,
    slingIgnited: false,
    comboStormFired: false,
    stormCount: 0,
    bricksCleared: 0,
    stars: 0,
    prevNudge: 0,
    lastEffect: null,
    cleared: false
  };
}

// 重新开始当前关卡/模式
export function restartStage(state) {
  const fresh = createInitialState({ mode: state.mode, levelId: state.levelId, seed: state.seed, balls: 3 });
  return fresh;
}

// ---- 发射（仅 serving 状态合法；power 0..1，按住蓄力松开发射）----
export function launchBall(state, power = 1) {
  if (state.status !== "serving") return false;
  if (state.balls.length !== 0) return false;
  const p = Math.max(0, Math.min(1, power));
  const vy = -(420 + p * LAUNCH_SPEED);
  const vx = (rngNext(state) - 0.5) * 60;
  const x = CX + (rngNext(state) - 0.5) * 40;
  state.balls.push({ x, y: H - 150, vx, vy, radius: BALL_R, trail: [], nudges: 0, lastBrick: -1 });
  state.status = "playing";
  return true;
}

// ---- 帧步进（固定步长）----
export function stepFrame(state, dt, inputs = {}) {
  if (state.status === "cleared" || state.status === "failed" || state.status === "over") {
    return { state, events: [] };
  }
  const events = [];
  const next = clone(state);

  // 1. 计时器
  if (next.frenzyTimer > 0) {
    next.frenzyTimer -= dt;
    if (next.frenzyTimer <= 0) events.push({ type: "frenzy_off" });
  }
  if (next.flipperBoostTimer > 0) {
    next.flipperBoostTimer -= dt;
    if (next.flipperBoostTimer <= 0) { next.flipperBoost = 0; }
  }
  if (next.comboTimer > 0) {
    next.comboTimer -= dt;
    if (next.comboTimer <= 0) resetCombo(next, events);
  }
  if (next.status === "playing" && next.mode === MODE.STAGE) next.stageTimer += dt;

  // 2. 挡板角度与表面速度
  stepFlippers(next, dt, inputs);

  // 3. 摇机（每球限 3 次）
  const nudgeOn = inputs.nudge ? 1 : 0;
  if (nudgeOn === 1 && next.prevNudge === 0) {
    const dir = rngNext(next) < 0.5 ? -1 : 1;
    let applied = false;
    for (const ball of next.balls) {
      if (ball.nudges < 3) { ball.vx += dir * 90; ball.nudges += 1; applied = true; }
    }
    if (applied) events.push({ type: "nudge", dir });
  }
  next.prevNudge = nudgeOn;

  // 4. 球体物理（CCD 子步进 + 全碰撞）
  for (let i = next.balls.length - 1; i >= 0; i--) {
    const ball = next.balls[i];
    stepBall(next, ball, dt, events);
    if (!next.balls.includes(ball)) continue; // 该球已排水移除
  }

  // 4.5 机关冷却与闪光衰减（供渲染层绘制点亮效果）
  decayMechanisms(next, dt);

  // 5. 清场判定（含风暴砖）
  if (next.status === "playing" && next.bricksRemaining === 0) {
    next.status = "cleared";
    next.stars = computeStars(next);
    events.push({ type: "stage_clear", stars: next.stars, time: next.stageTimer, maxCombo: next.maxCombo });
  }

  return { state: next, events };
}

function stepBall(state, ball, dt, events) {
  ball.vy += GRAVITY * dt;
  clampSpeed(ball, state);

  ball.trail.push({ x: ball.x, y: ball.y });
  if (ball.trail.length > 10) ball.trail.shift();

  // CCD 子步进：每步位移不超过 4px，高速绝不穿模
  const speed = Math.hypot(ball.vx, ball.vy) || 1;
  const steps = Math.max(1, Math.ceil((speed * dt) / 4));
  const subDt = dt / steps;

  for (let s = 0; s < steps; s++) {
    ball.x += ball.vx * subDt;
    ball.y += ball.vy * subDt;
    collideWallsAndDrain(state, ball, events);
    if (!state.balls.includes(ball)) return;
    collideOutlanePosts(state, ball, events);
    collideBricks(state, ball, events);
    collideMechanisms(state, ball, events);
    collideFlippers(state, ball, dt, events);
  }
}

// 出球口弹射挡柱（圆撞圆 + 定向救球踢：把贴墙滚珠斜向抛回挡板区，经典弹珠台侧柱设计）
function collideOutlanePosts(state, ball, events) {
  for (const post of OUTLANE_POSTS) {
    const dx = ball.x - post.x, dy = ball.y - post.y;
    const dist = Math.hypot(dx, dy);
    const rr = OUTLANE_POST_R + ball.radius;
    if (dist >= rr) continue;
    const nx = dist > 0 ? dx / dist : (post.side === "R" ? -1 : 1);
    const ny = dist > 0 ? dy / dist : -1;
    ball.x = post.x + nx * rr;
    ball.y = post.y + ny * rr;
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) {
      // 定向救球：贴墙下落（x 深入边沟且向下）时斜抛回场内
      const deepSide = (post.side === "R" && ball.x > W - OUTLANE_W) || (post.side === "L" && ball.x < OUTLANE_W);
      if (deepSide && ball.vy > 0) {
        const dir = post.side === "R" ? -1 : 1;
        const kx = dir * (380 + rngNext(state) * 140);
        const ky = -(260 + rngNext(state) * 120);
        ball.vx = kx;
        ball.vy = ky;
      } else {
        ball.vx -= (1 + 0.9) * vn * nx;
        ball.vy -= (1 + 0.9) * vn * ny;
      }
      onWallTouch(state, events);
      events.push({ type: "post", side: post.side });
    }
  }
}

// 四壁、机台裙边与排水空白区
function collideWallsAndDrain(state, ball, events) {
  if (ball.x - ball.radius < 0) {
    ball.x = ball.radius; ball.vx = Math.abs(ball.vx) * WALL_RESTITUTION;
    onWallTouch(state, events);
  } else if (ball.x + ball.radius > W) {
    ball.x = W - ball.radius; ball.vx = -Math.abs(ball.vx) * WALL_RESTITUTION;
    onWallTouch(state, events);
  }
  if (ball.y - ball.radius < 0) {
    ball.y = ball.radius; ball.vy = Math.abs(ball.vy) * WALL_RESTITUTION;
    onWallTouch(state, events);
  }
  if (ball.y + ball.radius > DRAIN_Y) {
    const inSlot = ball.x < OUTLANE_W || ball.x > W - OUTLANE_W || Math.abs(ball.x - CX) < CENTER_GAP_HALF;
    if (inSlot) {
      drainBall(state, ball, events);
      return;
    }
    // 裙边回弹（保留横向动量，给再次接球机会）
    ball.y = APRON_Y - ball.radius;
    ball.vy = -Math.abs(ball.vy) * APRON_RESTITUTION;
    onWallTouch(state, events);
  }
}

function onWallTouch(state, events) {
  if (state.combo > 0) resetCombo(state, events);
}

function drainBall(state, ball, events) {
  const idx = state.balls.indexOf(ball);
  if (idx >= 0) state.balls.splice(idx, 1);
  events.push({ type: "drain", x: ball.x, y: ball.y });
  if (state.ballSave) {
    state.ballSave = false;
    const x = CX + (rngNext(state) - 0.5) * 40;
    state.balls.push({ x, y: H - 150, vx: 0, vy: -260, radius: BALL_R, trail: [], nudges: 0, lastBrick: -1 });
    events.push({ type: "ball_saved" });
    return;
  }
  state.ballsRemaining -= 1;
  if (state.ballsRemaining <= 0) {
    state.status = state.mode === MODE.STAGE ? "failed" : "over";
    events.push({ type: state.mode === MODE.STAGE ? "stage_fail" : "game_over", score: state.score, maxCombo: state.maxCombo, clearedBricks: state.bricksCleared });
  } else if (state.balls.length === 0) {
    state.status = "serving";
    events.push({ type: "ball_lost", ballsRemaining: state.ballsRemaining });
  }
}

// 砖块碰撞（圆 vs 矩形，速度方向朝砖才计伤害；碎砖计分并减簇计数）
function collideBricks(state, ball, events) {
  for (const brick of state.bricks) {
    if (brick.hp <= 0) continue;
    const closest = clampToRect(ball.x, ball.y, brick);
    const dx = ball.x - closest.x;
    const dy = ball.y - closest.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= ball.radius * ball.radius) continue;
    const d = Math.sqrt(d2) || 1;
    const nx = dx / d, ny = dy / d;
    ball.x = closest.x + nx * ball.radius;
    ball.y = closest.y + ny * ball.radius;
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) {
      ball.vx -= (1 + 0.92) * vn * nx;
      ball.vy -= (1 + 0.92) * vn * ny;
      if (brick.flash <= 0) {
        brick.flash = 0.12;
        brick.hp -= 1;
        bumpCombo(state, events);
        events.push({ type: "brick_hit", tier: brick.tier, hp: brick.hp, x: brick.x, y: brick.y });
        if (brick.hp <= 0) {
          brickBreak(state, brick, ball, events);
        }
      }
    }
  }
}

function brickBreak(state, brick, ball, events) {
  brick.hp = 0;
  state.bricksRemaining -= 1;
  state.bricksCleared += 1;
  const mult = comboMult(state);
  const gain = Math.round(brick.score * mult);
  state.score += gain;
  state.clusters[brick.cluster] -= 1;
  events.push({ type: "brick_broken", tier: brick.tier, score: gain, mult, x: brick.x, y: brick.y });
  if (state.clusters[brick.cluster] === 0) {
    clusterReward(state, events, brick.cluster);
  }
}

// 机关：缓冲 / 侧弹射 / 可翻倒靶 / 转盘 / 滚道 / 斜坡
function collideMechanisms(state, ball, events) {
  // 弹跳缓冲
  for (const b of state.mechs.bumpers) {
    const dx = ball.x - b.x, dy = ball.y - b.y;
    const dist = Math.hypot(dx, dy);
    const rr = b.r + ball.radius;
    if (dist < rr && b.cool <= 0) {
      const nx = dist > 0 ? dx / dist : 0, ny = dist > 0 ? dy / dist : -1;
      if (ball.vx * nx + ball.vy * ny < 0 || dist < rr * 0.6) {
        // 真实弹跳缓冲：无论来向一律向上弹出（带横向散布），球从下方撞来也能弹进砖墙
        const spread = (rngNext(state) - 0.5) * 0.9;
        const ang = -Math.PI / 2 + spread;
        ball.vx = Math.cos(ang) * BUMPER_KICK + nx * 40;
        ball.vy = Math.sin(ang) * BUMPER_KICK;
        b.cool = 0.18;
        b.flash = 0.25;
        bumpCombo(state, events);
        const gain = Math.round(MECH_SCORE.bumper * comboMult(state) * (state.frenzyTimer > 0 ? 2 : 1));
        state.score += gain;
        events.push({ type: "bumper", score: gain, x: b.x, y: b.y, frenzy: state.frenzyTimer > 0 });
      }
    }
  }
  // 侧弹射器（5 连击点燃后踢速 ×1.5）
  for (const s of state.mechs.slings) {
    if (s.cool > 0) continue;
    const dx = ball.x - s.x, dy = ball.y - s.y;
    const dist = Math.hypot(dx, dy);
    const rr = s.r + ball.radius;
    if (dist < rr) {
      const nx = dist > 0 ? dx / dist : 0, ny = dist > 0 ? dy / dist : -1;
      if (ball.vx * nx + ball.vy * ny < 0 || dist < rr * 0.6) {
        const ignited = state.combo >= SLING_IGNITE_COMBO;
        const kick = ignited ? SLING_KICK_IGNITED : SLING_KICK;
        ball.vx = nx * kick;
        ball.vy = ny * kick;
        s.cool = 0.22;
        s.flash = 0.25;
        bumpCombo(state, events);
        const gain = Math.round(MECH_SCORE.sling * comboMult(state));
        state.score += gain;
        events.push({ type: "sling", score: gain, ignited, x: s.x, y: s.y });
      }
    }
  }
  // 可翻倒靶
  for (const t of state.mechs.targets) {
    if (t.down || t.cool > 0) continue;
    const closest = clampToRect(ball.x, ball.y, t);
    const dx = ball.x - closest.x, dy = ball.y - closest.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= ball.radius * ball.radius) continue;
    const d = Math.sqrt(d2) || 1;
    const nx = dx / d, ny = dy / d;
    if (ball.vx * nx + ball.vy * ny >= 0) continue;
    ball.x = closest.x + nx * ball.radius;
    ball.y = closest.y + ny * ball.radius;
    ball.vx -= 2 * (ball.vx * nx) * nx;
    ball.vy -= 2 * (ball.vy * ny) * ny;
    t.down = true;
    t.flash = 0.25;
    bumpCombo(state, events);
    const gain = Math.round(MECH_SCORE.target * comboMult(state));
    state.score += gain;
    events.push({ type: "target_down", score: gain, x: t.x, y: t.y });
    if (state.mechs.targets.every((tt) => tt.down)) {
      state.score += MECH_SCORE.allTargets;
      events.push({ type: "all_targets", score: MECH_SCORE.allTargets });
      dropTargetReward(state, events);
    }
  }
  // 转盘（软碰撞微加速）
  const spinner = state.mechs.spinner;
  if (spinner && spinner.cool <= 0) {
    const dx = ball.x - spinner.x, dy = ball.y - spinner.y;
    const dist = Math.hypot(dx, dy);
    const rr = spinner.r + ball.radius;
    if (dist < rr) {
      const nx = dist > 0 ? dx / dist : 0, ny = dist > 0 ? dy / dist : -1;
      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0 || dist < rr * 0.5) {
        ball.vx -= (1 + 1.06) * vn * nx;
        ball.vy -= (1 + 1.06) * vn * ny;
        ball.vx += nx * 30;
        ball.vy += ny * 30;
        spinner.cool = 0.25;
        spinner.flash = 0.2;
        bumpCombo(state, events);
        const gain = Math.round(MECH_SCORE.spinner * comboMult(state));
        state.score += gain;
        events.push({ type: "spinner", score: gain, x: spinner.x, y: spinner.y });
        clampSpeed(ball, state);
      }
    }
  }
  // 滚道感应（第三章节）：弹珠自上而下穿过感应带 → 特效转盘
  const roll = state.mechs.rollovers;
  if (roll && roll.cool <= 0 && ball.vy > 0) {
    const inBand = ball.y > roll.y - 8 && ball.y < roll.y + 8;
    const inLane = (ball.x > roll.left[0] && ball.x < roll.left[1]) || (ball.x > roll.right[0] && ball.x < roll.right[1]);
    if (inBand && inLane) {
      roll.cool = 1.2;
      bumpCombo(state, events);
      state.score += MECH_SCORE.rollover * comboMult(state);
      events.push({ type: "rollover", score: MECH_SCORE.rollover * comboMult(state) });
      triggerEffectWheel(state, events);
    }
  }
  // 斜坡通道：高速上冲触发完成判定（每关首次返还 1 颗弹珠）
  const ramp = state.mechs.ramp;
  if (ramp && ramp.cool <= 0) {
    const dzx = ball.x - ramp.zone.x, dzy = ball.y - ramp.zone.y;
    if (Math.hypot(dzx, dzy) < 26 && ball.vy < -120) {
      ramp.cool = 1.0;
      bumpCombo(state, events);
      const gain = Math.round(MECH_SCORE.ramp * comboMult(state));
      state.score += gain;
      events.push({ type: "ramp", score: gain, x: ramp.zone.x, y: ramp.zone.y });
      if (!ramp.used && state.ballsRemaining < 3) {
        ramp.used = true;
        state.ballsRemaining += 1;
        events.push({ type: "ball_restored", ballsRemaining: state.ballsRemaining });
      }
    }
    // 斜坡作为实体斜面
    collideBallSegment(ball, ramp.p1.x, ramp.p1.y, ramp.p2.x, ramp.p2.y, RAMP_RESTITUTION, 0, 0);
  }
}

// 双挡板（带表面速度的刚体碰撞：抬升瞬间板面把弹珠勺起）
function collideFlippers(state, ball, dt, events) {
  for (const f of state.flippers) {
    const len = f.len;
    const ax = f.pivot.x, ay = f.pivot.y;
    const ca = Math.cos(f.angle), sa = Math.sin(f.angle);
    const bx = f.side === "L" ? ax + len * ca : ax - len * ca;
    const by = ay + len * sa;
    const closest = closestOnSegment(ball.x, ball.y, ax, ay, bx, by);
    const dx = ball.x - closest.x, dy = ball.y - closest.y;
    const d = Math.hypot(dx, dy);
    if (d >= ball.radius) continue;
    const nx = d > 0 ? dx / d : 0, ny = d > 0 ? dy / d : 1;
    ball.x = closest.x + nx * ball.radius;
    ball.y = closest.y + ny * ball.radius;
    // 表面速度：板尖旋转线速度（抬升时向上）+ 按下活踢（球接触瞬间一键勺回墙区）
    const s = Math.hypot(closest.x - ax, closest.y - ay);
    const omega = (f.angle - f.prevAngle) / dt;
    const perpX = f.side === "L" ? -sa : sa;
    const perpY = f.side === "L" ? ca : ca;
    let surfVx = omega * s * perpX;
    let surfVy = omega * s * perpY;
    let liveKick = false;
    if (f.pressed && !f.kickedThisPress && f.kickCool <= 0) {
      surfVx += (f.side === "L" ? -1 : 1) * 30; // 横向仅轻微修正，救球主体竖直向上
      surfVy -= FLIPPER_LIVE_KICK;
      liveKick = true;
    }
    const rvx = ball.vx - surfVx, rvy = ball.vy - surfVy;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      const j = -(1 + FLIPPER_RESTITUTION) * vn;
      ball.vx = rvx + j * nx + surfVx;
      ball.vy = rvy + j * ny + surfVy;
      if (state.combo > 0) resetCombo(state, events);
      if (liveKick) {
        f.kickCool = FLIPPER_KICK_COOLDOWN;
        f.kickedThisPress = true;
        events.push({ type: "flipper_hit", side: f.side, kick: true });
      } else {
        events.push({ type: "flipper_hit", side: f.side });
      }
      clampSpeed(ball, state);
    }
  }
}

function stepFlippers(state, dt, inputs) {
  for (const f of state.flippers) {
    if (f.kickCool > 0) f.kickCool -= dt;
    f.prevPressed = f.pressed;
    f.pressed = f.side === "L" ? !!inputs.flipL : !!inputs.flipR;
    if (f.pressed && !f.prevPressed) f.kickedThisPress = false; // 每次按压只允许一次活踢
    f.prevAngle = f.angle;
    const pressed = f.side === "L" ? Boolean(inputs.flipL) : Boolean(inputs.flipR);
    f.pressed = pressed;
    const target = pressed ? FLIPPER_RAISED_ANGLE : FLIPPER_REST_ANGLE;
    const rate = pressed ? FLIPPER_PRESS_RATE : FLIPPER_RELEASE_RATE;
    const maxDelta = rate * dt;
    const delta = clamp(target - f.angle, -maxDelta, maxDelta);
    f.angle += delta;
    f.len = FLIPPER_LEN + (state.flipperBoostTimer > 0 ? state.flipperBoost : 0);
  }
}

// 特效转盘（滚道触发）：双球乱舞 / 砖块风暴 / 缓冲狂潮 / 救球罩
function triggerEffectWheel(state, events) {
  const candidates = ["multiball", "storm", "frenzy", "save"];
  let pick = candidates[Math.floor(rngNext(state) * candidates.length)];
  for (let i = 0; i < 4; i++) {
    if (pick === "multiball" && state.balls.length >= MAX_BALLS) { pick = candidates[Math.floor(rngNext(state) * candidates.length)]; continue; }
    break;
  }
  state.lastEffect = pick;
  if (pick === "multiball") {
    const x = CX - 70 + (rngNext(state) - 0.5) * 20;
    state.balls.push({ x, y: H - 150, vx: (rngNext(state) - 0.5) * 120, vy: -380, radius: BALL_R, trail: [], nudges: 0, lastBrick: -1 });
    events.push({ type: "effect", effect: "multiball" });
  } else if (pick === "storm") {
    addStormRow(state, events);
    events.push({ type: "effect", effect: "storm" });
  } else if (pick === "frenzy") {
    state.frenzyTimer = FRENZY_DURATION;
    events.push({ type: "effect", effect: "frenzy" });
  } else if (pick === "save") {
    state.ballSave = true;
    events.push({ type: "effect", effect: "save" });
  }
}

// 砖块风暴：砖墙顶部追加一层脆化玻璃砖（至少留 2 个通道空位）
export function addStormRow(state, events) {
  const line = new Array(COLS).fill("G");
  const gaps = [Math.floor(rngNext(state) * COLS), Math.floor(rngNext(state) * COLS)];
  line[gaps[0]] = ".";
  if (gaps[1] !== gaps[0]) line[gaps[1]] = ".";
  const wallX = (W - COLS * BRICK_CELL_W) / 2;
  const row = 0;
  let start = -1;
  const newBricks = [];
  for (let c = 0; c <= COLS; c++) {
    const ch = c < COLS ? line[c] : ".";
    if (ch !== "." && start < 0) start = c;
    if (ch === "." && start >= 0) {
      const cluster = `${row}:${start}`;
      state.clusters[cluster] = (state.clusters[cluster] || 0) + (c - start);
      for (let cc = start; cc < c; cc++) {
        const brick = {
          id: state.bricks.length ? Math.max(...state.bricks.map((b) => b.id)) + 1 : 0,
          col: cc,
          row,
          x: wallX + cc * BRICK_CELL_W + 2,
          y: WALL_TOP + row * BRICK_CELL_H + 2,
          w: BRICK_CELL_W - 4,
          h: BRICK_CELL_H - 4,
          tier: "G",
          hp: BRICK_HP.G,
          score: BRICK_SCORE.G,
          cluster,
          flash: 0
        };
        newBricks.push(brick);
      }
      start = -1;
    }
  }
  // 旧砖整体下移一行（为风暴层腾位，越界则丢弃最底行）
  for (const b of state.bricks) {
    b.row += 1;
    b.y += BRICK_CELL_H;
    b.cluster = `${b.row}:${b.col}`;
  }
  state.clusters = {};
  for (const b of state.bricks) {
    state.clusters[b.cluster] = (state.clusters[b.cluster] || 0) + 1;
  }
  for (const b of newBricks) {
    state.bricks.push(b);
    state.clusters[b.cluster] = (state.clusters[b.cluster] || 0) + 1;
  }
  state.bricksRemaining += newBricks.length;
  state.stormCount += 1;
  events.push({ type: "storm_row", count: newBricks.length });
}

// 清空一簇砖的随机奖励
function clusterReward(state, events, cluster) {
  const kind = ["combo", "flipper", "speed"][Math.floor(rngNext(state) * 3)];
  if (kind === "combo") {
    bumpCombo(state, events);
    bumpCombo(state, events);
    bumpCombo(state, events);
    events.push({ type: "cluster_reward", reward: "combo+3", cluster });
  } else if (kind === "flipper") {
    state.flipperBoostTimer = FLIPPER_BOOST_DURATION;
    state.flipperBoost = FLIPPER_BOOST_EXTRA;
    events.push({ type: "cluster_reward", reward: "flipper", cluster });
  } else {
    state.speedBoost += 60;
    events.push({ type: "cluster_reward", reward: "speed", cluster });
  }
}

// 全靶奖励的随机特效
function dropTargetReward(state, events) {
  const kind = ["combo", "flipper", "speed"][Math.floor(rngNext(state) * 3)];
  if (kind === "combo") {
    bumpCombo(state, events);
    bumpCombo(state, events);
    events.push({ type: "target_reward", reward: "combo+2" });
  } else if (kind === "flipper") {
    state.flipperBoostTimer = FLIPPER_BOOST_DURATION;
    state.flipperBoost = FLIPPER_BOOST_EXTRA;
    events.push({ type: "target_reward", reward: "flipper" });
  } else {
    state.speedBoost += 60;
    events.push({ type: "target_reward", reward: "speed" });
  }
}

function bumpCombo(state, events) {
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.comboTimer = COMBO_WINDOW;
  events.push({ type: "combo_up", combo: state.combo, mult: comboMult(state) });
  // 10 连击自动触发砖块风暴（章节模式每关一次，生存模式每段连击一次）
  if (state.combo >= STORM_COMBO && !state.comboStormFired) {
    state.comboStormFired = true;
    addStormRow(state, events);
    events.push({ type: "effect", effect: "storm", source: "combo" });
  }
}

function resetCombo(state, events) {
  if (state.combo > 0) events.push({ type: "combo_reset", combo: state.combo });
  state.combo = 0;
  state.comboTimer = 0;
  // 生存模式：连击中断后可再次攒出风暴
  if (state.mode === MODE.SURVIVAL) state.comboStormFired = false;
}

export function comboMult(state) {
  return Math.min(1 + state.combo * COMBO_MULT_BASE, COMBO_MULT_CAP);
}

function clampSpeed(ball, state) {
  const max = MAX_BALL_SPEED + state.speedBoost;
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > max) {
    const k = max / speed;
    ball.vx *= k;
    ball.vy *= k;
  }
}

// 星级：★剩余弹珠≥1 ★★通关用时≤目标 ★★★最高连击≥目标（清场保底 1 星）
export function computeStars(state) {
  let n = 0;
  if (state.ballsRemaining >= 1) n += 1;
  if (state.level && state.stageTimer <= state.level.targets.time) n += 1;
  if (state.level && state.maxCombo >= state.level.targets.combo) n += 1;
  return Math.max(1, Math.min(3, n));
}

// ---- 几何工具 ----
function clampToRect(x, y, rect) {
  return {
    x: Math.max(rect.x, Math.min(rect.x + rect.w, x)),
    y: Math.max(rect.y, Math.min(rect.y + rect.h, y))
  };
}

function closestOnSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const len2 = abx * abx + aby * aby;
  let t = len2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / len2 : 0;
  t = clamp(t, 0, 1);
  return { x: ax + t * abx, y: ay + t * aby };
}

function collideBallSegment(ball, ax, ay, bx, by, restitution, surfVx, surfVy) {
  const closest = closestOnSegment(ball.x, ball.y, ax, ay, bx, by);
  const dx = ball.x - closest.x, dy = ball.y - closest.y;
  const d = Math.hypot(dx, dy);
  if (d >= ball.radius) return false;
  const nx = d > 0 ? dx / d : 0, ny = d > 0 ? dy / d : -1;
  ball.x = closest.x + nx * ball.radius;
  ball.y = closest.y + ny * ball.radius;
  const rvx = ball.vx - surfVx, rvy = ball.vy - surfVy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    const j = -(1 + restitution) * vn;
    ball.vx = rvx + j * nx + surfVx;
    ball.vy = rvy + j * ny + surfVy;
  }
  return true;
}

// 机关冷却与闪光逐帧衰减
function decayMechanisms(state, dt) {
  for (const brick of state.bricks) if (brick.flash > 0) brick.flash -= dt;
  for (const b of state.mechs.bumpers) {
    if (b.cool > 0) b.cool -= dt;
    if (b.flash > 0) b.flash -= dt;
  }
  for (const s of state.mechs.slings) {
    if (s.cool > 0) s.cool -= dt;
    if (s.flash > 0) s.flash -= dt;
  }
  for (const t of state.mechs.targets) {
    if (t.cool > 0) t.cool -= dt;
    if (t.flash > 0) t.flash -= dt;
  }
  if (state.mechs.spinner && state.mechs.spinner.cool > 0) state.mechs.spinner.cool -= dt;
  if (state.mechs.spinner && state.mechs.spinner.flash > 0) state.mechs.spinner.flash -= dt;
  if (state.mechs.rollovers && state.mechs.rollovers.cool > 0) state.mechs.rollovers.cool -= dt;
  if (state.mechs.ramp && state.mechs.ramp.cool > 0) state.mechs.ramp.cool -= dt;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function clone(state) {
  return JSON.parse(JSON.stringify(state));
}

// 供 UI/控制器查询的只读常量
export { clamp };
