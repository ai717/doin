import test from "node:test";
import assert from "node:assert/strict";
import { LEVELS, LAYOUTS, RUSH, CHAPTERS, getLevel, TOTAL_LEVELS } from "../js/levels.mjs";

function supported(layout, x, y) {
  return layout.platforms.some((plat) => Math.abs(plat.y - y) < 0.6 && x >= plat.x - 2 && x <= plat.x + plat.w + 2);
}

test("关卡：三十关三章，id 唯一且顺序稳定", () => {
  assert.equal(TOTAL_LEVELS, 30);
  assert.equal(LEVELS.length, 30);
  assert.equal(CHAPTERS.length, 3);
  const ids = new Set(LEVELS.map((level) => level.id));
  assert.equal(ids.size, 30);
  LEVELS.forEach((level, index) => {
    assert.equal(level.index, index);
    assert.equal(level.chapter, Math.floor(index / 10));
    assert.match(level.id, /^snow_\d{2}$/);
  });
});

test("关卡：每章十关，章末为首领关", () => {
  for (let index = 0; index < 30; index += 1) {
    const level = LEVELS[index];
    const isBoss = index % 10 === 9;
    if (isBoss) {
      assert.ok(level.boss, `第 ${index + 1} 关应有首领`);
      assert.ok(level.boss.hp >= 3);
      assert.equal(level.enemies.length, 2);
    } else {
      assert.equal(level.boss, null);
      assert.ok(level.enemies.length >= 3 && level.enemies.length <= 7);
    }
  }
});

test("关卡：玩家出生点落在实心平台上", () => {
  for (const level of LEVELS) {
    const layout = LAYOUTS[level.layoutIndex];
    assert.ok(supported(layout, level.playerSpawn.x, level.playerSpawn.y), `${level.id} 出生点悬空`);
  }
});

test("关卡：地面敌人都有可站立平台，飞行怪留在场内", () => {
  for (const level of LEVELS) {
    const layout = LAYOUTS[level.layoutIndex];
    for (const enemy of level.enemies) {
      const base = getLevel(level.index);
      assert.ok(enemy.x > 20 && enemy.x < 940, `${level.id} 敌人越界`);
      assert.ok(enemy.y > 60 && enemy.y <= 500, `${level.id} 敌人高度异常`);
      if (enemy.type === "flyer") continue;
      assert.ok(supported(base.layout, enemy.x, enemy.y), `${level.id} 的 ${enemy.type} 没有落脚平台`);
    }
  }
});

test("地形：五套布局都可逐层跳达，层高不超过跳跃上限", () => {
  for (const layout of LAYOUTS) {
    assert.ok(layout.platforms.length >= 5, `${layout.id} 平台过少`);
    const groundWidth = layout.platforms.filter((plat) => plat.y === 500).reduce((sum, plat) => sum + plat.w, 0);
    assert.ok(groundWidth >= 700, `${layout.id} 缺少主地面`);
    const tops = [...new Set(layout.platforms.filter((plat) => plat.type !== "spring").map((plat) => plat.y))].sort((a, b) => b - a);
    for (let i = 1; i < tops.length; i += 1) {
      const gap = tops[i - 1] - tops[i];
      assert.ok(gap >= 60 && gap <= 120, `${layout.id} 层高 ${gap} 超出跳跃范围`);
    }
    assert.ok(layout.slots.length >= 6, `${layout.id} 敌人槽位不足`);
  }
});

test("关卡：冰面与弹簧地形确实存在于对应章节", () => {
  const all = LAYOUTS.flatMap((layout) => layout.platforms);
  assert.ok(all.some((plat) => plat.type === "ice"));
  assert.ok(all.some((plat) => plat.type === "spring"));
  const brickLayouts = LAYOUTS.filter((layout) => layout.bricks.length > 0);
  assert.ok(brickLayouts.length >= 2);
  for (const layout of brickLayouts) {
    for (const brick of layout.bricks) {
      assert.ok(brick.x > 0 && brick.x + brick.w < 960);
      assert.ok(brick.w > 0 && brick.h > 0);
      assert.ok([null, "star", "heart"].includes(brick.item));
    }
  }
});

test("冲刺：九十秒竞技场与生成波次配置齐全", () => {
  assert.equal(RUSH.duration, 90);
  assert.ok(RUSH.playerSpawn);
  assert.ok(LAYOUTS[RUSH.layoutIndex]);
  assert.ok(RUSH.waves > 10);
});
