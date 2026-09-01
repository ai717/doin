import assert from "node:assert/strict";
import test from "node:test";

import {
  canExtract,
  canInsert,
  canSelectDock,
  clearDockSelection,
  createState,
  extractOrb,
  applyAction,
  applyIntent,
  evaluateState,
  insertOrb,
  isSolved,
  isStuck,
  isTrackComplete,
  reset,
  selectDock,
  undo,
} from "../engine.mjs";

function state(config) {
  return createState({ levelId: "test", capacity: 2, dockCount: 1, ...config });
}

function orbIds(game) {
  return [
    ...game.tracks.flatMap((track) => track.orbs.map((orb) => orb.id)),
    ...game.docks.flatMap((dock) => (dock.orb ? [dock.orb.id] : [])),
  ].sort();
}

test("only an unlocked track mouth can be extracted", () => {
  const game = state({ tracks: [[0, 1], []] });
  assert.equal(canExtract(game, 0), true);
  assert.equal(canExtract(game, 1), false);
  assert.equal(extractOrb(game, 0).tracks[0].orbs.at(-1).color, 0);
});

test("the level-two sequence rejects an off-color landing", () => {
  let game = createState({
    levelId: 2,
    capacity: 3,
    dockCount: 1,
    tracks: [[1, 1, 0], [0, 2, 2], [0, 2, 1], []],
  });
  game = insertOrb(extractOrb(game, 0), 0, 3);
  game = insertOrb(extractOrb(game, 2), 0, 0);
  game = extractOrb(game, 2);
  const before = game;
  const after = insertOrb(game, game.selectedDockId, 3);
  assert.equal(after, before);
  assert.deepEqual(after.tracks[3].orbs.map((orb) => orb.color), [0]);
  assert.equal(after.docks[0].orb.color, 2);
});

test("a same-color transfer into the left track is not reported as stuck", () => {
  let game = createState({
    levelId: "screenshot-state",
    capacity: 3,
    dockCount: 1,
    tracks: [[1, 1, 0], [0, 2], [0, 2, 1], [2]],
  });
  game = extractOrb(game, 1);
  assert.equal(game.status, "playing");
  assert.equal(canInsert(game, game.selectedDockId, 3), true);
  game = insertOrb(game, game.selectedDockId, 3);
  assert.equal(game.status, "playing");
  assert.deepEqual(game.tracks[3].orbs.map((orb) => orb.color), [2, 2]);
});

test("stuck status cannot hide a legal extraction or same-color landing", () => {
  const game = createState({
    levelId: "stale-status-state",
    capacity: 3,
    dockCount: 1,
    tracks: [[1, 1, 0], [0, 2], [0, 2, 1], [2]],
  });
  assert.equal(isStuck({ ...game, status: "stuck" }), false);
});

test("a stale stuck status still permits a legal landing", () => {
  const initial = createState({
    levelId: "stale-landing-state",
    capacity: 3,
    dockCount: 1,
    tracks: [[1, 1, 0], [0, 2], [0, 2, 1], [2]],
  });
  const extracted = extractOrb(initial, 1);
  const stale = { ...extracted, status: "stuck" };
  assert.equal(canSelectDock(stale, stale.selectedDockId), true);
  assert.equal(canInsert(stale, stale.selectedDockId, 3), true);
  const inserted = insertOrb(stale, stale.selectedDockId, 3);
  assert.deepEqual(inserted.tracks[3].orbs.map((orb) => orb.color), [2, 2]);
});

test("the unified rule authority returns reasons and executes every legal action", () => {
  const initial = state({ tracks: [[0], [1], []] });
  const extracted = applyAction(initial, { type: "extract", trackId: 0 });
  assert.equal(extracted.valid, true);
  const inserted = applyAction(extracted.state, { type: "insert", dockId: 0, trackId: 2 });
  assert.equal(inserted.valid, true);
  const rejected = applyAction(initial, { type: "insert", dockId: 0, trackId: 1 });
  assert.equal(rejected.valid, false);
  assert.equal(rejected.reason, "empty-dock");
  assert.equal(evaluateState(inserted.state).status, "playing");
});

test("intents resolve track and dock clicks through the engine", () => {
  const initial = createState({ capacity: 2, dockCount: 2, tracks: [[0], [1], []] });
  const first = applyIntent(initial, { target: "track", id: 0 });
  assert.equal(first.action.type, "extract");
  const second = applyIntent(first.state, { target: "dock", id: 1 });
  assert.equal(second.action.type, "clear-selection");
  const third = applyIntent(second.state, { target: "track", id: 1 });
  assert.equal(third.action.type, "extract");
  assert.equal(third.valid, true);
});

test("a red entrance cannot land on a green entrance", () => {
  const game = createState({
    levelId: "off-color-state",
    capacity: 3,
    dockCount: 1,
    tracks: [[1, 1, 0], [0, 2, 0], [0, 2, 1], [2]],
  });
  const withRed = extractOrb(game, 1);
  assert.equal(withRed.docks[0].orb.color, 0);
  assert.equal(canInsert(withRed, 0, 3), false);
  assert.equal(insertOrb(withRed, 0, 3), withRed);
});

test("a full core cannot accept another extraction", () => {
  const game = extractOrb(state({ tracks: [[0], [1]] }), 0);
  assert.equal(canExtract(game, 1), false);
  assert.equal(game.moves, 1);
});

test("empty and same-color tracks accept an orb, but different colors and full tracks do not", () => {
  const game = extractOrb(state({ tracks: [[0], [0], [1, 1]] }), 0);
  assert.equal(canInsert(game, 0, 1), true);
  assert.equal(canInsert(game, 0, 2), false);
  assert.equal(canInsert(game, 0, 0), true);
  const inserted = insertOrb(game, 0, 1);
  assert.equal(inserted.tracks[1].orbs.length, 2);
  assert.equal(inserted.tracks[1].orbs.at(-1).color, 0);
});

test("extract increments moves and insert does not", () => {
  const before = state({ tracks: [[0], []] });
  const extracted = extractOrb(before, 0);
  const inserted = insertOrb(extracted, 0, 1);
  assert.equal(extracted.moves, 1);
  assert.equal(inserted.moves, 1);
});

test("a completed track is locked and solved state requires empty docks", () => {
  const game = insertOrb(extractOrb(state({ tracks: [[0], []] }), 0), 0, 1);
  assert.equal(isTrackComplete(game.tracks[1], 2), false);
  assert.equal(game.tracks[1].completed, false);
  assert.equal(isSolved(game), false);

  const solved = insertOrb(
    extractOrb(state({ tracks: [[0], [0]], dockCount: 1 }), 0),
    0,
    1,
  );
  assert.equal(solved.tracks[1].completed, true);
  assert.equal(isSolved(solved), true);
  assert.equal(canExtract(solved, 1), false);
});

test("frozen tracks unlock when their bound color completes", () => {
  const game = state({
    tracks: [
      [1, 0],
      [0],
      { orbs: [1, 1], mode: "frozen", frozenUntilColor: 0 },
    ],
  });
  const afterExtract = extractOrb(game, 0);
  const afterInsert = insertOrb(afterExtract, 0, 1);
  assert.equal(afterInsert.tracks[1].completed, true);
  assert.equal(afterInsert.tracks[2].mode, "normal");
  assert.equal(canExtract(afterInsert, 2), true);
});

test("undo restores a frozen track after its binding color had completed", () => {
  const initial = state({
    tracks: [
      [1, 0],
      [0],
      { orbs: [1, 1], mode: "frozen", frozenUntilColor: 0 },
    ],
  });
  const completed = insertOrb(extractOrb(initial, 0), 0, 1);
  const restored = undo(completed);
  assert.equal(restored.tracks[2].mode, "frozen");
  assert.equal(restored.tracks[2].frozenUntilColor, 0);
  assert.equal(restored.moves, 0);
});

test("one-way tracks enforce their direction", () => {
  const game = state({
    tracks: [
      { orbs: [0], mode: "in-only" },
      { orbs: [], mode: "out-only" },
    ],
  });
  assert.equal(canExtract(game, 0), false);
  assert.equal(canInsert(game, 0, 0), false);
  assert.equal(canExtract(game, 1), false);
  const extracted = extractOrb(game, 0);
  assert.equal(extracted, game);
});

test("selecting a dock is free and insert selects the remaining orb", () => {
  const game = createState({ capacity: 2, dockCount: 2, tracks: [[0], [1], []] });
  const first = extractOrb(game, 0);
  const second = extractOrb(first, 1);
  assert.equal(second.selectedDockId, 1);
  assert.equal(canSelectDock(second, 0), true);
  assert.equal(selectDock(second, 0).selectedDockId, 0);
  const afterInsert = insertOrb(second, 1, 2);
  assert.equal(afterInsert.selectedDockId, 0);
  assert.equal(afterInsert.moves, 2);
});

test("empty dock can clear placement selection before filling another dock", () => {
  const game = createState({ capacity: 2, dockCount: 2, tracks: [[0, 1], [1, 0], []] });
  const extracted = extractOrb(game, 0);
  assert.equal(extracted.selectedDockId, 0);
  const readyToExtract = clearDockSelection(extracted);
  assert.equal(readyToExtract.selectedDockId, null);
  assert.equal(canExtract(readyToExtract, 1), true);
  assert.equal(clearDockSelection(game), game);
});

test("undo restores the complete state before the last extraction", () => {
  const initial = state({ tracks: [[0, 1], []] });
  const extracted = extractOrb(initial, 0);
  const inserted = insertOrb(extracted, 0, 1);
  const restored = undo(inserted);
  assert.deepEqual(restored.tracks, initial.tracks);
  assert.deepEqual(restored.docks, initial.docks);
  assert.equal(restored.selectedDockId, initial.selectedDockId);
  assert.equal(restored.moves, 0);
  assert.equal(restored.history.length, 0);
});

test("stuck is reported only when neither extraction nor insertion is legal", () => {
  const playable = extractOrb(state({ tracks: [[0, 0], [1, 1]] }), 0);
  assert.equal(isStuck(playable), false);

  const stuck = extractOrb(
    state({ tracks: [{ orbs: [0, 1], mode: "out-only" }, [2]] }),
    0,
  );
  assert.equal(isStuck(stuck), true);
  assert.equal(stuck.status, "stuck");
});

test("reset returns a fresh initial state and does not mutate its source", () => {
  const initial = state({ tracks: [[0, 1], []] });
  const current = insertOrb(extractOrb(initial, 0), 0, 1);
  const resetState = reset(current, initial);
  assert.deepEqual(resetState.tracks, initial.tracks);
  assert.equal(resetState.moves, 0);
  assert.equal(resetState.history.length, 0);
  assert.equal(current.moves, 1);
});

test("orb ids remain unique and unchanged across an extraction and insertion", () => {
  const initial = state({ tracks: [[0, 1], [1], []], dockCount: 2 });
  const afterExtract = extractOrb(initial, 0);
  const afterInsert = insertOrb(afterExtract, 0, 2);
  assert.deepEqual(orbIds(afterExtract), orbIds(initial));
  assert.deepEqual(orbIds(afterInsert), orbIds(initial));
  assert.equal(new Set(orbIds(afterInsert)).size, orbIds(afterInsert).length);
});

test("state transitions do not mutate their input", () => {
  const initial = state({ tracks: [[0, 1], []] });
  const original = structuredClone(initial);
  const extracted = extractOrb(initial, 0);
  const inserted = insertOrb(extracted, 0, 1);
  assert.deepEqual(initial, original);
  assert.equal(extracted.tracks[0].orbs.length, 1);
  assert.equal(inserted.tracks[1].orbs.length, 1);
});
