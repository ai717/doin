// engine.mjs — 操场大乱斗的唯一规则权威，严格 DOM-free。
// 连续运动采用固定步长 substep（1/60），离散操作走 applyIntent。
// 合法操作永不抛错；无效意图返回 action: null；终局一律 no-op。

import { ARCADE, ENEMY_TYPES, ITEM_KINDS, LEVEL_BY_ID, LEVELS } from "./levels.mjs";
import { arcadeScore, levelScore, starsFor } from "./score.mjs";

export const FIXED_DT = 1 / 60;
export const VIEW_W = 960;
export const VIEW_H = 540;
export const WORLD_W = 1800;
export const ARENA_MIN = 78;
export const ARENA_MAX = WORLD_W - 78;
export const Z_MIN = 0.18;
export const Z_MAX = 0.92;
export const GRAVITY = 1500;
export const MAX_HP = 100;
export const CONTINUES = 3;
export const SPECIAL_COST = 10;
export const PLAYER_SPEED = 214;
export const PLAYER_DEPTH = 0.58;
export const STORY_WAVES = 3;

export const STATUS = Object.freeze({
  playing: "playing",
  cleared: "cleared",
  lost: "lost",
  continue: "continue",
});

const PLAYER_ATTACKS = {
  light: { windup: 0.05, active: 0.07, recover: 0.11, range: 60, depth: 0.18, dmg: 6, hitstop: 0.04, shake: 2, maxTargets: 1 },
  heavy: { windup: 0.13, active: 0.09, recover: 0.24, range: 76, depth: 0.19, dmg: 15, hitstop: 0.075, shake: 7, launch: "small", maxTargets: 3 },
  jump: { windup: 0.04, active: 0.22, recover: 0.12, range: 68, depth: 0.22, dmg: 10, hitstop: 0.05, shake: 4, maxTargets: 2 },
  suplex: { windup: 0.06, active: 0.09, recover: 0.3, range: 64, depth: 0.22, dmg: 20, hitstop: 0.09, shake: 8, launch: "big", maxTargets: 1 },
  special: { windup: 0.05, active: 0.18, recover: 0.26, range: 158, depth: 0.58, dmg: 40, hitstop: 0.1, shake: 12, launch: "big", maxTargets: 12, aoe: true },
};

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

function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

function between(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

function pushEvent(state, event) {
  state.events.push(event);
}

export function drainEvents(state) {
  if (!state) return [];
  const out = state.events;
  state.events = [];
  return out;
}

export function isTerminal(state) {
  return !state || state.status === STATUS.cleared || state.status === STATUS.lost;
}

export function getPlayer(state, playerId = 0) {
  return state?.players?.find((player) => player.slot === playerId) ?? null;
}

export function aliveEnemies(state) {
  return state ? state.enemies.filter((enemy) => !enemy.dead) : [];
}

function nearestPlayer(state, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const player of state.players) {
    if (player.downTimer > 0) continue;
    const distance = Math.abs(player.x - x) + Math.abs(player.z - z) * 160;
    if (distance < bestD) {
      bestD = distance;
      best = player;
    }
  }
  return best;
}

function createPlayer(slot) {
  return {
    id: slot,
    slot,
    team: "player",
    kind: "player",
    x: 300 + slot * 84,
    z: 0.68 - slot * 0.16,
    h: 0,
    vx: 0,
    vz: 0,
    vh: 0,
    facing: 1,
    hp: MAX_HP,
    maxHp: MAX_HP,
    state: "idle",
    attack: null,
    stun: 0,
    invuln: 1.2,
    combo: 0,
    comboT: 0,
    comboHits: 0,
    comboTimer: 0,
    buffer: null,
    bufferT: 0,
    special: { phase: "idle", t: 0, glow: 0 },
    grabId: null,
    grabT: 0,
    carryId: null,
    carryT: 0,
    downTimer: 0,
    ko: 0,
    walkT: 0,
    input: { mx: 0, mz: 0 },
  };
}

function createEnemy(state, kind, options = {}) {
  const base = ENEMY_TYPES[kind] ?? ENEMY_TYPES.enemy_scrapper;
  const isBoss = Boolean(base.boss);
  const progress = state.mode === "arcade"
    ? 1 + (1 - state.timeLeft / ARCADE.duration) * 0.5
    : 1 + (state.spec?.diff ?? 0);
  const hp = Math.max(1, Math.round((options.hp || base.hp) * (isBoss ? progress * 0.9 + 0.1 : progress)));
  return {
    id: state.idSeq++,
    team: "enemy",
    kind,
    nameKey: options.nameKey ?? base.nameKey,
    boss: isBoss,
    elite: Boolean(options.elite),
    x: clamp(options.x ?? 700, ARENA_MIN, ARENA_MAX),
    z: clamp(options.z ?? 0.6, Z_MIN, Z_MAX),
    h: 0,
    vx: 0,
    vz: 0,
    vh: 0,
    facing: -1,
    hp,
    maxHp: hp,
    attack: null,
    stun: options.elite ? 0.2 : 0,
    invuln: 0,
    cool: between(state.rng, 0.6, 1.4),
    spawnT: options.spawnT ?? 0.35,
    dead: false,
    removeT: 0,
    state: options.elite ? "hurt" : "idle",
    downTimer: 0,
    summoned: false,
    comboLeft: 0,
    phaseT: 0,
    walkT: 0,
    scale: base.scale ?? 1,
  };
}

function spawnEnemy(state, kind, options = {}) {
  const enemy = createEnemy(state, kind, options);
  state.enemies.push(enemy);
  return enemy;
}

function spawnWave(state, index) {
  const wave = state.spec.waves[index] ?? [];
  const points = waveSpawns(state, wave.length);
  wave.forEach((kind, i) => {
    spawnEnemy(state, kind, { ...points[i], spawnT: 0.4 });
  });
  state.waveIndex = index;
  state.waveDelay = 0;
  pushEvent(state, { type: "wave", index: index + 1, total: STORY_WAVES });
}

function waveSpawns(state, count) {
  const anchor = state.players[0]?.x ?? 360;
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const side = i % 2 === 0 ? 1 : -1;
    const offset = 300 + Math.floor(i / 2) * 96 + state.rng() * 60;
    let x = anchor + side * offset;
    if (x < ARENA_MIN + 40 || x > ARENA_MAX - 40) x = anchor - side * offset;
    points.push({
      x: clamp(x, ARENA_MIN + 16, ARENA_MAX - 16),
      z: clamp(0.3 + state.rng() * 0.55, Z_MIN, Z_MAX),
    });
  }
  return points;
}

function spawnBoss(state) {
  const headliner = state.spec.headliner;
  const anchor = state.players[0]?.x ?? 360;
  const x = clamp(anchor + 420, ARENA_MIN + 60, ARENA_MAX - 60);
  const enemy = spawnEnemy(state, headliner.kind, {
    x,
    z: 0.58,
    hp: headliner.hp || 0,
    elite: headliner.elite,
    nameKey: headliner.nameKey,
    spawnT: 0.9,
  });
  enemy.facing = enemy.x > anchor ? -1 : 1;
  state.phase = "boss";
  state.waveDelay = 0;
  pushEvent(state, { type: "boss", kind: headliner.kind, nameKey: headliner.nameKey, boss: headliner.boss });
}

function seedItems(state) {
  if (!state.spec) return;
  state.items = state.spec.items.map((item) => ({
    id: state.idSeq++,
    kind: item.kind,
    x: item.x,
    z: item.z,
    held: false,
    by: null,
  }));
}

function spawnArcadeWave(state) {
  const count = ARCADE.waveSize;
  const points = waveSpawns(state, count);
  const kinds = ARCADE.enemyKinds;
  points.forEach((point) => {
    const kind = kinds[Math.floor(state.rng() * kinds.length)];
    spawnEnemy(state, kind, { ...point, spawnT: 0.45 });
  });
  state.arcade.spawnT = 2.6;
  pushEvent(state, { type: "wave", index: 0, total: 0 });
}

export function createMatch({ mode = "story", levelId, players = 1, seed } = {}) {
  const isArcade = mode === "arcade";
  const spec = isArcade ? null : (LEVEL_BY_ID[levelId] ?? LEVELS[0]);
  const seedValue = Number.isFinite(seed) ? seed >>> 0 : (spec?.seed ?? 20261115);
  const count = isArcade ? 1 : clamp(Math.trunc(Number(players) || 1), 1, 2);
  const state = {
    mode: isArcade ? "arcade" : count > 1 ? "coop" : "story",
    levelId: spec?.id ?? "arcade",
    spec,
    seed: seedValue,
    rng: mulberry32(seedValue),
    status: STATUS.playing,
    phase: isArcade ? "arcade" : "wave",
    players: Array.from({ length: count }, (_, slot) => createPlayer(slot)),
    enemies: [],
    items: [],
    projectiles: [],
    events: [],
    waveIndex: 0,
    waveDelay: 0,
    clearTimer: 0,
    time: 0,
    timeLeft: ARCADE.duration,
    continues: isArcade ? 0 : CONTINUES,
    continuesUsed: 0,
    ko: 0,
    bossKills: 0,
    hitStop: 0,
    cameraX: 0,
    idSeq: 100,
    arcade: { spawnT: 0, bossT: ARCADE.bossEvery, diff: 0 },
    fx: { shake: 0, flash: 0 },
  };

  seedItems(state);
  if (isArcade) {
    spawnArcadeWave(state);
  } else {
    spawnWave(state, 0);
  }
  updateCamera(state);
  return state;
}

function updateCamera(state) {
  const alive = state.players.filter((player) => player.downTimer <= 0);
  const list = alive.length ? alive : state.players;
  const mid = list.reduce((sum, player) => sum + player.x, 0) / Math.max(1, list.length);
  state.cameraX = clamp(mid - VIEW_W / 2, 0, WORLD_W - VIEW_W);
}

function startPlayerAttack(state, player, type, options = {}) {
  if (player.attack || player.stun > 0) return false;
  if (type === "jump" && player.h <= 0) return false;
  const baseSpec = PLAYER_ATTACKS[type];
  if (!baseSpec) return false;
  const spec = { ...baseSpec };
  if (type === "light" && options.chain === 2) spec.launch = "small";
  player.attack = {
    type,
    phase: "windup",
    t: spec.windup,
    spec,
    dir: options.dir ?? player.facing,
    hitIds: [],
    targetId: options.targetId ?? null,
    chain: options.chain ?? 0,
  };
  pushEvent(state, { type: "swing", player: player.slot, attack: type });
  return true;
}

function playerLight(state, player) {
  if (player.h > 0) return startPlayerAttack(state, player, "jump");
  if (player.attack) {
    if (player.attack.type === "light" && player.attack.phase === "recover") {
      player.buffer = "light";
      player.bufferT = 0.2;
    }
    return false;
  }
  const chain = player.comboT > 0 ? (player.combo + 1) % 3 : 0;
  player.combo = chain;
  player.comboT = 0.68;
  return startPlayerAttack(state, player, "light", { chain });
}

function findEnemy(state, id) {
  return state.enemies.find((enemy) => enemy.id === id && !enemy.dead) ?? null;
}

function findGrabbable(state, player) {
  let best = null;
  let bestD = Infinity;
  for (const enemy of state.enemies) {
    if (enemy.dead || enemy.boss || enemy.h > 40 || enemy.state === "launched") continue;
    if (Math.abs(enemy.z - player.z) > 0.18) continue;
    const dx = enemy.x - player.x;
    if (Math.sign(dx) === -player.facing && Math.abs(dx) > 10) continue;
    const distance = Math.abs(dx);
    if (distance > 58) continue;
    const weak = enemy.stun > 0.08 || enemy.hp <= enemy.maxHp * 0.45;
    if (!weak) continue;
    if (distance < bestD) {
      bestD = distance;
      best = enemy;
    }
  }
  return best;
}

function playerHeavy(state, player) {
  if (player.attack) {
    player.buffer = "heavy";
    player.bufferT = 0.2;
    return false;
  }
  if (player.stun > 0 || player.special.phase !== "idle" || player.h > 0) return false;
  const grab = findEnemy(state, player.grabId) ?? findGrabbable(state, player);
  if (grab) {
    player.grabId = null;
    player.grabT = 0;
    if (Math.abs(grab.x - player.x) > 4) player.facing = grab.x > player.x ? 1 : -1;
    pushEvent(state, { type: "grab", player: player.slot, x: grab.x, z: grab.z });
    return startPlayerAttack(state, player, "suplex", { targetId: grab.id, dir: player.facing });
  }
  player.combo = 0;
  return startPlayerAttack(state, player, "heavy", { dir: player.facing });
}

function playerJump(state, player) {
  if (player.h > 0 || player.attack || player.stun > 0 || player.special.phase !== "idle" || player.downTimer > 0) return false;
  player.vh = 520;
  player.h = 0.01;
  pushEvent(state, { type: "jump", player: player.slot });
  return true;
}

function playerUse(state, player) {
  if (player.stun > 0 || player.attack || player.special.phase !== "idle") return false;
  if (player.carryId != null) return throwCarried(state, player);
  let best = null;
  let bestD = 52;
  for (const item of state.items) {
    if (item.held) continue;
    const distance = Math.hypot(item.x - player.x, (item.z - player.z) * 200);
    if (distance <= bestD) {
      bestD = distance;
      best = item;
    }
  }
  if (!best) return false;
  const definition = ITEM_KINDS[best.kind];
  if (!definition) return false;
  if (!definition.throwable) {
    removeItem(state, best);
    player.hp = Math.min(player.maxHp, player.hp + (definition.heal ?? 0));
    pushEvent(state, { type: "heal", player: player.slot, x: player.x, z: player.z, amount: definition.heal ?? 0 });
    return true;
  }
  best.held = true;
  best.by = player.slot;
  best.x = player.x;
  best.z = player.z;
  player.carryId = best.id;
  player.carryT = 5;
  pushEvent(state, { type: "pickup", player: player.slot, kind: best.kind });
  return true;
}

function removeItem(state, item) {
  const index = state.items.indexOf(item);
  if (index >= 0) state.items.splice(index, 1);
}

function throwCarried(state, player) {
  const item = state.items.find((entry) => entry.id === player.carryId);
  if (!item) {
    player.carryId = null;
    return false;
  }
  const definition = ITEM_KINDS[item.kind];
  spawnProjectile(state, {
    kind: item.kind,
    x: player.x + player.facing * 34,
    z: player.z,
    h: 48,
    vx: player.facing * 540,
    vh: 120,
    team: "player",
    owner: player.slot,
    dmg: definition?.dmg ?? 12,
  });
  removeItem(state, item);
  player.carryId = null;
  player.carryT = 0;
  pushEvent(state, { type: "throw", player: player.slot, x: player.x, z: player.z });
  return true;
}

function dropCarriedItem(state, player) {
  const item = state.items.find((entry) => entry.id === player.carryId);
  if (item) {
    item.held = false;
    item.by = null;
    item.x = player.x;
    item.z = player.z;
  }
  player.carryId = null;
  player.carryT = 0;
}

function playerSpecial(state, player) {
  if (player.special.phase === "charge") {
    player.special = { phase: "idle", t: 0, glow: 0 };
    pushEvent(state, { type: "specialCancel", player: player.slot });
    return true;
  }
  if (player.special.phase !== "idle" || player.attack || player.stun > 0 || player.h > 0) return false;
  if (player.hp <= SPECIAL_COST || player.downTimer > 0) return false;
  player.special = { phase: "charge", t: 0.3, glow: 0 };
  player.vx = 0;
  player.vz = 0;
  pushEvent(state, { type: "charge", player: player.slot });
  return true;
}

function releaseSpecial(state, player) {
  player.special = { phase: "idle", t: 0, glow: 0 };
  player.hp = Math.max(1, player.hp - SPECIAL_COST);
  player.invuln = Math.max(player.invuln, 0.7);
  player.comboHits = 0;
  startPlayerAttack(state, player, "special", { dir: player.facing });
  pushEvent(state, { type: "special", player: player.slot, x: player.x, z: player.z });
}

export function applyIntent(state, intent) {
  if (!state || !intent) return { state, action: null, events: [] };
  const start = state.events.length;
  if (intent.type === "input") {
    const player = getPlayer(state, intent.playerId ?? 0);
    if (player) {
      player.input.mx = clamp(Number(intent.mx) || 0, -1, 1);
      player.input.mz = clamp(Number(intent.mz) || 0, -1, 1);
      return { state, action: "input", events: state.events.slice(start) };
    }
    return { state, action: null, events: [] };
  }
  if (intent.type === "continue") {
    return resumeAfterContinue(state);
  }
  if (state.status === STATUS.continue) {
    return { state, action: null, events: state.events.slice(start) };
  }
  if (isTerminal(state)) {
    return { state, action: null, events: [] };
  }
  const player = getPlayer(state, intent.playerId ?? 0);
  if (!player || player.downTimer > 0) {
    return { state, action: null, events: [] };
  }
  let action = null;
  switch (intent.action) {
    case "light":
      action = playerLight(state, player) ? "light" : null;
      break;
    case "heavy":
      action = playerHeavy(state, player) ? "heavy" : null;
      break;
    case "jump":
      action = playerJump(state, player) ? "jump" : null;
      break;
    case "use":
      action = playerUse(state, player) ? "use" : null;
      break;
    case "special":
      action = playerSpecial(state, player) ? "special" : null;
      break;
    default:
      return { state, action: null, events: [] };
  }
  return { state, action, events: state.events.slice(start) };
}

function advanceAttack(state, fighter, dt) {
  const attack = fighter.attack;
  if (!attack) return;
  attack.t -= dt;
  let guard = 0;
  while (attack.t <= 0 && guard < 4) {
    guard += 1;
    if (attack.phase === "windup") {
      attack.phase = "active";
      attack.t += Math.max(0.0001, attack.spec.active);
      onAttackActive(state, fighter, attack);
    } else if (attack.phase === "active") {
      attack.phase = "recover";
      attack.t += Math.max(0.0001, attack.spec.recover);
    } else {
      fighter.attack = null;
      afterAttack(state, fighter, attack);
      break;
    }
  }
}

function afterAttack(state, fighter, attack) {
  if (fighter.team === "player") {
    if (fighter.buffer && fighter.bufferT > 0) {
      const next = fighter.buffer;
      fighter.buffer = null;
      fighter.bufferT = 0;
      if (next === "light") playerLight(state, fighter);
      else playerHeavy(state, fighter);
    }
    return;
  }
  if (!fighter.boss) return;
  if (attack.comboLeft > 0) {
    startEnemyAttack(state, fighter, "combo", fighter.facing, attack.comboLeft - 1);
    return;
  }
  const base = ENEMY_TYPES[fighter.kind] ?? ENEMY_TYPES.enemy_scrapper;
  fighter.cool = between(state.rng, base.cool?.[0] ?? 1.4, base.cool?.[1] ?? 2.2);
}

function inAttackRange(attacker, target, spec, dir, aoe) {
  if (!target || target.dead) return false;
  const dx = target.x - attacker.x;
  const dz = Math.abs(target.z - attacker.z);
  if (Math.abs(dx) > spec.range) return false;
  if (dz > spec.depth) return false;
  if (!aoe && dx * dir < -12) return false;
  if (target.h > 100) return false;
  return true;
}

function onAttackActive(state, fighter, attack) {
  const spec = attack.spec;
  if (fighter.team === "player") {
    const candidates = state.enemies
      .filter((enemy) => !enemy.dead && enemy.state !== "launched" && enemy.state !== "down")
      .filter((enemy) => (attack.targetId == null ? true : enemy.id === attack.targetId))
      .filter((enemy) => inAttackRange(fighter, enemy, spec, attack.dir, spec.aoe))
      .sort((a, b) => Math.abs(a.x - fighter.x) - Math.abs(b.x - fighter.x));
    let hits = 0;
    for (const enemy of candidates) {
      if (hits >= (spec.maxTargets ?? 1)) break;
      if (attack.hitIds.includes(enemy.id)) continue;
      attack.hitIds.push(enemy.id);
      hits += 1;
      damageEnemy(state, fighter, enemy, attack);
    }
    if (hits > 0) {
      pushEvent(state, { type: "impact", x: fighter.x + attack.dir * 40, z: fighter.z, h: fighter.h + 44, power: spec.dmg >= 15 ? "heavy" : "light" });
    }
    return;
  }
  if (spec.ranged) {
    spawnRangedAttack(state, fighter, attack);
    return;
  }
  const players = state.players.filter((player) => inAttackRange(fighter, player, spec, attack.dir, spec.aoe));
  for (const player of players) {
    if (attack.hitIds.includes(player.id)) continue;
    attack.hitIds.push(player.id);
    hurtPlayer(state, player, spec.dmg ?? 6, { ...attack, fromX: fighter.x });
  }
  if (players.length > 0) {
    pushEvent(state, { type: "impact", x: fighter.x + attack.dir * 34, z: fighter.z, h: 40, power: "enemy" });
  }
}

function damageEnemy(state, attacker, enemy, attack) {
  if (!enemy || enemy.dead) return;
  const spec = attack.spec ?? {};
  const player = attacker.team === "player" ? (attacker.slot != null ? attacker : getPlayer(state, 0)) : null;
  const boost = player ? 1 + Math.min(0.5, Math.max(0, player.comboHits - 2) * 0.1) : 1;
  const damage = Math.max(1, Math.round((spec.dmg ?? 6) * boost));
  enemy.hp -= damage;
  enemy.attack = null;
  const dir = attack.dir ?? (enemy.x >= (attacker.x ?? enemy.x) ? 1 : -1);
  const launch = spec.launch;

  if (enemy.boss) {
    enemy.stun = Math.max(enemy.stun, 0.18);
    enemy.vx = dir * 26;
    enemy.state = "hurt";
  } else if (launch) {
    launchEnemy(enemy, dir, launch === "big" ? 440 : 310, launch === "big" ? 280 : 205);
  } else {
    const armored = (ENEMY_TYPES[enemy.kind]?.armor ?? false) && damage < 12;
    enemy.stun = Math.max(enemy.stun, armored ? 0.06 : 0.2);
    enemy.vx = dir * (armored ? 24 : 74);
    if (!armored) enemy.state = "hurt";
  }

  if (player) {
    player.comboHits += 1;
    player.comboTimer = 2;
  }
  state.hitStop = Math.max(state.hitStop, spec.hitstop ?? 0.04);
  state.fx.shake = Math.max(state.fx.shake, spec.shake ?? 2);
  pushEvent(state, {
    type: "hit",
    x: enemy.x,
    z: enemy.z,
    h: enemy.h + 46,
    power: launch ? "heavy" : "light",
    dmg: damage,
    combo: player?.comboHits ?? 0,
  });

  if (enemy.hp <= 0) killEnemy(state, player, enemy, dir, launch === "big");
}

function damageEnemyByProjectile(state, projectile, enemy) {
  const owner = getPlayer(state, projectile.owner ?? 0);
  damageEnemy(state, owner ?? { team: "player", x: projectile.x, z: projectile.z }, enemy, {
    spec: { dmg: projectile.dmg ?? 12, launch: "small", hitstop: 0.03, shake: 3 },
    dir: Math.sign(projectile.vx) || 1,
    hitIds: [],
    type: "throw",
  });
}

function launchEnemy(enemy, dir, vx, vh) {
  enemy.state = "launched";
  enemy.vx = dir * vx;
  enemy.vz = 0;
  enemy.vh = vh;
  enemy.stun = 0;
  enemy.attack = null;
}

function killEnemy(state, player, enemy, dir, big) {
  if (enemy.dead) return;
  enemy.dead = true;
  enemy.hp = 0;
  enemy.attack = null;
  if (enemy.boss) {
    enemy.state = "down";
    enemy.vh = 260;
    enemy.vx = dir * 150;
    state.bossKills += 1;
    pushEvent(state, { type: "bossDown", x: enemy.x, z: enemy.z, kind: enemy.kind });
    if (state.mode === "arcade") {
      state.arcade.bossT = ARCADE.bossEvery;
    } else if (state.phase === "boss") {
      state.clearTimer = 1.7;
      state.projectiles = [];
      for (const other of state.enemies) {
        if (other === enemy || other.dead) continue;
        launchEnemy(other, dir, 300, 220);
        other.dead = true;
        other.hp = 0;
      }
    }
  } else {
    launchEnemy(enemy, dir, big ? 540 : 340, big ? 310 : 220);
  }
  if (player && player.team === "player") {
    player.ko += 1;
    state.ko += 1;
  } else {
    state.ko += 1;
  }
  pushEvent(state, { type: "ko", x: enemy.x, z: enemy.z, ko: state.ko, boss: enemy.boss, team: "player" });
  if (state.ko === 10) pushEvent(state, { type: "star" });
  state.fx.shake = Math.max(state.fx.shake, enemy.boss ? 14 : 6);
}

function hurtPlayer(state, player, damage, attack) {
  if (!player || player.downTimer > 0) return;
  if (player.invuln > 0) return;
  if (player.h > 62 && !attack?.spec?.aoe) return;
  const amount = Math.max(1, Math.round(damage));
  player.hp -= amount;
  player.invuln = 0.78;
  player.stun = 0.28;
  player.attack = null;
  player.special = { phase: "idle", t: 0, glow: 0 };
  player.combo = 0;
  player.comboHits = 0;
  player.buffer = null;
  player.vx = (player.x < (attack?.fromX ?? player.x) ? -1 : 1) * 200;
  state.fx.shake = Math.max(state.fx.shake, 8);
  state.fx.flash = Math.max(state.fx.flash, 0.4);
  state.hitStop = Math.max(state.hitStop, 0.05);
  pushEvent(state, { type: "hurt", player: player.slot, amount, x: player.x, z: player.z });
  if (player.hp <= 0) downPlayer(state, player);
}

function downPlayer(state, player) {
  player.hp = 0;
  player.downTimer = 5;
  player.attack = null;
  player.special = { phase: "idle", t: 0, glow: 0 };
  player.grabId = null;
  player.input.mx = 0;
  player.input.mz = 0;
  if (player.carryId != null) dropCarriedItem(state, player);
  pushEvent(state, { type: "down", player: player.slot, x: player.x, z: player.z });
  const mate = state.players.find((other) => other !== player && other.downTimer <= 0);
  if (mate) return;
  if (state.continues > 0) {
    state.status = STATUS.continue;
    pushEvent(state, { type: "continue", remaining: state.continues });
  } else {
    state.status = STATUS.lost;
    pushEvent(state, { type: "lost" });
  }
}

function revivePlayer(state, player) {
  const anchor = state.players.find((other) => other !== player && other.downTimer <= 0);
  player.hp = Math.round(player.maxHp * 0.5);
  player.downTimer = 0;
  player.invuln = 1.4;
  player.stun = 0;
  player.x = clamp((anchor?.x ?? 360) - 70, ARENA_MIN, ARENA_MAX);
  player.z = anchor?.z ?? 0.62;
  player.h = 0;
  player.vh = 0;
  pushEvent(state, { type: "revive", player: player.slot, x: player.x, z: player.z });
}

export function resumeAfterContinue(state) {
  if (!state || state.status !== STATUS.continue) return { state, action: null, events: [] };
  const start = state.events.length;
  state.continues = Math.max(0, state.continues - 1);
  state.continuesUsed += 1;
  state.status = STATUS.playing;
  state.hitStop = 0;
  state.fx.flash = 0;
  state.projectiles = [];
  for (const player of state.players) {
    player.hp = player.maxHp;
    player.downTimer = 0;
    player.invuln = 1.5;
    player.stun = 0;
    player.attack = null;
    player.special = { phase: "idle", t: 0, glow: 0 };
    player.combo = 0;
    player.comboHits = 0;
    player.h = 0;
    player.vh = 0;
    player.vx = 0;
    player.vz = 0;
    player.x = 260 + player.slot * 84;
    player.z = 0.68 - player.slot * 0.16;
  }
  if (state.mode === "arcade") {
    state.enemies = state.enemies.filter((enemy) => enemy.boss && !enemy.dead);
  } else if (state.phase === "boss") {
    state.enemies = [];
    state.clearTimer = 0;
    spawnBoss(state);
  } else {
    state.enemies = [];
    state.phase = "wave";
    spawnWave(state, state.waveIndex);
  }
  pushEvent(state, { type: "resume", remaining: state.continues });
  updateCamera(state);
  return { state, action: "continue", events: state.events.slice(start) };
}

function stepPlayer(state, player, dt) {
  player.invuln = Math.max(0, player.invuln - dt);
  player.comboTimer = Math.max(0, player.comboTimer - dt);
  if (player.comboTimer <= 0) player.comboHits = 0;
  player.bufferT = Math.max(0, player.bufferT - dt);
  if (player.bufferT <= 0) player.buffer = null;
  player.comboT = Math.max(0, player.comboT - dt);

  if (player.downTimer > 0) {
    player.downTimer -= dt;
    if (player.downTimer <= 0) revivePlayer(state, player);
    return;
  }
  if (player.special.phase === "charge") {
    player.special.t -= dt;
    player.special.glow = clamp(1 - player.special.t / 0.3, 0, 1);
    player.vx = 0;
    player.vz = 0;
    if (player.special.t <= 0) releaseSpecial(state, player);
    return;
  }
  if (player.attack) advanceAttack(state, player, dt);
  player.stun = Math.max(0, player.stun - dt);

  const input = player.input;
  const len = Math.hypot(input.mx, input.mz) || 1;
  const canMove = player.stun <= 0 && (!player.attack || player.attack.phase === "recover");
  if (canMove && (input.mx || input.mz)) {
    const speed = player.attack ? 0.45 : 1;
    player.vx = (input.mx / len) * PLAYER_SPEED * speed;
    player.vz = (input.mz / len) * PLAYER_DEPTH * speed;
    player.walkT += dt;
    if (Math.abs(input.mx) > 0.12) player.facing = input.mx > 0 ? 1 : -1;
  } else {
    const decay = Math.pow(0.02, dt);
    player.vx *= decay;
    player.vz *= decay;
    if (!input.mx && !input.mz) player.walkT = 0;
  }
  player.x = clamp(player.x + player.vx * dt, ARENA_MIN, ARENA_MAX);
  player.z = clamp(player.z + player.vz * dt, Z_MIN, Z_MAX);

  if (player.h > 0 || player.vh > 0) {
    player.h += player.vh * dt;
    player.vh -= GRAVITY * dt;
    if (player.h <= 0) {
      player.h = 0;
      player.vh = 0;
      if (player.attack && player.attack.type === "jump") player.attack = null;
      pushEvent(state, { type: "land", x: player.x, z: player.z, player: player.slot });
    }
  }

  if (player.grabT > 0) {
    player.grabT -= dt;
    if (player.grabT <= 0) player.grabId = null;
  }
  if (player.carryId != null) {
    player.carryT -= dt;
    if (player.carryT <= 0) dropCarriedItem(state, player);
  }
}

function stepEnemy(state, enemy, dt) {
  if (enemy.removeT > 0) {
    enemy.removeT -= dt;
    return;
  }
  if (enemy.spawnT > 0) {
    enemy.spawnT -= dt;
    return;
  }
  enemy.cool = Math.max(0, enemy.cool - dt);
  enemy.stun = Math.max(0, enemy.stun - dt);

  if (enemy.state === "launched") {
    enemy.x += enemy.vx * dt;
    enemy.z = clamp(enemy.z + enemy.vz * dt, Z_MIN, Z_MAX);
    enemy.h += enemy.vh * dt;
    enemy.vh -= GRAVITY * dt;
    if (enemy.h <= 0) {
      enemy.h = 0;
      enemy.vh = 0;
      enemy.vx = 0;
      pushEvent(state, { type: "land", x: enemy.x, z: enemy.z, dead: enemy.dead });
      if (enemy.dead) {
        enemy.state = "down";
        enemy.removeT = 0.55;
      } else {
        enemy.state = "hurt";
        enemy.stun = 0.5;
        enemy.x = clamp(enemy.x, ARENA_MIN, ARENA_MAX);
      }
    } else if (!enemy.dead) {
      enemy.x = clamp(enemy.x, ARENA_MIN, ARENA_MAX);
    }
    return;
  }
  if (enemy.state === "down") {
    enemy.removeT -= dt;
    return;
  }

  if (enemy.attack) {
    advanceAttack(state, enemy, dt);
    return;
  }

  if (enemy.state === "charge") {
    enemy.phaseT -= dt;
    enemy.x = clamp(enemy.x + enemy.vx * dt, ARENA_MIN, ARENA_MAX);
    for (const player of state.players) {
      if (player.downTimer > 0 || player.invuln > 0) continue;
      if (Math.abs(player.x - enemy.x) < 44 && Math.abs(player.z - enemy.z) < 0.22) {
        hurtPlayer(state, player, Math.round((ENEMY_TYPES[enemy.kind]?.dmg ?? 10) * 1.1), { fromX: enemy.x, spec: { dmg: 10 } });
        enemy.phaseT = 0;
      }
    }
    if (enemy.phaseT <= 0) {
      enemy.state = "idle";
      enemy.vx = 0;
      enemy.stun = 0.35;
      enemy.cool = between(state.rng, 1.4, 2.1);
    }
    return;
  }

  if (enemy.state === "leap") {
    enemy.x = clamp(enemy.x + enemy.vx * dt, ARENA_MIN, ARENA_MAX);
    enemy.h += enemy.vh * dt;
    enemy.vh -= GRAVITY * dt;
    if (enemy.h <= 0) {
      enemy.h = 0;
      enemy.vh = 0;
      enemy.vx = 0;
      enemy.state = "idle";
      enemy.stun = 0.3;
      state.fx.shake = Math.max(state.fx.shake, 9);
      pushEvent(state, { type: "land", x: enemy.x, z: enemy.z, slam: true });
      for (const player of state.players) {
        if (player.downTimer > 0) continue;
        if (Math.abs(player.x - enemy.x) < 120 && Math.abs(player.z - enemy.z) < 0.36) {
          hurtPlayer(state, player, Math.round((ENEMY_TYPES[enemy.kind]?.dmg ?? 10) * 1.2), { fromX: enemy.x, spec: { aoe: true } });
        }
      }
    }
    return;
  }

  if (enemy.stun > 0) {
    enemy.vx *= Math.pow(0.02, dt);
    enemy.x = clamp(enemy.x + enemy.vx * dt, ARENA_MIN, ARENA_MAX);
    return;
  }

  const target = nearestPlayer(state, enemy.x, enemy.z);
  if (!target) return;
  const dx = target.x - enemy.x;
  const dz = target.z - enemy.z;
  const distance = Math.abs(dx);
  if (distance > 6) enemy.facing = dx > 0 ? 1 : -1;

  if (enemy.boss) {
    stepBoss(state, enemy, target, distance, dz, dt);
    return;
  }

  const base = ENEMY_TYPES[enemy.kind] ?? ENEMY_TYPES.enemy_scrapper;
  if (base.ranged) {
    stepRanger(state, enemy, base, target, distance, dz, dt);
    return;
  }
  stepGrunt(state, enemy, base, target, distance, dz, dt);
}

function attackTokens(state) {
  return state.enemies.filter((enemy) => !enemy.dead && enemy.attack && enemy.attack.phase !== "recover").length;
}

function stepGrunt(state, enemy, base, target, distance, dz, dt) {
  const attackRange = base.range;
  const inRange = distance <= attackRange + 4 && Math.abs(dz) <= base.depth + 0.02;
  if (inRange && enemy.cool <= 0 && attackTokens(state) < 2) {
    startEnemyAttack(state, enemy, "swing", enemy.facing);
    return;
  }
  let speed = base.speed;
  let dirX = 0;
  let dirZ = 0;
  if (distance > attackRange * 0.86) dirX = Math.sign(target.x - enemy.x);
  else if (distance < attackRange * 0.5 && enemy.kind !== "enemy_guard") dirX = -Math.sign(target.x - enemy.x) * 0.4;
  if (Math.abs(dz) > 0.04) dirZ = Math.sign(dz);
  if (!dirX && !dirZ && enemy.cool > 0) {
    dirZ = Math.sin(state.time * 1.7 + enemy.id) > 0 ? 0.5 : -0.5;
  }
  enemy.x = clamp(enemy.x + dirX * speed * dt, ARENA_MIN, ARENA_MAX);
  enemy.z = clamp(enemy.z + dirZ * 0.34 * dt, Z_MIN, Z_MAX);
  if (dirX || dirZ) enemy.walkT += dt;
}

function stepRanger(state, enemy, base, target, distance, dz, dt) {
  const keep = base.keep ?? 210;
  if (distance > keep + 60) {
    enemy.x = clamp(enemy.x + Math.sign(target.x - enemy.x) * base.speed * dt, ARENA_MIN, ARENA_MAX);
    enemy.walkT += dt;
  } else if (distance < keep - 70) {
    enemy.x = clamp(enemy.x - Math.sign(target.x - enemy.x) * base.speed * 0.8 * dt, ARENA_MIN, ARENA_MAX);
    enemy.walkT += dt;
  }
  if (Math.abs(dz) > 0.05) enemy.z = clamp(enemy.z + Math.sign(dz) * 0.3 * dt, Z_MIN, Z_MAX);
  if (enemy.cool <= 0 && attackTokens(state) < 2 && Math.abs(dz) < 0.24) {
    startEnemyAttack(state, enemy, "ball", enemy.facing);
  }
}

function stepBoss(state, enemy, target, distance, dz, dt) {
  const base = ENEMY_TYPES[enemy.kind] ?? ENEMY_TYPES.boss_pe;
  const patterns = base.patterns ?? ["swing"];
  const close = distance <= (base.range ?? 64) + 6 && Math.abs(dz) <= (base.depth ?? 0.24) + 0.04;
  if (enemy.kind === "boss_shopkeeper" && !enemy.summoned && enemy.hp <= enemy.maxHp * 0.55) {
    enemy.summoned = true;
    summonHelp(state, enemy);
    return;
  }
  if (enemy.kind === "boss_senior" && distance > 150 && enemy.cool <= 0 && attackTokens(state) < 2) {
    startLeap(state, enemy);
    return;
  }
  if (enemy.cool <= 0 && attackTokens(state) < 2) {
    if (close) {
      const choice = enemy.kind === "boss_senior" ? "combo" : (enemy.kind === "boss_pe" ? "swing" : "sweep");
      startEnemyAttack(state, enemy, choice, enemy.facing);
      return;
    }
    if (distance > 160) {
      if (enemy.kind === "boss_pe") startCharge(state, enemy);
      else if (enemy.kind === "boss_captain") startEnemyAttack(state, enemy, "ball", enemy.facing);
      else if (enemy.kind === "boss_shopkeeper") startEnemyAttack(state, enemy, "can", enemy.facing);
      else if (enemy.kind === "boss_senior") startEnemyAttack(state, enemy, "shock", enemy.facing);
      else startEnemyAttack(state, enemy, "swing", enemy.facing);
      return;
    }
  }
  if (distance > 56) {
    enemy.x = clamp(enemy.x + Math.sign(target.x - enemy.x) * (base.speed ?? 80) * dt, ARENA_MIN, ARENA_MAX);
    enemy.walkT += dt;
  }
  if (Math.abs(dz) > 0.03) enemy.z = clamp(enemy.z + Math.sign(dz) * 0.28 * dt, Z_MIN, Z_MAX);
}

function startCharge(state, enemy) {
  enemy.state = "charge";
  enemy.phaseT = 0.52;
  enemy.vx = enemy.facing * 380;
  enemy.cool = between(state.rng, 2.2, 3.2);
  pushEvent(state, { type: "charge", enemy: true, x: enemy.x, z: enemy.z });
}

function startLeap(state, enemy) {
  enemy.state = "leap";
  enemy.vx = enemy.facing * 280;
  enemy.vh = 480;
  enemy.h = 0.01;
  enemy.cool = between(state.rng, 2.4, 3.4);
  pushEvent(state, { type: "leap", x: enemy.x, z: enemy.z });
}

function summonHelp(state, enemy) {
  const points = waveSpawns(state, 2);
  points.forEach((point) => spawnEnemy(state, "enemy_scrapper", { ...point, spawnT: 0.3 }));
  enemy.cool = 1.6;
  pushEvent(state, { type: "summon", x: enemy.x, z: enemy.z });
}

function startEnemyAttack(state, enemy, type, dir, comboLeft = 0) {
  const base = ENEMY_TYPES[enemy.kind] ?? ENEMY_TYPES.enemy_scrapper;
  let spec;
  if (type === "sweep") {
    spec = { windup: 0.5, active: 0.16, recover: 0.5, range: 112, depth: 0.34, dmg: base.dmg, hitstop: 0.05, shake: 5, maxTargets: 2 };
  } else if (type === "slam") {
    spec = { windup: 0.62, active: 0.12, recover: 0.7, range: 150, depth: 0.62, dmg: base.dmg + 2, aoe: true, hitstop: 0.08, shake: 9 };
  } else if (type === "ball") {
    spec = { windup: 0.42, active: 0.05, recover: 0.5, range: 999, depth: 1, dmg: 10, ranged: "ball" };
  } else if (type === "can") {
    spec = { windup: 0.38, active: 0.05, recover: 0.55, range: 999, depth: 1, dmg: 8, ranged: "can" };
  } else if (type === "shock") {
    spec = { windup: 0.45, active: 0.05, recover: 0.62, range: 999, depth: 1, dmg: 10, ranged: "shock" };
  } else if (type === "combo") {
    spec = { windup: 0.2, active: 0.06, recover: 0.09, range: (base.range ?? 60) + 4, depth: base.depth ?? 0.24, dmg: Math.max(4, (base.dmg ?? 8) - 2), hitstop: 0.03, shake: 3 };
  } else {
    spec = {
      windup: base.windup ?? 0.4,
      active: base.active ?? 0.1,
      recover: base.recover ?? 0.4,
      range: base.range ?? 50,
      depth: base.depth ?? 0.2,
      dmg: base.dmg ?? 6,
      hitstop: 0.05,
      shake: 3,
    };
  }
  enemy.attack = {
    type,
    phase: "windup",
    t: spec.windup,
    spec,
    dir: dir ?? enemy.facing,
    hitIds: [],
    comboLeft,
  };
  pushEvent(state, { type: "telegraph", kind: enemy.kind, boss: enemy.boss, x: enemy.x, z: enemy.z });
}

function spawnRangedAttack(state, enemy, attack) {
  const kind = attack.spec.ranged;
  const dir = attack.dir;
  if (kind === "ball") {
    spawnProjectile(state, {
      kind: "ball", x: enemy.x + dir * 30, z: enemy.z, h: 82,
      vx: dir * 330, vh: 250, team: "enemy", owner: null, enemyKind: enemy.kind,
      dmg: attack.spec.dmg, bounces: 2,
    });
  } else if (kind === "can") {
    [-0.1, 0, 0.1].forEach((offset) => {
      spawnProjectile(state, {
        kind: "can", x: enemy.x + dir * 28, z: clamp(enemy.z + offset, Z_MIN, Z_MAX), h: 70,
        vx: dir * 390, vh: 120, team: "enemy", owner: null, enemyKind: enemy.kind,
        dmg: attack.spec.dmg, bounces: 0,
      });
    });
  } else if (kind === "shock") {
    [-1, 1].forEach((side) => {
      spawnProjectile(state, {
        kind: "shock", x: enemy.x, z: enemy.z, h: 14,
        vx: side * 300, vh: 0, team: "enemy", owner: null, enemyKind: enemy.kind,
        dmg: attack.spec.dmg, bounces: 0, gravity: false,
      });
    });
  }
  pushEvent(state, { type: "throw", enemy: true, x: enemy.x, z: enemy.z });
}

function spawnProjectile(state, options) {
  state.projectiles.push({
    id: state.idSeq++,
    kind: options.kind ?? "ball",
    x: options.x,
    z: clamp(options.z ?? 0.6, Z_MIN, Z_MAX),
    h: options.h ?? 50,
    vx: options.vx ?? 0,
    vz: options.vz ?? 0,
    vh: options.vh ?? 0,
    team: options.team ?? "player",
    owner: options.owner ?? 0,
    enemyKind: options.enemyKind ?? null,
    dmg: options.dmg ?? 10,
    bounces: options.bounces ?? 0,
    gravity: options.gravity !== false,
    life: options.life ?? 2.6,
  });
}

function stepProjectiles(state, dt) {
  const keep = [];
  for (const projectile of state.projectiles) {
    projectile.life -= dt;
    projectile.x += projectile.vx * dt;
    projectile.z = clamp(projectile.z + projectile.vz * dt, Z_MIN, Z_MAX);
    if (projectile.gravity) {
      projectile.h += projectile.vh * dt;
      projectile.vh -= GRAVITY * dt;
      if (projectile.h <= 0) {
        projectile.h = 0;
        if (projectile.bounces > 0) {
          projectile.bounces -= 1;
          projectile.vh = 220;
          pushEvent(state, { type: "bounce", x: projectile.x, z: projectile.z });
        } else {
          pushEvent(state, { type: "dust", x: projectile.x, z: projectile.z });
          continue;
        }
      }
    }
    let hit = false;
    if (projectile.team === "player") {
      for (const enemy of state.enemies) {
        if (enemy.dead || enemy.spawnT > 0) continue;
        if (Math.abs(enemy.x - projectile.x) > 38) continue;
        if (Math.abs(enemy.z - projectile.z) > 0.2) continue;
        if (projectile.h > enemy.h + 92 || projectile.h < enemy.h - 8) continue;
        damageEnemyByProjectile(state, projectile, enemy);
        hit = true;
        break;
      }
    } else {
      for (const player of state.players) {
        if (player.downTimer > 0) continue;
        if (Math.abs(player.x - projectile.x) > 38) continue;
        if (Math.abs(player.z - projectile.z) > 0.2) continue;
        if (projectile.h > player.h + 92 || projectile.h < player.h - 14) continue;
        hurtPlayer(state, player, projectile.dmg, { fromX: projectile.x, spec: { dmg: projectile.dmg } });
        hit = true;
        break;
      }
    }
    if (hit || projectile.life <= 0 || projectile.x < -80 || projectile.x > WORLD_W + 80) continue;
    keep.push(projectile);
  }
  state.projectiles = keep;
}

function separateEnemies(state) {
  const list = state.enemies.filter((enemy) => !enemy.dead && enemy.state !== "launched" && enemy.spawnT <= 0);
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      if (Math.abs(a.x - b.x) > 34 || Math.abs(a.z - b.z) > 0.13) continue;
      const push = a.z <= b.z ? -1 : 1;
      a.z = clamp(a.z + push * 0.028, Z_MIN, Z_MAX);
      b.z = clamp(b.z - push * 0.028, Z_MIN, Z_MAX);
    }
  }
  for (const enemy of list) {
    for (const player of state.players) {
      if (player.downTimer > 0) continue;
      if (Math.abs(enemy.x - player.x) > 26 || Math.abs(enemy.z - player.z) > 0.045) continue;
      const push = enemy.z <= player.z ? -1 : 1;
      enemy.z = clamp(enemy.z + push * 0.05, Z_MIN, Z_MAX);
    }
  }
}

function updateWaves(state, dt) {
  if (state.phase === "wave") {
    if (aliveEnemies(state).length > 0) {
      state.waveDelay = 0;
      return;
    }
    state.waveDelay += dt;
    if (state.waveDelay >= 1.05) {
      state.waveDelay = 0;
      if (state.waveIndex < state.spec.waves.length - 1) {
        spawnWave(state, state.waveIndex + 1);
      } else {
        spawnBoss(state);
      }
    }
    return;
  }
  if (state.phase === "boss") {
    if (state.clearTimer > 0) {
      state.clearTimer -= dt;
      if (state.clearTimer <= 0) {
        state.clearTimer = 0;
        state.status = STATUS.cleared;
        pushEvent(state, { type: "clear" });
      }
      return;
    }
    // 压轴对手（含非 Boss 的小队长）倒下后留一小段击飞演出再结算。
    if (aliveEnemies(state).length === 0) state.clearTimer = 1.15;
  }
}

function updateArcade(state, dt) {
  state.timeLeft = Math.max(0, state.timeLeft - dt);
  if (state.timeLeft <= 0) {
    state.status = STATUS.cleared;
    pushEvent(state, { type: "clear" });
    return;
  }
  state.arcade.spawnT = Math.max(0, state.arcade.spawnT - dt);
  state.arcade.bossT -= dt;
  if (state.arcade.bossT <= 0) {
    state.arcade.bossT = ARCADE.bossEvery;
    const kind = ARCADE.bossKinds[Math.floor(state.rng() * ARCADE.bossKinds.length)];
    const anchor = state.players[0]?.x ?? 360;
    const enemy = spawnEnemy(state, kind, {
      x: clamp(anchor + 420, ARENA_MIN + 60, ARENA_MAX - 60),
      z: 0.58,
      spawnT: 0.9,
    });
    enemy.facing = enemy.x > anchor ? -1 : 1;
    pushEvent(state, { type: "boss", kind, nameKey: enemy.nameKey, boss: true });
    return;
  }
  if (state.arcade.spawnT <= 0 && aliveEnemies(state).length < 2) {
    spawnArcadeWave(state);
  }
}

function cleanupEnemies(state) {
  state.enemies = state.enemies.filter((enemy) => !(enemy.state === "down" && enemy.removeT <= 0 && !enemy.boss));
}

function substep(state, dt) {
  state.time += dt;
  state.fx.flash = Math.max(0, state.fx.flash - dt * 2.6);

  if (state.mode === "arcade") updateArcade(state, dt);

  for (const player of state.players) stepPlayer(state, player, dt);
  for (const enemy of state.enemies) stepEnemy(state, enemy, dt);

  stepProjectiles(state, dt);
  separateEnemies(state);
  cleanupEnemies(state);

  if (state.mode !== "arcade") updateWaves(state, dt);

  updateCamera(state);
}

export function stepFrame(state, dt = FIXED_DT) {
  if (!state) return { state, action: null, events: [] };
  if (isTerminal(state) || state.status === STATUS.continue) {
    return { state, action: null, events: [] };
  }
  const step = clamp(Number(dt) || 0, 0, 0.12);
  if (step <= 0) return { state, action: "idle", events: [] };
  const start = state.events.length;
  if (state.hitStop > 0) {
    state.hitStop = Math.max(0, state.hitStop - step);
    state.fx.shake = Math.max(0, state.fx.shake - step * 26);
    return { state, action: "hitStop", events: state.events.slice(start) };
  }
  let remaining = step;
  let guard = 0;
  while (remaining > 0.0001 && guard < 10) {
    const slice = Math.min(FIXED_DT, remaining);
    substep(state, slice);
    remaining -= slice;
    guard += 1;
    if (state.status !== STATUS.playing) break;
  }
  state.fx.shake = Math.max(0, state.fx.shake - step * 18);
  return { state, action: "step", events: state.events.slice(start) };
}

export function summarize(state) {
  if (!state) return null;
  const totalMax = state.players.reduce((sum, player) => sum + player.maxHp, 0) || 1;
  const totalHp = state.players.reduce((sum, player) => sum + Math.max(0, player.hp), 0);
  const hpRatio = totalHp / totalMax;
  const outcome = state.status === STATUS.cleared ? "clear" : state.status === STATUS.lost ? "lose" : null;
  const base = {
    outcome,
    mode: state.mode,
    ko: state.ko,
    bossKills: state.bossKills,
    time: state.time,
    hpRatio,
    continuesUsed: state.continuesUsed,
    kos: state.players.map((player) => player.ko),
  };
  if (state.mode === "arcade") {
    return {
      ...base,
      levelId: null,
      levelNum: 0,
      chapter: -1,
      stars: 0,
      par: ARCADE.duration,
      score: arcadeScore({ ko: state.ko, bossKills: state.bossKills, timeLeft: state.timeLeft }),
      timeLeft: state.timeLeft,
    };
  }
  const spec = state.spec;
  const cleared = outcome === "clear";
  return {
    ...base,
    levelId: spec.id,
    levelNum: spec.num,
    chapter: spec.chapter,
    par: spec.par,
    stars: cleared ? starsFor({ hpRatio, time: state.time, par: spec.par }) : 0,
    score: cleared
      ? levelScore({
        ko: state.ko,
        hpRatio,
        time: state.time,
        par: spec.par,
        continuesUsed: state.continuesUsed,
        bossDown: state.bossKills > 0,
      })
      : 0,
    timeLeft: 0,
  };
}
