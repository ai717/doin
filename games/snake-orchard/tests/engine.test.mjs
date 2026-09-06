import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, DIRECTIONS, OPPOSITES, createPseudoRandom } from '../js/engine.mjs';

test('Engine - 初始化初始状态正确', () => {
  const engine = new Engine({ gridWidth: 20, gridHeight: 20 });
  const state = engine.getState();

  assert.equal(state.gridWidth, 20);
  assert.equal(state.gridHeight, 20);
  assert.equal(state.snake.length, 3);
  assert.equal(state.direction, 'RIGHT');
  assert.equal(state.isDead, false);
  assert.equal(state.lastEvent, null);
  assert.notEqual(state.normalFruit, null);
  assert.equal(typeof state.normalFruit.x, 'number');
  assert.equal(typeof state.normalFruit.y, 'number');
});

test('Engine - 反向掉头操作安全限制 (no-op)', () => {
  const engine = new Engine({ gridWidth: 20, gridHeight: 20 });

  // 初始向右移动，试图反向向左应被引擎拦截为合法 no-op
  assert.equal(engine.setDirection('LEFT'), false);
  assert.equal(engine.pendingDirection, 'RIGHT');

  // 转向向下应合法生效
  assert.equal(engine.setDirection('DOWN'), true);
  assert.equal(engine.pendingDirection, 'DOWN');
  engine.step();
  assert.equal(engine.direction, 'DOWN');

  // 当前向下，试图反向向上应被安全拒绝
  assert.equal(engine.setDirection('UP'), false);
  assert.equal(engine.pendingDirection, 'DOWN');
});

test('Engine - 撞墙碰撞判定与死亡标记', () => {
  const engine = new Engine({ gridWidth: 10, gridHeight: 10 });
  engine.reset();
  // 初始蛇头位于中点 (5, 5)，连续向右移动触发越界
  for (let i = 0; i < 5; i++) {
    engine.step();
  }
  const state = engine.getState();
  assert.equal(state.isDead, true);
  assert.equal(state.lastEvent, 'die');

  // 死亡后继续 step 仍为 safe no-op，保持死亡标记
  const afterDeadState = engine.step();
  assert.equal(afterDeadState.isDead, true);
});

test('Engine - 身体自撞精准判定', () => {
  const engine = new Engine({ gridWidth: 20, gridHeight: 20 });
  // 注入一条长蛇并折返环绕
  engine.snake = [
    { x: 5, y: 5 },
    { x: 4, y: 5 },
    { x: 4, y: 6 },
    { x: 5, y: 6 },
    { x: 6, y: 6 }
  ];
  engine.direction = 'UP';
  engine.pendingDirection = 'UP';
  engine.normalFruit = { x: 0, y: 0, type: 'normal' };

  // (5,5) 向上走是 (5,4)，为空位
  engine.step();
  assert.equal(engine.isDead, false);

  // 向左走 (4,4)
  engine.setDirection('LEFT');
  engine.step();
  assert.equal(engine.isDead, false);

  // 向下走到 (4,5) —— 该坐标仍在蛇身占据中，触发自撞死亡
  engine.setDirection('DOWN');
  const state = engine.step();
  assert.equal(state.isDead, true);
  assert.equal(state.lastEvent, 'die');
});

test('Engine - PRNG 确定性与果实刷新重现', () => {
  const rng1 = createPseudoRandom(42);
  const rng2 = createPseudoRandom(42);

  const seq1 = [rng1(), rng1(), rng1()];
  const seq2 = [rng2(), rng2(), rng2()];

  assert.deepEqual(seq1, seq2);

  const seededEngine1 = new Engine({ gridWidth: 15, gridHeight: 15, random: createPseudoRandom(999) });
  const seededEngine2 = new Engine({ gridWidth: 15, gridHeight: 15, random: createPseudoRandom(999) });

  assert.deepEqual(seededEngine1.normalFruit, seededEngine2.normalFruit);
});
