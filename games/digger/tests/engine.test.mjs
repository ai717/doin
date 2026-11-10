import test from "node:test";
import assert from "node:assert/strict";

import {
  CELL_DIRT, CELL_OPEN, COLS, FOSSIL_SCORE, PLAYER_LIVES, PUMP_SCORE, ROWS,
  STATUS_LOST, STATUS_PLAYING, STATUS_WON, createState, clearDirection, pump,
  setDirection, stepFrame,
} from "../js/engine.mjs";
import { LEVELS } from "../js/levels.mjs";

const eq = assert.strictEqual;

function level(overrides = {}) {
  return {
    id: "test",
    chapter: 1,
    spawnCol: 8,
    seed: 7,
    ghostInterval: 99,
    monsters: [],
    rocks: [],
    fossils: [],
    tunnels: [],
    ...overrides,
  };
}

function openRow(row, from, to) {
  const cells = [];
  for (let col = from; col <= to; col += 1) cells.push({ col, row });
  return cells;
}

test("createState：网格、隧道、怪物、巨石与化石", () => {
  const state = createState(level({
    monsters: [{ type: "pooka", col: 3, row: 5 }],
    rocks: [{ col: 6, row: 4 }],
    fossils: [{ col: 4, row: 8 }],
    tunnels: openRow(5, 2, 4),
  }));
  eq(state.grid.length, ROWS);
  eq(state.grid[0].length, COLS);
  eq(state.grid[0][0], CELL_DIRT);
  eq(state.grid[5][3], CELL_OPEN);
  eq(state.player.col, 8);
  eq(state.player.row, -1);
  eq(state.player.lives, PLAYER_LIVES);
  eq(state.monsters.length, 1);
  eq(state.monsters[0].alive, true);
  eq(state.rocks[0].falling, false);
  eq(state.fossils.length, 1);
  eq(state.status, STATUS_PLAYING);
  eq(createState(null), null);
});

test("移动会永久挖开泥土，且不能越过巨石与边界", () => {
  let state = createState(level({
    rocks: [{ col: 8, row: 1 }],
    tunnels: [{ col: 8, row: 0 }, { col: 0, row: 13 }],
    monsters: [{ type: "pooka", col: 0, row: 13 }],
  }));
  state = setDirection(state, "down");
  state = stepFrame(state, 1 / 60);
  eq(state.player.row, 0);
  eq(state.grid[0][8], CELL_OPEN);
  // 巨石挡路
  state = stepFrame(state, 0.2);
  eq(state.player.row, 0);
  // 横向挖掘后再向下
  state = setDirection(state, "right");
  state = stepFrame(state, 0.2);
  eq(state.player.col, 9);
  eq(state.player.row, 0);
  eq(state.grid[0][9], CELL_OPEN);
});

test("气泵射程被泥土阻挡，畅通时三次充气爆炸", () => {
  const blocked = createState(level({
    monsters: [{ type: "pooka", col: 10, row: 5 }],
    tunnels: [{ col: 7, row: 5 }],
  }));
  blocked.player.col = 7;
  blocked.player.row = 5;
  blocked.player.dir = "right";
  const missed = pump(blocked);
  eq(missed.monsters[0].inflation, 0);
  eq(missed.events[0].type, "pump-miss");

  let state = createState(level({
    monsters: [{ type: "pooka", col: 10, row: 5 }],
    tunnels: openRow(5, 7, 10),
  }));
  state.player.col = 7;
  state.player.row = 5;
  state.player.dir = "right";
  state = pump(state);
  eq(state.monsters[0].inflation, 1);
  eq(state.monsters[0].hooked, true);
  state = pump(state);
  eq(state.monsters[0].inflation, 2);
  state = pump(state);
  eq(state.monsters[0].alive, false);
  eq(state.score, PUMP_SCORE);
  eq(state.status, STATUS_WON);
  eq(state.events.some((event) => event.type === "burst"), true);
});

test("停止打气后怪物漏气并恢复移动", () => {
  let state = createState(level({
    monsters: [{ type: "pooka", col: 10, row: 5 }],
    tunnels: openRow(5, 7, 10),
  }));
  state.player.col = 7;
  state.player.row = 5;
  state.player.dir = "right";
  state = pump(state);
  eq(state.monsters[0].hooked, true);
  state = stepFrame(state, 0.2);
  eq(state.monsters[0].hooked, true);
  state = stepFrame(state, 0.3);
  eq(state.monsters[0].hooked, false);
  state = stepFrame(state, 1.01);
  eq(state.monsters[0].inflation, 0);
});

test("挖空巨石支撑后晃动一秒坠落，砸死怪物计三倍分", () => {
  let state = createState(level({
    monsters: [
      { type: "pooka", col: 5, row: 7 },
      { type: "pooka", col: 0, row: 0 },
    ],
    rocks: [{ col: 5, row: 4 }],
    tunnels: [{ col: 5, row: 5 }, { col: 5, row: 6 }, { col: 5, row: 7 }, { col: 0, row: 0 }],
  }));
  state.monsters.forEach((monster) => {
    monster.moveTimer = 999;
  });
  state.player.col = 15;
  state.player.row = 13;
  let sawFall = false;
  for (let i = 0; i < 60; i += 1) {
    state = stepFrame(state, 1 / 60);
    if (state.events.some((event) => event.type === "rock-fall")) sawFall = true;
  }
  eq(sawFall, true);
  for (let i = 0; i < 40; i += 1) state = stepFrame(state, 1 / 60);
  eq(state.monsters[0].alive, false);
  eq(state.score, PUMP_SCORE * 3);
  eq(state.rocks[0].shattered, true);
});

test("巨石也会砸中玩家并消耗一顶探险帽", () => {
  let state = createState(level({
    monsters: [{ type: "pooka", col: 0, row: 0 }],
    rocks: [{ col: 5, row: 4 }],
    tunnels: [{ col: 0, row: 0 }, { col: 5, row: 5 }, { col: 5, row: 6 }],
  }));
  state.monsters[0].moveTimer = 999;
  state.player.col = 5;
  state.player.row = 6;
  for (let i = 0; i < 120; i += 1) state = stepFrame(state, 1 / 60);
  eq(state.player.lives, PLAYER_LIVES - 1);
  eq(state.player.row, -1);
  eq(state.player.col, 8);
  eq(state.player.invuln > 0, true);
});

test("喷火绿龙蓄力后三格烈焰烧中玩家", () => {
  let state = createState(level({
    monsters: [{ type: "fygar", col: 8, row: 6 }],
    tunnels: openRow(6, 4, 8),
  }));
  state.player.col = 5;
  state.player.row = 6;
  state.monsters[0].flameTimer = 0;
  state.monsters[0].moveTimer = 999;
  let sawCharge = false;
  let sawFlame = false;
  for (let i = 0; i < 90; i += 1) {
    state = stepFrame(state, 1 / 60);
    if (state.events.some((event) => event.type === "charge")) sawCharge = true;
    if (state.events.some((event) => event.type === "flame")) sawFlame = true;
    if (state.player.lives < PLAYER_LIVES) break;
  }
  eq(sawCharge, true);
  eq(sawFlame, true);
  eq(state.player.lives, PLAYER_LIVES - 1);
});

test("最后一只怪物惊慌逃回地表并按清场处理", () => {
  let state = createState(level({
    monsters: [
      { type: "pooka", col: 8, row: 0 },
      { type: "pooka", col: 0, row: 0 },
    ],
    tunnels: [{ col: 8, row: 0 }, { col: 0, row: 0 }],
  }));
  state.monsters[1].alive = false;
  state.monsters[0].moveTimer = 0;
  state.monsters[0].panic = true;
  state.monsters[0].panicTimer = 0;
  for (let i = 0; i < 30; i += 1) state = stepFrame(state, 1 / 60);
  eq(state.monsters[0].escaped, true);
  eq(state.monsters[0].alive, false);
  eq(state.status, STATUS_WON);
});

test("单怪关卡不会自动惊慌逃跑，必须由玩家击破", () => {
  let state = createState(level({
    monsters: [{ type: "pooka", col: 0, row: 13 }],
    tunnels: [{ col: 0, row: 13 }],
  }));
  for (let i = 0; i < 600; i += 1) state = stepFrame(state, 1 / 60);
  eq(state.status, STATUS_PLAYING);
  eq(state.monsters[0].panic, false);
  eq(state.monsters[0].alive, true);
});

test("化石被挖出时加分并计数", () => {
  let state = createState(level({
    fossils: [{ col: 8, row: 2 }],
    monsters: [{ type: "pooka", col: 0, row: 13 }],
    tunnels: [{ col: 0, row: 13 }],
  }));
  state = setDirection(state, "down");
  for (let i = 0; i < 20; i += 1) {
    state = stepFrame(state, 1 / 30);
    if (state.fossilsGot) break;
  }
  eq(state.fossilsGot, 1);
  eq(state.fossils[0].got, true);
  assert.ok(state.score >= FOSSIL_SCORE);
});

test("终局后所有操作均为 no-op", () => {
  let state = createState(level({ monsters: [{ type: "pooka", col: 10, row: 5 }], tunnels: openRow(5, 7, 10) }));
  state.player.col = 7;
  state.player.row = 5;
  state.player.dir = "right";
  state = pump(pump(pump(state)));
  eq(state.status, STATUS_WON);
  const snapshot = JSON.stringify(state);
  eq(setDirection(state, "down"), state);
  eq(clearDirection(state, null), state);
  eq(pump(state), state);
  eq(stepFrame(state, 1 / 60), state);
  eq(JSON.stringify(state), snapshot);
});

test("1000 步随机游走：不抛错、不变式守恒", () => {
  let seed = 0x9e3779b9;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const dirs = ["up", "down", "left", "right"];
  let state = createState(LEVELS[19]);
  let digs = 0;
  assert.doesNotThrow(() => {
    for (let step = 0; step < 1000; step += 1) {
      const roll = random();
      if (roll < 0.14) state = pump(state);
      else if (roll < 0.22) state = clearDirection(state);
      else state = setDirection(state, dirs[Math.floor(random() * 4)]);
      state = stepFrame(state, 1 / 60);
      digs += state.events.filter((event) => event.type === "dig").length;

      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          assert.ok(state.grid[row][col] === CELL_DIRT || state.grid[row][col] === CELL_OPEN);
        }
      }
      assert.ok(state.player.col >= 0 && state.player.col < COLS);
      assert.ok(state.player.row >= -1 && state.player.row < ROWS);
      assert.ok(state.player.lives >= 0 && state.player.lives <= PLAYER_LIVES);
      assert.ok(state.score >= 0);
      assert.ok([STATUS_PLAYING, STATUS_WON, STATUS_LOST].includes(state.status));
      for (const monster of state.monsters) {
        assert.ok(Number.isFinite(monster.col) && Number.isFinite(monster.row));
        assert.ok(Number.isFinite(monster.inflation) && monster.inflation >= 0 && monster.inflation <= 3);
        if (monster.alive && monster.row >= 0 && state.grid[monster.row][monster.col] === CELL_DIRT) {
          assert.ok(monster.ghosting || monster.panic, "怪物不得无故停留在泥土中");
        }
      }
      for (const rock of state.rocks) assert.ok(rock.row >= 0 && rock.row < ROWS);
      if (state.status !== STATUS_PLAYING) state = createState(LEVELS[19], { seed: 0x51ed + step });
    }
  });
  assert.ok(digs > 20, `随机游走应至少挖开一些泥土（实际 ${digs}）`);
});

test("相同种子与操作序列完全可复现", () => {
  const script = (initial) => {
    let state = initial;
    const dirs = ["down", "right", "down", "left", "up"];
    for (let i = 0; i < 240; i += 1) {
      if (i % 19 === 0) state = pump(state);
      else if (i % 7 === 0) state = setDirection(state, dirs[(i / 7) % dirs.length]);
      state = stepFrame(state, 1 / 60);
    }
    return JSON.stringify({
      grid: state.grid,
      player: state.player,
      monsters: state.monsters,
      rocks: state.rocks,
      fossils: state.fossils,
      score: state.score,
      status: state.status,
      rng: state.rng,
      tick: state.tick,
    });
  };
  eq(script(createState(LEVELS[7])), script(createState(LEVELS[7])));
});
