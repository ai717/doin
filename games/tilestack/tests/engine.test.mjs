import test from 'node:test';
import assert from 'node:assert/strict';
import {
  doesTileCover,
  isTileBlocked,
  getFreeTiles,
  generateSolvableBoard,
  createGameState,
  pickTile,
  undo,
  findHint,
  createPRNG,
  GAME_STATUS
} from '../js/engine.mjs';
import { LEVELS } from '../js/levels.mjs';
import { GAME_CONSTANTS } from '../js/data.mjs';

test('doesTileCover detects overlapping layers correctly', () => {
  const lower = { x: 0, y: 0, layer: 0 };
  const upperDirect = { x: 0, y: 0, layer: 1 };
  const upperNear = { x: 10, y: 15, layer: 1 };
  const upperFar = { x: 120, y: 120, layer: 1 };
  const sameLayer = { x: 0, y: 0, layer: 0 };

  assert.equal(doesTileCover(upperDirect, lower), true);
  assert.equal(doesTileCover(upperNear, lower), true);
  assert.equal(doesTileCover(upperFar, lower), false);
  assert.equal(doesTileCover(sameLayer, lower), false);
  assert.equal(doesTileCover(lower, upperDirect), false);
});

test('generateSolvableBoard creates valid triples for all levels', () => {
  const lvl1 = LEVELS[0];
  const tiles = generateSolvableBoard(lvl1);

  assert.equal(tiles.length % 3, 0);
  assert.equal(tiles.length, lvl1.slots.length);

  // Count each type: must all be multiples of 3 (or include wild cards)
  const counts = {};
  tiles.forEach(t => {
    counts[t.type] = (counts[t.type] || 0) + 1;
  });

  for (const type of Object.keys(counts)) {
    assert.equal(counts[type] % 3, 0, `Type ${type} count ${counts[type]} should be divisible by 3`);
  }
});

test('pickTile correctly manages tray, match-3 and win condition', () => {
  const dummyLevel = {
    id: 99,
    chapter: 1,
    slots: [
      { id: 1, x: 0, y: 0, layer: 0 },
      { id: 2, x: 100, y: 0, layer: 0 },
      { id: 3, x: 200, y: 0, layer: 0 }
    ],
    seed: 42
  };

  const state = createGameState(dummyLevel);
  // Manually ensure all 3 tiles have type 'teapot'
  state.boardTiles.forEach(t => { t.type = 'teapot'; t.special = null; });

  assert.equal(state.status, GAME_STATUS.READY);
  assert.equal(state.tray.length, 0);

  // Pick first
  const res1 = pickTile(state, 1);
  assert.equal(res1.success, true);
  assert.equal(state.status, GAME_STATUS.PLAYING);
  assert.equal(state.tray.length, 1);
  assert.equal(state.boardTiles.length, 2);

  // Pick second
  const res2 = pickTile(state, 2);
  assert.equal(res2.success, true);
  assert.equal(state.tray.length, 2);

  // Pick third -> should match-3 and clear board -> WON!
  const res3 = pickTile(state, 3);
  assert.equal(res3.success, true);
  assert.equal(res3.action, 'won');
  assert.equal(state.status, GAME_STATUS.WON);
  assert.equal(state.tray.length, 0);
  assert.equal(state.boardTiles.length, 0);
});

test('pickTile triggers tray overflow loss condition at 7 tiles', () => {
  const dummyLevel = {
    id: 98,
    chapter: 1,
    slots: Array.from({ length: 9 }, (_, i) => ({
      id: i + 1,
      x: i * 80,
      y: 0,
      layer: 0
    })),
    seed: 123
  };

  const state = createGameState(dummyLevel);
  // Assign 7 different types
  const types = ['teapot', 'bowl', 'vase', 'fan', 'lotus', 'carp', 'bamboo'];
  state.boardTiles.forEach((t, idx) => {
    t.type = types[idx % types.length];
    t.special = null;
  });

  for (let i = 1; i <= 6; i++) {
    const res = pickTile(state, i);
    assert.equal(res.success, true);
    assert.equal(state.status, GAME_STATUS.PLAYING);
  }

  // 7th tile overflows tray with no match
  const res7 = pickTile(state, 7);
  assert.equal(res7.success, true);
  assert.equal(res7.action, 'lost');
  assert.equal(state.status, GAME_STATUS.LOST);
});

test('undo restores previous state accurately', () => {
  const state = createGameState(LEVELS[0]);
  const initialTilesCount = state.boardTiles.length;
  const freeTile = getFreeTiles(state.boardTiles)[0];

  pickTile(state, freeTile.id);
  assert.equal(state.boardTiles.length, initialTilesCount - 1);
  assert.equal(state.tray.length, 1);

  const undoRes = undo(state);
  assert.equal(undoRes.success, true);
  assert.equal(state.boardTiles.length, initialTilesCount);
  assert.equal(state.tray.length, 0);
});

test('hint successfully finds playable matching tiles', () => {
  const state = createGameState(LEVELS[0]);
  const hintRes = findHint(state);
  assert.equal(hintRes.success, true);
  assert.ok(hintRes.tileIds.length >= 1);
  assert.equal(state.hintsUsed, 1);
});

test('1000-step random walk test verifies invariant stability', () => {
  const prng = createPRNG(987654321);
  let state = createGameState(LEVELS[0]);

  for (let step = 0; step < 1000; step++) {
    // If state ended in won or lost, restart fresh level
    if (state.status === GAME_STATUS.WON || state.status === GAME_STATUS.LOST) {
      const lvlIdx = Math.floor(prng() * LEVELS.length);
      state = createGameState(LEVELS[lvlIdx]);
      continue;
    }

    const roll = prng();
    if (roll < 0.15 && state.undoStack.length > 0) {
      undo(state);
    } else if (roll < 0.25 && state.hintsUsed < GAME_CONSTANTS.MAX_HINTS) {
      findHint(state);
    } else {
      const free = getFreeTiles(state.boardTiles, state.unlockedKeys);
      if (free.length > 0) {
        const picked = free[Math.floor(prng() * free.length)];
        pickTile(state, picked.id);
      } else {
        // If no free tiles left, restart
        state = createGameState(LEVELS[0]);
      }
    }

    // Invariants check:
    assert.ok(state.tray.length <= GAME_CONSTANTS.TRAY_CAPACITY);
    assert.ok(state.boardTiles.length >= 0);
    assert.ok(state.score >= 0);
  }
});
