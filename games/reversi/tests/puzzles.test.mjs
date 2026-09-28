import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  BLACK, EMPTY, CELL_COUNT,
  other, legalMoves, countDiscs, isXSquare, isCSquare,
  flipLines, placeDisc, parseBoard, createState, applyMove, finalScore,
  STATUS_OVER,
} from "../js/engine.mjs";
import { solveExact, finalDiff } from "../js/solver.mjs";
import { CHAPTERS, PUZZLES, PUZZLE_COUNT, chapterPuzzles, puzzleById } from "../js/puzzles.mjs";
// 章节判据与阈值只有一份来源（产线工具），测试直接引它，避免两处各写一套判据后漂移。
import { CHAPTER_KEYS, MAX_EMPTIES, PER_CHAPTER, MIN_DIFF, CHAPTER_RULES } from "../tools/gen-puzzles.mjs";

const eq = assert.strictEqual;
const de = assert.deepStrictEqual;

const PUZZLE_FILE = new URL("../js/puzzles.mjs", import.meta.url);

// 逐题复核很贵（空位 14 的完美求解约 0.4s），把"重跑求解器"的结果缓存复用。
const solveCache = new Map();
function exactFor(board, side) {
  const key = `${board.join("")}|${side}`;
  let hit = solveCache.get(key);
  if (!hit) {
    hit = solveExact(board, side);
    solveCache.set(key, hit);
  }
  return hit;
}

// ─── 数据层契约 ───────────────────────────────────────────────────
test("题库结构：6 章 × 10 题 = 60 题，章节表与题目一一对应", () => {
  eq(PUZZLE_COUNT, 60);
  eq(PUZZLES.length, 60);
  eq(CHAPTERS.length, 6);
  eq(PER_CHAPTER, 10);
  de(CHAPTERS.map((ch) => ch.key), CHAPTER_KEYS);
  de(CHAPTERS.map((ch) => ch.number), [1, 2, 3, 4, 5, 6]);
  for (const ch of CHAPTERS) {
    eq(ch.count, PER_CHAPTER);
    eq(chapterPuzzles(ch.number).length, PER_CHAPTER, `第 ${ch.number} 章题量`);
  }
  // 章节上限必须非递减：这是"★ → ★★★★★"难度阶梯的硬编码来源
  eq(MAX_EMPTIES.length, CHAPTERS.length);
  for (let i = 1; i < MAX_EMPTIES.length; i += 1) {
    assert.ok(MAX_EMPTIES[i] >= MAX_EMPTIES[i - 1], `第 ${i + 1} 章的空位上限不得比上一章更紧`);
  }
});

test("数据层零中文：puzzles.mjs 的数据与代码里不允许出现任何汉字（文案由 i18n 提供）", () => {
  const text = readFileSync(PUZZLE_FILE, "utf8");
  const hanPattern = /[\u3400-\u4dbf\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/;
  // 注释是文档、不受此约束（项目全站注释都是中文）；被约束的是"代码与数据本身"。
  const code = text.split("\n").filter((line) => !line.trimStart().startsWith("//")).join("\n");
  const inCode = code.match(new RegExp(hanPattern, "g"));
  eq(inCode, null, `代码层混入中文：${(inCode ?? []).slice(0, 20).join("")}`);

  // 字段值逐个复核：这是"数据层"的真正边界
  for (const puzzle of PUZZLES) {
    for (const [field, value] of Object.entries(puzzle)) {
      if (typeof value === "string") {
        assert.ok(!hanPattern.test(value), `${puzzle.id}.${field} 含中文：${value}`);
      }
    }
    assert.match(puzzle.id, /^p0[1-6](0[1-9]|10)$/, `id 格式 ${puzzle.id}`);
    assert.match(puzzle.chapterKey, /^[a-z-]+$/);
    eq(typeof puzzle.board, "string");
    eq(puzzle.side, BLACK);
  }
});

test("元数据契约：字段齐全、board 为 64 字符三态串、题面计数与实际盘面一致", () => {
  const ids = new Set();
  for (const puzzle of PUZZLES) {
    assert.ok(!ids.has(puzzle.id), `id 重复：${puzzle.id}`);
    ids.add(puzzle.id);
    for (const field of ["id", "chapter", "chapterKey", "side", "board", "empties", "legalMoves", "bestDiff", "winningMoves", "bestLine", "difficulty"]) {
      assert.ok(puzzle[field] !== undefined, `${puzzle.id} 缺少字段 ${field}`);
    }
    eq(puzzle.board.length, CELL_COUNT, `${puzzle.id} 盘面长度`);
    assert.match(puzzle.board, /^[BW.]{64}$/, `${puzzle.id} 盘面只能含 B / W / .`);

    const board = parseBoard(puzzle.board);
    assert.ok(board, `${puzzle.id} 盘面必须可解析`);
    const discs = countDiscs(board);
    const moves = legalMoves(board, puzzle.side);
    eq(discs.empty, puzzle.empties, `${puzzle.id} 空位数`);
    eq(moves.length, puzzle.legalMoves, `${puzzle.id} 合法落点数`);
    assert.ok(discs.black >= 1 && discs.white >= 1, `${puzzle.id} 双方都必须有子`);
    assert.ok(discs.empty > 0 && discs.empty <= MAX_EMPTIES[puzzle.chapter - 1], `${puzzle.id} 空位数越界：${discs.empty}`);

    // 题面必须"有得选"：至少 4 个合法落点，唯一解才有区分度
    assert.ok(moves.length >= 4, `${puzzle.id} 合法落点过少：${moves.length}`);
    eq(puzzle.winningMoves.length, 1, `${puzzle.id} 硬指标要求唯一最优首手`);
    assert.ok(puzzle.winningMoves.every((move) => moves.includes(move)), `${puzzle.id} 最优首手必须合法`);
    assert.ok(puzzle.bestDiff >= MIN_DIFF, `${puzzle.id} 分差必须 ≥ ${MIN_DIFF}`);
    eq(puzzle.chapterKey, CHAPTER_KEYS[puzzle.chapter - 1], `${puzzle.id} 章号与 chapterKey 必须一致`);
    assert.ok(Number.isFinite(puzzle.difficulty) && puzzle.difficulty > 0, `${puzzle.id} difficulty`);
    eq(puzzle.bestLine.length, puzzle.empties, `${puzzle.id} 最优线长度应等于空位数`);
  }
  eq(ids.size, 60);
  eq(puzzleById(PUZZLES[0].id), PUZZLES[0]);
  eq(puzzleById("no-such-id"), null);
});

// ─── 章节教学重点复核（按盘面重新判定，不信生成器的自述）─────────
test("章节判据复核：每道题都必须真的落在它那一章的教学重点上", () => {
  for (const puzzle of PUZZLES) {
    const board = parseBoard(puzzle.board);
    const side = puzzle.side;
    const moves = legalMoves(board, side);
    const best = puzzle.winningMoves[0];
    const lines = flipLines(board, best, side);
    const discs = countDiscs(board);
    const info = {
      best,
      empties: puzzle.empties,
      moveCount: moves.length,
      flips: lines.reduce((sum, line) => sum + line.length, 0),
      directions: lines.length,
      deficit: side === BLACK ? discs.white - discs.black : discs.black - discs.white,
      opponentMovesAfter: legalMoves(placeDisc(board, best, side), other(side)).length,
      trapMoves: moves.filter((move) => isXSquare(move) || isCSquare(move)),
    };
    assert.ok(
      CHAPTER_RULES[puzzle.chapterKey](info, MAX_EMPTIES[puzzle.chapter - 1]),
      `${puzzle.id}（${puzzle.chapterKey}）不满足本章判据：${JSON.stringify(info)}`,
    );
  }
});

// ─── 求解器权威复核（题库正确性的唯一护栏）───────────────────────
test("权威复核：逐题重跑完美求解器，bestDiff 与 winningMoves 必须逐位吻合", () => {
  const started = Date.now();
  let slowest = 0;
  for (const puzzle of PUZZLES) {
    const board = parseBoard(puzzle.board);
    const t0 = Date.now();
    const solved = exactFor(board, puzzle.side);
    slowest = Math.max(slowest, Date.now() - t0);
    eq(solved.score, puzzle.bestDiff, `${puzzle.id} bestDiff 与求解器不符`);
    de(solved.moves, puzzle.winningMoves, `${puzzle.id} 最优首手集合与求解器不符`);
    eq(solved.exact, true, `${puzzle.id} 求解器必须给出精确解`);
  }
  const cold = Date.now() - started;
  assert.ok(cold < 40000, `整库冷启动复核 ${cold}ms，超出预算`);
  assert.ok(slowest < 5000, `单题最慢 ${slowest}ms`);
});

test("最优线复核：按 bestLine 逐手落子必须合法，且终局子差恰为 bestDiff", () => {
  for (const puzzle of PUZZLES) {
    let state = createState({ board: puzzle.board, current: puzzle.side });
    let played = 0;
    for (const move of puzzle.bestLine) {
      const legal = legalMoves(state.board, state.current);
      assert.ok(legal.includes(move), `${puzzle.id} 第 ${played + 1} 手 ${move} 不合法`);
      const next = applyMove(state, move);
      assert.notStrictEqual(next, state, `${puzzle.id} 第 ${played + 1} 手未被引擎接受`);
      state = next;
      played += 1;
    }
    eq(played, puzzle.bestLine.length);
    eq(countDiscs(state.board).empty, 0, `${puzzle.id} 最优线走完应铺满棋盘`);
    eq(state.status, STATUS_OVER, `${puzzle.id} 最优线走完必须是终局`);
    eq(finalDiff(state.board, puzzle.side), puzzle.bestDiff, `${puzzle.id} 最优线终局子差`);
    const score = finalScore(state.board);
    eq(score.black + score.white, CELL_COUNT, `${puzzle.id} 终局总子数必须为 64`);
    eq(Math.abs(score.black - score.white), puzzle.bestDiff, `${puzzle.id} 终局分差的绝对值`);
  }
});

test("最优线逐手最优：空位 ≤ 10 的题，线上每一手都必须是当时的最优解", () => {
  let checked = 0;
  for (const puzzle of PUZZLES) {
    if (puzzle.empties > 10) continue; // 高空的完美求解太贵，逐手复核只做便宜的那批
    checked += 1;
    // 必须走 createState/applyMove：applyMove 内部会自动结算让位，
    // state.current 因此永远是"下一步该由谁走"。手工 other(side) 交替会在让位处错位。
    let state = createState({ board: puzzle.board, current: puzzle.side });
    for (const move of puzzle.bestLine) {
      const solved = exactFor(state.board, state.current);
      assert.ok(
        solved.moves.includes(move),
        `${puzzle.id} 线中第 ${move} 手（${state.moves.length + 1} 手）不是当时的最优解`,
      );
      state = applyMove(state, move);
    }
  }
  assert.ok(checked >= 20, `便宜题样本过少：${checked}`);
});

// ─── 教学属性 ─────────────────────────────────────────────────────
test("可失败性：每题都有多个会输的分支，且最优与最劣差距足够大", () => {
  let sampled = 0;
  for (const puzzle of PUZZLES) {
    const board = parseBoard(puzzle.board);
    const moves = legalMoves(board, puzzle.side);
    const losers = moves.filter((move) => !puzzle.winningMoves.includes(move));
    assert.ok(losers.length >= 3, `${puzzle.id} 非最优分支过少：${losers.length}`);

    // 空位 ≤ 9 的题便宜，逐个精确复算"错着会输多少"；更深的题只保证分支数量。
    if (puzzle.empties > 9) continue;
    sampled += 1;
    let worst = Infinity;
    for (const move of losers) {
      worst = Math.min(worst, -exactFor(placeDisc(board, move, puzzle.side), other(puzzle.side)).score);
    }
    assert.ok(puzzle.bestDiff - worst >= 4, `${puzzle.id} 最优 ${puzzle.bestDiff} 与最劣 ${worst} 差距过小`);
  }
  assert.ok(sampled >= 20, `错着样本过少：${sampled}`);
});

test("难度阶梯：空位整体上行（第 5、6 章最深），同章内按 difficulty 降序排列", () => {
  const stats = CHAPTERS.map((ch) => {
    const list = chapterPuzzles(ch.number);
    const empties = list.map((p) => p.empties);
    return {
      chapter: ch.number,
      min: Math.min(...empties),
      max: Math.max(...empties),
      mean: empties.reduce((sum, value) => sum + value, 0) / empties.length,
      sorted: list.every((p, i) => i === 0 || list[i - 1].difficulty >= p.difficulty),
    };
  });
  const mean = (n) => stats[n - 1].mean;

  // 第 1-3 章与第 4-6 章各自严格上行。第 4 章（连环翻）的难度来自"翻型"而不是深度，
  // 所以它只保证比第 1 章深、比第 5 章浅，不与第 3 章比深浅（数据实况如此，不硬掰）。
  assert.ok(mean(1) < mean(2), `ch1 ${mean(1)} vs ch2 ${mean(2)}`);
  assert.ok(mean(2) < mean(3), `ch2 ${mean(2)} vs ch3 ${mean(3)}`);
  assert.ok(mean(4) > mean(1), `ch4 ${mean(4)} vs ch1 ${mean(1)}`);
  assert.ok(mean(4) < mean(5), `ch4 ${mean(4)} vs ch5 ${mean(5)}`);
  assert.ok(mean(5) <= mean(6), `ch5 ${mean(5)} vs ch6 ${mean(6)}`);
  // 最后两章是"最深的残局"，必须明显比入门章深
  assert.ok(stats[4].min >= 12 && stats[5].min >= 12, `ch5 min ${stats[4].min} / ch6 min ${stats[5].min}`);
  assert.ok(mean(6) >= 13, `ch6 平均空位 ${mean(6)} 偏浅`);
  for (const item of stats) assert.ok(item.sorted, `第 ${item.chapter} 章未按 difficulty 降序排列`);

  // 第 6 章的题必须全部落在 12-14（PRD 指定的"终局精算"区间）
  for (const puzzle of chapterPuzzles(6)) {
    assert.ok(puzzle.empties >= 12 && puzzle.empties <= 14, `${puzzle.id} 空位 ${puzzle.empties} 不在 12-14`);
  }
});

test("题库无死局：任何一题行棋方都有子可下，且求解结果可复用（缓存命中）", () => {
  for (const puzzle of PUZZLES) {
    const board = parseBoard(puzzle.board);
    assert.ok(legalMoves(board, puzzle.side).length > 0, `${puzzle.id} 行棋方无子可下`);
    assert.ok(countDiscs(board).empty > 0, `${puzzle.id} 不能是终局`);
  }
  // 冷启动已在上一批测试里付过账，这里必须全部命中缓存 —— 同一份结果只烧一次 CPU
  const before = solveCache.size;
  for (const puzzle of PUZZLES) exactFor(parseBoard(puzzle.board), puzzle.side);
  eq(solveCache.size, before);
  assert.ok(before >= 60, `缓存条目过少：${before}`);
});
