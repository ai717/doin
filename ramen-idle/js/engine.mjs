// engine.mjs — Pure logic core engine, DOM-free (no document, no window)
// Midnight Ramen idle tycoon mathematical model and state machine

/**
 * 确定性伪随机数发生器 (mulberry32)
 */
export function createRng(seed = 123456789) {
  let s = (seed >>> 0) || 1;
  return function next() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const STATION_IDS = ["prep", "stove", "counter", "seats"];

export const STATION_DEFS = {
  prep: {
    id: "prep",
    baseCost: 10,
    baseRate: 2,
    workerId: "worker_prep",
  },
  stove: {
    id: "stove",
    baseCost: 60,
    baseRate: 4,
    workerId: "worker_chef",
  },
  counter: {
    id: "counter",
    baseCost: 260,
    baseRate: 8,
    workerId: "worker_server",
  },
  seats: {
    id: "seats",
    baseCost: 1200,
    baseRate: 16,
    workerId: "worker_manager",
  },
};

export const WORKER_DEFS = {
  worker_prep: {
    id: "worker_prep",
    stationId: "prep",
    baseCost: 150,
    multiplierPerLevel: 0.5, // level 1 gives 1.5x, level 2 gives 2.0x
  },
  worker_chef: {
    id: "worker_chef",
    stationId: "stove",
    baseCost: 800,
    multiplierPerLevel: 0.5,
  },
  worker_server: {
    id: "worker_server",
    stationId: "counter",
    baseCost: 3500,
    multiplierPerLevel: 0.5,
  },
  worker_manager: {
    id: "worker_manager",
    stationId: "seats",
    baseCost: 15000,
    multiplierPerLevel: 0.5,
  },
};

export const RECIPE_IDS = [
  "recipe_shoyu",
  "recipe_tonkotsu",
  "recipe_miso",
  "recipe_shio",
  "recipe_tsukemen",
  "recipe_spicy",
  "recipe_oyaji",
  "recipe_legend",
];

export const RECIPE_DEFS = {
  recipe_shoyu: {
    id: "recipe_shoyu",
    cost: 0,
    multiplier: 1.0,
    reqTier: 0,
    reqBowls: 0,
  },
  recipe_tonkotsu: {
    id: "recipe_tonkotsu",
    cost: 500,
    multiplier: 1.25,
    reqTier: 1, // Tiny Shop
    reqBowls: 30,
  },
  recipe_miso: {
    id: "recipe_miso",
    cost: 2500,
    multiplier: 1.5,
    reqTier: 1,
    reqBowls: 100,
  },
  recipe_shio: {
    id: "recipe_shio",
    cost: 10000,
    multiplier: 1.8,
    reqTier: 2, // Local Favorite
    reqBowls: 250,
  },
  recipe_tsukemen: {
    id: "recipe_tsukemen",
    cost: 45000,
    multiplier: 2.2,
    reqTier: 2,
    reqBowls: 600,
  },
  recipe_spicy: {
    id: "recipe_spicy",
    cost: 180000,
    multiplier: 2.7,
    reqTier: 3, // Famous Midnight Spot
    reqBowls: 1200,
  },
  recipe_oyaji: {
    id: "recipe_oyaji",
    cost: 800000,
    multiplier: 3.5,
    reqTier: 3,
    reqBowls: 2500,
  },
  recipe_legend: {
    id: "recipe_legend",
    cost: 3500000,
    multiplier: 5.0,
    reqTier: 4, // Legendary Kitchen
    reqBowls: 5000,
    reqGuest: "guest_elder",
  },
};

export const SHOP_TIERS = [
  { id: "tier_corner", reqRevenue: 0, upgradeCost: 0, offlineMaxHours: 8 },
  { id: "tier_shop", reqRevenue: 5000, upgradeCost: 2000, offlineMaxHours: 16 },
  { id: "tier_favorite", reqRevenue: 50000, upgradeCost: 20000, offlineMaxHours: 24 },
  { id: "tier_famous", reqRevenue: 500000, upgradeCost: 200000, offlineMaxHours: 32 },
  { id: "tier_legend", reqRevenue: 5000000, upgradeCost: 2000000, offlineMaxHours: 48 },
];

export const GUEST_IDS = [
  "guest_coder",
  "guest_driver",
  "guest_runner",
  "guest_student",
  "guest_clerk",
  "guest_courier",
  "guest_musician",
  "guest_nurse",
  "guest_drinker",
  "guest_elder",
  "guest_cat",
  "guest_mentor",
];

export const GUEST_DEFS = {
  guest_coder: { id: "guest_coder", reqBowls: 15, favoriteRecipe: "recipe_shoyu", tipBonus: 0.03 },
  guest_driver: { id: "guest_driver", reqBowls: 40, favoriteRecipe: "recipe_tonkotsu", tipBonus: 0.03 },
  guest_runner: { id: "guest_runner", reqBowls: 80, favoriteRecipe: "recipe_shio", tipBonus: 0.04 },
  guest_student: { id: "guest_student", reqBowls: 150, favoriteRecipe: "recipe_miso", tipBonus: 0.04 },
  guest_clerk: { id: "guest_clerk", reqBowls: 300, favoriteRecipe: "recipe_tsukemen", tipBonus: 0.05 },
  guest_courier: { id: "guest_courier", reqBowls: 500, favoriteRecipe: "recipe_spicy", tipBonus: 0.05 },
  guest_musician: { id: "guest_musician", reqBowls: 800, favoriteRecipe: "recipe_oyaji", tipBonus: 0.06 },
  guest_nurse: { id: "guest_nurse", reqBowls: 1200, favoriteRecipe: "recipe_tonkotsu", tipBonus: 0.06 },
  guest_drinker: { id: "guest_drinker", reqBowls: 1800, favoriteRecipe: "recipe_shoyu", tipBonus: 0.07 },
  guest_elder: { id: "guest_elder", reqBowls: 2600, favoriteRecipe: "recipe_legend", tipBonus: 0.08 },
  guest_cat: { id: "guest_cat", reqBowls: 3800, favoriteRecipe: "recipe_shio", tipBonus: 0.09 },
  guest_mentor: { id: "guest_mentor", reqBowls: 5000, favoriteRecipe: "recipe_legend", tipBonus: 0.10 },
};

export const SHIFT_IDS = [
  "shift_dinner",   // 18:00 - 20:00
  "shift_commute",  // 20:00 - 22:00
  "shift_midnight", // 22:00 - 00:00
  "shift_rush",     // 00:00 - 02:00 (Rush Hour)
  "shift_dawn",     // 02:00 - 04:00
];

export const SHIFT_DEFS = {
  shift_dinner: { id: "shift_dinner", timeLabel: "18:00 - 20:00", multiplier: 1.0, isRush: false },
  shift_commute: { id: "shift_commute", timeLabel: "20:00 - 22:00", multiplier: 1.1, isRush: false },
  shift_midnight: { id: "shift_midnight", timeLabel: "22:00 - 00:00", multiplier: 1.2, isRush: false },
  shift_rush: { id: "shift_rush", timeLabel: "00:00 - 02:00", multiplier: 1.5, isRush: true },
  shift_dawn: { id: "shift_dawn", timeLabel: "02:00 - 04:00", multiplier: 1.3, isRush: false },
};

export const SPECIAL_UPGRADES = {
  lanterns_lit: {
    id: "lanterns_lit",
    cost: 10000,
    reqTier: 1,
  },
};

/**
 * 初始游戏状态
 */
export function createInitialState() {
  return {
    coins: 10,
    totalCoinsEarned: 10,
    bowlsServed: 0,
    stations: {
      prep: { level: 1 },
      stove: { level: 0 },
      counter: { level: 0 },
      seats: { level: 0 },
    },
    workers: {
      worker_prep: { level: 0 },
      worker_chef: { level: 0 },
      worker_server: { level: 0 },
      worker_manager: { level: 0 },
    },
    recipes: ["recipe_shoyu"],
    activeRecipe: "recipe_shoyu",
    shopTier: 0, // index into SHOP_TIERS (0..4)
    guests: [], // unlocked guest ids
    upgrades: {
      lanterns_lit: false,
    },
    prestigeCount: 0,
    prestigeMultiplier: 1.0,
    nightNumber: 1,
    shiftIndex: 0, // 0..4
    shiftElapsedSeconds: 0,
    shiftDurationSeconds: 60, // each shift is 60s in active play
    rushRushActive: false,
    rushRemainingSeconds: 0,
    lastTickTime: 0,
  };
}

/**
 * 计算工位升级费用
 */
export function getStationCost(stationId, currentLevel) {
  const def = STATION_DEFS[stationId];
  if (!def) return Infinity;
  // 基础费用 * 1.15^currentLevel
  return Math.floor(def.baseCost * Math.pow(1.15, currentLevel));
}

/**
 * 计算帮工升级费用
 */
export function getWorkerCost(workerId, currentLevel) {
  const def = WORKER_DEFS[workerId];
  if (!def) return Infinity;
  return Math.floor(def.baseCost * Math.pow(1.6, currentLevel));
}

/**
 * 计算配方总体倍率
 */
export function getRecipeMultiplier(state) {
  let mult = 1.0;
  for (const rid of state.recipes) {
    const rdef = RECIPE_DEFS[rid];
    if (rdef && rdef.multiplier > mult) {
      mult = rdef.multiplier;
    }
  }
  return mult;
}

/**
 * 计算常客小费总倍率
 */
export function getGuestTipMultiplier(state) {
  let bonus = 0;
  for (const gid of state.guests) {
    const gdef = GUEST_DEFS[gid];
    if (gdef) {
      bonus += gdef.tipBonus;
    }
  }
  return 1.0 + bonus;
}

/**
 * 计算当前时段倍率
 */
export function getShiftMultiplier(state) {
  const shiftId = SHIFT_IDS[state.shiftIndex] || "shift_dinner";
  const def = SHIFT_DEFS[shiftId];
  return def ? def.multiplier : 1.0;
}

/**
 * 计算每秒总营业额（Revenue Per Second）
 */
export function calculateRevenuePerSecond(state) {
  let baseStationOutput = 0;
  for (const sid of STATION_IDS) {
    const sState = state.stations[sid];
    const sDef = STATION_DEFS[sid];
    if (sState && sState.level > 0 && sDef) {
      let stationRate = sDef.baseRate * sState.level;
      const workerState = state.workers[sDef.workerId];
      if (workerState && workerState.level > 0) {
        const wDef = WORKER_DEFS[sDef.workerId];
        const wMult = 1.0 + workerState.level * (wDef ? wDef.multiplierPerLevel : 0.5);
        stationRate *= wMult;
      }
      baseStationOutput += stationRate;
    }
  }

  const recipeMult = getRecipeMultiplier(state);
  const guestMult = getGuestTipMultiplier(state);
  const shiftMult = getShiftMultiplier(state);
  const prestigeMult = Math.max(1, state.prestigeMultiplier || 1);

  const totalRps = baseStationOutput * recipeMult * guestMult * shiftMult * prestigeMult;
  return Math.max(0, Math.floor(totalRps * 10) / 10);
}

/**
 * 计算手动出餐冲刺收益 (Rush Click)
 */
export function getRushClickIncome(state) {
  const rps = calculateRevenuePerSecond(state);
  const baseRush = Math.max(1, Math.floor(rps * 0.5));
  const isRushHour = Boolean(state.rushRushActive && state.rushRemainingSeconds > 0);
  return isRushHour ? baseRush * 2 : baseRush;
}

/**
 * 计算离线收益里程碑倍率（4/4/4/4/218）
 */
export function getOfflineMilestones(state) {
  const m1 = Object.values(state.workers).every((w) => w && w.level >= 1); // 4 workers
  const m2 = state.shopTier >= 1; // Tiny shop reached
  const m3 = state.recipes.length >= 5; // 5 recipes unlocked
  const m4 = state.shopTier >= 3; // Famous midnight spot
  const m5 = state.shopTier >= 4 && state.recipes.length >= 8; // Legendary + all 8 recipes

  const mult1 = m1 ? 4 : 1;
  const mult2 = m2 ? 4 : 1;
  const mult3 = m3 ? 4 : 1;
  const mult4 = m4 ? 4 : 1;
  const mult5 = m5 ? 218 : 1;

  const totalMultiplier = mult1 * mult2 * mult3 * mult4 * mult5;

  return {
    m1,
    m2,
    m3,
    m4,
    m5,
    mult1,
    mult2,
    mult3,
    mult4,
    mult5,
    totalMultiplier,
  };
}

/**
 * 离线最大储存时长（秒）
 */
export function getMaxOfflineSeconds(state) {
  const currentTier = SHOP_TIERS[state.shopTier] || SHOP_TIERS[0];
  return currentTier.offlineMaxHours * 3600;
}

/**
 * 计算离线收益
 */
export function calculateOfflineEarnings(state, elapsedSeconds) {
  if (elapsedSeconds <= 5) {
    return {
      earnedCoins: 0,
      offlineSeconds: 0,
      milestones: getOfflineMilestones(state),
      efficiency: 0.5,
    };
  }

  const maxSec = getMaxOfflineSeconds(state);
  const clampedSec = Math.min(elapsedSeconds, maxSec);
  const efficiency = state.upgrades.lanterns_lit ? 1.0 : 0.5;
  const rps = calculateRevenuePerSecond(state);
  const milestones = getOfflineMilestones(state);

  const earned = Math.floor(rps * clampedSec * efficiency * milestones.totalMultiplier);

  return {
    earnedCoins: Math.max(0, earned),
    offlineSeconds: clampedSec,
    milestones,
    efficiency,
  };
}

/**
 * 检查新常客解锁
 */
export function checkNewGuestUnlocks(state) {
  const newlyUnlocked = [];
  for (const gid of GUEST_IDS) {
    if (!state.guests.includes(gid)) {
      const def = GUEST_DEFS[gid];
      if (def && state.bowlsServed >= def.reqBowls) {
        state.guests.push(gid);
        newlyUnlocked.push(gid);
      }
    }
  }
  return newlyUnlocked;
}

/**
 * 主帧/定时推演（纯函数或更新 state）
 */
export function tick(state, dtSeconds) {
  if (dtSeconds <= 0) return { earned: 0, newGuests: [], chapterAdvanced: false };

  // 更新 rush hour 倒计时
  if (state.rushRushActive) {
    state.rushRemainingSeconds -= dtSeconds;
    if (state.rushRemainingSeconds <= 0) {
      state.rushRushActive = false;
      state.rushRemainingSeconds = 0;
    }
  }

  // 计算产出
  const rps = calculateRevenuePerSecond(state);
  const earned = Math.floor(rps * dtSeconds);
  state.coins += earned;
  state.totalCoinsEarned += earned;

  // 增加出餐碗数（按炉台与吧台的运行估算）
  const activeStationCount = Object.values(state.stations).filter((s) => s.level > 0).length;
  if (activeStationCount > 0) {
    const bowlsDelta = Math.floor(dtSeconds * (1 + activeStationCount * 0.5));
    state.bowlsServed += bowlsDelta;
  }

  // 检查常客解锁
  const newGuests = checkNewGuestUnlocks(state);

  // 推动夜间时段
  state.shiftElapsedSeconds += dtSeconds;
  let chapterAdvanced = false;
  if (state.shiftElapsedSeconds >= state.shiftDurationSeconds) {
    state.shiftElapsedSeconds = 0;
    state.shiftIndex++;
    if (state.shiftIndex >= SHIFT_IDS.length) {
      state.shiftIndex = 0;
      state.nightNumber++;
      chapterAdvanced = true;
    }
  }

  return {
    earned,
    newGuests,
    chapterAdvanced,
  };
}

/**
 * 玩家合法意图分发 (Action Dispatcher)
 */
export function performAction(state, action) {
  if (!action || typeof action.type !== "string") {
    return { success: false, action: null };
  }

  switch (action.type) {
    case "RUSH_CLICK": {
      const income = getRushClickIncome(state);
      state.coins += income;
      state.totalCoinsEarned += income;
      state.bowlsServed += 1;
      const newGuests = checkNewGuestUnlocks(state);
      return { success: true, action: "RUSH_CLICK", income, newGuests };
    }

    case "UPGRADE_STATION": {
      const { stationId } = action;
      if (!STATION_IDS.includes(stationId)) return { success: false, action: null };
      const currentLevel = state.stations[stationId].level;
      const cost = getStationCost(stationId, currentLevel);
      if (state.coins < cost) return { success: false, action: null };

      state.coins -= cost;
      state.stations[stationId].level += 1;
      return { success: true, action: "UPGRADE_STATION", stationId, newLevel: state.stations[stationId].level };
    }

    case "HIRE_WORKER":
    case "UPGRADE_WORKER": {
      const { workerId } = action;
      const def = WORKER_DEFS[workerId];
      if (!def) return { success: false, action: null };
      const currentLevel = state.workers[workerId].level;
      const cost = getWorkerCost(workerId, currentLevel);
      if (state.coins < cost) return { success: false, action: null };

      state.coins -= cost;
      state.workers[workerId].level += 1;
      return { success: true, action: "UPGRADE_WORKER", workerId, newLevel: state.workers[workerId].level };
    }

    case "UNLOCK_RECIPE": {
      const { recipeId } = action;
      const def = RECIPE_DEFS[recipeId];
      if (!def || state.recipes.includes(recipeId)) return { success: false, action: null };
      if (state.shopTier < def.reqTier) return { success: false, action: null };
      if (state.bowlsServed < def.reqBowls) return { success: false, action: null };
      if (def.reqGuest && !state.guests.includes(def.reqGuest)) return { success: false, action: null };
      if (state.coins < def.cost) return { success: false, action: null };

      state.coins -= def.cost;
      state.recipes.push(recipeId);
      state.activeRecipe = recipeId;
      return { success: true, action: "UNLOCK_RECIPE", recipeId };
    }

    case "UPGRADE_SHOP_TIER": {
      if (state.shopTier >= SHOP_TIERS.length - 1) return { success: false, action: null };
      const nextTierIndex = state.shopTier + 1;
      const nextTierDef = SHOP_TIERS[nextTierIndex];
      if (state.totalCoinsEarned < nextTierDef.reqRevenue) return { success: false, action: null };
      if (state.coins < nextTierDef.upgradeCost) return { success: false, action: null };

      state.coins -= nextTierDef.upgradeCost;
      state.shopTier = nextTierIndex;
      return { success: true, action: "UPGRADE_SHOP_TIER", newTier: nextTierIndex };
    }

    case "BUY_SPECIAL_UPGRADE": {
      const { upgradeId } = action;
      const def = SPECIAL_UPGRADES[upgradeId];
      if (!def || state.upgrades[upgradeId]) return { success: false, action: null };
      if (state.shopTier < def.reqTier) return { success: false, action: null };
      if (state.coins < def.cost) return { success: false, action: null };

      state.coins -= def.cost;
      state.upgrades[upgradeId] = true;
      return { success: true, action: "BUY_SPECIAL_UPGRADE", upgradeId };
    }

    case "START_RUSH_HOUR": {
      // 触发限时冲刺（例如凌晨时段或手动激活）
      if (state.rushRushActive) return { success: false, action: null };
      state.rushRushActive = true;
      state.rushRemainingSeconds = 60;
      return { success: true, action: "START_RUSH_HOUR", duration: 60 };
    }

    case "CLAIM_OFFLINE": {
      const { rewardCoins } = action;
      if (typeof rewardCoins !== "number" || rewardCoins <= 0) return { success: false, action: null };
      state.coins += rewardCoins;
      state.totalCoinsEarned += rewardCoins;
      return { success: true, action: "CLAIM_OFFLINE", rewardCoins };
    }

    case "REFURBISH_PRESTIGE": {
      // 转生翻新：需要达到 Legendary Kitchen
      if (state.shopTier < 4) return { success: false, action: null };

      const currentPrestige = state.prestigeCount || 0;
      const newPrestigeMultiplier = (state.prestigeMultiplier || 1.0) * 2.0;

      // 保留配方图鉴、常客图鉴、翻新次数与倍率
      const savedRecipes = [...state.recipes];
      const savedGuests = [...state.guests];

      state.coins = 50;
      state.totalCoinsEarned = 50;
      state.bowlsServed = 0;
      state.stations = {
        prep: { level: 1 },
        stove: { level: 0 },
        counter: { level: 0 },
        seats: { level: 0 },
      };
      state.workers = {
        worker_prep: { level: 0 },
        worker_chef: { level: 0 },
        worker_server: { level: 0 },
        worker_manager: { level: 0 },
      };
      state.recipes = savedRecipes;
      state.activeRecipe = savedRecipes[0] || "recipe_shoyu";
      state.guests = savedGuests;
      state.shopTier = 0;
      state.upgrades = { lanterns_lit: false };
      state.prestigeCount = currentPrestige + 1;
      state.prestigeMultiplier = newPrestigeMultiplier;
      state.nightNumber = 1;
      state.shiftIndex = 0;
      state.shiftElapsedSeconds = 0;
      state.rushRushActive = false;
      state.rushRemainingSeconds = 0;

      return { success: true, action: "REFURBISH_PRESTIGE", newPrestigeMultiplier };
    }

    default:
      return { success: false, action: null };
  }
}
