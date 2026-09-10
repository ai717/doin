import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateGuaranteedLevel,
  analyzeLevel,
  levelDifficulty,
  endlessSpec,
  SIZES
} from '../js/engine.mjs';
import { normalizeState } from '../js/storage.mjs';

// 1. 难度旋钮：同一盘面、同一 seed，难度 1 的障碍率应不低于难度 0
test('difficulty knob raises obstacle ratio', () => {
  const easy = analyzeLevel(generateGuaranteedLevel(10, 10, 42, 0));
  const hard = analyzeLevel(generateGuaranteedLevel(10, 10, 42, 1));
  assert.ok(hard.obstacleRatio >= easy.obstacleRatio, 'hard obstacleRatio >= easy');
});

// 2. 难度旋钮产出必须仍可解（路径覆盖所有空格）
test('difficulty levels stay solvable', () => {
  for (const d of [0, 0.5, 1]) {
    const lvl = generateGuaranteedLevel(8, 8, 7, d);
    assert.equal(lvl.solution.length, lvl.rows * lvl.cols - countObstacles(lvl));
  }
});

// 3. levelDifficulty 随规格与关号非递减
test('levelDifficulty rises with size and level', () => {
  assert.ok(levelDifficulty(4, 1) <= levelDifficulty(4, 6));
  assert.ok(levelDifficulty(4, 6) <= levelDifficulty(8, 1));
  assert.ok(levelDifficulty(8, 10) <= 1);
});

// 4. endlessSpec：随机盘面、确定性、难度有界、越往后越偏大规格
test('endlessSpec within bounds, deterministic, size-weighted by progress', () => {
  let allSizesValid = true;
  let deterministic = true;
  for (let n = 1; n <= 200; n++) {
    const a = endlessSpec(n);
    const b = endlessSpec(n);
    if (a.seed !== b.seed || a.size !== b.size || a.difficulty !== b.difficulty) deterministic = false;
    if (!SIZES.includes(a.size)) allSizesValid = false;
    assert.ok(a.difficulty >= 0 && a.difficulty <= 1, `difficulty in bounds n=${n}`);
  }
  assert.ok(allSizesValid, 'size always from SIZES');
  assert.ok(deterministic, 'same n -> same spec');

  // 后期大规格占比应明显高于前期
  const largeRatio = (ns) => {
    const sizes = ns.map((n) => endlessSpec(n).size);
    return sizes.filter((s) => s >= 7).length / sizes.length;
  };
  const early = largeRatio(Array.from({ length: 40 }, (_, i) => i + 1));
  const late = largeRatio(Array.from({ length: 40 }, (_, i) => i + 261));
  assert.ok(late > early, `late large-size ratio (${late.toFixed(2)}) should exceed early (${early.toFixed(2)})`);
});

// 5. 无尽关卡由 seed 驱动，题面各不相同且都可解
test('endless levels are distinct and solvable', () => {
  const sigs = new Set();
  for (let n = 1; n <= 12; n++) {
    const spec = endlessSpec(n);
    const lvl = generateGuaranteedLevel(spec.size, spec.size, spec.seed, spec.difficulty);
    const sig = lvl.solution.map((p) => p.join('')).join('|');
    sigs.add(spec.size + ':' + sig);
    assert.equal(lvl.solution.length, spec.size * spec.size - countObstacles(lvl));
  }
  assert.equal(sigs.size, 12);
});

// 6. 存档 normalization 保留 endlessBest 并清洗非法值
test('normalizeState keeps endlessBest', () => {
  const clean = normalizeState({ endlessBest: 12, unlocked: { 4: 3 }, levelStats: {} });
  assert.equal(clean.endlessBest, 12);

  const clamped = normalizeState({ endlessBest: -5 });
  assert.equal(clamped.endlessBest, 0);

  const fallback = normalizeState(null);
  assert.equal(fallback.endlessBest, 0);
});

function countObstacles(lvl) {
  let obstacles = 0;
  for (let r = 0; r < lvl.rows; r++) {
    for (let c = 0; c < lvl.cols; c++) {
      if (lvl.grid[r][c] === 0) obstacles++;
    }
  }
  return obstacles;
}
