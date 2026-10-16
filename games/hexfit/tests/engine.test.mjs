// engine.test.mjs — 蜂巢网格规则纯函数验证：三轴满行、级联、倍率公式、守恒、随机游走、确定性。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createState,
  drawPiece,
  placeAndClear,
  allCells,
  allRows,
  cellKey,
  inBoard,
  shapeCells,
  SHAPES,
  SHAPE_COUNT,
  RADIUS,
  CELL_COUNT,
  BASE_SCORE_PER_ROW,
  MAX_MULTIPLIER_EXP,
  RUSH_THRESHOLD,
  occupiedCount,
  invariants,
  findFullRows,
  applyGravity,
  placementKeys,
  shapeCenteredCells,
  stepFrame,
  MODE,
} from "../js/engine.mjs";
import { mulberry32 } from "../js/rng.mjs";
import { totalMultiplier, waveMultiplier, scoreFor, MULT_CAP } from "../js/score.mjs";

function fresh(mode = MODE.SURVIVAL, seed = 1) {
  const s = createState({ seed, mode });
  drawPiece(s);
  return s;
}

test("网格：半径 4 共 61 格，全部在棋盘内", () => {
  const cells = allCells();
  assert.equal(cells.length, CELL_COUNT);
  assert.equal(CELL_COUNT, 61);
  for (const [q, r] of cells) assert.ok(inBoard(q, r), `(${q},${r}) 在盘内`);
});

test("三轴行：每条行的格都在盘内，且每条行长度 ≥ 5", () => {
  const rows = allRows();
  assert.ok(rows.length >= 15, `至少 15 条行（3 轴 × 9 减去重复），实际 ${rows.length}`);
  for (const row of rows) {
    assert.ok(row.length >= 5, `行长度 ${row.length} ≥ 5`);
    for (const k of row) {
      const [q, r] = k.split(",").map(Number);
      assert.ok(inBoard(q, r));
    }
  }
});

test("形状：12 种，每种旋转 6 次后格数守恒", () => {
  assert.equal(SHAPES.length, SHAPE_COUNT);
  for (const shape of SHAPES) {
    const base = shapeCells(shape.id, 0);
    assert.ok(base.length >= 1 && base.length <= 5, `${shape.id} 格数 1-5`);
    for (let rot = 0; rot < 6; rot += 1) {
      const cells = shapeCells(shape.id, rot);
      assert.equal(cells.length, base.length, `${shape.id} rot${rot} 格数守恒`);
    }
  }
});

test("形状旋转 6 次回到原位", () => {
  for (const shape of SHAPES) {
    const a = shapeCells(shape.id, 0).map((c) => c.join(",")).sort();
    const b = shapeCells(shape.id, 6).map((c) => c.join(",")).sort();
    assert.deepEqual(a, b, `${shape.id} 旋转 6 次复原`);
  }
});

test("放置合法性：空位可放、占格/越界不可放", () => {
  const s = fresh();
  const shapeId = s.current.shapeId;
  const rot = 0;
  // 找一个合法位置
  let placed = false;
  for (const [q, r] of allCells()) {
    const keys = placementKeys(s, shapeId, rot, q, r);
    if (keys) {
      assert.ok(keys.length > 0);
      placed = true;
      break;
    }
  }
  assert.ok(placed, "空盘总能找到放置位");
});

test("满行消除：填满一整行后消除，格数减少", () => {
  const s = createState({ seed: 1, mode: MODE.SURVIVAL });
  // 取一条横轴行（constant r=0）
  const row = allRows().find((r) => r.length === 9); // 中间最长行
  assert.ok(row, "存在长度 9 的行");
  for (const k of row) s.occupied[k] = true;
  const before = occupiedCount(s);
  const full = findFullRows(s);
  assert.equal(full.length, 1, "恰好一行满");
  const clearedKeys = new Set(full.flat());
  for (const k of clearedKeys) delete s.occupied[k];
  const after = occupiedCount(s);
  assert.equal(after, before - row.length);
});

test("重力下落：消除后同列块向下压实", () => {
  const s = createState({ seed: 1, mode: MODE.SURVIVAL });
  // 在 q=0 列放两个块，留空中间
  s.occupied[cellKey(0, -2)] = true;
  s.occupied[cellKey(0, 2)] = true;
  applyGravity(s);
  // q=0 列合法 r 范围
  const valid = [];
  for (let r = -RADIUS; r <= RADIUS; r += 1) if (inBoard(0, r)) valid.push(r);
  valid.sort((a, b) => b - a);
  // 压实后应占据最底两个
  assert.ok(s.occupied[cellKey(0, valid[0])]);
  assert.ok(s.occupied[cellKey(0, valid[1])]);
});

test("计分公式：消 N 行倍率 = 2^(N-1)，封顶 2^18", () => {
  assert.equal(waveMultiplier(0), 1);
  assert.equal(waveMultiplier(1), 1);
  assert.equal(waveMultiplier(2), 2);
  assert.equal(waveMultiplier(3), 4);
  assert.equal(waveMultiplier(4), 8);
  assert.equal(waveMultiplier(5), 16);
  assert.equal(waveMultiplier(20), MULT_CAP, "超大 N 封顶 2^18");
  assert.equal(scoreFor(4, 8), 4 * BASE_SCORE_PER_ROW * 8);
  assert.equal(scoreFor(1, 1), 100);
});

test("狂潮连乘：4 行进狂潮，后续消除倍率 ×2 连乘", () => {
  // 模拟：先消 4 行进狂潮，再消 1 行 → 倍率 = 2^0 * 2^1 = 2
  assert.equal(totalMultiplier(4, 0, false), 8, "首次 4 行：2^3=8（未连乘）");
  assert.equal(totalMultiplier(1, 1, true), 2, "狂潮后消 1 行：2^(0+1)=2");
  assert.equal(totalMultiplier(1, 2, true), 4, "再消 1 行：2^(0+2)=4");
  assert.equal(totalMultiplier(1, 15, true), 2 ** 15, "连乘 15 次");
  assert.equal(totalMultiplier(1, 18, true), MULT_CAP, "封顶 2^18");
});

test("placeAndClear：合法放置更新 occupied 与计分", () => {
  const s = fresh();
  const shapeId = s.current.shapeId;
  const rot = 0;
  let anchor = null;
  for (const [q, r] of allCells()) {
    if (placementKeys(s, shapeId, rot, q, r)) { anchor = [q, r]; break; }
  }
  assert.ok(anchor, "找到合法锚点");
  const before = occupiedCount(s);
  const res = placeAndClear(s, shapeId, rot, anchor[0], anchor[1]);
  assert.equal(res.placed, true);
  assert.equal(occupiedCount(s), before + shapeCells(shapeId, rot).length, "格数增加块大小");
});

test("不变量：任意放置后格数守恒、倍率合法、分数有限", () => {
  const s = fresh();
  const res = placeAndClear(s, s.current.shapeId, 0, 0, 0);
  // 0,0 可能非法；若非法换位置
  if (!res.placed) {
    for (const [q, r] of allCells()) {
      const r2 = placeAndClear(s, s.current.shapeId, 0, q, r);
      if (r2.placed) break;
    }
  }
  const inv = invariants(s);
  assert.ok(inv.cellCountInRange, "格数在 0-61");
  assert.ok(inv.allCellsInBoard, "所有格在盘内");
  assert.ok(inv.multiplierPowerOfTwo, "倍率为 2 的幂且 ≤ 2^18");
  assert.ok(inv.scoreNonNegativeFinite, "分数非负有限");
});

test("随机游走 1200 步：状态机不崩、不变式守恒", () => {
  const rng = mulberry32(20261009);
  const s = createState({ seed: 42, mode: MODE.SURVIVAL });
  drawPiece(s);
  let placed = 0;
  for (let i = 0; i < 1200; i += 1) {
    if (s.gameOver) break;
    if (!s.current) drawPiece(s);
    const shapeId = s.current.shapeId;
    const rot = Math.floor(rng() * 6);
    // 随机找一个合法位置
    const cells = allCells();
    const shuffled = [...cells].sort(() => rng() - 0.5);
    let did = false;
    for (const [q, r] of shuffled) {
      const res = placeAndClear(s, shapeId, rot, q, r);
      if (res.placed) { did = true; placed += 1; break; }
    }
    if (!did) {
      // 所有旋转都不行 → 游戏应 stuck
      break;
    }
    if (i % 100 === 0) {
      const inv = invariants(s);
      assert.ok(inv.cellCountInRange && inv.allCellsInBoard, `步 ${i} 守恒`);
    }
  }
  assert.ok(placed > 0, "至少放置一次");
});

test("确定性：同种子 + 同放置序列 → 同分同格", () => {
  const run = (seed) => {
    const s = createState({ seed, mode: MODE.SURVIVAL });
    drawPiece(s);
    for (let i = 0; i < 50; i += 1) {
      if (s.gameOver || !s.current) break;
      for (const [q, r] of allCells()) {
        const res = placeAndClear(s, s.current.shapeId, 0, q, r);
        if (res.placed) break;
      }
    }
    return { score: s.score, rows: s.rowsCleared, count: occupiedCount(s) };
  };
  const a = run(777);
  const b = run(777);
  assert.deepEqual(a, b, "同种子轨迹一致");
  const c = run(778);
  assert.notDeepEqual(a, c, "异种子结果不同");
});

test("hex-bag：每袋含全部形状各 1，均衡分布", () => {
  const s = createState({ seed: 1, mode: MODE.SURVIVAL });
  drawPiece(s); // 触发首次装袋
  // 此时 queue 里是一袋（12 个形状），加上 current 已取走 1 个
  const drawn = [s.current.shapeId];
  while (s.queue.length > 0) {
    drawn.push(s.queue.shift());
  }
  assert.equal(drawn.length, SHAPE_COUNT, "一袋共 12 个形状");
  const counts = {};
  for (const id of drawn) counts[id] = (counts[id] || 0) + 1;
  for (const shape of SHAPES) {
    assert.equal(counts[shape.id], 1, `形状 ${shape.id} 在袋内恰好 1 次`);
  }
});

test("章节模式：块用尽且未达标 → gameOver 且 winner=null", () => {
  const s = createState({
    seed: 1,
    mode: MODE.CAMPAIGN,
    level: { id: 1, pieces: 1, goalRows: 999 },
  });
  drawPiece(s);
  // 放置一次耗尽块
  for (const [q, r] of allCells()) {
    const res = placeAndClear(s, s.current.shapeId, 0, q, r);
    if (res.placed) break;
  }
  assert.equal(s.gameOver, true);
  assert.equal(s.winner, null);
});

test("倍率封顶：连乘不超过 2^18", () => {
  const s = createState({ seed: 1, mode: MODE.SURVIVAL });
  s.rushActive = true;
  s.rushCombo = 100;
  drawPiece(s);
  // 即使狂潮 combo 很大，倍率也不超过 2^18
  const mult = totalMultiplier(1, s.rushCombo, true);
  assert.ok(mult <= MULT_CAP, `倍率 ${mult} ≤ 2^18`);
});

test("跟手锚定：居中偏移恒为块体真实格平移（光标即块格）", () => {
  const ids = [
    "mono", "domino", "tri-line", "tri-bend", "tetro-line", "tetro-square",
    "tetro-bend", "tetro-t", "pento-cluster", "pento-line", "pento-y", "pento-z",
  ];
  for (const id of ids) {
    for (let rot = 0; rot < 6; rot += 1) {
      const raw = shapeCells(id, rot);
      const centered = shapeCenteredCells(id, rot);
      assert.equal(centered.length, raw.length, `${id}#${rot} 格数守恒`);
      assert.ok(centered.some(([q, r]) => q === 0 && r === 0), `${id}#${rot} 原点必须是块体真实格`);
      // centered 必须是 raw 的整体平移，且平移量是 raw 中的真实格
      const oq = raw[0][0] - centered[0][0];
      const orr = raw[0][1] - centered[0][1];
      assert.ok(
        raw.every((c, i) => c[0] - centered[i][0] === oq && c[1] - centered[i][1] === orr),
        `${id}#${rot} centered 必须是 raw 的整体平移`,
      );
      assert.ok(
        raw.some((c) => c[0] === oq && c[1] === orr),
        `${id}#${rot} 平移量必须是块体真实格`,
      );
    }
  }
});

test("跟手放置：点击空格且合法时该格必被填充；非法点击零副作用", () => {
  const s = fresh(MODE.SURVIVAL, 77);
  const all = allCells();
  const inB = (qq, rr) => Math.abs(qq) <= 4 && Math.abs(rr) <= 4 && Math.abs(qq + rr) <= 4;
  for (let step = 0; step < 200 && !s.gameOver && s.current; step += 1) {
    const { shapeId, rotation } = s.current;
    const cursor = all[(step * 7) % all.length];
    const cells = shapeCenteredCells(shapeId, rotation);
    const fit = cells.every(([dq, dr]) => {
      const qq = cursor[0] + dq;
      const rr = cursor[1] + dr;
      return inB(qq, rr) && !s.occupied[cellKey(qq, rr)];
    });
    const before = occupiedCount(s);
    const minQ = Math.min(...cells.map((c) => c[0]));
    const minR = Math.min(...cells.map((c) => c[1]));
    const res = placeAndClear(s, shapeId, rotation, cursor[0] + minQ, cursor[1] + minR);
    if (fit) {
      assert.equal(res.placed, true, "合法点击必须成功放置");
      if (res.rowsCleared === 0) {
        assert.equal(s.occupied[cellKey(cursor[0], cursor[1])], true, "未消行时点击格必须被填充");
      }
    } else {
      assert.equal(res.placed, false, "非法点击必须拒绝");
      assert.equal(occupiedCount(s), before, "非法点击零副作用");
    }
    if (step % 10 === 0) {
      const inv = invariants(s);
      assert.ok(Object.values(inv).every(Boolean), `不变式守恒: ${JSON.stringify(inv)}`);
    }
  }
  assert.ok(occupiedCount(s) > 0, "至少放置一次");
});

test("消除浮字：placeAndClear 产生 pop 事件，stepFrame 确定性衰减", () => {
  const s = fresh(MODE.SURVIVAL, 9);
  // 构造 constant r=0 行 9 格中占 8 格，用 mono 补 (4,0) → 必消 1 行
  for (let q = -4; q <= 3; q += 1) s.occupied[cellKey(q, 0)] = true;
  const res = placeAndClear(s, "mono", 0, 4, 0);
  assert.equal(res.placed, true);
  assert.ok(res.rowsCleared >= 1, "补满 r=0 行必须消除");
  const pops = s.events.filter((e) => e.type === "pop");
  assert.equal(pops.length, 1, "单波消除恰产生一条 pop 事件");
  assert.equal(pops[0].text, `+${res.scoreGain}`, "浮字必须等于实际得分");
  assert.ok(pops[0].t > 0, "初始寿命为正");
  const t0 = pops[0].t;
  stepFrame(s, 0.4);
  assert.ok(Math.abs(pops[0].t - (t0 - 0.4)) < 1e-9, "stepFrame 确定性衰减");
  stepFrame(s, 10);
  assert.equal(s.events.filter((e) => e.type === "pop").length, 0, "寿命归零后清除");
});
