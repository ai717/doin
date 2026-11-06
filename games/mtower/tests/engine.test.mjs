import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  step,
  calculateBattle,
  calculateThresholds,
} from '../js/engine.mjs';
import { MONSTERS, GRID } from '../js/data.mjs';

test('engine: combat damage and turn formulas', () => {
  const hero = { hp: 1000, atk: 25, def: 10, relics: {} };
  const slime = MONSTERS.green_slime; // hp: 50, atk: 20, def: 1

  // hero deals 25 - 1 = 24 dmg per hit. Slime HP: 50 => ceil(50/24) = 3 turns.
  // Slime attacks 3 - 1 = 2 times. Slime dmg: max(0, 20 - 10) = 10. Total damage: 20.
  const battle = calculateBattle(hero, slime);
  assert.equal(battle.canWin, true);
  assert.equal(battle.turns, 3);
  assert.equal(battle.damage, 20);

  // If hero cannot pierce defense (Atk <= Def)
  const weakHero = { hp: 1000, atk: 1, def: 10, relics: {} };
  const failBattle = calculateBattle(weakHero, slime);
  assert.equal(failBattle.canWin, false);
  assert.equal(failBattle.damage, Infinity);
});

test('engine: critical threshold calculator', () => {
  const hero = { hp: 1000, atk: 25, def: 10, relics: {} };
  const slime = MONSTERS.green_slime; // hp: 50, atk: 20, def: 1

  const thresholds = calculateThresholds(hero, slime);
  assert.ok(thresholds.atkThreshold, 'Should have atk threshold');
  assert.ok(thresholds.atkThreshold.deltaAtk > 0, 'Delta atk should be > 0');
  assert.ok(thresholds.atkThreshold.savedHp > 0, 'Saved HP should be > 0');

  // Def threshold: slime atk is 20, hero def is 10 => +10 def saves all damage!
  assert.ok(thresholds.defThreshold, 'Should have def threshold');
  assert.equal(thresholds.defThreshold.deltaDef, 10);
  assert.equal(thresholds.defThreshold.savedHp, 20);
});

test('engine: relics effects (Holy Water, Holy Cross, Earthquake)', () => {
  const s0 = createInitialState();
  s0.hero.relics.holyWater = 1;
  s0.hero.hp = 1200;

  // Use Holy Water
  const s1 = step(s0, { type: 'use_water' });
  assert.equal(s1.hero.hp, 2400);
  assert.equal(s1.hero.relics.holyWater, 0);

  // Use Earthquake Scroll
  s1.hero.relics.earthquake = 1;
  const s2 = step(s1, { type: 'use_quake' });
  assert.equal(s2.hero.relics.earthquake, 0);
  // Ensure no regular '#' walls remain on current floor
  const hasRegularWall = s2.floors[s2.currentFloor - 1].map.some((row) => row.includes('#'));
  assert.equal(hasRegularWall, false, 'Earthquake must destroy all regular walls on the floor');
});

test('engine: infinite undo restores exact prior state', () => {
  const s0 = createInitialState();
  const startX = s0.hero.x;
  const startY = s0.hero.y;

  const s1 = step(s0, { type: 'move', dx: 0, dy: -1 });
  assert.equal(s1.steps, 1);

  const sUndo = step(s1, { type: 'undo' });
  assert.equal(sUndo.hero.x, startX);
  assert.equal(sUndo.hero.y, startY);
  assert.equal(sUndo.steps, 0);
});

test('engine: >= 1000 steps random walk invariant test', () => {
  let state = createInitialState();
  const moves = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];

  let seed = 987654321;
  function rnd() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  for (let stepIdx = 0; stepIdx < 1000; stepIdx++) {
    const actionChoice = rnd();
    let action;

    if (actionChoice < 0.75) {
      const m = moves[Math.floor(rnd() * moves.length)];
      action = { type: 'move', dx: m.dx, dy: m.dy };
    } else if (actionChoice < 0.90) {
      action = { type: 'undo' };
    } else {
      action = { type: 'use_water' };
    }

    state = step(state, action);

    // 断言不变量守恒
    assert.ok(state.hero.hp >= 0, `Hero HP must be >= 0 at step ${stepIdx}`);
    assert.ok(state.hero.atk >= 10, 'Hero ATK must be >= initial 10');
    assert.ok(state.hero.def >= 10, 'Hero DEF must be >= initial 10');
    assert.ok(state.hero.x >= 0 && state.hero.x < GRID, 'Hero X must be in bounds');
    assert.ok(state.hero.y >= 0 && state.hero.y < GRID, 'Hero Y must be in bounds');
    assert.ok(state.currentFloor >= 1 && state.currentFloor <= 50, 'Floor must be 1..50');
  }
});
