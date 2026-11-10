// 20 关传送门推箱关卡：10×12 实验台，5 章 × 4 关。
// 数据全部为坐标与英文枚举，展示文案由 i18n 查表；optimal 由 BFS 求解器验算。

import { COLS, ROWS } from "./engine.mjs";

export const CHAPTERS = Object.freeze([
  { key: "chapter_ch1", tagKey: "tag_ch1" },
  { key: "chapter_ch2", tagKey: "tag_ch2" },
  { key: "chapter_ch3", tagKey: "tag_ch3" },
  { key: "chapter_ch4", tagKey: "tag_ch4" },
  { key: "chapter_ch5", tagKey: "tag_ch5" },
]);

function vwall(col, from, to, skip = []) {
  const out = [];
  for (let row = from; row <= to; row += 1) {
    if (!skip.includes(row)) out.push([col, row]);
  }
  return out;
}

function hwall(row, from, to, skip = []) {
  const out = [];
  for (let col = from; col <= to; col += 1) {
    if (!skip.includes(col)) out.push([col, row]);
  }
  return out;
}

function rect(c1, r1, c2, r2) {
  const out = [];
  for (let row = r1; row <= r2; row += 1) {
    for (let col = c1; col <= c2; col += 1) out.push([col, row]);
  }
  return out;
}

function portal(pair, color, col, row, side) {
  return { pair, color, col, row, side };
}

const RAW = [
  // 第一卷 · 单对虫洞：直线穿梭与隔空运箱
  {
    id: "p01",
    chapter: 1,
    optimal: 5,
    player: [1, 1],
    boxes: [[4, 1]],
    goals: [[9, 1]],
    walls: [...vwall(7, 1, 8), ...vwall(8, 1, 8)],
    portals: [portal("A", "blue", 6, 1, "right"), portal("A", "orange", 9, 1, "left")],
  },
  {
    id: "p02",
    chapter: 1,
    optimal: 11,
    player: [3, 3],
    boxes: [[3, 2]],
    goals: [[6, 7]],
    walls: [...hwall(6, 1, 10), [5, 7], [7, 7], [6, 8]],
    portals: [portal("A", "blue", 6, 5, "down"), portal("A", "orange", 6, 7, "up")],
  },
  {
    id: "p03",
    chapter: 1,
    optimal: 10,
    player: [1, 5],
    boxes: [[2, 5]],
    goals: [[9, 4]],
    walls: [...vwall(7, 1, 8), ...vwall(8, 1, 8), [2, 3], [2, 4]],
    portals: [portal("A", "blue", 6, 4, "right"), portal("A", "orange", 9, 4, "left")],
  },
  {
    id: "p04",
    chapter: 1,
    optimal: 12,
    player: [1, 1],
    boxes: [[4, 1], [2, 2]],
    goals: [[9, 1], [3, 5]],
    walls: [...vwall(7, 1, 8), ...vwall(8, 1, 8), [2, 3]],
    portals: [portal("A", "blue", 6, 1, "right"), portal("A", "orange", 9, 1, "left")],
  },

  // 第二卷 · 方向扭曲：90 度直角折射
  {
    id: "p05",
    chapter: 2,
    optimal: 7,
    player: [1, 2],
    boxes: [[4, 2]],
    goals: [[6, 8]],
    walls: [...vwall(9, 2, 8), [5, 8], [7, 8], [6, 7]],
    portals: [portal("A", "blue", 8, 2, "right"), portal("A", "orange", 6, 8, "down")],
  },
  {
    id: "p06",
    chapter: 2,
    optimal: 9,
    player: [3, 3],
    boxes: [[3, 2]],
    goals: [[10, 6]],
    walls: [[5, 5], [9, 6], [10, 5], [10, 7]],
    portals: [portal("A", "blue", 5, 4, "down"), portal("A", "orange", 10, 6, "left")],
  },
  {
    id: "p07",
    chapter: 2,
    optimal: 10,
    player: [1, 5],
    boxes: [[2, 5]],
    goals: [[10, 7]],
    walls: [[9, 7], [10, 6], [10, 8], [3, 3], [4, 3], [3, 4], [4, 4]],
    portals: [portal("A", "blue", 5, 1, "up"), portal("A", "orange", 10, 7, "right")],
  },
  {
    id: "p08",
    chapter: 2,
    optimal: 10,
    player: [5, 2],
    boxes: [[4, 2]],
    goals: [[9, 7]],
    walls: [[9, 6], [8, 7], [10, 7], [9, 8], [3, 3]],
    portals: [portal("A", "blue", 1, 4, "left"), portal("A", "orange", 9, 7, "up")],
  },

  // 第三卷 · 双色交织：紫绿第二门对
  {
    id: "p09",
    chapter: 3,
    optimal: 20,
    player: [1, 5],
    boxes: [[3, 2], [3, 6]],
    goals: [[9, 2], [9, 6]],
    walls: [...vwall(8, 1, 8)],
    portals: [
      portal("A", "blue", 7, 2, "right"),
      portal("A", "orange", 9, 2, "left"),
      portal("B", "purple", 7, 6, "right"),
      portal("B", "green", 9, 6, "left"),
    ],
  },
  {
    id: "p10",
    chapter: 3,
    optimal: 24,
    player: [1, 4],
    boxes: [[3, 2], [3, 7]],
    goals: [[9, 2], [10, 7]],
    walls: [...vwall(8, 1, 3), [7, 8], [9, 7], [10, 6], [10, 8]],
    portals: [
      portal("A", "blue", 7, 2, "right"),
      portal("A", "orange", 9, 2, "left"),
      portal("B", "purple", 7, 7, "down"),
      portal("B", "green", 10, 7, "right"),
    ],
  },
  {
    id: "p11",
    chapter: 3,
    optimal: 24,
    player: [1, 4],
    boxes: [[2, 2], [2, 7]],
    goals: [[9, 2], [9, 7]],
    walls: [...vwall(8, 1, 8), [3, 3], [4, 3], [5, 3], [3, 6], [4, 6], [5, 6]],
    portals: [
      portal("A", "blue", 7, 2, "right"),
      portal("A", "orange", 9, 2, "left"),
      portal("B", "purple", 7, 7, "right"),
      portal("B", "green", 9, 7, "left"),
    ],
  },
  {
    id: "p12",
    chapter: 3,
    optimal: 20,
    player: [1, 4],
    boxes: [[5, 2], [5, 7], [5, 4]],
    goals: [[9, 2], [9, 7], [3, 5]],
    walls: [...vwall(8, 1, 8)],
    portals: [
      portal("A", "blue", 7, 2, "right"),
      portal("A", "orange", 9, 2, "left"),
      portal("B", "purple", 7, 7, "right"),
      portal("B", "green", 9, 7, "left"),
    ],
  },

  // 第四卷 · 隔空换位：人门互换与箱体转移
  {
    id: "p13",
    chapter: 4,
    optimal: 10,
    player: [2, 4],
    boxes: [[9, 4]],
    goals: [[9, 7]],
    walls: [...vwall(6, 1, 8)],
    portals: [portal("A", "blue", 5, 4, "right"), portal("A", "orange", 7, 4, "left")],
  },
  {
    id: "p14",
    chapter: 4,
    optimal: 25,
    player: [2, 4],
    boxes: [[9, 2], [9, 7]],
    goals: [[9, 4], [9, 6]],
    walls: [...vwall(6, 1, 8), ...hwall(5, 7, 10)],
    portals: [
      portal("A", "blue", 5, 2, "right"),
      portal("A", "orange", 7, 2, "left"),
      portal("B", "purple", 5, 7, "right"),
      portal("B", "green", 7, 7, "left"),
    ],
  },
  {
    id: "p15",
    chapter: 4,
    optimal: 13,
    player: [2, 2],
    boxes: [[3, 2]],
    goals: [[9, 7]],
    walls: [...vwall(6, 1, 8), [8, 4]],
    portals: [
      portal("A", "blue", 5, 2, "right"),
      portal("A", "orange", 9, 4, "left"),
      portal("B", "purple", 5, 4, "right"),
      portal("B", "green", 7, 4, "left"),
    ],
  },
  {
    id: "p16",
    chapter: 4,
    optimal: 15,
    player: [2, 2],
    boxes: [[3, 2], [9, 7]],
    goals: [[9, 4], [10, 6]],
    walls: [...vwall(6, 1, 8), [8, 4]],
    portals: [
      portal("A", "blue", 5, 2, "right"),
      portal("A", "orange", 9, 4, "left"),
      portal("B", "purple", 5, 4, "right"),
      portal("B", "green", 7, 4, "left"),
    ],
  },

  // 第五卷 · 莫比乌斯环：复合双门对终极拓扑
  {
    id: "p17",
    chapter: 5,
    optimal: 26,
    player: [1, 4],
    boxes: [[2, 2], [2, 7]],
    goals: [[9, 2], [10, 7]],
    walls: [...vwall(8, 1, 3), [7, 8], [9, 7], [10, 6], [10, 8], [3, 4], [3, 5]],
    portals: [
      portal("A", "blue", 7, 2, "right"),
      portal("A", "orange", 9, 2, "left"),
      portal("B", "purple", 7, 7, "down"),
      portal("B", "green", 10, 7, "right"),
    ],
  },
  {
    id: "p18",
    chapter: 5,
    optimal: 24,
    player: [1, 1],
    boxes: [[5, 2], [5, 7], [3, 6]],
    goals: [[9, 2], [9, 7], [4, 4]],
    walls: [...vwall(8, 1, 8)],
    portals: [
      portal("A", "blue", 7, 2, "right"),
      portal("A", "orange", 9, 2, "left"),
      portal("B", "purple", 7, 7, "right"),
      portal("B", "green", 9, 7, "left"),
    ],
  },
  {
    id: "p19",
    chapter: 5,
    optimal: 25,
    player: [1, 1],
    boxes: [[5, 2], [5, 7], [4, 5]],
    goals: [[9, 2], [9, 7], [2, 4]],
    walls: [...vwall(8, 1, 8), [3, 3], [3, 6]],
    portals: [
      portal("A", "blue", 7, 2, "right"),
      portal("A", "orange", 9, 2, "left"),
      portal("B", "purple", 7, 7, "right"),
      portal("B", "green", 9, 7, "left"),
    ],
  },
  {
    id: "p20",
    chapter: 5,
    optimal: 25,
    player: [1, 1],
    boxes: [[5, 2], [5, 7], [5, 4]],
    goals: [[9, 2], [10, 7], [3, 5]],
    walls: [...vwall(8, 1, 3), [7, 8], [9, 7], [10, 6], [10, 8], [4, 3], [4, 6]],
    portals: [
      portal("A", "blue", 7, 2, "right"),
      portal("A", "orange", 9, 2, "left"),
      portal("B", "purple", 7, 7, "down"),
      portal("B", "green", 10, 7, "right"),
    ],
  },
];

function buildLevel(raw, index) {
  const grid = Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) => (row === 0 || row === ROWS - 1 || col === 0 || col === COLS - 1 ? "#" : ".")),
  );
  for (const [col, row] of raw.walls) {
    if (col > 0 && col < COLS - 1 && row > 0 && row < ROWS - 1) grid[row][col] = "#";
  }
  const [playerCol, playerRow] = raw.player;
  grid[playerRow][playerCol] = "P";
  for (const [col, row] of raw.boxes) grid[row][col] = "B";
  for (const [col, row] of raw.goals) grid[row][col] = "G";
  return {
    id: raw.id,
    index,
    chapter: raw.chapter,
    optimal: raw.optimal,
    map: grid.map((row) => row.join("")),
    portals: raw.portals.map((item) => ({ ...item })),
  };
}

export const LEVELS = Object.freeze(RAW.map((raw, index) => Object.freeze(buildLevel(raw, index))));
export const LEVEL_COUNT = LEVELS.length;
export const LEVEL_BY_ID = Object.freeze(Object.fromEntries(LEVELS.map((level) => [level.id, level])));

export function getLevel(id) {
  return LEVEL_BY_ID[id] ?? null;
}

export function nextLevel(id) {
  const level = LEVEL_BY_ID[id];
  if (!level) return null;
  return LEVELS[level.index + 1] ?? null;
}
