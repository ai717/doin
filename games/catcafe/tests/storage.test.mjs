// storage.test.mjs — 存档唯一口径：归一化、坏值降级、内存存储、读写回环、localStorage 不可用降级
import { test } from "node:test";
import assert from "node:assert/strict";
import * as storage from "../js/storage.mjs";
import * as engine from "../js/engine.mjs";

test("默认存档结构：load() 返回 createInitialState()", () => {
  storage.resetBackendForTests();
  const loaded = storage.load();
  assert.equal(loaded.coins, 30);
  assert.equal(loaded.bowlsServed, 0);
  assert.deepEqual(loaded.drinks, ["drink_espresso"]);
  assert.equal(loaded.stage, 0);
  assert.equal(loaded.stations.roast.level, 1);
  assert.equal(loaded.cats.cat_orange.unlocked, true);
  assert.equal(loaded.cats.cat_calico.unlocked, false);
  assert.equal(loaded.activeCat, "cat_orange");
  assert.deepEqual(loaded.windows, {});
  assert.equal(loaded.activeDrink, "drink_espresso");
});

test("normalize 脏数据全部降级默认值", () => {
  storage.resetBackendForTests();
  const dirty = {
    coins: "invalid",
    totalCoinsEarned: -50,
    bowlsServed: null,
    stars: -10,
    stage: 999,
    totalRevenue: NaN,
    offlineVisits: -5,
    stations: { roast: { level: -3 }, grind: null },
    cats: {
      cat_orange: { unlocked: false, level: -1, awakenUntilTick: -1 },
      cat_calico: null,
    },
    activeCat: "fake_cat",
    windows: { window_takeout: true, window_fake: true },
    drinks: ["unknown_drink", "drink_espresso", "drink_espresso"],
    activeDrink: "fake_drink",
    guests: ["unknown_guest", "guest_officecat"],
    rngSeed: -1,
    lastSaveTime: -1,
  };

  const norm = storage.normalize(dirty);
  assert.equal(norm.coins, 30, "非法 coins → 默认 30");
  assert.equal(norm.totalCoinsEarned, 30);
  assert.equal(norm.bowlsServed, 0);
  assert.equal(norm.stars, 0);
  assert.equal(norm.stage, 0, "stage 越界 → 0");
  assert.equal(norm.totalRevenue, 0, "NaN → 0");
  assert.equal(norm.offlineVisits, 0);
  assert.equal(norm.stations.roast.level, 0, "负数 level → 0");
  assert.equal(norm.stations.grind.level, 0, "null 工位 → 默认");
  // cat_orange 被强制解锁（兜底）
  assert.equal(norm.cats.cat_orange.unlocked, true);
  assert.equal(norm.cats.cat_orange.level, 0);
  assert.equal(norm.cats.cat_calico.unlocked, false);
  assert.equal(norm.cats.cat_calico.level, 0, "null cat → level 0");
  // activeCat 在 cats 里没有 unlocked 的会落到 cat_orange
  assert.equal(norm.activeCat, "cat_orange");
  // 未知 window 被过滤
  assert.equal(norm.windows.window_takeout, true);
  assert.equal(norm.windows.window_fake, undefined);
  // drinks 去重 + 过滤
  assert.deepEqual(norm.drinks, ["drink_espresso"]);
  // 未知 activeDrink → 列表第一项
  assert.equal(norm.activeDrink, "drink_espresso");
  // guests 过滤未知
  assert.deepEqual(norm.guests, ["guest_officecat"]);
  // rngSeed 负数 → 默认值（123456789）
  assert.equal(norm.rngSeed, 123456789);
  // lastSaveTime 负数 → Date.now()
  assert.ok(norm.lastSaveTime > 0);
});

test("normalize 接受 null / 非对象 返回初始状态", () => {
  const n1 = storage.normalize(null);
  assert.equal(n1.coins, 30);

  const n2 = storage.normalize(undefined);
  assert.equal(n2.coins, 30);

  const n3 = storage.normalize("not_an_object");
  assert.equal(n3.coins, 30);
});

test("读写回环：save 后 load 数据一致", () => {
  storage.resetBackendForTests();
  const s0 = storage.load();
  s0.coins = 8888;
  s0.bowlsServed = 66;
  s0.stars = 25;
  s0.stage = 2;
  s0.stations.roast.level = 5;
  s0.cats.cat_calico.unlocked = true;
  s0.cats.cat_calico.level = 3;
  s0.windows.window_takeout = true;
  s0.drinks.push("drink_americano");
  s0.activeDrink = "drink_americano";
  s0.guests.push("guest_officecat");
  s0.offlineVisits = 7;

  storage.save(s0);
  const reloaded = storage.load();

  assert.equal(reloaded.coins, 8888);
  assert.equal(reloaded.bowlsServed, 66);
  assert.equal(reloaded.stars, 25);
  assert.equal(reloaded.stage, 2);
  assert.equal(reloaded.stations.roast.level, 5);
  assert.equal(reloaded.cats.cat_calico.unlocked, true);
  assert.equal(reloaded.cats.cat_calico.level, 3);
  assert.equal(reloaded.windows.window_takeout, true);
  assert.deepEqual(reloaded.drinks, ["drink_espresso", "drink_americano"]);
  assert.equal(reloaded.activeDrink, "drink_americano");
  assert.deepEqual(reloaded.guests, ["guest_officecat"]);
  assert.equal(reloaded.offlineVisits, 7);
});

test("坏 JSON 静默降级不抛错", () => {
  storage.resetBackendForTests();
  // 注入 mock localStorage，返回坏 JSON
  const originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    _map: new Map([[storage.STORAGE_KEY, "not-a-valid-json{{"]]),
    setItem(k, v) {
      this._map.set(k, String(v));
    },
    getItem(k) {
      return this._map.get(k) ?? null;
    },
    removeItem(k) {
      this._map.delete(k);
    },
    clear() {
      this._map.clear();
    },
  };

  const loaded = storage.load();
  assert.equal(loaded.coins, 30, "坏 JSON → 默认状态");
  assert.equal(loaded.stations.roast.level, 1);

  globalThis.localStorage = originalLocalStorage;
  storage.resetBackendForTests();
});

test("localStorage 不可用时降级内存存储（读写回环仍工作）", () => {
  storage.resetBackendForTests();
  // 模拟 localStorage 抛出
  const originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    setItem() {
      throw new Error("QuotaExceeded");
    },
    getItem() {
      throw new Error("SecurityError");
    },
    removeItem() {
      throw new Error("SecurityError");
    },
  };

  // load 应该降级到内存默认
  const s0 = storage.load();
  assert.equal(s0.coins, 30);

  // save 应该不抛错
  s0.coins = 12345;
  const saved = storage.save(s0);
  assert.equal(saved.coins, 12345);

  // load 应该读回内存
  const s1 = storage.load();
  assert.equal(s1.coins, 12345, "内存降级模式仍能读写");

  globalThis.localStorage = originalLocalStorage;
  storage.resetBackendForTests();
});

test("clear() 清空存档，下次 load 回到初始状态", () => {
  storage.resetBackendForTests();
  const s0 = storage.load();
  s0.coins = 99999;
  storage.save(s0);

  let reloaded = storage.load();
  assert.equal(reloaded.coins, 99999);

  storage.clear();
  reloaded = storage.load();
  assert.equal(reloaded.coins, 30, "clear 后回到初始状态");
});

test("STORAGE_KEY 命名遵循 doin.<slug>.v1 契约", () => {
  assert.equal(storage.STORAGE_KEY, "doin.catcafe.v1");
});

test("normalize 不修改输入（pure 函数）", () => {
  const input = { coins: 100, drinks: ["drink_espresso"] };
  const snapshot = JSON.stringify(input);
  storage.normalize(input);
  assert.equal(JSON.stringify(input), snapshot, "原对象未被修改");
});

test("save 写入的 lastSaveTime 是当前时间戳", () => {
  storage.resetBackendForTests();
  const s0 = storage.load();
  const before = Date.now();
  const saved = storage.save(s0);
  const after = Date.now();

  assert.ok(saved.lastSaveTime >= before && saved.lastSaveTime <= after, "lastSaveTime 在调用窗口内");
});

test("离线收益计算的 state 完整往返（save→load→calculateOfflineEarnings）", () => {
  storage.resetBackendForTests();

  // 构造一个丰满的 state
  const state = engine.createInitialState();
  state.coins = 100000;
  state.stations.roast.level = 10;
  state.stations.grind.level = 8;
  state.stations.extract.level = 5;
  state.stations.latte.level = 3;
  state.stations.serve.level = 2;
  state.cats.cat_orange.unlocked = true;
  state.cats.cat_orange.level = 5;
  state.cats.cat_calico.unlocked = true;
  state.cats.cat_calico.level = 3;
  state.cats.cat_british.unlocked = true;
  state.cats.cat_british.level = 2;
  state.cats.cat_ragdoll.unlocked = true;
  state.cats.cat_ragdoll.level = 1;
  state.windows.window_takeout = true;
  state.windows.window_terrace = true;
  state.windows.window_garden = true;
  state.stage = 4;
  state.drinks = engine.DRINK_IDS;
  state.activeDrink = "drink_sunset";

  // 离线前 rps
  const rpsBefore = engine.calculateRevenuePerSecond(state);

  // 存档往返
  storage.save(state);
  const reloaded = storage.load();

  // 离线后 rps 应与存档前一致
  const rpsAfter = engine.calculateRevenuePerSecond(reloaded);
  assert.equal(rpsAfter, rpsBefore, "存档往返 RPS 一致");

  // 离线收益应可用
  const earnings = engine.calculateOfflineEarnings(reloaded, 24 * 3600);
  assert.ok(earnings.earnedCoins > 0);
  assert.equal(earnings.multiplier, 13952);
});