import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGameController } from "../js/game.mjs";

describe("game.mjs controller state machine", () => {
  it("initializes with default map and ready state", () => {
    const controller = createGameController();
    const state = controller.getState();
    assert.equal(state.mapId, "map_pool");
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

  it("setPlayerInput updates inputs", () => {
    const controller = createGameController();
    controller.setPlayerInput(0, "down", true);
    // tick to move
    const prevY = controller.getState().players[0].y;
    controller.tick(0.1);
    assert.ok(controller.getState().players[0].y > prevY);
  });

  it("drop and needle emit events", () => {
    const controller = createGameController();
    let placedEvent = false;

    controller.onEvent((e) => {
      if (e.type === "bubble_placed") placedEvent = true;
    });

    controller.drop(0);
    assert.equal(placedEvent, true);
    assert.equal(controller.getState().bubbles.length, 1);
  });

  it("subscribe receives updates", () => {
    const controller = createGameController();
    let callCount = 0;
    const unsub = controller.subscribe(() => {
      callCount++;
    });

    controller.tick(0.05);
    assert.ok(callCount >= 1);

    unsub();
    const prev = callCount;
    controller.tick(0.05);
    assert.equal(callCount, prev);
  });
});
