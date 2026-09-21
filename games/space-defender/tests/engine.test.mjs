import test from "node:test";
import assert from "node:assert/strict";

import {
  createGame,
  startWave,
  stepFrame,
  applyIntent,
  drainEvents,
  safeLanes,
  snapshot,
  mulberry32,
  MAX_SHIELD,
  COMBO_MAX,
  MAX_ENEMY_BULLETS,
  OVERLOAD_MAX,
  SCORE_CAP,
  PLAYER_MIN_X,
  PLAYER_MAX_X,
  PHASES,
} from "../js/engine.mjs";
import { TOTAL_WAVES } from "../js/levels.mjs";

const DT = 1 / 120;

function run(state, seconds, inputFn, onFrame) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i += 1) {
    state.events = [];
    stepFrame(state, DT, inputFn ? inputFn(i) : {});
    if (onFrame) onFrame(state, i);
  }
}

test("engine: same seed replays identically", () => {
  const a = createGame({ mode: "campaign", waveIndex: 3, seed: 12345 });
  const b = createGame({ mode: "campaign", waveIndex: 3, seed: 12345 });
  const rng = mulberry32(7);
  for (let i = 0; i < 900; i += 1) {
    const input = { left: rng() < 0.3, right: rng() < 0.3, fire: rng() < 0.6 };
    stepFrame(a, DT, input);
    stepFrame(b, DT, input);
  }
  assert.deepEqual(snapshot(a), snapshot(b));
  assert.equal(a.score, b.score);
});

test("engine: 1200-step random walk never throws and keeps invariants", () => {
  const state = createGame({ mode: "campaign", waveIndex: 12, seed: 99 });
  const rng = mulberry32(4242);
  for (let i = 0; i < 1200; i += 1) {
    stepFrame(state, DT, { left: rng() < 0.35, right: rng() < 0.35, fire: rng() < 0.7 });
    assert.ok(state.player.shields <= MAX_SHIELD && state.player.shields >= -1);
    assert.ok(state.combo >= 0 && state.combo <= COMBO_MAX);
    assert.ok(state.enemyBullets.length <= MAX_ENEMY_BULLETS);
    assert.ok(state.score >= 0 && state.score <= SCORE_CAP);
    assert.ok(state.player.x >= PLAYER_MIN_X - 0.001 && state.player.x <= PLAYER_MAX_X + 0.001);
    assert.ok(state.overload.charge >= 0 && state.overload.charge <= OVERLOAD_MAX);
  }
});

test("engine: every wave leaves at least one escape corridor (no deadlock)", () => {
  for (let wave = 0; wave < TOTAL_WAVES; wave += 1) {
    const state = createGame({ mode: "campaign", waveIndex: wave, seed: 1000 + wave });
    const rng = mulberry32(wave * 31 + 5);
    let minLanes = Infinity;
    run(state, 26, () => ({ left: rng() < 0.3, right: rng() < 0.3, fire: rng() < 0.8 }), (s) => {
      if (s.phase !== PHASES.playing) {
        // 终局后重开同一波，继续考察弹幕密度
        startWave(s, wave);
        return;
      }
      minLanes = Math.min(minLanes, safeLanes(s));
    });
    assert.ok(minLanes >= 1, `wave ${wave} 出现无解弹幕（safeLanes=${minLanes}）`);
  }
});

test("engine: terminal phases are no-ops", () => {
  const state = createGame({ mode: "campaign", waveIndex: 0, seed: 5 });
  state.phase = PHASES.lost;
  const before = state.time;
  stepFrame(state, DT, { fire: true, right: true });
  assert.equal(state.time, before);
  assert.equal(stepFrame(state, DT, { fire: true }), state);
});

test("engine: player hit drains shields, then costs a ship and clears the screen", () => {
  const state = createGame({ mode: "campaign", waveIndex: 0, seed: 8 });
  state.player.invuln = 0;
  state.enemyBullets.push({ x: state.player.x, y: state.player.y - 4, vx: 0, vy: 10, r: 5, grazed: false, life: 5 });
  stepFrame(state, DT, {});
  assert.equal(state.player.shields, MAX_SHIELD - 1);

  state.player.shields = 0;
  state.player.invuln = 0;
  const lives = state.lives;
  const killer = { x: state.player.x, y: state.player.y - 4, vx: 0, vy: 10, r: 5, grazed: false, life: 5 };
  state.enemyBullets.push(killer);
  stepFrame(state, DT, {});
  assert.equal(state.lives, lives - 1);
  assert.ok(!state.enemyBullets.includes(killer), "复活清屏：致命弹必须被移除");
  assert.equal(
    state.enemyBullets.filter((b) => Math.abs(b.y - state.player.y) < 40).length,
    0,
    "复活后玩家附近不得残留敌弹",
  );
  assert.ok(state.player.invuln > 0);
});

test("engine: grazing charges OVERLOAD without taking damage", () => {
  const state = createGame({ mode: "campaign", waveIndex: 0, seed: 11 });
  state.player.invuln = 0;
  const shields = state.player.shields;
  const before = state.overload.charge;
  state.enemyBullets.push({ x: state.player.x + 18, y: state.player.y, vx: 0, vy: 0, r: 5, grazed: false, life: 5 });
  stepFrame(state, DT, {});
  assert.ok(state.overload.charge > before, "擦弹必须充能");
  assert.equal(state.player.shields, shields, "擦弹不掉护盾");
});

test("engine: overload needs a full gauge, doubles fire rate and slows bullets", () => {
  const state = createGame({ mode: "campaign", waveIndex: 0, seed: 13 });
  assert.equal(applyIntent(state, "overload"), null, "未充满时不得引爆");
  state.overload.charge = OVERLOAD_MAX;
  assert.equal(applyIntent(state, "overload"), "overload");
  assert.ok(state.overload.active > 0);
  assert.equal(state.overload.charge, 0);

  const slowState = createGame({ mode: "campaign", waveIndex: 0, seed: 14 });
  slowState.overload.charge = OVERLOAD_MAX;
  applyIntent(slowState, "overload");
  const fast = createGame({ mode: "campaign", waveIndex: 0, seed: 14 });
  for (const s of [slowState, fast]) {
    s.enemyBullets = [{ x: 100, y: 300, vx: 0, vy: 150, r: 5, grazed: false, life: 9 }];
  }
  stepFrame(slowState, DT, {});
  stepFrame(fast, DT, {});
  assert.ok(slowState.enemyBullets[0].y < fast.enemyBullets[0].y, "过载期间敌弹必须变慢");
});

/** 让皇蜂真的把本机牵起来：不加射击、只做小幅走位，直到进入被俘状态。 */
function runUntilCapture(state, maxSeconds, seed) {
  const rng = mulberry32(seed);
  const steps = Math.round(maxSeconds / DT);
  for (let i = 0; i < steps; i += 1) {
    stepFrame(state, DT, { left: rng() < 0.2, right: rng() < 0.2, fire: false });
    if (state.captured) return true;
  }
  return false;
}

test("engine: shooting down the capturing Queen rescues the wingman (dual fighter)", () => {
  const state = createGame({ mode: "campaign", waveIndex: 20, seed: 77 });
  assert.ok(runUntilCapture(state, 120, 3), "皇蜂星区必须出现牵引俘获");
  const queenId = state.captured?.enemyId;
  assert.ok(queenId, "俘获状态必须记录皇蜂 id");
  const queen = state.enemies.find((e) => e.id === queenId);
  assert.ok(queen && queen.alive);
  queen.hp = 1;
  state.playerBullets = [];
  state.playerBullets.push({ x: queen.x, y: queen.y, vx: 0, vy: -1, r: 4, dead: false });
  stepFrame(state, DT, {});
  assert.equal(state.captured, null, "夺回僚机后必须脱离俘获");
  assert.equal(state.player.dual, true, "击落俘获者必须双机合体");
  assert.equal(state.stats.rescued, 1);
});

test("engine: capture that is not rescued within the window costs a ship", () => {
  const state = createGame({ mode: "campaign", waveIndex: 20, seed: 77 });
  assert.ok(runUntilCapture(state, 120, 3));
  const lives = state.lives;
  state.captured.t = 2.999;
  stepFrame(state, DT, {});
  assert.equal(state.captured, null);
  assert.equal(state.lives, lives - 1, "俘获超时必须扣残机");
});

test("engine: boss waves clear when the mothership core is destroyed", () => {
  const state = createGame({ mode: "rush", waveIndex: 0, seed: 21 });
  assert.ok(state.boss && state.boss.hp > 0);
  state.boss.hp = 1;
  state.playerBullets = [{ x: state.boss.x, y: state.boss.y, vx: 0, vy: -1, r: 4, dead: false }];
  stepFrame(state, DT, {});
  assert.equal(state.boss.hp, 0);
  assert.ok(state.phase === PHASES.cleared || state.phase === PHASES.won);
});

test("engine: draining all ships ends the run", () => {
  const state = createGame({ mode: "survival", waveIndex: 0, seed: 31 });
  assert.equal(state.lives, 1);
  for (let i = 0; i < MAX_SHIELD + 1; i += 1) {
    state.player.invuln = 0;
    state.enemyBullets = [{ x: state.player.x, y: state.player.y - 4, vx: 0, vy: 10, r: 5, grazed: false, life: 5 }];
    stepFrame(state, DT, {});
  }
  assert.equal(state.phase, PHASES.lost);
});

test("engine: wave clear produces a starred result within caps", () => {
  const state = createGame({ mode: "campaign", waveIndex: 0, seed: 41 });
  for (const enemy of state.enemies) enemy.alive = false;
  stepFrame(state, DT, {});
  assert.equal(state.phase, PHASES.cleared);
  const result = state.lastResult;
  assert.ok(result.stars >= 0 && result.stars <= 3);
  assert.ok(result.score >= 0 && result.score <= SCORE_CAP);
  assert.equal(result.wave, 0);
});

test("engine: events are drained exactly once", () => {
  const state = createGame({ mode: "campaign", waveIndex: 0, seed: 51 });
  drainEvents(state);
  state.enemyBullets = [{ x: state.player.x + 18, y: state.player.y, vx: 0, vy: 0, r: 5, grazed: false, life: 5 }];
  state.player.invuln = 0;
  stepFrame(state, DT, {});
  const events = drainEvents(state);
  assert.ok(events.some((e) => e.type === "graze"));
  assert.equal(drainEvents(state).length, 0);
});
