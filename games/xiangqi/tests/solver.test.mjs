// 求解器测试：杀距计分、确定性、预算兜底、关卡全量复核。
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as E from "../js/engine.mjs";
import { solve } from "../js/solver.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const puzzlesPath = resolve(here, "..", "js", "puzzles.mjs");

const B = (rows) => rows.join("");

// 双车错一步杀（引擎测试同款局面）
const MATE_IN_1 = E.parseBoard(B([
  "....k....",
  "R..P.P.R.",
  ".........",
  ".........",
  ".........",
  "...R.....",
  ".........",
  ".........",
  ".........",
  "...K.....",
]));

test("solve：一步杀局面返回 mateIn=1 且枚举全部杀着", () => {
  const result = solve(MATE_IN_1, E.RED, 5);
  assert.equal(result.solvable, true);
  assert.equal(result.mateIn, 1);
  assert.ok(result.winningMoves.length >= 2);
  assert.ok(result.winningMoves.some((m) => m.from === E.idx(5, 3) && m.to === E.idx(5, 4)));
  // 杀距口径自洽：mateIn=1 时首着走后黑方即无合法着法
  const next = E.applyMove(E.createState({ board: MATE_IN_1, turn: E.RED }), result.first);
  assert.equal(next.result.kind, E.RESULT_MATE);
});

test("solve：无杀局面 solvable=false（王仕象守和）", () => {
  const board = E.parseBoard(B([
    "..a.a.k..",
    ".........",
    ".........",
    ".........",
    ".........",
    ".........",
    ".........",
    ".........",
    ".........",
    "...K.....",
  ]));
  const result = solve(board, E.RED, 3);
  assert.equal(result.solvable, false);
});

test("solve：确定性 —— 同局面两次求解逐位相同", () => {
  const a = solve(MATE_IN_1, E.RED, 5);
  const b = solve(MATE_IN_1, E.RED, 5);
  assert.deepEqual(b, a);
});

test("solve：nodeBudget 兜底置 exceeded", () => {
  const board = E.parseBoard(E.START_BOARD);
  const result = solve(board, E.RED, 5, { nodeBudget: 50 });
  assert.equal(result.exceeded, true);
});

test("solve：黑方视角搜索（防守方求杀）", () => {
  // 黑车正面将军红方一步杀：红帅 (9,4) 孤王，黑车 (5,4)
  const board = E.parseBoard(B([
    "....k....",
    ".........",
    ".........",
    ".........",
    ".........",
    "....r....",
    ".........",
    ".........",
    ".........",
    "....K....",
  ]));
  const result = solve(board, E.BLACK, 3);
  assert.equal(result.solvable, true);
  assert.equal(result.mateIn, 1);
});

test("关卡全量复核：puzzles.mjs 每关重跑求解器", { skip: !existsSync(puzzlesPath) ? "puzzles.mjs 尚未生成" : false }, async () => {
  const { PUZZLES } = await import(`file://${puzzlesPath.replace(/\\/g, "/")}`);
  const keys = Object.keys(PUZZLES);
  assert.ok(keys.length >= 24, `关卡数不足 24：${keys.length}`);
  for (const key of keys) {
    const puzzle = PUZZLES[key];
    const board = E.parseBoard(puzzle.board);
    assert.ok(board, `${key} 棋谱无法解析`);
    const result = solve(board, E.RED, 5, { nodeBudget: 400000 });
    assert.equal(result.solvable, true, `${key} 不可解`);
    assert.equal(result.mateIn, puzzle.par, `${key} 杀距漂移`);
    assert.equal(result.winningMoves.length, 1, `${key} 首着不唯一`);
    assert.equal(result.winningMoves[0].from, puzzle.first[0], `${key} first.from 不符`);
    assert.equal(result.winningMoves[0].to, puzzle.first[1], `${key} first.to 不符`);
  }
});
