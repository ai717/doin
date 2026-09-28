import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeStorageData,
  loadGameData,
  saveGameData,
  recordLevelResult
} from '../js/storage.mjs';

test('Storage: normalizeStorageData handles invalid or null input gracefully', () => {
  const norm1 = normalizeStorageData(null);
  assert.equal(norm1.soundMuted, false);
  assert.deepEqual(norm1.levelProgress, {});
  assert.equal(norm1.endlessStats.gamesWon, 0);

  const norm2 = normalizeStorageData({
    soundMuted: 'true',
    levelProgress: {
      level_1_1: { completed: true, stars: '3', bestScore: '500', bestMoves: '88' }
    }
  });
  assert.equal(norm2.soundMuted, true);
  assert.equal(norm2.levelProgress.level_1_1.stars, 3);
  assert.equal(norm2.levelProgress.level_1_1.bestScore, 500);
  assert.equal(norm2.levelProgress.level_1_1.bestMoves, 88);
});

test('Storage: loadGameData and saveGameData in memory fallback environment', () => {
  const initial = loadGameData();
  assert.ok(typeof initial === 'object');

  saveGameData({ soundMuted: true });
  const afterSave = loadGameData();
  assert.equal(afterSave.soundMuted, true);

  recordLevelResult('level_1_1', 3, 1200, 95);
  const afterRecord = loadGameData();
  assert.equal(afterRecord.levelProgress.level_1_1.completed, true);
  assert.equal(afterRecord.levelProgress.level_1_1.stars, 3);
  assert.equal(afterRecord.levelProgress.level_1_1.bestScore, 1200);
});
