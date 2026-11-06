import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClassic50Floors, buildFast25Floors } from '../js/levels.mjs';
import { GRID } from '../js/data.mjs';

test('levels: classic 50 floors structure and grid integrity', () => {
  const floors = buildClassic50Floors();
  assert.equal(floors.length, 50, 'Classic campaign must contain exactly 50 floors');

  floors.forEach((f, idx) => {
    assert.equal(f.floor, idx + 1);
    assert.ok(f.act >= 1 && f.act <= 5, 'Act must be 1..5');
    assert.equal(f.map.length, GRID, 'Map must have 11 rows');

    f.map.forEach((row, rIdx) => {
      assert.equal(row.length, GRID, `Row ${rIdx} of floor ${f.floor} must have 11 columns`);
      // Outer boundaries check
      if (rIdx === 0 || rIdx === GRID - 1) {
        assert.equal(row[0], '#');
        assert.equal(row[GRID - 1], '#');
      }
    });

    // Check boss floors have bosses mapped
    if (f.special?.bossFloor || f.special?.finalFloor) {
      assert.ok(Object.keys(f.monsters).length > 0, `Boss floor ${f.floor} must have monster mapping`);
    }
  });
});

test('levels: fast 25 floors structure integrity', () => {
  const floors = buildFast25Floors();
  assert.equal(floors.length, 25, 'Fast campaign must contain exactly 25 floors');

  floors.forEach((f, idx) => {
    assert.equal(f.floor, idx + 1);
    assert.equal(f.map.length, GRID);
  });
});
