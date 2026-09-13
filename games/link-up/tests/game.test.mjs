import test from "node:test";
import assert from "node:assert/strict";

import { Game } from "../js/game.mjs?v=dev";

function makeAudio() {
  const noop = () => {};
  return { sfx: { select: noop, reject: noop, line: noop, clear: noop, shuffle: noop, win: noop, tick: noop } };
}

test("Game：连续洗牌使用不同确定性种子，盘面确实变化", () => {
  const saved = [];
  const storage = {
    load: () => ({ unlocked: 1, best: {}, daily: null, sound: true }),
    save: (data) => data,
    recordResult: (data) => ({ data, isNewBest: false }),
  };
  const game = new Game({ storage, audio: makeAudio() });
  game.startLevel(17);
  const before = JSON.stringify(game.state.grid);
  game.intentShuffle();
  const once = JSON.stringify(game.state.grid);
  game.intentShuffle();
  const twice = JSON.stringify(game.state.grid);
  assert.notEqual(once, before);
  assert.notEqual(twice, once);
  assert.equal(game.state.shuffleCount, 2);
  assert.deepEqual(saved, []);
});

test("Game：每日结算把 dailyDate 传成可持久化的 date", () => {
  let recorded = null;
  const storage = {
    load: () => ({ unlocked: 1, best: {}, daily: null, sound: true }),
    save: (data) => data,
    recordResult: (data, result) => {
      recorded = result;
      return { data, isNewBest: false };
    },
  };
  const game = new Game({ storage, audio: makeAudio() });
  game.startDaily("2026-09-13");
  game.settle(false);
  assert.ok(recorded);
  assert.equal(recorded.dailyDate, "2026-09-13");
  assert.equal(recorded.date, "2026-09-13");
});

test("Game：连线动画期间不允许暂停，结算幂等且 phase 同步", () => {
  const storage = {
    load: () => ({ unlocked: 1, best: {}, daily: null, sound: true }),
    save: (data) => data,
    recordResult: (data) => ({ data, isNewBest: false }),
  };
  const noop = () => {};
  const audio = { sfx: { select: noop, reject: noop, line: noop, clear: noop, shuffle: noop, win: noop, tick: noop } };
  const game = new Game({ storage, audio });
  let wins = 0;
  game.on("win", () => { wins += 1; });
  game.startLevel(1);
  const occupied = [];
  for (let r = 0; r < game.state.rows; r++) {
    for (let c = 0; c < game.state.cols; c++) {
      if (game.state.grid[r][c] !== null) occupied.push({ r, c, value: game.state.grid[r][c] });
    }
  }
  let pair = null;
  for (let i = 0; i < occupied.length && !pair; i++) {
    for (let j = i + 1; j < occupied.length; j++) {
      if (occupied[i].value === occupied[j].value) { pair = [occupied[i], occupied[j]]; break; }
    }
  }
  assert.ok(pair);
  game.intentSelect(pair[0].r, pair[0].c);
  game.intentSelect(pair[1].r, pair[1].c);
  assert.ok(game.pending);
  game.togglePause();
  assert.equal(game.paused, false);
  game.confirmPathDone();
  assert.equal(game.state.steps, 1);
  game.settle(false);
  game.settle(false);
  assert.equal(wins, 1);
  assert.equal(game.phase, "won");
});
