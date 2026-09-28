import test from "node:test";
import assert from "node:assert/strict";

import {
  SIZE, CELL_COUNT, EMPTY, BLACK, WHITE,
  STATUS_PLAYING, STATUS_OVER, DIRS,
  indexOf, rowCol, inBounds, other, cellName,
  emptyBoard, standardBoard, parseBoard, formatBoard,
  flipLines, flipsFor, isLegalMove, legalMoves,
  countDiscs, finalScore, winnerOf,
  createState, applyMove, settle, boardKey, replay,
  isCorner, isXSquare, isCSquare, squareKind, stableSet, stableCounts,
  CORNER_INDICES, RULES_WOF, RULES_CLASSIC, isRuleSet,
} from "../js/engine.mjs";

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

// ─── 常量与坐标 ───────────────────────────────────────────────────
test("棋盘常量：8×8 = 64 格，黑先白后", () => {
  eq(SIZE, 8);
  eq(CELL_COUNT, 64);
  eq(EMPTY, 0);
  eq(BLACK, 1);
  eq(WHITE, 2);
});

test("DIRS 恰为八向、无重复、无零向量，且顺序固定（波次动画依赖）", () => {
  eq(DIRS.length, 8);
  const seen = new Set(DIRS.map(([r, c]) => `${r},${c}`));
  eq(seen.size, 8);
  for (const [r, c] of DIRS) {
    assert.ok(Math.abs(r) <= 1 && Math.abs(c) <= 1);
    assert.ok(r !== 0 || c !== 0);
  }
  de(DIRS[0], [-1, -1]);
  de(DIRS[7], [1, 1]);
});

test("indexOf / rowCol 互逆", () => {
  for (let i = 0; i < CELL_COUNT; i += 1) {
    const [r, c] = rowCol(i);
    eq(indexOf(r, c), i);
  }
  eq(indexOf(0, 0), 0);
  eq(indexOf(7, 7), 63);
  eq(indexOf(4, 3), 35);
});

test("inBounds 边界判定", () => {
  eq(inBounds(0, 0), true);
  eq(inBounds(7, 7), true);
  eq(inBounds(-1, 0), false);
  eq(inBounds(0, 8), false);
  eq(inBounds(8, 0), false);
});

test("other: 黑白互转，空返回空", () => {
  eq(other(BLACK), WHITE);
  eq(other(WHITE), BLACK);
  eq(other(EMPTY), EMPTY);
});

test("cellName: a1-h8 国际记法", () => {
  eq(cellName(indexOf(0, 0)), "a1");
  eq(cellName(indexOf(7, 7)), "h8");
  eq(cellName(indexOf(2, 3)), "d3");
  eq(cellName(indexOf(4, 5)), "f5");
});

// ─── 盘面构造 ─────────────────────────────────────────────────────
test("标准开局：白占主对角线 d4/e5，黑占副对角线 d5/e4，黑先", () => {
  const board = standardBoard();
  eq(board[indexOf(3, 3)], WHITE); // d4
  eq(board[indexOf(4, 4)], WHITE); // e5
  eq(board[indexOf(3, 4)], BLACK); // e4
  eq(board[indexOf(4, 3)], BLACK); // d5
  const d = countDiscs(board);
  de(d, { black: 2, white: 2, empty: 60 });

  const state = createState();
  eq(state.current, BLACK);
  eq(state.status, STATUS_PLAYING);
  eq(state.moves.length, 0);
});

test("标准开局黑方恰有 4 个合法着法：d3 / c4 / f5 / e6", () => {
  const board = standardBoard();
  const moves = legalMoves(board, BLACK);
  de(moves, [indexOf(2, 3), indexOf(3, 2), indexOf(4, 5), indexOf(5, 4)]);
  eq(moves.length, 4);
  // 白方开局同样 4 个
  eq(legalMoves(board, WHITE).length, 4);
});

test("parseBoard / formatBoard 往返一致，非法输入返回 null", () => {
  const board = standardBoard();
  const text = formatBoard(board);
  eq(text.length, 64);
  de(parseBoard(text), board);
  eq(parseBoard("B".repeat(63)), null);
  eq(parseBoard("X".repeat(64)), null);
  eq(parseBoard(null), null);
  eq(parseBoard(123), null);
});

test("permissive 解析：小写 b/w 也接受", () => {
  const text = "b" + "w".repeat(63);
  const board = parseBoard(text);
  eq(board[0], BLACK);
  eq(board[1], WHITE);
});

// ─── 夹击扫描 ─────────────────────────────────────────────────────
test("flipLines: 单方向夹击返回一条线，序列自落点向外", () => {
  const board = emptyBoard();
  board[indexOf(0, 0)] = BLACK;
  board[indexOf(0, 1)] = WHITE;
  board[indexOf(0, 2)] = WHITE;
  const lines = flipLines(board, indexOf(0, 3), BLACK);
  eq(lines.length, 1);
  de(lines[0], [indexOf(0, 2), indexOf(0, 1)]);
  de(flipsFor(board, indexOf(0, 3), BLACK), [indexOf(0, 2), indexOf(0, 1)]);
});

test("flipLines: 单枚对手也成立，两枚不成线则非法", () => {
  const board = emptyBoard();
  board[indexOf(0, 0)] = BLACK;
  board[indexOf(0, 1)] = WHITE;
  eq(flipLines(board, indexOf(0, 2), BLACK).length, 1);

  const lonely = emptyBoard();
  lonely[indexOf(0, 1)] = WHITE; // 无己方封口
  eq(flipLines(lonely, indexOf(0, 2), BLACK).length, 0);
});

test("flipLines: 中间夹着己方棋子则不算夹击", () => {
  const board = emptyBoard();
  board[indexOf(0, 0)] = BLACK;
  board[indexOf(0, 1)] = WHITE;
  board[indexOf(0, 2)] = BLACK;
  eq(flipLines(board, indexOf(0, 3), BLACK).length, 0);
});

test("flipLines: 已占格 / 越界 / 非法行棋方一律返回空", () => {
  const board = emptyBoard();
  board[indexOf(0, 0)] = BLACK;
  board[indexOf(0, 1)] = WHITE;
  eq(flipLines(board, indexOf(0, 1), BLACK).length, 0);
  eq(flipLines(board, -1, BLACK).length, 0);
  eq(flipLines(board, 64, BLACK).length, 0);
  eq(flipLines(board, 1.5, BLACK).length, 0);
  eq(flipLines(board, indexOf(0, 2), EMPTY).length, 0);
});

test("flipLines: 八向同时夹击可返回多条线", () => {
  const board = emptyBoard();
  const [r, c] = [4, 4];
  const shooter = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1],
  ];
  for (const [dr, dc] of shooter) {
    board[indexOf(r + dr, c + dc)] = WHITE;
    board[indexOf(r + dr * 2, c + dc * 2)] = BLACK;
  }
  const lines = flipLines(board, indexOf(r, c), BLACK);
  eq(lines.length, 8);
  for (const line of lines) eq(line.length, 1);
  eq(flipsFor(board, indexOf(r, c), BLACK).length, 8);
});

// ─── 落子与不可变性 ───────────────────────────────────────────────
test("applyMove: 合法落子翻转整条线并换手", () => {
  const state = createState();
  const next = applyMove(state, indexOf(2, 3)); // d3，翻转 d4
  assert.notStrictEqual(next, state);
  eq(next.board[indexOf(2, 3)], BLACK);
  eq(next.board[indexOf(3, 3)], BLACK); // d4 被翻
  eq(next.board[indexOf(4, 4)], WHITE); // e5 未被翻
  eq(next.current, WHITE);
  eq(next.lastMove, indexOf(2, 3));
  de(next.lastFlips, [indexOf(3, 3)]);
  const d = countDiscs(next.board);
  de(d, { black: 4, white: 1, empty: 59 });
});

test("applyMove: 非法着法返回同一引用（静默忽略，严禁伪造失败）", () => {
  const state = createState();
  eq(applyMove(state, indexOf(0, 0)), state); // 空角无夹击
  eq(applyMove(state, indexOf(3, 3)), state); // 已占格
  eq(applyMove(state, -1), state);
  eq(applyMove(state, 64), state);
  eq(applyMove(state, "3"), state);
  eq(applyMove(state, null), state);
});

test("applyMove: 不可变 —— 原 state 与其 board 均未被修改", () => {
  const state = createState();
  const snapshot = state.board.slice();
  applyMove(state, indexOf(2, 3));
  eq(state.current, BLACK);
  eq(state.moves.length, 0);
  de(state.board, snapshot);
});

test("move 记录携带每手的黑白色子数（子数曲线的数据来源）", () => {
  let state = createState();
  state = applyMove(state, indexOf(2, 3));
  state = applyMove(state, indexOf(2, 2));
  eq(state.moves.length, 2);
  eq(state.moves[0].player, BLACK);
  de([state.moves[0].black, state.moves[0].white], [4, 1]);
  eq(state.moves[1].player, WHITE);
  for (const move of state.moves) {
    assert.ok(move.flips.length >= 1);
    assert.ok(move.lines.length >= 1);
  }
});

test("boardKey 随盘面变化，且同盘面稳定可复现", () => {
  const a = createState();
  const b = createState();
  eq(boardKey(a), boardKey(b));
  eq(boardKey(a).length, 64);
  const c = applyMove(a, indexOf(2, 3));
  assert.notStrictEqual(boardKey(c), boardKey(a));
});

test("replay: 按 moves 序列复现局面与轮次", () => {
  const state = createState({ moves: [indexOf(2, 3), indexOf(2, 2), indexOf(2, 1)] });
  eq(state.moves.length, 3);
  eq(state.current, WHITE); // 三手之后轮到白方
  eq(state.board[indexOf(2, 3)], BLACK);
  eq(state.board[indexOf(2, 2)], BLACK); // 第三手把白 (2,2) 翻掉
  eq(state.board[indexOf(2, 1)], BLACK);
  eq(state.status, STATUS_PLAYING);
});

// ─── WOF 终局结算 ─────────────────────────────────────────────────
test("finalScore: 盘面落满时原样返回", () => {
  const board = new Array(CELL_COUNT).fill(BLACK);
  de(finalScore(board), { black: 64, white: 0 });
});

test("finalScore: WOF 空位全归子多的一方", () => {
  const board = emptyBoard();
  for (let i = 0; i < 40; i += 1) board[i] = BLACK;
  for (let i = 40; i < 62; i += 1) board[i] = WHITE;
  // 62 格已占（黑 40 / 白 22），余 2 空位
  de(finalScore(board), { black: 42, white: 22 });
  eq(winnerOf(board), BLACK);

  const reversed = board.map((v) => (v === BLACK ? WHITE : v === WHITE ? BLACK : v));
  de(finalScore(reversed), { black: 22, white: 42 });
  eq(winnerOf(reversed), WHITE);
});

test("finalScore: 平局且有余空时空位不归属（总数 < 64，判和）", () => {
  const board = emptyBoard();
  for (let i = 0; i < 31; i += 1) board[i] = BLACK;
  for (let i = 31; i < 62; i += 1) board[i] = WHITE;
  de(finalScore(board), { black: 31, white: 31 });
  eq(winnerOf(board), EMPTY);
});

// ─── 终局结算口径（WOF / classic）────────────────────────────────
test("isRuleSet: 只认 wof 与 classic", () => {
  eq(isRuleSet(RULES_WOF), true);
  eq(isRuleSet(RULES_CLASSIC), true);
  eq(isRuleSet(""), false);
  eq(isRuleSet(undefined), false);
  eq(isRuleSet("oth"), false);
});

test("finalScore(rules): classic 口径空位不归属，比分总数可小于 64", () => {
  const board = emptyBoard();
  for (let i = 0; i < 40; i += 1) board[i] = BLACK;
  for (let i = 40; i < 62; i += 1) board[i] = WHITE;

  de(finalScore(board, RULES_CLASSIC), { black: 40, white: 22 });
  de(finalScore(board), { black: 42, white: 22 }); // 缺省即 WOF
  de(finalScore(board, RULES_WOF), { black: 42, white: 22 });
  // 非法口径按 WOF 处理（默认分支），不会静默变成 classic
  de(finalScore(board, "bogus"), { black: 42, white: 22 });

  // 落满时两种口径必然一致
  const full = board.slice();
  full[62] = BLACK;
  full[63] = WHITE;
  de(finalScore(full, RULES_CLASSIC), { black: 41, white: 23 });
  de(finalScore(full, RULES_WOF), { black: 41, white: 23 });
});

test("两种口径的胜负恒等：空位只归领先方，因此只改分差、从不改赢家", () => {
  const cases = [];
  const a = emptyBoard();
  for (let i = 0; i < 40; i += 1) a[i] = BLACK;
  for (let i = 40; i < 62; i += 1) a[i] = WHITE;
  cases.push(a);
  const b = a.map((v) => (v === BLACK ? WHITE : v === WHITE ? BLACK : v));
  cases.push(b);
  const c = emptyBoard();
  for (let i = 0; i < 31; i += 1) c[i] = BLACK;
  for (let i = 31; i < 62; i += 1) c[i] = WHITE;
  cases.push(c); // 实数平局 + 余空

  for (const board of cases) {
    eq(winnerOf(board, RULES_CLASSIC), winnerOf(board, RULES_WOF));
  }
});

test("createState: rules 缺省 WOF、显式 classic 生效，且逐手 applyMove 后不变", () => {
  const fresh = createState();
  eq(fresh.rules, RULES_WOF);

  const bogus = createState({ rules: "bogus" });
  eq(bogus.rules, RULES_WOF);

  // 终局局面（双方均无子可下）：全黑盘 + 两枚空位
  const board = new Array(CELL_COUNT).fill(BLACK);
  board[0] = EMPTY;
  board[1] = EMPTY;
  const classicEnd = createState({ board, rules: RULES_CLASSIC });
  eq(classicEnd.status, STATUS_OVER);
  de(classicEnd.finalScore, { black: 62, white: 0 }); // 空位不归属
  const wofEnd = createState({ board });
  de(wofEnd.finalScore, { black: 64, white: 0 }); // 空位归黑
  eq(classicEnd.winner, wofEnd.winner); // 口径只改分差，不改赢家

  // 对局中 rules 必须随状态一路传递，绝不中途回落到 WOF
  const play = createState({ rules: RULES_CLASSIC });
  const moved = applyMove(play, indexOf(2, 3));
  eq(moved.rules, RULES_CLASSIC);
  eq(createState({ rules: RULES_CLASSIC, moves: [indexOf(2, 3), indexOf(2, 2)] }).rules, RULES_CLASSIC);
});

test("settle: 双方均无子可下时立即终局并按 WOF 结算", () => {
  const board = new Array(CELL_COUNT).fill(BLACK);
  board[0] = EMPTY;
  board[1] = EMPTY;
  const state = createState({ board });
  eq(state.status, STATUS_OVER);
  eq(state.current, EMPTY);
  eq(state.winner, BLACK);
  de(state.finalScore, { black: 64, white: 0 });
  eq(state.passedPlayer, EMPTY); // 终局不播报让位
});

test("终局后所有 applyMove 为 no-op（返回同一引用）", () => {
  const board = new Array(CELL_COUNT).fill(BLACK);
  board[0] = EMPTY;
  const state = createState({ board });
  eq(state.status, STATUS_OVER);
  eq(applyMove(state, 0), state);
});

test("settle 幂等", () => {
  const board = new Array(CELL_COUNT).fill(BLACK);
  board[0] = EMPTY;
  const state = createState({ board });
  eq(settle(state), state);
});

// ─── Pass 规则 ────────────────────────────────────────────────────
// 手工构造的让位局面：
//   白 (0,0) 是角（永不可翻）且被空位隔断，无法从任何方向被夹击；
//   黑 (7,0) 与白 (7,1) 构成一把"刀"，黑 (7,7) 与白 (7,6) 构成另一把。
//   白方在任何空位都无法形成"黑段 + 白锚点"，而黑方有 (7,2) 与 (7,5) 两手。
test("Pass：无子可下的一方被跳过，另一方连下", () => {
  const board = emptyBoard();
  board[indexOf(0, 0)] = WHITE;
  board[indexOf(7, 0)] = BLACK;
  board[indexOf(7, 1)] = WHITE;
  board[indexOf(7, 6)] = WHITE;
  board[indexOf(7, 7)] = BLACK;

  const start = createState({ board, current: BLACK });
  eq(start.status, STATUS_PLAYING);
  de(legalMoves(start.board, BLACK), [indexOf(7, 2), indexOf(7, 5)]);
  eq(legalMoves(start.board, WHITE).length, 0);

  const after = applyMove(start, indexOf(7, 5));
  eq(after.moves.length, 1);
  eq(after.status, STATUS_PLAYING);
  eq(after.passedPlayer, WHITE);
  eq(after.current, BLACK); // 白被跳过，黑连下
  eq(legalMoves(after.board, WHITE).length, 0);
  assert.ok(legalMoves(after.board, BLACK).length > 0, "接手方必须仍有子可下");

  // 黑再落一手后，白仍无子可下且黑亦无子可下 → 终局（而非又一次让位）
  const ended = applyMove(after, indexOf(7, 2));
  eq(ended.status, STATUS_OVER);
  eq(ended.passedPlayer, EMPTY);
  // 盘面 6 黑 1 白 + 57 空位，WOF 把空位全归黑
  de(ended.finalScore, { black: 63, white: 1 });
  eq(ended.winner, BLACK);
});

test("settle：初始盘面上行棋方无子可下时，直接让位给对手而非终局", () => {
  const board = emptyBoard();
  board[indexOf(0, 0)] = WHITE;
  board[indexOf(7, 0)] = BLACK;
  board[indexOf(7, 1)] = WHITE;
  board[indexOf(7, 6)] = WHITE;
  board[indexOf(7, 7)] = BLACK;
  eq(legalMoves(board, WHITE).length, 0);
  assert.ok(legalMoves(board, BLACK).length > 0);

  const state = createState({ board, current: WHITE });
  eq(state.status, STATUS_PLAYING);
  eq(state.current, BLACK);
  eq(state.passedPlayer, WHITE);
  eq(state.moves.length, 0); // 让位不产生手数
});

test("1000 步随机游走：不抛错、不卡死、不变式守恒（含 Pass 分支覆盖）", () => {
  const rng = mulberry32(0xc0ffee);
  let games = 0;
  let passEvents = 0;
  let decisive = 0;
  let drawn = 0;

  while (games < 300) {
    games += 1;
    let state = createState();
    let guard = 0;
    const seen = new Set([boardKey(state)]);
    while (state.status === STATUS_PLAYING) {
      guard += 1;
      assert.ok(guard <= 200, "对局步数失控，疑似死循环");

      const moves = legalMoves(state.board, state.current);
      assert.ok(moves.length > 0, "playing 状态下行棋方必须有合法着法");

      const pick = moves[Math.floor(rng() * moves.length)];
      const mover = state.current;
      const before = countDiscs(state.board);
      const next = applyMove(state, pick);
      assert.notStrictEqual(next, state, "合法着法必须被执行");

      const after = countDiscs(next.board);
      // 不变式：每手恰好新增一枚子，总子数 +1
      eq(after.black + after.white, before.black + before.white + 1);
      eq(after.empty, before.empty - 1);
      // 落子方必然增加（落 1 + 翻 n），对手必然减少（被翻 n）
      const mine = mover === BLACK ? "black" : "white";
      const foe = mover === BLACK ? "white" : "black";
      assert.ok(after[mine] > before[mine], "落子方的子数必然增加");
      assert.ok(after[foe] <= before[foe], "对手的子数只可能因被翻而减少");
      eq(after[mine] - before[mine] - 1, before[foe] - after[foe], "落子方增加量 = 1 + 对手减少量");
      eq(next.moves.length, state.moves.length + 1);
      assert.ok(next.lastFlips.length >= 1);

      const key = boardKey(next);
      assert.ok(!seen.has(key), "同一局面重复出现，状态机不收敛");
      seen.add(key);

      if (next.passedPlayer !== EMPTY) {
        passEvents += 1;
        eq(legalMoves(next.board, next.passedPlayer).length, 0, "让位方必须确实无子可下");
        assert.ok(legalMoves(next.board, other(next.passedPlayer)).length > 0, "接手方必须仍有子可下");
        eq(next.current, other(next.passedPlayer));
      }
      state = next;
    }

    eq(state.moves.length <= 60, true, "黑白棋单手不可超过 60");
    const discs = countDiscs(state.board);
    eq(discs.black + discs.white, state.moves.length + 4, "起始 4 子 + 每手 1 子");
    eq(discs.empty, CELL_COUNT - discs.black - discs.white);
    const score = state.finalScore;
    assert.ok(score !== null);
    eq(state.winner, score.black > score.white ? BLACK : score.white > score.black ? WHITE : EMPTY);
    if (score.black === score.white) drawn += 1;
    else {
      decisive += 1;
      eq(score.black + score.white, 64, "非平局时 WOF 保证终局总子数恒为 64");
    }
    assert.ok(discs.black <= score.black && discs.white <= score.white, "WOF 只会加不会减");
    eq(countDiscs(state.board).empty, 64 - discs.black - discs.white);
  }

  eq(games, 300);
  assert.ok(passEvents > 0, "300 局随机游走中应出现过让位（Pass 分支未被覆盖）");
  assert.ok(decisive + drawn === games);
});

test("随机游走：同一 seed 复跑得到完全一致的对局（确定性）", () => {
  function play(seed) {
    const rng = mulberry32(seed);
    let state = createState();
    const key = [];
    while (state.status === STATUS_PLAYING) {
      const moves = legalMoves(state.board, state.current);
      const pick = moves[Math.floor(rng() * moves.length)];
      state = applyMove(state, pick);
      key.push(pick);
    }
    return key.join(",");
  }
  eq(play(20260928), play(20260928));
  assert.notStrictEqual(play(20260928), play(20260929));
});

// ─── 格位分类与稳定子 ─────────────────────────────────────────────
test("角落与 X / C 位分类正确", () => {
  de(CORNER_INDICES, [0, 7, 56, 63]);
  for (const corner of CORNER_INDICES) eq(isCorner(corner), true);

  eq(isXSquare(indexOf(1, 1)), true);
  eq(isXSquare(indexOf(1, 6)), true);
  eq(isXSquare(indexOf(6, 1)), true);
  eq(isXSquare(indexOf(6, 6)), true);

  eq(isCSquare(indexOf(0, 1)), true);
  eq(isCSquare(indexOf(1, 0)), true);
  eq(isCSquare(indexOf(6, 7)), true);
  eq(isCSquare(indexOf(7, 6)), true);

  eq(squareKind(indexOf(0, 0)), "corner");
  eq(squareKind(indexOf(1, 1)), "x");
  eq(squareKind(indexOf(0, 1)), "c");
  eq(squareKind(indexOf(0, 3)), "edge");
  eq(squareKind(indexOf(3, 3)), "inner");
});

test("stableSet: 空盘无稳定子；角一旦落子即永久稳定", () => {
  const emptyStable = stableSet(emptyBoard());
  eq(emptyStable.filter(Boolean).length, 0);

  const board = standardBoard();
  const before = stableSet(board);
  for (const corner of CORNER_INDICES) eq(before[corner], false); // 四角皆空

  board[indexOf(0, 0)] = BLACK;
  const after = stableSet(board);
  eq(after[indexOf(0, 0)], true);
});

test("stableSet: 从角沿边连续的同色子稳定，被异色截断则不稳定（且截断点之外也不稳定）", () => {
  const board = emptyBoard();
  board[indexOf(0, 0)] = BLACK;
  board[indexOf(0, 1)] = BLACK;
  board[indexOf(0, 2)] = BLACK;
  board[indexOf(0, 3)] = WHITE;
  board[indexOf(0, 4)] = BLACK;
  const stable = stableSet(board);
  eq(stable[indexOf(0, 0)], true);
  eq(stable[indexOf(0, 1)], true);
  eq(stable[indexOf(0, 2)], true);
  // (0,3) 是异色截断点：横向两侧分别是黑与黑，纵向/斜向皆有空位 → 不稳定
  eq(stable[indexOf(0, 3)], false);
  // (0,4) 横向左侧被异色挡住、右侧是空格 → 不稳定
  eq(stable[indexOf(0, 4)], false);
});

test("stableSet: 满盘单色时全部 64 格稳定", () => {
  const board = new Array(CELL_COUNT).fill(WHITE);
  const stable = stableSet(board);
  eq(stable.filter(Boolean).length, CELL_COUNT);
});

test("stableSet: 保守性 —— 孤立的一整行虽然填满，但上下皆是空位，对手仍可从垂直方向制造夹击", () => {
  const board = emptyBoard();
  for (let c = 0; c < SIZE; c += 1) board[indexOf(3, c)] = BLACK;
  const stable = stableSet(board);
  eq(stable.filter(Boolean).length, 0);
});

test("stableSet: 半盘锁死 —— 左半盘全黑且上下贯通到边缘时，该区域稳定", () => {
  const board = emptyBoard();
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < 4; c += 1) board[indexOf(r, c)] = BLACK;
  }
  const stable = stableSet(board);
  // (0,0) 角稳定，并沿上下左右封死后向内部扩散
  eq(stable[indexOf(0, 0)], true);
  eq(stable[indexOf(7, 3)], true);
  eq(stable[indexOf(3, 0)], true);
  // 右侧边界格 (r,3) 的水平方向对 (r,4) 是空格开口，但竖直方向已被同行同色封到边缘 → 稳定
  eq(stable[indexOf(4, 3)], true);
});

test("stableCounts 与 stableSet 一致", () => {
  const board = standardBoard();
  board[indexOf(0, 0)] = BLACK;
  board[indexOf(0, 1)] = BLACK;
  const counts = stableCounts(board);
  eq(counts.black, 2);
  eq(counts.white, 0);
  eq(counts.set.length, CELL_COUNT);
});

test("稳定子绝不可能被当手翻转：随机游走验证（AI Stability 评估项的正确性底线）", () => {
  const rng = mulberry32(0x5eed);
  let checked = 0;
  for (let game = 0; game < 30; game += 1) {
    let state = createState();
    let guard = 0;
    while (state.status === STATUS_PLAYING && guard < 200) {
      guard += 1;
      const stableBefore = stableSet(state.board);
      const moves = legalMoves(state.board, state.current);
      const next = applyMove(state, moves[Math.floor(rng() * moves.length)]);
      for (const flipped of next.lastFlips) {
        assert.ok(!stableBefore[flipped], `稳定子 ${flipped} 在 ${rowCol(flipped)} 处被翻转了`);
        checked += 1;
      }
      state = next;
    }
  }
  assert.ok(checked > 200, "样本量过低，未真正覆盖翻转路径");
});

test("stableSet 是纯函数：同样输入恒得同样输出，且不修改入参", () => {
  const board = standardBoard();
  const snapshot = board.slice();
  const a = stableSet(board);
  const b = stableSet(board);
  de(a, b);
  de(board, snapshot);
  de(a, new Array(CELL_COUNT).fill(false));
});
