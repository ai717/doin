// 霓虹弹珠台 · 关卡数据（纯数据模块，DOM-free）
// 行模板：每行 12 列，字符含义：
//   '.' 空白区弹道（永久空位，决定弹珠下落路径）
//   'G' 玻璃砖(1击) / 'S' 钢铁砖(2击) / 'A' 黄金砖(3击)
// 可解性硬约束：每一列在整关行集合中至少存在 1 个空位（垂直通道），
// 由 engine 的 checkLevelSolvable() 与 tests/levels.test.mjs 双重校验。

export const COLS = 12;
export const BRICK_CELL_W = 44; // 砖格宽（含间距）
export const BRICK_CELL_H = 22; // 砖格高（含间距）
export const WALL_TOP = 74;     // 砖墙起始 y
export const BRICK_BODY_W = 40;
export const BRICK_BODY_H = 18;

export const CHAPTERS = [
  { id: 1, nameKey: "chapter1", themeKey: "themeGlass", levelCount: 10 },
  { id: 2, nameKey: "chapter2", themeKey: "themeSteel", levelCount: 10 },
  { id: 3, nameKey: "chapter3", themeKey: "themeGold", levelCount: 10 }
];

// 机关默认配置（章节特征）：sling 侧弹射器为机台常驻件，不在关卡数据中重复声明
export const CHAPTER_MECHS = {
  1: { bumpers: [[300, 320]], targets: null, spinner: null, ramp: null, rollovers: null },
  2: { bumpers: [[240, 310], [360, 310]], targets: [[260, 380], [300, 380], [340, 380]], spinner: null, ramp: null, rollovers: null },
  3: {
    bumpers: [[210, 300], [300, 330], [390, 300]],
    targets: [[260, 380], [300, 380], [340, 380]],
    spinner: [110, 320],
    ramp: { p1: [490, 330], p2: [570, 210], zone: [560, 205] },
    rollovers: { y: 52, left: [60, 255], right: [345, 540] }
  }
};

const L1 = [
  "GGG.GGG.GGG.",
  "G.GGG.GGG.GG",
  "GG.GGGGG.G.G",
  "GGG.G.GGGG.G",
  "G.GGG.GGG.GG"
];
const L2 = [
  "GGG.GGG.G.GG",
  "GG.GGGG.GG.G",
  "G.GGG.GGG.GG",
  "GGG.G.GG.GGG",
  "G.GGG.GGGG.G"
];
const L3 = [
  "GGG.GGGG.GG.",
  "GG.GG.GGG.GG",
  "G.GGGG.GG.GG",
  "GG.GGGG.GG.G",
  "GGG.GG.GGG.G"
];
const L4 = [
  "GG.GGG.GGG.G",
  "G.GGGG.GGG.G",
  "GGG.G.GG.GGG",
  "G.GGGG.GG.GG",
  "GG.GGGG.GGG.",
  "G.GGG.GG.GGG"
];
const L5 = [
  "GGG.GG.GGG.G",
  "GG.GGGG.GG.G",
  "G.GGG.GGG.GG",
  "GGG.G.GGGG.G",
  "GG.GGG.GG.GG",
  "G.GGGG.GG.GG"
];
const L6 = [
  "GG.GGGG.GG.G",
  "G.GGG.GGGG.G",
  "GGG.GG.GG.GG",
  "GG.GGGG.GGG.",
  "G.GGG.GG.GGG",
  "GG.GG.GGGG.G"
];
const L7 = [
  "G.GGGG.GGG.G",
  "GG.GGG.GG.GG",
  "GGG.GG.GGG.G",
  "GG.GGGG.GG.G",
  "G.GGG.GGGG.G",
  "GGG.G.GGG.GG",
  "G.GGGG.GG.GG"
];
const L8 = [
  "GGG.GGG.GG.G",
  "G.GG.GGGG.GG",
  "GG.GGG.GGG.G",
  "GGG.GG.GG.GG",
  "G.GGGG.GGG.G",
  "GG.GGG.GG.GG",
  "GGG.GG.GGGG."
];
const L9 = [
  "GG.GGGG.GGG.",
  "G.GGG.GG.GGG",
  "GGG.GG.GGG.G",
  "GG.GGG.GG.GG",
  "G.GGGG.GGG.G",
  "GGG.GG.GG.GG",
  "G.GGG.GGGG.G",
  "GG.GGGG.GG.G"
];
const L10 = [
  "GGG.G.GGGG.G",
  "G.GGGG.GG.GG",
  "GG.GGG.GGG.G",
  "GGG.GG.GG.GG",
  "G.GGG.GGGG.G",
  "GG.GG.GGG.GG",
  "GGG.GGG.GG.G",
  "G.GGGG.GGG.G"
];
const L11 = [
  "SGS.GSG.SG.G",
  "G.SGG.GS.GSG",
  "SG.GS.GS.GSG",
  "G.GSG.SGG.SG",
  "SGG.SG.GS.GG",
  "GS.GSG.GSG."
];
const L12 = [
  "SG.GSG.SG.GS",
  "GSS.GG.SG.GG",
  "SG.GSG.GSG.S",
  "GS.GSG.GG.SG",
  "G.GSS.GS.GSG",
  "SGS.GG.SG.GS"
];
const L13 = [
  "SGS.GSG.GS.G",
  "G.SG.GSS.GS",
  "SG.GSG.SG.GG",
  "GSS.GG.GSG.S",
  "GS.GSG.GS.GG",
  "SG.GSS.G.GS"
];
const L14 = [
  "SGS.GS.GSG.G",
  "GS.GSG.SG.GS",
  "SG.GSS.GG.SG",
  "G.GSG.GS.GSG",
  "SGG.SG.GS.GG",
  "GS.GSG.SG.GS",
  "G.SGS.GSG.G"
];
const L15 = [
  "SGS.GSG.GS.G",
  "G.SGG.SG.GSG",
  "SG.GS.GSS.GG",
  "GSS.GG.GSG.S",
  "SG.GSG.GS.GS",
  "G.GSS.GS.GSG",
  "SGS.GG.SG.GG"
];
const L16 = [
  "SG.GSG.SG.GS",
  "GSS.GG.SG.GG",
  "SG.GS.GSG.SG",
  "GS.GSG.GSS.G",
  "G.SGG.SG.GSG",
  "SGS.GG.GS.GG",
  "GS.GSG.SG.GS",
  "G.GSS.GSG.SG"
];
const L17 = [
  "SGS.GSG.GS.G",
  "GS.GSG.SG.GS",
  "SG.GSS.GG.SG",
  "G.SG.GSS.GSG",
  "SGG.SG.GS.GG",
  "GS.GSG.GSS.G",
  "SG.GS.GG.SGS"
];
const L18 = [
  "SG.GSG.SGS.G",
  "GSS.GG.SG.GS",
  "SGS.GG.GS.GG",
  "G.SG.GSS.GSG",
  "GS.GSG.GS.GS",
  "SG.GSS.GG.SG",
  "G.SGG.SG.GSG",
  "SGS.GSG.GG.S"
];
const L19 = [
  "SGS.GSG.GS.G",
  "G.SG.GSS.GSG",
  "SGG.SG.GS.GG",
  "GS.GSG.SG.GS",
  "G.SGS.GSG.GS",
  "SGS.GG.GSS.G",
  "GS.GS.GG.SGS",
  "G.GSG.SGS.GG"
];
const L20 = [
  "SGS.GSG.GS.G",
  "GS.GS.GSS.GG",
  "G.SGG.SG.GSG",
  "SGG.SG.GS.GS",
  "GS.GSG.SG.GG",
  "G.SGS.GSG.GS",
  "SGS.GG.GSS.G",
  "SG.GSG.GS.GG"
];
const L21 = [
  "GAS.GAG.AG.G",
  "A.GGA.GA.GAG",
  "GAG.AG.GA.GG",
  "A.GAG.GAG.AG",
  "GGA.GA.GAG.G",
  "AG.GAG.AG.GA",
  "G.AGG.GA.GAG"
];
const L22 = [
  "AGA.GAG.AG.G",
  "G.AGG.AG.GAG",
  "GAG.AG.GAG.A",
  "AG.GA.GAG.GA",
  "GGA.AG.GA.GAG",
  "A.GAG.GAG.GA",
  "G.AGG.GA.AGG"
];
const L23 = [
  "GAG.AG.GAG.G",
  "A.GGA.GA.GAG",
  "GGA.GAG.AG.GA",
  "AG.AG.GAG.GAG",
  "G.AGG.GA.GAG",
  "GAG.GA.AG.GA",
  "AG.GAG.AG.AG"
];
const L24 = [
  "AGA.GAG.AG.G",
  "G.AG.GA.GAGG",
  "GAG.AG.GAG.A",
  "AG.GAG.GA.GG",
  "GGA.GA.GAG.AG",
  "A.GAG.GAG.GA",
  "G.AGG.AG.GAG",
  "AG.GA.GG.AGA"
];
const L25 = [
  "GAG.AG.GAG.G",
  "A.GGA.AG.GAG",
  "GGA.GAG.AG.AG",
  "AG.GA.GAGG.GA",
  "G.AGG.GA.GAG",
  "GAG.GAG.AG.GA",
  "AG.AG.GAG.GAG",
  "GGA.GA.AG.AGG"
];
const L26 = [
  "AGA.GAG.AG.G",
  "G.AG.GA.GAG",
  "GAG.AG.GAG.A",
  "AG.GAG.GA.AG",
  "GGA.AG.GAG.GA",
  "G.AGG.GA.GAG",
  "AG.GAG.AG.AG",
  "GGA.GA.GAG.GG"
];
const L27 = [
  "GAG.AG.GAG.A",
  "GGA.GA.AG.GAG",
  "A.GAG.GAG.GA",
  "AG.AG.GA.GAG",
  "GGA.GAG.AG.AG",
  "G.AGG.GA.AGG",
  "AG.GA.GAG.GAG",
  "GGA.AG.GA.GAG",
  "A.GAG.AG.GAG"
];
const L28 = [
  "AGA.GAG.AG.GA",
  "G.AGG.GA.GAG",
  "GAG.AG.GAG.A",
  "AG.GA.GAGG.GA",
  "GGA.GA.GAG.AG",
  "A.GAG.AG.GAG",
  "GGA.GAG.AG.AG",
  "AG.GAG.GA.AGG",
  "G.AG.GA.GAG"
];
const L29 = [
  "GAG.AG.GAG.A",
  "A.GGA.GA.GAG",
  "GGA.GAG.AG.GA",
  "AG.AG.GAG.GAG",
  "G.AGG.GA.AGG",
  "AG.GAG.AG.GA",
  "GGA.GA.GAG.AG",
  "G.AG.GAG.GAG",
  "AG.GGA.AG.GAG"
];
const L30 = [
  "AGA.GAG.AG.G",
  "G.AG.GA.GAGG",
  "GGA.GAG.AG.AG",
  "AG.GA.GAG.GA",
  "GAG.AG.GAG.A",
  "A.GAG.GAG.AG",
  "GGA.GAG.AG.GA",
  "AG.AG.GAG.GAG",
  "G.AG.GA.GAG",
  "AG.GGA.AG.GAG"
];

// 每个关卡的星级目标：[time(秒), combo(最高连击)]
const TARGETS = {
  1: [75, 8], 2: [78, 9], 3: [80, 9], 4: [85, 10], 5: [88, 10],
  6: [92, 11], 7: [95, 11], 8: [100, 12], 9: [105, 13], 10: [110, 14],
  11: [112, 15], 12: [115, 15], 13: [120, 16], 14: [125, 16], 15: [130, 17],
  16: [135, 17], 17: [140, 18], 18: [145, 18], 19: [150, 19], 20: [155, 20],
  21: [160, 21], 22: [165, 22], 23: [170, 22], 24: [175, 23], 25: [180, 24],
  26: [185, 25], 27: [190, 26], 28: [195, 27], 29: [198, 28], 30: [200, 30]
};

const ROW_SETS = {
  1: L1, 2: L2, 3: L3, 4: L4, 5: L5, 6: L6, 7: L7, 8: L8, 9: L9, 10: L10,
  11: L11, 12: L12, 13: L13, 14: L14, 15: L15, 16: L16, 17: L17, 18: L18,
  19: L19, 20: L20, 21: L21, 22: L22, 23: L23, 24: L24, 25: L25, 26: L26,
  27: L27, 28: L28, 29: L29, 30: L30
};

function chapterOf(id) {
  if (id >= 1 && id <= 10) return 1;
  if (id >= 11 && id <= 20) return 2;
  return 3;
}

// 确定性归一化：截断超列行、补足不足行、被封死的列打出一个通道空位（可解性保证）
function normalizeRows(rows) {
  const fixed = rows.map((line) => line.slice(0, COLS).padEnd(COLS, "."));
  for (let col = 0; col < COLS; col++) {
    let hasGap = false;
    for (const line of fixed) if (line[col] === ".") { hasGap = true; break; }
    if (!hasGap) {
      const r = col % fixed.length;
      fixed[r] = fixed[r].slice(0, col) + "." + fixed[r].slice(col + 1);
    }
  }
  return fixed;
}

// 组装 30 个关卡定义（行模板 + 章节机关 + 星级目标）
export const LEVELS = Object.keys(ROW_SETS).map((key) => {
  const id = Number(key);
  const rows = normalizeRows(ROW_SETS[id]);
  return {
    id,
    chapter: chapterOf(id),
    rows,
    mechs: CHAPTER_MECHS[chapterOf(id)],
    targets: { time: TARGETS[id][0], combo: TARGETS[id][1] }
  };
});

// 街机生存模式的初始砖墙（生成时注入 rng，此处仅给行模板骨架）
export const SURVIVAL_ROWS = 7;
