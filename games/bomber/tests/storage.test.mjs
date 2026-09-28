import test from "node:test";
import assert from "node:assert/strict";
import * as store from "../js/storage.mjs";

function installStub() {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
  return map;
}

test("defaults are a clean slate", () => {
  const data = store.defaults();
  assert.equal(data.campaignUnlocked, 1);
  assert.equal(data.puzzleUnlocked, 1);
  assert.equal(data.parts, 0);
  assert.deepEqual(data.unlocks, { bomb: false, fire: false, shield: false });
  assert.equal(data.assist, true);
});

test("garbage payloads normalise instead of throwing", () => {
  assert.deepEqual(store.normalize(null), store.defaults());
  assert.deepEqual(store.normalize("nonsense"), store.defaults());
  const messy = store.normalize({
    campaignUnlocked: 999,
    puzzleUnlocked: -5,
    parts: "12",
    unlocks: { bomb: 1, fire: null, shield: "yes" },
    records: { maxChain: 3.7, bestDemo: 4, stars: -2 },
    campaign: { level_1_1: { stars: 9, time: -1, demo: 2 }, broken: null },
    muted: "yes",
    assist: 0,
    skin: 99,
  });
  assert.equal(messy.campaignUnlocked, 40);
  assert.equal(messy.puzzleUnlocked, 1);
  assert.equal(messy.parts, 12);
  assert.equal(messy.unlocks.bomb, true);
  assert.equal(messy.unlocks.fire, false);
  assert.equal(messy.campaign.level_1_1.stars, 3);
  assert.equal(messy.campaign.level_1_1.demo, 1);
  assert.equal(messy.campaign.broken, undefined);
  assert.equal(messy.records.bestDemo, 1);
  assert.equal(messy.assist, false);
  assert.equal(messy.skin, 5);
});

test("save and load round-trip through localStorage", () => {
  const map = installStub();
  const data = store.defaults();
  data.campaign.level_1_1 = { stars: 2, time: 41, demo: 0.8 };
  data.parts = 33;
  data.unlocks.shield = true;
  assert.equal(store.save(data), true);
  assert.ok(map.has(store.STORAGE_KEY));
  const back = store.load();
  assert.equal(back.campaign.level_1_1.stars, 2);
  assert.equal(back.parts, 33);
  assert.equal(back.unlocks.shield, true);
});

test("storage degrades to memory when localStorage throws", () => {
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
  assert.deepEqual(store.load(), store.defaults());
  const data = store.defaults();
  data.parts = 8;
  assert.equal(store.save(data), true, "writes fall back to the memory map");
  assert.equal(store.load().parts, 8, "memory fallback keeps the value");
  assert.deepEqual(store.clear(), store.defaults());
  assert.equal(store.load().parts, 0, "clear wipes the memory fallback too");
});

test("unlock helpers respect the stored count", () => {
  const data = store.defaults();
  assert.equal(store.isCampaignUnlocked(data, 0), true);
  assert.equal(store.isCampaignUnlocked(data, 1), false);
  assert.equal(store.isPuzzleUnlocked(data, 0), true);
  assert.equal(store.isPuzzleUnlocked(data, 3), false);
});
