import test from "node:test";
import assert from "node:assert/strict";

import {
  MODES, STORAGE_KEY, applyCampaignResult, applyOutcome, defaultState, load, normalize,
  resetBackendForTests, save, starsFor, totalStars,
} from "../js/storage.mjs";
import { OUTCOME_DRAW, OUTCOME_LOSS, OUTCOME_WIN } from "../js/score.mjs";
import { PUZZLES } from "../js/puzzles.mjs";

const eq = assert.strictEqual;

function installStorage(entries = []) {
  const store = new Map(entries);
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  resetBackendForTests();
  return store;
}

test("默认存档结构完整，key 用 doin.ultimate.v1", () => {
  eq(STORAGE_KEY, "doin.ultimate.v1");
  const state = defaultState();
  eq(state.prefs.mode, MODES.DUEL);
  eq(state.prefs.tier, "duelist");
  eq(state.stats.wins, 0);
  eq(state.session, null);
  assert.deepEqual(state.campaign, {});
});

test("往返读写一致", () => {
  installStorage();
  const state = defaultState();
  state.prefs.mode = MODES.CAMPAIGN;
  state.prefs.tier = "master";
  state.prefs.pvp = true;
  state.prefs.muted = true;
  state.prefs.lastPuzzle = "u07";
  state.stats.wins = 3;
  state.stats.totalScore = 420;
  state.campaign = { u01: { stars: 3, bestMoves: 2 } };
  eq(save(state), true);
  const loaded = load();
  eq(loaded.prefs.mode, MODES.CAMPAIGN);
  eq(loaded.prefs.tier, "master");
  eq(loaded.prefs.pvp, true);
  eq(loaded.prefs.muted, true);
  eq(loaded.prefs.lastPuzzle, "u07");
  eq(loaded.stats.wins, 3);
  eq(loaded.stats.totalScore, 420);
  eq(loaded.campaign.u01.stars, 3);
  eq(loaded.campaign.u01.bestMoves, 2);
});

test("坏数据归一化：非法模式 / 档位 / 关卡 / 统计全部回落", () => {
  const normalized = normalize({
    prefs: { mode: "nope", tier: "god", pvp: "yes", muted: 1, lastPuzzle: "zzz" },
    stats: { wins: -2, losses: "x", draws: 1.9, streak: "3", bestStreak: null, totalScore: Infinity },
    campaign: { u01: { stars: 9, bestMoves: -4 }, nope: { stars: 3 } },
    session: { mode: "campaign", tier: "bad", puzzleId: "nope", moves: [0, 1] },
  });
  eq(normalized.prefs.mode, MODES.DUEL);
  eq(normalized.prefs.tier, "duelist");
  eq(normalized.prefs.pvp, true);
  eq(normalized.prefs.lastPuzzle, PUZZLES[0].id);
  eq(normalized.stats.wins, 0);
  eq(normalized.stats.losses, 0);
  eq(normalized.stats.draws, 1);
  eq(normalized.stats.streak, 3);
  eq(normalized.stats.bestStreak, 0);
  eq(normalized.stats.totalScore, 0);
  eq(normalized.campaign.u01.stars, 3);
  eq(normalized.campaign.u01.bestMoves, 0);
  eq(normalized.campaign.nope, undefined);
  eq(normalized.session, null, "残局存档指向不存在的关卡必须整条丢弃");
});

test("会话落子序列过滤非法值", () => {
  const normalized = normalize({
    session: { mode: "duel", pvp: true, tier: "novice", moves: [0, 9, -1, 81, 2.5, "3", 40] },
  });
  assert.ok(normalized.session);
  eq(normalized.session.mode, MODES.DUEL);
  eq(normalized.session.pvp, true);
  assert.deepEqual(normalized.session.moves, [0, 9, 40]);
});

test("战绩推进：胜涨连胜，平局保留，失败清零", () => {
  let stats = { wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0, totalScore: 0 };
  stats = applyOutcome(stats, OUTCOME_WIN, 100);
  stats = applyOutcome(stats, OUTCOME_WIN, 120);
  eq(stats.streak, 2);
  eq(stats.bestStreak, 2);
  eq(stats.totalScore, 220);
  stats = applyOutcome(stats, OUTCOME_DRAW, 40);
  eq(stats.streak, 2);
  eq(stats.draws, 1);
  stats = applyOutcome(stats, OUTCOME_LOSS, 0);
  eq(stats.streak, 0);
  eq(stats.losses, 1);
  eq(stats.bestStreak, 2);
});

test("残局记录只进不退：星数取最高、步数取最少", () => {
  const records = applyCampaignResult({}, "u01", { stars: 2, used: 4 });
  eq(records.u01.stars, 2);
  eq(records.u01.bestMoves, 4);
  const improved = applyCampaignResult(records, "u01", { stars: 3, used: 3 });
  eq(improved.u01.stars, 3);
  eq(improved.u01.bestMoves, 3);
  const worse = applyCampaignResult(improved, "u01", { stars: 1, used: 9 });
  eq(worse.u01.stars, 3);
  eq(worse.u01.bestMoves, 3);
  assert.deepEqual(applyCampaignResult({}, "nope", { stars: 3, used: 1 }), {});
  eq(starsFor(improved, "u01"), 3);
  eq(starsFor(improved, "u02"), 0);
  eq(totalStars(improved), 3);
});

test("localStorage 抛错时静默降级内存，读写都不炸", () => {
  globalThis.localStorage = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  resetBackendForTests();
  eq(load().prefs.mode, MODES.DUEL);
  eq(save(defaultState()), true);
  eq(load().stats.wins, 0);
  resetBackendForTests();
});

test("损坏 JSON 自动回落默认存档", () => {
  installStorage([[STORAGE_KEY, "{not json"]]);
  const state = load();
  eq(state.prefs.tier, "duelist");
  eq(state.session, null);
});
