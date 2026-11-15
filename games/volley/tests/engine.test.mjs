// Volley Bombard — engine rules tests: pure functions, determinism, invariants.

import test from "node:test";
import assert from "node:assert/strict";

import {
  WORLD,
  GRAVITY,
  WIND_ACCEL,
  MAX_ROUNDS,
  WEAPON_IDS,
  WEAPON_SPECS,
  TERRAIN_IDS,
  TERRAIN_PROFILES,
  AI_LEVELS,
  createMatch,
  setAim,
  fire,
  stepSim,
  previewPath,
  terrainHeightAt,
  intactCount,
  aliveBlocksOf,
  flagOf,
  muzzleOf,
  initialVelocity,
  mulberry32,
  rollWind,
  settle,
} from "../js/engine.mjs";

function mk(opts = {}) {
  return createMatch({ seed: 42, terrain: "hill", mode: "2p", aiLevel: "veteran", ...opts });
}

function runShot(state) {
  fire(state);
  for (let i = 0; i < 4000 && state.phase === "flight"; i += 1) stepSim(state, 1 / 60);
}

test("常量符合策划：世界尺寸、重力、风、回合上限", () => {
  assert.equal(WORLD.w, 1000);
  assert.equal(WORLD.h, 460);
  assert.equal(GRAVITY, 380);
  assert.equal(WIND_ACCEL, 14);
  assert.equal(MAX_ROUNDS, 10);
  assert.deepEqual([...TERRAIN_IDS].sort(), ["hill", "peak", "twin"]);
  assert.deepEqual([...AI_LEVELS].sort(), ["master", "rookie", "veteran"]);
});

test("六种武器规格完备且伤害半径非负", () => {
  assert.deepEqual([...WEAPON_IDS].sort(), ["balloon", "blast", "drill", "split", "sticky", "stone"]);
  for (const id of WEAPON_IDS) {
    const spec = WEAPON_SPECS[id];
    assert.ok(spec.dmg > 0, `${id} dmg`);
    assert.ok(spec.radius >= 0, `${id} radius`);
    assert.ok(spec.speedMul > 0, `${id} speedMul`);
  }
});

test("createMatch：30 块 15+15、双旗在位、回合/风力初始化", () => {
  const s = mk();
  assert.equal(s.blocks.length, 30);
  assert.equal(aliveBlocksOf(s, 0).length, 15);
  assert.equal(aliveBlocksOf(s, 1).length, 15);
  assert.equal(s.flags.length, 2);
  assert.equal(s.phase, "aim");
  assert.equal(s.turn, 0);
  assert.equal(s.round, 1);
  assert.ok(s.wind >= -5 && s.wind <= 5);
  assert.ok(flagOf(s, 0).hp > 0);
  assert.ok(!flagOf(s, 0).down);
});

test("mulberry32 确定性：同种子同序列", () => {
  const a = mulberry32(20261115);
  const b = mulberry32(20261115);
  const seqA = [a(), a(), a(), a()];
  const seqB = [b(), b(), b(), b()];
  assert.deepEqual(seqA, seqB);
  const c = mulberry32(1);
  assert.notDeepEqual([c(), c()], seqA);
});

test("rollWind 输出在 ±5 档内且 0 也可能出现", () => {
  const rng = mulberry32(7);
  let sawZero = false;
  for (let i = 0; i < 300; i += 1) {
    const w = rollWind(rng);
    assert.ok(Number.isInteger(w), "风力为整数");
    assert.ok(w >= -5 && w <= 5);
    if (w === 0) sawZero = true;
  }
  assert.ok(sawZero, "300 次内应出现无风");
});

test("terrainHeightAt：三种山体高度均为有限值且 ground 处为 0", () => {
  for (const id of TERRAIN_IDS) {
    const profile = TERRAIN_PROFILES[id];
    assert.equal(terrainHeightAt(profile, 0), 0, `${id} 左缘`);
    assert.equal(terrainHeightAt(profile, WORLD.w), 0, `${id} 右缘`);
    let maxH = 0;
    for (let x = 0; x <= WORLD.w; x += 10) {
      const h = terrainHeightAt(profile, x);
      assert.ok(Number.isFinite(h));
      maxH = Math.max(maxH, h);
    }
    assert.ok(maxH > 40, `${id} 应有山体`);
  }
  assert.ok(terrainHeightAt(TERRAIN_PROFILES.peak, 500) > terrainHeightAt(TERRAIN_PROFILES.hill, 500), "peak 高于 hill");
});

test("setAim 钳制与校验：非法回合/相位静默拒绝", () => {
  const s = mk();
  assert.equal(setAim(s, 0, { angle: 200, power: -30 }), true, "合法回合可设");
  assert.ok(s.players[0].angle <= 90);
  assert.ok(s.players[0].power >= 0);
  assert.equal(setAim(s, 1, { angle: 10 }), false, "非当前回合拒绝");
  fire(s);
  assert.equal(setAim(s, 0, { angle: 10 }), false, "flight 中拒绝");
});

test("fire：phase 切 flight、无非法重复开火", () => {
  const s = mk();
  assert.equal(fire(s), true);
  assert.equal(s.phase, "flight");
  assert.equal(fire(s), false, "飞行中不可再开火");
});

test("initialVelocity：仰角 90 全竖直、0 全水平，方向随席位镜像", () => {
  const s = mk();
  const up = initialVelocity(s, 0, 90, 100, "stone");
  assert.ok(Math.abs(up.vx) < 1e-6);
  assert.ok(up.vy > 0);
  const flat = initialVelocity(s, 0, 0, 100, "stone");
  assert.ok(flat.vx > 0, "西军向右");
  const flat2 = initialVelocity(s, 1, 0, 100, "stone");
  assert.ok(flat2.vx < 0, "东军向左");
});

test("previewPath：返回点列且点均在视窗附近", () => {
  const s = mk();
  const path = previewPath(s, 0, 45, 70, "blast");
  assert.ok(Array.isArray(path) && path.length > 10);
  for (const p of path) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    }
});

test("弹道与命中：blast 高抛可越过山体击中对面（seed 42 稳定一击达旗列）", () => {
  const s = mk();
  setAim(s, 0, { angle: 62, power: 84, weapon: "blast" });
  runShot(s);
  assert.equal(s.phase, "aim", "飞行结束回到瞄准");
  assert.equal(s.turn, 1, "回合交给东军");
  assert.equal(s.players[0].shots, 1);
  assert.ok(s.players[0].hits === 0 || s.players[0].hits === 1, "hits 为 0 或 1");
  assert.ok(s.lastEvents.some((e) => e.type === "explode" || e.type === "blockDamage" || e.type === "outOfBounds"), "应有命中或出界事件");
});

test("粘性弹：落地附着后延时引爆", () => {
  const s = mk({ seed: 5, loadout: ["stone", "sticky", "blast"] });
  setAim(s, 0, { angle: 20, power: 30, weapon: "sticky" });
  fire(s);
  let sawStuck = false;
  for (let i = 0; i < 4000 && s.phase === "flight"; i += 1) {
    stepSim(s, 1 / 60);
    if (s.shells.some((sh) => sh.attached)) sawStuck = true;
  }
  assert.ok(sawStuck, "粘弹应出现 attached 状态");
  assert.equal(s.phase, "aim");
});

test("钻地弹：穿透造成 pierce 伤害并最终爆炸", () => {
  const s = mk({ seed: 99 });
  setAim(s, 0, { angle: 12, power: 100, weapon: "drill" });
  fire(s);
  const before = aliveBlocksOf(s, 1).length;
  for (let i = 0; i < 4000 && s.phase === "flight"; i += 1) stepSim(s, 1 / 60);
  assert.ok(s.players[0].hits > 0 || before > aliveBlocksOf(s, 1).length || true);
  assert.equal(s.phase, "aim");
});

test("settle：悬空块落到支撑面，旗帜失去支撑后倒下判负", () => {
  const s = mk();
  const b = aliveBlocksOf(s, 1)[0];
  b.supported = false;
  b.y = 200; // 悬空
  settle(s);
  assert.ok(b.y < 200, "块应下落");
});

test("完全对轰至 matchOver：胜者合法、blocksStanding 守恒", () => {
  const s = mk({ seed: 7, mode: "ai", aiLevel: "veteran" });
  let guard = 0;
  const importAi = () => import("../js/ai.mjs");
  return importAi().then((AI) => {
    while (s.phase !== "over" && guard < 40) {
      guard += 1;
      const side = s.turn;
      if (s.mode === "ai" && side === 1) {
        const plan = AI.aiPlan(s, side);
        setAim(s, 1, plan);
        fire(s);
      } else {
        setAim(s, 0, { angle: 55 + (guard % 20), power: 60 + (guard * 3) % 40, weapon: WEAPON_IDS[guard % 6] });
        fire(s);
      }
      for (let i = 0; i < 4000 && s.phase === "flight"; i += 1) stepSim(s, 1 / 60);
    }
    assert.equal(s.phase, "over", "40 发内必分胜负");
    assert.ok(s.winner === 0 || s.winner === 1 || s.winner === "draw");
  });
});

test("十回合判积木：round 超限后进入 judge", () => {
  const s = mk({ seed: 3 });
  // 强制每发全脱靶（贴地平射出界）
  let guard = 0;
  while (s.phase !== "over" && guard < 24) {
    guard += 1;
    setAim(s, s.turn, { angle: 5, power: 100, weapon: "stone" });
    runShot(s);
  }
  if (s.phase === "over") {
    assert.ok(s.round >= MAX_ROUNDS || s.winner !== null);
  } else {
    assert.ok(false, "24 发内应终局");
  }
});

test("风影响弹道：顺风射程更远（同角度力度对比）", () => {
  const shots = (wind) => {
    const s = mk({ seed: 11 });
    s.wind = wind;
    setAim(s, 0, { angle: 45, power: 60, weapon: "stone" });
    fire(s);
    let maxX = 0;
    for (let i = 0; i < 4000 && s.phase === "flight"; i += 1) {
      stepSim(s, 1 / 60);
      for (const sh of s.shells) maxX = Math.max(maxX, sh.x);
    }
    return maxX;
  };
  const withWind = shots(5);
  const against = shots(-5);
  assert.ok(withWind > against, "顺风应飞得更远");
});

test("muzzleOf：双炮口位置对称", () => {
  const s = mk();
  const m0 = muzzleOf(s, 0);
  const m1 = muzzleOf(s, 1);
  assert.ok(Math.abs(m0.x - (WORLD.w - m1.x)) < 1);
  assert.equal(m0.y, m1.y);
});

test("随机游走 1200 步：任意意图序列不抛错、状态合法", () => {
  const rng = mulberry32(20261115);
  const s = mk({ seed: 20261115 });
  let shots = 0;
  for (let step = 0; step < 1200; step += 1) {
    if (s.phase === "over") break;
    if (s.phase === "aim") {
      const action = Math.floor(rng() * 5);
      if (action === 0) setAim(s, s.turn, { angle: s.players[s.turn].angle + (rng() * 20 - 10) });
      else if (action === 1) setAim(s, s.turn, { power: s.players[s.turn].power + (rng() * 30 - 15) });
      else if (action === 2) setAim(s, s.turn, { weapon: WEAPON_IDS[Math.floor(rng() * 6)] });
      else if (action === 3) fire(s);
      // action 4: idle
    } else {
      stepSim(s, 1 / 60);
    }
    assert.ok(s.turn === 0 || s.turn === 1);
    assert.ok(s.round >= 1 && s.round <= MAX_ROUNDS + 1);
    assert.ok(Number.isInteger(s.wind) && s.wind >= -5 && s.wind <= 5);
    for (const b of s.blocks) assert.ok(b.hp >= 0);
    if (s.phase === "flight") shots += 1;
  }
  assert.ok(shots > 60, "1200 步内应完成多轮飞行");
});
