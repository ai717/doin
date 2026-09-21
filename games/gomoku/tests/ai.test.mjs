import test from "node:test";
import assert from "node:assert/strict";

import {
  BLACK, WHITE, EMPTY,
  SIZE, CELL_COUNT,
  STATUS_PLAYING, STATUS_WON, STATUS_FORBIDDEN,
  idx, rc,
  createState, applyMove,
} from "../js/engine.mjs";
import {
  DIFFICULTIES,
  DIFFICULTY_BEGINNER, DIFFICULTY_INTERMEDIATE, DIFFICULTY_ADVANCED, DIFFICULTY_MASTER,
  DIFFICULTY_META,
  findImmediateWin, findForcedBlock,
  isBlackForbiddenMove,
  orderMoves,
  rankMoves,
  solveVCF, solveVCT,
  chooseMove,
  chooseMoveAsync,
} from "../js/ai.mjs";

const eq = assert.strictEqual;

// 确定性 PRNG
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("DIFFICULTIES 包含四档且顺序固定", () => {
  eq(DIFFICULTIES.length, 4);
  eq(DIFFICULTIES[0], DIFFICULTY_BEGINNER);
  eq(DIFFICULTIES[1], DIFFICULTY_INTERMEDIATE);
  eq(DIFFICULTIES[2], DIFFICULTY_ADVANCED);
  eq(DIFFICULTIES[3], DIFFICULTY_MASTER);
});

test("DIFFICULTY_META: 每档必含 mistakeRate/maxDepth/guard/budgetMs/factor", () => {
  for (const d of DIFFICULTIES) {
    const m = DIFFICULTY_META[d];
    assert.ok(typeof m.mistakeRate === "number");
    assert.ok(typeof m.maxDepth === "number" && m.maxDepth >= 1);
    assert.ok(typeof m.guard === "boolean");
    assert.ok(typeof m.budgetMs === "number" && m.budgetMs > 0);
    assert.ok(typeof m.factor === "number" && m.factor > 0);
    assert.ok(typeof m.minThinkMs === "number");
    assert.ok(typeof m.maxThinkMs === "number");
    assert.ok(m.maxThinkMs >= m.minThinkMs);
  }
});

test("DIFFICULTY_META: 难度梯度 mistakeRate 递减、maxDepth 递增", () => {
  const b = DIFFICULTY_META[DIFFICULTY_BEGINNER];
  const i = DIFFICULTY_META[DIFFICULTY_INTERMEDIATE];
  const a = DIFFICULTY_META[DIFFICULTY_ADVANCED];
  const m = DIFFICULTY_META[DIFFICULTY_MASTER];
  assert.ok(b.mistakeRate > i.mistakeRate);
  assert.ok(i.mistakeRate > a.mistakeRate);
  assert.ok(a.mistakeRate >= m.mistakeRate);
  assert.ok(b.maxDepth < m.maxDepth);
});

test("findImmediateWin: 黑方活四 → 落子即五连，应返回该点", () => {
  const s = createState({
    preset: [
      { pos: idx(7, 5), player: BLACK }, { pos: idx(7, 6), player: BLACK },
      { pos: idx(7, 7), player: BLACK }, { pos: idx(7, 8), player: BLACK },
    ],
    firstPlayer: BLACK, current: BLACK,
  });
  const w = findImmediateWin(s, BLACK);
  // 活四两端任一都能成五：(7,4)=109 或 (7,9)=114
  assert.ok(w === idx(7, 4) || w === idx(7, 9), `expected (7,4) or (7,9), got ${w}`);
});

test("findImmediateWin: 无制胜着 → -1", () => {
  const s = createState();
  eq(findImmediateWin(s, BLACK), -1);
});

test("findForcedBlock: 对手活四必须堵", () => {
  const s = createState({
    preset: [
      { pos: idx(7, 5), player: WHITE }, { pos: idx(7, 6), player: WHITE },
      { pos: idx(7, 7), player: WHITE }, { pos: idx(7, 8), player: WHITE },
      { pos: idx(8, 8), player: BLACK },
    ],
    firstPlayer: BLACK, current: BLACK,
  });
  // 白方活四，黑必须堵
  const block = findForcedBlock(s, BLACK);
  // 应在两端之一（7,4 或 7,9）—— findImmediateWin 返回第一个找到的
  assert.ok(block === idx(7, 4) || block === idx(7, 9), `block=${block}`);
});

test("isBlackForbiddenMove: 黑方双三位置返回 true", () => {
  const s = createState({
    preset: [
      { pos: idx(7, 6), player: BLACK }, { pos: idx(7, 8), player: BLACK },
      { pos: idx(5, 7), player: BLACK }, { pos: idx(6, 7), player: BLACK },
    ],
    firstPlayer: BLACK, current: BLACK,
  });
  eq(isBlackForbiddenMove(s, idx(7, 7)), true);
});

test("isBlackForbiddenMove: 普通空位返回 false", () => {
  const s = createState();
  eq(isBlackForbiddenMove(s, idx(7, 7)), false);
});

test("orderMoves: 返回与输入同长度、全部合法索引", () => {
  const s = createState({ firstPlayer: BLACK, moves: [idx(7, 7)] });
  const moves = [idx(6, 6), idx(8, 8), idx(7, 8), idx(6, 7)];
  const sorted = orderMoves(moves, s.board);
  eq(sorted.length, moves.length);
  for (const m of sorted) assert.ok(moves.includes(m));
});

test("rankMoves: 空盘返回候选着法列表", () => {
  const s = createState();
  const ranked = rankMoves(s, BLACK, { maxDepth: 2, budgetMs: 100 });
  assert.ok(Array.isArray(ranked));
  assert.ok(ranked.length > 0);
  for (const r of ranked) {
    assert.ok("move" in r && "score" in r);
    assert.ok(Number.isInteger(r.move) && r.move >= 0 && r.move < 225);
    assert.ok(typeof r.score === "number");
  }
});

test("rankMoves: 排序后首位是分数最高的", () => {
  const s = createState({ firstPlayer: BLACK, moves: [idx(7, 7)] });
  const ranked = rankMoves(s, WHITE, { maxDepth: 2, budgetMs: 100 });
  for (let i = 1; i < ranked.length; i += 1) {
    assert.ok(ranked[i - 1].score >= ranked[i].score);
  }
});

test("chooseMove: 必胜点优先选（活四 → 五连）", () => {
  const s = createState({
    preset: [
      { pos: idx(7, 5), player: BLACK }, { pos: idx(7, 6), player: BLACK },
      { pos: idx(7, 7), player: BLACK }, { pos: idx(7, 8), player: BLACK },
      { pos: idx(8, 8), player: WHITE },
    ],
    firstPlayer: BLACK, current: BLACK,
  });
  const m = chooseMove(s, { difficulty: DIFFICULTY_INTERMEDIATE, aiPlayer: BLACK, rng: mulberry32(1) });
  // 活四两端任一都能成五
  assert.ok(m === idx(7, 4) || m === idx(7, 9), `expected (7,4) or (7,9), got ${m}`);
});

test("chooseMove: 必堵点优先选（对手活四）", () => {
  const s = createState({
    preset: [
      { pos: idx(7, 5), player: WHITE }, { pos: idx(7, 6), player: WHITE },
      { pos: idx(7, 7), player: WHITE }, { pos: idx(7, 8), player: WHITE },
      { pos: idx(0, 0), player: BLACK },
    ],
    firstPlayer: BLACK, current: BLACK,
  });
  const m = chooseMove(s, { difficulty: DIFFICULTY_INTERMEDIATE, aiPlayer: BLACK, rng: mulberry32(2) });
  assert.ok(m === idx(7, 4) || m === idx(7, 9), `should block, got ${m}`);
});

test("chooseMove: 终局返回 -1（不抛错）", () => {
  // 五连已成的局，status=WON
  const s = createState({
    preset: [
      { pos: idx(7, 5), player: BLACK }, { pos: idx(7, 6), player: BLACK },
      { pos: idx(7, 7), player: BLACK }, { pos: idx(7, 8), player: BLACK },
      { pos: idx(7, 9), player: BLACK },
    ],
    firstPlayer: BLACK, current: BLACK,
  });
  // 此时 board 已五连但 createState 不主动检查 win（preset 模式）。
  // applyMove 会拒绝（status=playing 但已五连子在盘上 → 不应走到这步）。
  // 我们直接验证 chooseMove 在非 playing 状态下安全返回
  // 通过手动模拟终局：
  const won = { ...s, status: "won", winner: BLACK, current: EMPTY };
  const m = chooseMove(won, { difficulty: DIFFICULTY_MASTER, aiPlayer: BLACK });
  eq(m, -1);
});

test("chooseMove: 黑方避免禁手自爆", () => {
  // 在禁手位附近决策时不应选禁手位
  const s = createState({
    preset: [
      { pos: idx(7, 6), player: BLACK }, { pos: idx(7, 8), player: BLACK },
      { pos: idx(5, 7), player: BLACK }, { pos: idx(6, 7), player: BLACK },
      { pos: idx(0, 0), player: WHITE },
    ],
    firstPlayer: BLACK, current: BLACK,
  });
  const m = chooseMove(s, { difficulty: DIFFICULTY_MASTER, aiPlayer: BLACK, rng: mulberry32(42) });
  // 不应选 (7,7) —— 双三禁手
  assert.notStrictEqual(m, idx(7, 7));
  assert.ok(m >= 0);
});

test("chooseMove: 启蒙档失误率 > 0，多次运行可能产生不同着法", () => {
  const s = createState({ firstPlayer: BLACK, moves: [idx(7, 7), idx(7, 8), idx(8, 8), idx(8, 7)] });
  const moves = new Set();
  for (let seed = 1; seed <= 50; seed += 1) {
    const m = chooseMove(s, { difficulty: DIFFICULTY_BEGINNER, aiPlayer: BLACK, rng: mulberry32(seed) });
    moves.add(m);
  }
  // 启蒙档失误率 0.30，应至少产生 2 种不同着法
  assert.ok(moves.size >= 2, `beginner should vary, got ${moves.size}`);
});

test("chooseMove: 大师档失误率近 0，多次运行应稳定", () => {
  const s = createState({ firstPlayer: BLACK, moves: [idx(7, 7), idx(7, 8), idx(8, 8), idx(8, 7)] });
  const moves = new Set();
  for (let seed = 1; seed <= 3; seed += 1) {
    const m = chooseMove(s, { difficulty: DIFFICULTY_MASTER, aiPlayer: BLACK, rng: mulberry32(seed) });
    moves.add(m);
  }
  assert.strictEqual(moves.size, 1);
});

test("solveVCF: 简单 VCF（黑活四 → 必胜）", () => {
  const s = createState({
    preset: [
      { pos: idx(7, 5), player: BLACK }, { pos: idx(7, 6), player: BLACK },
      { pos: idx(7, 7), player: BLACK }, { pos: idx(7, 8), player: BLACK },
      { pos: idx(0, 0), player: WHITE },
    ],
    firstPlayer: BLACK, current: BLACK,
  });
  const v = solveVCF(s, BLACK, 5);
  // 活四两端任一都能成五
  assert.ok(v === idx(7, 4) || v === idx(7, 9), `expected (7,4) or (7,9), got ${v}`);
});

test("solveVCF: 无 VCF 时返回 -1", () => {
  const s = createState();
  const v = solveVCF(s, BLACK, 3);
  // 空盘不可能 VCF
  eq(v, -1);
});

test("solveVCF: 白方也可使用（白活四）", () => {
  const s = createState({
    preset: [
      { pos: idx(7, 5), player: WHITE }, { pos: idx(7, 6), player: WHITE },
      { pos: idx(7, 7), player: WHITE }, { pos: idx(7, 8), player: WHITE },
      { pos: idx(0, 0), player: BLACK },
    ],
    firstPlayer: WHITE, current: WHITE,
  });
  const v = solveVCF(s, WHITE, 5);
  assert.ok(v === idx(7, 4) || v === idx(7, 9), `expected (7,4) or (7,9), got ${v}`);
});

test("solveVCT: 进阶版搜索不抛错", () => {
  const s = createState({
    preset: [
      { pos: idx(7, 5), player: BLACK }, { pos: idx(7, 6), player: BLACK },
      { pos: idx(7, 7), player: BLACK },
      { pos: idx(0, 0), player: WHITE },
    ],
    firstPlayer: BLACK, current: BLACK,
  });
  // VCT 即使无解也应返回 -1 而非抛错
  const v = solveVCT(s, BLACK, 3);
  assert.ok(typeof v === "number");
});

test("chooseMoveAsync: 返回合法着法 + 触发 onProgress", async () => {
  const s = createState();
  let progressCalled = false;
  const m = await chooseMoveAsync(s, {
    difficulty: DIFFICULTY_INTERMEDIATE,
    aiPlayer: BLACK,
    rng: mulberry32(7),
    onProgress: (p) => {
      progressCalled = true;
      assert.ok(p && Array.isArray(p.candidates));
    },
  });
  assert.ok(m >= 0 && m < 225);
  // 给 await raf 一个 tick
  await new Promise((r) => setTimeout(r, 5));
  assert.ok(progressCalled);
});

test("chooseMove: 100 步随机对局不抛错", () => {
  let seed = 99;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 0x100000000;
    return seed / 0x100000000;
  };
  let s = createState({ firstPlayer: BLACK });
  for (let step = 0; step < 100; step += 1) {
    if (s.status !== STATUS_PLAYING) break;
    const m = chooseMove(s, {
      difficulty: step % 2 === 0 ? DIFFICULTY_BEGINNER : DIFFICULTY_INTERMEDIATE,
      aiPlayer: s.current,
      rng,
    });
    if (m < 0) break;
    const next = applyMove(s, m);
    if (next === s) continue;
    s = next;
  }
  assert.ok([STATUS_PLAYING, STATUS_WON, STATUS_FORBIDDEN, "draw"].includes(s.status));
});
