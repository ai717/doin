// engine.test.mjs — 核心经济模型、工位成长、配方解锁、4/4/4/4/218离线倍率与1000步随机游走
import { test } from "node:test";
import assert from "node:assert/strict";
import * as engine from "../js/engine.mjs";

test("初始状态符合预期", () => {
  const state = engine.createInitialState();
  assert.equal(state.coins, 10);
  assert.equal(state.totalCoinsEarned, 10);
  assert.equal(state.bowlsServed, 0);
  assert.equal(state.stations.prep.level, 1);
  assert.equal(state.stations.stove.level, 0);
  assert.deepEqual(state.recipes, ["recipe_shoyu"]);
  assert.equal(state.shopTier, 0);
  assert.equal(state.prestigeCount, 0);
  assert.equal(state.prestigeMultiplier, 1.0);
});

test("工位升级费用指数递增", () => {
  const cost0 = engine.getStationCost("prep", 0);
  const cost1 = engine.getStationCost("prep", 1);
  const cost5 = engine.getStationCost("prep", 5);
  assert.equal(cost0, 10);
  assert.equal(cost1, Math.floor(10 * 1.15));
  assert.ok(cost5 > cost1, "级别越高费用越贵");
});

test("帮工雇佣与每秒营业额计算", () => {
  const state = engine.createInitialState();
  const initialRps = engine.calculateRevenuePerSecond(state);
  assert.equal(initialRps, 2); // 备料台 baseRate 2 * level 1

  // 升级备料台
  state.stations.prep.level = 2;
  assert.equal(engine.calculateRevenuePerSecond(state), 4);

  // 雇佣帮工
  state.workers.worker_prep.level = 1;
  // rate = 2 * 2 * (1 + 1 * 0.5) = 6
  assert.equal(engine.calculateRevenuePerSecond(state), 6);
});

test("出餐冲刺 (Rush Click) 在普通与狂潮时段", () => {
  const state = engine.createInitialState();
  state.stations.prep.level = 10;
  const normalIncome = engine.getRushClickIncome(state);
  assert.ok(normalIncome >= 1);

  // 触发狂潮冲刺状态
  state.rushRushActive = true;
  state.rushRemainingSeconds = 60;
  const rushIncome = engine.getRushClickIncome(state);
  assert.equal(rushIncome, normalIncome * 2, "狂潮时段出餐冲刺收益翻倍");
});

test("4/4/4/4/218 离线倍率分档验证", () => {
  const state = engine.createInitialState();

  // 初始状态，所有里程碑未达成
  let ms = engine.getOfflineMilestones(state);
  assert.equal(ms.totalMultiplier, 1);

  // 里程碑 1：全自动流水线（4 名帮工全部雇佣）
  state.workers.worker_prep.level = 1;
  state.workers.worker_chef.level = 1;
  state.workers.worker_server.level = 1;
  state.workers.worker_manager.level = 1;
  ms = engine.getOfflineMilestones(state);
  assert.equal(ms.m1, true);
  assert.equal(ms.totalMultiplier, 4);

  // 里程碑 2：首次扩店（达到小面馆 tier >= 1）
  state.shopTier = 1;
  ms = engine.getOfflineMilestones(state);
  assert.equal(ms.m2, true);
  assert.equal(ms.totalMultiplier, 16); // 4 * 4

  // 里程碑 3：配方图鉴点亮 5 款
  state.recipes = [
    "recipe_shoyu",
    "recipe_tonkotsu",
    "recipe_miso",
    "recipe_shio",
    "recipe_tsukemen",
  ];
  ms = engine.getOfflineMilestones(state);
  assert.equal(ms.m3, true);
  assert.equal(ms.totalMultiplier, 64); // 4 * 4 * 4

  // 里程碑 4：声誉达到深夜名店（tier >= 3）
  state.shopTier = 3;
  ms = engine.getOfflineMilestones(state);
  assert.equal(ms.m4, true);
  assert.equal(ms.totalMultiplier, 256); // 4 * 4 * 4 * 4

  // 里程碑 5：达成传说食堂（tier >= 4 且 8 款全配方点亮）
  state.shopTier = 4;
  state.recipes = [...engine.RECIPE_IDS];
  ms = engine.getOfflineMilestones(state);
  assert.equal(ms.m5, true);
  // 4 * 4 * 4 * 4 * 218 = 55808
  assert.equal(ms.totalMultiplier, 55808, "终局离线倍率达成 55808 倍！");
});

test("离线时长封顶与打烊留灯效率", () => {
  const state = engine.createInitialState();
  state.shopTier = 0; // 8 小时上限
  const maxSec = engine.getMaxOfflineSeconds(state);
  assert.equal(maxSec, 8 * 3600);

  // 未购买打烊留灯时效率 50%
  const off1 = engine.calculateOfflineEarnings(state, 100);
  assert.equal(off1.efficiency, 0.5);

  // 购买打烊留灯后效率 100%
  state.upgrades.lanterns_lit = true;
  const off2 = engine.calculateOfflineEarnings(state, 100);
  assert.equal(off2.efficiency, 1.0);
  assert.equal(off2.earnedCoins, off1.earnedCoins * 2);
});

test("常客解锁与小费加成累计", () => {
  const state = engine.createInitialState();
  state.bowlsServed = 20;
  const newGuests = engine.checkNewGuestUnlocks(state);
  assert.ok(newGuests.includes("guest_coder"));
  assert.ok(state.guests.includes("guest_coder"));

  const guestMult = engine.getGuestTipMultiplier(state);
  assert.ok(guestMult > 1.0);
});

test("翻新重装 (Prestige) 重置产线保留图鉴与永久加成", () => {
  const state = engine.createInitialState();
  state.shopTier = 4; // 传说食堂
  state.recipes = ["recipe_shoyu", "recipe_tonkotsu", "recipe_miso"];
  state.guests = ["guest_coder", "guest_driver"];
  state.stations.prep.level = 20;

  const res = engine.performAction(state, { type: "REFURBISH_PRESTIGE" });
  assert.equal(res.success, true);
  assert.equal(state.prestigeCount, 1);
  assert.equal(state.prestigeMultiplier, 2.0);
  assert.equal(state.stations.prep.level, 1);
  assert.deepEqual(state.recipes, ["recipe_shoyu", "recipe_tonkotsu", "recipe_miso"]);
  assert.deepEqual(state.guests, ["guest_coder", "guest_driver"]);
});

test("大步数随机游走测试（1000 步状态机无报错、不卡死、不变式不破）", () => {
  const rng = engine.createRng(987654321);
  const state = engine.createInitialState();

  const actionTypes = [
    "RUSH_CLICK",
    "UPGRADE_STATION",
    "HIRE_WORKER",
    "UNLOCK_RECIPE",
    "UPGRADE_SHOP_TIER",
    "BUY_SPECIAL_UPGRADE",
    "START_RUSH_HOUR",
    "TICK",
  ];

  for (let step = 0; step < 1000; step++) {
    const choice = actionTypes[Math.floor(rng() * actionTypes.length)];

    if (choice === "RUSH_CLICK") {
      const res = engine.performAction(state, { type: "RUSH_CLICK" });
      assert.equal(res.success, true);
    } else if (choice === "UPGRADE_STATION") {
      const sid = engine.STATION_IDS[Math.floor(rng() * engine.STATION_IDS.length)];
      engine.performAction(state, { type: "UPGRADE_STATION", stationId: sid });
    } else if (choice === "HIRE_WORKER") {
      const wid = Object.keys(engine.WORKER_DEFS)[Math.floor(rng() * Object.keys(engine.WORKER_DEFS).length)];
      engine.performAction(state, { type: "HIRE_WORKER", workerId: wid });
    } else if (choice === "UNLOCK_RECIPE") {
      const rid = engine.RECIPE_IDS[Math.floor(rng() * engine.RECIPE_IDS.length)];
      engine.performAction(state, { type: "UNLOCK_RECIPE", recipeId: rid });
    } else if (choice === "UPGRADE_SHOP_TIER") {
      engine.performAction(state, { type: "UPGRADE_SHOP_TIER" });
    } else if (choice === "BUY_SPECIAL_UPGRADE") {
      engine.performAction(state, { type: "BUY_SPECIAL_UPGRADE", upgradeId: "lanterns_lit" });
    } else if (choice === "START_RUSH_HOUR") {
      engine.performAction(state, { type: "START_RUSH_HOUR" });
    } else {
      const dt = rng() * 1.5;
      engine.tick(state, dt);
    }

    // 检查不变式
    assert.ok(state.coins >= 0, "金币永不为负");
    assert.ok(state.totalCoinsEarned >= state.coins, "累计收入大于等于当前现金");
    assert.ok(state.bowlsServed >= 0, "出餐数非负");
    assert.ok(state.recipes.length >= 1, "初始酱油配方始终保留");
    assert.ok(state.shopTier >= 0 && state.shopTier <= 4, "店铺阶段合法");
  }
});
