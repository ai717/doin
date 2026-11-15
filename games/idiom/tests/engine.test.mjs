import test from "node:test";
import assert from "node:assert/strict";
import { getPuzzle } from "../js/puzzles.mjs";
import {
  createSession,
  selectCell,
  selectEntry,
  fillCell,
  eraseCell,
  useHint,
  tick,
  drainEvents,
  summarize,
  isTerminal,
  STATUS,
} from "../js/engine.mjs";

function fresh(lang = "zh", board = "board_history", level = 0) {
  const puzzle = getPuzzle(lang, board, level);
  const state = createSession({ puzzle });
  drainEvents(state);
  return { puzzle, state };
}

function wrongChar(state, answer) {
  return state.rack.find((char) => char !== answer) ?? "甲";
}

function complete(state) {
  for (const cell of state.cells.values()) {
    if (cell.value === cell.answer) continue;
    selectCell(state, cell.r, cell.c);
    fillCell(state, cell.answer);
  }
  return state;
}

function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

test("开局：自动选中第一条未填词条的字格", () => {
  const { state } = fresh();
  assert.ok(state.selected);
  const entry = state.entries[state.selected.entryIndex];
  assert.ok(entry);
  assert.ok(!entry.solved);
  assert.equal(state.status, STATUS.PLAYING);
  assert.equal(state.hintsLeft, 3);
  assert.equal(state.stars, 0);
});

test("填错：字仍在格中、发 wrong 事件、不判过关", () => {
  const { state } = fresh();
  const cell = state.cells.get(state.selected.cellKey);
  const bad = wrongChar(state, cell.answer);
  const result = fillCell(state, bad);
  assert.equal(result.action, "wrong");
  assert.equal(state.cells.get(state.selected.cellKey).value, bad);
  assert.ok(result.events.some((event) => event.type === "wrong"));
  assert.equal(state.status, STATUS.PLAYING);
});

test("擦除：错字可擦，预填/正确字不可擦", () => {
  const { state } = fresh();
  const cell = state.cells.get(state.selected.cellKey);
  fillCell(state, wrongChar(state, cell.answer));
  const erase = eraseCell(state);
  assert.equal(erase.action, "erase");
  assert.equal(state.cells.get(state.selected.cellKey).value, null);

  const locked = [...state.cells.values()].find((item) => item.locked);
  assert.ok(locked, "首关应有预填格");
  selectCell(state, locked.r, locked.c);
  assert.equal(eraseCell(state).action, null);
  assert.equal(locked.value, locked.answer);
});

test("整关填对：清零事件后结算三星", () => {
  const { state, puzzle } = fresh();
  complete(state);
  assert.equal(isTerminal(state), true);
  assert.equal(state.stars, 3);
  const summary = summarize(state);
  assert.equal(summary.cleared, true);
  assert.equal(summary.solved, puzzle.entries.length);
  assert.equal(summary.total, puzzle.entries.length);
  assert.equal(summary.hintsUsed, 0);
});

test("提示：用一次提示得二星，两次及以上得一星", () => {
  const first = fresh();
  useHint(first.state);
  assert.equal(first.state.hintsLeft, 2);
  assert.equal(first.state.hintsUsed, 1);
  complete(first.state);
  assert.equal(summarize(first.state).stars, 2);

  const second = fresh();
  useHint(second.state);
  useHint(second.state);
  complete(second.state);
  assert.equal(summarize(second.state).stars, 1);
});

test("提示：最多三次，用尽后返回空操作", () => {
  const { state } = fresh();
  for (let i = 0; i < 3; i += 1) useHint(state);
  assert.equal(state.hintsLeft, 0);
  assert.equal(useHint(state).action, null);
  assert.equal(state.hintsUsed, 3);
});

test("终局后所有输入均为空操作", () => {
  const { state } = fresh();
  complete(state);
  assert.equal(selectCell(state, 0, 0).action, null);
  assert.equal(selectEntry(state, 0).action, null);
  assert.equal(fillCell(state, state.rack[0]).action, null);
  assert.equal(eraseCell(state).action, null);
  assert.equal(useHint(state).action, null);
  tick(state, 100);
  assert.equal(state.elapsed, 0);
});

test("交叉格：再点一次在横竖之间切换", () => {
  const { state, puzzle } = fresh();
  const counts = new Map();
  for (const entry of puzzle.entries) {
    for (let i = 0; i < entry.len; i += 1) {
      const r = entry.row + (entry.dir === "down" ? i : 0);
      const c = entry.col + (entry.dir === "across" ? i : 0);
      const key = `${r},${c}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const shared = [...counts.entries()].find(([, count]) => count > 1);
  assert.ok(shared, "应存在交叉格");
  const [key] = shared;
  const [r, c] = key.split(",").map(Number);
  selectCell(state, r, c);
  const firstDir = state.selected.dir;
  selectCell(state, r, c);
  assert.notEqual(state.selected.dir, firstDir);
});

test("自动跳格：填对后光标移到同词下一空格", () => {
  const { state } = fresh();
  const before = state.selected.cellKey;
  const cell = state.cells.get(before);
  fillCell(state, cell.answer);
  assert.notEqual(state.selected.cellKey, before);
});

test("计时：仅进行中累加，非法值忽略", () => {
  const { state } = fresh();
  tick(state, 250);
  tick(state, -50);
  tick(state, "abc");
  assert.equal(state.elapsed, 250);
  complete(state);
  tick(state, 500);
  assert.equal(state.elapsed, 250);
});

test("随机游走 1200 步不变量", () => {
  const { state } = fresh("zh", "board_nature", 3);
  const rand = rng(20261115);
  const rackSet = new Set(state.rack);
  let cleared = false;
  for (let step = 0; step < 1200; step += 1) {
    const roll = rand();
    if (roll < 0.3) {
      const r = Math.floor(rand() * state.rows);
      const c = Math.floor(rand() * state.cols);
      selectCell(state, r, c);
    } else if (roll < 0.68) {
      const char = state.rack[Math.floor(rand() * state.rack.length)];
      fillCell(state, char);
    } else if (roll < 0.8) {
      eraseCell(state);
    } else if (roll < 0.9) {
      useHint(state);
    } else {
      selectEntry(state, Math.floor(rand() * state.entries.length));
    }
    drainEvents(state);

    assert.ok(state.hintsLeft >= 0 && state.hintsLeft <= 3);
    assert.ok(state.hintsUsed >= 0 && state.hintsUsed <= 3);
    for (const cell of state.cells.values()) {
      if (cell.value !== null) assert.ok(rackSet.has(cell.value));
      if (cell.locked) assert.equal(cell.value, cell.answer);
    }
    for (const entry of state.entries) {
      if (entry.solved) {
        for (let i = 0; i < entry.len; i += 1) {
          const r = entry.row + (entry.dir === "down" ? i : 0);
          const c = entry.col + (entry.dir === "across" ? i : 0);
          assert.equal(state.cells.get(`${r},${c}`).value, state.cells.get(`${r},${c}`).answer);
        }
      }
    }
    if (state.status === STATUS.CLEARED) cleared = true;
    assert.ok(state.status === STATUS.PLAYING || cleared);
    if (state.selected) assert.ok(state.selected.entryIndex >= 0 && state.selected.entryIndex < state.entries.length);
  }
});

test("英文题库：逐格填字同样可通关", () => {
  const { state, puzzle } = fresh("en", "board_history", 1);
  complete(state);
  assert.equal(state.status, STATUS.CLEARED);
  assert.equal(summarize(state).stars, 3);
  assert.equal(summarize(state).lang, "en");
  assert.ok(puzzle.entries.every((entry) => /^[A-Z]+$/.test(entry.answer)));
});
