import test from "node:test";
import assert from "node:assert/strict";

import {
  AIM_STEP,
  DROP_Y,
  FIXED_DT,
  MAX_BUBBLES,
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
  isRunning,
  levelRadius,
  mulberry32,
  nextDropLevel,
  popTargetAt,
  poolMaxFor,
  stepFrame,
} from "../js/engine.mjs";

import { POP_BONUS, mergeScore, popScore, triangular } from "../js/score.mjs";

// 测试内手工塞泡泡（makeBubble 未导出，按引擎的 bubble 形状构造）。
let uid = 90000;
function bubble(level, x, y, extra = {}) {
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

// —— 计分数学（三角数 + 连锁 ×1.5 + 戳破奖励）——
test("score: triangular numbers match Suika-style table", () => {
  assert.equal(triangular(1), 1);
  assert.equal(triangular(2), 3);
  assert.equal(triangular(5), 15);
  assert.equal(triangular(10), 55);
  assert.equal(triangular(0), 0);
  assert.equal(triangular(-3), 0);
});

test("score: chain multiplier rounds correctly", () => {
  assert.equal(mergeScore(2, 0), 3);
  assert.equal(mergeScore(3, 0), 6);
  assert.equal(mergeScore(4, 1), 15); // round(10 * 1.5)
  assert.equal(mergeScore(5, 2), 34); // round(15 * 2.25)
  assert.equal(popScore(), POP_BONUS);
  assert.equal(POP_BONUS, 100);
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
  assert.equal(hashSeed("bubble-merge:daily:2026-09-14"), hashSeed("bubble-merge:daily:2026-09-14"));
  assert.notEqual(dailySeed("2026-09-14"), dailySeed("2026-09-15"));
});

// —— 初始状态 / 工具函数 ——
test("createState: fresh ready-state defaults", () => {
  const s = createState({}, { rng: mulberry32(7), mode: "daily", seed: 7 });
  assert.equal(s.status, STATUS.ready);
  assert.equal(s.score, 0);
  assert.equal(s.mode, "daily");
  assert.deepEqual(s.bubbles, []);
  assert.equal(s.aimX, WORLD.width / 2);
  assert.ok(s.current >= 1 && s.current <= START_POOL);
  assert.ok(s.next >= 1 && s.next <= START_POOL);
});

test("clampAimX keeps the drop inside the walls", () => {
  const r = levelRadius(3);
  assert.equal(clampAimX(-999, 3), WALL + r);
  assert.equal(clampAimX(99999, 3), WORLD.width - WALL - r);
  assert.equal(clampAimX(Number.NaN, 3), (WALL + r + WORLD.width - WALL - r) / 2);
});

test("levelRadius / RADII / poolMaxFor sanity", () => {
  assert.equal(RADII.length, MAX_LEVEL);
  assert.equal(levelRadius(1), RADII[0]);
  assert.equal(levelRadius(MAX_LEVEL), RADII[MAX_LEVEL - 1]);
  assert.equal(levelRadius(99), RADII[MAX_LEVEL - 1]); // clamped
  assert.equal(poolMaxFor(0), 4);
  assert.equal(poolMaxFor(6), 4);
  assert.equal(poolMaxFor(7), 5); // L7 unlocks the 5th drop level
  const lv = nextDropLevel(mulberry32(3), { maxLevel: 0 });
  assert.ok(lv >= 1 && lv <= 4);
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
  // start is idempotent-guarded: a second start is a no-op
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
  assert.equal(state.bubbles.length, 1);
  const b = state.bubbles[0];
  assert.equal(b.level, before);
  assert.equal(b.y, DROP_Y);
  assert.ok(state.dropCooldown > 0);
  assert.ok(res.events.some((e) => e.type === "drop"));
  // immediate second drop is denied by cooldown
  const denied = applyIntent(state, { type: "drop" }, { rng });
  assert.equal(denied.action, null);
  assert.ok(denied.events.some((e) => e.type === "deny" && e.reason === "cooldown"));
});

test("drop is denied when the spawn point is blocked", () => {
  const { rng, state } = started(31);
  state.bubbles.push(bubble(state.current, state.aimX, DROP_Y));
  const res = applyIntent(state, { type: "drop" }, { rng });
  assert.equal(res.action, null);
  assert.ok(res.events.some((e) => e.type === "deny" && e.reason === "blocked"));
});

test("drop is denied when the tank is full", () => {
  const { rng, state } = started(33);
  for (let i = 0; i < MAX_BUBBLES; i += 1) {
    state.bubbles.push(bubble(1, WALL + 20 + (i % 20) * 18, WORLD.height - WALL - 20));
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
test("two touching same-level bubbles merge into level+1 with score", () => {
  const { rng, state } = started(50);
  state.bubbles.push(bubble(1, 200, 600));
  state.bubbles.push(bubble(1, 225, 600)); // overlap (dist 25 < 2r 34)
  const res = stepFrame(state, { rng });
  assert.equal(state.bubbles.length, 1);
  const merged = state.bubbles[0];
  assert.equal(merged.level, 2);
  assert.equal(merged.r, levelRadius(2));
  assert.equal(state.score, mergeScore(2, 0));
  assert.equal(state.chain, 1);
  assert.equal(state.maxChain, 1);
  assert.equal(state.maxLevel, 2);
  const ev = res.events.find((e) => e.type === "merge");
  assert.ok(ev);
  assert.equal(ev.level, 2);
  assert.equal(ev.chainIndex, 0);
});

test("L10 bubbles do not merge past the cap", () => {
  const { rng, state } = started(52);
  state.bubbles.push(bubble(MAX_LEVEL, 200, 500));
  state.bubbles.push(bubble(MAX_LEVEL, 240, 500));
  stepFrame(state, { rng });
  // still two bubbles (no L11); solver pushed them apart, no merge event
  assert.equal(state.bubbles.length, 2);
  assert.ok(state.bubbles.every((b) => b.level === MAX_LEVEL));
});

// —— 戳破 ——
test("pop removes an L10, pays the bonus, and only targets L10", () => {
  const { rng, state } = started(60);
  const big = bubble(MAX_LEVEL, 220, 400);
  state.bubbles.push(big);
  state.bubbles.push(bubble(3, 100, 600));
  assert.equal(popTargetAt(state, 220, 400), true);
  assert.equal(popTargetAt(state, 100, 600), false); // not an L10
  const before = state.score;
  const res = applyIntent(state, { type: "pop", x: 220, y: 400 }, { rng });
  assert.equal(res.action, "pop");
  assert.equal(state.score, before + POP_BONUS);
  assert.equal(state.pops, 1);
  assert.equal(state.bubbles.length, 1);
  assert.ok(res.events.some((e) => e.type === "pop"));
  // popping empty space denies
  const deny = applyIntent(state, { type: "pop", x: 5, y: 5 }, { rng });
  assert.equal(deny.action, null);
  assert.ok(deny.events.some((e) => e.type === "deny" && e.reason === "noPop"));
});

// —— 超线失败 ——
test("stacking past the safety line ends the round", () => {
  const { rng, state } = started(70);
  const pin = bubble(2, WORLD.width / 2, SAFETY_Y - 30, { age: 5 });
  state.bubbles.push(pin);
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
});

test("after game over, gameplay intents are silent no-ops", () => {
  const { rng, state } = started(72);
  state.status = STATUS.over;
  for (const intent of [
    { type: "drop" },
    { type: "aim", x: 10 },
    { type: "pop", x: 10, y: 10 },
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
    if (roll < 0.22) {
      applyIntent(state, { type: "aim", x: rng() * WORLD.width }, { rng });
    } else if (roll < 0.52) {
      applyIntent(state, { type: "drop" }, { rng });
    } else if (roll < 0.58) {
      applyIntent(state, { type: "pop", x: rng() * WORLD.width, y: rng() * WORLD.height }, { rng });
    } else if (roll < 0.62) {
      applyIntent(state, { type: "togglePause" }, { rng });
    }

    const sub = 1 + Math.floor(rng() * 3);
    for (let s = 0; s < sub; s += 1) {
      stepFrame(state, { rng });
      stepsRun += 1;
    }

    // —— 不变式 ——
    assert.ok([STATUS.ready, STATUS.playing, STATUS.over].includes(state.status));
    assert.ok(state.bubbles.length <= MAX_BUBBLES, `bubble cap exceeded: ${state.bubbles.length}`);
    assert.ok(Number.isFinite(state.score) && state.score >= 0);
    assert.ok(state.score >= lastScore, "score must never decrease");
    lastScore = state.score;
    assert.ok(state.maxLevel >= 0 && state.maxLevel <= MAX_LEVEL);
    assert.ok(Number.isFinite(state.maxChain) && state.maxChain >= 0);

    for (const b of state.bubbles) {
      assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), "NaN position");
      assert.ok(Number.isFinite(b.vx) && Number.isFinite(b.vy), "NaN velocity");
      assert.ok(Number.isInteger(b.level) && b.level >= 1 && b.level <= MAX_LEVEL);
      assert.equal(b.r, levelRadius(b.level));
      assert.ok(b.x >= WALL + b.r - 1.5 && b.x <= WORLD.width - WALL - b.r + 1.5, "x escaped walls");
      assert.ok(b.y <= WORLD.height - WALL - b.r + 1.5, "y sank through floor");
      assert.ok(b.y >= -b.r * 3 - 2, "y flew past ceiling cap");
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
      n: s.bubbles.length,
      levels: s.bubbles.map((b) => b.level),
      xs: s.bubbles.map((b) => Number(b.x.toFixed(4))),
      ys: s.bubbles.map((b) => Number(b.y.toFixed(4))),
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
