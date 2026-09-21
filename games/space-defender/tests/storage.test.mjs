import test from "node:test";
import assert from "node:assert/strict";

import {
  STORAGE_KEY,
  defaultState,
  normalize,
  load,
  save,
  setMuted,
  setAutoFire,
  applyResult,
  isWaveUnlocked,
  resetAll,
  resetBackendForTests,
} from "../js/storage.mjs";
import { TOTAL_WAVES } from "../js/levels.mjs";

test("storage: key follows the doin.<slug>.v1 convention", () => {
  assert.equal(STORAGE_KEY, "doin.space-defender.v1");
});

test("storage: garbage normalizes back to defaults", () => {
  for (const raw of [null, undefined, 42, "oops", [], { prefs: "x", progress: 7 }]) {
    const state = normalize(raw);
    assert.deepEqual(state, defaultState());
  }
});

test("storage: star values and unlocked wave are clamped", () => {
  const state = normalize({
    progress: {
      campaignStars: Array.from({ length: TOTAL_WAVES }, () => 99),
      unlockedWave: 999,
      bestScore: -50,
      bestCombo: 42,
      survivalBestWave: -3,
    },
  });
  assert.equal(state.progress.campaignStars.length, TOTAL_WAVES);
  for (const stars of state.progress.campaignStars) assert.equal(stars, 3);
  assert.equal(state.progress.unlockedWave, TOTAL_WAVES - 1);
  assert.equal(state.progress.bestScore, 0);
  assert.equal(state.progress.bestCombo, 8);
  assert.equal(state.progress.survivalBestWave, 0);
});

test("storage: preferences survive a round trip and bad input falls back", () => {
  resetBackendForTests();
  let state = defaultState();
  state = setMuted(state, true);
  assert.equal(state.prefs.muted, true);
  assert.equal(load().prefs.muted, true);
  state = setAutoFire(state, false);
  assert.equal(load().prefs.autoFire, false);
  const broken = normalize({ prefs: { muted: "true", autoFire: "false" } });
  assert.equal(broken.prefs.muted, true, "字符串 'true' 应归一为真");
  assert.equal(broken.prefs.autoFire, false, "字符串 'false' 应归一为假");
  const junk = normalize({ prefs: { muted: "yes", autoFire: {} } });
  assert.equal(junk.prefs.muted, false, "无法识别的值回默认");
  assert.equal(junk.prefs.autoFire, true, "自动开火默认开，坏值回默认");
});

test("storage: campaign results record stars and unlock the next wave", () => {
  resetBackendForTests();
  let state = defaultState();
  const first = applyResult(state, { mode: "campaign", wave: 0, stars: 2, score: 1200, kills: 12, rescued: 1, bestCombo: 5 });
  assert.equal(first.improved, true);
  assert.equal(first.state.progress.campaignStars[0], 2);
  assert.equal(first.state.progress.unlockedWave, 1);
  assert.equal(first.state.progress.bestScore, 1200);
  assert.equal(first.state.progress.totalKills, 12);

  const worse = applyResult(first.state, { mode: "campaign", wave: 0, stars: 1, score: 300 });
  assert.equal(worse.improved, false, "更差的成绩不得覆盖");
  assert.equal(worse.state.progress.campaignStars[0], 2);
  assert.equal(worse.state.progress.bestScore, 1200);
});

test("storage: rush keeps the fastest clear, survival keeps the deepest wave", () => {
  resetBackendForTests();
  let state = defaultState();
  state = applyResult(state, { mode: "rush", won: true, time: 212.5, wave: 4 }).state;
  assert.equal(state.progress.rushBestMs, 212500);
  const slower = applyResult(state, { mode: "rush", won: true, time: 300, wave: 4 }).state;
  assert.equal(slower.progress.rushBestMs, 212500);
  const faster = applyResult(slower, { mode: "rush", won: true, time: 180.2, wave: 4 }).state;
  assert.equal(faster.progress.rushBestMs, 180200);

  const s = applyResult(faster, { mode: "survival", wave: 9 }).state;
  assert.equal(s.progress.survivalBestWave, 9);
  assert.equal(applyResult(s, { mode: "survival", wave: 4 }).state.progress.survivalBestWave, 9);
});

test("storage: losing does not unlock anything", () => {
  resetBackendForTests();
  const state = defaultState();
  const lost = applyResult(state, { mode: "campaign", wave: 0, stars: 3, score: 900, lost: true });
  assert.equal(lost.state.progress.campaignStars[0], 0);
  assert.equal(lost.state.progress.unlockedWave, 0);
});

test("storage: unlock gate matches the recorded progress", () => {
  const state = normalize({ progress: { unlockedWave: 3 } });
  assert.equal(isWaveUnlocked(state, 0), true);
  assert.equal(isWaveUnlocked(state, 3), true);
  assert.equal(isWaveUnlocked(state, 4), false);
  assert.equal(isWaveUnlocked(state, 999), false);
});

test("storage: reset clears everything and save never throws", () => {
  resetBackendForTests();
  let state = applyResult(defaultState(), { mode: "campaign", wave: 0, stars: 3, score: 500 }).state;
  save(state);
  state = resetAll();
  assert.deepEqual(state, defaultState());
  assert.equal(load().progress.bestScore, 0);
});
