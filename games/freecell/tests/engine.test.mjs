import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dealMicrosoftBoard,
  createCard,
  canMoveToFoundation,
  canMoveToCascade,
  isValidCascadeSequence,
  getMaxMovableCards,
  FreeCellEngine
} from '../js/engine.mjs';

test('PRNG Determinism: Deal #11982 layout verification', () => {
  const cascades = dealMicrosoftBoard(11982);
  assert.equal(cascades.length, 8);
  
  const totalCards = cascades.reduce((acc, col) => acc + col.length, 0);
  assert.equal(totalCards, 52);

  for (let c = 0; c < 4; c++) {
    assert.equal(cascades[c].length, 7);
  }
  for (let c = 4; c < 8; c++) {
    assert.equal(cascades[c].length, 6);
  }

  const cascadesRepeat = dealMicrosoftBoard(11982);
  assert.deepEqual(cascades, cascadesRepeat);
});

test('Foundation Rules: Ace first, then same suit ascending', () => {
  const aceHearts = createCard('hearts', 1);
  const twoHearts = createCard('hearts', 2);
  const twoSpades = createCard('spades', 2);
  const kingHearts = createCard('hearts', 13);

  assert.equal(canMoveToFoundation(aceHearts, null), true);
  assert.equal(canMoveToFoundation(twoHearts, null), false);
  assert.equal(canMoveToFoundation(twoHearts, aceHearts), true);
  assert.equal(canMoveToFoundation(twoSpades, aceHearts), false);
  assert.equal(canMoveToFoundation(kingHearts, twoHearts), false);
});

test('Cascade Rules: Alternating color, descending ranks', () => {
  const red9 = createCard('hearts', 9);
  const black10 = createCard('spades', 10);
  const red10 = createCard('diamonds', 10);
  const black8 = createCard('clubs', 8);

  assert.equal(canMoveToCascade(red9, black10), true);
  assert.equal(canMoveToCascade(red9, red10), false);
  assert.equal(canMoveToCascade(red9, null), true);
  assert.equal(canMoveToCascade(black8, black10), false);
});

test('Sequence Validity and Movable Count formula', () => {
  const validSeq = [
    createCard('spades', 8),
    createCard('hearts', 7),
    createCard('clubs', 6)
  ];
  const invalidSeq = [
    createCard('spades', 8),
    createCard('clubs', 7)
  ];

  assert.equal(isValidCascadeSequence(validSeq), true);
  assert.equal(isValidCascadeSequence(invalidSeq), false);

  assert.equal(getMaxMovableCards(4, 0, false), 5);
  assert.equal(getMaxMovableCards(4, 1, false), 10);
  assert.equal(getMaxMovableCards(4, 1, true), 5);
});

test('Engine Move & Undo Integrity', () => {
  const engine = new FreeCellEngine(11982);
  assert.equal(engine.movesCount, 0);

  const cardFromCascade = engine.cascades[0][engine.cascades[0].length - 1];
  const movedToCell = engine.moveCards({
    from: { type: 'cascade', index: 0 },
    to: { type: 'cell', index: 0 },
    count: 1
  });

  assert.equal(movedToCell, true);
  assert.equal(engine.movesCount, 1);
  assert.deepEqual(engine.cells[0], cardFromCascade);
  assert.equal(engine.cascades[0].length, 6);

  const undone = engine.undo();
  assert.equal(undone, true);
  assert.equal(engine.cells[0], null);
  assert.equal(engine.cascades[0].length, 7);
  assert.deepEqual(engine.cascades[0][6], cardFromCascade);

  const invalidMove = engine.moveCards({
    from: { type: 'cell', index: 3 },
    to: { type: 'foundation', index: 0 }
  });
  assert.equal(invalidMove, false);
});

test('Victory Check', () => {
  const engine = new FreeCellEngine(11982);
  assert.equal(engine.isWon, false);

  for (let s = 0; s < 4; s++) {
    for (let r = 1; r <= 13; r++) {
      engine.foundations[s].push(createCard(['spades', 'hearts', 'diamonds', 'clubs'][s], r));
    }
  }

  assert.equal(engine.checkVictory(), true);
  assert.equal(engine.isWon, true);
});
