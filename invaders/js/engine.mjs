// Pure rules layer for Starport Siege (fixed screen formation shooter).
// Strictly DOM-free and storage-free: every mechanic runs on plain data and is
// advanced by the pure function stepFrame(state, dt), so a whole stage can be
// replayed head-less in tests.
import {
  VIEW_W,
  VIEW_H,
  COLS,
  COL_W,
  ROW_H,
  FORMATION_BASE_X,
  FORMATION_BASE_Y,
  FORMATION_MARGIN,
  STEP_X,
  STEP_Y,
  TURRET_Y,
  TURRET_W,
  TURRET_H,
  TURRET_SPEED,
  RED_LINE_Y,
  BARRICADE_Y,
  BARRICADE_W,
  BARRICADE_H,
  BARRICADE_CELL,
  BARRICADE_COLS,
  BARRICADE_ROWS,
  BULLET_SPEED,
  ENEMY_BULLET_SPEED,
  MAX_PLAYER_BULLETS,
  MAX_ENEMY_BULLETS,
  SHOT_COOLDOWN,
  HEAT_PER_SHOT,
  HEAT_DECAY,
  OVERHEAT_LOCK,
  FIRE_BUFFER,
  RAIL_CHARGE,
  RAIL_HEAT,
  RAIL_HEAT_GATE,
  RAIL_HALF_W,
  DIVE_ARC_TIME,
  DIVE_ARC_SPEED,
  DIVE_DASH_SPEED,
  MAX_DIVERS,
  MOD_DURATION,
  MOD_DROP_CHANCE,
  PICKUP_SPEED,
  INTRO_TIME,
  CLEAR_TIME,
  INVULN_TIME,
  ENEMY_TYPES,
  SHIELD_CYCLE,
  SHIELD_OPEN,
  CLOAK_CYCLE,
  CLOAK_HIDDEN,
  MOD_TYPES,
  MOD_KEYS,
  MOD_BOUNTY,
  maskCells,
} from "./data.mjs";
import { LEVELS, TRAINING, survivalWave, levelById, trainingById, TOTAL_LEVELS } from "./levels.mjs";
import { nextRandom, randRange } from "./rng.mjs";

export const STATUS = {
  INTRO: "intro",
  FIGHT: "fight",
  CLEAR: "clear",
  WON: "won",
  LOST: "lost",
};

export const MODES = { CAMPAIGN: "campaign", SURVIVAL: "survival", TRAINING: "training" };

const MAX_EVENTS = 240;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function emit(state, event) {
  state.events.push(event);
  if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
}

export function drainEvents(state) {
  const events = state.events;
  state.events = [];
  return events;
}

// ---------------------------------------------------------------- barricades

function makeBarricade(centerX) {
  const cells = new Uint8Array(BARRICADE_COLS * BARRICADE_ROWS);
  cells.fill(1);
  return { x: centerX - BARRICADE_W / 2, y: BARRICADE_Y, w: BARRICADE_W, h: BARRICADE_H, cells };
}

function cellSolid(barricade, col, row) {
  if (!barricade) return false;
  if (col < 0 || col >= BARRICADE_COLS || row < 0 || row >= BARRICADE_ROWS) return false;
  return barricade.cells[row * BARRICADE_COLS + col] === 1;
}

function solidAt(barricades, x, y) {
  for (const barricade of barricades) {
    const col = Math.floor((x - barricade.x) / BARRICADE_CELL);
    const row = Math.floor((y - barricade.y) / BARRICADE_CELL);
    if (cellSolid(barricade, col, row)) return barricade;
  }
  return null;
}

function erode(barricades, x, y, radius) {
  let removed = 0;
  let hit = null;
  for (const barricade of barricades) {
    const c0 = Math.floor((x - radius - barricade.x) / BARRICADE_CELL);
    const c1 = Math.floor((x + radius - barricade.x) / BARRICADE_CELL);
    const r0 = Math.floor((y - radius - barricade.y) / BARRICADE_CELL);
    const r1 = Math.floor((y + radius - barricade.y) / BARRICADE_CELL);
    for (let row = r0; row <= r1; row += 1) {
      for (let col = c0; col <= c1; col += 1) {
        if (!cellSolid(barricade, col, row)) continue;
        const cx = barricade.x + (col + 0.5) * BARRICADE_CELL;
        const cy = barricade.y + (row + 0.5) * BARRICADE_CELL;
        if ((cx - x) ** 2 + (cy - y) ** 2 > radius * radius) continue;
        barricade.cells[row * BARRICADE_COLS + col] = 0;
        removed += 1;
        hit = barricade;
      }
    }
  }
  return { removed, barricade: hit };
}

function erodeBox(barricades, box) {
  let removed = 0;
  for (const barricade of barricades) {
    if (box.x + box.w < barricade.x || box.x > barricade.x + barricade.w) continue;
    if (box.y + box.h < barricade.y || box.y > barricade.y + barricade.h) continue;
    const c0 = Math.max(0, Math.floor((box.x - barricade.x) / BARRICADE_CELL));
    const c1 = Math.min(BARRICADE_COLS - 1, Math.floor((box.x + box.w - barricade.x) / BARRICADE_CELL));
    const r0 = Math.max(0, Math.floor((box.y - barricade.y) / BARRICADE_CELL));
    const r1 = Math.min(BARRICADE_ROWS - 1, Math.floor((box.y + box.h - barricade.y) / BARRICADE_CELL));
    for (let row = r0; row <= r1; row += 1) {
      for (let col = c0; col <= c1; col += 1) {
        if (barricade.cells[row * BARRICADE_COLS + col] === 1) {
          barricade.cells[row * BARRICADE_COLS + col] = 0;
          removed += 1;
        }
      }
    }
  }
  return removed;
}

// -------------------------------------------------------------------- aliens

function alienSize(alien) {
  return ENEMY_TYPES[alien.type]?.size ?? 34;
}

function makeAlien(state, row, col, type, dx = 0) {
  const def = ENEMY_TYPES[type] ?? ENEMY_TYPES.grunt;
  return {
    id: state.nextAlienId++,
    row,
    col,
    dx,
    type,
    hp: def.hp,
    maxHp: def.hp,
    alive: true,
    mode: "formation",
    phase: "arc",
    diveT: 0,
    targetX: 0,
    x: 0,
    y: 0,
    shieldOpen: true,
    cloaked: false,
  };
}

export function aliveAliens(state) {
  return state.aliens.filter((alien) => alien.alive);
}

export function divers(state) {
  return state.aliens.filter((alien) => alien.alive && alien.mode === "dive");
}

export function formationBottom(state) {
  let bottom = -Infinity;
  for (const alien of state.aliens) {
    if (!alien.alive || alien.mode !== "formation") continue;
    bottom = Math.max(bottom, alien.y + alienSize(alien) / 2);
  }
  return bottom === -Infinity ? 0 : bottom;
}

function syncFormationPositions(state) {
  const f = state.formation;
  for (const alien of state.aliens) {
    if (!alien.alive || alien.mode !== "formation") continue;
    alien.x = f.x + alien.col * COL_W + COL_W / 2 + alien.dx;
    alien.y = f.y + alien.row * ROW_H + ROW_H / 2;
    const def = ENEMY_TYPES[alien.type];
    if (def?.shield) {
      alien.shieldOpen = (state.time + alien.col * 0.17) % SHIELD_CYCLE < SHIELD_OPEN;
    }
    if (def?.cloak) {
      alien.cloaked = (state.time + alien.row * 0.3 + alien.col * 0.11) % CLOAK_CYCLE < CLOAK_HIDDEN;
    }
  }
}

// ---------------------------------------------------------------- wave setup

function waveSpecFor(state, index) {
  if (state.mode === MODES.SURVIVAL) return survivalWave(index + 1);
  return state.waves[index];
}

function spawnWave(state) {
  const spec = waveSpecFor(state, state.waveIndex);
  const cells = maskCells(spec.mask);
  state.aliens = cells.map((cell) => makeAlien(state, cell.row, cell.col, spec.rows[cell.row] ?? "grunt"));
  state.totalAliens = state.aliens.length || 1;
  state.formation.x = FORMATION_BASE_X;
  state.formation.y = -170;
  state.formation.dir = 1;
  state.formation.stepTimer = 0;
  state.bullets = [];
  state.enemyBullets = [];
  state.pickups = [];
  state.sweep = null;
  state.mothership = null;
  state.fireTimer = spec.fire * 0.8;
  state.diveTimer = spec.dive > 0 ? spec.dive * 0.7 : Infinity;
  state.pending = spec.mothership
    ? { hp: spec.mothership.hp, boss: Boolean(spec.mothership.boss), count: spec.mothership.count ?? 1, timer: spec.mothership.delay ?? 8 }
    : null;
  state.status = STATUS.INTRO;
  state.phaseTimer = INTRO_TIME;
  syncFormationPositions(state);
  emit(state, { type: "wave", index: state.waveIndex, count: state.aliens.length });
}

export function createState(options = {}) {
  const mode = options.mode ?? MODES.CAMPAIGN;
  const levelId = options.levelId ?? 1;
  const spec = mode === MODES.TRAINING ? trainingById(levelId) : levelById(levelId);
  const state = {
    mode,
    levelId,
    levelSpec: spec,
    training: mode === MODES.TRAINING,
    hint: spec.hint ?? null,
    par: spec.par ?? 0,
    waves: mode === MODES.SURVIVAL ? [] : spec.waves,
    waveIndex: 0,
    waveCount: mode === MODES.SURVIVAL ? Infinity : (spec.waves?.length ?? 0),
    status: STATUS.INTRO,
    phaseTimer: 0,
    time: 0,
    elapsed: 0,
    formation: { x: FORMATION_BASE_X, y: -170, dir: 1, stepTimer: 0, stepInterval: 0.9 },
    aliens: [],
    nextAlienId: 1,
    totalAliens: 1,
    bullets: [],
    enemyBullets: [],
    pickups: [],
    beams: [],
    sweep: null,
    turret: {
      x: VIEW_W / 2,
      vx: 0,
      heat: 0,
      overheated: false,
      lockTimer: 0,
      cooldown: 0,
      invuln: 0,
      charge: 0,
      charging: false,
      firingPrev: false,
      buffer: 0,
    },
    hull: 4,
    maxHull: 4,
    barricades: [makeBarricade(236), makeBarricade(500), makeBarricade(764)],
    mothership: null,
    pending: null,
    fireTimer: 0,
    diveTimer: 0,
    mod: { key: null, timer: 0, blocks: 0 },
    score: 0,
    comboHits: 0,
    bestCombo: 0,
    shotsFired: 0,
    shotsHit: 0,
    headons: 0,
    kills: 0,
    input: { move: 0, firing: false },
    paused: false,
    rngState: (options.seed ?? 0x9e3779b9) >>> 0,
    events: [],
  };
  spawnWave(state);
  return state;
}

export function setInput(state, input = {}) {
  state.input.move = input.move ?? 0;
  state.input.firing = Boolean(input.firing);
}

export function comboMultiplier(state) {
  return Math.min(4, 1 + 0.2 * Math.floor(state.comboHits / 5));
}

// ------------------------------------------------------------------- combat

function addHeat(state, amount) {
  const turret = state.turret;
  if (turret.overheated) return;
  turret.heat = clamp(turret.heat + amount, 0, 1);
  if (turret.heat >= 1) {
    turret.heat = 1;
    turret.overheated = true;
    turret.lockTimer = OVERHEAT_LOCK;
    turret.charge = 0;
    turret.charging = false;
    emit(state, { type: "overheat", x: turret.x, y: TURRET_Y });
  }
}

function spawnPlayerBullet(state, vx) {
  state.bullets.push({ x: state.turret.x, y: TURRET_Y - TURRET_H / 2 - 6, vx, vy: -BULLET_SPEED });
}

function tryShoot(state) {
  const turret = state.turret;
  if (turret.overheated) {
    turret.buffer = FIRE_BUFFER;
    return false;
  }
  if (turret.cooldown > 0) return false;
  const live = state.bullets.length;
  if (live >= MAX_PLAYER_BULLETS) return false;
  turret.cooldown = SHOT_COOLDOWN;
  const heatRate = state.mod.key === "mod_spread" ? MOD_TYPES.mod_spread.heat : 1;
  state.shotsFired += 1;
  if (state.mod.key === "mod_spread") {
    spawnPlayerBullet(state, -180);
    spawnPlayerBullet(state, 0);
    spawnPlayerBullet(state, 180);
  } else {
    spawnPlayerBullet(state, 0);
  }
  addHeat(state, HEAT_PER_SHOT * heatRate);
  emit(state, { type: "shot", x: turret.x, y: TURRET_Y });
  return true;
}

function fireRail(state) {
  const turret = state.turret;
  const x = turret.x;
  state.beams.push({ x, y: TURRET_Y, life: 0.24, age: 0 });
  for (const alien of state.aliens) {
    if (!alien.alive) continue;
    if (Math.abs(alien.x - x) > RAIL_HALF_W + alienSize(alien) / 2) continue;
    damageAlien(state, alien, 1, { rail: true });
  }
  if (state.mothership && Math.abs(state.mothership.x - x) < state.mothership.size / 2) {
    damageMothership(state, 2);
  }
  addHeat(state, RAIL_HEAT);
  emit(state, { type: "rail", x, y: TURRET_Y });
}

function killAlien(state, alien, meta = {}) {
  alien.alive = false;
  state.kills += 1;
  const def = ENEMY_TYPES[alien.type] ?? ENEMY_TYPES.grunt;
  const mult = comboMultiplier(state);
  let gained = Math.round(def.score * mult);
  if (meta.headon) {
    gained = Math.round(def.score * mult * 2) + 50;
    state.headons += 1;
  }
  state.score += gained;
  emit(state, { type: "kill", x: alien.x, y: alien.y, alien: alien.type, headon: Boolean(meta.headon), gained });
  if (def.onDeath === "split") {
    state.aliens.push(makeAlien(state, alien.row, alien.col, "spawn", -15));
    state.aliens.push(makeAlien(state, alien.row, alien.col, "spawn", 15));
    syncFormationPositions(state);
  } else if (def.onDeath === "swarm") {
    triggerSwarm(state, alien);
  }
  if (!meta.noDrop && nextRandom(state) < MOD_DROP_CHANCE) {
    const key = MOD_KEYS[Math.floor(nextRandom(state) * MOD_KEYS.length) % MOD_KEYS.length];
    state.pickups.push({ x: alien.x, y: alien.y, key, vy: PICKUP_SPEED });
  }
}

function triggerSwarm(state, source) {
  const candidates = state.aliens.filter(
    (alien) => alien.alive && alien.mode === "formation" && alien.row === source.row && alien.id !== source.id,
  );
  candidates.sort((a, b) => Math.abs(a.col - source.col) - Math.abs(b.col - source.col));
  // One escort only, and it has to wait its turn: forcing two un-paced dives on
  // every swarm kill stacks more simultaneous threats than the player can read.
  if (divers(state).length >= MAX_DIVERS) return;
  const victim = candidates[0];
  if (!victim) return;
  startDive(state, victim);
  state.diveTimer = Math.max(state.diveTimer, 1.2);
}

function damageAlien(state, alien, amount, meta = {}) {
  const def = ENEMY_TYPES[alien.type] ?? ENEMY_TYPES.grunt;
  if (!alien.alive) return false;
  if (def.cloak && alien.cloaked && !meta.rail) return false;
  if (def.shield && !alien.shieldOpen && !meta.rail) {
    emit(state, { type: "deflect", x: alien.x, y: alien.y });
    return false;
  }
  state.shotsHit += 1;
  state.comboHits += 1;
  if (state.comboHits > state.bestCombo) state.bestCombo = state.comboHits;
  alien.hp -= amount;
  if (alien.hp <= 0) {
    killAlien(state, alien, meta);
  } else {
    emit(state, { type: "hit", x: alien.x, y: alien.y, alien: alien.type });
  }
  return true;
}

function damageMothership(state, amount) {
  const ms = state.mothership;
  if (!ms) return;
  ms.hp -= amount;
  state.shotsHit += 1;
  state.comboHits += 1;
  if (state.comboHits > state.bestCombo) state.bestCombo = state.comboHits;
  const ratio = ms.hp / ms.maxHp;
  ms.phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
  emit(state, { type: "mshipHit", x: ms.x, y: ms.y });
  if (ms.hp <= 0) {
    ms.alive = false;
    state.mothership = null;
    if (state.pending) state.pending.count = 0;
    const bounty = MOD_BOUNTY[Math.floor(nextRandom(state) * MOD_BOUNTY.length) % MOD_BOUNTY.length];
    state.score += 1000 + bounty;
    emit(state, { type: "mshipDown", x: ms.x, y: ms.y, bounty });
  }
}

function damageHull(state, reason) {
  if (state.training) return;
  const turret = state.turret;
  if (turret.invuln > 0) return;
  if (state.mod.key === "mod_shield" && state.mod.blocks > 0) {
    state.mod.blocks -= 1;
    turret.invuln = INVULN_TIME;
    emit(state, { type: "blocked", x: turret.x, y: TURRET_Y });
    return;
  }
  state.hull -= 1;
  state.comboHits = 0;
  turret.invuln = INVULN_TIME;
  emit(state, { type: "hull", x: turret.x, y: TURRET_Y, hull: state.hull, reason });
  if (state.hull <= 0) {
    state.hull = 0;
    state.status = STATUS.LOST;
    emit(state, { type: "lose", reason });
  }
}

// ------------------------------------------------------------------- dives

function startDive(state, alien) {
  const current = divers(state);
  // Dives aim at the lane the turret occupies, with enough spread that simply
  // keeping the turret moving is a real answer: the player never has to cover
  // more than ~120px to leave the committed lane.
  let targetX = clamp(state.turret.x + randRange(state, -120, 120), TURRET_W, VIEW_W - TURRET_W);
  if (current.length > 0) {
    const other = current[0].targetX;
    targetX = other < VIEW_W / 2 ? clamp(VIEW_W * 0.74, TURRET_W, VIEW_W - TURRET_W) : clamp(VIEW_W * 0.26, TURRET_W, VIEW_W - TURRET_W);
  }
  alien.mode = "dive";
  alien.phase = "arc";
  alien.diveT = 0;
  alien.targetX = targetX;
  emit(state, { type: "dive", x: alien.x, y: alien.y });
}

function scheduleDive(state, dt) {
  const spec = waveSpecFor(state, state.waveIndex);
  if (!spec.dive || spec.dive <= 0) return;
  const alive = aliveAliens(state).filter((alien) => alien.mode === "formation");
  if (!alive.length) return;
  state.diveTimer -= dt;
  if (state.diveTimer > 0) return;
  const ratio = alive.length / Math.max(1, state.totalAliens);
  state.diveTimer = Math.max(1.5, spec.dive * (0.45 + 0.55 * ratio));
  if (divers(state).length >= MAX_DIVERS) return;
  const columns = new Map();
  for (const alien of alive) {
    const prev = columns.get(alien.col);
    if (!prev || alien.row > prev.row) columns.set(alien.col, alien);
  }
  const pool = [];
  for (const alien of columns.values()) {
    const weight = ENEMY_TYPES[alien.type]?.diveWeight ?? 1;
    for (let i = 0; i < Math.max(1, Math.round(weight)); i += 1) pool.push(alien);
  }
  if (!pool.length) return;
  const chosen = pool[Math.floor(nextRandom(state) * pool.length) % pool.length];
  startDive(state, chosen);
}

function updateDivers(state, dt) {
  for (const alien of state.aliens) {
    if (!alien.alive || alien.mode !== "dive") continue;
    alien.diveT += dt;
    if (alien.phase === "return") {
      const slotX = state.formation.x + alien.col * COL_W + COL_W / 2 + alien.dx;
      const slotY = state.formation.y + alien.row * ROW_H + ROW_H / 2;
      alien.x += (slotX - alien.x) * Math.min(1, 4.5 * dt);
      alien.y += (slotY - alien.y) * Math.min(1, 4.5 * dt);
      if (Math.abs(slotY - alien.y) < 6 && Math.abs(slotX - alien.x) < 6) {
        alien.mode = "formation";
        alien.phase = "arc";
        alien.diveT = 0;
      }
      continue;
    }
    if (alien.phase === "arc") {
      alien.y += DIVE_ARC_SPEED * dt;
      alien.x += (alien.targetX - alien.x) * Math.min(1, 2.0 * dt);
      if (alien.diveT >= DIVE_ARC_TIME) {
        alien.phase = "dash";
        emit(state, { type: "dash", x: alien.x, y: alien.y });
      }
    } else {
      alien.y += DIVE_DASH_SPEED * dt;
    }
    const size = alienSize(alien);
    const hitBarricade = solidAt(state.barricades, alien.x, alien.y + size / 2);
    if (hitBarricade) {
      erode(state.barricades, alien.x, alien.y + size / 2, 20);
      alien.alive = false;
      emit(state, { type: "crash", x: alien.x, y: alien.y });
      continue;
    }
    // The diver has to actually overlap the turret's own band. Without the
    // upper bound a diver that already fell past the deck could still "ram"
    // the turret from below, purely because the turret slid sideways into it.
    if (alien.y + size / 2 >= TURRET_Y - TURRET_H / 2 && alien.y <= TURRET_Y + TURRET_H / 2 + 8) {
      const inRange = Math.abs(alien.x - state.turret.x) < TURRET_W / 2 + 12;
      if (inRange) {
        alien.alive = false;
        damageHull(state, "ram");
        emit(state, { type: "crash", x: alien.x, y: alien.y });
        continue;
      }
    }
    if (alien.y > VIEW_H + 40) {
      // A dive that runs out of room peels off and re-forms at the top of the
      // block: missing the turret costs the player tempo, never a hull point.
      alien.phase = "return";
      alien.y = -70;
      alien.x = state.formation.x + alien.col * COL_W + COL_W / 2 + alien.dx;
      emit(state, { type: "return", x: alien.x, y: alien.y });
    }
  }
}

// ----------------------------------------------------------------- shooting

function updatePlayerFire(state, dt) {
  const turret = state.turret;
  const firing = state.input.firing;
  // Holding the trigger lays down sustained fire -- it has to, otherwise a
  // pressed key or a held pointer would only ever produce a single shell.
  // The shell stream is gated by the cooldown, the two-shell cap and heat.
  if (firing) {
    turret.charging = true;
    turret.charge = Math.min(RAIL_CHARGE, turret.charge + dt);
    tryShoot(state);
  }
  // Releasing a long hold cashes the charge in for the piercing rail beam.
  if (!firing && turret.firingPrev) {
    if (turret.charge >= RAIL_CHARGE && turret.heat <= RAIL_HEAT_GATE) {
      fireRail(state);
    }
    turret.charge = 0;
    turret.charging = false;
  }
  turret.firingPrev = firing;

  if (turret.overheated) {
    turret.lockTimer -= dt;
    turret.buffer -= dt;
    if (turret.lockTimer <= 0) {
      turret.overheated = false;
      turret.heat = 0;
      turret.lockTimer = 0;
      if (turret.buffer > 0 && firing) {
        turret.buffer = 0;
        turret.cooldown = 0;
        tryShoot(state);
      } else {
        turret.buffer = 0;
      }
      emit(state, { type: "cooled", x: turret.x, y: TURRET_Y });
    }
    return;
  }
  // Cooling never stops just because the trigger is down: the gauge has to be
  // a rate limit, not a timer that runs while you are charging.
  const decay = HEAT_DECAY * (state.mod.key === "mod_slowfield" ? 2 : 1);
  turret.heat = Math.max(0, turret.heat - decay * dt);
}

function nearestAlienX(state, bullet) {
  let best = null;
  let bestDist = 180;
  for (const alien of state.aliens) {
    if (!alien.alive) continue;
    const dist = Math.abs(alien.x - bullet.x);
    if (dist < bestDist) {
      bestDist = dist;
      best = alien;
    }
  }
  return best;
}

function updatePlayerBullets(state, dt) {
  const alive = [];
  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (state.mod.key === "mod_magrail") {
      const target = nearestAlienX(state, bullet);
      if (target) {
        const pull = MOD_TYPES.mod_magrail.pull;
        const dir = Math.sign(target.x - bullet.x);
        bullet.vx = clamp(bullet.vx + dir * pull * dt, -320, 320);
      }
    }
    if (bullet.x < 0 || bullet.x > VIEW_W) {
      state.comboHits = 0;
      continue;
    }
    const barricade = solidAt(state.barricades, bullet.x, bullet.y);
    if (barricade) {
      erode(state.barricades, bullet.x, bullet.y, 9);
      emit(state, { type: "chip", x: bullet.x, y: bullet.y });
      continue;
    }
    let consumed = false;
    for (const alien of state.aliens) {
      if (!alien.alive) continue;
      const size = alienSize(alien);
      if (Math.abs(bullet.x - alien.x) > size / 2 + 3) continue;
      if (Math.abs(bullet.y - alien.y) > size / 2 + 4) continue;
      const headon = alien.mode === "dive" && alien.phase === "dash";
      const hit = damageAlien(state, alien, 1, { headon });
      if (hit) {
        consumed = true;
        break;
      }
      if (!ENEMY_TYPES[alien.type]?.cloak) {
        consumed = true;
        break;
      }
    }
    if (consumed) continue;
    if (state.mothership && Math.abs(bullet.x - state.mothership.x) < state.mothership.size / 2 && Math.abs(bullet.y - state.mothership.y) < 34) {
      damageMothership(state, 1);
      continue;
    }
    if (bullet.y < -30) {
      state.comboHits = 0;
      continue;
    }
    alive.push(bullet);
  }
  state.bullets = alive;
}

function enemyShoot(state) {
  if (state.enemyBullets.length >= MAX_ENEMY_BULLETS) return;
  const columns = new Map();
  for (const alien of state.aliens) {
    if (!alien.alive || alien.mode !== "formation") continue;
    const prev = columns.get(alien.col);
    if (!prev || alien.row > prev.row) columns.set(alien.col, alien);
  }
  const pool = [...columns.values()];
  if (!pool.length) return;
  const shooter = pool[Math.floor(nextRandom(state) * pool.length) % pool.length];
  const def = ENEMY_TYPES[shooter.type] ?? ENEMY_TYPES.grunt;
  const lead = state.turret.vx * def.lead;
  const vx = clamp((state.turret.x + lead - shooter.x) * def.lead * 1.2, -70, 70);
  state.enemyBullets.push({
    x: shooter.x,
    y: shooter.y + alienSize(shooter) / 2,
    vx,
    vy: ENEMY_BULLET_SPEED,
  });
  emit(state, { type: "enemyShot", x: shooter.x, y: shooter.y });
}

function mothershipShoot(state) {
  const ms = state.mothership;
  if (!ms) return;
  const count = ms.phase === 1 ? 1 : ms.phase === 2 ? 2 : 3;
  for (let i = 0; i < count; i += 1) {
    if (state.enemyBullets.length >= MAX_ENEMY_BULLETS) break;
    const spread = count === 1 ? 0 : (i - (count - 1) / 2) * 130;
    state.enemyBullets.push({ x: ms.x + spread, y: ms.y + 26, vx: 0, vy: ENEMY_BULLET_SPEED * 0.9 });
  }
  emit(state, { type: "enemyShot", x: ms.x, y: ms.y });
}

function updateEnemyBullets(state, dt) {
  const alive = [];
  for (const bullet of state.enemyBullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    const barricade = solidAt(state.barricades, bullet.x, bullet.y);
    if (barricade) {
      erode(state.barricades, bullet.x, bullet.y, 8);
      emit(state, { type: "chip", x: bullet.x, y: bullet.y });
      continue;
    }
    const turret = state.turret;
    if (
      bullet.y > TURRET_Y - TURRET_H / 2 &&
      bullet.y < TURRET_Y + TURRET_H / 2 + 10 &&
      Math.abs(bullet.x - turret.x) < TURRET_W / 2
    ) {
      damageHull(state, "shot");
      emit(state, { type: "impact", x: bullet.x, y: bullet.y });
      continue;
    }
    if (bullet.y > VIEW_H + 30) continue;
    if (bullet.x < -40 || bullet.x > VIEW_W + 40) continue;
    alive.push(bullet);
  }
  state.enemyBullets = alive;
}

// -------------------------------------------------------------- mothership

function spawnMothership(state) {
  const fromLeft = nextRandom(state) < 0.5;
  const hp = state.pending?.hp ?? 10;
  const size = ENEMY_TYPES.mothership.size;
  state.mothership = {
    x: fromLeft ? -size / 2 : VIEW_W + size / 2,
    y: 82,
    vx: fromLeft ? 76 : -76,
    hp,
    maxHp: hp,
    size,
    phase: 1,
    boss: Boolean(state.pending?.boss),
    fireTimer: 1.2,
    sweepTimer: 2.4,
  };
  emit(state, { type: "mshipIn", x: state.mothership.x, y: 82 });
}

function updateMothership(state, dt) {
  const ms = state.mothership;
  if (!ms) {
    if (state.pending && state.pending.count > 0) {
      state.pending.timer -= dt;
      if (state.pending.timer <= 0) spawnMothership(state);
    }
    return;
  }
  ms.x += ms.vx * dt;
  if (ms.boss) {
    if (ms.x < 90 && ms.vx < 0) ms.vx = Math.abs(ms.vx);
    if (ms.x > VIEW_W - 90 && ms.vx > 0) ms.vx = -Math.abs(ms.vx);
  } else if (ms.x < -ms.size || ms.x > VIEW_W + ms.size) {
    state.mothership = null;
    if (state.pending) {
      state.pending.count -= 1;
      state.pending.timer = 14;
    }
    emit(state, { type: "mshipOut", x: ms.x, y: ms.y });
    return;
  }
  ms.fireTimer -= dt;
  if (ms.fireTimer <= 0) {
    ms.fireTimer = ms.phase === 1 ? 1.5 : ms.phase === 2 ? 1.15 : 0.95;
    mothershipShoot(state);
  }
  if (ms.phase === 3) {
    ms.sweepTimer -= dt;
    if (!state.sweep && ms.sweepTimer <= 0) {
      state.sweep = { x: state.turret.x, t: 0, fired: false };
      ms.sweepTimer = 2.6;
      emit(state, { type: "sweepWarn", x: state.sweep.x });
    }
  }
}

function updateSweep(state, dt) {
  const sweep = state.sweep;
  if (!sweep) return;
  sweep.t += dt;
  if (!sweep.fired && sweep.t >= 0.5) {
    sweep.fired = true;
    if (Math.abs(state.turret.x - sweep.x) < 46) damageHull(state, "sweep");
    emit(state, { type: "sweep", x: sweep.x });
  }
  if (sweep.t >= 0.85) state.sweep = null;
}

// ------------------------------------------------------------------- pickups

function updatePickups(state, dt) {
  const alive = [];
  for (const pickup of state.pickups) {
    pickup.y += pickup.vy * dt;
    if (
      pickup.y > TURRET_Y - TURRET_H &&
      pickup.y < TURRET_Y + TURRET_H &&
      Math.abs(pickup.x - state.turret.x) < TURRET_W / 2 + 12
    ) {
      applyMod(state, pickup.key);
      continue;
    }
    if (pickup.y > VIEW_H + 30) continue;
    alive.push(pickup);
  }
  state.pickups = alive;
}

export function applyMod(state, key) {
  if (!MOD_KEYS.includes(key)) return;
  state.mod.key = key;
  state.mod.timer = MOD_DURATION;
  state.mod.blocks = key === "mod_shield" ? MOD_TYPES.mod_shield.blocks : 0;
  emit(state, { type: "mod", key, x: state.turret.x, y: TURRET_Y });
}

// ------------------------------------------------------------------- marching

function stepFormation(state, dt) {
  const formation = state.formation;
  const alive = state.aliens.filter((alien) => alien.alive && alien.mode === "formation");
  if (!alive.length) return;
  const spec = waveSpecFor(state, state.waveIndex);
  const total = Math.max(1, state.totalAliens);
  const ratio = total > 1 ? (alive.length - 1) / (total - 1) : 0;
  const base = 0.9 - 0.78 * (1 - ratio);
  const interval = Math.max(0.1, base / Math.max(0.4, spec.speed));
  formation.stepInterval = interval;
  const slow = state.mod.key === "mod_slowfield" ? MOD_TYPES.mod_slowfield.factor : 1;
  formation.stepTimer += dt * slow;
  if (formation.stepTimer < interval) return;
  formation.stepTimer -= interval;
  let minCol = COLS;
  let maxCol = -1;
  for (const alien of alive) {
    minCol = Math.min(minCol, alien.col);
    maxCol = Math.max(maxCol, alien.col);
  }
  // Only the occupied slice of the block collides with the walls. The block
  // narrows as aliens die, so the clamp has to be recomputed every step --
  // otherwise a block whose survivors all sit in an edge column can end up
  // permanently outside the rail and descend on every single step.
  const spanLeft = minCol * COL_W;
  const spanRight = (maxCol + 1) * COL_W;
  const lo = FORMATION_MARGIN - spanLeft;
  const hi = VIEW_W - FORMATION_MARGIN - spanRight;
  if (formation.dir < 0 && formation.x + formation.dir * STEP_X < lo) {
    formation.dir = 1;
    formation.y += STEP_Y;
    emit(state, { type: "descend", y: formation.y });
  } else if (formation.dir > 0 && formation.x + formation.dir * STEP_X > hi) {
    formation.dir = -1;
    formation.y += STEP_Y;
    emit(state, { type: "descend", y: formation.y });
  }
  formation.x = clamp(formation.x + formation.dir * STEP_X, Math.min(lo, hi), Math.max(lo, hi));
  emit(state, { type: "march", interval, count: alive.length });
  syncFormationPositions(state);
  for (const alien of alive) {
    const size = alienSize(alien);
    const box = { x: alien.x - size / 2, y: alien.y - size / 2, w: size, h: size };
    if (erodeBox(state.barricades, box) > 0) emit(state, { type: "chip", x: alien.x, y: alien.y + size / 2 });
  }
}

// ------------------------------------------------------------------ lifecycle

function checkWaveClear(state) {
  const aliensLeft = state.aliens.some((alien) => alien.alive);
  const pendingMship = Boolean(state.mothership) || Boolean(state.pending && state.pending.count > 0);
  if (aliensLeft || pendingMship) return;
  state.status = STATUS.CLEAR;
  state.phaseTimer = CLEAR_TIME;
  emit(state, { type: "waveClear", index: state.waveIndex });
}

function advanceWave(state) {
  state.waveIndex += 1;
  if (state.mode !== MODES.SURVIVAL && state.waveIndex >= state.waveCount) {
    state.status = STATUS.WON;
    emit(state, { type: "win", levelId: state.levelId });
    return;
  }
  spawnWave(state);
}

function updateTurret(state, dt) {
  const turret = state.turret;
  turret.vx = state.input.move * TURRET_SPEED;
  turret.x = clamp(turret.x + turret.vx * dt, TURRET_W / 2, VIEW_W - TURRET_W / 2);
  turret.cooldown = Math.max(0, turret.cooldown - dt);
  turret.invuln = Math.max(0, turret.invuln - dt);
}

export function stepFrame(state, dt) {
  const step = Math.min(Math.max(dt, 0), 0.05);
  if (state.status === STATUS.WON || state.status === STATUS.LOST || state.paused) return state;
  state.time += step;
  state.elapsed += step;

  for (const beam of state.beams) beam.age += step;
  state.beams = state.beams.filter((beam) => beam.age < beam.life);

  if (state.mod.key) {
    state.mod.timer -= step;
    if (state.mod.timer <= 0) {
      state.mod.key = null;
      state.mod.blocks = 0;
    }
  }

  if (state.status === STATUS.INTRO) {
    state.phaseTimer -= step;
    const progress = clamp(1 - state.phaseTimer / INTRO_TIME, 0, 1);
    state.formation.y = -170 + progress * (FORMATION_BASE_Y + 170);
    syncFormationPositions(state);
    updateTurret(state, step);
    if (state.phaseTimer <= 0) {
      state.status = STATUS.FIGHT;
      state.formation.y = FORMATION_BASE_Y;
      syncFormationPositions(state);
    }
    return state;
  }

  if (state.status === STATUS.CLEAR) {
    state.phaseTimer -= step;
    updateTurret(state, step);
    if (state.phaseTimer <= 0) advanceWave(state);
    return state;
  }

  // STATUS.FIGHT
  updateTurret(state, step);
  updatePlayerFire(state, step);
  stepFormation(state, step);
  syncFormationPositions(state);
  scheduleDive(state, step);
  updateDivers(state, step);
  updatePlayerBullets(state, step);
  updateEnemyBullets(state, step);
  updateMothership(state, step);
  updateSweep(state, step);
  updatePickups(state, step);

  const slow = state.mod.key === "mod_slowfield" ? MOD_TYPES.mod_slowfield.factor : 1;
  const spec = waveSpecFor(state, state.waveIndex);
  if (spec.fire > 0) {
    state.fireTimer -= step * slow;
    if (state.fireTimer <= 0) {
      state.fireTimer = spec.fire / Math.max(0.4, spec.speed);
      enemyShoot(state);
    }
  }

  if (formationBottom(state) >= RED_LINE_Y) {
    if (state.training) {
      state.formation.y = FORMATION_BASE_Y;
      syncFormationPositions(state);
    } else {
      state.status = STATUS.LOST;
      emit(state, { type: "lose", reason: "breach" });
      return state;
    }
  }
  if (state.hull <= 0 && !state.training) {
    state.status = STATUS.LOST;
    emit(state, { type: "lose", reason: "hull" });
    return state;
  }
  checkWaveClear(state);
  return state;
}

export function accuracy(state) {
  if (state.shotsFired === 0) return 0;
  // One piercing rail beam can register several hits, so cap the ratio.
  return Math.min(1, state.shotsHit / state.shotsFired);
}

export {
  LEVELS,
  TRAINING,
  TOTAL_LEVELS,
  VIEW_W,
  VIEW_H,
  TURRET_Y,
  TURRET_W,
  TURRET_SPEED,
  RED_LINE_Y,
  MAX_DIVERS,
};
