// 泡泡射手 · 计分口径单元测试（UI 不得自算分）
import test from "node:test";
import assert from "node:assert/strict";

import {
  POP_PER_BUBBLE,
  DROP_BASE,
  popScore,
  dropScore,
  comboMultiplier,
  shotScore,
  starsFor,
  chainSize,
  isAvalanche
} from "../js/score.mjs";

test("爆开计分：每颗固定 10 分", () => {
  assert.equal(popScore(3), 3 * POP_PER_BUBBLE);
  assert.equal(popScore(0), 0);
  assert.equal(popScore(7), 70);
});

test("坠落计分：经典几何级数 20/40/80 翻倍", () => {
  assert.equal(dropScore(0), 0);
  assert.equal(dropScore(1), DROP_BASE);
  assert.equal(dropScore(2), DROP_BASE * 2);
  assert.equal(dropScore(3), DROP_BASE * 4);
  assert.equal(dropScore(4), DROP_BASE * 8);
});

test("坠落计分封顶：避免单次连锁分数爆炸", () => {
  const cap = dropScore(10);
  assert.equal(dropScore(11), cap);
  assert.equal(dropScore(40), cap);
  assert.ok(cap <= DROP_BASE * 1024);
});

test("坠落分远高于爆开分（鼓励打支撑柱）", () => {
  assert.ok(dropScore(8) > popScore(8) * 5, "八连坠落必须显著高于八颗爆开");
});

test("连击倍率：连续得分递增并封顶 ×3", () => {
  assert.equal(comboMultiplier(0), 1);
  assert.equal(comboMultiplier(1), 1);
  assert.equal(comboMultiplier(2), 1.2);
  assert.equal(comboMultiplier(3), 1.5);
  assert.equal(comboMultiplier(4), 2);
  assert.equal(comboMultiplier(9), 3);
});

test("单发计分：爆开 + 坠落 × 连击倍率，向下取整", () => {
  const base = popScore(3) + dropScore(2);
  assert.equal(shotScore({ popped: 3, dropped: 2, streak: 1 }), base);
  assert.equal(shotScore({ popped: 3, dropped: 2, streak: 2 }), Math.round(base * 1.2));
  assert.equal(shotScore({ popped: 3, dropped: 2, streak: 9 }), Math.round(base * 3));
});

test("硬核瞄准档（无预测线）享受 ×1.15 加成", () => {
  const normal = shotScore({ popped: 3, dropped: 0, streak: 1, pro: false });
  const pro = shotScore({ popped: 3, dropped: 0, streak: 1, pro: true });
  assert.ok(pro > normal);
  assert.equal(pro, Math.round(30 * 1.15));
});

test("星级评定：不超过目标发数三星，+4 发内二星", () => {
  assert.equal(starsFor(18, 20), 3);
  assert.equal(starsFor(20, 20), 3);
  assert.equal(starsFor(24, 20), 2);
  assert.equal(starsFor(25, 20), 1);
});

test("连锁规模与雪崩判定", () => {
  assert.equal(chainSize(3, 2), 5);
  assert.equal(isAvalanche(5), true);
  assert.equal(isAvalanche(4), false);
  assert.equal(isAvalanche(19), true);
});
