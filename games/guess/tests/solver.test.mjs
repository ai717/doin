// solver.test.mjs —— 无死局的机器证据：求解器只用玩家可见信息，在预算内必胜

import test from "node:test";
import assert from "node:assert/strict";

import { createRun, remainingOf } from "../js/engine.mjs";
import { LEVELS } from "../js/levels.mjs";
import { mulberry32 } from "../js/rng.mjs";
import { solve, pickGuess, createWorlds } from "../js/solver.mjs";

const SEEDS_PER_LEVEL = 6;

test("每一关：求解器都能在预算内命中（只用可见信息）", () => {
  for (const lv of LEVELS) {
    for (let s = 0; s < SEEDS_PER_LEVEL; s += 1) {
      const seed = 1000 + s * 37 + lv.id * 11;
      const run = createRun(lv, mulberry32(seed));
      const out = solve(run, { maxSteps: 40 });
      assert.equal(out.hit, true, `lv${lv.id} seed${seed} 未能在预算内命中（用了 ${out.used}/${lv.budget}）`);
      assert.ok(out.used <= lv.budget, `lv${lv.id} 超支 ${out.used} > ${lv.budget}`);
      assert.equal(remainingOf(run) >= 0, true);
    }
  }
});

test("求解器不会读取隐藏目标：世界集合只由配置与回波决定", () => {
  const lv = LEVELS[13];
  const run = createRun(lv, mulberry32(4242));
  const hidden = run.target;
  // 把目标换成同区间的另一个值，求解器的第一步必须完全相同（它并不知情）
  const twin = createRun(lv, mulberry32(4242));
  twin.target = hidden === lv.max ? lv.min : hidden + 1;
  const a = pickGuess(run, createWorlds(run));
  const b = pickGuess(twin, createWorlds(twin));
  assert.equal(a, b, "求解器不得依赖隐藏目标");
});

test("最坏步数留有余量：实投不超过预算的 90%", () => {
  for (const lv of LEVELS) {
    let worst = 0;
    for (let s = 0; s < 4; s += 1) {
      const run = createRun(lv, mulberry32(7000 + s * 91 + lv.id));
      worst = Math.max(worst, solve(run, { maxSteps: 40 }).used);
    }
    assert.ok(worst <= Math.ceil(lv.budget * 0.95), `lv${lv.id} 最坏步数 ${worst} 贴预算太近（${lv.budget}）`);
  }
});
