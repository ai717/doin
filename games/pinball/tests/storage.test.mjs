// 霓虹弹珠台 · 存档单元测试
// 覆盖：默认存档 / 损坏数据归一化 / 越界钳制 / 存取回环 / 清档 / 存储不可用降级
import test from "node:test";
import assert from "node:assert/strict";
import { STORAGE_KEY, defaultSave, loadSave, saveSave, clearSave } from "../js/storage.mjs";

// 注入受控内存后端（Node 无 localStorage）
globalThis.localStorage = (() => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
})();

test("存储键为 doin.pinball.v1", () => {
  assert.equal(STORAGE_KEY, "doin.pinball.v1");
});

test("默认存档：音效开、1 关解锁、空星级、生存纪录清零", () => {
  const d = defaultSave();
  assert.equal(d.sound, true);
  assert.equal(d.unlockedLevel, 1);
  assert.deepEqual(d.stars, {});
  assert.equal(d.bestSurvivalScore, 0);
  assert.equal(d.bestSurvivalCombo, 0);
});

test("空存档读取返回默认值", () => {
  localStorage.removeItem(STORAGE_KEY);
  const save = loadSave();
  assert.equal(save.unlockedLevel, 1);
  assert.deepEqual(save.stars, {});
});

test("损坏 JSON 静默降级为默认（不抛错）", () => {
  localStorage.setItem(STORAGE_KEY, "{oops not json");
  const save = loadSave();
  assert.deepEqual(save, defaultSave());
});

test("非法类型与越界值被归一化拒绝（回退默认，不白屏）", () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    sound: "yes",
    unlockedLevel: 999,
    stars: { 5: 9, 0: 2, 31: 1, x: 3, 2: -1, 7: 2 },
    bestSurvivalScore: -5,
    bestSurvivalCombo: "huge"
  }));
  const save = loadSave();
  assert.equal(save.sound, true, "非布尔音效应回退默认");
  assert.equal(save.unlockedLevel, 1, "越界关卡应拒绝并回退默认");
  assert.deepEqual(save.stars, { 7: 2 }, "仅合法星值被采纳");
  assert.equal(save.bestSurvivalScore, 0);
  assert.equal(save.bestSurvivalCombo, 0);
});

test("存取回环：合法存档可完整保存并读回", () => {
  const save = {
    sound: false,
    unlockedLevel: 12,
    stars: { 1: 3, 2: 2, 11: 3 },
    bestSurvivalScore: 12345,
    bestSurvivalCombo: 27
  };
  assert.equal(saveSave(save), true);
  const read = loadSave();
  assert.deepEqual(read, save);
});

test("清档后读取为默认", () => {
  saveSave({ unlockedLevel: 8, stars: { 1: 1 } });
  assert.equal(clearSave(), true);
  assert.deepEqual(loadSave(), defaultSave());
});

test("存储不可用（抛错后端）时静默降级内存，读写不抛错", async () => {
  // 全新模块实例（避开已缓存的内存后端），此时 localStorage 抛错
  globalThis.localStorage = {
    getItem: () => { throw new Error("denied"); },
    setItem: () => { throw new Error("denied"); },
    removeItem: () => { throw new Error("denied"); }
  };
  const fresh = await import("../js/storage.mjs?v=throwing-backend");
  try {
    assert.deepEqual(fresh.loadSave(), fresh.defaultSave(), "存储不可用时应回默认");
    // 静默降级内存：写入仍成功（仅不持久化），绝不抛错
    assert.equal(fresh.saveSave({ unlockedLevel: 2 }), true);
    assert.equal(fresh.loadSave().unlockedLevel, 2, "降级后内存读写应生效");
  } finally {
    delete globalThis.localStorage;
  }
});
