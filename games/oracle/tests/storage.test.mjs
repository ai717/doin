import test from "node:test";
import assert from "node:assert/strict";

import { LEVELS } from "../js/levels.mjs";
import {
  STORAGE_KEY,
  defaultProgress,
  normalize,
  load,
  save,
  remember,
  recordLevel,
  levelRecord,
  setBackendForTests,
  resetBackendForTests,
} from "../js/storage.mjs";

function fakeBackend(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

test("存档：键统一且默认结构完整", () => {
  assert.equal(STORAGE_KEY, "doin.oracle.v1");
  assert.deepEqual(defaultProgress(), {
    version: 1,
    levels: {},
    current: { levelIndex: 0 },
  });
});

test("存档：坏数据归一化为默认值", () => {
  assert.deepEqual(normalize(null), defaultProgress());
  assert.deepEqual(normalize("oops"), defaultProgress());
  assert.deepEqual(normalize({ levels: 3, current: 8 }), defaultProgress());
  const clean = normalize({ levels: { unknown: { stars: 3 } }, current: { levelIndex: 999 } });
  assert.deepEqual(clean.levels, {});
  assert.equal(clean.current.levelIndex, LEVELS.length - 1);
});

test("存档：星级、用时与误配全部夹紧", () => {
  const id = LEVELS[0].id;
  const clean = normalize({
    levels: {
      [id]: { stars: 9, bestTime: -5, errors: 5000 },
      [LEVELS[1].id]: { stars: -2, bestTime: 999999, errors: -1 },
    },
    current: { levelIndex: -4 },
  });
  assert.equal(clean.levels[id].stars, 3);
  assert.equal(clean.levels[id].bestTime, 0);
  assert.equal(clean.levels[id].errors, 999);
  assert.equal(clean.levels[LEVELS[1].id].stars, 0);
  assert.equal(clean.levels[LEVELS[1].id].bestTime, 86400);
  assert.equal(clean.levels[LEVELS[1].id].errors, 0);
  assert.equal(clean.current.levelIndex, 0);
});

test("存档：保存后能原样读回", () => {
  resetBackendForTests();
  const progress = defaultProgress();
  progress.levels[LEVELS[2].id] = { stars: 2, bestTime: 41.5, errors: 1 };
  remember(progress, 2);
  assert.equal(save(progress), true);
  const loaded = load();
  assert.equal(loaded.levels[LEVELS[2].id].stars, 2);
  assert.equal(loaded.levels[LEVELS[2].id].bestTime, 41.5);
  assert.equal(loaded.current.levelIndex, 2);
});

test("存档：损坏 JSON 静默回退默认", () => {
  setBackendForTests(fakeBackend({ [STORAGE_KEY]: "{not json" }));
  assert.deepEqual(load(), defaultProgress());
  resetBackendForTests();
});

test("存档：成绩只升不降，用时取更快，误配取更少", () => {
  const id = LEVELS[0].id;
  const progress = defaultProgress();
  recordLevel(progress, id, { stars: 2, time: 40, errors: 3 });
  assert.deepEqual(levelRecord(progress, id), { stars: 2, bestTime: 40, errors: 3 });
  recordLevel(progress, id, { stars: 1, time: 55, errors: 5 });
  assert.deepEqual(levelRecord(progress, id), { stars: 2, bestTime: 40, errors: 3 });
  recordLevel(progress, id, { stars: 3, time: 31, errors: 0 });
  assert.deepEqual(levelRecord(progress, id), { stars: 3, bestTime: 31, errors: 0 });
  recordLevel(progress, "missing_level", { stars: 3, time: 1, errors: 0 });
  assert.equal(levelRecord(progress, "missing_level"), null);
});

test("存档：当前关卡夹紧且可保存", () => {
  const progress = defaultProgress();
  remember(progress, 999);
  assert.equal(progress.current.levelIndex, LEVELS.length - 1);
  remember(progress, -3);
  assert.equal(progress.current.levelIndex, 0);
  assert.equal(remember(null, 2), null);
});

test("存档：localStorage 不可用时降级内存", () => {
  resetBackendForTests();
  const progress = defaultProgress();
  progress.levels[LEVELS[3].id] = { stars: 1, bestTime: 12, errors: 4 };
  assert.equal(save(progress), true);
  assert.equal(load().levels[LEVELS[3].id].stars, 1);
  resetBackendForTests();
});
