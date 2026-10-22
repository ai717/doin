// engine.mjs — 《割草！Mow!》规则唯一权威，DOM-free。
// 固定步长 stepFrame(state, dt, input)；离散意图走 applyIntent。
// 合法操作永不抛错；无效意图返回 null；终局（won/lost）一律 no-op。
// rng 可注入（默认 mulberry32(seed)），战斗过程可重放、可单测。
// 无死局保证：① 怪物从视野外环带出生（距玩家 ≥ 420，出生 0.4s 淡入无敌）；
// ② 每 2s 逃生走廊校验，8 方向全被围时自动触发免费"花粉应急爆发"脱困；
// ③ Boss 战前全屏清场 + 满血补给。死亡只可能是走位失误，绝不可能是刷怪运气。

import {
  SCORE_CAP,
  clampScore,
  killScore,
  burstScore,
  bossScore,
  starsFor,
  bestOf,
} from "./score.mjs";

export const ARENA_W = 1280;
export const ARENA_H = 720;
export const PLAYER_R = 16;
export const COMBO_WINDOW = 0.9;
export const COMBO_MAX = 99;
export const MOW_MAX = 100;
export const BURST_RADIUS = 520;
export const EMERGENCY_RADIUS = 330;
export const INVULN_TIME = 0.8;
export const SPAWN_MIN_DIST = 420;
export const SPAWN_FADE = 0.4;
export const MAX_ENEMIES = 220;
export const WEAPON_SLOTS = 6;
export const PASSIVE_SLOTS = 6;
export const WEAPON_MAX_LEVEL = 8;
export const PASSIVE_MAX_LEVEL = 5;
export const BOSS_TIME = 450; // 7:30 园丁巨人登场
export const CHECKPOINTS = [120, 240, 360]; // 2:00 / 4:00 / 6:00 节奏检查点
export const CHARACTER_IDS = Object.freeze(["mower", "sprinkler", "ladybug", "rabbit"]);
export const MODES = Object.freeze(["standard", "endless"]);

export const PHASES = Object.freeze({
  ready: "ready",
  playing: "playing",
  paused: "paused",
  upgrading: "upgrading",
  won: "won",
  lost: "lost",
});

/* ---------------------------------------------------------------- 数据表 */

export const CHARACTERS = Object.freeze({
  mower: { name: "Mower", hp: 100, speed: 205, weapon: "blade-ring", desc: "Balanced; starts with spinning blades" },
  sprinkler: { name: "Sprinkler", hp: 85, speed: 205, weapon: "pollen-spray", fireRateMult: 1.15, damageMult: 0.85, desc: "Fast-firing; starts with pollen spray" },
  ladybug: { name: "Ladybug", hp: 72, speed: 262, weapon: "bouncy-pod", desc: "Fast & fragile; starts with bouncy pods" },
  rabbit: { name: "Saw Rabbit", hp: 115, speed: 190, weapon: "thorn-vine", damageMult: 1.3, cdMult: 1.15, desc: "Melee burst; starts with thorn vines" },
});

// 武器解锁时间（秒）：前期聚焦核心武器，后期解锁更多构筑
export const WEAPONS = Object.freeze({
  "blade-ring": { name: "Blade Ring", unlock: 0, kind: "melee", maxLevel: WEAPON_MAX_LEVEL, desc: "Orbiting blades, close-range mowing" },
  "pollen-spray": { name: "Pollen Spray", unlock: 0, kind: "projectile", maxLevel: WEAPON_MAX_LEVEL, desc: "Continuous pollen jets in move direction" },
  "bouncy-pod": { name: "Bouncy Pod", unlock: 0, kind: "projectile", maxLevel: WEAPON_MAX_LEVEL, desc: "Homing pea pods that ricochet between foes" },
  "thorn-vine": { name: "Thorn Vine", unlock: 30, kind: "zone", maxLevel: WEAPON_MAX_LEVEL, desc: "Damage vines sprout under the swarm" },
  sunbeam: { name: "Sunbeam", unlock: 60, kind: "beam", maxLevel: WEAPON_MAX_LEVEL, desc: "Auto-aims the nearest target with a beam" },
  "ladybug-strike": { name: "Ladybug Strike", unlock: 90, kind: "aoe", maxLevel: WEAPON_MAX_LEVEL, desc: "Dive-bombs the densest cluster" },
  "bee-swarm": { name: "Bee Swarm", unlock: 120, kind: "swarm", maxLevel: WEAPON_MAX_LEVEL, desc: "Orbiting bees sting nearby enemies" },
  "dandelion-bomb": { name: "Dandelion Bomb", unlock: 150, kind: "bomb", maxLevel: WEAPON_MAX_LEVEL, desc: "Charges then explodes over a wide area" },
});

// 进化超武（武器满级 + 对应被动 ≥1 级 + 拾取进化宝箱）
export const EVOLUTIONS = Object.freeze({
  "gold-disk": { name: "Golden Disk", base: "blade-ring", passive: "steel-disk", desc: "Huge golden disk sweeps half the field; kills heal" },
  "toxic-mist": { name: "Toxic Mist", base: "pollen-spray", passive: "herbicide", desc: "Toxic mist corrodes and slows enemies" },
  "harvest-rain": { name: "Harvest Rain", base: "bouncy-pod", passive: "clover", desc: "Pods rain from the sky" },
  "rainbow-bloom": { name: "Rainbow Bloom", base: "sunbeam", passive: "windbell", desc: "Twin beams with crit chance" },
  maneater: { name: "Man-Eater", base: "thorn-vine", passive: "compost", desc: "Man-eater flowers drag and devour swarms" },
  "ladybug-queen": { name: "Ladybug Queen", base: "ladybug-strike", passive: "flowerpot", desc: "The Queen bombs wide areas frequently" },
});

export const PASSIVES = Object.freeze({
  magnet: { name: "Nectar Magnet", maxLevel: PASSIVE_MAX_LEVEL, desc: "Wider nectar pickup range" },
  herbicide: { name: "Herbicide", maxLevel: PASSIVE_MAX_LEVEL, desc: "Increases damage" },
  windbell: { name: "Wind Bell", maxLevel: PASSIVE_MAX_LEVEL, desc: "Increases move speed" },
  flowerpot: { name: "Flower Pot", maxLevel: PASSIVE_MAX_LEVEL, desc: "Increases max HP" },
  compost: { name: "Compost", maxLevel: PASSIVE_MAX_LEVEL, desc: "Increases XP gain" },
  "steel-disk": { name: "Steel Disk", maxLevel: PASSIVE_MAX_LEVEL, desc: "Shortens weapon cooldowns" },
  clover: { name: "Lucky Clover", maxLevel: PASSIVE_MAX_LEVEL, desc: "Increases drop luck" },
  thorn: { name: "Rose Thorn", maxLevel: PASSIVE_MAX_LEVEL, desc: "Reflects damage and reduces hits" },
});

export const ENEMIES = Object.freeze({
  caterpillar: { name: "Caterpillar", hp: 10, speed: 58, dmg: 1, r: 12, xp: 1, unlock: 0 },
  beetle: { name: "Beetle", hp: 18, speed: 78, dmg: 1, r: 14, xp: 2, unlock: 40 },
  wasp: { name: "Wasp", hp: 8, speed: 132, dmg: 1, r: 9, xp: 2, unlock: 90 },
  toadstool: { name: "Toadstool", hp: 42, speed: 34, dmg: 1, r: 16, xp: 4, unlock: 150, explode: true },
  thornball: { name: "Thorn Ball", hp: 24, speed: 96, dmg: 1, r: 13, xp: 3, unlock: 210, bounce: true },
  elite: { name: "Giant Beetle", hp: 260, speed: 52, dmg: 2, r: 26, xp: 25, unlock: 270, elite: true },
});

/* ---------------------------------------------------------------- 工具 */

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

/* ---------------------------------------------------------------- 构造 */

function computeStats(state) {
  const c = CHARACTERS[state.character];
  let speed = c.speed;
  let damageMult = c.damageMult ?? 1;
  let cdMult = c.cdMult ?? 1;
  const fireRateMult = c.fireRateMult ?? 1;
  let pickupRange = 92;
  let maxHp = c.hp;
  let xpMult = 1;
  let luck = 0;
  let armor = 0;
  let reflect = 0;
  for (const p of state.passives) {
    const lv = p.level;
    if (p.id === "magnet") pickupRange = 92 * (1 + 0.4 * lv);
    else if (p.id === "herbicide") damageMult *= 1 + 0.12 * lv;
    else if (p.id === "windbell") speed *= 1 + 0.08 * lv;
    else if (p.id === "flowerpot") maxHp += 25 * lv;
    else if (p.id === "compost") xpMult *= 1 + 0.15 * lv;
    else if (p.id === "steel-disk") cdMult *= 1 - 0.08 * lv;
    else if (p.id === "clover") luck += 0.15 * lv;
    else if (p.id === "thorn") {
      armor += lv;
      reflect += 8 * lv;
    }
  }
  return { speed, damageMult, cdMult, fireRateMult, pickupRange, maxHp, xpMult, luck, armor, reflect };
}

export function xpForLevel(level) {
  return Math.round(18 * Math.pow(1.13, level));
}

function makeWeapon(id) {
  return { id, level: 1, evolved: false, cd: 0, aux: { angle: Math.random() * Math.PI * 2, tick: 0, charge: 0 } };
}

export function createGame(options = {}) {
  const mode = MODES.includes(options.mode) ? options.mode : "standard";
  const character = CHARACTER_IDS.includes(options.character) ? options.character : "mower";
  const seed = Number.isFinite(options.seed) ? options.seed >>> 0 : hashSeed(`${mode}:${character}:${Date.now()}`);
  const player = { x: ARENA_W / 2, y: ARENA_H / 2, hp: 0, maxHp: 0, speed: 0, aimX: 0, aimY: -1, invuln: 0, burstCd: 0 };
  const state = {
    mode,
    character,
    seed,
    rng: options.rng ?? mulberry32(seed),
    phase: PHASES.ready,
    time: 0,
    level: 0,
    xp: 0,
    xpNext: xpForLevel(0),
    player,
    weapons: [],
    passives: [],
    projectiles: [],
    enemies: [],
    drops: [],
    vines: [],
    boss: null,
    spawnT: 1.0,
    eliteT: 34,
    escapeT: 2.0,
    emergencyCd: 0,
    combo: 0,
    comboTimer: 0,
    mow: 0,
    mowReady: false,
    scoreMult: 1,
    scoreMultT: 0,
    score: 0,
    kills: 0,
    maxCombo: 0,
    burstCount: 0,
    codex: { weapons: [], passives: [], evolutions: [] },
    choices: null,
    events: [],
    lastResult: null,
    bossSpawned: false,
    checkpointsDone: new Set(),
    stats: computeStats({ character, passives: [] }),
  };
  player.maxHp = CHARACTERS[character].hp;
  player.hp = player.maxHp;
  player.speed = CHARACTERS[character].speed;
  const w = makeWeapon(CHARACTERS[character].weapon);
  state.weapons.push(w);
  state.codex.weapons.push(w.id);
  pushEvent(state, { type: "init", mode, character });
  return state;
}

function recomputePlayer(state) {
  const s = computeStats(state);
  const oldMax = state.player.maxHp;
  state.player.maxHp = s.maxHp;
  state.player.speed = s.speed;
  if (s.maxHp > oldMax) state.player.hp += s.maxHp - oldMax;
  state.player.hp = clamp(state.player.hp, 0, s.maxHp);
  state.stats = s;
}

/* ------------------------------------------------------------ 离散意图 */

/**
 * 离散意图：start（开局）/ pause / resume / burst（花粉爆发）/ choose（升级三选一）。
 * 无效意图返回 null，绝不抛错；终局一律 no-op。
 */
export function applyIntent(state, intent, payload) {
  if (!state || typeof intent !== "string") return null;
  if (intent === "start") {
    if (state.phase !== PHASES.ready) return null;
    state.phase = PHASES.playing;
    pushEvent(state, { type: "runStart" });
    return "start";
  }
  if (intent === "pause") {
    if (state.phase !== PHASES.playing) return null;
    state.phase = PHASES.paused;
    pushEvent(state, { type: "pause" });
    return "pause";
  }
  if (intent === "resume") {
    if (state.phase !== PHASES.paused) return null;
    state.phase = PHASES.playing;
    pushEvent(state, { type: "resume" });
    return "resume";
  }
  if (intent === "burst") {
    if (state.phase !== PHASES.playing) return null;
    if (state.mow < MOW_MAX) return null;
    if (state.player.burstCd > 0) return null;
    triggerBurst(state, false);
    return "burst";
  }
  if (intent === "choose") {
    if (state.phase !== PHASES.upgrading) return null;
    const i = Number(payload);
    const choice = state.choices && state.choices[i];
    if (!choice) return null;
    applyChoice(state, choice);
    state.choices = null;
    state.phase = PHASES.playing;
    return "choose";
  }
  return null;
}

function applyChoice(state, choice) {
  if (choice.kind === "xp") {
    state.xp += choice.value;
    pushEvent(state, { type: "pickup", kind: "nectar" });
  } else if (choice.kind === "weapon") {
    const owned = state.weapons.find((w) => w.id === choice.id);
    if (owned) {
      owned.level = Math.min(WEAPON_MAX_LEVEL, owned.level + 1);
    } else if (state.weapons.length < WEAPON_SLOTS) {
      state.weapons.push(makeWeapon(choice.id));
      if (!state.codex.weapons.includes(choice.id)) state.codex.weapons.push(choice.id);
    }
  } else if (choice.kind === "passive") {
    const owned = state.passives.find((p) => p.id === choice.id);
    if (owned) {
      owned.level = Math.min(PASSIVE_MAX_LEVEL, owned.level + 1);
    } else if (state.passives.length < PASSIVE_SLOTS) {
      state.passives.push({ id: choice.id, level: 1 });
      if (!state.codex.passives.includes(choice.id)) state.codex.passives.push(choice.id);
    }
  }
  recomputePlayer(state);
}

/* ------------------------------------------------------------ 推进 */

export function stepFrame(state, dt, input = {}) {
  if (!state) return state;
  const step = clamp(Number(dt) || 0, 0, 1 / 20);
  if (step <= 0) return state;
  if (state.phase !== PHASES.playing) return state; // 暂停/升级/终局 no-op

  state.time += step;

  tickPlayer(state, step, input);
  tickCombo(state, step);
  tickScoreMult(state, step);
  updateWeapons(state, step);
  updateProjectiles(state, step);
  updateVines(state, step);
  updateDrops(state, step);
  spawnDirector(state, step);
  updateEnemies(state, step);
  updateBoss(state, step);
  checkLevelUp(state);
  checkCheckpoints(state);
  checkEscapeCorridor(state, step);
  return state;
}

function tickPlayer(state, dt, input) {
  const p = state.player;
  if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
  if (p.burstCd > 0) p.burstCd = Math.max(0, p.burstCd - dt);
  const dx = clamp(Number(input.dx) || 0, -1, 1);
  const dy = clamp(Number(input.dy) || 0, -1, 1);
  const len = Math.hypot(dx, dy);
  if (len > 0.01) {
    const nx = dx / len;
    const ny = dy / len;
    // 简易惯性：直接目标速度，走位跟手（保留轻微加速度手感）
    p.x = clamp(p.x + nx * p.speed * dt, 26, ARENA_W - 26);
    p.y = clamp(p.y + ny * p.speed * dt, 26, ARENA_H - 26);
    p.aimX = nx;
    p.aimY = ny;
  }
  if (input.burst) applyIntent(state, "burst");
}

function tickCombo(state, dt) {
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) {
      state.combo = 0;
      state.comboTimer = 0;
    }
  }
}

function tickScoreMult(state, dt) {
  if (state.scoreMultT > 0) {
    state.scoreMultT -= dt;
    if (state.scoreMultT <= 0) state.scoreMult = 1;
  }
}

/* ------------------------------------------------------------ 武器 */

function weaponDamage(state, w, base) {
  let dmg = base * state.stats.damageMult;
  if (w.id === "rainbow-bloom" && state.rng() < 0.25) dmg *= 2; // 暴击
  return dmg;
}

function updateWeapons(state, dt) {
  const p = state.player;
  for (const w of state.weapons) {
    const cdRate = w.evolved ? 1 : state.stats.cdMult;
    if (w.cd > 0) w.cd -= dt * cdRate;
    const id = w.id;
    if (id === "blade-ring" || id === "gold-disk") updateBladeRing(state, w, dt);
    else if (id === "pollen-spray" || id === "toxic-mist") updatePollen(state, w, dt);
    else if (id === "bouncy-pod" || id === "harvest-rain") updatePod(state, w, dt);
    else if (id === "sunbeam" || id === "rainbow-bloom") updateBeam(state, w, dt);
    else if (id === "thorn-vine" || id === "maneater") updateVine(state, w, dt);
    else if (id === "ladybug-strike" || id === "ladybug-queen") updateLadybug(state, w, dt);
    else if (id === "bee-swarm") updateBee(state, w, dt);
    else if (id === "dandelion-bomb") updateBomb(state, w, dt);
  }
}

function bladeParams(w) {
  if (w.evolved) return { count: 6, radius: 148, tick: 0.2, dmg: 26, speed: 3.4 };
  const lv = w.level;
  return { count: 1 + Math.floor(lv / 2), radius: 76 + lv * 5, tick: Math.max(0.16, 0.3 - lv * 0.012), dmg: 6 + lv * 3, speed: 2.6 + lv * 0.1 };
}

function updateBladeRing(state, w, dt) {
  const par = bladeParams(w);
  w.aux.angle += par.speed * dt;
  w.aux.tick -= dt;
  if (w.aux.tick > 0) return;
  w.aux.tick = par.tick;
  const dmg = weaponDamage(state, w, par.dmg) * (w.evolved ? 1.5 : 1);
  for (const e of state.enemies) {
    if (!e.alive || e.spawnT > 0) continue;
    const dx = e.x - state.player.x;
    const dy = e.y - state.player.y;
    if (dx * dx + dy * dy <= (par.radius + e.r) * (par.radius + e.r)) {
      damageEnemy(state, e, dmg, w);
    }
  }
  hurtBoss(state, state.player.x, state.player.y, par.radius, dmg);
}

function updatePollen(state, w, dt) {
  if (w.cd > 0) return;
  const evolved = w.id === "toxic-mist";
  const lv = w.level;
  w.cd = evolved ? 0.09 : Math.max(0.1, 0.34 - lv * 0.025);
  const count = evolved ? 4 : 1 + Math.floor(lv / 3);
  const spread = evolved ? 0.5 : 0.34;
  const dmg = weaponDamage(state, w, evolved ? 6 : 4 + lv * 2);
  const speed = 430;
  const base = Math.atan2(state.player.aimY, state.player.aimX);
  for (let i = 0; i < count; i += 1) {
    const off = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread;
    const a = base + off;
    spawnProjectile(state, {
      kind: evolved ? "mist" : "pollen",
      x: state.player.x + Math.cos(a) * 26,
      y: state.player.y + Math.sin(a) * 26,
      vx: Math.cos(a) * speed + state.player.aimX * 60,
      vy: Math.sin(a) * speed + state.player.aimY * 60,
      life: 0.75,
      r: evolved ? 13 : 8,
      dmg,
      from: w.id,
    });
  }
}

function updatePod(state, w, dt) {
  if (w.cd > 0) return;
  if (w.id === "harvest-rain") {
    w.cd = 1.3;
    // 天空豆荚雨：随机落在敌人聚集处
    for (let i = 0; i < 5; i += 1) {
      const target = pickCluster(state, 160);
      if (!target) break;
      const dmg = weaponDamage(state, w, 12);
      spawnProjectile(state, {
        kind: "podrain",
        x: target.x + (state.rng() - 0.5) * 120,
        y: target.y + (state.rng() - 0.5) * 120,
        vx: 0,
        vy: 0,
        life: 0.9,
        r: 0,
        dmg,
        from: w.id,
        aoe: 64,
      });
    }
    return;
  }
  w.cd = Math.max(0.28, 0.8 - w.level * 0.05);
  const target = nearestEnemy(state, state.player.x, state.player.y, 640);
  if (!target) return;
  const dmg = weaponDamage(state, w, 8 + w.level * 3);
  const speed = 520;
  const a = Math.atan2(target.y - state.player.y, target.x - state.player.x);
  spawnProjectile(state, {
    kind: "pod",
    x: state.player.x,
    y: state.player.y,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    life: 1.6,
    r: 9,
    dmg,
    from: w.id,
    bounces: 1 + Math.floor(w.level / 2),
  });
}

function updateBeam(state, w, dt) {
  const evolved = w.id === "rainbow-bloom";
  const range = evolved ? 460 : 380;
  const dps = weaponDamage(state, w, evolved ? 40 : 10 + w.level * 4);
  const beams = evolved ? 2 : 1 + (w.level >= 4 ? 1 : 0);
  const targets = [];
  for (const e of state.enemies) {
    if (!e.alive || e.spawnT > 0) continue;
    const dx = e.x - state.player.x;
    const dy = e.y - state.player.y;
    if (dx * dx + dy * dy <= range * range) targets.push(e);
  }
  targets.sort((a, b) => {
    const da = (a.x - state.player.x) ** 2 + (a.y - state.player.y) ** 2;
    const db = (b.x - state.player.x) ** 2 + (b.y - state.player.y) ** 2;
    return da - db;
  });
  for (let i = 0; i < Math.min(beams, targets.length); i += 1) {
    damageEnemy(state, targets[i], dps * dt, w);
  }
  // 光束同样可以灼烧 Boss
  const boss = state.boss;
  if (boss && boss.hp > 0) {
    const dbx = boss.x - state.player.x;
    const dby = boss.y - state.player.y;
    if (dbx * dbx + dby * dby <= range * range) damageBoss(state, dps * dt);
  }
  w.aux.tick = (w.aux.tick ?? 0) + dt;
}

function vineParams(w) {
  if (w.id === "maneater") return { cd: 2.0, count: 4, r: 88, dur: 3.0, tickDmg: 26, pull: true };
  const lv = w.level;
  return { cd: Math.max(1.6, 3.2 - lv * 0.2), count: 1 + Math.floor(lv / 2), r: 70 + lv * 6, dur: 2.5, tickDmg: 7 + lv * 3, pull: false };
}

function updateVine(state, w, dt) {
  if (w.cd > 0) return;
  const par = vineParams(w);
  w.cd = par.cd;
  const spots = [];
  const pool = [...state.enemies.filter((e) => e.alive && e.spawnT <= 0)];
  for (let i = 0; i < par.count && pool.length; i += 1) {
    const e = pool.splice(Math.floor(state.rng() * pool.length), 1)[0];
    spots.push({ x: e.x, y: e.y });
  }
  if (!spots.length) return;
  for (const s of spots) {
    state.vines.push({ x: s.x, y: s.y, r: par.r, t: par.dur, maxT: par.dur, tick: 0, dmg: weaponDamage(state, w, par.tickDmg), pull: par.pull, from: w.id });
  }
}

function updateVines(state, dt) {
  for (const v of state.vines) {
    v.t -= dt;
    v.tick -= dt;
    if (v.tick <= 0) {
      v.tick = 0.3;
      for (const e of state.enemies) {
        if (!e.alive || e.spawnT > 0) continue;
        const dx = e.x - v.x;
        const dy = e.y - v.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= (v.r + e.r) * (v.r + e.r)) {
          damageEnemy(state, e, v.dmg, { id: v.from });
          if (v.pull) {
            const d = Math.hypot(dx, dy) || 1;
            e.x += (dx / d) * 70 * 0.3;
            e.y += (dy / d) * 70 * 0.3;
          }
        }
      }
      hurtBoss(state, v.x, v.y, v.r, v.dmg);
    }
  }
  state.vines = state.vines.filter((v) => v.t > 0);
}

function updateLadybug(state, w, dt) {
  if (w.cd > 0) return;
  const evolved = w.id === "ladybug-queen";
  w.cd = evolved ? 2.2 : Math.max(2.4, 4.5 - w.level * 0.3);
  const cluster = pickCluster(state, evolved ? 190 : 110);
  if (!cluster) return;
  const dmg = weaponDamage(state, w, evolved ? 40 : 18 + w.level * 5);
  const r = evolved ? 170 : 90 + w.level * 8;
  pushEvent(state, { type: "strike", x: cluster.x, y: cluster.y, r });
  for (const e of state.enemies) {
    if (!e.alive || e.spawnT > 0) continue;
    const dx = e.x - cluster.x;
    const dy = e.y - cluster.y;
    if (dx * dx + dy * dy <= (r + e.r) * (r + e.r)) damageEnemy(state, e, dmg, w);
  }
  hurtBoss(state, cluster.x, cluster.y, r, dmg);
}

function updateBee(state, w, dt) {
  w.aux.angle = (w.aux.angle ?? 0) + dt * 2.2;
  w.aux.tick -= dt;
  if (w.aux.tick > 0) return;
  w.aux.tick = 0.45;
  const target = nearestEnemy(state, state.player.x, state.player.y, 300);
  const dmg = weaponDamage(state, w, 4 + w.level * 2);
  if (target) {
    damageEnemy(state, target, dmg, w);
  } else {
    hurtBoss(state, state.player.x, state.player.y, 300, dmg);
  }
}

function updateBomb(state, w, dt) {
  if (w.cd > 0) return;
  w.aux.charge += dt;
  const chargeNeed = 1.6;
  if (w.aux.charge < chargeNeed) return;
  w.aux.charge = 0;
  w.cd = 5.0;
  const cluster = pickCluster(state, 200, 640);
  if (!cluster) return;
  const dmg = weaponDamage(state, w, 40 + w.level * 10);
  const r = 120 + w.level * 10;
  pushEvent(state, { type: "bomb", x: cluster.x, y: cluster.y, r });
  for (const e of state.enemies) {
    if (!e.alive || e.spawnT > 0) continue;
    const dx = e.x - cluster.x;
    const dy = e.y - cluster.y;
    if (dx * dx + dy * dy <= (r + e.r) * (r + e.r)) damageEnemy(state, e, dmg, w);
  }
  hurtBoss(state, cluster.x, cluster.y, r, dmg);
}

/* ------------------------------------------------------------ 投射物 */

function spawnProjectile(state, proj) {
  state.projectiles.push(proj);
}

function updateProjectiles(state, dt) {
  const p = state.player;
  for (const proj of state.projectiles) {
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;
    proj.life -= dt;
    if (proj.life <= 0 || proj.x < -60 || proj.x > ARENA_W + 60 || proj.y < -60 || proj.y > ARENA_H + 60) {
      proj.dead = true;
      continue;
    }
    if (proj.kind === "water") {
      // 敌方水弹：命中玩家
      if (p.invuln <= 0) {
        const dx = proj.x - p.x;
        const dy = proj.y - p.y;
        if (dx * dx + dy * dy <= (PLAYER_R + proj.r) * (PLAYER_R + proj.r)) {
          proj.dead = true;
          damagePlayer(state, proj.dmg, "water");
        }
      }
      continue;
    }
    // 玩家投射物：命中敌人
    for (const e of state.enemies) {
      if (!e.alive || e.spawnT > 0) continue;
      const dx = proj.x - e.x;
      const dy = proj.y - e.y;
      const rr = (proj.r + e.r) * (proj.r + e.r);
      if (dx * dx + dy * dy <= rr) {
        damageEnemy(state, e, proj.dmg, { id: proj.from });
        if (proj.aoe) {
          for (const o of state.enemies) {
            if (!o.alive || o.spawnT > 0 || o === e) continue;
            const ox = o.x - proj.x;
            const oy = o.y - proj.y;
            if (ox * ox + oy * oy <= (proj.aoe + o.r) * (proj.aoe + o.r)) damageEnemy(state, o, proj.dmg * 0.6, { id: proj.from });
          }
        }
        if (proj.kind === "pod") {
          // 弹跳：重新索敌
          const target = nearestEnemy(state, e.x, e.y, 320, e);
          if (target && proj.bounces > 0) {
            proj.bounces -= 1;
            const a = Math.atan2(target.y - e.y, target.x - e.x);
            proj.x = e.x;
            proj.y = e.y;
            proj.vx = Math.cos(a) * 520;
            proj.vy = Math.sin(a) * 520;
            proj.r = Math.max(5, proj.r - 1);
          } else {
            proj.dead = true;
          }
        } else {
          proj.dead = true;
        }
        break;
      }
    }
    if (!proj.dead && proj.kind !== "water") {
      hurtBoss(state, proj.x, proj.y, proj.r, proj.dmg);
      if (state.boss && state.boss.hp <= 0) proj.dead = true;
      if (proj.kind === "pod") {
        const boss = state.boss;
        if (boss && boss.hp > 0) {
          const dx = proj.x - boss.x;
          const dy = proj.y - boss.y;
          const rr = (proj.r + boss.r) * (proj.r + boss.r);
          if (dx * dx + dy * dy <= rr) {
            const target = nearestEnemy(state, boss.x, boss.y, 320);
            if (target && proj.bounces > 0) {
              proj.bounces -= 1;
              const a = Math.atan2(target.y - boss.y, target.x - boss.x);
              proj.x = boss.x;
              proj.y = boss.y;
              proj.vx = Math.cos(a) * 520;
              proj.vy = Math.sin(a) * 520;
              proj.r = Math.max(5, proj.r - 1);
            } else {
              proj.dead = true;
            }
          }
        }
      }
    }
  }
  state.projectiles = state.projectiles.filter((pr) => !pr.dead);
}

/* ------------------------------------------------------------ 掉落与升级 */

function dropLoot(state, e, kind) {
  if (state.drops.length > 420) return;
  if (kind === "chest") {
    state.drops.push({ kind: "chest", x: e.x, y: e.y, life: 14, vx: (state.rng() - 0.5) * 60, vy: (state.rng() - 0.5) * 60 });
  } else {
    const xp = e.xp;
    state.drops.push({ kind: "nectar", x: e.x + (state.rng() - 0.5) * 22, y: e.y + (state.rng() - 0.5) * 22, xp, life: 10, vx: 0, vy: 0 });
    if (state.rng() < 0.06 + state.stats.luck * 0.3) {
      state.drops.push({ kind: "rose", x: e.x, y: e.y, life: 12, vx: 0, vy: 0 });
    }
    if (state.rng() < 0.03 + state.stats.luck * 0.2) {
      state.drops.push({ kind: "clover", x: e.x, y: e.y, life: 12, vx: 0, vy: 0 });
    }
  }
}

function updateDrops(state, dt) {
  const p = state.player;
  const range = state.stats.pickupRange;
  for (const d of state.drops) {
    d.life -= dt;
    const dx = p.x - d.x;
    const dy = p.y - d.y;
    const dist = Math.hypot(dx, dy);
    if (d.kind !== "chest" && dist < range) {
      // 磁吸
      const pull = 640 * (1 - Math.min(1, dist / range) * 0.6);
      d.x += (dx / (dist || 1)) * pull * dt;
      d.y += (dy / (dist || 1)) * pull * dt;
    } else if (d.kind === "chest") {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
    }
    if (dist < 24) {
      d.dead = true;
      collectDrop(state, d);
    }
  }
  state.drops = state.drops.filter((d) => !d.dead && d.life > 0);
}

function collectDrop(state, d) {
  const p = state.player;
  if (d.kind === "nectar") {
    state.xp += Math.max(1, Math.round(d.xp * state.stats.xpMult));
    pushEvent(state, { type: "pickup", kind: "nectar" });
  } else if (d.kind === "rose") {
    p.hp = Math.min(p.maxHp, p.hp + 15);
    pushEvent(state, { type: "pickup", kind: "rose" });
  } else if (d.kind === "clover") {
    state.score = clampScore(state.score + 50);
    pushEvent(state, { type: "pickup", kind: "clover" });
  } else if (d.kind === "chest") {
    const evolved = tryEvolve(state);
    if (evolved) {
      pushEvent(state, { type: "evolve", weapon: evolved.evolvedId });
    } else {
      state.xp += 40;
      pushEvent(state, { type: "pickup", kind: "chest" });
    }
  }
}

function tryEvolve(state) {
  for (const evolvedId of Object.keys(EVOLUTIONS)) {
    const recipe = EVOLUTIONS[evolvedId];
    const weapon = state.weapons.find((w) => !w.evolved && w.id === recipe.base);
    if (!weapon || weapon.level < WEAPON_MAX_LEVEL) continue;
    const passive = state.passives.find((p) => p.id === recipe.passive);
    if (!passive || passive.level < 1) continue;
    weapon.id = evolvedId;
    weapon.evolved = true;
    weapon.level = 1;
    weapon.cd = 0;
    weapon.aux = { angle: Math.random() * Math.PI * 2, tick: 0, charge: 0 };
    if (!state.codex.evolutions.includes(evolvedId)) state.codex.evolutions.push(evolvedId);
    return { evolvedId, base: recipe.base };
  }
  return null;
}

function checkLevelUp(state) {
  while (state.xp >= state.xpNext && state.phase === PHASES.playing) {
    state.xp -= state.xpNext;
    state.level += 1;
    state.xpNext = xpForLevel(state.level);
    state.choices = rollChoices(state);
    state.phase = PHASES.upgrading;
    pushEvent(state, { type: "levelUp", level: state.level, choices: state.choices });
  }
}

function rollChoices(state) {
  const candidates = [];
  const now = state.time;
  const pushWeapon = (id, w) => candidates.push({ kind: "weapon", id, name: WEAPONS[id].name, level: w ? w.level + 1 : 1, weight: 3 });
  for (const id of Object.keys(WEAPONS)) {
    const meta = WEAPONS[id];
    if (meta.unlock > now) continue;
    const owned = state.weapons.find((w) => w.id === id && !w.evolved);
    if (owned) {
      if (owned.level < WEAPON_MAX_LEVEL) pushWeapon(id, owned);
    } else if (state.weapons.length < WEAPON_SLOTS) {
      pushWeapon(id, null);
    }
  }
  for (const id of Object.keys(PASSIVES)) {
    const owned = state.passives.find((p) => p.id === id);
    if (owned) {
      if (owned.level < PASSIVE_MAX_LEVEL) candidates.push({ kind: "passive", id, name: PASSIVES[id].name, level: owned.level + 1, weight: 2 });
    } else if (state.passives.length < PASSIVE_SLOTS) {
      candidates.push({ kind: "passive", id, name: PASSIVES[id].name, level: 1, weight: 3 });
    }
  }
  const picks = [];
  const pool = [...candidates];
  while (picks.length < 3 && pool.length) {
    const total = pool.reduce((s, c) => s + c.weight, 0);
    let roll = state.rng() * total;
    let idx = 0;
    for (let i = 0; i < pool.length; i += 1) {
      roll -= pool[i].weight;
      if (roll <= 0) {
        idx = i;
        break;
      }
    }
    picks.push(pool.splice(idx, 1)[0]);
  }
  while (picks.length < 3) {
    // 兜底：必出可用项——补"经验补给"
    picks.push({ kind: "xp", name: "XP Vial", value: 30, weight: 0 });
  }
  return picks;
}

/* ------------------------------------------------------------ 怪物调度 */

function enemyHpScale(state) {
  return state.mode === "endless" ? 1 + (state.time / 60) * 0.18 : 1 + (state.time / 480) * 1.2;
}

function spawnIntervalFor(state) {
  const t = state.time;
  const k = state.mode === "endless" ? Math.min(1, t / 900) : Math.min(1, t / 480);
  return 0.3 - k * 0.17; // 0.30s → 0.13s：割草密度随时间拉满
}

function unlockedEnemies(state) {
  const list = [];
  for (const id of Object.keys(ENEMIES)) {
    const meta = ENEMIES[id];
    if (meta.unlock <= state.time && id !== "elite") list.push(id);
  }
  return list;
}

function spawnDirector(state, dt) {
  const cap = MAX_ENEMIES;
  state.spawnT -= dt;
  if (state.spawnT <= 0 && state.enemies.length < cap && !state.boss) {
    state.spawnT = spawnIntervalFor(state) * (0.8 + state.rng() * 0.4);
    const batch = Math.min(4, 1 + Math.floor(state.time / 120)); // 随时间批量出生
    const pool = unlockedEnemies(state);
    if (pool.length) {
      for (let i = 0; i < batch; i += 1) {
        if (state.enemies.length >= cap) break;
        const id = pool[Math.floor(state.rng() * pool.length)];
        spawnEnemy(state, id);
      }
    }
  }
  if (!state.boss) {
    state.eliteT -= dt;
    if (state.eliteT <= 0 && state.time >= 270 && state.enemies.length < cap - 10) {
      state.eliteT = state.mode === "endless" ? 38 : 42;
      spawnEnemy(state, "elite");
    }
  }
}

function spawnEnemy(state, typeId, force = false) {
  const meta = ENEMIES[typeId];
  const hp = Math.round(meta.hp * enemyHpScale(state) * (meta.elite ? 1 : 1));
  let x = 0;
  let y = 0;
  let ok = false;
  if (force) {
    ok = true;
  }
  for (let attempt = 0; attempt < 12 && !ok; attempt += 1) {
    const side = Math.floor(state.rng() * 4);
    if (side === 0) {
      x = state.rng() * ARENA_W;
      y = -24;
    } else if (side === 1) {
      x = state.rng() * ARENA_W;
      y = ARENA_H + 24;
    } else if (side === 2) {
      x = -24;
      y = state.rng() * ARENA_H;
    } else {
      x = ARENA_W + 24;
      y = state.rng() * ARENA_H;
    }
    const dx = x - state.player.x;
    const dy = y - state.player.y;
    if (dx * dx + dy * dy >= SPAWN_MIN_DIST * SPAWN_MIN_DIST) {
      ok = true;
      break;
    }
  }
  if (!ok) return null; // 无满足距离的出生点：本轮跳过（绝不贴脸刷怪）
  const e = {
    id: `e${state.kills}_${state.enemies.length}`,
    type: typeId,
    x,
    y,
    hp,
    maxHp: hp,
    r: meta.r,
    speed: meta.speed * (0.85 + state.rng() * 0.3),
    dmg: meta.dmg,
    xp: meta.xp,
    alive: true,
    spawnT: SPAWN_FADE,
    explode: Boolean(meta.explode),
    bounce: Boolean(meta.bounce),
    elite: Boolean(meta.elite),
    angle: state.rng() * Math.PI * 2,
    steer: 1 + state.rng() * 1.2,
    hitFlash: 0,
    dirX: 0,
    dirY: 1,
  };
  if (meta.bounce) {
    const a = state.rng() * Math.PI * 2;
    e.dirX = Math.cos(a);
    e.dirY = Math.sin(a);
  }
  state.enemies.push(e);
  return e;
}

function updateEnemies(state, dt) {
  const p = state.player;
  const alive = [];
  for (const e of state.enemies) {
    if (!e.alive) continue;
    alive.push(e);
    if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
    if (e.spawnT > 0) {
      e.spawnT = Math.max(0, e.spawnT - dt);
    }
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    if (e.bounce) {
      e.x += e.dirX * e.speed * dt;
      e.y += e.dirY * e.speed * dt;
      if (e.x < 12 || e.x > ARENA_W - 12) e.dirX *= -1;
      if (e.y < 12 || e.y > ARENA_H - 12) e.dirY *= -1;
      e.steer -= dt;
      if (e.steer <= 0) {
        e.steer = 1.2 + state.rng();
        const a = Math.atan2(ny, nx) + (state.rng() - 0.5) * 1.2;
        e.dirX = Math.cos(a) * 0.5 + e.dirX * 0.5;
        e.dirY = Math.sin(a) * 0.5 + e.dirY * 0.5;
        const len = Math.hypot(e.dirX, e.dirY) || 1;
        e.dirX /= len;
        e.dirY /= len;
      }
    } else if (e.type === "wasp") {
      // 野蜂：接近到 150px 后绕行包抄
      if (dist > 150) {
        e.x += nx * e.speed * dt;
        e.y += ny * e.speed * dt;
      } else {
        e.angle += dt * 2.4;
        const tx = -ny * Math.cos(e.angle) + nx * Math.sin(e.angle);
        const ty = nx * Math.cos(e.angle) + ny * Math.sin(e.angle);
        e.x += (tx * e.speed * 0.9) * dt;
        e.y += (ty * e.speed * 0.9) * dt;
        // 轻微向玩家收敛，避免无限绕圈
        e.x += nx * e.speed * 0.12 * dt;
        e.y += ny * e.speed * 0.12 * dt;
      }
    } else {
      e.x += nx * e.speed * dt;
      e.y += ny * e.speed * dt;
    }
    // 接触伤害
    if (e.spawnT <= 0 && p.invuln <= 0) {
      const rr = (e.r + PLAYER_R) * (e.r + PLAYER_R);
      if (dx * dx + dy * dy <= rr) {
        damagePlayer(state, e.dmg, e.type);
      }
    }
  }
  state.enemies = alive;
}

/* ------------------------------------------------------------ 伤害与击杀 */

function damagePlayer(state, amount, source) {
  const p = state.player;
  if (p.invuln > 0) return;
  const reduced = Math.max(1, amount - state.stats.armor);
  p.hp -= reduced;
  p.invuln = INVULN_TIME;
  state.combo = 0;
  state.comboTimer = 0;
  // 玫瑰刺反击：攻击者掉血
  if (state.stats.reflect > 0) {
    const attacker = state.enemies.find((e) => e.alive && e.type === source);
    if (attacker) damageEnemy(state, attacker, state.stats.reflect, { id: "thorn" });
  }
  pushEvent(state, { type: "hit", x: p.x, y: p.y, amount: reduced });
  if (p.hp <= 0) {
    p.hp = 0;
    loseGame(state);
  }
}

function damageEnemy(state, e, amount, source) {
  if (!e.alive) return;
  e.hp -= amount;
  e.hitFlash = 0.1;
  if (e.hp > 0) {
    pushEvent(state, { type: "chip", x: e.x, y: e.y });
    return;
  }
  killEnemy(state, e, source);
}

function damageBoss(state, amount) {
  const boss = state.boss;
  if (!boss || boss.hp <= 0) return;
  boss.hp -= amount;
  boss.hitFlash = 0.1;
  pushEvent(state, { type: "chip", x: boss.x, y: boss.y });
  if (boss.hp <= 0) {
    boss.hp = 0;
    onBossKilled(state);
  }
}

/** 判定 boss 是否被一次范围伤害命中（所有武器的统一出口） */
function hurtBoss(state, x, y, radius, amount) {
  if (!state.boss || state.boss.hp <= 0) return;
  const dx = x - state.boss.x;
  const dy = y - state.boss.y;
  if (dx * dx + dy * dy <= (radius + state.boss.r) * (radius + state.boss.r)) {
    damageBoss(state, amount);
  }
}

function killEnemy(state, e, source) {
  e.alive = false;
  state.kills += 1;
  state.combo = Math.min(COMBO_MAX, state.combo + 1);
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.comboTimer = COMBO_WINDOW;
  state.score = clampScore(state.score + killScore(e.type, state.combo) * state.scoreMult);
  state.mow = Math.min(MOW_MAX, state.mow + Math.min(4, 0.7 + e.xp * 0.12 + state.combo * 0.012));
  if (state.mow >= MOW_MAX && !state.mowReady) {
    state.mowReady = true;
    pushEvent(state, { type: "mowReady" });
  }
  // 黄金割草盘击杀回血
  const gold = state.weapons.find((w) => w.id === "gold-disk");
  if (gold) state.player.hp = Math.min(state.player.maxHp, state.player.hp + 1);
  if (e.explode) {
    // 毒蘑菇死亡爆炸：对玩家溅射
    pushEvent(state, { type: "explode", x: e.x, y: e.y, r: 70 });
    const p = state.player;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    if (dx * dx + dy * dy <= 70 * 70 && p.invuln <= 0 && e.spawnT <= 0) damagePlayer(state, 2, "toadstool");
  }
  pushEvent(state, { type: "kill", x: e.x, y: e.y, enemy: e.type, combo: state.combo });
  dropLoot(state, e, e.elite ? "chest" : "none");
  if (e.elite) {
    // 精英必掉进化宝箱 + 大花蜜
    state.drops.push({ kind: "nectar", x: e.x, y: e.y, xp: 12, life: 12, vx: 0, vy: 0 });
    state.score = clampScore(state.score + 200);
  }
  const src = source && source.id ? source.id : "";
  if (src === "gold-disk") state.player.hp = Math.min(state.player.maxHp, state.player.hp + 1);
}

/* ------------------------------------------------------------ 花粉爆发 */

function triggerBurst(state, emergency) {
  const p = state.player;
  const radius = emergency ? EMERGENCY_RADIUS : BURST_RADIUS;
  const dmg = emergency ? 60 : 120;
  const p2 = radius * radius;
  for (const e of state.enemies) {
    if (!e.alive || e.spawnT > 0) continue;
    if (e.type === "elite") continue; // 精英免于爆发（保留挑战）
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy <= p2) damageEnemy(state, e, dmg, { id: "burst" });
  }
  if (!emergency) {
    state.mow = 0;
    state.mowReady = false;
    state.burstCount += 1;
    state.scoreMult = 2;
    state.scoreMultT = 4;
    state.score = clampScore(state.score + burstScore(state.burstCount));
    p.invuln = Math.max(p.invuln, 1.0);
  } else {
    p.invuln = Math.max(p.invuln, 1.5);
    state.emergencyCd = 4;
    pushEvent(state, { type: "emergencyBurst", x: p.x, y: p.y });
    return;
  }
  pushEvent(state, { type: "burst", x: p.x, y: p.y, radius });
}

/* ------------------------------------------------------------ 逃生走廊 */

function checkEscapeCorridor(state, dt) {
  state.escapeT -= dt;
  if (state.escapeT > 0) return;
  state.escapeT = 2.0;
  if (state.emergencyCd > 0) {
    state.emergencyCd = Math.max(0, state.emergencyCd - dt);
    return;
  }
  if (state.boss) return; // Boss 战不触发包围脱困（Boss 前已清场）
  const p = state.player;
  const probe = 300;
  const blockedDirs = [];
  for (let dir = 0; dir < 8; dir += 1) {
    const a = (dir / 8) * Math.PI * 2;
    let blocked = false;
    for (const e of state.enemies) {
      if (!e.alive || e.spawnT > 0) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy > probe * probe) continue;
      const ea = Math.atan2(dy, dx);
      let diff = Math.abs(ea - a);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < Math.PI / 3) {
        blocked = true;
        break;
      }
    }
    if (blocked) blockedDirs.push(dir);
  }
  if (blockedDirs.length >= 8) {
    // 360° 全被围：免费花粉应急爆发脱困（不消耗割草槽）
    triggerBurst(state, true);
  }
}

/* ------------------------------------------------------------ 检查点与 Boss */

function checkCheckpoints(state) {
  for (const cp of CHECKPOINTS) {
    if (!state.checkpointsDone.has(cp) && state.time >= cp) {
      state.checkpointsDone.add(cp);
      pushEvent(state, { type: "checkpoint", minute: cp / 60 });
    }
  }
}

function updateBoss(state, dt) {
  if (state.mode !== "standard") return;
  if (!state.bossSpawned && state.time >= BOSS_TIME) {
    state.bossSpawned = true;
    // ① 全屏清场 + 满血补给：杜绝"残血进 Boss 必死"
    for (const e of state.enemies) {
      if (e.alive) state.score = clampScore(state.score + killScore(e.type, 1));
    }
    state.enemies = [];
    state.projectiles = [];
    state.player.hp = state.player.maxHp;
    state.boss = {
      hp: 1500,
      maxHp: 1500,
      phase: 0,
      t: 0,
      fireT: 1.6,
      summonT: 3.2,
      x: ARENA_W / 2,
      y: 170,
      r: 64,
      speed: 0,
      chargeT: 0,
      chargeDir: 0,
      hitFlash: 0,
    };
    pushEvent(state, { type: "bossSpawn", x: state.boss.x, y: state.boss.y });
    return;
  }
  const boss = state.boss;
  if (!boss || boss.hp <= 0) return;
  boss.t += dt;
  if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - dt);
  const ratio = boss.hp / boss.maxHp;
  boss.phase = ratio > 0.66 ? 0 : ratio > 0.33 ? 1 : 2;
  // 阶段移动：缓慢追踪 + 第三阶段冲锋
  const p = state.player;
  if (boss.chargeT > 0) {
    boss.chargeT -= dt;
    boss.x += boss.chargeDir * 430 * dt;
    boss.y = clamp(boss.y, 120, ARENA_H - 120);
    if (boss.chargeT <= 0) boss.chargeDir = 0;
    if (Math.abs(boss.x - p.x) < boss.r + PLAYER_R && Math.abs(boss.y - p.y) < boss.r + PLAYER_R && p.invuln <= 0) {
      damagePlayer(state, 3, "boss");
    }
  } else {
    const dx = p.x - boss.x;
    boss.x += clamp(dx * 0.2, -1, 1) * 44 * dt;
    // 缓慢向玩家逼近（保持 240px 以上距离感），让近战武器够得着、远程不无聊
    const targetY = clamp(p.y - 240, 130, 560);
    boss.y += (targetY - boss.y) * Math.min(1, 0.4 * dt) + Math.sin(boss.t * 0.6) * 12 * dt;
  }
  if (boss.phase === 2 && boss.chargeT <= 0 && state.rng() < 0.35 * dt * 2) {
    boss.chargeDir = p.x > boss.x ? 1 : -1;
    boss.chargeT = 1.15;
    pushEvent(state, { type: "bossCharge", x: boss.x, y: boss.y });
  }
  // 阶段 0/2：洒水壶扇形水弹
  boss.fireT -= dt;
  if (boss.fireT <= 0) {
    boss.fireT = boss.phase === 2 ? 1.0 : 1.5;
    const a = Math.atan2(p.y - boss.y, p.x - boss.x);
    const spread = boss.phase === 2 ? 0.5 : 0.34;
    const count = boss.phase === 2 ? 7 : 5;
    for (let i = 0; i < count; i += 1) {
      const off = (i / (count - 1) - 0.5) * spread;
      const ang = a + off;
      spawnProjectile(state, {
        kind: "water",
        x: boss.x + Math.cos(a) * 40,
        y: boss.y + Math.sin(a) * 40,
        vx: Math.cos(ang) * 300,
        vy: Math.sin(ang) * 300,
        life: 6,
        r: 7,
        dmg: boss.phase === 2 ? 2 : 1,
      });
    }
  }
  // 阶段 1：召唤虫群
  if (boss.phase >= 1) {
    boss.summonT -= dt;
    if (boss.summonT <= 0) {
      boss.summonT = 2.6;
      for (let i = 0; i < 8; i += 1) {
        const e = spawnEnemy(state, state.rng() < 0.6 ? "caterpillar" : "beetle", true);
        if (e) {
          e.x = boss.x + (state.rng() - 0.5) * 240;
          e.y = boss.y + 80;
        }
      }
      pushEvent(state, { type: "bossSummon", x: boss.x, y: boss.y });
    }
  }
  // Boss 接触伤害
  if (p.invuln <= 0 && Math.abs(boss.x - p.x) < boss.r + PLAYER_R && Math.abs(boss.y - p.y) < boss.r + PLAYER_R) {
    damagePlayer(state, 3, "boss");
  }
}

function onBossKilled(state) {
  state.score = clampScore(state.score + bossScore(state.kills));
  pushEvent(state, { type: "win", x: state.boss.x, y: state.boss.y });
  state.phase = PHASES.won;
}

function loseGame(state) {
  state.phase = PHASES.lost;
  pushEvent(state, { type: "lose", time: state.time, kills: state.kills });
}

/* ------------------------------------------------------------ 工具查询 */

function nearestEnemy(state, x, y, range, exclude) {
  let best = null;
  let bestD = range * range;
  for (const e of state.enemies) {
    if (!e.alive || e.spawnT > 0 || e === exclude) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) {
      bestD = d2;
      best = e;
    }
  }
  return best;
}

function pickCluster(state, radius, maxDist) {
  const pool = state.enemies.filter((e) => e.alive && e.spawnT <= 0);
  if (!pool.length) return null;
  let best = null;
  let bestScore = -1;
  for (let i = 0; i < Math.min(12, pool.length); i += 1) {
    const anchor = pool[Math.floor(state.rng() * pool.length)];
    let score = 0;
    for (const e of pool) {
      const dx = e.x - anchor.x;
      const dy = e.y - anchor.y;
      if (dx * dx + dy * dy <= radius * radius) score += 1;
    }
    if (maxDist) {
      const dx = anchor.x - state.player.x;
      const dy = anchor.y - state.player.y;
      if (dx * dx + dy * dy > maxDist * maxDist) continue;
    }
    if (score > bestScore) {
      bestScore = score;
      best = anchor;
    }
  }
  return best;
}

/* ------------------------------------------------------------ 出口 */

export function isTerminal(state) {
  return state.phase === PHASES.won || state.phase === PHASES.lost;
}

export function resultOf(state) {
  const won = state.phase === PHASES.won;
  const stars = starsFor({ won, kills: state.kills, maxCombo: state.maxCombo, time: state.time });
  return {
    mode: state.mode,
    character: state.character,
    won,
    lost: state.phase === PHASES.lost,
    time: state.time,
    kills: state.kills,
    maxCombo: state.maxCombo,
    burstCount: state.burstCount,
    score: state.score,
    level: state.level,
    stars,
    codex: { weapons: [...state.codex.weapons], passives: [...state.codex.passives], evolutions: [...state.codex.evolutions] },
    bossKilled: won,
  };
}

/** 只读诊断出口：供测试与渲染读取真实状态，避免验收脚本复刻逻辑。 */
export function snapshot(state) {
  return {
    phase: state.phase,
    mode: state.mode,
    character: state.character,
    time: state.time,
    hp: state.player.hp,
    maxHp: state.player.maxHp,
    level: state.level,
    xp: state.xp,
    xpNext: state.xpNext,
    kills: state.kills,
    combo: state.combo,
    maxCombo: state.maxCombo,
    mow: state.mow,
    mowReady: state.mowReady,
    scoreMult: state.scoreMult,
    score: state.score,
    weapons: state.weapons.map((w) => ({ id: w.id, level: w.level, evolved: w.evolved, angle: w.aux.angle ?? 0, tick: w.aux.tick ?? 0, charge: w.aux.charge ?? 0 })),
    passives: state.passives.map((p) => ({ id: p.id, level: p.level })),
    choices: state.choices ? state.choices.map((c) => ({ kind: c.kind, id: c.id, level: c.level })) : null,
    player: { x: state.player.x, y: state.player.y, aimX: state.player.aimX, aimY: state.player.aimY, invuln: state.player.invuln, burstCd: state.player.burstCd },
    vines: state.vines.map((v) => ({ x: v.x, y: v.y, r: v.r, t: v.t, maxT: v.maxT, from: v.from })),
    drops: state.drops.map((d) => ({ kind: d.kind, x: d.x, y: d.y })),
    enemies: state.enemies
      .filter((e) => e.alive)
      .map((e) => ({ type: e.type, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, r: e.r, spawnT: e.spawnT, hitFlash: e.hitFlash, elite: e.elite, angle: e.angle, bounce: e.bounce })),
    projectiles: state.projectiles.map((p) => ({ kind: p.kind, x: p.x, y: p.y, vx: p.vx, vy: p.vy, r: p.r, life: p.life })),
    boss: state.boss
      ? { x: state.boss.x, y: state.boss.y, hp: state.boss.hp, maxHp: state.boss.maxHp, phase: state.boss.phase, chargeT: state.boss.chargeT, chargeDir: state.boss.chargeDir, hitFlash: state.boss.hitFlash }
      : null,
    bossSpawned: state.bossSpawned,
  };
}

export { SCORE_CAP, clampScore, bestOf };
