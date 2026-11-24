import test from "node:test";
import assert from "node:assert/strict";
import { createController } from "../js/game.mjs";
import { rate, formatTime, starArray } from "../js/score.mjs";

test("controller boots instantly on level one with a ready board", () => {
  const game = createController();
  const snap = game.snapshot();
  assert.equal(snap.levelId, "level_sedan");
  assert.equal(snap.paused, false);
  assert.equal(snap.progress, 0);
  assert.equal(snap.complete, false);
  assert.ok(snap.state.totalInitial > 0);
});

test("dwell tick cleans and accumulates time; pointer up stops washing", () => {
  const game = createController({ levelId: "level_sedan" });
  game.beginPointer({ x: 0.5, y: 0.5 });
  let advanced = false;
  for (let t = 0; t < 20; t += 1) {
    const r = game.tick(0.05, { x: 0.5, y: 0.5 });
    if (r.changed) advanced = true;
  }
  assert.equal(advanced, true);
  assert.ok(game.snapshot().progress > 0);
  assert.ok(game.snapshot().state.elapsed > 0.9);
  const before = game.snapshot().progress;
  game.endPointer();
  game.tick(0.05, { x: 0.5, y: 0.5 });
  assert.equal(game.snapshot().progress, before, "no washing after release");
});

test("pause freezes washing and time; resume continues", () => {
  const game = createController({ levelId: "level_suv" });
  game.beginPointer({ x: 0.5, y: 0.5 });
  game.tick(0.05, { x: 0.5, y: 0.5 });
  const snap = game.snapshot();
  const progress = snap.progress;
  const time = snap.state.elapsed;
  game.setPaused(true);
  game.tick(0.05, { x: 0.5, y: 0.5 });
  assert.equal(game.snapshot().progress, progress);
  assert.equal(game.snapshot().state.elapsed, time);
  assert.equal(game.beginPointer({ x: 0.2, y: 0.2 }), false, "pointer ignored while paused");
  game.setPaused(false);
  assert.equal(game.beginPointer({ x: 0.5, y: 0.5 }), true, "pointer re-engages after resume");
  game.tick(0.05, { x: 0.5, y: 0.5 });
  assert.ok(game.snapshot().state.elapsed > time);
});

test("tool and nozzle choices are blocked while paused", () => {
  const game = createController();
  assert.equal(game.chooseTool("tool_brush"), true);
  assert.equal(game.snapshot().tool, "tool_brush");
  assert.equal(game.chooseTool("bogus"), false);
  assert.equal(game.switchNozzle(), true);
  assert.equal(game.snapshot().nozzle, "narrow");
  assert.equal(game.chooseNozzle("wide"), true);
  game.setPaused(true);
  assert.equal(game.chooseTool("tool_foam"), false);
  assert.equal(game.switchNozzle(), false);
});

test("completion emits result once and terminal ticks are inert", () => {
  const game = createController({ levelId: "level_sedan" });
  game.beginPointer({ x: 0.5, y: 0.5 });
  let completed = 0;
  let guard = 0;
  while (!game.snapshot().complete && guard++ < 400) {
    game.chooseTool(guard % 2 ? "tool_jet" : "tool_brush");
    for (let y = 0; y < 30; y += 3) {
      for (let x = 0; x < 48; x += 3) {
        const norm = { x: (x + 0.5) / 48, y: (y + 0.5) / 30 };
        game.beginPointer(norm);
        const r = game.tick(0.05, norm);
        completed += r.events.filter((e) => e.type === "complete").length;
      }
    }
  }
  assert.equal(game.snapshot().complete, true);
  assert.equal(completed, 1, "completion event fires exactly once");
  assert.ok(game.snapshot().result.stars >= 1 && game.snapshot().result.stars <= 3);
  const before = game.snapshot().state.totalRemaining;
  game.tick(0.05, { x: 0.5, y: 0.5 });
  assert.equal(game.snapshot().state.totalRemaining, before);
});

test("rewash and next level reset the board fully", () => {
  const game = createController();
  game.beginPointer({ x: 0.5, y: 0.5 });
  game.tick(0.05, { x: 0.5, y: 0.5 });
  assert.ok(game.snapshot().progress > 0);
  game.rewash();
  assert.equal(game.snapshot().progress, 0);
  assert.equal(game.snapshot().paused, false);
  assert.equal(game.nextLevel(), "level_suv");
  assert.equal(game.snapshot().levelId, "level_suv");
  assert.equal(game.snapshot().progress, 0);
});

test("score tiers and formatting have one authority", () => {
  assert.equal(rate(30), 3);
  assert.equal(rate(60), 2);
  assert.equal(rate(200), 1);
  assert.equal(rate(NaN), 1);
  assert.equal(formatTime(65), "01:05");
  assert.equal(formatTime(0), "00:00");
  assert.deepEqual(starArray(2), [true, true, false]);
});
