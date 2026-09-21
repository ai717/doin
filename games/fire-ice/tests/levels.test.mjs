// 森林冰火人 · 关卡数据体系测试
// 覆盖：40 关可解析、行宽一致、宝石/出口/出生齐备、章节划分、解析器键值映射

import test from "node:test";
import assert from "node:assert/strict";
import {
  LEVELS,
  LEVEL_COUNT,
  CHAPTERS,
  getLevel
} from "../js/levels.mjs";
import { T } from "../js/engine.mjs";

test("关卡总数 40，分 5 章 × 8 关", () => {
  assert.equal(LEVEL_COUNT, 40);
  assert.equal(CHAPTERS.length, 5);
  for (const ch of CHAPTERS) {
    assert.equal(ch.to - ch.from + 1, 8, `章节 ${ch.id} 应有 8 关`);
  }
  // 章节连续覆盖 0..39
  const covers = CHAPTERS.flatMap((ch) => {
    const arr = [];
    for (let i = ch.from; i <= ch.to; i++) arr.push(i);
    return arr;
  });
  assert.deepEqual(covers, Array.from({ length: 40 }, (_, i) => i));
});

test("每关可解析且结构完备", () => {
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const lv = getLevel(i);
    assert.ok(lv, `第 ${i + 1} 关可解析`);
    assert.equal(lv.w, 20, `${lv.name} 宽 20`);
    assert.equal(lv.h, 14, `${lv.name} 高 14`);
    assert.ok(lv.map.every((row) => row.length === 20), `${lv.name} 行宽一致`);
    assert.ok(Number.isFinite(lv.fireX) && Number.isFinite(lv.iceX), `${lv.name} 双角色出生点`);
    assert.ok(lv.fireExit && lv.iceExit, `${lv.name} 双出口`);
    assert.ok(Array.isArray(lv.gems) && lv.gems.length >= 3, `${lv.name} 有宝石（≥3）`);
    assert.ok(Array.isArray(lv.doors), `${lv.name} doors 数组`);
    assert.ok(Array.isArray(lv.buttons), `${lv.name} buttons 数组`);
  }
});

test("宝石不超过 5 颗且红/蓝/中立合法", () => {
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const lv = getLevel(i);
    assert.ok(lv.gems.length <= 5, `${lv.name} 宝石 ≤5`);
    for (const g of lv.gems) {
      assert.ok(["red", "blue", "gold"].includes(g.kind), `${lv.name} 宝石类型合法`);
    }
  }
});

test("开关-门配对：门 switchIndex 不越界", () => {
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const lv = getLevel(i);
    const switchCount = lv.buttons.length + lv.syncPairs.length;
    for (const d of lv.doors) {
      assert.ok(d.switchIndex >= 0 && d.switchIndex < switchCount, `${lv.name} 门 ${d.x} 的开关索引越界`);
    }
  }
});

test("传送门两两配对完整", () => {
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const lv = getLevel(i);
    assert.ok(lv.portals.length % 2 === 0, `${lv.name} 传送门成对`);
  }
});

test("角色/机关脚下无致命元素", () => {
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const lv = getLevel(i);
    // 出生点、传送门、按钮脚下 r12 不得是岩浆/水/毒液（避免出生即死）
    for (const [name, pts] of [
      ["出生点", [{ x: lv.fireX }, { x: lv.iceX }]],
      ["传送门", lv.portals],
      ["按钮", lv.buttons]
    ]) {
      for (const p of pts) {
        const col = Math.floor(p.x);
        const tile = lv.map[12]?.[col];
        assert.notEqual(tile, T.MAGMA, `${lv.name} ${name}@${col} 脚下不能是岩浆`);
        assert.notEqual(tile, T.WATER, `${lv.name} ${name}@${col} 脚下不能是水`);
        assert.notEqual(tile, T.GOO, `${lv.name} ${name}@${col} 脚下不能是毒液`);
      }
    }
  }
});

test("关卡数据行宽常量校验（无断行超宽）", () => {
  for (const def of LEVELS) {
    assert.ok(def.rows.length >= 14, `${def.name} rows ≥14`);
    for (const row of def.rows) {
      assert.ok(row.length === 20, `${def.name} 行 "${row}" 宽应为 20（实际 ${row.length}）`);
    }
  }
});
