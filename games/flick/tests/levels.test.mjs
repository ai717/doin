import test from "node:test";
import assert from "node:assert/strict";

import {
  BOARDS,
  DEFAULT_SETTINGS,
  DIFFICULTIES,
  MAX_ROUNDS,
  MODES,
  PUCKS_PER_SIDE,
  SIDES,
  START,
  bestKey,
  getBoard,
  getDifficulty,
  normalizeSettings,
  otherSide,
} from "../js/levels.mjs";

test("盘面：三种变体，孔位数量与顺序正确", () => {
  assert.equal(BOARDS.length, 3);
  assert.deepEqual(BOARDS.map((board) => board.gates.length), [1, 2, 3]);
  for (const board of BOARDS) {
    assert.ok(board.id.startsWith("board_"));
    assert.ok(board.nameKey && board.descKey);
    const sorted = [...board.gates].sort((a, b) => a - b);
    assert.deepEqual(board.gates, sorted);
    for (const fraction of board.gates) {
      assert.ok(fraction > 0.1 && fraction < 0.9);
    }
  }
  assert.equal(getBoard("board_3gate").gates.length, 3);
  assert.equal(getBoard("missing").id, BOARDS[0].id);
});

test("难度：三档启发式误差递减、思考时间合理", () => {
  assert.equal(DIFFICULTIES.length, 3);
  const [novice, skilled, master] = DIFFICULTIES;
  assert.ok(novice.aimError > skilled.aimError && skilled.aimError > master.aimError);
  assert.ok(novice.powerError > skilled.powerError && skilled.powerError > master.powerError);
  for (const level of DIFFICULTIES) {
    assert.ok(level.thinkMs >= 300 && level.thinkMs <= 3000);
    assert.ok(level.nameKey);
  }
  assert.equal(getDifficulty("nope").id, DIFFICULTIES[0].id);
});

test("设置：非法值回退默认，合法值原样保留", () => {
  assert.deepEqual(normalizeSettings(null), { ...DEFAULT_SETTINGS });
  assert.deepEqual(normalizeSettings({ mode: "nope", difficulty: "x", boardId: "y", humanSide: "z" }), {
    ...DEFAULT_SETTINGS,
  });
  const valid = { mode: "duel", difficulty: "ai_master", boardId: "board_2gate", humanSide: "north" };
  assert.deepEqual(normalizeSettings(valid), valid);
  assert.deepEqual(normalizeSettings({ ...valid, mode: "solo" }), { ...valid, mode: "solo" });
});

test("设置：最佳纪录键区分模式、难度、盘面与先手", () => {
  const a = bestKey({ mode: "solo", difficulty: "ai_novice", boardId: "board_1gate", humanSide: "south" });
  const b = bestKey({ mode: "solo", difficulty: "ai_master", boardId: "board_1gate", humanSide: "south" });
  const c = bestKey({ mode: "duel", difficulty: "ai_master", boardId: "board_1gate", humanSide: "south" });
  assert.notEqual(a, b);
  assert.notEqual(b, c);
  assert.match(a, /^solo_ai_novice_board_1gate_south$/);
  assert.match(c, /^duel_duel_board_1gate_south$/);
});

test("常量：布局、回合上限与阵营枚举齐备", () => {
  assert.equal(PUCKS_PER_SIDE, 5);
  assert.equal(MAX_ROUNDS, 60);
  assert.equal(START.offsets.length, PUCKS_PER_SIDE);
  assert.deepEqual([...SIDES], ["south", "north"]);
  assert.deepEqual([...MODES], ["solo", "duel"]);
  assert.equal(otherSide("south"), "north");
  assert.equal(otherSide("north"), "south");
});
