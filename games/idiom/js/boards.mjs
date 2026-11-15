// 榜单骨架：只放 id、配色与关卡节奏，展示文案一律走 i18n。
export const BOARDS = [
  { id: "board_history", nameKey: "boardHistory", descKey: "boardHistoryDesc", accent: "#b23a2f", numeral: "I" },
  { id: "board_nature", nameKey: "boardNature", descKey: "boardNatureDesc", accent: "#3f7a5a", numeral: "II" },
  { id: "board_animals", nameKey: "boardAnimals", descKey: "boardAnimalsDesc", accent: "#b57a22", numeral: "III" },
  { id: "board_people", nameKey: "boardPeople", descKey: "boardPeopleDesc", accent: "#4a5f92", numeral: "IV" },
  { id: "board_numbers", nameKey: "boardNumbers", descKey: "boardNumbersDesc", accent: "#8a5a9c", numeral: "V" },
  { id: "board_body", nameKey: "boardBody", descKey: "boardBodyDesc", accent: "#a34b35", numeral: "VI" },
  { id: "board_colors", nameKey: "boardColors", descKey: "boardColorsDesc", accent: "#3b7f8c", numeral: "VII" },
  { id: "board_objects", nameKey: "boardObjects", descKey: "boardObjectsDesc", accent: "#7a5a2e", numeral: "VIII" },
];

export const BOARD_BY_ID = Object.fromEntries(BOARDS.map((board) => [board.id, board]));

export const LEVELS_PER_BOARD = 10;

// 每关成语条数：由浅入深，符合 4~8 条的策划区间。
export const ENTRIES_ZH = [4, 4, 4, 5, 5, 5, 6, 6, 6, 6];
export const ENTRIES_EN = [4, 5, 5, 6, 6, 6, 7, 7, 8, 8];

export const MAX_GRID_ZH = 9;
export const MAX_GRID_EN = 12;
export const MIN_GRID = 5;

export const HINTS_PER_LEVEL = 3;
export const DISTRACTOR_COUNT = 3;

export function boardIndex(boardId) {
  return BOARDS.findIndex((board) => board.id === boardId);
}

export function boardOf(boardId) {
  return BOARD_BY_ID[boardId] ?? BOARDS[0];
}

export function entriesFor(lang, levelIndex) {
  const table = lang === "en" ? ENTRIES_EN : ENTRIES_ZH;
  return table[Math.max(0, Math.min(table.length - 1, levelIndex))];
}
