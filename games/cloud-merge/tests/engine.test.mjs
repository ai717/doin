import test from "node:test";
import assert from "node:assert/strict";

import {
  WORLD,
  WALL,
  SAFETY_Y,
  DROP_Y,
  FIXED_DT,
  MAX_LEVEL,
  RADII,
  STATUS,
  mulberry32,
  hashSeed,
  dailySeed,
  levelRadius,
  clampAimX,
  createInitialState,
  applyIntent,
  stepFrame,
} from "../js/engine.mjs?v=dev";

import {
  mergeScore,
  chainMultiplier,
  calculateMergePoints,
  rainClearScore,
  rainbowCollectScore,
} from "../js/score.mjs?v=dev";

test("score: merge triangular numbers and multipliers", () => {
  assert.equal(mergeScore(1), 1);
  assert.equal(mergeScore(2), 3);
  assert.equal(mergeScore(3), 6);
  assert.equal(mergeScore(8), 36);
  assert.equal(mergeScore(10), 55);

  assert.equal(chainMultiplier(1), 1);
  assert.equal(chainMultiplier(2), 1.5);
  assert.equal(chainMultiplier(3), 2.0);

  assert.equal(calculateMergePoints(2, 1), 3);
  assert.equal(calculateMergePoints(8, 2), 54); // round(36 * 1.5)
  assert.equal(rainClearScore(2), 30);
  assert.equal(rainbowCollectScore(), 100);
});

test("rng: deterministic PRNG and seed generation", () => {
  const rng1 = mulberry32(12345);
  const rng2 = mulberry32(12345);
  for (let i = 0; i < 20; i += 1) {
    assert.equal(rng1(), rng2());
  }

  assert.equal(dailySeed("2026-09-14"), dailySeed("2026-09-14"));
  assert.notEqual(dailySeed("2026-09-14"), dailySeed("2026-09-15"));
});

test("engine: clampAimX keeps aim within container walls", () => {
  const r = levelRadius(1);
  const minX = WALL + r + 4;
  const maxX = WORLD.width - WALL - r - 4;

  assert.equal(clampAimX(0, 1), minX);
  assert.equal(clampAimX(WORLD.width * 2, 1), maxX);
  assert.equal(clampAimX(200, 1), 200);
});

test("engine: initial state and drop intent", () => {
  const state = createInitialState({ mode: "endless", seed: 999 });
  assert.equal(state.status, STATUS.ready);
  assert.equal(state.score, 0);
  assert.equal(state.clouds.length, 0);

  const dropRes = applyIntent(state, { type: "drop" });
  assert.equal(dropRes.action, "drop");
  assert.equal(state.status, STATUS.playing);
  assert.equal(state.clouds.length, 1);
  assert.ok(state.cooldown > 0);

  // 冷却中再次投放应被静默忽略
  const deniedRes = applyIntent(state, { type: "drop" });
  assert.equal(deniedRes.action, null);
});

test("engine: two touching same-level clouds merge into higher tier", () => {
  const state = createInitialState({ seed: 42 });
  const r1 = levelRadius(1);

  // 放置两朵同级 L1 云朵相互接触
  state.clouds.push({
    id: 1,
    level: 1,
    x: 200,
    y: 500,
    vx: 10,
    vy: 0,
    radius: r1,
    age: 1,
    mass: r1 * r1 * 0.05,
  });

  state.clouds.push({
    id: 2,
    level: 1,
    x: 200 + r1 * 1.5,
    y: 500,
    vx: -10,
    vy: 0,
    radius: r1,
    age: 1,
    mass: r1 * r1 * 0.05,
  });

  const stepRes = stepFrame(state, FIXED_DT);
  const mergeEvent = stepRes.events.find((e) => e.type === "merge");

  assert.ok(mergeEvent, "应当触发合体事件");
  assert.equal(mergeEvent.level, 2);
  assert.equal(state.clouds.length, 1);
  assert.equal(state.clouds[0].level, 2);
  assert.equal(state.score, 3);
});

test("engine: L8 thunderstorm cloud clears crowded clouds below and awards rain score", () => {
  const state = createInitialState({ seed: 77 });
  const r7 = levelRadius(7);
  const r2 = levelRadius(2);

  // 在下方放置两朵低等级云朵
  state.clouds.push({
    id: 10,
    level: 2,
    x: 200,
    y: 520,
    vx: 0,
    vy: 0,
    radius: r2,
    age: 1,
    mass: r2 * r2 * 0.05,
  });
  state.clouds.push({
    id: 11,
    level: 2,
    x: 205,
    y: 580,
    vx: 0,
    vy: 0,
    radius: r2,
    age: 1,
    mass: r2 * r2 * 0.05,
  });

  // 放置两朵即将合体生成 L8 的 L7 云朵
  state.clouds.push({
    id: 1,
    level: 7,
    x: 195,
    y: 350,
    vx: 0,
    vy: 0,
    radius: r7,
    age: 1,
    mass: r7 * r7 * 0.05,
  });
  state.clouds.push({
    id: 2,
    level: 7,
    x: 205,
    y: 350,
    vx: 0,
    vy: 0,
    radius: r7,
    age: 1,
    mass: r7 * r7 * 0.05,
  });

  const stepRes = stepFrame(state, FIXED_DT);
  const rainEvent = stepRes.events.find((e) => e.type === "rain_clear");

  assert.ok(rainEvent, "合成 L8 雷暴云必须触发降雨清场事件");
  assert.ok(rainEvent.cleared.length > 0, "正下方云朵应被清除");
  assert.ok(rainEvent.points > 0, "应获得降雨清场奖励分");
  assert.ok(!state.clouds.some((c) => c.id === 10), "下方云朵 10 应已清除");
});

test("engine: L10 rainbow cloud can be collected to clear space and award 100 points", () => {
  const state = createInitialState({ seed: 88 });
  const r10 = levelRadius(10);

  state.clouds.push({
    id: 99,
    level: 10,
    x: 220,
    y: 400,
    vx: 0,
    vy: 0,
    radius: r10,
    age: 2,
    mass: r10 * r10 * 0.05,
  });

  assert.equal(state.clouds.length, 1);
  assert.equal(state.rainbowsCollected, 0);

  const collectRes = applyIntent(state, { type: "collect_rainbow", id: 99 });
  assert.equal(collectRes.action, "collect_rainbow");
  assert.equal(state.clouds.length, 0, "L10 彩虹云被收集后腾出空间");
  assert.equal(state.score, 100, "收集彩虹奖励 100 分");
  assert.equal(state.rainbowsCollected, 1);
});

test("engine: stacking above safety threshold ends the game after timer", () => {
  const state = createInitialState({ seed: 33 });
  state.status = STATUS.playing;
  const r = levelRadius(1);

  // 放置在安全线以上且稳定的云朵
  const pin = {
    id: 1,
    level: 1,
    x: 220,
    y: SAFETY_Y - 10,
    vx: 0,
    vy: 0,
    radius: r,
    age: 2,
    mass: r * r * 0.05,
  };
  state.clouds.push(pin);

  // 持续步进 2.2 秒（超过 DANGER_LIMIT 2.0 秒）
  const steps = Math.ceil(2.2 / FIXED_DT);
  let gameOverEmitted = false;
  for (let i = 0; i < steps; i += 1) {
    // 钉在安全线上方静止，模拟被下方云朵垫高堆叠
    pin.y = SAFETY_Y - 10;
    pin.vy = 0;
    const res = stepFrame(state, FIXED_DT);
    if (res.events.some((e) => e.type === "game_over")) {
      gameOverEmitted = true;
      break;
    }
  }

  assert.ok(gameOverEmitted, "持续超线应触发 game_over");
  assert.equal(state.status, STATUS.over);
});

test("engine: 1000-step random walk satisfies all invariants", () => {
  const state = createInitialState({ seed: 2026 });
  const rng = mulberry32(999);

  for (let step = 0; step < 1000; step += 1) {
    // 随机操作：瞄准、投放、收集彩虹
    const actionRoll = rng();
    if (actionRoll < 0.08) {
      applyIntent(state, { type: "drop", x: clampAimX(WALL + rng() * (WORLD.width - 2 * WALL), state.currentDrop) });
    } else if (actionRoll < 0.15) {
      applyIntent(state, { type: "set_aim", x: WALL + rng() * (WORLD.width - 2 * WALL) });
    } else if (actionRoll < 0.20) {
      applyIntent(state, { type: "collect_rainbow" });
    }

    const res = stepFrame(state, FIXED_DT);

    // 不变量检验
    assert.ok(Number.isFinite(state.score) && state.score >= 0, "得分必须非负有限");
    assert.ok(Number.isFinite(state.aimX), "瞄准 X 必须为有限数值");

    for (const c of state.clouds) {
      assert.ok(Number.isFinite(c.x) && Number.isFinite(c.y), "坐标必须非 NaN");
      assert.ok(Number.isFinite(c.vx) && Number.isFinite(c.vy), "速度必须非 NaN");
      assert.ok(c.level >= 1 && c.level <= MAX_LEVEL, "云朵等级必须在 [1, 10] 之间");
      assert.ok(c.x >= WALL && c.x <= WORLD.width - WALL, "云朵水平位置必须在容器边界内");
    }

    if (state.status === STATUS.over) {
      // 重新开始继续游走测试
      applyIntent(state, { type: "restart", mode: "endless", seed: (rng() * 100000) >>> 0 });
    }
  }
});
