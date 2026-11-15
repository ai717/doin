import test from "node:test";
import assert from "node:assert/strict";

import {
  ARCADE,
  CHAPTERS,
  ENEMY_TYPES,
  ITEM_KINDS,
  LEVELS,
  LEVEL_BY_ID,
  WORLD_W,
  chapterOf,
  firstLevelId,
  levelIndex,
  nextLevelId,
} from "../js/levels.mjs";

test("12 关、4 章，每章 3 关且编号连续", () => {
  assert.equal(LEVELS.length, 12);
  assert.equal(CHAPTERS.length, 4);
  assert.deepEqual(LEVELS.map((level) => level.num), Array.from({ length: 12 }, (_, i) => i + 1));
  assert.deepEqual(LEVELS.map((level) => level.id), Array.from({ length: 12 }, (_, i) => `level_${String(i + 1).padStart(2, "0")}`));
  for (let chapter = 0; chapter < 4; chapter += 1) {
    assert.equal(LEVELS.filter((level) => level.chapter === chapter).length, 3);
    assert.ok(chapterOf({ chapter }).nameKey);
  }
  assert.equal(new Set(LEVELS.map((level) => level.seed)).size, 12);
});

test("每关三波，人数依次 3 / 4 / 5，敌人 key 全部有效", () => {
  for (const level of LEVELS) {
    assert.equal(level.waves.length, 3, `${level.id} 波次数量`);
    assert.deepEqual(level.waves.map((wave) => wave.length), [3, 4, 5], `${level.id} 波次人数`);
    for (const wave of level.waves) {
      for (const kind of wave) {
        assert.ok(ENEMY_TYPES[kind], `${level.id} 未知敌人 ${kind}`);
        assert.equal(Boolean(ENEMY_TYPES[kind].boss), false, `${level.id} 小怪波不应出现 Boss`);
      }
    }
  }
});

test("章节 Boss 只在第 3/6/9/12 关，其余关卡为精英压轴", () => {
  for (const level of LEVELS) {
    const headliner = level.headliner;
    assert.ok(ENEMY_TYPES[headliner.kind], `${level.id} 压轴对手无效`);
    const isBossLevel = [3, 6, 9, 12].includes(level.num);
    assert.equal(Boolean(headliner.boss), isBossLevel, `${level.id} Boss 标记`);
    assert.equal(Boolean(ENEMY_TYPES[headliner.kind].boss), isBossLevel, `${level.id} 敌人类型 Boss 标记`);
    assert.ok(headliner.nameKey, `${level.id} 缺少名字 key`);
    if (!isBossLevel) assert.ok(headliner.hp > 0, `${level.id} 精英需要单独血量`);
  }
  assert.deepEqual(
    LEVELS.filter((level) => level.headliner.boss).map((level) => level.headliner.kind),
    ["boss_pe", "boss_captain", "boss_shopkeeper", "boss_senior"],
  );
});

test("难度、标准用时与道具配置合法", () => {
  for (const level of LEVELS) {
    assert.ok(level.par >= 55 && level.par <= 120, `${level.id} par`);
    assert.ok(level.diff >= 0 && level.diff < 1);
    assert.ok(level.items.length >= 2 && level.items.length <= 3, `${level.id} 道具数量`);
    for (const item of level.items) {
      assert.ok(ITEM_KINDS[item.kind], `${level.id} 未知道具 ${item.kind}`);
      assert.ok(item.x > 0 && item.x < WORLD_W);
      assert.ok(item.z >= 0.18 && item.z <= 0.92);
    }
  }
  const avg = (chapter) => {
    const list = LEVELS.filter((level) => level.chapter === chapter);
    return list.reduce((sum, level) => sum + level.par, 0) / list.length;
  };
  assert.ok(avg(3) > avg(0), "末章平均用时上限应高于首章");
  assert.ok(LEVELS[LEVELS.length - 1].diff > LEVELS[0].diff);
});

test("关卡链路：首关、索引与下一关安全边界", () => {
  assert.equal(firstLevelId(), "level_01");
  assert.equal(levelIndex("level_06"), 5);
  assert.equal(levelIndex("nope"), 0);
  let id = firstLevelId();
  for (let i = 1; i < LEVELS.length; i += 1) {
    id = nextLevelId(id);
    assert.equal(id, LEVELS[i].id);
  }
  assert.equal(nextLevelId(id), "level_12");
  assert.equal(LEVEL_BY_ID.level_12.headliner.kind, "boss_senior");
});

test("街机配置覆盖全部小怪与四个首领", () => {
  assert.equal(ARCADE.duration, 180);
  assert.equal(ARCADE.bossEvery, 55);
  for (const kind of ARCADE.enemyKinds) assert.ok(ENEMY_TYPES[kind] && !ENEMY_TYPES[kind].boss);
  for (const kind of ARCADE.bossKinds) assert.ok(ENEMY_TYPES[kind]?.boss);
});

test("敌人数值单调：越靠后的类型血量与伤害不低于基础小怪", () => {
  const base = ENEMY_TYPES.enemy_scrapper;
  for (const [kind, type] of Object.entries(ENEMY_TYPES)) {
    if (type.boss) {
      assert.ok(type.hp > base.hp * 4, `${kind} Boss 血量`);
      assert.ok(type.dmg >= base.dmg, `${kind} Boss 伤害`);
      assert.ok(type.scale > 1.2, `${kind} Boss 体型`);
    } else {
      assert.ok(type.hp >= base.hp * 0.8, `${kind} 小怪血量`);
      assert.ok(type.range >= base.range, `${kind} 攻击距离`);
    }
  }
});
