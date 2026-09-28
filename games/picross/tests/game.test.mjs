import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GameController } from "../js/game.mjs";
import { CELL_PAINT, CELL_CROSS, CELL_EMPTY } from "../js/engine.mjs";

describe("Picross GameController Tests", () => {
  it("initializes with default level", () => {
    const game = new GameController();
    assert.ok(game.activeLevel);
    assert.equal(game.activeLevel.id, "p1");
    assert.equal(game.state.rows, 5);
    assert.equal(game.state.cols, 5);
    assert.equal(game.state.status, "playing");
    assert.equal(game.state.mistakes, 0);
  });

  it("handles tool switching", () => {
    const game = new GameController();
    assert.equal(game.tool, "paint");
    game.setTool("cross");
    assert.equal(game.tool, "cross");
    game.toggleTool();
    assert.equal(game.tool, "paint");
  });

  it("applies cell action and tracks mistakes", () => {
    const game = new GameController();
    // In p1 heart, (0, 0) is 0 (empty). Painting (0, 0) should be a mistake!
    game.cellClick(0, 0, CELL_PAINT);
    assert.equal(game.state.grid[0][0], CELL_PAINT);
    assert.equal(game.state.mistakes, 1);

    // Painting (0, 1) is target 1. Not a mistake.
    game.cellClick(0, 1, CELL_PAINT);
    assert.equal(game.state.grid[0][1], CELL_PAINT);
    assert.equal(game.state.mistakes, 1);
  });

  it("supports undo", () => {
    const game = new GameController();
    game.cellClick(0, 1, CELL_PAINT);
    assert.equal(game.state.grid[0][1], CELL_PAINT);

    game.undo();
    assert.equal(game.state.grid[0][1], CELL_EMPTY);
  });

  it("detects victory upon completing target cells", () => {
    const game = new GameController();
    let wonData = null;
    game.on("win", (data) => {
      wonData = data;
    });

    const target = game.activeLevel.target;
    for (let r = 0; r < game.activeLevel.rows; r++) {
      for (let c = 0; c < game.activeLevel.cols; c++) {
        if (target[r][c] === 1) {
          game.cellClick(r, c, CELL_PAINT);
        }
      }
    }

    assert.equal(game.state.status, "won");
    assert.ok(wonData, "Win event must be emitted");
    assert.equal(wonData.stars, 3);
  });
});
