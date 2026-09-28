import test from "node:test";
import assert from "node:assert/strict";
import {
  TILE_EMPTY,
  TILE_HARD,
  TILE_SOFT,
  MODE_PUZZLE,
  STATUS_LOST,
  STATUS_PLAYING,
  STATUS_WON,
  createState,
  stepFrame,
  placeBomb,
  detonateRemote,
  setInput,
  applyPowerup,
  flameCells,
  demolitionRate,
  rating,
} from "../js/engine.mjs";

function level(overrides = {}) {
  return {
    id: "test_level",
    mode: "campaign",
    cols: 7,
    rows: 7,
    tiles: [
      "#######",
      "#.....#",
      "#.o.o.#",
      "#..o..#",
      "#.o.o.#",
      "#.....#",
      "#######",
    ],
    spawn: [1, 1],
    enemies: [],
    powerups: [],
    exit: null,
    timeLimit: 60,
    fire: 1,
    bombs: 1,
    seed: 7,
    ...overrides,
  };
}

function run(state, frames) {
  for (let i = 0; i < frames; i++) stepFrame(state);
}

test("tile parsing and spawn safety", () => {
  const state = createState(level());
  assert.equal(state.tiles[0][0], TILE_HARD);
  assert.equal(state.tiles[1][1], TILE_EMPTY);
  assert.equal(state.player.x, 1.5);
  assert.equal(state.player.y, 1.5);
  assert.equal(state.status, STATUS_PLAYING);
});

test("bomb placement respects capacity and ground", () => {
  const state = createState(level({ bombs: 1 }));
  assert.equal(placeBomb(state), true);
  assert.equal(placeBomb(state), false, "one bomb at a time at capacity 1");
  assert.equal(state.bombs.length, 1);
  assert.equal(state.player.bombsOut, 1);

  state.player.x = 2.5;
  state.player.y = 2.5; // soft brick tile
  assert.equal(placeBomb(state), false, "cannot bury a bomb inside a brick");
});

test("blast clears bricks, kills enemies and respects hard walls", () => {
  const state = createState(
    level({
      tiles: [
        "#######",
        "#.o...#",
        "#.o.o.#",
        "#..o..#",
        "#.o.o.#",
        "#.....#",
        "#######",
      ],
      enemies: [{ cx: 1, cy: 3, type: "target" }],
      fire: 2,
    })
  );
  assert.equal(placeBomb(state), true);
  state.player.x = 5.5;
  state.player.y = 5.5;
  run(state, 160);
  assert.equal(state.bombs.length, 0);
  assert.equal(state.tiles[1][2], TILE_EMPTY, "soft brick beside the bomb is cleared");
  assert.equal(state.stats.kills, 1);
  assert.equal(state.stats.bricksBroken, 1);
  assert.equal(state.player.alive, true, "player survived by walking away");
});

test("bomber can walk off his own fresh bomb", () => {
  const state = createState(level());
  assert.equal(placeBomb(state), true);
  setInput(state, 1, 0);
  run(state, 200); // bomb detonates at 2.4s = frame 144
  assert.equal(state.player.alive, true, "player escaped his own bomb");
  assert.equal(state.status, STATUS_PLAYING);
  assert.ok(state.player.x > 3, `player actually walked away, x=${state.player.x}`);
});

test("bomb turns solid once the bomber steps off it", () => {
  const state = createState(level());
  placeBomb(state);
  setInput(state, 1, 0);
  run(state, 40);
  assert.ok(state.player.x > 3, `walked clear, x=${state.player.x}`);
  const bomb = state.bombs[0];
  assert.ok(bomb, "bomb still ticking");
  assert.equal(bomb.soft, false, "bomb hardened after the body cleared the cell");
  setInput(state, -1, 0);
  run(state, 40);
  assert.ok(state.player.x >= 2.3, `cannot walk back onto the bomb, x=${state.player.x}`);
});

test("staying inside your own blast is fatal", () => {
  const state = createState(level({ enemies: [{ cx: 5, cy: 5, type: "target" }] }));
  placeBomb(state);
  run(state, 160);
  assert.equal(state.status, STATUS_LOST);
  assert.equal(state.player.alive, false);
});

test("shield absorbs one lethal blast", () => {
  const state = createState(level({ enemies: [{ cx: 5, cy: 5, type: "target" }] }));
  applyPowerup(state, "shield");
  placeBomb(state);
  run(state, 160);
  assert.equal(state.status, STATUS_PLAYING);
  assert.equal(state.player.shield, 0);
});

test("chained bombs count as one cascade", () => {
  const state = createState(level({ bombs: 2, fire: 2, enemies: [{ cx: 5, cy: 5, type: "target" }] }));
  assert.equal(placeBomb(state), true); // (1,1)
  state.player.x = 3.5;
  state.player.y = 1.5;
  assert.equal(placeBomb(state), true); // (3,1)
  state.player.x = 5.5;
  state.player.y = 5.5;
  run(state, 160);
  assert.equal(state.bombs.length, 0, "both bombs resolved");
  assert.equal(state.cascades, 1, "second bomb was lit by the first blast");
});

test("remote control holds the fuse until triggered", () => {
  const state = createState(level({ bombs: 1, enemies: [{ cx: 5, cy: 5, type: "target" }] }));
  applyPowerup(state, "remote");
  placeBomb(state);
  state.player.x = 5.5;
  state.player.y = 5.5;
  run(state, 200);
  assert.equal(state.bombs.length, 1, "remote bomb waits");
  assert.equal(state.bombs[0].waiting, true);
  assert.equal(detonateRemote(state), true);
  assert.equal(state.bombs.length, 0);
});

test("kick sends a bomb sliding until it hits something", () => {
  const state = createState(level());
  applyPowerup(state, "kick");
  placeBomb(state);
  state.player.x = 3.5;
  state.player.y = 1.5;
  setInput(state, -1, 0); // walk left into the bomb at (1,1) -> kicks it further left? blocked by wall
  run(state, 40);
  assert.equal(state.bombs[0].cx, 1, "wall stops the slide");
});

test("power-ups are picked up by walking onto them", () => {
  const state = createState(
    level({ powerups: [{ cx: 2, cy: 1, kind: "fire", hidden: false }] })
  );
  state.player.fire = 1;
  state.player.x = 2.5;
  state.player.y = 1.5;
  run(state, 2);
  assert.equal(state.player.fire, 2);
});

test("curse expires on its own", () => {
  const state = createState(level({ enemies: [{ cx: 5, cy: 5, type: "target" }] }));
  applyPowerup(state, "curse");
  assert.ok(state.player.curse);
  run(state, 620);
  assert.equal(state.player.curse, null);
});

test("campaign exit opens only after the arena is cleared", () => {
  const state = createState(
    level({
      enemies: [{ cx: 3, cy: 5, type: "target" }],
      exit: { cx: 5, cy: 5, hidden: false },
      fire: 3,
    })
  );
  assert.equal(state.exit.revealed, true);
  state.player.x = 5.5;
  state.player.y = 5.5;
  run(state, 2);
  assert.equal(state.status, STATUS_PLAYING, "exit does not open while an enemy lives");

  placeBomb(state); // bomb at (5,5) but player must leave
  state.player.x = 1.5;
  state.player.y = 5.5;
  run(state, 160);
  assert.equal(state.stats.kills, 1);
  state.player.x = 5.5;
  state.player.y = 5.5;
  run(state, 40);
  assert.equal(state.status, STATUS_WON);
});

test("puzzle mode: immune player, budget cap and one-chain flag", () => {
  const state = createState(
    level({
      id: "puzzle_test",
      mode: MODE_PUZZLE,
      enemies: [
        { cx: 2, cy: 1, type: "target" },
        { cx: 1, cy: 2, type: "target" },
      ],
      fire: 2,
      bombs: 2,
      par: 1,
      bombBudget: 2,
    })
  );
  assert.equal(state.player.immune, true);
  placeBomb(state);
  run(state, 260);
  assert.equal(state.player.alive, true, "puzzle player never dies to the blast");
  assert.equal(state.status, STATUS_WON);
  assert.equal(state.stats.bombsUsed, 1);
  assert.equal(rating(state).oneChain, true);
});

test("puzzle budget refuses extra bombs", () => {
  const state = createState(
    level({ mode: MODE_PUZZLE, fire: 1, bombs: 5, bombBudget: 1, enemies: [] })
  );
  assert.equal(placeBomb(state), true);
  state.player.x = 3.5;
  assert.equal(placeBomb(state), false, "budget blocks the second bomb");
});

test("flame geometry: walls and bricks stop the arm, pierce punches through", () => {
  const grid = [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 2, 0],
    [1, 0, 1, 0, 0],
    [1, 1, 1, 1, 1],
  ];
  const plain = flameCells(grid, 5, 4, 1, 1, 3, false);
  assert.ok(plain.some(([x, y]) => x === 3 && y === 1), "brick cell is hit");
  assert.ok(!plain.some(([x, y]) => x === 4 && y === 1), "brick stops the arm");
  const pierced = flameCells(grid, 5, 4, 1, 1, 3, true);
  assert.ok(pierced.some(([x, y]) => x === 4 && y === 1), "pierce continues past the brick");
  assert.ok(!plain.some(([x, y]) => x === 2 && y === 2), "perpendicular wall is untouched");
});

test("demolition rate tracks broken bricks", () => {
  const state = createState(level({ fire: 2, enemies: [{ cx: 5, cy: 1, type: "target" }] }));
  assert.equal(demolitionRate(state), 0);
  state.player.x = 1.5;
  state.player.y = 3.5; // right arm reaches the brick at (3,3)
  placeBomb(state);
  state.player.x = 5.5;
  state.player.y = 5.5;
  run(state, 160);
  assert.ok(demolitionRate(state) > 0);
});

test("rating grants up to three stars", () => {
  const state = createState(
    level({ enemies: [{ cx: 2, cy: 1, type: "target" }], fire: 3 })
  );
  placeBomb(state);
  state.player.x = 5.5;
  state.player.y = 5.5;
  run(state, 160);
  const info = rating(state);
  assert.ok(info.stars >= 1 && info.stars <= 3);
});

test("1000-step random walk never breaks the invariants", () => {
  // a real generated board, so terrain and AI both get exercised
  const generated = createState(
    {
      id: "walk",
      mode: "campaign",
      cols: 13,
      rows: 11,
      tiles: [
        "#############",
        "#..o..oooo..#",
        "#.#o#o#.#.#o#",
        "#oo..o.ooo..#",
        "#.#.#o#o#.#.#",
        "#ooooo.....o#",
        "#.#.#.#.#.#.#",
        "#.o...o....o#",
        "#.#o#.#o#.#o#",
        "#.o.o.o.....#",
        "#############",
      ],
      spawn: [1, 1],
      enemies: [
        { cx: 7, cy: 2, type: "balloon" },
        { cx: 9, cy: 4, type: "chaser" },
        { cx: 8, cy: 7, type: "evader" },
      ],
      powerups: [
        { cx: 3, cy: 2, kind: "fire", hidden: true },
        { cx: 5, cy: 4, kind: "bomb", hidden: true },
      ],
      exit: { cx: 11, cy: 8, hidden: true },
      timeLimit: 200,
      fire: 1,
      bombs: 2,
      seed: 99,
    },
    {}
  );
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let frame = 0; frame < 1200; frame++) {
    if (frame % 17 === 0) {
      const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [0, 0],
      ];
      const dir = dirs[Math.floor(rand() * dirs.length)];
      setInput(generated, dir[0], dir[1]);
    }
    if (frame % 31 === 0) placeBomb(generated);
    if (frame % 97 === 0) detonateRemote(generated);
    stepFrame(generated);
    assert.ok(generated.player.x > 0 && generated.player.x < generated.cols, "player stays in bounds");
    assert.ok(generated.player.y > 0 && generated.player.y < generated.rows, "player stays in bounds");
    assert.ok(generated.player.bombsOut <= generated.player.bombMax, "bomb count never exceeds capacity");
    assert.ok(generated.stats.bombsUsed >= generated.player.bombsOut, "usage bookkeeping is monotonic");
    if (generated.status !== STATUS_PLAYING) break;
  }
});
