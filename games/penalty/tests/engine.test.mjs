import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../js/engine.mjs";
import { chooseDive } from "../js/ai.mjs";

function resolve(power, matched, seed) {
  let state = E.createMatch({ seed });
  state = E.commitShot(state, 4, power).state;
  state = E.chooseDive(state, matched ? 4 : 0).state;
  return state.lastShot.result;
}

test("tap is always saved when read and always scores when missed", () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    assert.equal(resolve("tap", true, seed), "save");
    assert.equal(resolve("tap", false, seed), "goal");
  }
});

test("drive is saved about half the time when read, never wide", () => {
  let saved = 0;
  for (let seed = 1; seed <= 4000; seed += 1) {
    const result = resolve("drive", true, seed);
    assert.notEqual(result, "wide");
    if (result === "save") saved += 1;
  }
  assert.ok(saved / 4000 > 0.46 && saved / 4000 < 0.54, `drive save rate ${saved / 4000}`);
});

test("blast sends about 25 percent wide and is saved about 20 percent of the rest", () => {
  let wide = 0;
  let saved = 0;
  let onTarget = 0;
  for (let seed = 1; seed <= 6000; seed += 1) {
    const result = resolve("blast", true, seed);
    if (result === "wide") wide += 1;
    else onTarget += 1;
    if (result === "save") saved += 1;
  }
  assert.ok(wide / 6000 > 0.23 && wide / 6000 < 0.27, `wide rate ${wide / 6000}`);
  assert.ok(saved / onTarget > 0.17 && saved / onTarget < 0.23, `save rate ${saved / onTarget}`);
});

function play(state, target, power, dive) {
  if (state.phase === "shooter") {
    const result = state.mode === "mode_solo" && state.shooter === "side_b"
      ? E.aiDecideShot(state)
      : E.commitShot(state, target, power);
    state = result.state;
  }
  if (state.phase === "handoff") state = E.confirmHandoff(state).state;
  if (state.phase === "keeper") {
    const result = state.mode === "mode_solo" && state.shooter === "side_a"
      ? E.aiDecideDive(state)
      : E.chooseDive(state, dive);
    state = result.state;
  }
  if (state.phase === "reveal") state = E.advance(state).state;
  return state;
}

test("regulation ends after ten kicks and awards the higher score", () => {
  let state = E.createMatch({ mode: "mode_duo", seed: 9 });
  for (let i = 0; i < 10; i += 1) {
    // side_a always scores (tap, keeper elsewhere), side_b always saved.
    const shooterA = state.shooter === "side_a";
    state = play(state, 4, "tap", shooterA ? 8 : 4);
  }
  assert.equal(state.shots.length, 10);
  assert.equal(state.score.side_a, 5);
  assert.equal(state.score.side_b, 0);
  assert.equal(state.phase, "over");
  assert.equal(state.winner, "side_a");
  assert.equal(E.checkInvariants(state), null);
});

test("a tie enters sudden death and the first one-sided round decides it", () => {
  let state = E.createMatch({ mode: "mode_duo", seed: 3 });
  for (let i = 0; i < 10; i += 1) state = play(state, 4, "tap", 8); // everyone scores
  assert.equal(state.suddenDeath, true);
  assert.equal(state.phase, "shooter");
  state = play(state, 4, "tap", 8); // side_a scores
  state = play(state, 4, "tap", 4); // side_b saved
  assert.equal(state.phase, "over");
  assert.equal(state.winner, "side_a");
  assert.equal(E.checkInvariants(state), null);
});

test("same seed and same input sequence replay identically", () => {
  const replay = () => {
    let state = E.createMatch({ mode: "mode_solo", difficulty: "ai_master", seed: 4242 });
    for (let i = 0; i < 240 && state.phase !== "over"; i += 1) {
      if (state.phase === "shooter" && state.shooter === "side_a") state = E.commitShot(state, i % 9, ["tap", "drive", "blast"][i % 3]).state;
      else if (state.phase === "keeper" && state.shooter === "side_b") state = E.chooseDive(state, (i * 5) % 9).state;
      else state = play(state, i % 9, "drive", (i * 7) % 9);
    }
    return JSON.stringify(E.matchSummary(state));
  };
  assert.equal(replay(), replay());
});

test("same-screen hand-off hides the choice until confirmed", () => {
  let state = E.createMatch({ mode: "mode_duo", seed: 1 });
  state = E.commitShot(state, 2, "blast").state;
  assert.equal(state.phase, "handoff");
  assert.equal(E.chooseDive(state, 2).ok, false);
  state = E.confirmHandoff(state).state;
  assert.equal(state.phase, "keeper");
  state = E.undoShot(state).state;
  assert.equal(state.phase, "shooter");
  assert.equal(state.zone, null);
});

test("skilled and master keepers learn repeated target zones", () => {
  const history = Array.from({ length: 8 }, (_, index) => ({
    index, round: index + 1, shooter: "side_a", zone: 0, power: "tap",
    dive: 8, result: "goal", scoredBy: "side_a", suddenDeath: false,
  }));
  const countAtZero = (difficulty) => {
    let hits = 0;
    for (let seed = 1; seed <= 2000; seed += 1) {
      const state = { shooter: "side_a", shots: history, difficulty, rng: seed };
      const randoms = [(seed % 997) / 997, ((seed * 31) % 991) / 991, 0.5];
      if (chooseDive(state, randoms).zone === 0) hits += 1;
    }
    return hits / 2000;
  };
  assert.ok(countAtZero("ai_novice") < 0.15);
  assert.ok(countAtZero("ai_master") > 0.35, `master read rate ${countAtZero("ai_master")}`);
});

test("1000 random matches finish with invariants intact", () => {
  for (let match = 0; match < 1000; match += 1) {
    let state = E.createMatch({
      mode: match % 2 ? "mode_duo" : "mode_solo",
      difficulty: match % 2 ? null : "ai_novice",
      seed: match + 1,
      firstShooter: match % 4 < 2 ? "side_a" : "side_b",
    });
    for (let step = 0; step < 500 && state.phase !== "over"; step += 1) {
      assert.equal(E.checkInvariants(state), null, `match ${match} step ${step}`);
      state = play(state, (match + step) % 9, ["tap", "drive", "blast"][(match + step) % 3], (match * 3 + step) % 9);
    }
    assert.equal(state.phase, "over", `match ${match} did not finish`);
    assert.ok(state.winner === "side_a" || state.winner === "side_b");
    assert.equal(E.checkInvariants(state), null);
  }
});
