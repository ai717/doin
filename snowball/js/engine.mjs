// Deterministic, DOM-free platform engine for Snowball Bros.
// All coordinates are in the fixed 960 x 540 stage space.

import { getLevel, LAYOUTS, RUSH, STAGE_W, STAGE_H, TOTAL_LEVELS, LEVELS_PER_CHAPTER } from "./levels.mjs";
import { starsFor, killScore, timeBonus } from "./score.mjs";

export const GRAVITY = 1900;
export const MOVE_SPEED = 260;
export const JUMP_SPEED = 680;
export const MAX_FALL = 1180;
export const FIXED_DT = 1 / 60;
export const RUSH_SECONDS = RUSH.duration;

const PLAYER_W = 26;
const PLAYER_H = 34;

const DIMS = {
  slime: { w: 28, h: 26, resist: 0.9, speed: 64 },
  flyer: { w: 32, h: 24, resist: 0.8, speed: 0 },
  thrower: { w: 28, h: 36, resist: 1.35, speed: 0 },
  armored: { w: 34, h: 34, resist: 2.4, speed: 38 },
  boss: { w: 88, h: 88, resist: 99, speed: 0 },
};

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

function makePlayer(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    w: PLAYER_W,
    h: PLAYER_H,
    facing: 1,
    onGround: true,
    coyote: 0,
    jumpBuffer: 0,
    spray: false,
    sprayPhase: 0,
    walk: 0,
    invuln: 0,
    respawn: 0,
    air: 0,
    springLock: false,
  };
}

function makeEnemy(session, spec) {
  const dims = DIMS[spec.type] ?? DIMS.slime;
  const y = spec.type === "boss" ? spec.y : spec.y - dims.h / 2;
  return {
    id: session.nextId++,
    type: spec.type,
    x: spec.x,
    y,
    baseX: spec.x,
    baseY: y,
    w: dims.w,
    h: dims.h,
    speed: dims.speed,
    resist: dims.resist,
    dir: spec.dir ?? (spec.x < STAGE_W / 2 ? 1 : -1),
    phase: (spec.x / STAGE_W) * Math.PI * 2,
    range: spec.type === "boss" ? 210 : spec.type === "flyer" ? 86 : 0,
    freeze: 0,
    hp: spec.hp ?? (spec.type === "boss" ? 3 : 1),
    maxHp: spec.hp ?? (spec.type === "boss" ? 3 : 1),
    throwTimer: 1.2 + nextRandom(session) * 0.8,
    invuln: 0,
    alive: true,
  };
}

function makeWorld(session, level, rush = false) {
  const layout = level.layout;
  const bricks = (layout.bricks ?? []).map((brick) => ({
    ...brick,
    id: session.nextId++,
    alive: true,
  }));
  const enemies = rush ? [] : level.enemies.map((spec) => makeEnemy(session, spec));
  if (!rush && level.boss) enemies.push(makeEnemy(session, { type: "boss", ...level.boss }));
  return {
    player: makePlayer(level.playerSpawn),
    platforms: layout.platforms.map((plat) => ({ ...plat })),
    bricks,
    enemies,
    snowballs: [],
    projectiles: [],
    items: [],
    particles: [],
    floats: [],
    shake: 0,
    spawnTimer: 2,
    wave: 0,
  };
}

export function createSession(options = {}) {
  const mode = options.mode === "rush" ? "rush" : "level";
  const levelIndex = clamp(Math.floor(Number(options.levelIndex) || 0), 0, TOTAL_LEVELS - 1);
  const level = mode === "rush"
    ? { ...RUSH, layout: LAYOUTS[RUSH.layoutIndex] }
    : getLevel(levelIndex);
  const seed = (options.seed ?? (mode === "rush" ? 77001 : 4200 + levelIndex * 37)) >>> 0;
  const session = {
    mode,
    status: "playing",
    paused: false,
    levelIndex,
    chapter: mode === "rush" ? 0 : Math.floor(levelIndex / LEVELS_PER_CHAPTER),
    level,
    par: mode === "rush" ? RUSH_SECONDS : level.par,
    lives: clamp(Number(options.lives) || 3, 0, 9),
    score: Math.max(0, Math.floor(Number(options.score) || 0)),
    elapsed: 0,
    rushTime: mode === "rush" ? RUSH_SECONDS : 0,
    rushKills: 0,
    chain: 0,
    chainTimer: 0,
    maxChain: 0,
    kills: 0,
    damaged: false,
    stars: 0,
    completed: false,
    events: [],
    nextId: 1,
    rngState: seed,
    seed,
    rand: mulberry32(seed),
    world: null,
  };
  session.world = makeWorld(session, level, mode === "rush");
  return session;
}

export function pause(session) {
  if (session.status === "playing") session.paused = true;
}

export function resume(session) {
  session.paused = false;
}

export function togglePause(session) {
  if (session.status !== "playing") return;
  session.paused = !session.paused;
}

export function drainEvents(session) {
  const events = session.events;
  session.events = [];
  return events;
}

function solids(world) {
  const list = world.platforms.slice();
  for (const brick of world.bricks) {
    if (brick.alive) list.push({ x: brick.x, y: brick.y, w: brick.w, h: brick.h, type: "brick" });
  }
  return list;
}

function supportAt(world, x, footY, margin = 3) {
  for (const plat of solids(world)) {
    if (x >= plat.x + margin && x <= plat.x + plat.w - margin && Math.abs(footY - plat.y) < 1.2) return plat;
  }
  return null;
}

function standingPlatform(world, player) {
  return supportAt(world, player.x, player.y, 2);
}

function springUnder(world, player) {
  for (const plat of world.platforms) {
    if (plat.type !== "spring") continue;
    const overlapX = player.x + PLAYER_W / 2 > plat.x && player.x - PLAYER_W / 2 < plat.x + plat.w;
    if (overlapX && player.y >= plat.y - 1 && player.y <= plat.y + 12) return plat;
  }
  return null;
}

function optionAxis(input) {
  const raw = Number(input?.axis);
  if (!Number.isFinite(raw)) return 0;
  return clamp(raw, -1, 1);
}

function playerRect(player) {
  return { x: player.x - player.w / 2, y: player.y - player.h, w: player.w, h: player.h };
}

function rectOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleRect(cx, cy, r, rect) {
  const nearX = clamp(cx, rect.x, rect.x + rect.w);
  const nearY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nearX;
  const dy = cy - nearY;
  return dx * dx + dy * dy <= r * r;
}

function spawnParticles(session, x, y, count, color, speed = 160) {
  const world = session.world;
  for (let i = 0; i < count; i += 1) {
    const angle = nextRandom(session) * Math.PI * 2;
    const power = 40 + nextRandom(session) * speed;
    world.particles.push({
      x,
      y,
      vx: Math.cos(angle) * power,
      vy: Math.sin(angle) * power - 40,
      life: 0.3 + nextRandom(session) * 0.45,
      max: 0.75,
      r: 1.5 + nextRandom(session) * 3,
      color,
    });
  }
  if (world.particles.length > 260) world.particles.splice(0, world.particles.length - 260);
}

function addFloat(session, x, y, text, color = "#ffffff") {
  session.world.floats.push({ x, y, text: String(text), life: 0.9, color });
  if (session.world.floats.length > 18) session.world.floats.shift();
}

function shake(session, amount) {
  session.world.shake = Math.min(16, Math.max(session.world.shake, amount));
}

function resetPlayer(session) {
  const player = session.world.player;
  const spawn = session.level.playerSpawn;
  player.x = spawn.x;
  player.y = spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.invuln = Math.max(player.invuln, 2);
  player.respawn = 0;
  player.spray = false;
  player.springLock = false;
}

function hurtPlayer(session) {
  const player = session.world.player;
  if (session.status !== "playing" || player.invuln > 0 || player.respawn > 0) return;
  session.lives -= 1;
  session.damaged = true;
  player.invuln = 2.2;
  player.respawn = 0.85;
  shake(session, 10);
  emit(session, "hurt", { lives: session.lives });
  spawnParticles(session, player.x, player.y - 16, 16, "#9fd8ff", 220);
  if (session.lives <= 0) {
    session.lives = 0;
    session.status = "gameover";
    emit(session, "gameover");
  }
}

function registerKill(session, enemy) {
  const world = session.world;
  session.chain = session.chainTimer > 0 ? session.chain + 1 : 1;
  session.chainTimer = 1.7;
  session.maxChain = Math.max(session.maxChain, session.chain);
  session.kills += 1;
  if (session.mode === "rush") session.rushKills += 1;
  const gain = enemy.type === "boss" ? 1500 : killScore(session.chain);
  session.score += gain;
  addFloat(session, enemy.x, enemy.y - enemy.h / 2 - 6, `+${gain}`, session.chain >= 3 ? "#ffe27a" : "#ffffff");
  shake(session, session.chain >= 3 ? 8 : 4);
  emit(session, "kill", { chain: session.chain, x: enemy.x, y: enemy.y });
  spawnParticles(session, enemy.x, enemy.y, enemy.type === "boss" ? 30 : 12, enemy.type === "boss" ? "#b9f4ff" : "#ffffff", enemy.type === "boss" ? 300 : 200);
  if (session.chain >= 3) {
    session.score += 150;
    emit(session, "avalanche", { chain: session.chain });
    addFloat(session, enemy.x, enemy.y - 34, "AVALANCHE", "#ffe27a");
  }
}

function killEnemy(session, enemy) {
  if (!enemy.alive) return;
  enemy.alive = false;
  registerKill(session, enemy);
  const world = session.world;
  if (enemy.type !== "boss" && session.mode !== "rush" && nextRandom(session) < 0.24) {
    world.items.push({
      type: nextRandom(session) < 0.32 ? "heart" : "star",
      x: enemy.x,
      y: enemy.y,
      vy: -80,
      life: 12,
    });
  }
}

function freezeEnemy(session, enemy) {
  if (!enemy.alive) return;
  enemy.alive = false;
  const world = session.world;
  const radius = Math.max(16, Math.min(24, enemy.w * 0.58));
  let y = Math.max(radius + 2, enemy.y + enemy.h / 2 - radius);
  for (const solid of solids(world)) {
    const overlapX = enemy.x + radius - 3 > solid.x && enemy.x - radius + 3 < solid.x + solid.w;
    if (overlapX && y < solid.y && y + radius > solid.y) y = solid.y - radius;
  }
  world.snowballs.push({
    id: session.nextId++,
    x: enemy.x,
    y,
    r: radius,
    vx: 0,
    vy: 0,
    dir: 1,
    rolling: false,
    escape: 7,
    age: 0,
    spin: 0,
    trail: 0,
  });
  emit(session, "freeze", { x: enemy.x, y: enemy.y });
  spawnParticles(session, enemy.x, enemy.y, 12, "#dff6ff", 150);
  shake(session, 3);
}

function updateSpray(session, dt) {
  const world = session.world;
  const player = world.player;
  if (!player.spray) return;
  const dir = player.facing;
  const mouth = player.x + dir * 16;
  const box = {
    x: dir > 0 ? mouth : mouth - 112,
    y: player.y - 48,
    w: 112,
    h: 52,
  };
  for (const enemy of world.enemies) {
    if (!enemy.alive || enemy.type === "boss") continue;
    const rect = { x: enemy.x - enemy.w / 2, y: enemy.y - enemy.h / 2, w: enemy.w, h: enemy.h };
    if (!rectOverlap(box, rect)) continue;
    enemy.freeze += (dt * 2.1) / enemy.resist;
    if (enemy.type === "flyer") enemy.freeze += dt * 0.6;
    if (enemy.freeze >= 1) freezeEnemy(session, enemy);
    else if (nextRandom(session) < dt * 14) {
      spawnParticles(session, enemy.x, enemy.y, 1, "#ffffff", 40);
    }
  }
  for (const projectile of world.projectiles) {
    const near = projectile.x > box.x && projectile.x < box.x + box.w && projectile.y > box.y && projectile.y < box.y + box.h;
    if (near) {
      projectile.dead = true;
      spawnParticles(session, projectile.x, projectile.y, 4, "#dff6ff", 80);
    }
  }
  world.projectiles = world.projectiles.filter((shot) => !shot.dead);
}

function updatePlayer(session, input, dt) {
  const world = session.world;
  const player = world.player;
  if (player.respawn > 0) {
    player.respawn -= dt;
    if (player.respawn <= 0) resetPlayer(session);
    return;
  }
  if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt);
  player.coyote = Math.max(0, player.coyote - dt);
  player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);

  const axis = optionAxis(input);
  if (input?.jumpPressed) player.jumpBuffer = 0.1;
  const spraying = Boolean(input?.spray);
  player.spray = spraying;
  if (spraying) player.sprayPhase += dt * 22;
  else player.sprayPhase = 0;

  const plat = standingPlatform(world, player);
  const onIce = plat?.type === "ice";
  const maxSpeed = spraying ? 96 : MOVE_SPEED;
  const accel = spraying ? 700 : onIce ? 900 : 2400;
  const target = axis * maxSpeed;
  if (target !== 0) {
    player.vx += clamp(target - player.vx, -accel * dt, accel * dt);
    player.facing = target > 0 ? 1 : -1;
  } else {
    const drag = (onIce ? 260 : 2100) * dt;
    if (Math.abs(player.vx) <= drag) player.vx = 0;
    else player.vx -= Math.sign(player.vx) * drag;
  }
  if (Math.abs(player.vx) > 2) player.walk += dt * 9;

  if (player.jumpBuffer > 0 && (player.onGround || player.coyote > 0)) {
    player.vy = -JUMP_SPEED;
    player.onGround = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
    emit(session, "jump");
  }

  player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt);
  player.x = clamp(player.x + player.vx * dt, PLAYER_W / 2 + 2, STAGE_W - PLAYER_W / 2 - 2);

  const wasGround = player.onGround;
  const prevY = player.y;
  player.y += player.vy * dt;
  if (player.vy >= 0) {
    let landing = null;
    for (const solid of solids(world)) {
      const overlapX = player.x + PLAYER_W / 2 - 3 > solid.x && player.x - PLAYER_W / 2 + 3 < solid.x + solid.w;
      if (!overlapX) continue;
      if (prevY <= solid.y + 0.6 && player.y >= solid.y) {
        if (!landing || solid.y < landing.y) landing = solid;
      }
    }
    if (landing) {
      const fallingFast = player.vy > 320;
      player.y = landing.y;
      player.vy = 0;
      player.onGround = true;
      player.coyote = 0;
      player.air = 0;
      if (landing.type === "spring") {
        player.vy = -930;
        player.onGround = false;
        player.springLock = true;
        emit(session, "spring");
        spawnParticles(session, player.x, player.y, 8, "#ffe9b8", 160);
      } else if (!wasGround && fallingFast) {
        emit(session, "land");
        spawnParticles(session, player.x, player.y, 5, "#ffffff", 90);
      }
    } else {
      player.onGround = false;
      if (wasGround) player.coyote = 0.08;
      player.air += dt;
    }
  } else {
    player.onGround = false;
    player.air += dt;
  }

  const spring = springUnder(world, player);
  if (spring && !player.springLock) {
    player.vy = -930;
    player.onGround = false;
    player.springLock = true;
    emit(session, "spring");
    spawnParticles(session, player.x, player.y, 8, "#ffe9b8", 160);
  } else if (!spring) {
    player.springLock = false;
  }

  if (player.y > STAGE_H + 80) hurtPlayer(session);
  updateSpray(session, dt);
}

function pushSnowballs(session, input) {
  const world = session.world;
  const player = world.player;
  const axis = optionAxis(input);
  if (!axis) return;
  for (const ball of world.snowballs) {
    if (ball.rolling) continue;
    const dx = ball.x - player.x;
    if (Math.sign(dx) !== Math.sign(axis)) continue;
    if (Math.abs(dx) > ball.r + 22) continue;
    if (Math.abs(ball.y - (player.y - PLAYER_H / 2)) > ball.r + 26) continue;
    ball.rolling = true;
    ball.dir = Math.sign(axis);
    ball.vx = ball.dir * 300;
    ball.vy = 0;
    emit(session, "push", { x: ball.x, y: ball.y });
    shake(session, 3);
    spawnParticles(session, ball.x - ball.dir * ball.r, ball.y, 5, "#ffffff", 90);
  }
}

function enemyRect(enemy) {
  return { x: enemy.x - enemy.w / 2, y: enemy.y - enemy.h / 2, w: enemy.w, h: enemy.h };
}

function updateEnemies(session, dt) {
  const world = session.world;
  const player = world.player;
  for (const enemy of world.enemies) {
    if (!enemy.alive) continue;
    if (enemy.invuln > 0) enemy.invuln = Math.max(0, enemy.invuln - dt);
    if (enemy.type === "boss") {
      enemy.phase += dt * 0.55;
      enemy.x = enemy.baseX + Math.sin(enemy.phase) * enemy.range;
      enemy.y = enemy.baseY + Math.sin(enemy.phase * 0.9) * 12;
      enemy.throwTimer -= dt;
      if (enemy.throwTimer <= 0) {
        enemy.throwTimer = 2.1;
        for (let spread = -1; spread <= 1; spread += 1) {
          const dx = player.x - enemy.x;
          const dy = player.y - 16 - enemy.y;
          const len = Math.max(1, Math.hypot(dx, dy));
          world.projectiles.push({
            x: enemy.x + spread * 26,
            y: enemy.y + 24,
            vx: (dx / len) * 230 + spread * 46,
            vy: (dy / len) * 200,
            r: 8,
            life: 5,
          });
        }
        emit(session, "bossThrow");
      }
    } else if (enemy.type === "flyer") {
      enemy.phase += dt * 1.5;
      enemy.x = enemy.baseX + Math.sin(enemy.phase) * enemy.range;
      enemy.y = enemy.baseY + Math.sin(enemy.phase * 1.9) * 16;
      enemy.dir = Math.cos(enemy.phase) >= 0 ? 1 : -1;
    } else if (enemy.type === "thrower") {
      enemy.dir = player.x >= enemy.x ? 1 : -1;
      enemy.throwTimer -= dt;
      if (enemy.throwTimer <= 0 && Math.abs(player.x - enemy.x) < 460) {
        enemy.throwTimer = 2.6;
        const dx = player.x - enemy.x;
        const dy = player.y - 16 - enemy.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        world.projectiles.push({
          x: enemy.x + enemy.dir * 12,
          y: enemy.y - 10,
          vx: (dx / len) * 250,
          vy: (dy / len) * 210 - 40,
          r: 7,
          life: 5,
        });
        emit(session, "throw");
      }
    } else {
      const footY = enemy.y + enemy.h / 2;
      const ahead = enemy.x + enemy.dir * (enemy.w / 2 + 7);
      const support = supportAt(world, ahead, footY, 2);
      if (!support || ahead < 20 || ahead > STAGE_W - 20) enemy.dir *= -1;
      enemy.x = clamp(enemy.x + enemy.dir * enemy.speed * dt, enemy.w / 2 + 6, STAGE_W - enemy.w / 2 - 6);
      enemy.phase += dt * 5;
    }
    if (enemy.type !== "boss" && enemy.freeze > 0 && !player.spray) {
      enemy.freeze = Math.max(0, enemy.freeze - dt * 0.55);
    }
  }
  world.enemies = world.enemies.filter((enemy) => enemy.alive);
}

function updateProjectiles(session, dt) {
  const world = session.world;
  const player = world.player;
  for (const shot of world.projectiles) {
    shot.life -= dt;
    shot.vy += 520 * dt;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    if (shot.life <= 0 || shot.y > STAGE_H + 40 || shot.x < -30 || shot.x > STAGE_W + 30) shot.dead = true;
    if (!shot.dead && player.invuln <= 0 && player.respawn <= 0) {
      const box = { x: shot.x - shot.r, y: shot.y - shot.r, w: shot.r * 2, h: shot.r * 2 };
      if (rectOverlap(box, playerRect(player))) {
        shot.dead = true;
        hurtPlayer(session);
      }
    }
  }
  world.projectiles = world.projectiles.filter((shot) => !shot.dead);
}

function updateSnowballs(session, dt) {
  const world = session.world;
  const player = world.player;
  for (const ball of world.snowballs) {
    if (!ball.rolling) {
      ball.escape -= dt;
      ball.vy = Math.min(MAX_FALL, ball.vy + GRAVITY * dt);
      const prevBottom = ball.y + ball.r;
      ball.y += ball.vy * dt;
      if (ball.vy >= 0) {
        let landing = null;
        for (const solid of solids(world)) {
          const overlapX = ball.x + ball.r - 3 > solid.x && ball.x - ball.r + 3 < solid.x + solid.w;
          const sunk = ball.y < solid.y && ball.y + ball.r > solid.y;
          if (overlapX && (sunk || prevBottom <= solid.y + 0.6) && ball.y + ball.r >= solid.y) {
            if (!landing || solid.y < landing.y) landing = solid;
          }
        }
        if (landing) {
          ball.y = landing.y - ball.r;
          ball.vy = 0;
        }
      }
      if (ball.escape <= 0) {
        ball.dead = true;
        world.enemies.push(makeEnemy(session, { type: "slime", x: ball.x, y: ball.y + ball.r }));
        emit(session, "thaw", { x: ball.x, y: ball.y });
        spawnParticles(session, ball.x, ball.y, 8, "#bfeaff", 120);
      }
      continue;
    }
    ball.age += dt;
    ball.spin += dt * (6 + Math.abs(ball.vx) / 60);
    ball.vx += ball.dir * 300 * dt;
    ball.vx = clamp(ball.vx, -720, 720);
    ball.x += ball.vx * dt;
    if (ball.x - ball.r < 6) {
      ball.x = 6 + ball.r;
      ball.dir = 1;
      ball.vx = Math.abs(ball.vx) * 0.9;
      shake(session, 3);
      emit(session, "bounce");
    } else if (ball.x + ball.r > STAGE_W - 6) {
      ball.x = STAGE_W - 6 - ball.r;
      ball.dir = -1;
      ball.vx = -Math.abs(ball.vx) * 0.9;
      shake(session, 3);
      emit(session, "bounce");
    }
    ball.vy = Math.min(MAX_FALL, ball.vy + GRAVITY * 0.85 * dt);
    const prevBottom = ball.y + ball.r;
    ball.y += ball.vy * dt;
    if (ball.vy >= 0) {
      let landing = null;
      for (const solid of solids(world)) {
        const overlapX = ball.x + ball.r - 4 > solid.x && ball.x - ball.r + 4 < solid.x + solid.w;
        const sunk = ball.y < solid.y && ball.y + ball.r > solid.y;
        if (overlapX && (sunk || prevBottom <= solid.y + 1) && ball.y + ball.r >= solid.y) {
          if (!landing || solid.y < landing.y) landing = solid;
        }
      }
      if (landing) {
        ball.y = landing.y - ball.r;
        ball.vy = 0;
      }
    }
    for (const enemy of world.enemies) {
      if (!enemy.alive) continue;
      if (!circleRect(ball.x, ball.y, ball.r + 2, enemyRect(enemy))) continue;
      if (enemy.type === "boss") {
        if (enemy.invuln > 0) continue;
        enemy.hp -= 1;
        enemy.invuln = 0.7;
        session.score += 400;
        addFloat(session, enemy.x, enemy.y - enemy.h / 2, "+400", "#ffe27a");
        shake(session, 9);
        spawnParticles(session, enemy.x, enemy.y, 16, "#bff4ff", 260);
        emit(session, "bossHit", { hp: enemy.hp });
        if (enemy.hp <= 0) killEnemy(session, enemy);
      } else {
        killEnemy(session, enemy);
        const grown = Math.min(46, ball.r + 5);
        ball.y -= grown - ball.r;
        ball.r = grown;
      }
    }
    for (const brick of world.bricks) {
      if (!brick.alive) continue;
      if (!circleRect(ball.x, ball.y, ball.r, { x: brick.x, y: brick.y, w: brick.w, h: brick.h })) continue;
      brick.alive = false;
      session.score += 50;
      addFloat(session, brick.x + brick.w / 2, brick.y, "+50", "#bfeaff");
      spawnParticles(session, brick.x + brick.w / 2, brick.y + brick.h / 2, 14, "#9fe8ff", 200);
      emit(session, "brick");
      shake(session, 5);
      if (brick.item) {
        world.items.push({ type: brick.item, x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, vy: -180, life: 14 });
      }
    }
    for (const shot of world.projectiles) {
      if (Math.hypot(shot.x - ball.x, shot.y - ball.y) < ball.r + shot.r) shot.dead = true;
    }
    if (ball.age > 9 || ball.y > STAGE_H + 90 || ball.x < -130 || ball.x > STAGE_W + 130) ball.dead = true;
  }
  world.projectiles = world.projectiles.filter((shot) => !shot.dead);
  world.snowballs = world.snowballs.filter((ball) => !ball.dead);
}

function updateItems(session, dt) {
  const world = session.world;
  const player = world.player;
  for (const item of world.items) {
    item.life -= dt;
    item.vy = Math.min(700, item.vy + 900 * dt);
    item.y += item.vy * dt;
    if (item.vy > 0) {
      let landing = null;
      const prevBottom = item.y - item.vy * dt + 10;
      for (const solid of solids(world)) {
        if (item.x > solid.x && item.x < solid.x + solid.w && prevBottom <= solid.y + 1 && item.y + 10 >= solid.y) {
          if (!landing || solid.y < landing.y) landing = solid;
        }
      }
      if (landing) {
        item.y = landing.y - 10;
        item.vy = 0;
      }
    }
    if (item.life <= 0 || item.y > STAGE_H + 40) item.dead = true;
    const box = { x: item.x - 10, y: item.y - 10, w: 20, h: 20 };
    if (!item.dead && rectOverlap(box, playerRect(player))) {
      item.dead = true;
      if (item.type === "heart") {
        session.lives = Math.min(5, session.lives + 1);
        emit(session, "item", { kind: "heart" });
        addFloat(session, item.x, item.y - 10, "+1 LIFE", "#ff9fb2");
      } else {
        session.score += 300;
        emit(session, "item", { kind: "star" });
        addFloat(session, item.x, item.y - 10, "+300", "#ffe27a");
      }
    }
  }
  world.items = world.items.filter((item) => !item.dead);
}

function updateEffects(session, dt) {
  const world = session.world;
  for (const particle of world.particles) {
    particle.life -= dt;
    particle.vy += 420 * dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
  }
  world.particles = world.particles.filter((particle) => particle.life > 0);
  for (const float of world.floats) {
    float.life -= dt;
    float.y -= 34 * dt;
  }
  world.floats = world.floats.filter((float) => float.life > 0);
  world.shake = Math.max(0, world.shake - dt * 34);
  if (session.chainTimer > 0) {
    session.chainTimer -= dt;
    if (session.chainTimer <= 0) session.chain = 0;
  }
}

function spawnRushWave(session) {
  const world = session.world;
  if (world.enemies.length >= 9) return;
  world.wave += 1;
  const count = world.wave % 3 === 0 ? 2 : 1;
  for (let i = 0; i < count; i += 1) {
    const flyer = nextRandom(session) < 0.34;
    const x = 90 + nextRandom(session) * (STAGE_W - 180);
    if (flyer) {
      world.enemies.push(makeEnemy(session, { type: "flyer", x, y: 120 + nextRandom(session) * 140 }));
    } else {
      world.enemies.push(makeEnemy(session, { type: "slime", x, y: 500 }));
    }
  }
  emit(session, "wave", { wave: world.wave });
}

function checkClear(session) {
  if (session.status !== "playing") return;
  if (session.mode === "rush") {
    if (session.rushTime <= 0) {
      session.status = "cleared";
      session.stars = starsFor({ mode: "rush", kills: session.rushKills });
      session.score += session.rushKills * 50;
      emit(session, "clear", {
        mode: "rush",
        stars: session.stars,
        score: session.score,
        kills: session.rushKills,
        time: RUSH_SECONDS,
      });
    }
    return;
  }
  if (session.world.enemies.some((enemy) => enemy.alive)) return;
  session.status = "cleared";
  session.stars = starsFor({ time: session.elapsed, par: session.par, damaged: session.damaged });
  const bonus = timeBonus({ time: session.elapsed, par: session.par });
  session.score += bonus;
  if (session.levelIndex >= TOTAL_LEVELS - 1) session.completed = true;
  emit(session, "clear", {
    mode: "level",
    stars: session.stars,
    score: session.score,
    time: session.elapsed,
    chain: session.maxChain,
    bonus,
    completed: session.completed,
  });
}

export function step(session, input = {}, dt = FIXED_DT) {
  if (!session || session.status !== "playing" || session.paused) return session;
  const clamped = clamp(Number(dt) || FIXED_DT, 0.001, 0.05);
  session.elapsed += clamped;
  if (session.mode === "rush") {
    session.rushTime = Math.max(0, session.rushTime - clamped);
    session.world.spawnTimer -= clamped;
    if (session.world.spawnTimer <= 0) {
      session.world.spawnTimer = 2.9;
      spawnRushWave(session);
    }
  }
  updatePlayer(session, input, clamped);
  pushSnowballs(session, input);
  updateEnemies(session, clamped);
  updateSnowballs(session, clamped);
  updateProjectiles(session, clamped);
  updateItems(session, clamped);
  updateEffects(session, clamped);
  checkClear(session);
  return session;
}

export function debugClearEnemies(session) {
  if (!session || session.mode !== "level") return;
  for (const enemy of session.world.enemies) {
    if (enemy.type === "boss") enemy.hp = 0;
    enemy.alive = false;
  }
}

export function debugKillEnemy(session, index = 0) {
  const enemy = session?.world?.enemies?.[index];
  if (!enemy || !enemy.alive) return false;
  killEnemy(session, enemy);
  session.world.enemies = session.world.enemies.filter((item) => item.alive);
  return true;
}

export function debugHurt(session) {
  const player = session?.world?.player;
  if (!player) return;
  player.invuln = 0;
  player.respawn = 0;
  hurtPlayer(session);
}

export function debugSetPlayer(session, x, y) {
  const player = session?.world?.player;
  if (!player) return;
  player.x = clamp(x, 14, STAGE_W - 14);
  player.y = y;
  player.vx = 0;
  player.vy = 0;
}
