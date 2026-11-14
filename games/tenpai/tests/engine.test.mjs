import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTile,
  sortTiles,
  checkWinningHand,
  findWaits,
  evaluateHandFan,
  analyzeAllWaitsWithFan,
  ALL_TILE_IDS
} from '../js/engine.mjs';

test('parseTile parses suit and value correctly', () => {
  assert.deepEqual(parseTile('3m'), { suit: 'm', value: 3, id: '3m' });
  assert.deepEqual(parseTile('9p'), { suit: 'p', value: 9, id: '9p' });
  assert.deepEqual(parseTile('7z'), { suit: 'z', value: 7, id: '7z' });
});

test('sortTiles orders tiles by suit and value', () => {
  const unsorted = ['5z', '9p', '1m', '4s', '2m', '1s'];
  const sorted = sortTiles(unsorted);
  assert.deepEqual(sorted, ['1m', '2m', '9p', '1s', '4s', '5z']);
});

test('checkWinningHand verifies standard 4 melds + 1 pair', () => {
  const hand14 = [
    '1m', '2m', '3m',
    '4m', '5m', '6m',
    '7m', '8m', '9m',
    '2s', '3s', '4s',
    '5p', '5p'
  ];
  const win = checkWinningHand(hand14);
  assert.equal(win.isWin, true);
  assert.equal(win.shape, 'standard');
  assert.equal(win.pair, '5p');
});

test('checkWinningHand verifies Seven Pairs', () => {
  const hand14 = [
    '1m', '1m', '3m', '3m', '5m', '5m', '7m', '7m', '9m', '9m', '2s', '2s', '4p', '4p'
  ];
  const win = checkWinningHand(hand14);
  assert.equal(win.isWin, true);
  assert.equal(win.shape, 'seven_pairs');
});

test('checkWinningHand verifies Thirteen Orphans', () => {
  const hand14 = [
    '1m', '9m', '1p', '9p', '1s', '9s', '1z', '2z', '3z', '4z', '5z', '6z', '7z', '7z'
  ];
  const win = checkWinningHand(hand14);
  assert.equal(win.isWin, true);
  assert.equal(win.shape, 'thirteen_orphans');
});

test('findWaits finds two-sided wait 1s and 4s', () => {
  const hand13 = [
    '1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1s', '1s', '2s', '3s'
  ];
  const waits = findWaits(hand13);
  assert.deepEqual(waits, ['1s', '4s']);
});

test('findWaits finds all 13 waits for Thirteen Orphans', () => {
  const hand13 = [
    '1m', '9m', '1p', '9p', '1s', '9s', '1z', '2z', '3z', '4z', '5z', '6z', '7z'
  ];
  const waits = findWaits(hand13);
  assert.equal(waits.length, 13);
});

test('evaluateHandFan awards full flush (清一色) 6 fan', () => {
  const hand13 = [
    '1m', '1m', '1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '9m', '9m'
  ];
  const evalRes = evaluateHandFan(hand13, '5m');
  assert.ok(evalRes.totalFan >= 6);
  assert.ok(evalRes.fanList.some(f => f.id === 'qingyise' || f.id === 'jiulian'));
});

test('1000-step random walk test verifies engine invariant stability', () => {
  let seed = 123456789;
  function prng() {
    seed = (seed + 0x6D2B79F5) >>> 0;
    return (seed >>> 0) / 4294967296;
  }

  for (let step = 0; step < 1000; step++) {
    // Generate a random 13-tile hand from available tiles
    const sample = [];
    for (let i = 0; i < 13; i++) {
      const idx = Math.floor(prng() * ALL_TILE_IDS.length);
      sample.push(ALL_TILE_IDS[idx]);
    }
    const res = findWaits(sample);
    assert.ok(Array.isArray(res));
    // Each wait found must be valid
    res.forEach(w => {
      const winCheck = checkWinningHand([...sample, w]);
      assert.equal(winCheck.isWin, true, 'Every returned wait must form a win');
    });
  }
});
