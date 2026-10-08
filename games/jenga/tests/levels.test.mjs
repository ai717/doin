// 叠叠乐 · 关卡数据测试
//   1. 结构完整（4 章 × 6 关、id/种子唯一、key 可查）
//   2. 目标可达成（层数上限 27、层数目标换算成 move 数非空转）
//   3. 机关按章引入，难度单调不倒退
//   4. 双语 “关卡名 / 章节名” 键位齐备（与 i18n 交叉核对）

import test from "node:test";
import assert from "node:assert/strict";

import {
  LEVELS, CHAPTERS, MAX_LAYERS, TOTAL_LEVELS, LEVELS_PER_CHAPTER, CHAPTER_COUNT,
  GOAL_MOVES, GOAL_LAYERS, HAZARD_GUST, HAZARD_LOAD,
  findLevel, levelById, chapterOf, goalMoves,
  DUEL_LEVEL, RIDDLE_LEVEL, DUEL_WIN_TARGET, RIDDLE_QUESTIONS, RIDDLE_CANDIDATES
} from "../js/levels.mjs";
import { LOCALES } from "../js/i18n.mjs";

test("结构：4 章 × 6 关，index 连续、id 与种子唯一", () => {
  assert.equal(CHAPTERS.length, CHAPTER_COUNT);
  assert.equal(LEVELS.length, TOTAL_LEVELS);
  assert.equal(TOTAL_LEVELS, CHAPTER_COUNT * LEVELS_PER_CHAPTER);

  const ids = new Set();
  const seeds = new Set();
  LEVELS.forEach((level, i) => {
    assert.equal(level.index, i + 1, "index 必须连续");
    assert.equal(level.chapter, Math.floor(i / LEVELS_PER_CHAPTER) + 1);
    assert.equal(level.id, `level_${i + 1}`);
    assert.ok(!ids.has(level.id), `重复 id ${level.id}`);
    ids.add(level.id);
    assert.ok(Number.isInteger(level.seed) && level.seed > 0);
    assert.ok(!seeds.has(level.seed), `重复种子 ${level.seed}`);
    seeds.add(level.seed);
    assert.equal(level.par >= 0, true);
  });

  for (const chapter of CHAPTERS) {
    assert.equal(chapter.levels.length, LEVELS_PER_CHAPTER);
    assert.ok(LOCALES.zh[chapter.id] && LOCALES.en[chapter.id], `缺 ${chapter.id} 的文案`);
  }
  for (const level of LEVELS) {
    assert.ok(LOCALES.zh[level.id], `缺 ${level.id} 中文名`);
    assert.ok(LOCALES.en[level.id], `缺 ${level.id} 英文名`);
  }
});

test("查询接口：findLevel / levelById / chapterOf 自洽且容错", () => {
  const first = findLevel(1);
  assert.equal(first.id, "level_1");
  assert.equal(chapterOf(first).index, 1);
  assert.equal(levelById("level_24").index, 24);
  assert.equal(findLevel(0), null);
  assert.equal(findLevel(99), null);
  assert.equal(findLevel("abc"), null);
  assert.equal(chapterOf(null), null);
  assert.equal(goalMoves(null), 0);
});

test("目标换算：layers 目标折叠成等价 move 数，且不超过物理层数上限", () => {
  // 初始 18 层且顶层已满 ⇒ layers = 18 + ceil(moves/3)
  for (const level of LEVELS) {
    const goal = level.goal;
    const moves = goalMoves(goal);
    assert.ok(moves >= 1, `${level.id} 目标不可完成`);
    if (goal.type === GOAL_LAYERS) {
      assert.ok(goal.target > 18, `${level.id} 层数目标必须高于初始 18 层`);
      assert.ok(goal.target <= MAX_LAYERS, `${level.id} 目标 ${goal.target} 层超过物理上限 ${MAX_LAYERS}`);
      assert.equal(moves, (goal.target - 18) * 3);
      // 目标各层需要的 move 数必须足以撑到该层
      assert.ok(Math.ceil(moves / 3) >= goal.target - 18);
    } else {
      assert.equal(goal.type, GOAL_MOVES);
      assert.equal(moves, goal.target);
    }
  }
});

test("机关逐章引入：第 1 章自动落位，第 2 章解锁选位，第 3 章起上机关", () => {
  for (const level of LEVELS) {
    const gustOn = level.hazards.includes(HAZARD_GUST);
    const loadOn = level.hazards.includes(HAZARD_LOAD);
    assert.equal(gustOn, level.gustAmp > 0, `${level.id} 的 gust 标记与 gustAmp 不一致`);
    assert.equal(loadOn, level.loadMarks > 0, `${level.id} 的 load 标记与 loadMarks 不一致`);
    if (level.chapter <= 1) {
      assert.equal(level.autoStack, true, "第 1 章必须自动落位");
      assert.deepEqual(level.hazards, [], "第 1 章不得上机关");
    } else {
      assert.equal(level.autoStack, false, "第 2 章起必须玩家自己选槽");
    }
    if (level.chapter === 2) assert.deepEqual(level.hazards, [], "第 2 章只有选位，无其他机关");
    if (level.chapter === 3) assert.ok(gustOn && loadOn, "第 3 章必须同时有阵风与承重块");
    if (level.chapter === 4) {
      assert.ok(gustOn && loadOn, "第 4 章机关全开");
      assert.ok(level.goal.streak >= 3, "第 4 章要求打出 ×27 连击");
    } else {
      assert.equal(level.goal.streak, 0, "前 3 章不强制连击");
    }
  }
});

test("难度节奏：章内所需 move 单调不减，跨章平均递增", () => {
  const byChapter = new Map();
  for (const level of LEVELS) {
    const list = byChapter.get(level.chapter) ?? [];
    list.push(goalMoves(level.goal));
    byChapter.set(level.chapter, list);
  }
  const averages = [];
  for (let chapter = 1; chapter <= CHAPTER_COUNT; chapter += 1) {
    const list = byChapter.get(chapter);
    for (let i = 1; i < list.length; i += 1) {
      assert.ok(list[i] >= list[i - 1], `第 ${chapter} 章第 ${i + 1} 关比前一关简单`);
    }
    averages.push(list.reduce((a, b) => a + b, 0) / list.length);
  }
  for (let i = 1; i < averages.length; i += 1) {
    assert.ok(averages[i] > averages[i - 1], `第 ${i + 1} 章平均强度没有超过前一章`);
  }
});

test("附加模式的固定配置", () => {
  assert.equal(DUEL_WIN_TARGET, 2, "三局两胜");
  assert.equal(RIDDLE_QUESTIONS, 10);
  assert.equal(RIDDLE_CANDIDATES, 4);
  for (const preset of [DUEL_LEVEL, RIDDLE_LEVEL]) {
    assert.deepEqual(preset.hazards, []);
    assert.equal(preset.gustAmp, 0);
    assert.equal(preset.loadMarks, 0);
    assert.equal(preset.autoStack, false);
  }
});
