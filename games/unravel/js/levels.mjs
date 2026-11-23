// unravel levels — pure data, zero hardcoded display text.
// 40 levels across 4 chapters: yarn ball, sweater, doll, garden.
// Display names live in js/i18n.mjs via chapter/object/color keys.

const PALETTE = ["red", "amber", "teal", "indigo", "rose", "moss"];

function colorsFor(index, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(PALETTE[(index + i) % PALETTE.length]);
  }
  return out;
}

// [object, colorCount, triplets, knots, duals, maxCover(unused hint), minFree]
const TABLE = [
  ["yarnball", 3, 1, 0, 0, 3],
  ["yarnball", 3, 1, 0, 0, 3],
  ["yarnball", 3, 1, 0, 0, 3],
  ["yarnball", 3, 1, 0, 0, 2],
  ["yarnball", 3, 1, 0, 0, 2],
  ["yarnball", 4, 1, 0, 0, 3],
  ["yarnball", 4, 1, 0, 0, 2],
  ["yarnball", 4, 1, 0, 0, 2],
  ["yarnball", 4, 1, 0, 0, 2],
  ["yarnball", 4, 1, 0, 0, 2],
  ["sweater", 4, 1, 1, 0, 2],
  ["sweater", 4, 1, 1, 0, 2],
  ["sweater", 4, 1, 1, 0, 2],
  ["sweater", 4, 1, 2, 0, 2],
  ["sweater", 4, 1, 2, 0, 2],
  ["sweater", 4, 1, 2, 0, 2],
  ["sweater", 4, 1, 2, 0, 2],
  ["sweater", 4, 1, 2, 0, 2],
  ["sweater", 4, 1, 2, 0, 2],
  ["sweater", 4, 1, 2, 0, 2],
  ["doll", 4, 1, 1, 1, 2],
  ["doll", 4, 1, 1, 1, 2],
  ["doll", 4, 1, 1, 1, 2],
  ["doll", 4, 1, 2, 1, 2],
  ["doll", 4, 1, 2, 1, 2],
  ["doll", 5, 1, 2, 2, 2],
  ["doll", 5, 1, 2, 2, 2],
  ["doll", 5, 1, 2, 2, 2],
  ["doll", 5, 1, 2, 2, 2],
  ["doll", 5, 1, 2, 2, 2],
  ["garden", 5, 1, 2, 2, 2],
  ["garden", 5, 1, 2, 2, 2],
  ["garden", 5, 1, 2, 2, 2],
  ["garden", 5, 1, 3, 2, 2],
  ["garden", 5, 1, 3, 2, 2],
  ["garden", 5, 1, 3, 3, 2],
  ["garden", 5, 1, 3, 3, 2],
  ["garden", 5, 1, 3, 3, 1],
  ["garden", 5, 1, 3, 3, 1],
  ["garden", 5, 1, 3, 3, 1],
];

export const LEVELS = TABLE.map((row, i) => {
  const id = i + 1;
  const [object, colorCount, triplets, knots, duals, minFree] = row;
  const strandEstimate = colorCount * triplets * 3 - duals;
  return {
    id,
    chapter: Math.floor(i / 10) + 1,
    object,
    colors: colorsFor(i, colorCount),
    triplets,
    knots,
    duals,
    maxCover: 6,
    minFree,
    parMs: 15000 + strandEstimate * 3500,
  };
});

export function getLevel(id) {
  const level = LEVELS.find((l) => l.id === id);
  return level || LEVELS[0];
}

export const LEVEL_COUNT = LEVELS.length;

export const CHAPTER_COUNT = 4;

export const RELAX_PARAMS = {
  id: 0,
  object: "yarnball",
  colors: colorsFor(7, 4),
  triplets: 1,
  knots: 1,
  duals: 1,
  maxCover: 6,
  minFree: 2,
  parMs: 60000,
};

// Deterministic per-level generation seed.
export function levelSeed(id) {
  return (Math.imul(id, 2654435761) ^ 0x9e3779b9) >>> 0;
}
