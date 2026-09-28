// storage.test.mjs：坏数据归一化、降级内存回退、往返读写、进度推进。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  defaultState,
  normalize,
  load,
  save,
  recordClear,
  isUnlocked,
  resetBackendForTests,
} from "../js/storage.mjs";

test("defaultState 返回合法结构", () => {
  const s = defaultState();
  assert.equal(s.version, 1);
  assert.equal(s.prefs.muted, false);
  assert.equal(s.progress.cleared, 0);
  assert.deepEqual(s.progress.stars, {});
});

test("normalize 对坏数据兜底", () => {
  assert.deepEqual(normalize(null), defaultState());
  assert.deepEqual(normalize(undefined), defaultState());
  assert.deepEqual(normalize("garbage"), defaultState());
  assert.deepEqual(normalize({}), defaultState());

  const bad = {
    prefs: { muted: "yes" },
    progress: { cleared: "abc", stars: { "0": "x", "1": 5, "2": 2 } },
  };
  const n = normalize(bad);
  assert.equal(n.prefs.muted, true); // Boolean("yes")
  assert.equal(n.progress.cleared, 0); // int("abc") -> 0
  assert.equal(n.progress.stars["0"], undefined); // 非法星级被丢弃
  assert.equal(n.progress.stars["1"], undefined);
  assert.equal(n.progress.stars["2"], 2);
});

test("save/load 往返一致", () => {
  resetBackendForTests();
  const s = defaultState();
  s.progress.cleared = 3;
  s.progress.stars = { "0": 3, "1": 2 };
  s.prefs.muted = true;
  assert.equal(save(s), true);
  const loaded = load();
  assert.equal(loaded.progress.cleared, 3);
  assert.equal(loaded.progress.stars["0"], 3);
  assert.equal(loaded.progress.stars["1"], 2);
  assert.equal(loaded.prefs.muted, true);
});

test("load 无存档时返回默认", () => {
  resetBackendForTests();
  const s = load();
  assert.equal(s.progress.cleared, 0);
});

test("recordClear 推进进度并保留最高星级", () => {
  let progress = { cleared: 0, stars: {} };
  progress = recordClear(progress, 0, 40, 3);
  assert.equal(progress.cleared, 1);
  assert.equal(progress.stars["0"], 3);

  // 重复通关低星不覆盖高星
  progress = recordClear(progress, 0, 40, 1);
  assert.equal(progress.stars["0"], 3);

  // cleared 不超过总关数
  let p2 = { cleared: 39, stars: {} };
  p2 = recordClear(p2, 39, 40, 3);
  assert.equal(p2.cleared, 40);
});

test("isUnlocked 解锁逻辑", () => {
  const progress = { cleared: 2, stars: {} };
  assert.equal(isUnlocked(progress, 0), true); // 第 1 关恒解锁
  assert.equal(isUnlocked(progress, 1), true);
  assert.equal(isUnlocked(progress, 2), true); // cleared=2 表示已通关前 2 关，第 3 关（index 2）解锁
  assert.equal(isUnlocked(progress, 3), false);
});
