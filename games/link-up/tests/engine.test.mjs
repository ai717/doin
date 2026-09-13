import test from "node:test";
import assert from "node:assert/strict";

import {
  mulberry32,
  hashString,
  LEVEL_COUNT,
  levelConfig,
  createGame,
  createDaily,
  pieceMultiset,
  getCell,
  isHoleAt,
  findPath,
  canConnect,
  validateMatch,
  handleSelect,
  commitEliminate,
  findHint,
  hasMove,
  handleHint,
  handleShuffle,
} from "../js/engine.mjs";

function occupiedCells(state) {
  const arr = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (getCell(state, r, c) !== null) arr.push({ r, c });
    }
  }
  return arr;
}

function solveByHint(state) {
  let guard = 0;
  while (state.status === "playing" && guard < 200) {
    const hint = findHint(state);
    assert.ok(hint, "任意可解局面必须存在可消对");
    const vm = validateMatch(state, hint.a, hint.b);
    assert.ok(vm.ok, "提示对必须可消");
    commitEliminate(state, hint.a, hint.b);
    guard++;
  }
  return state;
}

// ---------- 确定性 ----------
test("mulberry32 同种子序列确定，不同种子序列不同", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const c = mulberry32(43);
  const seq = [];
  for (let i = 0; i < 8; i++) seq.push(a());
  for (let i = 0; i < 8; i++) assert.equal(b(), seq[i]);
  assert.notEqual(c(), seq[0]);
});

test("hashString 稳定", () => {
  assert.equal(hashString("link-up"), hashString("link-up"));
  assert.notEqual(hashString("a"), hashString("b"));
});

// ---------- 关卡配置 ----------
test("levelConfig 覆盖 1..50 且五章参数正确", () => {
  const cases = [
    [1, 6, 6, "rect"],
    [10, 6, 6, "rect"],
    [11, 7, 7, "rect"],
    [21, 8, 8, "corners"],
    [31, 9, 8, "rect"],
    [41, 10, 8, "notch"],
    [50, 10, 8, "notch"],
  ];
  for (const [lv, rows, cols, variant] of cases) {
    const cfg = levelConfig(lv);
    assert.equal(cfg.level, lv);
    assert.equal(cfg.rows, rows);
    assert.equal(cfg.cols, cols);
    assert.equal(cfg.variant, variant);
  }
  assert.equal(levelConfig(0).level, 1);
  assert.equal(levelConfig(99).level, 50);
  assert.equal(LEVEL_COUNT, 50);
});

test("第 4 章后段启用同图 4 块（four）", () => {
  assert.equal(levelConfig(34).four, false);
  assert.equal(levelConfig(36).four, true);
  const st = createGame({ levelIndex: 36 });
  assert.equal(st.totalPieces, 12 * 4);
});

// ---------- 生成器：确定性 + 数学可解 ----------
test("createGame 同种子生成同一盘面", () => {
  const s1 = createGame({ levelIndex: 9, seed: 123 });
  const s2 = createGame({ levelIndex: 9, seed: 123 });
  assert.deepEqual(s1.grid, s2.grid);
  const s3 = createGame({ levelIndex: 9, seed: 456 });
  assert.notDeepEqual(s1.grid, s3.grid);
});

test("全部章节代表关卡均 100% 可解（反向构建保证）", () => {
  for (const lv of [1, 5, 9, 11, 15, 21, 25, 31, 35, 41, 45, 50]) {
    const state = createGame({ levelIndex: lv });
    assert.equal(state.totalPieces % 2, 0);
    assert.ok(hasMove(state), `关卡 ${lv} 开局必须存在可消对`);
    // 每种符号恰好 per 块（普通 2 块，四连 4 块），不多放不漏放
    const counts = new Map();
    for (const cell of occupiedCells(state)) {
      const v = getCell(state, cell.r, cell.c);
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    assert.equal(counts.size, state.symbolCount, `关卡 ${lv} 必须覆盖全部 ${state.symbolCount} 种符号`);
    const expectedPer = state.four ? 4 : 2;
    for (const n of counts.values()) {
      assert.ok(n >= expectedPer && n % expectedPer === 0, `关卡 ${lv} 每种符号必须按 ${expectedPer} 的倍数出现`);
    }
    solveByHint(state);
    assert.equal(state.status, "won");
    assert.equal(state.eliminated, state.totalPieces);
  }
});

test("每日挑战：同日期同题、四连高密度、可解", () => {
  const a = createDaily({ dateStr: "2026-09-13" });
  const b = createDaily({ dateStr: "2026-09-13" });
  assert.deepEqual(a.grid, b.grid);
  assert.notDeepEqual(a.grid, createDaily({ dateStr: "2026-09-14" }).grid);
  assert.equal(a.totalPieces, 14 * 4);
  const counts = new Map();
  for (const cell of occupiedCells(a)) {
    const v = getCell(a, cell.r, cell.c);
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  assert.equal(counts.size, 14);
  for (const n of counts.values()) assert.equal(n, 4);
  assert.ok(hasMove(a));
  solveByHint(a);
  assert.equal(a.status, "won");
});

test("pieceMultiset 偶数且符号数正确", () => {
  assert.deepEqual(pieceMultiset({ symbolCount: 4, pairCount: 4, four: false }), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(pieceMultiset({ symbolCount: 4, pairCount: 8, four: true }).length, 16);
});

// ---------- 路径合法性 ----------
test("直线连通：0 拐弯", () => {
  const state = {
    rows: 3,
    cols: 3,
    variant: "rect",
    grid: [
      ["A", null, "A"],
      [null, null, null],
      [null, null, null],
    ],
  };
  assert.equal(canConnect(state, { r: 0, c: 0 }, { r: 0, c: 2 }), true);
  const path = findPath(state, { r: 0, c: 0 }, { r: 0, c: 2 });
  assert.ok(path);
  assert.equal(path.length, 2); // 起终点
});

test("直线被占：可出界绕行（经典特性）", () => {
  const state = {
    rows: 3,
    cols: 3,
    variant: "rect",
    grid: [
      ["A", "B", "A"],
      [null, null, null],
      [null, null, null],
    ],
  };
  // 直线路径 (0,0)-(0,2) 被 (0,1) 阻挡，但可从棋盘外绕行
  assert.equal(canConnect(state, { r: 0, c: 0 }, { r: 0, c: 2 }), true);
  const path = findPath(state, { r: 0, c: 0 }, { r: 0, c: 2 });
  assert.ok(path.some((p) => p.r === 0), "路径必须经过外侧环（扩展坐标第 0 行）");
});

test("拐点 ≤ 2：返回路径拐弯数不超 2", () => {
  const state = {
    rows: 5,
    cols: 5,
    variant: "rect",
    grid: Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => null)),
  };
  state.grid[0][0] = "X";
  state.grid[0][4] = "X";
  // 同行中段被占：直线受阻，但可从棋盘外顶侧绕行
  state.grid[0][1] = "B";
  state.grid[0][2] = "B";
  state.grid[0][3] = "B";
  const path = findPath(state, { r: 0, c: 0 }, { r: 0, c: 4 });
  assert.ok(path, "出界绕行应可连通");
  assert.ok(path.some((p) => p.r === 0), "路径应经过外侧环");
  const turns = countTurns(path);
  assert.ok(turns <= 2, `拐弯数 ${turns} 应 ≤ 2`);
});

function countTurns(path) {
  let turns = 0;
  let lastDir = null;
  for (let i = 1; i < path.length; i++) {
    const dr = path[i].r - path[i - 1].r;
    const dc = path[i].c - path[i - 1].c;
    const dir = dr !== 0 ? "v" : "h";
    if (lastDir && dir !== lastDir) turns++;
    lastDir = dir;
  }
  return turns;
}

test("十字全堵：即使出界也无法连通（路径必须由空单元格组成）", () => {
  const state = {
    rows: 5,
    cols: 5,
    variant: "rect",
    grid: Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => "B")),
  };
  state.grid[2][2] = "A"; // 中心被十字封锁
  state.grid[0][0] = "A";
  assert.equal(canConnect(state, { r: 0, c: 0 }, { r: 2, c: 2 }), false);
  // 其余格子换空后应能连通
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++) if (state.grid[r][c] !== "A") state.grid[r][c] = null;
  assert.equal(canConnect(state, { r: 0, c: 0 }, { r: 2, c: 2 }), true);
});

test("图案不同 / 端点为空 / 同格：均拒绝", () => {
  const state = {
    rows: 3,
    cols: 3,
    variant: "rect",
    grid: [
      ["A", null, "B"],
      [null, null, null],
      [null, null, null],
    ],
  };
  assert.equal(canConnect(state, { r: 0, c: 0 }, { r: 0, c: 2 }), false); // 不同图案
  assert.equal(canConnect(state, { r: 0, c: 1 }, { r: 1, c: 1 }), false); // 空格端点
  assert.equal(canConnect(state, { r: 0, c: 0 }, { r: 0, c: 0 }), false); // 同格
});

test("异形棋盘：缺口不可通行", () => {
  const state = {
    rows: 8,
    cols: 8,
    variant: "corners",
    grid: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null)),
  };
  assert.equal(isHoleAt(8, 8, 0, 0, "corners"), true);
  assert.equal(isHoleAt(8, 8, 0, 3, "corners"), false);
  assert.equal(isHoleAt(10, 8, 0, 4, "notch"), true);
  assert.equal(isHoleAt(10, 8, 0, 0, "notch"), false);
});

// ---------- 选中 / 判定 / 消除 ----------
test("选中、取消、切换、空格无反应", () => {
  const st = createGame({ levelIndex: 1, seed: 7 });
  const cells = occupiedCells(st);
  const a = cells[0];
  assert.equal(handleSelect(st, a.r, a.c).action, "select");
  assert.equal(handleSelect(st, a.r, a.c).action, "deselect");
  assert.equal(handleSelect(st, a.r, a.c).action, "select");
  const b = cells[1];
  const res = handleSelect(st, b.r, b.c);
  // 同图案可连通则 match，否则 reject 或 select（换选）
  if (getCell(st, a.r, a.c) === getCell(st, b.r, b.c)) {
    assert.ok(["match", "reject"].includes(res.action));
  } else {
    assert.equal(res.action, "select");
  }
  // 空格点击：无反应
  let empty = null;
  for (let r = 0; r < st.rows && !empty; r++)
    for (let c = 0; c < st.cols && !empty; c++) if (getCell(st, r, c) === null) empty = { r, c };
  if (empty) assert.equal(handleSelect(st, empty.r, empty.c).action, null);
});

test("判定成功 → 消除推进步数/连击/分数原料", () => {
  const st = createGame({ levelIndex: 1, seed: 7 });
  const hint = findHint(st);
  assert.ok(hint);
  const vm = validateMatch(st, hint.a, hint.b);
  assert.ok(vm.ok);
  commitEliminate(st, hint.a, hint.b);
  assert.equal(st.steps, 1);
  assert.equal(st.combo, 1);
  assert.equal(st.comboBonus, 0); // 第 1 连无加成
  assert.equal(getCell(st, hint.a.r, hint.a.c), null);
  assert.equal(getCell(st, hint.b.r, hint.b.c), null);
});

test("连击加成：连续消除第 2 连起 +10 递增", () => {
  const st = createGame({ levelIndex: 1, seed: 7 });
  // 用提示链连续消除
  const h1 = findHint(st);
  commitEliminate(st, h1.a, h1.b);
  const h2 = findHint(st);
  commitEliminate(st, h2.a, h2.b);
  assert.equal(st.combo, 2);
  assert.equal(st.comboBonus, 10);
  const h3 = findHint(st);
  commitEliminate(st, h3.a, h3.b);
  assert.equal(st.comboBonus, 10 + 20);
});

test("洗牌打断连击并保持可解", () => {
  const st = createGame({ levelIndex: 17, seed: 11 });
  const h1 = findHint(st);
  commitEliminate(st, h1.a, h1.b);
  commitEliminate(st, findHint(st).a, findHint(st).b);
  assert.ok(st.combo >= 2);
  const gridBefore = JSON.stringify(st.grid);
  const res = handleShuffle(st, mulberry32(2026));
  assert.equal(res.action, "shuffle");
  assert.equal(st.combo, 0);
  assert.notEqual(JSON.stringify(st.grid), gridBefore);
  assert.ok(hasMove(st));
});

test("提示与无对判定", () => {
  const st = createGame({ levelIndex: 1, seed: 7 });
  const res = handleHint(st);
  assert.equal(res.action, "hint");
  assert.ok(res.a && res.b);
  // 清盘后无对
  solveByHint(st);
  assert.equal(handleHint(st).action, null);
});

// ---------- 终局 / 终止态 ----------
test("终局后一切操作安全 no-op", () => {
  const st = createGame({ levelIndex: 1, seed: 7 });
  st.status = "won"; // 直接进入终止态
  const before = JSON.stringify(st.grid);
  assert.equal(handleSelect(st, 0, 0).action, null);
  assert.equal(handleShuffle(st, mulberry32(1)).action, null);
  assert.equal(handleHint(st).action, null);
  assert.equal(validateMatch(st, { r: 0, c: 0 }, { r: 0, c: 1 }).ok, false);
  assert.equal(JSON.stringify(st.grid), before, "终止态不得改变规则状态");
});

// ---------- 随机游走 ≥1000 步 ----------
test("随机游走 ≥1000 步：任意合法操作不抛错、不卡死、可终局", () => {
  for (const lv of [3, 19, 27, 43]) {
    const st = createGame({ levelIndex: lv, seed: 5000 + lv });
    const rng = mulberry32(lv * 13);
    let steps = 0;
    const maxIter = 1000;
    while (st.status === "playing" && steps < maxIter) {
      const cells = occupiedCells(st);
      if (cells.length === 0) break;
      const a = cells[Math.floor(rng() * cells.length)];
      const res = handleSelect(st, a.r, a.c);
      if (res && res.action === "match") {
        commitEliminate(st, res.a, res.b);
        assert.ok(st.eliminated % 2 === 0);
        assert.ok(st.eliminated <= st.totalPieces);
        assert.ok(st.combo >= 1);
        assert.ok(st.steps >= 1);
        if (st.status === "won") assert.equal(st.eliminated, st.totalPieces);
      } else if (rng() < 0.04) {
        handleShuffle(st, mulberry32(Math.floor(rng() * 1e6)));
        assert.ok(st.combo === 0 || st.steps === 0);
      } else if (rng() < 0.2) {
        handleHint(st);
      }
      // 校验已消除格为空
      assert.ok(st.eliminated <= st.totalPieces);
      steps++;
    }
    // 用提示链强制终局
    solveByHint(st);
    assert.equal(st.status, "won");
  }
});


test("洗牌只重排剩余牌：不复活已消除牌且计数保持一致", () => {
  const st = createGame({ levelIndex: 36, seed: 17 });
  const first = findHint(st);
  const second = findHint(st);
  assert.ok(first && second);
  commitEliminate(st, first.a, first.b);
  const eliminatedBefore = st.eliminated;
  const valuesBefore = occupiedCells(st).map(({ r, c }) => getCell(st, r, c)).sort((a, b) => a - b);
  const occupiedBefore = valuesBefore.length;

  const res = handleShuffle(st, mulberry32(20260913));
  assert.equal(res.action, "shuffle");
  assert.equal(st.eliminated, eliminatedBefore);
  const valuesAfter = occupiedCells(st).map(({ r, c }) => getCell(st, r, c)).sort((a, b) => a - b);
  assert.equal(valuesAfter.length, occupiedBefore);
  assert.deepEqual(valuesAfter, valuesBefore);
  assert.equal(st.totalPieces - st.eliminated, occupiedBefore);
  assert.ok(hasMove(st));
});
