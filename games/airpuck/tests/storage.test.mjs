import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeStorage,
  loadStorage,
  saveStorage,
  recordLevelClear,
  recordVsMatch,
  STORAGE_KEY,
} from '../js/storage.mjs';

test('storage: normalizeStorage with null, empty, or corrupted data', () => {
  const norm1 = normalizeStorage(null);
  assert.equal(norm1.unlockedLevel, 1);
  assert.deepEqual(norm1.records, {});
  assert.deepEqual(norm1.vsModeStats, { p1Wins: 0, p2Wins: 0 });

  const norm2 = normalizeStorage({
    unlockedLevel: 99,
    records: {
      1: { won: true, stars: 10, bestTime: -5 },
    },
  });
  assert.equal(norm2.unlockedLevel, 22, 'Level clamped to 22');
  assert.equal(norm2.records[1].stars, 3, 'Stars clamped to 3');
  assert.equal(norm2.records[1].bestTime, 1, 'Best time clamped to >= 1');
});

test('storage: recordLevelClear updates unlocked level and preserves best record', () => {
  const initial = saveStorage({ unlockedLevel: 1, records: {}, vsModeStats: { p1Wins: 0, p2Wins: 0 } });
  assert.equal(initial.unlockedLevel, 1);

  const updated = recordLevelClear(1, { won: true, stars: 3, goalsConceded: 0 }, 42);
  assert.equal(updated.unlockedLevel, 2, 'Must unlock level 2');
  assert.equal(updated.records[1].stars, 3);
  assert.equal(updated.records[1].bestTime, 42);

  // Clearing again with worse time shouldn't overwrite bestTime
  const updated2 = recordLevelClear(1, { won: true, stars: 2, goalsConceded: 1 }, 55);
  assert.equal(updated2.records[1].stars, 3, 'Keeps highest stars');
  assert.equal(updated2.records[1].bestTime, 42, 'Keeps best time');
});

test('storage: recordVsMatch updates 2-player local win tally', () => {
  saveStorage({ unlockedLevel: 1, records: {}, vsModeStats: { p1Wins: 2, p2Wins: 1 } });
  const updated = recordVsMatch('p1');
  assert.equal(updated.vsModeStats.p1Wins, 3);
  assert.equal(updated.vsModeStats.p2Wins, 1);

  const updated2 = recordVsMatch('p2');
  assert.equal(updated2.vsModeStats.p2Wins, 2);
});
