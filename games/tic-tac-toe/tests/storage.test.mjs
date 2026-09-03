import test from "node:test";
import assert from "node:assert/strict";
import { OUTCOME_DRAW, OUTCOME_LOSS, OUTCOME_WIN } from "../js/score.mjs";
import { DIFFICULTY_EASY, DIFFICULTY_MASTER } from "../js/ai.mjs";
import {
  MODES,
  SCHEMA_VERSION,
  STORAGE_KEY,
  applyOutcome,
  defaultState,
  load,
  normalize,
  resetBackendForTests,
  save,
  winRate,
} from "../js/storage.mjs";

// 用一个最小内存后端替换 localStorage，让测试不依赖浏览器环境。
function installBackend(initial) {
  const map = new Map(initial ? Object.entries(initial) : []);
  globalThis.localStorage = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
  resetBackendForTests();
  return map;
}

test("defaultState: 结构完整且默认普通难度 / 3x3 / 人机", () => {
  const state = defaultState();
  assert.equal(state.version, SCHEMA_VERSION);
  assert.equal(state.prefs.difficulty, "normal");
  assert.equal(state.prefs.boardSize, 3);
  assert.equal(state.prefs.mode, MODES.PVE);
  assert.equal(state.stats.wins, 0);
  assert.equal(state.session, null);
});

test("normalize: 脏数据与缺字段全部退回默认值", () => {
  assert.deepEqual(normalize(null), defaultState());
  assert.deepEqual(normalize("garbage"), defaultState());
  assert.deepEqual(normalize({ stats: null, prefs: 42 }), defaultState());

  const patched = normalize({
    prefs: { difficulty: "godlike", boardSize: 99, theme: "neon", mode: "coop", muted: 1 },
    stats: { wins: -5, streak: "x", totalScore: 1.9 },
    session: { size: 7, moves: "nope" },
  });
  assert.equal(patched.prefs.difficulty, "normal");
  assert.equal(patched.prefs.boardSize, 3);
  assert.equal(patched.prefs.theme, "light");
  assert.equal(patched.prefs.mode, MODES.PVE);
  assert.equal(patched.prefs.muted, true);
  assert.equal(patched.stats.wins, 0);
  assert.equal(patched.stats.streak, 0);
  assert.equal(patched.stats.totalScore, 1);
  assert.equal(patched.session, null);
});

test("normalize: 合法会话被保留，越界落子被剔除", () => {
  const patched = normalize({
    prefs: { difficulty: DIFFICULTY_MASTER, boardSize: 4 },
    session: { size: 4, mode: MODES.PVP, difficulty: DIFFICULTY_EASY, aiMark: 2, firstPlayer: 1, moves: [0, 99, -1, 5] },
  });
  assert.equal(patched.prefs.boardSize, 4);
  assert.equal(patched.session.size, 4);
  assert.equal(patched.session.mode, MODES.PVP);
  assert.deepEqual(patched.session.moves, [0, 5]);
  assert.equal(patched.session.winLength, 4);
});

test("applyOutcome: 胜场推进连胜并记录最高连胜", () => {
  let stats = defaultState().stats;
  stats = applyOutcome(stats, OUTCOME_WIN, 100);
  assert.equal(stats.wins, 1);
  assert.equal(stats.streak, 1);
  assert.equal(stats.bestStreak, 1);
  assert.equal(stats.totalScore, 100);
  stats = applyOutcome(stats, OUTCOME_WIN, 40);
  assert.equal(stats.streak, 2);
  assert.equal(stats.bestStreak, 2);
  assert.equal(stats.totalScore, 140);
});

test("applyOutcome: 平局保留连胜，失败清零但保留最高纪录", () => {
  let stats = applyOutcome(applyOutcome(defaultState().stats, OUTCOME_WIN, 100), OUTCOME_WIN, 100);
  assert.equal(stats.streak, 2);
  stats = applyOutcome(stats, OUTCOME_DRAW, 30);
  assert.equal(stats.draws, 1);
  assert.equal(stats.streak, 2, "draws must not break a streak");
  stats = applyOutcome(stats, OUTCOME_LOSS, 0);
  assert.equal(stats.losses, 1);
  assert.equal(stats.streak, 0);
  assert.equal(stats.bestStreak, 2);
});

test("applyOutcome: 负分与脏输入不会让总积分倒退", () => {
  const stats = applyOutcome(defaultState().stats, OUTCOME_WIN, -50);
  assert.equal(stats.totalScore, 0);
  const weird = applyOutcome({ ...defaultState().stats, totalScore: 10 }, OUTCOME_WIN, 1.7);
  assert.equal(weird.totalScore, 11);
});

test("winRate: 未开局为 0，按胜场占比取整", () => {
  assert.equal(winRate(defaultState().stats), 0);
  const stats = { wins: 1, draws: 1, losses: 2, streak: 0, bestStreak: 1, totalScore: 0 };
  assert.equal(winRate(stats), 25);
});

test("save / load 往返一致，且能读回偏好与战绩", () => {
  const map = installBackend();
  const state = defaultState();
  state.prefs.difficulty = DIFFICULTY_MASTER;
  state.prefs.theme = "dark";
  state.stats = applyOutcome(state.stats, OUTCOME_WIN, 160);
  state.session = { size: 4, winLength: 4, mode: MODES.PVE, difficulty: DIFFICULTY_MASTER, aiMark: 2, firstPlayer: 1, moves: [0, 5] };

  assert.equal(save(state), true);
  assert.ok(map.has(STORAGE_KEY));
  const back = load();
  assert.equal(back.prefs.difficulty, DIFFICULTY_MASTER);
  assert.equal(back.prefs.theme, "dark");
  assert.equal(back.stats.wins, 1);
  assert.equal(back.stats.totalScore, 160);
  assert.deepEqual(back.session.moves, [0, 5]);
});

test("首次访问（无存档）返回默认状态", () => {
  installBackend();
  assert.deepEqual(load(), defaultState());
});

test("存档损坏（非法 JSON）时静默回退默认值", () => {
  installBackend({ [STORAGE_KEY]: "{not json" });
  assert.deepEqual(load(), defaultState());
});

test("localStorage 被禁用时降级到内存，不抛异常", () => {
  resetBackendForTests();
  globalThis.localStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  assert.deepEqual(load(), defaultState());
  assert.doesNotThrow(() => save(defaultState()));
});

test("无 localStorage 全局对象时同样可用", () => {
  resetBackendForTests();
  delete globalThis.localStorage;
  assert.deepEqual(load(), defaultState());
  const state = defaultState();
  state.prefs.theme = "dark";
  save(state);
  assert.equal(load().prefs.theme, "dark");
});
