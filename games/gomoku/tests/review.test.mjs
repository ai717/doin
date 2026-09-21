// review.mjs 单元测试

import test from "node:test";
import assert from "node:assert";
import { analyzeGame } from "../js/review.mjs";
import { BLACK, WHITE } from "../js/engine.mjs";

const idx = (r, c) => r * 15 + c;

test("analyzeGame: 空着法返回空数组", () => {
  const r = analyzeGame([], null, BLACK);
  assert.deepStrictEqual(r, []);
});

test("analyzeGame: 识别最终连五制胜手", () => {
  // 黑棋直接横向连五
  const moves = [
    idx(7, 5), idx(8, 5),
    idx(7, 6), idx(8, 6),
    idx(7, 7), idx(8, 7),
    idx(7, 8), idx(8, 8),
    idx(7, 9), // 黑 5 连
  ];
  const reviews = analyzeGame(moves, BLACK, BLACK);
  assert.ok(reviews.length >= 1);
  const winReview = reviews.find((x) => x.type === "win");
  assert.ok(winReview, "应包含胜定点评");
  assert.strictEqual(winReview.step, 9);
  assert.strictEqual(winReview.isHuman, true);
});

test("analyzeGame: 识别双杀形绝杀手", () => {
  // 模拟黑棋在 (7,7) 同时形成两个三或冲四活三
  const moves = [
    idx(7, 5), idx(0, 0),
    idx(7, 6), idx(0, 1),
    idx(5, 7), idx(0, 2),
    idx(6, 7), idx(0, 3),
    idx(7, 7), // 双杀手
  ];
  const reviews = analyzeGame(moves, null, BLACK);
  assert.ok(reviews.some((r) => r.type === "double_threat" && r.step === 9));
});
