import test from 'node:test';
import assert from 'node:assert/strict';

import { PhysicsEngine, GAME_STATES } from '../js/engine.mjs';
import { ScoreSystem, MAX_SINGLE_GAME_SCORE } from '../js/score.mjs';
import { loadSaveData, saveGameRecord } from '../js/storage.mjs';
import { TRANSLATIONS, setLanguage, t } from '../js/i18n.mjs';

test('1. 计分系统 (ScoreSystem) 边界与单局上限测试', () => {
  const scoreSys = new ScoreSystem();
  assert.equal(scoreSys.getScore(), 0, '初始分数应为 0');

  // 普通消除砖块
  const added = scoreSys.addBrickBreak(1, false, 1);
  assert.equal(added, 50, 'Tier 1 基础砖块分应为 50');
  assert.equal(scoreSys.getScore(), 50);

  // 连击累加与重置
  scoreSys.addBrickBreak(1, false, 1);
  assert.equal(scoreSys.getStreak(), 2, '连续击碎应累计连击数');
  scoreSys.resetStreak();
  assert.equal(scoreSys.getStreak(), 0, '丢失底板后连击应被重置为 0');

  // 星环通关加分
  scoreSys.addSectorClearBonus(1);
  assert.equal(scoreSys.getScore(), 50 + 52 + 1000);

  // 上限溢出截断保护 (Clamping)
  const hugeScoreSys = new ScoreSystem(MAX_SINGLE_GAME_SCORE - 10);
  hugeScoreSys.addSectorClearBonus(10);
  assert.equal(
    hugeScoreSys.getScore(),
    MAX_SINGLE_GAME_SCORE,
    '得分绝不能超过单局最大得分限制'
  );
});

test('2. 物理与规则引擎 (PhysicsEngine) 初始状态与生命周期', () => {
  // 注入固定伪随机数生成器 (PRNG)，确保确定性测试
  let seed = 42;
  const mockRandom = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const engine = new PhysicsEngine(600, 800, mockRandom);
  assert.equal(engine.state, GAME_STATES.READY);
  assert.equal(engine.lives, 3);
  assert.equal(engine.sector, 1);

  // 加载第 1 关
  engine.loadSector(1);
  assert.ok(engine.bricks.length > 0, '关卡砖块应当被生成');
  assert.equal(engine.balls.length, 1, '初始化时应有且仅有 1 颗待发射主球');
  assert.equal(engine.balls[0].stuckToPaddle, true, '主球初始必须吸附在底板上');

  // 发射操作
  const launched = engine.launchBall();
  assert.equal(launched, true, '小球应被成功弹出');
  assert.equal(engine.balls[0].stuckToPaddle, false, '弹出后小球脱离底板');

  // 重复发射应安全返回 false
  const repeatLaunch = engine.launchBall();
  assert.equal(repeatLaunch, false, '没有待发射球时不应报错，安全返回 false');
});

test('3. 终止状态 (GAME_OVER / VICTORY) 下的操作为安全 no-op', () => {
  const engine = new PhysicsEngine(600, 800);
  engine.state = GAME_STATES.GAMEOVER;

  const initialPaddleX = engine.paddle.x;
  engine.setPaddlePosition(100);
  assert.equal(engine.paddle.x, initialPaddleX, '游戏结束后设置底板应安全忽略，不改变状态');

  const events = engine.step(0.016);
  assert.deepEqual(events, [], '游戏结束后 step() 调用必须直接返回空事件');
});

test('4. 记忆切片肉鸽机制 (Draft & Relic System)', () => {
  const engine = new PhysicsEngine(600, 800);
  engine.loadSector(1);
  engine.state = GAME_STATES.DRAFTING;

  engine.prepareDraftChoices();
  assert.equal(engine.draftPool.length, 3, '每轮应从剩余切片中提供 3 个不同选项');

  // 选择“时空阻尼带”（底板变宽）
  const originalWidth = engine.paddle.w;
  const chosenId = 'relic_chronos_buffer';
  const success = engine.selectRelic(chosenId);

  assert.equal(success, true);
  assert.ok(engine.activeRelics.has(chosenId), '被动特质应被加入玩家同调列表');
  assert.ok(engine.paddle.w > originalWidth, '获得时空阻尼带后底板宽度应按比例扩展');
  assert.equal(engine.state, GAME_STATES.PLAYING, '选择切片后应重返 PLAYING 状态');
  assert.equal(engine.sector, 2, '选择切片后星环层级应自动递增至 2');
});

test('5. 国际化 (i18n) 键值完全对应与双语切换', () => {
  const zhKeys = Object.keys(TRANSLATIONS.zh).sort();
  const enKeys = Object.keys(TRANSLATIONS.en).sort();

  assert.deepEqual(
    zhKeys,
    enKeys,
    '中英文语言包键列表必须 100% 严格一致，不允许出现缺失项'
  );

  setLanguage('en');
  assert.equal(t('gameTitle'), 'Gravity Echoes');
  setLanguage('zh');
  assert.equal(t('gameTitle'), '重力回响');
});

test('6. 存档系统 (Storage) 容错与降级', () => {
  // 模拟全局环境无 localStorage（例如安全模式或某些 WebView）
  const originalLocalStorage = globalThis.localStorage;
  delete globalThis.localStorage;

  const fallbackData = loadSaveData();
  assert.equal(fallbackData.highScore, 0, '缺失 localStorage 时必须回退到默认零值');

  const saved = saveGameRecord({ score: 9999, sector: 3 });
  assert.equal(saved.highScore, 9999, '即使存储不可用，记录计算仍然安全生效');

  // 恢复环境
  globalThis.localStorage = originalLocalStorage;
});
