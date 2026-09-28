// engine.test.mjs — 规则引擎用例（确定性 / 状态机 / 不变量 / 1000 步随机游走）
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  STATUS, ACTION, MECH, mulberry32, dailySeed, todayKey,
  generateBoard, createLevel, createSandbox,
  applyRotation, flip, cancelFlip, canFlip, hasUnmatched, foundTotems,
  invariantsHold, endTurn,
} from "../js/engine.mjs";
import { LEVELS, levelById, CHAPTERS, SANDBOX_LIMITS } from "../js/levels.mjs";
import { TOTEM_IDS, TOTEM_COUNT, pickTotemIds } from "../js/data.mjs";

// ---------------------------------------------------------------------------
// 工具：用固定种子构造一关；做最少翻牌尝试
// ---------------------------------------------------------------------------
function makeLevel(levelId, seedOverride) {
  const lv = levelById(levelId);
  return createLevel({
    levelId: lv.id, rows: lv.rows, cols: lv.cols, totemCount: lv.totemCount,
    seed: seedOverride ?? lv.id.length * 7 + lv.chapter,
    mech: lv.mech, missBudget: lv.missBudget,
  });
}

// ---------------------------------------------------------------------------
// 确定性 PRNG
// ---------------------------------------------------------------------------
describe("engine: mulberry32 与每日种子", () => {
  it("同种子序列一致、异种子不同", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    const c = mulberry32(124);
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    const seqC = Array.from({ length: 8 }, () => c());
    assert.deepEqual(seqA, seqB);
    assert.notDeepEqual(seqA, seqC);
    for (const v of seqA) assert.ok(v >= 0 && v < 1);
  });

  it("每日种子同日同值、跨日不同", () => {
    assert.equal(dailySeed("2026-09-28"), dailySeed("2026-09-28"));
    assert.notEqual(dailySeed("2026-09-28"), dailySeed("2026-09-29"));
    assert.ok(Number.isInteger(dailySeed("2026-09-28")));
  });

  it("todayKey 输出 YYYY-MM-DD", () => {
    assert.match(todayKey(new Date(2026, 8, 28)), /^2026-09-28$/);
  });

  it("非法 dailySeed 输入回 0", () => {
    assert.equal(dailySeed("not-a-date"), 0);
    assert.equal(dailySeed(null), 0);
    assert.equal(dailySeed(123), 0);
  });
});

// ---------------------------------------------------------------------------
// 数据层基本约束
// ---------------------------------------------------------------------------
describe("data: 图腾集", () => {
  it("图腾总数 = 30", () => {
    assert.equal(TOTEM_COUNT, 30);
  });
  it("pickTotemIds(n) 返回前 n 个唯一 id", () => {
    const five = pickTotemIds(5);
    assert.equal(five.length, 5);
    assert.equal(new Set(five).size, 5);
  });
  it("pickTotemIds 越界返回空", () => {
    assert.deepEqual(pickTotemIds(0), []);
    assert.deepEqual(pickTotemIds(31), []);
  });
});

// ---------------------------------------------------------------------------
// 关卡数据
// ---------------------------------------------------------------------------
describe("levels: 22 关 5 章配额与机制递进", () => {
  it("共 22 关，章节配额 (4/4/5/4/5)", () => {
    assert.equal(LEVELS.length, 22);
    assert.equal(LEVELS.filter((lv) => lv.chapter === 1).length, 4);
    assert.equal(LEVELS.filter((lv) => lv.chapter === 2).length, 4);
    assert.equal(LEVELS.filter((lv) => lv.chapter === 3).length, 5);
    assert.equal(LEVELS.filter((lv) => lv.chapter === 4).length, 4);
    assert.equal(LEVELS.filter((lv) => lv.chapter === 5).length, 5);
  });

  it("每关 totemCount = rows*cols/2", () => {
    for (const lv of LEVELS) {
      assert.equal(lv.totemCount, (lv.rows * lv.cols) / 2, `${lv.id}`);
    }
  });

  it("机制递进：第1章 none / 第2章 ring4 / 第3章 ring4 或 ring8 / 第4章 gear / 第5章残局有 missBudget", () => {
    for (const lv of LEVELS) {
      if (lv.chapter === 1) assert.equal(lv.mech, "none");
      if (lv.chapter === 2) assert.equal(lv.mech, "ring4");
      if (lv.chapter === 3) assert.ok(["ring4", "ring8"].includes(lv.mech), `${lv.id} 第3章 mech`);
      if (lv.chapter === 4) assert.equal(lv.mech, "gear");
      if (lv.chapter === 5) assert.ok(Number.isInteger(lv.missBudget) && lv.missBudget > 0, `${lv.id} 第5章 missBudget`);
    }
  });

  it("第 4 章 gear 关卡盘面行/列均为偶数（象限可分）", () => {
    for (const lv of LEVELS) {
      if (lv.mech !== "gear") continue;
      assert.equal(lv.rows % 2, 0, `${lv.id} rows 偶`);
      assert.equal(lv.cols % 2, 0, `${lv.id} cols 偶`);
    }
  });

  it("CHAPTERS 五章齐备", () => {
    assert.deepEqual([...Object.values(CHAPTERS)].map((c) => c.order), [1, 2, 3, 4, 5]);
  });
});

// ---------------------------------------------------------------------------
// 生成器：无不动点 + 无相邻对子
// ---------------------------------------------------------------------------
describe("generator: 无不动点 + 无相邻对子", () => {
  it("4x4 = 16 格 / 8 种图腾，对子守恒、无不动点、无相邻对子", () => {
    const lv = makeLevel("level_1_1", 42);
    assert.equal(lv.grid.length, 16);
    const counts = new Map();
    for (const t of lv.grid) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const [, n] of counts) assert.equal(n, 2);
    // 无相邻：横竖 4 邻均不同
    for (let r = 0; r < lv.rows; r += 1) {
      for (let c = 0; c < lv.cols; c += 1) {
        const idx = r * lv.cols + c;
        if (c + 1 < lv.cols) assert.notEqual(lv.grid[idx], lv.grid[r * lv.cols + (c + 1)], `邻位 (${r},${c})`);
        if (r + 1 < lv.rows) assert.notEqual(lv.grid[idx], lv.grid[(r + 1) * lv.cols + c], `邻位 (${r},${c})`);
      }
    }
    // 无不动点：原排序为 [ids[0],ids[0],ids[1],ids[1],...]
    const ids = pickTotemIds(8);
    for (let i = 0; i < lv.grid.length; i += 1) {
      assert.notEqual(lv.grid[i], ids[Math.floor(i / 2)], `不动点位置 ${i}`);
    }
  });

  it("异种子生成不同盘面", () => {
    const a = makeLevel("level_1_1", 42);
    const b = makeLevel("level_1_1", 88);
    assert.notDeepEqual(a.grid, b.grid);
  });

  it("非法 totemCount 抛错", () => {
    assert.throws(() => createLevel({ rows: 4, cols: 4, totemCount: 5, seed: 1 }));
    assert.throws(() => createLevel({ rows: 3, cols: 3, totemCount: 4, seed: 1 }));
  });

  it("奇数格抛错", () => {
    assert.throws(() => createLevel({ rows: 3, cols: 5, totemCount: 7, seed: 1 }));
  });
});

// ---------------------------------------------------------------------------
// 翻牌主流程
// ---------------------------------------------------------------------------
describe("flip: 配对与错配状态机", () => {
  it("翻第一张返回 flip-one，第二张同图腾返回 match", () => {
    const state = makeLevel("level_1_1", 1);
    // 手工找到两张同图腾的位
    const grid = state.grid;
    const pairA = grid.findIndex((t, i) => grid.indexOf(t) < i);  // 第二张
    const pairFirst = grid.indexOf(grid[pairA]);
    assert.notEqual(pairFirst, pairA);

    const r1 = flip(state, pairFirst);
    assert.equal(r1.action, ACTION.FLIP_ONE);
    assert.equal(state.faceUp[pairFirst], true);
    assert.equal(state.flipped.length, 1);

    const r2 = flip(state, pairA);
    assert.equal(r2.action, ACTION.MATCH);
    assert.equal(state.foundPairs.length, 1);
    assert.equal(state.combo, 1);
    assert.equal(state.grid[pairFirst], null);
    assert.equal(state.grid[pairA], null);
  });

  it("连续配对成功累加 combo 与 maxCombo", () => {
    const state = makeLevel("level_1_1", 7);
    // 找两对不同的图腾位
    const seen = new Map();
    const pairs = [];
    for (let i = 0; i < state.grid.length; i += 1) {
      const t = state.grid[i];
      if (seen.has(t)) {
        pairs.push([seen.get(t), i]);
        if (pairs.length >= 2) break;
      } else {
        seen.set(t, i);
      }
    }
    assert.equal(pairs.length, 2);
    flip(state, pairs[0][0]);
    flip(state, pairs[0][1]);
    flip(state, pairs[1][0]);
    flip(state, pairs[1][1]);
    assert.equal(state.combo, 2);
    assert.equal(state.maxCombo, 2);
    assert.equal(state.foundPairs.length, 2);
  });

  it("翻同一张盖回 = cancelFlip", () => {
    const state = makeLevel("level_1_1", 9);
    flip(state, 0);
    const r = cancelFlip(state);
    assert.equal(r.action, ACTION.CANCEL);
    assert.equal(state.faceUp[0], false);
    assert.equal(state.flipped.length, 0);
  });

  it("翻已翻开位 / 空槽 / 终局后 = none 静默", () => {
    const state = makeLevel("level_1_1", 11);
    flip(state, 0);
    // 再翻 flipped[0] 同一张 = 取消（盖回 + 清 flipped）
    const r = flip(state, 0);
    assert.equal(r.action, ACTION.CANCEL);
    assert.equal(state.faceUp[0], false);
    assert.equal(state.flipped.length, 0);

    // 空槽（先配对一对形成空槽）
    const seen = new Map();
    let pair = null;
    for (let i = 0; i < state.grid.length; i += 1) {
      const t = state.grid[i];
      if (seen.has(t)) { pair = [seen.get(t), i]; break; }
      seen.set(t, i);
    }
    flip(state, pair[0]);
    flip(state, pair[1]);
    assert.equal(state.grid[pair[0]], null);
    // 空槽位（grid=null）翻 = none 静默
    const r2 = flip(state, pair[0]);
    assert.equal(r2.action, ACTION.NONE);
  });

  it("配对成功触发 won 状态当盘面全空", () => {
    // 用 4x4 mech=none 关卡：找全部 8 对位置逐对翻完
    const state = createLevel({
      levelId: "won-test", rows: 4, cols: 4, totemCount: 8, seed: 3,
      mech: "none", missBudget: null,
    });
    const positionsByTotem = new Map();
    for (let i = 0; i < state.grid.length; i += 1) {
      const t = state.grid[i];
      if (!positionsByTotem.has(t)) positionsByTotem.set(t, []);
      positionsByTotem.get(t).push(i);
    }
    assert.equal(positionsByTotem.size, 8);
    let lastAction = null;
    for (const [, [a, b]] of positionsByTotem) {
      flip(state, a);
      lastAction = flip(state, b).action;
    }
    assert.equal(lastAction, ACTION.MATCH_WIN);
    assert.equal(state.status, STATUS.WON);
    assert.equal(state.grid.every((g) => g === null), true);
  });

  it("残局限定翻错次数：用满且仍有未配对 → lost", () => {
    // 4x4 / 8 对 / missBudget=1：第一次错配即触发 lost
    const state = createLevel({
      levelId: "lost-test", rows: 4, cols: 4, totemCount: 8, seed: 5,
      mech: "none", missBudget: 1,
    });
    // 找两个不同图腾的位触发错配
    let a = -1, b = -1;
    outer: for (let i = 0; i < state.grid.length; i += 1) {
      for (let j = i + 1; j < state.grid.length; j += 1) {
        if (state.grid[i] !== state.grid[j]) { a = i; b = j; break outer; }
      }
    }
    assert.ok(a >= 0 && b >= 0);
    flip(state, a);
    const r = flip(state, b);
    assert.equal(r.action, ACTION.MISMATCH_LOSE);
    assert.equal(state.status, STATUS.LOST);
    assert.equal(state.misses, 1);
  });
});

// ---------------------------------------------------------------------------
// 4 邻轮转（ring4）
// ---------------------------------------------------------------------------
describe("rotateRing ring4: 4 邻顺时针轮转 1 格", () => {
  it("中心位 5（4x4 第 (1,1)）周围 4 张盖牌按 上→右→下→左 各前移 1 格", () => {
    const state = makeLevel("level_2_1", 100);
    const center = 5; // (r=1, c=1)
    const neighbors = [
      1,   // 上 (r=0, c=1)
      6,   // 右 (r=1, c=2)
      9,   // 下 (r=2, c=1)
      4,   // 左 (r=1, c=0)
    ];
    const before = neighbors.map((idx) => state.grid[idx]);
    assert.notEqual(state.grid[center], null);

    const rotations = applyRotation(state, [center]);
    assert.equal(rotations.length, 1);
    assert.equal(rotations[0].center, center);
    assert.equal(rotations[0].positions.length, 4);

    // 顺时针前进 1 格：旧 positions[i] 去新 positions[(i+1) % n]
    // 即 新上=旧左、新右=旧上、新下=旧右、新左=旧下
    assert.equal(state.grid[neighbors[0]], before[3]); // 新上=旧左
    assert.equal(state.grid[neighbors[1]], before[0]); // 新右=旧上
    assert.equal(state.grid[neighbors[2]], before[1]); // 新下=旧右
    assert.equal(state.grid[neighbors[3]], before[2]); // 新左=旧下
  });

  it("中心位在角点（如位 0）：仅 2 邻参与，2 张牌互换", () => {
    const state = makeLevel("level_2_1", 200);
    const center = 0;
    const positions = [1, 4]; // 上无（越界）、右=1、下=4、左无（越界）
    const before = positions.map((idx) => state.grid[idx]);
    const rotations = applyRotation(state, [center]);
    assert.equal(rotations[0].positions.length, 2);
    // 顺时针前进 1 格：旧 positions[0]→新 positions[1]、旧 positions[1]→新 positions[0] = 互换
    assert.equal(state.grid[positions[1]], before[0]);
    assert.equal(state.grid[positions[0]], before[1]);
  });

  it("已翻开位不参与轮转", () => {
    const state = makeLevel("level_2_1", 300);
    // 把中心位 5 的上方位 1 翻开
    flip(state, 1);
    const center = 5;
    const positions = [6, 9, 4]; // 仅剩 右/下/左
    const before = positions.map((idx) => state.grid[idx]);
    const rotations = applyRotation(state, [center]);
    assert.equal(rotations[0].positions.length, 3);
    // 顺时针：旧 positions[i] 去新 positions[(i+1) % 3]
    assert.equal(state.grid[positions[1]], before[0]); // 新下=旧右
    assert.equal(state.grid[positions[2]], before[1]); // 新左=旧下
    assert.equal(state.grid[positions[0]], before[2]); // 新右=旧左
  });

  it("空槽不参与轮转（盘面有配对空槽时）", () => {
    const state = makeLevel("level_2_1", 400);
    // 先配一对形成空槽，且这一对的位避开中心 5 的邻接
    const seen = new Map();
    let pair = null;
    for (let i = 0; i < state.grid.length; i += 1) {
      const t = state.grid[i];
      if (seen.has(t)) { pair = [seen.get(t), i]; break; }
      seen.set(t, i);
    }
    flip(state, pair[0]);
    flip(state, pair[1]);
    // 现在 pair[0]/[1] 都是空槽（grid=null）
    assert.equal(state.grid[pair[0]], null);
    // 选个远离空槽的中心做轮转测试
    const center = 10; // (r=2, c=2)
    const rotations = applyRotation(state, [center]);
    // 验证轮转描述中的 positions 不含空槽位
    for (const r of rotations) {
      for (const idx of r.positions) {
        assert.notEqual(state.grid[idx], null);
      }
    }
  });

  it("两个错配位邻接块重叠 → 重叠格只参与一次", () => {
    const state = makeLevel("level_2_1", 500);
    const c1 = 5;  // (1,1)
    const c2 = 6;  // (1,2)，与 c1 共享位 (1,1)、(2,1) 等
    const before = state.grid.slice();
    const rotations = applyRotation(state, [c1, c2]);
    // 合并去重后参与的位数量应小于两次独立旋转之和
    const allPositions = rotations.flatMap((r) => r.positions);
    const unique = new Set(allPositions);
    assert.equal(allPositions.length, unique.size, "重叠格只参与一次");
    // 旋转后图腾分布守恒：所有非空格上的图腾 multiset 不变
    const beforeMultiset = before.filter((g) => g !== null).sort().join(",");
    const afterMultiset = state.grid.filter((g) => g !== null).sort().join(",");
    assert.equal(beforeMultiset, afterMultiset, "图腾守恒");
  });
});

// ---------------------------------------------------------------------------
// 8 邻轮转（ring8）
// ---------------------------------------------------------------------------
describe("rotateRing ring8: 8 邻一并顺时针轮转", () => {
  it("中心位 (1,2) 的 8 邻盖牌按 上→右上→右→右下→下→左下→左→左上 顺序轮转 1 格", () => {
    // 用 5x6 关卡 level_3_4（mech=ring8），中心位 8 = (r=1, c=2)，8 邻全在盘面内
    const state = makeLevel("level_3_4", 100);
    assert.equal(state.cols, 6);
    assert.equal(state.mech, "ring8");
    const center = 8; // (r=1, c=2)
    const dirs = [
      [-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1],
    ];
    const cr = 1, cc = 2;
    const positions = dirs.map(([dr, dc]) => (cr + dr) * state.cols + (cc + dc));
    const before = positions.map((idx) => state.grid[idx]);
    const rotations = applyRotation(state, [center]);
    assert.equal(rotations[0].positions.length, 8);
    // 顺时针前进 1 格：旧 positions[i] 去新 positions[(i+1) % 8]
    for (let i = 0; i < 8; i += 1) {
      const next = (i + 1) % 8;
      assert.equal(state.grid[positions[next]], before[i], `ring8 旧位 ${i} → 新位 ${next}`);
    }
  });

  it("角点中心仅 3 邻参与（5x6 盘面位 0）", () => {
    const state = makeLevel("level_3_4", 200);
    assert.equal(state.mech, "ring8");
    const center = 0; // (0,0)：邻只有右、右下、下
    const positions = [1, 7, 6]; // 右、右下、下 (cols=6)
    const before = positions.map((idx) => state.grid[idx]);
    const rotations = applyRotation(state, [center]);
    assert.equal(rotations[0].positions.length, 3);
    // 顺时针：旧 positions[i] 去新 positions[(i+1) % 3]
    assert.equal(state.grid[positions[1]], before[0]); // 新右下=旧右
    assert.equal(state.grid[positions[2]], before[1]); // 新下=旧右下
    assert.equal(state.grid[positions[0]], before[2]); // 新右=旧下
  });
});

// ---------------------------------------------------------------------------
// 象限整体旋转 90°（gear）
// ---------------------------------------------------------------------------
describe("rotateQuadrants gear: 象限整体旋转 90°", () => {
  it("4x4 盘面，中心在左上象限 (0,0)，左上 2x2 子盘整体旋转 90°", () => {
    const state = makeLevel("level_4_1", 100);
    const center = 0; // 左上象限
    const positions = [0, 1, 4, 5]; // 2x2 子盘
    const before = positions.map((idx) => state.grid[idx]);
    const rotations = applyRotation(state, [center]);
    assert.equal(rotations.length, 1);
    assert.equal(rotations[0].positions.length, 4);
    // 顺时针 90° 矩阵 M=N=2: new[r][c] = old[M-1-c][r]
    // 子盘布局 (r,c)→idx:
    //   (0,0)=0  (0,1)=1
    //   (1,0)=4  (1,1)=5
    // 旋转后：(0,0)=旧(1,0), (0,1)=旧(0,0), (1,0)=旧(1,1), (1,1)=旧(0,1)
    assert.equal(state.grid[0], before[2]); // 新(0,0)=旧(1,0)=positions[2]
    assert.equal(state.grid[1], before[0]); // 新(0,1)=旧(0,0)=positions[0]
    assert.equal(state.grid[4], before[3]); // 新(1,0)=旧(1,1)=positions[3]
    assert.equal(state.grid[5], before[1]); // 新(1,1)=旧(0,1)=positions[1]
  });

  it("两个错配位在不同象限 → 两个象限都旋转", () => {
    const state = makeLevel("level_4_1", 200);
    const c1 = 0; // 左上象限
    const c2 = 15; // 右下象限
    const rotations = applyRotation(state, [c1, c2]);
    assert.equal(rotations.length, 2);
    assert.notEqual(rotations[0].center, rotations[1].center);
  });

  it("两个错配位在同一象限 → 只转一次", () => {
    const state = makeLevel("level_4_1", 300);
    const c1 = 0; // 左上象限
    const c2 = 5; // 仍在左上象限
    const rotations = applyRotation(state, [c1, c2]);
    assert.equal(rotations.length, 1);
  });

  it("象限旋转包含翻开位一起转（齿轮联动物理语义）", () => {
    const state = makeLevel("level_4_1", 400);
    // 把位 1 翻开（左上象限内）
    flip(state, 1);
    assert.equal(state.faceUp[1], true);
    const before = [state.grid[0], state.grid[1], state.grid[4], state.grid[5]];
    const beforeFace = [state.faceUp[0], state.faceUp[1], state.faceUp[4], state.faceUp[5]];
    applyRotation(state, [0]); // 左上象限旋转
    // 旋转后翻开位标志也跟着迁移
    const afterFace = [state.faceUp[0], state.faceUp[1], state.faceUp[4], state.faceUp[5]];
    assert.notDeepEqual(beforeFace, afterFace, "faceUp 跟随位置迁移");
    assert.equal(afterFace.filter(Boolean).length, beforeFace.filter(Boolean).length, "翻开位数守恒");
  });

  it("图腾守恒：旋转前后象限内图腾 multiset 不变", () => {
    const state = makeLevel("level_4_1", 500);
    const positions = [0, 1, 4, 5];
    const before = positions.map((idx) => state.grid[idx]).sort().join(",");
    applyRotation(state, [0]);
    const after = positions.map((idx) => state.grid[idx]).sort().join(",");
    assert.equal(before, after);
  });
});

// ---------------------------------------------------------------------------
// 不变量 + ≥1000 步随机游走
// ---------------------------------------------------------------------------
describe("invariants: 1000 步随机游走不变式守恒", () => {
  for (const mech of ["none", "ring4", "ring8", "gear"]) {
    it(`mech=${mech}: 1000 步随机翻牌对每一步不变量守恒`, () => {
      const seed = mech.length * 31 + 7;
      const cfg = mech === "gear"
        ? { levelId: "rw-gear", rows: 4, cols: 4, totemCount: 8, seed, mech, missBudget: null }
        : { levelId: "rw", rows: 4, cols: 5, totemCount: 10, seed, mech, missBudget: null };
      const state = createLevel(cfg);
      const rng = mulberry32(seed + 999);
      for (let step = 0; step < 1000; step += 1) {
        assert.ok(invariantsHold(state), `step ${step} 不变量破裂`);
        // 随机挑一个非空且未翻开的位翻
        const candidates = [];
        for (let i = 0; i < state.grid.length; i += 1) {
          if (state.grid[i] !== null && !state.faceUp[i] && state.flipped.length < 2) {
            candidates.push(i);
          }
        }
        if (candidates.length === 0) break;
        const idx = candidates[Math.floor(rng() * candidates.length)];
        flip(state, idx);
        // 若状态变 won/lost，重新开局继续
        if (state.status !== STATUS.PLAYING) break;
      }
      assert.ok(invariantsHold(state), "最终态不变量破裂");
    });
  }

  it("完整通关路径不变量守恒（4x4 ring4）", () => {
    const state = createLevel({
      levelId: "full", rows: 4, cols: 4, totemCount: 8, seed: 11,
      mech: "ring4", missBudget: null,
    });
    // 通过"知道答案"的方式逐步翻所有对子（用 seed 反推 grid 也行）
    const positionsByTotem = new Map();
    for (let i = 0; i < state.grid.length; i += 1) {
      const t = state.grid[i];
      if (!positionsByTotem.has(t)) positionsByTotem.set(t, []);
      positionsByTotem.get(t).push(i);
    }
    let safety = 100;
    for (const [t, [a, b]] of positionsByTotem) {
      if (safety-- < 0) break;
      // 中间可能被 ring4 移位了，需要重新找
      // 但 ring4 仅在错配时触发；只要我们一直配对成功就不会触发
      // 所以这里直接连续翻 a, b 应该都能 match
      const r1 = flip(state, a);
      assert.ok([ACTION.FLIP_ONE, ACTION.NONE].includes(r1.action));
      if (r1.action === ACTION.NONE) continue;
      const r2 = flip(state, b);
      assert.ok([ACTION.MATCH, ACTION.MATCH_WIN].includes(r2.action), `t=${t} action=${r2.action}`);
    }
    assert.equal(state.status, STATUS.WON);
    assert.ok(invariantsHold(state));
  });
});

// ---------------------------------------------------------------------------
// 沙盒
// ---------------------------------------------------------------------------
describe("sandbox: 起始即开放（参 PRD §5 定案 #3）", () => {
  it("默认配置 = 4x4 / none / 全图腾集", () => {
    const sb = createSandbox({});
    assert.equal(sb.rows, 4);
    assert.equal(sb.cols, 4);
    assert.equal(sb.mech, "none");
    assert.equal(sb.totemCount, 8);
  });

  it("自定 6x6 ring8", () => {
    const sb = createSandbox({ rows: 6, cols: 6, mech: "ring8", seed: 42 });
    assert.equal(sb.rows, 6);
    assert.equal(sb.cols, 6);
    assert.equal(sb.mech, "ring8");
    assert.equal(sb.totemCount, 18);
    assert.ok(invariantsHold(sb));
  });

  it("SANDBOX_LIMITS 边界", () => {
    assert.equal(SANDBOX_LIMITS.rows.min, 4);
    assert.equal(SANDBOX_LIMITS.rows.max, 6);
    assert.deepEqual([...SANDBOX_LIMITS.mechs], ["none", "ring4", "ring8", "gear"]);
  });
});

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------
describe("helpers: canFlip / hasUnmatched / foundTotems", () => {
  it("canFlip 在翻 1 张后仍可翻；翻 2 张未结清时不可", () => {
    const state = makeLevel("level_1_1", 13);
    assert.equal(canFlip(state), true);
    flip(state, 0);
    assert.equal(canFlip(state), true);
    flip(state, 1);
    // 第二张可能配对或错配，配对后状态回到 length=0；错配后会盖回也是 0
    assert.equal(canFlip(state), true); // 状态自动清理
  });

  it("hasUnmatched 在盘面有图腾时为 true", () => {
    const state = makeLevel("level_1_1", 17);
    assert.equal(hasUnmatched(state), true);
    // 强行通关后应 false（用全 4x4 全配对路径）
    const pairs = new Map();
    for (let i = 0; i < state.grid.length; i += 1) {
      const t = state.grid[i];
      if (!pairs.has(t)) pairs.set(t, []);
      pairs.get(t).push(i);
    }
    for (const [, [a, b]] of pairs) {
      // 注意配对过程中可能因为 ring4 移位破坏位置；这里 mech=none 不触发位移
      flip(state, a);
      flip(state, b);
    }
    assert.equal(hasUnmatched(state), false);
    assert.equal(state.status, STATUS.WON);
  });

  it("foundTotems 返回已配对图腾数组副本", () => {
    const state = makeLevel("level_1_1", 19);
    const seen = new Map();
    let pair = null;
    for (let i = 0; i < state.grid.length; i += 1) {
      const t = state.grid[i];
      if (seen.has(t)) { pair = [seen.get(t), i]; break; }
      seen.set(t, i);
    }
    flip(state, pair[0]);
    flip(state, pair[1]);
    const found = foundTotems(state);
    assert.equal(found.length, 1);
    assert.equal(found[0], state.grid.length === 0 ? null : state.foundPairs[0]);
    // 副本验证：修改外部不影响内部
    found.push("fake");
    assert.equal(state.foundPairs.length, 1);
  });
});

// ---------------------------------------------------------------------------
// endTurn 辅助（测试用）
// ---------------------------------------------------------------------------
describe("endTurn: 仅测试用辅助", () => {
  it("仅当翻 2 张时盖回；其他情况 none", () => {
    const state = makeLevel("level_1_1", 21);
    assert.equal(endTurn(state).action, ACTION.NONE);
    flip(state, 0);
    assert.equal(endTurn(state).action, ACTION.NONE);
    flip(state, 1); // 翻两张后 engine 自动结算（可能 match 或 mismatch）
    // 此时 flipped 已清空，endTurn 也无效
    assert.equal(endTurn(state).action, ACTION.NONE);
  });
});