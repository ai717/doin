// Hand-authored stage data: 30 levels across three chapters, plus one Rush arena.
// Coordinates use a fixed 960 x 540 stage. Enemy y is the feet position unless the enemy flies.

export const STAGE_W = 960;
export const STAGE_H = 540;

export const CHAPTERS = [
  { id: "village", nameKey: "chapterVillage", accent: "#66b8ee" },
  { id: "crystal", nameKey: "chapterCrystal", accent: "#79ecff" },
  { id: "aurora", nameKey: "chapterAurora", accent: "#8ef7c4" },
];

const ground = (type = "snow") => ({ x: 0, y: 500, w: 960, h: 40, type });

function p(x, y, w, type = "snow") {
  return { x, y, w, h: 16, type };
}

export const LAYOUTS = [
  {
    id: "terraces",
    spawn: { x: 480, y: 500 },
    platforms: [ground(), p(120, 390, 220), p(620, 390, 220), p(370, 280, 220), p(110, 170, 190), p(660, 170, 190)],
    bricks: [],
    slots: [
      [200, 390], [760, 390], [480, 500], [200, 500], [760, 500], [480, 280], [150, 170], [810, 170],
    ],
  },
  {
    id: "towers",
    spawn: { x: 480, y: 500 },
    platforms: [ground(), p(60, 390, 200), p(380, 390, 200), p(700, 390, 200), p(220, 280, 200), p(540, 280, 200), p(380, 170, 200)],
    bricks: [
      { x: 450, y: 470, w: 32, h: 30, item: "star" },
      { x: 482, y: 470, w: 32, h: 30, item: null },
    ],
    slots: [
      [140, 390], [460, 390], [800, 390], [320, 280], [640, 280], [480, 170], [160, 170], [820, 170],
    ],
  },
  {
    id: "springyard",
    spawn: { x: 480, y: 500 },
    platforms: [
      ground(),
      { x: 300, y: 492, w: 60, h: 8, type: "spring" },
      { x: 600, y: 492, w: 60, h: 8, type: "spring" },
      p(150, 380, 210), p(600, 380, 210), p(380, 265, 200), p(90, 150, 190), p(680, 150, 190),
    ],
    bricks: [],
    slots: [
      [210, 380], [650, 380], [480, 500], [240, 500], [720, 500], [480, 265], [250, 150], [710, 150],
    ],
  },
  {
    id: "iceshelves",
    spawn: { x: 480, y: 500 },
    platforms: [
      { x: 0, y: 500, w: 220, h: 40, type: "snow" },
      { x: 220, y: 500, w: 520, h: 40, type: "ice" },
      { x: 740, y: 500, w: 220, h: 40, type: "snow" },
      p(120, 390, 220, "ice"),
      p(620, 390, 220, "ice"),
      p(370, 290, 220),
      p(200, 180, 180),
      p(580, 180, 180),
    ],
    bricks: [{ x: 200, y: 360, w: 32, h: 30, item: "heart" }],
    slots: [
      [200, 390], [700, 390], [480, 290], [300, 500], [660, 500], [290, 180], [670, 180], [480, 120],
    ],
  },
  {
    id: "brokenbridge",
    spawn: { x: 200, y: 500 },
    platforms: [
      { x: 0, y: 500, w: 380, h: 40, type: "snow" },
      { x: 580, y: 500, w: 380, h: 40, type: "snow" },
      p(120, 390, 220), p(620, 390, 220), p(370, 300, 220), p(90, 200, 200), p(670, 200, 200),
    ],
    bricks: [
      { x: 440, y: 270, w: 32, h: 30, item: "star" },
      { x: 472, y: 270, w: 32, h: 30, item: null },
    ],
    slots: [
      [140, 390], [820, 390], [480, 300], [260, 500], [700, 500], [290, 200], [670, 200], [480, 140],
    ],
  },
];

const POOLS = [
  ["slime", "slime", "flyer"],
  ["slime", "flyer", "thrower"],
  ["slime", "thrower", "armored", "flyer"],
];

function poolFor(chapter, indexInChapter) {
  const pool = POOLS[chapter];
  if (indexInChapter < 3) return pool.slice(0, 2);
  return pool;
}

function buildLevel(index) {
  const chapter = Math.floor(index / 10);
  const inChapter = index % 10;
  const layoutIndex = (inChapter + chapter) % LAYOUTS.length;
  const layout = LAYOUTS[layoutIndex];
  const isBoss = inChapter === 9;
  const enemies = [];
  if (isBoss) {
    enemies.push({ type: "slime", x: 220, y: 500 }, { type: "slime", x: 740, y: 500 });
    return {
      id: `snow_${String(index + 1).padStart(2, "0")}`,
      index,
      chapter,
      layoutIndex,
      par: 62 + index,
      boss: { x: 480, y: 430, hp: 3 + chapter },
      enemies,
      playerSpawn: layout.spawn,
    };
  }
  const pool = poolFor(chapter, inChapter);
  const count = Math.min(7, 3 + Math.floor(inChapter / 2));
  const slots = layout.slots;
  for (let k = 0; k < count; k += 1) {
    const type = pool[(k + inChapter) % pool.length];
    const slot = slots[k % slots.length];
    enemies.push({ type, x: slot[0], y: slot[1] });
  }
  return {
    id: `snow_${String(index + 1).padStart(2, "0")}`,
    index,
    chapter,
    layoutIndex,
    par: 38 + inChapter * 2,
    boss: null,
    enemies,
    playerSpawn: layout.spawn,
  };
}

export const LEVELS = Array.from({ length: 30 }, (_, index) => buildLevel(index));

export const LEVELS_PER_CHAPTER = 10;
export const TOTAL_LEVELS = LEVELS.length;

export const RUSH = {
  id: "rush",
  duration: 90,
  layoutIndex: 0,
  playerSpawn: LAYOUTS[0].spawn,
  waves: 26,
};

export function getLevel(index) {
  const safe = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.floor(Number(index) || 0)));
  const base = LEVELS[safe];
  return { ...base, layout: LAYOUTS[base.layoutIndex] };
}

export function chapterOf(index) {
  const safe = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.floor(Number(index) || 0)));
  return CHAPTERS[Math.floor(safe / LEVELS_PER_CHAPTER)];
}

export function levelLabelKey(index) {
  return `levelLabel`;
}
