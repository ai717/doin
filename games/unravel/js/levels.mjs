// unravel levels — pure data, zero hardcoded display text.
// 40 levels across 4 chapters: yarn ball, sweater, doll, garden.
// Difficulty curve levers per level:
//   deep   - how many colors carry 6 chips (triplets 2): the third chip sits
//            deep in the tangle, so the rack must hold 2 chips while digging;
//   colors - more colors means more spread pressure against the 6-slot rack;
//   span   - chord angular span: wider chords cross more, deeper occlusion;
//   minFree - guaranteed free strands on the open board (branching slack);
//   tightCap - slot ceiling the REFERENCE solution order must respect, always
//   below the fail cap of 6: the intended path always keeps 1-2 slots spare.
// Display names live in js/i18n.mjs via chapter/object/color keys.

const PALETTE = ["red", "amber", "teal", "indigo", "rose", "moss"];

function colorsFor(index, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(PALETTE[(index + i) % PALETTE.length]);
  }
  return out;
}

function tripletsFor(deep, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(i < deep ? 2 : 1);
  }
  return out;
}

// [object, colorCount, deep, knots, duals, minFree, spanMin, spanMax]
const TABLE = [
  ["yarnball", 3, 0, 0, 0, 3, 60, 150, 4],
  ["yarnball", 3, 0, 0, 0, 3, 65, 150, 4],
  ["yarnball", 3, 0, 0, 0, 2, 70, 155, 4],
  ["yarnball", 4, 0, 0, 0, 3, 70, 155, 4],
  ["yarnball", 4, 0, 0, 0, 2, 70, 155, 4],
  ["yarnball", 4, 1, 0, 0, 2, 75, 155, 4],
  ["yarnball", 4, 1, 0, 0, 2, 75, 160, 4],
  ["yarnball", 4, 1, 0, 0, 2, 80, 160, 4],
  ["yarnball", 4, 1, 0, 0, 2, 80, 160, 4],
  ["yarnball", 4, 1, 0, 0, 2, 85, 160, 4],
  ["sweater", 4, 1, 1, 0, 2, 85, 160, 4],
  ["sweater", 4, 1, 1, 0, 2, 85, 165, 4],
  ["sweater", 4, 1, 1, 0, 2, 90, 165, 4],
  ["sweater", 4, 1, 2, 0, 2, 90, 165, 4],
  ["sweater", 4, 1, 2, 0, 2, 90, 165, 4],
  ["sweater", 4, 2, 2, 0, 2, 95, 165, 4],
  ["sweater", 4, 2, 2, 0, 2, 95, 170, 4],
  ["sweater", 4, 2, 2, 0, 2, 100, 170, 4],
  ["sweater", 4, 2, 2, 0, 2, 100, 170, 4],
  ["sweater", 4, 2, 2, 0, 1, 105, 170, 4],
  ["doll", 5, 1, 1, 1, 2, 100, 170, 5],
  ["doll", 5, 1, 1, 1, 2, 100, 170, 5],
  ["doll", 5, 2, 1, 1, 2, 105, 170, 5],
  ["doll", 5, 2, 2, 1, 2, 105, 170, 5],
  ["doll", 5, 2, 2, 1, 2, 110, 170, 5],
  ["doll", 5, 2, 2, 1, 2, 110, 172, 5],
  ["doll", 5, 2, 2, 2, 1, 110, 172, 5],
  ["doll", 5, 2, 2, 2, 1, 115, 172, 5],
  ["doll", 5, 2, 2, 2, 1, 115, 175, 5],
  ["doll", 5, 2, 2, 2, 1, 115, 175, 5],
  ["garden", 5, 2, 2, 2, 1, 115, 175, 5],
  ["garden", 5, 2, 2, 2, 1, 115, 175, 5],
  ["garden", 5, 2, 2, 2, 1, 120, 175, 5],
  ["garden", 5, 2, 3, 2, 1, 120, 175, 5],
  ["garden", 5, 2, 3, 2, 1, 120, 175, 5],
  ["garden", 6, 2, 3, 2, 1, 120, 178, 5],
  ["garden", 6, 2, 3, 2, 1, 125, 178, 5],
  ["garden", 6, 2, 3, 3, 1, 125, 178, 5],
  ["garden", 6, 3, 3, 3, 1, 125, 180, 5],
  ["garden", 6, 3, 3, 3, 1, 130, 180, 5],
];

export const LEVELS = TABLE.map((row, i) => {
  const id = i + 1;
  const [object, colorCount, deep, knots, duals, minFree, spanMin, spanMax, tightCap] = row;
  const triplets = tripletsFor(deep, colorCount);
  const chips = triplets.reduce((sum, t) => sum + t * 3, 0) - duals;
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
    spanMin,
    spanMax,
    tightCap,
    parMs: 15000 + chips * 3500,
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
  triplets: [2, 1, 1, 1],
  knots: 1,
  duals: 1,
  maxCover: 6,
  minFree: 2,
  spanMin: 85,
  spanMax: 165,
  tightCap: 5,
  parMs: 60000,
};

// Deterministic per-level generation seed.
export function levelSeed(id) {
  return (Math.imul(id, 2654435761) ^ 0x9e3779b9) >>> 0;
}
