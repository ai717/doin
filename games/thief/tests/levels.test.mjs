// levels.test.mjs - the stage catalogue has to be provably solvable.
// This is the geometric contract from the PRD: replaying the authored route
// must reach the loot in the real engine, and no segment of the cord may ever
// cut through a pillar.

import test from "node:test";
import assert from "node:assert/strict";
import {
  GRAB_RADIUS,
  STAGE,
  createState,
  dist,
  dragTo,
  playSolution,
  segmentPointDistance,
  visiblePath,
  wrapCount,
} from "../js/engine.mjs";
import { CHAPTERS, LEVELS, LEVEL_COUNT, chapterLevels, getLevel, isUnlocked, nextLevelId } from "../js/levels.mjs";

const inside = (point) => point.x >= 0 && point.x <= STAGE.width && point.y >= 0 && point.y <= STAGE.height;

test("关卡目录: 20 关、5 卷、每卷 4 关、编号连续", () => {
  assert.equal(LEVEL_COUNT, 20);
  assert.equal(LEVELS.length, LEVEL_COUNT);
  assert.deepEqual(
    LEVELS.map((level) => level.id),
    Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1),
  );
  assert.equal(CHAPTERS.length, 5);
  for (const chapter of CHAPTERS) {
    assert.equal(chapterLevels(chapter.id).length, 4, `卷 ${chapter.id} 应有 4 关`);
  }
  assert.equal(getLevel(0), null);
  assert.equal(getLevel(LEVEL_COUNT + 1), null);
  assert.equal(getLevel(1)?.id, 1);
});

test("关卡目录: 每关都有完整的舞台数据", () => {
  const keys = new Set();
  for (const level of LEVELS) {
    assert.ok(inside(level.origin), `#${level.id} origin 在舞台内`);
    assert.ok(inside(level.target), `#${level.id} target 在舞台内`);
    assert.ok(level.target.key, `#${level.id} 有战利品标识`);
    assert.ok(!keys.has(level.target.key), `#${level.id} 战利品不重复`);
    keys.add(level.target.key);
    assert.ok(level.par > 0, `#${level.id} 有 par`);
    assert.ok(Array.isArray(level.solution) && level.solution.length >= 2, `#${level.id} 有作者路线`);
    for (const point of level.solution) assert.ok(inside(point), `#${level.id} 路线在舞台内`);

    for (const peg of level.pegs) {
      assert.ok(inside(peg), `#${level.id} 石柱在舞台内`);
      assert.ok(peg.r >= 10 && peg.r <= 80, `#${level.id} 石柱半径合理`);
      assert.ok(dist(peg, level.target) > peg.r + GRAB_RADIUS, `#${level.id} 宝物不埋在柱子里`);
    }
    for (const lever of level.levers) assert.ok(inside(lever), `#${level.id} 电闸在舞台内`);
    for (const dog of level.dogs ?? []) assert.ok(inside(dog), `#${level.id} 犬只在舞台内`);
    for (const spot of level.spotlights ?? []) assert.ok(inside(spot), `#${level.id} 探照灯在舞台内`);
  }
  assert.equal(keys.size, LEVEL_COUNT);
});

test("可达性: 20 关的作者路线在真引擎里全部摸到宝物", () => {
  for (const level of LEVELS) {
    const last = level.solution[level.solution.length - 1];
    assert.ok(
      dist(last, level.target) <= GRAB_RADIUS + level.target.r,
      `#${level.id} 路线终点应落在宝物抓取范围内`,
    );
    const state = playSolution(level);
    assert.ok(["retract", "won"].includes(state.status), `#${level.id} 应进入回弹而不是 ${state.status}`);
    assert.ok(state.travelled > 0, `#${level.id} 有实际臂展`);
  }
});

test("可达性: 每关手臂的每一段都不穿柱", () => {
  for (const level of LEVELS) {
    const state = playSolution(level);
    const path = visiblePath(level, state);
    assert.ok(path.length >= 2, `#${level.id} 有可见手臂`);
    assert.deepEqual(path[0], level.origin, `#${level.id} 手臂从肩部出发`);
    assert.ok(dist(path[path.length - 1], state.hand) < 1e-6, `#${level.id} 手臂末端就是手掌`);
    for (const peg of level.pegs) {
      for (const point of path) {
        assert.ok(dist(point, peg) >= peg.r - 0.6, `#${level.id} 路径点不得落入石柱`);
      }
      for (let i = 1; i < path.length; i += 1) {
        // 切线弧按 18° 采样，弦与柱面最多差不到 1px；超过 1px 就是真的穿柱。
        const gap = segmentPointDistance(path[i - 1], path[i], peg).distance;
        assert.ok(gap >= peg.r - 1, `#${level.id} 路径段穿柱 ${(peg.r - gap).toFixed(2)}px`);
      }
    }
  }
});

test("可达性: 至少 17 关必须靠绕桩才能得手（教学关除外）", () => {
  let wrapped = 0;
  for (const level of LEVELS) {
    if (wrapCount(playSolution(level)) > 0) wrapped += 1;
  }
  assert.ok(wrapped >= 17, `实际绕桩关卡 ${wrapped}/20`);
  for (const level of LEVELS) {
    assert.ok(level.pegs.length >= 1, `#${level.id} 至少一根柱子`);
  }
});

test("可达性: par 与实测臂展相差不超过 6%", () => {
  for (const level of LEVELS) {
    const state = playSolution(level);
    const drift = Math.abs(level.par - state.travelled) / state.travelled;
    assert.ok(drift <= 0.06, `#${level.id} par=${level.par} 实测=${Math.round(state.travelled)}`);
  }
});

test("防作弊: 第 2 卷起直接把手拖向宝物必定触电", () => {
  for (const level of LEVELS.filter((item) => item.chapter >= 2)) {
    const naive = dragTo(level, createState(level), level.target);
    assert.equal(naive.status, "shock", `#${level.id} 直线解应当失败`);
    assert.ok(["laser", "wire", "dog", "spot"].includes(naive.failure.kind), `#${level.id} failure.kind 合法`);
  }
});

test("教学: 第 1 卷允许一拖就得手", () => {
  for (const level of LEVELS.filter((item) => item.chapter === 1)) {
    const naive = dragTo(level, createState(level), level.target);
    assert.ok(["retract", "won"].includes(naive.status), `#${level.id} 教学关不该劝退`);
  }
});

test("探照灯: 只要布了探照灯，开场时刻就存在通关窗口", () => {
  const lit = LEVELS.filter((level) => (level.spotlights ?? []).length > 0);
  assert.ok(lit.length >= 6, `布灯的关卡只有 ${lit.length} 关`);
  for (const level of LEVELS.filter((item) => item.chapter === 4)) {
    assert.ok((level.spotlights ?? []).length > 0, `#${level.id} 第 4 卷应布有探照灯`);
  }
  for (const level of lit) {
    const state = playSolution(level, { time: 0 });
    assert.ok(["retract", "won"].includes(state.status), `#${level.id} t=0 无解`);
  }
});

test("解锁链: 下一关只能在前一关入库后打开", () => {
  assert.equal(isUnlocked(1, {}), true);
  assert.equal(isUnlocked(2, {}), false);
  assert.equal(isUnlocked(2, { 1: 2 }), true);
  assert.equal(nextLevelId(1), 2);
  assert.equal(nextLevelId(LEVEL_COUNT), LEVEL_COUNT, "最后一关没有下一关");
  assert.equal(nextLevelId(999), 1);
});
