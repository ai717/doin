import test from "node:test";
import assert from "node:assert/strict";

import {
  OUTCOME_WIN, OUTCOME_LOSS, OUTCOME_DRAW,
  tsumegoStars, isTsumegoSolved,
  emptyCount, movesPlayed,
} from "../js/score.mjs";
import { createState, applyMove, BLACK, WHITE, STATUS_WON, idx } from "../js/engine.mjs";

const eq = assert.strictEqual;

test("常量定义", () => {
  eq(OUTCOME_WIN, "win");
  eq(OUTCOME_LOSS, "loss");
  eq(OUTCOME_DRAW, "draw");
});

test("tsumegoStars: 未解出 = 0 星", () => {
  eq(tsumegoStars(false, 5, 5, false), 0);
  eq(tsumegoStars(false, 1, 1, false), 0);
  eq(tsumegoStars(false, 99, 5, true), 0);
});

test("tsumegoStars: 解出 + 步数 ≤ par + 无错着 = 3 星", () => {
  eq(tsumegoStars(true, 5, 5, false), 3);
  eq(tsumegoStars(true, 1, 1, false), 3);
  eq(tsumegoStars(true, 3, 5, false), 3); // 步数少于 par 也算 3 星
});

test("tsumegoStars: 解出 + 步数 ≤ par + 有错着 = 2 星", () => {
  // 有错着重选 → 不能 3 星，但 ≤ par 仍 2 星
  eq(tsumegoStars(true, 5, 5, true), 2);
  eq(tsumegoStars(true, 1, 1, true), 2);
});

test("tsumegoStars: 解出 + 步数 ≤ par+2 = 2 星", () => {
  eq(tsumegoStars(true, 7, 5, false), 2);
  eq(tsumegoStars(true, 5, 3, false), 2);
});

test("tsumegoStars: 解出 + 步数 > par+2 = 1 星", () => {
  eq(tsumegoStars(true, 10, 5, false), 1);
  eq(tsumegoStars(true, 5, 1, false), 1);
});

test("isTsumegoSolved: 无 tsumego 返回 false", () => {
  const s = createState();
  eq(isTsumegoSolved(s, null), false);
});

test("isTsumegoSolved: 五连胜 + winner=firstPlayer + 步数足够 → true", () => {
  const preset = [
    { pos: idx(7, 5), player: BLACK }, { pos: idx(7, 6), player: BLACK },
    { pos: idx(7, 7), player: BLACK }, { pos: idx(7, 8), player: BLACK },
  ];
  const s = createState({ preset, firstPlayer: BLACK, current: BLACK });
  const w = applyMove(s, idx(7, 9));
  // preset 共 4 子，玩家落 1 子 → movesUsed=1
  // presetMovesCount=4, parMoves=1 → moves.length - presetMovesCount = 1 ≤ parMoves
  const tsumego = { firstPlayer: BLACK, presetMovesCount: 4, parMoves: 1 };
  eq(isTsumegoSolved(w, tsumego), true);
});

test("emptyCount: 空盘 = 225", () => {
  const s = createState();
  eq(emptyCount(s), 225);
});

test("emptyCount: 落子后减少", () => {
  const s = createState({ firstPlayer: BLACK, moves: [idx(7, 7), idx(7, 8)] });
  eq(emptyCount(s), 223);
});

test("movesPlayed: 落子数计数", () => {
  const s = createState();
  eq(movesPlayed(s), 0);
  const s2 = createState({ firstPlayer: BLACK, moves: [idx(7, 7), idx(7, 8), idx(8, 8)] });
  eq(movesPlayed(s2), 3);
});
