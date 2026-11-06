// filepath: games/jigsaw/js/levels.mjs
// 50 关内容表：每关 = 一张确定性艺术图（seed）+ 网格边长 n + par + 图案风格。
// 难度沿两轴上升：网格边长（3×3 → 4×4 → 5×5）与图案复杂度（art.detail / art.contrast）。
// par 用 PRD §3.3 经验公式 n·n + n：3×3=12、4×4=20、5×5=30（休闲玩家正常发挥即可达线）。

import { hashString } from "./engine.mjs";

export const CHAPTER_COUNT = 5;
export const LEVELS_PER_CHAPTER = 10;
export const LEVEL_COUNT = CHAPTER_COUNT * LEVELS_PER_CHAPTER; // 50

/**
 * 每章参数（对应 PRD §3.3 的"图风格"列）：
 *   n        网格边长
 *   detail   图案细节 0..1（越大越多层越细腻）→ 决定几何特征数量
 *   contrast 图案对比 0..1（越大底色明暗跨度越大，切片后每格亮度越分明）
 *
 * 两轴的走向刻意不同：第 1 章"高对比渐变（易辨认）"靠大跨度明暗；
 * 第 3 章"柔和渐变"是全作最柔的一档（contrast 最低）；
 * 第 5 章 5×5（25 块）特征最多且仍保留高对比，作为视觉锚点
 * （PRD §8 风险 3："抽象图切片后没有明显特征，玩家只能乱试"的缓解）。
 */
export const CHAPTERS = [
  { id: 1, n: 3, detail: 0.2, contrast: 0.88 }, // 高对比渐变
  { id: 2, n: 3, detail: 0.42, contrast: 0.62 }, // 带几何形状
  { id: 3, n: 4, detail: 0.56, contrast: 0.32 }, // 柔和渐变
  { id: 4, n: 4, detail: 0.72, contrast: 0.55 }, // 多图层
  { id: 5, n: 5, detail: 0.88, contrast: 0.78 }, // 细腻纹理 + 高对比大色块
];

function chapterForIndex(index) {
  const safe = Math.min(CHAPTER_COUNT - 1, Math.max(0, Math.floor(index / LEVELS_PER_CHAPTER)));
  return CHAPTERS[safe];
}

export const LEVELS = Array.from({ length: LEVEL_COUNT }, (_, index) => {
  const chapter = chapterForIndex(index);
  const id = `l${index + 1}`;
  return {
    id,
    index,
    n: chapter.n,
    chapter: chapter.id,
    // 同一 id 永远同一张图；seed 由 id 派生，改关卡顺序不会串图
    seed: hashString(`jigsaw:${id}`),
    art: { detail: chapter.detail, contrast: chapter.contrast },
    par: chapter.n * chapter.n + chapter.n,
  };
});

export function levelAt(index) {
  const safe = Number.isInteger(index) ? Math.min(LEVEL_COUNT - 1, Math.max(0, index)) : 0;
  return LEVELS[safe];
}

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function indexOfLevel(id) {
  return LEVELS.findIndex((level) => level.id === id);
}

/** YYYY-MM-DD（本地时区）—— 同一天全服同一题 */
export function dateKey(date = new Date()) {
  const value = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayKey(date) {
  return dateKey(date);
}

/** 每日精选：hash(dateKey) % 50。同 dateKey 必得同一关，且与主线进度无关。 */
export function dailyIndex(dateKeyValue) {
  return hashString(`jigsaw-daily:${dateKeyValue}`) % LEVEL_COUNT;
}

export function dailyLevel(dateKeyValue) {
  return LEVELS[dailyIndex(dateKeyValue)];
}

/** 每日精选的稳定关卡 id，用于存档与 UI 判定（不占用主线 levels 记录） */
export function dailyLevelId(dateKeyValue) {
  return `daily-${dateKeyValue}-${dailyLevel(dateKeyValue).id}`;
}
