// 符文塔防核心规则引擎（纯函数、DOM-free、100% 规则权威）

// Mulberry32 确定性种子随机数发生器
export function createPRNG(seed = 12345) {
  let s = Math.floor(seed) >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 战场逻辑视窗规格
export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 600;

// 回廊贝塞尔航点定义（双 S 型经典路线）
export const PATH_WAYPOINTS = [
  { x: 20, y: 90 },
  { x: 220, y: 90 },
  { x: 340, y: 120 },
  { x: 380, y: 240 },
  { x: 310, y: 340 },
  { x: 180, y: 350 },
  { x: 100, y: 440 },
  { x: 160, y: 520 },
  { x: 380, y: 530 },
  { x: 540, y: 480 },
  { x: 600, y: 360 },
  { x: 570, y: 220 },
  { x: 670, y: 120 },
  { x: 820, y: 130 },
  { x: 880, y: 240 },
  { x: 850, y: 380 },
  { x: 910, y: 500 },
];

// 预计算回廊细分点与累计弧长（保证恒定线速度推进）
function buildPathSegments(waypoints, samplesPerCurve = 30) {
  const points = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p0 = waypoints[Math.max(0, i - 1)];
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    const p3 = waypoints[Math.min(waypoints.length - 1, i + 2)];

    for (let step = 0; step < samplesPerCurve; step++) {
      const t = step / samplesPerCurve;
      // Catmull-Rom 样条平滑插值
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      points.push({ x, y });
    }
  }
  points.push(waypoints[waypoints.length - 1]);

  const distances = [0];
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    totalLength += Math.hypot(dx, dy);
    distances.push(totalLength);
  }

  return { points, distances, totalLength };
}

export const PATH_DATA = buildPathSegments(PATH_WAYPOINTS);

export function getPositionAtProgress(progress) {
  const clamped = Math.max(0, Math.min(1, progress));
  const targetDist = clamped * PATH_DATA.totalLength;
  const { distances, points } = PATH_DATA;

  // 二分查找对应段
  let low = 0;
  let high = distances.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (distances[mid] < targetDist) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const idx = Math.max(1, Math.min(points.length - 1, low));
  const prevDist = distances[idx - 1];
  const nextDist = distances[idx];
  const segLen = nextDist - prevDist;
  const ratio = segLen > 0.0001 ? (targetDist - prevDist) / segLen : 0;

  const p1 = points[idx - 1];
  const p2 = points[idx];
  return {
    x: p1.x + (p2.x - p1.x) * ratio,
    y: p1.y + (p2.y - p1.y) * ratio,
  };
}

// 10 个战略石基坐标（紧密分布在入弯、十字打击及末端防区）
export const PEDESTALS = [
  { id: "P1", x: 140, y: 170 },
  { id: "P2", x: 270, y: 210 },
  { id: "P3", x: 230, y: 430 },
  { id: "P4", x: 380, y: 410 },
  { id: "P5", x: 470, y: 260 },
  { id: "P6", x: 490, y: 140 },
  { id: "P7", x: 730, y: 220 },
  { id: "P8", x: 740, y: 390 },
  { id: "P9", x: 700, y: 490 },
  { id: "P10", x: 820, y: 520 },
];

// 四系符文基础属性
export const RUNES = {
  arcane: {
    id: "arcane",
    cost: 70,
    range: 165,
    fireRate: 2.2, // 发/秒
    damage: 16,
    color: "#00f5d4",
    bulletSpeed: 520,
    splashRadius: 0,
  },
  flame: {
    id: "flame",
    cost: 85,
    range: 135,
    fireRate: 0.85,
    damage: 32,
    color: "#ff5400",
    bulletSpeed: 380,
    splashRadius: 52,
    burnDmgPerSec: 6,
    burnDuration: 3.5,
  },
  frost: {
    id: "frost",
    cost: 75,
    range: 140,
    fireRate: 1.1,
    damage: 9,
    color: "#00bbf9",
    bulletSpeed: 420,
    slowAmount: 0.45,
    slowDuration: 2.8,
  },
  storm: {
    id: "storm",
    cost: 95,
    range: 155,
    fireRate: 0.95,
    damage: 36,
    color: "#9d4edd",
    chainTargets: 3,
    chainRange: 95,
  },
};

export const TIER_MULTIPLIERS = {
  1: { costMult: 1.0, dmgMult: 1.0, rangeMult: 1.0, rateMult: 1.0 },
  2: { costMult: 1.6, dmgMult: 1.7, rangeMult: 1.15, rateMult: 1.15 },
  3: { costMult: 2.6, dmgMult: 2.6, rangeMult: 1.3, rateMult: 1.3 },
};

// 20 张质变级遗物定义
export const ALL_RELICS = [
  { id: "relic_split_arrow", type: "ballistics", tier: 1 },
  { id: "relic_frostbite", type: "elemental", tier: 1 },
  { id: "relic_combustion", type: "elemental", tier: 1 },
  { id: "relic_superconduct", type: "elemental", tier: 1 },
  { id: "relic_mana_harvest", type: "economy", tier: 1 },
  { id: "relic_piercing_beam", type: "ballistics", tier: 2 },
  { id: "relic_blazing_core", type: "elemental", tier: 2 },
  { id: "relic_blizzard_field", type: "elemental", tier: 2 },
  { id: "relic_thunder_burst", type: "elemental", tier: 2 },
  { id: "relic_crystal_shield", type: "economy", tier: 2 },
  { id: "relic_rush_bounty", type: "economy", tier: 1 },
  { id: "relic_focus_lens", type: "tactical", tier: 1 },
  { id: "relic_chain_melt", type: "elemental", tier: 2 },
  { id: "relic_arcane_tempo", type: "tactical", tier: 1 },
  { id: "relic_heavy_impact", type: "tactical", tier: 2 },
  { id: "relic_static_field", type: "tactical", tier: 2 },
  { id: "relic_alchemical_rush", type: "economy", tier: 1 },
  { id: "relic_executioner", type: "tactical", tier: 3 },
  { id: "relic_hyper_charge", type: "tactical", tier: 3 },
  { id: "relic_stagger_shock", type: "tactical", tier: 3 },
];

// 魔物配置生成工厂
export function createMonsterArchetype(type, wave, id) {
  const hpScale = Math.pow(wave, 1.28);
  switch (type) {
    case "crawler":
      return {
        id,
        type: "crawler",
        maxHp: Math.round(45 + 10 * hpScale),
        hp: Math.round(45 + 10 * hpScale),
        speed: 85,
        armor: 0,
        reward: 7,
        radius: 12,
        color: "#38b000",
      };
    case "golem":
      return {
        id,
        type: "golem",
        maxHp: Math.round(180 + 38 * hpScale),
        hp: Math.round(180 + 38 * hpScale),
        speed: 46,
        armor: 0.35, // 35% 物理减免，受雷电伤害脆弱
        reward: 18,
        radius: 19,
        color: "#6c757d",
      };
    case "banshee":
      return {
        id,
        type: "banshee",
        maxHp: Math.round(90 + 20 * hpScale),
        hp: Math.round(90 + 20 * hpScale),
        speed: 72,
        armor: 0,
        immuneSlow: true,
        reward: 14,
        radius: 14,
        color: "#c77dff",
      };
    case "beetle":
      return {
        id,
        type: "beetle",
        maxHp: Math.round(65 + 14 * hpScale),
        hp: Math.round(65 + 14 * hpScale),
        speed: 62,
        armor: 0,
        reward: 11,
        radius: 13,
        color: "#ff7b00",
        explodeOnDeath: true,
      };
    case "boss_wave_5":
      return {
        id,
        type: "boss",
        bossType: "titanus",
        nameKey: "monsterBoss1",
        maxHp: Math.round(850 + 120 * hpScale),
        hp: Math.round(850 + 120 * hpScale),
        maxShield: Math.round(350 + 60 * hpScale),
        shield: Math.round(350 + 60 * hpScale),
        speed: 38,
        armor: 0.25,
        reward: 90,
        radius: 28,
        color: "#ffb703",
        staggerTimer: 0,
      };
    case "boss_wave_10":
      return {
        id,
        type: "boss",
        bossType: "twin",
        nameKey: "monsterBoss2",
        maxHp: Math.round(2200 + 200 * hpScale),
        hp: Math.round(2200 + 200 * hpScale),
        maxShield: Math.round(700 + 100 * hpScale),
        shield: Math.round(700 + 100 * hpScale),
        speed: 42,
        armor: 0.2,
        reward: 150,
        radius: 29,
        color: "#219ebc",
        elementCycleTimer: 0,
        immuneElement: "frost", // 冰火轮替
        staggerTimer: 0,
      };
    case "boss_wave_15":
      return {
        id,
        type: "boss",
        bossType: "void_weaver",
        nameKey: "monsterBoss3",
        maxHp: Math.round(4800 + 350 * hpScale),
        hp: Math.round(4800 + 350 * hpScale),
        maxShield: Math.round(1400 + 160 * hpScale),
        shield: Math.round(1400 + 160 * hpScale),
        speed: 40,
        armor: 0.15,
        reward: 220,
        radius: 30,
        color: "#7209b7",
        shroudTimer: 0,
        staggerTimer: 0,
      };
    case "boss_wave_20":
      return {
        id,
        type: "boss",
        bossType: "oblivion",
        nameKey: "monsterBoss4",
        maxHp: Math.round(10000 + 600 * hpScale),
        hp: Math.round(10000 + 600 * hpScale),
        maxShield: Math.round(2600 + 300 * hpScale),
        shield: Math.round(2600 + 300 * hpScale),
        speed: 45,
        armor: 0.3,
        reward: 500,
        radius: 34,
        color: "#d90429",
        phase: 1,
        staggerTimer: 0,
      };
    default:
      return createMonsterArchetype("crawler", wave, id);
  }
}

// 波次魔物编成生成
export function getWaveComposition(wave) {
  if (wave === 5) return [{ type: "boss_wave_5", count: 1, interval: 1.0 }, { type: "crawler", count: 8, interval: 0.8 }];
  if (wave === 10) return [{ type: "boss_wave_10", count: 1, interval: 1.0 }, { type: "golem", count: 6, interval: 1.4 }];
  if (wave === 15) return [{ type: "boss_wave_15", count: 1, interval: 1.0 }, { type: "banshee", count: 10, interval: 0.9 }];
  if (wave === 20) return [{ type: "boss_wave_20", count: 1, interval: 1.0 }, { type: "beetle", count: 14, interval: 0.6 }];

  const groups = [];
  // 随波次递增编队
  const crawlerCount = Math.min(26, 6 + wave * 2);
  groups.push({ type: "crawler", count: crawlerCount, interval: Math.max(0.4, 0.9 - wave * 0.02) });

  if (wave >= 3) {
    const golemCount = Math.min(10, Math.floor(wave / 2));
    groups.push({ type: "golem", count: golemCount, interval: 1.5 });
  }
  if (wave >= 7) {
    const bansheeCount = Math.min(12, Math.floor(wave / 2) + 1);
    groups.push({ type: "banshee", count: bansheeCount, interval: 1.1 });
  }
  if (wave >= 11) {
    const beetleCount = Math.min(14, Math.floor(wave / 1.8));
    groups.push({ type: "beetle", count: beetleCount, interval: 0.85 });
  }

  return groups;
}

// 初始化对局状态
export function createInitialState({ seed = 12345 } = {}) {
  const prng = createPRNG(seed);
  return {
    seed,
    prngSeedStep: 0,
    status: "PREPARING", // PREPARING | COMBAT | RELIC_DRAFT | VICTORY | GAMEOVER
    wave: 1,
    maxWaves: 20,
    crystalHp: 20,
    maxCrystalHp: 20,
    mana: 220, // 初始充沛法力，可建 2~3 座基础塔
    score: 0,
    kills: 0,
    elapsedSeconds: 0,

    // 玩家防御塔分布
    towers: {}, // { [pedestalId]: { id, type, tier, levelCost, kills, cooldown } }

    // 战场实体
    monsters: [],
    projectiles: [],
    particles: [], // 瞬态渲染粒子
    combatEvents: [], // 事件日志供音效与 UI 使用

    // 出怪队列
    spawnQueue: [],
    spawnTimer: 0,
    waveStarted: false,

    // 战术交互
    focusTargetId: null,
    gameSpeed: 1, // 1 | 2 | 3

    // 肉鸽遗物系统
    activeRelics: [], // [relicId, ...]
    draftOptions: [], // 当前三选一卡池
    rerollsLeft: 2,
    monstersKilledSinceHarvest: 0,

    // 统计记录
    damageDealtByType: { arcane: 0, flame: 0, frost: 0, storm: 0 },
  };
}

// 章节选关初始状态生成器
export function createInitialStateForChapter(chapter = 1, { seed = 12345 } = {}) {
  const base = createInitialState({ seed });
  const validChapter = Math.max(1, Math.min(4, Math.floor(chapter)));
  if (validChapter === 1) return base;

  const prng = createPRNG(seed + validChapter * 31337);
  const shuffledRelics = [...ALL_RELICS].sort(() => prng() - 0.5);

  if (validChapter === 2) {
    return {
      ...base,
      wave: 6,
      mana: 550,
      activeRelics: shuffledRelics.slice(0, 2).map((r) => r.id),
      score: 500,
    };
  } else if (validChapter === 3) {
    return {
      ...base,
      wave: 11,
      mana: 950,
      activeRelics: shuffledRelics.slice(0, 4).map((r) => r.id),
      score: 1200,
    };
  } else {
    // Chapter 4
    return {
      ...base,
      wave: 16,
      mana: 1500,
      activeRelics: shuffledRelics.slice(0, 6).map((r) => r.id),
      score: 2200,
    };
  }
}

// 抽取三选一卡牌（支持智能加权与防重复）
export function generateRelicDraft(state) {
  const prng = createPRNG(state.seed + state.wave * 997 + state.prngSeedStep++);
  const existing = new Set(state.activeRelics);
  const candidates = ALL_RELICS.filter((r) => !existing.has(r.id));

  if (candidates.length <= 3) {
    return candidates.map((c) => c.id);
  }

  // 统计玩家已有塔类型做智能加权
  const typeCounts = { arcane: 0, flame: 0, frost: 0, storm: 0 };
  for (const t of Object.values(state.towers)) {
    typeCounts[t.type] = (typeCounts[t.type] || 0) + 1;
  }

  const scored = candidates.map((c) => {
    let weight = 10;
    if (c.id.includes("arcane") || c.id.includes("split") || c.id.includes("pierce")) weight += typeCounts.arcane * 6;
    if (c.id.includes("flame") || c.id.includes("combustion") || c.id.includes("blazing")) weight += typeCounts.flame * 6;
    if (c.id.includes("frost") || c.id.includes("blizzard")) weight += typeCounts.frost * 6;
    if (c.id.includes("storm") || c.id.includes("thunder") || c.id.includes("superconduct")) weight += typeCounts.storm * 6;
    if (state.crystalHp < 12 && c.id === "relic_crystal_shield") weight += 35; // 残血急救保底加权
    return { ...c, weight: weight + prng() * 5 };
  });

  scored.sort((a, b) => b.weight - a.weight);
  return scored.slice(0, 3).map((c) => c.id);
}

// 建塔操作
export function buildTower(state, pedestalId, type) {
  if (state.status === "VICTORY" || state.status === "GAMEOVER") return { state, ok: false, reason: "game_ended" };
  const pedestal = PEDESTALS.find((p) => p.id === pedestalId);
  if (!pedestal) return { state, ok: false, reason: "invalid_pedestal" };
  if (state.towers[pedestalId]) return { state, ok: false, reason: "already_built" };

  const rune = RUNES[type];
  if (!rune) return { state, ok: false, reason: "invalid_rune" };

  const costDiscount = state.activeRelics.includes("relic_alchemical_rush") ? 0.85 : 1.0;
  const actualCost = Math.round(rune.cost * costDiscount);

  if (state.mana < actualCost) return { state, ok: false, reason: "insufficient_mana" };

  const nextTowers = {
    ...state.towers,
    [pedestalId]: {
      id: pedestalId,
      x: pedestal.x,
      y: pedestal.y,
      type,
      tier: 1,
      totalInvested: actualCost,
      cooldown: 0,
      kills: 0,
    },
  };

  return {
    state: {
      ...state,
      mana: state.mana - actualCost,
      towers: nextTowers,
    },
    ok: true,
  };
}

// 升阶塔
export function upgradeTower(state, pedestalId) {
  const current = state.towers[pedestalId];
  if (!current) return { state, ok: false, reason: "no_tower" };
  if (current.tier >= 3) return { state, ok: false, reason: "max_tier" };

  const nextTier = current.tier + 1;
  const rune = RUNES[current.type];
  const mult = TIER_MULTIPLIERS[nextTier];
  const costDiscount = state.activeRelics.includes("relic_alchemical_rush") ? 0.85 : 1.0;
  const upgradeCost = Math.round(rune.cost * mult.costMult * 0.9 * costDiscount);

  if (state.mana < upgradeCost) return { state, ok: false, reason: "insufficient_mana" };

  const updatedTower = {
    ...current,
    tier: nextTier,
    totalInvested: current.totalInvested + upgradeCost,
  };

  return {
    state: {
      ...state,
      mana: state.mana - upgradeCost,
      towers: { ...state.towers, [pedestalId]: updatedTower },
    },
    ok: true,
  };
}

// 分解拆除塔
export function salvageTower(state, pedestalId) {
  const current = state.towers[pedestalId];
  if (!current) return { state, ok: false, reason: "no_tower" };

  const refund = Math.round(current.totalInvested * 0.75);
  const nextTowers = { ...state.towers };
  delete nextTowers[pedestalId];

  return {
    state: {
      ...state,
      mana: state.mana + refund,
      towers: nextTowers,
    },
    ok: true,
    refund,
  };
}

// 设定集火目标
export function setFocusTarget(state, monsterId) {
  return {
    ...state,
    focusTargetId: state.focusTargetId === monsterId ? null : monsterId,
  };
}

// 开始波次
export function startWave(state) {
  if (state.status !== "PREPARING") return { state, ok: false };
  const waveComp = getWaveComposition(state.wave);
  const queue = [];
  let uid = 1;
  for (const item of waveComp) {
    for (let i = 0; i < item.count; i++) {
      queue.push({
        type: item.type,
        delay: item.interval,
        id: `M_W${state.wave}_${uid++}`,
      });
    }
  }

  return {
    state: {
      ...state,
      status: "COMBAT",
      spawnQueue: queue,
      spawnTimer: 0.2, // 延迟微调后出怪
      waveStarted: true,
      combatEvents: [...state.combatEvents, { type: "wave_start", wave: state.wave }],
    },
    ok: true,
  };
}

// 提前召怪（Rush Wave 赚利息）
export function rushWave(state) {
  if (state.status !== "COMBAT") return { state, ok: false };
  const rushBonus = state.activeRelics.includes("relic_rush_bounty") ? 40 : 20;
  const remainingSpawn = state.spawnQueue.length;
  // 立即将生成延迟压缩 80%
  const compressedQueue = state.spawnQueue.map((item) => ({ ...item, delay: item.delay * 0.2 }));

  return {
    state: {
      ...state,
      mana: state.mana + rushBonus + Math.round(remainingSpawn * 1.5),
      spawnQueue: compressedQueue,
      spawnTimer: 0.05,
      combatEvents: [...state.combatEvents, { type: "wave_rush", bonus: rushBonus }],
    },
    ok: true,
  };
}

// 挑选遗物
export function draftRelic(state, relicId) {
  if (state.status !== "RELIC_DRAFT") return { state, ok: false };
  if (!state.draftOptions.includes(relicId)) return { state, ok: false, reason: "not_in_draft" };

  let nextHp = state.crystalHp;
  let nextMaxHp = state.maxCrystalHp;
  if (relicId === "relic_crystal_shield") {
    nextHp = Math.min(nextMaxHp, nextHp + 3);
  }

  const nextWave = state.wave + 1;
  const isFinalVictory = state.wave >= state.maxWaves;

  return {
    state: {
      ...state,
      status: isFinalVictory ? "VICTORY" : "PREPARING",
      wave: isFinalVictory ? state.wave : nextWave,
      crystalHp: nextHp,
      activeRelics: [...state.activeRelics, relicId],
      draftOptions: [],
      combatEvents: [...state.combatEvents, { type: isFinalVictory ? "victory" : "relic_chosen", relicId }],
    },
    ok: true,
  };
}

// 重抽遗物
export function rerollRelics(state) {
  if (state.status !== "RELIC_DRAFT") return { state, ok: false };
  if (state.rerollsLeft <= 0) return { state, ok: false, reason: "no_rerolls" };

  const nextState = {
    ...state,
    rerollsLeft: state.rerollsLeft - 1,
  };
  const newDraft = generateRelicDraft(nextState);

  return {
    state: {
      ...nextState,
      draftOptions: newDraft,
    },
    ok: true,
  };
}

// 帧步进推进函数（标准固定步长 stepFrame）
export function stepFrame(state, dt) {
  if (state.status !== "COMBAT") return state;

  const events = [];
  let mana = state.mana;
  let crystalHp = state.crystalHp;
  let score = state.score;
  let kills = state.kills;
  let harvestCount = state.monstersKilledSinceHarvest;
  let status = state.status;
  let draftOptions = state.draftOptions;

  // 1. 处理出怪队列
  let spawnTimer = state.spawnTimer - dt;
  const spawnQueue = [...state.spawnQueue];
  const monsters = [...state.monsters];

  while (spawnTimer <= 0 && spawnQueue.length > 0) {
    const nextSpawn = spawnQueue.shift();
    const archetype = createMonsterArchetype(nextSpawn.type, state.wave, nextSpawn.id);
    monsters.push({
      ...archetype,
      progress: 0,
      x: PATH_WAYPOINTS[0].x,
      y: PATH_WAYPOINTS[0].y,
      burnTimer: 0,
      burnDmg: 0,
      slowTimer: 0,
      slowFactor: 1.0,
      frozenTimer: 0,
      superconductTimer: 0,
    });
    spawnTimer = nextSpawn.delay;
  }

  // 2. 推进魔物行进与状态衰减
  const survivingMonsters = [];
  for (let i = 0; i < monsters.length; i++) {
    const m = { ...monsters[i] };

    // 冰冻或眩晕硬直中
    if (m.frozenTimer > 0) {
      m.frozenTimer = Math.max(0, m.frozenTimer - dt);
    } else if (m.staggerTimer > 0) {
      m.staggerTimer = Math.max(0, m.staggerTimer - dt);
    } else {
      // 减速处理
      let currentSpeed = m.speed;
      if (m.slowTimer > 0 && !m.immuneSlow) {
        m.slowTimer = Math.max(0, m.slowTimer - dt);
        currentSpeed *= m.slowFactor;
      }
      if (state.activeRelics.includes("relic_static_field") && m.progress < 0.25) {
        currentSpeed *= 0.85;
      }

      // 沿路径前进
      const distTraveled = currentSpeed * dt;
      m.progress += distTraveled / PATH_DATA.totalLength;
    }

    const pos = getPositionAtProgress(m.progress);
    m.x = pos.x;
    m.y = pos.y;

    // 灼烧 DOT 结算
    if (m.burnTimer > 0) {
      m.burnTimer = Math.max(0, m.burnTimer - dt);
      let burnTick = m.burnDmg * dt;
      if (state.activeRelics.includes("relic_blazing_core")) burnTick *= 1.5;
      m.hp -= burnTick;
    }

    // 超导状态衰减
    if (m.superconductTimer > 0) {
      m.superconductTimer = Math.max(0, m.superconductTimer - dt);
    }

    // 首领特异计时器更新
    if (m.type === "boss") {
      if (m.bossType === "twin") {
        m.elementCycleTimer = (m.elementCycleTimer || 0) + dt;
        if (m.elementCycleTimer > 6.0) {
          m.elementCycleTimer = 0;
          m.immuneElement = m.immuneElement === "frost" ? "flame" : "frost";
          events.push({ type: "boss_cycle", immune: m.immuneElement });
        }
      }
    }

    // 逃脱判定：魔物到达终点
    if (m.progress >= 1.0) {
      let penalty = m.type === "boss" ? 5 : m.type === "golem" ? 2 : 1;
      // 圣所共鸣概率格挡
      if (state.activeRelics.includes("relic_crystal_shield") && Math.random() < 0.3) {
        penalty = 0;
        events.push({ type: "crystal_blocked" });
      }
      crystalHp = Math.max(0, crystalHp - penalty);
      events.push({ type: "monster_escaped", penalty, monsterId: m.id });
      continue;
    }

    // 阵亡判定已在伤害处拦截，生命正常保留
    if (m.hp > 0) {
      survivingMonsters.push(m);
    } else {
      // 触发阵亡逻辑
      events.push({ type: "monster_slain", monster: m });
      mana += m.reward;
      score += m.reward * 10;
      kills += 1;
      harvestCount += 1;

      // 自爆熔甲虫加速周围魔物
      if (m.explodeOnDeath) {
        for (const nearby of survivingMonsters) {
          if (Math.hypot(nearby.x - m.x, nearby.y - m.y) < 85) {
            nearby.speed *= 1.35;
          }
        }
        events.push({ type: "beetle_explode", x: m.x, y: m.y });
      }

      // 余烬扩散：周围被点燃
      if (state.activeRelics.includes("relic_combustion") && m.burnTimer > 0) {
        for (const nearby of survivingMonsters) {
          if (Math.hypot(nearby.x - m.x, nearby.y - m.y) < 75) {
            nearby.burnTimer = 3.0;
            nearby.burnDmg = 8;
          }
        }
      }

      // 法力汲取：每 10 击杀返还 15 法力
      if (state.activeRelics.includes("relic_mana_harvest") && harvestCount >= 10) {
        mana += 15;
        harvestCount = 0;
        events.push({ type: "mana_harvest", amount: 15 });
      }
    }
  }

  // 3. 符文塔索敌与射击
  const towers = { ...state.towers };
  const projectiles = [...state.projectiles];
  const dmgStats = { ...state.damageDealtByType };

  // 索敌策略：优先玩家手动集火，其次最靠近终点的怪物（progress 最大）
  const getTargetForTower = (tower, range) => {
    if (state.focusTargetId) {
      const focused = survivingMonsters.find((m) => m.id === state.focusTargetId);
      if (focused && Math.hypot(focused.x - tower.x, focused.y - tower.y) <= range) {
        return focused;
      }
    }
    let best = null;
    let maxProgress = -1;
    for (const m of survivingMonsters) {
      const dist = Math.hypot(m.x - tower.x, m.y - tower.y);
      if (dist <= range && m.progress > maxProgress) {
        maxProgress = m.progress;
        best = m;
      }
    }
    return best;
  };

  for (const [pId, t] of Object.entries(towers)) {
    const updatedTower = { ...t };
    const rune = RUNES[t.type];
    const tierMult = TIER_MULTIPLIERS[t.tier];

    let attackRange = rune.range * tierMult.rangeMult;
    let attackRate = rune.fireRate * tierMult.rateMult;
    let baseDamage = rune.damage * tierMult.dmgMult;

    // 遗物词条修正
    if (state.activeRelics.includes("relic_hyper_charge")) {
      baseDamage *= 1.2;
      attackRange *= 1.15;
    }
    if (t.type === "arcane" && state.activeRelics.includes("relic_arcane_tempo")) {
      attackRate *= 1.3;
    }

    updatedTower.cooldown = Math.max(0, updatedTower.cooldown - dt);

    if (updatedTower.cooldown <= 0) {
      const target = getTargetForTower(updatedTower, attackRange);
      if (target) {
        updatedTower.cooldown = 1.0 / attackRate;

        // 生成弹道
        if (t.type === "storm") {
          // 雷霆为瞬发链式电弧
          events.push({ type: "lightning_strike", from: { x: t.x, y: t.y }, targetId: target.id });
          applyStormDamage(target, baseDamage, updatedTower, survivingMonsters, state, events, dmgStats);
        } else {
          projectiles.push({
            id: `P_${Date.now()}_${Math.random()}`,
            type: t.type,
            tier: t.tier,
            x: t.x,
            y: t.y,
            targetId: target.id,
            targetPos: { x: target.x, y: target.y },
            speed: rune.bulletSpeed,
            damage: baseDamage,
            splashRadius: rune.splashRadius || 0,
            towerPedestalId: pId,
          });
          events.push({ type: "tower_fire", towerType: t.type, x: t.x, y: t.y });
        }
      }
    }
    towers[pId] = updatedTower;
  }

  // 4. 推进弹道飞向目标
  const survivingProjectiles = [];
  for (let i = 0; i < projectiles.length; i++) {
    const p = { ...projectiles[i] };
    const target = survivingMonsters.find((m) => m.id === p.targetId);

    // 锁定目标实时位置，若已死亡则飞向最后记录点
    const destX = target ? target.x : p.targetPos.x;
    const destY = target ? target.y : p.targetPos.y;

    const dx = destX - p.x;
    const dy = destY - p.y;
    const dist = Math.hypot(dx, dy);
    const step = p.speed * dt;

    if (dist <= step || dist < 12) {
      // 命中目标结算
      applyProjectileHit(p, target, survivingMonsters, state, events, dmgStats);
    } else {
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;
      p.targetPos = { x: destX, y: destY };
      survivingProjectiles.push(p);
    }
  }

  // 5. 胜负与波次完成检测
  if (crystalHp <= 0) {
    status = "GAMEOVER";
    events.push({ type: "defeat", wave: state.wave });
  } else if (spawnQueue.length === 0 && survivingMonsters.length === 0 && state.waveStarted) {
    // 当前波全部歼灭
    status = "RELIC_DRAFT";
    draftOptions = generateRelicDraft({ ...state, wave: state.wave, activeRelics: state.activeRelics });
    events.push({ type: "wave_cleared", wave: state.wave });
  }

  return {
    ...state,
    status,
    crystalHp,
    mana,
    score,
    kills,
    elapsedSeconds: state.elapsedSeconds + dt,
    spawnQueue,
    spawnTimer,
    monsters: survivingMonsters,
    projectiles: survivingProjectiles,
    towers,
    draftOptions,
    monstersKilledSinceHarvest: harvestCount,
    damageDealtByType: dmgStats,
    combatEvents: events,
  };
}

// 弹道命中结算
function applyProjectileHit(p, directTarget, allMonsters, state, events, dmgStats) {
  const isFocused = state.focusTargetId && directTarget && state.focusTargetId === directTarget.id;
  let finalDmg = p.damage;
  if (isFocused && state.activeRelics.includes("relic_focus_lens")) {
    finalDmg *= 1.45;
  }

  if (p.type === "arcane") {
    dmgStats.arcane = (dmgStats.arcane || 0) + finalDmg;
    if (directTarget) {
      // 终结印记：低于 20% 直接斩杀
      if (state.activeRelics.includes("relic_executioner") && directTarget.hp / directTarget.maxHp < 0.2) {
        directTarget.hp = 0;
        events.push({ type: "executed", monsterId: directTarget.id });
      } else {
        dealDirectDamage(directTarget, finalDmg, "arcane", state, events);
      }

      // 多重裂变：命中时分裂 2 枚追踪碎屑
      if (state.activeRelics.includes("relic_split_arrow") && !p.isShard) {
        const others = allMonsters.filter((m) => m.id !== directTarget.id);
        for (let s = 0; s < Math.min(2, others.length); s++) {
          dealDirectDamage(others[s], finalDmg * 0.5, "arcane", state, events);
          events.push({ type: "split_hit", fromId: directTarget.id, toId: others[s].id });
        }
      }
    }
  } else if (p.type === "flame") {
    dmgStats.flame = (dmgStats.flame || 0) + finalDmg;
    // 范围爆炸
    const splash = p.splashRadius * (state.activeRelics.includes("relic_blazing_core") ? 1.4 : 1.0);
    events.push({ type: "flame_explosion", x: p.x, y: p.y, radius: splash });

    for (const m of allMonsters) {
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d <= splash) {
        // 双相反应：烈焰 + 冰霜 = 融甲碎冰 (Meltdown)
        if (m.slowTimer > 0 && state.activeRelics.includes("relic_chain_melt")) {
          dealDirectDamage(m, finalDmg * 2.0, "flame", state, events);
          m.slowTimer = 0;
          events.push({ type: "reaction_meltdown", monsterId: m.id });
        } else {
          dealDirectDamage(m, finalDmg, "flame", state, events);
        }

        // 附加灼烧 DOT
        m.burnTimer = RUNES.flame.burnDuration;
        m.burnDmg = RUNES.flame.burnDmgPerSec * TIER_MULTIPLIERS[p.tier].dmgMult;

        // 地脉震荡：眩晕
        if (state.activeRelics.includes("relic_heavy_impact") && Math.random() < 0.15) {
          m.frozenTimer = 0.6;
        }
      }
    }
  } else if (p.type === "frost") {
    dmgStats.frost = (dmgStats.frost || 0) + finalDmg;
    if (directTarget) {
      dealDirectDamage(directTarget, finalDmg, "frost", state, events);
      if (!directTarget.immuneSlow) {
        directTarget.slowTimer = RUNES.frost.slowDuration;
        directTarget.slowFactor = 1.0 - RUNES.frost.slowAmount;
      }
      // 绝对零度：20% 概率冻结
      if (state.activeRelics.includes("relic_blizzard_field") && Math.random() < 0.2) {
        directTarget.frozenTimer = 1.2;
        events.push({ type: "frozen", monsterId: directTarget.id });
      }
    }
  }
}

// 雷霆电弧贯穿伤害与连锁跳跃
function applyStormDamage(firstTarget, baseDamage, tower, allMonsters, state, events, dmgStats) {
  let currentTarget = firstTarget;
  let chainDmg = baseDamage;
  const maxJumps = RUNES.storm.chainTargets + (state.activeRelics.includes("relic_superconduct") ? 2 : 0);
  const visited = new Set([firstTarget.id]);

  for (let jump = 0; jump < maxJumps; jump++) {
    if (!currentTarget) break;

    // 双相反应：雷霆 + 灼烧 = 超导过载 (Overload)
    if (currentTarget.burnTimer > 0 && state.activeRelics.includes("relic_superconduct")) {
      chainDmg *= 1.35;
      events.push({ type: "reaction_overload", monsterId: currentTarget.id });
    }

    dealDirectDamage(currentTarget, chainDmg, "storm", state, events);
    dmgStats.storm = (dmgStats.storm || 0) + chainDmg;

    // 寻找下一个临近未受击目标
    let nextTarget = null;
    let minDist = RUNES.storm.chainRange;
    for (const m of allMonsters) {
      if (!visited.has(m.id)) {
        const d = Math.hypot(m.x - currentTarget.x, m.y - currentTarget.y);
        if (d < minDist) {
          minDist = d;
          nextTarget = m;
        }
      }
    }

    if (nextTarget) {
      visited.add(nextTarget.id);
      events.push({
        type: "lightning_arc",
        from: { x: currentTarget.x, y: currentTarget.y },
        to: { x: nextTarget.x, y: nextTarget.y },
      });
      currentTarget = nextTarget;
      chainDmg *= 0.8; // 跳跃衰减
    } else {
      break;
    }
  }
}

// 统一伤害与护盾/首领硬直扣减
function dealDirectDamage(m, dmg, type, state, events) {
  let effective = dmg;

  // 首领护盾机制优先吸收
  if (m.shield && m.shield > 0) {
    if (m.immuneElement && m.immuneElement === type) {
      effective = 0; // 双子免疫
      events.push({ type: "damage_immune", monsterId: m.id });
      return;
    }

    const shieldDamage = Math.min(m.shield, effective);
    m.shield -= shieldDamage;
    effective -= shieldDamage;

    // 护盾击破硬直 (Boss Stagger)
    if (m.shield <= 0 && m.staggerTimer === 0) {
      m.staggerTimer = 3.0;
      events.push({ type: "boss_staggered", bossId: m.id });
      // 破盾反冲：清空杂兵
      if (state.activeRelics.includes("relic_stagger_shock")) {
        events.push({ type: "shockwave_burst" });
      }
    }
  }

  // 护甲减免（雷电无视护甲）
  if (m.armor && type !== "storm") {
    effective *= 1.0 - m.armor;
  }

  // 极寒碎裂易伤加成
  if (m.slowTimer > 0 && state.activeRelics.includes("relic_frostbite")) {
    effective *= 1.35;
  }

  m.hp -= effective;
}
