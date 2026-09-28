import test from "node:test";
import assert from "node:assert/strict";

import { SiegeGame } from "../js/game.mjs";
import { MODES, STATUS } from "../js/engine.mjs";
import { STORAGE_KEY, defaultProgress } from "../js/storage.mjs";

function harness() {
  const frames = [];
  const finishes = [];
  const game = new SiegeGame({
    onFrame: (state, dt, events) => frames.push({ state, dt, events }),
    onFinish: (report, state) => finishes.push({ report, state }),
  });
  return { game, frames, finishes };
}

test("starting a run builds a live state and drives frames", () => {
  const { game, frames } = harness();
  const state = game.start({ mode: MODES.CAMPAIGN, levelId: 1 });
  assert.equal(state.status, STATUS.INTRO);
  for (let i = 0; i < 400; i += 1) game.advance(1 / 120);
  assert.ok(frames.length >= 0);
  assert.equal(state.status, STATUS.FIGHT);
  assert.ok(state.time > 3);
});

test("pointer intent steers the turret toward the target", () => {
  const { game } = harness();
  game.start({ mode: MODES.CAMPAIGN, levelId: 1 });
  for (let i = 0; i < 200; i += 1) game.advance(1 / 120);
  const before = game.state.turret.x;
  game.setPointer(before - 200);
  for (let i = 0; i < 30; i += 1) game.advance(1 / 120);
  assert.ok(game.state.turret.x < before);
  game.setPointer(null);
  game.setMove(1);
  for (let i = 0; i < 30; i += 1) game.advance(1 / 120);
  assert.ok(game.state.turret.x > before - 200);
});

test("keyboard takes steering back from a live pointer target", () => {
  const { game } = harness();
  game.start({ mode: MODES.CAMPAIGN, levelId: 1 });
  for (let i = 0; i < 200; i += 1) game.advance(1 / 120);
  game.setPointer(900);
  for (let i = 0; i < 10; i += 1) game.advance(1 / 120);
  const mid = game.state.turret.x;
  game.setMove(-1);
  assert.equal(game.input.pointerX, null, "a held direction must release the pointer");
  for (let i = 0; i < 60; i += 1) game.advance(1 / 120);
  assert.ok(game.state.turret.x < mid, "a stale pointer target must not shadow the keyboard");
});

test("a pointer target releases control once the turret arrives", () => {
  const { game } = harness();
  game.start({ mode: MODES.CAMPAIGN, levelId: 1 });
  for (let i = 0; i < 200; i += 1) game.advance(1 / 120);
  game.setPointer(320);
  for (let i = 0; i < 400; i += 1) game.advance(1 / 120);
  assert.equal(game.input.pointerX, null, "arriving must hand steering back");
  assert.ok(Math.abs(game.state.turret.x - 320) < 6);
});

test("clearInput drops held direction, trigger and pointer target", () => {
  const { game } = harness();
  game.start({ mode: MODES.CAMPAIGN, levelId: 1 });
  for (let i = 0; i < 200; i += 1) game.advance(1 / 120);
  game.setMove(1);
  game.setPointer(700);
  game.setFiring(true);
  game.clearInput();
  assert.deepEqual(game.input, { dir: 0, firing: false, pointerX: null });
  const frozen = game.state.turret.x;
  for (let i = 0; i < 60; i += 1) game.advance(1 / 120);
  assert.equal(game.state.turret.x, frozen, "the turret must sit still after an input reset");
});

test("pause freezes the simulation and resumes cleanly", () => {
  const { game } = harness();
  game.start({ mode: MODES.CAMPAIGN, levelId: 1 });
  for (let i = 0; i < 200; i += 1) game.advance(1 / 120);
  assert.equal(game.togglePause(), true);
  const time = game.state.time;
  for (let i = 0; i < 120; i += 1) game.advance(1 / 120);
  assert.equal(game.state.time, time);
  assert.equal(game.togglePause(), false);
  for (let i = 0; i < 60; i += 1) game.advance(1 / 120);
  assert.ok(game.state.time > time);
});

test("finishing a campaign stage records stars and unlocks the next", () => {
  const { game, finishes } = harness();
  game.progress = defaultProgress();
  game.start({ mode: MODES.CAMPAIGN, levelId: 1 });
  const state = game.state;
  state.status = STATUS.WON;
  state.score = 500;
  game.advance(1 / 120);
  assert.equal(finishes.length, 1);
  assert.ok(game.progress.stars[1] >= 1);
  assert.equal(game.progress.unlocked, 2);
  assert.equal(finishes[0].report.score, 500);
});

test("survival runs record the furthest wave", () => {
  const { game } = harness();
  game.progress = defaultProgress();
  game.start({ mode: MODES.SURVIVAL, levelId: 1 });
  game.state.waveIndex = 5;
  game.state.status = STATUS.LOST;
  game.advance(1 / 120);
  assert.equal(game.progress.survival.wave, 6);
});

test("mute preference is persisted through the storage key", () => {
  const { game } = harness();
  assert.equal(game.setMuted(true), true);
  assert.equal(game.progress.muted, true);
  assert.equal(STORAGE_KEY, "doin.invaders.v1");
  game.setMuted(false);
  assert.equal(game.progress.muted, false);
});
