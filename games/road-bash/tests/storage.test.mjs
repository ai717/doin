import test from "node:test";
import assert from "node:assert/strict";

import {
  applyResult,
  buyBike,
  defaultState,
  isLeagueUnlocked,
  load,
  normalize,
  resetAll,
  resetBackendForTests,
  save,
  selectBike,
  setCruise,
  setMuted,
  STORAGE_KEY,
} from "../js/storage.mjs";

test("storage key is doin.road-bash.v1", () => {
  assert.equal(STORAGE_KEY, "doin.road-bash.v1");
});

test("normalize falls back to defaults for corrupt payloads", () => {
  const d = defaultState();
  assert.deepEqual(normalize(null).progress.owned, [0]);
  assert.deepEqual(normalize("boom").prefs, d.prefs);
  assert.deepEqual(normalize(42).progress.leagueStars.length, 20);
  assert.equal(normalize({ progress: { selectedBike: 9 } }).progress.selectedBike, 0);
  assert.equal(normalize({ prefs: { muted: "yes" } }).prefs.muted, false);
});

test("starter bike is never lost and cash cannot go negative", () => {
  const out = normalize({
    progress: { owned: [], cash: -50, leagueStars: [9, -1], farthestFly: "nope" },
  });
  assert.ok(out.progress.owned.includes(0));
  assert.equal(out.progress.cash, 0);
  assert.equal(out.progress.leagueStars[0], 3);
  assert.equal(out.progress.leagueStars[1], 0);
  assert.equal(out.progress.farthestFly, 0);
});

test("buying a bike spends cash; poor players are refused; rat stays free", () => {
  resetBackendForTests();
  let data = defaultState();
  data.progress.cash = 800;
  const bought = buyBike(data, 1);
  assert.equal(bought.ok, true);
  assert.ok(bought.state.progress.owned.includes(1));
  assert.equal(bought.state.progress.cash, 0);
  const poor = buyBike(bought.state, 2);
  assert.equal(poor.ok, false);
  assert.ok(poor.state.progress.owned.includes(0));
});

test("applyResult never regresses stars and unlocks the next league tier", () => {
  let data = defaultState();
  for (let i = 0; i < 5; i += 1) {
    const rec = applyResult(data, {
      mode: "league",
      raceId: i,
      won: true,
      stars: 1,
      cash: 100,
      knockouts: 1,
      farthestFly: 12,
    });
    data = rec.state;
  }
  assert.equal(data.progress.leagueTier, 1);
  assert.equal(isLeagueUnlocked(data, 5), true);
  assert.equal(isLeagueUnlocked(data, 10), false);
  const worse = applyResult(data, { mode: "league", raceId: 0, won: true, stars: 1, cash: 0, knockouts: 0 });
  assert.equal(worse.state.progress.leagueStars[0], 1);
  const better = applyResult(data, { mode: "league", raceId: 0, won: true, stars: 3, cash: 0, knockouts: 3 });
  assert.equal(better.improved, true);
  assert.equal(better.state.progress.leagueStars[0], 3);
});

test("setMuted / setCruise / selectBike persist", () => {
  resetBackendForTests();
  let data = defaultState();
  data = setMuted(data, true);
  data = setCruise(data, false);
  data.progress.owned = [0, 1];
  data = selectBike(data, 1);
  assert.equal(data.prefs.muted, true);
  assert.equal(data.prefs.cruise, false);
  assert.equal(data.progress.selectedBike, 1);
  const loaded = load();
  assert.equal(loaded.prefs.muted, true);
});

test("save round-trips and resetAll wipes progress but keeps a rat bike", () => {
  resetBackendForTests();
  let data = defaultState();
  data.progress.cash = 500;
  data = save(data);
  assert.equal(load().progress.cash, 500);
  const wiped = resetAll();
  assert.equal(wiped.progress.cash, 0);
  assert.deepEqual(wiped.progress.owned, [0]);
});
