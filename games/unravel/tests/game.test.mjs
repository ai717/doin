import assert from "node:assert/strict";
import { test } from "node:test";
import { createController } from "../js/game.mjs";
import { getLevel, levelSeed } from "../js/levels.mjs";
import { freeStrands } from "../js/engine.mjs";

test("controller loads a level ready to play", () => {
  const ctrl = createController();
  ctrl.loadLevel(1);
  assert.equal(ctrl.ctrl.state.status, "playing");
  assert.ok(freeStrands(ctrl.ctrl.board, ctrl.ctrl.state).length >= 2);
  assert.ok(ctrl.ctrl.timer.running);
});

test("undo restores the previous state exactly", () => {
  const ctrl = createController();
  ctrl.loadLevel(2);
  const before = JSON.stringify(ctrl.ctrl.state);
  const free = freeStrands(ctrl.ctrl.board, ctrl.ctrl.state)
    .find((s) => !s.knot);
  assert.ok(free, "level 2 should have a knot-free strand");
  const event = ctrl.collect(free.id);
  assert.ok(event);
  assert.equal(ctrl.ctrl.state.collected.includes(free.id), true);
  assert.equal(ctrl.undo().type, "undo");
  assert.equal(ctrl.ctrl.undoCount, 1);
  assert.equal(JSON.stringify(ctrl.ctrl.state), before);
  assert.equal(ctrl.canUndo(), false);
  assert.equal(ctrl.undo(), null);
});

test("undo count is tracked for scoring", () => {
  const ctrl = createController();
  ctrl.loadLevel(3);
  for (let i = 0; i < 3; i++) {
    const free = freeStrands(ctrl.ctrl.board, ctrl.ctrl.state).find((s) => !s.knot);
    if (!free || !ctrl.collect(free.id)) break;
  }
  const undos = ctrl.ctrl.undoCount;
  ctrl.undo();
  assert.equal(ctrl.ctrl.undoCount, undos + 1);
});

test("timer freezes while paused and resumes", async () => {
  const ctrl = createController();
  ctrl.loadLevel(1);
  ctrl.pauseTimer();
  const frozen = ctrl.getElapsedMs();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(ctrl.getElapsedMs(), frozen);
  ctrl.resumeTimer();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.ok(ctrl.getElapsedMs() > frozen);
});

test("relax mode never reports lost under greedy play", () => {
  const ctrl = createController();
  ctrl.startRelax(987654);
  for (let guard = 0; guard < 500 && ctrl.ctrl.state.status === "playing"; guard++) {
    const free = freeStrands(ctrl.ctrl.board, ctrl.ctrl.state);
    if (!free.length) break;
    const target = free[0];
    if (target.knot && !ctrl.ctrl.state.untied[target.id]) {
      ctrl.untie(target.id);
      continue;
    }
    ctrl.collect(target.id);
    assert.ok(ctrl.ctrl.state.status !== "lost");
  }
  assert.equal(ctrl.ctrl.state.status, "won");
});

test("deterministic seeds per level", () => {
  assert.equal(levelSeed(5), levelSeed(5));
  assert.notEqual(levelSeed(5), levelSeed(6));
  assert.equal(getLevel(40).id, 40);
});
