import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY,
  normalizeStorage,
  loadStorage,
  saveStorage,
  recordLevelClear,
  setLastLevel,
  setSoundEnabled,
  resetStorageForTests,
  writeRawForTests,
} from '../js/storage.mjs';

beforeEach(() => {
  resetStorageForTests();
});

test('storage: normalize clamps corrupted and out-of-range values', () => {
  const empty = normalizeStorage(null);
  assert.equal(empty.unlockedLevel, 1);
  assert.equal(empty.lastLevelId, 1);
  assert.deepEqual(empty.records, {});
  assert.equal(empty.sound, true);

  const dirty = normalizeStorage({
    unlockedLevel: 999,
    lastLevelId: -8,
    records: {
      1: { cleared: true, stars: 99, bestTimeMs: -20, bestMoves: -4, undos: -1 },
      999: { cleared: true, stars: 3 },
      bad: { cleared: true, stars: 2 },
    },
    sound: 0,
  });
  assert.equal(dirty.unlockedLevel, 21);
  assert.equal(dirty.lastLevelId, 1);
  assert.equal(dirty.records[1].stars, 3);
  assert.equal(dirty.records[1].bestTimeMs, 0);
  assert.equal(dirty.records[1].bestMoves, 0);
  assert.equal(dirty.records[999], undefined);
  assert.equal(dirty.records.bad, undefined);
  assert.equal(dirty.sound, false);
});

test('storage: corrupted JSON falls back to a safe default without throwing', () => {
  writeRawForTests('{ this is not json');
  const loaded = loadStorage();
  assert.equal(loaded.unlockedLevel, 1);
  assert.deepEqual(loaded.records, {});
});

test('storage: clearing a stage unlocks the next and keeps the best record', () => {
  let data = saveStorage({ unlockedLevel: 1, lastLevelId: 1, records: {}, sound: true });
  assert.equal(data.unlockedLevel, 1);

  data = recordLevelClear(1, { stars: 3, timeMs: 42000, moves: 6, undos: 0 });
  assert.equal(data.unlockedLevel, 2);
  assert.equal(data.records[1].cleared, true);
  assert.equal(data.records[1].stars, 3);
  assert.equal(data.records[1].bestTimeMs, 42000);
  assert.equal(data.records[1].bestMoves, 6);

  data = recordLevelClear(1, { stars: 1, timeMs: 90000, moves: 8, undos: 2 });
  assert.equal(data.records[1].stars, 3, 'keeps highest stars');
  assert.equal(data.records[1].bestTimeMs, 42000, 'keeps best time');
  assert.equal(data.records[1].bestMoves, 6, 'keeps best moves');
});

test('storage: round-trip, last level and sound preference persist', () => {
  saveStorage({ unlockedLevel: 4, lastLevelId: 3, records: {}, sound: true });
  const afterLevel = setLastLevel(4);
  assert.equal(afterLevel.lastLevelId, 4);
  assert.equal(afterLevel.unlockedLevel, 4);

  const afterSound = setSoundEnabled(false);
  assert.equal(afterSound.sound, false);
  const loaded = loadStorage();
  assert.equal(loaded.lastLevelId, 4);
  assert.equal(loaded.sound, false);
  assert.equal(STORAGE_KEY, 'doin.screw.v1');
});
