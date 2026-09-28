// engine.test.mjs — Cat Cafe Arcade Idle 核心引擎测试
// 覆盖：工位/猫掌柜/饮品/窗口/声誉/常客图鉴/离线倍率/想念桶/打盹周期/PRNG/1000步随机游走
import { test } from "node:test";
import assert from "node:assert/strict";
import * as engine from "../js/engine.mjs";

// =========================================================================
// 初始状态
// =========================================================================

test("初始状态符合预期", () => {
  const state = engine.createInitialState();
  assert.equal(state.coins, 30);
  assert.equal(state.totalCoinsEarned, 30);
  assert.equal(state.bowlsServed, 0);
  assert.equal(state.stars, 0);
  assert.equal(state.stage, 0);
  assert.equal(state.totalRevenue, 0);
  assert.equal(state.stations.roast.level, 1);
  assert.equal(state.stations.grind.level, 0);
  assert.equal(state.stations.extract.level, 0);
  assert.equal(state.stations.latte.level, 0);
  assert.equal(state.stations.serve.level, 0);
  assert.deepEqual(state.drinks, ["drink_espresso"]);
  assert.equal(state.activeDrink, "drink_espresso");
  assert.equal(state.cats.cat_orange.unlocked, true);
  assert.equal(state.cats.cat_calico.unlocked, false);
  assert.equal(state.cats.cat_british.unlocked, false);
  assert.equal(state.cats.cat_ragdoll.unlocked, false);
  assert.equal(state.activeCat, "cat_orange");
  assert.deepEqual(state.windows, {});
  assert.deepEqual(state.guests, []);
  assert.equal(typeof state.rngSeed, "number");
});

// =========================================================================
// 工位升级成本曲线（指数 cost = base × 1.15^level）
// =========================================================================

test("工位升级费用按 base × 1.15^level 指数递增", () => {
  assert.equal(engine.getStationCost("roast", 0), 15);
  assert.equal(engine.getStationCost("roast", 1), Math.floor(15 * 1.15));
  assert.equal(engine.getStationCost("grind", 5), Math.floor(100 * Math.pow(1.15, 5)));
  const a = engine.getStationCost("extract", 3);
  const b = engine.getStationCost("extract", 4);
  assert.ok(b > a, "等级越高费用越贵");
});

test("UPGRADE_STATION 合法操作扣金币+升级，金币不足静默失败", () => {
  const state = engine.createInitialState();
  state.coins = 1000;
  const initialCoins = state.coins;

  // 升级 grind 工位（lvl 0 → 1，cost = 100）
  const r1 = engine.performAction(state, { type: "UPGRADE_STATION", stationId: "grind" });
  assert.equal(r1.success, true);
  assert.equal(r1.newLevel, 1);
  assert.equal(state.stations.grind.level, 1);
  assert.equal(state.coins, initialCoins - 100);

  // 金币不足
  state.coins = 5;
  const r2 = engine.performAction(state, { type: "UPGRADE_STATION", stationId: "grind" });
  assert.equal(r2.success, false);
  assert.equal(state.stations.grind.level, 1, "金币不足不应升级");

  // 非法 stationId
  const r3 = engine.performAction(state, { type: "UPGRADE_STATION", stationId: "fake" });
  assert.equal(r3.success, false);
});

// =========================================================================
// 喵掌柜系统（星标解锁 + 升级倍率）
// =========================================================================

test("UNLOCK_CAT 消耗星标解锁第二只猫", () => {
  const state = engine.createInitialState();
  state.stars = 10;

  const r1 = engine.performAction(state, { type: "UNLOCK_CAT", catId: "cat_calico" });
  assert.equal(r1.success, true);
  assert.equal(state.cats.cat_calico.unlocked, true);
  assert.equal(state.stars, 0);

  // 星标不足
  const r2 = engine.performAction(state, { type: "UNLOCK_CAT", catId: "cat_british" });
  assert.equal(r2.success, false);
  assert.equal(state.cats.cat_british.unlocked, false);
});

test("UPGRADE_CAT 提升猫等级倍率", () => {
  const state = engine.createInitialState();
  state.cats.cat_orange.unlocked = true;
  state.cats.cat_orange.level = 0;
  state.coins = 1000;

  const r1 = engine.performAction(state, { type: "UPGRADE_CAT", catId: "cat_orange" });
  assert.equal(r1.success, true);
  assert.equal(state.cats.cat_orange.level, 1);
  assert.equal(state.coins, 1000 - 50); // baseCost=50
});

test("SWITCH_ACTIVE_CAT 切换出战猫", () => {
  const state = engine.createInitialState();
  state.cats.cat_calico.unlocked = true;

  const r1 = engine.performAction(state, { type: "SWITCH_ACTIVE_CAT", catId: "cat_calico" });
  assert.equal(r1.success, true);
  assert.equal(state.activeCat, "cat_calico");

  // 切换到未解锁的猫应失败
  const r2 = engine.performAction(state, { type: "SWITCH_ACTIVE_CAT", catId: "cat_ragdoll" });
  assert.equal(r2.success, false);
});

// =========================================================================
// 每秒产出
// =========================================================================

test("初始 RPS = 2（烘焙机 lvl1 × 2 baseRate）", () => {
  const state = engine.createInitialState();
  // tickIndex=10 处于清醒窗口（0-2 打盹，3-9 清醒）
  assert.equal(engine.calculateRevenuePerSecond(state, 5), 2);
});

test("升级工位与升级猫线性提升 RPS", () => {
  const state = engine.createInitialState();
  // tickIndex=5 处于清醒窗口（cyclePosition=5 > 2）
  // roast lvl 2 = 4
  state.stations.roast.level = 2;
  assert.equal(engine.calculateRevenuePerSecond(state, 5), 4);

  // 猫 lvl 1 = 1.5× → 4 * 1.5 = 6
  state.cats.cat_orange.level = 1;
  assert.equal(engine.calculateRevenuePerSecond(state, 5), 6);

  // grind lvl 3（无猫）= 12，加入总和 = 18
  state.stations.grind.level = 3;
  assert.equal(engine.calculateRevenuePerSecond(state, 5), 18);
});

// =========================================================================
// 饮品研制
// =========================================================================

test("RESEARCH_DRINK 需 bowls 与 coins 门槛", () => {
  const state = engine.createInitialState();
  state.coins = 10000;

  // drink_americano: cost=200, reqBowls=30
  state.bowlsServed = 20;
  const r1 = engine.performAction(state, { type: "RESEARCH_DRINK", drinkId: "drink_americano" });
  assert.equal(r1.success, false, "bowls 不够");

  state.bowlsServed = 30;
  const r2 = engine.performAction(state, { type: "RESEARCH_DRINK", drinkId: "drink_americano" });
  assert.equal(r2.success, true);
  assert.deepEqual(state.drinks, ["drink_espresso", "drink_americano"]);
  assert.equal(state.activeDrink, "drink_americano");
});

test("SWITCH_ACTIVE_DRINK 必须在已研制列表中", () => {
  const state = engine.createInitialState();
  state.drinks = ["drink_espresso"];

  const r1 = engine.performAction(state, { type: "SWITCH_ACTIVE_DRINK", drinkId: "drink_latte" });
  assert.equal(r1.success, false);

  state.drinks.push("drink_latte");
  const r2 = engine.performAction(state, { type: "SWITCH_ACTIVE_DRINK", drinkId: "drink_latte" });
  assert.equal(r2.success, true);
});

// =========================================================================
// 窗口扩张（阶段门槛 + 金币门槛）
// =========================================================================

test("UNLOCK_WINDOW 需 stage 门槛", () => {
  const state = engine.createInitialState();
  state.coins = 100000;

  // window_takeout: reqStage=1, cost=500
  const r1 = engine.performAction(state, { type: "UNLOCK_WINDOW", windowId: "window_takeout" });
  assert.equal(r1.success, false, "stage 0 < 1");

  state.stage = 1;
  const r2 = engine.performAction(state, { type: "UNLOCK_WINDOW", windowId: "window_takeout" });
  assert.equal(r2.success, true);
  assert.equal(state.windows.window_takeout, true);
  assert.equal(state.coins, 100000 - 500);
});

// =========================================================================
// 声誉升级
// =========================================================================

test("UPGRADE_STAGE 需 totalRevenue 门槛", () => {
  const state = engine.createInitialState();

  const r1 = engine.performAction(state, { type: "UPGRADE_STAGE" });
  assert.equal(r1.success, false, "revenue 0 < 3000");

  state.totalRevenue = 3000;
  const r2 = engine.performAction(state, { type: "UPGRADE_STAGE" });
  assert.equal(r2.success, true);
  assert.equal(state.stage, 1);
});

// =========================================================================
// 常客图鉴
// =========================================================================

test("SERVE_GUEST_DRINK 喂对偏好饮品解锁图鉴", () => {
  const state = engine.createInitialState();
  state.bowlsServed = 50;
  state.coins = 1000;
  // 先研制 drink_americano（SERVE 要求饮品已研制）
  engine.performAction(state, { type: "RESEARCH_DRINK", drinkId: "drink_americano" });

  // 喂程序员猫美式（其偏好饮品）
  const r1 = engine.performAction(state, {
    type: "SERVE_GUEST_DRINK",
    guestId: "guest_officecat",
    drinkId: "drink_americano",
  });
  assert.equal(r1.success, true);
  assert.equal(r1.isFavorite, true);
  assert.deepEqual(state.guests, ["guest_officecat"]);

  // 喂错饮品 → 不解锁
  const r2 = engine.performAction(state, {
    type: "SERVE_GUEST_DRINK",
    guestId: "guest_writercat",
    drinkId: "drink_americano",
  });
  assert.equal(r2.success, true);
  assert.equal(r2.isFavorite, false);
  assert.equal(state.guests.includes("guest_writercat"), false);
});

test("checkNewGuestUnlocks 按 bowls 累计自动解锁", () => {
  const state = engine.createInitialState();
  state.bowlsServed = 25;
  const new1 = engine.checkNewGuestUnlocks(state);
  // guest_officecat reqBowls=20 → 应解锁
  assert.deepEqual(new1, ["guest_officecat"]);
  assert.deepEqual(state.guests, ["guest_officecat"]);

  state.bowlsServed = 110;
  const new2 = engine.checkNewGuestUnlocks(state);
  assert.ok(new2.includes("guest_writercat"));
});

// =========================================================================
// 猫咪打盹周期（确定性 + 永不归零 = 永不断产硬要求）
// =========================================================================

test("getCatProductionFactor 在 0.5~1.0 区间确定性震荡", () => {
  // level>=1 才进入打盹周期；level=0 永远 1.0
  const cat0 = { unlocked: true, level: 0, awakenUntilTick: 0 };
  for (let i = 0; i < 10; i++) {
    assert.equal(engine.getCatProductionFactor(cat0, i), 1.0, "level=0 永远 1.0");
  }

  // 升级后：周期 [0,2] 打盹 0.5，[3,9] 清醒 1.0
  const cat1 = { unlocked: true, level: 1, awakenUntilTick: 0 };
  const cycle = [];
  for (let i = 0; i < 20; i++) {
    cycle.push(engine.getCatProductionFactor(cat1, i));
  }
  // 永远 > 0（硬要求：永不断产）
  for (const v of cycle) {
    assert.ok(v > 0, `factor ${v} > 0`);
    assert.ok(v >= 0.5 && v <= 1.0, `factor ${v} 在 [0.5, 1.0]`);
  }
  // 周期性：第 0-2 打盹 (0.5)，第 3-9 清醒 (1.0)
  assert.equal(cycle[0], 0.5);
  assert.equal(cycle[1], 0.5);
  assert.equal(cycle[2], 0.5);
  assert.equal(cycle[3], 1.0);
  assert.equal(cycle[9], 1.0);
  assert.equal(cycle[10], 0.5); // 下一个周期开始
});

test("AWAKEN_CAT 摇醒猫恢复 100%", () => {
  const state = engine.createInitialState();
  state.cats.cat_orange.unlocked = true;
  state.cats.cat_orange.level = 1; // 升级后才进入打盹周期

  const r1 = engine.performAction(state, {
    type: "AWAKEN_CAT",
    catId: "cat_orange",
    currentTick: 100,
    awakenTicks: 30,
  });
  assert.equal(r1.success, true);

  // awakenUntilTick = 100 + 30 = 130，tickIndex < 130 时摇醒中 → 1.0
  assert.equal(engine.getCatProductionFactor(state.cats.cat_orange, 101), 1.0);
  assert.equal(engine.getCatProductionFactor(state.cats.cat_orange, 125), 1.0);
  // tickIndex=130 摇醒过期 → 走周期
  assert.equal(engine.getCatProductionFactor(state.cats.cat_orange, 131), 0.5);
});

// =========================================================================
// 离线倍率（4/4/4/218 = 13,952× 封顶）
// =========================================================================

test("离线倍率按四档里程碑叠加", () => {
  const state = engine.createInitialState();

  // 初始：×1
  assert.equal(engine.getOfflineMultiplier(state), 1);

  // m1 全自动流水线：×4
  state.cats.cat_orange.unlocked = true;
  state.cats.cat_calico.unlocked = true;
  state.cats.cat_british.unlocked = true;
  state.cats.cat_ragdoll.unlocked = true;
  assert.equal(engine.getOfflineMultiplier(state), 4);

  // m2 外带窗：×4 → 16
  state.windows.window_takeout = true;
  assert.equal(engine.getOfflineMultiplier(state), 16);

  // m3 露台：×4 → 64
  state.windows.window_terrace = true;
  assert.equal(engine.getOfflineMultiplier(state), 64);

  // m4 五星名店：×218 → 13,952
  state.stage = 4;
  assert.equal(engine.getOfflineMultiplier(state), 13952);
});

test("离线时长上限按声誉阶段递增（4/8/12/16/24h）", () => {
  const state = engine.createInitialState();
  assert.equal(engine.getMaxOfflineSeconds(state), 4 * 3600);

  state.stage = 1;
  assert.equal(engine.getMaxOfflineSeconds(state), 8 * 3600);

  state.stage = 4;
  assert.equal(engine.getMaxOfflineSeconds(state), 24 * 3600);
});

test("calculateOfflineEarnings 应用倍率 + 封顶时长", () => {
  const state = engine.createInitialState();
  state.coins = 100;
  state.stations.roast.level = 10; // rps = 20
  state.cats.cat_orange.unlocked = true;
  state.cats.cat_orange.level = 5; // 1 + 5*0.5 = 3.5× → 70
  state.cats.cat_calico.unlocked = true;
  state.cats.cat_british.unlocked = true;
  state.cats.cat_ragdoll.unlocked = true;
  state.windows.window_takeout = true;
  state.windows.window_terrace = true;
  state.stage = 4;

  // 离线 100s：rps*100*0.5*13952 ≈ 巨大
  const r1 = engine.calculateOfflineEarnings(state, 100);
  assert.equal(r1.offlineSeconds, 100);
  assert.equal(r1.multiplier, 13952);
  assert.ok(r1.earnedCoins > 0);

  // 离线 100h：超过 24h 上限，按 24h 计算
  const r2 = engine.calculateOfflineEarnings(state, 100 * 3600);
  assert.equal(r2.offlineSeconds, 24 * 3600);
  // 与 100s 的产出比应 ≈ (24*3600) / 100 ≈ 864
  const ratio = r2.earnedCoins / r1.earnedCoins;
  assert.ok(Math.abs(ratio - 864) <= 1, `时长封顶比例 ${ratio} ≈ 864`);
});

// =========================================================================
// 想念桶（按上岗猫等分 + 确定性留言）
// =========================================================================

test("generateOfflineBuckets 按上岗猫等分离线收益", () => {
  const state = engine.createInitialState();
  state.stations.roast.level = 100; // 大量产出
  state.cats.cat_orange.unlocked = true;
  state.cats.cat_calico.unlocked = true;
  state.cats.cat_british.unlocked = true;
  state.cats.cat_ragdoll.unlocked = true;

  const mockMsgFn = (catId, vi) => `mock msg for ${catId} #${vi}`;
  const buckets = engine.generateOfflineBuckets(state, 600, mockMsgFn);
  assert.equal(buckets.length, 4);
  // 每个桶的金额 = 总收益 // 4
  const sum = buckets.reduce((a, b) => a + b.amount, 0);
  const earnings = engine.calculateOfflineEarnings(state, 600);
  assert.ok(sum <= earnings.earnedCoins);
  // 每只猫一条确定性留言
  for (const b of buckets) {
    assert.ok(typeof b.message === "string" && b.message.length > 0);
    assert.ok(b.message.startsWith("mock msg for cat_"));
  }
});

test("想念桶留言确定性：同一 visitIndex 相同留言", () => {
  const state = engine.createInitialState();
  state.stations.roast.level = 100;
  state.cats.cat_orange.unlocked = true;

  const mockMsgFn = (catId, vi) => `msg#${vi}`;
  const b1 = engine.generateOfflineBuckets(state, 600, mockMsgFn);
  state.offlineVisits = 5;
  const b2 = engine.generateOfflineBuckets(state, 600, mockMsgFn);
  assert.equal(b1[0].message, "msg#0");
  assert.equal(b2[0].message, "msg#5", "visitIndex 改变 → 留言改变");
});

// =========================================================================
// CLAIM_OFFLINE 领取想念桶
// =========================================================================

test("CLAIM_OFFLINE 累加想念桶金额", () => {
  const state = engine.createInitialState();
  const buckets = [
    { catId: "cat_orange", amount: 100, message: "msg1" },
    { catId: "cat_calico", amount: 200, message: "msg2" },
  ];

  const r1 = engine.performAction(state, { type: "CLAIM_OFFLINE", buckets });
  assert.equal(r1.success, true);
  assert.equal(r1.rewardCoins, 300);
  assert.equal(state.coins, 30 + 300);
  assert.equal(state.totalRevenue, 300);
  assert.equal(state.offlineVisits, 1);

  // 空桶失败
  const r2 = engine.performAction(state, { type: "CLAIM_OFFLINE", buckets: [] });
  assert.equal(r2.success, false);
});

// =========================================================================
// tick 主循环
// =========================================================================

test("tick 推进 dt 秒累积金币与 bowlsServed", () => {
  const state = engine.createInitialState();
  const r = engine.tick(state, 10, 0);
  // rps=2（cat_orange level=0 不打盹），10s = 20 coins
  assert.equal(r.earned, 20);
  assert.equal(state.coins, 50);
  // activeStationCount=1 → bowlsDelta = floor(10 * (1 + 1*0.5)) = floor(15) = 15
  assert.equal(state.bowlsServed, 15);
});

test("tick 0 或负数 dt 静默忽略", () => {
  const state = engine.createInitialState();
  const r = engine.tick(state, 0, 0);
  assert.equal(r.earned, 0);
  assert.equal(state.coins, 30);
});

// =========================================================================
// PRNG 确定性
// =========================================================================

test("createRng 序列确定性（同种子相同序列）", () => {
  const a = engine.createRng(42);
  const b = engine.createRng(42);
  for (let i = 0; i < 10; i++) {
    assert.equal(a(), b());
  }
});

test("randBetween 返回 [min, max) 区间", () => {
  const rng = engine.createRng(7);
  for (let i = 0; i < 100; i++) {
    const v = engine.randBetween(rng, 5, 10);
    assert.ok(v >= 5 && v < 10, `${v} in [5, 10)`);
  }
});

// =========================================================================
// 1000 步随机游走（不变式守恒）
// =========================================================================

test("1000 步随机操作序列不变式守恒（不抛错、不卡死、状态机自洽）", () => {
  const state = engine.createInitialState({ seed: 999 });
  const rng = engine.createRng(999);
  const validActions = [
    "UPGRADE_STATION",
    "UPGRADE_CAT",
    "UNLOCK_CAT",
    "SWITCH_ACTIVE_CAT",
    "UNLOCK_WINDOW",
    "UPGRADE_STAGE",
    "RESEARCH_DRINK",
    "SWITCH_ACTIVE_DRINK",
    "SERVE_GUEST_DRINK",
    "AWAKEN_CAT",
    "CLAIM_OFFLINE",
    "ADD_STARS",
  ];

  for (let step = 0; step < 1000; step++) {
    // 随机选择一种合法操作
    const type = validActions[Math.floor(rng() * validActions.length)];
    const action = { type };

    switch (type) {
      case "UPGRADE_STATION": {
        const sids = engine.STATION_IDS;
        action.stationId = sids[Math.floor(rng() * sids.length)];
        break;
      }
      case "UPGRADE_CAT":
      case "UNLOCK_CAT":
      case "SWITCH_ACTIVE_CAT":
      case "AWAKEN_CAT": {
        const cids = engine.CAT_IDS;
        const cid = cids[Math.floor(rng() * cids.length)];
        action.catId = cid;
        if (type === "AWAKEN_CAT") action.currentTick = step;
        break;
      }
      case "UNLOCK_WINDOW": {
        const wids = engine.WINDOW_IDS;
        action.windowId = wids[Math.floor(rng() * wids.length)];
        break;
      }
      case "RESEARCH_DRINK":
      case "SWITCH_ACTIVE_DRINK": {
        const dids = engine.DRINK_IDS;
        action.drinkId = dids[Math.floor(rng() * dids.length)];
        break;
      }
      case "SERVE_GUEST_DRINK": {
        const gids = engine.GUEST_IDS;
        const dids = engine.DRINK_IDS;
        action.guestId = gids[Math.floor(rng() * gids.length)];
        action.drinkId = dids[Math.floor(rng() * dids.length)];
        break;
      }
      case "CLAIM_OFFLINE": {
        action.buckets = [{ catId: "cat_orange", amount: 50, message: "msg" }];
        break;
      }
      case "ADD_STARS": {
        action.amount = Math.floor(rng() * 5) + 1;
        break;
      }
    }

    // 抛错检测
    let r;
    try {
      r = engine.performAction(state, action);
    } catch (e) {
      assert.fail(`step ${step} ${type} 抛错: ${e.message}`);
    }
    assert.ok(r, `step ${step} ${type} 应返回对象`);
    assert.equal(typeof r.success, "boolean");

    // 偶尔推进 tick（在线产出）
    if (step % 5 === 0) {
      engine.tick(state, 1, step);
    }
  }

  // 不变式：coins / bowlsServed 不为负；stage 0..4；数组长度有界
  assert.ok(state.coins >= 0, "coins 非负");
  assert.ok(state.bowlsServed >= 0, "bowlsServed 非负");
  assert.ok(state.stage >= 0 && state.stage <= 4, `stage ${state.stage} in [0,4]`);
  assert.ok(state.stars >= 0, "stars 非负");
  assert.ok(state.drinks.length <= engine.DRINK_IDS.length, "drinks 不超 8");
  assert.ok(state.guests.length <= engine.GUEST_IDS.length, "guests 不超 12");
  assert.ok(Object.keys(state.windows).length <= engine.WINDOW_IDS.length, "windows 不超 3");

  // 状态机不自相矛盾：已解锁的猫应该是 unlocked=true
  for (const cid of engine.CAT_IDS) {
    const cs = state.cats[cid];
    assert.ok(cs && typeof cs.unlocked === "boolean");
  }
});

// =========================================================================
// 边界与非法输入
// =========================================================================

test("performAction 接受 null / 非法 type 返回失败", () => {
  const state = engine.createInitialState();
  assert.equal(engine.performAction(state, null).success, false);
  assert.equal(engine.performAction(state, {}).success, false);
  assert.equal(engine.performAction(state, { type: "FAKE_ACTION" }).success, false);
  assert.equal(engine.performAction(state, { type: "ADD_STARS", amount: -5 }).success, false);
  assert.equal(engine.performAction(state, { type: "ADD_STARS", amount: 0 }).success, false);
});

test("engine 完全 DOM-free（不引入 document / window / Date）", async () => {
  const { readFileSync } = await import("node:fs");
  const sourceCode = readFileSync(
    new URL("../js/engine.mjs", import.meta.url),
    "utf8"
  );
  assert.equal(sourceCode.includes("document"), false, "不应引用 document");
  assert.equal(sourceCode.includes("window."), false, "不应引用 window.");
  assert.equal(sourceCode.includes("Date.now"), false, "不应使用 Date.now");
  assert.equal(sourceCode.includes("Math.random"), false, "不应使用 Math.random");
});