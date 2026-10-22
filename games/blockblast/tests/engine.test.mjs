// engine.test.mjs —— 规则引擎：形状/旋转、放置计分、行列消除、十字共鸣、
// Combo、终局判定、确定性 bag、三档难度、≥1000 步随机游走不变式、同种子逐帧重放一致。
import test from "node:test";
import assert from "node:assert/strict";
import {
  GRID,
  CELL_COUNT,
  STATUS,
  OVER_REASON,
  QUEUE_SIZE,
  PIECES,
  PIECE_IDS,
  createState,
  applyIntent,
  pieceCells,
  pieceColor,
  centeredCells,
  canPlace,
  hasLegalPlacement,
  queueHasLegalPlacement,
  findFullLines,
  refillQueue,
  stepFrame,
  filledCount,
  invariants,
  snapshot,
  cellIndex,
} from "../js/engine.mjs";
import { mulberry32 } from "../js/rng.mjs";
import { SCORE_PER_CELL, SCORE_PER_LINE, SCORE_CROSS } from "../js/score.mjs";
import { DIFFICULTY_IDS, DIFFICULTIES, difficultyById } from "../js/difficulty.mjs";

// ---------------------------------------------------------------- 形状与旋转

test("piece shapes: canonical offsets", () => {
  assert.deepEqual(pieceCells("mono", 0), [[0, 0]]);
  assert.deepEqual(pieceCells("domino", 0), [[0, 0], [0, 1]]);
  assert.deepEqual(pieceCells("tri-line", 0), [[0, 0], [0, 1], [0, 2]]);
  assert.deepEqual(pieceCells("tet-line", 0), [[0, 0], [0, 1], [0, 2], [0, 3]]);
  assert.deepEqual(pieceCells("square", 0), [[0, 0], [0, 1], [1, 0], [1, 1]]);
});

test("piece rotation: 90-degree steps and wraparound", () => {
  assert.deepEqual(pieceCells("tet-line", 1), [[0, 0], [1, 0], [2, 0], [3, 0]]);
  assert.deepEqual(pieceCells("tet-line", 4), pieceCells("tet-line", 0));
  assert.deepEqual(pieceCells("tet-line", -1), pieceCells("tet-line", 3));
  // 方形旋转不变（比较集合，旋转会重排偏移顺序）
  for (let rot = 0; rot < 4; rot += 1) {
    const cells = pieceCells("square", rot).map((c) => c.join(",")).sort();
    assert.deepEqual(cells, ["0,0", "0,1", "1,0", "1,1"]);
  }
  // 五格十字旋转不变
  for (let rot = 0; rot < 4; rot += 1) {
    const cells = pieceCells("pento-plus", rot).map((c) => c.join(",")).sort();
    assert.deepEqual(cells, ["0,1", "1,0", "1,1", "1,2", "2,1"]);
  }
});

test("piece rotation: every shape has 1-4 distinct orientations, all normalized", () => {
  for (const id of PIECE_IDS) {
    const seen = new Set();
    for (let rot = 0; rot < 4; rot += 1) {
      const cells = pieceCells(id, rot);
      const minR = Math.min(...cells.map((c) => c[0]));
      const minC = Math.min(...cells.map((c) => c[1]));
      assert.equal(minR, 0, `${id} rot${rot} min row`);
      assert.equal(minC, 0, `${id} rot${rot} min col`);
      seen.add(cells.map((c) => c.join(",")).sort().join("|"));
    }
    assert.ok(seen.size >= 1 && seen.size <= 4, `${id} orientations`);
  }
});

test("centeredCells: cursor lands on a real cell, deterministic ties", () => {
  assert.deepEqual(centeredCells("mono", 0), [[0, 0]]);
  assert.deepEqual(centeredCells("tet-line", 0), [[0, -1], [0, 0], [0, 1], [0, 2]]);
  assert.deepEqual(centeredCells("square", 0), [[-0, -0], [0, 1], [1, 0], [1, 1]].map((c) => [c[0] + 0, c[1] + 0]));
  // 同一形状同旋转两次调用结果一致（缓存不漂移）
  assert.deepEqual(centeredCells("tet-t", 2), centeredCells("tet-t", 2));
});

// ---------------------------------------------------------------- 放置校验

function emptyBoard() {
  return new Array(CELL_COUNT).fill(0);
}

test("canPlace: bounds and occupancy", () => {
  const board = emptyBoard();
  assert.equal(canPlace(board, "mono", 0, 0, 0), true);
  assert.equal(canPlace(board, "mono", 0, 7, 7), true);
  assert.equal(canPlace(board, "mono", 0, 8, 0), false);
  assert.equal(canPlace(board, "mono", 0, 0, -1), false);
  assert.equal(canPlace(board, "tet-line", 0, 0, 5), false); // 越界：需要 col 5..8
  assert.equal(canPlace(board, "tet-line", 0, 0, 4), true);
  board[cellIndex(1, 1)] = 3;
  assert.equal(canPlace(board, "domino", 0, 1, 0), false); // (1,1) 被占
  assert.equal(canPlace(board, "domino", 0, 1, 2), true);
});

test("hasLegalPlacement: rotation can be the only fit", () => {
  const board = emptyBoard().map((_, i) => ((i % 8 === 7 && i < 24) ? 0 : 5));
  // 仅 (0..2, 7) 三格为空：只有竖放三连能放
  assert.equal(hasLegalPlacement(board, "tri-line"), true);
  assert.equal(canPlace(board, "tri-line", 1, 0, 7), true);
  assert.equal(canPlace(board, "tri-line", 0, 0, 5), false);
  assert.equal(hasLegalPlacement(board, "tet-line"), false);
  assert.equal(queueHasLegalPlacement(board, ["tet-line", "square"]), false);
  assert.equal(queueHasLegalPlacement(board, ["tet-line", "tri-line"]), true);
});

// ---------------------------------------------------------------- 消除与计分

/** 构造一个第 row 行仅缺尾部若干格的盘（用于脚本化计分用例） */
function boardWithRowGap(row, gapCols) {
  const board = emptyBoard();
  for (let c = 0; c < GRID; c += 1) {
    if (!gapCols.includes(c)) board[cellIndex(row, c)] = 4;
  }
  return board;
}

test("place: row clear scores cells + line", () => {
  let state = createState({ seed: 7 });
  state = { ...state, queue: ["tri-line", "mono", "square"], board: boardWithRowGap(0, [5, 6, 7]) };
  const { state: next, action } = applyIntent(state, { type: "place", slot: 0, rotation: 0, row: 0, col: 5 });
  assert.equal(action, "place");
  assert.equal(next.rowsCleared, 1);
  assert.equal(next.crossCount, 0);
  assert.equal(next.combo, 1);
  assert.equal(next.maxCombo, 1);
  assert.equal(next.score, 3 * SCORE_PER_CELL + 1 * SCORE_PER_LINE);
  // 该行已清空
  for (let c = 0; c < GRID; c += 1) assert.equal(next.board[cellIndex(0, c)], 0);
  // 补块后队列仍为 3
  assert.equal(next.queue.length, QUEUE_SIZE);
  assert.equal(next.piecesPlaced, 1);
  // 事件含 clear
  assert.ok(next.events.some((e) => e.kind === "clear" && e.lineCount === 1));
  assert.ok(next.particles.length > 0);
});

test("place: column clear", () => {
  const board = emptyBoard();
  for (let r = 0; r < GRID; r += 1) {
    if (r < 5) board[cellIndex(r, 3)] = 4;
  }
  let state = createState({ seed: 7 });
  state = { ...state, queue: ["tri-line", "mono", "square"], board };
  const { state: next } = applyIntent(state, { type: "place", slot: 0, rotation: 1, row: 5, col: 3 });
  assert.equal(next.rowsCleared, 1);
  assert.equal(next.combo, 1);
  assert.equal(next.score, 3 * SCORE_PER_CELL + SCORE_PER_LINE);
  for (let r = 0; r < GRID; r += 1) assert.equal(next.board[cellIndex(r, 3)], 0);
});

test("place: cross resonance (row + column in one drop)", () => {
  const board = emptyBoard();
  for (let c = 0; c < GRID; c += 1) if (c !== 3) board[cellIndex(3, c)] = 4;
  for (let r = 0; r < GRID; r += 1) if (r !== 3) board[cellIndex(r, 3)] = 4;
  let state = createState({ seed: 7 });
  state = { ...state, queue: ["mono", "domino", "square"], board };
  const { state: next } = applyIntent(state, { type: "place", slot: 0, rotation: 0, row: 3, col: 3 });
  assert.equal(next.rowsCleared, 2);
  assert.equal(next.crossCount, 1);
  assert.equal(next.combo, 1);
  assert.equal(next.score, SCORE_PER_CELL + 2 * SCORE_PER_LINE + SCORE_CROSS);
  assert.ok(next.events.some((e) => e.kind === "cross"));
  assert.equal(filledCount(next), 0); // 行清 + 列清 = 全空
});

test("place: no clear resets combo but keeps score monotone", () => {
  let state = createState({ seed: 7 });
  state = { ...state, queue: ["mono", "mono", "mono"], board: emptyBoard(), combo: 4, maxCombo: 4, score: 100 };
  const { state: next } = applyIntent(state, { type: "place", slot: 0, rotation: 0, row: 0, col: 0 });
  assert.equal(next.combo, 0);
  assert.equal(next.maxCombo, 4);
  assert.equal(next.score, 101);
  const { state: third } = applyIntent(next, { type: "place", slot: 0, rotation: 0, row: 7, col: 7 });
  assert.equal(third.score, 102);
});

test("place: consecutive clears stack combo", () => {
  let state = createState({ seed: 7 });
  // 第 0 行缺 1 格，第 1 行缺 1 格
  const board = boardWithRowGap(0, [7]);
  for (let c = 0; c < GRID; c += 1) if (c !== 0) board[cellIndex(1, c)] = 4;
  state = { ...state, queue: ["mono", "mono", "mono"], board };
  const first = applyIntent(state, { type: "place", slot: 0, rotation: 0, row: 0, col: 7 }).state;
  assert.equal(first.combo, 1);
  const second = applyIntent(first, { type: "place", slot: 0, rotation: 0, row: 1, col: 0 }).state;
  assert.equal(second.combo, 2);
  assert.equal(second.maxCombo, 2);
});

// ---------------------------------------------------------------- 无效果操作

test("applyIntent: no-ops return the same state reference", () => {
  const state = createState({ seed: 11 });
  const occupied = { ...state, board: state.board.map((v, i) => (i === 0 ? 2 : v)) };
  assert.equal(applyIntent(occupied, { type: "place", slot: 0, rotation: 0, row: 0, col: 0 }).state, occupied);
  assert.equal(applyIntent(state, { type: "place", slot: 9, rotation: 0, row: 0, col: 0 }).state, state);
  assert.equal(applyIntent(state, { type: "place", slot: -1, rotation: 0, row: 0, col: 0 }).state, state);
  assert.equal(applyIntent(state, { type: "place", slot: 0, rotation: 0, row: 8, col: 0 }).state, state);
  assert.equal(applyIntent(state, { type: "nope" }).state, state);
  assert.equal(applyIntent(state, null).state, state);
  const over = { ...state, status: STATUS.OVER, overReason: OVER_REASON.STUCK };
  assert.equal(applyIntent(over, { type: "place", slot: 0, rotation: 0, row: 0, col: 0 }).state, over);
  assert.equal(applyIntent(state, { type: "place", slot: 0, rotation: 0, row: 0, col: 0 }).action, "place");
});

// ---------------------------------------------------------------- 终局判定

function syntheticState(overrides) {
  const base = createState({ seed: 3 });
  return { ...base, ...overrides };
}

test("terminal: stuck when no queue piece fits anywhere", () => {
  // 终盘空洞 = 棋盘格色空位（(r+c)%3===0）：无任意两空洞正交相邻，且每行每列都有洞
  // （保证放置后无满行满列可消）。预盘在此基础上再挖一组相邻双格洞给 domino。
  const preBoard = emptyBoard().map((_, i) => {
    const r = Math.floor(i / GRID);
    const c = i % GRID;
    const hole = (r + c) % 3 === 0 || (r === 7 && (c === 6 || c === 7));
    return hole ? 0 : 5;
  });
  // 显式钉死补块流：放置后补上来的必为五格大块，杜绝随机小块续命
  const state = syntheticState({
    queue: ["domino", "tri-line", "square"],
    board: preBoard,
    stream: ["pento-l"],
    streamPos: 0,
    bagIndex: 0,
  });
  const { state: next } = applyIntent(state, { type: "place", slot: 0, rotation: 0, row: 7, col: 6 });
  assert.equal(next.rowsCleared, 0); // 放置未触发消除
  assert.equal(next.status, STATUS.OVER);
  assert.equal(next.overReason, OVER_REASON.STUCK);
  assert.deepEqual(next.queue, ["tri-line", "square", "pento-l"]);
  assert.equal(queueHasLegalPlacement(next.board, next.queue), false);
});

// ---------------------------------------------------------------- 三档难度

test("difficulty: prefills land exactly on every tier", () => {
  const expected = { easy: 0, normal: 6, hard: 12 };
  for (const id of DIFFICULTY_IDS) {
    const state = createState({ seed: 20261022, difficulty: id });
    const filled = state.board.reduce((n, v) => (v !== 0 ? n + 1 : n), 0);
    assert.equal(filled, expected[id], `${id} prefills`);
    assert.equal(state.difficulty, id);
    // 预填格必须是合法糖果色，且首队列必有合法落位（兜底保证）
    assert.ok(state.board.every((v) => v === 0 || (Number.isInteger(v) && v >= 1 && v <= PIECES.length)));
    assert.equal(queueHasLegalPlacement(state.board, state.queue), true, `${id} first queue must be playable`);
  }
});

test("difficulty: unknown id falls back to normal", () => {
  const state = createState({ seed: 5, difficulty: "nightmare" });
  assert.equal(state.difficulty, "normal");
  assert.equal(difficultyById("nightmare"), null);
});

test("difficulty: same seed + same tier is deterministic, tiers diverge", () => {
  const a = createState({ seed: 777, difficulty: "hard" });
  const b = createState({ seed: 777, difficulty: "hard" });
  assert.deepEqual(a.board, b.board);
  assert.deepEqual(a.queue, b.queue);
  assert.notDeepEqual(createState({ seed: 777, difficulty: "easy" }).board, a.board);
});

test("difficulty: bag strength scales with tier", () => {
  // chunk 大小 = 11 形状 + dups；dups: easy 3-5 / normal 5-7 / hard 7-9。
  // 采样：清空队列逼 refill，只在 stream 增长（生成新袋）时记增量。
  const avgChunk = (id) => {
    let total = 0;
    let bags = 0;
    for (let seed = 1; seed <= 24 && bags < 48; seed += 1) {
      let state = createState({ seed, difficulty: id });
      let guard = 0;
      while (bags < 48 && guard < 600) {
        guard += 1;
        const before = state.stream.length;
        state = refillQueue({ ...state, queue: [] });
        if (state.stream.length > before) {
          total += state.stream.length - before;
          bags += 1;
        }
      }
    }
    return total / bags;
  };
  const easy = avgChunk("easy");
  const normal = avgChunk("normal");
  const hard = avgChunk("hard");
  assert.ok(easy < normal && normal < hard, `bag strength must scale: ${easy} < ${normal} < ${hard}`);
  assert.ok(easy >= 14 && easy <= 16, `easy chunk within 14-16, got ${easy}`);
  assert.ok(normal >= 16 && normal <= 18, `normal chunk within 16-18, got ${normal}`);
  assert.ok(hard >= 18 && hard <= 20, `hard chunk within 18-20, got ${hard}`);
});

test("difficulty: prefill never bricks the opening (60 seeds)", () => {
  for (const id of DIFFICULTY_IDS) {
    for (let seed = 1; seed <= 60; seed += 1) {
      const state = createState({ seed: seed * 7919, difficulty: id });
      assert.equal(queueHasLegalPlacement(state.board, state.queue), true, `${id} seed ${seed}`);
    }
  }
});

test("snapshot: exposes difficulty, no campaign fields", () => {
  const snap = snapshot(createState({ seed: 3, difficulty: "hard" }));
  assert.equal(snap.difficulty, "hard");
  assert.equal(snap.goal, undefined);
  assert.equal(snap.pieceBudget, undefined);
  assert.equal(snap.goalMet, undefined);
  assert.equal(snap.levelId, undefined);
});

// ---------------------------------------------------------------- 确定性 bag

test("bag: same seed yields the same queue, different seeds diverge", () => {
  const a = createState({ seed: 42 });
  const b = createState({ seed: 42 });
  const c = createState({ seed: 43 });
  assert.deepEqual(a.queue, b.queue);
  assert.ok(a.queue.every((id) => PIECE_IDS.includes(id)));
  assert.notDeepEqual(a.queue, c.queue);
  assert.equal(a.queue.length, QUEUE_SIZE);
  // 队列持续推进也确定
  const a2 = applyIntent(a, { type: "place", slot: 0, rotation: 0, row: 0, col: 0 }).state;
  const b2 = applyIntent(b, { type: "place", slot: 0, rotation: 0, row: 0, col: 0 }).state;
  assert.deepEqual(a2.queue, b2.queue);
  assert.equal(a2.queue.length, QUEUE_SIZE);
});

test("bag: every chunk contains each shape at least once (balanced)", () => {
  const state = createState({ seed: 0xbeef });
  // stream 第一个 chunk 至少含全部形状各 1 个
  const chunk = state.stream;
  for (const id of PIECE_IDS) {
    assert.ok(chunk.includes(id), `chunk missing ${id}`);
  }
  assert.equal(new Set(chunk).size, PIECE_IDS.length);
});

// ---------------------------------------------------------------- stepFrame

test("stepFrame: no-op without particles/events; ages deterministically", () => {
  const state = createState({ seed: 5 });
  assert.equal(stepFrame(state, 1 / 120), state);
  assert.equal(stepFrame(state, 0), state);
  assert.equal(stepFrame(state, -1), state);
  // 造一次消除产生粒子
  const board = boardWithRowGap(0, [5, 6, 7]);
  const withPieces = { ...state, queue: ["tri-line", "mono", "square"], board };
  const cleared = applyIntent(withPieces, { type: "place", slot: 0, rotation: 0, row: 0, col: 5 }).state;
  assert.ok(cleared.particles.length > 0);
  const before = cleared.particles[0];
  const stepped = stepFrame(cleared, 0.1);
  assert.notEqual(stepped, cleared);
  assert.ok(stepped.particles.every((p) => p.life < before.maxLife + 1));
  const aged = stepFrame(stepped, 10);
  assert.equal(aged.particles.length, 0);
  assert.equal(aged.events.length, 0);
});

// ---------------------------------------------------------------- 快照隔离

test("snapshot: read-only, mutation does not feed back", () => {
  let state = createState({ seed: 9 });
  const board = boardWithRowGap(0, [5, 6, 7]);
  state = applyIntent({ ...state, queue: ["tri-line", "mono", "square"], board }, { type: "place", slot: 0, rotation: 0, row: 0, col: 5 }).state;
  const snap = snapshot(state);
  const frozen = JSON.stringify(snapshot(state));
  snap.board[0] = 99;
  snap.queue.push("mono");
  snap.events.push({ kind: "fake" });
  snap.particles.length = 0;
  snap.score = -12345;
  assert.equal(JSON.stringify(snapshot(state)), frozen);
});

// ---------------------------------------------------------------- 不变式断言

function assertInvariants(state) {
  const inv = invariants(state);
  for (const [key, ok] of Object.entries(inv)) {
    assert.ok(ok, `invariant ${key} violated`);
  }
}

// ---------------------------------------------------------------- 随机游走（≥1000 步）

function legalMoves(state) {
  const moves = [];
  state.queue.forEach((id, slot) => {
    for (let rot = 0; rot < 4; rot += 1) {
      const cells = pieceCells(id, rot);
      const maxR = Math.max(...cells.map((c) => c[0]));
      const maxC = Math.max(...cells.map((c) => c[1]));
      for (let row = 0; row + maxR < GRID; row += 1) {
        for (let col = 0; col + maxC < GRID; col += 1) {
          if (canPlace(state.board, id, rot, row, col)) moves.push({ slot, rotation: rot, row, col });
        }
      }
    }
  });
  return moves;
}

function walk(seed, difficulty, maxSteps = 500) {
  let state = createState({ seed, difficulty });
  const rng = mulberry32((seed ^ 0x51ed) >>> 0);
  const trace = [];
  const inputs = [];
  let steps = 0;
  let frames = 0;
  while (state.status === STATUS.PLAYING && steps < maxSteps) {
    const moves = legalMoves(state);
    assert.ok(moves.length > 0, "playing state must have a legal move");
    const move = moves[Math.floor(rng() * moves.length)];
    inputs.push(move);
    const res = applyIntent(state, { type: "place", ...move });
    assert.equal(res.action, "place");
    state = res.state;
    steps += 1;
    assertInvariants(state);
    trace.push(JSON.stringify(snapshot(state)));
    // 每步穿插两次固定步长帧推进（粒子/事件）
    state = stepFrame(state, 1 / 120);
    state = stepFrame(state, 1 / 120);
    frames += 2;
    trace.push(JSON.stringify(snapshot(state)));
    assertInvariants(state);
  }
  assert.equal(state.status, STATUS.OVER, "walk must terminate");
  return { steps, frames, inputs, state, trace };
}

test("random walk: 1000+ legal placements keep every invariant (endless)", () => {
  let total = 0;
  for (let seed = 1; seed <= 96; seed += 1) {
    const run = walk(seed, "normal");
    total += run.steps;
    assert.equal(run.state.overReason, OVER_REASON.STUCK);
    assert.ok(run.state.score >= 0 && Number.isFinite(run.state.score));
    assert.ok(run.state.piecesPlaced === run.steps);
    assert.equal(filledCount(run.state) <= CELL_COUNT, true);
  }
  assert.ok(total >= 1000, `expected >=1000 steps, got ${total}`);
});

test("random walk: every tier terminates by stuck with invariants", () => {
  let total = 0;
  for (const id of DIFFICULTY_IDS) {
    for (let seed = 201; seed <= 216; seed += 1) {
      const run = walk(seed, id);
      total += run.steps;
      assert.equal(run.state.overReason, OVER_REASON.STUCK, `${id} over reason: ${run.state.overReason}`);
      assert.equal(run.state.difficulty, id);
    }
  }
  assert.ok(total >= 300, `expected >=300 steps across tiers, got ${total}`);
});

test("replay: same seed + same inputs is frame-identical", () => {
  const seed = 0xc0ffee;
  const first = walk(seed, "normal");
  assert.ok(first.steps > 5, "walk too short to be meaningful");
  // 第二次：同种子、同输入序列、同帧推进节奏
  let state = createState({ seed, difficulty: "normal" });
  first.inputs.forEach((move, i) => {
    const res = applyIntent(state, { type: "place", ...move });
    assert.equal(res.action, "place");
    state = res.state;
    assert.equal(JSON.stringify(snapshot(state)), first.trace[i * 2], `frame mismatch after placement ${i}`);
    state = stepFrame(state, 1 / 120);
    state = stepFrame(state, 1 / 120);
    assert.equal(JSON.stringify(snapshot(state)), first.trace[i * 2 + 1], `frame mismatch after step ${i}`);
  });
  assert.equal(state.status, STATUS.OVER);
  assert.equal(state.overReason, first.state.overReason);
  assert.equal(state.score, first.state.score);
  assert.equal(state.rowsCleared, first.state.rowsCleared);
});

test("replay: different seeds diverge", () => {
  const a = walk(0xaaaa, "normal");
  const b = walk(0xbbbb, "normal");
  assert.notEqual(a.trace.join(""), b.trace.join(""));
});

// ---------------------------------------------------------------- findFullLines

test("findFullLines: rows and cols detected independently", () => {
  const board = emptyBoard().fill(4);
  assert.deepEqual(findFullLines(board).rows, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(findFullLines(board).cols, [0, 1, 2, 3, 4, 5, 6, 7]);
  const sparse = emptyBoard();
  assert.deepEqual(findFullLines(sparse), { rows: [], cols: [] });
  const one = emptyBoard().fill(4);
  one[cellIndex(4, 4)] = 0;
  assert.deepEqual(findFullLines(one).rows, [0, 1, 2, 3, 5, 6, 7]);
  assert.deepEqual(findFullLines(one).cols, [0, 1, 2, 3, 5, 6, 7]);
});

// ---------------------------------------------------------------- 杂项

test("refillQueue: idempotent when queue is full", () => {
  const state = createState({ seed: 8 });
  assert.equal(state.queue.length, QUEUE_SIZE);
  assert.equal(refillQueue(state), state);
});

test("difficulty table: three tiers, ids match storage contract", () => {
  assert.deepEqual(DIFFICULTIES.map((d) => d.id), DIFFICULTY_IDS);
  for (const d of DIFFICULTIES) {
    assert.ok(d.dupMin <= d.dupMax, `${d.id} dup envelope`);
    assert.ok(d.prefills >= 0 && d.prefills < 20, `${d.id} prefills sane`);
  }
});

test("piece colors are unique per shape and in range", () => {
  const colors = PIECES.map((p) => p.color);
  assert.equal(new Set(colors).size, PIECES.length);
  assert.ok(colors.every((c) => Number.isInteger(c) && c >= 1));
  assert.equal(pieceColor("mono"), PIECES[0].color);
  assert.equal(pieceColor("nope"), PIECES[0].color); // 未知形状回落首格
});
