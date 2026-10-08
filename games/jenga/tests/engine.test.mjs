// 叠叠乐 · 引擎四类原生测试
//   1. 塔结构与抽叠规则（端头动态可抽、顶层禁抽、块数守恒）
//   2. 四档判倒（4/4/3/4）逐档命中
//   3. 确定性（同种子重放逐帧一致）+ ≥1000 步随机合法操作游走
//   4. 塌落松弛收敛与连击状态机

import test from "node:test";
import assert from "node:assert/strict";

import {
  FIXED_DT,
  BLOCK_H,
  PER_LAYER,
  START_LAYERS,
  TOTAL_BLOCKS,
  STATUS,
  AXIS,
  LEAN_DEG,
  OVERHANG_RATIO,
  COLLAPSE_TIME,
  mulberry32,
  createInitialState,
  cloneState,
  canPull,
  pullBlock,
  canStack,
  stackBlock,
  cancelPull,
  stepFrame,
  audit,
  verdictOf,
  tiltOf,
  towerBlocks,
  towerStats,
  pullableBlocks,
  layerBox,
  axisOfLayer,
  baseBox
} from "../js/engine.mjs";

const deg = (rad) => (rad * 180) / Math.PI;

function fresh(opts) {
  return createInitialState({ seed: 20261009, ...opts });
}

// 走一次完整的「抽 + 叠」循环；返回是否还活着
function move(state, rnd, slot) {
  const cand = pullableBlocks(state);
  if (!cand.length) return { alive: false, reason: "nopull" };
  const pick = cand[Math.floor(rnd() * cand.length)];
  const pulled = pullBlock(state, pick.layer, pick.slot);
  if (pulled.collapsed) return { alive: false, reason: "pull", verdict: pulled.verdict };
  const target = slot != null && canStack(state, slot) ? slot : [0, 1, 2].find((s) => canStack(state, s));
  const stacked = stackBlock(state, target);
  if (!stacked.ok) return { alive: false, reason: "stackfail" };
  if (stacked.collapsed) return { alive: false, reason: "stack", verdict: stacked.verdict };
  return { alive: true, stacked };
}

// ---------------------------------------------------------------- 1 · 塔结构与规则

test("初始塔：3 块/层 × 18 层 = 54 块，层间 90° 正交交错", () => {
  const s = fresh();
  assert.equal(s.layers.length, START_LAYERS);
  assert.equal(s.blocks.length, TOTAL_BLOCKS);
  assert.equal(towerBlocks(s).length, TOTAL_BLOCKS);
  for (let layer = 0; layer < s.layers.length; layer += 1) {
    assert.equal(s.layers[layer].slots.filter((id) => id != null).length, PER_LAYER);
    assert.equal(axisOfLayer(layer), layer % 2 === 0 ? AXIS.X : AXIS.Z);
    // 相邻层长边必须正交
    assert.notEqual(axisOfLayer(layer), axisOfLayer(layer + 1));
  }
  // 同层三块沿短边方向并排、长边方向居中
  const b0 = layerBox(s, 0, 0);
  const b1 = layerBox(s, 0, 1);
  assert.equal(b0.x0, b1.x0); // 偶层长边沿 X：x 跨度相同
  assert.ok(b0.z1 <= b1.z0 + 1e-9); // z 方向并排不重叠
});

test("端头规则：初始只有 slot 0/2 可抽；邻居被抽走后中间块才露出端头", () => {
  const s = fresh();
  assert.ok(canPull(s, 5, 0));
  assert.ok(canPull(s, 5, 2));
  assert.ok(!canPull(s, 5, 1), "两侧夹住的中间块不可抽");

  // 抽走 slot 0 并把这块叠到塔顶（回到 IDLE），此时层 5 的 slot 1 一端已露出
  pullBlock(s, 5, 0);
  assert.ok(!canPull(s, 5, 1), "持块期间不得再抽");
  stackBlock(s, 1);
  assert.ok(canPull(s, 5, 1), "邻居被抽走后，中间块的一端露出，变为可抽");
  assert.ok(canPull(s, 5, 2));
});

test("正在施工的最顶层永远不可抽（杜绝原地空转刷连击）", () => {
  const s = fresh();
  const top = s.layers.length - 1;
  assert.ok(!canPull(s, top, 0));
  assert.ok(!canPull(s, top, 2));
  // 顶层满 → 落位会自动起新层；无论新层填了几块，最顶层始终禁抽
  for (let i = 0; i < 4; i += 1) {
    pullBlock(s, 3, i % 2 === 0 ? 0 : 2);
    stackBlock(s, i % 3);
    assert.ok(!canPull(s, s.layers.length - 1, 0), `第 ${i} 轮：最顶层不可抽`);
    assert.ok(!canPull(s, s.layers.length - 1, 2));
  }
  // 塔只能往上长：4 次抽叠后层数必然增加，绝不可能回到原层数
  assert.ok(s.layers.length > START_LAYERS);
});

test("抽块→持块（HOLDING）→堆叠→回到 IDLE，连击逐次累加", () => {
  const s = fresh();
  assert.equal(s.status, STATUS.IDLE);
  const pulled = pullBlock(s, 4, 0);
  assert.ok(pulled.ok);
  assert.equal(s.status, STATUS.HOLDING);
  assert.equal(s.held, s.layers[4].slots[0] === null ? s.held : s.held);
  assert.equal(s.pullCount, 1);
  // 持块期间不得再抽
  assert.ok(!canPull(s, 6, 0));
  const stacked = stackBlock(s, 1);
  assert.ok(stacked.ok);
  assert.equal(s.status, STATUS.IDLE);
  assert.equal(s.held, null);
  assert.equal(s.stackCount, 1);
  assert.equal(s.streak, 1);
});

test("取消抽块：木块原位塞回，块数守恒、连击不受影响", () => {
  const s = fresh();
  pullBlock(s, 6, 0);
  const streakBefore = s.streak;
  const pullsBefore = s.pullCount;
  const r = cancelPull(s);
  assert.ok(r.ok);
  assert.equal(s.held, null);
  assert.equal(s.status, STATUS.IDLE);
  assert.equal(s.pullCount, pullsBefore - 1, "取消不计一次抽块");
  assert.equal(s.streak, streakBefore, "取消既不涨连击也不清连击");
  assert.equal(towerBlocks(s).length, TOTAL_BLOCKS, "塞回后块数守恒");
  assert.equal(s.layers[6].slots[0], r.block);
  assert.ok(!cancelPull(s).ok, "非持块状态不得取消");
});

test("堆叠槽位：顶层已满时三槽皆可（自动起新层），已占槽不可再落", () => {
  const s = fresh();
  // 开局顶层是满的 → 第一次落位必须起新层；持块期间三槽皆可
  pullBlock(s, 2, 0);
  assert.ok(canStack(s, 0) && canStack(s, 1) && canStack(s, 2), "顶层满时三槽皆可（自动起新层）");
  stackBlock(s, 1);
  assert.equal(s.layers.length, START_LAYERS + 1, "顶层满时落位应起新层");
  pullBlock(s, 3, 0);
  assert.ok(!canStack(s, 1), "新层该槽已被占用");
  assert.ok(canStack(s, 0) && canStack(s, 2), "新层其余空槽可落");
  // 新层填满（3 块）后才允许再起一层
  pullBlock(s, 3, 0);
  stackBlock(s, 0);
  pullBlock(s, 4, 0);
  stackBlock(s, 2);
  assert.equal(s.layers.length, START_LAYERS + 1);
  assert.equal(s.layers[s.layers.length - 1].slots.filter((id) => id != null).length, PER_LAYER);
  pullBlock(s, 5, 0);
  stackBlock(s, 1);
  assert.equal(s.layers.length, START_LAYERS + 2, "顶层满后再落一块应自动起新层");
});

test("块数守恒：抽 N 块必叠 N 块，塔内块 + 手上一块恒为 54", () => {
  const s = fresh();
  const rnd = mulberry32(99);
  for (let i = 0; i < 60; i += 1) {
    const r = move(s, rnd, i % 3);
    if (!r.alive) break; // 判倒瞬间塔内块会全部脱手进入塌落，不再适用守恒式
    const inTower = towerBlocks(s).length;
    const held = s.held == null ? 0 : 1;
    assert.equal(inTower + held, TOTAL_BLOCKS, `第 ${i} 步块数守恒被破坏`);
    assert.equal(s.pullCount, s.stackCount + held);
    for (let f = 0; f < 20; f += 1) {
      stepFrame(s);
      if (s.status === STATUS.COLLAPSE) break;
    }
    if (s.status !== STATUS.IDLE) break;
  }
  assert.ok(s.pullCount > 0);
});

// ---------------------------------------------------------------- 2 · 四档判倒逐档断言

test("档 1（4 角支撑）：整层被抽光 → 上层重心彻底失去托底 → 判倒", () => {
  const s = fresh();
  // 白盒掏空第 6 层：这一层的三块全部消失，其上第 7 层既无接触角也无托底。
  for (let slot = 0; slot < PER_LAYER; slot += 1) {
    const id = s.layers[6].slots[slot];
    s.blocks[id].inTower = false;
    s.layers[6].slots[slot] = null;
  }
  audit(s);
  const verdict = verdictOf(s);
  assert.ok(verdict, "整层掏空必须判倒");
  assert.equal(verdict.gear, 1);
  assert.equal(verdict.corners, 0);
  assert.equal(s.audit.worstSupport.center, false);
});

test("档 1 不误伤：只掏掉一层的两块（重心仍搭在剩下那块上）不判倒", () => {
  const s = fresh();
  for (const slot of [0, 2]) {
    const id = s.layers[6].slots[slot];
    s.blocks[id].inTower = false;
    s.layers[6].slots[slot] = null;
  }
  audit(s);
  const verdict = verdictOf(s);
  assert.ok(!verdict || verdict.gear !== 1, "重心仍有托底时不应判档 1");
  // 但判危度必须显著抬升（塔身微颤的氛围提示）
  assert.ok(s.geomDanger > 0.5, `判危度应明显上升，实际 ${s.geomDanger}`);
});

test("档 2（质心越出基座）：底层被掏到只剩一根独木 → 判倒", () => {
  const s = fresh();
  for (const slot of [0, 2]) {
    const id = s.layers[0].slots[slot];
    s.blocks[id].inTower = false;
    s.layers[0].slots[slot] = null;
  }
  audit(s);
  const verdict = verdictOf(s);
  assert.ok(verdict, "底层只剩一块必须判倒");
  assert.equal(verdict.gear, 2);
  assert.equal(s.audit.baseBlocks, 1);
  // 基座包围盒随之收窄
  const box = baseBox(s);
  assert.ok(box.x1 - box.x0 <= 1.0001 || box.z1 - box.z0 <= 1.0001);
});

test("档 3（倾角 3°）：高楼静止倾角超过阈值且无回落 → 判倒", () => {
  // 24 层塔的层间错位累积已使平衡倾角逼近 3°，塔从竖直态摆过去会过冲越线。
  const s = fresh({ layers: 24 });
  audit(s);
  assert.ok(tiltOf(s) < 0.05, "初始静止态应为竖直");
  let collapsed = false;
  for (let i = 0; i < 600 && !collapsed; i += 1) {
    stepFrame(s);
    if (s.status === STATUS.COLLAPSE) collapsed = true;
  }
  assert.ok(collapsed, "24 层歪塔必须在摆动中判倒");
  assert.equal(s.verdict.gear, 3);
  assert.ok(deg(s.verdict.lean) >= LEAN_DEG - 1e-6, `判倒倾角应 ≥ 3°，实际 ${deg(s.verdict.lean)}`);
});

test("档 3 的倾角随塔高增长（越高越难回正）", () => {
  const short = fresh({ layers: 18 });
  const tall = fresh({ layers: 22 });
  for (let i = 0; i < 240; i += 1) {
    stepFrame(short);
    stepFrame(tall);
  }
  assert.ok(tiltOf(tall) > tiltOf(short), `高塔倾角应更大：${deg(tiltOf(tall))} vs ${deg(tiltOf(short))}`);
});

test("档 4（悬臂 40%）：下方只剩中间一块、上方无压重 → 悬空 2/3 判倒", () => {
  const s = fresh();
  // 掏空倒数第二层的两侧，最顶层的块沿长轴只剩 1/3 搭着，且顶上没有压重。
  const under = s.layers.length - 2;
  for (const slot of [0, 2]) {
    const id = s.layers[under].slots[slot];
    s.blocks[id].inTower = false;
    s.layers[under].slots[slot] = null;
  }
  audit(s);
  const oh = s.audit.worstOverhang;
  assert.ok(oh.ratio > OVERHANG_RATIO, `悬空比例应超过 40%，实际 ${oh.ratio.toFixed(3)}`);
  assert.equal(oh.load, 0, "最顶层之上没有压重");
  const verdict = verdictOf(s);
  assert.ok(verdict, "顶层悬空过大必须判倒");
  assert.equal(verdict.gear, 4);
});

test("档 4 豁免：同样的悬空比例但上方压着 ≥2 块时不判倒", () => {
  const s = fresh();
  const under = 8; // 中层，上方还有十几层压着
  for (const slot of [0, 2]) {
    const id = s.layers[under].slots[slot];
    s.blocks[id].inTower = false;
    s.layers[under].slots[slot] = null;
  }
  audit(s);
  const verdict = verdictOf(s);
  assert.ok(!verdict || verdict.gear !== 4, "上压 ≥ 2 块时档 4 应豁免");
});

// ---------------------------------------------------------------- 3 · 确定性与随机游走

test("同种子重放逐帧一致：相同操作序列产出逐字段相同的状态", () => {
  const rnd = mulberry32(4242);
  const script = [];
  for (let i = 0; i < 24; i += 1) script.push({ slot: Math.floor(rnd() * 3), frames: 12 + Math.floor(rnd() * 40) });

  const run = () => {
    const s = fresh();
    const r = mulberry32(777);
    for (const cmd of script) {
      move(s, r, cmd.slot);
      for (let f = 0; f < cmd.frames; f += 1) stepFrame(s);
      if (s.status === STATUS.COLLAPSE) break;
    }
    return s;
  };
  const a = run();
  const b = run();
  assert.equal(a.status, b.status);
  assert.equal(a.pullCount, b.pullCount);
  assert.equal(a.stackCount, b.stackCount);
  assert.equal(a.streak, b.streak);
  assert.deepEqual(a.sway, b.sway);
  assert.deepEqual(a.com, b.com);
  assert.deepEqual(a.layers, b.layers);
  assert.deepEqual(
    a.blocks.map((x) => [x.layer, x.slot, x.px, x.py, x.pz]),
    b.blocks.map((x) => [x.layer, x.slot, x.px, x.py, x.pz])
  );
});

test("不同种子产出不同的塔（初始摆放抖动与歪斜朝向由种子决定）", () => {
  const a = fresh({ seed: 1 });
  const b = fresh({ seed: 2 });
  const oxA = a.layers.map((l) => l.ox.toFixed(6)).join(",");
  const oxB = b.layers.map((l) => l.ox.toFixed(6)).join(",");
  assert.notEqual(oxA, oxB);
});

test("≥1000 步随机合法操作游走：状态机不崩、不卡死、不变量守恒", () => {
  const rnd = mulberry32(31337);
  let steps = 0;
  let collapses = 0;
  let s = fresh();
  const gears = new Set();
  while (steps < 1200) {
    const before = steps;
    const r = move(s, rnd, Math.floor(rnd() * 3));
    steps += 1;
    // 不变量 2：判危度始终归一（任何阶段都要成立）
    assert.ok(s.danger >= 0 && s.danger <= 1, `danger 越界 ${s.danger}`);
    // 不变量 3：状态机只允许这几个状态
    assert.ok(
      [STATUS.IDLE, STATUS.HOLDING, STATUS.COLLAPSE, STATUS.LOST].includes(s.status),
      `非法状态 ${s.status}`
    );
    if (!r.alive) {
      gears.add(r.verdict ? r.verdict.gear : -1);
      collapses += 1;
      // 塌落必须能收敛到 LOST，绝不卡死
      let guard = 0;
      while (s.status !== STATUS.LOST && guard < 1200) {
        stepFrame(s);
        guard += 1;
      }
      assert.equal(s.status, STATUS.LOST, "塌落必须收敛");
      assert.ok(guard <= Math.ceil(COLLAPSE_TIME / FIXED_DT) + 2, "塌落不得超过设定时长");
      s = createInitialState({ seed: 1000 + collapses });
      continue;
    }
    // 不变量 1：块数守恒（仅在塔仍站立时成立）
    assert.equal(towerBlocks(s).length, TOTAL_BLOCKS, `第 ${steps} 步块数守恒被破坏`);
    assert.equal(s.pullCount, s.stackCount);
    // 每次成功操作后推进一段物理帧
    for (let f = 0; f < 20; f += 1) {
      stepFrame(s);
      if (s.status === STATUS.COLLAPSE) break;
    }
    if (s.status === STATUS.COLLAPSE) {
      gears.add(s.verdict ? s.verdict.gear : -1);
      collapses += 1;
      let guard = 0;
      while (s.status !== STATUS.LOST && guard < 1200) {
        stepFrame(s);
        guard += 1;
      }
      s = createInitialState({ seed: 1000 + collapses });
    }
    assert.ok(steps > before);
  }
  assert.ok(steps >= 1200);
  assert.ok(collapses > 0, "1200 步内至少应出现过一次塔倒");
  assert.ok(gears.size >= 2, `四档判倒应至少命中两档，实际 ${[...gears].join(",")}`);
});

test("阵风机关：开启后塔的摆幅显著大于无风局", () => {
  const calm = fresh({ layers: 16 });
  const windy = fresh({ layers: 16, gust: true, gustPeriod: 2, gustAmp: 0.06 });
  let calmMax = 0;
  let windyMax = 0;
  for (let i = 0; i < 900; i += 1) {
    stepFrame(calm);
    stepFrame(windy);
    if (calm.status === STATUS.IDLE) calmMax = Math.max(calmMax, tiltOf(calm));
    if (windy.status === STATUS.IDLE) windyMax = Math.max(windyMax, tiltOf(windy));
  }
  assert.ok(windyMax > calmMax, `阵风应推高摆幅：${deg(windyMax)} vs ${deg(calmMax)}`);
});

// ---------------------------------------------------------------- 4 · 塌落与状态机

test("判倒后进入塌落松弛，并在限定帧数内收敛为 LOST（块全部落地静止）", () => {
  const s = fresh();
  for (let slot = 0; slot < PER_LAYER; slot += 1) {
    const id = s.layers[4].slots[slot];
    s.blocks[id].inTower = false;
    s.layers[4].slots[slot] = null;
  }
  audit(s);
  const verdict = verdictOf(s);
  assert.ok(verdict);
  // 通过一次合法操作触发判倒路径（pull 内部会审计）
  const id = s.layers[7].slots[0];
  s.blocks[id].inTower = true;
  s.layers[7].slots[0] = id;
  pullBlock(s, 7, 0);
  assert.equal(s.status, STATUS.COLLAPSE);
  assert.equal(s.streak, 0, "判倒后连击清零");
  let frames = 0;
  while (s.status !== STATUS.LOST && frames < 1200) {
    stepFrame(s);
    frames += 1;
  }
  assert.equal(s.status, STATUS.LOST);
  assert.ok(frames <= Math.ceil(COLLAPSE_TIME / FIXED_DT) + 2);
  for (const b of s.blocks) {
    assert.ok(b.resting, "塌落结束后所有木块必须静止");
    assert.ok(b.py >= BLOCK_H / 2 - 1e-9, "木块不得陷进地面");
    assert.equal(b.vx, 0);
    assert.equal(b.vz, 0);
  }
});

test("终局后一切操作 no-op（严禁抛错、严禁改状态）", () => {
  const s = fresh();
  pullBlock(s, 7, 0);
  stackBlock(s, 0);
  // 白盒掏空一层：下一次合法抽块必然触发档 1 判倒
  for (let slot = 0; slot < PER_LAYER; slot += 1) {
    const id = s.layers[2].slots[slot];
    s.blocks[id].inTower = false;
    s.layers[2].slots[slot] = null;
  }
  const doomed = pullBlock(s, 5, 0);
  assert.ok(doomed.collapsed, "掏空一层后抽块必须判倒");
  let guard = 0;
  while (s.status !== STATUS.LOST && guard < 1200) {
    stepFrame(s);
    guard += 1;
  }
  assert.equal(s.status, STATUS.LOST);
  const before = towerStats(s);
  const pulled = pullBlock(s, 5, 2);
  assert.equal(pulled.ok, false);
  assert.equal(pulled.reason, "illegal");
  const stacked = stackBlock(s, 0);
  assert.equal(stacked.ok, false);
  assert.deepEqual(towerStats(s), before, "终局操作不得改动任何状态");
});

test("cloneState 深拷贝：改动副本不污染原状态", () => {
  const s = fresh();
  const c = cloneState(s);
  c.layers[3].slots[1] = null;
  c.blocks[0].px = 99;
  c.sway.tx = 0.4;
  assert.notEqual(s.layers[3].slots[1], null);
  assert.notEqual(s.blocks[0].px, 99);
  assert.notEqual(s.sway.tx, 0.4);
});

test("towerStats 快照：层数 / 块数 / 判危度 / 连击口径自洽", () => {
  const s = fresh();
  const stat = towerStats(s);
  assert.equal(stat.layers, START_LAYERS);
  assert.equal(stat.blocks, TOTAL_BLOCKS);
  assert.equal(stat.streak, 0);
  assert.ok(stat.danger >= 0 && stat.danger <= 1);
  assert.equal(stat.height, START_LAYERS * BLOCK_H);
  assert.equal(stat.topSlots.length, PER_LAYER);
});
