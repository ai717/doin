// engine.mjs — 太空防御者规则唯一权威，DOM-free。
// 固定步长 stepFrame(state, dt, input)；离散意图走 applyIntent。
// 合法操作永不抛错；action === null 表示这一步没生效；终局（cleared/won/lost）一律 no-op。
// rng 可注入（默认 mulberry32(seed)），战斗过程因此可重放、可单测。

import {
  ENEMY_TYPES,
  TOTAL_WAVES,
  WAVES_PER_SECTOR,
  SECTOR_COUNT,
  waveSpec,
  survivalSpec,
  rushSpec,
} from "./levels.mjs";
import {
  COMBO_MAX,
  COMBO_WINDOW,
  SCORE_CAP,
  clampScore,
  comboMultiplier,
  grazeScore,
  killScore,
  starsFor,
  waveClearBonus,
} from "./score.mjs";

export const FIELD_W = 540;
export const FIELD_H = 720;
export const PLAYER_Y = 634;
export const PLAYER_MIN_X = 32;
export const PLAYER_MAX_X = FIELD_W - 32;
export const PLAYER_SPEED = 340;
export const PLAYER_ACCEL = 2400;
export const CORE_R = 6; // 真实受击判定（远小于外形，弹幕游戏的公平性惯例）
export const GRAZE_R = 23; // 擦弹环：贴弹飞行充能 OVERLOAD
export const BULLET_R = 5;
export const MAX_SHIELD = 3;
export const MAX_DRONES = 2;
export const MAX_ENEMY_BULLETS = 90;
export const MAX_PLAYER_BULLETS = 24;
export const MAX_GRACE = 1.6; // 复活无敌
export const OVERLOAD_MAX = 100;
export const OVERLOAD_TIME = 2.6;
export const OVERLOAD_SLOW = 0.55; // 敌弹时间流速
export const OVERLOAD_FIRE_BOOST = 2;
export const CAPTURE_LIMIT = 3.0;
export const CELL_W = 52;
export const CELL_H = 44;
export const FORMATION_TOP = 92;
export const DROP_STEP = 15;
export const BREACH_Y = PLAYER_Y - 52;
export const BREACH_DRAIN = 2.0;
export const BULLET_SPEED_CAP = 200; // 敌弹速度上限：玩家横移速度足以甩开
export const PLAYER_BULLET_SPEED = 780;
export const MODES = Object.freeze(["campaign", "rush", "survival"]);
export const PHASES = Object.freeze({
  ready: "ready",
  playing: "playing",
  cleared: "cleared",
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
  if (state.events.length >= 96) state.events.shift();
  state.events.push(event);
}

export function drainEvents(state) {
  const out = state.events;
  state.events = [];
  return out;
}

/* ------------------------------------------------------------------ 构造 */

function makeEnemy(typeId, col, row, id) {
  const type = ENEMY_TYPES[typeId];
  return {
    id,
    type: typeId,
    col,
    row,
    hp: type.hp,
    maxHp: type.hp,
    alive: true,
    state: "formation", // formation | dive | return | beam
    x: 0,
    y: 0,
    t: 0,
    dur: 1,
    fireT: 0,
    beamT: 0,
    cooldown: 1.2 + (id % 5) * 0.35,
    dropped: false,
    path: null,
    from: null,
    hitFlash: 0,
  };
}

function buildFormation(state, spec) {
  const enemies = [];
  let id = 1;
  for (let row = 0; row < spec.rows; row += 1) {
    const types = spec.types[row] ?? ["wasp"];
    for (let col = 0; col < spec.cols; col += 1) {
      const typeId = types[col % types.length];
      enemies.push(makeEnemy(typeId, col, row, id));
      id += 1;
    }
  }
  state.formation = {
    ox: (FIELD_W - spec.cols * CELL_W) / 2,
    oy: FORMATION_TOP,
    dir: 1,
    cols: spec.cols,
    rows: spec.rows,
    total: enemies.length,
    timer: 0,
  };
  return enemies;
}

function buildBoss(state, spec) {
  state.boss = {
    x: FIELD_W / 2,
    y: 132,
    hp: spec.bossHp,
    maxHp: spec.bossHp,
    phase: 0,
    t: 0,
    fireT: 1.4,
    dir: 1,
    radius: 52,
    hitFlash: 0,
  };
}

function makeBarriers() {
  return [110, 270, 430].map((cx) => ({
    cx,
    y: 566,
    w: 78,
    h: 26,
    hp: 10,
    maxHp: 10,
  }));
}

export function startWave(state, waveIndex) {
  const mode = state.mode;
  const spec =
    mode === "campaign" ? waveSpec(waveIndex) : mode === "rush" ? rushSpec(waveIndex) : survivalSpec(waveIndex);
  state.waveIndex = waveIndex;
  state.spec = spec;
  state.enemies = spec.boss ? [] : buildFormation(state, spec);
  state.boss = null;
  if (spec.boss) buildBoss(state, spec);
  state.barriers = makeBarriers();
  state.playerBullets = [];
  state.enemyBullets = [];
  state.drops = [];
  state.time = 0;
  state.phase = PHASES.playing;
  state.breach = 0;
  state.captured = null;
  state.bulletBudget = 0;
  state.divers = 0;
  state.stats = { shots: 0, hits: 0, kills: 0, graze: 0, hitsTaken: 0, rescued: 0, maxCombo: 0 };
  state.combo = 0;
  state.comboTimer = 0;
  state.player.x = FIELD_W / 2;
  state.player.y = PLAYER_Y;
  state.player.vx = 0;
  state.player.fireT = 0;
  state.player.droneT = 0;
  state.player.shields = MAX_SHIELD;
  state.player.dual = false;
  state.player.drones = 0;
  state.player.invuln = 1.0;
  state.overload.charge = 0;
  state.overload.active = 0;
  state.events = [];
  pushEvent(state, { type: "waveStart", wave: waveIndex });
  return state;
}

export function createGame(options = {}) {
  const mode = MODES.includes(options.mode) ? options.mode : "campaign";
  const seed = Number.isFinite(options.seed) ? options.seed >>> 0 : hashSeed(`${mode}:${options.waveIndex ?? 0}`);
  const state = {
    mode,
    seed,
    rng: options.rng ?? mulberry32(seed),
    phase: PHASES.ready,
    waveIndex: 0,
    lives: mode === "survival" ? 1 : 3,
    score: 0,
    spec: null,
    enemies: [],
    boss: null,
    barriers: [],
    playerBullets: [],
    enemyBullets: [],
    drops: [],
    formation: null,
    player: {
      x: FIELD_W / 2,
      y: PLAYER_Y,
      vx: 0,
      fireT: 0,
      droneT: 0,
      shields: MAX_SHIELD,
      drones: 0,
      dual: false,
      invuln: 0,
    },
    overload: { charge: 0, active: 0 },
    captured: null,
    combo: 0,
    comboTimer: 0,
    time: 0,
    breach: 0,
    bulletBudget: 0,
    divers: 0,
    stats: { shots: 0, hits: 0, kills: 0, graze: 0, hitsTaken: 0, rescued: 0 },
    events: [],
    lastResult: null,
    rushTime: 0,
  };
  startWave(state, Number.isFinite(options.waveIndex) ? Math.max(0, options.waveIndex) : 0);
  if (mode === "survival") state.lives = 1;
  return state;
}

export function resetGame(state, waveIndex = 0) {
  const next = createGame({ mode: state.mode, seed: state.seed, waveIndex });
  next.lives = state.mode === "survival" ? 1 : 3;
  return next;
}

/* -------------------------------------------------------------- 离散意图 */

/**
 * 离散意图：overload（引爆过载）/ restart / next。
 * 无效意图返回 null，绝不抛错。
 */
export function applyIntent(state, intent) {
  if (!state || typeof intent !== "string") return null;
  if (intent === "overload") {
    if (state.phase !== PHASES.playing) return null;
    if (state.overload.active > 0) return null;
    if (state.overload.charge < OVERLOAD_MAX) return null;
    state.overload.active = OVERLOAD_TIME;
    state.overload.charge = 0;
    pushEvent(state, { type: "overload" });
    return "overload";
  }
  return null;
}

/* ---------------------------------------------------------------- 推进 */

export function stepFrame(state, dt, input = {}) {
  if (!state) return state;
  const step = clamp(Number(dt) || 0, 0, 1 / 20);
  if (step <= 0) return state;
  if (state.phase !== PHASES.playing) return state; // 终局 no-op

  state.time += step;
  if (state.mode === "rush") state.rushTime += step;

  tickTimers(state, step);
  updatePlayer(state, step, input);
  updatePlayerBullets(state, step);
  updateEnemies(state, step);
  updateBoss(state, step);
  updateEnemyBullets(state, step);
  updateDrops(state, step);
  checkBreach(state, step);
  checkWaveEnd(state);
  return state;
}

function tickTimers(state, dt) {
  const p = state.player;
  if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
  if (state.overload.active > 0) {
    state.overload.active = Math.max(0, state.overload.active - dt);
    if (state.overload.active === 0) pushEvent(state, { type: "overloadEnd" });
  }
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) {
      state.combo = 0;
      state.comboTimer = 0;
    }
  }
  state.bulletBudget = Math.max(0, state.bulletBudget - dt);
}

function updatePlayer(state, dt, input) {
  const p = state.player;
  if (state.captured) {
    updateCaptured(state, dt);
    fire(state, dt, Boolean(input.fire));
    return;
  }
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const target = dir * PLAYER_SPEED;
  const accel = PLAYER_ACCEL * dt;
  if (p.vx < target) p.vx = Math.min(target, p.vx + accel);
  else if (p.vx > target) p.vx = Math.max(target, p.vx - accel);
  p.x = clamp(p.x + p.vx * dt, PLAYER_MIN_X, PLAYER_MAX_X);
  if (p.x === PLAYER_MIN_X || p.x === PLAYER_MAX_X) p.vx *= 0.4;
  p.y = PLAYER_Y;
  fire(state, dt, Boolean(input.fire));
}

function fire(state, dt, wantFire) {
  const p = state.player;
  const boost = state.overload.active > 0 ? OVERLOAD_FIRE_BOOST : 1;
  const interval = (p.dual ? 0.17 : 0.21) / boost;
  p.fireT -= dt;
  if (wantFire && p.fireT <= 0) {
    p.fireT = interval;
    const lanes = p.dual ? [-11, 11] : [0];
    for (const dx of lanes) spawnPlayerBullet(state, p.x + dx, p.y - 16, 0, -PLAYER_BULLET_SPEED);
  }
  // 浮游炮同步开火（节奏略慢，形成火力编织）
  if (p.drones > 0) {
    p.droneT -= dt;
    if (p.droneT <= 0) {
      p.droneT = 0.34 / boost;
      for (let i = 0; i < p.drones; i += 1) {
        const dx = i === 0 ? -32 : 32;
        spawnPlayerBullet(state, p.x + dx, p.y - 4, 0, -PLAYER_BULLET_SPEED * 0.86);
      }
    }
  }
}

function spawnPlayerBullet(state, x, y, vx, vy) {
  if (state.playerBullets.length >= MAX_PLAYER_BULLETS) return null;
  const bullet = { x, y, vx, vy, r: 4, dead: false };
  state.playerBullets.push(bullet);
  state.stats.shots += 1;
  pushEvent(state, { type: "shot", x, y });
  return bullet;
}

function updateCaptured(state, dt) {
  const cap = state.captured;
  const enemy = state.enemies.find((e) => e.id === cap.enemyId && e.alive);
  cap.t += dt;
  if (!enemy) {
    // 皇蜂已不在（被击落 → rescue 在击杀处处理），直接脱身
    state.captured = null;
    return;
  }
  const targetX = enemy.x;
  const targetY = enemy.y + 40;
  state.player.x += (targetX - state.player.x) * Math.min(1, dt * 6);
  state.player.y += (targetY - state.player.y) * Math.min(1, dt * 6);
  state.player.vx = 0;
  if (cap.t >= CAPTURE_LIMIT) {
    state.captured = null;
    loseLife(state, "captured");
  }
}

function updatePlayerBullets(state, dt) {
  const bullets = state.playerBullets;
  for (const bullet of bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (bullet.y < -30 || bullet.x < -20 || bullet.x > FIELD_W + 20) bullet.dead = true;
  }
  for (const bullet of bullets) {
    if (bullet.dead) continue;
    // 掩体星礁：自机弹同样会被削掉
    for (const barrier of state.barriers) {
      if (barrier.hp <= 0) continue;
      if (Math.abs(bullet.x - barrier.cx) <= barrier.w / 2 && bullet.y <= barrier.y + barrier.h && bullet.y >= barrier.y - 6) {
        barrier.hp = Math.max(0, barrier.hp - 1);
        bullet.dead = true;
        pushEvent(state, { type: "barrierChip", x: bullet.x, y: barrier.y });
        break;
      }
    }
  }
  for (const bullet of bullets) {
    if (bullet.dead) continue;
    if (state.boss && state.boss.hp > 0) {
      const boss = state.boss;
      if (Math.abs(bullet.x - boss.x) <= boss.radius && Math.abs(bullet.y - boss.y) <= boss.radius * 0.62) {
        bullet.dead = true;
        state.stats.hits += 1;
        damageBoss(state, boss, 1);
        continue;
      }
    }
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      const r = ENEMY_TYPES[enemy.type].radius;
      const dx = bullet.x - enemy.x;
      const dy = bullet.y - enemy.y;
      if (dx * dx + dy * dy <= (r + bullet.r) * (r + bullet.r)) {
        bullet.dead = true;
        state.stats.hits += 1;
        damageEnemy(state, enemy, 1);
        break;
      }
    }
  }
  state.playerBullets = bullets.filter((b) => !b.dead);
}

function damageEnemy(state, enemy, amount) {
  enemy.hp -= amount;
  enemy.hitFlash = 0.12;
  if (enemy.hp > 0) {
    pushEvent(state, { type: "chip", x: enemy.x, y: enemy.y });
    return;
  }
  enemy.alive = false;
  state.stats.kills += 1;
  state.combo = Math.min(COMBO_MAX, state.combo + 1);
  state.stats.maxCombo = Math.max(state.stats.maxCombo, state.combo);
  state.comboTimer = COMBO_WINDOW;
  const overloadOn = state.overload.active > 0;
  state.score = clampScore(state.score + killScore(enemy.type, state.combo, overloadOn));
  state.overload.charge = Math.min(OVERLOAD_MAX, state.overload.charge + 5);
  pushEvent(state, { type: "kill", x: enemy.x, y: enemy.y, enemy: enemy.type, combo: state.combo });
  // 牵引中的皇蜂被击落 → 夺回僚机，双机合体
  if (state.captured && state.captured.enemyId === enemy.id) {
    state.captured = null;
    state.player.dual = true;
    state.player.y = PLAYER_Y;
    state.player.invuln = Math.max(state.player.invuln, 0.9);
    state.stats.rescued += 1;
    state.score = clampScore(state.score + 800);
    pushEvent(state, { type: "rescue", x: enemy.x, y: enemy.y });
  }
  maybeDrop(state, enemy);
}

function damageBoss(state, boss, amount) {
  boss.hp -= amount;
  boss.hitFlash = 0.1;
  if (boss.hp > 0) {
    pushEvent(state, { type: "chip", x: boss.x, y: boss.y });
    return;
  }
  boss.hp = 0;
  state.stats.kills += 1;
  state.combo = Math.min(COMBO_MAX, state.combo + 1);
  state.stats.maxCombo = Math.max(state.stats.maxCombo, state.combo);
  state.comboTimer = COMBO_WINDOW;
  state.score = clampScore(state.score + killScore("queen", state.combo, state.overload.active > 0) * 3);
  pushEvent(state, { type: "bossDown", x: boss.x, y: boss.y });
}

function maybeDrop(state, enemy) {
  const chance = { wasp: 0.1, falcon: 0.16, crab: 0.26, queen: 0.55 }[enemy.type] ?? 0.1;
  if (state.rng() >= chance) return;
  const kind = state.player.drones >= MAX_DRONES ? "shield" : state.rng() < 0.72 ? "drone" : "shield";
  state.drops.push({ x: enemy.x, y: enemy.y, kind, vy: 96, life: 9 });
  pushEvent(state, { type: "drop", x: enemy.x, y: enemy.y, kind });
}

/* ------------------------------------------------------------ 敌阵 */

function slotX(state, enemy) {
  const f = state.formation;
  return f.ox + enemy.col * CELL_W + CELL_W / 2;
}

function slotY(state, enemy) {
  return state.formation.oy + enemy.row * CELL_H;
}

function updateEnemies(state, dt) {
  const spec = state.spec;
  const alive = state.enemies.filter((e) => e.alive);
  if (!alive.length) {
    state.divers = 0;
    return;
  }
  const f = state.formation;
  const ratio = f.total ? alive.length / f.total : 1;
  const survivor = 1 + (1 - ratio) * 1.9;
  const width = f.cols * CELL_W;
  f.ox += f.dir * spec.speed * survivor * dt;
  const minOx = 12;
  const maxOx = FIELD_W - 12 - width;
  if (f.ox <= minOx) {
    f.ox = minOx;
    f.dir = 1;
    f.oy += DROP_STEP;
  } else if (f.ox >= maxOx) {
    f.ox = maxOx;
    f.dir = -1;
    f.oy += DROP_STEP;
  }

  let divers = 0;
  for (const enemy of alive) {
    if (enemy.hitFlash > 0) enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    if (enemy.cooldown > 0) enemy.cooldown = Math.max(0, enemy.cooldown - dt);
    if (enemy.state === "dive" || enemy.state === "return") {
      divers += 1;
      continue;
    }
  }
  state.divers = divers;

  const lowest = Math.max(...alive.filter((e) => e.state === "formation").map((e) => slotY(state, e)), 0);
  state.formation.lowest = lowest;

  for (const enemy of alive) {
    if (enemy.state === "formation") {
      enemy.x = slotX(state, enemy);
      enemy.y = slotY(state, enemy);
      updateEnemyFire(state, enemy, dt, spec);
      maybeDive(state, enemy, spec, dt);
      maybeCapture(state, enemy, dt);
    } else if (enemy.state === "dive") {
      updateDive(state, enemy, dt, spec);
    } else if (enemy.state === "return") {
      enemy.t += dt;
      const k = Math.min(1, enemy.t / enemy.dur);
      enemy.x = enemy.from.x + (slotX(state, enemy) - enemy.from.x) * k;
      enemy.y = enemy.from.y + (slotY(state, enemy) - enemy.from.y) * k;
      if (k >= 1) {
        enemy.state = "formation";
        enemy.x = slotX(state, enemy);
        enemy.y = slotY(state, enemy);
        enemy.cooldown = 1.4;
      }
    } else if (enemy.state === "beam") {
      enemy.x = slotX(state, enemy);
      enemy.y = slotY(state, enemy);
      updateBeam(state, enemy, dt);
    }
  }
}

function maybeDive(state, enemy, spec, dt) {
  if (!spec.dive) return;
  const type = ENEMY_TYPES[enemy.type];
  if (!type.diver && enemy.row !== 0) return;
  if (state.divers >= spec.maxDivers) return;
  if (enemy.cooldown > 0) return;
  const base = enemy.type === "falcon" ? 0.34 : 0.07;
  if (state.rng() > base * dt * 6) return;
  enemy.state = "dive";
  enemy.t = 0;
  enemy.dur = 2.1 + state.rng() * 0.5;
  enemy.dropped = false;
  const side = state.rng() < 0.5 ? -1 : 1;
  enemy.path = {
    x0: enemy.x,
    y0: enemy.y,
    cx: enemy.x + side * (70 + state.rng() * 60),
    cy: enemy.y + 150,
    x1: clamp(state.player.x + (state.rng() - 0.5) * 120, 40, FIELD_W - 40),
    y1: FIELD_H + 60,
  };
  enemy.cooldown = 2.4 + state.rng() * 2;
  state.divers += 1;
  pushEvent(state, { type: "diveStart", x: enemy.x, y: enemy.y });
}

function updateDive(state, enemy, dt, spec) {
  enemy.t += dt;
  const k = clamp(enemy.t / enemy.dur, 0, 1);
  const p = enemy.path;
  const inv = 1 - k;
  enemy.x = inv * inv * p.x0 + 2 * inv * k * p.cx + k * k * p.x1;
  enemy.y = inv * inv * p.y0 + 2 * inv * k * p.cy + k * k * p.y1;
  // 俯冲途中的投弹（单发，留足提前量）
  if (!enemy.dropped && k > 0.42) {
    enemy.dropped = true;
    spawnEnemyBullet(state, enemy.x, enemy.y + 12, 0, 170, "aimed");
  }
  if (k >= 1) {
    enemy.state = "return";
    enemy.t = 0;
    enemy.dur = 1.1;
    enemy.from = { x: enemy.x, y: -40 };
    enemy.x = enemy.from.x;
    enemy.y = enemy.from.y;
  }
}

function maybeCapture(state, enemy, dt) {
  if (!state.spec.capture) return;
  const type = ENEMY_TYPES[enemy.type];
  if (!type.captor) return;
  if (state.captured) return;
  if (enemy.cooldown > 0) return;
  if (state.player.invuln > 0) return;
  if (state.rng() > 0.22 * dt * 2) return;
  enemy.state = "beam";
  enemy.beamT = 0;
  enemy.cooldown = 8;
  pushEvent(state, { type: "beamStart", x: enemy.x, y: enemy.y });
}

function updateBeam(state, enemy, dt) {
  enemy.beamT += dt;
  const telegraph = 0.6;
  if (enemy.beamT < telegraph) return;
  if (enemy.beamT > telegraph + 0.9) {
    enemy.state = "formation";
    enemy.cooldown = 7;
    return;
  }
  if (state.captured) return;
  if (state.player.invuln > 0) return;
  if (Math.abs(state.player.x - enemy.x) <= 24) {
    state.captured = { enemyId: enemy.id, t: 0 };
    pushEvent(state, { type: "capture", x: enemy.x, y: enemy.y });
  }
}

function updateEnemyFire(state, enemy, dt, spec) {
  if (enemy.fireT > 0) {
    enemy.fireT -= dt;
    return;
  }
  const rate = spec.fireRate * (0.5 + (1 - enemy.row / Math.max(1, state.formation.rows)) * 0.7);
  enemy.fireT = 1.6 / Math.max(0.25, rate) + state.rng() * 1.6;
  if (state.rng() > 0.55 + spec.fireRate * 0.25) return;
  const type = ENEMY_TYPES[enemy.type];
  const volley = type.volley;
  if (volley === "fan") {
    for (const a of [-0.32, 0, 0.32]) {
      spawnEnemyBullet(state, enemy.x, enemy.y + 14, Math.sin(a) * 165, Math.cos(a) * 165, "fan");
    }
  } else if (volley === "aimed") {
    const dx = state.player.x - enemy.x;
    const dy = Math.max(40, state.player.y - enemy.y);
    const len = Math.hypot(dx, dy) || 1;
    const jitter = (state.rng() - 0.5) * 0.22;
    const speed = 150;
    let vx = (dx / len) * speed;
    let vy = (dy / len) * speed;
    const cos = Math.cos(jitter);
    const sin = Math.sin(jitter);
    const nvx = vx * cos - vy * sin;
    const nvy = vx * sin + vy * cos;
    spawnEnemyBullet(state, enemy.x, enemy.y + 12, nvx, nvy, "aimed");
  } else {
    spawnEnemyBullet(state, enemy.x, enemy.y + 12, 0, 158 + state.rng() * 24, "straight");
  }
}

/**
 * 敌弹生成唯一出口：受同屏上限与"每秒预算"双重约束，
 * 这是"几何可读弹幕 + 无死局"的硬保证。
 */
function spawnEnemyBullet(state, x, y, vx, vy, kind) {
  if (state.enemyBullets.length >= MAX_ENEMY_BULLETS) return null;
  if (state.bulletBudget > 0) return null;
  const speed = Math.hypot(vx, vy);
  if (speed > BULLET_SPEED_CAP) {
    const k = BULLET_SPEED_CAP / speed;
    vx *= k;
    vy *= k;
  }
  state.bulletBudget = 1 / Math.max(1, state.spec.bulletBudget);
  const bullet = { x, y, vx, vy, kind, r: BULLET_R, grazed: false, life: 8 };
  state.enemyBullets.push(bullet);
  return bullet;
}

/* -------------------------------------------------------------- 母舰 */

function updateBoss(state, dt) {
  const boss = state.boss;
  if (!boss || boss.hp <= 0) return;
  if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - dt);
  boss.t += dt;
  const ratio = boss.hp / boss.maxHp;
  boss.phase = ratio > 0.66 ? 0 : ratio > 0.33 ? 1 : 2;
  const span = FIELD_W / 2 - 70;
  boss.x = FIELD_W / 2 + Math.sin(boss.t * (0.5 + boss.phase * 0.22)) * span;
  boss.y = 132 + Math.sin(boss.t * 1.1) * 8;
  boss.fireT -= dt;
  if (boss.fireT > 0) return;
  boss.fireT = [1.35, 1.05, 0.85][boss.phase];
  fireBossVolley(state, boss);
}

function fireBossVolley(state, boss) {
  const speed = 150;
  if (boss.phase === 0) {
    // 环形轮转，但必定留一道缺口（几何可读 + 必定有解）
    const gap = Math.floor(state.rng() * 12);
    for (let i = 0; i < 12; i += 1) {
      if (i === gap || i === (gap + 1) % 12) continue;
      const a = (i / 12) * Math.PI * 2 + boss.t * 0.4;
      spawnEnemyBullet(state, boss.x, boss.y + 24, Math.cos(a) * speed, Math.abs(Math.sin(a)) * speed + 40, "ring");
    }
  } else if (boss.phase === 1) {
    // 双螺旋渐开，左右对称留中缝
    for (let i = 0; i < 6; i += 1) {
      const a = boss.t * 2.2 + (i / 6) * Math.PI;
      const vx = Math.cos(a) * speed;
      const vy = Math.abs(Math.sin(a)) * speed + 60;
      if (Math.abs(vx) < 26) continue;
      spawnEnemyBullet(state, boss.x, boss.y + 24, vx, vy, "spiral");
    }
  } else {
    // 十字点射 + 一发瞄准弹
    for (const a of [0.5, -0.5, 1.15, -1.15]) {
      spawnEnemyBullet(state, boss.x, boss.y + 24, Math.sin(a) * speed, Math.cos(a) * speed, "cross");
    }
    const dx = state.player.x - boss.x;
    const len = Math.hypot(dx, state.player.y - boss.y) || 1;
    spawnEnemyBullet(state, boss.x, boss.y + 24, (dx / len) * 130, ((state.player.y - boss.y) / len) * 130, "aimed");
  }
}

/* ------------------------------------------------------------ 敌弹 */

function updateEnemyBullets(state, dt) {
  const scale = state.overload.active > 0 ? OVERLOAD_SLOW : 1;
  const step = dt * scale;
  const p = state.player;
  const bullets = state.enemyBullets;
  for (const bullet of bullets) {
    bullet.x += bullet.vx * step;
    bullet.y += bullet.vy * step;
    bullet.life -= dt;
    if (bullet.y > FIELD_H + 24 || bullet.y < -40 || bullet.x < -30 || bullet.x > FIELD_W + 30 || bullet.life <= 0) {
      bullet.dead = true;
      continue;
    }
    for (const barrier of state.barriers) {
      if (barrier.hp <= 0) continue;
      if (Math.abs(bullet.x - barrier.cx) <= barrier.w / 2 && bullet.y + bullet.r >= barrier.y && bullet.y - bullet.r <= barrier.y + barrier.h) {
        barrier.hp = Math.max(0, barrier.hp - 1);
        bullet.dead = true;
        pushEvent(state, { type: "barrierChip", x: bullet.x, y: barrier.y });
        break;
      }
    }
  }
  if (state.captured || p.invuln > 0) {
    state.enemyBullets = bullets.filter((b) => !b.dead);
    return;
  }
  for (const bullet of bullets) {
    if (bullet.dead) continue;
    const dx = bullet.x - p.x;
    const dy = bullet.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= CORE_R + bullet.r) {
      bullet.dead = true;
      hitPlayer(state, bullet);
      continue;
    }
    if (!bullet.grazed && dist <= GRAZE_R + bullet.r) {
      bullet.grazed = true;
      state.stats.graze += 1;
      state.overload.charge = Math.min(OVERLOAD_MAX, state.overload.charge + 7);
      state.score = clampScore(state.score + grazeScore(state.combo, state.overload.active > 0));
      pushEvent(state, { type: "graze", x: bullet.x, y: bullet.y });
    }
  }
  state.enemyBullets = bullets.filter((b) => !b.dead);
}

function hitPlayer(state, bullet) {
  const p = state.player;
  state.combo = 0;
  state.comboTimer = 0;
  state.stats.hitsTaken += 1;
  p.shields -= 1;
  pushEvent(state, { type: "hit", x: p.x, y: p.y });
  if (p.shields < 0) {
    loseLife(state, "shot");
  } else {
    p.invuln = Math.max(p.invuln, 0.8);
  }
}

function loseLife(state, reason) {
  const p = state.player;
  state.lives -= 1;
  state.captured = null;
  p.dual = false;
  p.drones = 0;
  p.shields = MAX_SHIELD;
  p.x = FIELD_W / 2;
  p.y = PLAYER_Y;
  p.vx = 0;
  p.invuln = MAX_GRACE;
  state.combo = 0;
  state.comboTimer = 0;
  state.overload.charge = 0;
  state.overload.active = 0;
  // 复活清屏：场上敌弹柔化为得分粒子，杜绝"复活即再死"
  const cleared = state.enemyBullets.length;
  state.enemyBullets = [];
  pushEvent(state, { type: "lifeLost", x: p.x, y: p.y, reason, cleared });
  if (state.lives <= 0) {
    state.lives = 0;
    state.phase = PHASES.lost;
    pushEvent(state, { type: "gameOver" });
  }
}

/* ------------------------------------------------------------ 掉落 */

function updateDrops(state, dt) {
  const p = state.player;
  for (const drop of state.drops) {
    drop.y += drop.vy * dt;
    drop.life -= dt;
    if (drop.y > FIELD_H + 20 || drop.life <= 0) {
      drop.dead = true;
      continue;
    }
    if (Math.abs(drop.x - p.x) <= 26 && Math.abs(drop.y - p.y) <= 26) {
      drop.dead = true;
      if (drop.kind === "drone" && p.drones < MAX_DRONES) {
        p.drones += 1;
        pushEvent(state, { type: "pickup", kind: "drone", x: p.x, y: p.y });
      } else {
        p.shields = Math.min(MAX_SHIELD, p.shields + 1);
        pushEvent(state, { type: "pickup", kind: "shield", x: p.x, y: p.y });
      }
    }
  }
  state.drops = state.drops.filter((d) => !d.dead);
}

/* -------------------------------------------------------- 防线失守 */

function checkBreach(state, dt) {
  if (state.spec?.boss) {
    state.breach = 0;
    return;
  }
  const lowest = state.formation?.lowest ?? 0;
  if (lowest < BREACH_Y) {
    state.breach = 0;
    return;
  }
  state.breach += dt;
  if (state.breach >= BREACH_DRAIN) {
    state.breach = 0;
    pushEvent(state, { type: "breach", x: state.player.x, y: state.player.y });
    if (state.player.invuln <= 0 && !state.captured) {
      state.player.shields -= 1;
      state.stats.hitsTaken += 1;
      if (state.player.shields < 0) loseLife(state, "breach");
      else state.player.invuln = Math.max(state.player.invuln, 0.8);
    }
  }
}

/* ------------------------------------------------------------ 波次结算 */

function checkWaveEnd(state) {
  if (state.phase !== PHASES.playing) return;
  const bossAlive = Boolean(state.boss && state.boss.hp > 0);
  const enemiesAlive = state.enemies.some((e) => e.alive);
  if (bossAlive || enemiesAlive) return;
  finishWave(state);
}

function finishWave(state) {
  const stats = state.stats;
  const accuracy = stats.shots > 0 ? stats.hits / stats.shots : 0;
  const stars = starsFor({
    shots: stats.shots,
    hits: stats.hits,
    hitsTaken: stats.hitsTaken,
    timeUsed: state.time,
    par: state.spec.par,
  });
  const bonus = waveClearBonus(state.spec, state.time, stats.hitsTaken === 0);
  state.score = clampScore(state.score + bonus);
  const cleared = state.mode === "campaign" ? state.waveIndex >= TOTAL_WAVES - 1 : state.mode === "rush" ? state.waveIndex >= SECTOR_COUNT - 1 : false;
  state.lastResult = {
    mode: state.mode,
    wave: state.waveIndex,
    sector: state.spec.sector ?? 0,
    boss: Boolean(state.spec.boss),
    stars,
    score: state.score,
    bonus,
    accuracy,
    kills: stats.kills,
    graze: stats.graze,
    rescued: stats.rescued,
    hitsTaken: stats.hitsTaken,
    time: state.mode === "rush" ? state.rushTime : state.time,
    maxCombo: stats.maxCombo,
    won: cleared,
  };
  state.phase = cleared ? PHASES.won : PHASES.cleared;
  pushEvent(state, { type: cleared ? "campaignWin" : "waveClear", stars });
}

export function isTerminal(state) {
  return state.phase === PHASES.cleared || state.phase === PHASES.won || state.phase === PHASES.lost;
}

export function resultOf(state) {
  if (!state.lastResult) return null;
  const lost = state.phase === PHASES.lost;
  return {
    ...state.lastResult,
    lost,
    score: state.score,
    lives: state.lives,
    time: state.mode === "rush" ? state.rushTime : state.time,
  };
}

/**
 * 逃生走廊校验（无死局的可验证判据）：
 * 在玩家所在的横移带内采样若干条通道，若某条通道在未来 horizon 秒内
 * 都不会被任何敌弹扫到，则玩家可以横移到那里躲开。
 * 引擎的开火预算、弹速上限与带缺口的弹幕共同保证本值恒 ≥ 1。
 */
export function safeLanes(state, horizon = 0.55, samples = 48) {
  if (!state || state.phase !== PHASES.playing) return samples;
  const bullets = state.enemyBullets;
  const span = PLAYER_MAX_X - PLAYER_MIN_X;
  const scale = state.overload.active > 0 ? OVERLOAD_SLOW : 1;
  const player = state.player;
  // 只有"这段时间内真的赶得到"的通道才算逃生通道，否则判据形同虚设
  const reach = PLAYER_SPEED * horizon;
  let safe = 0;
  for (let i = 0; i < samples; i += 1) {
    const lx = PLAYER_MIN_X + (span * i) / (samples - 1);
    if (Math.abs(lx - player.x) > reach) continue;
    let blocked = false;
    for (let t = 0; t <= horizon; t += 0.06) {
      for (const bullet of bullets) {
        const bx = bullet.x + bullet.vx * scale * t;
        const by = bullet.y + bullet.vy * scale * t;
        if (Math.abs(by - PLAYER_Y) > 26) continue;
        if (Math.abs(bx - lx) <= CORE_R + bullet.r + 2) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;
    }
    if (!blocked) safe += 1;
  }
  return safe;
}

/** 只读诊断出口：供测试与渲染读取真实状态，避免验收脚本复刻逻辑。 */
export function snapshot(state) {
  return {
    phase: state.phase,
    wave: state.waveIndex,
    score: state.score,
    lives: state.lives,
    combo: state.combo,
    shields: state.player.shields,
    dual: state.player.dual,
    drones: state.player.drones,
    overload: state.overload.charge,
    overloadActive: state.overload.active > 0,
    captured: Boolean(state.captured),
    enemies: state.enemies.filter((e) => e.alive).length,
    bossHp: state.boss ? state.boss.hp : 0,
    enemyBullets: state.enemyBullets.length,
    safeLanes: safeLanes(state),
  };
}

export { COMBO_MAX, COMBO_WINDOW, SCORE_CAP, comboMultiplier, WAVES_PER_SECTOR, TOTAL_WAVES, SECTOR_COUNT };
