// levels.mjs - 20 hand-authored heists across five volumes.
// Pure data + geometry: no DOM, no storage, no locale strings (the UI looks
// names up through i18n keys). Every level ships an authored waypoint route
// that the test suite replays through the real engine, so "solvable" is a
// proven property rather than a promise.

import { playSolution } from "./engine.mjs";

const O = { x: 46, y: 300 };
const H = { x: 156, y: 300 };

export const CHAPTERS = [
  { id: 1, key: "chapter1" },
  { id: 2, key: "chapter2" },
  { id: 3, key: "chapter3" },
  { id: 4, key: "chapter4" },
  { id: 5, key: "chapter5" },
];

const raw = [
  // ---------------- Volume 1 - the apprentice ----------------
  {
    id: 1,
    chapter: 1,
    origin: { x: 46, y: 300 },
    handStart: { x: 156, y: 300 },
    target: { x: 742, y: 300, key: "pie" },
    pegs: [{ x: 430, y: 368, r: 42 }],
    solution: [
      { x: 320, y: 300 },
      { x: 470, y: 300 },
      { x: 610, y: 300 },
      { x: 742, y: 300 },
    ],
  },
  {
    id: 2,
    chapter: 1,
    origin: { x: 46, y: 300 },
    handStart: { x: 156, y: 300 },
    target: { x: 750, y: 350, key: "donut" },
    pegs: [{ x: 440, y: 352, r: 42 }],
    solution: [
      { x: 330, y: 330 },
      { x: 480, y: 340 },
      { x: 620, y: 350 },
      { x: 750, y: 350 },
    ],
  },
  {
    id: 3,
    chapter: 1,
    origin: { x: 46, y: 320 },
    handStart: { x: 156, y: 320 },
    target: { x: 752, y: 262, key: "ring" },
    pegs: [{ x: 460, y: 300, r: 44 }],
    solution: [
      { x: 350, y: 318 },
      { x: 500, y: 320 },
      { x: 640, y: 300 },
      { x: 752, y: 262 },
    ],
  },
  {
    id: 4,
    chapter: 1,
    origin: { x: 46, y: 300 },
    handStart: { x: 150, y: 300 },
    target: { x: 762, y: 330, key: "crown" },
    pegs: [
      { x: 330, y: 352, r: 40 },
      { x: 600, y: 344, r: 40 },
    ],
    solution: [
      { x: 240, y: 300 },
      { x: 350, y: 302 },
      { x: 480, y: 320 },
      { x: 620, y: 322 },
      { x: 762, y: 330 },
    ],
  },

  // ---------------- Volume 2 - the laser vault ----------------
  {
    id: 5,
    chapter: 2,
    origin: { x: 46, y: 306 },
    handStart: { x: 150, y: 306 },
    target: { x: 748, y: 306, key: "gold" },
    pegs: [{ x: 500, y: 306, r: 44 }],
    lasers: [{ x1: 570, y1: 56, x2: 570, y2: 300 }],
    solution: [
      { x: 286, y: 312 },
      { x: 430, y: 312 },
      { x: 574, y: 348 },
      { x: 718, y: 312 },
    ],
  },
  {
    id: 6,
    chapter: 2,
    origin: { x: 46, y: 300 },
    handStart: { x: 150, y: 300 },
    target: { x: 770, y: 300, key: "sapphire" },
    pegs: [
      { x: 390, y: 300, r: 42 },
      { x: 630, y: 300, r: 42 },
    ],
    lasers: [
      { x1: 470, y1: 56, x2: 470, y2: 300 },
      { x1: 700, y1: 300, x2: 700, y2: 528 },
    ],
    solution: [
      { x: 286, y: 312 },
      { x: 430, y: 312 },
      { x: 574, y: 276 },
      { x: 718, y: 312 },
      { x: 754, y: 312 },
    ],
  },
  {
    id: 7,
    chapter: 2,
    origin: { x: 46, y: 300 },
    handStart: { x: 150, y: 300 },
    target: { x: 700, y: 420, key: "key" },
    pegs: [
      { x: 360, y: 330, r: 38 },
      { x: 560, y: 350, r: 38 },
    ],
    lasers: [
      { x1: 430, y1: 340, x2: 430, y2: 528 },
      { x1: 640, y1: 56, x2: 640, y2: 300 },
    ],
    solution: [
      { x: 330, y: 280 },
      { x: 470, y: 300 },
      { x: 600, y: 380 },
      { x: 690, y: 420 },
    ],
  },
  {
    id: 8,
    chapter: 2,
    origin: { x: 46, y: 300 },
    handStart: { x: 150, y: 300 },
    target: { x: 752, y: 240, key: "mask" },
    pegs: [
      { x: 300, y: 300, r: 36 },
      { x: 470, y: 290, r: 36 },
      { x: 640, y: 270, r: 36 },
    ],
    lasers: [
      { x1: 370, y1: 56, x2: 370, y2: 290 },
      { x1: 540, y1: 290, x2: 540, y2: 528 },
    ],
    solution: [
      { x: 286, y: 348 },
      { x: 430, y: 276 },
      { x: 574, y: 240 },
      { x: 718, y: 240 },
    ],
  },

  // ---------------- Volume 3 - hound and lever ----------------
  {
    id: 9,
    chapter: 3,
    origin: { x: 46, y: 300 },
    handStart: { x: 150, y: 300 },
    target: { x: 752, y: 380, key: "goblet" },
    pegs: [{ x: 420, y: 300, r: 42 }],
    levers: [{ x: 700, y: 130, group: "vault" }],
    lasers: [
      { x1: 574, y1: 210, x2: 574, y2: 520, group: "vault" },
      { x1: 574, y1: 210, x2: 780, y2: 210, group: "vault" },
    ],
    solution: [
      { x: 360, y: 250 },
      { x: 520, y: 240 },
      { x: 660, y: 160 },
      { x: 700, y: 130 },
      { x: 700, y: 300 },
      { x: 752, y: 380 },
    ],
  },
  {
    id: 10,
    chapter: 3,
    origin: { x: 46, y: 320 },
    handStart: { x: 150, y: 320 },
    target: { x: 760, y: 300, key: "boots" },
    pegs: [{ x: 380, y: 320, r: 40 }],
    dogs: [{ x: 560, y: 412, r: 54 }],
    levers: [{ x: 620, y: 170, group: "kennel" }],
    wires: [{ x: 690, y: 340, w: 46, h: 180, group: "kennel" }],
    lasers: [{ x1: 450, y1: 56, x2: 450, y2: 300 }],
    solution: [
      { x: 286, y: 312 },
      { x: 430, y: 348 },
      { x: 574, y: 312 },
      { x: 718, y: 276 },
      { x: 754, y: 276 },
    ],
  },
  {
    id: 11,
    chapter: 3,
    origin: { x: 46, y: 300 },
    handStart: { x: 150, y: 300 },
    target: { x: 764, y: 300, key: "watch" },
    pegs: [
      { x: 340, y: 300, r: 38 },
      { x: 600, y: 300, r: 38 },
    ],
    levers: [
      { x: 520, y: 150, group: "gate1" },
      { x: 520, y: 452, group: "gate2" },
    ],
    lasers: [
      { x1: 600, y1: 240, x2: 600, y2: 540, group: "gate1" },
      { x1: 600, y1: 60, x2: 600, y2: 240, group: "gate2" },
    ],
    solution: [
      { x: 300, y: 250 },
      { x: 460, y: 200 },
      { x: 520, y: 150 },
      { x: 520, y: 320 },
      { x: 520, y: 452 },
      { x: 660, y: 380 },
      { x: 764, y: 300 },
    ],
  },
  {
    id: 12,
    chapter: 3,
    origin: { x: 46, y: 300 },
    handStart: { x: 150, y: 300 },
    target: { x: 756, y: 440, key: "cat" },
    pegs: [
      { x: 300, y: 320, r: 36 },
      { x: 520, y: 340, r: 36 },
    ],
    dogs: [{ x: 520, y: 470, r: 48 }],
    levers: [{ x: 660, y: 200, group: "cage" }],
    lasers: [
      { x1: 660, y1: 300, x2: 660, y2: 520, group: "cage" },
      { x1: 660, y1: 300, x2: 790, y2: 300, group: "cage" },
    ],
    solution: [
      { x: 260, y: 270 },
      { x: 400, y: 280 },
      { x: 520, y: 300 },
      { x: 640, y: 240 },
      { x: 660, y: 200 },
      { x: 700, y: 360 },
      { x: 756, y: 440 },
    ],
  },

  // ---------------- Volume 4 - sweeping spotlights ----------------
  {
    id: 13,
    chapter: 4,
    origin: { x: 46, y: 300 },
    handStart: { x: 150, y: 300 },
    target: { x: 756, y: 300, key: "statue" },
    pegs: [{ x: 440, y: 300, r: 44 }],
    lasers: [{ x1: 560, y1: 56, x2: 560, y2: 288 }],
    spotlights: [{ x: 620, y: 40, angle: 1.9, amplitude: 0.42, period: 5.2, spread: 0.24, length: 300, phase: 0.24 }],
    solution: [
      { x: 286, y: 312 },
      { x: 430, y: 348 },
      { x: 574, y: 312 },
      { x: 718, y: 312 },
    ],
  },
  {
    id: 14,
    chapter: 4,
    origin: { x: 46, y: 300 },
    handStart: { x: 150, y: 300 },
    target: { x: 770, y: 232, key: "violin" },
    pegs: [
      { x: 380, y: 300, r: 40 },
      { x: 620, y: 320, r: 40 },
    ],
    lasers: [
      { x1: 470, y1: 40, x2: 470, y2: 300 },
      { x1: 710, y1: 320, x2: 710, y2: 540 },
    ],
    spotlights: [
      { x: 500, y: 40, angle: 1.6, amplitude: 0.5, period: 6.4, spread: 0.2, length: 280 },
      { x: 700, y: 540, angle: -1.5, amplitude: 0.46, period: 5.6, spread: 0.2, length: 280, phase: 1.2 },
    ],
    solution: [
      { x: 300, y: 250 },
      { x: 430, y: 340 },
      { x: 590, y: 360 },
      { x: 700, y: 262 },
      { x: 770, y: 232 },
    ],
  },
  {
    id: 15,
    chapter: 4,
    origin: { x: 46, y: 300 },
    handStart: { x: 150, y: 300 },
    target: { x: 740, y: 430, key: "codex" },
    pegs: [{ x: 420, y: 340, r: 40 }],
    lasers: [
      { x1: 470, y1: 352, x2: 470, y2: 560 },
      { x1: 660, y1: 60, x2: 660, y2: 300 },
    ],
    dogs: [{ x: 600, y: 470, r: 46 }],
    spotlights: [{ x: 520, y: 40, angle: 1.85, amplitude: 0.42, period: 5.4, spread: 0.2, length: 300, phase: 0.47 }],
    solution: [
      { x: 360, y: 300 },
      { x: 445, y: 312 },
      { x: 560, y: 380 },
      { x: 660, y: 410 },
      { x: 740, y: 430 },
    ],
  },
  {
    id: 16,
    chapter: 4,
    origin: { x: 46, y: 300 },
    handStart: { x: 150, y: 300 },
    target: { x: 720, y: 440, key: "tiara" },
    pegs: [
      { x: 340, y: 300, r: 38 },
      { x: 500, y: 280, r: 38 },
    ],
    dogs: [{ x: 470, y: 470, r: 48 }],
    levers: [{ x: 540, y: 190, group: "beam" }],
    lasers: [
      { x1: 620, y1: 360, x2: 790, y2: 360, group: "beam" },
      { x1: 620, y1: 360, x2: 620, y2: 540, group: "beam" },
    ],
    spotlights: [{ x: 600, y: 40, angle: 1.7, amplitude: 0.44, period: 5.8, spread: 0.22, length: 320, phase: 4.55 }],
    solution: [
      { x: 300, y: 262 },
      { x: 420, y: 250 },
      { x: 520, y: 220 },
      { x: 540, y: 190 },
      { x: 620, y: 300 },
      { x: 700, y: 400 },
      { x: 720, y: 440 },
    ],
  },

  // ---------------- Volume 5 - the Louvre ----------------
  {
    id: 17,
    chapter: 5,
    origin: { x: 46, y: 290 },
    handStart: { x: 150, y: 290 },
    target: { x: 772, y: 300, key: "painting" },
    pegs: [
      { x: 300, y: 290, r: 36 },
      { x: 470, y: 300, r: 36 },
      { x: 650, y: 290, r: 36 },
    ],
    lasers: [
      { x1: 370, y1: 56, x2: 370, y2: 278 },
      { x1: 545, y1: 322, x2: 545, y2: 528 },
      { x1: 720, y1: 56, x2: 720, y2: 278 },
      { x1: 620, y1: 280, x2: 620, y2: 528 },
      { x1: 240, y1: 420, x2: 460, y2: 420 },
    ],
    solution: [
      { x: 286, y: 348 },
      { x: 430, y: 276 },
      { x: 574, y: 276 },
      { x: 718, y: 276 },
      { x: 754, y: 312 },
    ],
  },
  {
    id: 18,
    chapter: 5,
    origin: { x: 46, y: 300 },
    handStart: { x: 150, y: 300 },
    target: { x: 766, y: 300, key: "mona" },
    pegs: [
      { x: 300, y: 300, r: 40 },
      { x: 620, y: 300, r: 40 },
    ],
    lasers: [
      { x1: 380, y1: 56, x2: 380, y2: 300 },
      { x1: 700, y1: 300, x2: 700, y2: 528 },
    ],
    dogs: [{ x: 500, y: 470, r: 50 }],
    spotlights: [{ x: 470, y: 40, angle: 1.9, amplitude: 0.4, period: 6, spread: 0.18, length: 260 }],
    solution: [
      { x: 286, y: 348 },
      { x: 430, y: 312 },
      { x: 574, y: 276 },
      { x: 718, y: 276 },
      { x: 754, y: 312 },
    ],
  },
  {
    id: 19,
    chapter: 5,
    origin: { x: 46, y: 300 },
    handStart: { x: 150, y: 300 },
    target: { x: 758, y: 280, key: "ledger" },
    pegs: [
      { x: 340, y: 300, r: 36 },
      { x: 520, y: 280, r: 36 },
      { x: 680, y: 300, r: 36 },
    ],
    levers: [{ x: 430, y: 460, group: "louvre" }],
    lasers: [
      { x1: 600, y1: 380, x2: 600, y2: 540, group: "louvre" },
      { x1: 600, y1: 380, x2: 800, y2: 380, group: "louvre" },
      { x1: 440, y1: 220, x2: 440, y2: 60 },
      { x1: 660, y1: 56, x2: 660, y2: 280 },
    ],
    spotlights: [{ x: 520, y: 540, angle: -1.4, amplitude: 0.5, period: 6.2, spread: 0.2, length: 300, phase: 0.61 }],
    solution: [
      { x: 286, y: 312 },
      { x: 430, y: 312 },
      { x: 574, y: 312 },
      { x: 718, y: 312 },
      { x: 754, y: 276 },
    ],
  },
  {
    id: 20,
    chapter: 5,
    origin: { x: 46, y: 290 },
    handStart: { x: 150, y: 290 },
    target: { x: 770, y: 300, key: "diamond" },
    pegs: [
      { x: 300, y: 290, r: 34 },
      { x: 470, y: 310, r: 34 },
      { x: 640, y: 290, r: 34 },
    ],
    lasers: [
      { x1: 380, y1: 250, x2: 380, y2: 60 },
      { x1: 540, y1: 350, x2: 540, y2: 520 },
      { x1: 320, y1: 280, x2: 320, y2: 528 },
      { x1: 720, y1: 250, x2: 720, y2: 60 },
    ],
    dogs: [{ x: 600, y: 430, r: 44 }],
    spotlights: [{ x: 460, y: 40, angle: 1.75, amplitude: 0.4, period: 5.4, spread: 0.18, length: 260, phase: 0.35 }],
    solution: [
      { x: 286, y: 240 },
      { x: 430, y: 276 },
      { x: 574, y: 276 },
      { x: 718, y: 276 },
      { x: 754, y: 312 },
    ],
  },
];

function decorate(level) {
  const target = { r: 20, ...level.target };
  const pegs = (level.pegs ?? []).map((peg) => ({ kind: "column", ...peg }));
  return {
    ...level,
    target,
    pegs,
    lasers: level.lasers ?? [],
    wires: level.wires ?? [],
    dogs: level.dogs ?? [],
    levers: level.levers ?? [],
    spotlights: level.spotlights ?? [],
  };
}

export const LEVELS = raw.map(decorate);

// Par is the authored route length (the shortest route we can vouch for), plus
// a small allowance so a clean three-star run is reachable in practice.
for (const level of LEVELS) {
  const route = playSolution(level);
  level.par = Math.max(1, Math.ceil((route.travelled || 1) * 1.04));
}

export const LEVEL_COUNT = LEVELS.length;

export const chapterLevels = (chapter) => LEVELS.filter((level) => level.chapter === chapter);

export function getLevel(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function nextLevelId(id) {
  const index = LEVELS.findIndex((level) => level.id === id);
  if (index < 0) return LEVELS[0].id;
  return LEVELS[Math.min(LEVELS.length - 1, index + 1)].id;
}

export function isUnlocked(id, cleared) {
  if (id <= 1) return true;
  const previous = id - 1;
  return Boolean(cleared && cleared[previous]);
}
