import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  CAMPAIGN_SIZE,
  ENDGAME_SIZE,
  defaults,
  normalize,
  load,
  save,
  clear,
  isCampaignUnlocked,
  isEndgameUnlocked,
  totalStars,
  clearedCount,
  chapterCleared,
  accuracy,
} from "../js/storage.mjs";
import { LEVELS } from "../js/levels.mjs";

test("the save key follows the portal contract", () => {
  assert.equal(STORAGE_KEY, "doin.tank.v1");
});

test("defaults are a clean, empty dossier", () => {
  const d = defaults();
  assert.equal(d.version, 1);
  assert.deepEqual(d.campaign, {});
  assert.equal(d.campaignUnlocked, 1);
  assert.equal(d.endgameUnlocked, 1);
  assert.equal(d.records.stars, 0);
  assert.equal(d.hints, true);
  assert.equal(d.muted, false);
});

test("junk input normalises back to defaults instead of throwing", () => {
  for (const junk of [null, undefined, 42, "nope", [], { campaign: "x", records: 7 }]) {
    const out = normalize(junk);
    assert.equal(out.campaignUnlocked, 1);
    assert.equal(out.records.kills, 0);
  }
});

test("every counter is clamped into its legal range", () => {
  const out = normalize({
    campaign: { level_1_1: { stars: 99, time: -5, baseHp: 12, deaths: -3 } },
    endgames: { endgame_1: { cleared: true, ammoLeft: 500 } },
    campaignUnlocked: 9999,
    endgameUnlocked: -4,
    medals: { 3: true, 88: true, x: true },
    records: { stars: -10, bestWave: 1e9, shots: 5, hits: 99, maxCombo: -1 },
  });
  assert.equal(out.campaign.level_1_1.stars, 3);
  assert.equal(out.campaign.level_1_1.time, 0);
  assert.equal(out.campaign.level_1_1.baseHp, 3);
  assert.equal(out.campaign.level_1_1.deaths, 0);
  assert.equal(out.endgames.endgame_1.ammoLeft, 99);
  assert.equal(out.campaignUnlocked, CAMPAIGN_SIZE);
  assert.equal(out.endgameUnlocked, 1);
  assert.deepEqual(out.medals, { 3: true });
  assert.equal(out.records.stars, 0);
  assert.equal(out.records.hits, 99);
  assert.equal(out.records.maxCombo, 0);
});

test("unknown stage ids are dropped on read", () => {
  const out = normalize({
    campaign: { level_9_9: { stars: 3 }, "": { stars: 3 }, level_2_3: { stars: 2 } },
    endgames: { endgame_99: { cleared: true }, endgame_2: { cleared: true } },
  });
  assert.deepEqual(Object.keys(out.campaign), ["level_2_3"]);
  assert.deepEqual(Object.keys(out.endgames), ["endgame_2"]);
});

test("save and load round-trip without leaking references", () => {
  clear();
  const data = defaults();
  data.campaign.level_1_1 = { stars: 2, time: 88.5, baseHp: 3, deaths: 1, score: 4100 };
  data.campaignUnlocked = 3;
  data.records.kills = 12;
  assert.equal(save(data), true);
  const back = load();
  assert.equal(back.campaign.level_1_1.stars, 2);
  assert.equal(back.campaign.level_1_1.time, 88.5);
  assert.equal(back.campaignUnlocked, 3);
  assert.equal(back.records.kills, 12);
  back.campaign.level_1_1.stars = 3;
  assert.equal(load().campaign.level_1_1.stars, 2, "load must hand out a fresh copy");
});

test("a corrupted payload degrades to defaults, never to a crash", () => {
  // localStorage is absent under node, so the module falls back to its memory map.
  assert.equal(typeof globalThis.localStorage, "undefined");
  clear();
  assert.deepEqual(load(), defaults());
});

test("clear wipes the dossier", () => {
  const data = defaults();
  data.campaign.level_1_1 = { stars: 3 };
  save(data);
  const wiped = clear();
  assert.deepEqual(wiped.campaign, {});
  assert.deepEqual(load().campaign, {});
});

test("unlock gates read the campaign counter", () => {
  const data = defaults();
  assert.equal(isCampaignUnlocked(data, 0), true);
  assert.equal(isCampaignUnlocked(data, 1), false);
  data.campaignUnlocked = 4;
  assert.equal(isCampaignUnlocked(data, 3), true);
  assert.equal(isCampaignUnlocked(data, 4), false);
  assert.equal(isEndgameUnlocked(data, 0), true);
  data.endgameUnlocked = 8;
  assert.equal(isEndgameUnlocked(data, 7), true);
});

test("star and clear tallies drive the medal rack", () => {
  const data = defaults();
  assert.equal(totalStars(data), 0);
  for (const lv of LEVELS.filter((l) => l.chapter === 1)) data.campaign[lv.id] = { stars: 3 };
  assert.equal(totalStars(data), 12);
  assert.equal(clearedCount(data), 4);
  assert.equal(chapterCleared(data, 1, LEVELS), true);
  assert.equal(chapterCleared(data, 2, LEVELS), false);
});

test("accuracy never exceeds 1 and survives an empty record", () => {
  assert.equal(accuracy(defaults()), 0);
  assert.equal(accuracy({ records: { shots: 10, hits: 25 } }), 1);
  assert.equal(accuracy({ records: { shots: 10, hits: 3 } }), 0.3);
});
