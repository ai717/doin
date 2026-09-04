import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  SCHEMA_VERSION,
  defaultBest,
  defaultState,
  normalize,
  load,
  save,
  recordResult,
  resetBackendForTests,
} from "../js/storage.mjs";

test("defaultState：结构完整，各难度有独立 best 槽", () => {
  const s = defaultState();
  assert.equal(s.version, SCHEMA_VERSION);
  assert.equal(s.prefs.difficulty, "beginner");
  assert.equal(s.prefs.muted, false);
  for (const id of ["beginner", "intermediate", "expert"]) {
    assert.ok(s.best[id]);
    assert.equal(s.best[id].bestScore, 0);
    assert.equal(s.best[id].bestTimeMs, null);
  }
});

test("normalize：兼容早期扁平 { difficulty } 迁移", () => {
  const s = normalize({ difficulty: "expert" });
  assert.equal(s.prefs.difficulty, "expert");
  assert.equal(s.prefs.muted, false);
  assert.equal(s.version, SCHEMA_VERSION);
});

test("normalize：非法/损坏数据回退默认，不抛异常", () => {
  assert.equal(normalize(null).prefs.difficulty, "beginner");
  assert.equal(normalize("garbage").prefs.difficulty, "beginner");
  assert.equal(normalize({ prefs: { difficulty: "???" } }).prefs.difficulty, "beginner");
  assert.equal(normalize({ best: { beginner: { bestTimeMs: -5 } } }).best.beginner.bestTimeMs, null);
});

test("recordResult：通关更新最佳分/最佳时间并返回破纪录标记（纯函数）", () => {
  const s0 = defaultState();
  const r1 = recordResult(s0, { difficulty: "beginner", won: true, score: 200, timeMs: 12000 });
  assert.equal(r1.isBestScore, true);
  assert.equal(r1.isBestTime, true);
  assert.equal(r1.state.best.beginner.bestScore, 200);
  assert.equal(r1.state.best.beginner.bestTimeMs, 12000);
  assert.equal(r1.state.best.beginner.plays, 1);
  assert.equal(r1.state.best.beginner.wins, 1);
  // 入参不被改动
  assert.equal(s0.best.beginner.plays, 0);

  const r2 = recordResult(r1.state, { difficulty: "beginner", won: true, score: 150, timeMs: 8000 });
  assert.equal(r2.isBestScore, false, "分更低，不破纪录");
  assert.equal(r2.isBestTime, true, "时间更短，破纪录");
  assert.equal(r2.state.best.beginner.bestScore, 200, "最高分保留");
  assert.equal(r2.state.best.beginner.bestTimeMs, 8000, "最佳时间更新");
});

test("recordResult：失败不计入分数/胜利，但仍计玩过一局", () => {
  const s0 = defaultState();
  const r = recordResult(s0, { difficulty: "expert", won: false, score: 0, timeMs: 50000 });
  assert.equal(r.isBestScore, false);
  assert.equal(r.isBestTime, false);
  assert.equal(r.state.best.expert.plays, 1);
  assert.equal(r.state.best.expert.wins, 0);
  assert.equal(r.state.best.expert.bestScore, 0);
});

test("recordResult：未知难度回退初级", () => {
  const s0 = defaultState();
  const r = recordResult(s0, { difficulty: "???", won: true, score: 99, timeMs: 1000 });
  assert.equal(r.state.best.beginner.plays, 1);
});

test("load/save 往返：内存后端可持久化", () => {
  resetBackendForTests();
  const s = defaultState();
  s.prefs.difficulty = "intermediate";
  s.best.intermediate = { bestScore: 333, bestTimeMs: 42000, plays: 2, wins: 1 };
  assert.equal(save(s), true);
  const loaded = load();
  assert.equal(loaded.prefs.difficulty, "intermediate");
  assert.equal(loaded.best.intermediate.bestScore, 333);
});

test("normalize：空对象与 undefined 都安全回退", () => {
  assert.equal(normalize({}).prefs.difficulty, "beginner");
  assert.equal(normalize(undefined).prefs.muted, false);
});
