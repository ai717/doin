import test from "node:test";
import assert from "node:assert/strict";
import { createController } from "../js/game.mjs";
import { rate, efficiency } from "../js/score.mjs";
import { levelById } from "../js/levels.mjs";
import { solve } from "../js/engine.mjs";

test("controller starts at first level with legal moves and a live hint path", () => {
  const game = createController();
  const snap = game.snapshot();
  assert.equal(snap.levelId, "L1");
  assert.equal(snap.moves, 0);
  assert.equal(snap.finished, false);
  assert.ok(snap.legal.length > 0);
  assert.deepEqual(snap.rings, levelById("L1").start);
  assert.ok(snap.hintPath.length > 0);
});

test("legal move advances state; illegal move is a no-op without cost", () => {
  const game = createController({ levelId: "L1" });
  const illegal = game.moveRing(2); // ring 3 locked on the starting corner
  assert.equal(illegal.event, "illegal");
  assert.equal(game.moves, 0);
  const legal = game.moveRing(0);
  assert.equal(legal.event, "move");
  assert.equal(game.moves, 1);
  assert.equal(game.snapshot().rings[0], 0);
});

test("optimal play reaches the win state and rate 3 stars", () => {
  const game = createController({ levelId: "L1" });
  const path = solve(levelById("L1").start, "unlink").moves;
  let last = null;
  for (const ring of path) last = game.moveRing(ring);
  assert.equal(last.event, "win");
  const snap = game.snapshot();
  assert.equal(snap.finished, true);
  assert.equal(snap.moves, levelById("L1").optimal);
  assert.equal(snap.stars, 3);
  assert.equal(game.moveRing(0).event, "noop", "terminal is a no-op");
});

test("undo and reset restore state; undo increments the move counter", () => {
  const game = createController({ levelId: "L1" });
  game.moveRing(0);
  game.moveRing(2); // ring 3 is now legal after ring 1 stepped down
  const before = game.snapshot().rings.slice();
  const undo = game.undo();
  assert.equal(undo.event, "undo");
  assert.notDeepEqual(game.snapshot().rings, before);
  assert.equal(game.moves, 3);
  assert.equal(game.snapshot().undos, 1);
  game.reset();
  assert.deepEqual(game.snapshot().rings, levelById("L1").start);
  assert.equal(game.moves, 0);
  assert.equal(game.snapshot().undos, 0);
});

test("paused controller ignores moves, undo and reset", () => {
  const game = createController();
  game.setPaused(true);
  assert.equal(game.moveRing(0).event, "noop");
  assert.equal(game.undo().event, "noop");
  assert.equal(game.reset().event, "noop");
  game.setPaused(false);
  assert.equal(game.moveRing(0).changed, true);
});

test("timer only advances while running and resets with the level", () => {
  const game = createController();
  game.tick(250);
  assert.equal(game.snapshot().elapsedMs, 250);
  game.setPaused(true);
  game.tick(5000);
  assert.equal(game.snapshot().elapsedMs, 250);
  game.setPaused(false);
  game.tick(-10);
  assert.equal(game.snapshot().elapsedMs, 250);
  game.reset();
  assert.equal(game.snapshot().elapsedMs, 0);
});

test("hint toggle and level switching keep state coherent", () => {
  const game = createController();
  assert.equal(game.setHint(false), false);
  assert.deepEqual(game.snapshot().hintPath, []);
  assert.equal(game.setHint(true), true);
  assert.equal(game.loadLevel("L10"), true);
  const snap = game.snapshot();
  assert.equal(snap.levelId, "L10");
  assert.equal(snap.ringCount, 9);
  assert.equal(snap.optimal, 341);
  assert.equal(game.loadLevel("nope"), false);
  assert.equal(game.loadNext(), true);
  assert.equal(game.snapshot().levelId, "L11");
});

test("switching level from the paused drawer still rebuilds the board", () => {
  const game = createController();
  game.moveRing(0);
  game.setPaused(true); // drawer opens with a paused controller
  assert.equal(game.loadLevel("L10"), true);
  const snap = game.snapshot();
  assert.equal(snap.levelId, "L10");
  assert.equal(snap.ringCount, 9, "board must be rebuilt with the new ring count");
  assert.deepEqual(snap.rings, levelById("L10").start);
  assert.equal(snap.moves, 0);
  game.setPaused(false);
  assert.equal(game.moveRing(0).changed, true, "board is playable after closing drawer");
});

test("rating tiers match optimal, 1.5x and beyond", () => {
  const level = { optimal: 10 };
  assert.equal(rate(level, 10), 3);
  assert.equal(rate(level, 15), 2);
  assert.equal(rate(level, 16), 1);
  assert.equal(efficiency(level, 10), 100);
  assert.equal(efficiency(level, 20), 50);
});
