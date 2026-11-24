import test from "node:test";
import assert from "node:assert/strict";
import { ENEMIES, STAGES, STAGE_COUNT, STAGE_H, STAGE_W, TRAINING, getStage, stageIndexOf, waveSlots } from "../js/levels.mjs";

test("关卡：六面航线按顺序编号且主题唯一", () => {
  assert.equal(STAGES.length, STAGE_COUNT);
  assert.equal(new Set(STAGES.map((stage) => stage.id)).size, STAGE_COUNT);
  assert.equal(new Set(STAGES.map((stage) => stage.theme)).size, STAGE_COUNT);
  STAGES.forEach((stage, index) => {
    assert.equal(stage.id, `stage_${index + 1}`);
    assert.ok(stage.nameKey.startsWith("stage"));
    assert.equal(stageIndexOf(stage.id), index);
  });
});

test("关卡：每面波次时间递增且包含首领配置", () => {
  for (const stage of STAGES) {
    assert.ok(stage.waves.length >= 9, `${stage.id} 波次不足`);
    let previous = -1;
    for (const wave of stage.waves) {
      assert.ok(wave.t > previous, `${stage.id} 波次时间未递增`);
      previous = wave.t;
      assert.ok(wave.count > 0);
      assert.ok(ENEMIES[wave.type], `未知敌机 ${wave.type}`);
    }
    assert.ok(stage.boss.hp > 0);
    assert.ok(stage.boss.patterns.length >= 1);
  }
});

test("关卡：敌机各有独立分值且数值为正", () => {
  const scores = new Set();
  for (const [type, data] of Object.entries(ENEMIES)) {
    assert.ok(data.hp > 0, type);
    assert.ok(data.r > 0, type);
    assert.ok(data.score > 0, type);
    assert.ok(!scores.has(data.score), `分值重复 ${type}`);
    scores.add(data.score);
  }
});

test("关卡：波次队形坐标全部落在舞台内", () => {
  for (const stage of STAGES) {
    for (const wave of stage.waves) {
      const slots = waveSlots(wave);
      assert.equal(slots.length, wave.count);
      for (const slot of slots) {
        assert.ok(slot.x >= 0 && slot.x <= STAGE_W, `${stage.id} x 越界`);
        assert.ok(slot.at >= 0);
      }
    }
  }
});

test("关卡：首领血量随面数递增，弹幕图案合法", () => {
  let previous = 0;
  const allowed = new Set(["fan", "ring", "spiral", "cross"]);
  for (const stage of STAGES) {
    assert.ok(stage.boss.hp > previous, "首领血量未递增");
    previous = stage.boss.hp;
    for (const pattern of stage.boss.patterns) assert.ok(allowed.has(pattern), pattern);
  }
});

test("关卡：越界索引被夹取到有效面", () => {
  assert.equal(getStage(-4).id, "stage_1");
  assert.equal(getStage(99).id, "stage_6");
  assert.equal(getStage("x").id, "stage_1");
});

test("训练：六十秒轮转配置完整", () => {
  assert.equal(TRAINING.duration, 60);
  assert.ok(TRAINING.interval > 0);
  assert.deepEqual(TRAINING.patterns, ["ring", "fan", "spiral", "cross"]);
  assert.ok(TRAINING.grazeThree > TRAINING.grazeTwo);
  assert.ok(STAGE_H > STAGE_W);
});
