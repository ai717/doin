import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createState,
  setInput,
  stepFrame,
  aliveAliens,
  divers,
  comboMultiplier,
  STATUS,
  MODES,
  MAX_DIVERS,
  VIEW_W,
  TURRET_W,
  TURRET_Y,
} from "../js/engine.mjs";
import { LEVELS } from "../js/levels.mjs";
import { MAX_PLAYER_BULLETS, MAX_ENEMY_BULLETS, STEP_Y, maskCells } from "../js/data.mjs";

const DT = 1 / 120;

function run(state, seconds, input = {}) {
  setInput(state, input);
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i += 1) stepFrame(state, DT);
  return state;
}

test("createState builds the first wave from the level mask", () => {
  const state = createState({ mode: MODES.CAMPAIGN, levelId: 1, seed: 7 });
  const expected = maskCells(LEVELS[0].waves[0].mask).length;
  assert.equal(aliveAliens(state).length, expected);
  assert.equal(state.status, STATUS.INTRO);
  assert.equal(state.hull, state.maxHull);
  assert.equal(state.barricades.length, 3);
});

test("intro slides the formation in and hands over to the fight", () => {
  const state = createState({ levelId: 1, seed: 11 });
  const startY = state.formation.y;
  run(state, 0.6);
  assert.ok(state.formation.y > startY);
  run(state, 0.8);
  assert.equal(state.status, STATUS.FIGHT);
});

test("turret follows input and never leaves the rail", () => {
  const state = createState({ levelId: 1, seed: 3 });
  run(state, 1.4);
  const startX = state.turret.x;
  run(state, 0.5, { move: -1 });
  assert.ok(state.turret.x < startX);
  run(state, 5, { move: -1 });
  assert.ok(state.turret.x >= TURRET_W / 2 - 0.001);
  run(state, 6, { move: 1 });
  assert.ok(state.turret.x <= VIEW_W - TURRET_W / 2 + 0.001);
});

function tapFire(state, times) {
  for (let i = 0; i < times; i += 1) {
    setInput(state, { firing: true });
    stepFrame(state, DT);
    setInput(state, { firing: false });
    for (let k = 0; k < 22; k += 1) stepFrame(state, DT);
  }
}

test("main gun respects bullet cap, cooldown and heat lock", () => {
  const state = createState({ levelId: 1, seed: 21 });
  run(state, 1.4);
  tapFire(state, 2);
  assert.ok(state.shotsFired >= 2);
  assert.ok(state.bullets.length <= MAX_PLAYER_BULLETS);
  assert.ok(state.turret.heat > 0);
  let guard = 0;
  while (!state.turret.overheated && guard < 80) {
    tapFire(state, 1);
    guard += 1;
  }
  assert.equal(state.turret.overheated, true);
  const shotsWhileLocked = state.shotsFired;
  run(state, 0.3, { firing: false });
  assert.equal(state.shotsFired, shotsWhileLocked);
  run(state, 1.2, { firing: false });
  assert.equal(state.turret.overheated, false);
  assert.equal(state.turret.heat, 0);
});

test("holding the trigger charges the railgun and release consumes heat", () => {
  const state = createState({ levelId: 1, seed: 31 });
  run(state, 1.4);
  run(state, 0.7, { firing: true });
  assert.ok(state.turret.charge >= 0.6);
  const heatBefore = state.turret.heat;
  const beamsBefore = state.beams.length;
  setInput(state, { firing: false });
  stepFrame(state, DT);
  assert.equal(state.beams.length, beamsBefore + 1);
  assert.ok(state.turret.heat > heatBefore);
});

test("holding the trigger keeps firing instead of stopping after one shell", () => {
  const state = createState({ levelId: 1, seed: 27 });
  run(state, 1.4);
  run(state, 1.2, { firing: true });
  // Cooldown + the two shell cap allow roughly three shells per second.
  assert.ok(state.shotsFired >= 3, `expected sustained fire, got ${state.shotsFired}`);
});

test("formation marches, reverses at the wall and descends", () => {
  const state = createState({ levelId: 1, seed: 41 });
  run(state, 1.4);
  const startX = state.formation.x;
  run(state, 1.0);
  assert.notEqual(state.formation.x, startX);
  let sawDescend = false;
  for (let i = 0; i < 120 * 60 && !sawDescend; i += 1) {
    stepFrame(state, DT);
    if (state.events.some((e) => e.type === "descend")) sawDescend = true;
  }
  assert.equal(sawDescend, true);
});

test("march tempo accelerates as the formation thins out", () => {
  const state = createState({ levelId: 1, seed: 51 });
  run(state, 1.4);
  run(state, 1.2);
  const slow = state.formation.stepInterval;
  const alive = aliveAliens(state);
  for (const alien of alive.slice(1)) alien.alive = false;
  run(state, 1.4);
  assert.ok(state.formation.stepInterval < slow, `${state.formation.stepInterval} < ${slow}`);
});

test("a block narrowed to an edge column must not descend on every step", () => {
  const state = createState({ levelId: 1, seed: 47 });
  run(state, 1.4);
  // Leave only the far right column alive, then park the block off the rail so
  // the occupied slice sits outside the wall on both sides. The old wall test
  // kept firing on every step, dropping the fleet through the line in seconds.
  for (const alien of state.aliens) {
    if (alien.col !== 10) alien.alive = false;
  }
  state.formation.x = 900;
  const startY = state.formation.y;
  run(state, 3.0);
  const drops = Math.round((state.formation.y - startY) / STEP_Y);
  assert.ok(drops <= 2, `expected at most 2 descents in 3s, got ${drops}`);
});

test("a diver that already fell past the deck cannot ram from below", () => {
  const state = createState({ levelId: 1, seed: 57 });
  run(state, 1.4);
  const alien = state.aliens.find((a) => a.alive);
  alien.mode = "dive";
  alien.phase = "dash";
  alien.diveT = 2;
  alien.targetX = state.turret.x;

  // Positive control: overlapping the turret band does cost a plate.
  alien.x = state.turret.x;
  alien.y = TURRET_Y - 20;
  state.turret.invuln = 0;
  run(state, 0.05);
  assert.equal(state.hull, state.maxHull - 1);

  // Below the band it is already gone -- sliding under it must be free.
  const hull = state.hull;
  const past = state.aliens.find((a) => a.alive);
  past.mode = "dive";
  past.phase = "dash";
  past.diveT = 2;
  past.targetX = state.turret.x;
  past.x = state.turret.x;
  past.y = TURRET_Y + 60;
  state.turret.invuln = 0;
  run(state, 0.05);
  assert.equal(state.hull, hull);
});

test("dives are capped and always leave a safe lane", () => {
  const state = createState({ levelId: 3, seed: 61 });
  run(state, 1.4);
  for (let i = 0; i < 120 * 90; i += 1) {
    setInput(state, { move: i % 240 < 120 ? -1 : 1, firing: i % 7 === 0 });
    stepFrame(state, DT);
    const active = divers(state);
    assert.ok(active.length <= MAX_DIVERS, `too many divers: ${active.length}`);
    if (active.length === 2) {
      const zone = TURRET_W + 60;
      const covered = zone * 2;
      assert.ok(covered < VIEW_W, "two divers must not seal the whole rail");
    }
    if (state.status === STATUS.WON || state.status === STATUS.LOST) break;
  }
});

test("killing aliens scores, builds combo and head-on pays double plus bonus", () => {
  const state = createState({ levelId: 1, seed: 71 });
  run(state, 1.4);
  const target = state.aliens.find((alien) => alien.alive);
  const scoreBefore = state.score;
  state.aliens = state.aliens.filter((alien) => alien === target);
  target.mode = "dive";
  target.phase = "dash";
  target.x = state.turret.x;
  target.y = 462; // above the barricade band so the dash is still airborne
  state.bullets = [{ x: target.x, y: target.y, vx: 0, vy: -900 }];
  stepFrame(state, DT);
  assert.equal(target.alive, false);
  assert.equal(state.headons, 1);
  assert.ok(state.score - scoreBefore >= 20);
  assert.equal(state.comboHits, 1);
});

test("combo multiplier steps up every five hits and caps at four", () => {
  const state = createState({ levelId: 1, seed: 73 });
  state.comboHits = 0;
  assert.equal(comboMultiplier(state), 1);
  state.comboHits = 5;
  assert.equal(comboMultiplier(state), 1.2);
  state.comboHits = 100;
  assert.equal(comboMultiplier(state), 4);
});

test("barricades erode and never block every firing lane", () => {
  const state = createState({ levelId: 1, seed: 81 });
  run(state, 1.4);
  const before = state.barricades.reduce((sum, b) => sum + b.cells.reduce((s, v) => s + v, 0), 0);
  state.enemyBullets = [{ x: 500, y: 540, vx: 0, vy: 300 }];
  run(state, 0.4);
  const after = state.barricades.reduce((sum, b) => sum + b.cells.reduce((s, v) => s + v, 0), 0);
  assert.ok(after < before, "barricade should lose cells");
});

function shootAtTurret(state) {
  state.turret.x = 368; // lane between two barricades
  state.enemyBullets = [{ x: 368, y: 596, vx: 0, vy: 300 }];
  run(state, 0.4);
}

test("hull damage respects invulnerability and ends the run at zero", () => {
  const state = createState({ levelId: 1, seed: 91 });
  const max = state.maxHull;
  run(state, 1.4);
  shootAtTurret(state);
  assert.equal(state.hull, max - 1);
  assert.ok(state.turret.invuln > 0);
  // Draining the whole bar has to end the run, whatever the bar size is.
  for (let left = max - 1; left > 0; left -= 1) {
    state.turret.invuln = 0;
    shootAtTurret(state);
  }
  assert.equal(state.hull, 0);
  assert.equal(state.status, STATUS.LOST);
});

test("training stages never damage the hull", () => {
  const state = createState({ mode: MODES.TRAINING, levelId: 101, seed: 95 });
  run(state, 1.4);
  state.enemyBullets = [{ x: state.turret.x, y: 600, vx: 0, vy: 300 }];
  run(state, 0.4);
  assert.equal(state.hull, state.maxHull);
  assert.notEqual(state.status, STATUS.LOST);
});

function clearCurrentWave(state) {
  for (const alien of state.aliens) alien.alive = false;
  state.pending = null;
  state.mothership = null;
  for (let i = 0; i < 1500; i += 1) {
    stepFrame(state, DT);
    if (state.status === STATUS.FIGHT || state.status === STATUS.WON) break;
  }
}

test("clearing every wave wins the level", () => {
  const state = createState({ levelId: 1, seed: 101 });
  run(state, 1.4);
  for (let wave = 0; wave < 3; wave += 1) clearCurrentWave(state);
  assert.equal(state.status, STATUS.WON);
});

test("survival mode keeps generating waves", () => {
  const state = createState({ mode: MODES.SURVIVAL, seed: 111 });
  run(state, 1.4);
  for (let wave = 0; wave < 4; wave += 1) clearCurrentWave(state);
  assert.equal(state.waveIndex, 4);
  assert.notEqual(state.status, STATUS.WON);
});

test("1000 step random walk keeps every invariant", () => {
  const state = createState({ levelId: 6, seed: 12345 });
  let seed = 987654321;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < 6000; i += 1) {
    setInput(state, { move: Math.floor(rand() * 3) - 1, firing: rand() < 0.45 });
    stepFrame(state, DT);
    assert.ok(state.turret.heat >= 0 && state.turret.heat <= 1);
    assert.ok(state.bullets.length <= MAX_PLAYER_BULLETS);
    assert.ok(state.enemyBullets.length <= MAX_ENEMY_BULLETS);
    assert.ok(divers(state).length <= MAX_DIVERS);
    assert.ok(state.hull >= 0 && state.hull <= state.maxHull);
    assert.ok(Number.isFinite(state.score) && state.score >= 0);
    assert.ok(state.turret.x >= TURRET_W / 2 - 0.001 && state.turret.x <= VIEW_W - TURRET_W / 2 + 0.001);
    if (state.status === STATUS.WON || state.status === STATUS.LOST) break;
  }
});

test("same seed replays identically", () => {
  const a = createState({ levelId: 5, seed: 2024 });
  const b = createState({ levelId: 5, seed: 2024 });
  let seed = 555;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  let seed2 = 555;
  const rand2 = () => {
    seed2 = (seed2 * 1103515245 + 12345) % 2147483648;
    return seed2 / 2147483648;
  };
  for (let i = 0; i < 2400; i += 1) {
    setInput(a, { move: Math.floor(rand() * 3) - 1, firing: rand() < 0.4 });
    setInput(b, { move: Math.floor(rand2() * 3) - 1, firing: rand2() < 0.4 });
    stepFrame(a, DT);
    stepFrame(b, DT);
  }
  assert.equal(a.score, b.score);
  assert.equal(a.hull, b.hull);
  assert.equal(a.formation.x, b.formation.x);
  assert.equal(a.formation.y, b.formation.y);
  assert.equal(a.aliens.filter((x) => x.alive).length, b.aliens.filter((x) => x.alive).length);
});

test("engine stays free of DOM and storage APIs", () => {
  const src = readFileSync(new URL("../js/engine.mjs", import.meta.url), "utf8");
  for (const token of ["document.", "window.", "localStorage", "sessionStorage"]) {
    assert.equal(src.includes(token), false, `engine must not touch ${token}`);
  }
});
