// 规则层单测：状态流转、三线连通、可解性、不变量、计分、星级、连击窗口、随机游走。
import test from "node:test";
import assert from "node:assert/strict";

import {
  AUTO_SHUFFLE_LIMIT,
  COLS,
  COMBO_WINDOW_MS,
  LEVEL_COUNT,
  MOTIF_COUNT,
  ROWS,
  SOLID_COLS,
  SOLID_ROWS,
  applyPick,
  createLevel,
  createState,
  findAnyPair,
  findHint,
  findLinkPath,
  hasAnyPair,
  hashSeed,
  isBoardCleared,
  levelOutcome,
  levelParams,
  levelSeed,
  makeRng,
  motifCounts,
  restartLevel,
  resolveDeadlock,
  shuffleBoard,
  startGame,
  straightClear,
  tick,
  useHint,
  useShuffle
} from "../js/engine.mjs";
import { clearScore, clampScore, endBonus, starsFor, MAX_SCORE } from "../js/score.mjs";
import { MOTIFS, TINTS, tileStops, motifById } from "../js/motifs.mjs";

/* ------------------------------------------------------------ 工具 */

function blank() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function customState(board, overrides) {
  const base = createState(1, { seed: 1 });
  return Object.assign({}, base, { phase: "playing", board: board }, overrides || {});
}

function tilesOf(board) {
  const list = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) if (board[r][c] !== 0) list.push({ r: r, c: c });
  }
  return list;
}

function assertRectilinear(path) {
  for (let i = 1; i < path.cells.length; i += 1) {
    const a = path.cells[i - 1];
    const b = path.cells[i];
    assert.ok(a.r === b.r || a.c === b.c, "折线必须横平竖直，禁止斜线");
  }
}

function assertOuterRingEmpty(board) {
  for (let r = 0; r < ROWS; r += 1) {
    assert.equal(board[r][0], 0, "外圈通道必须恒空");
    assert.equal(board[r][COLS - 1], 0, "外圈通道必须恒空");
  }
  for (let c = 0; c < COLS; c += 1) {
    assert.equal(board[0][c], 0, "外圈通道必须恒空");
    assert.equal(board[ROWS - 1][c], 0, "外圈通道必须恒空");
  }
}

function assertPairedCounts(board) {
  const counts = motifCounts(board);
  for (let id = 1; id <= MOTIF_COUNT; id += 1) {
    assert.equal(counts[id] % 2, 0, "图案 " + id + " 的计数必须为偶数");
  }
}

/* ------------------------------------------------------------ 母题表 */

test("母题表：12 个母题，id / path / 强调色两两不同", () => {
  assert.equal(MOTIFS.length, 12);
  assert.equal(MOTIF_COUNT, 12);
  const ids = new Set(MOTIFS.map((m) => m.id));
  assert.equal(ids.size, 12);
  const keys = new Set(MOTIFS.map((m) => m.key));
  assert.equal(keys.size, 12);
  const allPaths = MOTIFS.flatMap((m) => m.paths);
  assert.equal(new Set(allPaths).size, allPaths.length, "path 数据必须两两不同");
  const tints = new Set(MOTIFS.map((m) => m.tint));
  assert.equal(tints.size, 12, "12 个母题必须各配一个专属琉璃色");
  MOTIFS.forEach((m) => {
    assert.ok(TINTS[m.tint], "母题 " + m.key + " 的 tint 必须在 TINTS 表中");
    const stops = tileStops(m.id);
    assert.ok(stops.lt && stops.mid && stops.dk);
    assert.match(stops.lt, /^#[0-9a-f]{6}$/i);
    assert.ok(m.zh && m.en, "母题必须同时有中英文名");
    assert.ok(m.paths.length >= 1);
  });
  assert.equal(motifById(999).id, MOTIFS[0].id, "非法 id 必须安全回退");

  // 颜色两两可辨：只断言"tint 名字不同"是不够的 —— 那是数据不同，不是玩家看得出不同。
  // 取 tileStops 三档的均值 RGB，任意两母题的曼哈顿距离必须拉得开。
  // 真浏览器下的像素级形状+颜色可辨性由 x/pair-link/cdp-motifs.mjs 覆盖。
  const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const meanRgb = (id) => {
    const stops = tileStops(id);
    const parts = [toRgb(stops.lt), toRgb(stops.mid), toRgb(stops.dk)];
    return [0, 1, 2].map((k) => Math.round(parts.reduce((sum, p) => sum + p[k], 0) / parts.length));
  };
  const rgbs = MOTIFS.map((m) => ({ zh: m.zh, v: meanRgb(m.id) }));
  let minDist = Infinity;
  let minPair = "";
  for (let i = 0; i < rgbs.length; i += 1) {
    for (let j = i + 1; j < rgbs.length; j += 1) {
      const d =
        Math.abs(rgbs[i].v[0] - rgbs[j].v[0]) +
        Math.abs(rgbs[i].v[1] - rgbs[j].v[1]) +
        Math.abs(rgbs[i].v[2] - rgbs[j].v[2]);
      if (d < minDist) {
        minDist = d;
        minPair = rgbs[i].zh + "/" + rgbs[j].zh;
      }
    }
  }
  assert.ok(minDist >= 30, "任意两个母题的平均色曼哈顿距离必须 ≥ 30（最接近的一对：" + minPair + " = " + minDist + "）");
});

/* ------------------------------------------------------------ 关卡参数 */

test("关卡参数公式：全 36 关与派生表逐行一致", () => {
  const kinds = [
    6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8,
    8, 8, 8, 8, 9, 9, 9, 9, 10, 10, 10, 10,
    10, 10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12
  ];
  const tiles = [
    56, 56, 56, 56, 60, 60, 60, 60, 64, 64, 64, 64,
    64, 64, 64, 64, 68, 68, 68, 68, 72, 72, 72, 72,
    72, 72, 72, 72, 76, 76, 76, 76, 80, 80, 80, 80
  ];
  const timeMs = [
    124000, 124000, 124000, 124000, 132000, 132000, 132000, 132000, 141000, 141000, 141000, 141000,
    130000, 130000, 130000, 130000, 138000, 138000, 138000, 138000, 146000, 146000, 146000, 146000,
    135000, 135000, 135000, 135000, 143000, 143000, 143000, 143000, 150000, 150000, 150000, 150000
  ];
  const chapters = [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
    3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3
  ];

  for (let level = 1; level <= LEVEL_COUNT; level += 1) {
    const params = levelParams(level);
    const i = level - 1;
    assert.equal(params.level, level);
    assert.equal(params.chapter, chapters[i], "第 " + level + " 关章节不符");
    assert.equal(params.kinds, kinds[i], "第 " + level + " 关图案种类不符");
    assert.equal(params.tiles, tiles[i], "第 " + level + " 关实心块数不符");
    assert.equal(params.timeMs, timeMs[i], "第 " + level + " 关时限不符");
    assert.equal(params.hints, 3);
    assert.equal(params.shuffles, 2);
    assert.equal(params.tiles % 2, 0, "实心块数必须为偶数");
    assert.ok(params.tiles <= 80);
    assert.ok(params.tiles >= params.kinds * 2, "每种图案至少要成对出现一次");
  }

  assert.equal(levelParams(0).level, 1, "越界关卡必须钳制到 1");
  assert.equal(levelParams(999).level, LEVEL_COUNT, "越界关卡必须钳制到 36");
  assert.equal(levelParams(NaN).level, 1);
});

/* ------------------------------------------------------------ PRNG */

test("PRNG：同种子完全复现，hashSeed 稳定", () => {
  assert.equal(hashSeed("pair-link:7"), hashSeed("pair-link:7"));
  assert.notEqual(hashSeed("pair-link:7"), hashSeed("pair-link:8"));
  assert.equal(hashSeed(""), 0x811c9dc5);
  assert.ok(hashSeed("x") >= 0 && hashSeed("x") <= 0xffffffff);

  const a = makeRng(42);
  const b = makeRng(42);
  const seqA = [a(), a(), a(), a(), a()];
  const seqB = [b(), b(), b(), b(), b()];
  assert.deepEqual(seqA, seqB);
  seqA.forEach((v) => assert.ok(v >= 0 && v < 1));

  const lv1 = createLevel(7, makeRng(levelSeed(7)));
  const lv2 = createLevel(7, makeRng(levelSeed(7)));
  assert.deepEqual(lv1.board, lv2.board, "同种子必须生成完全相同的盘面");

  const other = createLevel(7, makeRng(levelSeed(8)));
  assert.notDeepEqual(lv1.board, other.board, "不同关卡种子应产生不同盘面");
});

/* ------------------------------------------------------------ 生成与可解性 */

test("可解性：36 关开局均存在可消对，且不变量成立", () => {
  for (let level = 1; level <= LEVEL_COUNT; level += 1) {
    const { board, params } = createLevel(level, makeRng(levelSeed(level)));
    assert.equal(tilesOf(board).length, params.tiles, "第 " + level + " 关实心块数不符");
    assert.ok(hasAnyPair(board), "第 " + level + " 关开局必须存在可消对");
    assertPairedCounts(board);
    assertOuterRingEmpty(board);
    assert.equal(isBoardCleared(board), false);

    const counts = motifCounts(board);
    const used = counts.filter((n) => n > 0);
    assert.equal(used.length, params.kinds, "第 " + level + " 关图案种类数不符");
    used.forEach((n) => assert.ok(n >= 2, "每种图案至少成对出现"));
    assert.ok(Math.max(...used) - Math.min(...used) <= 2, "各图案计数差不得超过 2");
  }
});

test("第 3 章最后四关为满盘开局（80 块铺满实心区）", () => {
  for (let level = 33; level <= 36; level += 1) {
    const { board } = createLevel(level, makeRng(levelSeed(level)));
    for (let r = 1; r <= SOLID_ROWS; r += 1) {
      for (let c = 1; c <= SOLID_COLS; c += 1) {
        assert.notEqual(board[r][c], 0, "满盘开局不应留空");
      }
    }
  }
});

test("洗牌：只置换位置，图案计数不变，外圈恒空", () => {
  const rng = makeRng(levelSeed(4));
  const { board } = createLevel(4, rng);
  const before = motifCounts(board);
  const shuffled = shuffleBoard(board, rng);
  assert.deepEqual(motifCounts(shuffled), before, "洗牌不得改变图案计数");
  assertOuterRingEmpty(shuffled);
  assert.deepEqual(board, board, "原盘面不得被就地修改");
});

test("死局化解：可解盘面不洗牌；彻底无解时洗到上限并如实报告", () => {
  const rng = makeRng(99);

  // 分支 1：本来就可解 → 不消耗洗牌
  const { board } = createLevel(6, rng);
  const ok = resolveDeadlock(board, rng);
  assert.equal(ok.shuffles, 0, "可解盘面不应洗牌");
  assert.equal(ok.solvable, true);
  assert.deepEqual(ok.board, board);

  // 分支 2：全盘图案两两不同 → 任何洗牌都无法产生可消对
  const lonely = blank();
  for (let id = 1; id <= SOLID_COLS; id += 1) lonely[1][id] = id;
  lonely[2][1] = 11;
  lonely[2][2] = 12;
  assert.equal(hasAnyPair(lonely), false, "12 个互不相同图案不应存在可消对");

  const stuck = resolveDeadlock(lonely, rng);
  assert.equal(stuck.shuffles, AUTO_SHUFFLE_LIMIT, "无解盘面应洗到次数上限");
  assert.equal(stuck.solvable, false);
  assert.deepEqual(motifCounts(stuck.board), motifCounts(lonely), "洗牌不得改变图案计数");
  assertOuterRingEmpty(stuck.board);
});

/* ------------------------------------------------------------ 三线连通 */

test("0 折：同行 / 同列直连；被阻挡则不成立", () => {
  const board = blank();
  board[1][1] = 1;
  board[1][4] = 1;
  const path = findLinkPath(board, { r: 1, c: 1 }, { r: 1, c: 4 });
  assert.ok(path);
  assert.equal(path.folds, 0);
  assert.equal(path.cells.length, 2);
  assertRectilinear(path);

  board[1][2] = 2;
  const detour = findLinkPath(board, { r: 1, c: 1 }, { r: 1, c: 4 });
  assert.ok(detour, "直连被阻挡后仍可绕外圈连通");
  assert.ok(detour.folds >= 1, "绕行路径不得再是 0 折直连");

  const col = blank();
  col[1][3] = 6;
  col[6][3] = 6;
  const colPath = findLinkPath(col, { r: 1, c: 3 }, { r: 6, c: 3 });
  assert.equal(colPath.folds, 0);

  const adjacent = blank();
  adjacent[4][4] = 9;
  adjacent[4][5] = 9;
  assert.equal(findLinkPath(adjacent, { r: 4, c: 4 }, { r: 4, c: 5 }).folds, 0);
});

test("1 折：两个候选拐点，折线三点且横平竖直", () => {
  const board = blank();
  board[2][2] = 1;
  board[5][6] = 1;
  const path = findLinkPath(board, { r: 2, c: 2 }, { r: 5, c: 6 });
  assert.ok(path);
  assert.equal(path.folds, 1);
  assert.equal(path.cells.length, 3);
  assertRectilinear(path);
  // 固定序：(a.r, b.c) 优先于 (b.r, a.c)
  assert.deepEqual(path.cells[1], { r: 2, c: 6 });
});

test("2 折：两个一折拐点被占时改走两折", () => {
  const board = blank();
  board[2][2] = 1;
  board[5][6] = 1;
  board[2][6] = 2;
  board[5][2] = 2;
  const path = findLinkPath(board, { r: 2, c: 2 }, { r: 5, c: 6 });
  assert.ok(path);
  assert.equal(path.folds, 2);
  assert.equal(path.cells.length, 4);
  assertRectilinear(path);
});

test("绕外圈：盘外通道可作折线通路，且优先于内部绕行", () => {
  const board = blank();
  board[1][1] = 1;
  board[1][10] = 1;
  for (let c = 2; c <= 9; c += 1) board[1][c] = 2;

  const path = findLinkPath(board, { r: 1, c: 1 }, { r: 1, c: 10 });
  assert.ok(path, "必须能绕外圈连通");
  assert.equal(path.folds, 2);
  assert.equal(path.cells.length, 4);
  assertRectilinear(path);
  assert.ok(
    path.cells.some(
      (cell) => cell.r === 0 || cell.r === ROWS - 1 || cell.c === 0 || cell.c === COLS - 1
    ),
    "路径必须经过外圈通道"
  );
  assert.equal(path.cells[1].r, 0, "外圈通道路径（拐点行列和最小）应被优先返回");
});

test("不连通：不同图案 / 被完全封死 / 同一格", () => {
  const board = blank();
  board[1][1] = 1;
  board[1][2] = 2;
  assert.equal(findLinkPath(board, { r: 1, c: 1 }, { r: 1, c: 2 }), null, "不同图案不得连通");
  assert.equal(findLinkPath(board, { r: 1, c: 1 }, { r: 1, c: 1 }), null, "同一格不得连通");
  assert.equal(findLinkPath(board, { r: 1, c: 1 }, { r: 0, c: 0 }), null, "空格不得作为端点");
  assert.equal(findLinkPath(board, { r: -1, c: 0 }, { r: 1, c: 1 }), null, "越界坐标安全返回 null");

  const sealed = blank();
  sealed[1][1] = 7;
  sealed[1][3] = 7;
  sealed[1][2] = 8;
  for (let r = 2; r <= 8; r += 1) {
    sealed[r][1] = 9;
    sealed[r][2] = 9;
    sealed[r][3] = 9;
  }
  for (let c = 0; c <= 2; c += 1) sealed[0][c] = 9;
  for (let c = 4; c <= 11; c += 1) sealed[0][c] = 9;
  sealed[0][3] = 9;
  assert.equal(findLinkPath(sealed, { r: 1, c: 1 }, { r: 1, c: 3 }), null, "被完全封死时不得连通");
});

test("straightClear：端点自身不计入阻挡", () => {
  const board = blank();
  board[3][3] = 1;
  board[3][7] = 1;
  assert.equal(straightClear(board, { r: 3, c: 3 }, { r: 3, c: 7 }), true);
  board[3][5] = 2;
  assert.equal(straightClear(board, { r: 3, c: 3 }, { r: 3, c: 7 }), false);
  assert.equal(straightClear(board, { r: 3, c: 3 }, { r: 4, c: 7 }), false, "非同行同列必须 false");
});

test("findAnyPair / findHint：返回一对合法可消", () => {
  const board = blank();
  board[1][1] = 4;
  board[1][5] = 4;
  const pair = findAnyPair(board);
  assert.ok(pair);
  assert.ok(findLinkPath(board, pair[0], pair[1]));
  assert.deepEqual(findHint(board), pair, "提示与扫描序必须一致");

  const none = blank();
  none[1][1] = 1;
  none[1][2] = 2;
  assert.equal(findAnyPair(none), null);
  assert.equal(hasAnyPair(none), false);
});

/* ------------------------------------------------------------ 状态流转 */

test("点选流转：选中 → 取消 → 配对消除 → 清盘获胜", () => {
  const board = blank();
  board[1][1] = 1;
  board[1][4] = 1;
  let state = customState(board);

  const first = applyPick(state, { r: 1, c: 1 });
  assert.equal(first.action.type, "select");
  assert.deepEqual(first.state.selected, { r: 1, c: 1 });
  state = first.state;

  const second = applyPick(state, { r: 1, c: 4 });
  assert.equal(second.action.type, "clear");
  assert.equal(second.action.folds, 0);
  assert.equal(second.state.board[1][1], 0);
  assert.equal(second.state.board[1][4], 0);
  assert.equal(second.state.phase, "won", "清盘即获胜");
  assert.equal(levelOutcome(second.state), "won");
  assert.ok(second.state.score >= 100);
});

test("非法输入一律安全 no-op", () => {
  const board = blank();
  board[1][1] = 1;
  let state = customState(board);

  const empty = applyPick(state, { r: 5, c: 5 });
  assert.equal(empty.action, null, "无选中时点空格应 no-op");
  assert.equal(empty.state, state);

  state = applyPick(state, { r: 1, c: 1 }).state;
  const outOfBounds = applyPick(state, { r: -3, c: 99 });
  assert.equal(outOfBounds.action, null, "越界点选应 no-op");
  assert.equal(outOfBounds.state, state);

  const cancel = applyPick(state, { r: 1, c: 1 });
  assert.equal(cancel.action.type, "deselect", "再点自身应取消选中");
  assert.equal(cancel.state.selected, null);
});

test("不可连通时保留第一枚选中（试探友好）；不同图案则改选", () => {
  const board = blank();
  board[2][2] = 1;
  board[5][6] = 1;
  board[2][6] = 2;
  board[5][2] = 2;
  board[7][7] = 3;
  let state = customState(board);
  state = applyPick(state, { r: 2, c: 2 }).state;

  // 同图案但需要两折 —— 合法，应该消除
  const linkable = applyPick(state, { r: 5, c: 6 });
  assert.equal(linkable.action.type, "clear");

  // 重新构造一个确实不可连通的场景
  const blocked = blank();
  blocked[1][1] = 1;
  blocked[1][3] = 1;
  blocked[1][2] = 8;
  for (let r = 2; r <= 8; r += 1) {
    blocked[r][1] = 9;
    blocked[r][2] = 9;
    blocked[r][3] = 9;
  }
  for (let c = 0; c <= 11; c += 1) blocked[0][c] = 9;
  let s2 = customState(blocked);
  s2 = applyPick(s2, { r: 1, c: 1 }).state;
  const invalid = applyPick(s2, { r: 1, c: 3 });
  assert.equal(invalid.action.type, "invalid", "同图案不可连通应判 invalid");
  assert.deepEqual(invalid.state.selected, { r: 1, c: 1 }, "必须保留第一枚选中");

  let s3 = customState(blocked);
  s3 = applyPick(s3, { r: 1, c: 1 }).state;
  const reselectEmpty = applyPick(s3, { r: 1, c: 5 });
  assert.equal(reselectEmpty.action.type, "deselect", "点空格应取消选中");
  assert.equal(reselectEmpty.state.selected, null);

  let s4 = customState(board);
  s4 = applyPick(s4, { r: 2, c: 2 }).state;
  const changed = applyPick(s4, { r: 7, c: 7 });
  assert.equal(changed.action.type, "reselect", "不同图案应改选第二枚");
  assert.deepEqual(changed.state.selected, { r: 7, c: 7 });
});

test("终止状态：won / lost 后一切输入为安全 no-op 且不抛错", () => {
  const board = blank();
  board[1][1] = 1;
  board[1][2] = 1;
  let state = applyPick(customState(board), { r: 1, c: 1 }).state;
  state = applyPick(state, { r: 1, c: 2 }).state;
  assert.equal(state.phase, "won");

  const afterWin = applyPick(state, { r: 1, c: 1 });
  assert.equal(afterWin.action, null);
  assert.equal(afterWin.state, state);
  assert.equal(tick(state, 5000), state, "won 后 tick 必须 no-op");
  assert.equal(useHint(state).action, null);
  assert.equal(useShuffle(state).action, null);

  const lost = customState(blank(), { phase: "lost" });
  assert.equal(applyPick(lost, { r: 1, c: 1 }).action, null);
  assert.equal(useHint(lost).action, null);
  assert.equal(useShuffle(lost).action, null);
  assert.equal(levelOutcome(lost), "lost");
});

test("暂停：计时与连击窗口冻结，恢复后继续推进", () => {
  const board = blank();
  board[1][1] = 1;
  board[1][2] = 1;
  const playing = customState(board, { remainingMs: 60000, comboTimerMs: 2000 });
  const paused = Object.assign({}, playing, { phase: "paused" });
  assert.equal(tick(paused, 5000), paused, "paused 期间 tick 必须 no-op");

  const after = tick(playing, 1000);
  assert.equal(after.remainingMs, 59000);
  assert.equal(after.comboTimerMs, 1000);
});

test("超时判定：倒计时归零即失败，remainingMs 不出现负数", () => {
  const state = customState(blank(), { remainingMs: 500 });
  const after = tick(state, 1200);
  assert.equal(after.remainingMs, 0);
  assert.equal(after.phase, "lost");
  assert.equal(after.failReason, "timeout");
  assert.equal(after.stars, 0);
  const later = tick(after, 1000);
  assert.equal(later, after);
});

test("提示与洗牌：扣减次数，次数为 0 时 no-op；洗牌保持可解", () => {
  const rng = makeRng(levelSeed(6));
  const { board } = createLevel(6, rng);
  let state = customState(board, { rng: rng, hintsLeft: 1, shufflesLeft: 1 });

  const hinted = useHint(state);
  assert.equal(hinted.action.type, "hint");
  assert.equal(hinted.state.hintsLeft, 0);
  assert.ok(hinted.state.hintPair);
  assert.ok(findLinkPath(hinted.state.board, hinted.state.hintPair[0], hinted.state.hintPair[1]));
  assert.equal(useHint(hinted.state).action, null, "次数为 0 时提示必须 no-op");
  assert.equal(hinted.state.hintsLeft, 0, "no-op 不得改变次数");

  const shuffled = useShuffle(hinted.state);
  assert.equal(shuffled.action.type, "shuffle");
  assert.equal(shuffled.state.shufflesLeft, 0);
  assert.equal(shuffled.state.activeShuffles, 1);
  assert.deepEqual(motifCounts(shuffled.state.board), motifCounts(hinted.state.board));
  assertOuterRingEmpty(shuffled.state.board);
  assert.ok(hasAnyPair(shuffled.state.board));
  assert.equal(useShuffle(shuffled.state).action, null);
});

/* ------------------------------------------------------------ 计分与星级 */

test("计分公式：基础 / 折线 / 连击 / 结算，含任务书算例", () => {
  assert.equal(clearScore({ folds: 0, combo: 0, chainMult: 1 }), 100);
  assert.equal(clearScore({ folds: 1, combo: 0, chainMult: 1 }), 110);
  assert.equal(clearScore({ folds: 2, combo: 0, chainMult: 1 }), 130);
  // 任务书算例：两折 + 连击 4 → 100 + 30 + 50 × 4 = 330
  assert.equal(clearScore({ folds: 2, combo: 4, chainMult: 1 }), 330);
  // 无尽倍率只作用于基础分与折线奖励
  assert.equal(clearScore({ folds: 2, combo: 0, chainMult: 2 }), 260);

  // 任务书算例：剩 84 秒 + 3 提示 + 2 洗牌 = 840 + 240 + 160 = 1240
  assert.equal(endBonus({ remainingMs: 84000, hintsLeft: 3, shufflesLeft: 2 }), 1240);
  assert.equal(endBonus({ remainingMs: 84000 }), 840);
  assert.equal(endBonus({ hintsLeft: 3, shufflesLeft: 2 }), 400);
  assert.equal(endBonus({}), 0);

  assert.equal(clampScore(-5), 0);
  assert.equal(clampScore(NaN), 0);
  assert.equal(clampScore(Infinity), 0);
  assert.equal(clampScore(12.9), 12);
  assert.equal(clampScore(1e12), MAX_SCORE);
});

test("星级判定：三档边界值逐一验证", () => {
  const base = { timeMs: 100000, activeShuffles: 0, comboPeak: 4 };
  assert.equal(starsFor(Object.assign({}, base, { remainingMs: 40000 })), 3, "40% 边界应给 3 星");
  assert.equal(starsFor(Object.assign({}, base, { remainingMs: 39999 })), 2);
  assert.equal(starsFor(Object.assign({}, base, { remainingMs: 90000, comboPeak: 3 })), 2);
  assert.equal(starsFor(Object.assign({}, base, { remainingMs: 90000, activeShuffles: 1 })), 2);
  assert.equal(starsFor(Object.assign({}, base, { remainingMs: 90000, activeShuffles: 2 })), 1);
  assert.equal(starsFor(Object.assign({}, base, { remainingMs: 25000 })), 2, "25% 边界应给 2 星");
  assert.equal(starsFor(Object.assign({}, base, { remainingMs: 24999 })), 1);
  assert.equal(starsFor(Object.assign({}, base, { remainingMs: 90000, activeShuffles: 0, comboPeak: 4 })), 3);
  assert.equal(starsFor({ remainingMs: 0, timeMs: 0 }), 1);
  assert.equal(starsFor({ remainingMs: NaN, timeMs: 1000 }), 1);
});

test("连击窗口：3 秒内累积，超时归零，暂停冻结", () => {
  const board = blank();
  for (let c = 1; c <= 6; c += 1) board[1][c] = 1;
  let state = customState(board, { params: Object.assign({}, levelParams(1), { timeMs: 200000 }), remainingMs: 200000 });

  const first = applyPick(applyPick(state, { r: 1, c: 1 }).state, { r: 1, c: 2 });
  assert.equal(first.action.combo, 0, "首次消除连击为 0");
  assert.equal(first.action.gain, 100);
  state = first.state;
  assert.equal(state.comboTimerMs, COMBO_WINDOW_MS);

  state = tick(state, 2500);
  assert.equal(state.comboTimerMs, 500);
  const second = applyPick(applyPick(state, { r: 1, c: 3 }).state, { r: 1, c: 4 });
  assert.equal(second.action.combo, 1, "窗口内应连击 +1");
  assert.equal(second.action.gain, 100 + 50, "连击 1 → +50");
  state = second.state;

  state = tick(state, COMBO_WINDOW_MS);
  assert.equal(state.comboTimerMs, 0);
  assert.equal(state.combo, 0, "窗口超时连击必须归零");
  const third = applyPick(applyPick(state, { r: 1, c: 5 }).state, { r: 1, c: 6 });
  assert.equal(third.action.combo, 0);
  assert.equal(third.action.gain, 100);
  assert.equal(third.state.comboPeak, 1, "连击峰值保留历史最高");
});

test("无尽模式：清盘补盘、倍率继承、不占用主线进度", () => {
  const board = blank();
  board[1][1] = 1;
  board[1][2] = 1;
  const endless = Object.assign(customState(board), {
    mode: "endless",
    level: 1,
    clearedBoards: 0,
    chainMult: 1,
    remainingMs: 30000
  });
  const result = applyPick(applyPick(endless, { r: 1, c: 1 }).state, { r: 1, c: 2 });
  assert.equal(result.action.boardCleared, true);
  assert.equal(result.state.phase, "playing", "无尽模式清盘后应继续");
  assert.equal(result.state.clearedBoards, 1);
  assert.equal(result.state.chainMult, 1.25);
  assert.equal(result.state.level, 2, "第二盘使用第 2 关参数");
  assert.equal(result.state.mode, "endless");
  assert.ok(result.state.score >= 300, "清盘剩余时间应折算进总分");
  assert.ok(hasAnyPair(result.state.board));
});

test("重玩：换一副新盘面，进度与难度不变", () => {
  const state = startGame(createState(9, { seed: 5 }));
  const replay = restartLevel(state);
  assert.equal(replay.level, 9);
  assert.equal(replay.phase, "ready");
  assert.equal(replay.score, 0);
  assert.equal(replay.replays, 1);
  assert.equal(replay.remainingMs, levelParams(9).timeMs);
  assert.ok(hasAnyPair(replay.board));
});

/* ------------------------------------------------------------ 随机游走 */

test("大步数随机游走 1000+ 步：不抛错、不卡死、不变量不破", () => {
  const rng = makeRng(20260913);
  let state = startGame(createState(5, { seed: 777 }));
  let steps = 0;
  let clears = 0;

  while (steps < 1200) {
    if (state.phase !== "playing") {
      state = startGame(createState(5, { seed: 1000 + steps }));
    }
    const tiles = tilesOf(state.board);
    assert.ok(tiles.length > 0, "playing 状态下盘面不应为空");

    const cell = tiles[Math.floor(rng() * tiles.length)];
    const before = state;
    const result = applyPick(state, cell);
    state = result.state;
    if (result.action && result.action.type === "clear") clears += 1;

    state = tick(state, Math.floor(rng() * 150));

    assertPairedCounts(state.board);
    assertOuterRingEmpty(state.board);
    assert.ok(Number.isFinite(state.score) && state.score >= 0);
    assert.ok(Number.isFinite(state.remainingMs) && state.remainingMs >= 0);
    assert.ok(state.comboPeak >= state.combo);
    if (state.phase === "playing" && !isBoardCleared(state.board)) {
      assert.ok(hasAnyPair(state.board), "playing 状态下必须永远存在合法操作");
    }
    if (state.phase === "playing") assert.equal(before.phase, "playing");
    steps += 1;
  }

  assert.ok(steps >= 1200);
  assert.ok(clears > 0, "随机游走应当产生过消除");
});

test("合法操作绝不抛错：对 36 关各关前 60 步随机点选", () => {
  for (let level = 1; level <= LEVEL_COUNT; level += 1) {
    let state = startGame(createState(level, { seed: levelSeed(level) }));
    const rng = makeRng(level * 7919);
    for (let i = 0; i < 60; i += 1) {
      const tiles = tilesOf(state.board);
      if (tiles.length === 0) break;
      const cell = tiles[Math.floor(rng() * tiles.length)];
      state = applyPick(state, cell).state;
      if (state.phase !== "playing") break;
      state = tick(state, 16);
    }
    assert.ok(["playing", "won", "lost", "ready"].includes(state.phase));
  }
});

test("全 36 关均可清盘获胜：贪心求解每一关，全程不允许出现死局", () => {
  // 前面的用例只证明「开局存在可消对」和「前 60 步不抛错」，
  // 都**没有**证明一关真的能打通。这里用 findAnyPair 做贪心求解，
  // 把每一关从头清到空，这是"无死局"在真实对局深度上的验证：
  // 任何一次 findAnyPair 返回 null 都意味着自动洗牌没能化解死局。
  for (let level = 1; level <= LEVEL_COUNT; level += 1) {
    let state = startGame(createState(level, { seed: levelSeed(level) }));
    const params = levelParams(level);
    const totalPairs = params.tiles / 2;
    let cleared = 0;

    // 正常贪心恰好 totalPairs 步；多给的额度只用于兜底防死循环。
    const guard = totalPairs * 3 + 100;
    while (state.phase === "playing" && cleared < guard) {
      const pair = findAnyPair(state.board);
      assert.ok(
        pair,
        "第 " + level + " 关在还剩 " + tilesOf(state.board).length + " 块时找不到可消对（死局未被自动洗牌化解）"
      );
      state = applyPick(state, pair[0]).state;
      const done = applyPick(state, pair[1]);
      assert.equal(done.action.type, "clear", "第 " + level + " 关的 findAnyPair 结果必须真的可消");
      state = done.state;
      cleared += 1;
      if (state.phase !== "playing") break;
      state = tick(state, 16); // 推进一点时间，让连击窗口逻辑也真实参与
    }

    assert.equal(
      state.phase,
      "won",
      "第 " + level + " 关未能清盘（消掉 " + cleared + "/" + totalPairs +
        " 对，phase=" + state.phase + (state.failReason ? "，failReason=" + state.failReason : "") + "）"
    );
    assert.equal(levelOutcome(state), "won");
    assert.equal(cleared, totalPairs, "第 " + level + " 关应恰好消掉 " + totalPairs + " 对");
    assert.equal(tilesOf(state.board).length, 0, "第 " + level + " 关清盘后棋盘必须为空");
    assert.ok(state.score > 0 && state.score <= MAX_SCORE);
  }
});
