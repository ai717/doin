// 统一状态调度器：持续执行全局同色三连扫描消除，杜绝任何假死与漏消

import {
    createSpiralTrack,
    createLevelSpawner,
    updateTrainPhysics,
    scanAndEliminateAllMatches,
    detectBulletCollision,
    insertBallIntoTrain,
    generateRandomColor,
    DIFFICULTY_CONFIG,
    BALL_RADIUS
} from './engine.mjs?v=48f76844757c';

import {
    getCanvasDimensions,
    renderGame,
    showScreen,
    hidePauseScreen,
    updateScoreUI
} from './ui.mjs?v=48f76844757c';

import { addScore, resetScore, getScore, nextLevel, resetLevel, getLevel, getBestScore } from './score.mjs?v=48f76844757c';
import { playShootSound, playMatchSound, playDefeatSound, playVictorySound } from './audio.mjs?v=48f76844757c';

export const GameState = {
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAMEOVER: 'GAMEOVER',
    WIN: 'WIN'
};

const state = {
    status: GameState.MENU,
    currentDiff: 'medium',
    track: null,
    train: [],
    pendingQueue: [],
    bullets: [],
    particles: [],
    expandingRings: [],
    shakeIntensity: 0,
    comboStreak: 0,
    shooter: {
        x: 0,
        y: 0,
        angle: 0,
        currentColor: '',
        nextColor: ''
    },
    baseSpeed: 0.30
};

export function setDifficulty(diff) {
    if (DIFFICULTY_CONFIG[diff]) {
        state.currentDiff = diff;
        updateScoreUI(getScore(), getBestScore(), DIFFICULTY_CONFIG[diff].name);
        syncDifficultyUI(diff);
    }
}

export function getDifficulty() {
    return state.currentDiff;
}

export function syncDifficultyUI(diff) {
    document.querySelectorAll('.diff-btn').forEach(btn => {
        if (btn.getAttribute('data-diff') === diff) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

export function initGame() {
    const dim = getCanvasDimensions();
    state.track = createSpiralTrack(dim.width, dim.height);
    state.shooter.x = dim.width / 2;
    state.shooter.y = dim.height / 2;
    resetScore();
    resetLevel();
    updateScoreUI(0, getBestScore(), DIFFICULTY_CONFIG[state.currentDiff].name);
    syncDifficultyUI(state.currentDiff);
    showScreen('screen-menu');
    requestAnimationFrame(gameLoop);
}

export function goToMenu() {
    state.status = GameState.MENU;
    hidePauseScreen();
    showScreen('screen-menu');
}

export function startNewGame(keepScore = false) {
    if (!keepScore) {
        resetScore();
        resetLevel();
    }

    const cfg = DIFFICULTY_CONFIG[state.currentDiff] || DIFFICULTY_CONFIG.medium;
    const dim = getCanvasDimensions();
    
    state.track = createSpiralTrack(dim.width, dim.height);
    state.shooter.x = dim.width / 2;
    state.shooter.y = dim.height / 2;

    const currentLvl = getLevel();
    const ballCount = cfg.ballCount + Math.min(currentLvl * 4, 30);
    state.baseSpeed = cfg.baseSpeed + Math.min(currentLvl * cfg.speedIncrement, 0.4);

    state.pendingQueue = createLevelSpawner(ballCount, cfg.colors);
    state.train = [];
    const firstColor = state.pendingQueue.shift();
    state.train.push({
        id: 1,
        color: firstColor,
        distance: 0,
        scale: 1.0
    });

    state.bullets = [];
    state.particles = [];
    state.expandingRings = [];
    state.shakeIntensity = 0;
    state.comboStreak = 0;

    state.shooter.currentColor = getAvailableTrainColor(state.train, state.pendingQueue, cfg.colors);
    state.shooter.nextColor = getAvailableTrainColor(state.train, state.pendingQueue, cfg.colors);

    state.status = GameState.PLAYING;
    updateScoreUI(getScore(), getBestScore(), cfg.name);
    showScreen('screen-hud');
}

function getAvailableTrainColor(train, pendingQueue, fallbackColors) {
    const activeColors = new Set();
    if (train) train.forEach(b => activeColors.add(b.color));
    if (pendingQueue && pendingQueue.length > 0) {
        for (let i = 0; i < Math.min(5, pendingQueue.length); i++) {
            activeColors.add(pendingQueue[i]);
        }
    }
    const pool = Array.from(activeColors);
    if (pool.length > 0) {
        return generateRandomColor(pool);
    }
    return generateRandomColor(fallbackColors);
}

export function handleAim(clientX, clientY) {
    if (state.status !== GameState.PLAYING && state.status !== GameState.PAUSED) return;
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const targetX = clientX - rect.left;
    const targetY = clientY - rect.top;

    state.shooter.angle = Math.atan2(targetY - state.shooter.y, targetX - state.shooter.x) + Math.PI / 2;
}

export function shootBall() {
    if (state.status !== GameState.PLAYING) return;

    const cfg = DIFFICULTY_CONFIG[state.currentDiff] || DIFFICULTY_CONFIG.medium;
    const speed = 15;
    const fireAngle = state.shooter.angle - Math.PI / 2;

    state.bullets.push({
        x: state.shooter.x + Math.cos(fireAngle) * 36,
        y: state.shooter.y + Math.sin(fireAngle) * 36,
        vx: Math.cos(fireAngle) * speed,
        vy: Math.sin(fireAngle) * speed,
        color: state.shooter.currentColor
    });

    state.shooter.currentColor = state.shooter.nextColor;
    state.shooter.nextColor = getAvailableTrainColor(state.train, state.pendingQueue, cfg.colors);
    playShootSound();
}

export function togglePause() {
    if (state.status === GameState.PLAYING) {
        state.status = GameState.PAUSED;
        syncDifficultyUI(state.currentDiff);
        showScreen('screen-pause');
    } else if (state.status === GameState.PAUSED) {
        state.status = GameState.PLAYING;
        hidePauseScreen();
    }
}

export function triggerEliminationVisuals(removedBalls, color) {
    state.shakeIntensity = Math.min(10, state.shakeIntensity + 5);

    removedBalls.forEach(ball => {
        const pt = state.track.getPointAtDistance(ball.distance);
        for (let i = 0; i < 14; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = Math.random() * 5 + 2;
            state.particles.push({
                x: pt.x,
                y: pt.y,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                radius: Math.random() * 4 + 2,
                alpha: 1.0,
                color
            });
        }
        state.expandingRings.push({
            x: pt.x,
            y: pt.y,
            radius: BALL_RADIUS * 0.8,
            maxRadius: BALL_RADIUS * 2.6,
            alpha: 0.95,
            color
        });
    });
}

function updatePhysics() {
    if (state.status !== GameState.PLAYING) return;

    // 1. 物理位置迭代与多断层持续回退
    updateTrainPhysics(state.train, state.pendingQueue, state.baseSpeed);

    // 2. 全局三连消除扫描（彻底解决截图中黄球相连不消除的 Bug！）
    const match = scanAndEliminateAllMatches(state.train);
    if (match.count >= 3) {
        state.comboStreak++;
        addScore(match.count * 10 * state.comboStreak);
        playMatchSound(state.comboStreak);
        triggerEliminationVisuals(match.removedBalls, match.color);
    }

    // 3. 弹性恢复
    state.train.forEach(ball => {
        if (ball.scale < 1.0) {
            ball.scale = Math.min(1.0, ball.scale + 0.12);
        }
    });

    // 4. 胜负检测
    if (state.train.length > 0) {
        const headBall = state.train[state.train.length - 1];
        if (headBall.distance >= state.track.totalLength) {
            state.status = GameState.GAMEOVER;
            playDefeatSound();
            showScreen('screen-over');
            return;
        }
    } else if (state.pendingQueue.length === 0) {
        state.status = GameState.WIN;
        playVictorySound();
        nextLevel();
        showScreen('screen-win');
        return;
    }

    // 5. 子弹飞行与碰撞检测
    const dim = getCanvasDimensions();
    for (let b = state.bullets.length - 1; b >= 0; b--) {
        const bullet = state.bullets[b];
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        const hit = detectBulletCollision(bullet, state.train, state.track);
        if (hit) {
            insertBallIntoTrain(state.train, hit.index, bullet.color);
            state.bullets.splice(b, 1);
            state.comboStreak = 0; // 重置连击
            continue;
        }

        if (bullet.x < 0 || bullet.x > dim.width || bullet.y < 0 || bullet.y > dim.height) {
            state.bullets.splice(b, 1);
        }
    }

    // 6. 粒子衰减
    for (let p = state.particles.length - 1; p >= 0; p--) {
        const part = state.particles[p];
        part.x += part.vx;
        part.y += part.vy;
        part.alpha -= 0.032;
        part.radius *= 0.94;
        if (part.alpha <= 0) {
            state.particles.splice(p, 1);
        }
    }

    // 7. 光环衰减
    for (let r = state.expandingRings.length - 1; r >= 0; r--) {
        const ring = state.expandingRings[r];
        ring.radius += 2.0;
        ring.alpha -= 0.045;
        if (ring.alpha <= 0) {
            state.expandingRings.splice(r, 1);
        }
    }

    // 8. 屏幕震颤衰减
    if (state.shakeIntensity > 0) {
        state.shakeIntensity *= 0.88;
        if (state.shakeIntensity < 0.2) state.shakeIntensity = 0;
    }
}

function gameLoop() {
    updatePhysics();
    renderGame(state);
    requestAnimationFrame(gameLoop);
}
