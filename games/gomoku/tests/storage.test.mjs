import test from "node:test";
import assert from "node:assert/strict";

import {
  STORAGE_KEY, SCHEMA_VERSION, MODES,
  defaultState, normalize, load, save, applyOutcome,
  resetBackendForTests,
} from "../js/storage.mjs";
import { DIFFICULTIES, DIFFICULTY_INTERMEDIATE, DIFFICULTY_MASTER } from "../js/ai.mjs";

const eq = assert.strictEqual;

// 给 node 注入一个内存版 localStorage（测试用）
function installMemoryStorage() {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
  return map;
}

test("STORAGE_KEY 与 SCHEMA_VERSION", () => {
  eq(STORAGE_KEY, "doin.gomoku.v1");
  eq(SCHEMA_VERSION, 1);
});

test("MODES 包含四种模式", () => {
  eq(MODES.PVE, "pve");
  eq(MODES.PVP, "pvp");
  eq(MODES.TSUMEGO, "tsumego");
  eq(MODES.FREE, "free");
});

test("defaultState: 包含 version/prefs/stats/tsumego/session", () => {
  const s = defaultState();
  eq(s.version, SCHEMA_VERSION);
  assert.ok(s.prefs && typeof s.prefs === "object");
  assert.ok(s.stats && typeof s.stats === "object");
  assert.ok(s.tsumego && typeof s.tsumego === "object");
  eq(s.session, null);
});

test("defaultState: prefs 默认值", () => {
  const s = defaultState();
  eq(s.prefs.difficulty, DIFFICULTY_INTERMEDIATE);
  eq(s.prefs.mode, MODES.PVE);
  eq(s.prefs.theme, "light");
  eq(s.prefs.muted, false);
});

test("defaultState: stats 含 byDifficulty 四档", () => {
  const s = defaultState();
  eq(s.stats.wins, 0);
  eq(s.stats.draws, 0);
  eq(s.stats.losses, 0);
  for (const d of DIFFICULTIES) {
    assert.ok(s.stats.byDifficulty[d]);
    eq(s.stats.byDifficulty[d].w, 0);
    eq(s.stats.byDifficulty[d].d, 0);
    eq(s.stats.byDifficulty[d].l, 0);
  }
});

test("defaultState: tsumego 默认解锁第 1 关", () => {
  const s = defaultState();
  assert.ok(s.tsumego.unlocked.includes(1));
  eq(Object.keys(s.tsumego.stars).length, 0);
});

test("normalize: 空输入 → 默认值", () => {
  const s = normalize(null);
  eq(s.version, SCHEMA_VERSION);
  eq(s.prefs.difficulty, DIFFICULTY_INTERMEDIATE);
});

test("normalize: 非法 difficulty 退回 intermediate", () => {
  const s = normalize({ prefs: { difficulty: "xxx" } });
  eq(s.prefs.difficulty, DIFFICULTY_INTERMEDIATE);
});

test("normalize: 非法 mode 退回 pve", () => {
  const s = normalize({ prefs: { mode: "xxx" } });
  eq(s.prefs.mode, MODES.PVE);
});

test("normalize: theme 非 dark/light 退回 light", () => {
  eq(normalize({ prefs: { theme: "xxx" } }).prefs.theme, "light");
  eq(normalize({ prefs: { theme: "dark" } }).prefs.theme, "dark");
  eq(normalize({ prefs: { theme: "light" } }).prefs.theme, "light");
});

test("normalize: stats 缺失字段补零", () => {
  const s = normalize({ stats: {} });
  eq(s.stats.wins, 0);
  eq(s.stats.draws, 0);
  eq(s.stats.losses, 0);
  for (const d of DIFFICULTIES) {
    eq(s.stats.byDifficulty[d].w, 0);
  }
});

test("normalize: stats 非法值退回 0", () => {
  const s = normalize({ stats: { wins: "abc", draws: -5, losses: 99.9, byDifficulty: { master: { w: 1.5 } } } });
  eq(s.stats.wins, 0);
  eq(s.stats.draws, 0);
  eq(s.stats.losses, 99);
  eq(s.stats.byDifficulty.master.w, 1);
});

test("normalize: tsumego unlocked 至少含 1", () => {
  const s = normalize({ tsumego: { unlocked: [5, 6, 7] } });
  assert.ok(s.tsumego.unlocked.includes(1));
  assert.ok(s.tsumego.unlocked.includes(5));
});

test("normalize: tsumego unlocked 非法值过滤", () => {
  const s = normalize({ tsumego: { unlocked: [0, -1, "x", 5, 99, 100] } });
  // 过滤掉 0/负数/字符串，但保留 ≤50 的正数
  assert.ok(!s.tsumego.unlocked.includes(0));
  assert.ok(!s.tsumego.unlocked.includes("x"));
  assert.ok(s.tsumego.unlocked.includes(5));
});

test("normalize: tsumego stars 非法 id 过滤", () => {
  const s = normalize({ tsumego: { stars: {
    "0": { stars: 3 }, "31": { stars: 3 }, "5": { stars: 2 },
  } } });
  eq(s.tsumego.stars[0], undefined);
  eq(s.tsumego.stars[31], undefined);
  assert.ok(s.tsumego.stars[5]);
  eq(s.tsumego.stars[5].stars, 2);
});

test("normalize: tsumego stars 钳制 0-3", () => {
  const s = normalize({ tsumego: { stars: {
    "5": { stars: 5 }, "6": { stars: -1 }, "7": { stars: 2 },
  } } });
  eq(s.tsumego.stars[5].stars, 3); // 钳到 3
  eq(s.tsumego.stars[6].stars, 0); // 钳到 0
  eq(s.tsumego.stars[7].stars, 2);
});

test("normalize: session 非法 mode 退回 pve", () => {
  const s = normalize({ session: { mode: "xxx", moves: [0, 1] } });
  eq(s.session.mode, MODES.PVE);
});

test("normalize: session 缺 moves 返回 null", () => {
  const s = normalize({ session: { mode: "pve" } });
  eq(s.session, null);
});

test("normalize: session moves 过滤非法索引", () => {
  const s = normalize({ session: { mode: "pve", moves: [0, 1, -1, 999, "x", 225] } });
  // 只保留 0,1
  assert.ok(s.session.moves.includes(0));
  assert.ok(s.session.moves.includes(1));
  assert.ok(!s.session.moves.includes(-1));
  assert.ok(!s.session.moves.includes(999));
});

test("load: 无存档 → 默认值", () => {
  resetBackendForTests();
  installMemoryStorage();
  const s = load();
  eq(s.version, SCHEMA_VERSION);
  eq(s.prefs.difficulty, DIFFICULTY_INTERMEDIATE);
});

test("load + save 往返一致", () => {
  resetBackendForTests();
  installMemoryStorage();
  const a = defaultState();
  a.prefs.difficulty = DIFFICULTY_MASTER;
  a.prefs.theme = "dark";
  a.stats.wins = 5;
  a.stats.byDifficulty.master.w = 3;
  a.tsumego.unlocked = [1, 2, 3];
  a.tsumego.stars = { 1: { stars: 3, bestMoves: 5, firstSolve: true } };
  a.session = { mode: "pvp", difficulty: DIFFICULTY_MASTER, firstPlayer: 1, moves: [112, 113], tsumego: null };

  save(a);
  const b = load();
  eq(b.prefs.difficulty, DIFFICULTY_MASTER);
  eq(b.prefs.theme, "dark");
  eq(b.stats.wins, 5);
  eq(b.stats.byDifficulty.master.w, 3);
  assert.ok(b.tsumego.unlocked.includes(2));
  eq(b.tsumego.stars[1].stars, 3);
  eq(b.session.mode, "pvp");
  eq(b.session.moves.length, 2);
});

test("load: 损坏 JSON → 默认值不抛错", () => {
  resetBackendForTests();
  const map = installMemoryStorage();
  map.set(STORAGE_KEY, "{not json");
  const s = load();
  eq(s.version, SCHEMA_VERSION);
  eq(s.prefs.difficulty, DIFFICULTY_INTERMEDIATE);
});

test("applyOutcome: 胜场 +1", () => {
  const stats = defaultState().stats;
  const next = applyOutcome(stats, "win", DIFFICULTY_MASTER);
  eq(next.wins, 1);
  eq(next.byDifficulty.master.w, 1);
  eq(next.byDifficulty.master.l, 0);
});

test("applyOutcome: 负场 +1", () => {
  const stats = defaultState().stats;
  const next = applyOutcome(stats, "loss", DIFFICULTY_INTERMEDIATE);
  eq(next.losses, 1);
  eq(next.byDifficulty.intermediate.l, 1);
});

test("applyOutcome: 和棋 +1", () => {
  const stats = defaultState().stats;
  const next = applyOutcome(stats, "draw", DIFFICULTY_INTERMEDIATE);
  eq(next.draws, 1);
  eq(next.byDifficulty.intermediate.d, 1);
});

test("applyOutcome: 不修改原 stats（不可变）", () => {
  const stats = defaultState().stats;
  const snapshot = JSON.parse(JSON.stringify(stats));
  applyOutcome(stats, "win", DIFFICULTY_MASTER);
  assert.deepStrictEqual(stats, snapshot);
});

test("applyOutcome: 非法 difficulty 退回 intermediate", () => {
  const stats = defaultState().stats;
  const next = applyOutcome(stats, "win", "xxx");
  eq(next.byDifficulty.intermediate.w, 1);
});

test("降级：localStorage 抛异常时 load 返回默认值", () => {
  resetBackendForTests();
  // 模拟 localStorage 不可用
  globalThis.localStorage = {
    getItem: () => { throw new Error("not allowed"); },
    setItem: () => { throw new Error("not allowed"); },
    removeItem: () => { throw new Error("not allowed"); },
  };
  const s = load();
  eq(s.version, SCHEMA_VERSION);
});

test("降级：localStorage 探测失败 → 降级到内存版 save 仍成功", () => {
  // storage() 探测时会 setItem + removeItem，若抛错则降级到内存版
  resetBackendForTests();
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => { throw new Error("not allowed"); },
    removeItem: () => { throw new Error("not allowed"); },
  };
  // save 不应抛错（即便探测失败也会降级到内存版）
  let ok = false;
  assert.doesNotThrow(() => {
    ok = save(defaultState());
  });
  // 探测失败 → 降级内存 → save 应成功
  eq(ok, true);
});
