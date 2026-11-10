import test from "node:test";
import assert from "node:assert/strict";

import {
  NO_VALUE,
  averageOf,
  bestOf,
  formatTime,
  pushTime,
  scoreRound,
  starsFor,
  tps,
} from "../js/score.mjs";

test("timer formatting always uses mm:ss.cc", () => {
  assert.equal(formatTime(0), "00:00.00");
  assert.equal(formatTime(42), "00:00.04");
  assert.equal(formatTime(42580), "00:42.58");
  assert.equal(formatTime(61000), "01:01.00");
  assert.equal(formatTime(599999), "09:59.99");
  assert.equal(formatTime(-5), "00:00.00");
  assert.equal(NO_VALUE, "—");
});

test("tps never divides by zero", () => {
  assert.equal(tps(30, 60000), 0.5);
  assert.equal(tps(0, 1000), 0);
  assert.equal(tps(10, 0), 0);
  assert.equal(tps(3, 1500), 2);
});

test("scores fall with more moves and time, with a floor", () => {
  const clean = scoreRound({ size: 3, moves: 20, ms: 30000 });
  const messy = scoreRound({ size: 3, moves: 60, ms: 90000 });
  assert.ok(clean > messy);
  assert.ok(messy >= 100);
  assert.equal(scoreRound({ size: 2, moves: 9999, ms: 9999999 }), 100);
  assert.ok(scoreRound({ size: 3, moves: 20, ms: 30000 }) > scoreRound({ size: 2, moves: 20, ms: 30000 }));
});

test("stars follow the par thresholds", () => {
  assert.equal(starsFor({ moves: 5, par: 5 }), 3);
  assert.equal(starsFor({ moves: 6, par: 5 }), 2);
  assert.equal(starsFor({ moves: 10, par: 5 }), 2);
  assert.equal(starsFor({ moves: 11, par: 5 }), 1);
  assert.equal(starsFor({ moves: 0, par: 1 }), 3);
});

test("ao5 needs five solves and trims the extremes", () => {
  assert.equal(averageOf([]), 0);
  assert.equal(averageOf([1000, 2000, 3000, 4000]), 0);
  assert.equal(averageOf([1000, 2000, 3000, 4000, 5000]), 3000);
  assert.equal(averageOf([9000, 1000, 5000, 2000, 3000]), 3333);
});

test("time buffers keep the last five non-zero entries", () => {
  let list = [];
  for (const value of [0, 1200, 0, 900, 1500, 2100, 800, 1700]) {
    list = pushTime(list, value);
  }
  assert.deepEqual(list, [900, 1500, 2100, 800, 1700]);
  assert.equal(bestOf([3200, 0, 2800, -1]), 2800);
  assert.equal(bestOf([]), 0);
});
