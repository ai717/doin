// storage.test.mjs —— 归一化、统计口径、连胜、每日幂等、双人战绩。
import { test } from "node:test";
import assert from "node:assert/strict";
import * as S from "../js/storage.mjs";

test("normalize：null/损坏/旧版本一律回落默认值", () => {
  for (const junk of [null, undefined, 42, "x", {}, { v: 9 }, { v: 1, track: "fr" }, { v: 1, mode: "ranked" }]) {
    const d = S.normalize(junk);
    assert.equal(d.v, 1);
    assert.equal(d.track, "en");
    assert.equal(d.mode, "daily");
    assert.equal(d.muted, false);
  }
});

test("normalize：数字钳制与分布长度补齐", () => {
  const d = S.normalize({
    v: 1,
    en: { stats: { played: -5, wins: 1e12, dist: [1, 2], streak: "x", maxStreak: 3.7, lastDay: "2026101" } },
    cn: { practice: { count: "a", wins: -1, best: 99 } },
  });
  assert.equal(d.en.stats.played, 0);
  assert.equal(d.en.stats.wins, 1e9);
  assert.equal(d.en.stats.dist.length, 7);
  assert.deepEqual(d.en.stats.dist, [1, 2, 0, 0, 0, 0, 0]);
  assert.equal(d.en.stats.streak, 0);
  assert.equal(d.en.stats.maxStreak, 3);
  assert.equal(d.en.stats.lastDay, "");
  assert.deepEqual(d.cn.practice, { count: 0, wins: 0, best: 7 });
});

test("normalize：daily/duel 状态字段损坏时安全丢弃", () => {
  const d = S.normalize({
    v: 1,
    en: { daily: { day: "not-a-day", guesses: "x", won: "y" }, duelState: { day: 123 } },
  });
  assert.equal(d.en.daily, null);
  assert.equal(d.en.duelState, null);
  const d2 = S.normalize({
    v: 1,
    cn: { daily: { day: "20261018", guesses: ["一心一意", 42, null, "abcd"], won: false, recorded: true } },
  });
  assert.deepEqual(d2.cn.daily, { day: "20261018", guesses: ["一心一意", "abcd"], hint: null, won: false, recorded: true });
});

test("saveDailyProgress：拒绝未来日回填；同日/换日正常写入", () => {
  const d = S.normalize(null);
  assert.equal(S.saveDailyProgress(d, "en", "20261018", ["crate"]), true);
  assert.equal(S.saveDailyProgress(d, "en", "20261018", ["sauce"]), true, "同日可覆盖");
  assert.deepEqual(d.en.daily.guesses, ["sauce"]);
  assert.equal(S.saveDailyProgress(d, "en", "20261019", ["crane"]), true, "次日推进正常");
  assert.equal(d.en.daily.day, "20261019");
  assert.equal(S.saveDailyProgress(d, "en", "20260101", ["stale"]), false, "旧档不得回填更新的一天");
  assert.equal(d.en.daily.day, "20261019");
});

test("recordDaily：胜率/分布/连胜/最高连胜口径", () => {
  const d = S.normalize(null);
  S.saveDailyProgress(d, "en", "20261016", ["crate"]);
  S.recordDaily(d, "en", "20261016", true, 1);
  S.saveDailyProgress(d, "en", "20261017", ["crate"]);
  S.recordDaily(d, "en", "20261017", true, 3);
  S.saveDailyProgress(d, "en", "20261018", ["crate"]);
  S.recordDaily(d, "en", "20261018", true, 6);
  const s = d.en.stats;
  assert.equal(s.played, 3);
  assert.equal(s.wins, 3);
  assert.deepEqual(s.dist, [1, 0, 1, 0, 0, 1, 0]);
  assert.equal(s.streak, 3);
  assert.equal(s.maxStreak, 3);
});

test("recordDaily：断签重置连胜；败局重置；重复结算幂等", () => {
  const d = S.normalize(null);
  S.saveDailyProgress(d, "en", "20261016", ["crate"]);
  S.recordDaily(d, "en", "20261016", true, 2);
  S.saveDailyProgress(d, "en", "20261017", ["crate"]);
  S.recordDaily(d, "en", "20261017", true, 2);
  assert.equal(d.en.stats.streak, 2);
  assert.equal(d.en.stats.maxStreak, 2);
  // 跳过一天 -> 连胜从 1 重开
  S.saveDailyProgress(d, "en", "20261019", ["crate"]);
  S.recordDaily(d, "en", "20261019", true, 2);
  assert.equal(d.en.stats.streak, 1);
  assert.equal(d.en.stats.maxStreak, 2);
  // 败局
  S.saveDailyProgress(d, "en", "20261020", ["crate"]);
  S.recordDaily(d, "en", "20261020", false, 6);
  assert.equal(d.en.stats.streak, 0);
  assert.equal(d.en.stats.played, 4);
  assert.equal(d.en.stats.wins, 3);
  // 幂等：同日重复结算不追加
  assert.equal(S.recordDaily(d, "en", "20261020", true, 1), false);
  assert.equal(d.en.stats.played, 4);
  // 无当日进度时拒绝结算
  assert.equal(S.recordDaily(d, "en", "20261021", true, 1), false);
});

test("recordPractice：次数/胜场/最少行数", () => {
  const d = S.normalize(null);
  S.recordPractice(d, "en", true, 4);
  S.recordPractice(d, "en", false, 6);
  S.recordPractice(d, "en", true, 2);
  assert.deepEqual(d.en.practice, { count: 3, wins: 2, best: 2 });
});

test("recordDuel：甲/乙/平局三向战绩", () => {
  const d = S.normalize(null);
  S.recordDuel(d, "cn", 0);
  S.recordDuel(d, "cn", 0);
  S.recordDuel(d, "cn", 1);
  S.recordDuel(d, "cn", -1);
  assert.deepEqual(d.cn.duelTally, { a: 2, b: 1, draw: 1 });
});

test("saveDuelState / clearDuelState / clearDaily：字段收敛", () => {
  const d = S.normalize(null);
  S.saveDuelState(d, "en", { day: "20261018", players: [["a", "b", "c"], ["d"]], active: 1, done: false, winner: null });
  assert.equal(d.en.duelState.day, "20261018");
  assert.deepEqual(d.en.duelState.players[0], ["a", "b", "c"]);
  S.clearDuelState(d, "en");
  assert.equal(d.en.duelState, null);
  S.saveDailyProgress(d, "en", "20261018", ["crate"]);
  S.clearDaily(d, "en");
  assert.equal(d.en.daily, null);
});
