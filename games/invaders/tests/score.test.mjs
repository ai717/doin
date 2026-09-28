import test from "node:test";
import assert from "node:assert/strict";

import { createState, stepFrame, STATUS, MODES } from "../js/engine.mjs";
import { starsFor, reportFor, formatScore, clampScore, totalStars, accuracyPct } from "../js/score.mjs";

function wonState(patch = {}) {
  const state = createState({ levelId: 1, seed: 5 });
  state.status = STATUS.WON;
  state.hull = state.maxHull;
  state.elapsed = 10;
  state.par = 42;
  state.shotsFired = 20;
  state.shotsHit = 10;
  Object.assign(state, patch);
  return state;
}

test("one star for clearing, two with accuracy or combo, three for a flawless run", () => {
  assert.equal(starsFor(wonState({ hull: 1, shotsFired: 100, shotsHit: 10, bestCombo: 5 })), 1);
  assert.equal(starsFor(wonState({ hull: 1, shotsFired: 100, shotsHit: 80, bestCombo: 0 })), 2);
  assert.equal(starsFor(wonState({ hull: 1, shotsFired: 100, shotsHit: 10, bestCombo: 25 })), 2);
  assert.equal(starsFor(wonState({ shotsFired: 100, shotsHit: 10, bestCombo: 0 })), 2);
  assert.equal(starsFor(wonState({ shotsFired: 100, shotsHit: 80, bestCombo: 0 })), 3);
  assert.equal(starsFor(wonState({ shotsFired: 100, shotsHit: 80, elapsed: 999 })), 2);
});

test("no stars while the stage is still running", () => {
  const state = createState({ levelId: 1, seed: 5 });
  assert.equal(starsFor(state), 0);
});

test("report packs the numbers the briefing note renders", () => {
  const state = wonState({ score: 1234, headons: 3, kills: 12, bestCombo: 9 });
  const report = reportFor(state);
  assert.equal(report.score, 1234);
  assert.equal(report.headons, 3);
  assert.equal(report.kills, 12);
  assert.equal(report.accuracy, 50);
  assert.equal(report.seconds, 10);
  assert.equal(report.waves, 3);
});

test("accuracy helper rounds to one decimal", () => {
  const state = createState({ levelId: 1, seed: 5 });
  state.shotsFired = 3;
  state.shotsHit = 1;
  assert.equal(accuracyPct(state), 33.3);
});

test("score formatting never shows negative or NaN", () => {
  assert.equal(formatScore(1234), "1,234");
  assert.equal(formatScore(-5), "0");
  assert.equal(formatScore(Number.NaN), "0");
  assert.equal(clampScore(-99), 0);
  assert.equal(clampScore(42.6), 43);
});

test("total stars sums the saved progress", () => {
  assert.equal(totalStars({ stars: { 1: 3, 2: 2, 3: 1 } }), 6);
  assert.equal(totalStars({}), 0);
  assert.equal(totalStars(null), 0);
});

test("survival reports expose the reached wave", () => {
  const state = createState({ mode: MODES.SURVIVAL, seed: 9 });
  state.waveIndex = 6;
  const report = reportFor(state);
  assert.equal(report.wave, 7);
  assert.equal(report.waves, 7);
});

test("stepFrame keeps the score monotonic", () => {
  const state = createState({ levelId: 2, seed: 17 });
  let last = 0;
  for (let i = 0; i < 3000; i += 1) {
    stepFrame(state, 1 / 120);
    assert.ok(state.score >= last);
    last = state.score;
  }
});
