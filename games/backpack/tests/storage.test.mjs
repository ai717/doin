// storage.test.mjs — 存档层测试：归一化 / 记录口径 / 快照 / 静默降级

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  defaultState, defaultProgress, normalize, load, save, STORAGE_KEY,
  recordExpedition, recordPuzzle, recordMirror, setMuted, resetAll,
  saveRun, loadRun, clearRun, resetBackendForTests,
} from "../js/storage.mjs";

test("默认存档结构完整", () => {
  const state = defaultState();
  assert.equal(state.version, 1);
  assert.equal(state.prefs.muted, false);
  assert.deepEqual(state.progress.unlocked, { berserker: true, ranger: false, pyromancer: false });
  assert.equal(state.progress.rank, 0);
  assert.deepEqual(state.progress.stars, {});
  assert.deepEqual(state.progress.mirror, { rounds: 0, damage: 0 });
});

test("坏数据归一化：垃圾 JSON / 越界值 / 未知关卡全部静默回收", () => {
  resetBackendForTests();
  const garbage = normalize("not an object");
  assert.deepEqual(garbage, defaultState());

  const dirty = normalize({
    version: 99,
    prefs: { muted: "yes" },
    progress: {
      rank: 999,
      wins: -3,
      expeditions: "2",
      stars: { p01: 5, p99: 3, bad: "x" },
      mirror: { rounds: -1, damage: 1e9 },
      unlocked: { ranger: "true", pyromancer: 1 },
    },
  });
  assert.equal(dirty.progress.rank, 4);
  assert.equal(dirty.progress.wins, 0);
  assert.equal(dirty.progress.expeditions, 2);
  assert.deepEqual(dirty.progress.stars, { p01: 3 });
  assert.deepEqual(dirty.progress.mirror, { rounds: 0, damage: 1e9 });
  assert.equal(dirty.progress.unlocked.ranger, true);
  assert.equal(dirty.progress.unlocked.pyromancer, true);
  assert.equal(dirty.prefs.muted, false);
});

test("save/load 往返一致，存档 key 正确", () => {
  resetBackendForTests();
  const state = defaultState();
  state.progress.rank = 2;
  const saved = save(state);
  const loaded = load();
  assert.equal(loaded.progress.rank, 2);
  assert.ok(STORAGE_KEY.length > 0);
  assert.deepEqual(saved.progress, loaded.progress);
});

test("远征记录：胜场累计 + 职业解锁曲线（1 胜游侠 / 3 胜火法）", () => {
  resetBackendForTests();
  const s0 = recordExpedition(defaultState(), { rank: 1, wins: 0, expeditions: 1 });
  assert.equal(s0.progress.unlocked.ranger, false, "0 胜不解锁游侠");
  assert.equal(s0.progress.rank, 1);

  const s1 = recordExpedition(s0, { rank: 1, wins: 1, expeditions: 1 });
  assert.equal(s1.progress.unlocked.ranger, true, "1 胜解锁游侠");
  assert.equal(s1.progress.unlocked.pyromancer, false, "1 胜不解锁火法");

  const s3 = recordExpedition(s1, { rank: 1, wins: 2, expeditions: 1 });
  assert.equal(s3.progress.unlocked.pyromancer, true, "累计 3 胜解锁火法");
  assert.equal(s3.progress.wins, 3);
});

test("残局星级只增不减", () => {
  resetBackendForTests();
  const s1 = recordPuzzle(defaultState(), { puzzleId: "p05", stars: 2 });
  assert.equal(s1.state.progress.stars.p05, 2);
  assert.equal(s1.improved, true);
  const s2 = recordPuzzle(s1.state, { puzzleId: "p05", stars: 1 });
  assert.equal(s2.state.progress.stars.p05, 2, "低星不覆盖高星");
  assert.equal(s2.improved, false);
  const s3 = recordPuzzle(s2.state, { puzzleId: "p05", stars: 3 });
  assert.equal(s3.state.progress.stars.p05, 3);
  const s4 = recordPuzzle(s3.state, { puzzleId: "pNope", stars: 3 });
  assert.deepEqual(s4.state.progress.stars.pNope, undefined, "未知关卡丢弃");
});

test("镜像纪录取最高", () => {
  resetBackendForTests();
  const a = recordMirror(defaultState(), { rounds: 4, damage: 12 });
  assert.equal(a.isRecord, true);
  const b = recordMirror(a.state, { rounds: 3, damage: 30 });
  assert.equal(b.state.progress.mirror.rounds, 4);
  assert.equal(b.state.progress.mirror.damage, 30);
});

test("静音偏好与清档", () => {
  resetBackendForTests();
  const muted = setMuted(defaultState(), true);
  assert.equal(muted.prefs.muted, true);
  const afterReset = resetAll();
  assert.equal(afterReset.prefs.muted, false);
  assert.deepEqual(afterReset.progress, defaultProgress());
});

test("远征快照：保存 / 读取 / 清除", () => {
  resetBackendForTests();
  assert.equal(loadRun(), null, "初始无快照");
  saveRun({ mode: "expedition", classId: "ranger", bag: "A", round: 7, gold: 21, wins: 3, losses: 1 });
  const run = loadRun();
  assert.equal(run.mode, "expedition");
  assert.equal(run.round, 7);
  clearRun();
  assert.equal(loadRun(), null, "清除后无快照");
  // 非远征模式的脏快照拒绝读取
  saveRun({ mode: "puzzle" });
  assert.equal(loadRun(), null);
});
