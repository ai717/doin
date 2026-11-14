// 魔方学院 19 关残局阶梯：全部由还原态出发的合法打乱生成，100% 可逆可解。
// 文案零裸写中文，标题与目标均通过 i18n key 查表。

export const CHAPTERS = Object.freeze([
  { id: 1, titleKey: "chapter1", tipKey: "tip1", levelIds: ["c01", "c02", "c03", "c04"] },
  { id: 2, titleKey: "chapter2", tipKey: "tip2", levelIds: ["c05", "c06", "c07", "c08", "c09"] },
  { id: 3, titleKey: "chapter3", tipKey: "tip3", levelIds: ["c10", "c11", "c12", "c13"] },
  { id: 4, titleKey: "chapter4", tipKey: "tip4", levelIds: ["c14", "c15", "c16"] },
  { id: 5, titleKey: "chapter5", tipKey: "tip5", levelIds: ["c17", "c18", "c19"] },
]);

const RAW_LEVELS = [
  { id: "c01", chapter: 1, goalKey: "goal1", scramble: "R U R'" },
  { id: "c02", chapter: 1, goalKey: "goal1", scramble: "F R U'" },
  { id: "c03", chapter: 1, goalKey: "goal1", scramble: "U R U' F" },
  { id: "c04", chapter: 1, goalKey: "goal1", scramble: "R U R' F' U" },
  { id: "c05", chapter: 2, goalKey: "goal2", scramble: "R U R' U' F" },
  { id: "c06", chapter: 2, goalKey: "goal2", scramble: "F R U R' U' F'" },
  { id: "c07", chapter: 2, goalKey: "goal2", scramble: "R U2 R' F' U" },
  { id: "c08", chapter: 2, goalKey: "goal2", scramble: "U R U' R' F R" },
  { id: "c09", chapter: 2, goalKey: "goal2", scramble: "F U R U' R' F' U" },
  { id: "c10", chapter: 3, goalKey: "goal3", scramble: "R U R' U' R' F R F'" },
  { id: "c11", chapter: 3, goalKey: "goal3", scramble: "F R U R' U' F' U R" },
  { id: "c12", chapter: 3, goalKey: "goal3", scramble: "R U2 R' U' R U' R'" },
  { id: "c13", chapter: 3, goalKey: "goal3", scramble: "U R U' R' U' F' U F" },
  { id: "c14", chapter: 4, goalKey: "goal4", scramble: "R U R' U' R' F R F' U" },
  { id: "c15", chapter: 4, goalKey: "goal4", scramble: "F R U R' U' R U R' U' F'" },
  { id: "c16", chapter: 4, goalKey: "goal4", scramble: "R U R' U R U2 R' F' U" },
  { id: "c17", chapter: 5, goalKey: "goal5", scramble: "R U R' U' R' F R2 U' R' U' R U R' F'" },
  { id: "c18", chapter: 5, goalKey: "goal5", scramble: "F R U' R' U' R U R' F' R U R' U' R' F R F'" },
  { id: "c19", chapter: 5, goalKey: "goal5", scramble: "R U2 R2 F R F' R U2 R' U' R U' R'" },
];

export const LEVELS = Object.freeze(
  RAW_LEVELS.map((level, index) => ({
    ...level,
    index: index + 1,
    size: 3,
    par: level.scramble.split(/\s+/).filter(Boolean).length + 2,
  })),
);

export const LEVEL_BY_ID = Object.freeze(
  Object.fromEntries(LEVELS.map((level) => [level.id, level])),
);

export const CHAPTER_BY_ID = Object.freeze(
  Object.fromEntries(CHAPTERS.map((chapter) => [chapter.id, chapter])),
);

export function levelsOfChapter(chapterId) {
  const chapter = CHAPTER_BY_ID[chapterId];
  if (!chapter) return [];
  return chapter.levelIds.map((id) => LEVEL_BY_ID[id]).filter(Boolean);
}

export function firstLevelId() {
  return LEVELS[0]?.id ?? "c01";
}

export function nextLevelId(currentId) {
  const index = LEVELS.findIndex((level) => level.id === currentId);
  if (index < 0) return LEVELS[0]?.id ?? null;
  return LEVELS[index + 1]?.id ?? null;
}
