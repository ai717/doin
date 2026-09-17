// 割绳子物理规则内核（DOM-free 纯函数，严禁访问 document/window/localStorage）
// 舞台基准虚拟空间：640 × 800
// 固定 60Hz 帧步进（dt = 1/60），保证确定性与重放一致

export const STAGE_WIDTH = 640;
export const STAGE_HEIGHT = 800;

export const PHYSICS = {
  GRAVITY: 920,             // 正常重力 px/s^2
  BUBBLE_BUOYANCY: -260,    // 气泡反重力加速度 px/s^2
  BUBBLE_MAX_UP_SPEED: -160,// 气泡最大上升速度
  DAMPING_AIR: 0.994,       // 空气阻力
  CANDY_RADIUS: 20,         // 糖果碰撞半径
  STAR_RADIUS: 18,          // 星星收集半径
  NOMMY_MOUTH_RADIUS: 28,   // 怪兽吞咽嘴部判定半径
  ROPE_NUM_SEGMENTS: 10,    // 绳索质点分段数
  ROPE_RELAX_ITERS: 6       // 约束求解迭代数
};

// 几何工具：线段相交检测
export function segmentsIntersect(p1, p2, p3, p4) {
  function ccw(a, b, c) {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  }
  const ab = ccw(p1, p3, p4) !== ccw(p2, p3, p4);
  const cd = ccw(p1, p2, p3) !== ccw(p1, p2, p4);
  return ab && cd;
}

// 几何工具：点到线段最短距离
export function distToSegment(p, v, w) {
  const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

// 圆形与轴对齐矩形相交检测（尖刺碰撞）
export function circleIntersectsRect(cx, cy, r, rx, ry, rw, rh) {
  const closestX = Math.max(rx - rw / 2, Math.min(cx, rx + rw / 2));
  const closestY = Math.max(ry - rh / 2, Math.min(cy, ry + rh / 2));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

// 初始化关卡物理世界状态
export function createLevelState(levelDef) {
  const candy = {
    x: levelDef.candy.x,
    y: levelDef.candy.y,
    vx: 0,
    vy: 0,
    r: PHYSICS.CANDY_RADIUS,
    mass: 1.0,
    inBubble: false,
    bubbleId: null
  };

  const ropes = (levelDef.ropes || []).map((rDef) => {
    const segs = PHYSICS.ROPE_NUM_SEGMENTS;
    const particles = [];
    const dx = (candy.x - rDef.anchor.x) / segs;
    const dy = (candy.y - rDef.anchor.y) / segs;
    const segLen = (rDef.length || Math.hypot(candy.x - rDef.anchor.x, candy.y - rDef.anchor.y)) / segs;

    for (let i = 0; i <= segs; i++) {
      const px = rDef.anchor.x + dx * i;
      const py = rDef.anchor.y + dy * i;
      particles.push({
        x: px,
        y: py,
        oldX: px,
        oldY: py,
        pinned: i === 0,
        isCandy: i === segs
      });
    }

    return {
      id: rDef.id,
      anchor: { x: rDef.anchor.x, y: rDef.anchor.y },
      length: rDef.length,
      segLength: segLen,
      cut: false,
      cutTime: 0,
      particles
    };
  });

  const stars = (levelDef.stars || []).map((sDef) => ({
    id: sDef.id,
    x: sDef.x,
    y: sDef.y,
    r: PHYSICS.STAR_RADIUS,
    collected: false
  }));

  const bubbles = (levelDef.bubbles || []).map((bDef) => ({
    id: bDef.id,
    x: bDef.x,
    y: bDef.y,
    r: bDef.r || 34,
    captured: Boolean(bDef.captured),
    popped: false
  }));

  // 如果初始就有气泡已包裹糖果
  const initCaptured = bubbles.find((b) => b.captured);
  if (initCaptured) {
    candy.inBubble = true;
    candy.bubbleId = initCaptured.id;
  }

  const bellows = (levelDef.bellows || []).map((bel) => ({
    id: bel.id,
    x: bel.x,
    y: bel.y,
    angle: bel.angle || 0,
    force: bel.force || 380,
    puffed: false,
    puffAnim: 0
  }));

  const spikes = (levelDef.spikes || []).map((sp) => ({
    id: sp.id,
    x: sp.x,
    y: sp.y,
    w: sp.w || 80,
    h: sp.h || 26
  }));

  const nommy = {
    x: levelDef.nommy.x,
    y: levelDef.nommy.y,
    r: 38,
    mouthRadius: PHYSICS.NOMMY_MOUTH_RADIUS,
    mouthOpen: 0, // 0: 闭口, 1: 全张
    state: "idle" // idle, open, eating, sad
  };

  const cutsAllowed = levelDef.cutsAllowed ?? null;

  return {
    levelId: levelDef.id,
    chapter: levelDef.chapter,
    status: "playing", // playing, cleared, failed
    failReason: null,  // out_of_bounds, spiked, timeout
    timeElapsed: 0,
    cutsAllowed,
    cutsRemaining: cutsAllowed,
    cutsMade: 0,
    currentCutStrokeId: null,
    starsCollected: 0,
    candy,
    ropes,
    stars,
    bubbles,
    bellows,
    spikes,
    nommy
  };
}

// 划线割绳检测
// swipe: { p1: { x, y }, p2: { x, y } }
// strokeId: 当前连续划击手势 ID（单次划拉动作可连续割断多根绳索，即便 cutsAllowed=1）
export function cutRopes(state, p1, p2, strokeId = null) {
  if (state.status !== "playing") return { cutCount: 0, cuts: [] };

  if (state.cutsAllowed !== null) {
    const isContinuingStroke = strokeId !== null && state.currentCutStrokeId === strokeId;
    if (!isContinuingStroke && state.cutsRemaining <= 0) {
      return { cutCount: 0, cuts: [] };
    }
  }

  const cutList = [];
  let cutHappened = false;

  for (const rope of state.ropes) {
    if (rope.cut) continue;

    // 检查划痕是否与该绳索的任一分段相交
    for (let i = 0; i < rope.particles.length - 1; i++) {
      const q1 = rope.particles[i];
      const q2 = rope.particles[i + 1];

      if (segmentsIntersect(p1, p2, q1, q2)) {
        rope.cut = true;
        rope.cutTime = state.timeElapsed;
        rope.cutSegmentIndex = i;
        cutHappened = true;
        cutList.push({
          ropeId: rope.id,
          cutPoint: {
            x: (q1.x + q2.x) / 2,
            y: (q1.y + q2.y) / 2
          }
        });
        break;
      }
    }
  }

  if (cutHappened) {
    state.cutsMade += cutList.length;
    if (state.cutsAllowed !== null) {
      if (strokeId !== null) {
        if (state.currentCutStrokeId !== strokeId) {
          state.cutsRemaining = Math.max(0, state.cutsRemaining - 1);
          state.currentCutStrokeId = strokeId;
        }
      } else {
        state.cutsRemaining = Math.max(0, state.cutsRemaining - 1);
      }
    }
  }

  return { cutCount: cutList.length, cuts: cutList };
}

// 戳破气泡
export function popBubble(state, bubbleId) {
  if (state.status !== "playing") return { popped: false };
  const b = state.bubbles.find((bubble) => bubble.id === bubbleId);
  if (!b || b.popped) return { popped: false };

  b.popped = true;
  if (state.candy.inBubble && state.candy.bubbleId === bubbleId) {
    state.candy.inBubble = false;
    state.candy.bubbleId = null;
  }
  return { popped: true, bubbleId };
}

// 吹气皮囊动作
export function puffBellows(state, bellowsId) {
  if (state.status !== "playing") return { puffed: false };
  const bel = state.bellows.find((b) => b.id === bellowsId);
  if (!bel) return { puffed: false };

  bel.puffAnim = 1.0;

  const candy = state.candy;
  const dx = candy.x - bel.x;
  const dy = candy.y - bel.y;
  const dist = Math.hypot(dx, dy);

  if (dist > 360 || dist === 0) {
    return { puffed: true, affected: false };
  }

  const belDirX = Math.cos(bel.angle);
  const belDirY = Math.sin(bel.angle);
  const dirX = dx / dist;
  const dirY = dy / dist;

  // 锥形吹风角度投影
  const dot = belDirX * dirX + belDirY * dirY;
  if (dot < 0.5) {
    // 超过 ±60 度范围吹不到
    return { puffed: true, affected: false };
  }

  const falloff = (1 - dist / 360) * dot;
  const boost = candy.inBubble ? 1.45 : 1.0;
  const strength = bel.force * falloff * boost;

  candy.vx += belDirX * strength;
  candy.vy += belDirY * strength;

  return {
    puffed: true,
    affected: true,
    impulse: { x: belDirX * strength, y: belDirY * strength }
  };
}

// 纯函数单物理帧步进
export function stepFrame(state, dt = 1 / 60) {
  if (state.status !== "playing") return state;

  state.timeElapsed += dt;

  const candy = state.candy;

  // 1. 动力学受力更新 (重力 / 气泡反重力浮力)
  if (candy.inBubble) {
    candy.vy += PHYSICS.BUBBLE_BUOYANCY * dt;
    if (candy.vy < PHYSICS.BUBBLE_MAX_UP_SPEED) {
      candy.vy = PHYSICS.BUBBLE_MAX_UP_SPEED;
    }
    // 气泡水平轻微浮动
    candy.vx *= Math.pow(0.985, dt * 60);
  } else {
    candy.vy += PHYSICS.GRAVITY * dt;
    candy.vx *= Math.pow(PHYSICS.DAMPING_AIR, dt * 60);
    candy.vy *= Math.pow(PHYSICS.DAMPING_AIR, dt * 60);
  }

  // 2. 气囊动画衰减
  for (const bel of state.bellows) {
    if (bel.puffAnim > 0) {
      bel.puffAnim = Math.max(0, bel.puffAnim - dt * 4);
    }
  }

  // 3. 糖果位置初次积分
  candy.x += candy.vx * dt;
  candy.y += candy.vy * dt;

  // 4. 绳索多质点 Verlet 积分与约束求解
  for (const rope of state.ropes) {
    const parts = rope.particles;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.pinned) continue;

      if (!rope.cut && p.isCandy) {
        // 与糖果同步
        p.x = candy.x;
        p.y = candy.y;
        continue;
      }

      // 质点自身重力 Verlet 积分
      const vx = (p.x - p.oldX) * 0.98;
      const vy = (p.y - p.oldY) * 0.98 + (PHYSICS.GRAVITY * 0.7) * dt * dt;
      p.oldX = p.x;
      p.oldY = p.y;
      p.x += vx;
      p.y += vy;
    }
  }

  // 5. 绳索刚性距离约束多次松弛
  for (let iter = 0; iter < PHYSICS.ROPE_RELAX_ITERS; iter++) {
    for (const rope of state.ropes) {
      if (rope.cut) {
        // 断裂后仍保留质点内部松弛
        const parts = rope.particles;
        for (let i = 0; i < parts.length - 1; i++) {
          const p1 = parts[i];
          const p2 = parts[i + 1];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const curDist = Math.hypot(dx, dy);
          if (curDist === 0) continue;
          const diff = (curDist - rope.segLength) / curDist;
          if (!p1.pinned) {
            p1.x += dx * 0.5 * diff;
            p1.y += dy * 0.5 * diff;
          }
          p2.x -= dx * 0.5 * diff;
          p2.y -= dy * 0.5 * diff;
        }
        continue;
      }

      // 未断裂绳索对糖果施加张力约束
      // 锚点与糖果总体距离约束
      const anchor = rope.anchor;
      const tdx = candy.x - anchor.x;
      const tdy = candy.y - anchor.y;
      const totalDist = Math.hypot(tdx, tdy);

      if (totalDist > rope.length) {
        const nx = tdx / totalDist;
        const ny = tdy / totalDist;
        candy.x = anchor.x + nx * rope.length;
        candy.y = anchor.y + ny * rope.length;

        // 约束速度切线方向（消除径向拉伸速度）
        const vr = candy.vx * nx + candy.vy * ny;
        if (vr > 0) {
          candy.vx -= vr * nx * 1.0;
          candy.vy -= vr * ny * 1.0;
        }
      }

      // 质点链顺次平滑约束
      const parts = rope.particles;
      parts[parts.length - 1].x = candy.x;
      parts[parts.length - 1].y = candy.y;

      for (let i = 0; i < parts.length - 1; i++) {
        const p1 = parts[i];
        const p2 = parts[i + 1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const curDist = Math.hypot(dx, dy);
        if (curDist === 0) continue;
        const diff = (curDist - rope.segLength) / curDist;
        if (!p1.pinned) {
          p1.x += dx * 0.5 * diff;
          p1.y += dy * 0.5 * diff;
        }
        if (!p2.isCandy) {
          p2.x -= dx * 0.5 * diff;
          p2.y -= dy * 0.5 * diff;
        }
      }
    }
  }

  // 6. 糖果与气泡接触捕获
  for (const b of state.bubbles) {
    if (b.popped) continue;
    if (!candy.inBubble) {
      const d = Math.hypot(candy.x - b.x, candy.y - b.y);
      if (d < candy.r + b.r - 4) {
        b.captured = true;
        candy.inBubble = true;
        candy.bubbleId = b.id;
      }
    } else if (b.id === candy.bubbleId) {
      // 气泡贴合糖果中心
      b.x = candy.x;
      b.y = candy.y;
    }
  }

  // 7. 星星收集检测
  for (const star of state.stars) {
    if (star.collected) continue;
    const d = Math.hypot(candy.x - star.x, candy.y - star.y);
    if (d < candy.r + star.r) {
      star.collected = true;
      state.starsCollected++;
    }
  }

  // 8. 尖刺碰撞致命检测
  for (const spike of state.spikes) {
    if (circleIntersectsRect(candy.x, candy.y, candy.r, spike.x, spike.y, spike.w, spike.h)) {
      state.status = "failed";
      state.failReason = "spiked";
      state.nommy.state = "sad";
      return state;
    }
  }

  // 9. 小怪兽吞食检测与眼神表情跟踪
  const nommy = state.nommy;
  const mouthX = nommy.x;
  const mouthY = nommy.y - 6;
  const distToMouth = Math.hypot(candy.x - mouthX, candy.y - mouthY);

  if (distToMouth < 160) {
    nommy.mouthOpen = Math.min(1.0, (160 - distToMouth) / 100);
    nommy.state = "open";
  } else {
    nommy.mouthOpen = Math.max(0, nommy.mouthOpen - dt * 3);
    nommy.state = "idle";
  }

  if (distToMouth < candy.r + nommy.mouthRadius - 8) {
    // 糖果进入怪兽口中！通关胜利
    state.status = "cleared";
    nommy.state = "eating";
    nommy.mouthOpen = 1.0;
    // 锁定糖果在口中
    candy.x = mouthX;
    candy.y = mouthY;
    candy.vx = 0;
    candy.vy = 0;
    return state;
  }

  // 10. 边界跌落判定
  if (candy.y > STAGE_HEIGHT + 60 || candy.x < -60 || candy.x > STAGE_WIDTH + 60) {
    state.status = "failed";
    state.failReason = "out_of_bounds";
    nommy.state = "sad";
    return state;
  }
  if (candy.inBubble && candy.y < -60) {
    state.status = "failed";
    state.failReason = "out_of_bounds";
    nommy.state = "sad";
    return state;
  }

  // 11. 一刀大师残局静止死锁判定
  if (state.cutsAllowed !== null && state.cutsRemaining === 0) {
    const speed = Math.hypot(candy.vx, candy.vy);
    if (state.timeElapsed > 3.0 && speed < 3.0 && !candy.inBubble) {
      // 停止运动且未到达口中
      state.status = "failed";
      state.failReason = "timeout";
      nommy.state = "sad";
    }
  }

  return state;
}
