/**
 * @file games/airpuck/js/ui.mjs
 * 纯 Canvas 2D 赛博霓虹电玩球台渲染器。
 * 驱动发光微孔气垫冰面、激光尾迹、红蓝手柄立体质感、进球大爆炸与微震反馈。
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
  }

  triggerSparks(x, y, count = 16, color = '#ffffff') {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 70 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        size: 2.5 + Math.random() * 3.5,
        color,
      });
    }
  }

  triggerGoalExplosion(scorer = 'p1') {
    const isP1 = scorer === 'p1';
    const x = isP1 ? RIGHT_WALL : LEFT_WALL;
    const y = (GOAL_Y_MIN + GOAL_Y_MAX) / 2;
    const baseColor = isP1 ? '#ff2d55' : '#00d2d3';

    for (let i = 0; i < 48; i++) {
      const angle = (Math.PI * 2 * i) / 48 + (Math.random() - 0.5) * 0.5;
      const speed = 120 + Math.random() * 260;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.7 + Math.random() * 0.5,
        maxLife: 1.2,
        size: 3.5 + Math.random() * 5,
        color: Math.random() > 0.3 ? baseColor : '#ffd54f',
      });
    }

    this.triggerShake(0.4, 9);
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
      p.vx *= 0.93;
      p.vy *= 0.93;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  render(state) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    // 屏幕震颤偏移
    if (this.shakeDuration > 0) {
      const ox = (Math.random() - 0.5) * this.shakeIntensity * 2;
      const oy = (Math.random() - 0.5) * this.shakeIntensity * 2;
      ctx.translate(ox, oy);
    }

    // 1. 赛博气垫球台冰面与刻线背景
    this.renderCourt(ctx, state);

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

  renderCourt(ctx, state) {
    const bgTheme = state.level?.table?.friction > 0.999 ? 'ice' : 'classic';

    // 桌面午夜曜石底色
    const courtGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (bgTheme === 'ice') {
      courtGrad.addColorStop(0, '#0a1626');
      courtGrad.addColorStop(0.5, '#07101c');
      courtGrad.addColorStop(1, '#050a12');
    } else {
      courtGrad.addColorStop(0, '#101522');
      courtGrad.addColorStop(0.5, '#0a0d16');
      courtGrad.addColorStop(1, '#06080e');
    }
    ctx.fillStyle = courtGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 细微微孔气流网纹阵列 (Perforated Air Holes)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    for (let x = LEFT_WALL + 24; x < RIGHT_WALL; x += 32) {
      for (let y = TOP_WALL + 20; y < BOTTOM_WALL; y += 32) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }

    // 外框立体高光防护栏
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 14;
    ctx.strokeRect(LEFT_WALL - 7, TOP_WALL - 7, (RIGHT_WALL - LEFT_WALL) + 14, (BOTTOM_WALL - TOP_WALL) + 14);

    // 球门深陷发光槽
    // 左球门 (红方守护门槽)
    ctx.fillStyle = '#ff2d55';
    ctx.fillRect(LEFT_WALL - 10, GOAL_Y_MIN, 10, GOAL_Y_MAX - GOAL_Y_MIN);
    // 右球门 (蓝方守护门槽)
    ctx.fillStyle = '#00d2d3';
    ctx.fillRect(RIGHT_WALL, GOAL_Y_MIN, 10, GOAL_Y_MAX - GOAL_Y_MIN);

    // 场地中线与中心圆
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2.5;

    // 分割中线
    ctx.beginPath();
    ctx.moveTo(CENTER_X, TOP_WALL);
    ctx.lineTo(CENTER_X, BOTTOM_WALL);
    ctx.stroke();

    // 中心开球圆圈
    ctx.beginPath();
    ctx.arc(CENTER_X, (TOP_WALL + BOTTOM_WALL) / 2, 70, 0, Math.PI * 2);
    ctx.stroke();

    // 双方发球点与禁区弧顶
    ctx.beginPath();
    ctx.arc(LEFT_WALL, (TOP_WALL + BOTTOM_WALL) / 2, 100, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(RIGHT_WALL, (TOP_WALL + BOTTOM_WALL) / 2, 100, Math.PI / 2, -Math.PI / 2);
    ctx.stroke();

    ctx.restore();
  }

  renderGadgets(ctx, state) {
    // 渲染中场电磁加速环 (Boosters)
    for (const booster of state.boosters) {
      ctx.save();
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.008);
      ctx.strokeStyle = booster.cooldown > 0 ? 'rgba(255, 215, 79, 0.3)' : `rgba(255, 215, 79, ${0.4 + 0.5 * pulse})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffd54f';
      ctx.shadowBlur = booster.cooldown > 0 ? 0 : 16 * pulse;

      ctx.beginPath();
      ctx.arc(booster.x, booster.y, booster.radius, 0, Math.PI * 2);
      ctx.stroke();

      // 内部向心旋转加速箭头
      ctx.fillStyle = `rgba(255, 215, 79, ${0.15 + 0.2 * pulse})`;
      ctx.beginPath();
      ctx.arc(booster.x, booster.y, booster.radius * 0.65, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // 渲染反弹阻抗柱 (Bumpers)
    for (const bumper of state.bumpers) {
      ctx.save();
      const isLit = bumper.hitTimer > 0;
      ctx.shadowColor = isLit ? '#ff2d55' : '#00d2d3';
      ctx.shadowBlur = isLit ? 24 : 12;

      // 柱体渐变底色
      const bGrad = ctx.createRadialGradient(bumper.x - 6, bumper.y - 6, 4, bumper.x, bumper.y, bumper.radius);
      bGrad.addColorStop(0, isLit ? '#ff758c' : '#70e1ff');
      bGrad.addColorStop(0.7, isLit ? '#ff2d55' : '#00a3ff');
      bGrad.addColorStop(1, isLit ? '#990022' : '#0055aa');

      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.arc(bumper.x, bumper.y, bumper.radius, 0, Math.PI * 2);
      ctx.fill();

      // 外圈反弹发光环
      ctx.strokeStyle = isLit ? '#ffffff' : 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.restore();
    }
  }

  renderPuckTrail(ctx, state) {
    const history = state.puck.history;
    if (!history || history.length < 2) return;

    ctx.save();
    const trailColor = state.puck.lastHitBy === 'p1' ? 'rgba(255, 45, 85, ' : 'rgba(0, 210, 211, ';

    for (let i = 0; i < history.length - 1; i++) {
      const p1 = history[i];
      const p2 = history[i + 1];
      const alpha = Math.max(0, (1 - (i / history.length)) * 0.65);
      const width = Math.max(2, (1 - (i / history.length)) * (PUCK_RADIUS * 1.5));

      ctx.strokeStyle = `${trailColor}${alpha})`;
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
    // 气垫球悬浮发光光晕
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 18;

    // 白色荧光球体本体
    const puckGrad = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, r);
    puckGrad.addColorStop(0, '#ffffff');
    puckGrad.addColorStop(0.7, '#e0f7fa');
    puckGrad.addColorStop(1, '#80deea');

    ctx.fillStyle = puckGrad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // 细致内圈同心激光纹
    ctx.strokeStyle = 'rgba(0, 180, 216, 0.8)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
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

    // 突进扣杀时的高光喷火气浪
    if (isDashing) {
      ctx.shadowColor = isP1 ? '#ff1744' : '#00e5ff';
      ctx.shadowBlur = 32;

      ctx.fillStyle = isP1 ? 'rgba(255, 23, 68, 0.35)' : 'rgba(0, 229, 255, 0.35)';
      ctx.beginPath();
      ctx.arc(x, y, r + 12, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.shadowColor = isP1 ? '#ff2d55' : '#00d2d3';
      ctx.shadowBlur = 16;
    }

    // 手柄主盘体渐变
    const grad = ctx.createRadialGradient(x - 8, y - 8, 4, x, y, r);
    if (isP1) {
      grad.addColorStop(0, '#ff758c');
      grad.addColorStop(0.55, '#ff2d55');
      grad.addColorStop(1, '#b70026');
    } else {
      grad.addColorStop(0, '#70e1ff');
      grad.addColorStop(0.55, '#00d2d3');
      grad.addColorStop(1, '#0069c0');
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // 外部硅胶防撞圈
    ctx.strokeStyle = isP1 ? '#ffd0d8' : '#e0f7fa';
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // 实体推手握把台 (Striker Knob)
    const knobR = r * 0.42;
    const knobGrad = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, knobR);
    knobGrad.addColorStop(0, '#ffffff');
    knobGrad.addColorStop(0.8, isP1 ? '#ff2d55' : '#00d2d3');
    knobGrad.addColorStop(1, '#17202a');

    ctx.fillStyle = knobGrad;
    ctx.beginPath();
    ctx.arc(x, y, knobR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  renderParticles(ctx) {
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
