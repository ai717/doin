import test from "node:test";
import assert from "node:assert/strict";
import {
  STAGE_COUNT,
  STORAGE_KEY,
  defaultProgress,
  load,
  normalize,
  recordStage,
  recordTraining,
  remember,
  resetBackendForTests,
  save,
  stageRecord,
  totalStars,
} from "../js/storage.mjs";

test("存档：唯一键与默认结构", () => {
  assert.equal(STORAGE_KEY, "doin.raiden.v1");
  assert.equal(STAGE_COUNT, 6);
  const progress = defaultProgress();
  assert.deepEqual(progress.current, { mode: "stage", stageIndex: 0 });
  assert.deepEqual(progress.stages, {});
  assert.deepEqual(progress.training, { bestGraze: 0, bestStars: 0 });
});

test("存档：坏数据被夹取，未知面被丢弃", () => {
  const progress = normalize({
    version: 9,
    stages: {
      stage_1: { stars: 99, best: -5, graze: "x" },
      stage_9: { stars: 3, best: 9999, graze: 1 },
      junk: { stars: 1 },
    },
    training: { bestGraze: -2, bestStars: 7 },
    current: { mode: "nope", stageIndex: 99 },
  });
  assert.equal(progress.version, 1);
  assert.deepEqual(progress.stages.stage_1, { stars: 3, best: 0, graze: 0 });
  assert.equal(progress.stages.stage_9, undefined);
  assert.equal(progress.stages.junk, undefined);
  assert.deepEqual(progress.training, { bestGraze: 0, bestStars: 3 });
  assert.deepEqual(progress.current, { mode: "stage", stageIndex: 5 });
});

test("存档：关卡成绩只增不减", () => {
  const progress = defaultProgress();
  recordStage(progress, "stage_2", 2, 8000, 40);
  recordStage(progress, "stage_2", 1, 3000, 10);
  recordStage(progress, "stage_2", 3, 5000, 60);
  assert.deepEqual(stageRecord(progress, "stage_2"), { stars: 3, best: 8000, graze: 60 });
  assert.equal(totalStars(progress), 3);
});

test("存档：训练最佳同时只升不降", () => {
  const progress = defaultProgress();
  recordTraining(progress, 42, 2);
  recordTraining(progress, 11, 1);
  recordTraining(progress, 90, 3);
  assert.deepEqual(progress.training, { bestGraze: 90, bestStars: 3 });
});

test("存档：记忆模式与面数并夹取", () => {
  const progress = defaultProgress();
  remember(progress, "training", 4);
  assert.deepEqual(progress.current, { mode: "training", stageIndex: 4 });
  remember(progress, "stage", 99);
  assert.deepEqual(progress.current, { mode: "stage", stageIndex: 5 });
});

test("存档：写入后可完整读回", () => {
  resetBackendForTests();
  const progress = defaultProgress();
  recordStage(progress, "stage_3", 3, 12345, 77);
  recordTraining(progress, 88, 3);
  remember(progress, "stage", 2);
  assert.equal(save(progress), true);
  const back = load();
  assert.deepEqual(back.stages.stage_3, { stars: 3, best: 12345, graze: 77 });
  assert.deepEqual(back.training, { bestGraze: 88, bestStars: 3 });
  assert.deepEqual(back.current, { mode: "stage", stageIndex: 2 });
});

test("存档：损坏 JSON 静默回退默认值", () => {
  resetBackendForTests();
  const original = globalThis.localStorage;
  const store = new Map([[STORAGE_KEY, "{broken"]]);
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  try {
    resetBackendForTests();
    assert.deepEqual(load(), defaultProgress());
  } finally {
    globalThis.localStorage = original;
    resetBackendForTests();
  }
});

test("存档：存储抛错时静默降级内存", () => {
  resetBackendForTests();
  const original = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {},
  };
  try {
    resetBackendForTests();
    const progress = defaultProgress();
    recordStage(progress, "stage_1", 2, 100, 5);
    assert.equal(save(progress), true);
    assert.deepEqual(load().stages.stage_1, { stars: 2, best: 100, graze: 5 });
  } finally {
    globalThis.localStorage = original;
    resetBackendForTests();
  }
});
