import test from "node:test";
import assert from "node:assert/strict";
import * as Engine from "../js/engine.mjs";

test("Engine: 路径几何与恒定线速度插值", () => {
  const pStart = Engine.getPositionAtProgress(0);
  const pMid = Engine.getPositionAtProgress(0.5);
  const pEnd = Engine.getPositionAtProgress(1.0);

  assert.equal(typeof pStart.x, "number");
  assert.equal(typeof pStart.y, "number");
  assert.equal(typeof pEnd.x, "number");
  assert.equal(typeof pEnd.y, "number");

  // 边界 clamp 验证
  const pUnder = Engine.getPositionAtProgress(-0.5);
  const pOver = Engine.getPositionAtProgress(1.5);
  assert.deepEqual(pUnder, pStart);
  assert.deepEqual(pOver, pEnd);
});

test("Engine: 初始状态结构与不变量", () => {
  const state = Engine.createInitialState({ seed: 42 });
  assert.equal(state.status, "PREPARING");
  assert.equal(state.wave, 1);
  assert.equal(state.crystalHp, 20);
  assert.equal(state.mana, 220);
  assert.equal(Object.keys(state.towers).length, 0);
  assert.equal(state.rerollsLeft, 2);
  assert.equal(state.monsters.length, 0);
});

test("Engine: 符文塔建造、升阶与拆解闭环", () => {
  let state = Engine.createInitialState({ seed: 100 });

  // 1. 建造奥术塔
  const b1 = Engine.buildTower(state, "P1", "arcane");
  assert.equal(b1.ok, true);
  state = b1.state;
  assert.equal(state.towers.P1.type, "arcane");
  assert.equal(state.towers.P1.tier, 1);
  assert.equal(state.mana, 220 - Engine.RUNES.arcane.cost);

  // 重复建造应失败
  const b2 = Engine.buildTower(state, "P1", "flame");
  assert.equal(b2.ok, false);

  // 2. 升阶突破
  const u1 = Engine.upgradeTower(state, "P1");
  assert.equal(u1.ok, true);
  state = u1.state;
  assert.equal(state.towers.P1.tier, 2);

  // 3. 分解拆卸
  const s1 = Engine.salvageTower(state, "P1");
  assert.equal(s1.ok, true);
  state = s1.state;
  assert.equal(state.towers.P1, undefined);
  assert.ok(state.mana > 150, "分解应获得合理法力返还");
});

test("Engine: 波次编队与第 5/10/15/20 波领主生成", () => {
  const w1 = Engine.getWaveComposition(1);
  assert.ok(w1.some((g) => g.type === "crawler"));

  const w5 = Engine.getWaveComposition(5);
  assert.ok(w5.some((g) => g.type === "boss_wave_5"));

  const w10 = Engine.getWaveComposition(10);
  assert.ok(w10.some((g) => g.type === "boss_wave_10"));

  const w15 = Engine.getWaveComposition(15);
  assert.ok(w15.some((g) => g.type === "boss_wave_15"));

  const w20 = Engine.getWaveComposition(20);
  assert.ok(w20.some((g) => g.type === "boss_wave_20"));
});

test("Engine: 质变遗物抽卡与重抽保底", () => {
  let state = Engine.createInitialState({ seed: 777 });
  state.status = "RELIC_DRAFT";
  state.draftOptions = Engine.generateRelicDraft(state);
  assert.equal(state.draftOptions.length, 3);

  // 重抽测试
  const r1 = Engine.rerollRelics(state);
  assert.equal(r1.ok, true);
  state = r1.state;
  assert.equal(state.rerollsLeft, 1);
  assert.equal(state.draftOptions.length, 3);

  // 挑选遗物测试
  const pickId = state.draftOptions[0];
  const d1 = Engine.draftRelic(state, pickId);
  assert.equal(d1.ok, true);
  state = d1.state;
  assert.ok(state.activeRelics.includes(pickId));
  assert.equal(state.status, "PREPARING");
});

test("Engine: 固定步长战斗模拟与大步数随机游走（≥ 1000 步）", () => {
  let state = Engine.createInitialState({ seed: 88888 });

  // 初始建两座塔
  state = Engine.buildTower(state, "P1", "arcane").state;
  state = Engine.buildTower(state, "P2", "flame").state;

  // 开启第一波
  state = Engine.startWave(state).state;
  assert.equal(state.status, "COMBAT");

  const prng = Engine.createPRNG(999);
  const fixedDt = 1 / 60;

  for (let frame = 0; frame < 1200; frame++) {
    // 模拟随机战术动作（随机建塔、升阶、选卡、引潮）
    if (frame % 80 === 0 && prng() < 0.4) {
      const freeP = Engine.PEDESTALS.find((p) => !state.towers[p.id]);
      if (freeP && state.mana >= 95) {
        const types = ["arcane", "flame", "frost", "storm"];
        const randType = types[Math.floor(prng() * types.length)];
        const b = Engine.buildTower(state, freeP.id, randType);
        if (b.ok) state = b.state;
      }
    }

    if (frame % 100 === 0 && prng() < 0.3) {
      const builtKeys = Object.keys(state.towers);
      if (builtKeys.length > 0) {
        const targetP = builtKeys[Math.floor(prng() * builtKeys.length)];
        const u = Engine.upgradeTower(state, targetP);
        if (u.ok) state = u.state;
      }
    }

    if (state.status === "RELIC_DRAFT" && state.draftOptions.length > 0) {
      const d = Engine.draftRelic(state, state.draftOptions[0]);
      if (d.ok) state = d.state;
    }

    if (state.status === "PREPARING") {
      const s = Engine.startWave(state);
      if (s.ok) state = s.state;
    }

    // 核心物理步进
    state = Engine.stepFrame(state, fixedDt);

    // 不变式断言
    assert.ok(state.crystalHp >= 0, `水晶耐久不应为负: ${state.crystalHp}`);
    assert.ok(state.mana >= 0, `法力不应为负: ${state.mana}`);
    assert.ok(Object.keys(state.towers).length <= 10, "符文塔数量不得超过10座");
    assert.ok(["PREPARING", "COMBAT", "RELIC_DRAFT", "VICTORY", "GAMEOVER"].includes(state.status), "状态机流转异常");

    if (state.status === "VICTORY" || state.status === "GAMEOVER") {
      break;
    }
  }
});

test("Engine: 章节选关初始配置与资源配给", () => {
  const c1 = Engine.createInitialStateForChapter(1, { seed: 101 });
  assert.equal(c1.wave, 1);
  assert.equal(c1.mana, 220);
  assert.equal(c1.activeRelics.length, 0);

  const c2 = Engine.createInitialStateForChapter(2, { seed: 102 });
  assert.equal(c2.wave, 6);
  assert.equal(c2.mana, 550);
  assert.equal(c2.activeRelics.length, 2);

  const c3 = Engine.createInitialStateForChapter(3, { seed: 103 });
  assert.equal(c3.wave, 11);
  assert.equal(c3.mana, 950);
  assert.equal(c3.activeRelics.length, 4);

  const c4 = Engine.createInitialStateForChapter(4, { seed: 104 });
  assert.equal(c4.wave, 16);
  assert.equal(c4.mana, 1500);
  assert.equal(c4.activeRelics.length, 6);
});

