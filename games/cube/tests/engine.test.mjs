import test from "node:test";
import assert from "node:assert/strict";

import {
  applyMove,
  applyMoves,
  createSolved,
  dailySeed,
  generateScramble,
  invertMove,
  isSolved,
  legalMoves,
  misplacedStickers,
  moveToText,
  movesFromText,
  movesToText,
  mulberry32,
  parseMove,
  rotationMatrix,
  scrambleText,
  stateKey,
  stickerTotal,
  suggestMove,
} from "../js/engine.mjs";

function isSignedPermutation(matrix) {
  for (let row = 0; row < 3; row += 1) {
    const values = matrix.slice(row * 3, row * 3 + 3);
    assert.equal(values.filter((value) => value !== 0).length, 1);
    assert.ok(values.every((value) => Math.abs(value) === 1 || value === 0));
  }
  return true;
}

test("solved cubes expose the right sticker counts", () => {
  for (const size of [2, 3]) {
    const cube = createSolved(size);
    assert.ok(isSolved(cube));
    assert.equal(cube.cubies.length, size ** 3);
    assert.equal(
      cube.cubies.reduce((sum, cubie) => sum + cubie.c.filter((value) => value >= 0).length, 0),
      stickerTotal(size),
    );
    assert.equal(stickerTotal(size), size * size * 6);
  }
});

test("every legal move has an exact inverse", () => {
  for (const size of [2, 3]) {
    for (const move of legalMoves()) {
      const scrambled = applyMove(createSolved(size), move);
      assert.equal(isSolved(scrambled), false);
      const back = applyMove(scrambled, invertMove(move));
      assert.ok(isSolved(back));
      assert.equal(misplacedStickers(back), 0);
    }
  }
});

test("four quarter turns of one face return to solved", () => {
  for (const face of ["U", "D", "F", "B", "R", "L"]) {
    let cube = createSolved(3);
    for (let i = 0; i < 4; i += 1) cube = applyMove(cube, { face, amount: 1 });
    assert.ok(isSolved(cube), `${face} x4 should solve`);
  }
});

test("180-degree rotation matrices are axis-correct signed permutations", () => {
  for (const axis of [0, 1, 2]) {
    const matrix = rotationMatrix(axis, 2);
    isSignedPermutation(matrix);
    const again = applyMove(applyMove(createSolved(3), { face: "R", amount: 2 }), { face: "R", amount: 2 });
    assert.ok(isSolved(again));
  }
});

test("notation parsing and formatting round-trip", () => {
  const moves = movesFromText("R U2 F' L D2 B");
  assert.deepEqual(moves, [
    { face: "R", amount: 1 },
    { face: "U", amount: 2 },
    { face: "F", amount: 3 },
    { face: "L", amount: 1 },
    { face: "D", amount: 2 },
    { face: "B", amount: 1 },
  ]);
  assert.equal(movesToText(moves), "R U2 F' L D2 B");
  assert.equal(scrambleText(moves), "R U2 F' L D2 B");
  assert.deepEqual(parseMove("r"), { face: "R", amount: 1 });
  assert.equal(parseMove("X"), null);
  assert.equal(parseMove("R3"), null);
  assert.equal(moveToText({ face: "B", amount: 3 }), "B'");
});

test("scramble generation is deterministic and avoids face repetition", () => {
  const first = generateScramble(3, 20, mulberry32(2026));
  const second = generateScramble(3, 20, mulberry32(2026));
  assert.equal(movesToText(first), movesToText(second));
  assert.equal(first.length, 20);

  for (let round = 0; round < 60; round += 1) {
    const moves = generateScramble(3, 22, mulberry32(round + 1));
    for (let i = 1; i < moves.length; i += 1) {
      assert.notEqual(moves[i].face, moves[i - 1].face, "same face twice in a row");
    }
  }
});

test("daily seed is stable for a given date key", () => {
  assert.equal(dailySeed("20261110"), dailySeed("20261110"));
  assert.notEqual(dailySeed("20261110"), dailySeed("20261111"));
  assert.ok(Number.isInteger(dailySeed()) && dailySeed() >= 0);
});

test("1000-step seeded random walk keeps every invariant", () => {
  const rng = mulberry32(0xc0ffee);
  let cube = createSolved(3);
  const applied = [];
  const moves = legalMoves();

  for (let step = 0; step < 1000; step += 1) {
    const move = moves[Math.floor(rng() * moves.length)];
    cube = applyMove(cube, move);
    applied.push(move);

    assert.equal(cube.cubies.length, 27);
    assert.equal(
      cube.cubies.reduce((sum, cubie) => sum + cubie.c.filter((value) => value >= 0).length, 0),
      54,
    );
    for (const cubie of cube.cubies) {
      assert.ok(cubie.p.every((value) => value >= 0 && value < 3));
      isSignedPermutation(cubie.m);
    }
  }

  const rewind = applied.slice().reverse().map(invertMove);
  assert.ok(isSolved(applyMoves(cube, rewind)));
  assert.ok(stateKey(cube).length > 0);
});

test("hint solves one-move-away positions and never returns an illegal move", () => {
  for (const move of legalMoves()) {
    const state = applyMove(createSolved(3), invertMove(move));
    const hint = suggestMove(state);
    assert.ok(hint);
    assert.ok(hint.score <= misplacedStickers(state));
    assert.ok(isSolved(applyMove(state, hint.move)), `${moveToText(move)} hint should solve`);
  }
  assert.equal(suggestMove(createSolved(2)), null);
});

test("misplaced sticker count is zero only when solved", () => {
  assert.equal(misplacedStickers(createSolved(2)), 0);
  assert.equal(misplacedStickers(createSolved(3)), 0);
  const scrambled = applyMoves(createSolved(3), movesFromText("R U R' U'"));
  assert.ok(misplacedStickers(scrambled) > 0);
  assert.equal(isSolved(scrambled), false);
});
