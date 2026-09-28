import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAMPAIGN_LEVELS, PUZZLE_LEVELS } from "../js/levels.mjs";
import { solvePuzzle } from "../tools/gen-levels.mjs";
import { createState, placeBomb, setInput, stepFrame } from "../js/engine.mjs";

const DESTRUCTIBLE = new Set([0, 2, 3]); // empty, soft, crack

function destructibleField(level) {
  const grid = level.tiles.map((row) => [...row].map((ch) => (ch === "#" ? 1 : ch === "." ? 0 : ch === "=" ? 3 : 2)));
  const seen = new Set();
  const key = (x, y) => `${x},${y}`;
  const queue = [[level.spawn[0], level.spawn[1]]];
  seen.add(key(...queue[0]));
  let head = 0;
  while (head < queue.length) {
    const [x, y] = queue[head++];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= level.cols || ny >= level.rows) continue;
      if (seen.has(key(nx, ny))) continue;
      if (!DESTRUCTIBLE.has(grid[ny][nx])) continue;
      seen.add(key(nx, ny));
      queue.push([nx, ny]);
    }
  }
  return { grid, seen, key };
}

test("campaign ships 40 stages across 5 chapters", () => {
  assert.equal(CAMPAIGN_LEVELS.length, 40);
  for (let chapter = 1; chapter <= 5; chapter++) {
    const slice = CAMPAIGN_LEVELS.filter((level) => level.chapter === chapter);
    assert.equal(slice.length, 8, `chapter ${chapter} has 8 stages`);
  }
});

test("campaign boards are structurally sound", () => {
  for (const level of CAMPAIGN_LEVELS) {
    assert.equal(level.tiles.length, level.rows, `${level.id} row count`);
    for (const row of level.tiles) assert.equal(row.length, level.cols, `${level.id} col width`);
    const { grid, seen, key } = destructibleField(level);
    assert.equal(grid[level.spawn[1]][level.spawn[0]], 0, `${level.id} spawn is open`);
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
    ]) {
      const x = level.spawn[0] + dx;
      const y = level.spawn[1] + dy;
      assert.equal(grid[y][x], 0, `${level.id} keeps the L-shaped pocket clear`);
    }
    assert.ok(level.enemies.length >= 3, `${level.id} has enemies`);
    for (const enemy of level.enemies) {
      assert.equal(grid[enemy.cy][enemy.cx], 0, `${level.id} enemy stands on open ground`);
      assert.ok(seen.has(key(enemy.cx, enemy.cy)), `${level.id} enemy is reachable`);
      const distance = Math.abs(enemy.cx - level.spawn[0]) + Math.abs(enemy.cy - level.spawn[1]);
      assert.ok(distance >= 3, `${level.id} enemy is not spawned on top of the player`);
    }
    const exitTile = grid[level.exit.cy][level.exit.cx];
    assert.ok(exitTile === 2 || exitTile === 3, `${level.id} exit hides under a brick`);
    assert.ok(seen.has(key(level.exit.cx, level.exit.cy)), `${level.id} exit is reachable`);
    for (const item of level.powerups) {
      const tile = grid[item.cy][item.cx];
      assert.ok(tile === 2 || tile === 3, `${level.id} power-up is buried in a brick`);
      assert.equal(item.hidden, true);
    }
  }
});

test("every campaign spawn has a straight escape from its own first bomb", () => {
  for (const level of CAMPAIGN_LEVELS) {
    const quiet = { ...level, enemies: [] };
    let escaped = false;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const state = createState(quiet);
      if (!placeBomb(state)) continue;
      setInput(state, dx, dy);
      for (let i = 0; i < 170; i++) stepFrame(state); // bomb blows at frame 144
      if (state.player.alive) {
        escaped = true;
        break;
      }
    }
    assert.ok(escaped, `${level.id} traps the bomber on his own first bomb`);
  }
});

// Two-cell runway check: a fire-1 blast reaches one cell out, so a floor tile
// is only a survivable drop spot when it has two clear cells in some direction.
test("every brick can be broken from a spot the bomber survives", () => {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const level of CAMPAIGN_LEVELS) {
    const grid = level.tiles.map((row) => [...row].map((ch) => (ch === "#" ? 1 : ch === "." ? 0 : 2)));
    const inside = (x, y) => x > 0 && y > 0 && x < level.cols - 1 && y < level.rows - 1;
    const laneClear = (x, y) =>
      dirs.some(([dx, dy]) => {
        const bx = x + 2 * dx;
        const by = y + 2 * dy;
        if (!inside(bx, by)) return false;
        return grid[y + dy][x + dx] === 0 && grid[by][bx] === 0;
      });
    for (let y = 1; y < level.rows - 1; y++) {
      for (let x = 1; x < level.cols - 1; x++) {
        if (grid[y][x] === 0 || grid[y][x] === 1) continue;
        const anchors = dirs
          .map(([dx, dy]) => [x + dx, y + dy])
          .filter(([ax, ay]) => inside(ax, ay) && grid[ay][ax] === 0);
        assert.ok(
          anchors.some(([ax, ay]) => laneClear(ax, ay)),
          `${level.id} brick ${x},${y} has no safe spot to bomb it from`
        );
      }
    }
  }
});

test("campaign boards are deterministic per id", () => {
  const level = CAMPAIGN_LEVELS[5];
  const a = createState(level);
  const b = createState(level);
  assert.deepEqual(a.tiles, b.tiles);
  assert.deepEqual(
    a.enemies.map((e) => [e.cx, e.cy, e.type]),
    b.enemies.map((e) => [e.cx, e.cy, e.type])
  );
});

test("puzzle ships 24 verified boards", () => {
  assert.equal(PUZZLE_LEVELS.length, 24);
  for (const level of PUZZLE_LEVELS) {
    const grid = level.tiles.map((row) =>
      [...row].map((ch) => (ch === "#" ? 1 : ch === "." ? 0 : 2))
    );
    assert.ok(level.enemies.length >= 3, `${level.id} needs targets`);
    assert.equal(level.tiles.length, level.rows);
    const targets = level.enemies.map((e) => [e.cx, e.cy]);
    assert.equal(grid[level.spawn[1]][level.spawn[0]], 0, `${level.id} spawn is open`);
    const solution = solvePuzzle(grid, level.cols, level.rows, targets, level.spawn, level.fire, 4);
    assert.ok(solution, `${level.id} is solvable`);
    assert.equal(solution.bombs, level.par, `${level.id} par matches the solver`);
    assert.equal(level.bombBudget, level.par + 1, `${level.id} allows one spare bomb`);
    assert.ok(level.par >= 1 && level.par <= 4, `${level.id} par stays in range`);
  }
});

test("level data carries no hard-coded display text", () => {
  const raw = readFileSync(new URL("../js/levels.mjs", import.meta.url), "utf8");
  assert.equal(/[\u4e00-\u9fa5]/.test(raw), false, "level data must stay language free");
  for (const level of CAMPAIGN_LEVELS) {
    assert.match(level.id, /^level_\d_\d$/);
  }
});
