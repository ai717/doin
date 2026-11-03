import test from "node:test";
import assert from "node:assert/strict";

import {
  LEVEL_COUNT,
  LEVELS,
  CHAPTERS,
  CLASSIC_FLOORS,
  MODES,
  levelSpec,
  levelSeed,
  chapterOf,
  parTimeFor,
  buildConfig,
} from "../js/levels.mjs";

test("levels: 23 stages split 5 / 5 / 4 / 5 / 4 across five chapters", () => {
  assert.equal(LEVEL_COUNT, 23);
  assert.equal(LEVELS.length, 23);
  assert.equal(CHAPTERS.length, 5);
  assert.deepEqual(
    CHAPTERS.map((chapter) => chapter.count),
    [5, 5, 4, 5, 4]
  );
  assert.equal(CHAPTERS[0].from, 1);
  assert.equal(CHAPTERS[4].to, 23);
  let cursor = 1;
  for (const chapter of CHAPTERS) {
    assert.equal(chapter.from, cursor);
    assert.equal(chapter.to, cursor + chapter.count - 1);
    cursor = chapter.to + 1;
  }
});

test("levels: ids, seeds and depth targets are strictly ordered", () => {
  const seeds = new Set();
  for (let i = 0; i < LEVELS.length; i += 1) {
    const spec = LEVELS[i];
    assert.equal(spec.id, i + 1, "关卡 id 必须从 1 连续排列");
    assert.equal(levelSpec(spec.id).id, spec.id);
    assert.ok(!seeds.has(spec.seed), "关卡种子不得重复");
    seeds.add(spec.seed);
    assert.equal(spec.seed, levelSeed(spec.id), "关卡种子必须可由 id 复算");
    if (i > 0) {
      assert.ok(spec.goalFloors > LEVELS[i - 1].goalFloors, "目标深度必须递增");
      assert.ok(spec.width <= LEVELS[i - 1].width, "平台宽度必须逐关收窄或持平");
      assert.ok(spec.scrollSpeed >= LEVELS[i - 1].scrollSpeed, "滚屏速度必须逐关加快");
    }
  }
  assert.equal(levelSpec(0).id, 1, "越界向下夹到第 1 关");
  assert.equal(levelSpec(99).id, LEVEL_COUNT, "越界向上夹到末关");
});

test("levels: chapterOf maps every stage into the right region", () => {
  assert.equal(chapterOf(1).id, 1);
  assert.equal(chapterOf(5).id, 1);
  assert.equal(chapterOf(6).id, 2);
  assert.equal(chapterOf(10).id, 2);
  assert.equal(chapterOf(11).id, 3);
  assert.equal(chapterOf(14).id, 3);
  assert.equal(chapterOf(15).id, 4);
  assert.equal(chapterOf(19).id, 4);
  assert.equal(chapterOf(20).id, 5);
  assert.equal(chapterOf(23).id, 5);
});

test("levels: every weight table is non-empty and every platform type is reachable", () => {
  for (const spec of LEVELS) {
    const sum = Object.values(spec.weights).reduce((acc, value) => acc + value, 0);
    assert.ok(sum > 0, `第 ${spec.id} 关权重表不得为空`);
    for (const value of Object.values(spec.weights)) assert.ok(value >= 0);
    assert.ok(spec.weights.normal > 0, "每关都必须保留普通岩板以便回血");
    assert.ok(spec.safeCount >= 3, "开局必须有足够的安全落板");
    assert.ok(spec.goalFloors >= 10);
    assert.equal(spec.parTime, parTimeFor(spec.goalFloors));
  }
  const chapterTwo = LEVELS.filter((spec) => spec.chapter === 2);
  assert.ok(chapterTwo.some((spec) => spec.weights.spike > 0), "第二章应引入尖刺");
  const chapterThree = LEVELS.filter((spec) => spec.chapter === 3);
  assert.ok(chapterThree.every((spec) => spec.weights.crumble > 0), "第三章应引入碎裂板");
});

test("levels: buildConfig clamps levels and produces all three modes", () => {
  const c1 = buildConfig({ mode: "campaign", level: 1 });
  assert.equal(c1.mode, "campaign");
  assert.equal(c1.level, 1);
  assert.equal(c1.goalFloors, LEVELS[0].goalFloors);
  assert.equal(c1.seed, LEVELS[0].seed);

  const c99 = buildConfig({ mode: "campaign", level: 99 });
  assert.equal(c99.level, LEVEL_COUNT);

  const classic = buildConfig({ mode: "classic" });
  assert.equal(classic.mode, "classic");
  assert.equal(classic.goalFloors, CLASSIC_FLOORS);
  assert.ok(classic.speedMax >= classic.scrollSpeed);

  const endless = buildConfig({ mode: "endless" });
  assert.equal(endless.mode, "endless");
  assert.equal(endless.goalFloors, 0, "无尽模式不得设置终点");
  assert.ok(endless.speedRamp > classic.speedRamp, "无尽模式加速更陡");

  assert.deepEqual(MODES, ["campaign", "classic", "endless"]);
  const seeded = buildConfig({ mode: "campaign", level: 7, seed: 123 });
  assert.equal(seeded.seed, 123, "显式种子必须覆盖关卡种子");
});
