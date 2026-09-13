import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTACT_EPS,
  MERGE_DELAY,
  PHASE,
  PULSE_MAX,
  SPAWN_BAG,
  TIER_COUNT,
  TIER_RADIUS,
  WARN_GRACE,
  WARN_Y,
  WORLD,
  aimTo,
  begin,
  createState,
  drainEvents,
  dropBubble,
  hashSeed,
  isOver,
  isPlaying,
  nudgeAim,
  overLineCount,
  pause,
  resume,
  stackSpeed,
  step,
  tierRadius,
  usePulse
} from "../js/engine.mjs";

function makeState(options) {
  const state = createState(Object.assign({ mode: "standard", seed: 4242 }, options || {}));
  begin(state);
  drainEvents(state);
  return state;
}

function put(state, tier, x, y, extra) {
  const bubble = {
    id: 9000 + state.bubbles.length,
    tier,
    x,
    y,
    vx: 0,
    vy: 0,
    r: tierRadius(tier),
    landed: true,
    merging: false,
    born: 0
  };
  Object.assign(bubble, extra || {});
  state.bubbles.push(bubble);
  return bubble;
}

function advance(state, seconds, hook) {
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i += 1) {
    if (hook) hook(i);
    step(state, 1 / 60);
  }
}

test("createState 初始化：待开始状态、双预览、落点居中", () => {
  const state = createState({ mode: "standard", seed: 1 });
  assert.equal(state.phase, PHASE.ready);
  assert.equal(state.mode, "standard");
  assert.equal(state.current, 1);
  assert.equal(state.next, 1);
  assert.equal(state.pulses, PULSE_MAX);
  assert.equal(state.bubbles.length, 0);
  assert.ok(state.aimX > 0 && state.aimX < WORLD.width);
  assert.equal(state.result, null);
});

test("候选袋：每个窗口内 1~4 阶各出现两次，不存在孤儿等级", () => {
  const state = createState({ mode: "standard", seed: 7 });
  // queue = [前导剩余, bag...]，前导序列 [1,1,2] 已经消耗掉两颗
  const bag = state.queue.slice(1, 9).sort((a, b) => a - b);
  assert.deepEqual(bag, [1, 1, 2, 2, 3, 3, 4, 4]);
  assert.deepEqual(SPAWN_BAG.slice().sort((a, b) => a - b), [1, 1, 2, 2, 3, 3, 4, 4]);
  for (let i = 0; i < state.queue.length; i += 1) {
    assert.ok(state.queue[i] >= 1 && state.queue[i] <= 4);
  }
});

test("同一种子产生完全一致的投放序列（可复盘）", () => {
  const a = createState({ mode: "daily", seed: hashSeed("bubble-bloom-2026-09-13") });
  const b = createState({ mode: "daily", seed: hashSeed("bubble-bloom-2026-09-13") });
  const seqA = [];
  const seqB = [];
  for (let i = 0; i < 40; i += 1) {
    seqA.push(a.queue[i]);
    seqB.push(b.queue[i]);
  }
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(
    createState({ seed: 1 }).queue,
    createState({ seed: 2 }).queue
  );
});

test("流程状态：begin / pause / resume 与非法流转 no-op", () => {
  const state = createState({ mode: "standard", seed: 3 });
  assert.equal(begin(state), true);
  assert.equal(state.phase, PHASE.playing);
  assert.equal(begin(state), false);

  assert.equal(pause(state), true);
  assert.equal(state.phase, PHASE.paused);
  assert.equal(pause(state), false);
  assert.equal(resume(state), true);
  assert.equal(state.phase, PHASE.playing);
  assert.equal(resume(state), false);
});

test("投放：合法投放必须生效，落点被夹在舱内", () => {
  const state = makeState();
  assert.equal(aimTo(state, -500), true);
  assert.equal(state.aimX, tierRadius(state.current));
  assert.equal(aimTo(state, 9999), true);
  assert.equal(state.aimX, WORLD.width - tierRadius(state.current));

  assert.equal(nudgeAim(state, -10), true);
  assert.ok(state.aimX < WORLD.width - tierRadius(state.current));

  assert.equal(dropBubble(state), true);
  assert.equal(state.bubbles.length, 1);
  assert.equal(state.drops, 1);
  assert.equal(state.bubbles[0].tier, 1);
});

test("同阶相碰即合成：一次只结算一次，产出高一级泡", () => {
  const state = makeState();
  put(state, 1, 200, 600);
  put(state, 1, 200 + tierRadius(1) * 2 + 1, 600);
  advance(state, MERGE_DELAY + 0.2);

  const merges = state.events.filter((ev) => ev.type === "merge");
  drainEvents(state);
  assert.equal(state.bubbles.length, 1);
  assert.equal(state.bubbles[0].tier, 2);
  assert.equal(state.score, 6);
  assert.equal(state.maxTier, 2);
  void merges;
});

test("压力连锁：同一次投放的连续合成按倍率递增", () => {
  const state = makeState();
  put(state, 1, 240, 600);
  put(state, 1, 240, 600 + tierRadius(1) * 2);
  put(state, 2, 240, 500);
  advance(state, 1.6);

  const merges = drainEvents(state).filter((ev) => ev.type === "merge");
  assert.equal(merges.length, 2);
  assert.equal(merges[0].chain, 1);
  assert.equal(merges[1].chain, 2);
  assert.equal(merges[0].score, 6);
  assert.equal(merges[1].score, 15);
  assert.equal(state.score, 21);
  assert.equal(state.maxChain, 2);
});

test("彩虹绽放：双王相撞不再升阶，固定奖励并清空低阶泡", () => {
  const state = makeState();
  put(state, 10, 120, 400);
  put(state, 10, 120 + tierRadius(10) * 2 + 1, 400);
  put(state, 1, 240, 700);
  put(state, 9, 400, 700);
  advance(state, MERGE_DELAY + 0.2);

  const bloom = drainEvents(state).filter((ev) => ev.type === "bloom");
  assert.equal(bloom.length, 1);
  assert.equal(bloom[0].score, 1000);
  assert.equal(bloom[0].cleared, 1);
  assert.equal(state.bloomed, true);
  assert.equal(state.score, 1000);
  const tiers = state.bubbles.map((b) => b.tier);
  assert.equal(tiers.includes(1), false);
  assert.equal(tiers.includes(10), false);
  assert.equal(tiers.includes(9), true);
});

test("失败判定：泡堆持续越过警戒线超过缓冲时长才结算", () => {
  const state = makeState();
  put(state, 10, 240, 720 - tierRadius(10));
  put(state, 9, 240, 720 - tierRadius(10) * 2 - tierRadius(9));
  put(state, 8, 240, 720 - tierRadius(10) * 2 - tierRadius(9) * 2 - tierRadius(8));
  put(state, 7, 240, 720 - tierRadius(10) * 2 - tierRadius(9) * 2 - tierRadius(8) * 2 - tierRadius(7));
  assert.ok(overLineCount(state) >= 1);

  advance(state, WARN_GRACE * 0.5);
  assert.equal(state.phase, PHASE.playing);

  advance(state, WARN_GRACE);
  assert.equal(state.phase, PHASE.over);
  assert.ok(state.result);
  assert.equal(state.result.mode, "standard");
  assert.equal(isOver(state), true);
});

test("终止状态 no-op：结算后投放、瞄准、脉冲一律无效且不抛错", () => {
  const state = makeState();
  put(state, 10, 240, 720 - tierRadius(10));
  put(state, 9, 240, 720 - tierRadius(10) * 2 - tierRadius(9));
  put(state, 8, 240, 720 - tierRadius(10) * 2 - tierRadius(9) * 2 - tierRadius(8));
  put(state, 7, 240, 720 - tierRadius(10) * 2 - tierRadius(9) * 2 - tierRadius(8) * 2 - tierRadius(7));
  advance(state, WARN_GRACE + 0.5);
  assert.equal(state.phase, PHASE.over);

  const before = state.bubbles.length;
  assert.equal(dropBubble(state), false);
  assert.equal(aimTo(state, 100), false);
  assert.equal(nudgeAim(state, 10), false);
  assert.equal(usePulse(state), false);
  assert.equal(state.bubbles.length, before);
  assert.equal(isPlaying(state), false);
});

test("潮汐脉冲：次数与冷却受限，只做横向扰动", () => {
  const state = makeState();
  put(state, 3, 240, 700);
  assert.equal(usePulse(state), true);
  assert.equal(state.pulses, PULSE_MAX - 1);
  assert.ok(state.pulseCooldown > 0);
  assert.equal(usePulse(state), false);

  advance(state, 7);
  assert.equal(state.pulseCooldown, 0);
  assert.equal(usePulse(state), true);
  assert.equal(state.pulses, 0);
  assert.equal(usePulse(state), false);
});

test("暂停时物理不推进", () => {
  const state = makeState();
  put(state, 2, 240, 300);
  pause(state);
  const y = state.bubbles[0].y;
  advance(state, 1);
  assert.equal(state.bubbles[0].y, y);
});

test("大 dt 被钳制，且不会产生数值异常", () => {
  const state = makeState();
  dropBubble(state);
  step(state, 100);
  step(state, -5);
  step(state, Number.NaN);
  for (const b of state.bubbles) {
    assert.ok(Number.isFinite(b.x));
    assert.ok(Number.isFinite(b.y));
    assert.ok(Number.isFinite(b.vx));
    assert.ok(Number.isFinite(b.vy));
  }
});

test("2000 步随机游走：不抛错、不变式不破、泡始终留在舱内", () => {
  const state = makeState({ seed: 20260913 });
  let drops = 0;
  for (let i = 0; i < 2000; i += 1) {
    const roll = (i * 2654435761) % 1000;
    if (state.phase === PHASE.playing && roll < 40) {
      aimTo(state, (roll / 1000) * WORLD.width);
      dropBubble(state);
      drops += 1;
    } else if (roll < 44) {
      usePulse(state);
    } else if (roll === 500) {
      pause(state);
    } else if (roll === 501) {
      resume(state);
    }
    step(state, 1 / 60);
    drainEvents(state);

    for (let k = 0; k < state.bubbles.length; k += 1) {
      const b = state.bubbles[k];
      assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), "坐标必须是有限数");
      assert.ok(b.x >= b.r - 1 && b.x <= WORLD.width - b.r + 1, `横向越界: ${b.x}`);
      assert.ok(b.y >= b.r - 1 && b.y <= WORLD.height - b.r + 1, `纵向越界: ${b.y}`);
      assert.ok(b.tier >= 1 && b.tier <= TIER_COUNT, `阶级越界: ${b.tier}`);
    }
  }
  assert.ok(drops > 20);
  assert.ok(state.score >= 0);
  assert.ok(Number.isFinite(stackSpeed(state)));
});

test("常量自洽：半径递增、警戒线在投放轨道下方", () => {
  for (let i = 1; i < TIER_RADIUS.length; i += 1) {
    assert.ok(TIER_RADIUS[i] > TIER_RADIUS[i - 1]);
  }
  assert.equal(TIER_RADIUS.length, TIER_COUNT);
  assert.ok(WARN_Y > 0 && WARN_Y < WORLD.height);
  assert.ok(CONTACT_EPS > 0);
  assert.ok(MERGE_DELAY > 0);
});
