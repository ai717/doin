/**
 * Level generator for games/screw.
 * Run: node games/screw/tools/gen-levels.mjs
 *
 * The tool bakes deterministic color assignments and box queues into js/levels.mjs.
 * Every baked level is verified by the DAG solver and replayed through the real engine.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createState, listAccessibleScrews, validateLevelData, COLORS, BOX_SIZE } from '../js/engine.mjs';
import { solveLevel, replaySolution } from '../js/solver.mjs';

const range = (start, len) => Array.from({ length: len }, (_, i) => start + i);
const hbar = (c, r, len) => range(c, len).map((x) => [x, r]);
const vbar = (c, r, len) => range(r, len).map((y) => [c, y]);
const ring = (c, r) => [
  [c - 1, r - 1], [c, r - 1], [c + 1, r - 1],
  [c - 1, r], [c + 1, r],
  [c - 1, r + 1], [c, r + 1], [c + 1, r + 1],
];
const cross = (c, r) => [[c, r], [c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]];

const P = (id, layer, cells, holes, shape = 'bar') => ({ id, layer, cells, holes, shape });

const CHAPTERS = [
  { id: 1, nameKey: 'chapter_1', subtitleKey: 'chapter_1_sub', material: 'wood', colorCount: 2 },
  { id: 2, nameKey: 'chapter_2', subtitleKey: 'chapter_2_sub', material: 'acrylic', colorCount: 3 },
  { id: 3, nameKey: 'chapter_3', subtitleKey: 'chapter_3_sub', material: 'metal', colorCount: 3 },
  { id: 4, nameKey: 'chapter_4', subtitleKey: 'chapter_4_sub', material: 'neon', colorCount: 4 },
  { id: 5, nameKey: 'chapter_5', subtitleKey: 'chapter_5_sub', material: 'sculpture', colorCount: 5 },
];

const MATERIAL_MIX = ['brass', 'neon', 'acrylic', 'metal', 'wood'];

const LEVEL_SPECS = [
  // ================= Chapter 1 · Wood =================
  {
    id: 1, chapter: 1, nameKey: 'lvl_1', buffer: 4,
    minBuffer: 0, minSwings: 0, minFirstBox: 3,
    plates: [
      P('a', 1, hbar(1, 2, 4), [[1, 2], [4, 2]]),
      P('b', 1, hbar(1, 5, 4), [[1, 5], [4, 5]]),
      P('c', 1, hbar(2, 7, 4), [[2, 7], [5, 7]]),
    ],
  },
  {
    id: 2, chapter: 1, nameKey: 'lvl_2', buffer: 4,
    minBuffer: 0, minSwings: 1, minFirstBox: 2,
    plates: [
      P('a', 3, hbar(1, 2, 5), [[1, 2], [2, 2], [5, 2]]),
      P('b', 2, vbar(3, 1, 5), [[3, 1], [3, 2], [3, 4]]),
      P('c', 1, hbar(1, 5, 5), [[1, 5], [3, 5], [5, 5]]),
    ],
  },
  {
    id: 3, chapter: 1, nameKey: 'lvl_3', buffer: 4,
    minBuffer: 1, minSwings: 1, minFirstBox: 1,
    plates: [
      P('a', 2, hbar(2, 2, 4), [[2, 2], [5, 2]]),
      P('b', 2, hbar(2, 4, 4), [[2, 4], [5, 4]]),
      P('c', 1, vbar(3, 1, 6), [[3, 2], [3, 3], [3, 6]], 'bar'),
      P('d', 1, hbar(4, 7, 3), [[4, 7], [6, 7]]),
    ],
  },
  {
    id: 4, chapter: 1, nameKey: 'lvl_4', buffer: 4,
    minBuffer: 1, minSwings: 1, minFirstBox: 1,
    plates: [
      P('a', 3, hbar(1, 1, 6), [[1, 1], [3, 1], [6, 1]]),
      P('b', 3, vbar(7, 2, 5), [[7, 2], [7, 4], [7, 6]]),
      P('c', 2, hbar(1, 4, 6), [[1, 4], [4, 4], [6, 4]]),
      P('d', 1, vbar(2, 3, 5), [[2, 3], [2, 4], [2, 7]]),
    ],
  },

  // ================= Chapter 2 · Acrylic =================
  {
    id: 5, chapter: 2, nameKey: 'lvl_5', buffer: 4,
    minBuffer: 1, minSwings: 1, minFirstBox: 1,
    plates: [
      P('a', 3, hbar(1, 2, 5), [[1, 2], [5, 2]]),
      P('b', 2, vbar(3, 1, 5), [[3, 2], [3, 4]]),
      P('c', 1, hbar(1, 5, 5), [[3, 5], [5, 5]]),
      P('d', 2, vbar(6, 1, 4), [[6, 3]]),
      P('e', 1, hbar(2, 7, 4), [[2, 7], [5, 7]]),
    ],
  },
  {
    id: 6, chapter: 2, nameKey: 'lvl_6', buffer: 4,
    minBuffer: 1, minSwings: 1, minFirstBox: 1,
    plates: [
      P('a', 4, hbar(1, 1, 7), [[2, 1], [5, 1], [7, 1]]),
      P('b', 3, vbar(4, 1, 6), [[4, 1], [4, 4], [4, 6]]),
      P('c', 2, hbar(1, 4, 7), [[1, 4], [3, 4], [7, 4]]),
      P('d', 1, vbar(2, 4, 4), [[2, 4], [2, 5], [2, 7]]),
    ],
  },
  {
    id: 7, chapter: 2, nameKey: 'lvl_7', buffer: 4,
    minBuffer: 1, minSwings: 2, minFirstBox: 1,
    plates: [
      P('a', 3, hbar(2, 2, 4), [[2, 2], [5, 2]]),
      P('b', 3, hbar(1, 5, 6), [[1, 5], [5, 5]]),
      P('c', 2, vbar(3, 1, 6), [[3, 2], [3, 3], [3, 6]]),
      P('d', 2, vbar(6, 2, 5), [[6, 2], [6, 4], [6, 5]]),
      P('e', 1, hbar(2, 7, 5), [[2, 7], [6, 7]]),
    ],
  },
  {
    id: 8, chapter: 2, nameKey: 'lvl_8', buffer: 4,
    minBuffer: 1, minSwings: 2, minFirstBox: 1,
    plates: [
      P('a', 4, hbar(1, 1, 6), [[1, 1], [3, 1], [6, 1]]),
      P('b', 3, vbar(4, 1, 6), [[4, 1], [4, 3], [4, 5]]),
      P('c', 2, hbar(1, 4, 6), [[1, 4], [3, 4], [5, 4]]),
      P('d', 3, vbar(6, 1, 6), [[6, 4], [6, 5], [6, 6]]),
      P('e', 1, hbar(1, 7, 6), [[1, 7], [4, 7], [6, 7]]),
    ],
  },
  {
    id: 9, chapter: 2, nameKey: 'lvl_9', buffer: 4,
    minBuffer: 2, minSwings: 2, minFirstBox: 1,
    plates: [
      P('a', 5, vbar(3, 0, 4), [[3, 0], [3, 2], [3, 3]]),
      P('b', 4, hbar(1, 3, 6), [[1, 3], [2, 3], [6, 3]]),
      P('c', 3, vbar(5, 2, 5), [[5, 2], [5, 4], [5, 6]]),
      P('d', 2, hbar(1, 5, 6), [[1, 5], [5, 5], [6, 5]]),
      P('e', 1, hbar(1, 7, 6), [[1, 7], [3, 7], [6, 7]]),
    ],
  },

  // ================= Chapter 3 · Metal =================
  {
    id: 10, chapter: 3, nameKey: 'lvl_10', buffer: 3,
    minBuffer: 1, minSwings: 2, minFirstBox: 1,
    plates: [
      P('a', 4, hbar(1, 2, 6), [[1, 2], [5, 2]]),
      P('b', 3, vbar(3, 1, 5), [[3, 2], [3, 4]]),
      P('c', 3, vbar(6, 1, 5), [[6, 2], [6, 4]]),
      P('d', 2, hbar(1, 5, 6), [[1, 5], [6, 5]]),
      P('e', 1, [[3, 3]], [[3, 3]], 'single'),
    ],
  },
  {
    id: 11, chapter: 3, nameKey: 'lvl_11', buffer: 3,
    minBuffer: 1, minSwings: 2, minFirstBox: 1,
    plates: [
      P('a', 4, hbar(0, 1, 8), [[0, 1], [3, 1], [7, 1]]),
      P('b', 3, vbar(2, 1, 6), [[2, 1], [2, 3], [2, 5]]),
      P('c', 3, vbar(5, 1, 6), [[5, 1], [5, 3], [5, 5]]),
      P('d', 2, hbar(1, 6, 6), [[2, 6], [4, 6], [6, 6]]),
    ],
  },
  {
    id: 12, chapter: 3, nameKey: 'lvl_12', buffer: 3,
    minBuffer: 1, minSwings: 2, minFirstBox: 1,
    plates: [
      P('a', 4, hbar(1, 2, 6), [[1, 2], [3, 2], [6, 2]]),
      P('b', 3, vbar(4, 1, 6), [[4, 2], [4, 3], [4, 6]]),
      P('c', 2, hbar(1, 4, 6), [[1, 4], [3, 4], [6, 4]]),
      P('d', 1, vbar(2, 4, 4), [[2, 4], [2, 6], [2, 7]]),
    ],
  },
  {
    id: 13, chapter: 3, nameKey: 'lvl_13', buffer: 3,
    minBuffer: 2, minSwings: 3, minFirstBox: 1,
    plates: [
      P('a', 4, vbar(2, 1, 6), [[2, 1], [2, 3], [2, 5]]),
      P('b', 3, vbar(5, 1, 6), [[5, 1], [5, 4], [5, 6]]),
      P('c', 2, hbar(1, 3, 6), [[1, 3], [5, 3], [6, 3]]),
      P('d', 2, hbar(1, 6, 6), [[2, 6], [3, 6], [6, 6]]),
      P('e', 1, vbar(4, 4, 4), [[4, 4], [4, 6], [4, 7]]),
    ],
  },

  // ================= Chapter 4 · Neon =================
  {
    id: 14, chapter: 4, nameKey: 'lvl_14', buffer: 3,
    minBuffer: 1, minSwings: 2, minFirstBox: 1,
    plates: [
      P('a', 3, ring(4, 3), [[3, 2], [5, 2], [3, 4], [5, 4]], 'ring'),
      P('b', 2, hbar(1, 4, 6), [[1, 4], [4, 4], [6, 4]]),
      P('c', 1, vbar(2, 5, 3), [[2, 5], [2, 6]]),
      P('d', 2, hbar(2, 7, 5), [[2, 7], [4, 7], [6, 7]]),
    ],
  },
  {
    id: 15, chapter: 4, nameKey: 'lvl_15', buffer: 3,
    minBuffer: 1, minSwings: 2, minFirstBox: 1,
    plates: [
      P('a', 4, ring(3, 2), [[2, 1], [4, 1], [2, 3]], 'ring'),
      P('b', 4, ring(6, 4), [[5, 3], [5, 5], [7, 5]], 'ring'),
      P('c', 3, hbar(1, 3, 7), [[1, 3], [4, 3], [7, 3]]),
      P('d', 2, hbar(1, 6, 7), [[1, 6], [4, 6], [7, 6]]),
      P('e', 1, [[4, 5]], [[4, 5]], 'single'),
      P('f', 1, [[1, 1]], [[1, 1]], 'single'),
      P('g', 1, [[7, 7]], [[7, 7]], 'single'),
    ],
  },
  {
    id: 16, chapter: 4, nameKey: 'lvl_16', buffer: 3,
    minBuffer: 1, minSwings: 2, minFirstBox: 1,
    plates: [
      P('a', 4, ring(2, 2), [[1, 1], [3, 1], [1, 3]], 'ring'),
      P('b', 4, ring(6, 2), [[5, 1], [7, 1], [7, 3]], 'ring'),
      P('c', 3, vbar(4, 1, 7), [[4, 2], [4, 5], [4, 7]]),
      P('d', 2, hbar(1, 4, 7), [[1, 4], [4, 4], [7, 4]]),
      P('e', 1, [[4, 6]], [[4, 6]], 'single'),
      P('f', 1, [[1, 5]], [[1, 5]], 'single'),
      P('g', 1, [[7, 5]], [[7, 5]], 'single'),
    ],
  },
  {
    id: 17, chapter: 4, nameKey: 'lvl_17', buffer: 3,
    minBuffer: 2, minSwings: 3, minFirstBox: 1,
    plates: [
      P('a', 5, ring(2, 2), [[1, 1], [3, 1], [1, 3]], 'ring'),
      P('b', 5, ring(6, 2), [[5, 1], [7, 1], [7, 3]], 'ring'),
      P('c', 4, ring(4, 5), [[3, 4], [5, 4], [3, 6]], 'ring'),
      P('d', 3, hbar(1, 1, 7), [[2, 1], [4, 1], [6, 1]]),
      P('e', 2, hbar(1, 7, 7), [[1, 7], [4, 7], [7, 7]]),
      P('f', 1, vbar(4, 3, 5), [[4, 4], [4, 5], [4, 6]]),
    ],
  },
  {
    id: 18, chapter: 4, nameKey: 'lvl_18', buffer: 3,
    minBuffer: 2, minSwings: 3, minFirstBox: 1,
    plates: [
      P('a', 6, ring(3, 2), [[4, 1], [2, 3], [4, 3]], 'ring'),
      P('b', 6, ring(6, 2), [[5, 1], [7, 1], [7, 3]], 'ring'),
      P('c', 5, hbar(1, 1, 7), [[2, 1], [3, 1], [6, 1]]),
      P('d', 4, vbar(4, 1, 7), [[4, 2], [4, 5], [4, 6]]),
      P('e', 3, hbar(1, 4, 7), [[1, 4], [4, 4], [7, 4]]),
      P('f', 2, hbar(1, 7, 7), [[1, 7], [4, 7], [7, 7]]),
      P('g', 1, vbar(2, 4, 4), [[2, 5], [2, 6], [2, 7]]),
    ],
  },

  // ================= Chapter 5 · Master =================
  {
    id: 19, chapter: 5, nameKey: 'lvl_19', buffer: 3,
    minBuffer: 2, minSwings: 3, minFirstBox: 1,
    plates: [
      P('a', 6, ring(2, 2), [[2, 1], [1, 2], [2, 3]], 'ring'),
      P('b', 6, ring(6, 2), [[5, 1], [5, 3], [7, 3]], 'ring'),
      P('c', 5, cross(4, 4), [[4, 3], [3, 4], [5, 4]], 'cross'),
      P('d', 4, hbar(1, 1, 7), [[1, 1], [3, 1], [6, 1], [7, 1]]),
      P('e', 3, vbar(4, 2, 6), [[4, 4], [4, 5], [4, 6]]),
      P('f', 2, hbar(1, 7, 7), [[1, 7], [4, 7], [7, 7]]),
      P('g', 1, vbar(2, 4, 4), [[2, 5], [2, 7]]),
    ],
  },
  {
    id: 20, chapter: 5, nameKey: 'lvl_20', buffer: 3,
    minBuffer: 2, minSwings: 3, minFirstBox: 1,
    plates: [
      P('a', 7, ring(2, 2), [[2, 1], [1, 2], [2, 3]], 'ring'),
      P('b', 7, ring(6, 2), [[6, 1], [7, 2], [6, 3]], 'ring'),
      P('c', 6, hbar(1, 1, 7), [[1, 1], [3, 1], [5, 1]]),
      P('d', 5, vbar(2, 1, 7), [[2, 2], [2, 4], [2, 6]]),
      P('e', 5, vbar(6, 1, 7), [[6, 2], [6, 4], [6, 6]]),
      P('f', 4, hbar(1, 4, 7), [[1, 4], [5, 4], [7, 4]]),
      P('g', 3, hbar(1, 7, 7), [[2, 7], [5, 7], [7, 7]]),
      P('h', 2, vbar(4, 2, 6), [[4, 3], [4, 5], [4, 7]]),
    ],
  },
  {
    id: 21, chapter: 5, nameKey: 'lvl_21', buffer: 3,
    minBuffer: 2, minSwings: 4, minFirstBox: 1,
    plates: [
      P('a', 8, ring(2, 2), [[2, 1], [1, 2], [2, 3]], 'ring'),
      P('b', 8, ring(6, 2), [[6, 1], [7, 2], [6, 3]], 'ring'),
      P('c', 7, vbar(4, 0, 8), [[4, 1], [4, 3], [4, 6]]),
      P('d', 6, hbar(1, 1, 7), [[1, 1], [3, 1], [5, 1], [7, 1]]),
      P('e', 5, hbar(1, 4, 7), [[1, 4], [4, 4], [7, 4]]),
      P('f', 4, hbar(1, 7, 7), [[1, 7], [4, 7], [7, 7]]),
      P('g', 3, vbar(2, 4, 4), [[2, 4], [2, 6]]),
      P('h', 3, vbar(6, 4, 4), [[6, 4], [6, 6]]),
      P('i', 2, [[4, 5]], [[4, 5]], 'single'),
    ],
  },
];

function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
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

function composition(total, parts, rng) {
  const counts = new Array(parts).fill(1);
  let remaining = total - parts;
  while (remaining > 0) {
    counts[Math.floor(rng() * parts)] += 1;
    remaining -= 1;
  }
  return counts;
}

function makeLevel(spec, chapter, colorsByHole, boxQueue) {
  let colorCursor = 0;
  const plates = spec.plates.map((plate, plateIndex) => {
    const holes = [];
    for (const [c, r] of plate.holes) {
      holes.push([c, r, colorsByHole[colorCursor]]);
      colorCursor += 1;
    }
    const material = chapter.id === 5 ? MATERIAL_MIX[plateIndex % MATERIAL_MIX.length] : chapter.material;
    return {
      id: plate.id,
      layer: plate.layer,
      material,
      shape: plate.shape || 'bar',
      tone: plateIndex % 5,
      cells: plate.cells,
      holes,
    };
  });

  return {
    id: spec.id,
    nameKey: spec.nameKey,
    chapter: spec.chapter,
    bufferCapacity: spec.buffer,
    boxQueue,
    plates,
  };
}

function generatorForLevel(spec, chapter, attempt) {
  const rng = mulberry32(spec.id * 100003 + attempt * 7919 + chapter.id * 13);
  const totalScrews = spec.plates.reduce((sum, plate) => sum + plate.holes.length, 0);
  const totalBoxes = totalScrews / BOX_SIZE;
  if (!Number.isInteger(totalBoxes) || totalBoxes < chapter.colorCount) return null;

  const usedColors = COLORS.slice(0, chapter.colorCount);
  const boxCounts = composition(totalBoxes, chapter.colorCount, rng);

  const bag = [];
  usedColors.forEach((color, index) => {
    for (let i = 0; i < boxCounts[index] * BOX_SIZE; i += 1) bag.push(color);
  });
  shuffle(bag, rng);

  const boxQueue = [];
  usedColors.forEach((color, index) => {
    for (let i = 0; i < boxCounts[index]; i += 1) boxQueue.push(color);
  });
  shuffle(boxQueue, rng);

  const level = makeLevel(spec, chapter, bag, boxQueue);
  const problems = validateLevelData(level);
  if (problems.length) {
    throw new Error(`level ${spec.id} data invalid: ${problems.join(',')}`);
  }

  const initial = createState(level);
  const accessible = listAccessibleScrews(initial);
  const firstColor = boxQueue[0];
  const firstColorCount = accessible.filter((screw) => screw.color === firstColor).length;
  if (firstColorCount < spec.minFirstBox) return null;
  if (initial.status !== 'playing') return null;

  const solved = solveLevel(level, {
    seed: attempt + 1,
    maxNodes: 250000,
    preferBuffer: spec.minBuffer > 0 && attempt % 3 === 0,
  });
  if (!solved.solution || solved.aborted) return null;
  if (solved.bufferMoves < spec.minBuffer) return null;
  if (solved.swings < spec.minSwings) return null;
  if (solved.falls !== spec.plates.filter((plate) => plate.holes.length > 0).length) return null;

  const replay = replaySolution(level, solved.solution);
  if (!replay.ok) {
    throw new Error(`level ${spec.id} replay failed: ${replay.problem}`);
  }

  return { level, stats: solved };
}

function serializeLevel(level) {
  const plates = level.plates
    .map((plate) => {
      const cells = plate.cells.map(([c, r]) => `[${c},${r}]`).join(',');
      const holes = plate.holes.map(([c, r, color]) => `[${c},${r},'${color}']`).join(',');
      return `    { id: '${plate.id}', layer: ${plate.layer}, material: '${plate.material}', shape: '${plate.shape}', tone: ${plate.tone}, cells: [${cells}], holes: [${holes}] },`;
    })
    .join('\n');
  return `  {
    id: ${level.id},
    nameKey: '${level.nameKey}',
    chapter: ${level.chapter},
    bufferCapacity: ${level.bufferCapacity},
    boxQueue: [${level.boxQueue.map((color) => `'${color}'`).join(', ')}],
    plates: [
${plates}
    ],
  },`;
}

const results = [];
const attemptsPerLevel = 4000;

for (const spec of LEVEL_SPECS) {
  const chapter = CHAPTERS.find((item) => item.id === spec.chapter);
  let found = null;
  let attempts = 0;
  for (let attempt = 0; attempt < attemptsPerLevel; attempt += 1) {
    attempts += 1;
    found = generatorForLevel(spec, chapter, attempt);
    if (found) break;
  }
  if (!found) {
    throw new Error(`Could not generate solvable level ${spec.id} after ${attempts} attempts`);
  }
  results.push(found.level);
  console.log(
    `level ${spec.id}: screws=${found.level.plates.reduce((n, p) => n + p.holes.length, 0)} ` +
    `boxes=${found.level.boxQueue.join('>')} bufferMoves=${found.stats.bufferMoves} ` +
    `swings=${found.stats.swings} attempts=${attempts}`,
  );
}

const chapterLines = CHAPTERS.map(
  (chapter) => `  { id: ${chapter.id}, nameKey: '${chapter.nameKey}', subtitleKey: '${chapter.subtitleKey}', material: '${chapter.material}', colorCount: ${chapter.colorCount}, levelIds: [${LEVEL_SPECS.filter((spec) => spec.chapter === chapter.id)
    .map((spec) => spec.id)
    .join(', ')}] },`,
).join('\n');

const file = `/**
 * @file games/screw/js/levels.mjs
 * 21 关 · 五工坊篇章关卡数据（由 tools/gen-levels.mjs 生成并验证，请勿手改颜色与盒序）。
 * 所有关卡均通过 DAG 拓扑求解器验证，并在备用孔容量约束下存在完整解。
 */

export const CHAPTERS = [
${chapterLines}
];

export const LEVELS = [
${results.map(serializeLevel).join('\n')}
];

export function levelById(id) {
  return LEVELS.find((level) => level.id === Number(id)) || null;
}

export function levelsOfChapter(chapterId) {
  return LEVELS.filter((level) => level.chapter === Number(chapterId));
}

export function chapterById(id) {
  return CHAPTERS.find((chapter) => chapter.id === Number(id)) || null;
}

export function nextLevelId(id) {
  const index = LEVELS.findIndex((level) => level.id === Number(id));
  return index >= 0 && index + 1 < LEVELS.length ? LEVELS[index + 1].id : null;
}
`;

writeFileSync(resolve(import.meta.dirname, '..', 'js', 'levels.mjs'), file, 'utf8');
console.log(`Wrote ${results.length} levels.`);
