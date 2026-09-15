import test from "node:test";
import assert from "node:assert/strict";
import {
  STAGE_WIDTH,
  STAGE_HEIGHT,
  segmentsIntersect,
  circleIntersectsRect,
  createLevelState,
  cutRopes,
  popBubble,
  puffBellows,
  stepFrame
} from "../js/engine.mjs";
import { LEVELS, getLevelById, getChapterByLevelId } from "../js/levels.mjs";

test("levels: all 40 levels defined with valid entities", () => {
  assert.equal(LEVELS.length, 40);
  for (const lvl of LEVELS) {
    assert.ok(lvl.id >= 1 && lvl.id <= 40);
    assert.ok(lvl.candy && typeof lvl.candy.x === "number");
    assert.ok(lvl.nommy && typeof lvl.nommy.x === "number");
    assert.ok(Array.isArray(lvl.ropes) && lvl.ropes.length >= 1);
    assert.ok(Array.isArray(lvl.stars) && lvl.stars.length === 3);
  }
});

test("geometry: segmentsIntersect & circleIntersectsRect", () => {
  const p1 = { x: 0, y: 10 };
  const p2 = { x: 20, y: 10 };
  const q1 = { x: 10, y: 0 };
  const q2 = { x: 10, y: 20 };
  assert.equal(segmentsIntersect(p1, p2, q1, q2), true);

  const qParallel = { x: 0, y: 20 };
  const qParallel2 = { x: 20, y: 20 };
  assert.equal(segmentsIntersect(p1, p2, qParallel, qParallel2), false);

  assert.equal(circleIntersectsRect(10, 10, 5, 10, 10, 20, 20), true);
  assert.equal(circleIntersectsRect(100, 100, 5, 10, 10, 20, 20), false);
});

test("engine: createLevelState initializes entities accurately", () => {
  const lvl1 = getLevelById(1);
  const state = createLevelState(lvl1);

  assert.equal(state.levelId, 1);
  assert.equal(state.status, "playing");
  assert.equal(state.starsCollected, 0);
  assert.equal(state.ropes.length, 1);
  assert.equal(state.stars.length, 3);
  assert.equal(state.candy.inBubble, false);
});

test("engine: cutRopes cleanly cuts intersected rope", () => {
  const lvl1 = getLevelById(1);
  const state = createLevelState(lvl1);

  // 划线穿过绳子 (320, 120) 到 (320, 320)
  const p1 = { x: 200, y: 200 };
  const p2 = { x: 400, y: 200 };
  const res = cutRopes(state, p1, p2);

  assert.equal(res.cutCount, 1);
  assert.equal(state.ropes[0].cut, true);
  assert.equal(state.cutsMade, 1);
});

test("engine: bubble capture and pop", () => {
  const lvl9 = getLevelById(9);
  const state = createLevelState(lvl9);
  const bubble = state.bubbles[0];

  assert.ok(bubble);
  assert.equal(state.candy.inBubble, false);

  // 先切断悬挂绳索，再模拟糖果进入气泡位置
  cutRopes(state, { x: 200, y: 140 }, { x: 400, y: 140 });
  state.candy.x = bubble.x;
  state.candy.y = bubble.y;
  stepFrame(state, 1 / 60);

  assert.equal(state.candy.inBubble, true);
  assert.equal(bubble.captured, true);

  // 戳破气泡
  const popRes = popBubble(state, bubble.id);
  assert.equal(popRes.popped, true);
  assert.equal(state.candy.inBubble, false);
});

test("engine: bellows puff imparts velocity", () => {
  const lvl17 = getLevelById(17);
  const state = createLevelState(lvl17);
  const bel = state.bellows[0];
  const oldVx = state.candy.vx;

  const res = puffBellows(state, bel.id);
  assert.equal(res.puffed, true);
  assert.ok(state.candy.vx > oldVx);
});

test("engine: level 1 drop completion", () => {
  const lvl1 = getLevelById(1);
  const state = createLevelState(lvl1);

  // 一刀切断绳索，糖果受重力竖直下落，穿过 3 颗星并喂食 Nommy
  cutRopes(state, { x: 200, y: 200 }, { x: 400, y: 200 });

  // 运行物理循环至通关
  for (let frame = 0; frame < 180; frame++) {
    stepFrame(state, 1 / 60);
    if (state.status === "cleared") break;
  }

  assert.equal(state.status, "cleared");
  assert.equal(state.starsCollected, 3);
});

test("engine: 1000-step random walk invariant validation", () => {
  // 随机游走验证：任意合法切割或物理推进下，数值不溢出、不出现 NaN，状态机保持稳健
  for (const lvlId of [1, 5, 9, 17, 25, 33]) {
    const lvl = getLevelById(lvlId);
    const state = createLevelState(lvl);

    let seed = 12345;
    function rnd() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }

    for (let step = 0; step < 200; step++) {
      if (rnd() < 0.05) {
        // 随机划线切割
        const x1 = rnd() * STAGE_WIDTH;
        const y1 = rnd() * STAGE_HEIGHT;
        const x2 = rnd() * STAGE_WIDTH;
        const y2 = rnd() * STAGE_HEIGHT;
        cutRopes(state, { x: x1, y: y1 }, { x: x2, y: y2 });
      }

      if (rnd() < 0.03 && state.bubbles.length > 0) {
        // 随机戳气泡
        const b = state.bubbles[Math.floor(rnd() * state.bubbles.length)];
        popBubble(state, b.id);
      }

      if (rnd() < 0.03 && state.bellows.length > 0) {
        // 随机吹气
        const bel = state.bellows[Math.floor(rnd() * state.bellows.length)];
        puffBellows(state, bel.id);
      }

      stepFrame(state, 1 / 60);

      // 不变量检查
      assert.ok(!Number.isNaN(state.candy.x), "candy.x must not be NaN");
      assert.ok(!Number.isNaN(state.candy.y), "candy.y must not be NaN");
      assert.ok(!Number.isNaN(state.candy.vx), "candy.vx must not be NaN");
      assert.ok(!Number.isNaN(state.candy.vy), "candy.vy must not be NaN");
      assert.ok(state.starsCollected >= 0 && state.starsCollected <= 3);
      assert.ok(["playing", "cleared", "failed"].includes(state.status));
    }
  }
});

test("engine: out-of-bounds failure and clean state recreation", () => {
  const lvl1 = getLevelById(1);
  let state = createLevelState(lvl1);
  cutRopes(state, { x: 200, y: 150 }, { x: 400, y: 150 });
  state.candy.y = STAGE_HEIGHT + 100;
  stepFrame(state, 1 / 60);
  assert.equal(state.status, "failed");
  assert.equal(state.failReason, "out_of_bounds");

  state = createLevelState(lvl1);
  assert.equal(state.status, "playing");
  assert.equal(state.failReason, null);
  assert.equal(state.candy.y, lvl1.candy.y);
});

test("engine: multi-rope cuts in a single continuous stroke when cutsAllowed = 1", () => {
  // 第33关：双绳并列，cutsAllowed = 1
  const lvl33 = getLevelById(33);
  const state = createLevelState(lvl33);
  assert.equal(state.cutsAllowed, 1);
  assert.equal(state.cutsRemaining, 1);
  assert.equal(state.ropes.length, 2);

  const strokeId = 42;

  // 模拟桌面端平滑划线手势：微段 1 穿过绳索 1 (x: 260, y: 160 -> 320, 320)
  const cut1 = cutRopes(state, { x: 240, y: 220 }, { x: 290, y: 220 }, strokeId);
  assert.equal(cut1.cutCount, 1);
  assert.equal(state.ropes[0].cut, true);
  assert.equal(state.ropes[1].cut, false);
  assert.equal(state.cutsRemaining, 0); // 首切已扣减额度

  // 同一手势继续向右滑动：微段 2 穿过绳索 2 (x: 380, y: 160 -> 320, 320)
  const cut2 = cutRopes(state, { x: 330, y: 220 }, { x: 400, y: 220 }, strokeId);
  assert.equal(cut2.cutCount, 1);
  assert.equal(state.ropes[0].cut, true);
  assert.equal(state.ropes[1].cut, true); // 第二根绳索成功切断！
  assert.equal(state.cutsRemaining, 0);

  // 尝试第二笔全新划线（不同 strokeId）
  const newStrokeId = 43;
  const cut3 = cutRopes(state, { x: 200, y: 300 }, { x: 450, y: 300 }, newStrokeId);
  assert.equal(cut3.cutCount, 0); // 额度已用尽，新划线被严格拦截
});

test("engine: single fast slash cuts multiple ropes simultaneously", () => {
  // 第35关：三线齐断，cutsAllowed = 1
  const lvl35 = getLevelById(35);
  const state = createLevelState(lvl35);
  assert.equal(state.cutsAllowed, 1);
  assert.equal(state.cutsRemaining, 1);
  assert.equal(state.ropes.length, 3);

  // 一道横切一次性穿过三根绳索
  const res = cutRopes(state, { x: 100, y: 220 }, { x: 500, y: 220 }, 99);
  assert.equal(res.cutCount, 3);
  assert.ok(state.ropes.every((r) => r.cut));
  assert.equal(state.cutsRemaining, 0);
});


