import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createSpiralTrack,
    createLevelSpawner,
    updateTrainPhysics,
    scanAndEliminateAllMatches,
    detectBulletCollision,
    insertBallIntoTrain,
    DIFFICULTY_CONFIG,
    BALL_DIAMETER
} from '../js/engine.mjs';

test('updateTrainPhysics: 彻底解决同色断层不回退死锁 Bug', () => {
    // 还原用户最新截图中场景：两颗黄球断开面对前方另外两颗黄球
    const train = [
        { id: 1, color: '#f9d342', distance: 100 },
        { id: 2, color: '#f9d342', distance: 140 }, // 后段头部为黄色
        { id: 3, color: '#f9d342', distance: 260 }, // 前段尾部为黄色（相隔 120px 断层）
        { id: 4, color: '#f9d342', distance: 300 }
    ];
    const pendingQueue = [];

    const prevFrontTailDist = train[2].distance;
    const prevFrontHeadDist = train[3].distance;

    updateTrainPhysics(train, pendingQueue, 0.3);

    // 验证前段两颗黄球无死锁，稳定向后倒吸！
    assert.ok(train[2].distance < prevFrontTailDist, '断层同色时前段尾球必须稳定向后倒吸！');
    assert.ok(train[3].distance < prevFrontHeadDist, '前段龙头球必须刚体协同向后倒吸！');
});

test('scanAndEliminateAllMatches: 全局三连紧贴即刻消除', () => {
    const train = [
        { id: 1, color: '#e94560', distance: 100 },
        { id: 2, color: '#e94560', distance: 140 },
        { id: 3, color: '#e94560', distance: 180 },
        { id: 4, color: '#3282b8', distance: 220 }
    ];

    const match = scanAndEliminateAllMatches(train);
    assert.equal(match.count, 3, '紧贴的3颗同色球必须立即消除！');
    assert.equal(match.color, '#e94560');
    assert.equal(train.length, 1);
});
