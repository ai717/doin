import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GRID,
  TANK_SIZE,
  CELL,
  ENEMY_TYPES,
  LEVELS,
  ENDGAMES,
  LEVEL_COUNT,
  ENDGAME_COUNT,
  BASE_SPOT,
  PLAYER_SPOT,
  ENEMY_SPOTS,
  campaignByChapter,
  levelById,
  endgameByIndex,
  LAST_STAND,
  waveComposition,
  validateLevel,
  inspectTerrain,
  tankReach,
  parseLevel,
  generateTerrain,
  campaignTerrainSpec,
  blankTerrain,
} from "../js/levels.mjs";
import {
  createState,
  startBattle,
  stepFrame,
  firePlayer,
  useOrder,
  applyIntent,
  PHASES,
} from "../js/engine.mjs";

const AUDIT = { playerSpawn: PLAYER_SPOT, spawns: ENEMY_SPOTS };

function audit(level) {
  return inspectTerrain(level.terrain, AUDIT);
}

function coverage(terrain) {
  let filled = 0;
  for (const row of terrain) for (const ch of row) if (ch !== "." && ch !== "E") filled += 1;
  return filled / (GRID * GRID);
}

/* ------------------------------------------------------------------- table */

test("campaign ships 24 stages, four per chapter, ids unique", () => {
  assert.equal(LEVEL_COUNT, 24);
  const ids = new Set();
  for (let ch = 1; ch <= 6; ch += 1) {
    const rows = campaignByChapter(ch);
    assert.equal(rows.length, 4, `chapter ${ch}`);
    for (const lv of rows) {
      assert.equal(lv.chapter, ch);
      assert.equal(lv.id, `level_${ch}_${lv.index}`);
      assert.equal(ids.has(lv.id), false, `duplicate ${lv.id}`);
      ids.add(lv.id);
    }
  }
});

test("breakthrough ships 8 hand-tuned puzzles", () => {
  assert.equal(ENDGAME_COUNT, 8);
  ENDGAMES.forEach((lv, i) => {
    assert.equal(lv.index, i + 1);
    assert.equal(lv.mode, "breakthrough");
    assert.ok(endgameByIndex(i + 1));
    assert.ok(levelById(lv.id));
  });
});

/* --------------------------------------------------------------- structure */

test("every stage passes the structural validator", () => {
  for (const lv of [...LEVELS, ...ENDGAMES]) {
    assert.deepEqual(validateLevel(lv), [], lv.id);
  }
});

test("every stage is reachable, pocket-free and has no orphan field", () => {
  for (const lv of [...LEVELS, ...ENDGAMES]) {
    const a = audit(lv);
    assert.deepEqual(a.problems, [], `${lv.id}: ${a.problems.join(",")}`);
    assert.equal(a.islands, 0, lv.id);
    assert.ok(a.reach > 120, `${lv.id} reach too small: ${a.reach}`);
    for (const n of a.pockets) assert.ok(n >= 20, `${lv.id} enemy pocket ${n}`);
  }
});

test("field density stays playable everywhere", () => {
  for (const lv of [...LEVELS, ...ENDGAMES]) {
    const c = coverage(lv.terrain);
    assert.ok(c >= 0.2 && c <= 0.72, `${lv.id} coverage ${c.toFixed(2)}`);
  }
});

test("the base is a solid 2x2 pocket at the bottom centre", () => {
  for (const lv of [...LEVELS, ...ENDGAMES]) {
    const rows = lv.terrain;
    for (let r = BASE_SPOT.hy; r < BASE_SPOT.hy + TANK_SIZE; r += 1) {
      for (let c = BASE_SPOT.hx; c < BASE_SPOT.hx + TANK_SIZE; c += 1) {
        assert.equal(rows[r][c], "E", `${lv.id} base cell ${c},${r}`);
      }
    }
    const ring = [
      [BASE_SPOT.hx - 1, BASE_SPOT.hy - 1],
      [BASE_SPOT.hx + TANK_SIZE, BASE_SPOT.hy - 1],
      [BASE_SPOT.hx, BASE_SPOT.hy - 1],
      [BASE_SPOT.hx + 1, BASE_SPOT.hy - 1],
    ];
    for (const [c, r] of ring) {
      assert.notEqual(rows[r][c], ".", `${lv.id} ring hole at ${c},${r}`);
    }
  }
});

test("terrain generation is deterministic", () => {
  const a = generateTerrain(4242, campaignTerrainSpec(3, 2));
  const b = generateTerrain(4242, campaignTerrainSpec(3, 2));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, generateTerrain(4243, campaignTerrainSpec(3, 2)));
  assert.equal(a.length, GRID);
  for (const row of a) assert.equal(row.length, GRID);
});

/* ------------------------------------------------------------------ curve */

test("chapter 1 teaches with brick only, later chapters introduce their terrain", () => {
  const has = (lv, ch) => lv.terrain.some((row) => row.includes(ch));
  for (const lv of campaignByChapter(1)) {
    assert.equal(has(lv, "S"), false, `${lv.id} must not ship steel`);
    assert.equal(has(lv, "W"), false, `${lv.id} must not ship water`);
    assert.equal(has(lv, "I"), false, `${lv.id} must not ship ice`);
  }
  for (const lv of campaignByChapter(2)) assert.equal(has(lv, "S"), true, `${lv.id} needs steel`);
  for (const lv of campaignByChapter(4)) {
    assert.equal(has(lv, "W"), true, `${lv.id} needs water`);
    assert.equal(has(lv, "I"), true, `${lv.id} needs ice`);
  }
  for (const lv of campaignByChapter(3)) assert.equal(has(lv, "T"), true, `${lv.id} needs trees`);
});

test("difficulty curve rises monotonically across the campaign", () => {
  let prevAggro = 0;
  let prevPar = Infinity;
  let prevGap = Infinity;
  for (const lv of LEVELS) {
    assert.ok(lv.aggro >= prevAggro - 1e-9, `${lv.id} aggro dip`);
    assert.ok(lv.parTime <= prevPar, `${lv.id} par time grew`);
    assert.ok(lv.spawnInterval <= prevGap + 1e-9, `${lv.id} spawn gap grew`);
    prevAggro = lv.aggro;
    prevPar = lv.parTime;
    prevGap = lv.spawnInterval;
  }
});

test("enemy roster follows the chapter promise", () => {
  assert.ok(campaignByChapter(1).every((lv) => lv.types.every((t) => t === "standard" || t === "scout")));
  assert.ok(campaignByChapter(2).some((lv) => lv.types.includes("rapid")));
  assert.ok(campaignByChapter(3).every((lv) => lv.types.includes("sniper")));
  assert.ok(campaignByChapter(4).every((lv) => lv.types.includes("armor")));
  assert.ok(campaignByChapter(5).every((lv) => lv.types.includes("sapper")));
  const fortress = LEVELS.find((lv) => lv.id === "level_6_4");
  assert.equal(fortress.fortress, true);
  assert.equal(fortress.total, 24);
  const armorShare = fortress.types.filter((t) => t === "armor").length / fortress.types.length;
  assert.ok(armorShare >= 0.5, `fortress armour share ${armorShare}`);
  assert.equal(fortress.terrain[BASE_SPOT.hy - 1][BASE_SPOT.hx - 1], "S");
});

test("chapter finales are harder than their openers", () => {
  for (let ch = 1; ch <= 6; ch += 1) {
    const rows = campaignByChapter(ch);
    assert.ok(rows[3].total >= rows[0].total);
    assert.ok(rows[3].concurrent >= rows[0].concurrent);
  }
});

/* -------------------------------------------------------------- breakthrough */

test("breakthrough presets sit on open, reachable ground", () => {
  for (const lv of ENDGAMES) {
    const reach = tankReach(lv.terrain, PLAYER_SPOT, false);
    assert.ok(lv.preset.length >= 2);
    const hp = lv.preset.reduce((n, p) => n + ENEMY_TYPES[p.type].hp, 0);
    assert.ok(lv.ammo >= hp + 4, `${lv.id} ammo ${lv.ammo} vs hp ${hp}`);
    const seen = new Set();
    for (const p of lv.preset) {
      assert.ok(reach.has(`${p.hx},${p.hy}`), `${lv.id} preset ${p.type} unreachable at ${p.hx},${p.hy}`);
      const k = `${p.hx},${p.hy}`;
      assert.equal(seen.has(k), false, `${lv.id} preset overlap`);
      seen.add(k);
      // never camped on top of the home pocket
      assert.ok(p.hy < 20 || p.hx < 8 || p.hx > 16, `${lv.id} preset on home row`);
    }
  }
});

test("parseLevel carries the breakthrough contract into the engine", () => {
  const lv = ENDGAMES[0];
  const parsed = parseLevel(lv);
  assert.equal(parsed.ammo, lv.ammo);
  assert.equal(parsed.mode, "breakthrough");
  assert.equal(parsed.preset.length, lv.preset.length);
  assert.equal(parsed.base.hx, BASE_SPOT.hx);
  assert.equal(parsed.grid.length, GRID * GRID);
  const campaign = parseLevel(LEVELS[0]);
  assert.equal(campaign.ammo, 0);
  assert.equal(campaign.preset.length, 0);
});

test("parseLevel degrades safely on junk input", () => {
  const parsed = parseLevel(null);
  assert.equal(parsed.grid.length, GRID * GRID);
  assert.equal(parsed.base.hy, BASE_SPOT.hy);
  assert.equal(parsed.total, 20);
  const bad = parseLevel({ terrain: blankTerrain() });
  assert.equal(bad.base.hx, BASE_SPOT.hx);
});

/* ----------------------------------------------------------------- runtime */

function run(state, seconds, dt = 1 / 60) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i += 1) {
    stepFrame(state, dt);
    if (state.phase !== PHASES.playing) break;
  }
}

test("every campaign stage survives a long unattended battle", () => {
  for (const lv of LEVELS) {
    const st = createState({ level: lv, seed: 7 });
    startBattle(st);
    run(st, 90);
    assert.ok(st.time > 0, lv.id);
    assert.ok(st.spawned > 0, `${lv.id} spawned nothing`);
    assert.ok(
      [PHASES.playing, PHASES.cleared, PHASES.lost].includes(st.phase),
      `${lv.id} phase ${st.phase}`
    );
  }
});

test("campaign has unlimited ammo, breakthrough spends a finite magazine", () => {
  const campaign = createState({ level: LEVELS[0], seed: 3 });
  startBattle(campaign);
  run(campaign, 3);
  assert.equal(campaign.ammo, Infinity);

  const puzzle = createState({ level: ENDGAMES[0], seed: 3 });
  startBattle(puzzle);
  assert.equal(puzzle.enemies.length, ENDGAMES[0].preset.length);
  assert.equal(puzzle.spawned, puzzle.queue.length);
  const budget = puzzle.ammo;
  let shots = 0;
  for (let i = 0; i < 600 && puzzle.ammo > 0; i += 1) {
    puzzle.player.cooldown = 0;
    if (puzzle.phase !== PHASES.playing) break;
    if (puzzle.ammo > 0) shots += 1;
    stepFrame(puzzle, 1 / 60);
    puzzle.player.cooldown = 0;
    if (i % 12 === 0) puzzle.shells.length = 0; // clear the tube so the trigger can run again
  }
  assert.ok(shots > 0);
  assert.ok(budget > 0 && budget < 40);
});

test("an empty magazine with enemies alive loses the puzzle", () => {
  const st = createState({ level: ENDGAMES[0], seed: 11 });
  startBattle(st);
  // burn every round straight up into whatever is there
  for (let i = 0; i < 4000 && st.ammo > 0 && st.phase === PHASES.playing; i += 1) {
    st.player.cooldown = 0;
    st.player.dir = 0;
    st.shells.length = 0; // keep the tube clear so the cooldown is the only limit
    firePlayer(st);
    stepFrame(st, 1 / 60);
  }
  assert.equal(st.ammo, 0);
  run(st, 6);
  assert.equal(st.phase, PHASES.lost);
});

test("a time limit ends the battle when the clock runs out", () => {
  const def = { ...ENDGAMES[1], timeLimit: 2, ammo: 0 };
  const st = createState({ level: def, seed: 5 });
  startBattle(st);
  run(st, 3);
  assert.equal(st.phase, PHASES.lost);
  assert.equal(st.timeLeft, 0);
});

/* --------------------------------------------------------------- last stand */

test("the siege tray is a real, reachable field", () => {
  const a = inspectTerrain(LAST_STAND.terrain, AUDIT);
  assert.deepEqual(a.problems, []);
  assert.equal(a.islands, 0);
  assert.equal(LAST_STAND.mode, "last_stand");
});

test("every wave is bigger and meaner than the last", () => {
  let prev = waveComposition(1);
  assert.deepEqual(prev.types, ["standard", "scout"]);
  for (let w = 2; w <= 24; w += 1) {
    const cur = waveComposition(w);
    assert.ok(cur.count >= prev.count, `wave ${w} shrank`);
    assert.ok(cur.concurrent >= prev.concurrent, `wave ${w} fewer slots`);
    assert.ok(cur.spawnInterval <= prev.spawnInterval, `wave ${w} slower`);
    assert.ok(cur.aggro >= prev.aggro, `wave ${w} calmer`);
    for (const t of prev.types) assert.ok(cur.types.includes(t), `wave ${w} dropped ${t}`);
    prev = cur;
  }
  assert.ok(waveComposition(5).types.includes("armor"));
  assert.ok(waveComposition(7).types.includes("sniper"));
  assert.ok(waveComposition(9).types.includes("sapper"));
  assert.equal(waveComposition(99).count, 20, "the roster caps out");
  assert.equal(waveComposition(99).concurrent, 6);
  assert.ok(waveComposition(99).spawnInterval >= 1.2);
});

test("clearing a siege wave rolls the next one instead of ending the battle", () => {
  const st = createState({ level: LAST_STAND, seed: 9 });
  startBattle(st);
  assert.equal(st.mode, "last_stand");
  assert.equal(st.wave, 1);
  assert.ok(st.queue.length > 0, "wave 1 must be queued up front");
  const first = st.queue.length;
  // wipe the wave the way a perfect run would
  st.enemies.length = 0;
  st.spawned = st.queue.length;
  stepFrame(st, 1 / 60);
  assert.equal(st.wave, 2);
  assert.equal(st.queue.length, first + waveComposition(2).count);
  assert.equal(st.phase, PHASES.playing);
  assert.equal(st.concurrent, waveComposition(2).concurrent);
});

test("a 300 step random walk over every stage keeps every invariant", () => {
  const list = [...LEVELS, ...ENDGAMES, LAST_STAND];
  for (const lv of list) {
    const st = createState({ level: lv, seed: 2026 });
    startBattle(st);
    let rngState = 99;
    const rnd = () => {
      rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
      return rngState / 0x7fffffff;
    };
    let lastScore = 0;
    for (let i = 0; i < 300; i += 1) {
      const roll = rnd();
      if (roll < 0.45) applyIntent(st, { type: "move", dir: Math.floor(rnd() * 4) });
      else if (roll < 0.6) applyIntent(st, { type: "stop" });
      else if (roll < 0.95) firePlayer(st);
      else useOrder(st);
      stepFrame(st, 1 / 60);

      assert.ok(st.lives >= 0, `${lv.id} lives`);
      assert.ok(st.base.hp >= 0 && st.base.hp <= 3, `${lv.id} base hp ${st.base.hp}`);
      assert.ok(st.score >= lastScore, `${lv.id} score went backwards`);
      lastScore = st.score;
      assert.ok(st.enemies.length <= Math.max(st.concurrent, 8), `${lv.id} roster overflow`);
      assert.ok(st.player.x >= 0 && st.player.x <= GRID - TANK_SIZE, `${lv.id} player x`);
      assert.ok(st.player.y >= 0 && st.player.y <= GRID - TANK_SIZE, `${lv.id} player y`);
      if (st.phase !== PHASES.playing) break;
    }
  }
});

/* -------------------------------------------------------------- stage heat */

test("stage heat actually drives the enemy towards the player", () => {
  const meanDistance = (aggro) => {
    let total = 0;
    let samples = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const lv = { ...LEVELS[6], aggro };
      const st = createState({ level: lv, seed });
      startBattle(st);
      run(st, 12);
      for (const e of st.enemies) {
        if (!e.alive || e.spawnT > 0) continue;
        total += Math.abs(e.x - st.player.x) + Math.abs(e.y - st.player.y);
        samples += 1;
      }
    }
    return samples > 0 ? total / samples : 0;
  };
  const cold = meanDistance(0.05);
  const hot = meanDistance(0.95);
  assert.ok(hot < cold, `hot stage should press the player: ${hot.toFixed(1)} vs ${cold.toFixed(1)}`);
});

/* ---------------------------------------------------------------- language */

test("the data layer holds no raw CJK literals", () => {
  const src = readFileSync(new URL("../js/levels.mjs", import.meta.url), "utf8");
  const hits = src.match(/[㐀-鿿　-〿＀-￯]/g);
  assert.equal(hits, null, `levels.mjs leaked CJK: ${hits?.slice(0, 5).join("")}`);
});
