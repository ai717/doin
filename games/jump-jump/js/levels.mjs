// levels.mjs — 旅途关卡（Odyssey）：25 关五章，确定性种子生成，数学保证 100% 可解。
// 单向依赖 engine.mjs（engine 不反向引用本文件），避免循环 import。

import {
  TAU,
  MOVING_AMP,
  MOVING_PERIOD,
  TRAMPOLINE_GAP_MIN,
  TRAMPOLINE_GAP_MAX,
  makePlatform,
  clampGapRange,
  mulberry32,
  hashSeed,
} from "./engine.mjs";

export const LEVEL_COUNT = 25;
export const LEVELS_PER_CHAPTER = 5;

export const CHAPTERS = [
  {
    id: 1,
    key: "timber",
    types: ["plain"],
    distRange: [190, 245],
    baseCount: 6,
  },
  {
    id: 2,
    key: "spring",
    types: ["plain", "plain", "vinyl", "trampoline"],
    distRange: [190, 265],
    baseCount: 7,
  },
  {
    id: 3,
    key: "drift",
    types: ["plain", "plain", "moving", "vinyl", "moving"],
    distRange: [195, 290],
    baseCount: 7,
  },
  {
    id: 4,
    key: "metro",
    types: ["plain", "plain", "thin", "moving", "vinyl", "trampoline"],
    distRange: [200, 310],
    baseCount: 8,
  },
  {
    id: 5,
    key: "cloud",
    types: ["plain", "thin", "moving", "trampoline", "vinyl", "thin", "moving"],
    distRange: [205, 340],
    baseCount: 9,
  },
];

export function chapterOf(levelId) {
  const id = Math.max(1, Math.min(LEVEL_COUNT, Math.round(levelId)));
  return Math.ceil(id / LEVELS_PER_CHAPTER);
}

export function levelSpec(levelId) {
  const id = Math.max(1, Math.min(LEVEL_COUNT, Math.round(levelId)));
  const chapter = chapterOf(id);
  const cfg = CHAPTERS[chapter - 1];
  const k = id - (chapter - 1) * LEVELS_PER_CHAPTER; // 章内序号 1..5
  return {
    id,
    chapter,
    chapterKey: cfg.key,
    types: cfg.types,
    distRange: cfg.distRange,
    count: Math.min(10, cfg.baseCount + Math.floor((k - 1) / 2)),
    seed: hashSeed(`jump-jump:level:${id}`),
  };
}

function pickType(spec, rng, index, prevType) {
  if (spec.types.length === 1) return spec.types[0];
  const pool = spec.types;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const t = pool[Math.floor(rng() * pool.length) % pool.length];
    if (t === "trampoline") {
      // 跳床后必须留出超远间距，因而跳床不能紧贴倒数第二格之后的目标冲突；
      // 同时禁止连续两个跳床，避免连续自动腾空。
      if (prevType === "trampoline") continue;
      return t;
    }
    if (t === "moving" && prevType === "moving" && index > 2) continue;
    if (t === "thin" && prevType === "thin") continue;
    return t;
  }
  return "plain";
}

/**
 * 生成一关的平台序列（同 seed 必得同局面）。
 * 平台交替沿 +x / +y 前进 —— 在 30° 等轴测投影下即「右上 / 左上」交替的视觉节奏。
 */
export function buildLevelRoute(levelId) {
  const spec = levelSpec(levelId);
  const rng = mulberry32(spec.seed);
  const platforms = [makePlatform(0, 0, 0, "start")];
  let axis = 0;
  let prevType = "start";

  for (let i = 1; i < spec.count; i += 1) {
    const isGoal = i === spec.count - 1;
    let type = isGoal ? "goal" : pickType(spec, rng, i, prevType);

    // 跳床自动腾空必须精确命中：其后禁止浮动岛 / 薄块 / 连续跳床
    if (prevType === "trampoline" && type !== "plain" && type !== "vinyl" && type !== "goal") {
      type = "plain";
    }

    let gap;
    if (prevType === "trampoline") {
      gap = TRAMPOLINE_GAP_MIN + rng() * (TRAMPOLINE_GAP_MAX - TRAMPOLINE_GAP_MIN);
    } else {
      const [lo, hi] = clampGapRange(spec.distRange, type);
      gap = lo + rng() * (hi - lo);
    }

    const prev = platforms[i - 1];
    const x = axis === 0 ? prev.x + gap : prev.x;
    const y = axis === 0 ? prev.y : prev.y + gap;

    let motion = null;
    if (type === "moving") {
      motion = {
        amp: MOVING_AMP,
        period: MOVING_PERIOD,
        phase: rng() * TAU,
        ax: axis === 0 ? 1 : 0,
        ay: axis === 0 ? 0 : 1,
      };
    }

    platforms.push(makePlatform(i, x, y, type, motion));
    prevType = type;
    axis = 1 - axis;
  }

  return platforms;
}

/** 关卡的「有效跳跃次数」= 平台数 - 1（起点不计入）。 */
export function levelJumps(levelId) {
  return levelSpec(levelId).count - 1;
}
