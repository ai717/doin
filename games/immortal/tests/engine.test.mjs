import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPRNG,
  generateEquipment,
  calculatePlayerStats,
  simulateCombat,
  calcOfflineGains
} from '../js/engine.mjs';
import { SLOTS, QUALITIES } from '../js/data.mjs';

test('engine: generateEquipment produces valid gear with stats and affixes', () => {
  const prng = createPRNG(42);
  const gear = generateEquipment(1, 1, prng);

  assert.ok(gear.uid);
  assert.ok(Object.values(SLOTS).includes(gear.slot));
  assert.ok(Object.values(QUALITIES).includes(gear.quality));
  assert.ok(gear.hp > 0);
  assert.ok(gear.atk > 0);
  assert.ok(gear.def > 0);
  assert.ok(gear.spd > 0);
  assert.ok(gear.cp > 0);
  assert.ok(typeof gear.nameZh === 'string');
  assert.ok(typeof gear.enName === 'string');
});

test('engine: calculatePlayerStats aggregates base realm and 8 equipment slots', () => {
  const equipment = {
    [SLOTS.SWORD]: { hp: 50, atk: 100, def: 20, spd: 10, affixes: { crit: 10 } },
    [SLOTS.BOOTS]: { hp: 30, atk: 15, def: 10, spd: 40, affixes: { dodge: 12 } }
  };

  const stats = calculatePlayerStats(1, equipment);
  assert.ok(stats.hp > 150 + 50);
  assert.ok(stats.atk > 25 + 100);
  assert.ok(stats.def > 10 + 20);
  assert.equal(stats.affixes.crit, 15); // 5 base + 10
  assert.equal(stats.affixes.dodge, 17); // 5 base + 12
  assert.ok(stats.cp > 0);
});

test('engine: simulateCombat produces turn logs and deterministic winner', () => {
  const prng = createPRNG(12345);
  const playerStats = { hp: 500, atk: 80, def: 30, spd: 20, affixes: { crit: 20, dodge: 10 } };
  const bossStats = { hp: 400, atk: 60, def: 20, spd: 15, affixes: { counter: 15 } };

  const res = simulateCombat(playerStats, bossStats, prng);
  assert.ok(res.winner === 'player' || res.winner === 'boss');
  assert.ok(res.logs.length > 0);
  assert.ok(res.remainingPlayerHp >= 0);
  assert.ok(res.remainingBossHp >= 0);
});

test('engine: calcOfflineGains calculates bounded offline spirit yield', () => {
  const now = Date.now();

  // Less than 10 seconds -> 0
  const g0 = calcOfflineGains(now - 5000, now, 1);
  assert.equal(g0.elapsedSeconds, 0);

  // 1 hour offline
  const g1 = calcOfflineGains(now - 3600 * 1000, now, 1);
  assert.equal(g1.elapsedSeconds, 3600);
  assert.ok(g1.spiritStones > 1000);
  assert.ok(g1.cauldronStones > 100);

  // Capped at 24 hours
  const g2 = calcOfflineGains(now - 48 * 3600 * 1000, now, 1);
  assert.equal(g2.elapsedSeconds, 24 * 3600);
});

test('engine: >= 1000 steps random walk invariant test', () => {
  const prng = createPRNG(999);
  let realm = 1;
  const equipment = {};

  for (let i = 0; i < 1000; i++) {
    const action = Math.floor(prng() * 4);

    if (action === 0) {
      // Generate gear and conditionally equip
      const cauldronLvl = 1 + Math.floor(prng() * 15);
      const gear = generateEquipment(cauldronLvl, realm, prng);
      assert.ok(gear.cp > 0);
      equipment[gear.slot] = gear;
    } else if (action === 1) {
      // Recalculate stats
      const stats = calculatePlayerStats(realm, equipment);
      assert.ok(stats.hp > 0);
      assert.ok(stats.atk > 0);
      assert.ok(stats.def > 0);
      assert.ok(stats.spd > 0);
      assert.ok(stats.cp > 0);
      assert.ok(stats.affixes.dodge <= 75.0);
    } else if (action === 2) {
      // Simulate combat
      const pStats = calculatePlayerStats(realm, equipment);
      const bStats = { hp: 500 + realm * 200, atk: 50 + realm * 20, def: 20 + realm * 10, spd: 15 + realm * 2, affixes: {} };
      const res = simulateCombat(pStats, bStats, prng);
      assert.ok(typeof res.won === 'boolean');
      if (res.won && realm < 21) {
        realm++;
      }
    } else {
      // Calc offline gains
      const elapsed = Math.floor(prng() * 100000);
      const gains = calcOfflineGains(Date.now() - elapsed * 1000, Date.now(), realm);
      assert.ok(gains.spiritStones >= 0);
    }
  }
});
