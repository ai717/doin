import test from "node:test";
import assert from "node:assert/strict";

import {
  CHARGE_MIN,
  CHARGE_MAX,
  CHARGE_CAP,
  DIST_BASE,
  distAt,
  chargeFor,
  createState,
  startCharge,
  releaseCharge,
  stepFrame,
  drainEvents,
  charPos,
  platformPos,
  classifyLanding,
  LANDING,
  isGapSolvable,
  gapReach,
  legalGapRange,
  computeStars,
  accuracy,
  sniperRank,
  sniperRing,
  mulberry32,
  hashSeed,
  PLATFORM_RADIUS,
  MOVING_AMP,
  TRAMPOLINE_GAP_MIN,
  TRAMPOLINE_GAP_MAX,
  SNIPER_SHOTS,
  VINYL_HOLD,
  VINYL_BONUS,
  LIFT_FROM,
} from "../js/engine.mjs";
import { bullseyeGain, landingPoints, computeStars as starRule } from "../js/score.mjs";
import { buildLevelRoute, levelSpec, LEVEL_COUNT, CHAPTERS } from "../js/levels.mjs";

const STEP = 1 / 120;

/** 完美瞄准：按飞行时长预测目标平台落点时刻的位置，反解所需蓄力 */
function aimCharge(st) {
  const from = charPos(st);
  const target = st.platforms[st.index + 1];
  if (!target) return null;
  const rough = Math.hypot(platformPos(target, st.time).x - from.x, platformPos(target, st.time).y - from.y);
  const dur = 0.34 + distAt(chargeFor(rough)) * 0.0013;
  const tp = platformPos(target, st.time + dur);
  return chargeFor(Math.hypot(tp.x - from.x, tp.y - from.y));
}

function play(opts, { random = false, rand = Math.random, maxSteps = 400000 } = {}) {
  const st = createState(opts);
  let guard = 0;
  let perfects = 0;
  let throws = 0;
  while (!st.ended && guard++ < maxSteps) {
    if (st.phase === "aiming" || st.phase === "wobble") {
      const charge = random ? 0.25 + rand() * 1.25 : aimCharge(st);
      if (charge === null) break;
      try {
        startCharge(st);
        st.charge = charge;
        releaseCharge(st);
      } catch {
        throws += 1;
      }
    }
    stepFrame(st, STEP);
    for (const e of drainEvents(st)) if (e.type === "landed" && e.kind === LANDING.PERFECT) perfects += 1;
  }
  return { st, guard, perfects, throws };
}

/* ---------------- 1 · 蓄力 — 距离标定 ---------------- */
test("charge mapping is strictly linear and clamped at the cap", () => {
  assert.equal(distAt(0), DIST_BASE);
  assert.ok(distAt(1) - distAt(0) > 0);
  assert.equal(distAt(0.5) - distAt(0), distAt(1) - distAt(0.5), "距离必须随蓄力严格线性");
  assert.equal(distAt(CHARGE_CAP), distAt(CHARGE_CAP + 5), "超过上限不再增长，杜绝数值失控");
  assert.ok(Math.abs(chargeFor(distAt(0.9)) - 0.9) < 1e-9, "chargeFor 是 distAt 的精确逆函数");
});

test("full charge overshoots the hardest legal gap (≈15% redundancy)", () => {
  const hardest = distAt(CHARGE_MAX);
  assert.ok(distAt(CHARGE_CAP) > hardest, "满蓄力必须超过最远合法间距");
  assert.ok(distAt(CHARGE_CAP) / hardest < 1.35, "冗余不应过度");
});

/* ---------------- 2 · 落地判定 ---------------- */
test("landing classification boundaries", () => {
  const r = PLATFORM_RADIUS.plain;
  assert.equal(classifyLanding(0, r), LANDING.PERFECT);
  assert.equal(classifyLanding(r * 0.25, r), LANDING.PERFECT);
  assert.equal(classifyLanding(r * 0.26, r), LANDING.SAFE);
  assert.equal(classifyLanding(r * 0.77, r), LANDING.SAFE);
  assert.equal(classifyLanding(r * 0.79, r), LANDING.WOBBLE);
  assert.equal(classifyLanding(r, r), LANDING.WOBBLE);
  assert.equal(classifyLanding(r + 0.01, r), LANDING.MISS);
});

test("the pawn travels the whole jump continuously instead of teleporting", () => {
  const st = createState({ mode: "endless", seed: 77 });
  const from = charPos(st);
  const target = platformPos(st.platforms[1], st.time);
  const gap = Math.hypot(target.x - from.x, target.y - from.y);

  startCharge(st);
  st.charge = chargeFor(gap);
  releaseCharge(st);
  assert.equal(st.phase, "flying");

  const samples = [];
  let guard = 0;
  while (st.phase === "flying" && guard++ < 4000) {
    stepFrame(st, STEP);
    samples.push(charPos(st));
  }
  assert.ok(samples.length >= 10, `flight lasted only ${samples.length} frames`);

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  let travelled = 0;
  let maxStep = 0;
  let frozen = 0;
  let prev = from;
  for (const s of samples) {
    const step = dist(s, prev);
    if (step < 1e-9) frozen += 1;
    maxStep = Math.max(maxStep, step);
    travelled += step;
    prev = s;
  }

  // 冻结帧直接等价于"画面停在原地、落地时闪现"
  assert.equal(frozen, 0, `${frozen} frames moved nothing`);
  // 总位移必须覆盖整段跳跃距离
  assert.ok(travelled > gap * 0.9, `travelled ${travelled.toFixed(1)} < gap ${gap.toFixed(1)}`);
  // 单帧位移过大就是肉眼可见的瞬移
  assert.ok(maxStep < travelled * 0.25, `single frame moved ${maxStep.toFixed(1)} of ${travelled.toFixed(1)}`);
});

test("a missed jump keeps falling from the overshoot point instead of snapping back", () => {
  const st = createState({ mode: "endless", seed: 77 });
  const from = charPos(st);
  startCharge(st);
  st.charge = CHARGE_CAP; // 必定过冲
  releaseCharge(st);

  let guard = 0;
  while (st.phase === "flying" && guard++ < 4000) stepFrame(st, STEP);
  assert.equal(st.phase, "falling");

  const miss = charPos(st);
  const overshoot = Math.hypot(miss.x - from.x, miss.y - from.y);
  assert.ok(overshoot > 100, `overshoot only ${overshoot.toFixed(1)}`);

  // 坠落全过程（含收尾那一帧）都不得出现回到起跳台的跳变
  let closest = Infinity;
  guard = 0;
  do {
    const p = charPos(st);
    closest = Math.min(closest, Math.hypot(p.x - from.x, p.y - from.y));
    stepFrame(st, STEP);
  } while (st.phase === "falling" && guard++ < 4000);
  assert.equal(st.phase, "lost");
  assert.ok(closest > 100, `pawn snapped back to ${closest.toFixed(1)} from the start pad`);
});

test("sniper recovery lifts the pawn back onto the deck instead of popping it in", () => {
  const st = createState({ mode: "sniper", seed: 5 });
  startCharge(st);
  st.charge = CHARGE_CAP; // 必定脱靶
  releaseCharge(st);

  let guard = 0;
  while (st.phase === "flying" && guard++ < 4000) stepFrame(st, STEP);
  assert.equal(st.phase, "falling");
  guard = 0;
  while (st.phase === "falling" && guard++ < 4000) stepFrame(st, STEP);

  assert.equal(st.phase, "lift");
  assert.ok(st.char.z < -50, `pawn must start below the deck, got z=${st.char.z}`);

  const zs = [];
  guard = 0;
  while (st.phase === "lift" && guard++ < 4000) {
    stepFrame(st, STEP);
    zs.push(st.char.z);
  }
  assert.ok(zs.length >= 8, `lift lasted only ${zs.length} frames`);

  let maxStep = 0;
  let prev = LIFT_FROM;
  for (const z of zs) {
    maxStep = Math.max(maxStep, Math.abs(z - prev));
    prev = z;
  }
  // 一帧跨过大半高度就等于闪现
  assert.ok(maxStep < Math.abs(LIFT_FROM) * 0.5, `lift jumped ${maxStep.toFixed(1)} in a single frame`);
  assert.equal(st.char.z, 0);
  assert.equal(st.phase, "settling");
  assert.equal(st.sniper.shots, 1);
  assert.equal(st.sniper.rings[st.sniper.rings.length - 1].points, 0);
});

/* ---------------- 3 · 可解性 ---------------- */
test("gap solvability predicate rejects out-of-window gaps", () => {
  assert.ok(isGapSolvable(250, "plain"));
  assert.ok(!isGapSolvable(60, "plain"), "太近的间距会小于最小起跳力");
  assert.ok(!isGapSolvable(600, "plain"), "太远的间距超出最大起跳力");
  const [lo, hi] = gapReach(250, "moving");
  assert.ok(hi - lo > 2 * MOVING_AMP, "浮动岛振幅必须计入可达区间");
});

test("legal gap windows stay inside the chargeable range for every platform type", () => {
  for (const type of Object.keys(PLATFORM_RADIUS)) {
    const [lo, hi] = legalGapRange(type);
    assert.ok(hi >= lo, `${type} 生成窗口不能为空`);
    assert.ok(isGapSolvable(lo, type), `${type} 窗口下界必须可解`);
    assert.ok(isGapSolvable(hi, type), `${type} 窗口上界必须可解`);
  }
});

test("all 25 odyssey levels are 100% solvable (every gap, worst-case offset, all motion phases)", () => {
  for (let id = 1; id <= LEVEL_COUNT; id += 1) {
    const route = buildLevelRoute(id);
    assert.ok(route.length >= 6 && route.length <= 10, `L${id} 平台数应在 6~10`);
    assert.equal(route[route.length - 1].type, "goal", `L${id} 末块必须是终点旗台`);
    for (let i = 1; i < route.length; i += 1) {
      const prev = route[i - 1];
      const cur = route[i];
      const gap = Math.hypot(cur.x - prev.x, cur.y - prev.y);
      if (prev.type === "trampoline") {
        assert.ok(
          gap >= TRAMPOLINE_GAP_MIN - 1e-6 && gap <= TRAMPOLINE_GAP_MAX + 1e-6,
          `L${id} 跳床后的间距应落在超远区间，实为 ${gap.toFixed(1)}`
        );
        continue;
      }
      assert.ok(isGapSolvable(gap, cur.type), `L${id} 第 ${i} 跳不可解：gap=${gap.toFixed(1)} type=${cur.type}`);
    }
  }
});

test("level generation is deterministic for a given id", () => {
  for (const id of [1, 8, 17, 25]) {
    const a = buildLevelRoute(id);
    const b = buildLevelRoute(id);
    assert.deepEqual(
      a.map((p) => [p.x, p.y, p.type, p.motion ? p.motion.phase : 0]),
      b.map((p) => [p.x, p.y, p.type, p.motion ? p.motion.phase : 0]),
      `L${id} 同 id 必须得到完全相同的局面`
    );
  }
});

test("level specs ramp across 5 chapters of 5 stages", () => {
  assert.equal(CHAPTERS.length, 5);
  for (let id = 1; id <= LEVEL_COUNT; id += 1) {
    const spec = levelSpec(id);
    assert.equal(spec.chapter, Math.ceil(id / 5));
    assert.ok(spec.count >= 6 && spec.count <= 10);
  }
  assert.ok(levelSpec(25).count >= levelSpec(1).count, "后章平台数不应少于首章");
});

/* ---------------- 4 · 完美瞄准必通关 ---------------- */
test("perfect aim clears every one of the 25 levels", () => {
  for (let id = 1; id <= LEVEL_COUNT; id += 1) {
    const r = play({ mode: "odyssey", level: id, seed: 1, route: buildLevelRoute(id) });
    assert.equal(r.st.phase, "won", `L${id} 完美瞄准应当通关，实为 ${r.st.phase}`);
    assert.equal(r.st.lands, levelSpec(id).count - 1, `L${id} 着陆次数应为平台数 - 1`);
    assert.equal(r.throws, 0, `L${id} 不得抛错`);
  }
});

test("perfect aim scores 3 stars and never wobbles", () => {
  const r = play({ mode: "odyssey", level: 12, seed: 1, route: buildLevelRoute(12) });
  assert.equal(r.st.bullseyes, r.st.jumps, "完美瞄准应当每一跳都正中靶心");
  assert.equal(r.st.wobbles, 0);
  assert.equal(computeStars(r.st), 3);
  assert.equal(accuracy(r.st), 1);
});

/* ---------------- 5 · 计分 ---------------- */
test("bullseye combo grows as +2, +4, +6, +8", () => {
  assert.equal(bullseyeGain(1), 2);
  assert.equal(bullseyeGain(2), 4);
  assert.equal(bullseyeGain(3), 6);
  assert.equal(bullseyeGain(4), 8);
  assert.equal(landingPoints(LANDING.SAFE, 9), 1);
  assert.equal(landingPoints(LANDING.WOBBLE, 9), 1);
  assert.equal(landingPoints(LANDING.TRAMPOLINE, 9), 2);
});

test("missing resets the combo and ends the endless run", () => {
  const st = createState({ mode: "endless", seed: 11 });
  startCharge(st);
  st.charge = aimCharge(st);
  releaseCharge(st);
  for (let i = 0; i < 400 && !st.ended; i += 1) stepFrame(st, STEP);
  assert.equal(st.combo, 1, "首跳完美后连击应为 1");
  assert.equal(st.score, 2);

  startCharge(st);
  st.charge = CHARGE_MAX; // 必定过冲坠落
  releaseCharge(st);
  for (let i = 0; i < 400 && st.phase !== "lost"; i += 1) stepFrame(st, STEP);
  assert.equal(st.phase, "lost");
  assert.equal(st.combo, 0, "坠落后连击必须归零");
  assert.ok(st.ended);
});

test("star rules require cumulative conditions", () => {
  const base = { jumps: 10, bullseyes: 6, bestCombo: 2, wobbles: 2 };
  assert.equal(starRule({ ...base, won: false }), 0, "未通关不给星");
  assert.equal(starRule({ ...base, bullseyes: 5, won: true }), 1, "靶心率不足只给 1 星");
  assert.equal(starRule({ ...base, won: true }), 2, "靶心率达标但无 3 连、有摇晃 → 2 星");
  assert.equal(starRule({ ...base, bestCombo: 3, won: true }), 3);
  assert.equal(starRule({ ...base, wobbles: 0, won: true }), 3, "零摇晃也可拿 3 星");
});

/* ---------------- 6 · 特种平台 ---------------- */
test("trampoline auto-launch crosses an unjumpable chasm and lands dead centre", () => {
  // 构造：起点 -> 跳床 -> 超远目标
  const st = createState({ mode: "endless", seed: 3 });
  st.platforms = [
    { id: 0, x: 0, y: 0, type: "start", radius: PLATFORM_RADIUS.start, motion: null, visited: true },
    { id: 1, x: 240, y: 0, type: "trampoline", radius: PLATFORM_RADIUS.trampoline, motion: null, visited: false },
    { id: 2, x: 240 + 460, y: 0, type: "plain", radius: PLATFORM_RADIUS.plain, motion: null, visited: false },
  ];
  st.index = 0;
  st.nextAxis = 0;

  startCharge(st);
  st.charge = chargeFor(240);
  releaseCharge(st);
  let guard = 0;
  while (st.index < 2 && guard++ < 4000) {
    stepFrame(st, STEP);
    drainEvents(st);
  }
  assert.equal(st.index, 2, "跳床必须把棋子送到超远平台");
  assert.equal(st.platforms[1].type, "trampoline");
  assert.ok(Math.hypot(st.char.offX, st.char.offY) < 1, "跳床自动落点必须正中平台中心");
});

test("vinyl deck pays the bonus only after holding still", () => {
  const st = createState({ mode: "endless", seed: 5 });
  st.platforms = [
    { id: 0, x: 0, y: 0, type: "start", radius: PLATFORM_RADIUS.start, motion: null, visited: true },
    { id: 1, x: 240, y: 0, type: "vinyl", radius: PLATFORM_RADIUS.vinyl, motion: null, visited: false },
    { id: 2, x: 480, y: 0, type: "plain", radius: PLATFORM_RADIUS.plain, motion: null, visited: false },
  ];
  st.index = 0;
  startCharge(st);
  st.charge = chargeFor(240);
  releaseCharge(st);
  let guard = 0;
  while (st.phase !== "aiming" && guard++ < 2000) {
    stepFrame(st, STEP);
    drainEvents(st);
  }
  assert.equal(st.index, 1);
  const before = st.score;

  // 未到停留时长就起跳 → 不发放彩蛋
  for (let i = 0; i < Math.floor((VINYL_HOLD * 0.5) / STEP); i += 1) stepFrame(st, STEP);
  assert.equal(st.score, before, "停留不足不得发放彩蛋");

  // 补足时长
  for (let i = 0; i < Math.ceil((VINYL_HOLD * 0.7) / STEP); i += 1) stepFrame(st, STEP);
  assert.equal(st.score - before, VINYL_BONUS, "停留达标应发放 +5 彩蛋");

  // 同一块台只发放一次
  for (let i = 0; i < Math.ceil((VINYL_HOLD * 2) / STEP); i += 1) stepFrame(st, STEP);
  assert.equal(st.score - before, VINYL_BONUS);
});

test("every endless-generated platform stays reachable, drifting isles included", () => {
  const st = createState({ mode: "endless", seed: 9 });
  let seen = 0;
  let moving = 0;
  let guard = 0;

  // 走真实生成路径：完美瞄准连跳，逐块校验刚生成的平台
  while (seen < 220 && guard++ < 400000) {
    if (st.phase === "aiming" || st.phase === "wobble") {
      const charge = aimCharge(st);
      if (charge === null) break;
      startCharge(st);
      st.charge = charge;
      releaseCharge(st);
    }
    stepFrame(st, STEP);
    drainEvents(st);

    while (seen < st.platforms.length - 1) {
      const prev = st.platforms[seen];
      const cur = st.platforms[seen + 1];
      const gap = Math.hypot(cur.x - prev.x, cur.y - prev.y);
      if (prev.type === "trampoline") {
        assert.ok(
          gap >= TRAMPOLINE_GAP_MIN - 1e-6 && gap <= TRAMPOLINE_GAP_MAX + 1e-6,
          `跳床后间距 ${gap.toFixed(1)} 应落在超远区间`
        );
      } else {
        assert.ok(isGapSolvable(gap, cur.type), `无尽第 ${seen + 1} 块不可解：gap=${gap.toFixed(1)} type=${cur.type}`);
        if (cur.type === "moving") moving += 1;
      }
      seen += 1;
    }
  }

  assert.ok(seen >= 200, `应至少生成 200 块（实为 ${seen}）`);
  assert.ok(moving > 0, "高难度档应当出现漂移浮岛");
  assert.equal(st.phase !== "lost", true, "完美瞄准不应坠落");
});

/* ---------------- 7 · 靶心试炼 ---------------- */
test("sniper rings and ranks", () => {
  const r = PLATFORM_RADIUS.plain;
  assert.equal(sniperRing(0, r).points, 100);
  assert.equal(sniperRing(r * 0.25, r).points, 100);
  assert.equal(sniperRing(r * 0.4, r).points, 60);
  assert.equal(sniperRing(r * 0.7, r).points, 30);
  assert.equal(sniperRing(r * 0.95, r).points, 10);
  assert.equal(sniperRing(r * 1.4, r).points, 0);
  assert.equal(sniperRing(r * 1.4, r).ring, "miss");

  assert.equal(sniperRank(1000), "S");
  assert.equal(sniperRank(800), "S");
  assert.equal(sniperRank(700), "A");
  assert.equal(sniperRank(500), "B");
  assert.equal(sniperRank(100), "C");
});

test("sniper range runs exactly 10 shots and recovers from a miss", () => {
  const st = createState({ mode: "sniper", seed: 1 });
  let guard = 0;
  let misses = 0;
  while (!st.ended && guard++ < 200000) {
    if (st.phase === "aiming" || st.phase === "wobble") {
      if (st.sniper.shots === 3) {
        // 强行脱靶一次：蓄力拉满
        startCharge(st);
        st.charge = CHARGE_CAP;
        releaseCharge(st);
      } else {
        startCharge(st);
        st.charge = aimCharge(st);
        releaseCharge(st);
      }
    }
    stepFrame(st, STEP);
    for (const e of drainEvents(st)) if (e.type === "recover") misses += 1;
  }
  assert.equal(st.phase, "won", "10 靶打完即结算，不因脱靶中断");
  assert.equal(st.sniper.shots, SNIPER_SHOTS);
  assert.ok(misses >= 1, "应记录到至少一次脱靶恢复");
  assert.ok(st.sniper.total < SNIPER_SHOTS * 100, "脱靶后总分应低于满分");
});

test("sniper perfect run scores the maximum", () => {
  const r = play({ mode: "sniper", seed: 1 });
  assert.equal(r.st.phase, "won");
  assert.equal(r.st.sniper.total, SNIPER_SHOTS * 100);
  assert.equal(sniperRank(r.st.sniper.total), "S");
});

/* ---------------- 8 · 随机游走不变式 ---------------- */
test("3000-step random walk never throws and preserves invariants", () => {
  const rand = mulberry32(hashSeed("jump-jump:walk"));
  const st = createState({ mode: "endless", seed: hashSeed("jump-jump:walk:state") });
  let steps = 0;
  let restarts = 0;

  while (steps < 3000) {
    if (st.phase === "aiming" || st.phase === "wobble") {
      startCharge(st);
      st.charge = CHARGE_MIN + rand() * (CHARGE_CAP - CHARGE_MIN);
      releaseCharge(st);
    }
    stepFrame(st, STEP);
    drainEvents(st);
    steps += 1;

    assert.ok(Number.isFinite(st.score) && st.score >= 0, "得分必须有限且非负");
    assert.ok(st.combo >= 0, "连击不得为负");
    assert.ok(st.index >= 0 && st.index < st.platforms.length, "当前平台索引必须有效");
    assert.ok(Number.isFinite(st.char.offX) && Number.isFinite(st.char.offY), "棋子偏移必须有限");
    assert.ok(Number.isFinite(st.char.z), "高度必须始终是有限值（坠落时会合法地降到负值）");

    if (st.ended) {
      restarts += 1;
      const fresh = createState({ mode: "endless", seed: hashSeed(`jump-jump:walk:${restarts}`) });
      Object.assign(st, fresh);
    }
  }
  assert.ok(steps >= 3000);
});

test("operations on a terminated run are no-ops instead of exceptions", () => {
  const st = createState({ mode: "endless", seed: 21 });
  startCharge(st);
  st.charge = CHARGE_CAP;
  releaseCharge(st);
  let guard = 0;
  while (!st.ended && guard++ < 5000) stepFrame(st, STEP);
  assert.ok(st.ended);

  assert.equal(startCharge(st), null, "终局后不得再蓄力");
  assert.equal(releaseCharge(st), null, "终局后不得再起跳");
  const before = JSON.stringify({ p: st.phase, s: st.score });
  stepFrame(st, STEP);
  assert.equal(JSON.stringify({ p: st.phase, s: st.score }), before, "终局后推进不得改变状态");
});

test("charging is only accepted while the pawn is grounded", () => {
  const st = createState({ mode: "endless", seed: 31 });
  startCharge(st);
  assert.equal(st.phase, "charging");
  st.charge = 0.6;
  releaseCharge(st);
  assert.equal(st.phase, "flying");
  assert.equal(startCharge(st), null, "空中不得重新蓄力");
});
