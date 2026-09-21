import test from "node:test";
import assert from "node:assert/strict";
import * as Storage from "../js/storage.mjs";

test("Storage: 存储键严格遵循 doin.<slug>.v1", () => {
  assert.equal(Storage.STORAGE_KEY, "doin.rune-tower.v1");
});

test("Storage: 内存隔离与默认值正常加载", () => {
  Storage.clearSaveData();
  const data = Storage.loadSaveData();
  assert.equal(data.bestWave, 0);
  assert.equal(data.totalWins, 0);
  assert.equal(data.totalKills, 0);
  assert.equal(data.soundEnabled, true);
  assert.deepEqual(data.unlockedRelics, []);
});

test("Storage: 数据写入与增量统计更新", () => {
  Storage.clearSaveData();
  Storage.updateStats({
    wave: 14,
    won: false,
    kills: 120,
    timeSeconds: 310,
    newRelics: ["relic_split_arrow", "relic_combustion"],
  });

  const d1 = Storage.loadSaveData();
  assert.equal(d1.bestWave, 14);
  assert.equal(d1.totalKills, 120);
  assert.deepEqual(d1.unlockedRelics, ["relic_split_arrow", "relic_combustion"]);

  // 再次通关大胜
  Storage.updateStats({
    wave: 20,
    won: true,
    kills: 80,
    timeSeconds: 280,
    newRelics: ["relic_combustion", "relic_superconduct"],
  });

  const d2 = Storage.loadSaveData();
  assert.equal(d2.bestWave, 20);
  assert.equal(d2.totalWins, 1);
  assert.equal(d2.totalKills, 200);
  assert.equal(d2.fastestWinSeconds, 280);
  assert.equal(d2.unlockedRelics.length, 3);
});

test("Storage: 损坏脏数据自动归一化降级", () => {
  Storage.writeSaveData({
    bestWave: "invalid",
    totalWins: -5,
    unlockedRelics: "not_an_array",
    soundEnabled: "maybe",
  });

  const normalized = Storage.loadSaveData();
  assert.equal(normalized.bestWave, 0);
  assert.equal(normalized.totalWins, 0);
  assert.deepEqual(normalized.unlockedRelics, []);
  assert.equal(typeof normalized.soundEnabled, "boolean");
});

test("Storage: 章节解锁梯度推进与断点存档", () => {
  Storage.clearSaveData();

  // 初始为第一章
  let d = Storage.loadSaveData();
  assert.equal(d.maxChapterUnlocked, 1);

  // 通关第 5 波，解锁第二章
  Storage.updateStats({ wave: 5, kills: 20 });
  d = Storage.loadSaveData();
  assert.equal(d.maxChapterUnlocked, 2);

  // 保存局内临时进度
  Storage.saveCurrentRun({
    wave: 8,
    mana: 400,
    crystalHp: 18,
    score: 600,
    kills: 45,
    activeRelics: ["relic_split_arrow"],
  });

  d = Storage.loadSaveData();
  assert.ok(d.savedRun);
  assert.equal(d.savedRun.wave, 8);
  assert.equal(d.savedRun.mana, 400);

  // 清除临时进度
  Storage.clearSavedRun();
  d = Storage.loadSaveData();
  assert.equal(d.savedRun, null);
});

