// 存档测试：key 契约、normalize 坏值回默认、内存降级、挑战进度。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  defaultState,
  normalize,
  load,
  save,
  savePrefs,
  recordOutcome,
  resetBackendForTests,
} from "../js/storage.mjs";

test("存档 key 符合全站契约 doin.<slug>.v1", () => {
  assert.equal(STORAGE_KEY, "doin.blind-auction.v1");
});

test("defaultState 结构完整", () => {
  const s = defaultState();
  assert.equal(s.version, 1);
  assert.equal(s.prefs.difficulty, "standard");
  assert.equal(s.prefs.character, "detective");
  assert.deepEqual(s.challenges.unlocked, [1]);
  assert.deepEqual(s.challenges.stars, {});
});

test("normalize: null / 垃圾值回默认", () => {
  assert.deepEqual(normalize(null), defaultState());
  assert.deepEqual(normalize("garbage"), defaultState());
  assert.deepEqual(normalize({}), defaultState());
});

test("normalize: 坏偏好回默认，合法偏好保留", () => {
  const n = normalize({ prefs: { difficulty: "hard", character: "gossip", muted: true } });
  assert.equal(n.prefs.difficulty, "hard");
  assert.equal(n.prefs.character, "gossip");
  assert.equal(n.prefs.muted, true);
  const bad = normalize({ prefs: { difficulty: "impossible", character: "hacker", muted: "yes" } });
  assert.equal(bad.prefs.difficulty, "standard");
  assert.equal(bad.prefs.character, "detective");
  assert.equal(bad.prefs.muted, false);
});

test("normalize: stats 钳制非负", () => {
  const n = normalize({ stats: { gamesPlayed: -3, bestAsset: "abc", bestRating: "Z", badges: [1, "snip"] } });
  assert.equal(n.stats.gamesPlayed, 0);
  assert.equal(n.stats.bestAsset, 0);
  assert.equal(n.stats.bestRating, null);
  assert.deepEqual(n.stats.badges, ["snip"]);
});

test("normalize: challenges 解锁与星级 clamp", () => {
  const n = normalize({ challenges: { unlocked: [3, 1, 99, -2], stars: { 2: 7, 5: 0, 20: 3 } } });
  assert.deepEqual(n.challenges.unlocked, [1, 3]);
  assert.equal(n.challenges.stars[2], 3); // clamp 到 3
  assert.equal(n.challenges.stars[5], 1); // 0 → 1
  assert.equal(n.challenges.stars[20], undefined);
});

test("save/load 往返（内存后端）", () => {
  resetBackendForTests();
  const state = normalize({ prefs: { difficulty: "easy", character: "hoarder" }, stats: { gamesPlayed: 3, bestAsset: 25000, bestRating: "S", badges: ["snip", "tight"] } });
  assert.ok(save(state));
  const loaded = load();
  assert.equal(loaded.prefs.difficulty, "easy");
  assert.equal(loaded.prefs.character, "hoarder");
  assert.equal(loaded.stats.gamesPlayed, 3);
  assert.equal(loaded.stats.bestAsset, 25000);
  assert.equal(loaded.stats.bestRating, "S");
});

test("savePrefs 只改偏好", () => {
  resetBackendForTests();
  const state = defaultState();
  state.stats.gamesPlayed = 5;
  save(state);
  savePrefs({ difficulty: "hard", character: "expert", muted: true });
  const loaded = load();
  assert.equal(loaded.prefs.difficulty, "hard");
  assert.equal(loaded.prefs.character, "expert");
  assert.equal(loaded.stats.gamesPlayed, 5);
});

test("recordOutcome 落账", () => {
  resetBackendForTests();
  recordOutcome({ gamesPlayed: 1, bestAsset: 12000, bestRating: "B", badges: ["sedan"] });
  const loaded = load();
  assert.equal(loaded.stats.gamesPlayed, 1);
  assert.equal(loaded.stats.bestAsset, 12000);
  assert.equal(loaded.stats.bestRating, "B");
  assert.deepEqual(loaded.stats.badges, ["sedan"]);
});
