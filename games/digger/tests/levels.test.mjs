import test from "node:test";
import assert from "node:assert/strict";

import { CELL_DIRT, CELL_OPEN, COLS, ROWS } from "../js/engine.mjs";
import { CHAPTERS, LEVELS, LEVEL_COUNT, getLevel, nextLevel } from "../js/levels.mjs";

const eq = assert.strictEqual;
const key = (col, row) => `${col},${row}`;

function gridOf(level) {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(CELL_DIRT));
  for (const cell of level.tunnels) grid[cell.row][cell.col] = CELL_OPEN;
  return grid;
}

function bfs(level, blocked) {
  const seen = new Set();
  const queue = [[level.spawnCol, -1]];
  seen.add(key(level.spawnCol, -1));
  while (queue.length) {
    const [col, row] = queue.shift();
    for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc < 0 || nc >= COLS || nr < -1 || nr >= ROWS) continue;
      if (blocked.has(key(nc, nr))) continue;
      const id = key(nc, nr);
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push([nc, nr]);
    }
  }
  return seen;
}

test("20 关 / 5 章 / 每章 4 关", () => {
  eq(LEVEL_COUNT, 20);
  eq(LEVELS.length, 20);
  eq(CHAPTERS.length, 5);
  for (let chapter = 1; chapter <= 5; chapter += 1) {
    eq(LEVELS.filter((level) => level.chapter === chapter).length, 4);
  }
  LEVELS.forEach((level, index) => {
    eq(level.index, index);
    eq(level.id, `d${String(index + 1).padStart(2, "0")}`);
    eq(level.spawnCol, 8);
    assert.ok(level.ghostInterval >= 4 && level.ghostInterval <= 10);
    assert.ok(level.speedScale >= 1);
  });
});

test("每关怪物、巨石、化石与隧道布局合法", () => {
  for (const level of LEVELS) {
    const grid = gridOf(level);
    assert.ok(level.monsters.length >= 1, `${level.id} 没有怪物`);
    assert.ok(level.monsters.length <= 9, `${level.id} 怪物过多`);
    assert.ok(level.fossils.length === 3, `${level.id} 化石不是 3 枚`);

    const monsterCells = new Set();
    for (const monster of level.monsters) {
      assert.ok(["pooka", "fygar"].includes(monster.type));
      assert.ok(monster.col >= 0 && monster.col < COLS);
      assert.ok(monster.row >= 0 && monster.row < ROWS);
      assert.equal(grid[monster.row][monster.col], CELL_OPEN, `${level.id} 怪物未站在隧道中`);
      const id = key(monster.col, monster.row);
      assert.ok(!monsterCells.has(id), `${level.id} 怪物位置重复`);
      monsterCells.add(id);
      assert.ok(Math.abs(monster.col - 8) + Math.abs(monster.row) > 2, `${level.id} 怪物离出生点过近`);
    }

    const rockCells = new Set();
    for (const rock of level.rocks) {
      assert.ok(rock.col >= 1 && rock.col < COLS - 1);
      assert.ok(rock.row >= 2 && rock.row < ROWS - 1);
      assert.equal(grid[rock.row][rock.col], CELL_DIRT, `${level.id} 巨石嵌在隧道中`);
      assert.equal(grid[rock.row + 1][rock.col], CELL_DIRT, `${level.id} 巨石初始缺少支撑`);
      assert.ok(!monsterCells.has(key(rock.col, rock.row)), `${level.id} 巨石与怪物重叠`);
      assert.ok(!monsterCells.has(key(rock.col, rock.row + 1)), `${level.id} 巨石正下方有怪物`);
      assert.ok(!rockCells.has(key(rock.col, rock.row)), `${level.id} 巨石位置重复`);
      rockCells.add(key(rock.col, rock.row));
    }

    const fossilCells = new Set();
    for (const fossil of level.fossils) {
      assert.equal(grid[fossil.row][fossil.col], CELL_DIRT, `${level.id} 化石不在泥土中`);
      assert.ok(!rockCells.has(key(fossil.col, fossil.row)), `${level.id} 化石与巨石重叠`);
      assert.ok(!monsterCells.has(key(fossil.col, fossil.row)), `${level.id} 化石与怪物重叠`);
      assert.ok(!fossilCells.has(key(fossil.col, fossil.row)), `${level.id} 化石位置重复`);
      fossilCells.add(key(fossil.col, fossil.row));
    }
  }
});

test("难度递进：前期无绿龙，终章怪物更密集", () => {
  for (const level of LEVELS.filter((item) => item.chapter === 1)) {
    eq(level.monsters.filter((monster) => monster.type === "fygar").length, 0);
  }
  const chapterTwo = LEVELS.filter((item) => item.chapter === 2);
  assert.ok(chapterTwo.some((level) => level.monsters.some((monster) => monster.type === "fygar")));
  const finalChapter = LEVELS.filter((item) => item.chapter === 5);
  for (const level of finalChapter) {
    assert.ok(level.monsters.length >= 6, `${level.id} 终章怪物过少`);
    assert.ok(level.monsters.some((monster) => monster.type === "fygar"));
  }
  assert.ok(LEVELS[19].monsters.length > LEVELS[0].monsters.length);
});

test("全清路径：每只怪物都存在安全的三格打气射线", () => {
  for (const level of LEVELS) {
    const blocked = new Set(level.rocks.map((rock) => key(rock.col, rock.row)));
    const reachable = bfs(level, blocked);
    assert.ok(reachable.has(key(8, 0)), `${level.id} 出生竖井不可达`);

    for (const monster of level.monsters) {
      const lanes = [];
      for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        for (const distance of [2, 3]) {
          const col = monster.col + dc * distance;
          const row = monster.row + dr * distance;
          if (col < 0 || col >= COLS || row < -1 || row >= ROWS) continue;
          let clear = true;
          for (let step = 1; step <= distance; step += 1) {
            const cc = monster.col + dc * step;
            const rr = monster.row + dr * step;
            if (blocked.has(key(cc, rr))) clear = false;
          }
          if (clear && reachable.has(key(col, row))) lanes.push([col, row]);
        }
      }
      assert.ok(lanes.length > 0, `${level.id} 的怪物 ${monster.col},${monster.row} 没有安全打气位`);
    }
  }
});

test("getLevel / nextLevel 链路", () => {
  eq(getLevel("d01"), LEVELS[0]);
  eq(getLevel("d20"), LEVELS[19]);
  eq(getLevel("nope"), null);
  eq(nextLevel("d01"), LEVELS[1]);
  eq(nextLevel("d19"), LEVELS[19]);
  eq(nextLevel("d20"), null);
  eq(nextLevel("nope"), null);
  for (let index = 0; index < 19; index += 1) {
    eq(nextLevel(LEVELS[index].id), LEVELS[index + 1]);
  }
});
