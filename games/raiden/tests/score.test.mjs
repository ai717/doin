import test from "node:test";
import assert from "node:assert/strict";
import { GRAZE_SCORE, bossScore, formatTime, killScore, stageBonus, starsForStage, starsForTraining } from "../js/score.mjs";
import { ENEMIES, TRAINING } from "../js/levels.mjs";

test("计分：擦弹分值固定且为正", () => {
  assert.equal(GRAZE_SCORE, 15);
});

test("计分：敌机分值来自关卡表", () => {
  for (const [type, data] of Object.entries(ENEMIES)) {
    assert.equal(killScore(type), data.score);
  }
  assert.equal(killScore("unknown"), 100);
});

test("计分：首领奖金随面数递增", () => {
  assert.ok(bossScore(5) > bossScore(0));
  assert.equal(bossScore(0), 2500);
});

test("计分：过关奖励随命数与保险增加", () => {
  const low = stageBonus({ lives: 0, bombs: 0 });
  const high = stageBonus({ lives: 3, bombs: 2 });
  assert.ok(high > low);
  assert.equal(low, 1200);
});

test("计分：三星按无伤与不使用保险判定", () => {
  assert.equal(starsForStage({ damaged: true, bombsUsed: 2 }), 1);
  assert.equal(starsForStage({ damaged: false, bombsUsed: 1 }), 2);
  assert.equal(starsForStage({ damaged: true, bombsUsed: 0 }), 2);
  assert.equal(starsForStage({ damaged: false, bombsUsed: 0 }), 3);
});

test("计分：训练星级按擦弹分档", () => {
  assert.equal(starsForTraining(0), 1);
  assert.equal(starsForTraining(TRAINING.grazeTwo), 2);
  assert.equal(starsForTraining(TRAINING.grazeThree), 3);
  assert.equal(starsForTraining(9999), 3);
});

test("计分：时间格式化为分秒且不为负", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(65_000), "1:05");
  assert.equal(formatTime(-5), "0:00");
  assert.equal(formatTime(600_000), "10:00");
});
