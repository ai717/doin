import test from "node:test";
import assert from "node:assert/strict";
import { createController } from "../js/game.mjs";
import { ballFrame, keeperFrame } from "../js/ui.mjs";

test("controller starts on a playable kick with no modal gate", () => {
  const game = createController({ mode: "mode_solo", difficulty: "ai_novice", seed: 5 });
  const snap = game.snapshot();
  assert.equal(snap.phase, "shooter");
  assert.equal(snap.shooter, "side_a");
  assert.equal(snap.finished, false);
  assert.deepEqual(snap.score, { side_a: 0, side_b: 0 });
});

test("target and power must both be set before a shot commits", () => {
  const game = createController({ mode: "mode_duo", seed: 7 });
  assert.equal(game.chooseTarget(2), true);
  assert.equal(game.shoot(), false);
  assert.equal(game.choosePower("tap"), true);
  assert.equal(game.shoot(), true);
  assert.equal(game.snapshot().phase, "handoff");
  assert.equal(game.confirmKeeper(), true);
  assert.equal(game.snapshot().phase, "keeper");
});

test("paused controller freezes the reveal clock and AI delay", () => {
  const game = createController({ mode: "mode_solo", difficulty: "ai_novice", seed: 11 });
  game.chooseTarget(4);
  game.choosePower("tap");
  game.shoot();
  game.tick(200);
  const before = game.snapshot();
  assert.equal(before.aiPending, "dive");
  game.setPaused(true);
  game.tick(900);
  const frozen = game.snapshot();
  assert.equal(frozen.revealT, before.revealT);
  assert.equal(frozen.aiPending, before.aiPending);
  assert.equal(frozen.lastShot, null);
  game.setPaused(false);
  for (let i = 0; i < 40; i += 1) game.tick(16);
  assert.notEqual(game.snapshot().lastShot, null, "AI resolves after the unpaused delay");
});

test("reveal advances only after the fixed clock completes", () => {
  const game = createController({ mode: "mode_duo", seed: 13 });
  game.chooseTarget(0);
  game.choosePower("drive");
  game.shoot();
  game.confirmKeeper();
  game.keeperDive(8);
  assert.equal(game.snapshot().phase, "reveal");
  assert.equal(game.continueMatch(), false);
  for (let i = 0; i < 40; i += 1) game.tick(16);
  assert.equal(game.snapshot().revealDone, false);
  for (let i = 0; i < 60; i += 1) game.tick(16);
  assert.equal(game.snapshot().revealDone, true);
  assert.equal(game.continueMatch(), true);
  assert.equal(game.snapshot().phase, "shooter");
  assert.equal(game.snapshot().taken, 1);
});

test("reset rebuilds the match and clears the reveal state", () => {
  const game = createController({ mode: "mode_solo", difficulty: "ai_master", seed: 17 });
  game.chooseTarget(3);
  game.choosePower("blast");
  game.shoot();
  game.tick(600);
  game.reset({ mode: "mode_duo", difficulty: "ai_master", firstShooter: "side_b" });
  const snap = game.snapshot();
  assert.equal(snap.phase, "shooter");
  assert.equal(snap.mode, "mode_duo");
  assert.equal(snap.firstShooter, "side_b");
  assert.equal(snap.taken, 0);
  assert.equal(snap.revealT, 0);
  assert.equal(snap.target, null);
});

test("ball and keeper frames are pure and freeze at a fixed progress", () => {
  const a = ballFrame(0.4, 0, "goal");
  const b = ballFrame(0.4, 0, "goal");
  assert.deepEqual(a, b);
  assert.notDeepEqual(ballFrame(0.4, 0, "goal"), ballFrame(0.4, 8, "goal"));
  assert.notDeepEqual(ballFrame(0.85, 4, "goal"), ballFrame(0.85, 4, "wide"));
  assert.deepEqual(keeperFrame(0, null), { x: 50, y: 64 });
  assert.notDeepEqual(keeperFrame(1, 0), keeperFrame(1, 8));
});
