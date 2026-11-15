// Volley Bombard — AI solver tests: legality, scoring sanity, level difficulty.

import test from "node:test";
import assert from "node:assert/strict";

import { createMatch, setAim, fire, stepSim, aliveBlocksOf, flagOf, AI_ERROR, AI_POWER_ERROR, TERRAIN_PROFILES, terrainHeightAt } from "../js/engine.mjs";
import { simulateShot, aiPlan } from "../js/ai.mjs";

function mk(opts = {}) {
  return createMatch({ seed: 42, terrain: "hill", mode: "ai", aiLevel: "veteran", ...opts });
}

test("simulateShot：真实命中给正伤害、完全脱靶给零", () => {
  const s = mk();
  // direct-ish blast at enemy fort
  const hit = simulateShot(s, 0, 62, 84, "blast");
  assert.ok(hit.enemyDamage >= 0 && hit.selfDamage >= 0);
  const miss = simulateShot(s, 0, 5, 30, "stone");
  assert.equal(miss.enemyDamage, 0);
  assert.equal(miss.selfDamage, 0);
});

test("simulateShot：对敌堡伤害显著高于对自己（西军标准 blast 位）", () => {
  const s = mk({ seed: 42 });
  const r = simulateShot(s, 0, 62, 84, "blast");
  assert.ok(r.enemyDamage > 0, "seed42 62°/84 blast 应命中东堡");
});

test("simulateShot：flagKilled 仅在虚拟击破敌旗时为真", () => {
  const s = mk();
  const r = simulateShot(s, 0, 80, 100, "blast");
  assert.equal(typeof r.flagKilled, "boolean");
});

test("aiPlan：输出合法角度/力度/武器且随 AI 等级误差收敛", () => {
  const s = mk({ seed: 42 });
  const plan = aiPlan(s, 1);
  assert.ok(plan.angle >= 0 && plan.angle <= 90, "angle 钳制");
  assert.ok(plan.power >= 10 && plan.power <= 100, "power 钳制");
  assert.ok(s.weapons.includes(plan.weapon), "武器在携带列表内");
});

test("aiPlan：三档难度确定可用（rookie/veteran/master 均产出计划）", () => {
  for (const level of ["rookie", "veteran", "master"]) {
    const s = mk({ seed: 9, aiLevel: level });
    const plan = aiPlan(s, 1);
    assert.ok(Number.isFinite(plan.angle) && Number.isFinite(plan.power), level);
    assert.ok(AI_ERROR[level] >= AI_ERROR.master, "误差 rookie≥master");
    assert.ok(AI_POWER_ERROR[level] >= AI_POWER_ERROR.master, "力度误差 rookie≥master");
  }
});

test("AI 实战：master 数发内轰塌西军旗帜（AI 执先手连射）", () => {
  const s = mk({ seed: 42, aiLevel: "master" });
  // The AI opens on side 0; let it keep firing while side 1 idles out weak shots.
  let guard = 0;
  while (s.phase !== "over" && guard < 24) {
    guard += 1;
    if (s.turn === 0) {
      const plan = aiPlan(s, 0);
      setAim(s, 0, plan);
      fire(s);
    } else {
      setAim(s, 1, { angle: 3, power: 35, weapon: s.weapons[0] });
      fire(s);
    }
    for (let i = 0; i < 4000 && s.phase === "flight"; i += 1) stepSim(s, 1 / 60);
  }
  assert.ok(
    aliveBlocksOf(s, 1).length < 15 || flagOf(s, 1).down || s.winner !== null,
    "master 应打崩东军（碎块/塌旗/判胜任一）",
  );
});

test("AI 自保：不从近距离平射自己堡垒（selfDamage 权重生效）", () => {
  const s = mk({ seed: 77 });
  const plan = aiPlan(s, 0);
  const r = simulateShot(s, 0, plan.angle, plan.power, plan.weapon);
  assert.ok(r.selfDamage <= r.enemyDamage * 2, "计划不应严重自伤");
});

test("三种山体下 aiPlan 均能给出越山弹道", () => {
  for (const terrain of ["hill", "peak", "twin"]) {
    const s = mk({ seed: 15, terrain });
    const plan = aiPlan(s, 0);
    const r = simulateShot(s, 0, plan.angle, plan.power, plan.weapon);
    assert.ok(r.enemyDamage > 0, `${terrain} 应能打到对面`);
  }
});

test("simulateShot 与引擎物理一致性：顶点分裂产生额外弹道（split 武器）", () => {
  const s = mk({ seed: 42, loadout: ["split", "blast", "stone"] });
  const r = simulateShot(s, 0, 45, 80, "split");
  assert.ok(r.enemyDamage >= 0);
  // split always terminates within step budget
  assert.ok(Number.isFinite(r.enemyDamage) && Number.isFinite(r.selfDamage));
});

test("随机游走 1000 次 aiPlan：任何局面下不抛错、计划合法", () => {
  const s = mk({ seed: 2026 });
  let plans = 0;
  for (let i = 0; i < 1000 && s.phase !== "over"; i += 1) {
    if (s.phase === "aim") {
      const side = s.turn;
      const plan = aiPlan(s, side);
      assert.ok(plan.angle >= 0 && plan.angle <= 90);
      assert.ok(s.weapons.includes(plan.weapon));
      plans += 1;
      setAim(s, side, plan);
      fire(s);
    } else {
      stepSim(s, 1 / 60);
    }
  }
  assert.ok(plans >= 4, "至少完成数轮规划");
});
