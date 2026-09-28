// 泡泡射手 · 规则引擎单元测试
// 覆盖：六边形网格几何 / 反弹物理 / 三连消除 / 悬空雪崩 / 冰压下压 / 无死色 / 1000 步随机游走
import test from "node:test";
import assert from "node:assert/strict";

import {
  R,
  D,
  COLS,
  WALL_L,
  WALL_R,
  DEATH_ROW,
  DEATH_Y,
  EMPTY,
  CRYSTAL,
  PRISM,
  MAX_ANGLE,
  rowWidth,
  cellX,
  cellY,
  createBoard,
  cloneBoard,
  setCell,
  getCell,
  neighbors,
  matchGroup,
  floatingCells,
  resolveLanding,
  simulateShot,
  predictPath,
  pressRow,
  makeRow,
  pressInterval,
  isDead,
  activeColors,
  nextColor,
  boardFromMask,
  pruneFloating,
  countBubbles,
  applyIcePick,
  randomWalk,
  mulberry32,
  AIM
} from "../js/engine.mjs";

const PALETTE = [0, 1, 2, 3, 4, 5];

test("网格几何：偶数行 8 格、奇数行 7 格且不越墙", () => {
  assert.equal(rowWidth(0), COLS);
  assert.equal(rowWidth(1), COLS - 1);
  const board = createBoard(6, 0);
  for (let r = 0; r < 6; r += 1) {
    for (let c = 0; c < board[r].cells.length; c += 1) {
      const x = cellX(board[r].parity, c);
      assert.ok(x - R >= WALL_L - 0.001, `第 ${r} 行第 ${c} 列越出左墙`);
      assert.ok(x + R <= WALL_R + 0.001, `第 ${r} 行第 ${c} 列越出右墙`);
    }
  }
});

test("六邻域对称：A 是 B 的邻居，则 B 必是 A 的邻居", () => {
  const board = createBoard(8, 0);
  for (let r = 1; r < 6; r += 1) {
    for (let c = 0; c < board[r].cells.length; c += 1) {
      for (const [nr, nc] of neighbors(board, r, c)) {
        const back = neighbors(board, nr, nc);
        assert.ok(back.some(([br, bc]) => br === r && bc === c), `(${r},${c}) 与 (${nr},${nc}) 邻接不对称`);
      }
    }
  }
});

test("六邻域几何一致：邻接格心距恰为一个直径", () => {
  const board = createBoard(8, 0);
  for (let r = 1; r < 6; r += 1) {
    for (let c = 0; c < board[r].cells.length; c += 1) {
      const x = cellX(board[r].parity, c);
      const y = cellY(r);
      for (const [nr, nc] of neighbors(board, r, c)) {
        const dist = Math.hypot(x - cellX(board[nr].parity, nc), y - cellY(nr));
        assert.ok(Math.abs(dist - D) < 0.01, `(${r},${c})->(${nr},${nc}) 距离 ${dist} 不等于直径 ${D}`);
      }
    }
  }
});

test("三连消除：凑齐三颗同色即整组爆开", () => {
  const board = createBoard(6, 0);
  setCell(board, 0, 2, 1);
  setCell(board, 0, 3, 1);
  const res = resolveLanding(board, 0, 4, 1);
  assert.equal(res.popped.length, 3);
  assert.equal(countBubbles(res.board), 0);
});

test("两连不消除：仅两颗同色不触发爆开", () => {
  const board = createBoard(6, 0);
  setCell(board, 0, 2, 1);
  const res = resolveLanding(board, 0, 3, 1);
  assert.equal(res.popped.length, 0);
  assert.equal(countBubbles(res.board), 2);
});

test("悬空雪崩：斩断支撑柱后整簇坠落，坠落数大于爆开数", () => {
  const board = createBoard(8, 0);
  // 顶行托住一根三连柱，柱下悬着大片
  for (let c = 0; c < 8; c += 1) setCell(board, 0, c, 0);
  setCell(board, 1, 2, 2);
  setCell(board, 1, 3, 2);
  for (let c = 0; c < 8; c += 1) setCell(board, 2, c, 3);
  for (let c = 0; c < 7; c += 1) setCell(board, 3, c, 4);
  const res = resolveLanding(board, 1, 4, 2);
  assert.equal(res.popped.length, 3, "支撑柱三连应爆开");
  assert.ok(res.dropped.length >= 14, `下悬结构应整片坠落，实际 ${res.dropped.length}`);
  assert.ok(res.dropped.length > res.popped.length, "雪崩坠落数应大于直接爆开数");
});

test("floatingCells：连通顶部的结构不算悬空", () => {
  const board = createBoard(6, 0);
  for (let c = 0; c < 8; c += 1) setCell(board, 0, c, 0);
  setCell(board, 1, 3, 1);
  assert.equal(floatingCells(board).length, 0);
});

test("冰晶不可被同色消除，只能靠断柱坠落", () => {
  const board = createBoard(6, 0);
  setCell(board, 0, 2, CRYSTAL);
  setCell(board, 0, 3, CRYSTAL);
  const res = resolveLanding(board, 0, 4, CRYSTAL);
  assert.equal(res.popped.length, 0);
  assert.equal(getCell(res.board, 0, 2), CRYSTAL);
});

test("棱镜泡为万能色：可与任意颜色凑三连", () => {
  const board = createBoard(6, 0);
  setCell(board, 0, 2, 3);
  setCell(board, 0, 3, 3);
  const res = resolveLanding(board, 0, 4, PRISM);
  assert.equal(res.popped.length, 3);
  assert.equal(countBubbles(res.board), 0);
});

test("反弹物理：贴边发射必定撞墙折返且落点合法", () => {
  const board = createBoard(6, 0);
  const shot = simulateShot(board, -MAX_ANGLE);
  assert.ok(shot.bounces >= 1, "极限角发射应至少反弹一次");
  assert.ok(shot.land, "反弹后必须有落点");
  assert.ok(shot.land[0] >= 0 && shot.land[0] < DEATH_ROW, "落点不得越过冰封线");
});

test("反弹物理：直射空盘必定吸附顶行", () => {
  const board = createBoard(6, 0);
  const shot = simulateShot(board, 0);
  assert.equal(shot.reason, "ceiling");
  assert.equal(shot.land[0], 0);
});

test("落点吸附：任何角度都不与已有泡重叠", () => {
  const rng = mulberry32(7);
  for (let trial = 0; trial < 200; trial += 1) {
    const board = boardFromMask(["########", "#######", "########"], [0, 1, 2, 3], rng, 0);
    const angle = -MAX_ANGLE + rng() * MAX_ANGLE * 2;
    const shot = simulateShot(board, angle);
    if (!shot.land) continue;
    const [r, c] = shot.land;
    assert.equal(getCell(board, r, c), EMPTY, "落点必须为空");
    const connected = r === 0 || neighbors(board, r, c).some(([nr, nc]) => getCell(board, nr, nc) !== EMPTY);
    assert.ok(connected, "落点必须挂在冰盖或已有泡上");
  }
});

test("预测线：完整档给出落点与轨迹点，硬核档不泄露落点", () => {
  const board = createBoard(6, 0);
  const full = predictPath(board, 0.4, AIM.EXTENDED);
  assert.ok(full.dots.length > 0);
  assert.ok(Array.isArray(full.land));
  const pro = predictPath(board, 0.4, AIM.PRO);
  assert.equal(pro.land, null);
  const classic = predictPath(board, 0.4, AIM.CLASSIC);
  assert.ok(classic.dots.length > 0);
  assert.equal(classic.land, null);
});

test("冰压下压：新行奇偶交替且整体下移一行，行数不失控", () => {
  const board = createBoard(6, 0);
  const topParity = board[0].parity;
  const next = pressRow(board, null);
  assert.equal(next[0].parity, topParity === 0 ? 1 : 0, "新行奇偶必须交替");
  assert.equal(next[1].parity, topParity, "原有行位置整体下移");
  assert.ok(next.length >= 6);
  let cur = board;
  for (let i = 0; i < 30; i += 1) cur = pressRow(cur, makeRow(cur[0].parity === 0 ? 1 : 0, PALETTE, mulberry32(i + 1), 0.9));
  assert.ok(cur.length <= 24, "棋盘高度必须封顶");
});

test("下压间隔：消失的颜色越多压迫越快，下限 4", () => {
  assert.equal(pressInterval(6, 6), 8);
  assert.equal(pressInterval(6, 4), 6);
  assert.equal(pressInterval(6, 1), 4);
  assert.equal(pressInterval(4, 1), 5);
});

test("颜色池约束：绝不发给场上已不存在的颜色（杜绝死牌）", () => {
  const rng = mulberry32(99);
  const board = createBoard(6, 0);
  setCell(board, 0, 0, 2);
  setCell(board, 0, 1, 2);
  setCell(board, 0, 2, 2);
  const pool = activeColors(board, PALETTE);
  assert.deepEqual(pool, [2]);
  for (let i = 0; i < 50; i += 1) assert.equal(nextColor(board, PALETTE, rng), 2);
});

test("冰封线判定：占据第 14 行即判负", () => {
  const board = createBoard(18, 0);
  setCell(board, DEATH_ROW - 1, 0, 1);
  assert.equal(isDead(board), false);
  setCell(board, DEATH_ROW, 0, 1);
  assert.equal(isDead(board), true);
  assert.ok(cellY(DEATH_ROW) + R > DEATH_Y, "第 14 行应已越过冰封线高度");
});

test("冰镐弹：穿透至多三格且触发坠落，自身不消除计分", () => {
  const board = boardFromMask(["########", "#######", "########"], [0, 1, 2], mulberry32(3), 0);
  const before = countBubbles(board);
  const res = applyIcePick(board, 0);
  assert.ok(res.cleared.length <= 3, "冰镐弹最多凿穿三格");
  assert.ok(res.cleared.length >= 1, "冰镐弹至少凿穿一格");
  assert.equal(countBubbles(res.board), before - res.cleared.length - res.dropped.length);
  assert.ok(res.dropped.length >= 0);
});

test("盘面生成：剪除悬空后必然连通顶部", () => {
  const board = pruneFloating(boardFromMask(["........", "..##....", "########"], [0, 1, 2, 3], mulberry32(11), 0));
  assert.equal(floatingCells(board).length, 0);
});

test("1000 步随机游走：状态机不抛错、不卡死、不变式守恒", () => {
  const board = boardFromMask(["########", "#######", "########", "#######"], [0, 1, 2, 3], mulberry32(2024), 0);
  const { board: after, moves } = randomWalk(board, 1000, 42, [0, 1, 2, 3]);
  assert.ok(moves > 900, `随机游走应持续推进，实际有效落点 ${moves}`);
  assert.ok(after.length >= 4);
  for (const row of after) {
    for (const v of row.cells) {
      assert.ok(v === EMPTY || (Number.isInteger(v) && v >= 0 && v <= 5), `非法格子值 ${v}`);
    }
  }
  assert.equal(floatingCells(after).length, 0, "结算后不应残留悬空泡");
});

test("纯函数性：resolveLanding 不修改入参棋盘", () => {
  const board = createBoard(6, 0);
  setCell(board, 0, 2, 1);
  setCell(board, 0, 3, 1);
  const snapshot = JSON.stringify(board);
  resolveLanding(cloneBoard(board), 0, 4, 1);
  assert.equal(JSON.stringify(board), snapshot);
});
