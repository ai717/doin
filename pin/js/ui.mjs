/**
 * @file games/pin/js/ui.mjs
 * 纯 Canvas 2D 复古钟表机械工坊渲染器。
 * 驱动黄铜发条齿轮、蓝钢指针、金石微粒火花、屏幕微震与星轨背景。
 */

import {
  WHEEL_CX,
  WHEEL_CY,
  WHEEL_RADIUS,
  PIN_STEM_LENGTH,
  PIN_HEAD_RADIUS,
  PIN_LAUNCH_Y,
} from './engine.mjs';

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 700;

export class PinRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
  }

  triggerSparks(x, y, count = 16, color = '#ffd54f') {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 60 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        size: 2.5 + Math.random() * 3.5,
        color,
      });
    }
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

    // 屏幕震颤偏移
    ctx.save();
    if (this.shakeDuration > 0) {
      const ox = (Math.random() - 0.5) * this.shakeIntensity * 2;
      const oy = (Math.random() - 0.5) * this.shakeIntensity * 2;
      ctx.translate(ox, oy);
    }

    // 1. 深邃青黛钟表工坊星轨背景
    this.renderBackground(ctx, state);

    // 2. 齿轮上已扎入的蓝钢指针 (Wheel Pins)
    this.renderWheelPins(ctx, state);

    // 3. 中央黄铜擒纵主齿轮 (Master Brass Gear)
    this.renderMasterGear(ctx, state);

    // 4. 正在向上弹射飞行的针头 (Flying Pins)
    this.renderFlyingPins(ctx, state);

    // 5. 底部排队待发射针阵列 (Pending Magazine)
    this.renderMagazine(ctx, state);

    // 6. 撞击火花与金色星屑粒子
    this.renderParticles(ctx);

    ctx.restore();
  }

  renderBackground(ctx, state) {
    // 沉浸深青黛至玄黑渐变，与容器底色无缝融为一体
    const bgGrad = ctx.createRadialGradient(
      WHEEL_CX,
      WHEEL_CY,
      30,
      WHEEL_CX,
      WHEEL_CY,
      360
    );
    bgGrad.addColorStop(0, '#162232');
    bgGrad.addColorStop(0.45, '#0d1522');
    bgGrad.addColorStop(0.82, '#070a10');
    bgGrad.addColorStop(1, '#05070c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    // 天文星轨同心圆刻度 (自适应 480 宽屏，边缘预留呼吸边距)
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.08)';
    ctx.lineWidth = 1.2;
    [115, 145, 180, 215].forEach((r) => {
      ctx.beginPath();
      ctx.arc(WHEEL_CX, WHEEL_CY, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 12 个微弱黄铜刻度星点
    for (let i = 0; i < 12; i++) {
      const ang = (i * Math.PI) / 6;
      const px = WHEEL_CX + Math.cos(ang) * 180;
      const py = WHEEL_CY + Math.sin(ang) * 180;
      ctx.fillStyle = 'rgba(212, 175, 55, 0.2)';
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 垂直射击瞄准轴线 (极简柔光虚线)
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(WHEEL_CX, WHEEL_CY + WHEEL_RADIUS + 12);
    ctx.lineTo(WHEEL_CX, PIN_LAUNCH_Y - 14);
    ctx.stroke();
    ctx.setLineDash([]);

    // 瞄准发射指示微型箭头
    ctx.fillStyle = 'rgba(255, 213, 79, 0.28)';
    ctx.beginPath();
    ctx.moveTo(WHEEL_CX, PIN_LAUNCH_Y - 16);
    ctx.lineTo(WHEEL_CX - 4.5, PIN_LAUNCH_Y - 8);
    ctx.lineTo(WHEEL_CX + 4.5, PIN_LAUNCH_Y - 8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  renderMasterGear(ctx, state) {
    const cx = WHEEL_CX;
    const cy = WHEEL_CY;
    const r = WHEEL_RADIUS;
    const angle = state.wheelAngle;

    ctx.save();
    ctx.translate(cx, cy);

    // 齿轮投影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;

    // 旋转齿轮
    ctx.rotate(angle);

    // 1. 16 颗外缘黄铜圆角齿
    const teeth = 16;
    ctx.fillStyle = '#caa132';
    for (let i = 0; i < teeth; i++) {
      const tAng = (i * Math.PI * 2) / teeth;
      const tx = Math.cos(tAng) * (r + 8);
      const ty = Math.sin(tAng) * (r + 8);
      ctx.beginPath();
      ctx.arc(tx, ty, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. 主齿轮盘体
    const goldGrad = ctx.createLinearGradient(-r, -r, r, r);
    goldGrad.addColorStop(0, '#ffd54f');
    goldGrad.addColorStop(0.5, '#d4af37');
    goldGrad.addColorStop(1, '#997300');
    ctx.fillStyle = goldGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // 3. 镂空内圈与辐条
    ctx.fillStyle = '#0c1017';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
    ctx.fill();

    // 4. 旋转游丝摆轮 (Balance Spring)
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.15) {
      const rad = 6 + a * 2.6;
      const sx = Math.cos(a) * rad;
      const sy = Math.sin(a) * rad;
      if (a === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // 5. 中心轴承红宝石 (Ruby Pivot)
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff9999';
    ctx.beginPath();
    ctx.arc(-3, -3, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  renderWheelPins(ctx, state) {
    const cx = WHEEL_CX;
    const cy = WHEEL_CY;
    const r = WHEEL_RADIUS;
    const wheelAngle = state.wheelAngle;

    for (const pin of state.wheelPins) {
      // 在齿轮参考系中的绝对世界角度 = pin.angle + wheelAngle
      const worldAngle = pin.angle + wheelAngle;

      const xBase = cx + Math.cos(worldAngle) * r;
      const yBase = cy + Math.sin(worldAngle) * r;
      const xTip = cx + Math.cos(worldAngle) * (r + PIN_STEM_LENGTH);
      const yTip = cy + Math.sin(worldAngle) * (r + PIN_STEM_LENGTH);

      ctx.save();
      // 蓝钢指针杆 (Blued Steel Stem)
      ctx.strokeStyle = '#4a90e2';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(xBase, yBase);
      ctx.lineTo(xTip, yTip);
      ctx.stroke();

      // 针杆高光细线
      ctx.strokeStyle = '#8bc34a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xBase, yBase);
      ctx.lineTo(xTip, yTip);
      ctx.stroke();

      // 针头圆润珠子 (Ruby / Gold Bead)
      const headColor = pin.color || '#ffd54f';
      ctx.fillStyle = headColor;
      ctx.beginPath();
      ctx.arc(xTip, yTip, PIN_HEAD_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // 珠子立体微反光
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.arc(xTip - 2.5, yTip - 2.5, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // 针头序号文字
      if (pin.label) {
        ctx.fillStyle = '#17202a';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pin.label, xTip, yTip + 0.5);
      }

      ctx.restore();
    }
  }

  renderFlyingPins(ctx, state) {
    for (const pin of state.flyingPins) {
      ctx.save();
      const x = pin.x;
      const y = pin.y;

      // 金色流光尾焰 (Flight Particle Trail)
      ctx.strokeStyle = 'rgba(255, 213, 79, 0.45)';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y + 8);
      ctx.lineTo(x, y + 42);
      ctx.stroke();

      // 蓝钢指针杆
      ctx.strokeStyle = '#64b5f6';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + PIN_STEM_LENGTH);
      ctx.stroke();

      // 镀金锐利针尖
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x - 3.5, y + 6);
      ctx.lineTo(x + 3.5, y + 6);
      ctx.closePath();
      ctx.fill();

      // 尾部针头圆珠
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath();
      ctx.arc(x, y + PIN_STEM_LENGTH, PIN_HEAD_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      if (pin.label) {
        ctx.fillStyle = '#17202a';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pin.label, x, y + PIN_STEM_LENGTH);
      }

      ctx.restore();
    }
  }

  renderMagazine(ctx, state) {
    if (state.pendingCount <= 0) return;

    ctx.save();
    const cx = WHEEL_CX;
    const startY = PIN_LAUNCH_Y;

    // 绘制弹夹最前端待发击发槽针头
    const topIndex = state.totalLaunched + 1;

    // 展现前 5 根待发针，排列整齐通透
    const visibleCount = Math.min(5, state.pendingCount);
    for (let i = 0; i < visibleCount; i++) {
      const py = startY + i * 36;
      const alpha = Math.max(0.28, 1.0 - i * 0.16);

      ctx.strokeStyle = `rgba(74, 144, 226, ${alpha})`;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(cx, py);
      ctx.lineTo(cx, py + 26);
      ctx.stroke();

      ctx.fillStyle = i === 0 ? '#ffd54f' : `rgba(255, 213, 79, ${alpha})`;
      ctx.beginPath();
      ctx.arc(cx, py + 26, PIN_HEAD_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // 珠子立体高光
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(cx - 2.5, py + 26 - 2.5, 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#17202a';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((topIndex + i).toString(), cx, py + 26 + 0.5);
    }

    // 若弹夹剩余针数超过 5 根，显示精炼的数量提示 badge
    if (state.pendingCount > 5) {
      const extraCount = state.pendingCount - 5;
      ctx.fillStyle = 'rgba(255, 213, 79, 0.75)';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`+${extraCount}`, cx, startY + 5 * 36 + 14);
    }

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
