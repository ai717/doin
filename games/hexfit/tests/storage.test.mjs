// storage.test.mjs — 存档唯一口径：归一化、静默降级、关卡记录、生存最佳。
import { test } from "node:test";
import assert from "node:assert/strict";
import * as storage from "../js/storage.mjs";
import { LEVEL_COUNT, STAR_MAX } from "../js/levels.mjs";

function makeLocalStorage() {
  return {
    _map: new Map(),
    setItem(k, v) { this._map.set(k, String(v)); },
    getItem(k) { return this._map.get(k) ?? null; },
    removeItem(k) { this._map.delete(k); },
  };
}

test("默认存档结构与显式归一化", () => {
  const def = storage.load();
  assert.equal(def.v, 1);
  assert.equal(def.muted, false);
  assert.equal(def.last, 1);
  assert.deepEqual(def.records, { stars: 0, cleared: 0 });
  assert.equal(def.bestSurvival, 0);
  // 脏数据归一化
  const dirty = storage.normalize({ muted: "yes", last: 999, levels: { 1: { stars: 99 } }, records: { stars: -5, cleared: 50 }, bestSurvival: "abc" });
  assert.equal(dirty.muted, false);
  assert.equal(dirty.last, LEVEL_COUNT);
  assert.equal(dirty.levels[1].stars, STAR_MAX, "星级 clamp 到上限");
  assert.equal(dirty.records.cleared, 1);
  assert.equal(dirty.bestSurvival, 0);
});

test("读写回环与坏 JSON 静默降级", () => {
  globalThis.localStorage = makeLocalStorage();
  try {
    let save = storage.load();
    save.muted = true;
    save = storage.save(save);
    const reloaded = storage.load();
    assert.equal(reloaded.muted, true);
    // 模拟坏 JSON
    globalThis.localStorage.getItem = (k) => k === storage.KEY ? "not-json{{{" : null;
    const after = storage.load();
    assert.equal(after.muted, false, "损坏自动回默认");
  } finally {
    delete globalThis.localStorage;
  }
});

test("recordLevel：星级取高、解锁下一关", () => {
  let save = storage.load();
  const r1 = storage.recordLevel(save, 1, { stars: 1, cleared: true });
  save = r1.data;
  assert.equal(r1.improved, true);
  assert.equal(save.levels[1].stars, 1);
  assert.equal(save.levels[1].cleared, true);
  // 二次更高星级覆盖
  const r2 = storage.recordLevel(save, 1, { stars: 3, cleared: true });
  save = r2.data;
  assert.equal(save.levels[1].stars, 3);
  // 低星级不覆盖
  const r3 = storage.recordLevel(save, 1, { stars: 1, cleared: true });
  assert.equal(r3.improved, false);
  assert.equal(r3.data.levels[1].stars, 3);
  // 解锁
  assert.equal(storage.isUnlocked(save, 1), true);
  assert.equal(storage.isUnlocked(save, 2), true, "通关 1 关解锁 2");
  assert.equal(storage.isUnlocked(save, 3), false, "未通关 2 关不解锁 3");
});

test("recordSurvival：只记最高分", () => {
  let save = storage.load();
  const r1 = storage.recordSurvival(save, 5000);
  save = r1.data;
  assert.equal(r1.improved, true);
  assert.equal(save.bestSurvival, 5000);
  const r2 = storage.recordSurvival(save, 3000);
  assert.equal(r2.improved, false);
  assert.equal(r2.data.bestSurvival, 5000, "低分不覆盖");
});

test("setMuted / setLast 不影响其他字段", () => {
  let save = storage.load();
  save = storage.recordLevel(save, 1, { stars: 2, cleared: true }).data;
  save = storage.setMuted(save, true);
  assert.equal(save.muted, true);
  assert.equal(save.levels[1].stars, 2, "静音不影响关卡记录");
  save = storage.setLast(save, 5);
  assert.equal(save.last, 5);
});

test("存档 key 统一 doin.hexfit.v1", () => {
  assert.equal(storage.KEY, "doin.hexfit.v1");
});
