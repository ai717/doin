import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY,
  PLAYER_X,
  PLAYER_O,
  STATUS_PLAYING,
  STATUS_WON,
  STATUS_DRAW,
  applyMove,
  boardKey,
  createState,
  generateWinLines,
  legalMoves,
  normalizeConfig,
  other,
  replay,
  winLinesFor,
} from "../js/engine.mjs";

function play(state, ...indices) {
  let next = state;
  for (const index of indices) next = applyMove(next, index);
  return next;
}

test("generateWinLines: 3x3 连三产出 8 条经典连线", () => {
  const lines = generateWinLines(3, 3);
  assert.equal(lines.length, 8);
  const keys = new Set(lines.map((line) => line.join(",")));
  for (const expected of [
    "0,1,2",
    "3,4,5",
    "6,7,8",
    "0,3,6",
    "1,4,7",
    "2,5,8",
    "0,4,8",
    "2,4,6",
  ]) {
    assert.ok(keys.has(expected), "missing line " + expected);
  }
});

test("generateWinLines: 4x4 连四产出 10 条，且不混入长度 3 的窗口", () => {
  const lines = generateWinLines(4, 4);
  assert.equal(lines.length, 10);
  for (const line of lines) assert.equal(line.length, 4);
  const keys = new Set(lines.map((line) => line.join(",")));
  assert.ok(keys.has("0,1,2,3"));
  assert.ok(keys.has("0,4,8,12"));
  assert.ok(keys.has("3,6,9,12"));
  assert.ok(!keys.has("0,1,2"));
});

test("winLinesFor 缓存结果且内容一致", () => {
  assert.equal(winLinesFor(3, 3), winLinesFor(3, 3));
  assert.deepEqual(winLinesFor(3, 3), generateWinLines(3, 3));
});

test("normalizeConfig: winLength 默认等于 size，且被 size 夹住", () => {
  assert.deepEqual(normalizeConfig(), { size: 3, winLength: 3, firstPlayer: PLAYER_X });
  assert.deepEqual(normalizeConfig({ size: 4 }), { size: 4, winLength: 4, firstPlayer: PLAYER_X });
  assert.equal(normalizeConfig({ size: 4, winLength: 9 }).winLength, 4);
  assert.equal(normalizeConfig({ size: 0 }).size, 2);
});

test("applyMove: 落子后轮换玩家并记录 move", () => {
  const start = createState({ size: 3 });
  const next = applyMove(start, 4);
  assert.equal(next.board[4], PLAYER_X);
  assert.equal(next.current, PLAYER_O);
  assert.deepEqual(next.moves, [4]);
  assert.equal(next.status, STATUS_PLAYING);
});

test("applyMove: 非法落子原样返回同一引用", () => {
  const start = createState({ size: 3 });
  assert.equal(applyMove(start, -1), start);
  assert.equal(applyMove(start, 9), start);
  assert.equal(applyMove(start, 1.5), start);
  const occupied = applyMove(start, 0);
  assert.equal(applyMove(occupied, 0), occupied);
});

test("applyMove: 不修改传入状态（不可变）", () => {
  const start = createState({ size: 3 });
  const snapshot = boardKey(start);
  applyMove(start, 0);
  assert.equal(boardKey(start), snapshot);
  assert.deepEqual(start.moves, []);
});

test("胜负判定：行、列、主对角、副对角", () => {
  const row = play(createState({ size: 3 }), 0, 3, 1, 4, 2);
  assert.equal(row.status, STATUS_WON);
  assert.equal(row.winner, PLAYER_X);
  assert.deepEqual(row.winLine, [0, 1, 2]);

  const col = play(createState({ size: 3 }), 1, 0, 4, 3, 7);
  assert.equal(col.status, STATUS_WON);
  assert.equal(col.winner, PLAYER_X);
  assert.deepEqual(col.winLine, [1, 4, 7]);

  const diag = play(createState({ size: 3 }), 0, 1, 4, 2, 8);
  assert.equal(diag.winner, PLAYER_X);
  assert.deepEqual(diag.winLine, [0, 4, 8]);

  const anti = play(createState({ size: 3 }), 2, 0, 4, 1, 6);
  assert.equal(anti.winner, PLAYER_X);
  assert.deepEqual(anti.winLine, [2, 4, 6]);
});

test("胜负判定：4x4 需要连满 4 子，连 3 不算", () => {
  const three = play(createState({ size: 4 }), 0, 4, 1, 5, 2);
  assert.equal(three.status, STATUS_PLAYING);
  const four = play(three, 8, 3);
  assert.equal(four.status, STATUS_WON);
  assert.equal(four.winner, PLAYER_X);
  assert.deepEqual(four.winLine, [0, 1, 2, 3]);
});

test("平局：填满且无连线", () => {
  // X O X / X O O / O X X
  const draw = play(createState({ size: 3 }), 0, 1, 2, 4, 3, 5, 7, 6, 8);
  assert.equal(draw.status, STATUS_DRAW);
  assert.equal(draw.winner, EMPTY);
  assert.equal(draw.current, EMPTY);
  assert.equal(draw.winLine, null);
});

test("终局后落子无效，current 清空", () => {
  const won = play(createState({ size: 3 }), 0, 3, 1, 4, 2);
  assert.equal(applyMove(won, 8), won);
  assert.equal(won.current, EMPTY);
});

test("legalMoves: 对局中返回空位，终局返回空数组", () => {
  const state = play(createState({ size: 3 }), 0, 1);
  assert.deepEqual(legalMoves(state), [2, 3, 4, 5, 6, 7, 8]);
  const won = play(state, 2, 3, 4, 5, 6);
  assert.equal(won.status, STATUS_WON);
  assert.deepEqual(legalMoves(won), []);
});

test("other 与先后手设置", () => {
  assert.equal(other(PLAYER_X), PLAYER_O);
  assert.equal(other(PLAYER_O), PLAYER_X);
  assert.equal(other(EMPTY), EMPTY);
  assert.equal(createState({ firstPlayer: PLAYER_O }).current, PLAYER_O);
});

test("replay: 从落子序列重建出相同局面，并静默跳过非法步", () => {
  const config = { size: 3, firstPlayer: PLAYER_X };
  const moves = [4, 0, 8, 2];
  assert.deepEqual(replay(config, moves).board, play(createState(config), ...moves).board);
  const dirty = replay(config, [4, 4, 99, 0, -1, 8]);
  assert.deepEqual(dirty.moves, [4, 0, 8]);
  assert.deepEqual(replay(config, []).board, createState(config).board);
});
