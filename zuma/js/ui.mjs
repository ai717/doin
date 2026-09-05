// 针对主菜单状态过滤战斗实体的拟真渲染器

import { BALL_RADIUS } from './engine.mjs?v=48f76844757c';

let canvas = null;
let ctx = null;

const GEM_PROFILES = {
    '#e94560': { inner: '#ff859d', mid: '#e94560', dark: '#570716', glyph: 'circle' },
    '#f9d342': { inner: '#fff59e', mid: '#f9d342', dark: '#6e5402', glyph: 'triangle' },
    '#4ecca3': { inner: '#adfae1', mid: '#4ecca3', dark: '#0e4a37', glyph: 'spiral' },
    '#3282b8': { inner: '#96d3ff', mid: '#3282b8', dark: '#0b263b', glyph: 'diamond' },
    '#a55eea': { inner: '#debbfd', mid: '#a55eea', dark: '#301054', glyph: 'cross' }
};

export function initUIElements() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

export function getCanvasDimensions() {
    if (!canvas) return { width: 900, height: 600 };
    const rect = canvas.getBoundingClientRect();
    return {
        width: rect.width,
        height: rect.height
    };
}

function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function showScreen(screenId) {
    const screens = ['screen-menu', 'screen-hud', 'screen-pause', 'screen-over', 'screen-win'];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (id === screenId) {
            el.classList.add('active');
        } else if (screenId !== 'screen-pause' && id !== 'screen-hud') {
            el.classList.remove('active');
        }
    });

    if (screenId === 'screen-pause') {
        const pauseEl = document.getElementById('screen-pause');
        if (pauseEl) pauseEl.classList.add('active');
    }
}

export function hidePauseScreen() {
    const pauseEl = document.getElementById('screen-pause');
    if (pauseEl) pauseEl.classList.remove('active');
}

export function updateScoreUI(score, bestScore, diffName = 'MED') {
    const hudScore = document.getElementById('hud-score');
    const hudBest = document.getElementById('hud-best');
    const overScore = document.getElementById('over-score');
    const winScore = document.getElementById('win-score');
    const hudDiff = document.getElementById('hud-diff');

    if (hudScore) hudScore.innerText = score;
    if (hudBest) hudBest.innerText = bestScore;
    if (overScore) overScore.innerText = score;
    if (winScore) winScore.innerText = score;
    if (hudDiff) hudDiff.innerText = diffName;
}

export function renderGame(state) {
    if (!ctx || !canvas) return;
    const { width, height } = canvas.getBoundingClientRect();

    ctx.save();
    if (state.shakeIntensity > 0) {
        const ox = (Math.random() - 0.5) * state.shakeIntensity * 2;
        const oy = (Math.random() - 0.5) * state.shakeIntensity * 2;
        ctx.translate(ox, oy);
    }

    ctx.clearRect(-10, -10, width + 20, height + 20);

    // 1. 神庙玄武岩地砖
    renderAztecTempleGround(ctx, width, height);

    // 2. 深凹石雕滑槽轨道
    if (state.track && state.track.points.length > 1) {
        renderTempleStoneTrack(ctx, state.track.points);
    }

    // 主菜单状态下：仅渲染深邃的神殿轨道背景，不渲染炮台与骷髅，避免视觉杂乱
    const isMenu = state.status === 'MENU';

    // 3. 终点黄金骷髅巨像
    if (!isMenu && state.track && state.track.endPoint) {
        renderGoldenSkullTrap(ctx, state.track.endPoint);
    }

    // 4. 滚动的符文宝石链
    if (!isMenu && state.train && state.track) {
        for (let i = 0; i < state.train.length; i++) {
            const ball = state.train[i];
            if (ball.distance < 0) continue;
            const pt = state.track.getPointAtDistance(ball.distance);
            renderGemBall(ctx, pt.x, pt.y, ball.color, ball.distance, ball.scale || 1.0);
        }
    }

    // 5. 石蟾炮台
    if (!isMenu && state.shooter) {
        renderAimGuide(ctx, state.shooter);
        renderZumaFrog(ctx, state.shooter);
    }

    // 6. 飞行子弹
    if (!isMenu && state.bullets) {
        for (let i = 0; i < state.bullets.length; i++) {
            renderBullet(ctx, state.bullets[i]);
        }
    }

    // 7. 能量扩散光环
    if (state.expandingRings) {
        for (let i = 0; i < state.expandingRings.length; i++) {
            const ring = state.expandingRings[i];
            ctx.save();
            ctx.beginPath();
            ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
            ctx.strokeStyle = ring.color;
            ctx.globalAlpha = Math.max(0, ring.alpha);
            ctx.lineWidth = 3.5;
            ctx.shadowColor = ring.color;
            ctx.shadowBlur = 12;
            ctx.stroke();
            ctx.restore();
        }
    }

    // 8. 碎屑与金粉粒子
    if (state.particles) {
        renderParticles(ctx, state.particles);
    }

    ctx.restore();
}

function renderAztecTempleGround(c, w, h) {
    c.save();
    const tileSize = 64;
    for (let x = 0; x < w; x += tileSize) {
        for (let y = 0; y < h; y += tileSize) {
            c.fillStyle = ((x / tileSize + y / tileSize) % 2 === 0) ? '#10151b' : '#0c1015';
            c.fillRect(x, y, tileSize, tileSize);

            c.strokeStyle = '#05080a';
            c.lineWidth = 2;
            c.strokeRect(x, y, tileSize, tileSize);

            c.strokeStyle = 'rgba(255, 234, 121, 0.03)';
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(x + 1, y + tileSize - 1);
            c.lineTo(x + 1, y + 1);
            c.lineTo(x + tileSize - 1, y + 1);
            c.stroke();
        }
    }

    const radial = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.65);
    radial.addColorStop(0, 'rgba(0, 0, 0, 0)');
    radial.addColorStop(1, 'rgba(2, 3, 5, 0.7)');
    c.fillStyle = radial;
    c.fillRect(0, 0, w, h);

    c.restore();
}

function renderTempleStoneTrack(c, points) {
    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';

    c.beginPath();
    c.strokeStyle = '#1e2630';
    c.lineWidth = BALL_RADIUS * 2 + 24;
    for (let i = 0; i < points.length; i++) {
        if (i === 0) c.moveTo(points[i].x, points[i].y);
        else c.lineTo(points[i].x, points[i].y);
    }
    c.stroke();

    c.beginPath();
    c.strokeStyle = '#040608';
    c.lineWidth = BALL_RADIUS * 2 + 16;
    for (let i = 0; i < points.length; i++) {
        if (i === 0) c.moveTo(points[i].x, points[i].y + 4);
        else c.lineTo(points[i].x, points[i].y + 4);
    }
    c.stroke();

    c.beginPath();
    c.strokeStyle = '#0c1015';
    c.lineWidth = BALL_RADIUS * 2 + 6;
    for (let i = 0; i < points.length; i++) {
        if (i === 0) c.moveTo(points[i].x, points[i].y);
        else c.lineTo(points[i].x, points[i].y);
    }
    c.stroke();

    c.beginPath();
    c.strokeStyle = 'rgba(245, 197, 66, 0.35)';
    c.lineWidth = 3;
    c.setLineDash([12, 14]);
    for (let i = 0; i < points.length; i++) {
        if (i === 0) c.moveTo(points[i].x, points[i].y);
        else c.lineTo(points[i].x, points[i].y);
    }
    c.stroke();

    c.setLineDash([]);
    for (let i = 10; i < points.length; i += 30) {
        const p = points[i];
        c.beginPath();
        c.arc(p.x, p.y, 3, 0, Math.PI * 2);
        c.fillStyle = '#f5c542';
        c.shadowColor = '#f5c542';
        c.shadowBlur = 6;
        c.fill();
        c.shadowBlur = 0;
    }

    c.restore();
}

function renderGoldenSkullTrap(c, ep) {
    c.save();
    c.translate(ep.x, ep.y);

    c.beginPath();
    c.arc(0, 0, BALL_RADIUS * 2.1, 0, Math.PI * 2);
    c.fillStyle = '#080c10';
    c.fill();
    c.lineWidth = 4;
    c.strokeStyle = '#d4af37';
    c.shadowColor = 'rgba(212, 175, 55, 0.4)';
    c.shadowBlur = 15;
    c.stroke();
    c.shadowBlur = 0;

    c.beginPath();
    c.arc(0, -3, 24, 0, Math.PI * 2);
    const skullGrad = c.createLinearGradient(0, -28, 0, 20);
    skullGrad.addColorStop(0, '#f9e076');
    skullGrad.addColorStop(0.5, '#cba028');
    skullGrad.addColorStop(1, '#573d05');
    c.fillStyle = skullGrad;
    c.fill();
    c.strokeStyle = '#fff099';
    c.lineWidth = 2;
    c.stroke();

    c.beginPath();
    c.moveTo(0, -22);
    c.lineTo(6, -14);
    c.lineTo(-6, -14);
    c.closePath();
    c.fillStyle = '#ff3366';
    c.fill();

    c.fillStyle = '#fff8db';
    for (let t = -12; t <= 12; t += 6) {
        c.fillRect(t, 10, 4, 8);
        c.strokeStyle = '#523704';
        c.strokeRect(t, 10, 4, 8);
    }

    c.beginPath();
    c.arc(-9, -6, 5.5, 0, Math.PI * 2);
    c.arc(9, -6, 5.5, 0, Math.PI * 2);
    c.fillStyle = '#ff1744';
    c.shadowColor = '#ff1744';
    c.shadowBlur = 16;
    c.fill();

    c.restore();
}

function renderAimGuide(c, shooter) {
    c.save();
    const fireAngle = shooter.angle - Math.PI / 2;
    const guideLen = 180;
    const startX = shooter.x + Math.cos(fireAngle) * 48;
    const startY = shooter.y + Math.sin(fireAngle) * 48;
    const endX = shooter.x + Math.cos(fireAngle) * (48 + guideLen);
    const endY = shooter.y + Math.sin(fireAngle) * (48 + guideLen);

    c.beginPath();
    c.setLineDash([6, 8]);
    c.moveTo(startX, startY);
    c.lineTo(endX, endY);
    c.strokeStyle = shooter.currentColor || '#f5c542';
    c.globalAlpha = 0.65;
    c.lineWidth = 2.5;
    c.stroke();
    c.restore();
}

function renderZumaFrog(c, shooter) {
    const { x, y, angle, currentColor, nextColor } = shooter;
    c.save();
    c.translate(x, y);

    c.beginPath();
    c.arc(0, 0, 56, 0, Math.PI * 2);
    c.fillStyle = '#10161d';
    c.fill();
    c.strokeStyle = '#cba028';
    c.lineWidth = 4;
    c.stroke();

    c.rotate(angle);

    c.beginPath();
    c.arc(0, 24, BALL_RADIUS * 0.75, 0, Math.PI * 2);
    c.fillStyle = '#080a0d';
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = '#574116';
    c.stroke();

    if (nextColor) {
        renderGemBall(c, 0, 24, nextColor, 0, 0.72);
    }

    c.beginPath();
    c.ellipse(0, 2, 35, 29, 0, 0, Math.PI * 2);
    const frogGrad = c.createRadialGradient(-6, -8, 6, 0, 0, 38);
    frogGrad.addColorStop(0, '#3e8471');
    frogGrad.addColorStop(0.7, '#1b4a3e');
    frogGrad.addColorStop(1, '#091c16');
    c.fillStyle = frogGrad;
    c.fill();
    c.strokeStyle = '#6fe0bd';
    c.lineWidth = 2.5;
    c.stroke();

    c.beginPath();
    c.moveTo(-13, -8);
    c.lineTo(0, -25);
    c.lineTo(13, -8);
    c.closePath();
    c.fillStyle = '#f5c542';
    c.fill();
    c.strokeStyle = '#8a620b';
    c.lineWidth = 2;
    c.stroke();

    renderFrogEye(c, -21, -15);
    renderFrogEye(c, 21, -15);

    c.beginPath();
    c.arc(0, -29, 23, Math.PI * 0.1, Math.PI * 0.9, false);
    c.fillStyle = '#050807';
    c.fill();
    c.lineWidth = 2.5;
    c.strokeStyle = '#6fe0bd';
    c.stroke();

    if (currentColor) {
        renderGemBall(c, 0, -32, currentColor, 0, 1.0);
    }

    c.restore();
}

function renderFrogEye(c, ox, oy) {
    c.beginPath();
    c.arc(ox, oy, 9.5, 0, Math.PI * 2);
    c.fillStyle = '#1b4a3e';
    c.fill();
    c.strokeStyle = '#f5c542';
    c.lineWidth = 2;
    c.stroke();

    c.beginPath();
    c.arc(ox, oy, 5.5, 0, Math.PI * 2);
    c.fillStyle = '#ff1744';
    c.shadowColor = '#ff1744';
    c.shadowBlur = 10;
    c.fill();
    c.shadowBlur = 0;
}

function renderGemBall(c, x, y, color, distance = 0, scale = 1.0) {
    const prof = GEM_PROFILES[color] || { inner: '#fff', mid: color, dark: '#000', glyph: 'circle' };
    const r = BALL_RADIUS * Math.max(0.1, scale);

    c.save();
    c.translate(x, y);

    c.beginPath();
    c.arc(2, 4, r, 0, Math.PI * 2);
    c.fillStyle = 'rgba(0, 0, 0, 0.55)';
    c.fill();

    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    const grad = c.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
    grad.addColorStop(0, prof.inner);
    grad.addColorStop(0.55, prof.mid);
    grad.addColorStop(1, prof.dark);
    c.fillStyle = grad;
    c.fill();

    c.save();
    c.rotate((distance * 0.04) % (Math.PI * 2));
    c.strokeStyle = 'rgba(255, 255, 255, 0.48)';
    c.lineWidth = 2 * scale;
    drawGlyph(c, prof.glyph, r * 0.52);
    c.restore();

    c.beginPath();
    c.ellipse(-r * 0.36, -r * 0.36, r * 0.36, r * 0.2, -Math.PI / 4, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255, 255, 255, 0.75)';
    c.fill();

    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(245, 197, 66, 0.35)';
    c.lineWidth = 1.5;
    c.stroke();

    c.restore();
}

function drawGlyph(c, type, size) {
    c.beginPath();
    if (type === 'circle') {
        c.arc(0, 0, size * 0.65, 0, Math.PI * 2);
    } else if (type === 'triangle') {
        c.moveTo(0, -size);
        c.lineTo(size * 0.86, size * 0.6);
        c.lineTo(-size * 0.86, size * 0.6);
        c.closePath();
    } else if (type === 'spiral') {
        c.arc(0, 0, size * 0.7, 0, Math.PI * 1.6);
    } else if (type === 'diamond') {
        c.moveTo(0, -size);
        c.lineTo(size, 0);
        c.lineTo(0, size);
        c.lineTo(-size, 0);
        c.closePath();
    } else if (type === 'cross') {
        c.moveTo(-size, 0);
        c.lineTo(size, 0);
        c.moveTo(0, -size);
        c.lineTo(0, size);
    }
    c.stroke();
}

function renderBullet(c, bullet) {
    c.save();
    c.beginPath();
    c.moveTo(bullet.x, bullet.y);
    c.lineTo(bullet.x - bullet.vx * 3, bullet.y - bullet.vy * 3);
    c.strokeStyle = bullet.color;
    c.lineWidth = BALL_RADIUS * 1.3;
    c.lineCap = 'round';
    c.globalAlpha = 0.55;
    c.stroke();
    c.globalAlpha = 1.0;

    renderGemBall(c, bullet.x, bullet.y, bullet.color, 0, 1.06);
    c.restore();
}

function renderParticles(c, particles) {
    c.save();
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        c.beginPath();
        c.arc(p.x, p.y, Math.max(0.5, p.radius), 0, Math.PI * 2);
        c.fillStyle = p.color;
        c.globalAlpha = Math.max(0, p.alpha);
        c.shadowColor = p.color;
        c.shadowBlur = 10;
        c.fill();
    }
    c.restore();
}