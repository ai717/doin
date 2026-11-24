import test from "node:test";
import assert from "node:assert/strict";
import { normalize, load, save, recordFinish, isUnlocked, resetBackendForTests } from "../js/storage.mjs";
import { LEVEL_IDS } from "../js/levels.mjs";

test("defaults are normalized and first level is always unlocked", () => {
  resetBackendForTests();
  const s = normalize(null);
  assert.equal(s.version, 1);
  assert.equal(s.levelId, LEVEL_IDS[0]);
  assert.deepEqual(s.unlocked, [LEVEL_IDS[0]]);
  assert.equal(s.muted, false);
});

test("corrupt and hostile input falls back safely", () => {
  const s = normalize({ levelId: "nope", unlocked: ["bad", LEVEL_IDS[3], LEVEL_IDS[3]], stars: { [LEVEL_IDS[0]]: 99, [LEVEL_IDS[1]]: -3 }, bestTime: { [LEVEL_IDS[0]]: -5 }, record: { cleaned: "x", totalTime: null } });
  assert.equal(s.levelId, LEVEL_IDS[0]);
  assert.deepEqual(s.unlocked, [LEVEL_IDS[0], LEVEL_IDS[3]]);
  assert.equal(s.stars[LEVEL_IDS[0]], 3);
  assert.equal(s.stars[LEVEL_IDS[1]], 0);
  assert.equal(s.bestTime[LEVEL_IDS[0]], undefined);
  assert.equal(s.record.cleaned, 0);
  assert.equal(s.record.totalTime, 0);
  assert.deepEqual(normalize("junk"), normalize(null));
});

test("recordFinish unlocks the next level and keeps best stars and time", () => {
  resetBackendForTests();
  let s = normalize(null);
  s = recordFinish(s, LEVEL_IDS[0], 2, 60);
  assert.ok(isUnlocked(s, LEVEL_IDS[1]));
  assert.equal(s.stars[LEVEL_IDS[0]], 2);
  assert.equal(s.bestTime[LEVEL_IDS[0]], 60);
  s = recordFinish(s, LEVEL_IDS[0], 1, 45);
  assert.equal(s.stars[LEVEL_IDS[0]], 2, "stars never regress");
  assert.equal(s.bestTime[LEVEL_IDS[0]], 45, "best time improves");
  s = recordFinish(s, "bogus", 3, 10);
  assert.equal(s.record.cleaned, 2, "invalid id is ignored");
});

test("save and load round trip through storage", () => {
  resetBackendForTests();
  const s = normalize(null);
  s.levelId = LEVEL_IDS[2];
  s.muted = true;
  assert.equal(save(s), true);
  const loaded = load();
  assert.equal(loaded.levelId, LEVEL_IDS[2]);
  assert.equal(loaded.muted, true);
  assert.ok(loaded.unlocked.includes(LEVEL_IDS[2]));
});
