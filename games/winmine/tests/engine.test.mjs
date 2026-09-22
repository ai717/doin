import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createState,
  reveal,
  mark,
  chord,
  applyIntent,
  neighborTable,
  remainingMines,
  isMine,
  normalizeConfig,
  HIDDEN,
  REVEALED,
  FLAG,
  QUESTION,
  STATUS_READY,
  STATUS_PLAYING,
  STATUS_WON,
  STATUS_LOST,
} from "../js/engine.mjs";

test("normalizeConfig 钳制到合法区间", () => {
  assert.deepEqual(normalizeConfig({ rows: 9, cols: 9, mines: 10 }), { rows: 9, cols: 9, mines: 10 });
  assert.equal(normalizeConfig({ rows: 1, cols: 1, mines: 999 }).rows, 9);
  // 雷数不超过 cells-9（留首击安全区）
  const c = normalizeConfig({ rows: 9, cols: 9, mines: 999 });
  assert.ok(c.mines <= 9 * 9 - 9);
});

test("首击永安全：首击及其 8 邻域无雷", () => {
  const s = reveal(createState({ rows: 9, cols: 9, mines: 10, seed: 42 }), 0);
  assert.equal(s.status, STATUS_PLAYING);
  assert.equal(s.seeded, true);
  const zone = [0].concat(neighborTable(9, 9)[0]);
  for (const i of zone) assert.equal(isMine(s, i), false);
  assert.equal(s.cellState[0], REVEALED);
});

test("踩雷进入失败态并高亮爆炸格", () => {
  const seeded = reveal(createState({ rows: 9, cols: 9, mines: 10, seed: 7 }), 0);
  // 找到一颗雷，翻开它
  let mine = -1;
  for (let i = 0; i < 81; i += 1) if (seeded.mineField[i] === 1) { mine = i; break; }
  assert.ok(mine >= 0);
  const lost = reveal(seeded, mine);
  assert.equal(lost.status, STATUS_LOST);
  assert.equal(lost.explodedIndex, mine);
});

test("右键插旗/问号/清除循环，旗数正确", () => {
  let s = reveal(createState({ rows: 9, cols: 9, mines: 10, seed: 3 }), 0);
  const idx = 80;
  s = mark(s, idx);
  assert.equal(s.cellState[idx], FLAG);
  assert.equal(s.flagCount, 1);
  s = mark(s, idx);
  assert.equal(s.cellState[idx], QUESTION);
  assert.equal(s.flagCount, 0);
  s = mark(s, idx);
  assert.equal(s.cellState[idx], HIDDEN);
  assert.equal(s.flagCount, 0);
});

test("翻开全部安全格即胜利，剩余格自动插旗", () => {
  let s = createState({ rows: 9, cols: 9, mines: 10, seed: 42 });
  s = reveal(s, 0);
  assert.equal(s.status, STATUS_PLAYING);
  for (let i = 0; i < 81; i += 1) {
    if (s.mineField[i] === 0 && (s.cellState[i] === HIDDEN || s.cellState[i] === QUESTION)) {
      s = reveal(s, i);
    }
  }
  assert.equal(s.status, STATUS_WON);
  assert.equal(remainingMines(s), 0);
});

function findChordCell(s) {
  const table = neighborTable(s.rows, s.cols);
  for (let i = 0; i < s.rows * s.cols; i += 1) {
    if (s.cellState[i] !== REVEALED) continue;
    const n = s.adjacency[i];
    if (n < 1 || n > 7) continue;
    const nb = table[i];
    const mines = nb.filter((j) => s.mineField[j] === 1);
    const safes = nb.filter((j) => s.mineField[j] === 0 && s.cellState[j] === HIDDEN);
    if (mines.length === n && safes.length >= 1) return { i, n, mines, safes };
  }
  return null;
}

test("和弦：旗数对了且标对 → 不炸", () => {
  let s = reveal(createState({ rows: 9, cols: 9, mines: 10, seed: 999 }), 0);
  const c = findChordCell(s);
  assert.ok(c, "能找到可和弦的数字格");
  for (const m of c.mines) s = mark(s, m); // 全部正确插旗
  const r = chord(s, c.i);
  assert.notEqual(r.status, STATUS_LOST);
});

test("和弦：旗标错 → 爆炸（原版唯一惩罚）", () => {
  let s = reveal(createState({ rows: 9, cols: 9, mines: 10, seed: 999 }), 0);
  const c = findChordCell(s);
  assert.ok(c, "能找到可和弦的数字格");
  for (let k = 0; k < c.n - 1; k += 1) s = mark(s, c.mines[k]); // 标 n-1 个真雷
  s = mark(s, c.safes[0]); // 再把 1 个安全格错标成雷
  const r = chord(s, c.i);
  assert.equal(r.status, STATUS_LOST);
});

test("终局后一切操作 no-op，不抛错", () => {
  let s = reveal(createState({ rows: 9, cols: 9, mines: 10, seed: 5 }), 0);
  let mine = -1;
  for (let i = 0; i < 81; i += 1) if (s.mineField[i] === 1) { mine = i; break; }
  s = reveal(s, mine);
  assert.equal(s.status, STATUS_LOST);
  const before = s;
  assert.equal(reveal(s, 0), before);
  assert.equal(mark(s, 1), before);
  assert.equal(chord(s, 2), before);
  const r1 = applyIntent(s, { type: "reveal", index: 3 });
  assert.equal(r1.action, null);
  const r2 = applyIntent(s, { type: "flag", index: 3 });
  assert.equal(r2.action, null);
});

test("非法意图返回 action null 且原状态返回", () => {
  const s = createState({ rows: 9, cols: 9, mines: 10, seed: 5 });
  assert.equal(applyIntent(s, { type: "reveal", index: -1 }).action, null);
  assert.equal(applyIntent(s, { type: "reveal", index: 99 }).action, null);
  assert.equal(applyIntent(s, {}).action, null);
  assert.equal(applyIntent(s, { type: "bogus", index: 0 }).action, null);
});

test("1000 步随机游走：任意合法序列不抛错、不变式不破", () => {
  let seed = 123;
  const rng = (() => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();

  let s = createState({ rows: 9, cols: 9, mines: 10, seed: 2024 });
  const types = ["reveal", "flag", "chord"];
  for (let step = 0; step < 1000; step += 1) {
    if (s.status === STATUS_WON || s.status === STATUS_LOST) {
      s = createState({ rows: 9, cols: 9, mines: 10, seed: step });
    }
    const index = Math.floor(rng() * s.rows * s.cols);
    const type = types[Math.floor(rng() * types.length)];
    const r = applyIntent(s, { type, index });
    s = r.state;
    // 不变式：flag 数 >= 0；revealed 数 >= 0 且 <= cells
    assert.ok(s.flagCount >= 0);
    assert.ok(s.revealedCount >= 0 && s.revealedCount <= s.rows * s.cols);
  }
});