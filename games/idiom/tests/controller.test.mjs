import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../js/game.mjs";
import { BOARDS } from "../js/boards.mjs";

function fillOne(game) {
  const state = game.state();
  const cell = state.cells.get(state.selected.cellKey);
  const result = game.dispatch({ type: "fill", char: cell.answer });
  return { cell, result };
}

test("控制器：启动即有一局可玩的关卡", () => {
  const game = createGame({ locale: "zh" });
  const state = game.state();
  assert.ok(state.puzzle);
  assert.equal(state.puzzle.lang, "zh");
  assert.ok(state.entries.length >= 4);
  assert.equal(game.cursor().boardId, BOARDS[0].id);
  assert.equal(game.cursor().levelIndex, 0);
  assert.deepEqual(game.summary().cleared, false);
});

test("控制器：填字事件按次下发且被清空", () => {
  const game = createGame({ locale: "zh" });
  const { result } = fillOne(game);
  assert.ok(["fill", "wrong"].includes(result.action));
  assert.ok(result.events.length >= 1);
  const again = game.dispatch({ type: "cell", r: 0, c: 0 });
  assert.deepEqual(again.events, []);
});

test("控制器：语言切换各自保留会话与进度", () => {
  const game = createGame({ locale: "zh" });
  const { cell } = fillOne(game);
  const zhFilled = game.summary().solved;
  const zhPuzzle = game.puzzle();
  assert.equal(game.setLocale("en").puzzle.lang, "en");
  assert.equal(game.summary().lang, "en");
  assert.notEqual(game.puzzle().rows + game.puzzle().cols, 0);
  const enBefore = [...game.state().cells.values()].filter((item) => item.value !== null).length;
  assert.equal(enBefore, game.puzzle().cells.filter((item) => item.locked).length);
  game.setLocale("zh");
  assert.equal(game.puzzle(), zhPuzzle);
  assert.equal(game.state().cells.get(`${cell.r},${cell.c}`).value, cell.answer);
  assert.equal(game.summary().solved, zhFilled);
});

test("控制器：面板打开时计时冻结，关闭后继续", () => {
  const game = createGame({ locale: "zh" });
  game.setMenuOpen(true);
  game.tick(500);
  assert.equal(game.summary().elapsed, 0);
  game.setMenuOpen(false);
  game.tick(500);
  assert.equal(game.summary().elapsed, 500);
});

test("控制器：下一关与第十关后换榜", () => {
  const game = createGame({ locale: "zh" });
  game.startLevel(BOARDS[1].id, 8);
  game.dispatch({ type: "next" });
  assert.deepEqual(game.cursor(), { boardId: BOARDS[1].id, levelIndex: 9 });
  game.dispatch({ type: "next" });
  assert.deepEqual(game.cursor(), { boardId: BOARDS[2].id, levelIndex: 0 });
});

test("控制器：重玩清空字格但保留关卡", () => {
  const game = createGame({ locale: "zh" });
  const cursor = game.cursor();
  const { cell } = fillOne(game);
  assert.equal(game.state().cells.get(`${cell.r},${cell.c}`).value, cell.answer);
  game.dispatch({ type: "retry" });
  assert.deepEqual(game.cursor(), cursor);
  assert.equal(game.state().cells.get(`${cell.r},${cell.c}`).value, null);
  assert.equal(game.summary().hintsLeft, 3);
});

test("控制器：清关后返回本次收录的图鉴 id", () => {
  const game = createGame({ locale: "zh" });
  const state = game.state();
  assert.deepEqual(game.clearedEntryIds(), []);
  for (const cell of state.cells.values()) {
    if (cell.value === cell.answer) continue;
    game.dispatch({ type: "cell", r: cell.r, c: cell.c });
    game.dispatch({ type: "fill", char: cell.answer });
  }
  assert.equal(game.state().status, "cleared");
  const ids = game.clearedEntryIds();
  assert.equal(ids.length, game.puzzle().entries.length);
  assert.ok(ids.every((id) => typeof id === "string" && id.length > 0));
});

test("控制器：未知指令不改变局势", () => {
  const game = createGame({ locale: "zh" });
  const before = game.snapshot();
  const result = game.dispatch({ type: "nope" });
  assert.equal(result.action, null);
  assert.deepEqual(game.snapshot(), before);
});
