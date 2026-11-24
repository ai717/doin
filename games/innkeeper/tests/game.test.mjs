import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGameController } from "../js/game.mjs";

describe("game.mjs state machine controller", () => {
  it("initializes with default shift and ready state", () => {
    const controller = createGameController();
    const state = controller.getState();
    assert.equal(state.shiftId, "shift_lunch");
    assert.equal(state.status, "playing");
    assert.equal(controller.getIsPaused(), false);
  });

  it("pause and resume freeze ticks", () => {
    const controller = createGameController();
    controller.pause();
    assert.equal(controller.getIsPaused(), true);

    const timeBefore = controller.getState().timeElapsed;
    controller.tick(0.5);
    assert.equal(controller.getState().timeElapsed, timeBefore);

    controller.resume();
    assert.equal(controller.getIsPaused(), false);
    controller.tick(0.5);
    assert.ok(controller.getState().timeElapsed > timeBefore);
  });

  it("togglePause switches paused state", () => {
    const controller = createGameController();
    assert.equal(controller.togglePause(), true);
    assert.equal(controller.togglePause(), false);
  });

  it("enqueue and cancel actions emit events", () => {
    const controller = createGameController();
    let enqueuedAct = null;
    let cancelledId = null;

    controller.onEvent((e) => {
      if (e.type === "action_enqueued") enqueuedAct = e.action;
      if (e.type === "action_cancelled") cancelledId = e.actionId;
    });

    controller.enqueue({ type: "fetch_tea" });
    assert.ok(enqueuedAct);
    assert.equal(enqueuedAct.type, "fetch_tea");

    const actId = controller.getState().actionQueue[0].id;
    controller.cancel(actId);
    assert.equal(cancelledId, actId);
    assert.equal(controller.getState().actionQueue.length, 0);
  });

  it("subscribe receives state notifications on tick and actions", () => {
    const controller = createGameController();
    let callCount = 0;
    const unsub = controller.subscribe(() => {
      callCount++;
    });

    controller.tick(0.1);
    assert.ok(callCount >= 1);

    unsub();
    const prev = callCount;
    controller.tick(0.1);
    assert.equal(callCount, prev);
  });
});
