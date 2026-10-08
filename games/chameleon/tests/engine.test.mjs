// engine.test.mjs —— 规则层单测：数值钳制、网格邻域、棋盘生成不变量、固定步长确定性、行动守卫与热力守恒

import test from "node:test";
import assert from "node:assert/strict";

import {
  GRID,
  CELL_COUNT,
  COLOR_COUNT,
  MAX_BLEND,
  BLEND_MIN,
  NOISE_AMPLITUDE,
  TELL_MIN,
  TURN,
  OUTCOME,
  clamp,
  clampBlend,
  colorDistance,
  worldColor,
  rowOf,
  colOf,
  neighborsOf,
  neighborhoodOf,
  dominantColor,
  heatNoise,
  createBoard,
  createState,
  stepFrame,
  heatFor,
  tellStrength,
  chameleonMove,
  chameleonRecolor,
  chameleonFineTune,
  hunterScan,
  hunterAccuse,
  hunterPass,
  invariants,
} from "../js/engine.mjs";

function colorCounts(residents) {
  const counts = new Array(COLOR_COUNT).fill(0);
  for (const c of residents) counts[c] += 1;
  return counts;
}

test("clamp 与 clampBlend 恒在合法区间，NaN 回下限", () => {
  assert.equal(clamp(50, 0, 100), 50);
  assert.equal(clamp(-5, 0, 100), 0);
  assert.equal(clamp(999, 0, 100), 100);
  assert.equal(clamp(NaN, 0, 100), 0);
  assert.equal(clampBlend(-20), BLEND_MIN);
  assert.equal(clampBlend(200), MAX_BLEND);
  assert.ok(clampBlend(53.6) === 54 || clampBlend(53.6) === 53);
});

test("颜色环距离：5 色环上 0↔4 距离为 1，0↔2 距离为 2", () => {
  assert.equal(colorDistance(0, 1), 1);
  assert.equal(colorDistance(0, 4), 1);
  assert.equal(colorDistance(0, 2), 2);
  assert.equal(colorDistance(2, 4), 2);
  assert.equal(colorDistance(3, 3), 0);
});

test("worldColor 随光相位漂移", () => {
  assert.equal(worldColor([0], 0, 1), 1);
  assert.equal(worldColor([4], 0, 1), 0);
  assert.equal(worldColor([2], 0, 0), 2);
});

test("四邻与 3×3 邻域：角 2 邻、边 3 邻、心 4 邻", () => {
  assert.equal(neighborsOf(0).length, 2);
  assert.equal(neighborsOf(1).length, 3);
  assert.equal(neighborsOf(12).length, 4);
  assert.equal(neighborhoodOf(0).length, 4);
  assert.equal(neighborhoodOf(12).length, 9);
});

test("dominantColor 取众数，平局取轮上更小者（确定性）", () => {
  assert.equal(dominantColor([0, 0, 1]), 0);
  assert.equal(dominantColor([2, 3, 3]), 3);
  assert.equal(dominantColor([1, 2]), 1);
});

test("createBoard 不变量：25 居民、每色至少 3 只、变色龙邻域至少 2 只同色盘居民", () => {
  for (const seed of [1, 101, 677, 123456]) {
    const b = createBoard(seed);
    assert.equal(b.residents.length, CELL_COUNT);
    const counts = colorCounts(b.residents);
    for (const c of counts) assert.ok(c >= 3, `seed ${seed} 出现少于 3 只的颜色`);
    assert.ok(b.chameleonCell >= 0 && b.chameleonCell < CELL_COUNT);
    assert.ok(b.initialColor >= 0 && b.initialColor < COLOR_COUNT);
    const nb = neighborhoodOf(b.chameleonCell)
      .filter((c) => c !== b.chameleonCell)
      .map((c) => b.residents[c]);
    const mode = dominantColor(nb);
    const modeCount = nb.filter((c) => c === mode).length;
    assert.ok(modeCount >= 2, `seed ${seed} 变色龙初始格邻域无 ≥2 只同色居民`);
  }
});

test("createState 初始态：融合度定满、回合 1、2 侦察点、REVEAL 揭幕", () => {
  const s = createState(42);
  assert.equal(s.blend, MAX_BLEND);
  assert.equal(s.round, 1);
  assert.equal(s.probes, 2);
  assert.equal(s.turn, TURN.REVEAL);
  assert.equal(s.residents.length, CELL_COUNT);
  assert.equal(s.outcome, OUTCOME.RUNNING);
});

test("stepFrame 同种子逐帧一致（重放确定性）且融合度恒在 0–90", () => {
  const a = createState(2024);
  const b = createState(2024);
  const dt = 1 / 120;
  for (let i = 0; i < 600; i += 1) {
    stepFrame(a, dt);
    stepFrame(b, dt);
    assert.equal(a.turn, b.turn);
    assert.equal(a.turnTimer.toFixed(4), b.turnTimer.toFixed(4));
    assert.equal(a.phase, b.phase);
    assert.equal(a.chameleonCell, b.chameleonCell);
    assert.equal(a.chameleonColor, b.chameleonColor);
    assert.equal(a.blend, b.blend);
    assert.equal(a.round, b.round);
    assert.equal(a.ripples.length, b.ripples.length);
    assert.ok(a.blend >= BLEND_MIN && a.blend <= MAX_BLEND);
  }
});

test("扫探噪声确定性且有界 ±8", () => {
  for (let i = 0; i < 20; i += 1) {
    const n = heatNoise(7, 12, i);
    assert.ok(n >= -NOISE_AMPLITUDE && n <= NOISE_AMPLITUDE);
    assert.equal(n, heatNoise(7, 12, i), "同 seed/格位/序号必须恒等");
  }
});

test("移动仅在伪装阶段有效，限 1 步，起落点各留波纹，融合度被打断", () => {
  const s = createState(9);
  s.turn = TURN.CAMO;
  s.outcome = OUTCOME.RUNNING;
  const start = s.chameleonCell;
  const dir = neighborsOf(start).length > 0 ? 0 : 0;
  const res = chameleonMove(s, dir);
  assert.equal(res.ok, true);
  assert.equal(s.ripples.length, 2);
  assert.ok(s.blend < MAX_BLEND);
  assert.equal(s.moved, true);
  assert.equal(chameleonMove(s, (dir + 1) % 4).ok, false, "每回合限 1 步");
});

test("换色在 5 色轮上移一档，精调收敛至邻域众数并 +15", () => {
  const s = createState(3);
  s.turn = TURN.CAMO;
  s.outcome = OUTCOME.RUNNING;
  const before = s.chameleonColor;
  const r = chameleonRecolor(s, 1);
  assert.equal(r.ok, true);
  assert.equal(s.chameleonColor, (before + 1) % COLOR_COUNT);

  const s2 = createState(4);
  s2.turn = TURN.CAMO;
  s2.outcome = OUTCOME.RUNNING;
  s2.blend = 60; // 开局已满 90，先压低才能测出精调的 +15
  const blendBefore = s2.blend;
  const f = chameleonFineTune(s2);
  assert.equal(f.ok, true);
  const mode = dominantColor(
    neighborhoodOf(s2.chameleonCell).filter((c) => c !== s2.chameleonCell).map((c) => worldColor(s2.residents, c, s2.phase))
  );
  assert.equal(s2.chameleonColor, mode);
  assert.ok(s2.blend >= blendBefore + 14);
  assert.equal(chameleonFineTune(s2).ok, false, "精调每回合限 1 次");
});

test("非伪装阶段所有变色龙行动一律 no-op", () => {
  const s = createState(5);
  assert.equal(s.turn, TURN.REVEAL);
  assert.equal(chameleonMove(s, 0).ok, false);
  assert.equal(chameleonRecolor(s, 1).ok, false);
  assert.equal(chameleonFineTune(s).ok, false);
});

test("猎手扫探消耗侦察点且热度恒在 0–100，指认命中=抓获、指错=存活", () => {
  const s = createState(6);
  s.turn = TURN.OBSERVE;
  s.outcome = OUTCOME.RUNNING;
  s.probes = 2;
  const scan = hunterScan(s, 12);
  assert.ok(scan);
  assert.equal(s.probes, 1);
  assert.ok(scan.heat >= 0 && scan.heat <= 100);

  const s2 = createState(6);
  s2.turn = TURN.OBSERVE;
  s2.outcome = OUTCOME.RUNNING;
  const hit = hunterAccuse(s2, s2.chameleonCell);
  assert.equal(hit.correct, true);
  assert.equal(s2.outcome, OUTCOME.CAUGHT);
  assert.equal(s2.turn, TURN.SETTLE);

  const s3 = createState(6);
  s3.turn = TURN.OBSERVE;
  s3.outcome = OUTCOME.RUNNING;
  const missCell = (s3.chameleonCell + 1) % CELL_COUNT;
  const miss = hunterAccuse(s3, missCell);
  assert.equal(miss.correct, false);
  assert.equal(s3.outcome, OUTCOME.SURVIVED);
});

test("猎手放弃=变色龙存活，侦察点耗尽后扫探/指认返回 null", () => {
  const s = createState(6);
  s.turn = TURN.OBSERVE;
  s.outcome = OUTCOME.RUNNING;
  assert.equal(hunterPass(s).ok, true);
  assert.equal(s.outcome, OUTCOME.SURVIVED);

  const s2 = createState(6);
  s2.turn = TURN.OBSERVE;
  s2.outcome = OUTCOME.RUNNING;
  s2.probes = 0;
  assert.equal(hunterScan(s2, 0), null);
  assert.equal(hunterAccuse(s2, 0), null);
});

test("异常热度恒在 0–100（低融合度更热，波纹顶高）", () => {
  const s = createState(6);
  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    const h = heatFor(s, cell);
    assert.ok(h >= 0 && h <= 100, `cell ${cell} 热度越界 ${h}`);
  }
  const atChameleon = heatFor(s, s.chameleonCell);
  assert.ok(atChameleon >= 0 && atChameleon <= 100);
});

test("守恒不变量审计始终为真", () => {
  const s = createState(6);
  const inv = invariants(s);
  assert.equal(inv.oneChameleon, true);
  assert.equal(inv.residentCount, true);
  assert.equal(inv.roundPositive, true);
  assert.equal(inv.blendInRange, true);
  assert.equal(inv.phaseInRange, true);
});

test("破绽强度 tellStrength：融合度越低越强，但恒在 [TELL_MIN, 1]，且随融合度单调递减", () => {
  const s = createState(6);
  let prev = null;
  for (let b = 0; b <= MAX_BLEND; b += 1) {
    s.blend = b;
    const t = tellStrength(s);
    assert.ok(t >= TELL_MIN - 1e-9 && t <= 1 + 1e-9, `blend ${b} 破绽越界 ${t}`);
    if (prev !== null) assert.ok(t <= prev, `blend ${b}（${t}）应不高于 blend ${b - 1}（${prev}）`);
    prev = t;
  }
  s.blend = MAX_BLEND;
  assert.ok(Math.abs(tellStrength(s) - TELL_MIN) < 1e-9, "满融合度时破绽应落到兜底 TELL_MIN");
  s.blend = BLEND_MIN;
  assert.ok(Math.abs(tellStrength(s) - 1) < 1e-9, "零融合度时破绽应拉满为 1");
});