import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState,
  unscrew,
  canUnscrew,
  isScrewAccessible,
  listAccessibleScrews,
  remainingScrewsOnPlate,
  plateStatus,
  useMagnet,
  stats,
  evaluateStatus,
  mulberry32,
  validateLevelData,
  STATUS,
  PLATE_STATE,
} from '../js/engine.mjs';
import { LEVELS } from '../js/levels.mjs';

function testLevel(overrides = {}) {
  return {
    id: 99,
    boxQueue: ['red', 'blue'],
    bufferCapacity: 3,
    plates: [
      {
        id: 'top',
        layer: 2,
        material: 'wood',
        cells: [[0, 0], [1, 0], [2, 0]],
        holes: [[0, 0, 'red'], [2, 0, 'red']],
      },
      {
        id: 'bottom',
        layer: 1,
        material: 'wood',
        cells: [[1, 0], [1, 1], [0, 1]],
        holes: [[1, 0, 'blue'], [1, 1, 'blue'], [0, 1, 'blue']],
      },
      {
        id: 'single',
        layer: 1,
        material: 'wood',
        cells: [[3, 3]],
        holes: [[3, 3, 'red']],
      },
    ],
    ...overrides,
  };
}

test('engine: createState builds board, boxes, buffer and playing status', () => {
  const level = testLevel();
  assert.deepEqual(validateLevelData(level), []);
  const state = createState(level);
  assert.equal(state.screws.length, 6);
  assert.equal(state.boxes.length, 2);
  assert.equal(state.activeBox, 0);
  assert.equal(state.buffer.length, 0);
  assert.equal(state.bufferCapacity, 3);
  assert.equal(state.status, STATUS.PLAYING);
  assert.ok(state.screws.every((screw) => screw.state === 'board'));
});

test('engine: higher anchored plate covers lower screw, swinging reveals it', () => {
  const state = createState(testLevel());
  assert.equal(isScrewAccessible(state, 'bottom-0'), false, 'screw under top plate must be covered');
  assert.equal(isScrewAccessible(state, 'top-0'), true);

  const first = unscrew(state, 'top-0');
  assert.ok(first.action);
  assert.equal(first.action.destination, 'box');
  assert.equal(first.state.activeBox, 0);
  assert.equal(remainingScrewsOnPlate(first.state, 'top'), 1);
  assert.equal(plateStatus(first.state, 'top'), PLATE_STATE.SWINGING);
  assert.equal(
    isScrewAccessible(first.state, 'bottom-0'),
    true,
    'a one-screw plate swings aside and stops blocking lower layers',
  );

  const second = unscrew(first.state, 'top-1');
  assert.ok(second.action);
  assert.equal(plateStatus(second.state, 'top'), PLATE_STATE.GONE);
  assert.equal(second.state.plates.find((plate) => plate.id === 'top').cells.length, 3);
});

test('engine: non-matching screws park in buffer and buffer capacity blocks', () => {
  const level = {
    id: 96,
    boxQueue: ['red', 'blue'],
    bufferCapacity: 1,
    plates: [
      { id: 'm', layer: 1, material: 'wood', cells: [[0, 0], [1, 0]], holes: [[0, 0, 'blue'], [1, 0, 'blue']] },
      { id: 'n', layer: 1, material: 'wood', cells: [[2, 0], [3, 0]], holes: [[2, 0, 'blue'], [3, 0, 'blue']] },
    ],
  };
  let state = createState(level);
  const blue = state.screws.find((screw) => screw.id === 'm-0');
  assert.ok(canUnscrew(state, blue.id));
  const result = unscrew(state, blue.id);
  assert.ok(result.action);
  assert.equal(result.action.destination, 'buffer');
  assert.equal(result.state.buffer.length, 1);

  const otherBlue = result.state.screws.find((screw) => screw.id === 'n-0');
  assert.equal(canUnscrew(result.state, otherBlue.id), false, 'buffer is full and no red is exposed');
  assert.equal(evaluateStatus(result.state), STATUS.LOST);
});

test('engine: box completion drives auto inflow from buffer', () => {
  const level = {
    id: 98,
    boxQueue: ['red', 'blue'],
    bufferCapacity: 2,
    plates: [
      { id: 'r', layer: 1, material: 'wood', cells: [[0, 0], [1, 0], [2, 0]], holes: [[0, 0, 'red'], [1, 0, 'red'], [2, 0, 'red']] },
      { id: 'b', layer: 1, material: 'wood', cells: [[0, 2], [1, 2], [2, 2]], holes: [[0, 2, 'blue'], [1, 2, 'blue'], [2, 2, 'blue']] },
    ],
  };
  let state = createState(level);

  state = unscrew(state, 'b-0').state;
  assert.equal(state.buffer.length, 1);

  state = unscrew(state, 'r-0').state;
  state = unscrew(state, 'r-1').state;
  state = unscrew(state, 'r-2').state;

  assert.equal(state.activeBox, 1);
  assert.equal(state.boxes[1].collected, 1, 'buffered blue must flow into the new blue box');
  assert.equal(state.buffer.length, 0);
  assert.ok(state.events.some((event) => event.type === 'buffer_inflow'));
});

test('engine: clearing all screws wins and magnet can overflow the buffer once', () => {
  let state = createState(testLevel());
  for (const id of ['top-0', 'top-1', 'single-0', 'bottom-0', 'bottom-1', 'bottom-2']) {
    const result = unscrew(state, id);
    assert.ok(result.action, `expected legal move ${id}`);
    state = result.state;
  }
  assert.equal(state.status, STATUS.WON);
  assert.equal(stats(state).boardScrews, 0);

  const magnetLevel = {
    id: 97,
    boxQueue: ['red', 'blue'],
    bufferCapacity: 1,
    plates: [
      { id: 'm', layer: 1, material: 'wood', cells: [[0, 0], [1, 0]], holes: [[0, 0, 'blue'], [1, 0, 'blue']] },
      { id: 'n', layer: 1, material: 'wood', cells: [[2, 0], [3, 0]], holes: [[2, 0, 'blue'], [3, 0, 'blue']] },
    ],
  };
  let magnetState = createState(magnetLevel);
  magnetState = unscrew(magnetState, 'm-0').state;
  assert.equal(magnetState.buffer.length, 1);

  const magnet = useMagnet(magnetState, 'm-1');
  assert.ok(magnet.action);
  assert.equal(magnet.state.magnetUsed, true);
  assert.equal(magnet.state.buffer.length, 2, 'magnet may exceed buffer capacity once');
  assert.equal(useMagnet(magnet.state, 'n-0').action, null, 'magnet is single-use');
});

test('engine: every shipped level passes 1000+ seeded random-walk invariant steps', () => {
  const rng = mulberry32(0x5c3e2);
  for (const level of LEVELS) {
    let state = createState(level);
    let actions = 0;
    let guard = 0;
    const totalScrews = state.screws.length;

    while (actions < 1100 && guard < 6000) {
      guard += 1;
      if (state.status !== STATUS.PLAYING) {
        state = createState(level);
        continue;
      }
      const legal = state.screws.filter(
        (screw) => screw.state === 'board' && canUnscrew(state, screw.id),
      );
      if (!legal.length) {
        state = createState(level);
        continue;
      }
      const pick = legal[Math.floor(rng() * legal.length)];
      const result = unscrew(state, pick.id);
      assert.ok(result.action, `legal move rejected: level ${level.id} screw ${pick.id}`);
      state = result.state;
      actions += 1;

      assert.equal(state.screws.length, totalScrews, 'screw total must be conserved');
      assert.ok(state.buffer.length <= state.bufferCapacity, 'buffer must not exceed capacity without magnet');
      assert.ok(state.boxes.every((box) => box.collected >= 0 && box.collected <= 3));
      assert.ok(Object.values(STATUS).includes(state.status));
      assert.ok(state.activeBox >= 0 && state.activeBox <= state.boxes.length);
      for (const bufferedId of state.buffer) {
        const screw = state.screws.find((item) => item.id === bufferedId);
        assert.equal(screw.state, 'buffer');
      }
      const board = state.screws.filter((screw) => screw.state === 'board').length;
      const boxed = state.screws.filter((screw) => screw.state === 'boxed').length;
      assert.equal(board + boxed + state.buffer.length, totalScrews);
    }

    assert.ok(actions >= 1000, `level ${level.id} only completed ${actions} random actions`);
  }
});

test('engine: listAccessibleScrews never returns covered or removed screws', () => {
  let state = createState(testLevel());
  const accessible = listAccessibleScrews(state).map((screw) => screw.id);
  assert.ok(!accessible.includes('bottom-0'));
  state = unscrew(state, 'top-0').state;
  const accessible2 = listAccessibleScrews(state).map((screw) => screw.id);
  assert.ok(accessible2.includes('bottom-0'));
});
