import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIFFICULTY_BASE,
  DIFFICULTY_PAR_MS,
  baseFor,
  parMs,
  timeScore,
  scoreResult,
  breakdown,
} from "../js/score.mjs";

test("baseFor / parMs：未知难度回退初级，且难度越高基础分越高", () => {
  assert.equal(baseFor("beginner"), DIFFICULTY_BASE.beginner);
  assert.equal(baseFor("nope"), DIFFICULTY_BASE.beginner);
  assert.ok(baseFor("intermediate") > baseFor("beginner"));
  assert.ok(baseFor("expert") > baseFor("intermediate"));
  assert.equal(parMs("expert"), DIFFICULTY_PAR_MS.expert);
});

test("timeScore：越快越高，par 时归零，超过 par 不为负", () => {
  const d = "intermediate";
  const par = parMs(d);
  assert.equal(timeScore(0, d), 0);
  assert.equal(timeScore(par, d), 0);
  assert.equal(timeScore(par * 2, d), 0);
  const fast = timeScore(par / 2, d);
  const faster = timeScore(par / 4, d);
  assert.ok(fast > 0);
  assert.ok(faster > fast, "更短用时拿更高时间分");
  assert.ok(faster <= Math.round(baseFor(d) * 0.6), "不会超过时间分上限");
});

test("timeScore：失败或非法输入得 0", () => {
  assert.equal(timeScore(-100, "beginner"), 0);
  assert.equal(timeScore(NaN, "beginner"), 0);
  assert.equal(timeScore("x", "beginner"), 0);
});

test("scoreResult：仅通关计分，失败得 0", () => {
  const win = scoreResult({ outcome: "win", difficulty: "beginner", elapsedMs: 5000 });
  assert.ok(win.base > 0);
  assert.ok(win.time > 0);
  assert.equal(win.total, win.base + win.time);

  const loss = scoreResult({ outcome: "loss", difficulty: "beginner", elapsedMs: 5000 });
  assert.equal(loss.base, 0);
  assert.equal(loss.time, 0);
  assert.equal(loss.total, 0);
});

test("scoreResult：难度越高同时间得分越高（基础分主导）", () => {
  const b = scoreResult({ outcome: "win", difficulty: "beginner", elapsedMs: 5000 }).total;
  const e = scoreResult({ outcome: "win", difficulty: "expert", elapsedMs: 5000 }).total;
  assert.ok(e > b);
});

test("scoreResult：默认参数安全（不抛异常、失败口径）", () => {
  const r = scoreResult();
  assert.equal(r.total, 0);
  assert.equal(r.base, 0);
});

test("breakdown：返回基础分/时间分/合计三行", () => {
  const rows = breakdown({ outcome: "win", difficulty: "intermediate", elapsedMs: 30000 });
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.key), ["base", "time", "total"]);
  const total = rows.find((r) => r.key === "total").value;
  const sum = rows.filter((r) => r.key !== "total").reduce((a, r) => a + r.value, 0);
  assert.equal(total, sum);
});
