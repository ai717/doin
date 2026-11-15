import test from 'node:test';
import assert from 'node:assert/strict';

import { LubanGame } from '../js/game.mjs';

test('LubanGame coordinator manages level flow, rotations and clicks', () => {
  let stateChanges = 0;
  let sounds = [];
  let blockBlockedTriggered = false;

  const game = new LubanGame({
    initialLevel: 1,
    onStateChange: () => {
      stateChanges++;
    },
    onSoundEffect: (snd) => {
      sounds.push(snd);
    },
    onBlockBlocked: () => {
      blockBlockedTriggered = true;
    }
  });

  game.loadLevel(1);
  assert.equal(game.currentLevelId, 1);
  assert.ok(stateChanges > 0);

  // Rotate view
  const angle = game.handleRotate(1);
  assert.equal(angle, 90);
  assert.ok(sounds.includes('view_rotate'));

  // Hint
  const hintRes = game.handleHint();
  assert.equal(hintRes.success, true);
  assert.ok(sounds.includes('hint_chime'));

  // Blocked click
  const blockedRes = game.handleBlockClick('b1');
  assert.equal(blockedRes.success, false);
  assert.equal(blockedRes.reason, 'blocked');
  assert.equal(blockBlockedTriggered, true);
  assert.ok(sounds.includes('wood_thud'));

  // Free click
  const freeRes = game.handleBlockClick('k1');
  assert.equal(freeRes.success, true);
  assert.ok(sounds.includes('wood_slide'));
});
