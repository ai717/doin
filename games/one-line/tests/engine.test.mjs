import test from 'node:test';
import assert from 'node:assert/strict';
import { OneLineEngine, generateGuaranteedLevel, LEVELS_PER_SIZE } from '../js/engine.mjs';

test('Dynamic Algorithm: 验证 4x4 到 12x12 随机关卡 100% 存在原生真解', () => {
  const testSizes = [4, 6, 8, 10, 12];

  for (const size of testSizes) {
    for (let seed = 1; seed <= 6; seed++) {
      const level = generateGuaranteedLevel(size, size, seed);
      const engine = new OneLineEngine(level);
      const solution = level.solution;

      assert.ok(solution.length > 0, `规格 ${size}x${size} seed ${seed} 必须生成真理路径`);
      assert.equal(solution.length, engine.targetCount, `真理路径长度必须与目标格子数相等`);

      // 逐步走通
      for (let i = 1; i < solution.length; i++) {
        const [r, c] = solution[i];
        const res = engine.moveToCell(r, c);
        assert.equal(res.success, true, `规格 ${size}x${size} 第 ${i + 1} 步 (${r},${c}) 必须合法`);
      }

      assert.equal(engine.status, 'clearing', `全部走完后必须触发通关充能`);
    }
  }
});

test('Level Shape: 真解必须正交连续、不重复，且恰好覆盖全部可走格', () => {
  for (const size of [4, 8, 12]) {
    for (let seed = 1; seed <= 6; seed++) {
      const level = generateGuaranteedLevel(size, size, seed);
      const seen = new Set();

      level.solution.forEach(([r, c], i) => {
        assert.equal(level.grid[r][c], 1, `第 ${i} 步必须落在可走格`);
        const key = `${r},${c}`;
        assert.equal(seen.has(key), false, `第 ${i} 步不得重复经过同一格`);
        seen.add(key);

        if (i > 0) {
          const [pr, pc] = level.solution[i - 1];
          assert.equal(Math.abs(pr - r) + Math.abs(pc - c), 1, `第 ${i} 步必须与上一步正交相邻`);
        }
      });

      assert.deepEqual(level.start, level.solution[0], '起点必须与真解首格一致');

      let walkable = 0;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) if (level.grid[r][c] === 1) walkable++;
      }
      assert.equal(walkable, level.solution.length, '可走格数量必须等于真解长度');
    }
  }
});

test('Determinism: 同一 (规格, 关卡号) 永远生成同一道题', () => {
  for (const size of [6, 10]) {
    for (let seed = 1; seed <= 4; seed++) {
      const a = generateGuaranteedLevel(size, size, seed);
      const b = generateGuaranteedLevel(size, size, seed);
      assert.deepEqual(a.solution, b.solution, `规格 ${size} 第 ${seed} 关必须可复现`);
      assert.deepEqual(a.start, b.start);
    }
  }
});

test('Variety: 同规格相邻关卡不得雷同（题面 / 起点 / 障碍占比都要有变化）', () => {
  const levelCount = 8;

  for (const size of [6, 8, 10, 12]) {
    const shapes = new Set();
    const starts = new Set();

    for (let seed = 1; seed <= levelCount; seed++) {
      const level = generateGuaranteedLevel(size, size, seed);
      let walkable = 0;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) if (level.grid[r][c] === 1) walkable++;
      }
      shapes.add(level.solution.map(([r, c]) => `${r}.${c}`).join('|'));
      starts.add(level.start.join(','));

      const ratio = (size * size - walkable) / (size * size);
      assert.ok(ratio >= 0.03 && ratio <= 0.32, `规格 ${size} 第 ${seed} 关障碍占比 ${ratio.toFixed(2)} 超出 3%~32%`);
    }

    assert.ok(
      shapes.size >= levelCount - 1,
      `规格 ${size} 的 ${levelCount} 关至少要有 ${levelCount - 1} 种题面，实际 ${shapes.size}`
    );
    assert.ok(starts.size >= Math.ceil(levelCount / 2), `规格 ${size} 起点必须分散，实际只有 ${starts.size} 种`);
  }
});

test('Difficulty: 可走区域必须开阔，避免退化成单行走廊', () => {
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const size of [8, 10, 12]) {
    for (let seed = 1; seed <= 4; seed++) {
      const level = generateGuaranteedLevel(size, size, seed);
      let sum = 0;
      let count = 0;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (level.grid[r][c] !== 1) continue;
          let deg = 0;
          for (const [dr, dc] of dirs) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
            if (level.grid[nr][nc] === 1) deg++;
          }
          sum += deg;
          count++;
        }
      }
      assert.ok(count > 0);
      assert.ok(sum / count >= 2.6, `规格 ${size} 第 ${seed} 关平均连通度 ${(sum / count).toFixed(2)} 过低`);
    }
  }
});

test('Config: 每个规格的关卡数量符合设定', () => {
  assert.equal(LEVELS_PER_SIZE[4], 20);
  assert.equal(LEVELS_PER_SIZE[5], 20);
  assert.equal(LEVELS_PER_SIZE[6], 15);
  assert.equal(LEVELS_PER_SIZE[7], 15);
  assert.equal(LEVELS_PER_SIZE[8], 10);
});
