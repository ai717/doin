// filepath: games/jigsaw/tests/score.test.mjs
// 计分口径回归：与 PRD §4 算例逐项对齐，并守住"总分永不超过该难度满分"的铁律。
import test from "node:test";
import assert from "node:assert/strict";

import {
  BASE_SCORE,
  DAILY_BONUS,
  MOVE_MAX,
  MOVE_FLOOR,
  MOVE_PENALTY,
  TIME_MAX,
  TIME_FLOOR,
  PERFECT,
  DAILY_PERFECT,
  baseScoreFor,
  perfectScoreFor,
  targetSeconds,
  moveScore,
  timeScore,
  scoreRun,
  formatTime,
} from "../js/score.mjs";

test("满分常量自洽", () => {
  assert.equal(PERFECT, 800);
  assert.equal(DAILY_PERFECT, 950);
  assert.equal(BASE_SCORE + MOVE_MAX + TIME_MAX, PERFECT);
  assert.equal(PERFECT + DAILY_BONUS, DAILY_PERFECT);
});

test("PRD §4 算例 L1：3×3 par 12，8 步 40 秒 -> 800", () => {
  const run = scoreRun({ moves: 8, timeMs: 40_000, par: 12 });
  assert.equal(run.base, 200);
  assert.equal(run.move, 500);
  assert.equal(run.time, 100);
  assert.equal(run.total, 800);
});

test("PRD §4 算例 L25：4×4 par 20，35 步 180 秒 -> 709", () => {
  const run = scoreRun({ moves: 35, timeMs: 180_000, par: 20 });
  assert.equal(run.move, 500 - 5 * 15);
  assert.equal(run.time, 100 - 8 * 2);
  assert.equal(run.total, 200 + 425 + 84);
  assert.equal(run.total, 709);
});

test("PRD §4 算例 L50：5×5 par 30，75 步 400 秒 -> 步数硬保底 + 时间分按公式", () => {
  // PRD 算例把这一行的时间分写成"保底 20"，与它自己给出的公式不自洽；
  // 以公式为准：target = 60 + 30*2 = 120s，超时 280s -> 100 - 28*2 = 44。
  const run = scoreRun({ moves: 75, timeMs: 400_000, par: 30 });
  assert.equal(run.move, MOVE_FLOOR);
  assert.equal(run.time, 44);
  assert.equal(run.total, 200 + 100 + 44);
});

test("步数分：三段式 —— ≤ par 满分；par..2par 每步 -5；超过 2par 硬保底", () => {
  assert.equal(moveScore(0, 12), MOVE_MAX);
  assert.equal(moveScore(12, 12), MOVE_MAX);
  assert.equal(moveScore(13, 12), MOVE_MAX - MOVE_PENALTY);
  assert.equal(moveScore(20, 12), MOVE_MAX - 8 * MOVE_PENALTY);
  assert.equal(moveScore(24, 12), MOVE_MAX - 12 * MOVE_PENALTY, "2×par 仍在衰减段内");
  assert.equal(moveScore(25, 12), MOVE_FLOOR, "越过 2×par 即落到硬保底");
  assert.equal(moveScore(9999, 12), MOVE_FLOOR);
  assert.equal(moveScore(-5, 12), MOVE_MAX);
});

test("时间分：≤ 目标满分；每超 10 秒 -2；保底 20", () => {
  assert.equal(targetSeconds(12), 84);
  assert.equal(targetSeconds(20), 100);
  assert.equal(targetSeconds(30), 120);
  assert.equal(timeScore(0, 12), TIME_MAX);
  assert.equal(timeScore(84_000, 12), TIME_MAX);
  assert.equal(timeScore(94_000, 12), TIME_MAX - 2);
  assert.equal(timeScore(84_000 + 400_000, 12), TIME_FLOOR);
  assert.equal(timeScore(Number.NaN, 12), TIME_MAX);
  assert.equal(timeScore(-1, 12), TIME_MAX);
});

test("异常入参不产生 NaN / 负分", () => {
  for (const moves of [undefined, null, Number.NaN, -3, "x", 1e9]) {
    const value = moveScore(moves, 12);
    assert.ok(Number.isFinite(value) && value >= MOVE_FLOOR && value <= MOVE_MAX, `moveScore(${moves}) = ${value}`);
  }
  for (const time of [undefined, null, Number.NaN, -1000, "x", 1e12]) {
    const value = timeScore(time, 12);
    assert.ok(Number.isFinite(value) && value >= TIME_FLOOR && value <= TIME_MAX, `timeScore(${time}) = ${value}`);
  }
  for (const par of [undefined, null, Number.NaN, 0, -7]) {
    const value = targetSeconds(par);
    assert.ok(Number.isFinite(value) && value >= 60, `targetSeconds(${par}) = ${value}`);
  }
});

test("今日精选：基础分 +150，满分 950", () => {
  assert.equal(baseScoreFor(false), 200);
  assert.equal(baseScoreFor(true), 350);
  assert.equal(perfectScoreFor(false), 800);
  assert.equal(perfectScoreFor(true), 950);

  const run = scoreRun({ moves: 5, timeMs: 30_000, par: 12, isDaily: true });
  assert.equal(run.base, 350);
  assert.equal(run.total, 950);
});

test("铁律：总分永不超过该难度满分", () => {
  for (const isDaily of [false, true]) {
    const cap = perfectScoreFor(isDaily);
    for (const moves of [0, 5, 12, 40, 100000]) {
      for (const timeMs of [0, 1000, 60_000, 3_600_000, 1e12]) {
        const run = scoreRun({ moves, timeMs, par: 12, isDaily });
        assert.ok(run.total <= cap, `total=${run.total} 超过满分 ${cap}`);
        assert.ok(run.total >= 0);
      }
    }
  }
});

test("formatTime：mm:ss，超长钳制到 99:59", () => {
  assert.equal(formatTime(0), "00:00");
  assert.equal(formatTime(1000), "00:01");
  assert.equal(formatTime(59_000), "00:59");
  assert.equal(formatTime(60_000), "01:00");
  assert.equal(formatTime(3_599_000), "59:59");
  assert.equal(formatTime(1e12), "99:59");
  assert.equal(formatTime(-5), "00:00");
  assert.equal(formatTime(Number.NaN), "00:00");
});
