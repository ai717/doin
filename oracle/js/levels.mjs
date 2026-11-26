// Flattened level table derived from the curated chapters. Pure data only.

import { CHAPTERS, GLYPHS } from "./data.mjs";

export { CHAPTERS, GLYPHS };

export const LEVELS = CHAPTERS.flatMap((chapter, chapterIndex) =>
  chapter.groups.map((group, groupIndex) => ({
    id: `${chapter.id}_${groupIndex + 1}`,
    index: chapterIndex * chapter.groups.length + groupIndex,
    chapterId: chapter.id,
    chapterIndex,
    nameKey: chapter.nameKey,
    levelInChapter: groupIndex + 1,
    glyphs: [...group],
    pairs: group.length,
  })),
);

export const TOTAL_LEVELS = LEVELS.length;

export function getLevel(index) {
  const safe = Math.max(0, Math.min(LEVELS.length - 1, Math.floor(Number(index) || 0)));
  return LEVELS[safe];
}

export function getChapter(chapterIndex) {
  const safe = Math.max(0, Math.min(CHAPTERS.length - 1, Math.floor(Number(chapterIndex) || 0)));
  return CHAPTERS[safe];
}

export function levelsOfChapter(chapterIndex) {
  return LEVELS.filter((level) => level.chapterIndex === chapterIndex);
}

export function glyphOf(id) {
  return GLYPHS[id] ?? null;
}

export function levelIdFor(index) {
  return getLevel(index).id;
}

// Used by tests and the level select screen; never mutates the source tables.
export function validateLevels() {
  const issues = [];
  if (LEVELS.length === 0) issues.push("empty-levels");
  for (const chapter of CHAPTERS) {
    if (chapter.groups.length !== 6) issues.push(`chapter-${chapter.id}-groups`);
    if (new Set(chapter.pool).size !== chapter.pool.length) issues.push(`chapter-${chapter.id}-pool-duplicate`);
    for (const id of chapter.pool) {
      if (!GLYPHS[id]) issues.push(`chapter-${chapter.id}-missing-glyph-${id}`);
    }
  }
  for (const level of LEVELS) {
    if (level.pairs !== level.glyphs.length) issues.push(`level-${level.id}-pair-count`);
    if (level.pairs < 4 || level.pairs > 8) issues.push(`level-${level.id}-pair-range`);
    if (new Set(level.glyphs).size !== level.glyphs.length) issues.push(`level-${level.id}-duplicate-glyph`);
    for (const id of level.glyphs) {
      if (!GLYPHS[id]) issues.push(`level-${level.id}-missing-${id}`);
    }
  }
  return issues;
}
