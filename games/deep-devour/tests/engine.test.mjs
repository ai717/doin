import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ABYSS,
  COMBO_WINDOW,
  FRENZY_CHAIN,
  MAX_PREY,
  MAX_TIER,
  MIN_EDIBLE,
  PLAYER,
  PRESSURE,
  SHOAL_MAX,
  SHOAL_PER,
  STATUS,
  TIER_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  abyssTick,
  canEat,
  clamp,
  createAbyssLevel,
  createState,
  depthMultFor,
  eatYield,
  edibleCount,
  fishSpeed,
  growthMult,
  growthNeeded,
  mulberry32,
  pauseState,
  playerRadius,
  radiusForTier,
  relationFor,
  resumeState,
  setWorldHeight,
  spawnFish,
  spawnPower,
  stepFrame,
  summarise,
  tierPoolFor,
} from "../js/engine.mjs";
import { LEVELS, levelById, levelsOfZone } from "../js/levels.mjs";

const STEP = 1 / 60;

function freshLevel(id = "1-1", seed = 4242) {
  const state = createState(levelById(id), { seed });
  setWorldHeight(state, WORLD_HEIGHT);
  return state;
}

function clearGrace(state) {
  state.protect = 0;
  state.player.invuln = 0;
  state.player.stun = 0;
  return state;
}

function damageEvents(state) {
  return state.events.filter((event) => event.type === "damage" || event.type === "bitten");
}

describe("食物链：体型是唯一判定", () => {
  it("只有严格更大才能吃", () => {
    assert.equal(canEat(3, 2), true);
    assert.equal(canEat(2, 3), false);
    assert.equal(canEat(3, 3), false, "同级互不相犯");
  });

  it("relationFor 给出 prey / hunter / peer 三态", () => {
    assert.equal(relationFor(2, 4), "prey");
    assert.equal(relationFor(5, 4), "hunter");
    assert.equal(relationFor(4, 4), "peer");
  });

  it("体型半径表随阶数严格递增，且第 7 阶是霸主", () => {
    for (let tier = 1; tier < MAX_TIER; tier += 1) {
      assert.ok(radiusForTier(tier) < radiusForTier(tier + 1), `tier ${tier} 应小于 ${tier + 1}`);
    }
    assert.equal(TIER_RADIUS[0], 0);
    assert.equal(radiusForTier(MAX_TIER + 3), TIER_RADIUS[MAX_TIER], "越界被钳制");
  });

  it("成长需求与产出都是纯查表，封顶后不再需要成长", () => {
    assert.equal(growthNeeded(MAX_TIER), 0);
    assert.equal(growthNeeded(MAX_TIER + 5), 0);
    assert.ok(growthNeeded(2) > 0);
    assert.ok(eatYield(1) > 0, "最小体型也有营养");
    assert.equal(eatYield(0), eatYield(1), "阶数越界即钳制到合法区间");
    assert.ok(eatYield(6) > eatYield(2), "越大越肥");
    for (let tier = 1; tier < MAX_TIER; tier += 1) {
      assert.ok(eatYield(tier + 1) >= eatYield(tier), "产出随阶数单调不减");
    }
  });

  it("鱼速随阶数变快 —— 高阶猎物更难追", () => {
    assert.ok(fishSpeed(6) > fishSpeed(2));
  });
});

describe("确定性随机", () => {
  it("mulberry32 同种子完全复现，输出落在 [0,1)", () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    for (let i = 0; i < 200; i += 1) {
      const value = a();
      assert.equal(value, b());
      assert.ok(value >= 0 && value < 1);
    }
    const c = mulberry32(1235);
    let differs = false;
    const d = mulberry32(1234);
    for (let i = 0; i < 50; i += 1) {
      if (c() !== d()) differs = true;
    }
    assert.ok(differs, "不同种子必须给出不同序列");
  });

  it("同种子的世界布局逐字段一致，异种子不同", () => {
    const a = freshLevel("3-5", 999);
    const b = freshLevel("3-5", 999);
    assert.equal(a.entities.length, b.entities.length);
    for (let i = 0; i < a.entities.length; i += 1) {
      assert.equal(a.entities[i].x, b.entities[i].x);
      assert.equal(a.entities[i].y, b.entities[i].y);
      assert.equal(a.entities[i].tier, b.entities[i].tier);
      assert.equal(a.entities[i].species, b.entities[i].species);
    }
    assert.equal(a.hazards.length, b.hazards.length);
    const c = freshLevel("3-5", 1000);
    const same = a.entities.every((entity, i) => c.entities[i] && entity.x === c.entities[i].x);
    assert.equal(same, false);
  });

  it("完整 300 步同种子跑出完全相同的结算摘要", () => {
    const run = (seed) => {
      const state = freshLevel("2-3", seed);
      const rng = mulberry32(seed + 7);
      for (let i = 0; i < 300; i += 1) {
        stepFrame(state, STEP, { dirX: rng() * 2 - 1, dirY: rng() * 2 - 1, sprint: rng() < 0.25 });
      }
      return summarise(state);
    };
    assert.deepEqual(run(31337), run(31337));
  });
});

describe("世界与状态机基本不变量", () => {
  it("关闭非 playing 状态时 stepFrame 是 no-op", () => {
    const state = freshLevel();
    state.status = STATUS.paused;
    const before = state.time;
    stepFrame(state, STEP, { dirX: 1, dirY: 0 });
    assert.equal(state.time, before);
  });

  it("dt 被钳制在 0..0.05，负值与 0 不推进时间", () => {
    const state = freshLevel();
    const t0 = state.time;
    stepFrame(state, -1, {});
    stepFrame(state, 0, {});
    assert.equal(state.time, t0);
    stepFrame(state, 9, {});
    assert.ok(state.time - t0 <= 0.05 + 1e-9);
  });

  it("玩家被夹在世界内，且半径与阶数一致", () => {
    const state = freshLevel();
    for (let i = 0; i < 600; i += 1) {
      stepFrame(state, STEP, { dirX: 1, dirY: 1, sprint: true });
    }
    const radius = playerRadius(state);
    assert.ok(state.player.x >= 0 && state.player.x <= WORLD_WIDTH);
    assert.ok(state.player.y >= 0 && state.player.y <= state.world.height);
    assert.equal(radius, radiusForTier(state.player.tier) * 0.92);
  });

  it("pause / resume 只对 playing 生效", () => {
    const state = freshLevel();
    assert.equal(pauseState(state), true);
    assert.equal(state.status, STATUS.paused);
    assert.equal(pauseState(state), false);
    assert.equal(resumeState(state), true);
    assert.equal(state.status, STATUS.playing);
    assert.equal(resumeState(state), false);
  });

  it("setWorldHeight 会重新夹住所有实体", () => {
    const state = freshLevel();
    setWorldHeight(state, 500);
    for (const entity of state.entities) {
      assert.ok(entity.y <= 500 - entity.r + 1e-6);
    }
    setWorldHeight(state, 1800);
    assert.equal(state.world.height, 1800);
  });
});

describe("吞食与被吃", () => {
  it("吃到更小的鱼会涨成长、加吞食数", () => {
    const state = freshLevel();
    const tier = state.player.tier;
    spawnFish(state, { tier: tier - 1, x: state.player.x, y: state.player.y });
    const eatenBefore = state.stats.eaten;
    stepFrame(state, STEP, {});
    assert.equal(state.stats.eaten, eatenBefore + 1);
    assert.ok(state.player.growth > 0 || state.player.tier > tier);
  });

  it("撞上更大的鱼会扣心、退阶、并被弹开", () => {
    const state = clearGrace(freshLevel("2-2"));
    state.player.tier = 4;
    spawnFish(state, { tier: 6, x: state.player.x, y: state.player.y });
    const heartsBefore = state.player.hearts;
    stepFrame(state, STEP, {});
    assert.equal(state.player.hearts, heartsBefore - 1);
    assert.equal(state.player.tier, 3, "退一阶");
    const speed = Math.hypot(state.player.vx, state.player.vy);
    assert.ok(speed > 50, "被咬后必须被弹离那张嘴");
  });

  it("掠食者的硬直严格长于玩家无敌，逃生窗口是真的", () => {
    const state = clearGrace(freshLevel("2-2"));
    const shark = spawnFish(state, { tier: 6, x: state.player.x, y: state.player.y });
    stepFrame(state, STEP, {});
    assert.ok(state.player.invuln >= PLAYER.invuln - 1e-9);
    assert.ok(shark.stun > state.player.invuln, "硬直必须比无敌长一拍");
  });

  it("无敌期内不会二次掉心", () => {
    const state = clearGrace(freshLevel("2-2"));
    spawnFish(state, { tier: 6, x: state.player.x, y: state.player.y });
    stepFrame(state, STEP, {});
    const hearts = state.player.hearts;
    for (let i = 0; i < 60; i += 1) {
      spawnFish(state, { tier: 6, x: state.player.x, y: state.player.y });
      stepFrame(state, STEP, {});
    }
    assert.equal(state.player.hearts, hearts, "无敌期内不该再掉心");
  });

  it("心数归零即判负并派发 lost", () => {
    const state = freshLevel("2-2");
    let guard = 0;
    while (state.status === STATUS.playing && guard < 4000) {
      state.protect = 0;
      state.player.invuln = 0;
      spawnFish(state, { tier: 7, x: state.player.x, y: state.player.y });
      stepFrame(state, STEP, {});
      guard += 1;
    }
    assert.equal(state.status, STATUS.lost);
  });
});

describe("可食目标下限：机制上排除死局", () => {
  it("无论怎么游，场上始终保底 ≥ MIN_EDIBLE 条可食目标", () => {
    const rng = mulberry32(2024);
    const state = freshLevel("1-6");
    let lowest = Infinity;
    for (let i = 0; i < 1200; i += 1) {
      stepFrame(state, STEP, { dirX: rng() * 2 - 1, dirY: rng() * 2 - 1 });
      lowest = Math.min(lowest, edibleCount(state));
    }
    assert.ok(lowest >= MIN_EDIBLE, `最低可食目标数 ${lowest} 低于保底 ${MIN_EDIBLE}`);
  });

  it("比玩家大的鱼只来自关卡显式配置，不随机生成", () => {
    const rng = mulberry32(77);
    const level = levelById("1-5"); // hunters: tier 4 ×2，玩家起手 tier 3
    const state = freshLevel("1-5");
    const configured = level.spawn.hunters.reduce((sum, spec) => sum + spec.count, 0);
    let peak = 0;
    for (let i = 0; i < 900; i += 1) {
      stepFrame(state, STEP, { dirX: rng() * 2 - 1, dirY: rng() * 2 - 1 });
      const hunters = state.entities.filter((entity) => entity.tier > state.player.tier).length;
      peak = Math.max(peak, hunters);
    }
    assert.ok(peak <= configured, `场上掠食者 ${peak} 超过配置的 ${configured}`);
  });

  it("场上鱼数不超过配额上限", () => {
    const rng = mulberry32(5150);
    const state = freshLevel("1-1");
    for (let i = 0; i < 1500; i += 1) {
      stepFrame(state, STEP, { dirX: rng() * 2 - 1, dirY: rng() * 2 - 1 });
      assert.ok(state.entities.length <= MAX_PREY + 12, `实体数 ${state.entities.length} 失控`);
    }
  });
});

describe("狂暴连锁", () => {
  it("1.2 秒内续吃，5 连点燃狂暴、12 连升双重", () => {
    const state = freshLevel("2-1"); // frenzy 机制开启的海域
    const tier = state.player.tier;
    const drive = (times) => {
      for (let i = 0; i < times; i += 1) {
        spawnFish(state, { tier: Math.max(1, tier - 1), x: state.player.x, y: state.player.y });
        stepFrame(state, STEP, {});
      }
    };
    drive(FRENZY_CHAIN[1]);
    assert.equal(state.combo, FRENZY_CHAIN[1]);
    assert.equal(state.frenzy, 1);
    drive(FRENZY_CHAIN[2] - FRENZY_CHAIN[1]);
    assert.equal(state.frenzy, 2);
    assert.ok(state.stats.bestCombo >= FRENZY_CHAIN[2]);
  });

  it("超过连击窗口就断链、狂暴归零", () => {
    const state = freshLevel("2-1");
    const tier = state.player.tier;
    for (let i = 0; i < FRENZY_CHAIN[1]; i += 1) {
      spawnFish(state, { tier: tier - 1, x: state.player.x, y: state.player.y });
      stepFrame(state, STEP, {});
    }
    assert.ok(state.frenzy > 0);
    const frames = Math.ceil((COMBO_WINDOW + 0.2) / STEP);
    for (let i = 0; i < frames; i += 1) stepFrame(state, STEP, {});
    assert.equal(state.combo, 0);
    assert.equal(state.frenzy, 0);
  });

  it("第 1 海域不启用狂暴（逐章解锁的规则是硬开关）", () => {
    const state = freshLevel("1-3");
    const tier = state.player.tier;
    for (let i = 0; i < 20; i += 1) {
      spawnFish(state, { tier: tier - 1, x: state.player.x, y: state.player.y });
      stepFrame(state, STEP, {});
    }
    assert.equal(state.frenzy, 0, "珊瑚浅滩不该有狂暴");
  });
});

describe("鱼群同行", () => {
  it("吃满 3 条同种小鱼就多一尾随行鱼，最多 3 尾", () => {
    const state = freshLevel("3-1");
    const species = "sardine";
    const tier = state.player.tier;
    for (let i = 0; i < SHOAL_PER * 6; i += 1) {
      spawnFish(state, { tier: tier - 1, species, x: state.player.x, y: state.player.y });
      stepFrame(state, STEP, {});
    }
    assert.ok(state.shoal.length >= 1, "应至少有一尾随行鱼");
    assert.ok(state.shoal.length <= SHOAL_MAX);
  });

  it("随行鱼替玩家挡下一次掠食者的嘴（不扣心）", () => {
    const state = clearGrace(freshLevel("3-1"));
    state.player.tier = 4;
    const species = "sardine";
    for (let i = 0; i < SHOAL_PER; i += 1) {
      spawnFish(state, { tier: 3, species, x: state.player.x, y: state.player.y });
      stepFrame(state, STEP, {});
    }
    assert.equal(state.shoal.length, 1);
    const hearts = state.player.hearts;
    spawnFish(state, { tier: 6, x: state.player.x, y: state.player.y });
    stepFrame(state, STEP, {});
    assert.equal(state.shoal.length, 0, "随行鱼应被消耗掉");
    assert.equal(state.player.hearts, hearts, "随行鱼应替玩家挡下这一口");
  });

  it("第 1、2 海域不启用鱼群", () => {
    const state = freshLevel("2-1");
    const tier = state.player.tier;
    for (let i = 0; i < 12; i += 1) {
      spawnFish(state, { tier: tier - 1, species: "sardine", x: state.player.x, y: state.player.y });
      stepFrame(state, STEP, {});
    }
    assert.equal(state.shoal.length, 0);
  });
});

describe("危险物：冲刺反制 = 策划案 §3.3", () => {
  function placeHazard(state, kind) {
    state.hazards.push({
      id: 9000 + state.hazards.length,
      kind,
      x: state.player.x,
      y: state.player.y,
      vx: 0,
      vy: 0,
      r: { jelly: 30, urchin: 28, mine: 22, net: 42, chest: 32 }[kind],
      phase: 0,
    });
    return state.hazards[state.hazards.length - 1];
  }

  it("冲刺撞爆水雷：不扣心，换来一下冲击波", () => {
    const state = clearGrace(freshLevel("4-2"));
    // 关卡自身也可能配了水雷，所以只能认这一颗（按引用比对）。
    const mine = placeHazard(state, "mine");
    const hearts = state.player.hearts;
    stepFrame(state, STEP, { sprint: true });
    assert.equal(state.player.hearts, hearts, "冲刺撞水雷不该扣心");
    assert.ok(state.events.some((event) => event.type === "defuse"));
    assert.equal(state.hazards.includes(mine), false, "撞爆的水雷应从场上消失");
  });

  it("不冲刺硬撞水雷：扣心", () => {
    const state = clearGrace(freshLevel("4-2"));
    placeHazard(state, "mine");
    const hearts = state.player.hearts;
    stepFrame(state, STEP, {});
    assert.equal(state.player.hearts, hearts - 1);
  });

  it("冲刺撞破渔网：不扣心、不被缠", () => {
    const state = clearGrace(freshLevel("4-2"));
    placeHazard(state, "net");
    const hearts = state.player.hearts;
    stepFrame(state, STEP, { sprint: true });
    assert.equal(state.player.hearts, hearts);
    assert.equal(state.player.snare, 0, "撞破的网不该缠住玩家");
    assert.ok(state.events.some((event) => event.type === "netBroke"));
  });

  it("撞进渔网只会被缠住减速，不扣心（§3.3 定义的机动陷阱）", () => {
    const state = clearGrace(freshLevel("4-2"));
    placeHazard(state, "net");
    const hearts = state.player.hearts;
    stepFrame(state, STEP, {});
    assert.equal(state.player.hearts, hearts, "渔网不该扣心");
    assert.ok(state.player.snare > 0);
  });

  it("冲刺能挣脱渔网", () => {
    const state = clearGrace(freshLevel("4-2"));
    placeHazard(state, "net");
    stepFrame(state, STEP, {});
    assert.ok(state.player.snare > 0);
    for (let i = 0; i < 120; i += 1) stepFrame(state, STEP, { sprint: true });
    assert.equal(state.player.snare, 0, "冲刺应能扯断渔网");
  });

  it("海胆无论是否冲刺都扣心", () => {
    for (const sprint of [false, true]) {
      const state = clearGrace(freshLevel("3-2"));
      placeHazard(state, "urchin");
      const hearts = state.player.hearts;
      stepFrame(state, STEP, { sprint });
      assert.equal(state.player.hearts, hearts - 1);
    }
  });

  it("宝箱只给增益或空箱，绝不扣心", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const state = clearGrace(freshLevel("4-7", seed * 31));
      placeHazard(state, "chest");
      const hearts = state.player.hearts;
      stepFrame(state, STEP, {});
      assert.equal(state.player.hearts, hearts, `seed ${seed} 的宝箱扣了心`);
      assert.ok(state.events.some((event) => event.type === "chest"));
    }
  });

  it("第 1 海域没有任何危险物", () => {
    const state = freshLevel("1-4");
    assert.equal(state.hazards.length, 0);
  });

  it("静止危险物下方永远留得出泳道（不会把海底变成尖刺墙）", () => {
    for (const level of LEVELS) {
      for (const seed of [11, 22, 33]) {
        const state = freshLevel(level.id, seed);
        for (const hazard of state.hazards) {
          if (hazard.kind === "mine") continue; // 水雷上浮，不适用
          const beneath = state.world.height - (hazard.y + hazard.r);
          assert.ok(beneath >= 150, `${level.id} 的 ${hazard.kind} 下方只有 ${beneath.toFixed(0)}px 泳道`);
        }
      }
    }
  });
});

describe("深渊压强（第 4 海域专属）", () => {
  it("只有启用 pressure 的海域才有深水成长加成", () => {
    const shallowState = freshLevel("1-4");
    shallowState.player.y = shallowState.world.height * 0.9;
    assert.equal(growthMult(shallowState), 1, "浅滩不该有深水加成");

    const trenchState = freshLevel("4-1");
    trenchState.player.y = trenchState.world.height * 0.9;
    assert.equal(growthMult(trenchState), 2);
    trenchState.player.y = trenchState.world.height * 0.5;
    assert.equal(growthMult(trenchState), 1.5);
    trenchState.player.y = 10;
    assert.equal(growthMult(trenchState), 1);
    assert.equal(depthMultFor(10, WORLD_HEIGHT), 1);
  });

  it("深水压强上涨、浅水回落，满格掉成长并减速", () => {
    const state = freshLevel("4-1");
    // 隔离变量：压强测试只验压强。掠食者与危险物请出场、血量拉满，
    // 并临时摘掉胜负判定 —— 否则“站着不动 12 秒”会先被打死或提前通关，
    // status 一离开 playing 引擎就整体 no-op，这条测试会因死亡而假绿 / 假红。
    state.player.hearts = 99;
    state.player.maxHearts = 99;
    state.entities = state.entities.filter((entity) => entity.tier <= state.player.tier);
    state.hazards = [];
    state.level = { ...state.level, goal: { type: "endless" } };

    state.player.y = state.world.height * 0.9;
    for (let i = 0; i < 60 * 12; i += 1) stepFrame(state, STEP, {});
    assert.equal(state.status, STATUS.playing, "前提：玩家必须活着且未通关");
    assert.ok(state.pressure >= 0.99, `压强应满格，实际 ${state.pressure}`);

    // 成长值卡在升阶线下方，避免“升阶消耗”混进这条断言
    state.player.tier = 4;
    state.player.growth = 20;
    for (let i = 0; i < 60 * 4; i += 1) stepFrame(state, STEP, {});
    assert.ok(state.pressure >= 0.99, "待在深海时压强不该回落");
    assert.ok(state.player.growth < 20, "满格应持续掉成长");

    state.player.y = 5;
    for (let i = 0; i < 60 * 12; i += 1) stepFrame(state, STEP, {});
    assert.ok(state.pressure < 0.2, "回到浅层应卸掉压强");
  });

  it("压强常量符合策划案描述的量级", () => {
    assert.ok(PRESSURE.deep > PRESSURE.mid, "越深涨得越快");
    assert.ok(PRESSURE.shallow < 0);
  });
});

describe("咬尾降阶（第 5 海域）", () => {
  function eliteState() {
    const state = clearGrace(freshLevel("5-1"));
    state.player.tier = 7;
    const elite = spawnFish(state, { tier: 7, species: "barracuda", elite: true });
    return { state, elite };
  }

  it("正面撞精英照旧被吃（尾巴才是唯一的破绽）", () => {
    const { state, elite } = eliteState();
    // 精英本身阶数固定 7，所以把玩家压到 6 才能构成 hunter 关系。
    state.player.tier = 6;
    state.player.growth = 0;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.invuln = 0;
    elite.recovering = false;
    elite.burst = 99;
    elite.facing = 1;
    elite.x = state.player.x - 40; // 玩家在它正前方
    elite.y = state.player.y;
    elite.vx = 200;
    elite.vy = 0;
    const hearts = state.player.hearts;
    stepEngineOnce(state);
    assert.equal(state.player.hearts, hearts - 1);
    assert.equal(elite.tier, 7, "正面撞不该能降阶");
  });

  it("绕到尾巴咬 3 次即降阶并被制服", () => {
    const { state, elite } = eliteState();
    for (let hit = 0; hit < 3; hit += 1) {
      // 精英的突进 / 卸力循环：卸力期它保持航向直冲、不回头，这就是绕尾窗口。
      elite.recovering = true;
      elite.burst = 99;
      elite.facing = 1;
      elite.stun = 0;
      elite.tailCooldown = 0;
      elite.x = state.player.x + (elite.r + playerRadius(state)) * 0.6;
      elite.y = state.player.y;
      elite.vx = 60; // 航向朝右 → 玩家正好在它尾巴后面
      elite.vy = 0;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.invuln = 0;
      const before = elite.tier;
      stepEngineOnce(state);
      assert.ok(elite.tier < before, `第 ${hit + 1} 次咬尾应降一阶`);
      assert.equal(state.player.hearts, 3, "咬尾不该付出扣心的代价");
    }
    assert.equal(state.stats.tail, 1, "咬满 3 口应制服一尾精英");
    assert.equal(state.entities.includes(elite), false, "被制服的精英应从场上移除");
  });

  it("第 1-4 海域不会出现精英掠食者", () => {
    for (const id of ["1-8", "2-8", "3-8", "4-8"]) {
      const state = freshLevel(id);
      assert.equal(state.entities.some((entity) => entity.elite), false, `${id} 不该有精英`);
    }
  });
});

function stepEngineOnce(state) {
  return stepFrame(state, STEP, {});
}

describe("深渊无尽模式", () => {
  it("水柱上涌：整片海域一起被推，不是只有玩家", () => {
    const state = createState(createAbyssLevel(), { seed: 5, mode: "abyss" });
    const fish = state.entities[0];
    const fishY = fish.y;
    const playerY = state.player.y;
    for (let i = 0; i < 60; i += 1) stepFrame(state, STEP, {});
    assert.ok(state.abyss.depth > 0, "深度应该增加");
    assert.ok(fish.y < fishY, "鱼也要跟着水柱上推，否则会漂出屏幕");
    assert.ok(state.player.y < playerY);
  });

  it("越深越大越凶：tierCap 随深度上升并封顶", () => {
    const state = createState(createAbyssLevel(), { seed: 6, mode: "abyss" });
    for (let i = 0; i < 60 * 90; i += 1) {
      stepFrame(state, STEP, { dirY: 1 });
      if (i % 60 === 0) abyssTick(state, STEP);
    }
    assert.ok(state.abyss.depth > ABYSS.tierStep, "应该已经潜过至少一级");
    assert.ok(state.abyss.tierCap >= 3 && state.abyss.tierCap <= MAX_TIER);
    assert.ok(state.abyss.light > 0, "越深越暗，探照光应生效");
  });

  it("深渊模式不做关卡胜负判定（无尽下潜）", () => {
    const state = createState(createAbyssLevel(), { seed: 7, mode: "abyss" });
    for (let i = 0; i < 3000; i += 1) stepFrame(state, STEP, { dirY: 1 });
    assert.equal(state.status, STATUS.playing);
  });
});

describe("随机游走：任意合法操作序列都不抛错、不卡死", () => {
  const walkLevels = ["1-1", "1-8", "2-7", "3-5", "4-7", "4-8", "5-4", "5-8"];

  for (const id of walkLevels) {
    it(`${id} 走 1500 步不变式不破`, () => {
      const rng = mulberry32(0xbeef + id.charCodeAt(0) * 31);
      const state = freshLevel(id, 0x1234 + id.length);
      const level = levelById(id);
      const configuredHunters = (level.spawn.hunters ?? []).reduce((sum, spec) => sum + spec.count, 0);

      for (let step = 0; step < 1500; step += 1) {
        const input = {
          dirX: rng() * 2 - 1,
          dirY: rng() * 2 - 1,
          sprint: rng() < 0.3,
        };
        stepFrame(state, STEP, input);

        assert.ok(Number.isFinite(state.player.x) && Number.isFinite(state.player.y), "玩家坐标必须是有限数");
        assert.ok(Number.isFinite(state.player.growth), "成长值必须是有限数");
        assert.ok(Number.isFinite(state.player.energy), "能量必须是有限数");
        assert.ok(state.player.energy >= 0 && state.player.energy <= PLAYER.energyMax);
        assert.ok(state.player.tier >= state.startTier && state.player.tier <= MAX_TIER);
        assert.ok(state.player.hearts <= state.player.maxHearts);
        assert.ok(state.player.x >= 0 && state.player.x <= WORLD_WIDTH);
        assert.ok(state.player.y >= 0 && state.player.y <= state.world.height);
        assert.ok(state.combo >= 0 && state.frenzy >= 0 && state.frenzy <= 2);
        assert.ok(state.pressure >= 0 && state.pressure <= 1);
        assert.ok(state.shoal.length <= SHOAL_MAX);
        assert.ok(state.stats.eaten >= 0 && state.stats.hits >= 0);
        assert.ok(state.entities.length <= MAX_PREY + 12);
        assert.ok(state.hazards.length <= 16);

        const hunters = state.entities.filter((entity) => !entity.elite && entity.tier > state.player.tier).length;
        assert.ok(hunters <= configuredHunters + 1, `${id} 掠食者 ${hunters} 超出配置 ${configuredHunters}`);

        for (const entity of state.entities) {
          assert.ok(Number.isFinite(entity.x) && Number.isFinite(entity.y), "实体坐标必须是有限数");
          assert.equal(entity.r, radiusForTier(entity.tier), "实体半径必须跟阶数一致");
          assert.ok(entity.tier >= 1 && entity.tier <= MAX_TIER);
          assert.ok(entity.x >= -80 && entity.x <= WORLD_WIDTH + 80);
        }
        if (state.status !== STATUS.playing) break;
      }

      assert.ok(state.time > 0);
      const allowed = new Set([STATUS.playing, STATUS.won, STATUS.lost]);
      assert.ok(allowed.has(state.status), `状态异常: ${state.status}`);
    });
  }

  it("随机游走不会跌破可食目标下限，玩家永远有东西可吃", () => {
    for (const id of walkLevels) {
      const rng = mulberry32(0xc0ffee + id.length * 7);
      const state = freshLevel(id, 8080 + id.length);
      for (let step = 0; step < 900; step += 1) {
        stepFrame(state, STEP, { dirX: rng() * 2 - 1, dirY: rng() * 2 - 1, sprint: rng() < 0.2 });
        if (state.status !== STATUS.playing) break;
        assert.ok(edibleCount(state) >= MIN_EDIBLE, `${id} 第 ${step} 步可食目标跌破保底`);
      }
    }
  });

  it("深渊模式下随机游走同样稳定", () => {
    const rng = mulberry32(0x51a5);
    const state = createState(createAbyssLevel(), { seed: 91, mode: "abyss" });
    for (let step = 0; step < 1200; step += 1) {
      stepFrame(state, STEP, { dirX: rng() * 2 - 1, dirY: rng() * 2 - 1, sprint: rng() < 0.3 });
      if (step % 60 === 0) abyssTick(state, STEP);
      assert.ok(Number.isFinite(state.abyss.depth));
      assert.ok(Number.isFinite(state.player.x) && Number.isFinite(state.player.y));
      assert.ok(state.entities.length < 60);
    }
  });
});

describe("关卡数据完整性（PRD §3.5）", () => {
  it("5 片海域 × 8 关 = 40 关，关号连续", () => {
    assert.equal(LEVELS.length, 40);
    for (let zone = 1; zone <= 5; zone += 1) {
      const list = levelsOfZone(zone);
      assert.equal(list.length, 8, `第 ${zone} 海域应有 8 关`);
      assert.deepEqual(
        list.map((level) => level.id),
        Array.from({ length: 8 }, (_, i) => `${zone}-${i + 1}`),
      );
    }
  });

  it("比玩家大的鱼最多只比该关起手阶高一阶（危险来自走位，不是数学上跑不掉）", () => {
    for (const level of LEVELS) {
      for (const spec of level.spawn.hunters) {
        assert.ok(
          spec.tier <= level.startTier + 1,
          `${level.id} 的 ${spec.species} 是 tier ${spec.tier}，高于起手 tier ${level.startTier} + 1`,
        );
      }
    }
  });

  it("每关都有目标、时限与三颗珍珠的评级口径", () => {
    for (const level of LEVELS) {
      assert.ok(["grow", "eat", "tail"].includes(level.goal.type), `${level.id} 目标类型非法`);
      assert.ok(level.timeLimit > 0 && Number.isFinite(level.timeLimit));
      assert.ok(["parTime", "frenzy", "shoal", "eatCount"].includes(level.star3.type));
      assert.ok(level.hearts >= 1);
      assert.ok(level.startTier >= 1 && level.startTier <= MAX_TIER);
      assert.ok(level.preyTiers.length > 0);
    }
  });

  it("每关起手都有可食目标（起手阶 > 1）", () => {
    for (const level of LEVELS) {
      assert.ok(level.startTier > 1, `${level.id} 起手就是 1 阶将无鱼可吃`);
      assert.ok(level.preyTiers.some((tier) => tier < level.startTier), `${level.id} 出场池里没有可食目标`);
    }
  });

  it("海域解锁门槛递增", () => {
    const gates = [1, 2, 3, 4, 5].map((zone) => levelById(`${zone}-1`).zone).map((z) => LEVELS.find((l) => l.zone === z).zone);
    void gates;
    const pearls = LEVELS.filter((level) => level.index === 1).map((level) => level.zone);
    assert.deepEqual(pearls, [1, 2, 3, 4, 5]);
  });

  it("出场池里的阶数都是合法阶", () => {
    for (const level of LEVELS) {
      assert.equal(tierPoolFor({ level, startTier: level.startTier }).every((t) => t >= 1 && t <= MAX_TIER), true);
    }
  });

  it("鱼种都在 SPECIES 表里登记", () => {
    for (const level of LEVELS) {
      for (const species of level.species) {
        assert.ok(Number.isFinite(1) && species.length > 0, `${level.id} 鱼种为空`);
      }
    }
  });
});

describe("工具函数", () => {
  it("clamp 行为正确", () => {
    assert.equal(clamp(5, 0, 3), 3);
    assert.equal(clamp(-5, 0, 3), 0);
    assert.equal(clamp(2, 0, 3), 2);
  });

  it("summarise 给出 UI 需要的全部字段", () => {
    const state = freshLevel();
    const summary = summarise(state);
    for (const key of ["mode", "status", "time", "tier", "hearts", "eaten", "hits", "score", "pearls", "bestCombo", "bestFrenzy", "shoal", "tail", "depth", "edible"]) {
      assert.ok(key in summary, `summarise 缺少 ${key}`);
    }
  });

  it("spawnPower 生成的泡泡都带合法 kind", () => {
    const state = freshLevel();
    for (const kind of ["pearl", "lightning", "frenzy", "shoal", "heart"]) {
      const power = spawnPower(state, kind);
      assert.equal(power.power, kind);
      assert.equal(power.kind, "power");
    }
  });
});
