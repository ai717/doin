import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultState,
  normalize,
  load,
  save,
  updateStats,
  resetBackendForTests
} from "../js/storage.mjs";
import { MODES } from "../js/engine.mjs";

test("storage: defaultState 提供完备默认结构", () => {
  const d = defaultState();
  assert.equal(d.version, 1);
  assert.equal(d.prefs.mode, "pve");
  assert.equal(d.prefs.targetScore, 5);
  assert.equal(d.stats.pveWins, 0);
  assert.equal(d.stats.maxRally, 0);
});

test("storage: normalize 容错能力与非法脏数据过滤", () => {
  assert.deepEqual(normalize(null), defaultState());
  assert.deepEqual(normalize("corrupted string"), defaultState());

  const dirty = {
    prefs: { mode: "unknown_mode", targetScore: 999, muted: "yes" },
    stats: { pveWins: -10, maxRally: "not_a_number" }
  };
  const clean = normalize(dirty);
  assert.equal(clean.prefs.mode, "pve");
  assert.equal(clean.prefs.targetScore, 5);
  assert.equal(clean.prefs.muted, true);
  assert.equal(clean.stats.pveWins, 0);
  assert.equal(clean.stats.maxRally, 0);
});

test("storage: 内存降级下的 load / save 循环", () => {
  resetBackendForTests();
  const initial = load();
  assert.equal(initial.stats.pveWins, 0);

  initial.stats.pveWins = 3;
  save(initial);

  const loaded = load();
  assert.equal(loaded.stats.pveWins, 3);
});

test("storage: updateStats 正确累加战绩与最大连拍", () => {
  const stats = defaultState().stats;
  const next = updateStats(stats, {
    mode: MODES.PVE,
    winner: "bottom",
    maxRally: 12,
    rallies: 12
  });

  assert.equal(next.pveWins, 1);
  assert.equal(next.maxRally, 12);
  assert.equal(next.totalHits, 12);
});