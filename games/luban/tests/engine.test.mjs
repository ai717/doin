import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createGameState,
  canBlockMove,
  tryExtractBlock,
  undo,
  findHint,
  rotateViewAngle,
  GAME_STATUS
} from '../js/engine.mjs';
import { LEVELS } from '../js/levels.mjs';

test('createGameState initializes state correctly', () => {
  const level1 = LEVELS[0];
  const state = createGameState(level1);

  assert.equal(state.status, GAME_STATUS.READY);
  assert.equal(state.steps, 0);
  assert.equal(state.viewAngle, 0);
  assert.equal(state.remainingBlocks.length, level1.blocks.length);
  assert.equal(state.extractedBlocks.length, 0);
  assert.equal(state.undoStack.length, 0);
});

test('canBlockMove detects free and blocked blocks accurately', () => {
  const level1 = LEVELS[0];
  const state = createGameState(level1);

  // Key block k1 has blockedBy: []
  const keyBlock = state.remainingBlocks.find(b => b.id === 'k1');
  assert.ok(keyBlock);
  const keyCheck = canBlockMove(keyBlock, state.remainingBlocks);
  assert.equal(keyCheck.canMove, true);
  assert.equal(keyCheck.blockers.length, 0);

  // Block b1 is blocked by k1
  const b1 = state.remainingBlocks.find(b => b.id === 'b1');
  assert.ok(b1);
  const b1Check = canBlockMove(b1, state.remainingBlocks);
  assert.equal(b1Check.canMove, false);
  assert.deepEqual(b1Check.blockers, ['k1']);
});

test('tryExtractBlock extracts free block and forbids blocked block', () => {
  const level1 = LEVELS[0];
  const state = createGameState(level1);

  // Attempting to extract blocked block b1 fails
  const resFail = tryExtractBlock(state, 'b1');
  assert.equal(resFail.success, false);
  assert.equal(resFail.reason, 'blocked');
  assert.equal(state.steps, 0);

  // Extracting free key block succeeds
  const resSuccess = tryExtractBlock(state, 'k1');
  assert.equal(resSuccess.success, true);
  assert.equal(state.steps, 1);
  assert.equal(state.remainingBlocks.length, level1.blocks.length - 1);
  assert.equal(state.extractedBlocks.length, 1);
  assert.equal(state.extractedBlocks[0].id, 'k1');
  assert.equal(state.undoStack.length, 1);

  // Now b1 should be free
  const b1After = state.remainingBlocks.find(b => b.id === 'b1');
  assert.ok(b1After);
  const b1AfterCheck = canBlockMove(b1After, state.remainingBlocks);
  assert.equal(b1AfterCheck.canMove, true);
});

test('undo rolls back extracted block properly', () => {
  const level1 = LEVELS[0];
  const state = createGameState(level1);

  tryExtractBlock(state, 'k1');
  assert.equal(state.remainingBlocks.length, level1.blocks.length - 1);
  assert.equal(state.steps, 1);

  const undoRes = undo(state);
  assert.equal(undoRes.success, true);
  assert.equal(state.remainingBlocks.length, level1.blocks.length);
  assert.equal(state.extractedBlocks.length, 0);
  assert.equal(state.steps, 0);
  assert.equal(state.undoStack.length, 0);
});

test('findHint returns unblocked candidate blocks', () => {
  const level1 = LEVELS[0];
  const state = createGameState(level1);

  const hintRes = findHint(state);
  assert.equal(hintRes.success, true);
  assert.ok(hintRes.movableBlockIds.includes('k1'));
});

test('rotateViewAngle cycles angles in 90-degree steps', () => {
  const level1 = LEVELS[0];
  const state = createGameState(level1);

  assert.equal(state.viewAngle, 0);
  assert.equal(rotateViewAngle(state, 1), 90);
  assert.equal(rotateViewAngle(state, 1), 180);
  assert.equal(rotateViewAngle(state, 1), 270);
  assert.equal(rotateViewAngle(state, 1), 0);
  assert.equal(rotateViewAngle(state, -1), 270);
});

test('≥1000 step random walk invariant test across various levels', () => {
  // Run 1000 random operations (clicks, undos, hints, rotates) without error
  for (let lvlIdx = 0; lvlIdx < 6; lvlIdx++) {
    const level = LEVELS[lvlIdx];
    const state = createGameState(level);

    for (let step = 0; step < 200; step++) {
      const actionType = Math.floor(Math.random() * 4);

      if (actionType === 0) {
        // Random block click
        if (state.remainingBlocks.length > 0) {
          const randBlock = state.remainingBlocks[Math.floor(Math.random() * state.remainingBlocks.length)];
          tryExtractBlock(state, randBlock.id);
        }
      } else if (actionType === 1) {
        // Undo
        undo(state);
      } else if (actionType === 2) {
        // Hint
        findHint(state);
      } else {
        // Rotate
        rotateViewAngle(state, Math.random() > 0.5 ? 1 : -1);
      }

      // Invariants check
      assert.ok(state.steps >= 0);
      assert.ok(state.remainingBlocks.length + state.extractedBlocks.length === level.blocks.length);
      assert.ok([0, 90, 180, 270].includes(state.viewAngle));
    }
  }
});
