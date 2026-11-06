import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, ACT_CONFIGS, getLevelById } from '../js/levels.mjs';

test('levels: metadata integrity for all 22 levels', () => {
  assert.equal(LEVELS.length, 22, 'Must contain exactly 22 levels');
  assert.equal(ACT_CONFIGS.length, 5, 'Must contain 5 acts');

  const seenIds = new Set();
  LEVELS.forEach((level, idx) => {
    assert.equal(level.id, idx + 1, `Level ID must be consecutive: ${level.id}`);
    assert.ok(level.act >= 1 && level.act <= 5, `Act must be 1-5, got ${level.act}`);
    assert.ok(typeof level.key === 'string' && level.key.length > 0);
    assert.ok(typeof level.nameKey === 'string' && level.nameKey.length > 0);
    assert.equal(level.targetScore, 5, 'Target score must be 5');
    assert.ok(level.targetSeconds >= 30 && level.targetSeconds <= 90);

    // AI parameters
    assert.ok(level.ai.speed >= 200 && level.ai.speed <= 600);
    assert.ok(level.ai.reactionDelay >= 0.01 && level.ai.reactionDelay <= 0.3);
    assert.ok(level.ai.defenseBias >= 0.3 && level.ai.defenseBias <= 1.0);
    assert.ok(level.ai.aggression >= 0.2 && level.ai.aggression <= 1.0);

    // Table parameters
    assert.ok(level.table.friction >= 0.99 && level.table.friction <= 1.0);
    assert.ok(level.table.wallRestitution >= 0.9 && level.table.wallRestitution <= 1.1);

    seenIds.add(level.id);
  });

  assert.equal(seenIds.size, 22);
});

test('levels: getLevelById returns correct level and handles fallback', () => {
  const l1 = getLevelById(1);
  assert.equal(l1.id, 1);

  const l22 = getLevelById(22);
  assert.equal(l22.id, 22);

  const fallback = getLevelById(999);
  assert.equal(fallback.id, 1);
});
