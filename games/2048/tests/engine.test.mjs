import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DIRS,
  SIZE,
  WIN_VALUE,
  addRandomTile,
  applyMove,
  continueGame,
  createState,
  emptyCells,
  hasProgress,
  highestTile,
  isOver,
  startGame,
  toGrid,
} from "../js/engine.mjs";

function stateFrom(values, best = 0) {
  const tiles = [];
  let id = 1;
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const value = values[row][col];
      if (value) tiles.push({ id: id++, value, row, col, kind: "idle" });
    }
  }
  return { ...createState(best), tiles, nextId: id };
}

function rowOf(state, row) {
  return toGrid(state.tiles)[row];
}

function columnOf(state, col) {
  return toGrid(state.tiles).map((line) => line[col]);
}

function mulberry32(seed) {
  return function rng() {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("sliding", () => {
  it("slides tiles into the gap", () => {
    const start = stateFrom([
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const { state, moved } = applyMove(start, "left", Math.random, { spawn: false });
    assert.equal(moved, true);
    assert.deepEqual(rowOf(state, 0), [2, 0, 0, 0]);
  });

  it("merges a pair across a gap", () => {
    const start = stateFrom([
      [2, 0, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const { state, gained, topMerge } = applyMove(start, "left", Math.random, { spawn: false });
    assert.deepEqual(rowOf(state, 0), [4, 0, 0, 0]);
    assert.equal(gained, 4);
    assert.equal(topMerge, 4);
  });

  it("moves in all four directions", () => {
    const start = stateFrom([
      [2, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [4, 0, 0, 0],
    ]);
    assert.deepEqual(rowOf(applyMove(start, "right", Math.random, { spawn: false }).state, 0), [
      0, 0, 0, 4,
    ]);
    assert.deepEqual(columnOf(applyMove(start, "down", Math.random, { spawn: false }).state, 0), [
      0, 0, 2, 4,
    ]);
    const column = stateFrom([
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 2],
      [0, 0, 0, 0],
    ]);
    assert.deepEqual(columnOf(applyMove(column, "up", Math.random, { spawn: false }).state, 3), [
      4, 0, 0, 0,
    ]);
  });

  it("ignores an unknown direction", () => {
    const start = startGame(0, mulberry32(1));
    const { moved, state } = applyMove(start, "sideways", Math.random, { spawn: false });
    assert.equal(moved, false);
    assert.equal(state, start);
  });
});

describe("merging", () => {
  it("never chains a merge inside one move", () => {
    const start = stateFrom([
      [2, 2, 2, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const { state, gained } = applyMove(start, "left", Math.random, { spawn: false });
    assert.deepEqual(rowOf(state, 0), [4, 4, 0, 0]);
    assert.equal(gained, 8);
  });

  it("merges the leading pair when three match", () => {
    const start = stateFrom([
      [2, 2, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    assert.deepEqual(rowOf(applyMove(start, "left", Math.random, { spawn: false }).state, 0), [
      4, 2, 0, 0,
    ]);
    assert.deepEqual(rowOf(applyMove(start, "right", Math.random, { spawn: false }).state, 0), [
      0, 0, 2, 4,
    ]);
  });

  it("scores every merge in every line", () => {
    const start = stateFrom([
      [2, 2, 0, 0],
      [4, 4, 0, 0],
      [8, 8, 0, 0],
      [16, 16, 0, 0],
    ]);
    const { gained, state } = applyMove(start, "left", Math.random, { spawn: false });
    assert.equal(gained, 4 + 8 + 16 + 32);
    assert.equal(state.score, 60);
  });

  it("reports absorbed parents at the merge cell", () => {
    const start = stateFrom([
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const { absorbed } = applyMove(start, "left", Math.random, { spawn: false });
    assert.equal(absorbed.length, 2);
    assert.deepEqual(absorbed[0], { id: 1, value: 2, row: 0, col: 0 });
    assert.deepEqual(absorbed[1], { id: 2, value: 2, row: 0, col: 0 });
  });
});

describe("immovable moves", () => {
  it("reports no move and keeps the same state", () => {
    const start = stateFrom([
      [2, 4, 8, 16],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = applyMove(start, "left", Math.random);
    assert.equal(result.moved, false);
    assert.equal(result.state, start);
    assert.equal(result.gained, 0);
  });

  it("never spawns a tile after an immovable move", () => {
    const start = stateFrom([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]);
    const { state } = applyMove(start, "up", Math.random);
    assert.equal(state.tiles.length, 16);
  });

  it("spawns exactly one tile after a real move", () => {
    const start = stateFrom([
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const spawned = applyMove(start, "right", mulberry32(7)).state;
    assert.equal(spawned.tiles.length, 2);
    assert.ok(spawned.tiles.some((tile) => tile.kind === "new"));
    const quiet = applyMove(start, "right", mulberry32(7), { spawn: false }).state;
    assert.equal(quiet.tiles.length, 1);
  });

  it("blocks input once the game is over", () => {
    const over = { ...stateFrom([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), over: true };
    const { moved, state } = applyMove(over, "left", Math.random);
    assert.equal(moved, false);
    assert.equal(state, over);
  });
});

describe("spawning", () => {
  it("starts a game with two tiles", () => {
    const state = startGame(0, mulberry32(3));
    assert.equal(state.tiles.length, 2);
    assert.equal(emptyCells(state.tiles).length, SIZE * SIZE - 2);
  });

  it("only spawns 2 or 4 on a free cell", () => {
    let state = createState();
    const rng = mulberry32(11);
    for (let i = 0; i < 16; i++) {
      state = addRandomTile(state, rng);
      const seen = new Set();
      for (const tile of state.tiles) {
        assert.ok(tile.value === 2 || tile.value === 4);
        const key = tile.row * SIZE + tile.col;
        assert.equal(seen.has(key), false);
        seen.add(key);
      }
    }
    assert.equal(addRandomTile(state, rng), state);
  });
});

describe("win and loss", () => {
  it("flags a win the first time 2048 appears", () => {
    const start = stateFrom([
      [1024, 1024, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const { state } = applyMove(start, "left", Math.random, { spawn: false });
    assert.equal(state.won, true);
    assert.equal(state.over, false);
    assert.equal(highestTile(state.tiles), WIN_VALUE);
  });

  it("detects a full board without a pair as over", () => {
    const start = stateFrom([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]);
    assert.equal(isOver(start.tiles), true);
  });

  it("keeps playing while a pair remains on a full board", () => {
    const start = stateFrom([
      [2, 2, 4, 8],
      [4, 8, 16, 32],
      [8, 16, 32, 64],
      [16, 32, 64, 128],
    ]);
    assert.equal(isOver(start.tiles), false);
  });

  it("only allows continue after a win", () => {
    const won = { ...createState(), won: true };
    assert.equal(continueGame(won).keepPlaying, true);
    assert.equal(continueGame({ ...won, over: true }).keepPlaying, false);
    assert.equal(continueGame(createState()).keepPlaying, false);
  });
});

describe("progress", () => {
  it("treats a fresh board as without progress", () => {
    const fresh = stateFrom([
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 2, 0, 0],
    ]);
    assert.equal(hasProgress(fresh), false);
  });

  it("counts a scored or grown board as progress", () => {
    const fresh = stateFrom([
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 2, 0, 0],
    ]);
    assert.equal(hasProgress({ ...fresh, score: 4 }), true);
    assert.equal(hasProgress(stateFrom([[8, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])), true);
  });
});

describe("random play invariants", () => {
  it("holds the board and score consistent across a full run", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const rng = mulberry32(seed);
      let state = startGame(0, rng);
      let expected = 0;
      let guard = 0;
      while (!state.over && guard++ < 5000) {
        const result = applyMove(state, DIRS[Math.floor(rng() * DIRS.length)], rng);
        if (!result.moved) continue;
        state = result.state;
        expected += result.gained;
        assert.equal(state.score, expected);
        assert.ok(state.tiles.length <= SIZE * SIZE);

        const seen = new Set();
        for (const tile of state.tiles) {
          const key = tile.row * SIZE + tile.col;
          assert.equal(seen.has(key), false, "two tiles share a cell");
          seen.add(key);
          assert.ok(tile.row >= 0 && tile.row < SIZE && tile.col >= 0 && tile.col < SIZE);
          assert.equal(Number.isInteger(Math.log2(tile.value)), true, "value is not a power of two");
        }
        assert.ok(state.best >= state.score);
      }
      assert.equal(state.over, true, "run never terminated");
    }
  });

  it("never mutates the state passed in", () => {
    const rng = mulberry32(21);
    let state = startGame(0, rng);
    for (const dir of DIRS) {
      const before = JSON.stringify(state);
      const result = applyMove(state, dir, rng);
      assert.equal(JSON.stringify(state), before);
      if (result.moved) state = result.state;
    }
  });
});
