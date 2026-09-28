// 计分口径的三套度量：对弈档案、残局三星、冲刺连击。
// 关键手法：所有"逆推"出来的量（子数曲线起点、最大反转幅度）都必须与
// "重放到第 i 手之前的真实盘面"对得上 —— 参照实现独立于被测实现，逆推写错必红。

import test from "node:test";
import assert from "node:assert/strict";

import {
  BLACK, WHITE, EMPTY, CELL_COUNT, STATUS_PLAYING, STATUS_OVER, RULES_CLASSIC,
  emptyBoard, legalMoves, applyMove, createState, countDiscs,
} from "../js/engine.mjs";
import {
  OUTCOME_WIN, OUTCOME_LOSS, OUTCOME_DRAW,
  CHAPTER_UNLOCK_NEED, PUZZLE_STARS_MAX,
  RUSH_COMBO_STEP, RUSH_MAX_MULTIPLIER, RUSH_WIN_BONUS_PER_DISC,
  outcomeOf, discGraph, maxFlipOf, biggestSwingOf, gameReport, recordHighlights,
  puzzleStars, clampStars, mergePuzzleResult, recordStars,
  solvedCount, starTotal, chapterCleared, allStarred,
  rushStart, rushMultiplier, rushAdvance, rushWinBonus,
} from "../js/score.mjs";

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

// 双方随机合法落子至终局（引擎自动处理 Pass），用作一切"真实对局"素材的来源。
function walk(seed, config = {}, maxMoves = 80) {
  const rng = mulberry32(seed);
  let state = createState(config);
  while (state.status === STATUS_PLAYING && state.moves.length < maxMoves) {
    const moves = legalMoves(state.board, state.current);
    if (moves.length === 0) break;
    const next = applyMove(state, moves[Math.floor(rng() * moves.length)]);
    if (next === state) break;
    state = next;
  }
  return state;
}

// 独立参照：把前 n 手重放一遍，拿到第 n 手之前/之后的真实子数。
function replayCounts(config, state, n) {
  const moves = state.moves.slice(0, n).map((move) => move.index);
  return countDiscs(createState({ ...config, moves }).board);
}

function syntheticMove(index, player, flips, black, white) {
  return { index, player, flips: new Array(flips).fill(0), black, white };
}

// ─── 对弈：胜负判定 ───────────────────────────────────────────────
const FULL_BOARD = (() => {
  const board = emptyBoard();
  for (let i = 0; i < CELL_COUNT; i += 1) board[i] = i < 32 ? BLACK : WHITE;
  return board;
})();

test("outcomeOf：未终局一律 null；观战/非法执子方也 null", () => {
  eq(outcomeOf(createState(), BLACK), null);
  eq(outcomeOf(null, BLACK), null);
  const over = createState({ board: FULL_BOARD });
  eq(over.status, STATUS_OVER);
  eq(outcomeOf(over, EMPTY), null);
  eq(outcomeOf(over, undefined), null);
  eq(outcomeOf(over, "black"), null);
});

test("outcomeOf：终局判胜/负/和，且跟随 state.rules 口径", () => {
  const board = new Array(CELL_COUNT).fill(BLACK);
  board[0] = EMPTY;
  board[1] = EMPTY;
  const wof = createState({ board });
  eq(outcomeOf(wof, BLACK), OUTCOME_WIN);
  eq(outcomeOf(wof, WHITE), OUTCOME_LOSS);

  const classic = createState({ board, rules: RULES_CLASSIC });
  eq(outcomeOf(classic, BLACK), OUTCOME_WIN); // 口径只改分差，不改胜负

  const draw = createState({ board: FULL_BOARD });
  eq(outcomeOf(draw, BLACK), OUTCOME_DRAW);
  eq(outcomeOf(draw, WHITE), OUTCOME_DRAW);
});

// ─── 子数曲线 ─────────────────────────────────────────────────────
test("discGraph：未落子时退化为单点，且起点即标准开局 2:2", () => {
  const graph = discGraph(createState());
  eq(graph.length, 1);
  de(graph[0], { moveNo: 0, black: 2, white: 2, player: EMPTY, index: -1, flips: 0 });
});

test("discGraph：逐手子数与重放参照完全一致（含 6 个种子、两种起始盘面）", () => {
  const configs = [{}, { board: FULL_BOARD.map((v, i) => (i < 20 ? BLACK : i < 44 ? WHITE : EMPTY)) }];
  for (const config of configs) {
    for (const seed of [1, 7, 42, 99, 2024, 65535]) {
      const state = walk(seed, config);
      if (state.moves.length < 5) continue;
      const graph = discGraph(state);
      eq(graph.length, state.moves.length + 1);
      for (let n = 0; n <= state.moves.length; n += 1) {
        const real = replayCounts(config, state, n);
        eq(graph[n].black, real.black, `seed ${seed} 第 ${n} 手黑子数`);
        eq(graph[n].white, real.white, `seed ${seed} 第 ${n} 手白子数`);
      }
    }
  }
});

test("discGraph：每一步的增减必须符合规则（本手 +1+k，对手 −k，总数 +1）", () => {
  const state = walk(12345);
  assert.ok(state.moves.length > 20, "样本对局太短，无法验证");
  const graph = discGraph(state);
  for (let n = 1; n < graph.length; n += 1) {
    const flips = state.moves[n - 1].flips.length;
    const player = state.moves[n - 1].player;
    const blackDelta = graph[n].black - graph[n - 1].black;
    const whiteDelta = graph[n].white - graph[n - 1].white;
    eq(blackDelta, player === BLACK ? 1 + flips : -flips);
    eq(whiteDelta, player === WHITE ? 1 + flips : -flips);
    eq(graph[n].black + graph[n].white, graph[n - 1].black + graph[n - 1].white + 1);
  }
});

// ─── 最大单步翻转 ─────────────────────────────────────────────────
test("maxFlipOf：无着法返回 null；并列取先发生的一手", () => {
  eq(maxFlipOf({ moves: [] }), null);
  const tied = { moves: [syntheticMove(5, BLACK, 3, 10, 6), syntheticMove(9, WHITE, 3, 8, 9)] };
  eq(maxFlipOf(tied).moveNo, 1);
  eq(maxFlipOf(tied).index, 5);
  eq(maxFlipOf(tied).flips, 3);
});

test("maxFlipOf：真实对局里恒等于逐手取最大翻转数", () => {
  const state = walk(777);
  const expected = Math.max(...state.moves.map((move) => move.flips.length));
  const best = maxFlipOf(state);
  eq(best.flips, expected);
  eq(best.moveNo, state.moves.findIndex((move) => move.flips.length === expected) + 1);
});

// ─── 最大反转幅度（指标定义的正确性靠这条把住）────────────────────
// 手工构造（每一步都对得上规则：本手 +1+k，对手 −k）：
//   起手 23:23
//   第 1 手 黑翻 6 → 30:17   （落子前均势，swing = 7）
//   第 2 手 白翻 2 → 28:20   （落子前白落后 13，swing = 1+2+13 = 16）
//   第 3 手 黑翻 4 → 33:16   （落子前黑领先 8，swing = 5）
const SYNTHETIC = {
  moves: [
    syntheticMove(27, BLACK, 6, 30, 17),
    syntheticMove(18, WHITE, 2, 28, 20),
    syntheticMove(44, BLACK, 4, 33, 16),
  ],
};

test("biggestSwingOf：取的是「逆风翻得最狠的一手」，不是「翻得最多的一手」", () => {
  const maxFlip = maxFlipOf(SYNTHETIC);
  const swing = biggestSwingOf(SYNTHETIC);
  eq(maxFlip.moveNo, 1);
  eq(maxFlip.flips, 6);
  eq(swing.moveNo, 2);
  eq(swing.flips, 2);
  eq(swing.deficitBefore, 13);
  eq(swing.swing, 16);
  assert.notEqual(swing.moveNo, maxFlip.moveNo, "两个指标退化成了同一手，档案卡失去意义");
  assert.ok(swing.swing > maxFlip.flips + 1);
});

test("biggestSwingOf：swing 恒 ≥ 翻转数 + 1；无着法返回 null；并列取先发生者", () => {
  eq(biggestSwingOf({ moves: [] }), null);
  // 两手 swing 恰好都是 6：黑翻 5 枚（落子前领先 19，无落后补偿），白翻 2 枚（落子前落后 3）。
  const tied = {
    moves: [
      syntheticMove(1, BLACK, 5, 40, 10), // margin 30 → before 19 → swing = 6
      syntheticMove(2, WHITE, 2, 22, 24), // margin 2 → before −3 → swing = 6
    ],
  };
  eq(biggestSwingOf(tied).swing, 6);
  eq(biggestSwingOf(tied).moveNo, 1);
  for (const seed of [3, 21, 404]) {
    const state = walk(seed);
    const entry = biggestSwingOf(state);
    eq(entry.swing, 1 + entry.flips + entry.deficitBefore);
    assert.ok(entry.swing >= entry.flips + 1);
    assert.ok(entry.deficitBefore >= 0);
  }
});

test("biggestSwingOf：逆推出的落子前落后子数必须与重放参照一致", () => {
  for (const seed of [11, 88, 31337]) {
    const state = walk(seed);
    let expected = null;
    for (let i = 0; i < state.moves.length; i += 1) {
      const before = replayCounts({}, state, i);
      const mover = state.moves[i].player;
      const mine = mover === BLACK ? before.black : before.white;
      const theirs = mover === BLACK ? before.white : before.black;
      const deficit = Math.max(0, -(mine - theirs));
      const swing = 1 + state.moves[i].flips.length + deficit;
      if (!expected || swing > expected.swing) {
        expected = { moveNo: i + 1, flips: state.moves[i].flips.length, deficitBefore: deficit, swing };
      }
    }
    const best = biggestSwingOf(state);
    eq(best.moveNo, expected.moveNo, `seed ${seed} 选中的手`);
    eq(best.deficitBefore, expected.deficitBefore, `seed ${seed} 落子前落后子数`);
    eq(best.swing, expected.swing, `seed ${seed} 反转幅度`);
  }
});

// ─── 对局档案卡 ───────────────────────────────────────────────────
test("gameReport：字段齐全，graph 长度 = 手数 + 1", () => {
  const state = walk(2024);
  const report = gameReport(state);
  eq(report.moves, state.moves.length);
  eq(report.graph.length, state.moves.length + 1);
  eq(report.black + report.white, state.finalScore.black + state.finalScore.white);
  eq(report.diff, Math.abs(report.black - report.white));
  eq(report.winner, state.winner);
  de(report.maxFlip, maxFlipOf(state));
  de(report.swing, biggestSwingOf(state));
});

test("gameReport：perfect 只在 64:0 成立，空盘与常规终局都不算", () => {
  const allBlack = new Array(CELL_COUNT).fill(BLACK);
  const perfectScore = createState({ board: allBlack });
  const perfect = gameReport(perfectScore);
  eq(perfect.perfect, true);
  eq(perfect.black, CELL_COUNT);

  // 有余空但 WOF 把空位全归黑 → 同样是 64:0
  const twoHoles = allBlack.slice();
  twoHoles[0] = EMPTY;
  twoHoles[1] = EMPTY;
  eq(gameReport(createState({ board: twoHoles })).perfect, true);

  // 空盘：0:0，总数不是 64，绝不能被判成完美局
  eq(gameReport(createState({ board: emptyBoard() })).perfect, false);

  const normal = createState({ board: FULL_BOARD });
  de([gameReport(normal).perfect, gameReport(normal).black, gameReport(normal).white], [false, 32, 32]);
});

test("recordHighlights：只升不降，空报告不破坏历史纪录", () => {
  const start = { maxFlip: 9, bestSwing: 20 };
  const up = recordHighlights(start, { maxFlip: { flips: 12 }, swing: { swing: 18 } });
  de(up, { maxFlip: 12, bestSwing: 20 });

  const down = recordHighlights(start, { maxFlip: { flips: 3 }, swing: { swing: 4 } });
  de(down, { maxFlip: 9, bestSwing: 20 });

  de(recordHighlights(start, null), { maxFlip: 9, bestSwing: 20 });
  de(recordHighlights(undefined, null), { maxFlip: 0, bestSwing: 0 });
  de(recordHighlights({ maxFlip: "x" }, null), { maxFlip: 0, bestSwing: 0 });
  eq(start.maxFlip, 9); // 纯函数：不改入参
});

// ─── 残局三星 ─────────────────────────────────────────────────────
test("puzzleStars：一星解出 / 二星无错着 / 三星首手即最优且零错着", () => {
  eq(puzzleStars(null), 0);
  eq(puzzleStars({ solved: false }), 0);
  eq(puzzleStars({ solved: false, firstMoveOptimal: true, hadWrongRetry: false }), 0);
  eq(puzzleStars({ solved: true, firstMoveOptimal: true, hadWrongRetry: false }), 3);
  eq(puzzleStars({ solved: true, firstMoveOptimal: false, hadWrongRetry: false }), 2);
  eq(puzzleStars({ solved: true, firstMoveOptimal: true, hadWrongRetry: true }), 1);
  eq(puzzleStars({ solved: true, firstMoveOptimal: false, hadWrongRetry: true }), 1);
  eq(PUZZLE_STARS_MAX, 3);
});

test("clampStars：越界与非法值一律夹到 0..3", () => {
  eq(clampStars(0), 0);
  eq(clampStars(2), 2);
  eq(clampStars(3), 3);
  eq(clampStars(9), 3);
  eq(clampStars(-4), 0);
  eq(clampStars(2.9), 2);
  eq(clampStars("2"), 2);
  eq(clampStars("x"), 0);
  eq(clampStars(undefined), 0);
});

test("mergePuzzleResult：星级只升不降；同级保留更干净的一次", () => {
  const one = { stars: 1, hadWrongRetry: true, firstMoveOptimal: false };
  const two = { stars: 2, hadWrongRetry: false, firstMoveOptimal: false };
  const three = { stars: 3, hadWrongRetry: false, firstMoveOptimal: true };

  de(mergePuzzleResult(null, one), one);
  de(mergePuzzleResult(one, three), three); // 升级
  de(mergePuzzleResult(three, one), three); // 降级被拒
  de(mergePuzzleResult(one, two), two);

  // 同级：2 星里"无错着"的那次胜出（两者星级相同，只有干净度不同）
  const twoDirty = { stars: 2, hadWrongRetry: true, firstMoveOptimal: false };
  de(mergePuzzleResult(two, twoDirty), two);
  de(mergePuzzleResult(twoDirty, two), two);
  de(mergePuzzleResult(three, { stars: 3, hadWrongRetry: true, firstMoveOptimal: true }), three);
});

test("mergePuzzleResult：绝不产出「三星 + 有错着重选」这种自相矛盾的记录", () => {
  let record = null;
  const runs = [
    { stars: 3, hadWrongRetry: true, firstMoveOptimal: true }, // 不可能发生，但必须被拒
    { stars: 1, hadWrongRetry: false, firstMoveOptimal: false },
    { stars: 3, hadWrongRetry: false, firstMoveOptimal: true },
    { stars: 2, hadWrongRetry: true, firstMoveOptimal: true },
  ];
  for (const run of runs) record = mergePuzzleResult(record, run);
  eq(record.stars, 3);
  eq(record.hadWrongRetry, false);
  eq(record.firstMoveOptimal, true);
});

// ─── 进度汇总 ─────────────────────────────────────────────────────
test("进度汇总：星数、解出数、章节放行、总成就", () => {
  const ids = ["p0101", "p0102", "p0103", "p0104", "p0105", "p0106", "p0107"];
  const records = {
    p0101: { stars: 3, hadWrongRetry: false, firstMoveOptimal: true },
    p0102: { stars: 2, hadWrongRetry: false, firstMoveOptimal: false },
    p0103: { stars: 1, hadWrongRetry: true, firstMoveOptimal: false },
    p0104: { stars: 0, hadWrongRetry: false, firstMoveOptimal: false },
    p0199: { stars: 3 }, // 不属于本章，不参与统计
  };
  eq(recordStars(records, "p0101"), 3);
  eq(recordStars(records, "p0104"), 0);
  eq(recordStars(records, "nope"), 0);
  eq(recordStars(null, "p0101"), 0);
  eq(solvedCount(records, ids), 3);
  eq(starTotal(records, ids), 6);
  eq(starTotal(records, []), 0);
  eq(chapterCleared(records, ids), false); // 3 < 6
  eq(chapterCleared(records, []), false);
  eq(chapterCleared(records, undefined), false);
  eq(CHAPTER_UNLOCK_NEED, 6);

  // 放行边界：恰好 6 题解出即放行，5 题差一题不放行
  const six = ids.slice(0, 6);
  const sixRecords = Object.fromEntries(six.map((id) => [id, { stars: 1 }]));
  eq(chapterCleared(sixRecords, six), true);
  eq(chapterCleared({ ...sixRecords, [six[5]]: { stars: 0 } }, six), false);

  eq(allStarred(records, ids), false);
  const allThree = Object.fromEntries(ids.map((id) => [id, { stars: 3 }]));
  eq(allStarred(allThree, ids), true);
  eq(allStarred(allThree, []), false);
  eq(allStarred({}, ids), false);
});

// ─── 翻转冲刺 ─────────────────────────────────────────────────────
test("rushMultiplier：每 3 级 +0.5，18 级起封顶 ×4，非法值按 0 处理", () => {
  eq(rushMultiplier(0), 1);
  eq(rushMultiplier(2), 1);
  eq(rushMultiplier(3), 1.5);
  eq(rushMultiplier(5), 1.5);
  eq(rushMultiplier(6), 2);
  eq(rushMultiplier(9), 2.5);
  eq(rushMultiplier(12), 3);
  eq(rushMultiplier(15), 3.5);
  eq(rushMultiplier(18), 4);
  eq(rushMultiplier(400), RUSH_MAX_MULTIPLIER);
  eq(rushMultiplier(-5), 1);
  eq(rushMultiplier(undefined), 1);
  eq(RUSH_COMBO_STEP, 3);
});

test("rushAdvance：翻 ≥2 续连击，翻 1 断连击，超时强制归零", () => {
  let state = rushStart();
  de(state, { score: 0, combo: 0, multiplier: 1, moves: 0 });

  state = rushAdvance(state, 3);
  de(state, { combo: 1, multiplier: 1, gained: 3, score: 3, moves: 1 });

  state = rushAdvance(state, 4);
  de(state, { combo: 2, multiplier: 1, gained: 4, score: 7, moves: 2 });

  state = rushAdvance(state, 5);
  de(state, { combo: 3, multiplier: 1.5, gained: 7.5, score: 14.5, moves: 3 });

  // 翻 1 子断连击：本手按 ×1 计，之后的连击从零重建
  state = rushAdvance(state, 1);
  de(state, { combo: 0, multiplier: 1, gained: 1, score: 15.5, moves: 4 });

  // 超时：即使翻得多，连击也必须归零
  state = rushAdvance(state, 6, { timedOut: true });
  de(state, { combo: 0, multiplier: 1, gained: 6, score: 21.5, moves: 5 });

  state = rushAdvance(state, 2);
  eq(state.combo, 1);
});

test("rushAdvance：连击长跑符合公式，且状态不可变", () => {
  let state = rushStart();
  const flips = 3;
  let expected = 0;
  for (let i = 1; i <= 24; i += 1) {
    const next = rushAdvance(state, flips);
    expected += flips * rushMultiplier(i);
    eq(next.combo, i);
    eq(next.gained, flips * rushMultiplier(i));
    eq(next.score, expected);
    eq(state.moves, i - 1); // 入参不被修改
    state = next;
  }
  eq(state.multiplier, RUSH_MAX_MULTIPLIER); // 24 级已封顶
});

test("rushAdvance：非法翻转数不产生负分，也不推进连击", () => {
  const state = rushStart();
  const bad = rushAdvance(state, -3);
  eq(bad.gained, 0);
  eq(bad.combo, 0);
  eq(rushAdvance(state, "x").gained, 0);
  eq(rushAdvance(state, 2.9).gained, 2);
});

test("rushWinBonus：只给胜方，按子差 ×50", () => {
  eq(rushWinBonus(true, 12), 12 * RUSH_WIN_BONUS_PER_DISC);
  eq(rushWinBonus(false, 12), 0);
  eq(rushWinBonus(true, -5), 0);
  eq(rushWinBonus(true, 0), 0);
  eq(rushWinBonus(true, undefined), 0);
  eq(RUSH_WIN_BONUS_PER_DISC, 50);
});
