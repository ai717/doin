// engine.mjs — the single authority for Tank Assault rules. Strictly DOM-free.
// Fixed step: stepFrame(state, dt). Discrete player intent: applyIntent(state, intent).
// Legal actions never throw. Terminal phases are no-op. rng is injectable so a battle replays.

import {
  GRID,
  TANK_SIZE,
  CELL,
  DIR,
  DX,
  DY,
  OPPOSITE,
  ENEMY_TYPES,
  POWERUPS,
  ORDERS,
  SHELL_PASSABLE,
  parseLevel,
  waveComposition,
  mulberry32,
  hashSeed,
} from "./levels.mjs";
export { mulberry32, hashSeed };
import { clampScore, killScore, brickScore, ricochetBonus, COMBO_WINDOW } from "./score.mjs";

export const PHASES = Object.freeze({
  ready: "ready",
  playing: "playing",
  cleared: "cleared",
  won: "won",
  lost: "lost",
});

export const EPS = 1e-6;
export const PLAYER_SPEED = 5.4;
export const SLIDE_TIME = 0.55; // ice glide after the stick is released
export const FIRE_CD = Object.freeze([0.3, 0.3, 0.24, 0.24]); // indexed by star level
export const SHELL_SPEED = Object.freeze([0, 18, 24, 24]); // indexed by star level
export const MAX_SHELLS = Object.freeze([0, 1, 2, 2]); // indexed by star level
export const STAR_BREAK_STEEL = 3;
export const BASE_HP = 3;
export const START_LIVES = 3;
export const MAX_LIVES = 5;
export const SPAWN_DELAY = 0.6; // materialisation flash, invulnerable during it
export const RESPAWN_DELAY = 1.0;
export const GRACE_TIME = 1.6;
export const SHIELD_TIME = 8;
export const FREEZE_TIME = 8;
export const STEEL_BASE_TIME = 15;
export const JAM_FREEZE = 3;
export const JAM_SMOKE = 3;
export const SNIPER_AIM = 0.5;
export const CHARGE_MAX = 100;
export const CHARGE_PER_KILL = 25;
export const POWERUP_TTL = 20;
export const MAX_ENEMY_SHELLS = 12;
export const ARTILLERY_DMG = 2;
export const ARTILLERY_REACH = 6; // half tiles ahead of the tank
export const ARTILLERY_BOX = 3; // half tile radius of the barrage

function randBetween(rng, [min, max]) {
  return min + rng() * (max - min);
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}

function emit(state, event) {
  state.events.push(event);
  return event;
}

/* ------------------------------------------------------------------ geometry */

function inBounds(c, r) {
  return c >= 0 && c < GRID && r >= 0 && r < GRID;
}

function cellAt(state, c, r) {
  if (!inBounds(c, r)) return CELL.STEEL; // outside the tray behaves like a wall
  return state.grid[r * GRID + c];
}

function baseContains(state, c, r) {
  const b = state.base;
  return c >= b.hx && c < b.hx + TANK_SIZE && r >= b.hy && r < b.hy + TANK_SIZE;
}

function boxContains(x, y, bx, by) {
  return x >= bx && x < bx + TANK_SIZE && y >= by && y < by + TANK_SIZE;
}

function boxOverlap(x1, y1, x2, y2) {
  return (
    x1 + TANK_SIZE - EPS > x2 + EPS &&
    x1 + EPS < x2 + TANK_SIZE - EPS &&
    y1 + TANK_SIZE - EPS > y2 + EPS &&
    y1 + EPS < y2 + TANK_SIZE - EPS
  );
}

function rectFree(state, x, y) {
  const c0 = Math.floor(x + EPS);
  const c1 = Math.floor(x + TANK_SIZE - EPS);
  const r0 = Math.floor(y + EPS);
  const r1 = Math.floor(y + TANK_SIZE - EPS);
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      if (!inBounds(c, r)) return false;
      if (baseContains(state, c, r)) return false;
      const v = state.grid[r * GRID + c];
      if (v !== CELL.EMPTY && v !== CELL.TREE && v !== CELL.ICE) return false;
    }
  }
  return true;
}

function canOccupy(state, self, x, y) {
  if (!rectFree(state, x, y)) return false;
  for (const e of state.enemies) {
    if (e === self || !e.alive) continue;
    if (boxOverlap(x, y, e.x, e.y)) return false;
  }
  const p = state.player;
  if (p && p.alive && p !== self && boxOverlap(x, y, p.x, p.y)) return false;
  return true;
}

function advance(state, ent, dist) {
  let remain = dist;
  while (remain > 1e-9) {
    const s = Math.min(0.25, remain);
    const nx = ent.x + DX[ent.dir] * s;
    const ny = ent.y + DY[ent.dir] * s;
    if (canOccupy(state, ent, nx, ny)) {
      ent.x = nx;
      ent.y = ny;
      remain -= s;
    } else {
      return true; // blocked
    }
  }
  return false;
}

function alignTank(ent, dir) {
  if (dir === DIR.LEFT || dir === DIR.RIGHT) ent.y = Math.round(ent.y);
  else ent.x = Math.round(ent.x);
}

function tankCenter(ent) {
  return { x: ent.x + TANK_SIZE / 2, y: ent.y + TANK_SIZE / 2 };
}

function onIce(state, ent) {
  const c = Math.floor(ent.x + TANK_SIZE / 2);
  const r = Math.floor(ent.y + TANK_SIZE / 2);
  return cellAt(state, c, r) === CELL.ICE;
}

/* ------------------------------------------------------------ base ring (shovel) */

function baseRing(state) {
  const b = state.base;
  const cells = [];
  for (let r = b.hy - 1; r <= b.hy + TANK_SIZE; r += 1) {
    for (let c = b.hx - 1; c <= b.hx + TANK_SIZE; c += 1) {
      if (!inBounds(c, r)) continue;
      if (baseContains(state, c, r)) continue;
      cells.push({ c, r });
    }
  }
  return cells;
}

/* ------------------------------------------------------------------- creation */

export function createState(options = {}) {
  const level = parseLevel(options.level ?? options.levelDef ?? null);
  const seed = Number.isFinite(options.seed) ? options.seed >>> 0 : hashSeed(level.id);
  const rng = typeof options.rng === "function" ? options.rng : mulberry32(seed);
  const mode = options.mode ?? level.mode ?? "campaign";
  const lives = Math.max(1, Math.min(MAX_LIVES, options.lives ?? START_LIVES));

  const queue = [];
  const types = level.types.length > 0 ? level.types : ["standard"];
  if (mode !== "last_stand") {
    for (let i = 0; i < level.total; i += 1) queue.push(pick(rng, types));
  }

  const state = {
    mode,
    levelId: level.id,
    chapter: level.chapter,
    parTime: level.parTime,
    fortress: level.fortress,
    phase: PHASES.ready,
    seed,
    rng,
    grid: level.grid,
    base: { hx: level.base.hx, hy: level.base.hy, hp: BASE_HP, maxHp: BASE_HP },
    playerSpawn: { hx: level.playerSpawn.hx, hy: level.playerSpawn.hy },
    enemySpawns: level.enemySpawns.slice(),
    aggro: level.aggro,
    concurrent: level.concurrent,
    spawnInterval: level.spawnInterval,
    player: {
      x: level.playerSpawn.hx,
      y: level.playerSpawn.hy,
      dir: DIR.UP,
      moving: false,
      alive: true,
      star: 1,
      cooldown: 0,
      graceT: GRACE_TIME,
      shieldT: 0,
      slideT: 0,
      respawnT: 0,
    },
    enemies: [],
    shells: [],
    drops: [],
    queue,
    spawned: 0,
    spawnTimer: 0.8,
    spawnIndex: 0,
    wave: 1,
    lives,
    // Breakthrough hands out a finite magazine; campaign is unlimited (Infinity).
    ammo: level.ammo > 0 ? level.ammo : Infinity,
    ammoMax: level.ammo > 0 ? level.ammo : 0,
    timeLimit: level.timeLimit,
    timeLeft: level.timeLimit,
    score: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    charge: 0,
    orderIndex: 0,
    freezeT: 0,
    smokeT: 0,
    steelBaseT: 0,
    baseRingOrig: [],
    time: 0,
    kills: 0,
    deaths: 0,
    stats: { kills: 0, bricks: 0, ricochets: 0, shots: 0, hits: 0, deaths: 0 },
    events: [],
    nextId: 1,
  };

  state.baseRingOrig = baseRing(state).map(({ c, r }) => ({ c, r, v: state.grid[r * GRID + c] }));
  if (level.preset.length > 0) deployPreset(state, level.preset);
  if (mode === "last_stand") enqueueWave(state);
  return state;
}

// The siege has no fixed roster: each wave is rolled when the previous one is wiped.
function enqueueWave(state) {
  const comp = waveComposition(state.wave);
  state.concurrent = comp.concurrent;
  state.spawnInterval = comp.spawnInterval;
  state.aggro = comp.aggro;
  for (let i = 0; i < comp.count; i += 1) state.queue.push(pick(state.rng, comp.types));
  emit(state, { type: "wave", wave: state.wave, count: comp.count });
}

// Breakthrough stages start with their whole garrison already on the tray.
function deployPreset(state, preset) {
  state.queue = preset.map((p) => p.type);
  state.spawned = preset.length;
  for (const p of preset) {
    const spec = ENEMY_TYPES[p.type] ?? ENEMY_TYPES.standard;
    state.enemies.push({
      id: state.nextId++,
      type: p.type,
      x: p.hx,
      y: p.hy,
      dir: DIR.DOWN,
      hp: spec.hp,
      alive: true,
      spawnT: SPAWN_DELAY,
      aiTimer: randBetween(state.rng, [0.2, 0.8]),
      fireTimer: randBetween(state.rng, [0.8, 1.8]),
      aimT: 0,
      aiming: false,
      pauseT: 0,
      bonus: state.rng() < 0.4,
    });
  }
}

export function startBattle(state) {
  if (state.phase !== PHASES.ready) return null;
  state.phase = PHASES.playing;
  return emit(state, { type: "start" });
}

/* -------------------------------------------------------------------- intents */

export function applyIntent(state, intent) {
  if (!intent || typeof intent !== "object") return null;
  const p = state.player;
  switch (intent.type) {
    case "start":
      return startBattle(state);
    case "move": {
      if (state.phase !== PHASES.playing || !p.alive) return null;
      const dir = intent.dir;
      if (dir !== DIR.UP && dir !== DIR.RIGHT && dir !== DIR.DOWN && dir !== DIR.LEFT) return null;
      p.dir = dir;
      alignTank(p, dir); // driving always snaps onto a lane, even if the heading is unchanged
      p.moving = true;
      return { type: "move", dir };
    }
    case "stop": {
      if (!p.alive) return null;
      p.moving = false;
      return { type: "stop" };
    }
    case "fire":
      return firePlayer(state);
    case "order":
      return useOrder(state);
    default:
      return null;
  }
}

function playerShellCount(state) {
  let n = 0;
  for (const s of state.shells) if (s.owner === "player") n += 1;
  return n;
}

export function firePlayer(state) {
  if (state.phase !== PHASES.playing) return null;
  const p = state.player;
  if (!p.alive || p.cooldown > 0) return null;
  if (state.ammo <= 0) return null;
  if (playerShellCount(state) >= MAX_SHELLS[p.star]) return null;
  p.cooldown = FIRE_CD[p.star];
  state.ammo -= 1;
  const c = tankCenter(p);
  const shell = {
    id: state.nextId++,
    owner: "player",
    x: c.x + DX[p.dir] * (TANK_SIZE / 2),
    y: c.y + DY[p.dir] * (TANK_SIZE / 2),
    dir: p.dir,
    speed: SHELL_SPEED[p.star],
    power: p.star >= STAR_BREAK_STEEL ? 3 : 1,
    bounced: false,
    alive: true,
  };
  state.shells.push(shell);
  state.stats.shots += 1;
  emit(state, { type: "shot", owner: "player", x: shell.x, y: shell.y, dir: shell.dir });
  return { type: "fire", dir: p.dir };
}

export function useOrder(state) {
  if (state.phase !== PHASES.playing) return null;
  if (state.charge < CHARGE_MAX) return null;
  state.charge = 0;
  const kind = ORDERS[state.orderIndex % ORDERS.length];
  state.orderIndex = (state.orderIndex + 1) % ORDERS.length;
  applyOrder(state, kind);
  emit(state, { type: "order", kind });
  return { type: "order", kind };
}

function applyOrder(state, kind) {
  const p = state.player;
  if (kind === "artillery") {
    const c = tankCenter(p);
    const tx = c.x + DX[p.dir] * ARTILLERY_REACH;
    const ty = c.y + DY[p.dir] * ARTILLERY_REACH;
    const c0 = Math.max(0, Math.floor(tx - ARTILLERY_BOX));
    const c1 = Math.min(GRID - 1, Math.floor(tx + ARTILLERY_BOX));
    const r0 = Math.max(0, Math.floor(ty - ARTILLERY_BOX));
    const r1 = Math.min(GRID - 1, Math.floor(ty + ARTILLERY_BOX));
    for (let r = r0; r <= r1; r += 1) {
      for (let cc = c0; cc <= c1; cc += 1) {
        if (state.grid[r * GRID + cc] === CELL.BRICK) destroyCell(state, cc, r, true);
      }
    }
    for (const e of state.enemies.slice()) {
      if (!e.alive || e.spawnT > 0) continue;
      const ec = tankCenter(e);
      if (ec.x >= c0 && ec.x <= c1 + 1 && ec.y >= r0 && ec.y <= r1 + 1) {
        damageEnemy(state, e, ARTILLERY_DMG, { owner: "player", power: 3 });
      }
    }
    emit(state, { type: "barrage", x: tx, y: ty });
    return;
  }
  if (kind === "fortify") {
    for (const { c, r } of state.baseRingOrig) {
      if (!inBounds(c, r)) continue;
      state.grid[r * GRID + c] = CELL.STEEL;
    }
    state.steelBaseT = STEEL_BASE_TIME;
    return;
  }
  if (kind === "jam") {
    state.freezeT = Math.max(state.freezeT, JAM_FREEZE);
    state.smokeT = Math.max(state.smokeT, JAM_SMOKE);
  }
}

/* ---------------------------------------------------------------- main update */

export function stepFrame(state, dt) {
  // Intents fire between frames (a shot, an order), so their events are queued into
  // state.events. Take that queue over instead of dropping it, or the audio layer
  // never hears the cannon it is supposed to play.
  const events = state.events;
  state.events = [];
  if (state.phase !== PHASES.playing) return events;
  const d = Math.max(0, Math.min(0.05, dt));
  state.time += d;

  tickTimers(state, d);
  updatePlayer(state, d);
  updateEnemies(state, d);
  updateShells(state, d);
  cancelShells(state);
  updateDrops(state, d);
  updateSpawner(state, d);
  checkEnd(state);
  if (state.events.length > 0) events.push(...state.events);
  state.events.length = 0;
  return events;
}

function tickTimers(state, d) {
  const p = state.player;
  if (p.cooldown > 0) p.cooldown = Math.max(0, p.cooldown - d);
  if (p.graceT > 0) p.graceT = Math.max(0, p.graceT - d);
  if (p.shieldT > 0) p.shieldT = Math.max(0, p.shieldT - d);
  if (state.freezeT > 0) state.freezeT = Math.max(0, state.freezeT - d);
  if (state.smokeT > 0) state.smokeT = Math.max(0, state.smokeT - d);
  if (state.comboTimer > 0) {
    state.comboTimer = Math.max(0, state.comboTimer - d);
    if (state.comboTimer === 0) state.combo = 0;
  }
  if (state.timeLimit > 0) state.timeLeft = Math.max(0, state.timeLeft - d);
  if (state.steelBaseT > 0) {
    state.steelBaseT = Math.max(0, state.steelBaseT - d);
    if (state.steelBaseT === 0) {
      for (const { c, r, v } of state.baseRingOrig) {
        if (inBounds(c, r)) state.grid[r * GRID + c] = v;
      }
      emit(state, { type: "fortifyEnd" });
    }
  }
}

function updatePlayer(state, d) {
  const p = state.player;
  if (!p.alive) {
    if (p.respawnT > 0) {
      p.respawnT = Math.max(0, p.respawnT - d);
      if (p.respawnT === 0) respawnPlayer(state);
    }
    return;
  }
  if (p.moving) {
    advance(state, p, PLAYER_SPEED * d);
    p.slideT = onIce(state, p) ? SLIDE_TIME : 0;
  } else if (p.slideT > 0 && onIce(state, p)) {
    advance(state, p, PLAYER_SPEED * d);
    p.slideT = Math.max(0, p.slideT - d);
  }
}

function respawnPlayer(state) {
  const p = state.player;
  p.x = state.playerSpawn.hx;
  p.y = state.playerSpawn.hy;
  p.dir = DIR.UP;
  p.moving = false;
  p.slideT = 0;
  p.alive = true;
  p.graceT = GRACE_TIME;
  emit(state, { type: "respawn", lives: state.lives });
}

function hitPlayer(state, source) {
  const p = state.player;
  if (!p.alive) return false;
  if (p.shieldT > 0 || p.graceT > 0) {
    emit(state, { type: "block", x: p.x, y: p.y });
    return false;
  }
  p.alive = false;
  p.moving = false;
  p.slideT = 0;
  state.lives -= 1;
  state.deaths += 1;
  state.stats.deaths += 1;
  state.combo = 0;
  state.comboTimer = 0;
  emit(state, { type: "playerDown", x: p.x, y: p.y, cause: source?.bounced ? "ricochet" : "enemy" });
  if (state.lives <= 0) {
    state.phase = PHASES.lost;
    emit(state, { type: "lost", reason: "lives" });
  } else {
    p.respawnT = RESPAWN_DELAY;
  }
  return true;
}

/* --------------------------------------------------------------------- enemies */

function enemyAt(state, x, y) {
  for (const e of state.enemies) {
    if (!e.alive || e.spawnT > 0) continue;
    if (boxContains(x, y, e.x, e.y)) return e;
  }
  return null;
}

function playerAt(state, x, y) {
  const p = state.player;
  if (!p.alive) return false;
  return boxContains(x, y, p.x, p.y);
}

function clearLine(state, x0, y0, x1, y1) {
  const dist = Math.abs(x1 - x0) + Math.abs(y1 - y0);
  const steps = Math.max(1, Math.ceil(dist * 2));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const c = Math.floor(x0 + (x1 - x0) * t);
    const r = Math.floor(y0 + (y1 - y0) * t);
    if (!inBounds(c, r)) return false;
    if (baseContains(state, c, r)) return false;
    const v = state.grid[r * GRID + c];
    if (v === CELL.BRICK || v === CELL.STEEL) return false;
  }
  return true;
}

function updateEnemies(state, d) {
  const frozen = state.freezeT > 0;
  for (const e of state.enemies.slice()) {
    if (!e.alive) continue;
    if (e.spawnT > 0) {
      e.spawnT = Math.max(0, e.spawnT - d);
      continue;
    }
    if (frozen) continue;
    const spec = ENEMY_TYPES[e.type] ?? ENEMY_TYPES.standard;

    e.aiTimer -= d;
    e.fireTimer -= d;
    if (e.aiTimer <= 0) {
      chooseEnemyDir(state, e, spec);
      e.aiTimer = randBetween(state.rng, [0.6, 1.6]);
      // tanks idle now and then, which is what keeps the original readable
      e.pauseT = state.rng() < 0.18 ? randBetween(state.rng, [0.2, 0.7]) : 0;
    }
    if (e.pauseT > 0) {
      e.pauseT = Math.max(0, e.pauseT - d);
    } else {
      const blocked = advance(state, e, spec.speed * d);
      if (blocked) {
        chooseEnemyDir(state, e, spec);
        advance(state, e, spec.speed * d);
      }
    }
    maybeEnemyFire(state, e, spec);
    updateSniperAim(state, e, spec);
  }
}

function enemyTarget(state, spec) {
  const p = state.player;
  const visible = p.alive && state.smokeT <= 0;
  // The stage heat scales the chassis instinct: a quiet stage sends most tanks at the
  // eagle, a hot one sends them hunting the player.
  const heat = Math.min(0.95, spec.aggro * (0.4 + 1.2 * state.aggro));
  if (visible && state.rng() < heat) {
    return state.rng() < 0.5 ? { x: p.x, y: p.y } : { x: state.base.hx, y: state.base.hy };
  }
  return { x: state.base.hx, y: state.base.hy };
}

function chooseEnemyDir(state, e, spec) {
  const target = spec.digger ? { x: state.base.hx, y: state.base.hy } : enemyTarget(state, spec);
  const ec = tankCenter(e);
  const options = [];
  for (let dir = 0; dir < 4; dir += 1) {
    const nx = e.x + DX[dir] * 0.6;
    const ny = e.y + DY[dir] * 0.6;
    if (!canOccupy(state, e, nx, ny)) continue;
    const nc = { x: nx + TANK_SIZE / 2, y: ny + TANK_SIZE / 2 };
    const dist = Math.abs(nc.x - target.x) + Math.abs(nc.y - target.y);
    options.push({ dir, dist, straight: dir === e.dir ? -0.5 : 0 });
  }
  if (options.length === 0) {
    e.dir = OPPOSITE[e.dir];
    return;
  }
  if (state.rng() < 0.65) {
    options.sort((a, b) => a.dist + a.straight - (b.dist + b.straight));
    e.dir = options[0].dir;
  } else {
    e.dir = pick(state.rng, options).dir;
  }
  alignTank(e, e.dir);
}

function maybeEnemyFire(state, e, spec) {
  if (e.fireTimer > 0) return;
  let enemyShells = 0;
  for (const s of state.shells) if (s.owner === "enemy") enemyShells += 1;
  if (enemyShells >= MAX_ENEMY_SHELLS) return;

  const ec = tankCenter(e);
  const fc = Math.floor(ec.x + DX[e.dir] * 1.2);
  const fr = Math.floor(ec.y + DY[e.dir] * 1.2);
  const ahead = cellAt(state, fc, fr);
  const diggerWants = spec.digger && (ahead === CELL.BRICK || ahead === CELL.STEEL);
  const randWants = state.rng() < 0.72;
  if (!diggerWants && !randWants) {
    e.fireTimer = randBetween(state.rng, [spec.fireMin, spec.fireMax]);
    return;
  }
  spawnShell(state, e, spec.shellSpeed, 1);
  e.fireTimer = randBetween(state.rng, [spec.fireMin, spec.fireMax]);
}

function updateSniperAim(state, e, spec) {
  if (!spec.sniper) return;
  const p = state.player;
  const ec = tankCenter(e);
  const pc = tankCenter(p);
  const aligned =
    p.alive &&
    state.smokeT <= 0 &&
    Math.abs(ec.y - pc.y) < 1.1 &&
    Math.abs(ec.x - pc.x) < 1.1 &&
    (Math.abs(ec.x - pc.x) < 1.1 || Math.abs(ec.y - pc.y) < 1.1);
  const locked = aligned && clearLine(state, ec.x, ec.y, pc.x, pc.y);
  if (locked) {
    e.aimT += 1 / 60;
    if (!e.aiming) {
      e.aiming = true;
      emit(state, { type: "sniperAim", id: e.id, x: ec.x, y: ec.y });
    }
    if (e.aimT >= SNIPER_AIM) {
      e.aimT = 0;
      let enemyShells = 0;
      for (const s of state.shells) if (s.owner === "enemy") enemyShells += 1;
      if (enemyShells < MAX_ENEMY_SHELLS) {
        const dir =
          Math.abs(ec.x - pc.x) < Math.abs(ec.y - pc.y)
            ? pc.y > ec.y
              ? DIR.DOWN
              : DIR.UP
            : pc.x > ec.x
              ? DIR.RIGHT
              : DIR.LEFT;
        e.dir = dir;
        spawnShell(state, e, spec.shellSpeed, 1);
      }
    }
  } else {
    e.aimT = 0;
    e.aiming = false;
  }
}

function spawnShell(state, ent, speed, power) {
  const c = tankCenter(ent);
  const shell = {
    id: state.nextId++,
    owner: ent === state.player ? "player" : "enemy",
    x: c.x + DX[ent.dir] * (TANK_SIZE / 2),
    y: c.y + DY[ent.dir] * (TANK_SIZE / 2),
    dir: ent.dir,
    speed,
    power,
    bounced: false,
    alive: true,
  };
  state.shells.push(shell);
  emit(state, { type: "shot", owner: shell.owner, x: shell.x, y: shell.y, dir: shell.dir });
  return shell;
}

function damageEnemy(state, e, amount, source) {
  if (!e.alive || e.spawnT > 0) return;
  e.hp -= amount;
  state.stats.hits += 1;
  emit(state, { type: "hit", id: e.id, x: e.x, y: e.y, hp: e.hp, bonus: e.bonus });
  if (e.hp > 0) return;
  e.alive = false;
  state.kills += 1;
  state.stats.kills += 1;
  state.combo += 1;
  state.comboTimer = COMBO_WINDOW;
  if (state.combo > state.bestCombo) state.bestCombo = state.combo;
  const spec = ENEMY_TYPES[e.type] ?? ENEMY_TYPES.standard;
  const gained = killScore(spec.score, state.combo - 1);
  state.score = clampScore(state.score + gained);
  state.charge = Math.min(CHARGE_MAX, state.charge + CHARGE_PER_KILL);
  emit(state, {
    type: "kill",
    id: e.id,
    kind: e.type,
    x: e.x,
    y: e.y,
    score: gained,
    combo: state.combo,
  });
  if (e.bonus) spawnDrop(state, e);
  const i = state.enemies.indexOf(e);
  if (i >= 0) state.enemies.splice(i, 1);
}

function spawnDrop(state, e) {
  const kind = pick(state.rng, POWERUPS);
  const spot = findDropSpot(state);
  if (!spot) return;
  const drop = { id: state.nextId++, kind, hx: spot.c, hy: spot.r, ttl: POWERUP_TTL };
  state.drops.push(drop);
  emit(state, { type: "drop", kind, x: drop.hx, y: drop.hy });
}

function findDropSpot(state) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const c = Math.floor(state.rng() * (GRID - TANK_SIZE + 1));
    const r = Math.floor(state.rng() * (GRID - TANK_SIZE + 1));
    let ok = true;
    for (let rr = r; rr < r + TANK_SIZE && ok; rr += 1) {
      for (let cc = c; cc < c + TANK_SIZE; cc += 1) {
        if (!inBounds(cc, rr) || baseContains(state, cc, rr) || state.grid[rr * GRID + cc] !== CELL.EMPTY) {
          ok = false;
          break;
        }
      }
    }
    if (ok) return { c, r };
  }
  return null;
}

/* ---------------------------------------------------------------------- shells */

function updateShells(state, d) {
  for (const s of state.shells.slice()) {
    if (!s.alive) continue;
    let remain = s.speed * d;
    while (remain > 1e-9 && s.alive) {
      const step = Math.min(0.25, remain);
      remain -= step;
      const nx = s.x + DX[s.dir] * step;
      const ny = s.y + DY[s.dir] * step;
      if (!moveShellTo(state, s, nx, ny)) break;
    }
  }
  state.shells = state.shells.filter((s) => s.alive);
}

function moveShellTo(state, s, nx, ny) {
  if (s.owner === "player") {
    const e = enemyAt(state, nx, ny);
    if (e) {
      damageEnemy(state, e, 1, s);
      s.alive = false;
      return false;
    }
    if (s.bounced && playerAt(state, nx, ny)) {
      hitPlayer(state, s);
      s.alive = false;
      return false;
    }
  } else if (playerAt(state, nx, ny)) {
    hitPlayer(state, s);
    s.alive = false;
    return false;
  }

  const c = Math.floor(nx);
  const r = Math.floor(ny);
  if (!inBounds(c, r)) {
    s.alive = false;
    emit(state, { type: "spent", x: s.x, y: s.y });
    return false;
  }
  if (baseContains(state, c, r)) {
    damageBase(state, s);
    s.alive = false;
    return false;
  }
  const v = state.grid[r * GRID + c];
  if (v === CELL.BRICK) {
    destroyCell(state, c, r, false);
    state.score = clampScore(state.score + brickScore());
    s.alive = false;
    return false;
  }
  if (v === CELL.STEEL) {
    if (s.power >= STAR_BREAK_STEEL) {
      destroyCell(state, c, r, false);
      s.alive = false;
      return false;
    }
    if (s.owner === "player" && !s.bounced) return ricochet(state, s, c, r);
    s.alive = false;
    emit(state, { type: "spent", x: s.x, y: s.y, steel: true });
    return false;
  }
  s.x = nx;
  s.y = ny;
  return true;
}

function openForShell(state, c, r) {
  if (!inBounds(c, r)) return false;
  if (baseContains(state, c, r)) return false;
  return SHELL_PASSABLE.includes(state.grid[r * GRID + c]);
}

// The signature mechanic. A shell that strikes steel is deflected according to the
// two cells perpendicular to its flight: dead end -> spent, both open -> straight
// bounce back, single side open -> 90 degree deflection around the corner.
export function ricochet(state, s, c, r) {
  const horiz = s.dir === DIR.LEFT || s.dir === DIR.RIGHT;
  const a = horiz ? { c, r: r - 1 } : { c: c - 1, r };
  const b = horiz ? { c, r: r + 1 } : { c: c + 1, r };
  const openA = openForShell(state, a.c, a.r);
  const openB = openForShell(state, b.c, b.r);
  if (!openA && !openB) {
    s.alive = false;
    emit(state, { type: "ricochet", x: s.x, y: s.y, dir: -1 });
    return false;
  }
  if (openA && openB) {
    s.dir = OPPOSITE[s.dir];
    s.bounced = true;
    emit(state, { type: "ricochet", x: s.x, y: s.y, dir: s.dir, mode: "bounce" });
    return true;
  }
  const cell = openA ? a : b;
  s.dir = horiz ? (openA ? DIR.UP : DIR.DOWN) : openA ? DIR.LEFT : DIR.RIGHT;
  s.bounced = true;
  s.x = cell.c + 0.5;
  s.y = cell.r + 0.5;
  state.stats.ricochets += 1;
  state.score = clampScore(state.score + ricochetBonus());
  emit(state, { type: "ricochet", x: s.x, y: s.y, dir: s.dir, mode: "deflect" });
  return true;
}

function cancelShells(state) {
  for (const a of state.shells) {
    if (!a.alive || a.owner !== "player") continue;
    for (const b of state.shells) {
      if (!b.alive || b.owner !== "enemy") continue;
      if (Math.floor(a.x) === Math.floor(b.x) && Math.floor(a.y) === Math.floor(b.y)) {
        a.alive = false;
        b.alive = false;
        emit(state, { type: "spent", x: a.x, y: a.y, clash: true });
        break;
      }
    }
  }
  state.shells = state.shells.filter((s) => s.alive);
}

function destroyCell(state, c, r, silent) {
  if (!inBounds(c, r)) return;
  const v = state.grid[r * GRID + c];
  if (v !== CELL.BRICK && v !== CELL.STEEL) return;
  state.grid[r * GRID + c] = CELL.EMPTY;
  if (v === CELL.BRICK) state.stats.bricks += 1;
  emit(state, { type: "destroy", c, r, was: v, silent: !!silent });
}

function damageBase(state, s) {
  state.base.hp = Math.max(0, state.base.hp - 1);
  emit(state, { type: "baseHit", hp: state.base.hp, x: state.base.hx, y: state.base.hy });
  if (state.base.hp <= 0) {
    state.phase = PHASES.lost;
    emit(state, { type: "lost", reason: "base" });
  }
}

/* ----------------------------------------------------------------------- drops */

function updateDrops(state, d) {
  const p = state.player;
  for (const drop of state.drops.slice()) {
    drop.ttl -= d;
    if (drop.ttl <= 0) {
      const i = state.drops.indexOf(drop);
      if (i >= 0) state.drops.splice(i, 1);
      emit(state, { type: "dropExpire", kind: drop.kind });
      continue;
    }
    if (!p.alive) continue;
    if (boxOverlap(drop.hx, drop.hy, p.x, p.y)) {
      const i = state.drops.indexOf(drop);
      if (i >= 0) state.drops.splice(i, 1);
      applyPowerup(state, drop.kind);
    }
  }
}

function applyPowerup(state, kind) {
  const p = state.player;
  switch (kind) {
    case "star":
      p.star = Math.min(3, p.star + 1);
      break;
    case "helmet":
      p.shieldT = SHIELD_TIME;
      break;
    case "grenade":
      for (const e of state.enemies.slice()) {
        damageEnemy(state, e, 99, { owner: "player", power: 3 });
      }
      break;
    case "shovel":
      applyOrder(state, "fortify");
      break;
    case "extra_life":
      state.lives = Math.min(MAX_LIVES, state.lives + 1);
      break;
    case "clock":
      state.freezeT = Math.max(state.freezeT, FREEZE_TIME);
      break;
    default:
      return;
  }
  emit(state, { type: "pickup", kind, star: p.star, lives: state.lives });
}

/* --------------------------------------------------------------------- spawner */

function updateSpawner(state, d) {
  const remaining = state.queue.length - state.spawned;
  if (remaining <= 0) return;
  if (state.enemies.length >= state.concurrent) return;
  state.spawnTimer -= d;
  if (state.spawnTimer > 0) return;
  const type = state.queue[state.spawned];
  const spot = state.enemySpawns[state.spawnIndex % state.enemySpawns.length];
  if (!canOccupy(state, null, spot.hx, spot.hy)) {
    state.spawnTimer = 0.4;
    state.spawnIndex += 1;
    return;
  }
  const spec = ENEMY_TYPES[type] ?? ENEMY_TYPES.standard;
  const enemy = {
    id: state.nextId++,
    type,
    x: spot.hx,
    y: spot.hy,
    dir: DIR.DOWN,
    hp: spec.hp,
    alive: true,
    spawnT: SPAWN_DELAY,
    aiTimer: randBetween(state.rng, [0.2, 0.8]),
    fireTimer: randBetween(state.rng, [0.8, 1.8]),
    aimT: 0,
    aiming: false,
    pauseT: 0,
    bonus: state.rng() < 0.22,
  };
  state.enemies.push(enemy);
  state.spawned += 1;
  state.spawnIndex += 1;
  state.spawnTimer = state.spawnInterval;
  emit(state, { type: "spawn", id: enemy.id, kind: type, x: enemy.x, y: enemy.y });
}

/* ------------------------------------------------------------------------- end */

function checkEnd(state) {
  if (state.phase !== PHASES.playing) return;
  if (state.base.hp <= 0) {
    state.phase = PHASES.lost;
    emit(state, { type: "lost", reason: "base" });
    return;
  }
  if (!state.player.alive && state.lives <= 0) {
    state.phase = PHASES.lost;
    emit(state, { type: "lost", reason: "lives" });
    return;
  }
  if (state.timeLimit > 0 && state.timeLeft <= 0) {
    state.phase = PHASES.lost;
    emit(state, { type: "lost", reason: "time" });
    return;
  }
  if (state.spawned >= state.queue.length && state.enemies.length === 0) {
    if (state.mode === "last_stand") {
      // Siege never "clears": the next wave rolls in and the scoreboard is the wave count.
      state.wave += 1;
      enqueueWave(state);
      return;
    }
    state.phase = PHASES.cleared;
    emit(state, { type: "cleared", time: state.time });
    return;
  }
  // Empty magazine with no shell still flying: the puzzle is unsolved, not stalemated.
  if (state.ammo <= 0 && state.enemies.length > 0) {
    const flying = state.shells.some((s) => s.owner === "player");
    if (!flying) {
      state.phase = PHASES.lost;
      emit(state, { type: "lost", reason: "ammo" });
    }
  }
}

/* --------------------------------------------------------------------- helpers */

export function remainingEnemies(state) {
  return state.queue.length - state.spawned + state.enemies.length;
}

export function nextId(state) {
  return state.nextId++;
}

export function setCell(state, c, r, value) {
  if (!inBounds(c, r)) return false;
  state.grid[r * GRID + c] = value;
  return true;
}

export function getCell(state, c, r) {
  return cellAt(state, c, r);
}

export function isBaseAt(state, c, r) {
  return baseContains(state, c, r);
}
