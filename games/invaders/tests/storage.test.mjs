import test from "node:test";
import assert from "node:assert/strict";

import {
  STORAGE_KEY,
  defaultProgress,
  normalize,
  load,
  save,
  clear,
  recordLevel,
  recordSurvival,
  recordTraining,
} from "../js/storage.mjs";
import { TOTAL_LEVELS } from "../js/levels.mjs";

test("storage key follows the platform contract", () => {
  assert.equal(STORAGE_KEY, "doin.invaders.v1");
});

test("default progress starts with a single unlocked stage", () => {
  const base = defaultProgress();
  assert.equal(base.unlocked, 1);
  assert.deepEqual(base.stars, {});
  assert.equal(base.muted, false);
});

test("normalize repairs junk input", () => {
  assert.equal(normalize(null).unlocked, 1);
  assert.equal(normalize("nope").unlocked, 1);
  const mixed = normalize({ unlocked: 999, stars: { 1: 9, 99: 2, x: 1 }, best: { 2: -5 }, survival: { wave: -3 }, muted: "yes" });
  assert.equal(mixed.unlocked, TOTAL_LEVELS);
  assert.equal(mixed.stars[1], 3);
  assert.equal(mixed.stars[99], undefined);
  assert.equal(mixed.best[2], 0);
  assert.equal(mixed.survival.wave, 0);
  assert.equal(mixed.muted, false);
});

test("save and load round-trip through the backend", () => {
  clear();
  const progress = recordLevel(defaultProgress(), 3, 2, 4800);
  assert.equal(save(progress), true);
  const restored = load();
  assert.equal(restored.stars[3], 2);
  assert.equal(restored.best[3], 4800);
  assert.equal(restored.unlocked, 4);
});

test("records never regress", () => {
  let progress = recordLevel(defaultProgress(), 2, 3, 900);
  progress = recordLevel(progress, 2, 1, 400);
  assert.equal(progress.stars[2], 3);
  assert.equal(progress.best[2], 900);
  progress = recordSurvival(progress, 8, 5000, 22);
  progress = recordSurvival(progress, 4, 9000, 10);
  assert.equal(progress.survival.wave, 8);
  assert.equal(progress.survival.score, 9000);
  assert.equal(progress.survival.combo, 22);
});

test("clearing a stage unlocks the next one", () => {
  let progress = recordLevel(defaultProgress(), 1, 1, 10);
  assert.equal(progress.unlocked, 2);
  progress = recordLevel(progress, 2, 2, 20);
  assert.equal(progress.unlocked, 3);
  progress = recordLevel(progress, TOTAL_LEVELS, 3, 30);
  assert.equal(progress.stars[TOTAL_LEVELS], 3);
  assert.equal(progress.unlocked, 3);
});

test("training completion is tracked separately", () => {
  const progress = recordTraining(defaultProgress(), 102);
  assert.equal(progress.training[102], true);
  assert.equal(progress.unlocked, 1);
});

test("missing or broken saved data falls back to defaults", () => {
  clear();
  assert.deepEqual(load(), defaultProgress());
});
