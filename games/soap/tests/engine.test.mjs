import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame, applyStroke, remainingRatio, shapeRatio, hasCore,
  isComplete, finishCleanup, mulberry32, defaultSeed, CORE_EXPOSE_DEPTH,
} from "../js/engine.mjs";
import { SOAP_IDS, GRID_W, GRID_H, TOOLS } from "../js/soaps.mjs";

const stroke = (x0, y0, x1, y1, tool = "tool_knife", speed = 300) => ({
  from: { x: x0, y: y0 }, to: { x: x1, y: y1 }, tool, speed,
});

test("all 12 soaps create a full grid with deterministic seeds", () => {
  for (const id of SOAP_IDS) {
    const a = createGame(id, 12345);
    const b = createGame(id, 12345);
    assert.equal(a.cells.length, GRID_W * GRID_H);
    assert.equal(a.totalDepth, GRID_W * GRID_H * a.layers);
    assert.deepEqual(a.cells, b.cells);
    assert.deepEqual(a.core, b.core);
    assert.equal(a.seed, 12345);
    assert.equal(defaultSeed(id) >>> 0, defaultSeed(id) >>> 0);
  }
});

test("core soaps have a detectable pattern, classic soaps have none", () => {
  const shape = createGame("soap_shape_star", 1);
  assert.equal(hasCore(shape), true);
  assert.ok(shape.core.filter(Boolean).length > 10);
  const classic = createGame("soap_classic_white", 1);
  assert.equal(hasCore(classic), false);
  assert.equal(shapeRatio(classic), 1);
});

test("a stroke removes depth only along its path", () => {
  let state = createGame("soap_classic_white", 7);
  const result = applyStroke(state, stroke(1, 3, 8, 3, "tool_knife", 300));
  assert.equal(result.changed === undefined, true);
  assert.ok(result.state.removedDepth > 0);
  assert.ok(result.state.cells[3 * GRID_W + 4] < state.layers);
  assert.equal(result.state.cells[0 * GRID_W + 4], state.layers);
  assert.ok(result.events.some((event) => event.type === "cut"));
  assert.equal(state.cells[3 * GRID_W + 4], 5, "input state must not be mutated");
});

test("same seed + same strokes produce identical boards (replay determinism)", () => {
  const moves = [
    stroke(0.5, 1, 9, 1, "tool_knife", 220),
    stroke(9, 2, 1, 3, "tool_scraper", 440),
    stroke(2, 5, 8, 6, "tool_peeler", 180),
    stroke(4, 0, 4, 6, "tool_knife", 900),
  ];
  let a = createGame("soap_shape_heart", 0xc0ffee);
  let b = createGame("soap_shape_heart", 0xc0ffee);
  for (const move of moves) {
    a = applyStroke(a, move).state;
    b = applyStroke(b, move).state;
  }
  assert.deepEqual(a.cells, b.cells);
  assert.equal(a.removedDepth, b.removedDepth);
  assert.equal(a.rngState, b.rngState);
});

test("different tools cut different widths and depths", () => {
  const base = createGame("soap_classic_white", 99);
  const narrow = applyStroke(base, stroke(0, 3, 9, 3, "tool_knife", 300)).state;
  const wide = applyStroke(base, stroke(0, 3, 9, 3, "tool_scraper", 300)).state;
  assert.ok(wide.removedDepth > narrow.removedDepth);
  assert.ok(TOOLS.tool_scraper.width > TOOLS.tool_knife.width);
});

test("core reveal fires exactly once and progress rises", () => {
  let state = createGame("soap_shape_flower", 31415);
  let reveals = 0;
  for (let pass = 0; pass < 24; pass += 1) {
    for (let y = 0; y < GRID_H; y += 1) {
      const result = applyStroke(state, stroke(-1, y, GRID_W, y, "tool_scraper", 350));
      state = result.state;
      reveals += result.events.filter((event) => event.type === "core").length;
      if (state.complete) break;
    }
    if (state.complete) break;
  }
  assert.ok(reveals >= 1);
  assert.ok(reveals <= 1, "core reveal should fire once");
  assert.ok(shapeRatio(state) > 0.5);
  assert.ok(remainingRatio(state) < 0.5);
});

test("completion is no-op afterwards and cleanup can sweep the last crumbs", () => {
  let state = createGame("soap_classic_blue", 6);
  for (let pass = 0; pass < 30 && !state.complete; pass += 1) {
    for (let y = -1; y <= GRID_H; y += 1) {
      state = applyStroke(state, stroke(-1, y, GRID_W, y, "tool_scraper", 350)).state;
    }
  }
  assert.equal(state.complete, true);
  assert.equal(state.won, true);
  assert.ok(remainingRatio(state) <= 0.05);
  const after = applyStroke(state, stroke(0, 0, 9, 6, "tool_knife", 300));
  assert.equal(after.state, state);
  assert.equal(after.events.length, 0);
  assert.equal(finishCleanup(state).events.length, 0);
});

test("cleanup is rejected while a lot of soap remains", () => {
  const state = createGame("soap_classic_mint", 1);
  const result = finishCleanup(state);
  assert.equal(result.state, state);
  assert.equal(result.events.length, 0);
});

test("blade outside the bar cuts nothing but never throws", () => {
  const state = createGame("soap_classic_white", 1);
  const result = applyStroke(state, stroke(-9, -9, -8, -8, "tool_knife", 300));
  assert.equal(result.state.removedDepth, state.removedDepth);
  assert.equal(result.state.strokes, state.strokes + 1);
});

test("1000-step random walk: no throw, no negative depth, monotone removal, stable invariants", () => {
  const random = mulberry32(20261124);
  let state = createGame("soap_shape_paw", 777);
  const toolIds = Object.keys(TOOLS);
  for (let i = 0; i < 1000; i += 1) {
    const x0 = random() * (GRID_W + 2) - 1;
    const y0 = random() * (GRID_H + 2) - 1;
    const x1 = random() * (GRID_W + 2) - 1;
    const y1 = random() * (GRID_H + 2) - 1;
    const tool = toolIds[Math.floor(random() * toolIds.length)];
    const speed = random() * 2600;
    const before = state.removedDepth;
    const result = applyStroke(state, stroke(x0, y0, x1, y1, tool, speed));
    state = result.state;
    assert.ok(state.removedDepth >= before - 1e-9, "removed depth must never decrease");
    assert.ok(remainingRatio(state) >= 0 && remainingRatio(state) <= 1);
    assert.ok(state.cells.every((depth) => depth >= 0 && depth <= state.layers));
    assert.equal(state.cells.length, GRID_W * GRID_H);
    assert.ok(Number.isFinite(state.rngState));
    if (state.complete) break;
  }
});

test("core expose threshold is shallow but nonzero", () => {
  assert.equal(CORE_EXPOSE_DEPTH, 1);
  assert.equal(isComplete(createGame("soap_classic_white", 1)), false);
});
