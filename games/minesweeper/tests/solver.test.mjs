import assert from "node:assert";
import { test } from "node:test";
import {
  FLAGGED,
  HIDDEN,
  REVEALED,
  createState,
  neighborTable,
  placeMines,
  reveal,
} from "../js/engine.mjs";
import { DIFFICULTIES } from "../js/level.mjs";
import {
  analyze,
  deduce,
  findSafeCell,
  isNoGuessSolvable,
  pickNoGuessSeed,
} from "../js/solver.mjs";

// 手工构造一个"已揭部分格"的局面，用来精确测试推理规则。
// 用 createState 打底以获得完整 state 形状（stats / seeded 等），
// 再覆盖 mineField / cellState / adjacency，供引擎 reveal 安全调用。
function buildState(rows, cols, mineSet, revealedSet = new Set()) {
  const st = createState({ rows, cols, mines: mineSet.size });
  for (const i of mineSet) st.mineField[i] = 1;
  for (const i of revealedSet) st.cellState[i] = REVEALED;
  const table = neighborTable(rows, cols);
  for (let i = 0; i < rows * cols; i += 1) {
    if (st.mineField[i] === 1) {
      st.adjacency[i] = -1;
      continue;
    }
    let c = 0;
    for (const n of table[i]) if (st.mineField[n] === 1) c += 1;
    st.adjacency[i] = c;
  }
  st.seeded = true;
  st.status = "playing";
  let rc = 0;
  for (let i = 0; i < st.cellState.length; i += 1) if (st.cellState[i] === REVEALED) rc += 1;
  st.revealedCount = rc;
  return st;
}

test("deduce: 数字格旗数=数字 → 其余隐藏邻居全安全", () => {
  const s = buildState(5, 5, new Set([0]), new Set([1]));
  s.cellState[0] = FLAGGED; // 把唯一的雷标掉
  const { safe } = deduce(s);
  assert.deepEqual([...safe].sort((a, b) => a - b), [2, 5, 6, 7]);
});

test("deduce: 数字格=隐藏邻居数 → 所有隐藏邻居都是雷", () => {
  const mines = new Set([6, 7, 8, 11, 13, 16, 17, 18]);
  const s = buildState(5, 5, mines, new Set([12]));
  const { mines: deduced } = deduce(s);
  assert.deepEqual([...deduced].sort((a, b) => a - b), [6, 7, 8, 11, 13, 16, 17, 18]);
});

test("deduce: 中间态没有任何单点推理时返回空集", () => {
  // 中心数字=1，两个隐藏邻居谁都可能是雷 → 推不出
  const s = buildState(5, 5, new Set([11]), new Set([12]));
  const { safe, mines } = deduce(s);
  assert.equal(safe.length, 0);
  assert.equal(mines.length, 0);
});

test("analyze: 全局约束（已标雷=总雷）→ 余下隐藏格皆安全，可通关", () => {
  const s = buildState(5, 5, new Set([0]), new Set([1]));
  s.cellState[0] = FLAGGED;
  const result = analyze(s);
  assert.equal(result.solvable, true);
  assert.equal(result.won, true);
});

test("isNoGuessSolvable: 手工无猜布局为 true", () => {
  // 1 雷，旗掉后其余全安全
  const s = buildState(5, 5, new Set([0]), new Set([1]));
  s.cellState[0] = FLAGGED;
  assert.equal(isNoGuessSolvable(s), true);
});

test("findSafeCell: 无猜进行中能证明一个安全格", () => {
  const s = buildState(5, 5, new Set([0]), new Set([1]));
  s.cellState[0] = FLAGGED;
  const safe = findSafeCell(s);
  assert.ok(safe !== null && safe !== 0); // 0 是雷（已标旗），不应被当作安全格返回
  assert.equal(s.cellState[safe], HIDDEN);
});

test("findSafeCell: 已通关局面返回 null", () => {
  const s = buildState(5, 5, new Set([0]), new Set([1]));
  s.cellState[0] = FLAGGED;
  for (let i = 1; i < 25; i += 1) s.cellState[i] = REVEALED;
  assert.equal(findSafeCell(s), null);
});

test("pickNoGuessSeed: 经典三档各 20 局均生成无猜可解布局", () => {
  for (const d of DIFFICULTIES) {
    const config = { rows: d.rows, cols: d.cols, mines: d.mines };
    for (let k = 0; k < 20; k += 1) {
      const firstIndex = Math.floor(((d.rows * d.cols) / 2) | 0) + (k % 3);
      const seed = pickNoGuessSeed(config, firstIndex, 1000 + k);
      const opened = reveal(placeMines(createState({ ...config, seed }), firstIndex), firstIndex);
      assert.equal(opened.status, "playing");
      assert.equal(isNoGuessSolvable(opened), true, `难度 ${d.id} 第 ${k} 局应无猜可解`);
    }
  }
});

test("pickNoGuessSeed: 同输入同输出（确定性）", () => {
  const config = { rows: 9, cols: 9, mines: 10 };
  const a = pickNoGuessSeed(config, 40, 777);
  const b = pickNoGuessSeed(config, 40, 777);
  assert.equal(a, b);
});

test("pickNoGuessSeed: 返回的确实是有效种子（1..2^32-1）", () => {
  const seed = pickNoGuessSeed({ rows: 9, cols: 9, mines: 10 }, 40, 42);
  assert.ok(Number.isInteger(seed) && seed >= 1 && seed < 4294967296);
});
