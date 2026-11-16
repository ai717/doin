// levels.mjs — 23 关深渊关卡编排 + 三种模式配置。
// 纯数据与纯函数，DOM-free；不含任何展示文案（章节名由 i18n 提供）。
// 结构：5 / 5 / 4 / 5 / 4 五大章节，共 23 关。

export const LEVEL_COUNT = 23;
export const CLASSIC_FLOORS = 100;
export const FLOOR_PIXELS = 110;

export const CHAPTERS = [
  { id: 1, count: 5, from: 1, to: 5 },
  { id: 2, count: 5, from: 6, to: 10 },
  { id: 3, count: 4, from: 11, to: 14 },
  { id: 4, count: 5, from: 15, to: 19 },
  { id: 5, count: 4, from: 20, to: 23 },
];

export const MODES = ["campaign", "classic", "endless"];

/** 每关权重：normal / spring / spike / conveyor / crumble（conveyor 自动拆成左右）。 */
function weights(normal, spring, spike, conveyor, crumble) {
  const half = conveyor / 2;
  return { normal, spring, spike, conveyorL: half, conveyorR: half, crumble };
}

const RAW = [
  { id: 1, chapter: 1, goalFloors: 14, scrollSpeed: 44, speedMax: 62, speedRamp: 0.2, width: 94, maxDrift: 96, safeCount: 5, weights: weights(80, 20, 0, 0, 0) },
  { id: 2, chapter: 1, goalFloors: 16, scrollSpeed: 45, speedMax: 64, speedRamp: 0.2, width: 94, maxDrift: 100, safeCount: 5, weights: weights(68, 18, 0, 14, 0) },
  { id: 3, chapter: 1, goalFloors: 18, scrollSpeed: 46, speedMax: 66, speedRamp: 0.22, width: 92, maxDrift: 102, safeCount: 4, weights: weights(60, 16, 4, 20, 0) },
  { id: 4, chapter: 1, goalFloors: 20, scrollSpeed: 48, speedMax: 70, speedRamp: 0.24, width: 92, maxDrift: 104, safeCount: 4, weights: weights(56, 15, 7, 22, 0) },
  { id: 5, chapter: 1, goalFloors: 22, scrollSpeed: 50, speedMax: 72, speedRamp: 0.24, width: 90, maxDrift: 106, safeCount: 4, weights: weights(52, 14, 10, 24, 0) },
  { id: 6, chapter: 2, goalFloors: 24, scrollSpeed: 52, speedMax: 78, speedRamp: 0.26, width: 90, maxDrift: 106, safeCount: 4, weights: weights(48, 13, 12, 22, 5) },
  { id: 7, chapter: 2, goalFloors: 27, scrollSpeed: 54, speedMax: 80, speedRamp: 0.28, width: 88, maxDrift: 108, safeCount: 4, weights: weights(44, 13, 13, 23, 7) },
  { id: 8, chapter: 2, goalFloors: 30, scrollSpeed: 56, speedMax: 84, speedRamp: 0.3, width: 88, maxDrift: 108, safeCount: 4, weights: weights(42, 12, 15, 22, 9) },
  { id: 9, chapter: 2, goalFloors: 33, scrollSpeed: 58, speedMax: 88, speedRamp: 0.32, width: 86, maxDrift: 110, safeCount: 3, weights: weights(40, 12, 17, 20, 11) },
  { id: 10, chapter: 2, goalFloors: 36, scrollSpeed: 60, speedMax: 92, speedRamp: 0.32, width: 86, maxDrift: 110, safeCount: 3, weights: weights(38, 11, 18, 20, 13) },
  { id: 11, chapter: 3, goalFloors: 38, scrollSpeed: 62, speedMax: 96, speedRamp: 0.34, width: 84, maxDrift: 110, safeCount: 3, weights: weights(36, 11, 19, 20, 14) },
  { id: 12, chapter: 3, goalFloors: 41, scrollSpeed: 64, speedMax: 100, speedRamp: 0.36, width: 84, maxDrift: 112, safeCount: 3, weights: weights(35, 10, 20, 20, 15) },
  { id: 13, chapter: 3, goalFloors: 44, scrollSpeed: 66, speedMax: 104, speedRamp: 0.38, width: 82, maxDrift: 112, safeCount: 3, weights: weights(34, 10, 21, 18, 17) },
  { id: 14, chapter: 3, goalFloors: 47, scrollSpeed: 68, speedMax: 108, speedRamp: 0.4, width: 82, maxDrift: 114, safeCount: 3, weights: weights(33, 10, 22, 17, 18) },
  { id: 15, chapter: 4, goalFloors: 49, scrollSpeed: 70, speedMax: 112, speedRamp: 0.4, width: 80, maxDrift: 114, safeCount: 3, weights: weights(36, 9, 18, 22, 15) },
  { id: 16, chapter: 4, goalFloors: 52, scrollSpeed: 72, speedMax: 116, speedRamp: 0.42, width: 78, maxDrift: 116, safeCount: 3, weights: weights(35, 9, 19, 22, 15) },
  { id: 17, chapter: 4, goalFloors: 55, scrollSpeed: 74, speedMax: 120, speedRamp: 0.44, width: 76, maxDrift: 118, safeCount: 3, weights: weights(34, 9, 19, 22, 16) },
  { id: 18, chapter: 4, goalFloors: 58, scrollSpeed: 76, speedMax: 124, speedRamp: 0.46, width: 76, maxDrift: 118, safeCount: 3, weights: weights(34, 8, 20, 22, 16) },
  { id: 19, chapter: 4, goalFloors: 61, scrollSpeed: 78, speedMax: 128, speedRamp: 0.48, width: 74, maxDrift: 120, safeCount: 3, weights: weights(33, 8, 20, 22, 17) },
  { id: 20, chapter: 5, goalFloors: 63, scrollSpeed: 80, speedMax: 132, speedRamp: 0.5, width: 74, maxDrift: 120, safeCount: 3, weights: weights(32, 8, 20, 22, 18) },
  { id: 21, chapter: 5, goalFloors: 66, scrollSpeed: 82, speedMax: 136, speedRamp: 0.52, width: 72, maxDrift: 122, safeCount: 3, weights: weights(32, 8, 20, 22, 18) },
  { id: 22, chapter: 5, goalFloors: 69, scrollSpeed: 84, speedMax: 140, speedRamp: 0.54, width: 72, maxDrift: 124, safeCount: 3, weights: weights(31, 8, 21, 22, 18) },
  { id: 23, chapter: 5, goalFloors: 72, scrollSpeed: 86, speedMax: 144, speedRamp: 0.56, width: 70, maxDrift: 126, safeCount: 3, weights: weights(30, 8, 21, 22, 19) },
];

export const LEVELS = RAW.map((spec) => ({
  ...spec,
  seed: levelSeed(spec.id),
  parTime: parTimeFor(spec.goalFloors),
}));

export function levelSeed(id) {
  const n = Math.max(1, Math.round(Number(id) || 1));
  return (0x9e3779b9 * (n + 7)) >>> 0;
}

export function parTimeFor(floors) {
  const n = Math.max(0, Math.round(Number(floors) || 0));
  return Math.round(n * 1.35 + 12);
}

export function levelSpec(id) {
  const n = Math.max(1, Math.min(LEVEL_COUNT, Math.round(Number(id) || 1)));
  return LEVELS[n - 1];
}

export function chapterOf(id) {
  const n = Math.max(1, Math.min(LEVEL_COUNT, Math.round(Number(id) || 1)));
  return CHAPTERS.find((chapter) => n >= chapter.from && n <= chapter.to) || CHAPTERS[0];
}

const COMMON = {
  gapBase: 110,
  gapJitter: 16,
  maxHp: 12,
};

const CLASSIC_WEIGHTS = {
  normal: 40,
  spring: 11,
  spike: 15,
  conveyorL: 12,
  conveyorR: 12,
  crumble: 10,
};

const ENDLESS_WEIGHTS = {
  normal: 38,
  spring: 10,
  spike: 17,
  conveyorL: 13,
  conveyorR: 13,
  crumble: 9,
};

/**
 * 生成引擎配置。campaign 走 23 关编排；classic 固定 100 层；
 * endless 不设终点，滚屏随深度持续加速。
 */
export function buildConfig({ mode = "campaign", level = 1, seed = null } = {}) {
  if (mode === "classic") {
    return {
      ...COMMON,
      mode,
      level: 0,
      seed: Number.isFinite(seed) ? Number(seed) >>> 0 : 0x1c1a5517,
      goalFloors: CLASSIC_FLOORS,
      scrollSpeed: 56,
      speedMax: 118,
      speedRamp: 0.5,
      width: 90,
      maxDrift: 108,
      safeCount: 4,
      weights: { ...CLASSIC_WEIGHTS },
      parTime: 160,
    };
  }
  if (mode === "endless") {
    return {
      ...COMMON,
      mode,
      level: 0,
      seed: Number.isFinite(seed) ? Number(seed) >>> 0 : 0x0a8b1e55,
      goalFloors: 0,
      scrollSpeed: 52,
      speedMax: 152,
      speedRamp: 0.9,
      width: 90,
      maxDrift: 110,
      safeCount: 4,
      weights: { ...ENDLESS_WEIGHTS },
      parTime: 0,
    };
  }
  const spec = levelSpec(level);
  return {
    ...COMMON,
    ...spec,
    mode: "campaign",
    level: spec.id,
    seed: Number.isFinite(seed) ? Number(seed) >>> 0 : spec.seed,
  };
}
