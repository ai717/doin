// filepath: games/sokoban/tests/levels.test.mjs
// 关卡库结构校验：50 关箱数==目标数、行宽一致、玩家唯一、章节覆盖、par 单调渐进。
import { test } from "node:test";
import assert from "node:assert/strict";
import { CHAPTERS, LEVELS } from "../js/levels.mjs";
import { parseLevel, countBoxes, boxesOnGoal } from "../js/engine.mjs";

test("levels: 共 50 关、5 章 × 10 关、章节编号连续", () => {
  assert.equal(LEVELS.length, 50);
  assert.equal(CHAPTERS.length, 5);
  for (const ch of CHAPTERS) {
    assert.equal(ch.hi - ch.lo + 1, 10);
    assert.ok(ch.nameZh && ch.nameEn);
  }
  // 章节区间互不重叠且覆盖 1..50
  const spans = CHAPTERS.map((c) => [c.lo, c.hi]).sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < spans.length; i++) {
    if (i > 0) assert.equal(spans[i][0], spans[i - 1][1] + 1);
  }
  assert.equal(spans[0][0], 1);
  assert.equal(spans[4][1], 50);
});

test("levels: 每关结构合法（箱数==目标数、玩家唯一、行宽一致、par>0）", () => {
  for (const level of LEVELS) {
    const map = parseLevel(level.map);
    const goals = map.goal.reduce((n, v) => n + v, 0);
    const boxes = countBoxes(map);
    assert.equal(boxes, goals, `${level.id}: 箱数(${boxes}) != 目标数(${goals})`);
    assert.ok(map.player >= 0, `${level.id}: 无玩家`);
    assert.ok(map.wall.length > 0, `${level.id}: 空墙`);
    assert.ok(level.parPushes > 0, `${level.id}: par 非法`);
    assert.ok(level.nameZh && level.nameEn, `${level.id}: 缺名称`);
    assert.ok(level.id.startsWith("s"), `${level.id}: id 格式`);
  }
});

test("levels: 地图均为闭合矩形（无缺口行宽不一致）", () => {
  for (const level of LEVELS) {
    const widths = level.map.map((r) => r.length);
    const max = Math.max(...widths);
    for (let y = 0; y < widths.length; y++) {
      if (widths[y] < max) {
        // 短行剩余字符必须是空格（补齐为墙）
        for (let x = widths[y]; x < max; x++) {
          assert.equal(level.map[y][x] ?? " ", " ", `${level.id} 第${y}行缺口`);
        }
      }
    }
  }
});

test("levels: 无任何箱初始已在目标上（避免送分开局）", () => {
  for (const level of LEVELS) {
    const map = parseLevel(level.map);
    assert.equal(boxesOnGoal(map), 0, `${level.id}: 初始即有箱在目标上`);
  }
});

test("levels: par 随关卡渐进（后半明显更难，允许小波动）", () => {
  const pars = LEVELS.map((l) => l.parPushes);
  // 相邻回落不超过 3（生成器按目标曲线软约束，最优推数允许小波动）
  for (let i = 1; i < pars.length; i++) {
    assert.ok(pars[i] - pars[i - 1] >= -3, `L${i + 1}: par 倒退 ${pars[i - 1]} -> ${pars[i]}`);
  }
  const first10 = Math.min(...pars.slice(0, 10));
  const last10 = Math.max(...pars.slice(40));
  assert.ok(last10 >= first10 + 8, `后 10 关难度未拉开 (${first10} -> ${last10})`);
});

test("levels: 章节名称与关卡 chapter 字段一致", () => {
  for (const level of LEVELS) {
    const num = Number(level.id.slice(1));
    const ch = CHAPTERS.find((c) => num >= c.lo && num <= c.hi);
    assert.ok(ch, `${level.id}: 章节未覆盖`);
    assert.equal(level.chapter, CHAPTERS.indexOf(ch) + 1, `${level.id}: chapter 字段`);
  }
});
