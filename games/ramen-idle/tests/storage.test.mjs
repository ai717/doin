// storage.test.mjs — 存档唯一口径：归一化、坏值降级、内存存储与读写回环
import { test } from "node:test";
import assert from "node:assert/strict";
import * as storage from "../js/storage.mjs";

test("默认存档结构与显式归一化", () => {
  storage.resetBackendForTests();
  const def = storage.load();
  assert.equal(def.coins, 10);
  assert.equal(def.bowlsServed, 0);
  assert.deepEqual(def.recipes, ["recipe_shoyu"]);
  assert.equal(def.shopTier, 0);

  // 脏数据归一化
  const dirty = storage.normalize({
    coins: "invalid",
    totalCoinsEarned: -50,
    bowlsServed: null,
    stations: { prep: { level: -3 } },
    workers: null,
    recipes: ["unknown_ramen", "recipe_shoyu", "recipe_shoyu"],
    shopTier: 999,
  });

  assert.equal(dirty.coins, 10, "非法数字回退");
  assert.equal(dirty.totalCoinsEarned, 10);
  assert.equal(dirty.bowlsServed, 0);
  assert.deepEqual(dirty.recipes, ["recipe_shoyu"], "非法配方过滤且去重");
  assert.equal(dirty.shopTier, 0, "越界阶段归一化");
});

test("读写回环与静默保存", () => {
  storage.resetBackendForTests();
  let s = storage.load();
  s.coins = 8888;
  s.bowlsServed = 66;
  storage.save(s);

  const reloaded = storage.load();
  assert.equal(reloaded.coins, 8888);
  assert.equal(reloaded.bowlsServed, 66);
});

test("坏 JSON 静默降级不抛错", () => {
  storage.resetBackendForTests();
  globalThis.localStorage = {
    _map: new Map(),
    setItem(k, v) {
      this._map.set(k, String(v));
    },
    getItem(k) {
      return k === storage.STORAGE_KEY ? "not-a-valid-json{{" : null;
    },
    removeItem(k) {
      this._map.delete(k);
    },
  };

  const loaded = storage.load();
  assert.equal(loaded.coins, 10, "坏 JSON 降级回退默认值");
  delete globalThis.localStorage;
  storage.resetBackendForTests();
});
