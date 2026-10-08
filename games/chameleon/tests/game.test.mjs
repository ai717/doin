// game.test.mjs —— 控制器：≥1000 步随机合法操作游走不抛错、不越界、不变量守恒；同种子重放逐帧一致

import test from "node:test";
import assert from "node:assert/strict";

import { createGame, FIXED_DT } from "../js/game.mjs";
import { mulberry32 } from "../js/rng.mjs";
import { TURN, OUTCOME, CELL_COUNT, MAX_BLEND, BLEND_MIN } from "../js/engine.mjs";

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function checkInvariants(view) {
  assert.ok(view, "视图不得为空");
  assert.ok(view.blend >= BLEND_MIN && view.blend <= MAX_BLEND, `blend 越界 ${view.blend}`);
  assert.equal(view.residents.length, CELL_COUNT, "居民数必须守恒");
  assert.ok(view.round >= 1, "回合数守恒");
}

function randomAction(g, rng) {
  const v = g.view();
  if (v.canChameleonAct) {
    const roll = rng();
    if (roll < 0.35) {
      for (const d of shuffle([0, 1, 2, 3], rng)) {
        if (g.move(d).ok === true) return true;
      }
      return false;
    }
    if (roll < 0.7) return g.recolor(rng() < 0.5 ? -1 : 1).ok === true;
    return g.refine().ok === true;
  }
  if (v.canHunterAct) {
    const roll = rng();
    if (v.probes > 0 && roll < 0.5) return g.scan(Math.floor(rng() * CELL_COUNT)) !== null;
    if (v.probes > 0 && roll < 0.85) return g.accuse(Math.floor(rng() * CELL_COUNT)) !== null;
    return g.pass() !== null;
  }
  return false;
}

test("随机游走 ≥1000 步合法操作：双人模式下不抛错、不越界、不变量守恒", () => {
  const g = createGame();
  const rng = mulberry32(20261008);
  g.startDuel(2026);

  let succeeded = 0;
  let iterations = 0;
  const MAX_ITER = 40000;
  while (succeeded < 1000 && iterations < MAX_ITER) {
    iterations += 1;
    g.tick(FIXED_DT);
    const v = g.view();
    if (!v) {
      g.startDuel(Math.floor(rng() * 1e9));
      continue;
    }
    checkInvariants(v);
    if (!g.isActive()) {
      g.startDuel(Math.floor(rng() * 1e9));
      continue;
    }
    if (v.canChameleonAct || v.canHunterAct) {
      if (randomAction(g, rng)) succeeded += 1;
    }
  }
  assert.ok(succeeded >= 1000, `只成功执行了 ${succeeded} 步合法操作，不足 1000`);
});

test("同种子重放逐帧一致：诊断真值（含隐藏变色龙格与颜色）完全对齐", () => {
  const a = createGame();
  const b = createGame();
  a.startDuel(777);
  b.startDuel(777);

  for (let i = 0; i < 1200; i += 1) {
    a.tick(FIXED_DT);
    b.tick(FIXED_DT);

    const va = a.view();
    const vb = b.view();
    if (va.canChameleonAct) {
      a.move(0);
      b.move(0);
      a.refine();
      b.refine();
    } else if (va.canHunterAct) {
      a.scan(12);
      b.scan(12);
      a.pass();
      b.pass();
    }
    assert.deepEqual(a.diagnose(), b.diagnose(), `第 ${i} 帧重放不一致`);
    assert.equal(va.turn, vb.turn);
    assert.equal(va.blend, vb.blend);
    assert.equal(va.chameleonCell, vb.chameleonCell);
  }
});

test("练习观察台：自己藏自己找，观察阶段玩家可扫探并手动翻页", () => {
  const g = createGame();
  g.startPractice(42);
  const v0 = g.view();
  assert.equal(v0.canChameleonAct, false); // 开局揭幕，尚未到伪装阶段

  // 推进到观察阶段（REVEAL 1.5 + LIGHT 0.3 + CAMO 3 = 4.8s ≈ 576 帧）
  let v = g.view();
  let guard = 0;
  while (v && v.turn !== TURN.OBSERVE && guard < 2000) {
    g.tick(FIXED_DT);
    v = g.view();
    checkInvariants(v);
    guard += 1;
  }
  assert.equal(v.turn, TURN.OBSERVE, "应推进到观察阶段");
  assert.equal(v.canHunterAct, true, "练习模式观察阶段应可由玩家（自己找）操作");
  assert.equal(v.canChameleonAct, false, "观察阶段变色龙不可行动");

  // 玩家扫探自己藏的那一格
  const before = v.scans.length;
  const scan = g.scan(v.chameleonCell);
  assert.ok(scan && scan.cell === v.chameleonCell, "练习模式应能扫探");
  assert.equal(g.view().scans.length, before + 1, "扫探应被记录");
  assert.equal(g.view().turn, TURN.OBSERVE, "扫探后仍停留观察阶段，等待玩家主动翻页");

  // 玩家手动放弃
  const p = g.pass();
  assert.ok(p, "练习模式应能手动放弃翻页");
});

test("单人猎手战役：AI 变色龙决策不抛错，猎手行动正常，能走到终局或自然结束", () => {
  const g = createGame();
  const rng = mulberry32(555);
  g.startHunt(1, 101);
  let steps = 0;
  let ended = false;
  for (let i = 0; i < 20000 && !ended; i += 1) {
    g.tick(FIXED_DT);
    const v = g.view();
    assert.ok(v, "视图不得为空");
    checkInvariants(v);
    if (v.canHunterAct) {
      const roll = rng();
      if (v.probes > 0 && roll < 0.6) g.scan(Math.floor(rng() * CELL_COUNT));
      else g.accuse(Math.floor(rng() * CELL_COUNT));
      steps += 1;
    }
    if (!g.isActive()) {
      ended = true;
      const res = g.result();
      assert.ok(res && res.mode === "hunt", "猎手战役终局结果应带 mode=hunt");
      assert.ok(res.stars >= 0 && res.stars <= 3, "星级应 0–3");
    }
  }
  assert.ok(steps > 0, "猎手战役应执行过玩家操作");
});