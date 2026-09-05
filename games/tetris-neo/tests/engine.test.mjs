import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  BOARD_CONFIGS,
  BagRandomizer,
  COLORS,
  DIFFICULTY_CONFIGS,
  LINE_SCORES,
  LINES_PER_LEVEL,
  PIECE_TYPES,
  SHAPES,
  collide,
  createMatrix,
  createPiece,
  dropIntervalFor,
  dropPosition,
  findFullRows,
  levelForLines,
  mergeInto,
  removeRows,
  rotateMatrix,
  rotateWithKick,
  scoreForLines,
} from "../js/engine.mjs";

const here = dirname(fileURLToPath(import.meta.url));

// 确定性 rng：线性同余，测试里代替 Math.random。
function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function filledCells(piece) {
  const cells = [];
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) cells.push({ x: piece.pos.x + x, y: piece.pos.y + y });
    });
  });
  return cells;
}

test("数值表：七种方块各有一色，三档棋盘与三档难度齐备且已冻结", () => {
  assert.deepEqual(PIECE_TYPES, ["I", "J", "L", "O", "S", "T", "Z"]);
  assert.deepEqual(Object.keys(SHAPES).sort(), [...PIECE_TYPES].sort());
  assert.deepEqual(Object.keys(COLORS).sort(), [...PIECE_TYPES].sort());
  assert.deepEqual(Object.keys(BOARD_CONFIGS), ["mini", "standard", "wide"]);
  assert.deepEqual(Object.keys(DIFFICULTY_CONFIGS), ["casual", "normal", "master"]);
  assert.deepEqual(BOARD_CONFIGS.standard, { cols: 10, rows: 20 });
  assert.deepEqual(BOARD_CONFIGS.mini, { cols: 8, rows: 16 });
  assert.deepEqual(BOARD_CONFIGS.wide, { cols: 12, rows: 22 });
  assert.equal(Object.isFrozen(SHAPES), true);
  assert.equal(Object.isFrozen(SHAPES.T[0]), true);
  assert.equal(Object.isFrozen(DIFFICULTY_CONFIGS.master), true);
  for (const type of PIECE_TYPES) {
    const matrix = SHAPES[type];
    assert.equal(matrix.every((row) => row.length === matrix[0].length), true, `${type} 必须是矩形`);
    const cells = filledCells(createPiece(type, 10));
    assert.equal(cells.length > 0, true, `${type} 不能是空形状`);
    assert.equal(cells.length <= 4, true, `${type} 最多四格`);
  }
});

test("createMatrix / createPiece：空盘填 0，出块水平居中且不越界", () => {
  const grid = createMatrix(10, 20);
  assert.equal(grid.length, 20);
  assert.equal(grid.every((row) => row.length === 10 && row.every((cell) => cell === 0)), true);

  for (const [board, cfg] of Object.entries(BOARD_CONFIGS)) {
    for (const type of PIECE_TYPES) {
      const piece = createPiece(type, cfg.cols);
      assert.equal(piece.pos.y, 0, board);
      assert.equal(
        piece.pos.x,
        (cfg.cols / 2 | 0) - (SHAPES[type][0].length / 2 | 0),
        `${board}/${type} 出块横坐标`,
      );
      assert.equal(piece.color, COLORS[type]);
      assert.equal(piece.type, type);
      for (const cell of filledCells(piece)) {
        assert.ok(cell.x >= 0 && cell.x < cfg.cols, `${board}/${type} 出块越界 x=${cell.x}`);
        assert.ok(cell.y >= 0 && cell.y < cfg.rows, `${board}/${type} 出块越界 y=${cell.y}`);
      }
    }
  }
});

test("rotateMatrix：顺时针 90°，转四次回到原姿态", () => {
  assert.deepEqual(rotateMatrix(SHAPES.T), [[0, 1, 0], [0, 1, 1], [0, 1, 0]]);
  assert.deepEqual(rotateMatrix(SHAPES.O), SHAPES.O.map((row) => [...row]));
  for (const type of PIECE_TYPES) {
    let matrix = SHAPES[type];
    for (let i = 0; i < 4; i += 1) matrix = rotateMatrix(matrix);
    assert.deepEqual(matrix, SHAPES[type].map((row) => [...row]), `${type} 四次旋转应复原`);
  }
});

test("collide：左右底越界算碰撞，顶部之上不算，占用格算碰撞", () => {
  const grid = createMatrix(10, 20);
  const o = createPiece("O", 10);

  o.pos = { x: 4, y: 4 };
  assert.equal(collide(grid, o), false);
  assert.equal(collide(grid, o, { x: 0, y: 1 }), false);

  o.pos = { x: -1, y: 4 };
  assert.equal(collide(grid, o), true, "左越界");
  o.pos = { x: 9, y: 4 };
  assert.equal(collide(grid, o), true, "右越界");
  o.pos = { x: 4, y: 19 };
  assert.equal(collide(grid, o), true, "底越界");

  // I 的实心行在矩阵第 1 行：y=-2 时实心格落在盘外之上，不算碰撞（出块瞬间不能被判定为死）
  const i = createPiece("I", 10);
  i.pos = { x: 3, y: -2 };
  assert.equal(collide(grid, i), false, "顶部之上不算碰撞");
  i.pos = { x: 3, y: -1 };
  assert.equal(collide(grid, i), false, "实心行刚好压在顶行");

  grid[5][5] = COLORS.T;
  o.pos = { x: 4, y: 4 };
  assert.equal(collide(grid, o), true, "压到已占用格");
  o.pos = { x: 6, y: 4 };
  assert.equal(collide(grid, o), false);
});

test("rotateWithKick：空地原地转，贴墙靠墙踢救回，救不回时返回 null 且不动原方块", () => {
  const grid = createMatrix(10, 20);

  const open = createPiece("T", 10);
  open.pos = { x: 3, y: 5 };
  const spun = rotateWithKick(grid, open);
  assert.deepEqual(spun.matrix, rotateMatrix(SHAPES.T));
  assert.deepEqual(spun.pos, { x: 3, y: 5 }, "空地不需要墙踢");
  assert.deepEqual(open.matrix, SHAPES.T.map((row) => [...row]), "不得改动传入的方块");

  // T 贴右墙：转成"T 朝右"后实心格会落到第 10 列，需要向左踢 1 格
  const wall = createPiece("T", 10);
  wall.pos = { x: 8, y: 5 };
  const kicked = rotateWithKick(grid, wall);
  assert.ok(kicked, "贴墙旋转应被墙踢救回");
  assert.equal(kicked.pos.x, 7);
  assert.equal(collide(grid, kicked), false);
  for (const cell of filledCells(kicked)) {
    assert.ok(cell.x >= 0 && cell.x < 10, `墙踢后仍越界 x=${cell.x}`);
  }

  // 两侧夹死：3 宽竖条被墙与堆叠夹住，任何墙踢都失败 → null 且原方块分毫不动
  const boxed = createMatrix(10, 20);
  for (let y = 0; y < 20; y += 1) {
    boxed[y][0] = COLORS.J;
    boxed[y][2] = COLORS.J;
  }
  const stuck = { matrix: rotateMatrix(SHAPES.T), color: COLORS.T, type: "T", pos: { x: 0, y: 5 } };
  const before = JSON.stringify(stuck);
  assert.equal(rotateWithKick(boxed, stuck), null, "无处可踢时应放弃旋转");
  assert.equal(JSON.stringify(stuck), before, "旋转失败不得留下横向漂移");
});

test("dropPosition：空盘落到底，有堆叠时停在堆上", () => {
  const grid = createMatrix(10, 20);
  const o = createPiece("O", 10);
  o.pos = { x: 3, y: 0 };
  assert.equal(dropPosition(grid, o), 18, "2 高方块落在第 18 行");

  grid[19][3] = COLORS.S;
  grid[19][4] = COLORS.S;
  assert.equal(dropPosition(grid, o), 17, "底部被占则停在第 17 行");
  assert.equal(o.pos.y, 0, "dropPosition 不得移动原方块");
});

test("mergeInto：写入方块颜色，盘外之上的格子安全跳过", () => {
  const grid = createMatrix(10, 20);
  const o = createPiece("O", 10);
  o.pos = { x: 2, y: 18 };
  mergeInto(grid, o);
  assert.deepEqual(grid[18].slice(2, 4), [COLORS.O, COLORS.O]);
  assert.deepEqual(grid[19].slice(2, 4), [COLORS.O, COLORS.O]);
  assert.equal(grid[18].filter((cell) => cell !== 0).length, 2);

  const fresh = createMatrix(10, 20);
  const i = createPiece("I", 10);
  i.pos = { x: 3, y: -2 };
  mergeInto(fresh, i);
  assert.equal(fresh.flat().every((cell) => cell === 0), true, "实心行在盘外之上时不应写入任何格");
});

test("findFullRows / removeRows：只删满行，顶部补等量空行，其余顺序不变", () => {
  const grid = [
    [0, 0, 0, 0],
    ["#a", "#a", "#a", "#a"],
    [0, 0, 0, 0],
    ["#b", "#b", "#b", "#b"],
    [0, "#c", 0, 0],
  ];
  assert.deepEqual(findFullRows(grid), [1, 3]);

  const next = removeRows(grid, findFullRows(grid));
  assert.equal(next.length, grid.length, "行数必须守恒");
  assert.deepEqual(next, [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, "#c", 0, 0],
  ]);
  assert.deepEqual(findFullRows(next), []);
  assert.deepEqual(grid[1], ["#a", "#a", "#a", "#a"], "原棋盘不得被就地改动");

  assert.deepEqual(removeRows(grid, []), grid);
});

test("计分与升级：单次消行越多越值钱，等级按累计行数推进，速度有下限", () => {
  assert.deepEqual([...LINE_SCORES], [0, 100, 300, 500, 800]);
  assert.equal(LINES_PER_LEVEL, 10);
  assert.equal(scoreForLines(0, 5), 0);
  assert.equal(scoreForLines(1, 1), 100);
  assert.equal(scoreForLines(2, 1), 300);
  assert.equal(scoreForLines(3, 1), 500);
  assert.equal(scoreForLines(4, 1), 800);
  assert.equal(scoreForLines(4, 3), 2400, "得分随等级放大");

  assert.equal(levelForLines(0), 1);
  assert.equal(levelForLines(9), 1);
  assert.equal(levelForLines(10), 2);
  assert.equal(levelForLines(19), 2);
  assert.equal(levelForLines(20), 3);
  assert.equal(levelForLines(99), 10);

  assert.equal(dropIntervalFor("normal", 1), 800);
  assert.equal(dropIntervalFor("normal", 2), 730);
  assert.equal(dropIntervalFor("master", 1), 360);
  assert.equal(dropIntervalFor("casual", 1), 1050);
  assert.equal(dropIntervalFor("casual", 99), 180, "不得低于 minSpeed");
  assert.equal(dropIntervalFor("master", 99), 60);
  assert.equal(dropIntervalFor("不存在的难度", 1), 800, "未知难度退回 standard");
});

test("7-Bag：每七个一组不重复且覆盖全部方块，rng 可注入", () => {
  const bag = new BagRandomizer(PIECE_TYPES, lcg(20260905));
  const drawn = [];
  for (let i = 0; i < 70; i += 1) drawn.push(bag.next());
  for (let start = 0; start < drawn.length; start += 7) {
    const group = drawn.slice(start, start + 7).sort();
    assert.deepEqual(group, [...PIECE_TYPES].sort(), `第 ${start / 7 + 1} 组不是完整七袋`);
  }

  const sameSeed = new BagRandomizer(PIECE_TYPES, lcg(20260905));
  assert.deepEqual(
    Array.from({ length: 14 }, () => sameSeed.next()),
    drawn.slice(0, 14),
    "同种子必须给出同一序列（存档恢复依赖可复现）",
  );

  const wild = new BagRandomizer();
  assert.equal(Array.isArray(wild.bag), true, "bag 必须可序列化进存档");
  wild.next();
  assert.ok(wild.bag.length <= 6);
  wild.reset();
  assert.deepEqual(wild.bag, []);
  assert.equal(wild.next() !== undefined, true, "reset 后仍可继续发牌");
});

test("engine.mjs 是 DOM-free 的规则层", () => {
  const src = readFileSync(resolve(here, "../js/engine.mjs"), "utf8");
  // 先剥注释，否则说明性注释里提到的名字会被误判成违规。
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.equal(/\bdocument\b/.test(code), false, "engine 不得碰 document");
  assert.equal(/\bwindow\b/.test(code), false, "engine 不得碰 window");
  assert.equal(/localStorage/.test(code), false, "engine 不得碰 localStorage");
});
