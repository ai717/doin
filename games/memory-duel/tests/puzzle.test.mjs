// 残局模式单测：15 关全部存在且可通过模拟操作成功获胜
import { test } from "node:test";
import assert from "node:assert/strict";
import { PUZZLES, loadPuzzleGame } from "../js/puzzles.mjs";
import { applyFlipCard, applySteal, applyLock, applyScout } from "../js/engine.mjs";

test("15 个残局配置完整且无缺失", () => {
  assert.equal(PUZZLES.length, 15);
  for (let i = 0; i < 15; i++) {
    const pz = PUZZLES[i];
    assert.equal(pz.id, `puzzle_${i + 1}`);
    assert.ok(pz.boardCards.length >= 4);
    assert.ok(pz.targetPairs >= 3);
    assert.ok(pz.players.player);
    assert.ok(pz.players.opponent);
    assert.ok(pz.stars.maxSteps >= 1);
  }
});

test("残局 1：配对已知星钥直接绝杀达成 3 对", () => {
  const state = loadPuzzleGame(0);
  assert.equal(state.players.player.pairs, 2);
  assert.equal(state.targetPairs, 3);

  // 翻开 0 和 3 号（星钥）
  const { state: s1 } = applyFlipCard(state, 0);
  const { state: s2 } = applyFlipCard(s1, 3);

  assert.equal(s2.players.player.pairs, 3);
  assert.equal(s2.winner, "player");
  assert.equal(s2.winReason, "target_reached");
});

test("残局 2：先偷牌拆散对手即将胜利的完整对", () => {
  const state = loadPuzzleGame(1);
  assert.equal(state.players.opponent.pairs, 2);
  assert.equal(state.players.player.sp, 2);

  const { state: s1, action } = applySteal(state);
  assert.equal(action.type, "steal");
  assert.equal(s1.players.opponent.pairs, 1);
  assert.equal(s1.players.player.looseCards, 1);
});

test("残局 3：先上锁封死对手偷袭威胁", () => {
  const state = loadPuzzleGame(2);
  assert.equal(state.players.player.pairs, 2);
  assert.equal(state.players.player.lockedPairs, 1);

  const { state: s1, action } = applyLock(state);
  assert.equal(action.type, "lock");
  assert.equal(s1.players.player.lockedPairs, 2);
});
