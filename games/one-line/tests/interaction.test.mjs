import test from 'node:test';
import assert from 'node:assert/strict';
import { OneLineEngine, generateGuaranteedLevel } from '../js/engine.mjs';
import { calculateStars, extraForwardCount } from '../js/score.mjs';

function emptyLevel(n) {
  return {
    id: 1,
    rows: n,
    cols: n,
    start: [0, 0],
    grid: Array.from({ length: n }, () => Array(n).fill(1)),
    solution: []
  };
}

function assertPathLegal(engine) {
  const seen = new Set();
  engine.path.forEach(([r, c], i) => {
    const key = `${r},${c}`;
    assert.equal(seen.has(key), false, `第 ${i} 格不得重复`);
    seen.add(key);
    assert.equal(engine.grid[r][c], 1, `第 ${i} 格必须可走`);
    if (i > 0) {
      const [pr, pc] = engine.path[i - 1];
      assert.equal(Math.abs(pr - r) + Math.abs(pc - c), 1, `第 ${i} 格必须与前一格正交相邻`);
    }
  });
}

test('Input: 快速滑动跨格时，中间格必须被补齐而不是断笔', () => {
  const engine = new OneLineEngine(emptyLevel(5));
  assert.equal(engine.moveToCell(0, 1).kind, 'advance');

  const res = engine.moveToCell(0, 3);
  assert.equal(res.success, true, '跨一格的目标必须被接受');
  assert.equal(res.kind, 'bridge');
  assert.deepEqual(
    engine.path.map(([r, c]) => `${r},${c}`),
    ['0,0', '0,1', '0,2', '0,3'],
    '中间格必须依次连上'
  );
  assertPathLegal(engine);
});

test('Input: 对角线滑走 L 形补齐，补齐结果仍然是合法单链', () => {
  const engine = new OneLineEngine(emptyLevel(5));
  const res = engine.moveToCell(2, 2);

  assert.equal(res.success, true, '对角线方向的滑必须在 L 形通路成立时补齐');
  assertPathLegal(engine);
  assert.equal(engine.path.length, 5, 'L 形路径应恰好覆盖 5 个格子');
});

test('Input: 超过补齐上限的远距离拖动必须被拒绝', () => {
  const engine = new OneLineEngine(emptyLevel(12));
  const res = engine.moveToCell(0, 11);

  assert.equal(res.success, false, '跨越大半张棋盘的输入不能当作划动');
  assert.equal(res.reason, 'not_adjacent');
  assert.equal(engine.path.length, 1, '被拒绝时不得改动任何路径');
});

test('Input: 点击已走过的格子可以一步跳退到那里', () => {
  const engine = new OneLineEngine(emptyLevel(5));
  engine.moveToCell(0, 3);

  const res = engine.moveToCell(0, 1);
  assert.equal(res.success, true);
  assert.equal(res.kind, 'back');
  assert.equal(res.steps, 2);
  assert.deepEqual(
    engine.path.map(([r, c]) => `${r},${c}`),
    ['0,0', '0,1']
  );
});

test('Input: 滑回上一步与点击撤销按钮共用同一套回退语义', () => {
  const a = new OneLineEngine(emptyLevel(5));
  a.moveToCell(0, 2);
  a.moveToCell(0, 1);
  assert.equal(a.backtrackCount, 1, '滑回必须记为一次回退');

  const b = new OneLineEngine(emptyLevel(5));
  b.moveToCell(0, 2);
  b.undo();
  assert.equal(b.backtrackCount, 1, '按钮撤销同样记为一次回退');
  assert.equal(b.path.length, 2);
});

test('Star: forwardCount 只增不减，完美路线恰好等于 targetCount - 1', () => {
  for (const seed of [1, 2, 3]) {
    const level = generateGuaranteedLevel(6, 6, seed);
    const engine = new OneLineEngine(level);

    for (let i = 1; i < level.solution.length; i++) {
      const [r, c] = level.solution[i];
      assert.equal(engine.moveToCell(r, c).success, true, `第 ${i} 步必须合法`);
    }

    assert.equal(engine.forwardCount, engine.targetCount - 1, '完美路线不得产生多余步数');
    assert.equal(extraForwardCount(engine), 0);
  }
});

test('Star: 回退不冲销步数，重走的格子自然计为多余步数', () => {
  const engine = new OneLineEngine(emptyLevel(5));
  engine.moveToCell(0, 1);
  engine.moveToCell(0, 2);
  const before = engine.forwardCount;

  engine.moveToCell(0, 1);
  engine.moveToCell(0, 2);
  assert.equal(engine.forwardCount, before + 1, '重走一遍会让前进步数继续累加');
  assert.equal(engine.backtrackCount, 1);
});

test('Star: 星级换算以多余步数与提示次数为准', () => {
  const perfect = { targetCount: 20, forwardCount: 19, elapsedTimeSeconds: 5 };
  assert.equal(calculateStars(perfect), 3);
  assert.equal(calculateStars({ ...perfect, hintCount: 1 }), 2, '用过提示就拿不到三星');
  assert.equal(calculateStars({ ...perfect, elapsedTimeSeconds: 999 }), 2, '严重超时拿不到三星');
  assert.equal(calculateStars({ ...perfect, forwardCount: 22 }), 2);
  assert.equal(calculateStars({ ...perfect, forwardCount: 40 }), 1);
  assert.equal(calculateStars({ ...perfect, forwardCount: 5 }), 0, '没走完不给星');
});
