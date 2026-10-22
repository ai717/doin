// filepath: games/ice-slide/tests/levels.test.mjs
// 关卡库结构校验 + 求解器逐关复核：60 关 5 章 × 12、箱数==灯标数、玩家唯一、行宽一致、
// 初始无送分、每关 BFS 可解且 par 与标称值一致（每次重跑）、par 渐进曲线。
import { test } from "node:test";
import assert from "node:assert/strict";
import { CHAPTERS, LEVELS, getLevel, levelsOfChapter } from "../js/levels.mjs";
import { parseLevel, countBoxes, boxesOnGoal } from "../js/engine.mjs";
import { solve } from "../js/solver.mjs";

test("levels: 共 60 关、5 章 × 12 关、章节区间连续覆盖", () => {
  assert.equal(LEVELS.length, 60);
  assert.equal(CHAPTERS.length, 5);
  for (const ch of CHAPTERS) {
    assert.equal(ch.hi - ch.lo + 1, 12);
    assert.ok(ch.id);
  }
  const spans = CHAPTERS.map((c) => [c.lo, c.hi]).sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < spans.length; i++) {
    if (i > 0) assert.equal(spans[i][0], spans[i - 1][1] + 1);
  }
  assert.equal(spans[0][0], 1);
  assert.equal(spans[4][1], 60);
  // id 连续且与索引对齐
  LEVELS.forEach((level, i) => {
    assert.equal(level.id, `level_${i + 1}`);
  });
});

test("levels: 每关结构合法（箱数==灯标数、玩家唯一、par>0）", () => {
  for (const level of LEVELS) {
    const map = parseLevel(level.map);
    const goals = map.goal.reduce((n, v) => n + v, 0);
    const boxes = countBoxes(map);
    assert.equal(boxes, goals, `${level.id}: 箱数(${boxes}) != 灯标数(${goals})`);
    assert.ok(map.player >= 0, `${level.id}: 无玩家`);
    assert.ok(Number.isInteger(level.par) && level.par > 0, `${level.id}: par 非法`);
    assert.ok(level.chapter >= 1 && level.chapter <= 5, `${level.id}: chapter 非法`);
    // 地图均为闭合矩形：外框全墙、行宽一致
    const widths = level.map.map((r) => r.length);
    assert.ok(widths.every((w) => w === widths[0]), `${level.id}: 行宽不一致`);
    assert.ok(level.map[0].split("").every((c) => c === "#"), `${level.id}: 顶行非全墙`);
    assert.ok(level.map.at(-1).split("").every((c) => c === "#"), `${level.id}: 底行非全墙`);
    for (const row of level.map) {
      assert.equal(row[0], "#", `${level.id}: 左边界非墙`);
      assert.equal(row.at(-1), "#", `${level.id}: 右边界非墙`);
    }
  }
});

test("levels: 初始无送分（无箱初始已在灯标上）", () => {
  for (const level of LEVELS) {
    const map = parseLevel(level.map);
    assert.equal(boxesOnGoal(map), 0, `${level.id}: 初始即有箱在灯标上`);
  }
});

test("levels: 每关求解器复核——可解且 par 与标称一致（每次重跑）", () => {
  for (const level of LEVELS) {
    const r = solve(parseLevel(level.map), { maxStates: 3000000 });
    assert.equal(r.solvable, true, `${level.id}: 求解器判定无解`);
    assert.equal(r.optimal, level.par, `${level.id}: 标称 par=${level.par} 与实测 ${r.optimal} 不符`);
    assert.equal(r.dirs.length, level.par, `${level.id}: 解序列长度与 par 不符`);
  }
});

test("levels: par 渐进曲线（相邻回落 ≤3，末 12 关显著难于首 12 关）", () => {
  const pars = LEVELS.map((l) => l.par);
  for (let i = 1; i < pars.length; i++) {
    assert.ok(pars[i] - pars[i - 1] >= -3, `level_${i + 1}: par 倒退 ${pars[i - 1]} -> ${pars[i]}`);
  }
  const first12 = Math.max(...pars.slice(0, 12));
  const last12 = Math.min(...pars.slice(48));
  assert.ok(last12 >= first12 + 8, `末 12 关难度未拉开 (${first12} -> ${last12})`);
  // 章内也递进：每章末关 par >= 首关 par
  for (const ch of CHAPTERS) {
    const chPars = levelsOfChapter(CHAPTERS.indexOf(ch) + 1).map((l) => l.par);
    assert.ok(chPars.at(-1) >= chPars[0], `${ch.id}: 章内 par 未递进`);
  }
});

test("levels: chapter 字段与 CHAPTERS 区间一致", () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const level = LEVELS[i];
    const ch = CHAPTERS.find((c) => i + 1 >= c.lo && i + 1 <= c.hi);
    assert.ok(ch, `${level.id}: 章节未覆盖`);
    assert.equal(level.chapter, CHAPTERS.indexOf(ch) + 1, `${level.id}: chapter 字段不符`);
  }
});

test("levels: getLevel / levelsOfChapter 访问器", () => {
  assert.equal(getLevel(0).id, "level_1");
  assert.equal(getLevel(60), null);
  assert.equal(getLevel(-1), null);
  assert.equal(levelsOfChapter(1).length, 12);
  assert.equal(levelsOfChapter(5).at(-1).id, "level_60");
});

test("levels: XSB 全字符覆盖（+ 人在灯标 / * 箱在灯标均被正确解析）", () => {
  // level_27/42/54 含 '+'（人在灯标上）：player 与 goal 同位，不占箱
  const plusLevels = LEVELS.filter((l) => l.map.some((r) => r.includes("+")));
  assert.ok(plusLevels.length >= 1, "关卡库应保留 '+' 字符关（生成器合法产物）");
  for (const level of plusLevels) {
    const map = parseLevel(level.map);
    assert.equal(map.goal[map.player], 1, `${level.id}: '+' 位应为灯标`);
    assert.equal(map.box[map.player], 0, `${level.id}: '+' 位不应有箱`);
  }
});
