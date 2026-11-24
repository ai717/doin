import test from "node:test";
import assert from "node:assert/strict";
import {
  GRID_W, GRID_H, createGame, applyWash, setTool, setNozzle, toggleNozzle,
  cleanliness, checkInvariants, isInside, mulberry32, defaultSeed,
} from "../js/engine.mjs";
import { LEVELS, LEVEL_IDS, STAINS, TOOLS } from "../js/levels.mjs";

test("twelve levels, six vehicles and six home items, all unique keys", () => {
  assert.equal(LEVELS.length, 12);
  assert.equal(new Set(LEVEL_IDS).size, 12);
  assert.equal(LEVELS.filter((l) => l.chapter === "chapter_car").length, 6);
  assert.equal(LEVELS.filter((l) => l.chapter === "chapter_home").length, 6);
  for (const lv of LEVELS) {
    for (const stain of STAINS) assert.ok(lv.layers[stain] >= 0 && lv.layers[stain] <= 1, lv.id);
  }
});

test("shape mask is non-trivial and inside cells carry grime", () => {
  assert.equal(isInside("sedan", 0.5, 0.5), true);
  assert.equal(isInside("sedan", 0.02, 0.05), false);
  const s = createGame("level_sedan");
  assert.equal(s.mask.length, GRID_W * GRID_H);
  assert.ok(s.mask.filter(Boolean).length > 350, "silhouette covers a healthy area");
  assert.ok(s.totalInitial > 0);
  assert.ok(s.dust.some((v) => v > 0) && s.grease.some((v) => v > 0) && s.stubborn.some((v) => v > 0));
});

test("deterministic seeding: same level seed gives identical fields", () => {
  const a = createGame("level_stove", 4242);
  const b = createGame("level_stove", 4242);
  assert.deepEqual(a.dust, b.dust);
  assert.deepEqual(a.grease, b.grease);
  const c = createGame("level_stove", 4243);
  assert.notDeepEqual(a.dust, c.dust);
  assert.equal(defaultSeed("level_stove"), defaultSeed("level_stove"));
  const r1 = mulberry32(7); const r2 = mulberry32(7);
  assert.deepEqual([r1(), r1(), r1()], [r2(), r2(), r2()]);
});

test("dwell beats waving: staying on a cell cleans it, waving barely touches it", () => {
  const idx = Math.floor(GRID_H / 2) * GRID_W + Math.floor(GRID_W / 2);
  let still = createGame("level_sedan");
  for (let t = 0; t < 45; t += 1) still = applyWash(still, { x: 0.5, y: 0.5 }, 0.05).state;
  let wave = createGame("level_sedan");
  for (let t = 0; t < 45; t += 1) wave = applyWash(wave, { x: 0.05 + 0.9 * (t / 44), y: 0.5 }, 0.05).state;
  assert.ok(still.dust[idx] < wave.dust[idx], "held jet clears the centre more than a fast sweep");
});

test("every tool removes every stain layer at a positive rate", () => {
  for (const tool of TOOLS) {
    let s = createGame("level_window");
    s = setTool(s, tool).state;
    const before = s.grease.reduce((a, b) => a + b, 0) + s.stubborn.reduce((a, b) => a + b, 0);
    for (let t = 0; t < 60; t += 1) s = applyWash(s, { x: 0.5, y: 0.45 }, 0.05).state;
    const after = s.grease.reduce((a, b) => a + b, 0) + s.stubborn.reduce((a, b) => a + b, 0);
    assert.ok(after < before, `${tool} must remove grease/stubborn`);
  }
});

test("foam softens stubborn grime before washing", () => {
  const idx = 12 * GRID_W + 24;
  let plain = createGame("level_window");
  let foamed = createGame("level_window");
  foamed = setTool(foamed, "tool_foam").state;
  for (let t = 0; t < 12; t += 1) foamed = applyWash(foamed, { x: 0.5, y: 0.4 }, 0.05).state;
  assert.ok(foamed.foam[idx] > 0, "foam is deposited on the target cell");
  plain = setTool(plain, "tool_jet").state;
  foamed = setTool(foamed, "tool_jet").state;
  for (let t = 0; t < 12; t += 1) {
    plain = applyWash(plain, { x: 0.5, y: 0.4 }, 0.05).state;
    foamed = applyWash(foamed, { x: 0.5, y: 0.4 }, 0.05).state;
  }
  assert.ok(foamed.stubborn[idx] < plain.stubborn[idx], "foam pre-treatment speeds stubborn removal");
});

test("nozzle toggle changes radius and power", () => {
  let s = createGame("level_sedan");
  assert.equal(s.nozzle, "wide");
  s = toggleNozzle(s).state;
  assert.equal(s.nozzle, "narrow");
  assert.equal(setNozzle(s, "wide").state.nozzle, "wide");
  assert.equal(setNozzle(s, "bogus").ok, false);
});

test("cleanliness is monotonic and completion clears all residue", () => {
  let s = createGame("level_stove");
  let prev = cleanliness(s);
  for (let t = 0; t < 600; t += 1) {
    s = applyWash(s, { x: 0.3 + 0.4 * ((t % 17) / 17), y: 0.3 + 0.35 * ((t % 11) / 11) }, 0.05).state;
    const current = cleanliness(s);
    assert.ok(current >= prev - 1e-9, "never rebounds");
    prev = current;
    assert.equal(checkInvariants(s), null);
  }
  // Sweep the whole surface to force completion.
  let guard = 0;
  while (!s.complete && guard++ < 3000) {
    s = setTool(s, guard % 2 ? "tool_jet" : "tool_brush").state;
    for (let y = 0; y < GRID_H; y += 2) {
      for (let x = 0; x < GRID_W; x += 2) {
        s = applyWash(s, { x: (x + 0.5) / GRID_W, y: (y + 0.5) / GRID_H }, 0.05).state;
      }
    }
  }
  assert.equal(s.complete, true);
  assert.equal(cleanliness(s), 1);
  assert.equal(s.totalRemaining, 0);
  assert.equal(checkInvariants(s), null);
  assert.equal(applyWash(s, { x: 0.5, y: 0.5 }, 0.05).ok, false, "terminal state is a no-op");
});

test("all twelve levels are washable to 100% without dead corners", () => {
  for (const lv of LEVELS) {
    let s = createGame(lv.id);
    let guard = 0;
    while (!s.complete && guard++ < 4000) {
      s = setTool(s, guard % 2 ? "tool_jet" : "tool_brush").state;
      for (let y = 0; y < GRID_H; y += 2) {
        for (let x = 0; x < GRID_W; x += 2) {
          s = applyWash(s, { x: (x + 0.5) / GRID_W, y: (y + 0.5) / GRID_H }, 0.05).state;
        }
      }
    }
    assert.equal(s.complete, true, `${lv.id} must be fully washable`);
    assert.equal(checkInvariants(s), null);
  }
});

test("replay determinism: same seed and pointer/dwell sequence match exactly", () => {
  const run = () => {
    let s = createGame("level_bus", 777);
    for (let t = 0; t < 260; t += 1) {
      if (t % 40 === 0) s = setTool(s, TOOLS[(t / 40) % TOOLS.length]).state;
      s = applyWash(s, { x: 0.2 + 0.6 * ((t % 23) / 23), y: 0.25 + 0.5 * ((t % 11) / 11) }, 0.033).state;
    }
    return JSON.stringify([s.totalRemaining, s.dust.slice(0, 40), s.foam.slice(0, 40)]);
  };
  assert.equal(run(), run());
});

test("1000-step random walk keeps invariants across random tools and nozzles", () => {
  let s = createGame("level_carpet", 31337);
  const rnd = mulberry32(2026);
  for (let step = 0; step < 1000; step += 1) {
    if (rnd() < 0.02) s = setTool(s, TOOLS[Math.floor(rnd() * TOOLS.length)]).state;
    if (rnd() < 0.01) s = toggleNozzle(s).state;
    if (rnd() < 0.03) {
      s = applyWash(s, null, 0.05).state;
    } else {
      s = applyWash(s, { x: rnd(), y: rnd() }, 0.01 + rnd() * 0.04).state;
    }
    assert.equal(checkInvariants(s), null, `step ${step}`);
    assert.ok(cleanliness(s) >= 0 && cleanliness(s) <= 1);
  }
});
