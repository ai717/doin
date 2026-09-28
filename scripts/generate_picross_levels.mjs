import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deriveGridClues, solveGrid } from "../games/picross/js/engine.mjs";

function parseArt(str) {
  const lines = str.trim().split("\n").map(l => l.trim()).filter(l => l.length > 0);
  return lines.map(line => line.replace(/\s+/g, "").split("").map(ch => (ch === "#" || ch === "1" ? 1 : 0)));
}

// 40 Levels definition
const rawLevels = [
  // --- Chapter 0: Prologue (5x5) ---
  {
    id: "p1",
    chapterKey: "chapter_prologue",
    titleKey: "level_heart",
    stampColor: "#EF4444",
    art: `
. # . # .
# # # # #
# # # # #
. # # # .
. . # . .
`
  },
  {
    id: "p2",
    chapterKey: "chapter_prologue",
    titleKey: "level_smile",
    stampColor: "#F59E0B",
    art: `
. # # # .
# . # . #
# . . . #
# # . # #
. # # # .
`
  },
  {
    id: "p3",
    chapterKey: "chapter_prologue",
    titleKey: "level_arrow",
    stampColor: "#3B82F6",
    art: `
. . # . .
. # # # .
# . # . #
. . # . .
. . # . .
`
  },
  {
    id: "p4",
    chapterKey: "chapter_prologue",
    titleKey: "level_cup",
    stampColor: "#10B981",
    art: `
# # # . .
# . # # .
# # # # #
# # # # .
. # # . .
`
  },

  // --- Chapter 1: Fruit Garden (5x5 to 10x10) ---
  {
    id: "f1",
    chapterKey: "chapter_fruit",
    titleKey: "level_apple",
    stampColor: "#DC2626",
    art: `
. . # # .
. # # # #
# # # # #
# # # # #
. # # # .
`
  },
  {
    id: "f2",
    chapterKey: "chapter_fruit",
    titleKey: "level_cherry",
    stampColor: "#E11D48",
    art: `
. . . # # .
. . # . # .
. # . . # .
# # . # # #
# # . # # #
# # . # # #
`
  },
  {
    id: "f3",
    chapterKey: "chapter_fruit",
    titleKey: "level_watermelon",
    stampColor: "#15803D",
    art: `
. # # # # # .
# # # # # # #
# . # . # . #
# # # # # # #
. # # # # # .
. . # # # . .
. . . # . . .
`
  },
  {
    id: "f4",
    chapterKey: "chapter_fruit",
    titleKey: "level_banana",
    stampColor: "#FBBF24",
    art: `
. . . . . . # #
. . . . . # # #
. . . . # # # .
. . . # # # . .
. . # # # . . .
. # # # . . . .
# # # # . . . .
# # # . . . . .
`
  },
  {
    id: "f5",
    chapterKey: "chapter_fruit",
    titleKey: "level_grape",
    stampColor: "#8B5CF6",
    art: `
. . . # # . . .
. . # # . . . .
. # # # # # . .
# # # # # # # .
. # # # # # . .
. . # # # . . .
. . # # # . . .
. . . # . . . .
`
  },
  {
    id: "f6",
    chapterKey: "chapter_fruit",
    titleKey: "level_pear",
    stampColor: "#84CC16",
    art: `
. . . . # # . . . .
. . . . . # . . . .
. . . # # # . . . .
. . # # # # # . . .
. . # # # # # . . .
. # # # # # # # . .
# # # # # # # # # .
# # # # # # # # # .
# # # # # # # # # .
. # # # # # # # . .
`
  },
  {
    id: "f7",
    chapterKey: "chapter_fruit",
    titleKey: "level_strawberry",
    stampColor: "#F43F5E",
    art: `
. . # # # # # . . .
. # # # # # # # . .
# # . # # # . # # .
# # # # # # # # # .
# # # . # # # . # .
. # # # # # # # . .
. # # # # # # # . .
. . # # # # # . . .
. . . # # # . . . .
. . . . # . . . . .
`
  },
  {
    id: "f8",
    chapterKey: "chapter_fruit",
    titleKey: "level_pineapple",
    stampColor: "#D97706",
    art: `
. . # . # . # . . .
. # # # # # # # . .
. . # # # # # . . .
. # # # # # # # . .
# # . # # # . # # .
# # # # # # # # # .
# # . # # # . # # .
# # # # # # # # # .
. # # # # # # # . .
. . # # # # # . . .
`
  },

  // --- Chapter 2: Pet Planet (10x10) ---
  {
    id: "a1",
    chapterKey: "chapter_pet",
    titleKey: "level_cat",
    stampColor: "#EC4899",
    art: `
# # . . . . . # # .
# # # . . . # # # .
# # # # # # # # # .
# . # # # # # . # .
# # # # # # # # # .
# # # . # . # # # .
# # # # # # # # # .
. # # # # # # # . .
. . # # # # # . # #
. . # # . # # . # #
`
  },
  {
    id: "a2",
    chapterKey: "chapter_pet",
    titleKey: "level_dog",
    stampColor: "#B45309",
    art: `
. # # . . . # # . .
# # # # . # # # # .
# # # # # # # # # .
# . # # # # # . # .
# # # # # # # # # .
. # # # # # # # . .
. . # # # # # . . .
. # # # # # # # . .
. # # . . . # # . .
. # # . . . # # . .
`
  },
  {
    id: "a3",
    chapterKey: "chapter_pet",
    titleKey: "level_rabbit",
    stampColor: "#FB7185",
    art: `
. # # . . . # # . .
. # # . . . # # . .
. # # . . . # # . .
. # # # # # # # . .
# # # # # # # # # .
# . # # # # # . # .
# # # # # # # # # .
. # # # # # # # . .
. # # # # # # # . .
. . # # . # # . . .
`
  },
  {
    id: "a4",
    chapterKey: "chapter_pet",
    titleKey: "level_penguin",
    stampColor: "#0284C7",
    art: `
. . . # # # # . . .
. . # # # # # # . .
. . # . # # . # . .
. . # # # # # # . .
. . # # # # # # . .
. # # # . . # # # .
# # # # . . # # # #
# # # # # # # # # #
. . # # # # # # . .
. . # # . . # # . .
`
  },
  {
    id: "a5",
    chapterKey: "chapter_pet",
    titleKey: "level_bear",
    stampColor: "#92400E",
    art: `
# # . . . . . # # .
# # # . . . # # # .
# # # # # # # # # .
# # # # # # # # # .
# . # # # # # . # .
# # # . # . # # # .
# # # # # # # # # .
. # # # # # # # . .
. # # # # # # # . .
. # # . . . # # . .
`
  },
  {
    id: "a6",
    chapterKey: "chapter_pet",
    titleKey: "level_panda",
    stampColor: "#475569",
    art: `
# # . . . . . # # .
# # . . . . . # # .
. # # # # # # # . .
# # # . # . # # # .
# # # . # . # # # .
. # # # # # # # . .
. # # # # # # # . .
# # # # # # # # # .
# # . # # # . # # .
# # . . . . . # # .
`
  },
  {
    id: "a7",
    chapterKey: "chapter_pet",
    titleKey: "level_koala",
    stampColor: "#64748B",
    art: `
# # # . . . # # # .
# # # . . . # # # .
# # # # # # # # # .
. # . # # # . # . .
. # # # # # # # . .
. # # # . # # # . .
. # # # # # # # . .
. . # # # # # . . .
. # # # # # # # . .
. # # . . . # # . .
`
  },
  {
    id: "a8",
    chapterKey: "chapter_pet",
    titleKey: "level_fox",
    stampColor: "#EA580C",
    art: `
# # . . . . . # # .
# # # . . . # # # .
# # # # . # # # # .
# # # # # # # # # .
. # . # # # . # . .
. # # # # # # # . .
. . # # # # # . . .
. . . # # # . . . .
. . . . # . . . . .
. . . # # # . . . .
`
  },
  {
    id: "a9",
    chapterKey: "chapter_pet",
    titleKey: "level_frog",
    stampColor: "#22C55E",
    art: `
. # # . . . # # . .
# # # # . # # # # .
# . # # # # # . # .
# # # # # # # # # .
# # # # # # # # # .
. # # # # # # # . .
# # # # # # # # # .
# # . # # # . # # .
# . . # # # . . # .
. . # # . # # . . .
`
  },
  {
    id: "a10",
    chapterKey: "chapter_pet",
    titleKey: "level_fish",
    stampColor: "#06B6D4",
    art: `
. . . # # # . . . .
. . # # # # # . . #
. # # # # # # # # #
# # . # # # # # # #
# # # # # # # # . #
. # # # # # # # # #
. . # # # # # . . #
. . . # # # . . . .
. . . . # . . . . .
. . . . # . . . . .
`
  },

  // --- Chapter 3: Myth & Legend (10x10 to 15x15) ---
  {
    id: "m1",
    chapterKey: "chapter_myth",
    titleKey: "level_moon_rabbit",
    stampColor: "#A78BFA",
    art: `
. . # # . . . . . .
. . # # . . . . . .
. . # # # # . . . .
. # # # # # # . . .
# # # # # # # # . .
# . # # # # # # . .
# # # # # # # # # .
. # # # # # # # # .
. . # # # # # # . .
. . . # # . # # . .
`
  },
  {
    id: "m2",
    chapterKey: "chapter_myth",
    titleKey: "level_wizard_hat",
    stampColor: "#7C3AED",
    art: `
. . . . # . . . . .
. . . # # . . . . .
. . . # # . . . . .
. . # # # . . . . .
. . # # # # . . . .
. # # # # # . . . .
. # # # # # # . . .
. # # # # # # # . .
# # # # # # # # # #
. # # # # # # # . .
`
  },
  {
    id: "m3",
    chapterKey: "chapter_myth",
    titleKey: "level_magic_wand",
    stampColor: "#F472B6",
    art: `
. . . . # . . . . .
. . . # # # . . . .
. # # # # # # # . .
. . . # # # . . . .
. . . . # # . . . .
. . . . . # # . . .
. . . . . . # # . .
. . . . . . . # # .
. . . . . . . . # #
. . . . . . . . . #
`
  },
  {
    id: "m4",
    chapterKey: "chapter_myth",
    titleKey: "level_crystal_ball",
    stampColor: "#38BDF8",
    art: `
. . . # # # # . . .
. . # # # # # # . .
. # # . . # # # # .
# # # . . # # # # #
# # # # # # # # # #
# # # # # # # # # #
. # # # # # # # # .
. . # # # # # # . .
. # # # # # # # # .
# # # # # # # # # #
`
  },
  {
    id: "m5",
    chapterKey: "chapter_myth",
    titleKey: "level_unicorn",
    stampColor: "#F43F5E",
    art: `
. . . . . . . . . . # .
. . . . . . . . . # # .
. . . . . . . . # # . .
. . . . # # # # # . . .
. . . # # # # # # # . .
. . # # . # # # # # . .
. . # # # # # # # # . .
. . . # # # # # # . . .
. . . . # # # # . . . .
. . . # # # # # # . . .
. . # # # . . # # # . .
. # # # . . . . # # # .
`
  },
  {
    id: "m6",
    chapterKey: "chapter_myth",
    titleKey: "level_genie_lamp",
    stampColor: "#FBBF24",
    art: `
. . . . . . . # # . . .
. . . . . . # # # # . .
. . . . . . . # # . . .
. . . . . . . # . . . .
. . . # # # # # # # # #
# # # # # # # # # # # .
# . . # # # # # # # . .
# # # # # # # # # . . .
. . . # # # # # . . . .
. . . # # # # # . . . .
. . # # # # # # # . . .
. # # # # # # # # # . .
`
  },
  {
    id: "m7",
    chapterKey: "chapter_myth",
    titleKey: "level_mermaid",
    stampColor: "#2DD4BF",
    art: `
. . . . # # # # . . . .
. . . # # # # # # . . .
. . . # . # # . # . . .
. . . # # # # # # . . .
. . . . # # # # . . . .
. . . # # # # # # . . .
. . # # # # # # # # . .
. . . . # # # # . . . .
. . . . . # # . . . . .
. . . . # # # . . . . .
. . . # # # # # . . . .
. . # # . . . # # . . .
`
  },
  {
    id: "m8",
    chapterKey: "chapter_myth",
    titleKey: "level_phoenix",
    stampColor: "#F97316",
    art: `
. . . . . . . # . . . . . . .
. . . . . . # # # . . . . . .
. # . . . . # # # . . . . # .
. # # . . # # # # # . . # # .
. # # # # # # # # # # # # # .
. . # # # # # # # # # # # . .
. . . # # # # # # # # # . . .
. . . . # # # # # # # . . . .
. . . . . # # # # # . . . . .
. . . . . . # # # . . . . . .
. . . . . # # # # # . . . . .
. . . . # # # . # # # . . . .
. . . # # # . . . # # # . . .
. . # # # . . . . . # # # . .
. # # # . . . . . . . # # # .
`
  },
  {
    id: "m9",
    chapterKey: "chapter_myth",
    titleKey: "level_pegasus",
    stampColor: "#60A5FA",
    art: `
. . . . . . . . # # # . . . .
. . . . . . . # # # # # . . .
. . . . . . # # . # # # . . .
. . # # # # # # # # # . . . .
. # # # # # # # # # . . . . .
# # # # # # # # # # . . . . .
# # # # # # # # # # # . . . .
. . . # # # # # # # # # . . .
. . . # # # # # # # # # # . .
. . . # # # # # # # # # # # .
. . . # # # . . . . # # # # .
. . . # # . . . . . . # # . .
. . # # . . . . . . . . # # .
. . # # . . . . . . . . # # .
. # # # . . . . . . . . # # #
`
  },
  {
    id: "m10",
    chapterKey: "chapter_myth",
    titleKey: "level_dragon",
    stampColor: "#EF4444",
    art: `
. . . . . . # # # # . . . . .
. . . . . # # # # # # . . . .
. . . . # # . # # . # # . . .
. . . # # # # # # # # # . . .
. . # # # # # # # # # . . . .
. # # # # # # # . . . . . . .
# # # # # # # . . . . . . . .
# # # # # # # # # # . . . . .
. # # # # # # # # # # # . . .
. . . # # # # # # # # # # . .
. . . . . # # # # # # # # # .
. . . . . . . # # # # # # # #
. . . . . . . . . # # # # # #
. . . . . . . . . . # # # # .
. . . . . . . . . . . # # . .
`
  },

  // --- Chapter 4: Star Odyssey (15x15) ---
  {
    id: "s1",
    chapterKey: "chapter_star",
    titleKey: "level_rocket",
    stampColor: "#3B82F6",
    art: `
. . . . . . . # . . . . . . .
. . . . . . # # # . . . . . .
. . . . . # # # # # . . . . .
. . . . . # # # # # . . . . .
. . . . . # # . # # . . . . .
. . . . . # # # # # . . . . .
. . . . . # # # # # . . . . .
. . . . # # # # # # # . . . .
. . . # # # # # # # # # . . .
. . # # # # # # # # # # # . .
. # # # # # # # # # # # # # .
# # # . . # # # # # . . # # #
# # . . . # # # # # . . . # #
. . . . . . # # # . . . . . .
. . . . . . . # . . . . . . .
`
  },
  {
    id: "s2",
    chapterKey: "chapter_star",
    titleKey: "level_saturn",
    stampColor: "#EAB308",
    art: `
. . . . . . . . . . . # # # #
. . . . . . # # # . # # # # .
. . . . # # # # # # # # # . .
. . . # # # # # # # # # . . .
. . # # # # # # # # . . . . .
. # # # # # # # # # # . . . .
# # # # # # # # # # # # . . .
# # # # # # # # # # # # # . .
. . # # # # # # # # # # # # .
. . . . # # # # # # # # # # #
. . . . . # # # # # # # # # .
. . . # # # # # # # # # . . .
. . # # # # . # # # . . . . .
. # # # # . . . . . . . . . .
# # # # . . . . . . . . . . .
`
  },
  {
    id: "s3",
    chapterKey: "chapter_star",
    titleKey: "level_astronaut",
    stampColor: "#06B6D4",
    art: `
. . . . . # # # # # . . . . .
. . . . # # # # # # # . . . .
. . . . # # . . . # # . . . .
. . . . # # . . . # # . . . .
. . . . # # # # # # # . . . .
. . . . . # # # # # . . . . .
. . # # # # # # # # # # # . .
. # # # # # # # # # # # # # .
. # # # # # . # . # # # # # .
. # # # # # # # # # # # # # .
. . . # # # # # # # # # . . .
. . . # # # . . . # # # . . .
. . . # # # . . . # # # . . .
. . . # # # . . . # # # . . .
. . # # # # . . . # # # # . .
`
  },
  {
    id: "s4",
    chapterKey: "chapter_star",
    titleKey: "level_alien",
    stampColor: "#10B981",
    art: `
. # # # . . . . . . . # # # .
. # # # . . . . . . . # # # .
. . # . . . . . . . . . # . .
. . . # # # # # # # # # . . .
. . # # # # # # # # # # # . .
. . # # . . # # # . . # # . .
. . # # . . # # # . . # # . .
. . # # # # # # # # # # # . .
. . . # # # # # # # # # . . .
. . . . # # # # # # # . . . .
. . # # # # # # # # # # # . .
. # # . # # # # # # # . # # .
# # . . # # # # # # # . . # #
# . . . # # . . . # # . . . #
. . . . # # . . . # # . . . .
`
  },
  {
    id: "s5",
    chapterKey: "chapter_star",
    titleKey: "level_satellite",
    stampColor: "#8B5CF6",
    art: `
# # # . . . . . . . . . # # #
# # # . . . . # . . . . # # #
# # # . . . # # # . . . # # #
. # . . . # # # # # . . . # .
. . . . # # # # # # # . . . .
. . . . # # # # # # # . . . .
. . . . . # # # # # . . . . .
. . . . . . # # # . . . . . .
. . . . . . . # . . . . . . .
. . . . . . . # . . . . . . .
. . . . . . # # # . . . . . .
. . . . . # # # # # . . . . .
. . . . # # # # # # # . . . .
. . . # # # # # # # # # . . .
. . # # # # # # # # # # # . .
`
  },
  {
    id: "s6",
    chapterKey: "chapter_star",
    titleKey: "level_ufo",
    stampColor: "#EC4899",
    art: `
. . . . . . # # # . . . . . .
. . . . . # # # # # . . . . .
. . . . # # # # # # # . . . .
. . # # # # # # # # # # # . .
. # # # # # # # # # # # # # .
# # # # # # # # # # # # # # #
# # . # # . # # . # # . # # #
# # # # # # # # # # # # # # #
. # # # # # # # # # # # # # .
. . # # # # # # # # # # # . .
. . . . # # # # # # # . . . .
. . . # # # # # # # # # . . .
. . # # . # # # # # . # # . .
. # # . . . # # # . . . # # .
# # . . . . . # . . . . . # #
`
  },
  {
    id: "s7",
    chapterKey: "chapter_star",
    titleKey: "level_telescope",
    stampColor: "#6366F1",
    art: `
. . . . . . . . . . . # # # #
. . . . . . . . . . # # # # #
. . . . . . . . . # # # # # #
. . . . . . . . # # # # # # .
. . . . . . . # # # # # # . .
. . . . . . # # # # # # . . .
. . . . . # # # # # # . . . .
. . . . # # # # # # . . . . .
. . . # # # # # . . . . . . .
. . # # # # . . . . . . . . .
. . . . # . . . . . . . . . .
. . . # # # . . . . . . . . .
. . # # . # # . . . . . . . .
. # # . . . # # . . . . . . .
# # . . . . . # # . . . . . .
`
  },
  {
    id: "s8",
    chapterKey: "chapter_star",
    titleKey: "level_shooting_star",
    stampColor: "#F59E0B",
    art: `
. . . . . . . . . . . . . # .
. . . . . . . . . . . . # # #
. . . . . . . . . . # # # # #
. . . . . . . . . # # # # # #
. . . . . . . . # # # # # # #
. . . . . . . # # # # # # # #
. . . . . . # # # # # # # . .
. . . . . # # # . # # # . . .
. . . . # # # . . # # . . . .
. . . # # # . . . # . . . . .
. . # # # . . . . . . . . . .
. # # # . . . . . . . . . . .
# # # . . . . . . . . . . . .
# # . . . . . . . . . . . . .
# . . . . . . . . . . . . . .
`
  }
];

console.log("Verifying " + rawLevels.length + " levels...");

const finalLevels = [];

for (const raw of rawLevels) {
  const target = parseArt(raw.art);
  const rows = target.length;
  const cols = target[0].length;
  const { rowClues, colClues } = deriveGridClues(target);

  const t0 = performance.now();
  const res = solveGrid(rowClues, colClues, rows, cols);
  const dt = performance.now() - t0;

  if (res.count !== 1) {
    console.error(`FAILED: ${raw.id} (${raw.titleKey}) has ${res.count} solutions!`);
    console.log("Sol 0:\n" + res.solutions[0].map(r => r.map(c => c ? '#' : '.').join(' ')).join('\n'));
    console.log("Sol 1:\n" + res.solutions[1].map(r => r.map(c => c ? '#' : '.').join(' ')).join('\n'));
    process.exit(1);
  }

  console.log(`OK: ${raw.id} (${raw.titleKey}) [${rows}x${cols}] unique=true (${dt.toFixed(1)}ms)`);

  finalLevels.push({
    id: raw.id,
    chapterKey: raw.chapterKey,
    titleKey: raw.titleKey,
    rows,
    cols,
    target,
    rowClues,
    colClues,
    stampColor: raw.stampColor,
  });
}

// Chapters metadata
const chapters = [
  { key: "chapter_prologue", levelIds: ["p1", "p2", "p3", "p4"], icon: "⭐" },
  { key: "chapter_fruit", levelIds: ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8"], icon: "🍎" },
  { key: "chapter_pet", levelIds: ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10"], icon: "🐾" },
  { key: "chapter_myth", levelIds: ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10"], icon: "🔮" },
  { key: "chapter_star", levelIds: ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"], icon: "🚀" }
];

const content = `/**
 * Picross Levels Data
 * All 40 levels are verified by solveGrid to possess EXACTLY 1 unique solution.
 * Text keys are used for all titles and chapters; zero hardcoded Chinese.
 */

export const CHAPTERS = ${JSON.stringify(chapters, null, 2)};

export const LEVELS = ${JSON.stringify(finalLevels, null, 2)};

export function getLevelById(id) {
  return LEVELS.find((lvl) => lvl.id === id) || LEVELS[0];
}

export function getLevelsByChapter(chapterKey) {
  return LEVELS.filter((lvl) => lvl.chapterKey === chapterKey);
}
`;

const targetFile = resolve("games/picross/js/levels.mjs");
writeFileSync(targetFile, content, "utf8");
console.log(`Generated ${targetFile} successfully!`);
