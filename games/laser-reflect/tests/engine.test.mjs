// engine.test.mjs：规则纯函数、光路追踪、胜负判定、无死局保证、1000 步随机游走。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  trace,
  isSolved,
  rotate,
  verifySolvable,
  randomWalk,
  starRating,
  MIRROR,
  SPLITTER,
  SPECTRO,
  FILTER,
  EMITTER,
  TARGET,
  WALL,
  WHITE,
  RED,
  GREEN,
  BLUE,
  ROTATABLE,
} from "../js/engine.mjs";
import { LEVELS, LEVEL_COUNT } from "../js/levels.mjs";

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("白光直行点亮白色靶", () => {
  const level = {
    rows: 1, cols: 3, par: 1,
    cells: [
      { type: EMITTER, r: 0, c: 0, dir: 1 },
      { type: TARGET, r: 0, c: 2, targetColor: WHITE },
    ],
  };
  assert.equal(isSolved(level), true);
  const r = trace(level);
  assert.equal(r.litTargets.size, 1);
});

test("镜子反射 90°", () => {
  // 发射器(0,0)向南，镜 "/"在(2,0)把 S 反射到 W，靶在(2,-1) 出界则用别的方式。
  // 用 E 入射：发射器(0,0)向东，镜 "/" 在(0,2) 把 E 反射到 N，靶在(-1,2) 出界。
  // 改用：发射器(0,0)向东，镜 "\"(1)在(0,2) 把 E 反射到 S，靶在(2,2)。
  const level = {
    rows: 3, cols: 3, par: 1,
    cells: [
      { type: EMITTER, r: 0, c: 0, dir: 1 },
      { type: MIRROR, r: 0, c: 2, mirror: 1 },
      { type: TARGET, r: 2, c: 2, targetColor: WHITE },
    ],
  };
  assert.equal(isSolved(level), true);
});

test("分光器一路直行一路反射", () => {
  // 发射器(0,0)向南，分光器 "\"(1) 在(2,0)：直行 S + 反射（"\": S->E）
  // 直行到(3,0)，反射到(2,2)
  const level = {
    rows: 4, cols: 3, par: 1,
    cells: [
      { type: EMITTER, r: 0, c: 0, dir: 2 },
      { type: SPLITTER, r: 2, c: 0, mirror: 1 },
      { type: TARGET, r: 3, c: 0, targetColor: WHITE },
      { type: TARGET, r: 2, c: 2, targetColor: WHITE },
    ],
  };
  const r = trace(level);
  assert.equal(r.litTargets.size, 2);
  assert.equal(isSolved(level), true);
});

test("滤色片：白光染色，异色吸收", () => {
  // 白光过红片变红光，点亮红靶
  const ok = {
    rows: 1, cols: 4, par: 1,
    cells: [
      { type: EMITTER, r: 0, c: 0, dir: 1 },
      { type: FILTER, r: 0, c: 2, color: RED },
      { type: TARGET, r: 0, c: 3, targetColor: RED },
    ],
  };
  assert.equal(isSolved(ok), true);

  // 白光过红片变红光，但靶是蓝色 → 不解
  const no = {
    rows: 1, cols: 4, par: 1,
    cells: [
      { type: EMITTER, r: 0, c: 0, dir: 1 },
      { type: FILTER, r: 0, c: 2, color: RED },
      { type: TARGET, r: 0, c: 3, targetColor: BLUE },
    ],
  };
  assert.equal(isSolved(no), false);
});

test("分色棱镜：白光拆成 RGB 三束", () => {
  // 发射器(0,2)向南，spectro在(2,2)，红直行(4,2)，绿左偏(2,0)，蓝右偏(2,4)
  const level = {
    rows: 5, cols: 5, par: 1,
    cells: [
      { type: EMITTER, r: 0, c: 2, dir: 2 },
      { type: SPECTRO, r: 2, c: 2 },
      { type: TARGET, r: 4, c: 2, targetColor: RED },
      { type: TARGET, r: 2, c: 0, targetColor: GREEN },
      { type: TARGET, r: 2, c: 4, targetColor: BLUE },
    ],
  };
  assert.equal(isSolved(level), true);
});

test("墙终止光束", () => {
  const level = {
    rows: 1, cols: 4, par: 1,
    cells: [
      { type: EMITTER, r: 0, c: 0, dir: 1 },
      { type: WALL, r: 0, c: 1 },
      { type: TARGET, r: 0, c: 3, targetColor: WHITE },
    ],
  };
  assert.equal(isSolved(level), false);
});

test("rotate 只旋转可旋转元件", () => {
  const level = {
    rows: 2, cols: 2, par: 1,
    cells: [
      { type: MIRROR, r: 0, c: 0, mirror: 0 },
      { type: TARGET, r: 0, c: 1, targetColor: WHITE },
    ],
  };
  const rotated = rotate(level, 0, 0);
  assert.equal(rotated[0].mirror, 1);
  // 旋转靶（不可旋转）应原样返回
  const unchanged = rotate(level, 0, 1);
  assert.equal(unchanged[1].mirror, undefined);
});

test("starRating 星级分级", () => {
  assert.equal(starRating(2, 3), 3); // <=par
  assert.equal(starRating(5, 3), 2); // <=2*par
  assert.equal(starRating(7, 3), 1); // 其余
});

test("所有关卡 100% 可解且 par 内存在解", () => {
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const spec = LEVELS[i];
    const level = { rows: spec.rows, cols: spec.cols, par: spec.par, cells: spec.cells.map((c) => ({ ...c })) };
    const v = verifySolvable(level);
    assert.equal(v.solvable, true, `L${i + 1} 不可解`);
    assert.ok(v.minMoves <= spec.par, `L${i + 1} minMoves=${v.minMoves} > par=${spec.par}`);
  }
});

test("1000 步随机游走不抛错、不变式守恒", () => {
  const rng = mulberry32(12345);
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const spec = LEVELS[i];
    const level = { rows: spec.rows, cols: spec.cols, par: spec.par, cells: spec.cells.map((c) => ({ ...c })) };
    const walked = randomWalk(level, rng, 1000);
    // 随机游走结束后仍能 trace 且不抛错
    const r = trace(walked);
    assert.ok(r.litTargets.size <= r.targetCount);
    // 元件数量不变
    assert.equal(walked.cells.length, level.cells.length);
  }
});

test("光路循环不会死循环（分光器成环）", () => {
  // 构造一个可能成环的布局：两个分光器对射
  const level = {
    rows: 3, cols: 3, par: 1,
    cells: [
      { type: EMITTER, r: 0, c: 1, dir: 2 },
      { type: SPLITTER, r: 1, c: 1, mirror: 0 },
      { type: SPLITTER, r: 2, c: 1, mirror: 0 },
      { type: TARGET, r: 2, c: 2, targetColor: WHITE },
    ],
  };
  // 不应抛错，且能返回结果
  const r = trace(level);
  assert.ok(Array.isArray(r.rays));
});
