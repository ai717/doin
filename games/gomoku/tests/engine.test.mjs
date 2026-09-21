import test from "node:test";
import assert from "node:assert/strict";

import {
  BLACK, WHITE, EMPTY,
  SIZE, CELL_COUNT, WIN_LENGTH,
  STATUS_PLAYING, STATUS_WON, STATUS_FORBIDDEN, STATUS_DRAW,
  idx, rc, inBounds, other,
  lineShape, checkLineAt, classifyShape, isForbidden,
  candidateMoves, legalMoves,
  createState, applyMove, replay,
  evaluateBoard, PATTERN_SCORE,
} from "../js/engine.mjs";

const eq = assert.strictEqual;

test("坐标与索引互转一致", () => {
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const i = idx(r, c);
      eq(i, r * SIZE + c);
      const [rr, cc] = rc(i);
      eq(rr, r);
      eq(cc, c);
      eq(inBounds(r, c), true);
    }
  }
  eq(inBounds(-1, 0), false);
  eq(inBounds(0, SIZE), false);
});

test("other: 黑白互换，空返回空", () => {
  eq(other(BLACK), WHITE);
  eq(other(WHITE), BLACK);
  eq(other(EMPTY), EMPTY);
});

test("createState: 默认黑先手 + 全空盘 + tsumego=null", () => {
  const s = createState();
  eq(s.board.length, CELL_COUNT);
  eq(s.current, BLACK);
  eq(s.firstPlayer, BLACK);
  eq(s.status, STATUS_PLAYING);
  eq(s.winner, EMPTY);
  eq(s.moves.length, 0);
  eq(s.lastMove, -1);
  eq(s.tsumego, null);
  for (let i = 0; i < CELL_COUNT; i += 1) eq(s.board[i], EMPTY);
});

test("createState: preset 预落子正确放置", () => {
  const s = createState({
    preset: [
      { pos: idx(7, 7), player: BLACK },
      { pos: idx(7, 8), player: WHITE },
    ],
    firstPlayer: BLACK,
    current: BLACK,
  });
  eq(s.board[idx(7, 7)], BLACK);
  eq(s.board[idx(7, 8)], WHITE);
  eq(s.moves.length, 0);
  eq(s.current, BLACK);
});

test("createState: moves 序列重建棋面（用于 replay）", () => {
  const s = createState({
    firstPlayer: BLACK,
    moves: [idx(7, 7), idx(7, 8), idx(8, 8)],
  });
  eq(s.board[idx(7, 7)], BLACK);
  eq(s.board[idx(7, 8)], WHITE);
  eq(s.board[idx(8, 8)], BLACK);
  eq(s.moves.length, 3);
  eq(s.lastMove, idx(8, 8));
});

test("applyMove: 落子置位 + 切换回合 + 入 moves", () => {
  const s0 = createState();
  const s1 = applyMove(s0, idx(7, 7));
  assert.notStrictEqual(s1, s0);
  eq(s1.board[idx(7, 7)], BLACK);
  eq(s1.current, WHITE);
  eq(s1.moves.length, 1);
  eq(s1.lastMove, idx(7, 7));
  eq(s1.status, STATUS_PLAYING);

  const s2 = applyMove(s1, idx(7, 8));
  eq(s2.board[idx(7, 8)], WHITE);
  eq(s2.current, BLACK);
  eq(s2.moves.length, 2);
});

test("applyMove: 非法着法返回同一引用（同对象引用）", () => {
  const s0 = createState();
  // 越界
  assert.strictEqual(applyMove(s0, -1), s0);
  assert.strictEqual(applyMove(s0, CELL_COUNT), s0);
  assert.strictEqual(applyMove(s0, 999), s0);
  // 非整数
  assert.strictEqual(applyMove(s0, 7.5), s0);
  assert.strictEqual(applyMove(s0, "x"), s0);
  // 已落子位置
  const s1 = applyMove(s0, idx(7, 7));
  assert.strictEqual(applyMove(s1, idx(7, 7)), s1);
  // 终局后不可再落
  const won = createState({ preset: [
    { pos: idx(7, 5), player: BLACK }, { pos: idx(7, 6), player: BLACK },
    { pos: idx(7, 7), player: BLACK }, { pos: idx(7, 8), player: BLACK },
  ], current: BLACK });
  const w = applyMove(won, idx(7, 9));
  eq(w.status, STATUS_WON);
  assert.strictEqual(applyMove(w, idx(8, 8)), w);
});

test("checkLineAt: 横向五连制胜", () => {
  const board = new Array(CELL_COUNT).fill(EMPTY);
  for (let c = 5; c <= 8; c += 1) board[idx(7, c)] = BLACK;
  board[idx(7, 9)] = BLACK;
  const r = checkLineAt(board, 7, 9, BLACK);
  eq(r.win, true);
  eq(r.overline, false);
  assert.ok(r.line);
  eq(r.line.length, WIN_LENGTH);
});

test("checkLineAt: 黑方长连 (6+) 返回 overline", () => {
  const board = new Array(CELL_COUNT).fill(EMPTY);
  for (let c = 4; c <= 9; c += 1) board[idx(7, c)] = BLACK;
  // 6 子已在 (7,4)-(7,9)
  const r = checkLineAt(board, 7, 9, BLACK);
  eq(r.win, false);
  eq(r.overline, true);
  eq(r.line.length, 6);
});

test("checkLineAt: 白方长连同样返回 overline（外层判定白胜）", () => {
  const board = new Array(CELL_COUNT).fill(EMPTY);
  for (let c = 4; c <= 9; c += 1) board[idx(7, c)] = WHITE;
  const r = checkLineAt(board, 7, 9, WHITE);
  eq(r.overline, true);
  eq(r.win, false);
});

test("applyMove: 黑方五连 → STATUS_WON + winner=BLACK", () => {
  const s = createState({
    preset: [
      { pos: idx(7, 5), player: BLACK }, { pos: idx(7, 6), player: BLACK },
      { pos: idx(7, 7), player: BLACK }, { pos: idx(7, 8), player: BLACK },
    ],
    firstPlayer: BLACK,
    current: BLACK,
  });
  const w = applyMove(s, idx(7, 9));
  eq(w.status, STATUS_WON);
  eq(w.winner, BLACK);
  assert.ok(w.winLine);
  eq(w.winLine.length, 5);
});

test("applyMove: 黑方长连 → STATUS_FORBIDDEN + winner=WHITE", () => {
  // 黑方在 (7,3)-(7,8) 已有 5 子（活五），再落 (7,2) 形成长连？需要 5 子连续后再落
  // 实际：黑方在 (7,3)-(7,7) 5 子已五连，无法继续走。改用 (7,2)-(7,7) 共 6 子布局：
  // 预落 5 子（非五连形态），落第 6 子形成 6 连。
  // (7,2)(7,3)(7,4)(7,5)(7,6) 落 (7,7) → 6 连
  const s = createState({
    preset: [
      { pos: idx(7, 2), player: BLACK }, { pos: idx(7, 3), player: BLACK },
      { pos: idx(7, 4), player: BLACK }, { pos: idx(7, 5), player: BLACK },
      { pos: idx(7, 6), player: BLACK },
      { pos: idx(8, 8), player: WHITE }, // 白方一手避免提前终局
    ],
    firstPlayer: BLACK,
    current: BLACK,
  });
  const w = applyMove(s, idx(7, 7));
  eq(w.status, STATUS_FORBIDDEN);
  eq(w.winner, WHITE);
});

test("applyMove: 白方长连 → STATUS_WON + winner=WHITE（白无禁手）", () => {
  const s = createState({
    preset: [
      { pos: idx(7, 2), player: WHITE }, { pos: idx(7, 3), player: WHITE },
      { pos: idx(7, 4), player: WHITE }, { pos: idx(7, 5), player: WHITE },
      { pos: idx(7, 6), player: WHITE },
      { pos: idx(8, 8), player: BLACK },
    ],
    firstPlayer: WHITE,
    current: WHITE,
  });
  const w = applyMove(s, idx(7, 7));
  eq(w.status, STATUS_WON);
  eq(w.winner, WHITE);
});

test("isForbidden: 黑方双活三 = 三三禁手", () => {
  // 黑方一子同时形成横向活三 + 纵向活三
  // 横向活三：黑在 (7,6)(7,7)(7,8)（两端空） → 活三
  // 纵向活三：黑在 (5,7)(6,7)(7,7) → (7,7) 共用，需 (7,7) 的新落子使两条线各成活三
  // 预设：(7,6)(7,8) + (5,7)(6,7)，落 (7,7) → 横向 (7,6)(7,7)(7,8) 活三，纵向 (5,7)(6,7)(7,7) 活三
  const board = new Array(CELL_COUNT).fill(EMPTY);
  board[idx(7, 6)] = BLACK;
  board[idx(7, 8)] = BLACK;
  board[idx(5, 7)] = BLACK;
  board[idx(6, 7)] = BLACK;
  // 落 (7,7)
  board[idx(7, 7)] = BLACK;
  eq(isForbidden(board, 7, 7, BLACK), true);
});

test("isForbidden: 黑方双四 = 四四禁手", () => {
  // 双四：一子同时形成两个四（含活四/冲四）
  // 横向：黑 (7,5)(7,6)(7,7) + 新落 (7,8) → 横向 4 连活四
  // 纵向：黑 (4,8)(5,8)(6,8) + 新落 (7,8) → 纵向 4 连活四
  const board = new Array(CELL_COUNT).fill(EMPTY);
  board[idx(7, 5)] = BLACK;
  board[idx(7, 6)] = BLACK;
  board[idx(7, 7)] = BLACK;
  board[idx(4, 8)] = BLACK;
  board[idx(5, 8)] = BLACK;
  board[idx(6, 8)] = BLACK;
  board[idx(7, 8)] = BLACK; // 新落子，纵向 4 连 + 横向 4 连
  eq(isForbidden(board, 7, 8, BLACK), true);
});

test("isForbidden: 白方永不禁手", () => {
  const board = new Array(CELL_COUNT).fill(EMPTY);
  board[idx(7, 6)] = WHITE;
  board[idx(7, 8)] = WHITE;
  board[idx(5, 7)] = WHITE;
  board[idx(6, 7)] = WHITE;
  board[idx(7, 7)] = WHITE;
  eq(isForbidden(board, 7, 7, WHITE), false);
});

test("lineShape: 单子 count=1", () => {
  const board = new Array(CELL_COUNT).fill(EMPTY);
  board[idx(7, 7)] = BLACK;
  const sh = lineShape(board, 7, 7, 0, 1, BLACK);
  eq(sh.count, 1);
  eq(sh.openEnds, 2);
});

test("lineShape: 双开放活三", () => {
  const board = new Array(CELL_COUNT).fill(EMPTY);
  board[idx(7, 6)] = BLACK;
  board[idx(7, 7)] = BLACK;
  board[idx(7, 8)] = BLACK;
  const sh = lineShape(board, 7, 7, 0, 1, BLACK);
  eq(sh.count, 3);
  eq(sh.openEnds, 2);
});

test("lineShape: 双堵眠三", () => {
  const board = new Array(CELL_COUNT).fill(EMPTY);
  board[idx(7, 5)] = WHITE; // 堵一头
  board[idx(7, 6)] = BLACK;
  board[idx(7, 7)] = BLACK;
  board[idx(7, 8)] = BLACK;
  board[idx(7, 9)] = WHITE; // 堵另一头
  const sh = lineShape(board, 7, 7, 0, 1, BLACK);
  eq(sh.count, 3);
  eq(sh.openEnds, 0);
});

test("candidateMoves: 空盘返回天元", () => {
  const s = createState();
  const moves = candidateMoves(s);
  eq(moves.length, 1);
  eq(moves[0], idx(7, 7));
});

test("candidateMoves: 仅考虑 ≤2 格邻域", () => {
  const s = createState({ firstPlayer: BLACK, moves: [idx(7, 7)] });
  const moves = candidateMoves(s);
  // 7,7 周围 5×5 减自身 = 24
  eq(moves.length, 24);
  for (const m of moves) {
    const [r, c] = rc(m);
    const dist = Math.max(Math.abs(r - 7), Math.abs(c - 7));
    assert.ok(dist <= 2 && dist >= 1);
  }
});

test("legalMoves: 终局返回空数组", () => {
  const won = createState({
    preset: [
      { pos: idx(7, 5), player: BLACK }, { pos: idx(7, 6), player: BLACK },
      { pos: idx(7, 7), player: BLACK }, { pos: idx(7, 8), player: BLACK },
    ],
    current: BLACK,
  });
  const w = applyMove(won, idx(7, 9));
  eq(legalMoves(w).length, 0);
});

test("replay: 跳过非法步不抛错", () => {
  const s = replay({ firstPlayer: BLACK, moves: [idx(7, 7), idx(7, 8), -1, 999, "x", idx(8, 8)] });
  eq(s.board[idx(7, 7)], BLACK);
  eq(s.board[idx(7, 8)], WHITE);
  eq(s.board[idx(8, 8)], BLACK);
  eq(s.moves.length, 3);
});

test("replay: 重建已胜利状态", () => {
  const s = replay({
    firstPlayer: BLACK,
    moves: [idx(7, 5), idx(0, 0), idx(7, 6), idx(0, 1), idx(7, 7), idx(0, 2), idx(7, 8), idx(0, 3), idx(7, 9)],
  });
  eq(s.status, STATUS_WON);
  eq(s.winner, BLACK);
});

test("evaluateBoard: 空盘为 0", () => {
  const board = new Array(CELL_COUNT).fill(EMPTY);
  eq(evaluateBoard(board, BLACK), 0);
});

test("evaluateBoard: 黑方活三有正分", () => {
  const board = new Array(CELL_COUNT).fill(EMPTY);
  board[idx(7, 6)] = BLACK;
  board[idx(7, 7)] = BLACK;
  board[idx(7, 8)] = BLACK;
  const score = evaluateBoard(board, BLACK);
  assert.ok(score > 0, `score should be positive, got ${score}`);
});

test("evaluateBoard: 黑白对称局 = 0", () => {
  const board = new Array(CELL_COUNT).fill(EMPTY);
  board[idx(7, 6)] = BLACK;
  board[idx(8, 6)] = WHITE;
  const score = evaluateBoard(board, BLACK);
  // 两人对称贡献，分值近似抵消（不一定精确为 0，但应很小）
  assert.ok(Math.abs(score) < 50, `symmetric score should be small, got ${score}`);
});

test("PATTERN_SCORE: 关键分值梯度合理", () => {
  eq(PATTERN_SCORE.FIVE, 100000);
  eq(PATTERN_SCORE.OPEN_FOUR, 10000);
  eq(PATTERN_SCORE.FOUR, 1000);
  eq(PATTERN_SCORE.OPEN_THREE, 200);
  assert.ok(PATTERN_SCORE.FIVE > PATTERN_SCORE.OPEN_FOUR);
  assert.ok(PATTERN_SCORE.OPEN_FOUR > PATTERN_SCORE.FOUR);
  assert.ok(PATTERN_SCORE.FOUR > PATTERN_SCORE.OPEN_THREE);
});

test("大步数随机走子不抛错（≥200 步）", () => {
  // 用确定性 PRNG 验证状态机稳健性
  let seed = 12345;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 0x100000000;
    return seed / 0x100000000;
  };
  let s = createState({ firstPlayer: BLACK });
  for (let step = 0; step < 200; step += 1) {
    const moves = legalMoves(s);
    if (moves.length === 0) break;
    if (s.status !== STATUS_PLAYING) break;
    const m = moves[Math.floor(rng() * moves.length)];
    const next = applyMove(s, m);
    if (next === s) continue; // 跳过禁手等无效着
    s = next;
    // 不变式：状态字段齐全
    assert.ok(s.board.length === CELL_COUNT);
    assert.ok([STATUS_PLAYING, STATUS_WON, STATUS_FORBIDDEN, STATUS_DRAW].includes(s.status));
  }
});

test("classifyShape: 返回结构正确", () => {
  const board = new Array(CELL_COUNT).fill(EMPTY);
  board[idx(7, 7)] = BLACK;
  const sh = classifyShape(board, 7, 7, BLACK);
  assert.ok("fours" in sh);
  assert.ok("openThrees" in sh);
  assert.ok("overline" in sh);
  eq(sh.fours, 0);
  eq(sh.openThrees, 0);
  eq(sh.overline, false);
});
