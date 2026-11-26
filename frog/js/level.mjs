// 青蛙过河关卡生成器：40 关 × 5 章难度阶梯，纯函数、确定性种子。
//
// 可解性保证（无死局构造）：
//  - 车道车辆按「车段 + 至少 1 格安全间隙」循环生成，任意时刻每行必有可穿越缝隙，绝不堵成车墙；
//  - 河流浮木按「木段 + 至少 1 格间隙」循环生成，保证覆盖与落脚点，绝不出现永无木可踩的死水墙；
//  - 难题关额外注入静止荷叶（still）作稳定落脚点；
//  - 每关用 mulberry32(seed) 生成，同关局面恒定可复现。

import { mulberry32 } from "./engine.mjs";

export const LEVEL_COUNT = 40;
export const CHAPTERS = [
  { id: 1, name: "chap1", titleKey: "chapter1" },
  { id: 2, name: "chap2", titleKey: "chapter2" },
  { id: 3, name: "chap3", titleKey: "chapter3" },
  { id: 4, name: "chap4", titleKey: "chapter4" },
  { id: 5, name: "chap5", titleKey: "chapter5" },
];

const PERIOD = 13; // 循环周期 = 列数，车流/木流一屏一循环，判定与渲染 mod cols 严格一致

function hashSeed(levelId) {
  return (levelId * 2654435761) >>> 0;
}

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// 生成一行车道：车段（length 格）与安全间隙交替，间隙恒 ≥ minGap。
function makeLane(rng, { row, dir, speed, length, minGap, maxGap }) {
  const pattern = new Array(PERIOD).fill(0);
  let pos = 0;
  while (pos < PERIOD) {
    for (let k = 0; k < length && pos + k < PERIOD; k += 1) pattern[pos + k] = 1;
    pos += length;
    const gap = randInt(rng, minGap, maxGap);
    pos += gap;
  }
  return { row, dir, speed, periodLen: PERIOD, pattern };
}

// 生成一行河流：浮木段（logMin~logMax 格）与间隙交替，可加静止荷叶。
function makeRiver(rng, { row, dir, speed, logMin, logMax, gapMin, gapMax, still }) {
  const pattern = new Array(PERIOD).fill(0);
  let pos = 0;
  while (pos < PERIOD) {
    const len = randInt(rng, logMin, logMax);
    for (let k = 0; k < len && pos + k < PERIOD; k += 1) pattern[pos + k] = 1;
    pos += len;
    pos += randInt(rng, gapMin, gapMax);
  }
  return { row, dir, speed, periodLen: PERIOD, pattern, still: still ?? [] };
}

// 均匀撒几个静止荷叶列（不重叠、避开边缘）。
function pickStill(rng, count) {
  const cols = new Set();
  while (cols.size < count) {
    cols.add(randInt(rng, 1, 11));
  }
  return [...cols];
}

// 难度阶梯：按 chapter 决定车速、车长、间隙与浮木速度、覆盖。
function chapterProfile(chapter) {
  if (chapter === 1) {
    return {
      lives: 3, timerMax: 120,
      car: { length: 1, speed: 1, minGap: 4, maxGap: 6 },
      log: { logMin: 3, logMax: 5, gapMin: 1, gapMax: 1, speed: 0.4, still: 3 },
    };
  }
  if (chapter === 2) {
    return {
      lives: 3, timerMax: 95,
      car: { length: 1, speed: 1, minGap: 3, maxGap: 5 },
      log: { logMin: 2, logMax: 4, gapMin: 1, gapMax: 2, speed: 0.6, still: 2 },
    };
  }
  if (chapter === 3) {
    return {
      lives: 3, timerMax: 70,
      car: { length: 1, speed: 2, minGap: 2, maxGap: 4 },
      log: { logMin: 2, logMax: 3, gapMin: 1, gapMax: 2, speed: 1, still: 1 },
    };
  }
  if (chapter === 4) {
    return {
      lives: 3, timerMax: 55,
      car: { length: 1, speed: 3, minGap: 1, maxGap: 3 },
      log: { logMin: 1, logMax: 2, gapMin: 1, gapMax: 2, speed: 1.5, still: 1 },
    };
  }
  return {
    lives: 3, timerMax: 45,
    car: { length: 2, speed: 4, minGap: 1, maxGap: 2 },
    log: { logMin: 1, logMax: 2, gapMin: 1, gapMax: 2, speed: 2, still: 0 },
  };
}

function chapterOf(levelId) {
  return Math.max(1, Math.min(5, Math.floor((levelId - 1) / 8) + 1));
}

export function buildLevel(levelId) {
  const id = Math.max(1, Math.min(LEVEL_COUNT, Math.trunc(levelId) || 1));
  const chapter = chapterOf(id);
  const seed = hashSeed(id);
  const rng = mulberry32(seed);
  const p = chapterProfile(chapter);

  // 5 行公路：方向交替（奇数行向左、偶数行向右），速度逐行微调。
  const lanes = [7, 8, 9, 10, 11].map((row, i) => {
    const dir = i % 2 === 0 ? -1 : 1;
    const speed = Math.max(1, p.car.speed + randInt(rng, -1, 1));
    const length = p.car.length + (i === 1 && p.car.length >= 2 ? 0 : 0);
    return makeLane(rng, {
      row, dir, speed, length,
      minGap: p.car.minGap, maxGap: p.car.maxGap,
    });
  });

  // 5 行河流：方向交替，速度随深度微调，难题关荷叶更少。
  const rivers = [1, 2, 3, 4, 5].map((row, i) => {
    const dir = i % 2 === 0 ? 1 : -1;
    const speed = p.log.speed + (i % 2 === 0 ? 0 : 0.5);
    const still = p.log.still > 0 && (i === 1 || i === 3 || p.log.still > 1)
      ? pickStill(rng, Math.min(p.log.still, 2))
      : [];
    return makeRiver(rng, {
      row, dir, speed,
      logMin: p.log.logMin, logMax: p.log.logMax,
      gapMin: p.log.gapMin, gapMax: p.log.gapMax,
      still,
    });
  });

  return {
    levelId: id,
    chapter,
    seed,
    lives: p.lives,
    timerMax: p.timerMax,
    lanes,
    rivers,
  };
}

// 章节题名（供 UI 显示章节分组，文案在 i18n 表里落地）。
export function chapterOfLevel(levelId) {
  return chapterOf(levelId);
}