// Deterministic, DOM-free bullet-hell engine for Raiden Lite.
// Coordinates live in a fixed 540 x 900 portrait stage; the player uses a tiny hitbox.

import {
  ENEMIES,
  STAGES,
  STAGE_H,
  STAGE_W,
  TRAINING,
  getStage,
  waveSlots,
} from "./levels.mjs";
import { GRAZE_ENERGY, GRAZE_SCORE, bossScore, killScore, starsForStage, starsForTraining, stageBonus } from "./score.mjs";

export const FIXED_DT = 1 / 60;
export const PLAYER_SPEED = 330;
export const PLAYER_SLOW = 145;
export const PLAYER_HIT_R = 4;
export const GRAZE_R = 27;
export const CHARGE_TIME = 1.1;
export const MAX_BOMBS = 3;
export const MAX_WEAPON = 3;
export const START_LIVES = 3;
export const START_BOMBS = 2;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nextRandom(session) {
  session.rngState = (session.rngState + 0x6d2b79f5) >>> 0;
  let t = session.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function emit(session, type, data = {}) {
  session.events.push({ type, ...data });
}

function makePlayer() {
  return {
    x: STAGE_W / 2,
    y: STAGE_H - 130,
    r: PLAYER_HIT_R,
    charge: 0,
    charging: false,
    fullAnnounced: false,
    bombBuffer: 0,
    invuln: 1.2,
    fireTimer: 0,
    hits: 0,
  };
}

function makeWorld() {
  return {
    player: makePlayer(),
    bullets: [],
    enemyBullets: [],
    enemies: [],
    items: [],
    particles: [],
    floats: [],
    beam: null,
    emitters: [],
    flash: 0,
    shake: 0,
  };
}

export function createSession(options = {}) {
  const mode = options.mode === "training" ? "training" : "stage";
  const stageIndex = clamp(Math.floor(Number(options.stageIndex) || 0), 0, STAGES.length - 1);
  const stage = mode === "training"
    ? { ...TRAINING, waves: [], boss: null }
    : getStage(stageIndex);
  const seed = (options.seed ?? (mode === "training" ? 91100 : 8100 + stageIndex * 131)) >>> 0;
  const session = {
    mode,
    status: "playing",
    paused: false,
    stageIndex,
    stage,
    time: 0,
    stageTime: 0,
    lives: mode === "training" ? START_LIVES : clamp(Number(options.lives) || START_LIVES, 0, 9),
    bombs: mode === "training" ? MAX_BOMBS : clamp(Number(options.bombs) || START_BOMBS, 0, MAX_BOMBS),
    bombEnergy: 0,
    bombsUsed: 0,
    weapon: clamp(Number(options.weapon) || 1, 1, MAX_WEAPON),
    score: Math.max(0, Math.floor(Number(options.score) || 0)),
    kills: 0,
    graze: 0,
    maxGraze: 0,
    damaged: false,
    stars: 0,
    completed: false,
    waveIndex: 0,
    pending: [],
    bossSpawned: false,
    boss: null,
    trainingTimer: 0.8,
    trainingPattern: 0,
    events: [],
    nextId: 1,
    rngState: seed,
    seed,
    world: makeWorld(),
  };
  if (mode === "training") {
    session.world.player.invuln = 1;
  }
  return session;
}

export function pause(session) {
  if (session?.status === "playing") session.paused = true;
}

export function resume(session) {
  if (session) session.paused = false;
}

export function togglePause(session) {
  if (!session || session.status !== "playing") return;
  session.paused = !session.paused;
}

export function drainEvents(session) {
  if (!session) return [];
  const events = session.events;
  session.events = [];
  return events;
}

function addFloat(session, x, y, text, color = "#dff6ff") {
  session.world.floats.push({ x, y, text: String(text), life: 0.85, color });
  if (session.world.floats.length > 20) session.world.floats.shift();
}

function spawnParticles(session, x, y, count, color, speed = 180) {
  const world = session.world;
  for (let i = 0; i < count; i += 1) {
    const angle = nextRandom(session) * Math.PI * 2;
    const power = 40 + nextRandom(session) * speed;
    world.particles.push({
      x,
      y,
      vx: Math.cos(angle) * power,
      vy: Math.sin(angle) * power,
      life: 0.25 + nextRandom(session) * 0.45,
      max: 0.7,
      r: 1.4 + nextRandom(session) * 2.8,
      color,
    });
  }
  if (world.particles.length > 300) world.particles.splice(0, world.particles.length - 300);
}

function shake(session, amount) {
  session.world.shake = Math.min(18, Math.max(session.world.shake, amount));
}

function addEnemyBullet(session, x, y, vx, vy, r = 5.5) {
  const world = session.world;
  if (world.enemyBullets.length > 460) return;
  world.enemyBullets.push({ x, y, vx, vy, r, grazed: false });
}

function aimedAngle(session, fromX, fromY) {
  const player = session.world.player;
  return Math.atan2(player.y - fromY, player.x - fromX);
}

function fireAimedFan(session, x, y, count, spread, speed, radius = 5.5) {
  const base = aimedAngle(session, x, y);
  for (let i = 0; i < count; i += 1) {
    const offset = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread * 2;
    const angle = base + offset;
    addEnemyBullet(session, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, radius);
  }
}

function fireRing(session, x, y, count, speed, offset = 0, radius = 6) {
  for (let i = 0; i < count; i += 1) {
    const angle = offset + (i / count) * Math.PI * 2;
    addEnemyBullet(session, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, radius);
  }
}

function spawnItem(session, x, y) {
  const roll = nextRandom(session);
  let type = null;
  if (roll < 0.16) type = "power";
  else if (roll < 0.22) type = "bomb";
  if (!type) return;
  session.world.items.push({ id: session.nextId++, type, x, y, vy: 120, life: 11 });
  emit(session, "drop", { kind: type });
}

function makeEnemy(session, type, x, y) {
  const dims = ENEMIES[type] ?? ENEMIES.drone;
  return {
    id: session.nextId++,
    type,
    x,
    y,
    homeX: x,
    r: dims.r,
    hp: dims.hp,
    maxHp: dims.hp,
    speed: dims.speed,
    score: dims.score,
    phase: (x / STAGE_W) * Math.PI * 2,
    holdTimer: dims.hold ?? 0,
    fireTimer: (dims.fireEvery ?? 0) * 0.6 + 0.4,
    entered: false,
  };
}

function damageEnemy(session, enemy, amount) {
  if (!enemy || enemy.hp <= 0) return;
  enemy.hp -= amount;
  if (enemy.hp > 0) return;
  enemy.hp = 0;
  const world = session.world;
  world.enemies = world.enemies.filter((item) => item !== enemy);
  session.kills += 1;
  session.score += killScore(enemy.type);
  addFloat(session, enemy.x, enemy.y - enemy.r - 4, `+${enemy.score}`, "#ffe27a");
  spawnParticles(session, enemy.x, enemy.y, enemy.type === "heavy" ? 18 : 10, "#ffcf6a", 220);
  shake(session, enemy.type === "heavy" ? 7 : 3);
  emit(session, "kill", { x: enemy.x, y: enemy.y, kind: enemy.type });
  spawnItem(session, enemy.x, enemy.y);
  checkProgress(session);
}

function damageBoss(session, amount) {
  const boss = session.boss;
  if (!boss || boss.hp <= 0) return;
  boss.hp -= amount;
  emit(session, "bossHit", { hp: Math.max(0, boss.hp) });
  if (boss.hp > 0) return;
  boss.hp = 0;
  session.score += bossScore(session.stageIndex);
  session.world.flash = 0.5;
  shake(session, 16);
  spawnParticles(session, boss.x, boss.y, 46, "#ffe9a8", 320);
  for (let i = 0; i < 5; i += 1) {
    spawnParticles(session, boss.x + (nextRandom(session) - 0.5) * 90, boss.y + (nextRandom(session) - 0.5) * 60, 10, "#ff9a6a", 260);
  }
  addFloat(session, boss.x, boss.y - 40, `+${bossScore(session.stageIndex)}`, "#ffe27a");
  emit(session, "bossDown", { x: boss.x, y: boss.y });
  session.boss = null;
  session.world.enemyBullets = [];
  checkProgress(session);
}

function hurtPlayer(session) {
  if (session.status !== "playing") return;
  const player = session.world.player;
  if (player.invuln > 0) return;
  session.world.enemyBullets = [];
  session.world.flash = 0.32;
  shake(session, 12);
  player.invuln = session.mode === "training" ? 1.6 : 2.6;
  spawnParticles(session, player.x, player.y, 20, "#7fe6ff", 240);
  if (session.mode === "training") {
    player.hits += 1;
    emit(session, "trainingHit");
    return;
  }
  session.lives -= 1;
  session.damaged = true;
  emit(session, "hurt", { lives: session.lives });
  if (session.lives <= 0) {
    session.lives = 0;
    session.status = "gameover";
    emit(session, "gameover");
  }
}

function useBomb(session) {
  if (session.bombs <= 0) return false;
  session.bombs -= 1;
  session.bombsUsed += 1;
  const world = session.world;
  world.enemyBullets = [];
  world.flash = 0.55;
  shake(session, 15);
  world.player.invuln = Math.max(world.player.invuln, 1.7);
  for (const enemy of world.enemies.slice()) damageEnemy(session, enemy, 4);
  if (session.boss) damageBoss(session, 10);
  emit(session, "bomb");
  return true;
}

function fireLaser(session, charge) {
  const world = session.world;
  const player = world.player;
  const power = 3 + Math.round(charge * 9);
  const width = 24 + charge * 26;
  const half = width / 2;
  world.beam = { x: player.x, w: width, life: 0.3, max: 0.3 };
  world.shake = Math.max(world.shake, 6);
  for (const enemy of world.enemies.slice()) {
    if (enemy.y > player.y) continue;
    if (Math.abs(enemy.x - player.x) > half + enemy.r * 0.7) continue;
    damageEnemy(session, enemy, power);
  }
  if (session.boss && !session.boss.enter) {
    if (Math.abs(session.boss.x - player.x) <= half + session.boss.r * 0.8) damageBoss(session, power);
  }
  world.enemyBullets = world.enemyBullets.filter((shot) => !(shot.y < player.y && Math.abs(shot.x - player.x) <= half + shot.r));
  spawnParticles(session, player.x, player.y - 30, 16, "#9ff4ff", 260);
  emit(session, "laser", { power });
}

function addGraze(session, bullet) {
  bullet.grazed = true;
  session.graze += 1;
  session.maxGraze = Math.max(session.maxGraze, session.graze);
  session.score += GRAZE_SCORE;
  if (session.bombs < MAX_BOMBS) {
    session.bombEnergy = Math.min(100, session.bombEnergy + GRAZE_ENERGY);
    if (session.bombEnergy >= 100) {
      session.bombEnergy = 0;
      session.bombs = Math.min(MAX_BOMBS, session.bombs + 1);
      emit(session, "bombReady");
    }
  }
  spawnParticles(session, bullet.x, bullet.y, 2, "#9ff4ff", 70);
  emit(session, "graze");
}

function updatePlayer(session, input, dt) {
  const world = session.world;
  const player = world.player;
  if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt);

  if (input?.bombPressed) player.bombBuffer = 0.16;
  player.bombBuffer = Math.max(0, player.bombBuffer - dt);
  if (player.bombBuffer > 0 && session.bombs > 0 && session.status === "playing") {
    if (useBomb(session)) player.bombBuffer = 0;
  }

  const wantCharge = Boolean(input?.charge);
  if (wantCharge) {
    player.charging = true;
    player.charge = Math.min(1, player.charge + dt / CHARGE_TIME);
    if (player.charge >= 1 && !player.fullAnnounced) {
      player.fullAnnounced = true;
      emit(session, "chargeFull");
    }
  } else if (player.charging) {
    const charge = player.charge;
    player.charging = false;
    player.charge = 0;
    player.fullAnnounced = false;
    if (charge >= 0.18) fireLaser(session, charge);
  }

  let ax = Number(input?.axisX) || 0;
  let ay = Number(input?.axisY) || 0;
  ax = clamp(ax, -1, 1);
  ay = clamp(ay, -1, 1);
  const length = Math.hypot(ax, ay);
  if (length > 1) {
    ax /= length;
    ay /= length;
  }
  const speed = player.charging ? PLAYER_SLOW : input?.slow ? PLAYER_SLOW : PLAYER_SPEED;
  player.x = clamp(player.x + ax * speed * dt, 18, STAGE_W - 18);
  player.y = clamp(player.y + ay * speed * dt, 70, STAGE_H - 18);

  player.fireTimer -= dt;
  if (!player.charging && player.fireTimer <= 0) {
    player.fireTimer = 0.085;
    const level = session.weapon;
    const shots = level === 1
      ? [{ dx: -7, vx: 0 }, { dx: 7, vx: 0 }]
      : level === 2
        ? [{ dx: -8, vx: 0 }, { dx: 8, vx: 0 }, { dx: 0, vx: 0 }]
        : [{ dx: -10, vx: -110 }, { dx: 10, vx: 110 }, { dx: -18, vx: -230 }, { dx: 18, vx: 230 }];
    for (const shot of shots) {
      world.bullets.push({
        x: player.x + shot.dx,
        y: player.y - 16,
        vx: shot.vx,
        vy: -1020,
        r: 3.6,
        dmg: 1,
      });
    }
    emit(session, "shot");
  }
}

function updatePlayerBullets(session, dt) {
  const world = session.world;
  for (const shot of world.bullets) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    if (shot.y < -20 || shot.x < -20 || shot.x > STAGE_W + 20) {
      shot.dead = true;
      continue;
    }
    for (const enemy of world.enemies.slice()) {
      if (Math.hypot(shot.x - enemy.x, shot.y - enemy.y) <= shot.r + enemy.r) {
        shot.dead = true;
        damageEnemy(session, enemy, shot.dmg);
        spawnParticles(session, shot.x, shot.y, 2, "#bff4ff", 60);
        break;
      }
    }
    if (shot.dead) continue;
    const boss = session.boss;
    if (boss && !boss.enter && Math.hypot(shot.x - boss.x, shot.y - boss.y) <= shot.r + boss.r * 0.82) {
      shot.dead = true;
      damageBoss(session, shot.dmg);
      spawnParticles(session, shot.x, shot.y, 3, "#bff4ff", 80);
    }
  }
  world.bullets = world.bullets.filter((shot) => !shot.dead);
}

function updateEnemies(session, dt) {
  const world = session.world;
  const player = world.player;
  for (const enemy of world.enemies.slice()) {
    enemy.phase += dt * 2.1;
    if (enemy.type === "drone") {
      enemy.y += enemy.speed * dt;
    } else if (enemy.type === "zigzag") {
      enemy.y += enemy.speed * dt;
      enemy.x = clamp(enemy.homeX + Math.sin(enemy.phase) * 74, 26, STAGE_W - 26);
    } else if (enemy.type === "gunner") {
      if (enemy.y < ENEMIES.gunner.holdY) {
        enemy.y += enemy.speed * dt;
      } else {
        if (!enemy.entered) {
          enemy.entered = true;
          enemy.x = enemy.homeX;
        }
        enemy.holdTimer -= dt;
        enemy.fireTimer -= dt;
        if (enemy.fireTimer <= 0) {
          enemy.fireTimer = ENEMIES.gunner.fireEvery;
          fireAimedFan(session, enemy.x, enemy.y + 12, 3, 0.13, 205, 5.5);
          emit(session, "enemyShot");
        }
        if (enemy.holdTimer <= 0) enemy.y += 250 * dt;
      }
    } else if (enemy.type === "heavy") {
      if (enemy.y < ENEMIES.heavy.holdY) {
        enemy.y += enemy.speed * dt;
      } else {
        enemy.holdTimer -= dt;
        enemy.fireTimer -= dt;
        if (enemy.fireTimer <= 0) {
          enemy.fireTimer = ENEMIES.heavy.fireEvery;
          fireRing(session, enemy.x, enemy.y, 10, 138, enemy.phase, 6);
          emit(session, "enemyShot");
        }
        if (enemy.holdTimer <= 0) enemy.y += 210 * dt;
      }
    }
    if (enemy.y < STAGE_H + 80 && player.invuln <= 0) {
      if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < enemy.r * 0.62 + player.r) hurtPlayer(session);
    }
  }
  world.enemies = world.enemies.filter((enemy) => enemy.y < STAGE_H + 80 && enemy.hp > 0);
}

function updateBoss(session, dt) {
  const boss = session.boss;
  const player = session.world.player;
  if (!boss) return;
  boss.time += dt;
  if (boss.enter) {
    boss.y += 95 * dt;
    if (boss.y >= boss.targetY) {
      boss.y = boss.targetY;
      boss.enter = false;
      emit(session, "bossReady");
    }
    return;
  }
  boss.x = STAGE_W / 2 + Math.sin(boss.time * 0.62) * 108;
  if (Math.hypot(boss.x - player.x, boss.y - player.y) < boss.r * 0.72 + player.r && player.invuln <= 0) hurtPlayer(session);
  const index = Math.floor(boss.time / 3.2) % boss.patterns.length;
  if (index !== boss.patternIndex) {
    boss.patternIndex = index;
    boss.fireTimer = 0.45;
  }
  boss.fireTimer -= dt;
  if (boss.fireTimer > 0) return;
  const pattern = boss.patterns[index];
  if (pattern === "fan") {
    fireAimedFan(session, boss.x, boss.y + 26, 5, 0.34, 205, 6);
    boss.fireTimer = 1.05;
  } else if (pattern === "ring") {
    fireRing(session, boss.x, boss.y, 18, 148, boss.time * 0.4, 6);
    boss.fireTimer = 1.55;
  } else if (pattern === "spiral") {
    const angle = boss.spiral ?? 0;
    addEnemyBullet(session, boss.x, boss.y, Math.cos(angle) * 168, Math.sin(angle) * 168, 6);
    addEnemyBullet(session, boss.x, boss.y, Math.cos(angle + Math.PI) * 168, Math.sin(angle + Math.PI) * 168, 6);
    boss.spiral = angle + 0.38;
    boss.fireTimer = 0.12;
  } else {
    fireAimedFan(session, boss.x, boss.y + 20, 3, 0.16, 215, 6);
    fireRing(session, boss.x, boss.y, 4, 150, boss.time, 6);
    boss.fireTimer = 0.95;
  }
  emit(session, "enemyShot");
  if (Math.hypot(boss.x - player.x, boss.y - player.y) < boss.r * 0.72 + player.r && player.invuln <= 0) hurtPlayer(session);
}

function updateEnemyBullets(session, dt) {
  const world = session.world;
  const player = world.player;
  for (const shot of world.enemyBullets) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    if (shot.x < -24 || shot.x > STAGE_W + 24 || shot.y < -30 || shot.y > STAGE_H + 30) {
      shot.dead = true;
      continue;
    }
    const distance = Math.hypot(shot.x - player.x, shot.y - player.y);
    if (distance <= player.r + shot.r) {
      if (player.invuln <= 0) {
        shot.dead = true;
        hurtPlayer(session);
      }
      continue;
    }
    if (!shot.grazed && player.invuln <= 0 && distance <= GRAZE_R + shot.r) addGraze(session, shot);
  }
  world.enemyBullets = world.enemyBullets.filter((shot) => !shot.dead);
}

function updateItems(session, dt) {
  const world = session.world;
  const player = world.player;
  for (const item of world.items) {
    item.life -= dt;
    item.y += item.vy * dt;
    if (item.life <= 0 || item.y > STAGE_H + 30) {
      item.dead = true;
      continue;
    }
    if (Math.hypot(item.x - player.x, item.y - player.y) < 28) {
      item.dead = true;
      if (item.type === "power") {
        if (session.weapon < MAX_WEAPON) {
          session.weapon += 1;
          addFloat(session, item.x, item.y, "POWER", "#9ff4ff");
        } else {
          session.score += 500;
          addFloat(session, item.x, item.y, "+500", "#ffe27a");
        }
      } else if (session.bombs < MAX_BOMBS) {
        session.bombs += 1;
        addFloat(session, item.x, item.y, "BOMB", "#ffb38a");
      } else {
        session.score += 500;
        addFloat(session, item.x, item.y, "+500", "#ffe27a");
      }
      emit(session, "item", { kind: item.type });
    }
  }
  world.items = world.items.filter((item) => !item.dead);
}

function updateEffects(session, dt) {
  const world = session.world;
  for (const particle of world.particles) {
    particle.life -= dt;
    particle.vy += 220 * dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
  }
  world.particles = world.particles.filter((particle) => particle.life > 0);
  for (const float of world.floats) {
    float.life -= dt;
    float.y -= 30 * dt;
  }
  world.floats = world.floats.filter((float) => float.life > 0);
  world.shake = Math.max(0, world.shake - dt * 40);
  world.flash = Math.max(0, world.flash - dt * 1.6);
  if (world.beam) {
    world.beam.life -= dt;
    if (world.beam.life <= 0) world.beam = null;
  }
}

function triggerWave(session, spec) {
  for (const slot of waveSlots(spec)) {
    session.pending.push({ due: session.stageTime + slot.at, type: spec.type, x: slot.x });
  }
}

function spawnBoss(session) {
  if (session.bossSpawned) return;
  session.bossSpawned = true;
  session.world.enemies = [];
  session.world.enemyBullets = [];
  const data = session.stage.boss ?? { hp: 100, patterns: ["fan"] };
  session.boss = {
    x: STAGE_W / 2,
    y: -90,
    targetY: 168,
    r: 58,
    hp: data.hp,
    maxHp: data.hp,
    patterns: data.patterns.slice(),
    time: 0,
    patternIndex: 0,
    fireTimer: 0.6,
    spiral: 0,
    enter: true,
  };
  session.world.flash = 0.25;
  emit(session, "bossWarn");
}

function spawnTrainingPattern(session) {
  const world = session.world;
  const pattern = TRAINING.patterns[session.trainingPattern % TRAINING.patterns.length];
  session.trainingPattern += 1;
  const x = 110 + nextRandom(session) * (STAGE_W - 220);
  if (pattern === "ring") {
    fireRing(session, x, 150, 20, 126, nextRandom(session) * Math.PI, 5.5);
  } else if (pattern === "fan") {
    fireAimedFan(session, x, 40, 9, 0.5, 175, 5.5);
  } else if (pattern === "spiral") {
    world.emitters.push({ x, y: 140, life: 2.6, timer: 0, angle: nextRandom(session) * Math.PI, speed: 150 });
  } else {
    fireAimedFan(session, 90, 60, 5, 0.24, 190, 5.5);
    fireAimedFan(session, STAGE_W - 90, 60, 5, 0.24, 190, 5.5);
  }
  emit(session, "pattern");
}

function updateEmitters(session, dt) {
  const world = session.world;
  for (const emitter of world.emitters) {
    emitter.life -= dt;
    emitter.timer -= dt;
    while (emitter.timer <= 0 && emitter.life > 0) {
      emitter.timer += 0.1;
      addEnemyBullet(session, emitter.x, emitter.y, Math.cos(emitter.angle) * emitter.speed, Math.sin(emitter.angle) * emitter.speed, 5.5);
      addEnemyBullet(session, emitter.x, emitter.y, Math.cos(emitter.angle + Math.PI) * emitter.speed, Math.sin(emitter.angle + Math.PI) * emitter.speed, 5.5);
      emitter.angle += 0.36;
    }
  }
  world.emitters = world.emitters.filter((emitter) => emitter.life > 0);
}

function updateSpawning(session, dt) {
  if (session.mode === "training") {
    updateEmitters(session, dt);
    session.trainingTimer -= dt;
    if (session.trainingTimer <= 0) {
      session.trainingTimer = TRAINING.interval;
      spawnTrainingPattern(session);
    }
    if (session.stageTime >= TRAINING.duration) {
      session.status = "cleared";
      session.stars = starsForTraining(session.graze);
      session.world.enemyBullets = [];
      emit(session, "clear", { mode: "training", stars: session.stars, graze: session.graze, score: session.score });
    }
    return;
  }

  const waves = session.stage.waves ?? [];
  while (session.waveIndex < waves.length && session.stageTime >= waves[session.waveIndex].t) {
    triggerWave(session, waves[session.waveIndex]);
    session.waveIndex += 1;
  }
  session.pending.sort((a, b) => a.due - b.due);
  while (session.pending.length && session.pending[0].due <= session.stageTime) {
    const spawn = session.pending.shift();
    session.world.enemies.push(makeEnemy(session, spawn.type, spawn.x, -30));
  }
  if (!session.bossSpawned) {
    const lastTime = waves.length ? waves[waves.length - 1].t : 0;
    if (session.waveIndex >= waves.length && session.pending.length === 0 && session.stageTime >= lastTime + 7) spawnBoss(session);
  }
}

function checkProgress(session) {
  if (session.status !== "playing") return;
  if (session.mode === "stage" && session.bossSpawned && !session.boss) {
    session.status = "cleared";
    session.stars = starsForStage({ damaged: session.damaged, bombsUsed: session.bombsUsed });
    const bonus = stageBonus({ lives: session.lives, bombs: session.bombs });
    session.score += bonus;
    session.completed = session.stageIndex >= STAGES.length - 1;
    emit(session, "clear", {
      mode: "stage",
      stars: session.stars,
      score: session.score,
      graze: session.graze,
      bonus,
      completed: session.completed,
    });
  }
}

export function step(session, input = {}, dt = FIXED_DT) {
  if (!session || session.status !== "playing" || session.paused) return session;
  const delta = clamp(Number(dt) || FIXED_DT, 0.001, 0.05);
  session.time += delta;
  session.stageTime += delta;
  updateSpawning(session, delta);
  if (session.status !== "playing") return session;
  updatePlayer(session, input, delta);
  updatePlayerBullets(session, delta);
  updateEnemies(session, delta);
  updateBoss(session, delta);
  updateEnemyBullets(session, delta);
  updateItems(session, delta);
  updateEffects(session, delta);
  checkProgress(session);
  return session;
}

// Pointer dragging bypasses the axis input but remains a pure engine mutation.
export function nudgePlayer(session, dx, dy) {
  const player = session?.world?.player;
  if (!player) return;
  player.x = clamp(player.x + (Number(dx) || 0), 18, STAGE_W - 18);
  player.y = clamp(player.y + (Number(dy) || 0), 70, STAGE_H - 18);
}

export function debugTeleport(session, x, y) {
  const player = session?.world?.player;
  if (!player) return;
  player.x = clamp(x, 18, STAGE_W - 18);
  player.y = clamp(y, 70, STAGE_H - 18);
  player.invuln = Math.max(player.invuln, 0.5);
}

export function debugAddEnemy(session, type, x, y) {
  if (!session || !ENEMIES[type]) return null;
  const enemy = makeEnemy(session, type, clamp(x, 28, STAGE_W - 28), y);
  session.world.enemies.push(enemy);
  return enemy;
}

export function debugClearStage(session) {
  if (!session) return;
  session.world.enemies = [];
  session.boss = null;
  session.bossSpawned = true;
  session.world.enemyBullets = [];
  checkProgress(session);
}

export function debugSpawnBoss(session) {
  if (!session || session.mode !== "stage") return;
  spawnBoss(session);
  if (session.boss) {
    session.boss.enter = false;
    session.boss.y = session.boss.targetY;
  }
}

export function debugCharge(session, value = 1) {
  const player = session?.world?.player;
  if (!player) return;
  player.charge = clamp(Number(value) || 0, 0, 1);
  player.charging = true;
}

export function debugHurt(session) {
  const player = session?.world?.player;
  if (!player) return;
  player.invuln = 0;
  hurtPlayer(session);
}
