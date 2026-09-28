// 状态控制器契约：意图与落子必须分离，事件流是 UI 的唯一指令源。
//
// 本文件的测试策略：注入确定性的 think / yielder，让"对手"永远取最小索引的合法手
// （不贪、不随机、不耗时），于是每一步棋都可被逐位复现，不需要任何真实 AI。
// 同时把 drive() 的推进语义钉死：placement() 只登记、advance() 才落子、
// 落子后对手必须应手、控制权必须回到人类 —— 这三条是本层存在的全部理由。

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  BLACK, WHITE, EMPTY, CELL_COUNT,
  STATUS_PLAYING, STATUS_OVER, RULES_WOF, RULES_CLASSIC,
  other, legalMoves, createState, applyMove, flipLines, countDiscs,
} from "../js/engine.mjs";
import {
  createGame, openingScript, rushBoard,
  OPENING_KEYS, OPENING_SCRIPTS, UNDO_LIMIT, HINT_LIMIT, BLITZ_TURN_MS,
  RUSH_START_MOVES, RUSH_MIN_REPLIES, RUSH_MAX_IMBALANCE,
} from "../js/game.mjs";
import { MODES } from "../js/storage.mjs";
import { mulberry32 } from "../js/rng.mjs";
import { puzzleById } from "../js/puzzles.mjs";
import { RUSH_DURATION_MS, RUSH_TURN_MS } from "../js/score.mjs";
import { TIER_DUELIST, TIER_VIRTUOSO, TIER_INFALLIBLE } from "../js/ai.mjs";
import { PERFECT_LIMIT } from "../js/solver.mjs";

const eq = assert.strictEqual;
const de = assert.deepStrictEqual;

const GAME_SRC = readFileSync(new URL("../js/game.mjs", import.meta.url), "utf8");

// ─── 确定性替身 ───────────────────────────────────────────────────
// 对手：永远取最小索引的合法手。tier 与预算原样记下来，供"预算契约"断言。
function firstMoveThink(record = null) {
  return async (board, player, tier, options = {}) => {
    const moves = legalMoves(board, player);
    if (record) record.push({ player, tier, budget: options });
    if (moves.length === 0) return { move: -1, passed: true, tier, depth: 0 };
    return { move: moves[0], passed: false, tier, depth: 1 };
  };
}

// 对手：按给定队列逐手复现（用于残局正解线，队列耗尽即视为异常）。
function queueThink(indices) {
  let cursor = 0;
  const calls = [];
  const fn = async (board, player, tier, options = {}) => {
    calls.push({ player, tier, options });
    if (cursor >= indices.length) return { move: -1, passed: true, tier, depth: 0 };
    const move = indices[cursor];
    cursor += 1;
    return { move, passed: false, tier, depth: 1 };
  };
  fn.calls = calls;
  fn.consumed = () => cursor;
  return fn;
}

const noYield = async () => {};

function newGame(options = {}) {
  return createGame({ think: firstMoveThink(), yielder: noYield, seed: 20260928, ...options });
}

// 用引擎独立复核一串开局脚本："两手都必须合法"这一步不能靠 game.mjs 自己说。
function legalScript(script) {
  let state = createState();
  for (const move of script) {
    if (flipLines(state.board, move, state.current).length === 0) return false;
    state = applyMove(state, move);
  }
  return true;
}

// 把题库的 bestLine 用引擎推一遍，标出每一手真正的行棋方。
// ★ 必须这样做：51/60 题的正解线里含 Pass，同一方会连走两手，
// 因此"奇数下标归对手"这种朴素假设会让残局测试在大多数题上直接错位。
function replayLine(entry) {
  let state = createState({ board: entry.board, current: entry.side, moves: [] });
  const plies = [];
  for (const index of entry.bestLine) {
    const player = state.current;
    if (flipLines(state.board, index, player).length === 0) return null;
    plies.push({ player, index });
    state = applyMove(state, index);
  }
  return { plies, state };
}

// ─── 常量契约 ─────────────────────────────────────────────────────
test("对外常量：悔棋 3 次 / 提示 3 次 / 闪电战 10 秒 / 街机起手 30 手", () => {
  eq(UNDO_LIMIT, 3);
  eq(HINT_LIMIT, 3);
  eq(BLITZ_TURN_MS, 10_000);
  eq(RUSH_START_MOVES, 30);
  eq(RUSH_MIN_REPLIES, 6);
  eq(RUSH_MAX_IMBALANCE, 2);
  de([...OPENING_KEYS], ["standard", "diagonal", "perpendicular", "parallel", "random"]);
  eq(OPENING_SCRIPTS.random, null); // 随机开局没有固定脚本，交给种子 PRNG
  eq(OPENING_SCRIPTS.standard.length, 0); // 标准开局四子就位即开打，不预落子
});

// ─── 开局脚本 ─────────────────────────────────────────────────────
test("开局脚本：四种定式各两手，且两都必须合法（用引擎复核）", () => {
  de(openingScript("standard", mulberry32(1)), []);
  for (const key of ["diagonal", "perpendicular", "parallel"]) {
    const script = openingScript(key, mulberry32(1));
    eq(script.length, 2, `${key} 应预落两手`);
    eq(legalScript(script), true, `${key} 的两手必须都合法`);
    assert.ok(script.every((move) => Number.isInteger(move) && move >= 0 && move < CELL_COUNT));
  }
  de(openingScript("no-such-opening", mulberry32(1)), []);
  de(openingScript("random", null), []); // 没有 PRNG 时不乱猜，退回不预落子
});

test("随机开局：400 个种子全部合法，且恰好覆盖 12 种前两手组合（4 首手 × 3 应手）", () => {
  const shapes = new Set();
  const firsts = new Set();
  for (let seed = 1; seed <= 400; seed += 1) {
    const script = openingScript("random", mulberry32(seed));
    eq(script.length, 2);
    eq(legalScript(script), true, `seed ${seed} 的前两手必须合法`);
    shapes.add(script.join(","));
    firsts.add(script[0]);
  }
  de([...firsts].sort((a, b) => a - b), [19, 26, 37, 44]); // d3 / c4 / f5 / e6
  eq(shapes.size, 12); // 每种首手恰有 3 种合法应手 —— 注释里 4×3 的推导，此处用实测钉住
  de(openingScript("random", mulberry32(99)), openingScript("random", mulberry32(99)));
});

// ─── 街机起手盘面 ─────────────────────────────────────────────────
test("街机起手盘面：60 个种子全部公平（余 30 空位、双方子差 ≤2、双方落点 ≥6）", () => {
  for (let seed = 1; seed <= 60; seed += 1) {
    const { board, current } = rushBoard(mulberry32(seed));
    const counts = countDiscs(board);
    eq(counts.empty, RUSH_START_MOVES);
    assert.ok(Math.abs(counts.black - counts.white) <= RUSH_MAX_IMBALANCE, `seed ${seed} 子差过大`);
    assert.ok(legalMoves(board, current).length >= RUSH_MIN_REPLIES, `seed ${seed} 先手落点过少`);
    assert.ok(legalMoves(board, other(current)).length >= RUSH_MIN_REPLIES, `seed ${seed} 后手落点过少`);
  }
});

test("街机起手盘面：同 seed 同盘面，绝不是标准开局，且不与任何一次调用共享数组", () => {
  const a = rushBoard(mulberry32(7));
  const b = rushBoard(mulberry32(7));
  eq(a.board.join(""), b.board.join(""));
  eq(a.current, b.current);
  assert.notEqual(a.board.join(""), createState().board.join(""));
  assert.notEqual(rushBoard(mulberry32(8)).board.join(""), a.board.join(""));

  const key = a.board.join("");
  a.board[0] = 99; // 污染返回值不得影响下一次生成
  eq(rushBoard(mulberry32(7)).board.join(""), key);
});

// ─── start 装配与快照只读 ─────────────────────────────────────────
test("start 默认值：对弈 / 棋手档 / 执黑 / 标准开局 / WOF 口径 / 无铜牌", () => {
  const snap = newGame().start();
  eq(snap.mode, MODES.PLAY);
  eq(snap.tier, TIER_DUELIST);
  eq(snap.human, BLACK);
  eq(snap.pvp, false);
  eq(snap.blitz, false);
  eq(snap.opening, "standard");
  eq(snap.rules, RULES_WOF);
  eq(snap.status, STATUS_PLAYING);
  eq(snap.current, BLACK);
  eq(snap.moveCount, 0);
  eq(snap.over, false);
  eq(snap.report, null);
  eq(snap.forecast, null); // 60 空位远超可精确求解上限，铜牌必须整块不出现
  eq(snap.puzzle, null);
  eq(snap.rush, null);
  eq(snap.pending, null);
  eq(snap.busy, false);
  eq(snap.thinking, false);
  eq(snap.hint, -1);
  eq(snap.blitzLeft, BLITZ_TURN_MS);
  de(snap.spend, { undo: UNDO_LIMIT, hint: HINT_LIMIT, undoLimit: UNDO_LIMIT, hintLimit: HINT_LIMIT });
  de(snap.legal, legalMoves(createState().board, BLACK));
  eq(snap.graph.length, 1); // 未落子 → 曲线退化为单点
});

test("start 对非法配置一律回落默认值，绝不抛错", () => {
  const snap = newGame().start({ mode: "cheat", tier: "god", side: 7, opening: "spiral", rules: "bogus" });
  eq(snap.mode, MODES.PLAY);
  eq(snap.tier, TIER_DUELIST);
  eq(snap.human, BLACK);
  eq(snap.opening, "standard");
  eq(snap.rules, RULES_WOF);
  eq(newGame().start({ rules: RULES_CLASSIC }).rules, RULES_CLASSIC);
});

test("残局模式传入不存在的题号 → 回落到对弈，而不是留下一张空盘", () => {
  const snap = newGame().start({ mode: MODES.PUZZLE, puzzleId: "p9999" });
  eq(snap.mode, MODES.PLAY);
  eq(snap.puzzle, null);
  de(snap.legal, legalMoves(createState().board, BLACK));
});

test("快照是只读契约：改返回对象不回写引擎，重复调用互相独立", () => {
  const game = newGame();
  const snap = game.start();
  snap.spend.undo = 99;
  snap.rush = { hacked: true };
  snap.puzzle = { hacked: true };
  snap.forecast = { hacked: true };
  const again = game.snapshot();
  de(again.spend, { undo: UNDO_LIMIT, hint: HINT_LIMIT, undoLimit: UNDO_LIMIT, hintLimit: HINT_LIMIT });
  eq(again.rush, null);
  eq(again.puzzle, null);
  eq(again.forecast, null);
});

// ─── 意图与落子分离 ───────────────────────────────────────────────
test("placement 只登记意图：非法点 / 越界 / 已占格一律 ignored，且盘面钉住不动", async () => {
  const game = newGame();
  const opened = game.start({ pvp: true });
  const key = opened.board.join("");
  for (const bad of [0, 27, -1, CELL_COUNT, 1.5, null, undefined, "19"]) {
    eq(game.placement(bad), "ignored", `落点 ${bad} 必须静默忽略`);
  }
  eq(game.snapshot().pending, null);
  eq(game.snapshot().board.join(""), key);

  eq(game.placement(19), "ready");
  eq(game.snapshot().pending, 19);
  eq(game.snapshot().board.join(""), key, "登记 ≠ 落子");
  eq(game.snapshot().moveCount, 0);

  await game.advance();
  eq(game.snapshot().moveCount, 1);
  eq(game.snapshot().pending, null);
  assert.notEqual(game.snapshot().board.join(""), key);
});

test("本地双人：双方都能在同一台机器上落子（pvp 下不存在「非本方回合」）", async () => {
  const game = newGame();
  game.start({ pvp: true });
  eq(game.placement(19), "ready");
  await game.advance();
  eq(game.snapshot().current, WHITE);
  eq(game.placement(18), "ready");
  await game.advance();
  eq(game.snapshot().current, BLACK);
  eq(game.snapshot().moveCount, 2);
  eq(game.placement(18), "ignored"); // 已被占
});

test("执白起手：start 只摆盘，必须再 advance 才会走出 AI 的第一步", async () => {
  const game = newGame();
  const opened = game.start({ side: WHITE });
  eq(opened.human, WHITE);
  eq(opened.current, BLACK);
  eq(opened.moveCount, 0);
  eq(game.placement(19), "ignored", "轮到 AI 时人类输入必须静默忽略");

  const snap = await game.advance();
  eq(snap.moveCount, 1);
  eq(snap.current, WHITE, "AI 走完必须把控制权交回人类");
  eq(snap.thinking, false);
});

test("动画期间（busy）落子进缓冲：返回 queued，release 后才真正落子", async () => {
  const game = newGame();
  game.start({ pvp: true });
  game.setVisualBusy(true);
  eq(game.placement(19), "queued");
  eq(game.snapshot().pending, 19);
  eq(game.snapshot().busy, true);
  eq(game.snapshot().moveCount, 0);

  game.setVisualBusy(false);
  await game.release();
  eq(game.snapshot().moveCount, 1);
  eq(game.snapshot().pending, null);
  eq(game.snapshot().busy, false);
});

test("事件流：moved 带 lines/flips/corners/trap，drainEvents 取走即清空", async () => {
  const game = newGame();
  game.start({ pvp: true });
  const dropped = game.drainEvents(); // start 期间的预报事件先丢掉
  assert.ok(Array.isArray(dropped));
  dropped.push({ type: "tampered" });
  de(game.drainEvents(), []); // 返回的是新数组，改它不影响引擎

  game.placement(19); // d3，向下夹住 d4
  await game.advance();
  const events = game.drainEvents();
  const moved = events.filter((e) => e.type === "moved");
  eq(moved.length, 1);
  eq(moved[0].index, 19);
  eq(moved[0].player, BLACK);
  de(moved[0].flips, [27]); // d4 = row3,col3
  eq(moved[0].lines.length, 1);
  de(moved[0].corners, []);
  eq(moved[0].trap, false); // d3 是内点，既非 X 位也非 C 位
  eq(events.filter((e) => e.type === "corner").length, 0);
  eq(events.filter((e) => e.type === "trap").length, 0);
  de(game.drainEvents(), []);
});

test("终局后 placement / tick / autoMove 全部 no-op（严禁弹窗、严禁负分）", async () => {
  const game = newGame();
  game.start();
  eq(game.resign(), true);
  const snap = game.snapshot();
  eq(snap.over, true);
  eq(game.placement(19), "ignored");
  eq(game.tick(99_999), null);
  eq(await game.autoMove(), -1);
  const after = await game.advance();
  eq(after.board.join(""), snap.board.join(""), "终局后任何推进都不得改动盘面");
  eq(after.moveCount, snap.moveCount);
});

// ─── 对手行动与思考预算 ───────────────────────────────────────────
test("对弈：advance 之后对手必须应手，控制权回到人类", async () => {
  const calls = [];
  const game = newGame({ think: firstMoveThink(calls) });
  game.start();
  eq(game.placement(19), "ready");
  const snap = await game.advance();
  eq(snap.moveCount, 2);
  eq(snap.current, BLACK);
  eq(snap.thinking, false);
  eq(calls.length, 1);
  eq(calls[0].player, WHITE);
  assert.ok(snap.legal.length > 0, "人类回合必须有合法着法");
});

test("思考预算：对弈交给档位默认 / 街机 220·60ms / 残局无限（精确优先）", async () => {
  const playCalls = [];
  const play = createGame({ think: firstMoveThink(playCalls), yielder: noYield, seed: 1 });
  play.start({ tier: TIER_VIRTUOSO });
  play.placement(19);
  await play.advance();
  eq(playCalls.at(-1).tier, TIER_VIRTUOSO);
  eq(playCalls.at(-1).budget.totalMs, undefined, "对弈不得覆盖档位自己的思考时长");
  eq(playCalls.at(-1).budget.hardMs, undefined);

  const rushCalls = [];
  const rushGame = createGame({ think: firstMoveThink(rushCalls), yielder: noYield, seed: 3 });
  const rushOpen = rushGame.start({ mode: MODES.RUSH });
  rushGame.placement(rushOpen.legal[0]);
  await rushGame.advance();
  eq(rushCalls.at(-1).tier, TIER_DUELIST, "街机用反应型档位，不看玩家选的档");
  eq(rushCalls.at(-1).budget.totalMs, 220);
  eq(rushCalls.at(-1).budget.hardMs, 60);

  const entry = puzzleById("p0101");
  const foeThink = queueThink([entry.bestLine[1]]);
  const puzzleGame = createGame({ think: foeThink, yielder: noYield, seed: 5 });
  puzzleGame.start({ mode: MODES.PUZZLE, puzzleId: "p0101" });
  puzzleGame.placement(entry.winningMoves[0]);
  await puzzleGame.advance();
  eq(foeThink.calls.length, 1);
  eq(foeThink.calls[0].tier, TIER_INFALLIBLE, "残局对手只走最优");
  eq(foeThink.calls[0].options.totalMs, Infinity);
  eq(foeThink.calls[0].options.hardMs, Infinity);
});

test("残局：对手必须自动应手，而不是让玩家替它走棋", async () => {
  const entry = puzzleById("p0101");
  const foeThink = queueThink([entry.bestLine[1]]);
  const game = newGame({ think: foeThink });
  const opened = game.start({ mode: MODES.PUZZLE, puzzleId: "p0101" });
  eq(opened.human, entry.side);
  eq(game.placement(entry.winningMoves[0]), "ready");
  const snap = await game.advance();
  eq(foeThink.consumed(), 1);
  eq(snap.moveCount, 2, "玩家一手 + 对手一手");
  eq(snap.puzzle.plies, 1, "只有玩家的着手被判定");
  eq(snap.current, entry.side, "对手走完必须回到玩家回合");
});

// ─── 残局：铜牌 / 错着 / 整线 ─────────────────────────────────────
test("残局开局：铜牌给出精确终局与最优首手，空位 ≤14 才点亮", () => {
  const entry = puzzleById("p0101");
  const snap = newGame().start({ mode: MODES.PUZZLE, puzzleId: "p0101" });
  eq(snap.rules, RULES_WOF, "残局恒用竞技口径");
  eq(snap.human, BLACK);
  eq(snap.puzzle.id, "p0101");
  eq(snap.puzzle.chapter, entry.chapter);
  eq(snap.puzzle.chapterKey, entry.chapterKey);
  eq(snap.puzzle.side, entry.side);
  eq(snap.puzzle.target, entry.bestDiff);
  eq(snap.puzzle.plies, 0);
  eq(snap.puzzle.status, "playing");
  eq(snap.puzzle.stars, 0);
  eq(snap.spend.undo, 0, "残局禁悔棋");
  eq(snap.spend.hint, null, "残局提示不限次");
  eq(snap.spend.undoLimit, UNDO_LIMIT);

  assert.ok(snap.forecast, "空位 6 ≤ 14，铜牌必须点亮");
  eq(snap.forecast.diff, entry.bestDiff);
  eq(snap.forecast.lead, entry.bestDiff);
  eq(snap.forecast.side, BLACK);
  de(snap.forecast.best, entry.winningMoves);
  eq(snap.legal.length, entry.legalMoves);
  eq(countDiscs(snap.board).empty, entry.empties);
  eq(snap.graph.length, 1);
  assert.ok(Array.isArray(snap.threat));
});

test("残局错着：只播报不落盘、记 wrongRetry，且允许无限次重选", async () => {
  const entry = puzzleById("p0101");
  const game = newGame();
  const opened = game.start({ mode: MODES.PUZZLE, puzzleId: "p0101" });
  const boardKey = opened.board.join("");
  const wrong = opened.legal.find((move) => !entry.winningMoves.includes(move));
  assert.ok(Number.isInteger(wrong), "本题必须存在非最优的合法着法");

  game.drainEvents();
  eq(game.placement(wrong), "ready");
  const snap = await game.advance();
  eq(snap.board.join(""), boardKey, "走错的手绝不落盘");
  eq(snap.moveCount, 0);
  eq(snap.puzzle.plies, 1);
  eq(snap.puzzle.wrongRetry, true);
  eq(snap.puzzle.firstMoveOptimal, false);
  eq(snap.puzzle.status, "playing", "错着不结束题目");
  eq(snap.status, STATUS_PLAYING);

  const judged = game.drainEvents().find((e) => e.type === "puzzle");
  eq(judged.phase, "wrong");
  eq(judged.value, entry.bestDiff);
  assert.ok(judged.loss > 0, "必须报出「这一步会输多少子」");
  eq(judged.after, entry.bestDiff - judged.loss);

  // 无限次重选：再来一次错着仍只是播报
  eq(game.placement(wrong), "ready");
  const again = await game.advance();
  eq(again.board.join(""), boardKey);
  eq(again.puzzle.plies, 2);
  eq(again.puzzle.wrongRetry, true);

  // 走对才推进
  eq(game.placement(entry.winningMoves[0]), "ready");
  const moved = await game.advance();
  assert.notEqual(moved.board.join(""), boardKey);
  eq(moved.puzzle.plies, 3);
  eq(moved.puzzle.firstMoveOptimal, false, "首手曾走错，三星资格已失");
});

test("残局走完整条 bestLine：解出、三星、终局子差恰等于题面 bestDiff", async () => {
  // 含 Pass 的题（同一方连走两手）与不含 Pass 的题都要覆盖
  const expectedPasses = { p0101: 3, p0110: 0, p0404: 1, p0607: 1 };
  for (const id of Object.keys(expectedPasses)) {
    const entry = puzzleById(id);
    const line = replayLine(entry);
    assert.ok(line, `${id} 的正解线必须全部合法`);

    const humanIndices = line.plies.filter((p) => p.player === entry.side).map((p) => p.index);
    const foeIndices = line.plies.filter((p) => p.player !== entry.side).map((p) => p.index);
    const think = queueThink(foeIndices);
    const game = newGame({ think });
    const opened = game.start({ mode: MODES.PUZZLE, puzzleId: id });
    eq(opened.human, entry.side);

    let passes = 0;
    let flips = 0;
    for (const index of humanIndices) {
      eq(game.placement(index), "ready", `${id} 的 ${index} 手应由玩家走出`);
      game.setVisualBusy(true);
      game.setVisualBusy(false);
      const step = await game.release();
      const events = game.drainEvents();
      passes += events.filter((e) => e.type === "pass").length;
      for (const ev of events) if (ev.type === "moved") flips += ev.flips.length;
      assert.ok(step.puzzle.plies <= humanIndices.length);
    }

    eq(think.consumed(), foeIndices.length, `${id} 对手的每一手都必须被走完`);
    eq(passes, expectedPasses[id], `${id} 的 Pass 事件数`);
    assert.ok(flips > 0);

    const snap = game.snapshot();
    eq(snap.status, STATUS_OVER);
    eq(snap.over, true);
    eq(snap.puzzle.status, "solved");
    eq(snap.puzzle.stars, 3, `${id} 全程最优应得三星`);
    eq(snap.puzzle.wrongRetry, false);
    eq(snap.puzzle.firstMoveOptimal, true);
    eq(snap.puzzle.plies, humanIndices.length);
    eq(snap.moveCount, line.plies.length);
    eq(snap.report.winner, entry.side);
    eq(snap.report.diff, entry.bestDiff);
    eq(snap.report.perfect, false);
    eq(snap.board.includes(EMPTY), false, "正解线走完盘面必须落满 64 子");
    eq(snap.forecast, null, "终局后铜牌必须收起");
    eq(snap.graph.length, line.plies.length + 1);
  }
});

// ─── 认输 ─────────────────────────────────────────────────────────
test("认输：保留真实子数、标记 resigned，绝不伪造 64:0 的完美局", async () => {
  const game = newGame();
  game.start();
  const before = countDiscs(game.snapshot().board);
  const key = game.snapshot().board.join("");

  eq(game.resign(), true);
  const snap = game.snapshot();
  eq(snap.status, STATUS_OVER);
  eq(snap.report.resigned, true);
  eq(snap.report.winner, WHITE, "人类执黑 → 判负");
  eq(snap.report.black, before.black);
  eq(snap.report.white, before.white);
  eq(snap.report.perfect, false, "认输不是完美局");
  eq(snap.report.diff, Math.abs(before.black - before.white));
  eq(snap.board.join(""), key, "认输不改盘面");
  de(snap.legal, []);
  eq(game.resign(), false, "二次认输 no-op");
  eq(game.placement(19), "ignored");
});

test("认输只在对弈模式可用，残局与街机一律拒绝", () => {
  const puzzleGame = newGame();
  puzzleGame.start({ mode: MODES.PUZZLE, puzzleId: "p0101" });
  eq(puzzleGame.resign(), false);
  eq(puzzleGame.snapshot().over, false);

  const rushGame = newGame();
  rushGame.start({ mode: MODES.RUSH });
  eq(rushGame.resign(), false);
  eq(rushGame.snapshot().over, false);
});

// ─── 计时与超时落子 ───────────────────────────────────────────────
test("tick：对弈（非闪电战）恒无事件；闪电战 10 秒到返回 blitz-timeout", async () => {
  const game = newGame();
  game.start();
  eq(game.tick(999_999), null);

  game.start({ blitz: true });
  eq(game.tick(BLITZ_TURN_MS - 1), null);
  eq(game.snapshot().blitzLeft, 1);
  eq(game.tick(1), "blitz-timeout");
  eq(game.snapshot().blitzLeft, BLITZ_TURN_MS, "触发后计时必须重置");
  eq(game.tick(0), null);
});

test("tick：街机 6 秒软倒计时 → rush-timeout；90 秒到 → rush-over 并结算", () => {
  const game = newGame();
  const opened = game.start({ mode: MODES.RUSH });
  eq(opened.rush.score, 0);
  eq(opened.rush.combo, 0);
  eq(opened.rush.multiplier, 1);
  eq(opened.rush.timeLeftMs, RUSH_DURATION_MS);
  eq(opened.rush.turnLeftMs, RUSH_TURN_MS);
  eq(opened.human, opened.current, "谁先手谁就是玩家");
  eq(countDiscs(opened.board).empty, RUSH_START_MOVES);
  eq(opened.spend.undo, 0);
  eq(opened.spend.hint, 0);

  eq(game.tick(1000), null);
  eq(game.snapshot().rush.turnLeftMs, RUSH_TURN_MS - 1000);
  eq(game.tick(RUSH_TURN_MS - 1000), "rush-timeout");
  eq(game.snapshot().rush.timeLeftMs, RUSH_DURATION_MS - RUSH_TURN_MS);

  eq(game.tick(RUSH_DURATION_MS), "rush-over");
  const snap = game.snapshot();
  eq(snap.over, true);
  eq(snap.rush.over, true);
  eq(snap.status, STATUS_OVER);
  eq(game.tick(1000), null, "已结束不再计时");
});

test("autoMove：超时自动落一手、连击归零、不判负，且翻转数只结算一次", async () => {
  const game = newGame();
  const opened = game.start({ mode: MODES.RUSH });
  const index = await game.autoMove();
  assert.ok(opened.legal.includes(index), "自动落子必须落在合法点上");

  const events = game.drainEvents();
  const moved = events.filter((e) => e.type === "moved");
  eq(moved.length, 2, "玩家一手 + 对手应手");
  eq(moved[0].index, index);
  eq(events.filter((e) => e.type === "auto").length, 1);

  const snap = game.snapshot();
  eq(moved[0].player, snap.human, "超时应替玩家落子");
  assert.ok(moved[0].flips.length >= 1);
  assert.notEqual(snap.board.join(""), opened.board.join(""));
  eq(snap.rush.combo, 0, "超时断连击");
  eq(snap.over, false, "超时不判负");
  // 三手以内倍率恒为 ×1（连击需累到 3 级才 +0.5），因此总分必须恰等于两手翻转数之和；
  // 若 autoMove 二次结算，这里会多出一份玩家那手的翻转数。
  eq(snap.rush.score, moved.reduce((sum, ev) => sum + ev.flips.length, 0));
  eq(snap.rush.turnLeftMs, RUSH_TURN_MS);
});

// ─── 提示 ─────────────────────────────────────────────────────────
test("提示（对弈）：走分块搜索、扣次数、3 次用尽后拒绝", async () => {
  const game = newGame();
  const opened = game.start();
  eq(opened.hint, -1);
  eq(opened.spend.hint, HINT_LIMIT);

  eq(await game.hint(), true);
  let snap = game.snapshot();
  eq(snap.hint, opened.legal[0], "注入的对手取最小合法索引作为提示");
  eq(snap.spend.hint, HINT_LIMIT - 1);

  eq(await game.hint(), true);
  eq(await game.hint(), true);
  snap = game.snapshot();
  eq(snap.spend.hint, 0);
  eq(await game.hint(), false);
  eq(game.snapshot().spend.hint, 0, "拒绝时不得再扣次数");
});

test("提示（残局）：给精确最优首手，不限次且不影响星级", async () => {
  const entry = puzzleById("p0101");
  const game = newGame();
  game.start({ mode: MODES.PUZZLE, puzzleId: "p0101" });
  for (let i = 0; i < 4; i += 1) eq(await game.hint(), true);
  const snap = game.snapshot();
  eq(snap.hint, entry.winningMoves[0]);
  eq(snap.spend.hint, null);
  eq(snap.puzzle.stars, 0);
  assert.ok(game.drainEvents().some((e) => e.type === "hint" && e.index === snap.hint));
});

// ─── 悔棋 ─────────────────────────────────────────────────────────
test("悔棋（对 AI）：一路退到重新轮到你，限 3 次/局", async () => {
  const game = newGame();
  game.start();
  eq(game.undo(), false, "未落子时无可悔");

  game.placement(19);
  await game.advance();
  eq(game.snapshot().moveCount, 2);
  eq(game.undo(), true);
  let snap = game.snapshot();
  eq(snap.moveCount, 0);
  eq(snap.current, BLACK);
  eq(snap.spend.undo, UNDO_LIMIT - 1);
  assert.ok(game.drainEvents().some((e) => e.type === "undo"));

  for (let i = 0; i < 2; i += 1) {
    game.placement(19);
    await game.advance();
    eq(game.undo(), true);
  }
  eq(game.snapshot().spend.undo, 0);
  game.placement(19);
  await game.advance();
  eq(game.undo(), false, "次数用尽");
  eq(game.snapshot().moveCount, 2);
});

test("悔棋（本地双人）：只退一手；残局与街机拒绝悔棋", async () => {
  const game = newGame();
  game.start({ pvp: true });
  game.placement(19);
  await game.advance();
  game.placement(18);
  await game.advance();
  eq(game.snapshot().moveCount, 2);
  eq(game.snapshot().current, BLACK);
  eq(game.undo(), true);
  eq(game.snapshot().moveCount, 1);
  eq(game.snapshot().current, WHITE);

  const puzzleGame = newGame();
  puzzleGame.start({ mode: MODES.PUZZLE, puzzleId: "p0101" });
  eq(puzzleGame.undo(), false);

  const rushGame = newGame();
  rushGame.start({ mode: MODES.RUSH });
  eq(rushGame.undo(), false);
});

test("悔棋下限是开局脚本之后的第一个局面：绝不退到脚本之前", async () => {
  const game = newGame();
  const opened = game.start({ side: WHITE, opening: "diagonal" });
  eq(opened.moveCount, 2, "对角开局预落两手");
  eq(opened.current, BLACK);
  eq(game.undo(), false, "开局脚本不算可悔的着手");

  const afterAi = await game.advance(); // AI 走出黑方的第一步
  eq(afterAi.moveCount, 3);
  eq(game.undo(), true);
  const snap = game.snapshot();
  assert.ok(snap.moveCount >= 2, `悔棋不得退到开局脚本之前（当前 ${snap.moveCount} 手）`);
  eq(snap.board.join(""), opened.board.join(""), "应恰好退回开局脚本走完的盘面");
});

// ─── 铜牌口径（定案 2A）─────────────────────────────────────────
test("铜牌只在 WOF 口径点亮：同一残局换成 classic 口径必须整块消失", async () => {
  // 用"总取最小合法索引"的双方陪跑，把一盘棋推到 14 空位以内；
  // WOF 是阳性对照（必须点亮），classic 是阴性对照（必须不出现）—— 读数口径不可混用。
  async function driveToPerfectZone(rules) {
    const game = newGame();
    game.start({ pvp: true, rules });
    for (let guard = 0; guard < 200; guard += 1) {
      const snap = game.snapshot();
      if (snap.over) return { reached: false };
      const move = snap.legal[0];
      if (!Number.isInteger(move)) return { reached: false };
      game.placement(move);
      const next = await game.advance();
      if (countDiscs(next.board).empty <= PERFECT_LIMIT) {
        return { reached: true, forecast: next.forecast, snap: next };
      }
    }
    return { reached: false };
  }

  const wof = await driveToPerfectZone(RULES_WOF);
  assert.ok(wof.reached, "陪跑必须能把对局推进到 14 空位以内");
  assert.ok(wof.forecast, "WOF 口径进入可精确求解区间后铜牌必须给出读数");
  eq(wof.forecast.lead, Math.abs(wof.forecast.diff));
  eq([BLACK, WHITE, EMPTY].includes(wof.forecast.side), true);
  assert.ok(wof.forecast.best.length > 0);
  for (const move of wof.forecast.best) assert.ok(wof.snap.legal.includes(move));

  const classic = await driveToPerfectZone(RULES_CLASSIC);
  assert.ok(classic.reached);
  eq(classic.forecast, null, "classic 口径下铜牌必须整块不出现");
  eq(classic.snap.rules, RULES_CLASSIC);
});

// ─── 派生值访问器 ─────────────────────────────────────────────────
test("派生值访问器：maxFlip / biggestSwing / highlights / puzzleRecord / rushResult", async () => {
  const game = newGame();
  // 用本地双人把历史压到"只有我这一手"，于是 swing 可以手算核对：
  // 1.d3 翻 1 枚、盘面 4:1，落子前并不落后 → swing = 1（落子）+ 1（翻转）+ 0（逆风加成）= 2。
  game.start({ pvp: true });
  eq(game.maxFlip(), null);
  eq(game.biggestSwing(), null);
  eq(game.puzzleRecord(), null);
  eq(game.rushResult(), null);
  eq(game.rushMultiplier(), 1);

  game.placement(19);
  await game.advance();
  const maxFlip = game.maxFlip();
  eq(maxFlip.moveNo, 1);
  eq(maxFlip.index, 19);
  eq(maxFlip.flips, 1);
  eq(maxFlip.black, 4);
  eq(maxFlip.white, 1);

  const swing = game.biggestSwing();
  eq(swing.moveNo, 1);
  eq(swing.deficitBefore, 0);
  eq(swing.swing, 2);
  eq(swing.after, 3);

  de(game.highlights({ maxFlip: 0, bestSwing: 0 }), { maxFlip: 1, bestSwing: 2 });
  de(game.highlights({ maxFlip: 5, bestSwing: 9 }), { maxFlip: 5, bestSwing: 9 }, "只升不降");
  de(game.highlights(null), { maxFlip: 1, bestSwing: 2 }, "空入参按零处理");

  const rushGame = newGame();
  rushGame.start({ mode: MODES.RUSH });
  de(rushGame.rushResult(), { score: 0, combo: 0 });
  eq(rushGame.rushMultiplier(), 1);
});

// ─── 源码铁律 ─────────────────────────────────────────────────────
test("源码铁律：game.mjs 零 DOM、零存储、零 Math.random、零自建定时器", () => {
  const code = GAME_SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  for (const token of ["document", "window", "localStorage", "sessionStorage", "Math.random", "setInterval", "requestAnimationFrame"]) {
    eq(code.includes(token), false, `game.mjs 不得出现 ${token}`);
  }
  // 唯一允许的计时器是默认 yielder 的 setTimeout（把主线程让出去），其余时间一律由 tick(dt) 注入
  eq(code.includes("new Date"), false);
  eq(code.includes("Date.now"), false);
});
