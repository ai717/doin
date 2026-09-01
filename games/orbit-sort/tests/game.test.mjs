import assert from "node:assert/strict";
import test from "node:test";

import { createGame } from "../js/game.mjs";

const level = {
  id: "controller-test",
  capacity: 2,
  dockCount: 2,
  tracks: [[0], [1], []],
  modifiers: [],
  par: 2,
};

test("game controller dispatches intents and supports two buffered planets", () => {
  const game = createGame(level);
  const first = game.dispatch({ target: "track", id: 0 });
  assert.equal(first.valid, true);
  const clear = game.dispatch({ target: "dock", id: 1 });
  assert.equal(clear.action.type, "clear-selection");
  const second = game.dispatch({ target: "track", id: 1 });
  assert.equal(second.valid, true);
  assert.deepEqual(game.state.docks.map((dock) => dock.orb?.color ?? null), [0, 1]);
});

test("controller preserves a real deadlock while clearing only stale stuck state", () => {
  const game = createGame({ ...level, tracks: [{ orbs: [0, 1], mode: "out-only" }, [1], []] });
  assert.equal(game.state.status, "playing");
  game.setState({ ...game.state, status: "stuck" });
  assert.equal(game.state.status, "playing");
  game.setState({
    ...game.state,
    status: "stuck",
    tracks: game.state.tracks.map((track) => ({ ...track, mode: "in-only" })),
    docks: game.state.docks.map((dock) => ({ ...dock, orb: null })),
  });
  assert.equal(game.state.status, "stuck");
});

test("controller accumulates hint usage and keeps it through later dispatches", () => {
  const game = createGame(level);
  assert.equal(game.state.hintsUsed, 0);

  const afterHint = game.useHint();
  assert.equal(afterHint.hintsUsed, 1);
  assert.equal(afterHint, game.state);

  game.dispatch({ target: "track", id: 0 });
  assert.equal(game.state.hintsUsed, 1, "hint usage must survive a dispatch");

  game.useHint();
  assert.equal(game.state.hintsUsed, 2);
});
