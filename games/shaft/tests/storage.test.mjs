import test from "node:test";
import assert from "node:assert/strict";

import {
  defaults,
  normalize,
  save,
  recordCampaign,
  recordClassic,
  recordEndless,
  setSound,
  setMode,
  setLastLevel,
  totalStars,
  resetAll,
  resetBackendForTests,
} from "../js/storage.mjs";
import { LEVEL_COUNT } from "../js/levels.mjs";

test("storage: corrupt payloads fall back to defaults", () => {
  resetBackendForTests();
  const d = defaults();
  assert.deepEqual(normalize(null), d);
  assert.deepEqual(normalize(undefined), d);
  assert.deepEqual(normalize("boom"), d);
  assert.deepEqual(normalize(42), d);
  assert.deepEqual(normalize([1, 2, 3]), d);
  assert.equal(normalize({ sound: "yes" }).sound, true);
  assert.equal(normalize({ mode: "nope" }).mode, "campaign");
});

test("storage: numeric fields are clamped and bad star keys dropped", () => {
  const out = normalize({
    campaign: { unlocked: 999, stars: { 1: 9, 2: -3, 99: 2, x: 1 }, clears: -4, bestTime: -20 },
    classic: { clears: 1e12, bestTime: "abc", bestDepth: -5, bestScore: 1e15 },
    endless: { bestDepth: 1e9, bestScore: -1 },
    lastLevel: 500,
  });
  assert.equal(out.campaign.unlocked, LEVEL_COUNT);
  assert.equal(out.campaign.stars["1"], 3);
  assert.equal(out.campaign.stars["2"], undefined, "零星不写入");
  assert.equal(out.campaign.stars["99"], undefined, "越界关卡丢弃");
  assert.equal(out.campaign.clears, 0);
  assert.equal(out.campaign.bestTime, 0);
  assert.ok(out.classic.bestScore <= 10_000_000);
  assert.equal(out.classic.bestDepth, 0);
  assert.ok(out.endless.bestDepth <= 5000);
  assert.equal(out.endless.bestScore, 0);
  assert.equal(out.lastLevel, LEVEL_COUNT, "关卡记录夹在已解锁范围内");
});

test("storage: sound / mode / last level persist through the guarded backend", () => {
  resetBackendForTests();
  assert.equal(setSound(false).sound, false);
  assert.equal(setSound(true).sound, true);
  assert.equal(setMode("endless").mode, "endless");
  assert.equal(setMode("bogus").mode, "endless", "非法模式不得覆盖既有值");
  assert.equal(setLastLevel(99).lastLevel, 1, "未解锁时不得跳到高关");
  let data = recordCampaign(defaults(), 1, { won: true, stars: 2, elapsed: 40 });
  data = save(data.data);
  assert.equal(setLastLevel(2).lastLevel, 2);
});

test("storage: campaign records stars, unlocks the next stage and never regresses", () => {
  let data = defaults();
  let rec = recordCampaign(data, 1, { won: true, stars: 2, elapsed: 42 });
  data = rec.data;
  assert.equal(data.campaign.stars["1"], 2);
  assert.equal(data.campaign.unlocked, 2);
  assert.equal(data.campaign.clears, 1);
  assert.equal(data.campaign.bestTime, 42);
  assert.equal(rec.improved, true);

  rec = recordCampaign(data, 1, { won: true, stars: 1, elapsed: 30 });
  data = rec.data;
  assert.equal(data.campaign.stars["1"], 2, "低星不得覆盖高星");
  assert.equal(data.campaign.bestTime, 30, "更快用时仍应保留");
  assert.equal(rec.improved, false);
  assert.equal(data.campaign.clears, 1, "重复通关不重复计数");

  rec = recordCampaign(data, 1, { won: false, stars: 0, elapsed: 10 });
  data = rec.data;
  assert.equal(data.campaign.stars["1"], 2, "失败不得改动星级");
  assert.equal(data.campaign.bestTime, 30, "失败不得改动最速");

  rec = recordCampaign(data, 1, { won: true, stars: 3, elapsed: 26 });
  assert.equal(rec.improved, true);
  assert.equal(rec.data.campaign.stars["1"], 3);
  assert.equal(rec.data.campaign.unlocked, 2);
});

test("storage: classic records clears, fastest time, deepest depth and score", () => {
  let data = defaults();
  let rec = recordClassic(data, { won: true, floors: 100, elapsed: 150, score: 2000 });
  data = rec.data;
  assert.equal(data.classic.clears, 1);
  assert.equal(data.classic.bestTime, 150);
  assert.equal(data.classic.bestDepth, 100);
  assert.equal(data.classic.bestScore, 2000);
  assert.equal(rec.isNewBest, true);

  rec = recordClassic(data, { won: false, floors: 60, elapsed: 90, score: 1200 });
  data = rec.data;
  assert.equal(data.classic.clears, 1, "未通关不得增加通关数");
  assert.equal(data.classic.bestTime, 150, "失败局不算最速");
  assert.equal(data.classic.bestDepth, 100);
  assert.equal(rec.isNewBest, false);

  rec = recordClassic(data, { won: true, floors: 100, elapsed: 130, score: 2600 });
  assert.equal(rec.data.classic.clears, 2);
  assert.equal(rec.data.classic.bestTime, 130);
  assert.equal(rec.isNewBest, true);
});

test("storage: endless keeps the deepest depth and best score", () => {
  let data = defaults();
  let rec = recordEndless(data, { floors: 37, score: 700 });
  data = rec.data;
  assert.equal(data.endless.bestDepth, 37);
  assert.equal(data.endless.bestScore, 700);
  assert.equal(rec.isNewBest, true);

  rec = recordEndless(data, { floors: 20, score: 900 });
  data = rec.data;
  assert.equal(data.endless.bestDepth, 37);
  assert.equal(data.endless.bestScore, 900);
  assert.equal(rec.isNewBest, false, "只有更深才算新纪录");
});

test("storage: totalStars sums the table and reset wipes everything", () => {
  let data = recordCampaign(defaults(), 1, { won: true, stars: 3 }).data;
  data = recordCampaign(data, 2, { won: true, stars: 2 }).data;
  assert.equal(totalStars(data), 5);
  assert.deepEqual(resetAll(), defaults());
  assert.equal(totalStars(resetAll()), 0);
});
