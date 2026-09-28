import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SpiderEngine,
  generateDeck,
  mulberry32,
  createCard
} from '../js/engine.mjs';

test('SpiderEngine: Deck generation for 1, 2, 3, 4 suits', () => {
  for (const suits of [1, 2, 3, 4]) {
    const deck = generateDeck(suits);
    assert.equal(deck.length, 104, `Deck for ${suits} suits must contain exactly 104 cards`);
  }

  // 2-suit: 52 spades, 52 hearts
  const deck2 = generateDeck(2);
  const spades2 = deck2.filter((c) => c.suit === 'spades').length;
  const hearts2 = deck2.filter((c) => c.suit === 'hearts').length;
  assert.equal(spades2, 52);
  assert.equal(hearts2, 52);

  // 4-suit: 26 of each suit
  const deck4 = generateDeck(4);
  assert.equal(deck4.filter((c) => c.suit === 'spades').length, 26);
  assert.equal(deck4.filter((c) => c.suit === 'hearts').length, 26);
  assert.equal(deck4.filter((c) => c.suit === 'clubs').length, 26);
  assert.equal(deck4.filter((c) => c.suit === 'diamonds').length, 26);
});

test('SpiderEngine: Deterministic PRNG mulberry32', () => {
  const engineA = new SpiderEngine({ seed: 42, suitCount: 2 });
  const engineB = new SpiderEngine({ seed: 42, suitCount: 2 });

  for (let c = 0; c < 10; c++) {
    assert.equal(engineA.columns[c].length, engineB.columns[c].length);
    for (let i = 0; i < engineA.columns[c].length; i++) {
      assert.equal(engineA.columns[c][i].id, engineB.columns[c][i].id);
      assert.equal(engineA.columns[c][i].faceUp, engineB.columns[c][i].faceUp);
    }
  }
});

test('SpiderEngine: Initial deal distribution and invariants', () => {
  const engine = new SpiderEngine({ seed: 999, suitCount: 2 });

  // Columns 0-3: 6 cards each; 4-9: 5 cards each
  for (let c = 0; c < 4; c++) {
    assert.equal(engine.columns[c].length, 6);
    // First 5 cards face-down, 6th face-up
    for (let i = 0; i < 5; i++) assert.equal(engine.columns[c][i].faceUp, false);
    assert.equal(engine.columns[c][5].faceUp, true);
  }
  for (let c = 4; c < 10; c++) {
    assert.equal(engine.columns[c].length, 5);
    for (let i = 0; i < 4; i++) assert.equal(engine.columns[c][i].faceUp, false);
    assert.equal(engine.columns[c][4].faceUp, true);
  }

  // Stock has 50 cards
  assert.equal(engine.stock.length, 50);
  assert.equal(engine.remainingStockDeals, 5);
  assert.equal(engine.completedRuns.length, 0);
  assert.equal(engine.isWon, false);
});

test('SpiderEngine: Sequence movability and legal destination logic', () => {
  const engine = new SpiderEngine({ seed: 12345, suitCount: 2 });

  // Custom set up columns to test rules precisely
  engine.columns[0] = [
    createCard('spades', 8, 'c1', true),
    createCard('spades', 7, 'c2', true),
    createCard('spades', 6, 'c3', true)
  ];
  engine.columns[1] = [createCard('hearts', 9, 'c4', true)];
  engine.columns[2] = [createCard('spades', 9, 'c5', true)];
  engine.columns[3] = []; // Empty column

  // Entire sequence [8, 7, 6] can move to hearts 9 (cross-suit)
  assert.equal(engine.canMove(0, 0, 1), true);

  // Entire sequence can move to spades 9 (same-suit)
  assert.equal(engine.canMove(0, 0, 2), true);

  // Entire sequence can move to empty column
  assert.equal(engine.canMove(0, 0, 3), true);

  // Partial sequence [7, 6] can move to 8
  engine.columns[4] = [createCard('clubs', 8, 'c6', true)];
  assert.equal(engine.canMove(0, 1, 4), true);

  // Cannot move onto incompatible rank
  engine.columns[5] = [createCard('spades', 5, 'c7', true)];
  assert.equal(engine.canMove(0, 0, 5), false);
});

test('SpiderEngine: Move execution and card uncovering', () => {
  const engine = new SpiderEngine({ seed: 12345, suitCount: 2 });
  engine.columns[0] = [
    createCard('spades', 10, 'c_hidden', false),
    createCard('spades', 5, 'c_top', true)
  ];
  engine.columns[1] = [createCard('hearts', 6, 'c_dest', true)];

  const res = engine.move(0, 1, 1);
  assert.equal(res.success, true);
  assert.equal(engine.columns[1].length, 2);
  assert.equal(engine.columns[0].length, 1);
  // Hidden card should have flipped face-up
  assert.equal(engine.columns[0][0].faceUp, true);
  assert.equal(res.flippedCard.id, 'c_hidden');
});

test('SpiderEngine: Complete 13-card run clearing', () => {
  const engine = new SpiderEngine({ seed: 12345, suitCount: 2 });
  engine.columns[0] = [createCard('hearts', 2, 'base', false)];

  // Add K down to 2
  for (let r = 13; r >= 2; r--) {
    engine.columns[0].push(createCard('spades', r, `s_${r}`, true));
  }

  // Column 1 has the Ace
  engine.columns[1] = [createCard('spades', 1, 's_1', true)];

  // Move Ace to column 0 to complete the 13-card sequence
  const res = engine.move(1, 0, 0);
  assert.equal(res.success, true);

  // 13 cards cleared!
  assert.equal(engine.completedRuns.length, 1);
  assert.equal(res.clearedRuns.length, 1);
  assert.equal(res.clearedRuns[0].suit, 'spades');
  assert.equal(res.clearedRuns[0].cards.length, 13);

  // Remaining base card was flipped
  assert.equal(engine.columns[0].length, 1);
  assert.equal(engine.columns[0][0].faceUp, true);
});

test('SpiderEngine: Stock deal and undo functionality', () => {
  const engine = new SpiderEngine({ seed: 777, suitCount: 2 });
  const initialStock = engine.stock.length;
  const initialColLens = engine.columns.map((c) => c.length);

  const res = engine.dealStock();
  assert.equal(res.success, true);
  assert.equal(engine.stock.length, initialStock - 10);
  for (let c = 0; c < 10; c++) {
    assert.equal(engine.columns[c].length, initialColLens[c] + 1);
  }

  // Undo deal
  const undoRes = engine.undo();
  assert.equal(undoRes, true);
  assert.equal(engine.stock.length, initialStock);
  for (let c = 0; c < 10; c++) {
    assert.equal(engine.columns[c].length, initialColLens[c]);
  }
});

test('SpiderEngine: 1000-step random walk test', () => {
  const engine = new SpiderEngine({ seed: 998877, suitCount: 2 });
  const prng = mulberry32(1234567);

  let steps = 0;
  for (let step = 0; step < 1000; step++) {
    if (engine.isWon) break;

    // Collect all legal moves
    const legalMoves = [];
    for (let from = 0; from < 10; from++) {
      const indices = engine.getMovableIndices(from);
      for (const idx of indices) {
        for (let to = 0; to < 10; to++) {
          if (engine.canMove(from, idx, to)) {
            legalMoves.push({ from, idx, to });
          }
        }
      }
    }

    if (legalMoves.length > 0 && (prng() > 0.1 || engine.stock.length < 10)) {
      const choice = legalMoves[Math.floor(prng() * legalMoves.length)];
      const res = engine.move(choice.from, choice.idx, choice.to);
      assert.equal(res.success, true);
      steps++;
    } else if (engine.stock.length >= 10) {
      const res = engine.dealStock();
      assert.equal(res.success, true);
      steps++;
    } else if (engine.history.length > 0) {
      assert.equal(engine.undo(), true);
      steps++;
    } else {
      break;
    }

    // Invariant check: total cards across columns + stock + completed runs must equal 104
    let totalCards = engine.stock.length + engine.completedRuns.length * 13;
    for (let c = 0; c < 10; c++) {
      totalCards += engine.columns[c].length;
    }
    assert.equal(totalCards, 104, `Card count must remain exactly 104 at step ${step}`);
  }

  assert.ok(steps > 0);
});
