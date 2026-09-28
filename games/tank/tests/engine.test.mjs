import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  GRID,
  CELL,
  DIR,
  LEVEL_1_1,
  parseLevel,
  validateLevel,
  ENEMY_TYPES,
} from "../js/levels.mjs";
import {
  PHASES,
  BASE_HP,
  MAX_ENEMY_SHELLS,
  STAR_BREAK_STEEL,
  CHARGE_MAX,
  createState,
  startBattle,
  applyIntent,
  stepFrame,
  remainingEnemies,
  mulberry32,
} from "../js/engine.mjs";
import { SCORE_CAP, comboMultiplier } from "../js/score.mjs";

/* ------------------------------------------------------------------ helpers */

function makeLevel(mutate) {
  const rows = Array.from({ length: GRID }, () => new Array(GRID).fill("."));
  rows[24][12] = "E";
  rows[24][13] = "E";
  rows[25][12] = "E";
  rows[25][13] = "E";
  if (mutate) mutate(rows);
  return {
    id: "test_level",
    chapter: 1,
    terrain: rows.map((r) => r.join("")),
    playerSpawn: { hx: 4, hy: 4 },
    enemySpawns: [
      { hx: 0, hy: 0 },
      { hx: 12, hy: 0 },
      { hx: 24, hy: 0 },
    ],
    total: 4,
    concurrent: 4,
    spawnInterval: 1e9,
    aggro: 0,
    types: ["standard"],
    parTime: 100,
  };
}

function mkState(mutate, opts = {}) {
  const st = createState({ level: makeLevel(mutate), seed: 7, lives: 3, ...opts });
  startBattle(st);
  st.spawnTimer = 1e9;
  st.player.graceT = 0;
  return st;
}

function run(st, frames, dt = 1 / 60) {
  const all = [];
  for (let i = 0; i < frames; i += 1) {
    const evs = stepFrame(st, dt);
    for (const e of evs) all.push({ ...e });
  }
  return all;
}

function runUntil(st, pred, maxFrames = 240, dt = 1 / 60) {
  const all = [];
  for (let i = 0; i < maxFrames; i += 1) {
    for (const e of stepFrame(st, dt)) all.push({ ...e });
    if (pred(st, all)) return all;
  }
  return all;
}

function put(st, c, r, value) {
  st.grid[r * GRID + c] = value;
}

function addShell(st, shell) {
  const s = {
    id: 9000 + st.shells.length,
    owner: "player",
    dir: DIR.RIGHT,
    speed: 20,
    power: 1,
    bounced: false,
    alive: true,
    ...shell,
  };
  st.shells.push(s);
  return s;
}

/* --------------------------------------------------------------- data layer */

test("level data: parses terrain, base pocket and spawn points", () => {
  const parsed = parseLevel(LEVEL_1_1);
  assert.equal(parsed.grid.length, GRID * GRID);
  assert.deepEqual(parsed.base, { hx: 12, hy: 24 });
  assert.equal(parsed.grid[23 * GRID + 11], CELL.BRICK);
  assert.equal(parsed.grid[24 * GRID + 12], CELL.EMPTY);
  assert.equal(parsed.enemySpawns.length, 3);
  assert.equal(validateLevel(LEVEL_1_1).length, 0);
});

test("level data: validateLevel reports broken definitions", () => {
  assert.ok(validateLevel({}).includes("no_terrain"));
  const bad = makeLevel();
  bad.terrain = bad.terrain.slice(0, 20);
  assert.ok(validateLevel(bad).includes("bad_row_count"));
  const noBase = makeLevel((rows) => {
    rows[24][12] = ".";
  });
  assert.ok(validateLevel(noBase).includes("base_not_2x2"));
});

test("score: combo multiplier is capped and never below 1", () => {
  assert.equal(comboMultiplier(0), 1);
  assert.ok(comboMultiplier(4) > 1);
  assert.equal(comboMultiplier(999), 3);
  assert.ok(SCORE_CAP > 0);
});

/* -------------------------------------------------------------- basic state */

test("createState: opening state is deterministic and well formed", () => {
  const st = createState({ level: LEVEL_1_1, seed: 42 });
  assert.equal(st.phase, PHASES.ready);
  assert.equal(st.base.hp, BASE_HP);
  assert.equal(st.lives, 3);
  assert.equal(st.player.star, 1);
  assert.equal(st.queue.length, LEVEL_1_1.total);
  assert.equal(remainingEnemies(st), LEVEL_1_1.total);
  assert.equal(st.charge, 0);
  assert.equal(st.orderIndex, 0);
});

test("createState: same seed yields the same enemy roster", () => {
  const a = createState({ level: LEVEL_1_1, seed: 1234 });
  const b = createState({ level: LEVEL_1_1, seed: 1234 });
  const c = createState({ level: LEVEL_1_1, seed: 9999 });
  assert.deepEqual(a.queue, b.queue);
  assert.notDeepEqual(a.queue, c.queue);
});

test("startBattle flips ready to playing and is a no-op afterwards", () => {
  const st = mkState();
  assert.equal(st.phase, PHASES.playing);
  assert.equal(startBattle(st), null);
});

/* ----------------------------------------------------------- player control */

test("move intent snaps the cross axis to the half tile grid", () => {
  const st = mkState();
  st.player.x = 4.42;
  st.player.y = 4;
  applyIntent(st, { type: "move", dir: DIR.UP });
  assert.equal(st.player.x, 4);
  assert.equal(st.player.dir, DIR.UP);
  assert.equal(st.player.moving, true);
  st.player.y = 6.7;
  applyIntent(st, { type: "move", dir: DIR.RIGHT });
  assert.equal(st.player.y, 7);
  assert.equal(st.player.dir, DIR.RIGHT);
});

test("player drives forward and stops against a brick wall", () => {
  const st = mkState((rows) => {
    rows[4][8] = "B";
    rows[5][8] = "B";
  });
  st.player.x = 4;
  st.player.y = 4;
  applyIntent(st, { type: "move", dir: DIR.RIGHT });
  run(st, 120);
  assert.ok(st.player.x <= 6 + 1e-6);
  assert.ok(st.player.x > 5);
});

test("ice keeps the tank gliding after the stick is released", () => {
  const st = mkState((rows) => {
    for (let r = 2; r <= 8; r += 1) {
      for (let c = 2; c <= 10; c += 1) rows[r][c] = "I";
    }
  });
  st.player.x = 4;
  st.player.y = 4;
  applyIntent(st, { type: "move", dir: DIR.RIGHT });
  run(st, 10);
  const before = st.player.x;
  applyIntent(st, { type: "stop" });
  run(st, 20);
  assert.ok(st.player.x > before, "tank should keep sliding on ice");
  assert.ok(st.player.slideT <= 0.55);
});

/* -------------------------------------------------------------------- shells */

test("shells destroy a single brick half tile and stop there", () => {
  const st = mkState((rows) => {
    rows[5][10] = "B";
  });
  addShell(st, { x: 6, y: 5, dir: DIR.RIGHT, speed: 20, power: 1 });
  const events = run(st, 60);
  assert.ok(events.some((e) => e.type === "destroy" && e.c === 10 && e.r === 5));
  assert.equal(st.grid[5 * GRID + 10], CELL.EMPTY);
  assert.equal(st.shells.length, 0);
});

test("steel blocks a low level shell but falls to a three star shell", () => {
  const weak = mkState((rows) => {
    rows[5][10] = "S";
  });
  addShell(weak, { x: 6, y: 5, dir: DIR.RIGHT, speed: 20, power: 1 });
  run(weak, 60);
  assert.equal(weak.grid[5 * GRID + 10], CELL.STEEL);

  const strong = mkState((rows) => {
    rows[5][10] = "S";
  });
  addShell(strong, { x: 6, y: 5, dir: DIR.RIGHT, speed: 20, power: STAR_BREAK_STEEL });
  run(strong, 60);
  assert.equal(strong.grid[5 * GRID + 10], CELL.EMPTY);
});

test("ricochet: both sides open bounces the shell straight back", () => {
  const st = mkState((rows) => {
    rows[5][10] = "S";
  });
  const s = addShell(st, { x: 6, y: 5, dir: DIR.RIGHT, speed: 20, power: 1 });
  runUntil(st, () => s.bounced);
  assert.equal(s.bounced, true);
  assert.equal(s.dir, DIR.LEFT);
});

test("ricochet: a single open side deflects the shell around the corner", () => {
  const st = mkState((rows) => {
    rows[5][10] = "S";
    rows[6][10] = "S"; // block the lower escape cell
  });
  const s = addShell(st, { x: 6, y: 5, dir: DIR.RIGHT, speed: 20, power: 1 });
  runUntil(st, () => s.bounced);
  assert.equal(s.dir, DIR.UP);
  assert.equal(s.y, 4.5, "deflected shell snaps to the centre of the escape cell");
  assert.equal(s.x, 10.5);
  assert.ok(st.stats.ricochets >= 1);
});

test("ricochet: a dead end simply spends the shell", () => {
  const st = mkState((rows) => {
    rows[4][10] = "S";
    rows[5][10] = "S";
    rows[6][10] = "S";
  });
  const s = addShell(st, { x: 6, y: 5, dir: DIR.RIGHT, speed: 20, power: 1 });
  const events = runUntil(st, () => !s.alive, 120);
  assert.equal(s.alive, false);
  assert.ok(events.some((e) => e.type === "ricochet" && e.dir === -1));
});

test("ricochet: only one bounce per shell, and a returning shell can kill you", () => {
  const st = mkState((rows) => {
    rows[5][10] = "S";
  });
  st.player.x = 4;
  st.player.y = 4;
  st.player.graceT = 0;
  st.player.shieldT = 0;
  const s = addShell(st, { x: 6, y: 5, dir: DIR.RIGHT, speed: 20, power: 1 });
  const events = runUntil(st, () => !s.alive || st.player.alive === false, 240);
  assert.equal(st.lives, 2, "the player's own bounce costs a life");
  assert.ok(events.some((e) => e.type === "playerDown" && e.cause === "ricochet"));
});

test("enemy shells never ricochet, keeping the field readable", () => {
  const st = mkState((rows) => {
    rows[5][10] = "S";
  });
  const s = addShell(st, { x: 6, y: 5, dir: DIR.RIGHT, speed: 20, power: 1, owner: "enemy" });
  runUntil(st, () => !s.alive, 120);
  assert.equal(s.alive, false);
  assert.equal(s.bounced, false);
  assert.equal(st.stats.ricochets, 0);
});

/* ---------------------------------------------------------------- base rules */

test("base holds three hits before the battle is lost", () => {
  const st = mkState();
  for (let i = 0; i < BASE_HP; i += 1) {
    addShell(st, { x: 11.4, y: 25, dir: DIR.RIGHT, speed: 20, power: 1 });
    run(st, 10);
  }
  assert.equal(st.base.hp, 0);
  assert.equal(st.phase, PHASES.lost);
});

test("your own shell damages your own base too", () => {
  const st = mkState();
  addShell(st, { x: 11.4, y: 25, dir: DIR.RIGHT, speed: 20, power: 1, owner: "player" });
  const events = run(st, 10);
  assert.ok(events.some((e) => e.type === "baseHit"));
  assert.equal(st.base.hp, BASE_HP - 1);
});

/* ------------------------------------------------------------------- enemies */

test("spawner respects the concurrent cap and the roster order", () => {
  const st = createState({ level: LEVEL_1_1, seed: 5 });
  startBattle(st);
  run(st, 1200);
  assert.ok(st.enemies.length <= LEVEL_1_1.concurrent);
  assert.ok(st.spawned > 0);
  assert.ok(st.spawned <= LEVEL_1_1.total);
  for (const e of st.enemies) assert.ok(ENEMY_TYPES[e.type]);
});

test("killing an enemy scores, builds combo and charges the order slot", () => {
  const st = mkState();
  const spec = ENEMY_TYPES.standard;
  st.enemies.push({
    id: 501,
    type: "standard",
    x: 10,
    y: 10,
    dir: DIR.DOWN,
    hp: spec.hp,
    alive: true,
    spawnT: 0,
    aiTimer: 1e9,
    fireTimer: 1e9,
    aimT: 0,
    aiming: false,
    bonus: false,
  });
  // aim down the tank's centre line; enemies keep driving, so never aim at its edge
  addShell(st, { x: 8, y: 11, dir: DIR.RIGHT, speed: 20, power: 1 });
  const events = run(st, 40);
  assert.ok(events.some((e) => e.type === "kill" && e.id === 501));
  assert.equal(st.kills, 1);
  assert.equal(st.combo, 1);
  assert.equal(st.charge, 25);
  assert.ok(st.score > 0);
});

test("four hit armour tank survives three shells", () => {
  const st = mkState();
  const spec = ENEMY_TYPES.armor;
  const tank = {
    id: 502,
    type: "armor",
    x: 10,
    y: 10,
    dir: DIR.DOWN,
    hp: spec.hp,
    alive: true,
    spawnT: 0,
    aiTimer: 1e9,
    fireTimer: 1e9,
    aimT: 0,
    aiming: false,
    bonus: false,
  };
  st.enemies.push(tank);
  const shoot = () => {
    const e = st.enemies[0];
    addShell(st, { x: e.x - 2, y: e.y + 1, dir: DIR.RIGHT, speed: 20, power: 1 });
    run(st, 20);
  };
  for (let i = 0; i < 3; i += 1) shoot();
  assert.equal(st.enemies.length, 1);
  assert.equal(st.enemies[0].hp, 1);
  shoot();
  assert.equal(st.enemies.length, 0);
});

/* ------------------------------------------------------------------ powerups */

test("power-ups apply their classic effects", () => {
  const cases = [
    { kind: "star", check: (st) => st.player.star === 2 },
    { kind: "helmet", check: (st) => st.player.shieldT > 0 },
    { kind: "extra_life", check: (st) => st.lives === 4 },
    { kind: "clock", check: (st) => st.freezeT > 0 },
    { kind: "shovel", check: (st) => st.steelBaseT > 0 && st.grid[23 * GRID + 11] === CELL.STEEL },
  ];
  for (const c of cases) {
    const st = mkState();
    st.drops.push({ id: 1, kind: c.kind, hx: st.player.x, hy: st.player.y, ttl: 10 });
    run(st, 2);
    assert.ok(c.check(st), `power-up ${c.kind} should apply`);
  }
});

test("grenade clears every enemy on the field", () => {
  const st = mkState();
  for (let i = 0; i < 3; i += 1) {
    st.enemies.push({
      id: 600 + i,
      type: "standard",
      x: 6 + i * 4,
      y: 14,
      dir: DIR.DOWN,
      hp: 1,
      alive: true,
      spawnT: 0,
      aiTimer: 1e9,
      fireTimer: 1e9,
      aimT: 0,
      aiming: false,
      bonus: false,
    });
  }
  st.drops.push({ id: 1, kind: "grenade", hx: st.player.x, hy: st.player.y, ttl: 10 });
  run(st, 2);
  assert.equal(st.enemies.length, 0);
  assert.equal(st.kills, 3);
});

test("shovel steel plating reverts when the timer runs out", () => {
  const st = mkState();
  st.charge = CHARGE_MAX;
  applyIntent(st, { type: "order" }); // artillery
  st.charge = CHARGE_MAX;
  applyIntent(st, { type: "order" }); // fortify
  assert.equal(st.steelBaseT, 15);
  assert.equal(st.grid[23 * GRID + 11], CELL.STEEL);
  run(st, 60 * 16);
  assert.equal(st.steelBaseT, 0);
});

/* -------------------------------------------------------------------- orders */

test("order slot needs full charge and rotates through the three commands", () => {
  const st = mkState();
  assert.equal(applyIntent(st, { type: "order" }), null);

  st.charge = CHARGE_MAX;
  const first = applyIntent(st, { type: "order" });
  assert.equal(first.kind, "artillery");
  assert.equal(st.charge, 0);
  assert.equal(st.orderIndex, 1);

  st.charge = CHARGE_MAX;
  assert.equal(applyIntent(st, { type: "order" }).kind, "fortify");
  st.charge = CHARGE_MAX;
  assert.equal(applyIntent(st, { type: "order" }).kind, "jam");
  assert.ok(st.freezeT > 0);
  assert.ok(st.smokeT > 0);
  st.charge = CHARGE_MAX;
  assert.equal(applyIntent(st, { type: "order" }).kind, "artillery");
});

test("artillery barrage clears bricks ahead of the tank", () => {
  const st = mkState((rows) => {
    for (let r = 4; r <= 6; r += 1) {
      for (let c = 8; c <= 12; c += 1) rows[r][c] = "B";
    }
  });
  st.player.x = 4;
  st.player.y = 4;
  st.player.dir = DIR.RIGHT;
  st.charge = CHARGE_MAX;
  applyIntent(st, { type: "order" });
  assert.equal(st.grid[5 * GRID + 10], CELL.EMPTY);
});

/* --------------------------------------------------------------- end states */

test("clearing the roster clears the stage", () => {
  const st = mkState();
  st.spawned = st.queue.length;
  st.enemies.length = 0;
  const events = run(st, 2);
  assert.equal(st.phase, PHASES.cleared);
  assert.ok(events.some((e) => e.type === "cleared"));
});

test("losing every life ends the battle", () => {
  const st = mkState();
  st.lives = 1;
  st.player.graceT = 0;
  st.player.shieldT = 0;
  addShell(st, { x: 3.4, y: 5, dir: DIR.RIGHT, speed: 20, owner: "enemy" });
  const events = run(st, 20);
  assert.equal(st.phase, PHASES.lost);
  assert.ok(events.some((e) => e.type === "lost" && e.reason === "lives"));
});

test("a lost battle is a no-op for every intent and frame", () => {
  const st = mkState();
  st.phase = PHASES.lost;
  const before = JSON.stringify({ g: Array.from(st.grid), s: st.score });
  assert.equal(applyIntent(st, { type: "move", dir: DIR.UP }), null);
  assert.equal(applyIntent(st, { type: "fire" }), null);
  run(st, 30);
  assert.equal(JSON.stringify({ g: Array.from(st.grid), s: st.score }), before);
});

/* ------------------------------------------------------------ robustness */

test("1000 step random walk never breaks an invariant", () => {
  const rng = mulberry32(20260928);
  const st = createState({ level: LEVEL_1_1, seed: 77 });
  startBattle(st);
  for (let i = 0; i < 1000; i += 1) {
    const roll = rng();
    if (roll < 0.45) applyIntent(st, { type: "move", dir: Math.floor(rng() * 4) });
    else if (roll < 0.55) applyIntent(st, { type: "stop" });
    else if (roll < 0.85) applyIntent(st, { type: "fire" });
    else applyIntent(st, { type: "order" });
    stepFrame(st, 1 / 60);

    assert.ok(Number.isFinite(st.player.x) && Number.isFinite(st.player.y));
    assert.ok(st.player.x >= 0 && st.player.x <= GRID - 2);
    assert.ok(st.player.y >= 0 && st.player.y <= GRID - 2);
    assert.ok(st.base.hp >= 0 && st.base.hp <= BASE_HP);
    assert.ok(st.lives >= 0);
    assert.ok(st.score >= 0 && st.score <= SCORE_CAP);
    assert.ok(st.charge >= 0 && st.charge <= CHARGE_MAX);
    assert.ok(st.shells.length <= MAX_ENEMY_SHELLS + 2);
    assert.ok(st.enemies.length <= LEVEL_1_1.concurrent);
    assert.ok(Object.values(PHASES).includes(st.phase));
    for (const e of st.enemies) {
      assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y));
      assert.ok(e.hp >= 1);
    }
  }
});

test("engine stays DOM-free", () => {
  const src = readFileSync(new URL("../js/engine.mjs", import.meta.url), "utf8");
  for (const token of ["document", "window", "localStorage", "navigator", "alert("]) {
    assert.equal(src.includes(token), false, `engine must not reference ${token}`);
  }
});
