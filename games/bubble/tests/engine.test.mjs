import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mulberry32,
  generateGrid,
  createInitialState,
  dropBubble,
  useNeedle,
  stepFrame,
  checkInvariants,
  getLegalActions,
  COLS,
  ROWS,
  TILE,
} from "../js/engine.mjs";

describe("engine.mjs bubble arena rules and determinism", () => {
  it("mulberry32 generates deterministic sequences", () => {
    const rng1 = mulberry32(100);
    const rng2 = mulberry32(100);
    for (let i = 0; i < 20; i++) {
      assert.equal(rng1(), rng2());
    }
  });

  it("generateGrid has hard walls and alternating pillars", () => {
    const grid = generateGrid("map_pool");
    // Outer border
    for (let r = 0; r < ROWS; r++) {
      assert.equal(grid[r][0], TILE.HARD);
      assert.equal(grid[r][COLS - 1], TILE.HARD);
    }
    for (let c = 0; c < COLS; c++) {
      assert.equal(grid[0][c], TILE.HARD);
      assert.equal(grid[ROWS - 1][c], TILE.HARD);
    }
    // Spawn corners are empty
    assert.equal(grid[1][1], TILE.EMPTY);
    assert.equal(grid[1][2], TILE.EMPTY);
    assert.equal(grid[2][1], TILE.EMPTY);
  });

  it("createInitialState creates ready match with 2 players", () => {
    const state = createInitialState({ mapId: "map_pool", seed: 42 });
    assert.equal(state.status, "playing");
    assert.equal(state.players.length, 2);
    assert.equal(state.players[0].alive, true);
    assert.equal(state.players[1].alive, true);
    checkInvariants(state);
  });

  it("dropBubble places a bubble at player position", () => {
    let state = createInitialState();
    state = dropBubble(state, 0);
    assert.equal(state.bubbles.length, 1);
    assert.equal(state.bubbles[0].col, 1);
    assert.equal(state.bubbles[0].row, 1);
    assert.equal(state.players[0].activeBubbles, 1);

    // Cannot drop another if at max limit
    state = dropBubble(state, 0);
    assert.equal(state.bubbles.length, 1);
  });

  it("bubble explosion creates cross splashes and destroys soft blocks", () => {
    let state = createInitialState();
    state.grid[1][2] = TILE.SOFT; // soft block adjacent to P1

    state = dropBubble(state, 0);
    // Advance fuse
    state = stepFrame(state, 2.5);

    // Bubble should have exploded
    assert.equal(state.bubbles.length, 0);
    assert.ok(state.splashes.length > 0);
    // Soft block at (2, 1) destroyed
    assert.equal(state.grid[1][2], TILE.EMPTY);
  });

  it("splash traps character in water bubble", () => {
    let state = createInitialState();
    // Place P2 at (1, 2) in splash range of (1, 1)
    state.players[1].x = 1.5;
    state.players[1].y = 2.5;

    state = dropBubble(state, 0);
    state = stepFrame(state, 2.5);

    // P2 should be trapped!
    assert.equal(state.players[1].trapped, true);
    assert.ok(state.players[1].trappedTimer > 0);
  });

  it("touching a trapped opponent pops and eliminates them", () => {
    let state = createInitialState();
    state.players[1].trapped = true;
    state.players[1].trappedTimer = 4.0;
    state.players[1].x = 2.0;
    state.players[1].y = 1.5;

    // P1 moves into P2
    state.players[0].x = 1.8;
    state.players[0].y = 1.5;

    state = stepFrame(state, 0.05);

    // P2 popped and eliminated!
    assert.equal(state.players[1].alive, false);
    assert.equal(state.status, "p1_won");
  });

  it("useNeedle self-rescues from trapped state", () => {
    let state = createInitialState();
    state.players[0].trapped = true;
    state.players[0].trappedTimer = 4.0;
    state.players[0].needles = 1;

    state = useNeedle(state, 0);
    assert.equal(state.players[0].trapped, false);
    assert.equal(state.players[0].needles, 0);
  });

  it("dropping a bubble allows walking multiple tiles away smoothly at 60fps", () => {
    let state = createInitialState({ seed: 12345 });
    // P1 starts at (1.5, 1.5)
    state = dropBubble(state, 0);
    assert.equal(state.bubbles.length, 1);

    // Simulate 60fps movement (dt = 0.016) walking right for 40 frames (~2 tiles)
    for (let f = 0; f < 40; f++) {
      state = stepFrame(state, 0.016, { p1: { right: true } });
    }

    // P1 must have walked past cell 2 and into cell 3 (> 3.0), never blocked at 2.3
    assert.ok(state.players[0].x > 3.0, `Expected player x > 3.0, got ${state.players[0].x}`);
  });

  it("1000+ step random walk invariant check", () => {
    let state = createInitialState({ seed: 777 });

    for (let step = 0; step < 1200; step++) {
      const inputs = {
        p1: {
          up: Math.random() < 0.25,
          down: Math.random() < 0.25,
          left: Math.random() < 0.25,
          right: Math.random() < 0.25,
        },
        p2: {
          up: Math.random() < 0.25,
          down: Math.random() < 0.25,
          left: Math.random() < 0.25,
          right: Math.random() < 0.25,
        },
      };

      state = stepFrame(state, 0.05, inputs);
      checkInvariants(state);

      if (Math.random() < 0.08) {
        state = dropBubble(state, 0);
      }
      if (Math.random() < 0.08) {
        state = dropBubble(state, 1);
      }

      if (state.status !== "playing") {
        state = createInitialState({ seed: step + 1 });
      }
    }
  });
});
