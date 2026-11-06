import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStorage, loadGameData, saveGameData } from '../js/storage.mjs';

test('storage: normalizeStorage with null, empty, or corrupted data', () => {
  const normEmpty = normalizeStorage(null);
  assert.equal(normEmpty.realmId, 1);
  assert.equal(normEmpty.cauldronLevel, 1);
  assert.deepEqual(normEmpty.equipment, {});
  assert.equal(normEmpty.soundEnabled, true);

  const normCorrupted = normalizeStorage({
    realmId: 999,
    cauldronLevel: -5,
    spiritStones: -100,
    equipment: { sword: { uid: 'eq_1', nameZh: '飞剑' }, bad: null }
  });
  assert.equal(normCorrupted.realmId, 21);
  assert.equal(normCorrupted.cauldronLevel, 1);
  assert.equal(normCorrupted.spiritStones, 200);
  assert.ok(normCorrupted.equipment.sword);
  assert.equal(normCorrupted.equipment.bad, undefined);
});

test('storage: loadGameData and saveGameData persistence fallback', () => {
  const data = loadGameData();
  data.spiritStones = 9999;
  const saved = saveGameData(data);
  assert.equal(saved.spiritStones, 9999);
});
