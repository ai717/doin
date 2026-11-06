// engine.mjs — 深海吞噬 · 规则唯一权威（DOM-free · 零依赖 · 确定性可测）
//
// 食物链唯一判定（对标 Sprout/PopCap《Feeding Frenzy》的精确体型分级）：
//   tier(猎物) < tier(玩家) → 可食；tier(猎物) > tier(玩家) → 被吃；同级互不相犯。
// 玩家从第 2 阶起手（第 1 阶是海里最小的沙丁鱼），7 阶为霸主。
//
// 成长：吞食累积成长值，满条升一阶；深水猎物成长值更高（深渊压强机制）。
// 随机：全部走注入的 mulberry32，测试可复现。
// 防死局：场上任意时刻保底 ≥ MIN_EDIBLE 条可食目标，低于阈值立刻从边缘补刷，
//         且不在玩家正前方 1 个体长内刷更大的鱼 —— 从机制上排除“只剩比你大的鱼”。
//
// 物理：固定步长的纯函数帧步进 stepFrame(state, dt, input)，原地推进状态，只吐事件。

export const WORLD_WIDTH = 1200;
export const WORLD_HEIGHT = 800;

export const MAX_TIER = 7;
export const MIN_START_TIER = 2;

// 体型半径表：真实尺寸决定可食关系，视觉与判定共用同一张表。
export const TIER_RADIUS = Object.freeze([0, 17, 25, 35, 46, 58, 72, 88]);

// 升到下一阶所需成长值（阶数越高越难涨）；第 7 阶封顶。
export const TIER_NEED = Object.freeze([0, 10, 16, 24, 34, 46, 60, 0]);

// 吃掉某阶猎物得到的成长值（越大越肥）。
export const TIER_YIELD = Object.freeze([0, 1, 1.3, 1.7, 2.2, 2.9, 3.8, 5]);

// —— 狂暴连锁 ——
export const COMBO_WINDOW = 1.2;
export const FRENZY_DECAY = 2.0;
export const FRENZY_CHAIN = Object.freeze([0, 5, 12]);
export const FRENZY_MULT = Object.freeze([1, 2, 3]);

// —— 鱼群同行 ——
export const SHOAL_MAX = 3;
export const SHOAL_PER = 3;

// —— 场上配额 ——
export const MIN_EDIBLE = 6;
export const MAX_PREY = 26;
export const PROTECT_TIME = 3;
export const SPAWN_INVULN = 2;

export const PLAYER = Object.freeze({
  baseSpeed: 330,
  sprintMul: 1.86,
  energyMax: 100,
  energyDrain: 58,
  energyRegen: 21,
  energyMin: 22,
  // 受击宽容（策划案 §2「被吃也不摔手柄」）：2.4 秒无敌 + 0.26 秒硬直，
  // 硬直只够你“顿一下”，绝不长到让你失去对鱼的控制。
  invuln: 2.4,
  stun: 0.26,
  buffer: 0.15,
});

// 鱼类巡航速度随阶数陡增：高阶鱼比你巡航更快，只有冲刺能甩掉它。
export const FISH_SPEED = Object.freeze({ base: 110, perTier: 32, fleeMul: 1.26, aggroMul: 1.0, loseInterest: 280 });

// 深度三段：越深成长越肥，但压强上涨。
export const DEPTH_BANDS = Object.freeze([
  { key: "shallow", until: 0.34, mult: 1 },
  { key: "mid", until: 0.67, mult: 1.5 },
  { key: "deep", until: 1, mult: 2 },
]);
export const PRESSURE = Object.freeze({
  shallow: -0.17,
  mid: 0.055,
  deep: 0.105,
  bleedGrowth: 2.4,
  bleedSlow: 0.7,
});

// 深渊无尽：水柱持续上涌，越深越大越凶，屏幕上只剩自己那束探照光。
export const ABYSS = Object.freeze({
  base: 30,
  minFactor: 0.45,
  pxPerMeter: 22,
  tierStep: 165,
  hunterEvery: 34,
  lightDepth: 900,
});

export const SPECIES = Object.freeze({
  guppy: { shoalable: true },
  sardine: { shoalable: true },
  clown: { shoalable: true },
  tang: { shoalable: true },
  puffer: { shoalable: false },
  poison: { shoalable: false, poison: true },
  grouper: { shoalable: false },
  shark: { shoalable: false },
  orca: { shoalable: false },
  barracuda: { shoalable: false },
});
export const SHOAL_SPECIES = Object.freeze(["guppy", "sardine", "clown", "tang"]);

export const POWER_KINDS = Object.freeze(["pearl", "lightning", "frenzy", "shoal", "heart"]);

export const STATUS = Object.freeze({
  ready: "ready",
  playing: "playing",
  paused: "paused",
  won: "won",
  lost: "lost",
});

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

// ---------- 确定性随机 ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed) {
  return mulberry32(typeof seed === "number" ? seed : 20260915);
}

function range(rng, min, max) {
  return min + rng() * (max - min);
}

function randInt(rng, min, max) {
  return Math.floor(range(rng, min, max + 1 - 1e-9));
}

function pick(rng, list) {
  if (!list.length) return undefined;
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

// ---------- 纯规则查询 ----------
export function radiusForTier(tier) {
  return TIER_RADIUS[clamp(Math.round(tier), 0, MAX_TIER)];
}

export function canEat(attackerTier, targetTier) {
  return attackerTier > targetTier;
}

export function growthNeeded(tier) {
  return tier >= MAX_TIER ? 0 : TIER_NEED[clamp(tier, 1, MAX_TIER)];
}

export function eatYield(tier) {
  return TIER_YIELD[clamp(Math.round(tier), 1, MAX_TIER)];
}

export function depthBandFor(y, height) {
  const ratio = clamp(y / Math.max(1, height), 0, 0.999);
  for (const band of DEPTH_BANDS) {
    if (ratio < band.until) return band;
  }
  return DEPTH_BANDS[DEPTH_BANDS.length - 1];
}

export function depthMultFor(y, height) {
  return depthBandFor(y, height).mult;
}

// 深水成长加成只在启用深渊压强的海域生效（第 4 片起）：
// 越深越肥是这个海域独有的交易 —— 拿压强换成长。
export function growthMult(state) {
  return state.level.mechanics?.pressure ? depthMultFor(state.player.y, state.world.height) : 1;
}

export function fishSpeed(tier) {
  return FISH_SPEED.base + tier * FISH_SPEED.perTier;
}

export function relationFor(tier, playerTier) {
  if (tier > playerTier) return "hunter";
  if (tier < playerTier) return "prey";
  return "peer";
}

export function playerRadius(state) {
  return radiusForTier(state.player.tier) * 0.92;
}

export function edibleCount(state) {
  let count = 0;
  for (const entity of state.entities) {
    if (entity.kind !== "power" && entity.tier < state.player.tier) count += 1;
  }
  return count;
}

export function summarise(state) {
  return {
    mode: state.mode,
    status: state.status,
    time: Math.round(state.time * 10) / 10,
    tier: state.player.tier,
    hearts: state.player.hearts,
    eaten: state.stats.eaten,
    hits: state.stats.hits,
    score: Math.round(state.stats.score),
    pearls: state.stats.pearls,
    bestCombo: state.stats.bestCombo,
    bestFrenzy: state.stats.bestFrenzy,
    shoal: state.shoal.length,
    tail: state.stats.tail,
    depth: Math.round(state.abyss.depth),
    edible: edibleCount(state),
  };
}

function emit(state, event) {
  state.events.push(event);
}

// ---------- 世界构造 ----------
export function createState(level, options = {}) {
  const seed = options.seed ?? 20260915;
  const world = {
    width: options.width ?? WORLD_WIDTH,
    height: options.height ?? WORLD_HEIGHT,
  };
  const state = {
    mode: options.mode ?? "level",
    level,
    world,
    rng: createRng(seed),
    seed,
    status: options.autoStart === false ? STATUS.ready : STATUS.playing,
    time: 0,
    timeLimit: level.timeLimit ?? Infinity,
    startTier: level.startTier ?? MIN_START_TIER,
    nextId: 1,
    player: {
      x: world.width * 0.5,
      y: world.height * 0.5,
      vx: 0,
      vy: 0,
      facing: 1,
      tier: level.startTier ?? MIN_START_TIER,
      growth: 0,
      hearts: level.hearts ?? 3,
      maxHearts: 3,
      invuln: level.invulnOnStart ?? SPAWN_INVULN,
      stun: 0,
      paralyze: 0,
      poison: 0,
      snare: 0,
      energy: PLAYER.energyMax,
      sprinting: false,
      sprintBuffer: 0,
      lightning: 0,
    },
    entities: [],
    hazards: [],
    powers: [],
    kelp: [],
    shoal: [],
    shoalProgress: {},
    combo: 0,
    comboTimer: 0,
    frenzy: 0,
    frenzyTimer: 0,
    pressure: 0,
    protect: PROTECT_TIME,
    danger: 0,
    spawnTimer: 0.5,
    powerTimer: 3.2,
    events: [],
    stats: {
      eaten: 0,
      eatenBySpecies: {},
      hits: 0,
      score: 0,
      pearls: 0,
      tail: 0,
      powers: 0,
      // 结算面板要用的峰值。必须显式初始化：`Math.max(undefined, n)` 会算出 NaN，
      // NaN 一旦混进来就再也回不去，UI 上会直接显示 NaN。
      bestCombo: 0,
      bestFrenzy: 0,
    },
    abyss: { depth: 0, light: 0, scroll: 0, tierCap: 2 },
  };
  state.powerTimer = range(state.rng, 3.2, 6.4);
  seedWorld(state);
  return state;
}

function seedWorld(state) {
  const level = state.level;
  const rng = state.rng;
  const mechanics = level.mechanics ?? {};

  if (mechanics.kelp) {
    const patches = level.kelp ?? 5;
    for (let i = 0; i < patches; i += 1) {
      state.kelp.push({
        x: range(rng, 90, state.world.width - 90),
        y: range(rng, state.world.height * 0.18, state.world.height * 0.94),
        r: range(rng, 90, 165),
        phase: rng() * Math.PI * 2,
      });
    }
  }

  const hazardPlan = level.hazards ?? {};
  for (const kind of ["jelly", "urchin", "mine", "net", "chest"]) {
    const count = hazardPlan[kind] ?? 0;
    for (let i = 0; i < count; i += 1) placeHazard(state, kind);
  }

  const crowd = level.initialPrey ?? 10;
  for (let i = 0; i < crowd; i += 1) spawnFish(state, { forceEdible: i < 5 });

  const hunters = level.spawn?.hunters ?? [];
  for (const spec of hunters) {
    const count = spec.count ?? 1;
    for (let i = 0; i < count; i += 1) {
      spawnFish(state, { tier: spec.tier, species: spec.species, elite: spec.elite, boss: spec.boss });
    }
  }
}

function placeHazard(state, kind) {
  const rng = state.rng;
  const world = state.world;
  const margin = 120;
  const floorKinds = kind === "chest" || kind === "urchin";
  // 纵向摆放红线：任何静止危险物下方必须留出 ≥ 210px 的泳道。
  // 玩家中心最低只能到 height - radius*0.6，最大体型（T7）半径 88 ——
  // 如果海胆贴在海底，整条海底就变成尖刺墙，玩家被追下去只能挨扎：
  // 那不是难度，是不给路。留出泳道后，“绕过去”永远是一个可行解。
  const floorTop = world.height * 0.54;
  const highest = world.height - 210;
  const spot = () => ({
    x: range(rng, margin, world.width - margin),
    y: floorKinds ? range(rng, floorTop, highest) : range(rng, margin, highest),
  });
  let point = spot();
  // 危险物之间也要留够间距：否则海胆 / 宝箱会挤成一道海底围墙，
  // 把“绕开一个障碍”变成“根本没有路”——这是关卡不公，不是难度。
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const dx = point.x - state.player.x;
    const dy = point.y - state.player.y;
    const awayFromPlayer = dx * dx + dy * dy > 240 * 240;
    const spread = state.hazards.every(
      (other) => Math.hypot(point.x - other.x, point.y - other.y) > 180,
    );
    if (awayFromPlayer && spread) break;
    point = spot();
  }
  const radius = { jelly: 30, urchin: 28, mine: 22, net: 42, chest: 32 }[kind] ?? 26;
  state.hazards.push({
    id: state.nextId++,
    kind,
    x: point.x,
    y: point.y,
    vx: 0,
    vy: kind === "mine" ? -18 : 0,
    r: radius,
    phase: rng() * Math.PI * 2,
  });
}

function spawnPoint(state, { avoidFront = true } = {}) {
  const rng = state.rng;
  const world = state.world;
  const player = state.player;
  const margin = 72;
  let point = { x: world.width * 0.5, y: -margin };
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const edge = randInt(rng, 0, 3);
    if (edge === 0) {
      point = { x: range(rng, margin, world.width - margin), y: -margin };
    } else if (edge === 1) {
      point = { x: range(rng, margin, world.width - margin), y: world.height + margin };
    } else if (edge === 2) {
      point = { x: -margin, y: range(rng, margin, world.height - margin) };
    } else {
      point = { x: world.width + margin, y: range(rng, margin, world.height - margin) };
    }
    const dx = point.x - player.x;
    const dy = point.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 210) continue;
    if (avoidFront && dist > 0) {
      const ahead = (dx * player.facing) / dist;
      // 不在玩家正前方 1 个体长内刷鱼（避免“贴脸冒出大嘴”）
      if (ahead > 0.72 && dist < 430) continue;
    }
    return point;
  }
  return point;
}

export function tierPoolFor(state) {
  const pool = state.level.preyTiers;
  if (Array.isArray(pool) && pool.length) return pool.map((value) => clamp(Math.round(value), 1, MAX_TIER));
  const base = state.startTier;
  return [...new Set([Math.max(1, base - 1), base, Math.min(MAX_TIER, base + 1)])];
}

function chooseSpecies(state, tier) {
  const rng = state.rng;
  const pool = (state.level.species ?? SHOAL_SPECIES).filter((name) => SPECIES[name]);
  const usable = pool.length ? pool : [...SHOAL_SPECIES];
  const shoalable = usable.filter((name) => SPECIES[name].shoalable);
  const hefty = usable.filter((name) => !SPECIES[name].shoalable);
  const preferShoal = tier <= state.startTier || rng() < 0.5;
  if (preferShoal && shoalable.length) return pick(rng, shoalable);
  if (hefty.length) return pick(rng, hefty);
  return pick(rng, shoalable.length ? shoalable : usable);
}

export function spawnFish(state, options = {}) {
  const rng = state.rng;
  const level = state.level;
  const player = state.player;
  const pool = tierPoolFor(state);
  let tier = options.tier;
  if (!tier) {
    if (options.forceEdible) {
      const edible = pool.filter((value) => value < player.tier);
      tier = edible.length ? pick(rng, edible) : Math.max(1, player.tier - 1);
    } else {
      tier = pick(rng, pool);
    }
  }
  tier = clamp(Math.round(tier), 1, MAX_TIER);
  if (state.mode === "abyss") tier = Math.min(tier, state.abyss.tierCap);
  const species = options.species ?? chooseSpecies(state, tier);
  const point = options.x !== undefined ? { x: options.x, y: options.y } : spawnPoint(state);
  const speed = fishSpeed(tier) * range(rng, 0.42, 0.62);
  const heading = rng() < 0.5 ? Math.PI : 0;
  const elite = Boolean(options.elite) && Boolean(level.mechanics?.elite);
  const entity = {
    id: state.nextId++,
    kind: "fish",
    species,
    tier,
    x: point.x,
    y: point.y,
    vx: Math.cos(heading) * speed,
    vy: range(rng, -0.35, 0.35) * speed,
    facing: heading === 0 ? 1 : -1,
    r: radiusForTier(tier),
    phase: rng() * Math.PI * 2,
    wanderTimer: range(rng, 0.6, 2.2),
    wx: 0,
    wy: 0,
    aggro: 0,
    stun: 0,
    poison: Boolean(SPECIES[species]?.poison),
    shoalable: Boolean(SPECIES[species]?.shoalable),
    elite,
    boss: elite && Boolean(options.boss),
    tailNeed: elite ? (options.boss ? 5 : 3) : 0,
    tailHits: 0,
    tailCooldown: 0,
    burst: 2.6,
    recovering: false,
    born: state.time,
    ttl: options.ttl ?? Infinity,
    dead: false,
  };
  state.entities.push(entity);
  return entity;
}

export function spawnPower(state, kind) {
  const rng = state.rng;
  const point = spawnPoint(state, { avoidFront: false });
  const power = {
    id: state.nextId++,
    kind: "power",
    power: kind,
    x: point.x,
    y: point.y,
    vx: range(rng, -26, 26),
    vy: range(rng, -18, 18),
    r: 24,
    phase: rng() * Math.PI * 2,
    dead: false,
  };
  state.powers.push(power);
  return power;
}

// ---------- 主步进 ----------
export function stepFrame(state, dt, input = {}) {
  state.events.length = 0;
  if (state.status !== STATUS.playing) return state.events;
  const step = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
  if (step <= 0) return state.events;

  state.time += step;
  updateTimers(state, step);
  updateDanger(state);
  // 危险感知：靠近掠食者时轻微时间减速（只作用于运动，不改变规则与计时）。
  // 减速只留一点点紧张感 —— 贴着掠食者擦过去的时候，正是最需要跟手的时候。
  const motion = 1 - 0.16 * state.danger;

  if (state.mode === "abyss") advanceAbyss(state, step);
  updatePlayer(state, step, input, motion);
  updateShoal(state, step, motion);
  updateFish(state, step, motion);
  updateHazards(state, step, motion);
  updatePowers(state, step, motion);
  resolveCollisions(state);
  maintainPopulation(state, step);
  checkOutcome(state);
  return state.events;
}

function updateTimers(state, dt) {
  const player = state.player;
  state.protect = Math.max(0, state.protect - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  player.stun = Math.max(0, player.stun - dt);
  player.paralyze = Math.max(0, player.paralyze - dt);
  player.poison = Math.max(0, player.poison - dt);
  player.lightning = Math.max(0, player.lightning - dt);
  player.sprintBuffer = Math.max(0, player.sprintBuffer - dt);
  // 渔网缠身：慢慢挣扎也能脱身（自然衰减 0.5/s，约 4.4 秒），冲刺则约 0.85 秒扯断。
  player.snare = Math.max(0, player.snare - dt * 0.5);

  if (state.comboTimer > 0) {
    state.comboTimer = Math.max(0, state.comboTimer - dt);
    if (state.comboTimer === 0) {
      state.combo = 0;
      if (state.frenzy > 0) {
        state.frenzy = 0;
        state.frenzyTimer = 0;
        emit(state, { type: "frenzyEnd" });
      }
    }
  }
  if (state.frenzy > 0) {
    state.frenzyTimer = Math.max(0, state.frenzyTimer - dt);
  }

  if (state.level.mechanics?.pressure) {
    const band = depthBandFor(player.y, state.world.height);
    const rate = PRESSURE[band.key] ?? 0;
    const before = state.pressure;
    state.pressure = clamp(state.pressure + rate * dt, 0, 1);
    if (state.pressure >= 1 && before < 1) emit(state, { type: "pressureFull" });
    if (state.pressure > 0 && state.pressure < 1 && before >= 1) emit(state, { type: "pressureSafe" });
    if (state.pressure >= 1) {
      player.growth = Math.max(0, player.growth - PRESSURE.bleedGrowth * dt);
    }
  }

  if (state.mode === "level" && state.timeLimit !== Infinity && state.timeLimit - state.time <= 10 && state.timeLimit - state.time + dt > 10) {
    emit(state, { type: "hurry" });
  }
}

function updateDanger(state) {
  const player = state.player;
  let danger = 0;
  for (const entity of state.entities) {
    if (!entity.elite && entity.tier <= player.tier) continue;
    const dx = entity.x - player.x;
    const dy = entity.y - player.y;
    const near = 1 - Math.min(1, Math.hypot(dx, dy) / 330);
    if (near > danger) danger = near;
  }
  state.danger = danger;
}

function advanceAbyss(state, dt) {
  const player = state.player;
  const bias = clamp(player.vy / (PLAYER.baseSpeed * 1.2), -1, 1);
  const factor = Math.max(ABYSS.minFactor, 1 + 0.55 * bias);
  const scroll = ABYSS.base * factor * dt;
  state.abyss.scroll += scroll;
  state.abyss.depth += scroll / ABYSS.pxPerMeter;
  state.abyss.light = clamp(state.abyss.depth / ABYSS.lightDepth, 0, 0.86);
  state.abyss.tierCap = clamp(2 + Math.floor(state.abyss.depth / ABYSS.tierStep), 2, MAX_TIER);
  // 水柱上涌：整片海域（含玩家）被向上推，玩家必须持续往下游才能保持下潜。
  player.y -= scroll * 0.42;
  for (const entity of state.entities) entity.y -= scroll;
  for (const hazard of state.hazards) hazard.y -= scroll;
  for (const power of state.powers) power.y -= scroll;
}

function updatePlayer(state, dt, input, motion) {
  const player = state.player;
  let dirX = Number(input.dirX) || 0;
  let dirY = Number(input.dirY) || 0;
  const magnitude = Math.hypot(dirX, dirY);

  if (player.stun > 0 || player.paralyze > 0) {
    dirX = 0;
    dirY = 0;
  } else if (magnitude > 1) {
    dirX /= magnitude;
    dirY /= magnitude;
  }

  // 毒鱼：左右反向 2 秒（感觉型 debuff，不改物理规则）
  if (player.poison > 0) dirX = -dirX;

  if (input.sprint) player.sprintBuffer = PLAYER.buffer;
  const wantsSprint = player.sprintBuffer > 0 && player.stun <= 0 && player.paralyze <= 0;
  if (wantsSprint) {
    if (player.lightning > 0 || player.energy >= (player.sprinting ? 1 : PLAYER.energyMin)) player.sprinting = true;
  } else {
    player.sprinting = false;
  }
  if (player.lightning > 0) {
    player.energy = Math.min(PLAYER.energyMax, player.energy + PLAYER.energyRegen * 1.6 * dt);
  } else if (player.sprinting) {
    player.energy = Math.max(0, player.energy - PLAYER.energyDrain * dt);
    if (player.energy <= 0) player.sprinting = false;
  } else {
    player.energy = Math.min(PLAYER.energyMax, player.energy + PLAYER.energyRegen * dt);
  }

  const frenzyBonus = 1 + 0.06 * state.frenzy;
  const tierDrag = 1 - (player.tier - MIN_START_TIER) * 0.004;
  let maxSpeed = PLAYER.baseSpeed * frenzyBonus * tierDrag;
  if (player.sprinting) maxSpeed *= PLAYER.sprintMul;
  if (player.snare > 0) {
    // 缠住时只剩四成推力：挣扎（自然衰减 0.5/s，约 4.4 秒）或冲刺（2.6/s，约 0.85 秒）脱身。
    maxSpeed *= 0.42;
    if (wantsSprint) {
      player.snare = Math.max(0, player.snare - dt * 2.6);
      if (player.snare === 0) emit(state, { type: "netBroke", x: player.x, y: player.y });
    }
  }
  if (state.pressure >= 1) maxSpeed *= PRESSURE.bleedSlow;

  // 转向惯性：指数逼近目标速度。高阶依然更“重”，但不再重到像换了个人操作——
  // steer 是手感旋钮：越大越跟手（低于 5 时玩家会觉得“鱼在冰上漂”）。
  const steer = Math.max(4.8, 9.2 - player.tier * 0.34);
  const k = 1 - Math.exp(-steer * dt * motion);
  const idle = magnitude < 0.02;
  const approach = idle ? 0.8 : 1;
  player.vx += (dirX * maxSpeed - player.vx) * k * approach;
  player.vy += (dirY * maxSpeed - player.vy) * k * approach;
  player.x += player.vx * dt * motion;
  player.y += player.vy * dt * motion;
  if (Math.abs(player.vx) > 6) player.facing = player.vx > 0 ? 1 : -1;

  const radius = playerRadius(state);
  player.x = clamp(player.x, radius * 0.6, state.world.width - radius * 0.6);
  player.y = clamp(player.y, radius * 0.6, state.world.height - radius * 0.6);
}

function updateShoal(state, dt, motion) {
  const player = state.player;
  const radius = playerRadius(state);
  for (let i = 0; i < state.shoal.length; i += 1) {
    const follower = state.shoal[i];
    const targetX = player.x - player.facing * (radius + 24 + i * 33);
    const targetY = player.y + (i % 2 === 0 ? -1 : 1) * 20 + Math.sin(state.time * 2.4 + i) * 6;
    const k = Math.min(1, 6 * dt * motion);
    follower.vx += (targetX - follower.x) * k * 3.2;
    follower.vy += (targetY - follower.y) * k * 3.2;
    const damping = 1 - Math.min(0.9, 6 * dt);
    follower.vx *= damping;
    follower.vy *= damping;
    follower.x += follower.vx * dt * motion;
    follower.y += follower.vy * dt * motion;
    follower.facing = player.facing;
    follower.bob = Math.sin(state.time * 5 + i * 1.4) * 0.14;
  }
}

function wander(state, entity, step, rng, speed) {
  entity.wanderTimer -= step;
  if (entity.wanderTimer <= 0) {
    entity.wanderTimer = range(rng, 0.8, 2.6);
    entity.wx = range(rng, -1, 1);
    entity.wy = range(rng, -0.75, 0.75);
  }
  const length = Math.hypot(entity.wx, entity.wy) || 1;
  return { targetX: entity.wx / length, targetY: entity.wy / length, speed };
}

function updateFish(state, step, motion) {
  const player = state.player;
  const rng = state.rng;
  const world = state.world;
  const dt = step * motion;
  for (const entity of state.entities) {
    if (entity.stun > 0) {
      entity.stun = Math.max(0, entity.stun - step);
      const damping = 1 - Math.min(0.9, 3.2 * step);
      entity.vx *= damping;
      entity.vy *= damping;
      entity.x += entity.vx * step;
      entity.y += entity.vy * step;
      continue;
    }
    const dx = player.x - entity.x;
    const dy = player.y - entity.y;
    const dist = Math.hypot(dx, dy) || 1;
    const relation = entity.elite ? "hunter" : relationFor(entity.tier, player.tier);
    const cruise = fishSpeed(entity.tier);
    let targetX;
    let targetY;
    let speed = cruise;

    if (relation === "hunter") {
      entity.aggro = dist < FISH_SPEED.loseInterest ? 1.6 : Math.max(0, entity.aggro - step);
      if (entity.elite) {
        // 精英掠食者的突进 / 卸力循环：卸力期航向不变、速度大减，这就是咬尾的窗口。
        entity.burst = (entity.burst ?? 2.6) - step;
        if (entity.burst <= 0) {
          entity.recovering = !entity.recovering;
          entity.burst = entity.recovering ? 1.3 : 2.6;
        }
      }
      if (entity.aggro > 0 && state.protect <= 0 && !entity.recovering) {
        targetX = dx / dist;
        targetY = dy / dist;
        // 追击速度有硬顶：掠食者永远只比你巡航快一点点（精英略多），
        // 所以危险来自“没看见 / 被逼到边上”，而不是数学上跑不掉。
        const cap = PLAYER.baseSpeed * (entity.elite ? (entity.boss ? 1.02 : 0.98) : 0.8);
        speed = entity.elite ? Math.min(cruise * (entity.boss ? 1.2 : 1.12), cap) : Math.min(cruise * FISH_SPEED.aggroMul, cap);
      } else if (entity.elite) {
        const heading = Math.hypot(entity.vx, entity.vy) || 1;
        targetX = entity.vx / heading;
        targetY = entity.vy / heading;
        speed = cruise * 0.5;
      } else {
        ({ targetX, targetY, speed } = wander(state, entity, step, rng, cruise * 0.62));
      }
    } else if (relation === "prey") {
      const fear = 200 + (player.tier - entity.tier) * 24;
      if (dist < fear) {
        targetX = -dx / dist;
        targetY = -dy / dist;
        speed = Math.min(PLAYER.baseSpeed * 0.62, cruise * FISH_SPEED.fleeMul);
      } else {
        ({ targetX, targetY, speed } = wander(state, entity, step, rng, cruise * 0.55));
      }
    } else {
      ({ targetX, targetY, speed } = wander(state, entity, step, rng, cruise * 0.45));
    }

    if (state.protect > 0 && entity.tier > player.tier) speed *= 0.45;

    const steer = entity.elite ? 3.1 : 4.2;
    const k = 1 - Math.exp(-steer * dt);
    entity.vx += (targetX * speed - entity.vx) * k;
    entity.vy += (targetY * speed - entity.vy) * k;
    entity.x += entity.vx * dt;
    entity.y += entity.vy * dt;
    if (Math.abs(entity.vx) > 5) entity.facing = entity.vx > 0 ? 1 : -1;

    if (state.mode === "abyss" && entity.y < -120) entity.dead = true;
    if (entity.ttl !== Infinity && state.time - entity.born > entity.ttl) entity.dead = true;

    if (entity.x < entity.r) {
      entity.x = entity.r;
      entity.vx = Math.abs(entity.vx);
      entity.facing = 1;
    } else if (entity.x > world.width - entity.r) {
      entity.x = world.width - entity.r;
      entity.vx = -Math.abs(entity.vx);
      entity.facing = -1;
    }
    if (entity.y < entity.r) {
      entity.y = entity.r;
      entity.vy = Math.abs(entity.vy);
    } else if (entity.y > world.height - entity.r) {
      entity.y = world.height - entity.r;
      entity.vy = -Math.abs(entity.vy);
    }
  }
  if (state.entities.some((entity) => entity.dead)) {
    state.entities = state.entities.filter((entity) => !entity.dead);
  }
}

function updateHazards(state, step, motion) {
  const world = state.world;
  for (const hazard of state.hazards) {
    if (hazard.kind === "mine") {
      hazard.y += hazard.vy * step * motion;
      hazard.x += Math.sin(state.time * 0.8 + hazard.phase) * 16 * step * motion;
      if (hazard.y < 60) hazard.y = world.height - 40;
    }
    hazard.x = clamp(hazard.x, 24, world.width - 24);
  }
}

function updatePowers(state, step, motion) {
  const world = state.world;
  for (const power of state.powers) {
    power.x += power.vx * step * motion;
    power.y += power.vy * step * motion;
    if (power.x < 26 || power.x > world.width - 26) power.vx *= -1;
    if (power.y < 26 || power.y > world.height - 26) power.vy *= -1;
    power.x = clamp(power.x, 26, world.width - 26);
    power.y = clamp(power.y, 26, world.height - 26);
    power.phase += step * 2.6;
  }
}

function hits(a, b, slack = 1) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const reach = (a.r + b.r) * slack;
  return dx * dx + dy * dy <= reach * reach;
}

function resolveCollisions(state) {
  const player = state.player;
  const radius = playerRadius(state);
  const self = { x: player.x, y: player.y, r: radius };

  for (const entity of state.entities) {
    if (entity.dead) continue;
    // 吞食判定半径略大于视觉鱼嘴：擦边算吃到
    if (!hits(self, entity, 1.15)) continue;
    const relation = relationFor(entity.tier, player.tier);
    if (entity.elite) {
      // 精英掠食者只能咬尾降阶，正面撞上照样被吃 —— 直到被制服
      if (isTailBite(player, entity) && (entity.tailCooldown ?? 0) <= 0) biteTail(state, entity);
      else if (relation === "hunter") biteHazardPlayer(state, entity);
      else emit(state, { type: "graze", x: entity.x, y: entity.y });
    } else if (relation === "prey") {
      eatFish(state, entity, { growthMul: 1 });
    } else if (relation === "hunter") {
      biteHazardPlayer(state, entity);
    }
  }

  for (const follower of state.shoal) {
    for (const entity of state.entities) {
      if (entity.dead) continue;
      if (entity.tier >= follower.tier) continue;
      if (!hits(follower, entity, 1.1)) continue;
      eatFish(state, entity, { growthMul: 0.5, byShoal: true });
    }
  }

  for (const hazard of state.hazards) {
    if (hazard.dead) continue;
    if (!hits(self, hazard, 1)) continue;
    touchHazard(state, hazard);
  }

  for (const power of state.powers) {
    if (power.dead || !hits(self, power, 1.1)) continue;
    collectPower(state, power);
  }

  if (state.entities.some((entity) => entity.dead)) {
    state.entities = state.entities.filter((entity) => !entity.dead);
  }
  if (state.powers.some((power) => power.dead)) {
    state.powers = state.powers.filter((power) => !power.dead);
  }
  if (state.hazards.some((hazard) => hazard.dead)) {
    state.hazards = state.hazards.filter((hazard) => !hazard.dead);
  }
}

// 咬尾判定：玩家必须绕到掠食者朝向的正后方（精英掠食者的专属破绽）
function isTailBite(player, entity) {
  const dx = player.x - entity.x;
  const dy = player.y - entity.y;
  const length = Math.hypot(dx, dy) || 1;
  const behind = (dx / length) * entity.facing;
  return behind < -0.25 || Math.abs(dy) / length > 0.86;
}

function biteTail(state, entity) {
  const player = state.player;
  entity.tailHits += 1;
  entity.stun = 1.5;
  entity.tier = Math.max(1, entity.tier - 1);
  entity.r = radiusForTier(entity.tier);
  entity.vx = -entity.facing * 170;
  entity.facing = -entity.facing;
  player.invuln = Math.max(player.invuln, 1.1);
  state.stats.score += 120 * (1 + entity.tailHits);
  emit(state, { type: "tail", x: entity.x, y: entity.y, hits: entity.tailHits, need: entity.tailNeed });
  if (entity.tailHits >= entity.tailNeed) {
    entity.dead = true;
    state.stats.tail += 1;
    state.stats.score += entity.boss ? 900 : 350;
    emit(state, { type: "subdue", x: entity.x, y: entity.y, boss: entity.boss });
  }
}

function biteHazardPlayer(state, entity) {
  const player = state.player;
  if (player.invuln > 0) return;
  if (state.shoal.length > 0) {
    // 随行鱼替你挡下这一口
    state.shoal.pop();
    player.invuln = 1.4;
    entity.stun = 0.9;
    emit(state, { type: "saved", x: player.x, y: player.y, left: state.shoal.length });
    return;
  }
  state.stats.hits += 1;
  player.hearts -= 1;
  player.invuln = PLAYER.invuln;
  player.stun = PLAYER.stun;
  player.tier = Math.max(state.startTier, player.tier - 1);
  player.growth = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.frenzy = 0;
  state.frenzyTimer = 0;
  // 被咬的瞬间把你从那张嘴里弹开：否则你会原地停在掠食者嘴边，
  // 等它的消化硬直一结束就立刻被咬第二口 —— 一次失误变成连环死亡。
  const awayX = player.x - entity.x;
  const awayY = player.y - entity.y;
  const away = Math.hypot(awayX, awayY) || 1;
  player.vx = (awayX / away) * 250;
  player.vy = (awayY / away) * 250;
  // 吃饱的掠食者需要消化，硬直必须比玩家的无敌整整长一拍，逃生窗口才是真的。
  entity.stun = Math.max(entity.stun, PLAYER.invuln + 0.9);
  emit(state, { type: "bitten", x: player.x, y: player.y, tier: player.tier, hearts: player.hearts });
  if (player.hearts <= 0) {
    state.status = STATUS.lost;
    emit(state, { type: "lost" });
  }
}

function damage(state, amount, cause) {
  const player = state.player;
  if (player.invuln > 0) return false;
  player.hearts -= amount;
  // 与「被咬」共用同一套受击宽容，别让海胆比掠食者更黏人。
  player.invuln = PLAYER.invuln;
  emit(state, { type: "damage", cause, x: player.x, y: player.y, hearts: player.hearts });
  if (player.hearts <= 0) {
    state.status = STATUS.lost;
    emit(state, { type: "lost" });
  }
  return true;
}

// 水雷冲击波：范围内的鱼被震晕并推开，给“冲刺撞雷”一个实打实的战术回报。
function shockwave(state, x, y, reach) {
  for (const entity of state.entities) {
    const dx = entity.x - x;
    const dy = entity.y - y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > reach) continue;
    const power = 1 - dist / reach;
    entity.stun = Math.max(entity.stun, 0.35 + power * 0.75);
    const push = 60 + power * 230;
    entity.vx += (dx / dist) * push;
    entity.vy += (dy / dist) * push;
  }
}

function touchHazard(state, hazard) {
  const player = state.player;
  if (hazard.kind === "jelly") {
    if (player.paralyze <= 0 && player.invuln <= 0) {
      player.paralyze = 1.5;
      emit(state, { type: "jelly", x: hazard.x, y: hazard.y });
    }
    return;
  }
  if (hazard.kind === "urchin") {
    if (damage(state, 1, "urchin")) emit(state, { type: "spike", x: hazard.x, y: hazard.y });
    return;
  }
  if (hazard.kind === "mine") {
    hazard.dead = true;
    // 冲刺撞爆水雷：不扣心，换来一圈冲击波把附近的鱼震晕推开（策划案 §3.3）。
    // 不冲刺就是硬撞 —— 扣心。这是“冲一下比绕一圈更划算”的取舍点。
    if (player.sprinting) {
      state.stats.score += 60;
      shockwave(state, hazard.x, hazard.y, 165);
      emit(state, { type: "defuse", x: hazard.x, y: hazard.y });
      return;
    }
    if (damage(state, 1, "mine")) emit(state, { type: "boom", x: hazard.x, y: hazard.y });
    return;
  }
  if (hazard.kind === "net") {
    // 冲刺撞破渔网，不扣心也不被缠（策划案 §3.3）。
    if (player.sprinting) {
      hazard.dead = true;
      state.stats.score += 40;
      emit(state, { type: "netBroke", x: hazard.x, y: hazard.y });
      return;
    }
    // 撞进网里：只有“缠住减速”，不扣心 —— 策划案 §3.3 的渔网条目是机动陷阱而非伤害物。
    // 网依然是深水最烦的东西（被缠住时掠食者就在旁边），但它的代价是走位，不是血量。
    if (player.snare <= 0) {
      player.snare = 2.2;
      hazard.dead = true;
      emit(state, { type: "snared", x: hazard.x, y: hazard.y });
    }
    return;
  }
  if (hazard.kind === "chest") {
    hazard.dead = true;
    state.stats.powers += 1;
    if (state.rng() < 0.8) {
      const kind = POWER_WEIGHTS_SAFE[Math.floor(state.rng() * POWER_WEIGHTS_SAFE.length)];
      const power = { ...spawnPower(state, kind), x: hazard.x, y: hazard.y, vx: 0, vy: 0 };
      emit(state, { type: "chest", x: hazard.x, y: hazard.y, good: true, power: power.power });
    } else {
      // 空箱：只被里面那团烂渔网缠一下，不扣心。
      // 策划案把宝箱定义为纯奖励（§3.2「宝箱（开出增益泡泡）」），
      // 所以它的“风险”是白跑一趟 + 被缠住挨一下，而不是掉血。
      player.snare = Math.max(player.snare, 1.6);
      emit(state, { type: "chest", x: hazard.x, y: hazard.y, good: false });
    }
  }
}
const POWER_WEIGHTS_SAFE = Object.freeze(["pearl", "lightning", "shoal", "frenzy"]);

function collectPower(state, power) {
  const player = state.player;
  power.dead = true;
  state.stats.powers += 1;
  const mult = growthMult(state);
  switch (power.power) {
    case "pearl":
      addGrowth(state, 12 * mult);
      break;
    case "lightning":
      player.lightning = 5;
      break;
    case "frenzy":
      state.combo = Math.max(state.combo, FRENZY_CHAIN[1]);
      state.frenzy = 1;
      state.frenzyTimer = FRENZY_DECAY + 1;
      state.comboTimer = COMBO_WINDOW;
      state.stats.bestFrenzy = Math.max(state.stats.bestFrenzy, state.frenzy);
      break;
    case "shoal":
      while (state.shoal.length < SHOAL_MAX) addFollower(state, pick(state.rng, [...SHOAL_SPECIES]));
      break;
    case "heart":
      if (player.hearts < player.maxHearts) player.hearts += 1;
      else state.stats.score += 260;
      break;
    default:
      break;
  }
  emit(state, { type: "power", power: power.power, x: power.x, y: power.y });
}

function addGrowth(state, amount) {
  const player = state.player;
  if (player.tier >= MAX_TIER) {
    state.stats.score += amount * 6;
    return;
  }
  player.growth += amount;
  while (player.tier < MAX_TIER && player.growth >= growthNeeded(player.tier)) {
    player.growth -= growthNeeded(player.tier);
    player.tier += 1;
    emit(state, { type: "grow", tier: player.tier });
  }
  if (player.tier >= MAX_TIER) player.growth = 0;
}

function addFollower(state, species) {
  if (state.shoal.length >= SHOAL_MAX) return;
  const player = state.player;
  const tier = Math.max(1, Math.min(player.tier - 1, 3));
  const follower = {
    species,
    tier,
    x: player.x - player.facing * (playerRadius(state) + 22),
    y: player.y + (state.shoal.length % 2 === 0 ? -18 : 18),
    vx: 0,
    vy: 0,
    r: radiusForTier(tier),
    facing: player.facing,
    bob: 0,
  };
  state.shoal.push(follower);
  emit(state, { type: "shoalJoin", count: state.shoal.length, species });
}

function eatFish(state, entity, options = {}) {
  const player = state.player;
  const mult = growthMult(state);
  const amount = eatYield(entity.tier) * mult * (options.growthMul ?? 1);
  entity.dead = true;

  state.stats.eaten += 1;
  state.stats.eatenBySpecies[entity.species] = (state.stats.eatenBySpecies[entity.species] ?? 0) + 1;
  addGrowth(state, amount);

  // 狂暴连锁：1.2 秒内不断链，5 连点燃狂暴、12 连双重狂暴。
  const frenzyOn = state.level.mechanics?.frenzy !== false;
  state.combo += 1;
  state.comboTimer = COMBO_WINDOW;
  if (frenzyOn) {
    if (state.combo >= FRENZY_CHAIN[2]) state.frenzy = 2;
    else if (state.combo >= FRENZY_CHAIN[1]) state.frenzy = 1;
    if (state.frenzy > 0) state.frenzyTimer = FRENZY_DECAY;
  }
  state.stats.bestCombo = Math.max(state.stats.bestCombo, state.combo);
  state.stats.bestFrenzy = Math.max(state.stats.bestFrenzy, state.frenzy);
  state.stats.score += eatYield(entity.tier) * FRENZY_MULT[state.frenzy] * (1 + player.tier * 0.12) + (options.byShoal ? 4 : 0);

  if (state.combo > 1) emit(state, { type: "combo", combo: state.combo, frenzy: state.frenzy, x: player.x, y: player.y });
  if (state.frenzy > 0 && state.combo === FRENZY_CHAIN[state.frenzy]) {
    emit(state, { type: "frenzy", level: state.frenzy });
  }

  // 鱼群同行：攒够同种三条即入列（最多三尾）
  if (state.level.mechanics?.shoal && entity.shoalable && !options.byShoal) {
    const progress = (state.shoalProgress[entity.species] ?? 0) + 1;
    if (progress >= SHOAL_PER) {
      state.shoalProgress[entity.species] = 0;
      if (state.shoal.length < SHOAL_MAX) addFollower(state, entity.species);
    } else {
      state.shoalProgress[entity.species] = progress;
    }
  }

  if (entity.poison) {
    player.poison = 2;
    emit(state, { type: "poisoned", x: entity.x, y: entity.y });
  }
  emit(state, { type: "eat", x: entity.x, y: entity.y, tier: entity.tier, species: entity.species, byShoal: Boolean(options.byShoal) });
}

function maintainPopulation(state, step) {
  const player = state.player;
  const level = state.level;
  const mechanics = level.mechanics ?? {};
  const rng = state.rng;

  state.spawnTimer -= step;
  const deficit = MIN_EDIBLE - edibleCount(state);
  const crowded = state.entities.length >= MAX_PREY;
  if ((deficit > 0 || state.spawnTimer <= 0) && !crowded) {
    if (deficit > 0) {
      for (let i = 0; i < deficit; i += 1) spawnFish(state, { forceEdible: true });
      state.spawnTimer = 0.9;
    } else {
      spawnFish(state);
      const rate = state.mode === "abyss" ? 0.42 : 0.85;
      state.spawnTimer = range(rng, rate * 0.6, rate * 1.5);
    }
  }

  // 深渊越深越凶：定期补刷掠食者
  if (state.mode === "abyss") {
    const hunters = state.entities.filter((entity) => entity.tier > player.tier).length;
    const quota = 2 + Math.floor(state.abyss.depth / ABYSS.hunterEvery);
    if (hunters < Math.min(6, quota) && state.entities.length < MAX_PREY + 4 && rng() < step * 0.6) {
      const tier = clamp(state.abyss.tierCap, player.tier + 1, MAX_TIER);
      spawnFish(state, { tier, species: pick(rng, ["shark", "orca", "grouper"]), x: range(rng, 120, state.world.width - 120), y: state.world.height + 90 });
    }
  }

  state.powerTimer -= step;
  if (state.powerTimer <= 0) {
    const weights = level.powers ?? {};
    const entries = POWER_KINDS.map((kind) => ({ kind, weight: weights[kind] ?? 0 })).filter((entry) => entry.weight > 0);
    if (entries.length) {
      let total = entries.reduce((sum, entry) => sum + entry.weight, 0);
      let roll = rng() * total;
      let chosen = entries[entries.length - 1].kind;
      for (const entry of entries) {
        roll -= entry.weight;
        if (roll <= 0) {
          chosen = entry.kind;
          break;
        }
      }
      spawnPower(state, chosen);
    }
    const base = mechanics.pressure ? 4.6 : 6.2;
    state.powerTimer = range(rng, base * 0.7, base * 1.5);
  }

  // 海藻/水母等静态物件的呼吸相位
  for (const patch of state.kelp) patch.phase += step * 0.6;
}

function goalReached(state) {
  const goal = state.level.goal ?? {};
  if (goal.type === "grow") return state.player.tier >= goal.tier;
  if (goal.type === "eat") return state.stats.eaten >= goal.count;
  if (goal.type === "tail") return state.stats.tail >= goal.count;
  return false;
}

function checkOutcome(state) {
  if (state.status !== STATUS.playing) return;
  if (state.mode === "abyss") return;
  if (goalReached(state)) {
    state.status = STATUS.won;
    emit(state, { type: "won" });
    return;
  }
  if (state.timeLimit !== Infinity && state.time >= state.timeLimit) {
    state.status = STATUS.lost;
    emit(state, { type: "timeout" });
    emit(state, { type: "lost" });
  }
}

// ---------- 会话级工具（供 game.mjs / 测试使用） ----------
export function setWorldHeight(state, height) {
  const next = clamp(height, 480, 1800);
  state.world.height = next;
  const player = state.player;
  const radius = playerRadius(state);
  player.y = clamp(player.y, radius * 0.6, next - radius * 0.6);
  for (const entity of state.entities) {
    entity.y = clamp(entity.y, entity.r, next - entity.r);
  }
  for (const hazard of state.hazards) hazard.y = clamp(hazard.y, hazard.r, next - hazard.r);
  for (const power of state.powers) power.y = clamp(power.y, power.r, next - power.r);
  return state;
}

export function pauseState(state) {
  if (state.status === STATUS.playing) {
    state.status = STATUS.paused;
    return true;
  }
  return false;
}

export function resumeState(state) {
  if (state.status === STATUS.paused) {
    state.status = STATUS.playing;
    return true;
  }
  return false;
}

export function createAbyssLevel() {
  return {
    id: "abyss",
    zone: 0,
    index: 0,
    nameZh: "深渊",
    nameEn: "Abyss",
    startTier: 2,
    hearts: 3,
    timeLimit: Infinity,
    initialPrey: 12,
    goal: { type: "endless" },
    preyTiers: [1, 2, 3],
    species: [...SHOAL_SPECIES, "grouper", "poison"],
    hazards: {},
    powers: { pearl: 3, lightning: 2, shoal: 2, frenzy: 2, heart: 1 },
    mechanics: { frenzy: true, shoal: true, poison: true, pressure: false, elite: false, kelp: false },
    spawn: { hunters: [{ tier: 4, species: "shark", count: 1 }] },
  };
}

// 深渊里猎物阶数围绕玩家当前阶浮动，保证永远有得吃、也永远有人在追。
export function abyssTick(state, step) {
  const player = state.player;
  const rng = state.rng;
  const cap = state.abyss.tierCap;
  for (const entity of state.entities) {
    if (entity.dead) continue;
    if (state.time - entity.born > 16 && entity.tier < cap && rng() < step * 0.16) {
      entity.tier = Math.min(cap, entity.tier + 1);
      entity.r = radiusForTier(entity.tier);
    }
    if (entity.tier > cap + 1) entity.dead = true;
  }
  if (rng() < step * 0.5 && state.entities.length < MAX_PREY + 4) {
    const tier = clamp(player.tier + randInt(rng, -1, 1), 1, cap);
    spawnFish(state, { tier, x: range(rng, 90, state.world.width - 90), y: state.world.height + 90 });
  }
}
