import test from 'node:test';
import assert from 'node:assert/strict';
import { TileStackGame } from '../js/game.mjs';

// Setup mock localStorage if running in pure Node.js
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };
}

test('TileStackGame initializes and loads level 1', () => {
  const game = new TileStackGame({ initialLevel: 1 });
  game.loadLevel(1);

  const state = game.getState();
  const config = game.getLevelConfig();

  assert.equal(config.id, 1);
  assert.equal(state.levelId, 1);
  assert.ok(state.boardTiles.length >= 24);
  assert.equal(state.tray.length, 0);
});

test('TileStackGame handles tile picking and state progression', () => {
  const sounds = [];
  const game = new TileStackGame({
    initialLevel: 1,
    onSoundEffect: (name) => sounds.push(name)
  });
  game.loadLevel(1);

  const state = game.getState();
  // Find a free tile
  const freeTile = state.boardTiles.find(t => {
    return !state.boardTiles.some(o => o.id !== t.id && o.layer > t.layer && Math.abs(o.x - t.x) < 45 && Math.abs(o.y - t.y) < 55);
  });
  assert.ok(freeTile, 'Should have at least one free tile');

  const res = game.handleTileClick(freeTile.id);
  assert.equal(res.success, true);
  assert.equal(game.getState().tray.length, 1);
  assert.ok(sounds.includes('tile_tap'));
  assert.ok(sounds.includes('tray_land'));
});

test('TileStackGame pause and resume functionality', () => {
  const game = new TileStackGame({ initialLevel: 8 }); // Level 8 is timed
  game.loadLevel(8);

  const state = game.getState();
  assert.equal(state.isTimed, true);
  state.status = 'playing';

  game.pause();
  assert.equal(game.getState().status, 'paused');

  game.resume();
  assert.equal(game.getState().status, 'playing');
});
