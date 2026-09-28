// game.test.mjs — CatCafeGame 协调器：存档加载、玩家操作分发、状态通知
import { test } from "node:test";
import assert from "node:assert/strict";
import * as storage from "../js/storage.mjs";
import { CatCafeGame } from "../js/game.mjs";

test("构造时自动从 storage 加载初始 state", () => {
  storage.resetBackendForTests();
  const game = new CatCafeGame();
  assert.equal(game.state.coins, 30);
  assert.equal(game.state.stations.roast.level, 1);
  assert.equal(game.state.cats.cat_orange.unlocked, true);
  assert.equal(game.state.activeCat, "cat_orange");
  game.stopLoop();
});

test("subscribe/notify 正确触发监听器", () => {
  storage.resetBackendForTests();
  const game = new CatCafeGame();
  game.state.coins = 1000; // 足够升级 grind（cost=100）

  const events = [];
  game.subscribe((state, event) => {
    events.push({ coins: state.coins, type: event.type });
  });

  game.upgradeStation("grind");
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "UPGRADE_STATION");
  assert.equal(events[0].coins, 1000 - 100);
  game.stopLoop();
});

test("upgradeStation 成功时扣金币+升级+save+notify", () => {
  storage.resetBackendForTests();
  const game = new CatCafeGame();
  game.state.coins = 1000;

  const r = game.upgradeStation("grind");
  assert.equal(r.success, true);
  assert.equal(game.state.stations.grind.level, 1);
  assert.equal(game.state.coins, 900);
  game.stopLoop();
});

test("upgradeStation 金币不足静默失败不 notify", () => {
  storage.resetBackendForTests();
  const game = new CatCafeGame();
  game.state.coins = 10;

  let notified = false;
  game.subscribe(() => { notified = true; });

  const r = game.upgradeStation("grind");
  assert.equal(r.success, false);
  assert.equal(notified, false);
  assert.equal(game.state.stations.grind.level, 0);
  game.stopLoop();
});

test("unlockCat 消耗星标解锁", () => {
  storage.resetBackendForTests();
  const game = new CatCafeGame();
  game.state.stars = 30;

  const r = game.unlockCat("cat_calico");
  assert.equal(r.success, true);
  assert.equal(game.state.cats.cat_calico.unlocked, true);
  assert.equal(game.state.stars, 20);
  game.stopLoop();
});

test("switchActiveCat 切换出战猫", () => {
  storage.resetBackendForTests();
  const game = new CatCafeGame();
  game.state.cats.cat_calico.unlocked = true;

  const r = game.switchActiveCat("cat_calico");
  assert.equal(r.success, true);
  assert.equal(game.state.activeCat, "cat_calico");
  game.stopLoop();
});

test("researchDrink 消耗杯数+金币+加入菜单", () => {
  storage.resetBackendForTests();
  const game = new CatCafeGame();
  game.state.coins = 10000;
  game.state.bowlsServed = 50;

  const r = game.researchDrink("drink_americano");
  assert.equal(r.success, true);
  assert.deepEqual(game.state.drinks, ["drink_espresso", "drink_americano"]);
  assert.equal(game.state.activeDrink, "drink_americano");
  game.stopLoop();
});

test("unlockWindow 需声誉门槛", () => {
  storage.resetBackendForTests();
  const game = new CatCafeGame();
  game.state.coins = 100000;

  const r1 = game.unlockWindow("window_takeout");
  assert.equal(r1.success, false, "stage 0 < 1");

  game.state.stage = 1;
  const r2 = game.unlockWindow("window_takeout");
  assert.equal(r2.success, true);
  assert.equal(game.state.windows.window_takeout, true);
  game.stopLoop();
});

test("upgradeStage 按 totalRevenue 门槛", () => {
  storage.resetBackendForTests();
  const game = new CatCafeGame();

  const r1 = game.upgradeStage();
  assert.equal(r1.success, false);

  game.state.totalRevenue = 3000;
  const r2 = game.upgradeStage();
  assert.equal(r2.success, true);
  assert.equal(game.state.stage, 1);
  game.stopLoop();
});

test("serveGuest 喂对偏好饮品解锁图鉴", () => {
  storage.resetBackendForTests();
  const game = new CatCafeGame();
  game.state.bowlsServed = 50;
  game.state.coins = 1000;
  game.researchDrink("drink_americano");

  const r = game.serveGuest("guest_officecat", "drink_americano");
  assert.equal(r.success, true);
  assert.equal(r.isFavorite, true);
  assert.deepEqual(game.state.guests, ["guest_officecat"]);
  game.stopLoop();
});

test("awakenCat 摇醒当前 tickIndex", () => {
  storage.resetBackendForTests();
  const game = new CatCafeGame();
  game.state.cats.cat_orange.unlocked = true;
  game.state.cats.cat_orange.level = 1;
  game.tickIndex = 100;

  const r = game.awakenCat("cat_orange", 100);
  assert.equal(r.success, true);
  assert.equal(game.state.cats.cat_orange.awakenUntilTick, 130);
  game.stopLoop();
});

test("claimPendingOffline 累加桶金额", () => {
  storage.resetBackendForTests();
  const game = new CatCafeGame();

  // 模拟想念桶已就绪
  game.pendingOfflineBuckets = {
    buckets: [
      { catId: "cat_orange", amount: 100, message: "msg1" },
      { catId: "cat_calico", amount: 200, message: "msg2" },
    ],
    earnedCoins: 300,
    multiplier: 1,
    efficiency: 0.5,
    offlineSeconds: 100,
  };

  const amount = game.claimPendingOffline();
  assert.equal(amount, 300);
  assert.equal(game.state.coins, 30 + 300);
  assert.equal(game.state.totalRevenue, 300);
  assert.equal(game.pendingOfflineBuckets, null, "claim 后清空");
  game.stopLoop();
});

test("claimPendingOffline 没有桶时返回 null", () => {
  storage.resetBackendForTests();
  const game = new CatCafeGame();
  assert.equal(game.pendingOfflineBuckets, null);

  const amount = game.claimPendingOffline();
  assert.equal(amount, null);
  game.stopLoop();
});

test("addStars 增加星标", () => {
  storage.resetBackendForTests();
  const game = new CatCafeGame();

  const r = game.addStars(15);
  assert.equal(r.success, true);
  assert.equal(game.state.stars, 15);
  game.stopLoop();
});

test("stopLoop 停止主循环", () => {
  storage.resetBackendForTests();
  const game = new CatCafeGame();
  game.init();
  assert.ok(game.timerId, "init 后 timerId 存在");
  game.stopLoop();
  assert.equal(game.timerId, null);
});