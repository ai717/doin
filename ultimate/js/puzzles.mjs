// 21 道残局题库（4 / 5 / 4 / 5 / 3 五章）。
// 每道题都由求解器（engine.canForceWin）验证过：mover 在 par 步内必杀，par-1 步内无解。
// 盘面用 81 位字符串描述：'0' 空 / '1' 红 X / '2' 蓝 O，索引 = big * 9 + small。

import { CELL_COUNT, EMPTY, MARK_O, MARK_X, createState } from "./engine.mjs";

export const CHAPTERS = Object.freeze([
  { key: "ch1", count: 4 },
  { key: "ch2", count: 5 },
  { key: "ch3", count: 4 },
  { key: "ch4", count: 5 },
  { key: "ch5", count: 3 },
]);

const RAW = [
  { chapter: 1, board: "122212220121122211111112111121221212221221110221212111122221112221001122211212022", active: 7, par: 2 },
  { chapter: 1, board: "221211121021121112121122210121221212111211121112221122220212022122211212122110212", active: 6, par: 2 },
  { chapter: 1, board: "122212220121122212121121111102221011221112221121212122212121110211122221212212101", active: 3, par: 2 },
  { chapter: 1, board: "211111122121202202110212122212112121221111212212122121121112212121212220221211012", active: 1, par: 2 },
  { chapter: 2, board: "111221211121122212210002212121212121122122011221112221121211210212112221211122221", active: 2, par: 2 },
  { chapter: 2, board: "201122221122201121112211221022010211121221210122111221212122121121211212221212011", active: 3, par: 3 },
  { chapter: 2, board: "112212220121221212122211112212212121001021122121221212111211122221211112212110221", active: 4, par: 2 },
  { chapter: 2, board: "112221121112211122200202121122212220122210122212011121112121121122112121211212021", active: 2, par: 3 },
  { chapter: 2, board: "221212021221112212221111221212122121111221111122221112221212022011021012211112221", active: 7, par: 2 },
  { chapter: 3, board: "211022211211122211211120221021202200110221121221112220122212121121112112110212122", active: 3, par: 3 },
  { chapter: 3, board: "221112201120122211022211121122211121221211121221212021112221112212120121000112220", active: 8, par: 3 },
  { chapter: 3, board: "122202221212211122221221110210212122101200201112021122121211112211221121110221112", active: 4, par: 3 },
  { chapter: 3, board: "022200201022112221121211221221211012112221122111111122122212120212011221211110221", active: 0, par: 3 },
  { chapter: 4, board: "221212012021121212112211221200000221221111122102221112110212122112221112212121121", active: 3, par: 3 },
  { chapter: 4, board: "212221111121122012212122121112211122111121212202112221121112210022020100221211022", active: 7, par: 3 },
  { chapter: 4, board: "211111211221112112221212012122212210212112121212211121220112221001002220122121012", active: 7, par: 3 },
  { chapter: 4, board: "221212011010002202211211121212121121212212121121221211122212220021112212110221112", active: 1, par: 3 },
  { chapter: 4, board: "221112221221211022111111221122221102221121211121212212221112021202112211120000210", active: 8, par: 3 },
  { chapter: 5, board: "120212112122212221112211102201200010112112121112221122112221122221121110022211212", active: 3, par: 3 },
  { chapter: 5, board: "212211122020200202111122111112221121211212112121221202212112201212211120212121021", active: 1, par: 3 },
  { chapter: 5, board: "121211221000120021212122121211212122221112202212101112211112201221112021211122221", active: 1, par: 3 },
];

function parseBoard(text) {
  if (typeof text !== "string" || text.length !== CELL_COUNT) return null;
  const cells = [];
  for (const ch of text) {
    if (ch === "0") cells.push(EMPTY);
    else if (ch === "1") cells.push(MARK_X);
    else if (ch === "2") cells.push(MARK_O);
    else return null;
  }
  return cells;
}

export const PUZZLES = Object.freeze(RAW.map((item, index) => {
  const id = `u${String(index + 1).padStart(2, "0")}`;
  return Object.freeze({
    id,
    index,
    chapter: item.chapter,
    par: item.par,
    active: item.active,
    board: item.board,
    cells: Object.freeze(parseBoard(item.board) ?? []),
  });
}));

export const PUZZLE_BY_ID = Object.freeze(
  Object.fromEntries(PUZZLES.map((puzzle) => [puzzle.id, puzzle])),
);

export function getPuzzle(id) {
  return PUZZLE_BY_ID[id] ?? null;
}

export function chapterOf(puzzle) {
  return puzzle ? puzzle.chapter : 0;
}

export function puzzlesInChapter(chapter) {
  return PUZZLES.filter((puzzle) => puzzle.chapter === chapter);
}

// 关卡序号（从 1 起）与 id 的互查，供「下一关」按钮使用。
export function puzzleAt(index) {
  return PUZZLES[index] ?? null;
}

export function createPuzzleState(puzzle) {
  if (!puzzle) return null;
  return createState({
    cells: puzzle.cells,
    active: puzzle.active,
    current: MARK_X,
  });
}
