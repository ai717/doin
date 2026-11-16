// Volley Bombard — rules authority (pure functions, strictly DOM-free).
// Parabolic turn-based artillery: angle + power + per-round wind, block fortresses
// with support-collapse physics, 6 weapons, 3 terrain shapes, 10-round judging.
// No document / window / localStorage may appear here; UI drives everything via intents.

export const WORLD = Object.freeze({ w: 1000, h: 460 });
export const GROUND = 0;
export const GRAVITY = 380;
export const WIND_ACCEL = 14;
export const SHELL_RADIUS = 4;
export const MAX_ROUNDS = 10;
export const MIN_ANGLE = 0;
export const MAX_ANGLE = 90;
export const MIN_POWER = 0;
export const MAX_POWER = 100;
export const WIND_MIN = -5;
export const WIND_MAX = 5;
export const SIM_DT = 1 / 60;

export const PLINTH_H = 46;
export const PLINTHS = Object.freeze([
  Object.freeze({ x0: 40, x1: 200 }),
  Object.freeze({ x0: 800, x1: 960 }),
]);
export const MUZZLES = Object.freeze([
  Object.freeze({ x: 212, y: 62 }),
  Object.freeze({ x: 788, y: 62 }),
]);

export const BLOCK_W = 25;
export const BLOCK_H = 22;
export const BLOCK_HP = 20;
export const FLAG_W = 30;
export const FLAG_H = 34;
export const FLAG_HP = 34;
export const LAYER_Y = Object.freeze([PLINTH_H, 68, 90]);
export const FLAG_Y = 112;

// Weapon table (tuned from PRD; keys are stable ids, display text lives in i18n).
export const WEAPON_SPECS = Object.freeze({
  stone: Object.freeze({ dmg: 22, radius: 0, speedMul: 1.0, gravMul: 1.0, windMul: 1.0, split: 0, sticky: 0, drill: 0 }),
  blast: Object.freeze({ dmg: 15, radius: 70, speedMul: 1.0, gravMul: 1.0, windMul: 1.0, split: 0, sticky: 0, drill: 0 }),
  split: Object.freeze({ dmg: 8, radius: 24, speedMul: 1.0, gravMul: 1.0, windMul: 1.0, split: 3, sticky: 0, drill: 0 }),
  sticky: Object.freeze({ dmg: 18, radius: 60, speedMul: 0.9, gravMul: 1.0, windMul: 1.0, split: 0, sticky: 2.0, drill: 0 }),
  drill: Object.freeze({ dmg: 18, radius: 55, speedMul: 1.05, gravMul: 1.0, windMul: 1.0, split: 0, sticky: 0, drill: 1, pierceDmg: 8 }),
  balloon: Object.freeze({ dmg: 16, radius: 55, speedMul: 0.45, gravMul: 0.22, windMul: 2.5, split: 0, sticky: 0, drill: 0 }),
});
export const WEAPON_IDS = Object.freeze(["stone", "blast", "split", "sticky", "drill", "balloon"]);
export const DEFAULT_LOADOUT = Object.freeze(["stone", "blast", "split"]);

// Terrain profiles: [x, height] keypoints, piecewise-linear. Pure display-free data.
export const TERRAIN_PROFILES = Object.freeze({
  hill: Object.freeze([[320, 0], [400, 48], [500, 88], [600, 48], [680, 0]]),
  peak: Object.freeze([[370, 0], [450, 128], [500, 205], [550, 128], [630, 0]]),
  twin: Object.freeze([[340, 0], [395, 92], [445, 52], [500, 26], [555, 52], [605, 92], [660, 0]]),
});
export const TERRAIN_IDS = Object.freeze(["hill", "peak", "twin"]);

export const AI_LEVELS = Object.freeze(["rookie", "veteran", "master"]);
export const AI_ERROR = Object.freeze({ rookie: 8, veteran: 4, master: 1 });
export const AI_POWER_ERROR = Object.freeze({ rookie: 12, veteran: 6, master: 1.5 });

export function mulberry32(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function terrainHeightAt(profile, x) {
  if (!profile || profile.length < 2) return 0;
  if (x <= profile[0][0] || x >= profile[profile.length - 1][0]) return 0;
  for (let i = 1; i < profile.length; i += 1) {
    const [x1, h1] = profile[i];
    if (x <= x1) {
      const [x0, h0] = profile[i - 1];
      const t = (x - x0) / (x1 - x0);
      return h0 + (h1 - h0) * t;
    }
  }
  return 0;
}

export function buildFortress(side) {
  const blocks = [];
  const mirror = (x) => (side === 0 ? x : WORLD.w - x - BLOCK_W);
  const layerX = [
    (i) => 43 + i * 25.4,
    (i) => 56.7 + i * 25.4,
    (i) => 70.4 + i * 25.4,
  ];
  const layerCounts = [6, 5, 4];
  let index = 0;
  for (let layer = 0; layer < 3; layer += 1) {
    for (let i = 0; i < layerCounts[layer]; i += 1) {
      blocks.push({
        id: `${side}-${index}`,
        side,
        layer,
        x: mirror(layerX[layer](i)),
        y: LAYER_Y[layer],
        w: BLOCK_W,
        h: BLOCK_H,
        hp: BLOCK_HP,
        maxHp: BLOCK_HP,
        alive: true,
      });
      index += 1;
    }
  }
  return blocks;
}

function buildFlag(side) {
  const x = side === 0 ? 104.4 : WORLD.w - 104.4 - FLAG_W;
  return { side, x, y: FLAG_Y, w: FLAG_W, h: FLAG_H, hp: FLAG_HP, maxHp: FLAG_HP, down: false, restY: FLAG_Y };
}

export function rollWind(rng) {
  return Math.floor(rng() * (WIND_MAX - WIND_MIN + 1)) + WIND_MIN;
}

export function createMatch(options = {}) {
  const seed = Number.isFinite(options.seed) ? Math.floor(options.seed) >>> 0 : (Date.now() & 0x7fffffff);
  const terrain = TERRAIN_IDS.includes(options.terrain) ? options.terrain : "hill";
  const mode = options.mode === "ai" ? "ai" : "2p";
  const aiLevel = AI_LEVELS.includes(options.aiLevel) ? options.aiLevel : "veteran";
  const loadout = Array.isArray(options.loadout)
    ? options.loadout.filter((id) => WEAPON_IDS.includes(id)).slice(0, 3)
    : [...DEFAULT_LOADOUT];
  const weapons = loadout.length >= 1 ? loadout : [...DEFAULT_LOADOUT];
  const rng = mulberry32(seed ^ 0x5f3759df);
  return {
    seed,
    rng,
    terrain,
    profile: TERRAIN_PROFILES[terrain],
    mode,
    aiLevel,
    weapons,
    turn: 0,
    round: 1,
    phase: "aim", // aim | flight | over
    winner: null, // null | 0 | 1 | "draw"
    wind: rollWind(rng),
    acc: 0,
    shotSeq: 0,
    players: [0, 1].map((side) => ({
      side,
      // 45°/90 是三种地形都落在对面阵地内的窗口（首发即可命中，玩家不必先摸参数）
      angle: 45,
      power: 90,
      weapon: weapons[0],
      shots: 0,
      hits: 0,
      bestDamage: 0,
    })),
    blocks: [...buildFortress(0), ...buildFortress(1)],
    flags: [buildFlag(0), buildFlag(1)],
    shells: [],
    shotCtx: null,
    lastEvents: [],
  };
}

// ---------- queries ----------

export function aliveBlocksOf(state, side) {
  return state.blocks.filter((b) => b.side === side && b.alive);
}

export function intactCount(state, side) {
  return aliveBlocksOf(state, side).length;
}

export function flagOf(state, side) {
  return state.flags[side];
}

export function muzzleOf(state, side) {
  return MUZZLES[side];
}

export function initialVelocity(state, side, angleDeg, power, weaponId) {
  const spec = WEAPON_SPECS[weaponId] ?? WEAPON_SPECS.stone;
  const v0 = (80 + power * 4.8) * spec.speedMul;
  const rad = (angleDeg * Math.PI) / 180;
  const dir = side === 0 ? 1 : -1;
  return { vx: Math.cos(rad) * v0 * dir, vy: Math.sin(rad) * v0 };
}

// No-wind preview polyline (stops at terrain / ground). Pure.
export function previewPath(state, side, angleDeg = state.players[side].angle, power = state.players[side].power, weaponId = state.players[side].weapon) {
  const m = MUZZLES[side];
  const { vx, vy } = initialVelocity(state, side, angleDeg, power, weaponId);
  const pts = [{ x: m.x, y: m.y }];
  let x = m.x;
  let y = m.y;
  let cvx = vx;
  let cvy = vy;
  for (let i = 0; i < 900; i += 1) {
    cvy -= GRAVITY * SIM_DT;
    x += cvx * SIM_DT;
    y += cvy * SIM_DT;
    if (x < -40 || x > WORLD.w + 40 || y <= GROUND) {
      pts.push({ x, y: Math.max(y, GROUND) });
      break;
    }
    if (y <= terrainHeightAt(state.profile, x)) {
      pts.push({ x, y });
      break;
    }
    if (i % 3 === 0) pts.push({ x, y });
  }
  return pts;
}

// ---------- mutation helpers (internal) ----------

function pushEvent(state, event) {
  state.lastEvents.push(event);
}

function damageBlock(state, block, dmg, cause) {
  if (!block.alive || dmg <= 0) return 0;
  const applied = Math.min(block.hp, Math.round(dmg));
  block.hp -= applied;
  if (block.hp <= 0) {
    block.alive = false;
    pushEvent(state, { type: "blockDestroy", id: block.id, side: block.side, x: block.x + block.w / 2, y: block.y + block.h / 2, cause, dmg: applied });
  } else {
    pushEvent(state, { type: "blockDamage", id: block.id, side: block.side, hp: block.hp, x: block.x + block.w / 2, y: block.y + block.h / 2, dmg: applied });
  }
  return applied;
}

function damageFlag(state, flag, dmg, cause) {
  if (flag.down || dmg <= 0) return 0;
  const applied = Math.min(flag.hp, Math.round(dmg));
  flag.hp -= applied;
  pushEvent(state, { type: "flagDamage", side: flag.side, hp: flag.hp, x: flag.x + flag.w / 2, y: flag.y + flag.h / 2, dmg: applied, cause });
  if (flag.hp <= 0) {
    flag.down = true;
    pushEvent(state, { type: "flagDown", side: flag.side, cause });
  }
  return applied;
}

function blastFalloff(dist, radius) {
  if (dist <= radius * 0.5) return 1;
  if (dist >= radius) return 0;
  return 1 - (dist - radius * 0.5) / (radius * 0.5);
}

function explodeAt(state, shell, cx, cy) {
  const spec = WEAPON_SPECS[shell.weapon] ?? WEAPON_SPECS.stone;
  const owner = shell.owner;
  let enemyDamage = 0;
  let selfDamage = 0;
  for (const block of state.blocks) {
    if (!block.alive) continue;
    const bcx = block.x + block.w / 2;
    const bcy = block.y + block.h / 2;
    let dmg = 0;
    if (spec.radius === 0) {
      if (shell.directHitId === block.id) dmg = spec.dmg;
    } else {
      const d = Math.hypot(bcx - cx, bcy - cy);
      dmg = spec.dmg * blastFalloff(d, spec.radius);
    }
    const applied = damageBlock(state, block, dmg, shell.weapon);
    if (applied > 0) {
      if (block.side === owner) selfDamage += applied;
      else enemyDamage += applied;
    }
  }
  for (const flag of state.flags) {
    if (flag.down) continue;
    const fcx = flag.x + flag.w / 2;
    const fcy = flag.y + flag.h / 2;
    let dmg = 0;
    if (spec.radius === 0) {
      if (shell.directHitId === `flag${flag.side}`) dmg = spec.dmg;
    } else {
      const d = Math.hypot(fcx - cx, fcy - cy);
      dmg = spec.dmg * blastFalloff(d, spec.radius);
    }
    const applied = damageFlag(state, flag, dmg, shell.weapon);
    if (applied > 0) {
      if (flag.side === owner) selfDamage += applied;
      else enemyDamage += applied;
    }
  }
  if (state.shotCtx && state.shotCtx.owner === owner) {
    state.shotCtx.enemyDamage += enemyDamage;
    state.shotCtx.selfDamage += selfDamage;
    state.shotCtx.singleDamage = Math.max(state.shotCtx.singleDamage, enemyDamage);
  }
  pushEvent(state, { type: "explode", x: cx, y: cy, radius: spec.radius, weapon: shell.weapon, owner, enemyDamage, selfDamage });
}

function spawnShell(state, owner, weapon, x, y, vx, vy, isChild = false) {
  state.shotSeq += 1;
  state.shells.push({
    id: `s${state.shotSeq}`,
    owner,
    weapon,
    x,
    y,
    vx,
    vy,
    t: 0,
    isChild,
    splitDone: isChild, // children never split again
    penetrated: false,
    pierceGrace: 0,
    directHitId: null,
    stickyTimer: 0,
    attached: false,
  });
}

function shellHitsBlock(shell, block) {
  if (!block.alive) return false;
  if (shell.pierceGrace > 0) return false;
  return (
    shell.x + SHELL_RADIUS > block.x &&
    shell.x - SHELL_RADIUS < block.x + block.w &&
    shell.y + SHELL_RADIUS > block.y &&
    shell.y - SHELL_RADIUS < block.y + block.h
  );
}

function shellHitsFlag(shell, flag) {
  if (flag.down) return false;
  return (
    shell.x + SHELL_RADIUS > flag.x &&
    shell.x - SHELL_RADIUS < flag.x + flag.w &&
    shell.y + SHELL_RADIUS > flag.y &&
    shell.y - SHELL_RADIUS < flag.y + flag.h
  );
}

function impactShell(state, shell, hitBlockId, hitFlagSide) {
  const spec = WEAPON_SPECS[shell.weapon] ?? WEAPON_SPECS.stone;
  shell.directHitId = hitFlagSide != null ? `flag${hitFlagSide}` : hitBlockId;
  if (spec.sticky > 0 && shell.stickyTimer <= 0 && !shell.attached) {
    shell.attached = true;
    shell.stickyTimer = spec.sticky;
    shell.vx = 0;
    shell.vy = 0;
    pushEvent(state, { type: "stick", x: shell.x, y: shell.y, owner: shell.owner });
    return;
  }
  if (spec.drill > 0 && !shell.penetrated && hitBlockId) {
    const block = state.blocks.find((b) => b.id === hitBlockId);
    if (block) {
      const applied = damageBlock(state, block, spec.pierceDmg, shell.weapon);
      if (state.shotCtx && state.shotCtx.owner === shell.owner) {
        if (block.side === shell.owner) state.shotCtx.selfDamage += applied;
        else {
          state.shotCtx.enemyDamage += applied;
          state.shotCtx.singleDamage = Math.max(state.shotCtx.singleDamage, applied);
        }
      }
    }
    shell.penetrated = true;
    shell.pierceGrace = 8; // steps of immunity to pass through the layer
    shell.vx *= 0.75;
    shell.vy *= 0.75;
    pushEvent(state, { type: "pierce", x: shell.x, y: shell.y, id: hitBlockId });
    return;
  }
  explodeAt(state, shell, shell.x, shell.y);
  shell.dead = true;
}

// Deterministic support-collapse: blocks fall straight down onto support; the flag
// falls when nothing beneath its window remains (resting on the plinth = down).
export function settle(state) {
  const events = [];
  let moved = true;
  let guard = 0;
  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x;
  while (moved && guard < 64) {
    moved = false;
    guard += 1;
    const alive = state.blocks.filter((b) => b.alive);
    for (const block of alive) {
      if (block.y <= PLINTH_H + 0.01) continue;
      const support = alive.some(
        (c) => c !== block && overlaps(block, c) && c.y < block.y - 0.01 && c.y + c.h >= block.y - 0.5,
      );
      if (!support) {
        let rest = PLINTH_H;
        for (const c of alive) {
          if (c === block || !overlaps(block, c)) continue;
          if (c.y + c.h <= block.y + 0.01) rest = Math.max(rest, c.y + c.h);
        }
        if (rest < block.y - 0.01) {
          events.push({ type: "collapse", id: block.id, side: block.side, fromY: block.y, toY: rest });
          block.y = rest;
          moved = true;
        }
      }
    }
    for (const flag of state.flags) {
      if (flag.down) continue;
      const column = alive.filter((b) => b.side === flag.side && b.x < flag.x + flag.w && b.x + b.w > flag.x);
      let rest = PLINTH_H;
      for (const c of column) {
        if (c.y + c.h <= flag.y + 0.01) rest = Math.max(rest, c.y + c.h);
      }
      if (rest < flag.y - 0.01) {
        events.push({ type: "flagFall", side: flag.side, fromY: flag.y, toY: rest });
        flag.y = rest;
        flag.restY = rest;
        moved = true;
        if (rest <= PLINTH_H + 0.01) {
          flag.down = true;
          events.push({ type: "flagDown", side: flag.side, cause: "support" });
        }
      } else {
        flag.restY = flag.y;
      }
    }
  }
  for (const event of events) pushEvent(state, event);
  return events;
}

function commitShot(state) {
  if (!state.shotCtx) return;
  const player = state.players[state.shotCtx.owner];
  player.shots += 1;
  if (state.shotCtx.enemyDamage > 0) player.hits += 1;
  player.bestDamage = Math.max(player.bestDamage, Math.round(state.shotCtx.enemyDamage));
  state.shotCtx = null;
}

function endShot(state) {
  commitShot(state);
  settle(state);
  const flag1Down = state.flags[1].down;
  const flag0Down = state.flags[0].down;
  if (flag1Down && flag0Down) {
    finishMatch(state, state.turn === 0 ? 0 : 1);
    return;
  }
  if (flag1Down) {
    finishMatch(state, 0);
    return;
  }
  if (flag0Down) {
    finishMatch(state, 1);
    return;
  }
  state.turn = 1 - state.turn;
  if (state.turn === 0) {
    state.round += 1;
    if (state.round > MAX_ROUNDS) {
      judgeByBlocks(state);
      return;
    }
    state.wind = rollWind(state.rng);
    pushEvent(state, { type: "windChange", wind: state.wind, round: state.round });
  }
  state.phase = "aim";
  pushEvent(state, { type: "turnStart", side: state.turn, round: state.round, wind: state.wind });
}

function judgeByBlocks(state) {
  const left = intactCount(state, 0);
  const right = intactCount(state, 1);
  if (left > right) finishMatch(state, 0);
  else if (right > left) finishMatch(state, 1);
  else finishMatch(state, "draw");
}

function finishMatch(state, winner) {
  state.phase = "over";
  state.winner = winner;
  pushEvent(state, { type: "matchOver", winner, round: state.round });
}

// ---------- public intents ----------

// Returns false when the intent is invalid (silent no-op per platform contract).
export function setAim(state, side, patch = {}) {
  if (state.phase !== "aim" || state.turn !== side) return false;
  const player = state.players[side];
  if (Number.isFinite(patch.angle)) player.angle = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, patch.angle));
  if (Number.isFinite(patch.power)) player.power = Math.max(MIN_POWER, Math.min(MAX_POWER, patch.power));
  if (typeof patch.weapon === "string" && state.weapons.includes(patch.weapon)) player.weapon = patch.weapon;
  return true;
}

export function fire(state) {
  if (state.phase !== "aim") return false;
  const side = state.turn;
  const player = state.players[side];
  const m = MUZZLES[side];
  const { vx, vy } = initialVelocity(state, side, player.angle, player.power, player.weapon);
  spawnShell(state, side, player.weapon, m.x, m.y, vx, vy);
  state.shotCtx = { owner: side, enemyDamage: 0, selfDamage: 0, singleDamage: 0 };
  state.phase = "flight";
  pushEvent(state, { type: "fire", side, owner: side, weapon: player.weapon, x: m.x, y: m.y, vx, vy });
  return true;
}

// One fixed physics step. UI calls stepSim(state, frameDt) which accumulates.
function stepFixed(state) {
  const profile = state.profile;
  const windAcc = state.wind * WIND_ACCEL;
  for (const shell of state.shells) {
    if (shell.dead) continue;
    const spec = WEAPON_SPECS[shell.weapon] ?? WEAPON_SPECS.stone;
    if (shell.attached) {
      shell.stickyTimer -= SIM_DT;
      if (shell.stickyTimer <= 0) {
        explodeAt(state, shell, shell.x, shell.y);
        shell.dead = true;
      }
      continue;
    }
    if (shell.pierceGrace > 0) shell.pierceGrace -= 1;
    const wasRising = shell.vy > 0;
    shell.vx += windAcc * spec.windMul * SIM_DT;
    shell.vy -= GRAVITY * spec.gravMul * SIM_DT;
    shell.x += shell.vx * SIM_DT;
    shell.y += shell.vy * SIM_DT;
    shell.t += SIM_DT;

    if (spec.split > 0 && !shell.splitDone && wasRising && shell.vy <= 0) {
      shell.splitDone = true;
      const speed = Math.hypot(shell.vx, shell.vy);
      const baseAng = Math.atan2(shell.vy, shell.vx);
      for (let k = -1; k <= 1; k += 1) {
        if (k === 0) continue;
        const ang = baseAng + k * (14 * Math.PI) / 180;
        spawnShell(state, shell.owner, shell.weapon, shell.x, shell.y, Math.cos(ang) * speed, Math.sin(ang) * speed, true);
      }
      pushEvent(state, { type: "split", x: shell.x, y: shell.y });
    }

    let hitBlockId = null;
    let hitFlagSide = null;
    for (const block of state.blocks) {
      if (shellHitsBlock(shell, block)) {
        hitBlockId = block.id;
        break;
      }
    }
    if (!hitBlockId) {
      for (const flag of state.flags) {
        if (shellHitsFlag(shell, flag)) {
          hitFlagSide = flag.side;
          break;
        }
      }
    }
    const th = terrainHeightAt(profile, shell.x);
    const terrainHit = shell.y <= th || shell.y <= GROUND;
    if (hitBlockId || hitFlagSide != null) {
      impactShell(state, shell, hitBlockId, hitFlagSide);
    } else if (terrainHit) {
      shell.y = Math.max(shell.y, GROUND);
      if (WEAPON_SPECS[shell.weapon]?.sticky > 0 && !shell.attached && shell.y > GROUND - 0.5) {
        // sticks into terrain, then detonates
        shell.attached = true;
        shell.stickyTimer = WEAPON_SPECS[shell.weapon].sticky;
        shell.vx = 0;
        shell.vy = 0;
        pushEvent(state, { type: "stick", x: shell.x, y: shell.y, owner: shell.owner });
      } else {
        explodeAt(state, shell, shell.x, Math.max(shell.y, th > 0 ? th : GROUND));
        shell.dead = true;
      }
    } else if (shell.x < -60 || shell.x > WORLD.w + 60) {
      shell.dead = true;
      pushEvent(state, { type: "outOfBounds", x: shell.x, y: shell.y });
    }
  }
  state.shells = state.shells.filter((s) => !s.dead);
}

export function stepSim(state, dt) {
  if (state.phase !== "flight") {
    state.lastEvents = [];
    return [];
  }
  state.lastEvents = [];
  state.acc += Math.min(dt, 0.25);
  let guard = 0;
  while (state.acc >= SIM_DT && guard < 12) {
    state.acc -= SIM_DT;
    guard += 1;
    stepFixed(state);
    if (state.phase !== "flight") break;
    if (state.shells.length === 0) {
      endShot(state);
      break;
    }
  }
  return state.lastEvents;
}
