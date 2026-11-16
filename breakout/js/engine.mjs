// engine.mjs — 弹球肉鸽防线规则唯一权威，DOM-free。
// 固定步长 stepFrame(state, dt, input)；离散意图走 applyIntent。
// 物理带子步进防穿模；随机走可注入种子 PRNG。

import { COLS, TOTAL_LAYERS, BOSS_LAYERS, isBossLayer, layerSpec, endlessSpec, BRICK_HP } from "./levels.mjs";
import { brickScore, brickDamage, layerClearBonus, clampScore, comboDamageMultiplier } from "./score.mjs";
import { RELIC_IDS, rollRelicChoices } from "./relics.mjs";

export const FIELD_W = 480;
export const FIELD_H = 640;
export const PADDLE_Y = 596;
export const PADDLE_W_BASE = 92;
export const PADDLE_H = 14;
export const BALL_R = 8;
export const BRICK_W = 44;
export const BRICK_H = 22;
export const BRICK_GAP = 4;
export const BRICK_TOP = 56;
export const BRICK_LEFT = Math.floor((FIELD_W - (COLS * BRICK_W + (COLS - 1) * BRICK_GAP)) / 2);
export const PADDLE_MIN_X = 6;
export const PADDLE_MAX_X = FIELD_W - 6;
export const PADDLE_SPEED = 520;
export const BALL_SPEED_BASE = 300;
export const BALL_SPEED_MAX_MULT = 1.9;
export const BALL_SPEED_PER_LAYER = 0.05;
export const MAX_BALLS = 6;
export const MAX_LIVES = 3;
export const LASER_INTERVAL = 0.8;
export const LASER_SPEED = 720;
export const MULTIBALL_THRESHOLD = 8;
export const COMBO_WINDOW = 1.6;

export const MODES = Object.freeze(["rogue", "endless", "daily"]);
export const PHASES = Object.freeze({
  ready: "ready",
  playing: "playing",
  relic: "relic",
  won: "won",
  lost: "lost",
});

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text) {
  const s = String(text ?? "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function pushEvent(state, event) {
  if (state.events.length >= 128) state.events.shift();
  state.events.push(event);
}

export function drainEvents(state) {
  const out = state.events;
  state.events = [];
  return out;
}

/* -------------------------------------------------------------- 派生属性 */

function hasRelic(state, id) {
  return state.relics.includes(id);
}

function relicCount(state, id) {
  return state.relics.filter((r) => r === id).length;
}

function paddleWidth(state) {
  return PADDLE_W_BASE * (hasRelic(state, "widePaddle") ? 1.35 : 1);
}

function ballSpeed(state) {
  const layerMult = 1 + Math.min(BALL_SPEED_MAX_MULT - 1, state.layer * BALL_SPEED_PER_LAYER);
  const slowMult = hasRelic(state, "slowMo") ? 0.75 : 1;
  return BALL_SPEED_BASE * layerMult * slowMult;
}

function fireballPierce(state) {
  return relicCount(state, "fireball");
}

/* -------------------------------------------------------------- 构造 */

function makeBrick(typeId, col, row) {
  return {
    col,
    row,
    type: typeId,
    hp: BRICK_HP[typeId] ?? 1,
    maxHp: BRICK_HP[typeId] ?? 1,
    alive: true,
    x: BRICK_LEFT + col * (BRICK_W + BRICK_GAP),
    y: BRICK_TOP + row * (BRICK_H + BRICK_GAP),
  };
}

function buildBricks(layout) {
  const bricks = [];
  for (let r = 0; r < layout.length; r += 1) {
    for (let c = 0; c < layout[r].length; c += 1) {
      const t = layout[r][c];
      if (t > 0) bricks.push(makeBrick(t, c, r));
    }
  }
  return bricks;
}

function makeBall(state, x, y, angle) {
  const speed = ballSpeed(state);
  return {
    x,
    y,
    vx: Math.sin(angle) * speed,
    vy: -Math.cos(angle) * speed,
    r: BALL_R,
    stuck: true,
    pierce: fireballPierce(state),
    bricksDestroyed: 0,
    id: state.ballIdCounter,
  };
}

export function createGame(options = {}) {
  const mode = MODES.includes(options.mode) ? options.mode : "rogue";
  const seed = Number.isFinite(options.seed) ? options.seed >>> 0 : hashSeed(`${mode}:${Date.now()}`);
  const rng = options.rng ?? mulberry32(seed);
  const state = {
    mode,
    seed,
    rng,
    phase: PHASES.ready,
    layer: 1,
    score: 0,
    lives: MAX_LIVES,
    relics: [],
    bricks: [],
    balls: [],
    lasers: [],
    paddle: { x: FIELD_W / 2, w: PADDLE_W_BASE },
    boss: null,
    combo: 0,
    comboTimer: 0,
    laserCooldown: 0,
    shieldCharges: 0,
    time: 0,
    events: [],
    ballIdCounter: 1,
    relicChoices: [],
    lastResult: null,
    stats: { bricksBroken: 0, maxCombo: 0 },
  };
  setupLayer(state, 1);
  return state;
}

function setupLayer(state, layer) {
  state.layer = layer;
  state.combo = 0;
  state.comboTimer = 0;
  state.laserCooldown = 0;
  state.shieldCharges = relicCount(state, "shield");
  state.lasers = [];
  state.ballIdCounter = 1;

  let spec;
  if (state.mode === "endless") {
    spec = endlessSpec(layer, state.rng);
  } else {
    spec = layerSpec(layer);
  }

  state.bricks = buildBricks(spec.rows);
  state.boss = spec.boss
    ? {
        hp: spec.boss.hp,
        maxHp: spec.boss.hp,
        x: FIELD_W / 2,
        y: 110,
        radius: spec.boss.radius,
        dir: 1,
        speed: 60 + layer * 4,
        t: 0,
        shieldTimer: 4,
        hitFlash: 0,
      }
    : null;

  // 重置球：吸附在底板中央
  state.balls = [makeBall(state, FIELD_W / 2, PADDLE_Y - BALL_R - 2, 0)];
  state.paddle.w = paddleWidth(state);
  state.paddle.x = FIELD_W / 2;
  state.phase = PHASES.ready;
  pushEvent(state, { type: "layerStart", layer, boss: Boolean(state.boss) });
}

/* -------------------------------------------------------------- 离散意图 */

export function applyIntent(state, intent) {
  if (!state || typeof intent !== "string") return null;
  if (state.phase === PHASES.ready && intent === "launch") {
    launchBalls(state);
    return "launch";
  }
  if (state.phase === PHASES.relic && intent.startsWith("pick:")) {
    const id = intent.slice(5);
    if (state.relicChoices.includes(id)) {
      pickRelic(state, id);
      return `pick:${id}`;
    }
  }
  return null;
}

function launchBalls(state) {
  for (const ball of state.balls) {
    if (ball.stuck) {
      ball.stuck = false;
      // 发射角度略带随机，避免完全垂直
      const angle = (state.rng() - 0.5) * 0.4;
      const speed = ballSpeed(state);
      ball.vx = Math.sin(angle) * speed;
      ball.vy = -Math.cos(angle) * speed;
      ball.pierce = fireballPierce(state);
    }
  }
  state.phase = PHASES.playing;
  pushEvent(state, { type: "launch" });
}

function pickRelic(state, id) {
  state.relics.push(id);
  state.relicChoices = [];
  // 立即刷新派生属性
  state.paddle.w = paddleWidth(state);
  state.shieldCharges = relicCount(state, "shield");
  // 进入下一层
  const nextLayer = state.layer + 1;
  if (state.mode === "rogue" && nextLayer > TOTAL_LAYERS) {
    state.phase = PHASES.won;
    pushEvent(state, { type: "gameWin" });
    return;
  }
  setupLayer(state, nextLayer);
  pushEvent(state, { type: "relicPicked", id });
}

/* -------------------------------------------------------------- 推进 */

export function stepFrame(state, dt, input = {}) {
  if (!state) return state;
  const step = clamp(Number(dt) || 0, 0, 1 / 20);
  if (step <= 0) return state;
  if (state.phase !== PHASES.playing && state.phase !== PHASES.ready) return state;

  state.time += step;
  updatePaddle(state, step, input);

  if (state.phase === PHASES.ready) {
    // 球吸附在底板上跟随
    for (const ball of state.balls) {
      if (ball.stuck) {
        ball.x = state.paddle.x;
        ball.y = PADDLE_Y - BALL_R - 2;
      }
    }
    return state;
  }

  if (state.comboTimer > 0) {
    state.comboTimer -= step;
    if (state.comboTimer <= 0) state.combo = 0;
  }

  updateBalls(state, step);
  updateLasers(state, step);
  fireLaser(state, step);
  updateBoss(state, step);
  checkLayerEnd(state);
  return state;
}

function updatePaddle(state, dt, input) {
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  state.paddle.x = clamp(state.paddle.x + dir * PADDLE_SPEED * dt, PADDLE_MIN_X, PADDLE_MAX_X);
}

/* -------------------------------------------------------------- 球物理 */

function updateBalls(state, dt) {
  const speed = ballSpeed(state);
  for (const ball of state.balls) {
    if (ball.stuck) {
      ball.x = state.paddle.x;
      ball.y = PADDLE_Y - BALL_R - 2;
      continue;
    }
    // 子步进防穿模
    const dist = Math.hypot(ball.vx, ball.vy) * dt;
    const subSteps = Math.max(1, Math.ceil(dist / (BALL_R * 0.8)));
    const sdt = dt / subSteps;
    for (let s = 0; s < subSteps; s += 1) {
      ball.x += ball.vx * sdt;
      ball.y += ball.vy * sdt;
      if (collideWalls(state, ball)) break;
      if (collidePaddle(state, ball)) break;
      if (collideBricks(state, ball)) break;
      if (state.boss && collideBoss(state, ball)) break;
    }
    // 归一化速度，防止漂移
    const cur = Math.hypot(ball.vx, ball.vy) || 1;
    const k = speed / cur;
    ball.vx *= k;
    ball.vy *= k;
  }
  // 移除飞出底部的球
  state.balls = state.balls.filter((ball) => !ball.dead);
  // 如果所有球都没了
  if (state.balls.length === 0) {
    loseLife(state);
  }
}

function collideWalls(state, ball) {
  if (ball.x - ball.r < 0) {
    ball.x = ball.r;
    ball.vx = Math.abs(ball.vx);
    ball.pierce = fireballPierce(state);
    pushEvent(state, { type: "wallHit", x: ball.x, y: ball.y });
  } else if (ball.x + ball.r > FIELD_W) {
    ball.x = FIELD_W - ball.r;
    ball.vx = -Math.abs(ball.vx);
    ball.pierce = fireballPierce(state);
    pushEvent(state, { type: "wallHit", x: ball.x, y: ball.y });
  }
  if (ball.y - ball.r < 0) {
    ball.y = ball.r;
    ball.vy = Math.abs(ball.vy);
    ball.pierce = fireballPierce(state);
    pushEvent(state, { type: "wallHit", x: ball.x, y: ball.y });
  }
  // 底部：失球
  if (ball.y - ball.r > FIELD_H) {
    ball.dead = true;
    return true;
  }
  return false;
}

function collidePaddle(state, ball) {
  const p = state.paddle;
  const pw = p.w;
  const px = p.x;
  if (
    ball.vy > 0 &&
    ball.y + ball.r >= PADDLE_Y &&
    ball.y - ball.r <= PADDLE_Y + PADDLE_H &&
    ball.x >= px - pw / 2 - ball.r &&
    ball.x <= px + pw / 2 + ball.r
  ) {
    // 磁吸底板
    if (hasRelic(state, "magnet")) {
      ball.stuck = true;
      ball.x = clamp(ball.x, px - pw / 2 + ball.r, px + pw / 2 - ball.r);
      ball.y = PADDLE_Y - ball.r - 1;
      ball.vx = 0;
      ball.vy = 0;
      ball.pierce = fireballPierce(state);
      // 如果所有球都吸附，回到 ready 状态等待发射
      if (state.balls.every((b) => b.stuck)) {
        state.phase = PHASES.ready;
      }
      pushEvent(state, { type: "paddleCatch", x: ball.x });
      return true;
    }
    // 角度反弹
    const hitX = clamp(ball.x, px - pw / 2, px + pw / 2);
    const rel = (hitX - px) / (pw / 2); // -1 ~ 1
    const maxAngle = (Math.PI / 180) * 65;
    const angle = rel * maxAngle;
    const speed = ballSpeed(state);
    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.cos(angle) * speed;
    ball.y = PADDLE_Y - ball.r - 1;
    ball.pierce = fireballPierce(state);
    pushEvent(state, { type: "paddleHit", x: ball.x });
    return true;
  }
  return false;
}

function collideBricks(state, ball) {
  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    // AABB 碰撞
    if (
      ball.x + ball.r > brick.x &&
      ball.x - ball.r < brick.x + BRICK_W &&
      ball.y + ball.r > brick.y &&
      ball.y - ball.r < brick.y + BRICK_H
    ) {
      // 火球穿透
      if (ball.pierce > 0 && brick.type !== 5) {
        ball.pierce -= 1;
        damageBrick(state, brick, ball);
        continue; // 不反弹，继续前进
      }
      // 钢砖：只反弹不伤害
      if (brick.type === 5) {
        reflectFromBrick(ball, brick);
        ball.pierce = fireballPierce(state);
        pushEvent(state, { type: "steelHit", x: ball.x, y: ball.y });
        return true;
      }
      // 普通砖块
      reflectFromBrick(ball, brick);
      ball.pierce = fireballPierce(state);
      damageBrick(state, brick, ball);
      return true;
    }
  }
  return false;
}

function reflectFromBrick(ball, brick) {
  // 判断碰撞边
  const prevX = ball.x - ball.vx * 0.01;
  const prevY = ball.y - ball.vy * 0.01;
  const fromLeft = prevX + ball.r <= brick.x;
  const fromRight = prevX - ball.r >= brick.x + BRICK_W;
  const fromTop = prevY + ball.r <= brick.y;
  const fromBottom = prevY - ball.r >= brick.y + BRICK_H;
  if (fromLeft || fromRight) {
    ball.vx = -ball.vx;
  } else if (fromTop || fromBottom) {
    ball.vy = -ball.vy;
  } else {
    // 兜底：按法线反射
    ball.vy = -ball.vy;
  }
}

function damageBrick(state, brick, ball) {
  if (brick.type === 5) return; // 钢砖不可破
  const dmg = brickDamage(brick.type, state.combo, hasRelic(state, "sniper"), hasRelic(state, "comboFever"));
  brick.hp -= dmg;
  state.combo += 1;
  state.comboTimer = COMBO_WINDOW;
  state.stats.maxCombo = Math.max(state.stats.maxCombo, state.combo);
  if (brick.hp <= 0) {
    brick.alive = false;
    state.stats.bricksBroken += 1;
    const comboMult = hasRelic(state, "comboFever") ? comboDamageMultiplier(state.combo) : 1;
    state.score = clampScore(state.score + brickScore(brick.type, comboMult, hasRelic(state, "goldRush")));
    pushEvent(state, { type: "brickBreak", x: brick.x + BRICK_W / 2, y: brick.y + BRICK_H / 2, brickType: brick.type, combo: state.combo });
    // 爆炸砖
    if (brick.type === 6) {
      explodeBricks(state, brick);
    }
    // 多球分裂
    if (ball) ball.bricksDestroyed += 1;
    if (ball && hasRelic(state, "multiball") && ball.bricksDestroyed >= MULTIBALL_THRESHOLD && state.balls.length < MAX_BALLS) {
      ball.bricksDestroyed = 0;
      spawnExtraBall(state, ball);
    }
    // 闪电链
    if (hasRelic(state, "lightning")) {
      chainLightning(state, brick);
    }
  } else {
    pushEvent(state, { type: "brickHit", x: brick.x + BRICK_W / 2, y: brick.y + BRICK_H / 2, brickType: brick.type });
  }
}

function explodeBricks(state, center) {
  const cx = center.col;
  const cy = center.row;
  for (const b of state.bricks) {
    if (!b.alive || b === center) continue;
    if (Math.abs(b.col - cx) <= 1 && Math.abs(b.row - cy) <= 1) {
      damageBrick(state, b, null);
    }
  }
  pushEvent(state, { type: "explosion", x: center.x + BRICK_W / 2, y: center.y + BRICK_H / 2 });
}

function chainLightning(state, origin) {
  let chained = 0;
  const target = 2;
  for (const b of state.bricks) {
    if (chained >= target) break;
    if (!b.alive || b === origin || b.type === 5) continue;
    const dist = Math.abs(b.col - origin.col) + Math.abs(b.row - origin.row);
    if (dist <= 3) {
      damageBrick(state, b, null);
      chained += 1;
    }
  }
}

function spawnExtraBall(state, parent) {
  const angle = state.rng() * Math.PI - Math.PI / 2; // 向上半圆
  const speed = ballSpeed(state);
  const ball = {
    x: parent.x,
    y: parent.y,
    vx: Math.sin(angle) * speed,
    vy: -Math.abs(Math.cos(angle) * speed),
    r: BALL_R,
    stuck: false,
    pierce: fireballPierce(state),
    bricksDestroyed: 0,
    id: state.ballIdCounter++,
  };
  state.balls.push(ball);
  pushEvent(state, { type: "multiball", x: ball.x, y: ball.y });
}

/* -------------------------------------------------------------- 激光 */

function fireLaser(state, dt) {
  if (!hasRelic(state, "laser")) return;
  state.laserCooldown -= dt;
  if (state.laserCooldown > 0) return;
  state.laserCooldown = LASER_INTERVAL;
  state.lasers.push({
    x: state.paddle.x,
    y: PADDLE_Y - 2,
    vy: -LASER_SPEED,
    w: 4,
    dead: false,
  });
}

function updateLasers(state, dt) {
  for (const laser of state.lasers) {
    laser.y += laser.vy * dt;
    if (laser.y < -20) {
      laser.dead = true;
      continue;
    }
    // 命中砖块
    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      if (
        laser.x >= brick.x &&
        laser.x <= brick.x + BRICK_W &&
        laser.y <= brick.y + BRICK_H &&
        laser.y >= brick.y
      ) {
        laser.dead = true;
        damageBrick(state, brick, null);
        break;
      }
    }
    if (laser.dead) continue;
    // 命中 Boss
    if (state.boss) {
      const dx = laser.x - state.boss.x;
      const dy = laser.y - state.boss.y;
      if (Math.abs(dx) <= state.boss.radius && Math.abs(dy) <= state.boss.radius * 0.7) {
        laser.dead = true;
        damageBoss(state, 1);
      }
    }
  }
  state.lasers = state.lasers.filter((l) => !l.dead);
}

/* -------------------------------------------------------------- Boss */

function updateBoss(state, dt) {
  const boss = state.boss;
  if (!boss || boss.hp <= 0) return;
  if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - dt);
  boss.t += dt;
  boss.x += boss.dir * boss.speed * dt;
  if (boss.x - boss.radius < 10) {
    boss.x = 10 + boss.radius;
    boss.dir = 1;
  } else if (boss.x + boss.radius > FIELD_W - 10) {
    boss.x = FIELD_W - 10 - boss.radius;
    boss.dir = -1;
  }
  // 周期性召唤护盾砖
  boss.shieldTimer -= dt;
  if (boss.shieldTimer <= 0) {
    boss.shieldTimer = 6;
    spawnBossShields(state, boss);
  }
}

function spawnBossShields(state, boss) {
  // 在 Boss 下方生成一排 1~2 血砖
  const cols = [boss.col ?? 4];
  const count = 3;
  const startCol = Math.max(0, Math.min(COLS - count, Math.floor((boss.x / FIELD_W) * COLS) - 1));
  for (let i = 0; i < count; i += 1) {
    const c = startCol + i;
    if (c < 0 || c >= COLS) continue;
    // 避免重叠
    if (state.bricks.some((b) => b.alive && b.col === c && b.row === 2)) continue;
    state.bricks.push(makeBrick(2, c, 2));
  }
  pushEvent(state, { type: "bossShield" });
}

function collideBoss(state, ball) {
  const boss = state.boss;
  const dx = ball.x - boss.x;
  const dy = ball.y - boss.y;
  if (Math.abs(dx) <= boss.radius && Math.abs(dy) <= boss.radius * 0.75) {
    // 反射
    if (Math.abs(dx / boss.radius) > Math.abs(dy / (boss.radius * 0.75))) {
      ball.vx = -ball.vx;
    } else {
      ball.vy = -ball.vy;
    }
    ball.pierce = fireballPierce(state);
    damageBoss(state, 1);
    pushEvent(state, { type: "bossHit", x: ball.x, y: ball.y });
    return true;
  }
  return false;
}

function damageBoss(state, amount) {
  const boss = state.boss;
  if (!boss) return;
  boss.hp -= amount;
  boss.hitFlash = 0.12;
  state.combo += 1;
  state.comboTimer = COMBO_WINDOW;
  if (boss.hp <= 0) {
    boss.hp = 0;
    state.score = clampScore(state.score + layerClearBonus(true));
    pushEvent(state, { type: "bossDown", x: boss.x, y: boss.y });
  }
}

/* -------------------------------------------------------------- 失命与终局 */

function loseLife(state) {
  // 护盾兜底
  if (state.shieldCharges > 0) {
    state.shieldCharges -= 1;
    state.balls = [makeBall(state, state.paddle.x, PADDLE_Y - BALL_R - 2, 0)];
    state.phase = PHASES.ready;
    pushEvent(state, { type: "shieldSave" });
    return;
  }
  state.lives -= 1;
  state.combo = 0;
  pushEvent(state, { type: "lifeLost", lives: state.lives });
  if (state.lives <= 0) {
    state.lives = 0;
    state.phase = PHASES.lost;
    state.lastResult = {
      mode: state.mode,
      layer: state.layer,
      score: state.score,
      relics: state.relics.length,
      time: state.time,
      won: false,
    };
    pushEvent(state, { type: "gameOver" });
    return;
  }
  state.balls = [makeBall(state, state.paddle.x, PADDLE_Y - BALL_R - 2, 0)];
  state.phase = PHASES.ready;
}

function checkLayerEnd(state) {
  if (state.phase !== PHASES.playing) return;
  // Boss 层：Boss 死亡即过关
  if (state.boss) {
    if (state.boss.hp <= 0) {
      finishLayer(state);
    }
    return;
  }
  // 普通层：所有可破坏砖块清空
  const breakableAlive = state.bricks.some((b) => b.alive && b.type !== 5);
  if (!breakableAlive) {
    finishLayer(state);
  }
}

function finishLayer(state) {
  state.score = clampScore(state.score + layerClearBonus(Boolean(state.boss)));
  if (state.mode === "rogue" && state.layer >= TOTAL_LAYERS) {
    state.phase = PHASES.won;
    state.lastResult = {
      mode: state.mode,
      layer: state.layer,
      score: state.score,
      relics: state.relics.length,
      time: state.time,
      won: true,
    };
    pushEvent(state, { type: "gameWin" });
    return;
  }
  // 进入核心选择
  state.phase = PHASES.relic;
  state.relicChoices = rollRelicChoices(state.rng, state.relics, 3);
  pushEvent(state, { type: "layerClear", layer: state.layer, choices: state.relicChoices });
}

export function isTerminal(state) {
  return state.phase === PHASES.won || state.phase === PHASES.lost;
}

export function resultOf(state) {
  if (!state.lastResult) return null;
  return {
    ...state.lastResult,
    lost: state.phase === PHASES.lost,
    score: state.score,
    layer: state.layer,
  };
}

/** 只读诊断出口 */
export function snapshot(state) {
  return {
    phase: state.phase,
    layer: state.layer,
    score: state.score,
    lives: state.lives,
    combo: state.combo,
    balls: state.balls.length,
    relics: state.relics.length,
    bricksAlive: state.bricks.filter((b) => b.alive && b.type !== 5).length,
    bossHp: state.boss ? state.boss.hp : 0,
  };
}
