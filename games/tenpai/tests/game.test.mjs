import test from 'node:test';
import assert from 'node:assert/strict';
import { TenpaiGame, GAME_STATUS } from '../js/game.mjs';

// Mock localStorage for Node environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };
}

test('TenpaiGame initializes and loads level 1', () => {
  const game = new TenpaiGame({ initialLevel: 1 });
  game.loadLevel(1);

  const state = game.getState();
  assert.equal(state.currentLevelId, 1);
  assert.equal(state.status, GAME_STATUS.ANSWERING);
  assert.equal(state.levelConfig.hand.length, 13);
  assert.equal(state.userPicks.length, 0);
  assert.equal(state.userTarget, null);
});

test('TenpaiGame toggles picks and target designation', () => {
  const game = new TenpaiGame({ initialLevel: 1 });
  game.loadLevel(1);

  // Click 1st time: select tile
  game.togglePick('5m');
  assert.equal(game.getState().userPicks.includes('5m'), true);
  assert.equal(game.getState().userTarget, null);

  // Click 2nd time: set as target
  game.togglePick('5m');
  assert.equal(game.getState().userTarget, '5m');

  // Click 3rd time: unselect tile
  game.togglePick('5m');
  assert.equal(game.getState().userPicks.includes('5m'), false);
  assert.equal(game.getState().userTarget, null);
});

test('TenpaiGame submits answer and transitions to submitted status', () => {
  const sounds = [];
  let completedResult = null;
  const game = new TenpaiGame({
    initialLevel: 1,
    onSoundEffect: (name) => sounds.push(name),
    onComplete: (res) => { completedResult = res; }
  });
  game.loadLevel(1);

  // Level 1 wait is 5m
  game.togglePick('5m');
  game.submit();

  const state = game.getState();
  assert.equal(state.status, GAME_STATUS.SUBMITTED);
  assert.ok(completedResult);
  assert.equal(completedResult.isPassed, true);
  assert.ok(sounds.includes('reveal_correct') || sounds.includes('hu_fanfare'));
});

test('TenpaiGame pauses and resumes timer correctly', () => {
  const game = new TenpaiGame({ initialLevel: 1 });
  game.loadLevel(1);

  game.pause();
  assert.equal(game.getState().status, GAME_STATUS.PAUSED);

  game.resume();
  assert.equal(game.getState().status, GAME_STATUS.ANSWERING);
});
