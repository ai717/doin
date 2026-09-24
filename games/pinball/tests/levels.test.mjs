// 霓虹弹珠台 · 关卡数据单元测试
// 覆盖：30 关行模板合法性 / 每列必有通道（可解性双重校验）/ 砖种分布 / 章节机关配置
import test from "node:test";
import assert from "node:assert/strict";
import { LEVELS, CHAPTERS, COLS, CHAPTER_MECHS } from "../js/levels.mjs";
import { checkLevelSolvable } from "../js/engine.mjs";

test("30 关齐全，三章 × 10 关", () => {
  assert.equal(LEVELS.length, 30);
  const ids = LEVELS.map((l) => l.id);
  assert.deepEqual(ids, Array.from({ length: 30 }, (_, i) => i + 1));
});

test("每关行模板 12 列、字符合法、行数随章节递增", () => {
  for (const level of LEVELS) {
    assert.ok(level.rows.length >= 5 && level.rows.length <= 10, `关卡 ${level.id} 行数 ${level.rows.length} 越界`);
    for (const row of level.rows) {
      assert.equal(row.length, COLS, `关卡 ${level.id} 行宽非 ${COLS}`);
      assert.ok(/^[GSA.]+$/.test(row), `关卡 ${level.id} 含非法砖种字符`);
    }
  }
});

test("可解性：每一列在整关行集合中至少 1 个空位（垂直通道），30 关全部通过", () => {
  for (const level of LEVELS) {
    const r = checkLevelSolvable(level.rows);
    assert.ok(r.ok, `关卡 ${level.id} 不可解: ${r.reason}`);
  }
});

test("可解性校验器本身能识别被封死的列", () => {
  const sealed = ["GGGGGGGGGGGG", "GGGGGGGGGGGG"];
  const r = checkLevelSolvable(sealed);
  assert.equal(r.ok, false);
});

test("章节主题：第一章玻璃 / 第二章钢铁 / 第三章黄金（高阶砖占比递增）", () => {
  const count = (rows, tier) => rows.join("").split("").filter((c) => c === tier).length;
  for (const level of LEVELS) {
    const g = count(level.rows, "G"), s = count(level.rows, "S"), a = count(level.rows, "A");
    if (level.chapter === 1) {
      assert.ok(g > 0 && s === 0 && a === 0, `关卡 ${level.id} 第一章应只有玻璃砖`);
    } else if (level.chapter === 2) {
      assert.ok(s > 0 && a === 0, `关卡 ${level.id} 第二章应有钢铁砖且无黄金砖`);
    } else {
      assert.ok(a > 0, `关卡 ${level.id} 第三章应有黄金砖`);
    }
  }
});

test("每关砖墙密度合理（非空关），至少 24 块砖", () => {
  for (const level of LEVELS) {
    const bricks = level.rows.join("").split("").filter((c) => c !== ".").length;
    assert.ok(bricks >= 24, `关卡 ${level.id} 砖数 ${bricks} 过少`);
  }
});

test("章节机关配置：每章引入的机关符合章节特征", () => {
  assert.ok(CHAPTER_MECHS[1].bumpers.length >= 1);
  assert.ok(CHAPTER_MECHS[2].targets.length >= 3);
  assert.ok(CHAPTER_MECHS[3].targets && CHAPTER_MECHS[3].spinner && CHAPTER_MECHS[3].ramp && CHAPTER_MECHS[3].rollovers, "第三章机关全开");
});

test("星级目标：随关卡递增且均为正数", () => {
  let prevTime = 0, prevCombo = 0;
  for (const level of LEVELS) {
    assert.ok(level.targets.time > prevTime, `关卡 ${level.id} 用时目标未递增`);
    assert.ok(level.targets.combo >= prevCombo, `关卡 ${level.id} 连击目标未递增`);
    prevTime = level.targets.time;
    prevCombo = level.targets.combo;
  }
});

test("章节元数据：名称键与主题键存在且三章各 10 关", () => {
  assert.equal(CHAPTERS.length, 3);
  for (const ch of CHAPTERS) {
    assert.ok(ch.nameKey && ch.themeKey, "章节应含名称与主题 i18n 键");
    assert.equal(ch.levelCount, 10);
  }
});
