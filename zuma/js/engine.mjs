// 经典祖玛真正物理模型：刚体分段（Rigid Segments）独立驱动、磁吸回滚无死锁吸附与全局三连消

export const BALL_RADIUS = 20;
export const BALL_DIAMETER = BALL_RADIUS * 2;

export const ALL_COLORS = ['#e94560', '#f9d342', '#4ecca3', '#3282b8', '#a55eea'];

export const DIFFICULTY_CONFIG = {
    easy: {
        name: 'EASY',
        colors: ALL_COLORS.slice(0, 3),
        baseSpeed: 0.22,
        ballCount: 22,
        speedIncrement: 0.03
    },
    medium: {
        name: 'MED',
        colors: ALL_COLORS.slice(0, 4),
        baseSpeed: 0.30,
        ballCount: 28,
        speedIncrement: 0.05
    },
    hard: {
        name: 'HARD',
        colors: ALL_COLORS,
        baseSpeed: 0.42,
        ballCount: 36,
        speedIncrement: 0.07
    }
};

export function createSpiralTrack(width, height) {
    const points = [];
    const centerX = width / 2;
    const centerY = height / 2;
    const samples = 450;

    const maxRadiusX = width * 0.43;
    const maxRadiusY = height * 0.41;
    const minRadius = Math.min(width, height) * 0.16;
    const turns = 2.2;

    for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const angle = t * turns * Math.PI * 2 + Math.PI * 0.15;
        const radiusFactor = 1 - Math.pow(t, 0.88);
        
        const curRx = minRadius + (maxRadiusX - minRadius) * radiusFactor;
        const curRy = minRadius + (maxRadiusY - minRadius) * radiusFactor;

        const x = centerX + Math.cos(angle) * curRx;
        const y = centerY + Math.sin(angle) * curRy;
        points.push({ x, y });
    }

    const pathDistances = [0];
    for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        pathDistances.push(pathDistances[i - 1] + Math.hypot(dx, dy));
    }

    const totalLength = pathDistances[pathDistances.length - 1];

    function getPointAtDistance(distance) {
        const targetDist = Math.max(0, Math.min(distance, totalLength));
        let low = 0;
        let high = pathDistances.length - 1;

        while (low <= high) {
            const mid = (low + high) >> 1;
            if (pathDistances[mid] < targetDist) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        const idx = Math.max(1, Math.min(low, pathDistances.length - 1));
        const segStart = pathDistances[idx - 1];
        const segEnd = pathDistances[idx];
        const ratio = segEnd === segStart ? 0 : (targetDist - segStart) / (segEnd - segStart);

        const p0 = points[idx - 1];
        const p1 = points[idx];

        return {
            x: p0.x + (p1.x - p0.x) * ratio,
            y: p0.y + (p1.y - p0.y) * ratio
        };
    }

    return {
        points,
        totalLength,
        getPointAtDistance,
        endPoint: points[points.length - 1]
    };
}

export function generateRandomColor(availableColors = ALL_COLORS, rng = Math.random) {
    const idx = Math.floor(rng() * availableColors.length);
    return availableColors[idx];
}

export function createLevelSpawner(count, availableColors, rng = Math.random) {
    const pendingQueue = [];
    for (let i = 0; i < count; i++) {
        let color = generateRandomColor(availableColors, rng);
        if (i >= 2 && pendingQueue[i - 1] === color && pendingQueue[i - 2] === color) {
            const pool = availableColors.filter(c => c !== color);
            color = pool[Math.floor(rng() * pool.length)];
        }
        pendingQueue.push(color);
    }
    return pendingQueue;
}

/**
 * 彻底重写物理引擎：基于刚体段（Rigid Train Segment）
 * 彻底消除前球后球相互锁死的冲突 Bug。
 */
export function updateTrainPhysics(train, pendingQueue, baseSpeed) {
    if (!train) return;

    const ROLLBACK_SPEED = 3.0; // 磁吸倒滚速度

    // 1. 无缝出球机制：起点空位自动补充新球
    if (pendingQueue && pendingQueue.length > 0) {
        if (train.length === 0) {
            train.push({
                id: Date.now() + Math.random(),
                color: pendingQueue.shift(),
                distance: 0,
                scale: 1.0
            });
        } else {
            const tailBall = train[0];
            if (tailBall.distance >= BALL_DIAMETER) {
                train.unshift({
                    id: Date.now() + Math.random(),
                    color: pendingQueue.shift(),
                    distance: tailBall.distance - BALL_DIAMETER,
                    scale: 1.0
                });
            }
        }
    }

    if (train.length === 0) return;

    // 2. 将整条球链严格划分为“刚体段 (Rigid Segment)”
    // 段内小球彼此物理紧贴（间距约为 BALL_DIAMETER），段与段之间存在物理间隙（Gap）
    const segments = [];
    let curSeg = [train[0]];

    for (let i = 1; i < train.length; i++) {
        const prevBall = train[i - 1];
        const thisBall = train[i];
        // 只要两球中心间距大于 直径 + 0.8px，必定属于两个独立的断开段！
        if (thisBall.distance - prevBall.distance > BALL_DIAMETER + 0.8) {
            segments.push(curSeg);
            curSeg = [thisBall];
        } else {
            curSeg.push(thisBall);
        }
    }
    segments.push(curSeg);

    // 3. 计算每一段的运动速度（向前推进 vs 向后磁吸）
    // 默认：所有刚体段均以 baseSpeed 稳定向前推进（绝不发生孤立球卡死！）
    const segSpeeds = new Array(segments.length).fill(baseSpeed);

    // 从后向前扫描断层：如果段 s-1 的头部球与段 s 的尾部球同色，
    // 则说明存在同色断口，从段 s 开始的前方所有段，必须强行倒吸回退！
    for (let s = segments.length - 1; s >= 1; s--) {
        const frontSeg = segments[s];
        const backSeg = segments[s - 1];

        const frontTail = frontSeg[0];
        const backHead = backSeg[backSeg.length - 1];

        if (frontTail.color === backHead.color) {
            // 同色断层：前方全部倒退！
            for (let k = s; k < segments.length; k++) {
                segSpeeds[k] = -ROLLBACK_SPEED;
            }
            break; // 优先被深层同色断口强烈拉回
        }
    }

    // 4. 将速度施加到各个段内的小球上
    for (let s = 0; s < segments.length; s++) {
        const spd = segSpeeds[s];
        const seg = segments[s];
        for (let b = 0; b < seg.length; b++) {
            seg[b].distance += spd;
        }
    }

    // 5. 段间撞击闭合与刚体约束校准（防止倒吸撞穿，或者推挤穿模）
    for (let s = 0; s < segments.length - 1; s++) {
        const backSeg = segments[s];
        const frontSeg = segments[s + 1];

        const backHead = backSeg[backSeg.length - 1];
        const frontTail = frontSeg[0];
        const minAllowedDistance = backHead.distance + BALL_DIAMETER;

        // 如果前段倒退撞上了后段（或者后段前进推到了前段）
        if (frontTail.distance < minAllowedDistance) {
            const overlap = minAllowedDistance - frontTail.distance;
            // 将整个前段（以及更前面的段）整体向前顺移校准，保持物理闭合紧贴！
            for (let k = s + 1; k < segments.length; k++) {
                for (let b = 0; b < segments[k].length; b++) {
                    segments[k][b].distance += overlap;
                }
            }
        }
    }

    // 6. 段内紧密度保证（确保段内每个球严丝合缝）
    for (let s = 0; s < segments.length; s++) {
        const seg = segments[s];
        for (let b = 1; b < seg.length; b++) {
            seg[b].distance = seg[b - 1].distance + BALL_DIAMETER;
        }
    }
}

/**
 * 全局消除扫描器：
 * 只要出现 >= 3 颗同色紧密相连的球，立刻执行爆破消除！
 */
export function scanAndEliminateAllMatches(train) {
    if (!train || train.length < 3) {
        return { count: 0, removedBalls: [], color: '' };
    }

    let start = 0;
    while (start < train.length) {
        let end = start;
        // 只要紧密相贴（间距在合法直径误差内）且颜色相同
        while (
            end + 1 < train.length &&
            train[end + 1].color === train[start].color &&
            Math.abs(train[end + 1].distance - train[end].distance - BALL_DIAMETER) <= 2.0
        ) {
            end++;
        }

        const matchLen = end - start + 1;
        if (matchLen >= 3) {
            const matchedColor = train[start].color;
            const removed = train.splice(start, matchLen);
            return {
                count: matchLen,
                removedBalls: removed,
                color: matchedColor
            };
        }
        start = end + 1;
    }

    return { count: 0, removedBalls: [], color: '' };
}

export function detectBulletCollision(bullet, train, track) {
    for (let i = 0; i < train.length; i++) {
        const ball = train[i];
        if (ball.distance < 0) continue;
        const ballPos = track.getPointAtDistance(ball.distance);
        const dist = Math.hypot(bullet.x - ballPos.x, bullet.y - ballPos.y);

        if (dist <= BALL_DIAMETER * 0.95) {
            return { index: i, ball };
        }
    }
    return null;
}

export function insertBallIntoTrain(train, insertIndex, color) {
    const targetBall = train[insertIndex];
    const newBall = {
        id: Date.now() + Math.random(),
        color,
        distance: targetBall ? targetBall.distance : 0,
        scale: 0.35
    };

    train.splice(insertIndex + 1, 0, newBall);

    // 将后方球体后推为新球腾出位置
    for (let i = 0; i <= insertIndex; i++) {
        train[i].distance -= BALL_DIAMETER;
    }

    return insertIndex + 1;
}
