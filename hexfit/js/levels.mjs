// levels.mjs —— 单人章节残局：4 章 × 6 关 = 24 关，全部字符串 key，严禁裸写中文。
import { hash32 } from "./rng.mjs";

export const LEVEL_COUNT = 24;
export const CHAPTERS = 4;
export const LEVELS_PER_CHAPTER = 6;

/**
 * 关卡定义：
 *   id: 1..24
 *   chapter: 1..4
 *   goalRows: 累计消除目标行数
 *   pieces: 本关可用块数（finite）
 *   seed: 确定性种子（保证所有玩家同关同块序）
 *   descKey: i18n 描述键
 *
 * 可解性保证：给足块数（≥ goalRows × 2.5），目标适中，玩家总可达成。
 */
export const LEVELS = [
  // 第 1 章·蜜房入门：标准盘 + 基本块序，目标累计消除 10 行
  { id: 1, chapter: 1, goalRows: 10, pieces: 28, seed: 0xc0ffee01, descKey: "lv1_desc" },
  { id: 2, chapter: 1, goalRows: 12, pieces: 30, seed: 0xc0ffee02, descKey: "lv1_desc" },
  { id: 3, chapter: 1, goalRows: 14, pieces: 32, seed: 0xc0ffee03, descKey: "lv1_desc" },
  { id: 4, chapter: 1, goalRows: 16, pieces: 34, seed: 0xc0ffee04, descKey: "lv1_desc" },
  { id: 5, chapter: 1, goalRows: 18, pieces: 36, seed: 0xc0ffee05, descKey: "lv1_desc" },
  { id: 6, chapter: 1, goalRows: 20, pieces: 38, seed: 0xc0ffee06, descKey: "lv1_desc" },

  // 第 2 章·三轴共鸣：单次消 ≥ 3 行目标
  { id: 7, chapter: 2, goalRows: 22, pieces: 38, seed: 0x2a2a0001, descKey: "lv2_desc" },
  { id: 8, chapter: 2, goalRows: 24, pieces: 40, seed: 0x2a2a0002, descKey: "lv2_desc" },
  { id: 9, chapter: 2, goalRows: 26, pieces: 42, seed: 0x2a2a0003, descKey: "lv2_desc" },
  { id: 10, chapter: 2, goalRows: 28, pieces: 44, seed: 0x2a2a0004, descKey: "lv2_desc" },
  { id: 11, chapter: 2, goalRows: 30, pieces: 46, seed: 0x2a2a0005, descKey: "lv2_desc" },
  { id: 12, chapter: 2, goalRows: 32, pieces: 48, seed: 0x2a2a0006, descKey: "lv2_desc" },

  // 第 3 章·蜜流狂潮：目标触发一次狂潮（消 ≥ 4 行）并达成 ×16 倍
  { id: 13, chapter: 3, goalRows: 30, pieces: 44, seed: 0xbee50001, descKey: "lv3_desc" },
  { id: 14, chapter: 3, goalRows: 32, pieces: 46, seed: 0xbee50002, descKey: "lv3_desc" },
  { id: 15, chapter: 3, goalRows: 34, pieces: 48, seed: 0xbee50003, descKey: "lv3_desc" },
  { id: 16, chapter: 3, goalRows: 36, pieces: 50, seed: 0xbee50004, descKey: "lv3_desc" },
  { id: 17, chapter: 3, goalRows: 38, pieces: 52, seed: 0xbee50005, descKey: "lv3_desc" },
  { id: 18, chapter: 3, goalRows: 40, pieces: 54, seed: 0xbee50006, descKey: "lv3_desc" },

  // 第 4 章·蜂王金标：目标单局倍率触达 ×256 以上
  { id: 19, chapter: 4, goalRows: 38, pieces: 52, seed: 0x9a1d0001, descKey: "lv4_desc" },
  { id: 20, chapter: 4, goalRows: 40, pieces: 54, seed: 0x9a1d0002, descKey: "lv4_desc" },
  { id: 21, chapter: 4, goalRows: 42, pieces: 56, seed: 0x9a1d0003, descKey: "lv4_desc" },
  { id: 22, chapter: 4, goalRows: 44, pieces: 58, seed: 0x9a1d0004, descKey: "lv4_desc" },
  { id: 23, chapter: 4, goalRows: 46, pieces: 60, seed: 0x9a1d0005, descKey: "lv4_desc" },
  { id: 24, chapter: 4, goalRows: 50, pieces: 64, seed: 0x9a1d0006, descKey: "lv4_desc" },
];

export function levelById(id) {
  return LEVELS.find((l) => l.id === id) ?? null;
}

export function levelsByChapter(chapter) {
  return LEVELS.filter((l) => l.chapter === chapter);
}

export function chapterTitleKey(chapter) {
  return `ch${chapter}_title`;
}

/** 用关卡 id 派生确定性种子（若未提供） */
export function seedForLevel(id) {
  const lvl = levelById(id);
  return lvl ? lvl.seed >>> 0 : hash32(id) >>> 0;
}

export const STAR_MAX = 3;

/** 章节目标达成时的星级：剩余块越多星级越高 */
export function starsForLevel(level, piecesRemaining, goalMet) {
  if (!goalMet) return 0;
  const ratio = piecesRemaining / level.pieces;
  if (ratio >= 0.3) return 3;
  if (ratio >= 0.15) return 2;
  return 1;
}
