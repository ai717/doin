// engine.mjs — 纯逻辑核心引擎，DOM-free（不接触浏览器 DOM/全局）
// Cat Cafe Arcade Idle 数学模型与状态机

/**
 * 确定性伪随机数发生器（mulberry32）
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

export function randBetween(rng, min, max) {
  return min + rng() * (max - min);
}

// =========================================================================
// 五环工艺链（工位 / Station）
// =========================================================================

export const STATION_IDS = ["roast", "grind", "extract", "latte", "serve"];

export const STATION_DEFS = {
  roast: {
    id: "roast",
    baseCost: 15,
    baseRate: 2,
    workerCat: "cat_orange",
  },
  grind: {
    id: "grind",
    baseCost: 100,
    baseRate: 4,
    workerCat: "cat_calico",
  },
  extract: {
    id: "extract",
    baseCost: 800,
    baseRate: 8,
    workerCat: "cat_british",
  },
  latte: {
    id: "latte",
    baseCost: 6000,
    baseRate: 16,
    workerCat: "cat_ragdoll",
  },
  serve: {
    id: "serve",
    baseCost: 50000,
    baseRate: 32,
    workerCat: null,
  },
};

// =========================================================================
// 喵掌柜（Cats）—— 多猫轮值 + 星标解锁
// =========================================================================

export const CAT_IDS = ["cat_orange", "cat_calico", "cat_british", "cat_ragdoll"];

export const CAT_DEFS = {
  cat_orange: {
    id: "cat_orange",
    stationId: "roast",
    unlockStars: 0,
    multiplierPerLevel: 0.5,
  },
  cat_calico: {
    id: "cat_calico",
    stationId: "grind",
    unlockStars: 10,
    multiplierPerLevel: 0.5,
  },
  cat_british: {
    id: "cat_british",
    stationId: "extract",
    unlockStars: 30,
    multiplierPerLevel: 0.5,
  },
  cat_ragdoll: {
    id: "cat_ragdoll",
    stationId: "latte",
    unlockStars: 100,
    multiplierPerLevel: 0.5,
  },
};

// =========================================================================
// 窗口扩张（Windows）—— 单吧台 → 外带窗 → 露台卡座 → 屋顶花园
// =========================================================================

export const WINDOW_IDS = ["window_takeout", "window_terrace", "window_garden"];

export const WINDOW_DEFS = {
  window_takeout: {
    id: "window_takeout",
    reqStage: 1,
    reqCoins: 500,
    multiplier: 1.5,
  },
  window_terrace: {
    id: "window_terrace",
    reqStage: 2,
    reqCoins: 5000,
    multiplier: 2.0,
  },
  window_garden: {
    id: "window_garden",
    reqStage: 3,
    reqCoins: 50000,
    multiplier: 3.0,
  },
};

// =========================================================================
// 咖啡菜单（Recipes / Drinks）
// =========================================================================

export const DRINK_IDS = [
  "drink_espresso",
  "drink_americano",
  "drink_latte",
  "drink_cappuccino",
  "drink_mocha",
  "drink_macchiato",
  "drink_matcha",
  "drink_sunset",
];

export const DRINK_DEFS = {
  drink_espresso: {
    id: "drink_espresso",
    cost: 0,
    multiplier: 1.0,
    reqBowls: 0,
  },
  drink_americano: {
    id: "drink_americano",
    cost: 200,
    multiplier: 1.2,
    reqBowls: 30,
  },
  drink_latte: {
    id: "drink_latte",
    cost: 800,
    multiplier: 1.4,
    reqBowls: 80,
  },
  drink_cappuccino: {
    id: "drink_cappuccino",
    cost: 2500,
    multiplier: 1.6,
    reqBowls: 180,
  },
  drink_mocha: {
    id: "drink_mocha",
    cost: 8000,
    multiplier: 1.9,
    reqBowls: 380,
  },
  drink_macchiato: {
    id: "drink_macchiato",
    cost: 25000,
    multiplier: 2.3,
    reqBowls: 800,
  },
  drink_matcha: {
    id: "drink_matcha",
    cost: 80000,
    multiplier: 2.8,
    reqBowls: 1600,
  },
  drink_sunset: {
    id: "drink_sunset",
    cost: 250000,
    multiplier: 3.5,
    reqBowls: 3000,
  },
};

// =========================================================================
// 常客喵咪图鉴（Guests）—— 喂对口味的咖啡解锁
// =========================================================================

export const GUEST_IDS = [
  "guest_officecat",
  "guest_writercat",
  "guest_retiredcat",
  "guest_yogacat",
  "guest_bloggercat",
  "guest_studentcat",
  "guest_couplecat",
  "guest_raincat",
  "guest_kidcat",
  "guest_doctorncat",
  "guest_pianocat",
  "guest_straycat",
];

export const GUEST_DEFS = {
  guest_officecat: {
    id: "guest_officecat",
    favoriteDrink: "drink_americano",
    reqBowls: 20,
    tipBonus: 0.03,
  },
  guest_writercat: {
    id: "guest_writercat",
    favoriteDrink: "drink_latte",
    reqBowls: 50,
    tipBonus: 0.03,
  },
  guest_retiredcat: {
    id: "guest_retiredcat",
    favoriteDrink: "drink_sunset",
    reqBowls: 100,
    tipBonus: 0.04,
  },
  guest_yogacat: {
    id: "guest_yogacat",
    favoriteDrink: "drink_matcha",
    reqBowls: 200,
    tipBonus: 0.04,
  },
  guest_bloggercat: {
    id: "guest_bloggercat",
    favoriteDrink: "drink_cappuccino",
    reqBowls: 350,
    tipBonus: 0.05,
  },
  guest_studentcat: {
    id: "guest_studentcat",
    favoriteDrink: "drink_americano",
    reqBowls: 600,
    tipBonus: 0.05,
  },
  guest_couplecat: {
    id: "guest_couplecat",
    favoriteDrink: "drink_mocha",
    reqBowls: 1000,
    tipBonus: 0.06,
  },
  guest_raincat: {
    id: "guest_raincat",
    favoriteDrink: "drink_macchiato",
    reqBowls: 1500,
    tipBonus: 0.06,
  },
  guest_kidcat: {
    id: "guest_kidcat",
    favoriteDrink: "drink_cappuccino",
    reqBowls: 2200,
    tipBonus: 0.07,
  },
  guest_doctorncat: {
    id: "guest_doctorncat",
    favoriteDrink: "drink_espresso",
    reqBowls: 3000,
    tipBonus: 0.07,
  },
  guest_pianocat: {
    id: "guest_pianocat",
    favoriteDrink: "drink_macchiato",
    reqBowls: 4000,
    tipBonus: 0.08,
  },
  guest_straycat: {
    id: "guest_straycat",
    favoriteDrink: "drink_espresso",
    reqBowls: 5500,
    tipBonus: 0.10,
  },
};

// =========================================================================
// 声誉阶段（Reputation Stages）
// =========================================================================

export const REPUTATION_STAGES = [
  { id: "reputation_local", reqRevenue: 0, offlineMaxHours: 4 },
  { id: "reputation_popular", reqRevenue: 3000, offlineMaxHours: 8 },
  { id: "reputation_instafam", reqRevenue: 25000, offlineMaxHours: 12 },
  { id: "reputation_city", reqRevenue: 200000, offlineMaxHours: 16 },
  { id: "reputation_5star", reqRevenue: 2000000, offlineMaxHours: 24 },
];

// =========================================================================
// 离线倍率里程碑（四档叠加 = 13,952× 封顶）
// =========================================================================

export const OFFLINE_MILESTONES = {
  m1_pipeline: { id: "m1_pipeline", factor: 4 },
  m2_takeout: { id: "m2_takeout", factor: 4 },
  m3_terrace: { id: "m3_terrace", factor: 4 },
  m4_5star: { id: "m4_5star", factor: 218 },
};

// =========================================================================
// 初始游戏状态
// =========================================================================

export function createInitialState(opts = {}) {
  const seed = opts.seed ?? 123456789;
  return {
    coins: 30,
    totalCoinsEarned: 30,
    bowlsServed: 0,
    stars: 0,

    stage: 0,
    totalRevenue: 0,

    stations: {
      roast: { level: 1 },
      grind: { level: 0 },
      extract: { level: 0 },
      latte: { level: 0 },
      serve: { level: 0 },
    },

    cats: {
      cat_orange: { unlocked: true, level: 0, awakenUntilTick: 0 },
      cat_calico: { unlocked: false, level: 0, awakenUntilTick: 0 },
      cat_british: { unlocked: false, level: 0, awakenUntilTick: 0 },
      cat_ragdoll: { unlocked: false, level: 0, awakenUntilTick: 0 },
    },

    activeCat: "cat_orange",

    windows: {},

    drinks: ["drink_espresso"],
    activeDrink: "drink_espresso",

    guests: [],

    offlineVisits: 0,

    rngSeed: seed,
  };
}

// =========================================================================
// 成本计算（指数曲线 cost = base × 1.15^level）
// =========================================================================

export function getStationCost(stationId, currentLevel) {
  const def = STATION_DEFS[stationId];
  if (!def) return Infinity;
  return Math.floor(def.baseCost * Math.pow(1.15, currentLevel));
}

export function getCatCost(catId, currentLevel) {
  const def = CAT_DEFS[catId];
  if (!def) return Infinity;
  return Math.floor(50 * Math.pow(1.5, currentLevel));
}

// =========================================================================
// 猫咪打盹周期（确定性函数，产速在 0.5–1.0 间震荡）
// =========================================================================

// 周期：每 10 个 tick 中前 3 个打盹（30% 时间），但永远 >= 0.5（永不断产硬要求）
// 未升级（level=0）的猫默认满产出，不参与打盹
export function getCatProductionFactor(catState, tickIndex) {
  if (!catState || !catState.unlocked) return 0;
  if (catState.level <= 0) return 1.0;
  if (catState.awakenUntilTick > tickIndex) return 1.0;
  const cyclePosition = ((tickIndex % 10) + 10) % 10;
  return cyclePosition < 3 ? 0.5 : 1.0;
}

// =========================================================================
// 离线倍率与时长
// =========================================================================

export function getOfflineMilestoneState(state) {
  const allCatsHired = CAT_IDS.every((cid) => state.cats[cid]?.unlocked);
  const hasTakeout = Boolean(state.windows.window_takeout);
  const hasTerrace = Boolean(state.windows.window_terrace);
  const is5Star = state.stage >= 4;

  return {
    m1: allCatsHired,
    m2: hasTakeout,
    m3: hasTerrace,
    m4: is5Star,
  };
}

export function getOfflineMultiplier(state) {
  const ms = getOfflineMilestoneState(state);
  let mult = 1;
  if (ms.m1) mult *= OFFLINE_MILESTONES.m1_pipeline.factor;
  if (ms.m2) mult *= OFFLINE_MILESTONES.m2_takeout.factor;
  if (ms.m3) mult *= OFFLINE_MILESTONES.m3_terrace.factor;
  if (ms.m4) mult *= OFFLINE_MILESTONES.m4_5star.factor;
  return mult;
}

export function getMaxOfflineSeconds(state) {
  const stage = REPUTATION_STAGES[state.stage] || REPUTATION_STAGES[0];
  return stage.offlineMaxHours * 3600;
}

// =========================================================================
// 每秒产出
// =========================================================================

export function calculateRevenuePerSecond(state, tickIndex = 0) {
  let baseOutput = 0;

  for (const sid of STATION_IDS) {
    const sState = state.stations[sid];
    const sDef = STATION_DEFS[sid];
    if (!sState || sState.level <= 0 || !sDef) continue;

    let stationRate = sDef.baseRate * sState.level;

    const catId = sDef.workerCat;
    if (catId) {
      const cState = state.cats[catId];
      if (cState && cState.unlocked) {
        const catMult = 1.0 + cState.level * CAT_DEFS[catId].multiplierPerLevel;
        const catActiveFactor = getCatProductionFactor(cState, tickIndex);
        stationRate *= catMult * catActiveFactor;
      }
    }

    baseOutput += stationRate;
  }

  const drinkMult = getDrinkMultiplier(state);
  const windowMult = getWindowMultiplier(state);
  const guestMult = getGuestTipMultiplier(state);

  const totalRps = baseOutput * drinkMult * windowMult * guestMult;
  return Math.max(0, Math.floor(totalRps * 10) / 10);
}

export function getDrinkMultiplier(state) {
  let mult = 1.0;
  for (const did of state.drinks) {
    const ddef = DRINK_DEFS[did];
    if (ddef && ddef.multiplier > mult) {
      mult = ddef.multiplier;
    }
  }
  return mult;
}

export function getWindowMultiplier(state) {
  let mult = 1.0;
  for (const wid of WINDOW_IDS) {
    if (state.windows[wid]) {
      const wdef = WINDOW_DEFS[wid];
      if (wdef && wdef.multiplier > mult) {
        mult = wdef.multiplier;
      }
    }
  }
  return mult;
}

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

// =========================================================================
// 主循环 tick（在线推进）
// =========================================================================

export function tick(state, dtSeconds, tickIndex = 0) {
  if (dtSeconds <= 0) return { earned: 0, newGuests: [], drankServed: 0 };

  const rps = calculateRevenuePerSecond(state, tickIndex);
  const earned = Math.floor(rps * dtSeconds);
  state.coins += earned;
  state.totalCoinsEarned += earned;
  state.totalRevenue += earned;

  const activeStationCount = Object.values(state.stations).filter((s) => s.level > 0).length;
  const drankDelta = activeStationCount > 0 ? Math.floor(dtSeconds * (1 + activeStationCount * 0.5)) : 0;
  state.bowlsServed += drankDelta;

  const newGuests = checkNewGuestUnlocks(state);

  return {
    earned,
    newGuests,
    drankServed: drankDelta,
  };
}

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

// =========================================================================
// 离线收益计算与想念桶生成
// =========================================================================

export function calculateOfflineEarnings(state, elapsedSeconds) {
  if (elapsedSeconds <= 5) {
    return {
      earnedCoins: 0,
      offlineSeconds: 0,
      multiplier: 1,
      efficiency: 0.5,
    };
  }

  const maxSec = getMaxOfflineSeconds(state);
  const clampedSec = Math.min(elapsedSeconds, maxSec);
  const efficiency = 0.5;
  // 离线收益按猫平均清醒状态计算（避开打盹窗口）
  const rps = calculateRevenuePerSecond(state, 5);
  const multiplier = getOfflineMultiplier(state);

  const earned = Math.floor(rps * clampedSec * efficiency * multiplier);

  return {
    earnedCoins: Math.max(0, earned),
    offlineSeconds: clampedSec,
    multiplier,
    efficiency,
  };
}

export function generateOfflineBuckets(state, elapsedSeconds, messageFn = null) {
  const earnings = calculateOfflineEarnings(state, elapsedSeconds);
  if (earnings.earnedCoins <= 0) return [];

  const hiredCats = CAT_IDS.filter((cid) => state.cats[cid]?.unlocked);
  if (hiredCats.length === 0) return [];

  const perCat = Math.floor(earnings.earnedCoins / hiredCats.length);
  if (perCat <= 0) return [];

  const buckets = [];
  const visitIndex = state.offlineVisits;
  for (let i = 0; i < hiredCats.length; i++) {
    const catId = hiredCats[i];
    let msg = "";
    if (typeof messageFn === "function") {
      msg = messageFn(catId, visitIndex);
    }
    buckets.push({
      catId,
      amount: perCat,
      message: msg,
      tickIndex: visitIndex,
    });
  }
  return buckets;
}

// =========================================================================
// 玩家合法意图分发（Action Dispatcher）
// =========================================================================

export function performAction(state, action) {
  if (!action || typeof action.type !== "string") {
    return { success: false, action: null };
  }

  switch (action.type) {
    case "UPGRADE_STATION": {
      const { stationId } = action;
      if (!STATION_IDS.includes(stationId)) return { success: false, action: null };
      const sState = state.stations[stationId];
      if (!sState) return { success: false, action: null };
      const cost = getStationCost(stationId, sState.level);
      if (state.coins < cost) return { success: false, action: null };

      state.coins -= cost;
      sState.level += 1;
      return { success: true, action: "UPGRADE_STATION", stationId, newLevel: sState.level, cost };
    }

    case "UPGRADE_CAT": {
      const { catId } = action;
      const def = CAT_DEFS[catId];
      const cState = state.cats[catId];
      if (!def || !cState || !cState.unlocked) return { success: false, action: null };
      const cost = getCatCost(catId, cState.level);
      if (state.coins < cost) return { success: false, action: null };

      state.coins -= cost;
      cState.level += 1;
      return { success: true, action: "UPGRADE_CAT", catId, newLevel: cState.level, cost };
    }

    case "UNLOCK_CAT": {
      const { catId } = action;
      const def = CAT_DEFS[catId];
      const cState = state.cats[catId];
      if (!def || !cState || cState.unlocked) return { success: false, action: null };
      if (state.stars < def.unlockStars) return { success: false, action: null };

      state.stars -= def.unlockStars;
      cState.unlocked = true;
      return { success: true, action: "UNLOCK_CAT", catId };
    }

    case "SWITCH_ACTIVE_CAT": {
      const { catId } = action;
      const def = CAT_DEFS[catId];
      const cState = state.cats[catId];
      if (!def || !cState || !cState.unlocked) return { success: false, action: null };
      if (catId === state.activeCat) return { success: false, action: null };

      state.activeCat = catId;
      return { success: true, action: "SWITCH_ACTIVE_CAT", catId };
    }

    case "UNLOCK_WINDOW": {
      const { windowId } = action;
      const def = WINDOW_DEFS[windowId];
      if (!def) return { success: false, action: null };
      if (state.windows[windowId]) return { success: false, action: null };
      if (state.stage < def.reqStage) return { success: false, action: null };
      if (state.coins < def.reqCoins) return { success: false, action: null };

      state.coins -= def.reqCoins;
      state.windows[windowId] = true;
      return { success: true, action: "UNLOCK_WINDOW", windowId };
    }

    case "UPGRADE_STAGE": {
      if (state.stage >= REPUTATION_STAGES.length - 1) return { success: false, action: null };
      const nextStage = REPUTATION_STAGES[state.stage + 1];
      if (state.totalRevenue < nextStage.reqRevenue) return { success: false, action: null };

      state.stage += 1;
      return { success: true, action: "UPGRADE_STAGE", newStage: state.stage };
    }

    case "RESEARCH_DRINK": {
      const { drinkId } = action;
      const def = DRINK_DEFS[drinkId];
      if (!def || state.drinks.includes(drinkId)) return { success: false, action: null };
      if (state.bowlsServed < def.reqBowls) return { success: false, action: null };
      if (state.coins < def.cost) return { success: false, action: null };

      state.coins -= def.cost;
      state.drinks.push(drinkId);
      state.activeDrink = drinkId;
      return { success: true, action: "RESEARCH_DRINK", drinkId };
    }

    case "SWITCH_ACTIVE_DRINK": {
      const { drinkId } = action;
      if (!state.drinks.includes(drinkId)) return { success: false, action: null };
      if (drinkId === state.activeDrink) return { success: false, action: null };

      state.activeDrink = drinkId;
      return { success: true, action: "SWITCH_ACTIVE_DRINK", drinkId };
    }

    case "SERVE_GUEST_DRINK": {
      const { guestId, drinkId } = action;
      const gdef = GUEST_DEFS[guestId];
      const ddef = DRINK_DEFS[drinkId];
      if (!gdef || !ddef) return { success: false, action: null };
      if (!state.drinks.includes(drinkId)) return { success: false, action: null };

      const isFavorite = gdef.favoriteDrink === drinkId;
      if (isFavorite && !state.guests.includes(guestId)) {
        state.guests.push(guestId);
      }

      return {
        success: true,
        action: "SERVE_GUEST_DRINK",
        guestId,
        drinkId,
        isFavorite,
        tipBonus: isFavorite ? gdef.tipBonus : 0,
      };
    }

    case "AWAKEN_CAT": {
      const { catId, currentTick, awakenTicks = 30 } = action;
      const cState = state.cats[catId];
      if (!cState || !cState.unlocked) return { success: false, action: null };
      if (typeof currentTick !== "number") return { success: false, action: null };

      cState.awakenUntilTick = currentTick + awakenTicks;
      return { success: true, action: "AWAKEN_CAT", catId, awakenUntilTick: cState.awakenUntilTick };
    }

    case "CLAIM_OFFLINE": {
      const { buckets } = action;
      if (!Array.isArray(buckets) || buckets.length === 0) return { success: false, action: null };

      let totalClaimed = 0;
      for (const b of buckets) {
        if (b && typeof b.amount === "number" && b.amount > 0) {
          totalClaimed += b.amount;
        }
      }
      if (totalClaimed <= 0) return { success: false, action: null };

      state.coins += totalClaimed;
      state.totalCoinsEarned += totalClaimed;
      state.totalRevenue += totalClaimed;
      state.offlineVisits += 1;

      return { success: true, action: "CLAIM_OFFLINE", rewardCoins: totalClaimed, bucketCount: buckets.length };
    }

    case "ADD_STARS": {
      const { amount } = action;
      if (typeof amount !== "number" || amount <= 0) return { success: false, action: null };
      state.stars += amount;
      return { success: true, action: "ADD_STARS", amount };
    }

    default:
      return { success: false, action: null };
  }
}