// levels.mjs — 15 层砖阵编排 + 3 场 Boss。纯数据 + 生成器，DOM-free。
// 砖块类型：0 空 / 1~4 血量 / 5 钢砖(不可破) / 6 爆炸砖 / 7 奖励砖

export const COLS = 10;
export const TOTAL_LAYERS = 15;
export const BOSS_LAYERS = Object.freeze([5, 10, 15]);

export function isBossLayer(layer) {
  return BOSS_LAYERS.includes(layer);
}

// 砖块血量对应的分值
export const BRICK_SCORE = Object.freeze({ 1: 10, 2: 25, 3: 50, 4: 100, 6: 40, 7: 80 });
export const BRICK_HP = Object.freeze({ 1: 1, 2: 2, 3: 3, 4: 4, 5: Infinity, 6: 1, 7: 1 });

function row(pattern) {
  // pattern 是长度 COLS 的数组
  return pattern.slice(0, COLS);
}

// 每层布局：rows 为二维数组（从顶部到底部）
const LAYOUTS = [
  // Layer 1 — 入门：两行 1 血砖
  [
    row([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    row([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
  ],
  // Layer 2 — 三行，中间夹杂 2 血
  [
    row([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    row([1, 2, 1, 2, 1, 1, 2, 1, 2, 1]),
    row([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
  ],
  // Layer 3 — 金字塔
  [
    row([0, 0, 0, 0, 2, 2, 0, 0, 0, 0]),
    row([0, 0, 0, 2, 2, 2, 2, 0, 0, 0]),
    row([0, 0, 2, 2, 3, 3, 2, 2, 0, 0]),
    row([0, 2, 2, 3, 3, 3, 3, 2, 2, 0]),
  ],
  // Layer 4 — 棋盘格
  [
    row([1, 0, 2, 0, 1, 1, 0, 2, 0, 1]),
    row([0, 2, 0, 1, 0, 0, 1, 0, 2, 0]),
    row([1, 0, 2, 0, 1, 1, 0, 2, 0, 1]),
    row([0, 2, 0, 1, 0, 0, 1, 0, 2, 0]),
  ],
  // Layer 5 — Boss 1 前置 + 钢砖障碍
  [
    row([2, 2, 2, 2, 2, 2, 2, 2, 2, 2]),
    row([1, 5, 1, 1, 5, 5, 1, 1, 5, 1]),
    row([2, 2, 2, 2, 2, 2, 2, 2, 2, 2]),
  ],
  // Layer 6 — 菱形
  [
    row([0, 0, 0, 0, 3, 3, 0, 0, 0, 0]),
    row([0, 0, 0, 3, 2, 2, 3, 0, 0, 0]),
    row([0, 0, 3, 2, 1, 1, 2, 3, 0, 0]),
    row([0, 3, 2, 1, 1, 1, 1, 2, 3, 0]),
    row([0, 0, 3, 2, 1, 1, 2, 3, 0, 0]),
  ],
  // Layer 7 — 爆炸砖引入
  [
    row([1, 1, 6, 1, 1, 1, 1, 6, 1, 1]),
    row([2, 2, 2, 2, 2, 2, 2, 2, 2, 2]),
    row([1, 6, 1, 1, 1, 1, 1, 1, 6, 1]),
    row([2, 2, 2, 2, 2, 2, 2, 2, 2, 2]),
  ],
  // Layer 8 — 城墙
  [
    row([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]),
    row([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    row([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]),
    row([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    row([2, 2, 2, 2, 2, 2, 2, 2, 2, 2]),
  ],
  // Layer 9 — 奖励砖迷宫
  [
    row([7, 1, 1, 7, 1, 1, 7, 1, 1, 7]),
    row([1, 2, 2, 1, 2, 2, 1, 2, 2, 1]),
    row([1, 1, 7, 1, 1, 1, 7, 1, 1, 1]),
    row([2, 2, 2, 2, 3, 3, 2, 2, 2, 2]),
    row([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
  ],
  // Layer 10 — Boss 2 前置
  [
    row([4, 4, 4, 4, 4, 4, 4, 4, 4, 4]),
    row([2, 5, 2, 5, 2, 2, 5, 2, 5, 2]),
    row([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]),
    row([2, 5, 2, 5, 2, 2, 5, 2, 5, 2]),
  ],
  // Layer 11 — 钢砖走廊
  [
    row([5, 1, 1, 1, 5, 5, 1, 1, 1, 5]),
    row([1, 2, 2, 2, 1, 1, 2, 2, 2, 1]),
    row([1, 2, 6, 2, 1, 1, 2, 6, 2, 1]),
    row([1, 2, 2, 2, 1, 1, 2, 2, 2, 1]),
    row([5, 1, 1, 1, 5, 5, 1, 1, 1, 5]),
  ],
  // Layer 12 — 全 3 血
  [
    row([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]),
    row([3, 6, 3, 3, 3, 3, 3, 3, 6, 3]),
    row([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]),
    row([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]),
  ],
  // Layer 13 — 4 血堡垒
  [
    row([4, 4, 4, 4, 4, 4, 4, 4, 4, 4]),
    row([4, 2, 2, 2, 4, 4, 2, 2, 2, 4]),
    row([4, 2, 6, 2, 4, 4, 2, 6, 2, 4]),
    row([4, 2, 2, 2, 4, 4, 2, 2, 2, 4]),
    row([4, 4, 4, 4, 4, 4, 4, 4, 4, 4]),
  ],
  // Layer 14 — 终章前奏
  [
    row([4, 4, 4, 4, 4, 4, 4, 4, 4, 4]),
    row([5, 3, 5, 3, 5, 5, 3, 5, 3, 5]),
    row([4, 4, 4, 4, 4, 4, 4, 4, 4, 4]),
    row([5, 3, 5, 3, 5, 5, 3, 5, 3, 5]),
    row([4, 4, 4, 4, 4, 4, 4, 4, 4, 4]),
  ],
  // Layer 15 — 最终 Boss 前置
  [
    row([4, 4, 4, 4, 4, 4, 4, 4, 4, 4]),
    row([4, 6, 4, 6, 4, 4, 6, 4, 6, 4]),
    row([4, 4, 4, 4, 4, 4, 4, 4, 4, 4]),
    row([4, 6, 4, 6, 4, 4, 6, 4, 6, 4]),
    row([4, 4, 4, 4, 4, 4, 4, 4, 4, 4]),
  ],
];

// Boss 配置：血量与半径随层数递增（名称由 i18n 提供）
const BOSSES = {
  5: { hp: 30, radius: 46 },
  10: { hp: 60, radius: 54 },
  15: { hp: 120, radius: 62 },
};

export function layerSpec(layer) {
  const index = Math.max(0, Math.min(TOTAL_LAYERS - 1, Math.floor(layer) - 1));
  const boss = BOSSES[layer] || null;
  return {
    layer,
    rows: LAYOUTS[index]?.map((r) => r.slice()) ?? [],
    boss,
  };
}

// 无尽模式：基于层数程序化生成，难度递增
export function endlessSpec(layer, rng) {
  const rows = 4 + Math.min(4, Math.floor(layer / 3));
  const layout = [];
  for (let r = 0; r < rows; r += 1) {
    const cells = [];
    for (let c = 0; c < COLS; c += 1) {
      const roll = rng();
      let type = 0;
      if (roll < 0.62) type = 1;
      else if (roll < 0.82) type = 2;
      else if (roll < 0.92) type = 3;
      else if (roll < 0.97) type = 4;
      else type = rng() < 0.5 ? 6 : 7;
      // 每 5 层加一行钢砖障碍
      if (r === 1 && layer >= 5 && c % 4 === 0) type = 5;
      cells.push(type);
    }
    layout.push(cells);
  }
  return { layer, rows: layout, boss: null };
}
