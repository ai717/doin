import test from "node:test";
import assert from "node:assert/strict";

import {
  BLACK, WHITE, EMPTY, CELL_COUNT,
  other, legalMoves, countDiscs, finalScore, createState, applyMove,
  STATUS_PLAYING, standardBoard, emptyBoard, indexOf,
} from "../js/engine.mjs";
import {
  INF, PERFECT_LIMIT, finalDiff, emptyCount, solve, solveExact, isOptimalMove,
  diffAfterMove, canSolvePerfectly, leadSide,
} from "../js/solver.mjs";

const eq = assert.strictEqual;
const de = assert.deepStrictEqual;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 参照实现：全窗口、无剪枝、无置换表、无着法排序。
// 它的唯一价值是"慢但显然正确"，用来给生产求解器当标尺。
// 仅在空位数 ≤ 7 时使用（代价随空位数阶乘增长）。
function naiveSolve(board, player) {
  const moves = legalMoves(board, player);
  if (moves.length === 0) {
    if (legalMoves(board, other(player)).length === 0) return { score: finalDiff(board, player), moves: [] };
    const passed = naiveSolve(board, other(player));
    return { score: -passed.score, moves: [] };
  }
  const values = [];
  for (const move of moves) {
    const child = applyMoveTo(board, move, player);
    const childResult = naiveSolve(child, other(player));
    values.push({ move, score: -childResult.score });
  }
  const best = Math.max(...values.map((v) => v.score));
  return { score: best, moves: values.filter((v) => v.score === best).map((v) => v.move).sort((a, b) => a - b) };
}

function applyMoveTo(board, index, player) {
  const next = board.slice();
  next[index] = player;
  for (const cell of flipsOf(board, index, player)) next[cell] = player;
  return next;
}

function flipsOf(board, index, player) {
  const out = [];
  const [row, col] = [Math.floor(index / 8), index % 8];
  const foe = other(player);
  for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
    const run = [];
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === foe) {
      run.push(r * 8 + c);
      r += dr;
      c += dc;
    }
    if (run.length && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === player) out.push(...run);
  }
  return out;
}

// 随机走到指定空位数，作为被测局面来源（确定性种子）。
function positionWithEmpties(seed, target) {
  const rng = mulberry32(seed);
  let state = createState();
  let guard = 0;
  while (state.status === STATUS_PLAYING && countDiscs(state.board).empty > target && guard < 300) {
    guard += 1;
    const moves = legalMoves(state.board, state.current);
    state = applyMove(state, moves[Math.floor(rng() * moves.length)]);
  }
  return state;
}

// ─── 基础工具 ─────────────────────────────────────────────────────
test("finalDiff: 已按 WOF 把余空判给胜方", () => {
  const board = emptyBoard();
  for (let i = 0; i < 40; i += 1) board[i] = BLACK;
  for (let i = 40; i < 62; i += 1) board[i] = WHITE;
  eq(finalDiff(board, BLACK), 42 - 22);
  eq(finalDiff(board, WHITE), -(42 - 22));
});

test("emptyCount / canSolvePerfectly / leadSide", () => {
  eq(emptyCount(standardBoard()), 60);
  eq(canSolvePerfectly(standardBoard()), false);
  const nearlyDone = new Array(CELL_COUNT).fill(BLACK);
  nearlyDone[0] = EMPTY;
  eq(emptyCount(nearlyDone), 1);
  eq(canSolvePerfectly(nearlyDone), true);
  eq(leadSide(nearlyDone), BLACK);
  assert.ok(PERFECT_LIMIT >= 12 && PERFECT_LIMIT <= 16);
  eq(INF > 10000, true);
});

// ─── 已手工验算的小局面 ───────────────────────────────────────────
test("求解：只剩 1 空位时，分数等于直接落子的终局差", () => {
  const board = new Array(CELL_COUNT).fill(BLACK);
  board[indexOf(3, 3)] = WHITE;
  board[indexOf(3, 4)] = EMPTY; // 黑落此处翻转 (3,3)
  const result = solve(board, BLACK);
  eq(result.moves.length, 1);
  eq(result.moves[0], indexOf(3, 4));
  de(finalScore(applyMoveTo(board, indexOf(3, 4), BLACK)), { black: 64, white: 0 });
  eq(result.score, 64);
});

test("求解：满盘终局返回盘面子差且无首手", () => {
  const board = emptyBoard();
  for (let i = 0; i < 30; i += 1) board[i] = BLACK;
  for (let i = 30; i < CELL_COUNT; i += 1) board[i] = WHITE;
  const result = solve(board, BLACK);
  de(result.moves, []);
  eq(result.score, 30 - 34);
  eq(result.nodes, 0);
});

test("求解：行棋方无子可下时让位给对手，分数取反", () => {
  // 全黑盘面，只有一处白子被两枚空格夹住：白方无任何着法，黑方有。
  const board = new Array(CELL_COUNT).fill(BLACK);
  board[indexOf(4, 4)] = WHITE;
  board[indexOf(4, 5)] = EMPTY;
  board[indexOf(4, 6)] = EMPTY;
  eq(legalMoves(board, WHITE).length, 0);
  assert.ok(legalMoves(board, BLACK).length > 0);

  const whiteResult = solve(board, WHITE);
  de(whiteResult.moves, []);
  eq(whiteResult.score, -64); // 黑落 (4,5) 翻掉唯一白子后 64:0

  const blackResult = solve(board, BLACK);
  eq(blackResult.score, 64);
  assert.ok(blackResult.moves.includes(indexOf(4, 5)));
});

test("求解：返回的全部最优首手，逐个复算都等于最优分", () => {
  const state = positionWithEmpties(2026, 9);
  const result = solveExact(state.board, state.current);
  assert.ok(result.moves.length >= 1);
  for (const move of result.moves) {
    const child = applyMoveTo(state.board, move, state.current);
    const after = solveExact(child, other(state.current));
    eq(-after.score, result.score, `首手 ${move} 的终局分与最优分不符`);
  }
  // 非最优首手不得混入
  const all = legalMoves(state.board, state.current);
  for (const move of all) {
    if (result.moves.includes(move)) continue;
    const after = solveExact(applyMoveTo(state.board, move, state.current), other(state.current));
    assert.ok(-after.score < result.score, `非最优着法 ${move} 被误判为最优`);
  }
});

// ─── 与参照实现交叉验证（正确性的核心护栏）───────────────────────
test("交叉验证：空位 6-7 的随机局面，求解器与朴素参照实现完全一致（分数 + 最优首手集合）", () => {
  let checked = 0;
  for (let seed = 1; seed <= 24; seed += 1) {
    const target = seed % 2 === 0 ? 7 : 6;
    const state = positionWithEmpties(seed * 7919, target);
    if (countDiscs(state.board).empty > 7) continue;

    const mine = solveExact(state.board, state.current);
    const reference = naiveSolve(state.board, state.current);
    eq(mine.score, reference.score, `seed=${seed} 分数不一致`);
    de(mine.moves, reference.moves, `seed=${seed} 最优首手集合不一致`);
    checked += 1;
  }
  assert.ok(checked >= 12, `有效样本过少：${checked}`);
});

// 根节点让位：applyMove 会在内部自动 settle，因此"行棋方无子可下"的盘面
// 只能由手工构造的盘面直接喂给求解器，随机游走永远走不到这个状态。
//
// 构造法（两个方向互为镜像）：整盘填满被动色，主动色只留一枚孤子 (4,1)，
// 其右侧一整行挖空 —— 主动色任何落点都凑不出"异色串 + 同色锚点"，
// 而被动色从 (4,2) 落子即可夹住这枚孤子，保证"一方让位、另一方仍有子可下"。
test("交叉验证：根节点让位局面 —— 无子可下一方得 0 首手，分数等于对手最优值的取反", () => {
  const holes = [[4, 2], [4, 3], [4, 4], [4, 5], [4, 6], [4, 7]];
  const cases = [
    { fill: BLACK, loneColor: WHITE, label: "白方让位" },
    { fill: WHITE, loneColor: BLACK, label: "黑方让位" },
  ];
  for (const item of cases) {
    const board = new Array(CELL_COUNT).fill(item.fill);
    board[indexOf(4, 1)] = item.loneColor;
    for (const [r, c] of holes) board[indexOf(r, c)] = EMPTY;

    eq(countDiscs(board).empty, 6, `${item.label} 空位数`);
    eq(legalMoves(board, item.loneColor).length, 0, `${item.label} 应当无子可下`);
    assert.ok(legalMoves(board, other(item.loneColor)).length > 0, `${item.label} 对手必须仍有子可下`);

    const mine = solveExact(board, item.loneColor);
    const reference = naiveSolve(board, item.loneColor);
    de(mine.moves, [], `${item.label} 让位方不得有任何首手`);
    de(mine.moves, reference.moves, `${item.label} 参照实现首手不一致`);
    eq(mine.score, reference.score, `${item.label} 分数与参照实现不一致`);

    // 分数必须等于"对手先手最优值"的取反
    const foeBest = solveExact(board, other(item.loneColor)).score;
    eq(mine.score, -foeBest, `${item.label} 分数不等于对手最优值取反`);
  }
});

test("交叉验证：空位 8 的局面同样一致", () => {
  for (let seed = 100; seed < 108; seed += 1) {
    const state = positionWithEmpties(seed * 104729, 8);
    if (countDiscs(state.board).empty !== 8) continue;
    const mine = solveExact(state.board, state.current);
    const reference = naiveSolve(state.board, state.current);
    eq(mine.score, reference.score, `seed=${seed} 分数不一致`);
    de(mine.moves, reference.moves, `seed=${seed} 最优首手集合不一致`);
  }
});

// ─── 确定性与接口契约 ─────────────────────────────────────────────
test("确定性：同一局面重复求解结果完全一致（严禁 Math.random）", () => {
  const state = positionWithEmpties(424242, 11);
  const a = solveExact(state.board, state.current);
  const b = solveExact(state.board, state.current);
  eq(a.score, b.score);
  de(a.moves, b.moves);
  eq(a.nodes, b.nodes); // 节点数也必须一致，否则说明搜索路径受随机影响
});

test("solveExact 不修改入参盘面", () => {
  const state = positionWithEmpties(555, 10);
  const snapshot = state.board.slice();
  solveExact(state.board, state.current);
  de(state.board, snapshot);
});

test("solve 的便捷封装：unique 标记与 moves 长度一致", () => {
  const state = positionWithEmpties(31337, 10);
  const result = solve(state.board, state.current);
  eq(result.unique, result.moves.length === 1);
  assert.ok(result.nodes > 0);
});

test("isOptimalMove：正解为 true，明显劣着为 false", () => {
  const state = positionWithEmpties(2024, 9);
  const { moves } = solveExact(state.board, state.current);
  for (const move of moves) eq(isOptimalMove(state.board, state.current, move), true);
  const all = legalMoves(state.board, state.current);
  const losers = all.filter((m) => !moves.includes(m));
  if (losers.length > 0) eq(isOptimalMove(state.board, state.current, losers[0]), false);
});

test("diffAfterMove：非法着法返回 null，合法着法返回精确终局分", () => {
  const state = positionWithEmpties(8888, 9);
  const occupied = state.board.findIndex((v) => v !== EMPTY);
  eq(diffAfterMove(state.board, state.current, occupied), null);
  const moves = legalMoves(state.board, state.current);
  const value = diffAfterMove(state.board, state.current, moves[0]);
  assert.ok(Number.isInteger(value));
  const after = solveExact(applyMoveTo(state.board, moves[0], state.current), other(state.current));
  eq(value, -after.score);
});

// ─── 性能上界（保证网页端与题库产线都跑得动）─────────────────────
test("性能上界：空位 12 的局面求解在 2 秒内完成", () => {
  const state = positionWithEmpties(777, 12);
  const started = Date.now();
  const result = solveExact(state.board, state.current);
  const elapsed = Date.now() - started;
  assert.ok(Number.isInteger(result.score));
  assert.ok(elapsed < 2000, `空位 12 求解耗时 ${elapsed}ms，超出上界`);
});

test("性能上界：PERFECT_LIMIT 规定的最大空位数求解在 8 秒内完成", () => {
  const state = positionWithEmpties(24680, PERFECT_LIMIT);
  const started = Date.now();
  const result = solveExact(state.board, state.current);
  const elapsed = Date.now() - started;
  assert.ok(Number.isInteger(result.score));
  assert.ok(elapsed < 8000, `空位 ${PERFECT_LIMIT} 求解耗时 ${elapsed}ms，超出上界`);
});

test("求解器在小空位下必须极快：空位 8 的局面 200ms 内返回", () => {
  const state = positionWithEmpties(1123, 8);
  const started = Date.now();
  solveExact(state.board, state.current);
  assert.ok(Date.now() - started < 200);
});
