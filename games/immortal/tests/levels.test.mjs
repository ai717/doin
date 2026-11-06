import test from 'node:test';
import assert from 'node:assert/strict';
import { TRIBULATION_BOSSES, getBossById, calcAbyssBoss } from '../js/levels.mjs';
import { REALMS } from '../js/data.mjs';

test('levels: 21 tribulation bosses match 21 realms', () => {
  assert.equal(TRIBULATION_BOSSES.length, 21);
  assert.equal(REALMS.length, 21);

  TRIBULATION_BOSSES.forEach((boss, idx) => {
    assert.equal(boss.id, idx + 1);
    assert.equal(boss.realmId, idx + 1);
    assert.ok(boss.hp > 0);
    assert.ok(boss.atk > 0);
    assert.ok(boss.def > 0);
    assert.ok(boss.spd > 0);
    assert.ok(typeof boss.nameZh === 'string');
    assert.ok(typeof boss.enName === 'string');
  });
});

test('levels: getBossById returns expected boss or fallback', () => {
  const b1 = getBossById(1);
  assert.equal(b1.id, 1);
  const b21 = getBossById(21);
  assert.equal(b21.id, 21);
  const fallback = getBossById(999);
  assert.equal(fallback.id, 1);
});

test('levels: calcAbyssBoss scales infinitely with floor', () => {
  const f1 = calcAbyssBoss(1);
  const f10 = calcAbyssBoss(10);
  const f50 = calcAbyssBoss(50);

  assert.ok(f10.hp > f1.hp);
  assert.ok(f10.atk > f1.atk);
  assert.ok(f50.hp > f10.hp);
  assert.ok(f50.atk > f10.atk);
});
