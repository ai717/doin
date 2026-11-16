// Spider Solitaire Level Configurations
// Curated chapter levels for Story Mode.
// Note: All identifiers are pure keys/ids; no hardcoded Chinese strings.

export const CHAPTERS = [
  {
    id: 'chapter_1',
    chapterIndex: 1,
    suitCount: 2,
    levelCount: 10
  },
  {
    id: 'chapter_2',
    chapterIndex: 2,
    suitCount: 3,
    levelCount: 10
  },
  {
    id: 'chapter_3',
    chapterIndex: 3,
    suitCount: 4,
    levelCount: 10
  }
];

export const LEVELS = [
  // Chapter 1: Silver Thread (Two Suits)
  { id: 'level_1_1', chapterId: 'chapter_1', levelIndex: 1, suitCount: 2, seed: 10421, par: 100 },
  { id: 'level_1_2', chapterId: 'chapter_1', levelIndex: 2, suitCount: 2, seed: 10738, par: 105 },
  { id: 'level_1_3', chapterId: 'chapter_1', levelIndex: 3, suitCount: 2, seed: 11055, par: 110 },
  { id: 'level_1_4', chapterId: 'chapter_1', levelIndex: 4, suitCount: 2, seed: 11372, par: 110 },
  { id: 'level_1_5', chapterId: 'chapter_1', levelIndex: 5, suitCount: 2, seed: 11689, par: 115 },
  { id: 'level_1_6', chapterId: 'chapter_1', levelIndex: 6, suitCount: 2, seed: 12006, par: 115 },
  { id: 'level_1_7', chapterId: 'chapter_1', levelIndex: 7, suitCount: 2, seed: 12323, par: 120 },
  { id: 'level_1_8', chapterId: 'chapter_1', levelIndex: 8, suitCount: 2, seed: 12640, par: 120 },
  { id: 'level_1_9', chapterId: 'chapter_1', levelIndex: 9, suitCount: 2, seed: 12957, par: 125 },
  { id: 'level_1_10', chapterId: 'chapter_1', levelIndex: 10, suitCount: 2, seed: 13274, par: 130 },

  // Chapter 2: Crimson Thread (Three Suits)
  { id: 'level_2_1', chapterId: 'chapter_2', levelIndex: 1, suitCount: 3, seed: 20113, par: 110 },
  { id: 'level_2_2', chapterId: 'chapter_2', levelIndex: 2, suitCount: 3, seed: 20430, par: 115 },
  { id: 'level_2_3', chapterId: 'chapter_2', levelIndex: 3, suitCount: 3, seed: 20747, par: 115 },
  { id: 'level_2_4', chapterId: 'chapter_2', levelIndex: 4, suitCount: 3, seed: 21064, par: 120 },
  { id: 'level_2_5', chapterId: 'chapter_2', levelIndex: 5, suitCount: 3, seed: 21381, par: 120 },
  { id: 'level_2_6', chapterId: 'chapter_2', levelIndex: 6, suitCount: 3, seed: 21698, par: 125 },
  { id: 'level_2_7', chapterId: 'chapter_2', levelIndex: 7, suitCount: 3, seed: 22015, par: 125 },
  { id: 'level_2_8', chapterId: 'chapter_2', levelIndex: 8, suitCount: 3, seed: 22332, par: 130 },
  { id: 'level_2_9', chapterId: 'chapter_2', levelIndex: 9, suitCount: 3, seed: 22649, par: 135 },
  { id: 'level_2_10', chapterId: 'chapter_2', levelIndex: 10, suitCount: 3, seed: 22966, par: 140 },

  // Chapter 3: Fourfold Web (Four Suits)
  { id: 'level_3_1', chapterId: 'chapter_3', levelIndex: 1, suitCount: 4, seed: 30107, par: 120 },
  { id: 'level_3_2', chapterId: 'chapter_3', levelIndex: 2, suitCount: 4, seed: 30424, par: 125 },
  { id: 'level_3_3', chapterId: 'chapter_3', levelIndex: 3, suitCount: 4, seed: 30741, par: 125 },
  { id: 'level_3_4', chapterId: 'chapter_3', levelIndex: 4, suitCount: 4, seed: 31058, par: 130 },
  { id: 'level_3_5', chapterId: 'chapter_3', levelIndex: 5, suitCount: 4, seed: 31375, par: 135 },
  { id: 'level_3_6', chapterId: 'chapter_3', levelIndex: 6, suitCount: 4, seed: 31692, par: 135 },
  { id: 'level_3_7', chapterId: 'chapter_3', levelIndex: 7, suitCount: 4, seed: 32009, par: 140 },
  { id: 'level_3_8', chapterId: 'chapter_3', levelIndex: 8, suitCount: 4, seed: 32326, par: 145 },
  { id: 'level_3_9', chapterId: 'chapter_3', levelIndex: 9, suitCount: 4, seed: 32643, par: 150 },
  { id: 'level_3_10', chapterId: 'chapter_3', levelIndex: 10, suitCount: 4, seed: 32960, par: 155 }
];

export function getLevelById(id) {
  return LEVELS.find((l) => l.id === id) || LEVELS[0];
}

export function getLevelsByChapter(chapterId) {
  return LEVELS.filter((l) => l.chapterId === chapterId);
}

/**
 * Returns deterministic daily seed based on YYYY-MM-DD string.
 */
export function getDailySeed(dateStr) {
  const str = dateStr || new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) & 0x7fffffff;
  }
  return hash || 20260926;
}
