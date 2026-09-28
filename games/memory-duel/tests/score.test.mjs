// 计分与星级评估单测
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateDuelStars,
  calculatePuzzleStars,
  calculateSummary,
} from "../js/score.mjs";

test("calculateDuelStars: 3 星判定 (净胜≥2, SP≥2, 失误≤2)", () => {
  const state = {
    winner: "player",
    players: {
      player: { pairs: 5, sp: 3, mistakes: 1, lockedPairs: 2, looseCards: 1 },
      opponent: { pairs: 3, sp: 1, mistakes: 4, lockedPairs: 1, looseCards: 0 },
    },
    turnCount: 8,
  };

  const stars = calculateDuelStars(state);
  assert.equal(stars, 3);
});

test("calculateDuelStars: 输局或平局一律 0 星", () => {
  const stateDefeat = {
    winner: "opponent",
    players: {
      player: { pairs: 4, sp: 0, mistakes: 3 },
      opponent: { pairs: 5, sp: 2, mistakes: 1 },
    },
  };
  assert.equal(calculateDuelStars(stateDefeat), 0);
});

test("calculatePuzzleStars: 根据残局步数与 SP 评估星级", () => {
  const state = {
    winner: "player",
    turnCount: 2,
    players: {
      player: { sp: 2 },
    },
  };
  const criteria = { maxSteps: 2, minSp: 1 };
  assert.equal(calculatePuzzleStars(state, criteria), 3);
});

test("calculateSummary: 统计数据聚合准确无误", () => {
  const state = {
    winner: "player",
    winReason: "target_reached",
    turnCount: 10,
    players: {
      player: { pairs: 5, lockedPairs: 3, looseCards: 1, sp: 2, mistakes: 2 },
      opponent: { pairs: 2, lockedPairs: 1, looseCards: 0, sp: 0, mistakes: 5 },
    },
  };
  const summary = calculateSummary(state);
  assert.equal(summary.winner, "player");
  assert.equal(summary.netPairs, 3);
  assert.equal(summary.playerPairs, 5);
  assert.equal(summary.opponentPairs, 2);
});
