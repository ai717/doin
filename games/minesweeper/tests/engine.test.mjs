import test from "node:test";
import assert from "node:assert/strict";
import {
  FLAGGED,
  HIDDEN,
  MINE_ADJACENCY,
  REVEALED,
  STATUS_LOST,
  STATUS_PLAYING,
  STATUS_READY,
  STATUS_WON,
  applyIntent,
  cellCount,
  chord,
  createState,
  hiddenCount,
  isMine,
  isValidIndex,
  mulberry32,
  neighborTable,
  normalizeConfig,
  placeMines,
  remainingMines,
  reveal,
  safeZone,
  toggleFlag,
} from "../js/engine.mjs";

function idx(state, row, col) {
  return row * state.cols + col;
}

function countMines(state) {
  return state.mineField.reduce((sum, v) => sum + v, 0);
}

test("normalizeConfig: 默认 9x9，雷数按 15% 取整并被上限夹住", () => {
  assert.deepEqual(normalizeConfig(), { rows: 9, cols: 9, mines: 12 });
  assert.deepEqual(normalizeConfig({ rows: 16, cols: 16, mines: 40 }), {
    rows: 16,
    cols: 16,
    mines: 40,
  });
  // 上限 = cells - 9，保证首击 3x3 安全区永远放得下
  assert.equal(normalizeConfig({ rows: 9, cols: 9, mines: 999 }).mines, 72);
  assert.equal(normalizeConfig({ rows: 1, cols: 1, mines: 5 }).rows, 5);
});

test("neighborTable: 角 3 / 边 5 / 中心 8，且双向对称", () => {
  const table = neighborTable(9, 9);
  assert.equal(table[0].length, 3);
  assert.equal(table[4].length, 5);
  assert.equal(table[40].length, 8);
  for (let i = 0; i < 81; i += 1) {
    for (const n of table[i]) assert.ok(table[n].includes(i));
  }
  assert.equal(neighborTable(9, 9), neighborTable(9, 9));
});

test("createState: 空盘、未布雷、ready，safeZone 恒为 9 格", () => {
  const state = createState({ rows: 9, cols: 9, mines: 10, seed: 1 });
  assert.equal(state.status, STATUS_READY);
  assert.equal(state.seeded, false);
  assert.equal(state.revealedCount, 0);
  assert.equal(state.flagCount, 0);
  assert.equal(state.explodedIndex, -1);
  assert.ok(state.cellState.every((v) => v === HIDDEN));
  assert.ok(state.mineField.every((v) => v === 0));
  assert.equal(safeZone(state, idx(state, 4, 4)).length, 9);
  // 角落的安全区只有 4 格
  assert.equal(safeZone(state, 0).length, 4);
});

test("placeMines: 雷数准确、安全区零雷、首击格 adjacency 为 0、雷格标记为 -1", () => {
  for (let seed = 0; seed < 60; seed += 1) {
    const state = placeMines(
      createState({ rows: 9, cols: 9, mines: 10, seed }),
      40
    );
    assert.equal(countMines(state), 10);
    assert.equal(state.status, STATUS_PLAYING);
    assert.equal(state.seeded, true);
    assert.equal(state.firstIndex, 40);
    assert.equal(state.adjacency[40], 0, "首击格必须能展开一片");
    for (const i of safeZone(state, 40)) assert.equal(state.mineField[i], 0);
    for (let i = 0; i < 81; i += 1) {
      assert.equal(state.adjacency[i] === MINE_ADJACENCY, state.mineField[i] === 1);
    }
  }
});

test("placeMines: 同一 seed 必得同一棋盘，不同 seed 通常不同", () => {
  const a = placeMines(createState({ rows: 9, cols: 9, mines: 10, seed: 42 }), 40);
  const b = placeMines(createState({ rows: 9, cols: 9, mines: 10, seed: 42 }), 40);
  const c = placeMines(createState({ rows: 9, cols: 9, mines: 10, seed: 43 }), 40);
  assert.deepEqual(a.mineField, b.mineField);
  assert.notDeepEqual(a.mineField, c.mineField);
});

test("placeMines: 高雷密度下安全区外的候选仍足够，雷数不被削减", () => {
  const state = placeMines(createState({ rows: 9, cols: 9, mines: 72, seed: 7 }), 40);
  assert.equal(countMines(state), 72);
  assert.equal(state.mines, 72);
});

test("reveal: 首击永不踩雷，且至少展开 9 格", () => {
  for (let seed = 0; seed < 80; seed += 1) {
    const start = createState({ rows: 9, cols: 9, mines: 10, seed });
    const next = reveal(start, 40);
    assert.notEqual(next.status, STATUS_LOST);
    assert.ok(next.lastRevealed.length >= 9, "首击必须展开一片");
    assert.equal(next.revealedCount, next.lastRevealed.length);
    assert.equal(next.stats.reveals, 1);
  }
});

test("reveal: 任意落点首击都安全（含四角与边缘）", () => {
  for (let seed = 0; seed < 20; seed += 1) {
    for (const index of [0, 8, 72, 80, 4, 36]) {
      const next = reveal(createState({ rows: 9, cols: 9, mines: 10, seed }), index);
      assert.notEqual(next.status, STATUS_LOST);
      assert.equal(next.adjacency[index], 0);
    }
  }
});

test("reveal: flood 只在 0 格扩散，0 格的非雷邻居必须全部揭开", () => {
  const state = placeMines(createState({ rows: 9, cols: 9, mines: 10, seed: 3 }), 40);
  const next = reveal(state, 40);
  const table = neighborTable(9, 9);
  for (const i of next.lastRevealed) {
    assert.notEqual(next.mineField[i], 1, "flood 永不自动揭开雷");
    assert.equal(next.cellState[i], REVEALED);
    if (next.adjacency[i] !== 0) continue;
    for (const n of table[i]) {
      if (next.mineField[n] === 1) continue;
      assert.equal(next.cellState[n], REVEALED, "0 格的非雷邻居必须被带出");
    }
  }
  const bordering = next.lastRevealed.filter((i) => next.adjacency[i] > 0);
  assert.ok(bordering.length > 0, "展开区边缘必须出现数字格");
  for (const i of bordering) {
    const fromZero = table[i].some(
      (n) => next.cellState[n] === REVEALED && next.adjacency[n] === 0
    );
    assert.ok(fromZero, "数字格必须由某个 0 格展开带出");
  }
});

test("reveal: 揭开数字格只揭开它自己，重复点击无效果", () => {
  const seeded = placeMines(createState({ rows: 9, cols: 9, mines: 10, seed: 11 }), 40);
  const opened = reveal(seeded, 40);
  const numberCell = opened.cellState.findIndex(
    (v, i) => v === HIDDEN && opened.adjacency[i] > 0 && opened.mineField[i] === 0
  );
  assert.ok(numberCell >= 0, "展开区边缘应存在隐藏的数字格");
  const after = reveal(opened, numberCell);
  assert.deepEqual(after.lastRevealed, [numberCell]);
  assert.equal(after.revealedCount, opened.revealedCount + 1);
  assert.equal(reveal(after, numberCell), after, "已揭开的格子再次 reveal 应无效果");
});

test("reveal: 踩雷进入 lost，之后任何操作都无效", () => {
  const seeded = placeMines(createState({ rows: 9, cols: 9, mines: 10, seed: 5 }), 40);
  const opened = reveal(seeded, 40);
  const mineIndex = opened.mineField.findIndex((v, i) => v === 1 && opened.cellState[i] === HIDDEN);
  const lost = reveal(opened, mineIndex);
  assert.equal(lost.status, STATUS_LOST);
  assert.equal(lost.explodedIndex, mineIndex);
  assert.equal(reveal(lost, 0), lost);
  assert.equal(toggleFlag(lost, 0), lost);
  assert.equal(chord(lost, 40), lost);
});

test("toggleFlag: 隐藏↔旗子切换、计数同步、已揭开格不可标", () => {
  const opened = reveal(createState({ rows: 9, cols: 9, mines: 10, seed: 5 }), 40);
  const target = opened.mineField.findIndex((v, i) => v === 1 && opened.cellState[i] === HIDDEN);
  const flagged = toggleFlag(opened, target);
  assert.equal(flagged.cellState[target], FLAGGED);
  assert.equal(flagged.flagCount, 1);
  assert.equal(flagged.stats.flagsPlaced, 1);
  assert.equal(remainingMines(flagged), 9);
  const unflagged = toggleFlag(flagged, target);
  assert.equal(unflagged.cellState[target], HIDDEN);
  assert.equal(unflagged.flagCount, 0);
  assert.equal(toggleFlag(flagged, 40), flagged, "已揭开格不能标旗");
  assert.equal(toggleFlag(flagged, -1), flagged);
  assert.equal(toggleFlag(flagged, 81), flagged);
});

test("reveal: 标旗格受保护，不会误触踩雷", () => {
  const opened = reveal(createState({ rows: 9, cols: 9, mines: 10, seed: 5 }), 40);
  const mineIndex = opened.mineField.findIndex((v, i) => v === 1 && opened.cellState[i] === HIDDEN);
  const flagged = toggleFlag(opened, mineIndex);
  assert.equal(reveal(flagged, mineIndex), flagged);
});

// 找一个已揭开数字格：其隐藏邻居里"真雷数 == 数字"且至少还有一个隐藏安全格。
// 边界数字格大多邻居已揭开，所以必须按这个条件挑，不能随便取第一个。
function findChordFixture() {
  for (let seed = 0; seed < 80; seed += 1) {
    const state = reveal(createState({ rows: 9, cols: 9, mines: 10, seed }), 40);
    const table = neighborTable(state.rows, state.cols);
    for (const pivot of state.lastRevealed) {
      if (state.adjacency[pivot] <= 0) continue;
      const hidden = table[pivot].filter((n) => state.cellState[n] === HIDDEN);
      const mines = hidden.filter((n) => state.mineField[n] === 1);
      const safe = hidden.filter((n) => state.mineField[n] === 0);
      if (mines.length === state.adjacency[pivot] && safe.length > 0) {
        return { state, pivot, mines, safe };
      }
    }
  }
  return null;
}

test("chord: 旗数吻合才展开，不吻合时无效果而非报错", () => {
  const fx = findChordFixture();
  assert.ok(fx, "应能找到可用于 chord 的局面");

  // 旗数 0 ≠ 数字：不展开，也不报错
  assert.equal(chord(fx.state, fx.pivot), fx.state);

  let state = fx.state;
  for (const mine of fx.mines) state = toggleFlag(state, mine);
  assert.equal(remainingMines(state), 10 - fx.mines.length);

  // 少标一个旗：仍然不展开，不报错
  const partial = toggleFlag(state, fx.mines[0]);
  assert.equal(chord(partial, fx.pivot), partial);

  // 旗数吻合：展开全部隐藏安全邻居
  const after = chord(state, fx.pivot);
  assert.notEqual(after, state);
  for (const cell of fx.safe) assert.equal(after.cellState[cell], REVEALED);
  for (const mine of fx.mines) {
    assert.equal(after.cellState[mine], FLAGGED, "已标旗的雷不会被 chord 揭开");
  }
  assert.equal(after.stats.chords, 1);
});

test("chord: 旗标错就炸，且炸在没标出来的那个雷", () => {
  const fx = findChordFixture();
  assert.ok(fx);
  // 旗数凑够，但把一个安全格当雷标、漏掉 fx.mines[0]
  let state = toggleFlag(fx.state, fx.safe[0]);
  for (const mine of fx.mines.slice(1)) state = toggleFlag(state, mine);
  const exploded = chord(state, fx.pivot);
  assert.equal(exploded.status, STATUS_LOST);
  assert.equal(exploded.explodedIndex, fx.mines[0]);
  assert.ok(isMine(exploded, exploded.explodedIndex));
});

test("chord: 数字为 0 或格子未揭开时无效果", () => {
  const state = reveal(createState({ rows: 9, cols: 9, mines: 10, seed: 9 }), 40);
  assert.equal(chord(state, 40), state, "adjacency 为 0 不触发 chord");
  const hidden = state.cellState.findIndex((v) => v === HIDDEN);
  assert.equal(chord(state, hidden), state);
});

test("胜利：揭开全部非雷格即 won，剩余格自动插旗且 remainingMines 归零", () => {
  let state = reveal(createState({ rows: 5, cols: 5, mines: 3, seed: 21 }), 12);
  for (let i = 0; i < cellCount(state); i += 1) {
    if (state.mineField[i] === 1) continue;
    state = reveal(state, i);
  }
  assert.equal(state.status, STATUS_WON);
  assert.equal(state.revealedCount, cellCount(state) - state.mines);
  assert.equal(hiddenCount(state), state.mines);
  assert.equal(remainingMines(state), 0);
  assert.equal(state.flagCount, state.mines);
  assert.ok(state.cellState.every((v) => v !== HIDDEN));
  // 终局后操作无效
  assert.equal(toggleFlag(state, 0), state);
});

test("不可变性：每次操作返回新对象，不修改传入 state", () => {
  const start = createState({ rows: 9, cols: 9, mines: 10, seed: 5 });
  const snapshot = start.cellState.join("");
  const opened = reveal(start, 40);
  assert.equal(start.cellState.join(""), snapshot);
  assert.equal(start.status, STATUS_READY);
  assert.notEqual(opened, start);
  const beforeFlag = opened.flagCount;
  toggleFlag(opened, 0);
  assert.equal(opened.flagCount, beforeFlag);
});

test("isValidIndex / isMine / cellCount 边界", () => {
  const state = createState({ rows: 9, cols: 9, mines: 10 });
  assert.equal(cellCount(state), 81);
  assert.ok(isValidIndex(state, 0));
  assert.ok(isValidIndex(state, 80));
  assert.ok(!isValidIndex(state, 81));
  assert.ok(!isValidIndex(state, -1));
  assert.ok(!isValidIndex(state, 1.5));
  assert.ok(!isMine(state, 999));
});

test("applyIntent: 返回真实 action，无效果时返回 null 且不抛错", () => {
  const start = createState({ rows: 9, cols: 9, mines: 10, seed: 5 });
  const revealed = applyIntent(start, { type: "reveal", index: 40 });
  assert.equal(revealed.action, "reveal");
  assert.equal(revealed.state.status, STATUS_PLAYING);

  const flagged = applyIntent(revealed.state, { type: "flag", index: 0 });
  assert.equal(flagged.action, "flag");
  const unflagged = applyIntent(flagged.state, { type: "flag", index: 0 });
  assert.equal(unflagged.action, "unflag");

  // 点已揭开的数字格 → chord；条件不满足 → null
  const noop = applyIntent(revealed.state, { type: "reveal", index: 40 });
  assert.equal(noop.action, null);
  assert.equal(noop.state, revealed.state);

  assert.equal(applyIntent(start, { type: "unknown", index: 0 }).action, null);
  assert.equal(applyIntent(start, null).action, null);
  assert.equal(applyIntent(start, { type: "reveal", index: -3 }).action, null);
});

test("applyIntent: 点已揭开数字格在旗数吻合时触发 chord", () => {
  const fx = findChordFixture();
  assert.ok(fx);
  let state = fx.state;
  for (const mine of fx.mines) state = toggleFlag(state, mine);
  const result = applyIntent(state, { type: "reveal", index: fx.pivot });
  assert.equal(result.action, "chord");
  assert.ok(result.state.revealedCount > state.revealedCount);
  assert.equal(result.state.stats.chords, 1);
});

test("整局随机对局：合法操作永不抛错，终局必为 won 或 lost", () => {
  for (let seed = 0; seed < 30; seed += 1) {
    let state = createState({ rows: 9, cols: 9, mines: 10, seed });
    const rng = mulberry32(seed + 977);
    for (let step = 0; step < 400 && state.status !== STATUS_WON && state.status !== STATUS_LOST; step += 1) {
      const index = Math.floor(rng() * cellCount(state));
      const type = rng() < 0.25 ? "flag" : "reveal";
      const result = applyIntent(state, { type, index });
      assert.ok(result.state !== undefined);
      state = result.state;
    }
    if (state.status === STATUS_WON) {
      assert.equal(state.revealedCount, cellCount(state) - state.mines);
    }
    if (state.status === STATUS_LOST) {
      assert.ok(isMine(state, state.explodedIndex));
    }
  }
});
