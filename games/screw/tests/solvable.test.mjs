import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, CHAPTERS, levelById, levelsOfChapter } from '../js/levels.mjs';
import { solveLevel, replaySolution } from '../js/solver.mjs';
import { validateLevelData, createState, listAccessibleScrews, STATUS } from '../js/engine.mjs';

test('levels: exactly 21 stages across five workshops (4/5/4/5/3)', () => {
  assert.equal(LEVELS.length, 21);
  assert.deepEqual(
    CHAPTERS.map((chapter) => chapter.levelIds.length),
    [4, 5, 4, 5, 3],
  );
  assert.deepEqual(
    CHAPTERS.flatMap((chapter) => levelsOfChapter(chapter.id).map((level) => level.id)),
    Array.from({ length: 21 }, (_, index) => index + 1),
  );
  for (const chapter of CHAPTERS) {
    assert.ok(chapter.nameKey);
    assert.ok(chapter.subtitleKey);
    assert.ok(chapter.colorCount >= 2 && chapter.colorCount <= 5);
  }
});

test('levels: every stage has healthy, deterministic and fully solvable data', () => {
  for (const level of LEVELS) {
    const problems = validateLevelData(level);
    assert.deepEqual(problems, [], `level ${level.id} has data problems`);

    const state = createState(level);
    assert.equal(state.status, STATUS.PLAYING, `level ${level.id} must be playable on load`);
    assert.ok(listAccessibleScrews(state).length > 0, `level ${level.id} has no first move`);

    const solved = solveLevel(level, { seed: 7, maxNodes: 400000 });
    assert.equal(solved.aborted, false, `level ${level.id} solver aborted`);
    assert.ok(Array.isArray(solved.solution), `level ${level.id} has no solution`);
    assert.equal(solved.solution.length, level.plates.reduce((sum, plate) => sum + plate.holes.length, 0));

    const replay = replaySolution(level, solved.solution);
    assert.equal(replay.ok, true, `level ${level.id} replay failed: ${replay.problem}`);
  }
});

test('levels: buffer capacity is 3 or 4 and box queues consume every screw', () => {
  for (const level of LEVELS) {
    assert.ok([3, 4].includes(level.bufferCapacity), `level ${level.id} buffer ${level.bufferCapacity}`);
    const total = level.plates.reduce((sum, plate) => sum + plate.holes.length, 0);
    assert.equal(total % 3, 0);
    assert.equal(level.boxQueue.length, total / 3);
    const counts = {};
    for (const plate of level.plates) {
      for (const [, , color] of plate.holes) counts[color] = (counts[color] || 0) + 1;
    }
    const expected = {};
    for (const color of level.boxQueue) expected[color] = (expected[color] || 0) + 3;
    assert.deepEqual(counts, expected);
  }
});

test('levels: first stage is a gentle two-color tutorial', () => {
  const first = levelById(1);
  assert.equal(first.plates.reduce((sum, plate) => sum + plate.holes.length, 0), 6);
  assert.equal(first.boxQueue.length, 2);
  assert.equal(first.bufferCapacity, 4);
  const state = createState(first);
  assert.equal(listAccessibleScrews(state).length, 6);
});
