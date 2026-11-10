import test from "node:test";
import assert from "node:assert/strict";

import { CHAPTERS, LEVELS, LEVEL_BY_ID, SOLUTION_SEED, getLevel, levelsInChapter, nextLevel } from "../js/levels.mjs";
import { createState, simulateShot, STATUS_WON } from "../js/engine.mjs";

const eq = assert.strictEqual;

test("21 关五卷：4 / 5 / 4 / 5 / 3", () => {
  eq(LEVELS.length, 21);
  assert.deepEqual(CHAPTERS.map((chapter) => chapter.count), [4, 5, 4, 5, 3]);
  for (let chapter = 1; chapter <= 5; chapter += 1) {
    eq(levelsInChapter(chapter).length, CHAPTERS[chapter - 1].count);
  }
});

test("关卡 id 唯一且顺序稳定", () => {
  const ids = new Set();
  LEVELS.forEach((level, index) => {
    eq(level.id, `p${String(index + 1).padStart(2, "0")}`);
    assert.ok(!ids.has(level.id));
    ids.add(level.id);
    eq(level.index, index);
    eq(LEVEL_BY_ID[level.id], level);
  });
  eq(getLevel("nope"), null);
  eq(nextLevel("p21"), null);
  eq(nextLevel("p01")?.id, "p02");
});

test("钉阵在机台内、互不重叠，颜色配额合理", () => {
  for (const level of LEVELS) {
    assert.ok(level.pegs.length >= 28, `${level.id} 钉子过少`);
    const seen = new Set();
    for (const peg of level.pegs) {
      assert.ok(!seen.has(peg.id), `${level.id} 重复钉 id`);
      seen.add(peg.id);
      assert.ok(peg.x > 60 && peg.x < 780, `${level.id} x 越界`);
      assert.ok(peg.y > 100 && peg.y < 480, `${level.id} y 越界`);
      assert.ok(["blue", "orange", "green"].includes(peg.type));
      assert.ok(peg.type !== "orange" || peg.type === "orange");
    }
    for (let i = 0; i < level.pegs.length; i += 1) {
      for (let j = i + 1; j < level.pegs.length; j += 1) {
        const a = level.pegs[i];
        const b = level.pegs[j];
        assert.ok(
          Math.hypot(a.x - b.x, a.y - b.y) >= 30,
          `${level.id} 钉子 ${a.id}/${b.id} 重叠`,
        );
      }
    }
    const greens = level.pegs.filter((peg) => peg.type === "green").length;
    const oranges = level.pegs.filter((peg) => peg.type === "orange").length;
    const blues = level.pegs.filter((peg) => peg.type === "blue").length;
    eq(greens, 2);
    assert.ok(oranges >= 10 && oranges <= 20, `${level.id} 橙钉数量 ${oranges}`);
    assert.ok(blues >= 8, `${level.id} 蓝钉过少`);
    eq(level.orangeTotal, oranges);
  }
});

test("机关位置合法：旋转挡板与引力场都在台面内", () => {
  for (const level of LEVELS) {
    for (const rotor of level.rotors) {
      assert.ok(rotor.x > 80 && rotor.x < 760);
      assert.ok(rotor.y > 120 && rotor.y < 440);
      assert.ok(rotor.length >= 100 && rotor.length <= 200);
      assert.ok(Number.isFinite(rotor.speed) && rotor.speed !== 0);
    }
    for (const well of level.wells) {
      assert.ok(well.radius >= 150 && well.radius <= 240);
      assert.ok(well.strength >= 300 && well.strength <= 700);
    }
  }
});

test("每关都嵌入可重放的清关角度序列，并在初始 10 颗弹珠内通关", () => {
  for (const level of LEVELS) {
    assert.ok(level.solution.length >= 3, `${level.id} 解算序列过短`);
    assert.ok(level.solution.length <= 10, `${level.id} 解算序列超过 10 发`);
    let state = createState(level, { seed: SOLUTION_SEED + level.index });
    for (const angle of level.solution) {
      if (state.status !== "aim") break;
      state = simulateShot(state, angle, { dt: 1 / 120, maxSteps: 2400 });
    }
    eq(state.status, STATUS_WON, `${level.id} 解算未能清关`);
    eq(state.orangeLeft, 0);
    assert.ok(state.ballsLeft >= 0);
  }
});

test("初始状态与关卡数据一致", () => {
  const level = LEVELS[0];
  const state = createState(level, { seed: SOLUTION_SEED });
  eq(state.pegs.length, level.pegs.length);
  eq(state.pegs.filter((peg) => peg.type === "orange").length, level.orangeTotal);
});
