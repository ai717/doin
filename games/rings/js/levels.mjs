// Level catalogue. Pure data: numeric ring counts, mode enums and i18n keys only.
// Every start state is derived from stateAtProgress(), so it is legal by construction.

import { stateAtProgress, solve } from "./engine.mjs";

export const CHAPTERS = Object.freeze([
  { id: "ch3", rings: 3 },
  { id: "ch5", rings: 5 },
  { id: "ch7", rings: 7 },
  { id: "ch9", rings: 9 },
]);

// kind: "full" = all rings on/off corner; "mid" = a mid-game position.
const DEFS = [
  { id: "L1", chapter: "ch3", rings: 3, mode: "unlink", kind: "full", fraction: 0 },
  { id: "L2", chapter: "ch3", rings: 3, mode: "unlink", kind: "mid", fraction: 0.5 },
  { id: "L3", chapter: "ch3", rings: 3, mode: "link", kind: "full", fraction: 0 },
  { id: "L4", chapter: "ch5", rings: 5, mode: "unlink", kind: "full", fraction: 0 },
  { id: "L5", chapter: "ch5", rings: 5, mode: "unlink", kind: "mid", fraction: 0.5 },
  { id: "L6", chapter: "ch5", rings: 5, mode: "link", kind: "full", fraction: 0 },
  { id: "L7", chapter: "ch7", rings: 7, mode: "unlink", kind: "full", fraction: 0 },
  { id: "L8", chapter: "ch7", rings: 7, mode: "link", kind: "full", fraction: 0 },
  { id: "L9", chapter: "ch7", rings: 7, mode: "link", kind: "mid", fraction: 0.6 },
  { id: "L10", chapter: "ch9", rings: 9, mode: "unlink", kind: "full", fraction: 0 },
  { id: "L11", chapter: "ch9", rings: 9, mode: "unlink", kind: "mid", fraction: 0.5 },
  { id: "L12", chapter: "ch9", rings: 9, mode: "link", kind: "full", fraction: 0 },
];

export const LEVELS = Object.freeze(
  DEFS.map((def) => {
    const start = stateAtProgress(def.rings, def.mode, def.fraction);
    return Object.freeze({ ...def, start, optimal: solve(start, def.mode).optimal });
  })
);

export const LEVEL_IDS = Object.freeze(LEVELS.map((level) => level.id));

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0];
}

export function nextLevelId(id) {
  const index = LEVEL_IDS.indexOf(id);
  return index < 0 || index >= LEVEL_IDS.length - 1 ? null : LEVEL_IDS[index + 1];
}

export function levelsInChapter(chapterId) {
  return LEVELS.filter((level) => level.chapter === chapterId);
}
