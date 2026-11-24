import test from "node:test";
import assert from "node:assert/strict";

import {
  formatTime,
  isNewBest,
  reasonKey,
  resultTitleKey,
  seatLabelKey,
  summarize,
  turnLabelKey,
} from "../js/score.mjs";

test("计分：用时格式为两位分秒", () => {
  assert.equal(formatTime(0), "00:00");
  assert.equal(formatTime(9.9), "00:09");
  assert.equal(formatTime(65), "01:05");
  assert.equal(formatTime(-4), "00:00");
  assert.equal(formatTime(Number.NaN), "00:00");
});

test("计分：回合方文案区分单人与双人", () => {
  assert.equal(turnLabelKey("solo", "south", "south"), "turnYou");
  assert.equal(turnLabelKey("solo", "north", "south"), "turnAi");
  assert.equal(turnLabelKey("duel", "south", "south"), "turnP1");
  assert.equal(turnLabelKey("duel", "north", "south"), "turnP2");
  assert.equal(seatLabelKey("solo", "south", "north"), "seatAi");
  assert.equal(seatLabelKey("duel", "north", "south"), "seatP2");
});

test("计分：结算标题覆盖胜、负、平与双人", () => {
  assert.equal(resultTitleKey("solo", "south", "south"), "winSolo");
  assert.equal(resultTitleKey("solo", "north", "south"), "loseSolo");
  assert.equal(resultTitleKey("solo", "draw", "south"), "drawTitle");
  assert.equal(resultTitleKey("duel", "south", "south"), "duelWinSouth");
  assert.equal(resultTitleKey("duel", "north", "south"), "duelWinNorth");
  assert.equal(reasonKey("cleared"), "reasonCleared");
  assert.equal(reasonKey("limit"), "reasonLimit");
});

test("计分：最佳纪录先比回合再比用时", () => {
  assert.equal(isNewBest(null, 10, 30), true);
  assert.equal(isNewBest({ rounds: 10, time: 30 }, 9, 40), true);
  assert.equal(isNewBest({ rounds: 10, time: 30 }, 11, 10), false);
  assert.equal(isNewBest({ rounds: 10, time: 30 }, 10, 29), true);
  assert.equal(isNewBest({ rounds: 10, time: 30 }, 10, 30), false);
});

test("计分：汇总半场棋子", () => {
  const state = {
    round: 3,
    maxRounds: 60,
    time: 12.4,
    winner: null,
    reason: null,
    pucks: [
      { side: "south" },
      { side: "south" },
      { side: "north" },
    ],
  };
  const result = summarize(state);
  assert.equal(result.counts.south, 2);
  assert.equal(result.counts.north, 1);
  assert.equal(result.round, 3);
});
