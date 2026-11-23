import assert from "node:assert/strict";
import { test } from "node:test";
import { createGame, generateBoard, isFree, tryCollect } from "../js/engine.mjs";
import { getLevel, LEVELS, levelSeed } from "../js/levels.mjs";
import { displaySortedStrands } from "../js/ui.mjs";

const boardCache = new Map();
function boardOf(level) {
  if (!boardCache.has(level.id)) {
    boardCache.set(level.id, generateBoard(level, levelSeed(level.id), "level"));
  }
  return boardCache.get(level.id);
}

test("spool display order follows stage geometry, not the solution", () => {
  for (const level of LEVELS) {
    const board = boardOf(level);
    const display = displaySortedStrands(board).map((s) => s.id);
    for (let i = 1; i < display.length; i++) {
      const prev = board.strands.find((s) => s.id === display[i - 1]);
      const cur = board.strands.find((s) => s.id === display[i]);
      const keyA = (prev.path.x1 + prev.path.x2) / 2;
      const keyB = (cur.path.x1 + cur.path.x2) / 2;
      assert.ok(keyA <= keyB, `level ${level.id} display order must ascend by midpoint x`);
    }
  }
});

test("display order never equals the solution order on any level", () => {
  let equal = 0;
  for (const level of LEVELS) {
    const board = boardOf(level);
    const display = displaySortedStrands(board).map((s) => s.id);
    if (display.join(",") === board.solution.join(",")) equal++;
  }
  assert.equal(equal, 0, "spool shelf must not leak the answer sequence");
});

test("clicking spools left-to-right cannot clear levels past teaching", () => {
  let naiveWins = 0;
  const winIds = [];
  for (const level of LEVELS) {
    const board = boardOf(level);
    let state = createGame(board);
    let moves = 0;
    while (state.status === "playing" && moves < 500) {
      const target = displaySortedStrands(board).find(
        (s) =>
          !state.collected.includes(s.id) &&
          isFree(board, state, s.id) &&
          (!s.knot || state.untied[s.id]),
      );
      if (!target) break;
      state = tryCollect(board, state, target.id).state;
      moves++;
    }
    if (state.status === "won") {
      naiveWins++;
      winIds.push(level.id);
    }
  }
  assert.ok(
    winIds.every((id) => id <= 4),
    `left-to-right play must not clear levels past teaching: ${winIds.join(",")}`,
  );
  assert.ok(naiveWins <= 4, `naive order play should win at most the teaching levels: ${winIds.join(",")}`);
});

test("level table remains intact after curve tuning", () => {
  assert.equal(LEVELS.length, 40);
  assert.equal(getLevel(40).colors.length, 6);
});
