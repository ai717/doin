import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStorageData } from '../js/storage.mjs';

test('Normalize cleans corrupted and negative inputs', () => {
  const corrupted = {
    highScore: -999,
    bestTime: 'invalid_string',
    gamesWon: NaN,
    gamesPlayed: null,
    soundMuted: 'yes',
    savedGame: {
      seed: 'corrupt',
      cells: 'not an array'
    }
  };

  const clean = normalizeStorageData(corrupted);

  assert.equal(clean.highScore, 0);
  assert.equal(clean.bestTime, 0);
  assert.equal(clean.gamesWon, 0);
  assert.equal(clean.gamesPlayed, 0);
  assert.equal(clean.soundMuted, true);
  assert.equal(clean.savedGame, null);
});

test('Normalize keeps valid numerical fields and ensures gamesPlayed >= gamesWon', () => {
  const validData = {
    highScore: 8400.9,
    bestTime: 142,
    gamesWon: 10,
    gamesPlayed: 5,
    soundMuted: false,
    savedGame: null
  };

  const clean = normalizeStorageData(validData);

  assert.equal(clean.highScore, 8400);
  assert.equal(clean.bestTime, 142);
  assert.equal(clean.gamesWon, 10);
  assert.equal(clean.gamesPlayed, 10);
  assert.equal(clean.soundMuted, false);
});

test('Normalize gracefully handles null or primitive inputs', () => {
  const cleanFromNull = normalizeStorageData(null);
  assert.equal(cleanFromNull.highScore, 0);
  assert.equal(cleanFromNull.gamesWon, 0);

  const cleanFromString = normalizeStorageData('garbage data');
  assert.equal(cleanFromString.highScore, 0);
});
