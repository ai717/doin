// 泡泡射手 · 关卡与题板单元测试
// 覆盖：30 关三星目标 / 24 道断柱残局 100% 可解 / 无尽与每日盘面无悬空 / 求解器无死局校验
import test from "node:test";
import assert from "node:assert/strict";

import {
  STAGE_LEVELS,
  PUZZLES,
  CHAPTERS,
  ENDLESS,
  stageLevel,
  chapterOf,
  puzzleBoard,
  instantiate,
  endlessBoard,
  dailySpec,
  dateSeed,
  crystalCount,
  bubbleCount
} from "../js/levels.mjs";
import {
  solve,
  solveWithLoad,
  floatingCells,
  countBubbles,
  CRYSTAL,
  DEATH_ROW
} from "../js/engine.mjs";

test("30 关闯关：编号连续、三章各 10 关、目标发数合理", () => {
  assert.equal(STAGE_LEVELS.length, 30);
  STAGE_LEVELS.forEach((lv, i) => {
    assert.equal(lv.id, i + 1);
    assert.ok(lv.target >= 10 && lv.target <= 40, `第 ${lv.id} 关目标发数 ${lv.target} 不合理`);
    assert.ok(lv.mask.length >= 3 && lv.mask.length <= 6, `第 ${lv.id} 关行数异常`);
  });
  assert.equal(CHAPTERS.length, 3);
  assert.equal(chapterOf(1).id, 1);
  assert.equal(chapterOf(15).id, 2);
  assert.equal(chapterOf(30).id, 3);
});

test("章节配色递进：4 色 → 5 色 → 6 色", () => {
  for (const lv of STAGE_LEVELS) {
    const ch = chapterOf(lv.id);
    assert.equal(lv.palette.length, ch.colors, `第 ${lv.id} 关配色数应等于章节设定`);
  }
});

test("30 关初始盘面：必然连通冰盖（零悬空）且非空白", () => {
  for (const lv of STAGE_LEVELS) {
    const board = instantiate(lv, 1000 + lv.id * 37);
    assert.equal(floatingCells(board).length, 0, `第 ${lv.id} 关存在悬空泡`);
    assert.ok(countBubbles(board) >= 12, `第 ${lv.id} 关冰泡过少`);
  }
});

test("无死局校验：30 关均可在目标发数 + 12 发内被求解器清空", () => {
  for (const lv of STAGE_LEVELS) {
    const board = instantiate(lv, 1000 + lv.id * 37);
    const res = solve(board, {
      budget: lv.target + 12,
      palette: lv.palette,
      goal: "clear",
      beam: 5,
      samples: 72
    });
    assert.ok(res.ok, `第 ${lv.id} 关在 ${lv.target + 12} 发内无法清空（剩 ${countBubbles(res.node.board)}）`);
    assert.ok(res.shots <= lv.target + 12);
  }
});

test("24 道断柱残局：题面含冰晶、发数序列与限定发数一致", () => {
  assert.equal(PUZZLES.length, 24);
  for (const pz of PUZZLES) {
    assert.equal(pz.load.length, pz.shots, `残局 ${pz.id} 的发数序列长度应等于限定发数`);
    const board = instantiate(pz, 500 + pz.id * 91);
    assert.ok(crystalCount(board) >= 1, `残局 ${pz.id} 缺少目标冰晶`);
    assert.equal(floatingCells(board).length, 0, `残局 ${pz.id} 存在悬空泡`);
  }
});

test("无死局校验：24 道残局 100% 可解（冰晶必定坠落）", () => {
  for (const pz of PUZZLES) {
    const board = instantiate(pz, 500 + pz.id * 91);
    const res = solveWithLoad(board, pz.load, { goal: "crystal", samples: 140, beam: 8 });
    assert.ok(res.ok, `残局 ${pz.id} 在 ${pz.shots} 发内无法让冰晶坠落`);
    assert.ok(res.shots <= pz.shots);
  }
});

test("冰晶不可被同色消除：残局盘面永远保留 CRYSTAL 标记", () => {
  const pz = puzzleBoard(1);
  const board = instantiate(pz, 591);
  const found = board.some((row) => row.cells.includes(CRYSTAL));
  assert.ok(found);
  assert.ok(bubbleCount(board) >= 1, "残局除冰晶外还应有可消除的冰泡");
});

test("无尽寒潮：起始盘面连通且颜色数封顶为 6", () => {
  const { board, palette } = endlessBoard(20240927);
  assert.equal(floatingCells(board).length, 0);
  assert.equal(palette.length, ENDLESS.startColors);
  assert.ok(ENDLESS.maxColors <= 6);
  assert.equal(endlessBoard(20240927).board.length, endlessBoard(20240927).board.length);
});

test("每日残局：同一日期必得同一题板（确定性种子）", () => {
  const seed = dateSeed(new Date(2026, 8, 28));
  const a = dailySpec(seed);
  const b = dailySpec(seed);
  assert.deepEqual(a.mask, b.mask);
  assert.notDeepEqual(a.mask, dailySpec(seed + 1).mask);
  const board = instantiate(a, seed);
  assert.equal(floatingCells(board).length, 0);
  assert.ok(countBubbles(board) >= 15);
});

test("关卡取用回退：越界 id 回退首关，不抛错", () => {
  assert.equal(stageLevel(0).id, 1);
  assert.equal(stageLevel(999).id, 1);
  assert.equal(puzzleBoard(999).id, 1);
});

test("盘面高度安全：所有关卡初始最低行远离冰封线", () => {
  for (const lv of STAGE_LEVELS) {
    const board = instantiate(lv, 1000 + lv.id * 37);
    let lowest = -1;
    board.forEach((row, r) => {
      if (row.cells.some((v) => v !== -1)) lowest = r;
    });
    assert.ok(lowest < DEATH_ROW - 4, `第 ${lv.id} 关初始盘面过低（第 ${lowest} 行）`);
  }
});
