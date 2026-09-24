import test from "node:test";
import assert from "node:assert/strict";

import {
  AIM_STEP,
  DROP_Y,
  FIXED_DT,
  LEVEL_VALUES,
  MAX_FRUITS,
  MAX_LEVEL,
  RADII,
  SAFETY_Y,
  START_POOL,
  STATUS,
  WALL,
  WORLD,
  applyIntent,
  clampAimX,
  createState,
  dailySeed,
  hashSeed,
  harvestTargetAt,
  isRunning,
  levelRadius,
  levelValue,
  mulberry32,
  nextDropLevel,
  poolMaxFor,
  stepFrame,
} from "../js/engine.mjs";

import { HARVEST_BONUS, harvestScore, mergeScore, valueOf } from "../js/score.mjs";

// 测试内手工塞水果（makeFruit 未导出，按引擎的 fruit 形状构造）。
let uid = 90000;
function fruit(level, x, y, extra = {}) {
  return {
    id: uid++,
    level,
    x,
    y,
    vx: 0,
    vy: 0,
    r: levelRadius(level),
    age: 0,
    squash: 0,
    ...extra,
  };
}

function started(seed = 1) {
  const rng = mulberry32(seed);
  let state = createState({}, { rng, mode: "endless", seed });
  state = applyIntent(state, { type: "start" }, { rng }).state;
  return { rng, state };
}

// —— 计分数学（合并得分 = 新值 × 连锁倍率 + 摘瓜奖励）——
test("score: valueOf maps level to the 2048 number chain", () => {
  assert.equal(valueOf(1), 2);
  assert.equal(valueOf(2), 4);
  assert.equal(valueOf(5), 32);
  assert.equal(valueOf(10), 1024);
  assert.equal(valueOf(11), 2048);
  assert.equal(valueOf(0), 2); // 非法级数回退最小值
  assert.equal(valueOf(-2), 2);
  assert.deepEqual(LEVEL_VALUES, [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048]);
});

test("score: merge pays the new value with a 1.5x-per-link chain multiplier", () => {
  assert.equal(mergeScore(2, 0), 4); // 2+2→4 得 4 分（2048 铁律）
  assert.equal(mergeScore(3, 0), 8); // 4+4→8 得 8 分
  assert.equal(mergeScore(4, 1), 24); // 16×1.5，连锁第 2 次
  assert.equal(mergeScore(5, 2), 64); // 32×2，连锁第 3 次
  assert.equal(mergeScore(11, 0), 2048); // 1024+1024→2048 得 2048 分
  assert.equal(mergeScore(11, 1), 3072); // 2048×1.5
});

test("score: harvest pays a fixed 2048 bonus", () => {
  assert.equal(HARVEST_BONUS, 2048);
  assert.equal(harvestScore(), 2048);
});

// —— PRNG / 种子确定性 ——
test("rng: mulberry32 is reproducible and in [0,1)", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 50; i += 1) {
    const x = a();
    const y = b();
    assert.equal(x, y);
    assert.ok(x >= 0 && x < 1);
  }
});

test("rng: hashSeed stable, dailySeed differs by date", () => {
  assert.equal(hashSeed("watermelon-2048:daily:2026-09-14"), hashSeed("watermelon-2048:daily:2026-09-14"));
  assert.notEqual(dailySeed("2026-09-14"), dailySeed("2026-09-15"));
});

// —— 初始状态 / 工具函数 ——
test("createState: fresh ready-state defaults", () => {
  const s = createState({}, { rng: mulberry32(7), mode: "daily", seed: 7 });
  assert.equal(s.status, STATUS.ready);
  assert.equal(s.score, 0);
  assert.equal(s.mode, "daily");
  assert.deepEqual(s.fruits, []);
  assert.equal(s.aimX, WORLD.width / 2);
  assert.equal(s.harvested, 0);
  assert.equal(s.first2048At, null);
  assert.ok(s.current >= 1 && s.current <= START_POOL);
  assert.ok(s.next >= 1 && s.next <= START_POOL);
});

test("clampAimX keeps the drop inside the walls", () => {
  const r = levelRadius(3);
  assert.equal(clampAimX(-999, 3), WALL + r);
  assert.equal(clampAimX(99999, 3), WORLD.width - WALL - r);
  assert.equal(clampAimX(Number.NaN, 3), (WALL + r + WORLD.width - WALL - r) / 2);
});

test("levelRadius / RADII / levelValue / poolMaxFor sanity", () => {
  assert.equal(RADII.length, MAX_LEVEL);
  assert.equal(LEVEL_VALUES.length, MAX_LEVEL);
  assert.equal(levelRadius(1), RADII[0]);
  assert.equal(levelRadius(MAX_LEVEL), RADII[MAX_LEVEL - 1]);
  assert.equal(levelRadius(99), RADII[MAX_LEVEL - 1]); // clamped
  assert.equal(levelValue(11), 2048);
  assert.equal(levelValue(0), 2);
  // 掉落池：前期只出 2/4，合出 16(L4) 后解锁 8(L3)
  assert.equal(poolMaxFor(0), 2);
  assert.equal(poolMaxFor(3), 2);
  assert.equal(poolMaxFor(4), 3);
  const lv = nextDropLevel(mulberry32(3), { maxLevel: 0 });
  assert.ok(lv >= 1 && lv <= 2);
  const lv2 = nextDropLevel(mulberry32(3), { maxLevel: 4 });
  assert.ok(lv2 >= 1 && lv2 <= 3);
});

// —— 生命周期意图 ——
test("start moves ready -> playing and emits start", () => {
  const rng = mulberry32(5);
  let s = createState({}, { rng, mode: "endless", seed: 5 });
  const res = applyIntent(s, { type: "start" }, { rng });
  assert.equal(res.action, "start");
  assert.equal(res.state.status, STATUS.playing);
  assert.ok(res.events.some((e) => e.type === "start"));
  assert.ok(isRunning(res.state));
  // start 幂等保护：第二次 start 是 no-op
  assert.equal(applyIntent(res.state, { type: "start" }, { rng }).action, null);
});

test("pause / resume / togglePause only act while playing", () => {
  const { rng, state } = started(11);
  assert.equal(applyIntent(state, { type: "pause" }, { rng }).action, "pause");
  assert.equal(state.paused, true);
  assert.equal(applyIntent(state, { type: "pause" }, { rng }).action, null); // already paused
  assert.equal(applyIntent(state, { type: "resume" }, { rng }).action, "resume");
  assert.equal(state.paused, false);
  assert.equal(applyIntent(state, { type: "resume" }, { rng }).action, null); // already running
  assert.equal(applyIntent(state, { type: "togglePause" }, { rng }).action, "togglePause");
  assert.equal(state.paused, true);
});

// —— 丢弃 / 冷却 / 阻挡 / 满盘 ——
test("drop spawns at DROP_Y, advances queue, sets cooldown", () => {
  const { rng, state } = started(21);
  const before = state.current;
  const res = applyIntent(state, { type: "drop", x: 200 }, { rng });
  assert.equal(res.action, "drop");
  assert.equal(state.fruits.length, 1);
  const f = state.fruits[0];
  assert.equal(f.level, before);
  assert.equal(f.y, DROP_Y);
  assert.ok(state.dropCooldown > 0);
  assert.ok(res.events.some((e) => e.type === "drop"));
  // 立即再丢会被冷却拒绝
  const denied = applyIntent(state, { type: "drop" }, { rng });
  assert.equal(denied.action, null);
  assert.ok(denied.events.some((e) => e.type === "deny" && e.reason === "cooldown"));
});

test("drop is denied when the spawn point is blocked", () => {
  const { rng, state } = started(31);
  state.fruits.push(fruit(state.current, state.aimX, DROP_Y));
  const res = applyIntent(state, { type: "drop" }, { rng });
  assert.equal(res.action, null);
  assert.ok(res.events.some((e) => e.type === "deny" && e.reason === "blocked"));
});

test("drop is denied when the orchard is full", () => {
  const { rng, state } = started(33);
  for (let i = 0; i < MAX_FRUITS; i += 1) {
    state.fruits.push(fruit(1, WALL + 20 + (i % 20) * 18, WORLD.height - WALL - 20));
  }
  const res = applyIntent(state, { type: "drop", x: WORLD.width / 2 }, { rng });
  assert.equal(res.action, null);
  assert.ok(res.events.some((e) => e.type === "deny" && e.reason === "full"));
});

test("aim is ignored unless running", () => {
  const rng = mulberry32(40);
  const s = createState({}, { rng, mode: "endless", seed: 40 });
  assert.equal(applyIntent(s, { type: "aim", x: 100 }, { rng }).action, null); // still ready
});

// —— 合成 ——
test("two touching same-level fruits merge into level+1 with score", () => {
  const { rng, state } = started(50);
  state.fruits.push(fruit(1, 200, 600));
  state.fruits.push(fruit(1, 225, 600)); // overlap (dist 25 < 2r 34)
  const res = stepFrame(state, { rng });
  assert.equal(state.fruits.length, 1);
  const merged = state.fruits[0];
  assert.equal(merged.level, 2);
  assert.equal(merged.r, levelRadius(2));
  assert.equal(state.score, mergeScore(2, 0));
  assert.equal(state.chain, 1);
  assert.equal(state.maxChain, 1);
  assert.equal(state.maxLevel, 2);
  assert.equal(state.first2048At, null);
  const ev = res.events.find((e) => e.type === "merge");
  assert.ok(ev);
  assert.equal(ev.level, 2);
  assert.equal(ev.value, 4);
  assert.equal(ev.chainIndex, 0);
});

test("merging the 2048 watermelon records first2048At and pays 2048", () => {
  const { rng, state } = started(52);
  state.fruits.push(fruit(10, 200, 500));
  state.fruits.push(fruit(10, 300, 500)); // overlap (dist 100 < 2r 174)
  const before = state.score;
  const res = stepFrame(state, { rng });
  assert.equal(state.fruits.length, 1);
  const merged = state.fruits[0];
  assert.equal(merged.level, MAX_LEVEL);
  assert.equal(state.maxLevel, MAX_LEVEL);
  assert.equal(state.score, before + mergeScore(11, 0));
  assert.ok(state.first2048At !== null && state.first2048At > 0, "first 2048 time must be recorded");
  const ev = res.events.find((e) => e.type === "merge");
  assert.equal(ev.value, 2048);
});

test("2048 fruits do not merge past the cap", () => {
  const { rng, state } = started(54);
  state.fruits.push(fruit(MAX_LEVEL, 200, 400));
  state.fruits.push(fruit(MAX_LEVEL, 240, 400));
  stepFrame(state, { rng });
  // 仍是两颗（无 L12）；求解器把它们推开，无合并事件
  assert.equal(state.fruits.length, 2);
  assert.ok(state.fruits.every((f) => f.level === MAX_LEVEL));
});

// —— 摘瓜 ——
test("harvest removes the 2048, pays the bonus, and only targets 2048", () => {
  const { rng, state } = started(60);
  const big = fruit(MAX_LEVEL, 220, 400);
  state.fruits.push(big);
  state.fruits.push(fruit(3, 100, 600));
  assert.equal(harvestTargetAt(state, 220, 400), true);
  assert.equal(harvestTargetAt(state, 100, 600), false); // 不是 2048
  const before = state.score;
  const res = applyIntent(state, { type: "harvest", x: 220, y: 400 }, { rng });
  assert.equal(res.action, "harvest");
  assert.equal(state.score, before + HARVEST_BONUS);
  assert.equal(state.harvested, 1);
  assert.equal(state.fruits.length, 1);
  assert.ok(res.events.some((e) => e.type === "harvest"));
  // 摘空位 / 摘普通水果会被拒绝
  const deny = applyIntent(state, { type: "harvest", x: 5, y: 5 }, { rng });
  assert.equal(deny.action, null);
  assert.ok(deny.events.some((e) => e.type === "deny" && e.reason === "noHarvest"));
  const deny2 = applyIntent(state, { type: "harvest", x: 100, y: 600 }, { rng });
  assert.equal(deny2.action, null);
});

// —— 超线失败 ——
test("stacking past the safety line ends the round", () => {
  const { rng, state } = started(70);
  const pin = fruit(2, WORLD.width / 2, SAFETY_Y - 30, { age: 5 });
  state.fruits.push(pin);
  let sawDangerStart = false;
  let over = null;
  for (let i = 0; i < 600 && state.status === STATUS.playing; i += 1) {
    // 把它钉在危险区，模拟堆过安全线且不掉落
    pin.y = SAFETY_Y - 30;
    pin.vy = 0;
    pin.age = 5;
    const res = stepFrame(state, { rng });
    if (res.events.some((e) => e.type === "dangerStart")) sawDangerStart = true;
    const end = res.events.find((e) => e.type === "roundEnd");
    if (end) over = end;
  }
  assert.equal(sawDangerStart, true);
  assert.equal(state.status, STATUS.over);
  assert.ok(over);
  assert.equal(over.mode, "endless");
  assert.equal(over.harvested, state.harvested);
  assert.equal(over.time, state.first2048At === null ? 0 : state.first2048At);
});

test("after game over, gameplay intents are silent no-ops", () => {
  const { rng, state } = started(72);
  state.status = STATUS.over;
  for (const intent of [
    { type: "drop" },
    { type: "aim", x: 10 },
    { type: "harvest", x: 10, y: 10 },
    { type: "pause" },
  ]) {
    const res = applyIntent(state, intent, { rng });
    assert.equal(res.action, null);
  }
  assert.equal(stepFrame(state, { rng }).action, null);
});

// —— 大步数随机游走（≥1000 步）：合法操作序列下永不抛错、不变式不破 ——
test("random walk: 1500 mixed operations keep every invariant", () => {
  const rng = mulberry32(20260914);
  let state = createState({}, { rng, mode: "endless", seed: 20260914 });
  state = applyIntent(state, { type: "start" }, { rng }).state;
  let lastScore = 0;
  let stepsRun = 0;

  for (let i = 0; i < 1500; i += 1) {
    const roll = rng();
    if (roll < 0.2) {
      applyIntent(state, { type: "aim", x: rng() * WORLD.width }, { rng });
    } else if (roll < 0.5) {
      applyIntent(state, { type: "drop" }, { rng });
    } else if (roll < 0.56) {
      applyIntent(state, { type: "harvest", x: rng() * WORLD.width, y: rng() * WORLD.height }, { rng });
    } else if (roll < 0.6) {
      applyIntent(state, { type: "togglePause" }, { rng });
    }

    const sub = 1 + Math.floor(rng() * 3);
    for (let s = 0; s < sub; s += 1) {
      stepFrame(state, { rng });
      stepsRun += 1;
    }

    // —— 不变式 ——
    assert.ok([STATUS.ready, STATUS.playing, STATUS.over].includes(state.status));
    assert.ok(state.fruits.length <= MAX_FRUITS, `fruit cap exceeded: ${state.fruits.length}`);
    assert.ok(Number.isFinite(state.score) && state.score >= 0);
    assert.ok(state.score >= lastScore, "score must never decrease");
    lastScore = state.score;
    assert.ok(state.maxLevel >= 0 && state.maxLevel <= MAX_LEVEL);
    assert.ok(Number.isFinite(state.maxChain) && state.maxChain >= 0);
    assert.ok(state.harvested >= 0 && Number.isInteger(state.harvested));

    for (const f of state.fruits) {
      assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y), "NaN position");
      assert.ok(Number.isFinite(f.vx) && Number.isFinite(f.vy), "NaN velocity");
      assert.ok(Number.isInteger(f.level) && f.level >= 1 && f.level <= MAX_LEVEL);
      assert.equal(f.r, levelRadius(f.level));
      assert.ok(f.x >= WALL + f.r - 1.5 && f.x <= WORLD.width - WALL - f.r + 1.5, "x escaped walls");
      assert.ok(f.y <= WORLD.height - WALL - f.r + 1.5, "y sank through floor");
      assert.ok(f.y >= -f.r * 3 - 2, "y flew past ceiling cap");
    }

    // 终局后重开，继续走（重开会清零分数）
    if (state.status === STATUS.over) {
      state = applyIntent(state, { type: "restart" }, { rng }).state;
      lastScore = state.score;
    }
  }

  assert.ok(stepsRun >= 1000, `expected >=1000 physics steps, ran ${stepsRun}`);
});

// —— 每日种子端到端可复现 ——
test("daily seed reproduces an identical run; different date diverges", () => {
  const script = [
    ["i", { type: "start" }],
    ["i", { type: "aim", x: 130 }],
    ["i", { type: "drop" }],
    ["s", 50],
    ["i", { type: "aim", x: 132 }],
    ["i", { type: "drop" }],
    ["s", 90],
    ["i", { type: "aim", x: 300 }],
    ["i", { type: "drop" }],
    ["s", 120],
  ];

  function play(seed, mode) {
    const rng = mulberry32(seed);
    let s = createState({}, { rng, mode, seed });
    for (const op of script) {
      if (op[0] === "i") s = applyIntent(s, op[1], { rng }).state;
      else for (let k = 0; k < op[1]; k += 1) s = stepFrame(s, { rng }).state;
    }
    return s;
  }

  const proj = (s) =>
    JSON.stringify({
      score: s.score,
      maxLevel: s.maxLevel,
      maxChain: s.maxChain,
      current: s.current,
      next: s.next,
      n: s.fruits.length,
      levels: s.fruits.map((f) => f.level),
      xs: s.fruits.map((f) => Number(f.x.toFixed(4))),
      ys: s.fruits.map((f) => Number(f.y.toFixed(4))),
    });

  const daySeed = dailySeed("2026-09-14");
  const a = play(daySeed, "daily");
  const b = play(daySeed, "daily");
  assert.equal(proj(a), proj(b)); // 同一天同一种子 → 完全一致
  assert.notEqual(dailySeed("2026-09-14"), dailySeed("2026-10-01")); // 不同天 → 不同题
});

test("FIXED_DT / AIM_STEP are sane positive constants", () => {
  assert.ok(FIXED_DT > 0 && FIXED_DT < 0.05);
  assert.ok(AIM_STEP > 0);
});
