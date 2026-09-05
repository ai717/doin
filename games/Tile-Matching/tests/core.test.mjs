import test from 'node:test';
import assert from 'node:assert/strict';

import {
  Match3Engine,
  BOARD_ROWS,
  BOARD_COLS
} from '../js/engine.mjs';
import { LEVEL_CONFIGS, getLevelConfig } from '../js/levels.mjs';

test('LevelConfig: 50 关完备性与波浪曲线验证', () => {
  assert.equal(LEVEL_CONFIGS.length, 50, '必须严格支持 50 个预设关卡');

  LEVEL_CONFIGS.forEach((lvl, idx) => {
    assert.equal(lvl.id, idx + 1);
    assert.ok(lvl.moves >= 15 && lvl.moves <= 35, `关卡 ${lvl.id} 步数需合理`);
    assert.ok(lvl.colors >= 4 && lvl.colors <= 6, `关卡 ${lvl.id} 颜色需在 4-6 之间`);
    assert.ok(Object.keys(lvl.goals).length >= 1, `关卡 ${lvl.id} 必须包含目标`);
    assert.equal(lvl.starThresholdMoves.length, 3);
  });

  const fallback = getLevelConfig(999);
  assert.equal(fallback.id, 1);
});

test('Match3Engine: 满格永续与重力坍缩无空隙', () => {
  const engine = new Match3Engine(5);
  engine.initBoard();

  // 清除中间与底部方块
  engine.grid[7][0] = null;
  engine.grid[6][0] = null;
  engine.grid[3][0] = null;

  const drops = engine.dropAndFill();
  assert.ok(drops.length > 0);

  // 验证坍缩补全后依然全满
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      assert.notEqual(engine.grid[r][c], null, `格子 (${r}, ${c}) 绝不可悬空`);
    }
  }
});
