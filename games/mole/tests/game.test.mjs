// game.test.mjs — 控制器：开始 / 暂停 / 敲击 / 结算
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createController, setGrid, start, pause, resume, togglePause,
  hit, tick, isOver, isRunning, summary, difficultyOf, MODES,
} from "../js/game.mjs";
import { PHASE } from "../js/engine.mjs";

function booted(mode = "normal") {
  const game = createController({ rows: 3, cols: 4 });
  setGrid(game, 3, 4);
  start(game, { mode, seed: 99 });
  return game;
}

describe("game: 生命周期", () => {
  it("开局即运行，未开局时敲击为 no-op", () => {
    const game = createController();
    assert.equal(isRunning(game), false);
    assert.equal(hit(game, 0).ok, false);
    assert.deepEqual(tick(game, 16), []);
  });

  it("暂停后 tick 不推进，恢复后继续", () => {
    const game = booted();
    tick(game, 16);
    const before = game.run.timeLeftMs;
    assert.equal(pause(game), true);
    assert.equal(pause(game), false, "重复暂停返回 false");
    assert.equal(isRunning(game), false);
    tick(game, 500);
    assert.equal(game.run.timeLeftMs, before, "暂停期间时间不流逝");
    assert.equal(hit(game, 0).ok, false, "暂停时敲击无效");
    assert.equal(resume(game), true);
    tick(game, 16);
    assert.ok(game.run.timeLeftMs < before);
  });

  it("togglePause 双向切换", () => {
    const game = booted();
    assert.equal(togglePause(game), true);
    assert.equal(game.paused, true);
    assert.equal(togglePause(game), true);
    assert.equal(game.paused, false);
  });

  it("终局后暂停/恢复与敲击全部 no-op", () => {
    const game = booted();
    for (let i = 0; i < 5000 && !isOver(game); i += 1) tick(game, 16);
    assert.equal(isOver(game), true);
    assert.equal(pause(game), false);
    assert.equal(resume(game), false);
    assert.equal(hit(game, 0).ok, false);
  });
});

describe("game: 模式与结算", () => {
  it("每日模式映射 normal 难度但单独记分", () => {
    const game = booted("daily");
    assert.equal(game.run.difficulty, "normal");
    assert.equal(game.run.daily, true);
    assert.equal(difficultyOf("daily"), "normal");
  });

  it("非法难度回退 normal", () => {
    assert.equal(difficultyOf("hell"), "normal");
    assert.ok(MODES.includes("daily"));
  });

  it("结算摘要字段完整且非负", () => {
    const game = booted("crazy");
    for (let i = 0; i < 5000 && !isOver(game); i += 1) {
      tick(game, 16);
      for (let k = 0; k < 12; k += 1) hit(game, k);
    }
    const sum = summary(game);
    assert.equal(sum.mode, "crazy");
    for (const key of ["score", "maxCombo", "hits", "misses", "bombs", "frenzyCount", "accuracy"]) {
      assert.ok(Number.isFinite(sum[key]), `${key} 非法`);
      assert.ok(sum[key] >= 0, `${key} 为负`);
    }
    assert.ok(sum.accuracy >= 0 && sum.accuracy <= 100);
  });

  it("未开局也能拿到安全摘要", () => {
    const game = createController();
    const sum = summary(game);
    assert.equal(sum.score, 0);
    assert.equal(sum.maxCombo, 0);
  });

  it("重开重置分数与连击", () => {
    const game = booted();
    game.run.score = 40;
    game.run.combo = 7;
    start(game, { mode: "normal", seed: 5 });
    assert.equal(game.run.score, 0);
    assert.equal(game.run.combo, 0);
    assert.equal(game.paused, false);
  });
});

describe("game: 网格与引擎一致", () => {
  it("setGrid 影响洞位数", () => {
    const game = createController();
    setGrid(game, 3, 3);
    start(game, { mode: "easy", seed: 1 });
    assert.equal(game.run.holeCount, 9);
    assert.equal(game.run.holes.length, 9);
  });

  it("越界敲击安全", () => {
    const game = booted();
    for (const idx of [-1, 99, Number.NaN]) {
      const res = hit(game, idx);
      assert.equal(res.ok, false);
    }
    for (const hole of game.run.holes) {
      if (hole) assert.ok(Object.values(PHASE).includes(hole.phase));
    }
  });
});
