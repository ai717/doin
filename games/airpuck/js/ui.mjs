/**
 * @file games/airpuck/js/ui.mjs
 * 纯 Canvas 2D 赛博霓虹电玩球台渲染器。
 * 极致能效优化（离线缓存球台、零 shadowBlur 开销、纯着色器级径向光效），告别风扇狂转与卡顿。
 */

import {
  TABLE_WIDTH,
  TABLE_HEIGHT,
  LEFT_WALL,
  RIGHT_WALL,
  TOP_WALL,
  BOTTOM_WALL,
  CENTER_X,
  GOAL_Y_MIN,
  GOAL_Y_MAX,
  PUCK_RADIUS,
  STRIKER_RADIUS,
} from './engine.mjs';

export const CANVAS_WIDTH = TABLE_WIDTH;
export const CANVAS_HEIGHT = TABLE_HEIGHT;

export class AirPuckRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.shakeDuration = 0;
    this.shakeIntensity = 0;

    // 离线静态底盘缓存 Canvas（彻底消灭每帧 350+ 次重复绘制，风扇零负载）
    this.courtCache = null;
    this.cachedFriction = null;
  }

  /**
   * 初始化并缓存球台底盘与球门静态层
   */
  ensureCourtCache(friction = 0.998) {
    if (this.courtCache && this.cachedFriction === friction) {
      return;
    }

    const off = document.createElement('canvas');
    off.width = CANVAS_WIDTH;
    off.height = CANVAS_HEIGHT;
    const ctx = off.getContext('2d');

    const isIce = friction > 0.999;

    // 1. 桌面深邃曜石底色
    const courtGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (isIce) {
      courtGrad.addColorStop(0, '#091524');
      courtGrad.addColorStop(0.5, '#060f1b');
      courtGrad.addColorStop(1, '#040912');
    } else {
      courtGrad.addColorStop(0, '#0d1320');
      courtGrad.addColorStop(0.5, '#080c14');
      courtGrad.addColorStop(1, '#05070c');
    }
    ctx.fillStyle = courtGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. 细微微孔气流网纹阵列 (Perforated Air Holes) 一次性烘焙进底图
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    for (let x = LEFT_WALL + 24; x < RIGHT_WALL; x += 32) {
      for (let y = TOP_WALL + 20; y < BOTTOM_WALL; y += 32) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }

    // 3. 外框立体铝合金防撞导轨 (Double-Bevel Aluminum Rails)
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#182436';
    ctx.strokeRect(LEFT_WALL - 7, TOP_WALL - 7, (RIGHT_WALL - LEFT_WALL) + 14, (BOTTOM_WALL - TOP_WALL) + 14);

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0, 210, 211, 0.35)';
    ctx.strokeRect(LEFT_WALL, TOP_WALL, RIGHT_WALL - LEFT_WALL, BOTTOM_WALL - TOP_WALL);

    // 4. 下沉式立体发光球门槽 (Recessed 3D Goal Cavities)
    // 左球门槽 (红方)
    const goalHeight = GOAL_Y_MAX - GOAL_Y_MIN;
    const leftGoalGrad = ctx.createLinearGradient(LEFT_WALL - 16, 0, LEFT_WALL, 0);
    leftGoalGrad.addColorStop(0, 'rgba(255, 45, 85, 0.85)');
    leftGoalGrad.addColorStop(1, 'rgba(255, 45, 85, 0.15)');
    ctx.fillStyle = leftGoalGrad;
    ctx.fillRect(LEFT_WALL - 16, GOAL_Y_MIN, 16, goalHeight);

    ctx.strokeStyle = '#ff2d55';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(LEFT_WALL, GOAL_Y_MIN);
    ctx.lineTo(LEFT_WALL, GOAL_Y_MAX);
    ctx.stroke();

    // 右球门槽 (蓝方)
    const rightGoalGrad = ctx.createLinearGradient(RIGHT_WALL, 0, RIGHT_WALL + 16, 0);
    rightGoalGrad.addColorStop(0, 'rgba(0, 210, 211, 0.15)');
    rightGoalGrad.addColorStop(1, 'rgba(0, 210, 211, 0.85)');
    ctx.fillStyle = rightGoalGrad;
    ctx.fillRect(RIGHT_WALL, GOAL_Y_MIN, 16, goalHeight);

    ctx.strokeStyle = '#00d2d3';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(RIGHT_WALL, GOAL_Y_MIN);
    ctx.lineTo(RIGHT_WALL, GOAL_Y_MAX);
    ctx.stroke();

    // 5. 场地中线、争球圈与红蓝禁区弧线
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;

    // 分割中线
    ctx.beginPath();
    ctx.moveTo(CENTER_X, TOP_WALL);
    ctx.lineTo(CENTER_X, BOTTOM_WALL);
    ctx.stroke();

    // 中心开球争球圈
    ctx.beginPath();
    ctx.arc(CENTER_X, (TOP_WALL + BOTTOM_WALL) / 2, 70, 0, Math.PI * 2);
    ctx.stroke();

    // 中心争球小原点
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.arc(CENTER_X, (TOP_WALL + BOTTOM_WALL) / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // 双方发球点禁区弧圈
    ctx.beginPath();
    ctx.arc(LEFT_WALL, (TOP_WALL + BOTTOM_WALL) / 2, 100, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(RIGHT_WALL, (TOP_WALL + BOTTOM_WALL) / 2, 100, Math.PI / 2, -Math.PI / 2);
    ctx.stroke();

    ctx.restore();

    this.courtCache = off;
    this.cachedFriction = friction;
  }

  triggerSparks(x, y, count = 14, color = '#ffffff') {
    if (this.particles.length > 50) return; // 严格限额，保障 60fps 零发热
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 70 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
        size: 2.2 + Math.random() * 2.5,
        color,
      });
    }
  }

  triggerGoalExplosion(scorer = 'p1') {
    const isP1 = scorer === 'p1';
    const x = isP1 ? RIGHT_WALL : LEFT_WALL;
    const y = (GOAL_Y_MIN + GOAL_Y_MAX) / 2;
    const baseColor = isP1 ? '#ff2d55' : '#00d2d3';

    for (let i = 0; i < 32; i++) {
      const angle = (Math.PI * 2 * i) / 32 + (Math.random() - 0.5) * 0.4;
      const speed = 100 + Math.random() * 220;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        size: 3 + Math.random() * 4,
        color: Math.random() > 0.3 ? baseColor : '#ffd54f',
      });
    }

    this.triggerShake(0.35, 8);
  }

  triggerShake(duration = 0.25, intensity = 5) {
    this.shakeDuration = duration;
    this.shakeIntensity = intensity;
  }

  update(dt) {
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      if (this.shakeDuration <= 0) {
        this.shakeIntensity = 0;
      }
    }

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  render(state) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    // 屏幕微震颤偏移
    if (this.shakeDuration > 0) {
      const ox = (Math.random() - 0.5) * this.shakeIntensity * 2;
      const oy = (Math.random() - 0.5) * this.shakeIntensity * 2;
      ctx.translate(ox, oy);
    }

    // 1. 绘制极速烘焙静态球台底图（单次硬件贴图绘制，风扇安详静音）
    this.ensureCourtCache(state.level?.table?.friction);
    if (this.courtCache) {
      ctx.drawImage(this.courtCache, 0, 0);
    }

    // 2. 机关物件 (Boosters & Bumpers)
    this.renderGadgets(ctx, state);

    // 3. 气垫球激光拖尾 (Laser Trail)
    this.renderPuckTrail(ctx, state);

    // 4. 气垫球实体 (Puck)
    this.renderPuck(ctx, state.puck);

    // 5. 红蓝双方手柄 (Strikers)
    this.renderStriker(ctx, state.p1, 'p1');
    this.renderStriker(ctx, state.p2, 'p2');

    // 6. 火花粒子与烟花爆炸
    this.renderParticles(ctx);

    ctx.restore();
  }

  renderGadgets(ctx, state) {
    const time = Date.now() * 0.005;

    // 渲染中场电磁加速环 (Boosters)
    for (const booster of state.boosters) {
      ctx.save();
      const pulse = 0.5 + 0.5 * Math.sin(time);
      const isCooling = booster.cooldown > 0;

      // 径向光环（替代卡顿的 shadowBlur）
      const gGrad = ctx.createRadialGradient(
        booster.x, booster.y, booster.radius * 0.4,
        booster.x, booster.y, booster.radius
      );
      gGrad.addColorStop(0, isCooling ? 'rgba(255, 215, 79, 0.05)' : `rgba(255, 215, 79, ${0.15 + 0.15 * pulse})`);
      gGrad.addColorStop(1, 'rgba(255, 215, 79, 0)');
      ctx.fillStyle = gGrad;
      ctx.beginPath();
      ctx.arc(booster.x, booster.y, booster.radius, 0, Math.PI * 2);
      ctx.fill();

      // 外圈光环
      ctx.strokeStyle = isCooling ? 'rgba(255, 215, 79, 0.3)' : `rgba(255, 215, 79, ${0.6 + 0.4 * pulse})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(booster.x, booster.y, booster.radius, 0, Math.PI * 2);
      ctx.stroke();

      // 内部向心能量核心
      ctx.fillStyle = isCooling ? 'rgba(255, 215, 79, 0.1)' : 'rgba(255, 215, 79, 0.35)';
      ctx.beginPath();
      ctx.arc(booster.x, booster.y, booster.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // 渲染反弹阻抗柱 (Bumpers)
    for (const bumper of state.bumpers) {
      ctx.save();
      const isLit = bumper.hitTimer > 0;

      // 3D 橡胶弹性柱底色
      const bGrad = ctx.createRadialGradient(
        bumper.x - 5, bumper.y - 5, 2,
        bumper.x, bumper.y, bumper.radius
      );
      bGrad.addColorStop(0, isLit ? '#ff859c' : '#7fe7ff');
      bGrad.addColorStop(0.65, isLit ? '#ff2d55' : '#00a8ff');
      bGrad.addColorStop(1, isLit ? '#a30024' : '#0052b3');

      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.arc(bumper.x, bumper.y, bumper.radius, 0, Math.PI * 2);
      ctx.fill();

      // 外圈发光反弹箍
      ctx.strokeStyle = isLit ? '#ffffff' : 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bumper.x, bumper.y, bumper.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }

  renderPuckTrail(ctx, state) {
    const history = state.puck.history;
    if (!history || history.length < 2) return;

    ctx.save();
    const isP1 = state.puck.lastHitBy === 'p1';
    const r = isP1 ? 255 : 0;
    const g = isP1 ? 45 : 210;
    const b = isP1 ? 85 : 211;

    for (let i = 0; i < history.length - 1; i++) {
      const p1 = history[i];
      const p2 = history[i + 1];
      const alpha = Math.max(0, (1 - (i / history.length)) * 0.55);
      const width = Math.max(2, (1 - (i / history.length)) * (PUCK_RADIUS * 1.4));

      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderPuck(ctx, puck) {
    const x = puck.x;
    const y = puck.y;
    const r = PUCK_RADIUS;

    ctx.save();

    // 1. 悬浮真实柔和投影（营造气垫离地悬浮 3D 纵深感）
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.arc(x + 3, y + 4, r, 0, Math.PI * 2);
    ctx.fill();

    // 2. 外部气垫光晕（低开销径向渐变代替卡顿 shadowBlur）
    const auraGrad = ctx.createRadialGradient(x, y, r * 0.7, x, y, r + 8);
    auraGrad.addColorStop(0, 'rgba(0, 240, 255, 0.4)');
    auraGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(x, y, r + 8, 0, Math.PI * 2);
    ctx.fill();

    // 3. 高光高分子聚碳酸酯球盘本体
    const puckGrad = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, r);
    puckGrad.addColorStop(0, '#ffffff');
    puckGrad.addColorStop(0.65, '#e0f7fa');
    puckGrad.addColorStop(1, '#80deea');

    ctx.fillStyle = puckGrad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // 4. 精细内圈同心防滑纹
    ctx.strokeStyle = 'rgba(0, 180, 216, 0.75)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  renderStriker(ctx, striker, side) {
    const x = striker.x;
    const y = striker.y;
    const r = STRIKER_RADIUS;
    const isP1 = side === 'p1';
    const isDashing = striker.isDashing;

    ctx.save();

    // 1. 手柄悬浮地表阴影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(x + 4, y + 5, r * 0.95, 0, Math.PI * 2);
    ctx.fill();

    // 2. 突进重扣喷气光环 (Jet Blast Ring)
    if (isDashing) {
      const dashGrad = ctx.createRadialGradient(x, y, r * 0.8, x, y, r + 14);
      dashGrad.addColorStop(0, isP1 ? 'rgba(255, 23, 68, 0.6)' : 'rgba(0, 229, 255, 0.6)');
      dashGrad.addColorStop(1, isP1 ? 'rgba(255, 23, 68, 0)' : 'rgba(0, 229, 255, 0)');
      ctx.fillStyle = dashGrad;
      ctx.beginPath();
      ctx.arc(x, y, r + 14, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. 手柄撞击外圈凸缘 (Polycarbonate Outer Flange)
    const baseGrad = ctx.createRadialGradient(x - 7, y - 7, 3, x, y, r);
    if (isP1) {
      baseGrad.addColorStop(0, '#ff758c');
      baseGrad.addColorStop(0.6, '#ff2d55');
      baseGrad.addColorStop(1, '#b70026');
    } else {
      baseGrad.addColorStop(0, '#70e1ff');
      baseGrad.addColorStop(0.6, '#00d2d3');
      baseGrad.addColorStop(1, '#0069c0');
    }

    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // 4. 外圈防撞柔和倒角细线
    ctx.strokeStyle = isP1 ? '#ffccd5' : '#cceeff';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    // 5. 实体推手中央隆起把台 (Striker Knob)
    const knobR = r * 0.45;
    const knobGrad = ctx.createRadialGradient(x - 3, y - 3, 1.5, x, y, knobR);
    knobGrad.addColorStop(0, '#ffffff');
    knobGrad.addColorStop(0.75, isP1 ? '#ff2d55' : '#00d2d3');
    knobGrad.addColorStop(1, '#111824');

    ctx.fillStyle = knobGrad;
    ctx.beginPath();
    ctx.arc(x, y, knobR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  renderParticles(ctx) {
    if (this.particles.length === 0) return;
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
