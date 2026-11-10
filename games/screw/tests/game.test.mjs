import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ScrewGame } from '../js/game.mjs';
import { resetStorageForTests, loadStorage } from '../js/storage.mjs';
import { solveLevel } from '../js/solver.mjs';
import { levelById } from '../js/levels.mjs';
import { stats, STATUS } from '../js/engine.mjs';

beforeEach(() => {
  resetStorageForTests();
});

function screwIds(level) {
  const ids = [];
  for (const plate of level.plates) {
    for (let i = 0; i < plate.holes.length; i += 1) ids.push(`${plate.id}-${i}`);
  }
  return ids;
}

test('game: boots into a ready first stage without any blocking overlay', () => {
  const game = new ScrewGame();
  assert.equal(game.getLevel().id, 1);
  assert.equal(game.getState().status, STATUS.PLAYING);
  assert.equal(stats(game.getState()).boardScrews, 6);
  assert.equal(game.isPaused(), false);
});

test('game: legal action, unlimited undo and restart restore the board', () => {
  const game = new ScrewGame();
  const before = stats(game.getState()).boardScrews;
  const accessible = game.accessibleScrews().find((screw) => game.canUnscrew(screw.id));
  assert.ok(accessible);

  const action = game.unscrew(accessible.id);
  assert.ok(action);
  assert.equal(stats(game.getState()).boardScrews, before - 1);
  assert.equal(game.canUndo(), true);

  assert.equal(game.undo(), true);
  assert.equal(stats(game.getState()).boardScrews, before);
  assert.equal(game.getUndoCount(), 1);

  game.unscrew(accessible.id);
  game.restart();
  assert.equal(stats(game.getState()).boardScrews, before);
  assert.equal(game.getUndoCount(), 0);
});

test('game: pause freezes elapsed time and resume continues', () => {
  const game = new ScrewGame();
  game.pause();
  const frozen = game.getElapsedMs();
  assert.equal(game.getElapsedMs(), frozen);
  assert.equal(game.isPaused(), true);
  game.resume();
  assert.equal(game.isPaused(), false);
  assert.ok(game.getElapsedMs() >= frozen);
});

test('game: solver solution clears stage 1, records stars and unlocks stage 2', () => {
  const game = new ScrewGame();
  const level = levelById(1);
  const solved = solveLevel(level, { seed: 3 });
  assert.ok(solved.solution);
  const ids = screwIds(level);

  for (const index of solved.solution) {
    const action = game.unscrew(ids[index]);
    assert.ok(action, `unexpected illegal solver move ${ids[index]}`);
  }

  assert.equal(game.getState().status, STATUS.WON);
  assert.ok(game.lastResult);
  assert.ok(game.lastResult.stars >= 1 && game.lastResult.stars <= 3);
  assert.equal(game.lastResult.moves, 6);

  const stored = loadStorage();
  assert.equal(stored.records[1].cleared, true);
  assert.equal(stored.unlockedLevel, 2);
  assert.equal(game.canUndo(), false, 'a cleared stage cannot be undone into a loss');
});
