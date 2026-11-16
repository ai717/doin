// 21 关钉板工坊：4 / 5 / 4 / 5 / 3 五卷，钉阵由确定性 PRNG 生成。
// 关卡只存放几何与颜色，不含任何展示文案（文案统一走 i18n）。

import { HEIGHT, WIDTH } from "./engine.mjs";

export const CHAPTERS = Object.freeze([
  { key: "ch1", count: 4 },
  { key: "ch2", count: 5 },
  { key: "ch3", count: 4 },
  { key: "ch4", count: 5 },
  { key: "ch5", count: 3 },
]);

const LEFT = 72;
const RIGHT = WIDTH - 72;
const TOP = 118;
const BOTTOM = 470;
const MIN_GAP = 34;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function grid(countX, countY, x0, y0, dx, dy, jitter, rng) {
  const out = [];
  for (let row = 0; row < countY; row += 1) {
    for (let col = 0; col < countX; col += 1) {
      const offset = row % 2 === 0 ? 0 : dx / 2;
      out.push({
        x: x0 + col * dx + offset + (rng() - 0.5) * jitter,
        y: y0 + row * dy + (rng() - 0.5) * jitter,
      });
    }
  }
  return out;
}

function ring(cx, cy, radius, count, offset = 0) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const angle = offset + (Math.PI * 2 * i) / count;
    out.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  }
  return out;
}

function column(xs, count, y0, dy, stagger = 0, rng) {
  const out = [];
  xs.forEach((x, index) => {
    const shift = index % 2 === 0 ? 0 : stagger;
    for (let i = 0; i < count; i += 1) {
      out.push({ x, y: y0 + i * dy + shift + (rng() - 0.5) * 6 });
    }
  });
  return out;
}

function waves(rows, cx, y0, gap, amplitude, frequency, count, rng) {
  const out = [];
  const step = (RIGHT - LEFT) / (count - 1);
  for (let row = 0; row < rows; row += 1) {
    for (let i = 0; i < count; i += 1) {
      const x = LEFT + i * step;
      const y = y0 + row * gap + Math.sin((i / count) * Math.PI * 2 * frequency + row * 0.8) * amplitude;
      out.push({ x: x + (rng() - 0.5) * 4, y });
    }
  }
  return out;
}

function diamond(cx, cy, step, rows = 4) {
  const out = [];
  for (let row = -rows; row <= rows; row += 1) {
    const width = rows - Math.abs(row);
    for (let col = -width; col <= width; col += 1) {
      out.push({ x: cx + col * step, y: cy + row * step * 0.72 });
    }
  }
  return out;
}

// 21 关参数：每关组合 1~2 种钉阵，后三卷逐步叠加机关。
const SPECS = [
  { chapter: 1, seed: 101, orange: 14, pills: 0, parts: [{ type: "grid", countX: 9, countY: 6, x0: 130, y0: 150, dx: 72, dy: 52, jitter: 6 }] },
  { chapter: 1, seed: 102, orange: 15, pills: 0, parts: [{ type: "rings", cx: 420, cy: 300, rings: [70, 130, 190, 250], counts: [8, 14, 20, 20] }] },
  { chapter: 1, seed: 103, orange: 14, pills: 0, parts: [{ type: "columns", xs: [150, 260, 370, 470, 580, 690], count: 7, y0: 140, dy: 50 }] },
  { chapter: 1, seed: 104, orange: 14, pills: 0, parts: [{ type: "diamond", cx: 420, cy: 300, step: 52, rows: 4 }] },
  { chapter: 2, seed: 201, orange: 16, pills: 4, parts: [{ type: "waves", rows: 5, cx: 420, y0: 155, gap: 60, amplitude: 24, frequency: 1.4, count: 12 }] },
  { chapter: 2, seed: 202, orange: 17, pills: 4, parts: [{ type: "grid", countX: 10, countY: 5, x0: 112, y0: 155, dx: 70, dy: 60, jitter: 8 }] },
  { chapter: 2, seed: 203, orange: 17, pills: 5, parts: [{ type: "rings", cx: 420, cy: 300, rings: [80, 150, 215, 262], counts: [9, 15, 21, 22] }] },
  { chapter: 2, seed: 204, orange: 16, pills: 4, parts: [{ type: "columns", xs: [150, 265, 380, 460, 575, 690], count: 7, y0: 150, dy: 50, stagger: 22 }] },
  { chapter: 2, seed: 205, orange: 18, pills: 5, parts: [{ type: "waves", rows: 5, cx: 420, y0: 150, gap: 60, amplitude: 20, frequency: 1.1, count: 10 }] },
  { chapter: 3, seed: 301, orange: 17, pills: 0, rotor: { x: 420, y: 300, length: 150, width: 15, speed: 42 }, parts: [{ type: "grid", countX: 9, countY: 6, x0: 130, y0: 150, dx: 72, dy: 52, jitter: 4 }] },
  { chapter: 3, seed: 302, orange: 16, pills: 0, rotor: { x: 420, y: 300, length: 168, width: 15, speed: 52 }, parts: [{ type: "rings", cx: 420, cy: 300, rings: [100, 165, 225, 270, 300], counts: [10, 16, 22, 20, 24] }] },
  { chapter: 3, seed: 303, orange: 18, pills: 0, rotors: [
    { x: 300, y: 240, length: 110, width: 14, speed: 48 },
    { x: 545, y: 355, length: 110, width: 14, speed: -44 },
  ], parts: [
    { type: "grid", countX: 9, countY: 6, x0: 130, y0: 145, dx: 72, dy: 54, jitter: 5 },
    { type: "rings", cx: 420, cy: 300, rings: [268], counts: [20] },
  ] },
  { chapter: 3, seed: 304, orange: 16, pills: 4, rotor: { x: 420, y: 300, length: 160, width: 15, speed: -46 }, parts: [{ type: "columns", xs: [150, 265, 380, 460, 575, 690], count: 7, y0: 140, dy: 50 }, { type: "rings", cx: 420, cy: 300, rings: [290], counts: [22] }] },
  { chapter: 4, seed: 401, orange: 18, pills: 0, well: { x: 420, y: 300, radius: 190, strength: 420 }, parts: [{ type: "rings", cx: 420, cy: 300, rings: [70, 135, 200, 258], counts: [8, 14, 20, 22] }] },
  { chapter: 4, seed: 402, orange: 18, pills: 0, well: { x: 420, y: 310, radius: 210, strength: 460 }, parts: [{ type: "grid", countX: 10, countY: 5, x0: 112, y0: 150, dx: 70, dy: 62, jitter: 6 }] },
  { chapter: 4, seed: 403, orange: 17, pills: 0, well: { x: 300, y: 330, radius: 170, strength: 520 }, parts: [{ type: "waves", rows: 5, cx: 420, y0: 150, gap: 60, amplitude: 24, frequency: 1.3, count: 12 }] },
  { chapter: 4, seed: 404, orange: 19, pills: 0, well: { x: 420, y: 280, radius: 200, strength: 480 }, parts: [{ type: "doubleRing", cx: 420, cy: 300 }] },
  { chapter: 4, seed: 405, orange: 18, pills: 4, well: { x: 530, y: 320, radius: 175, strength: 500 }, parts: [{ type: "columns", xs: [150, 265, 380, 470, 585, 700], count: 7, y0: 135, dy: 50 }] },
  { chapter: 5, seed: 501, orange: 18, pills: 0, well: { x: 420, y: 300, radius: 210, strength: 520 }, rotor: { x: 420, y: 300, length: 160, width: 16, speed: 55 }, parts: [{ type: "grid", countX: 10, countY: 6, x0: 112, y0: 140, dx: 69, dy: 52, jitter: 4 }] },
  { chapter: 5, seed: 502, orange: 16, pills: 0, rotors: [
    { x: 300, y: 240, length: 120, width: 15, speed: 58 },
    { x: 545, y: 355, length: 120, width: 15, speed: -58 },
  ], parts: [{ type: "rings", cx: 420, cy: 300, rings: [70, 130, 190, 245, 290], counts: [8, 14, 20, 20, 24] }] },
  { chapter: 5, seed: 503, orange: 14, pills: 0, well: { x: 420, y: 295, radius: 220, strength: 560 }, rotors: [
    { x: 250, y: 215, length: 110, width: 15, speed: 60 },
    { x: 590, y: 385, length: 110, width: 15, speed: -60 },
  ], parts: [{ type: "diamond", cx: 420, cy: 300, step: 54, rows: 4 }, { type: "rings", cx: 420, cy: 300, rings: [250], counts: [18] }] },
];

// 离线解算得到的清关角度序列（按 1/120s 固定步长、种子 0x51ed + index 复现）。
// 单测会逐关重放，证明每关都在初始 10 颗弹珠内 100% 可清空。
const SOLUTIONS = [
  [24, -28, -40, -7],
  [20, -12, 36, -47],
  [15, 52, 46, -48],
  [-44, -14, -35, 27, 43, 31],
  [-56, -12, 72, -72, 16],
  [40, 8, 12, -68, -44, -70, 43],
  [-28, 56, -44, 17, -21],
  [-56, -60, -32, -28, 42],
  [56, -44, -48, -76, -28, -60],
  [-32, -52, -32, -8, -53],
  [-36, -8, -40, 74],
  [8, -4, 68, -8, -80, 28],
  [60, -49, 62, -24, 40],
  [53, 12, -36, -43, 40],
  [-80, -32, -44, 20, -64],
  [-40, 72, 59, -56, 8],
  [-24, 41, -34],
  [-40, -24, -76, -64],
  [76, -44, -64, -57, 36],
  [32, -68, 68, 48, -33, -44],
  [10, -44, -60, -54, -56],
];

export const SOLUTION_SEED = 0x51ed;

function partPositions(part, rng) {
  if (part.type === "grid") return grid(part.countX, part.countY, part.x0, part.y0, part.dx, part.dy, part.jitter ?? 0, rng);
  if (part.type === "rings") {
    return part.rings.flatMap((radius, index) => ring(part.cx, part.cy, radius, part.counts[index], index * 0.35));
  }
  if (part.type === "columns") return column(part.xs, part.count, part.y0, part.dy, part.stagger ?? 0, rng);
  if (part.type === "waves") return waves(part.rows, part.cx, part.y0, part.gap, part.amplitude, part.frequency, part.count, rng);
  if (part.type === "diamond") return diamond(part.cx, part.cy, part.step);
  if (part.type === "doubleRing") {
    return [
      ...ring(part.cx, part.cy, 82, 10, 0),
      ...ring(part.cx, part.cy, 148, 16, 0.2),
      ...ring(part.cx, part.cy, 210, 20, 0.1),
      ...ring(part.cx, part.cy, 265, 12, 0.4),
    ];
  }
  return [];
}

function buildLevel(spec, index) {
  const rng = mulberry32(spec.seed);
  const id = `p${String(index + 1).padStart(2, "0")}`;
  const rotors = spec.rotors
    ? spec.rotors.map((rotor) => ({ ...rotor }))
    : spec.rotor
      ? [{ ...spec.rotor }]
      : [];
  const wells = spec.well ? [{ ...spec.well }] : [];

  const raw = spec.parts.flatMap((part) => partPositions(part, rng));
  const kept = [];
  for (const point of raw) {
    if (point.x < LEFT || point.x > RIGHT || point.y < TOP || point.y > BOTTOM) continue;
    let blocked = false;
    for (const rotor of rotors) {
      if (Math.hypot(point.x - rotor.x, point.y - rotor.y) < (rotor.length ?? 140) / 2 + 40) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    for (const peg of kept) {
      if (Math.hypot(point.x - peg.x, point.y - peg.y) < MIN_GAP) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    kept.push({ x: Math.round(point.x), y: Math.round(point.y) });
  }

  // 药丸钉：挑选周围空间足够的蓝钉改造成胶囊
  const pillCount = Math.min(spec.pills ?? 0, Math.floor(kept.length / 8));
  const pillIndexes = new Set();
  if (pillCount > 0) {
    const scored = kept
      .map((peg, i) => {
        let nearest = Infinity;
        kept.forEach((other, j) => {
          if (i === j) return;
          nearest = Math.min(nearest, Math.hypot(peg.x - other.x, peg.y - other.y));
        });
        return { i, nearest };
      })
      .filter((item) => item.nearest >= 52)
      .sort((a, b) => b.nearest - a.nearest);
    for (const item of scored.slice(0, pillCount)) pillIndexes.add(item.i);
  }

  const total = kept.length;
  const indexes = shuffle([...Array(total).keys()], rng);
  const types = new Array(total).fill("blue");

  // 绿钉：取两颗位于中下区、彼此间隔的钉子
  const greenCandidates = indexes.filter((i) => kept[i].y > 235 && !pillIndexes.has(i));
  const greens = [];
  for (const i of greenCandidates) {
    if (greens.length >= 2) break;
    if (greens.every((g) => Math.hypot(kept[g].x - kept[i].x, kept[g].y - kept[i].y) > 160)) greens.push(i);
  }
  for (const i of greens) types[i] = "green";

  // 橙钉：在剩余钉子中均匀抽取
  const pool = indexes.filter((i) => types[i] === "blue");
  const orangeCount = Math.min(spec.orange, pool.length);
  for (let k = 0; k < orangeCount; k += 1) {
    const at = Math.floor((k * pool.length) / orangeCount);
    types[pool[at]] = "orange";
  }

  const pegs = kept.map((point, i) => ({
    id: `${id}-${i}`,
    x: point.x,
    y: point.y,
    type: types[i],
    shape: pillIndexes.has(i) ? "pill" : "circle",
    radius: 12,
    length: pillIndexes.has(i) ? 46 : 0,
    thickness: 20,
    angle: pillIndexes.has(i) ? (rng() < 0.5 ? 0 : 90) : 0,
  }));

  return {
    id,
    index,
    chapter: spec.chapter,
    seed: spec.seed,
    pegs,
    rotors,
    wells,
    orangeTotal: pegs.filter((peg) => peg.type === "orange").length,
    solution: [...(SOLUTIONS[index] ?? [])],
  };
}

export const LEVELS = Object.freeze(SPECS.map((spec, index) => Object.freeze(buildLevel(spec, index))));

export const LEVEL_BY_ID = Object.freeze(
  Object.fromEntries(LEVELS.map((level) => [level.id, level])),
);

export function getLevel(id) {
  return LEVEL_BY_ID[id] ?? null;
}

export function levelAt(index) {
  return LEVELS[index] ?? null;
}

export function chapterOf(level) {
  return level ? level.chapter : 0;
}

export function levelsInChapter(chapter) {
  return LEVELS.filter((level) => level.chapter === chapter);
}

export function nextLevel(id) {
  const level = LEVEL_BY_ID[id];
  if (!level) return null;
  return LEVELS[level.index + 1] ?? null;
}

