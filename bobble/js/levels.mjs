// 泡泡射手 · 关卡与题板数据（零裸写中文，展示文本一律走 i18n）
// mask 约定：'#' 随机配色 / '0'-'5' 指定颜色 / '.' 空 / 'C' 目标冰晶
// 偶数行 8 格、奇数行 7 格（奇数行最后一个字符不参与）。

import {
  boardFromMask,
  pruneFloating,
  mulberry32,
  pick,
  CRYSTAL,
  EMPTY
} from "./engine.mjs";

export const CHAPTERS = [
  { id: 1, from: 1, to: 10, colors: 4, key: "chapter1" },
  { id: 2, from: 11, to: 20, colors: 5, key: "chapter2" },
  { id: 3, from: 21, to: 30, colors: 6, key: "chapter3" }
];

// 15 套结构模板（冰塔形状）
const MASKS = [
  // 1 冰墙
  ["########", "########", "########"],
  // 2 斜坡
  ["##......", "####....", "######..", "########"],
  // 3 双塔
  ["##....##", "##....##", "##....##", "########"],
  // 4 拱门
  ["########", "##....##", "##....##", "##....##"],
  // 5 金字塔
  ["..####..", ".######.", "########"],
  // 6 悬桥
  ["########", "##....##", "#......#", "##....##"],
  // 7 梳齿
  ["########", "#.#.#.#.", "########", "#.#.#.#."],
  // 8 高脚杯
  ["########", ".######.", "..####..", "...##...", "...##..."],
  // 9 双拱
  ["##.##.##", "##.##.##", "##....##", "########"],
  // 10 十字
  ["...##...", "########", "...##...", "########"],
  // 11 冰洞
  ["########", "#.....#", "#.####.#", "#.....#", "########"],
  // 12 阶梯
  ["########", "######.", "####...", "##.....", "#......"],
  // 13 棋盘墙
  ["########", ".#.#.#.", "########", ".#.#.#.", "########"],
  // 14 王冠
  ["#.##.##.", "#######", "##.##.##", "#######"],
  // 15 蜂巢柱
  ["########", "#######", "##.##.##", "..###..", "...##..."],
  // 16 厚斜坡
  ["########", "#######", "####....", "###.....", "##......"],
  // 17 双柱厚墙
  ["########", "###.###", "###.####", "###.###", "########"],
  // 18 蜂巢厚墙
  ["########", "#######", "##.###.#", ".#####.", "..###.."],
  // 19 右台阶
  ["########", "#######", "....####", "....###", "....##"]
];

function mirrorMask(mask) {
  return mask.map((line) => line.split("").reverse().join(""));
}

function countCells(mask) {
  return mask.reduce((n, line) => n + [...line].filter((ch) => ch !== ".").length, 0);
}

function paletteOf(size) {
  return Array.from({ length: size }, (_, i) => i);
}

// 三星目标发数：以启发式求解器实测发数 + 3 发余量标定（保证可达但需动脑）
const TARGETS = [
  20, 13, 16, 14, 12, 13, 16, 11, 14, 12,
  13, 11, 20, 21, 13, 14, 22, 17, 23, 11,
  16, 19, 22, 24, 19, 13, 18, 19, 17, 29
];

function targetFor(id, count, floor) {
  const tuned = TARGETS[id - 1];
  if (Number.isFinite(tuned)) return tuned;
  return Math.max(floor, Math.round(count / 1.45) + 3);
}

// 30 关闯关盘面：第 1 章 4 色 / 第 2 章 5 色（镜像结构）/ 第 3 章 6 色
function buildStageLevels() {
  const levels = [];
  const plan = [
    { chapter: 1, masks: MASKS.slice(0, 10), colors: 4, floor: 10 },
    {
      chapter: 2,
      masks: [MASKS[0], MASKS[1], MASKS[15], MASKS[16], MASKS[4], MASKS[5], MASKS[17], MASKS[7], MASKS[8], MASKS[9]].map(mirrorMask),
      colors: 5,
      floor: 12
    },
    {
      chapter: 3,
      masks: [MASKS[7], MASKS[10], MASKS[17], MASKS[18], MASKS[13], MASKS[14], MASKS[5], MASKS[8], MASKS[15], MASKS[16]],
      colors: 6,
      floor: 14
    }
  ];
  let id = 1;
  for (const group of plan) {
    for (const mask of group.masks) {
      const count = countCells(mask);
      levels.push({
        id,
        chapter: group.chapter,
        mask,
        palette: paletteOf(group.colors),
        target: targetFor(id, count, group.floor),
        startParity: 0
      });
      id += 1;
    }
  }
  return levels;
}

export const STAGE_LEVELS = buildStageLevels();

export function stageLevel(id) {
  return STAGE_LEVELS.find((lv) => lv.id === id) ?? STAGE_LEVELS[0];
}

export function chapterOf(id) {
  return CHAPTERS.find((c) => id >= c.from && id <= c.to) ?? CHAPTERS[0];
}

// ---------- 断柱残局：24 道限定发数题板（冰晶必须坠落） ----------
// load 为确定的发弹颜色序列，保证题面 100% 可解
const PUZZLE_DATA = [
  { mask: ["00000000", "..11....", "...C...."], palette: [0, 1], shots: 1, load: [1] },
  { mask: ["00000000", "....11..", ".....C.."], palette: [0, 1], shots: 1, load: [1] },
  { mask: ["11111111", "..22....", "...C...."], palette: [1, 2], shots: 1, load: [2] },
  { mask: ["22222222", ".33.....", "..C....."], palette: [2, 3], shots: 1, load: [3] },
  { mask: ["00000000", "..11....", "..22....", "...C...."], palette: [0, 1, 2], shots: 2, load: [1, 2] },
  { mask: ["33333333", "....11..", "....22..", ".....C.."], palette: [1, 2, 3], shots: 2, load: [1, 2] },
  { mask: ["11111111", "..00....", "..22....", "...C...."], palette: [0, 1, 2], shots: 2, load: [0, 2] },
  { mask: ["00000000", ".11.....", ".22.....", "..C....."], palette: [0, 1, 2], shots: 2, load: [1, 2] },
  { mask: ["22222222", "...11...", "...33...", "...C...."], palette: [1, 2, 3], shots: 2, load: [1, 3] },
  { mask: ["44444444", "..11....", "..33....", "...C...."], palette: [1, 3, 4], shots: 2, load: [3, 1] },
  { mask: ["11111111", "..22....", "..33....", "...C....", "...C...."], palette: [1, 2, 3], shots: 3, load: [2, 3, 2] },
  { mask: ["00000000", "..11....", "..22....", "..33....", "...C...."], palette: [0, 1, 2, 3], shots: 3, load: [1, 2, 3] },
  { mask: ["33333333", "....22..", "....11..", ".....C.."], palette: [1, 2, 3], shots: 2, load: [2, 1] },
  { mask: ["22222222", "..44....", "..11....", "...C...."], palette: [1, 2, 4], shots: 2, load: [4, 1] },
  { mask: ["11111111", "..33....", "..00....", "...C...."], palette: [0, 1, 3], shots: 2, load: [3, 0] },
  { mask: ["00000000", "...22...", "...11...", "...C...."], palette: [0, 1, 2], shots: 2, load: [2, 1] },
  { mask: ["44444444", "..11....", "..22....", "..33....", "...C...."], palette: [1, 2, 3, 4], shots: 3, load: [1, 2, 3] },
  { mask: ["22222222", "..55....", "..11....", "...C...."], palette: [1, 2, 5], shots: 2, load: [5, 1] },
  { mask: ["33333333", ".11.....", ".44.....", "..C....."], palette: [1, 3, 4], shots: 2, load: [1, 4] },
  { mask: ["11111111", "....33..", "....22..", ".....C.."], palette: [1, 2, 3], shots: 2, load: [3, 2] },
  { mask: ["00000000", "..11....", "..22....", "...C....", "..C....."], palette: [0, 1, 2], shots: 3, load: [1, 2, 1] },
  { mask: ["55555555", "...11...", "...22...", "...C...."], palette: [1, 2, 5], shots: 2, load: [1, 2] },
  { mask: ["22222222", "..33....", "..44....", "...C...."], palette: [2, 3, 4], shots: 2, load: [3, 4] },
  { mask: ["44444444", "..11....", "..55....", "..22....", "...C...."], palette: [1, 2, 4, 5], shots: 3, load: [1, 5, 2] }
];

export const PUZZLES = PUZZLE_DATA.map((p, i) => ({
  id: i + 1,
  mask: p.mask,
  palette: p.palette,
  shots: p.shots,
  load: p.load.slice(),
  startParity: 0
}));

export function puzzleBoard(id) {
  return PUZZLES.find((p) => p.id === id) ?? PUZZLES[0];
}

// ---------- 盘面实例化 ----------
export function instantiate(spec, seed) {
  const rng = mulberry32(seed);
  const raw = boardFromMask(spec.mask, spec.palette, rng, spec.startParity ?? 0);
  return pruneFloating(raw);
}

// ---------- 无尽寒潮 ----------
export const ENDLESS = {
  startRows: 5,
  startColors: 4,
  maxColors: 6,
  colorStepEvery: 6,     // 每 6 次下压增加一种颜色
  rowDensity: 0.82
};

export function endlessBoard(seed) {
  const rng = mulberry32(seed);
  const palette = paletteOf(ENDLESS.startColors);
  const mask = [];
  for (let r = 0; r < ENDLESS.startRows; r += 1) {
    const width = r % 2 === 0 ? 8 : 7;
    let line = "";
    for (let c = 0; c < width; c += 1) line += rng() <= 0.9 ? "#" : ".";
    mask.push(line);
  }
  const raw = boardFromMask(mask, palette, rng, 0);
  return { board: pruneFloating(raw), palette, rng };
}

// ---------- 每日残局（日期种子，全球同一题板） ----------
export function dateSeed(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return y * 10000 + m * 100 + d;
}

export function dailySpec(seed) {
  const rng = mulberry32(seed >>> 0);
  const palette = paletteOf(5);
  const rows = 6;
  const mask = [];
  for (let r = 0; r < rows; r += 1) {
    const width = r % 2 === 0 ? 8 : 7;
    const density = r === 0 ? 1 : 0.78;
    let line = "";
    for (let c = 0; c < width; c += 1) line += rng() <= density ? "#" : ".";
    mask.push(line);
  }
  return { id: 0, mask, palette, startParity: 0, target: 26 };
}

export function crystalCount(board) {
  let n = 0;
  for (const row of board) {
    for (const v of row.cells) if (v === CRYSTAL) n += 1;
  }
  return n;
}

export function bubbleCount(board) {
  let n = 0;
  for (const row of board) {
    for (const v of row.cells) if (v !== EMPTY && v !== CRYSTAL) n += 1;
  }
  return n;
}

export { pick };
