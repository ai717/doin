/**
 * @file games/bumper/js/ui.mjs
 * 微缩玩具撞车擂台 Canvas 2D 渲染器。
 * 呈现软胶合金碰撞火花、漂移胎痕、尾翼喷火、跌落深渊动效与微震打击感。
 */

import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  ARENA_CX,
  ARENA_CY,
  CAR_RADIUS,
} from './engine.mjs';
import { t } from './i18n.mjs';

export class ArenaRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lang = 'zh';

    // 粒子系统
    this.sparks = []; // 金属对撞火花
    this.smoke = []; // 急刹排烟微粒

    // 屏幕抖动 (Screenshake)
    this.shakeMag = 0;
    this.shakeDuration = 0;

    this.animTime = 0;
    this.setupResolution();
  }

  setLanguage(lang) {
    this.lang = lang;
  }

  setupResolution() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = ARENA_WIDTH * dpr;
    this.canvas.height = ARENA_HEIGHT * dpr;
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
  }

  /**
   * 触发撞击火花与震屏
   */
  spawnCollisionSparks(x, y, impact = 100) {
    const count = Math.min(26, Math.floor(10 + impact * 0.08));
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 240;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 3 + Math.random() * 4,
        color: Math.random() < 0.6 ? '#f5ba31' : '#ffffff',
        life: 0.35,
        maxLife: 0.35,
      });
    }

    // 触发轻微屏幕震动
    this.shakeMag = Math.min(6, 1.5 + impact * 0.02);
    this.shakeDuration = 0.16;
  }

  /**
   * 触发急刹白烟
   */
  spawnBrakeSmoke(x, y) {
    for (let i = 0; i < 8; i++) {
      this.smoke.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 16,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        r: 6 + Math.random() * 8,
        life: 0.4,
        maxLife: 0.4,
      });
    }
  }

  /**
   * 主渲染入口
   */
  render(state, dt) {
    this.animTime += dt;
    const ctx = this.ctx;

    // 震屏衰减计算
    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      shakeX = (Math.random() - 0.5) * this.shakeMag * 2;
      shakeY = (Math.random() - 0.5) * this.shakeMag * 2;
    }

    ctx.save();
    if (shakeX !== 0 || shakeY !== 0) {
      ctx.translate(shakeX, shakeY);
    }

    // 1. 绘制外部深渊背景与桌面
    this.drawBackground(ctx, state);

    // 2. 绘制悬空微缩擂台
    this.drawArenaPlatform(ctx, state);

    // 3. 绘制地面轮胎漂移拖尾印
    this.drawSkidMarks(ctx, state);

    // 4. 绘制弹球柱机关 (Act 3 Pegs)
    this.drawPegs(ctx, state);

    // 5. 绘制红蓝两辆微型撞车
    this.drawCar(ctx, state.cars.red, '#ff4757', '#dfe4ea', '#ffeaa7');
    this.drawCar(ctx, state.cars.blue, '#1e90ff', '#f5ba31', '#ff6b81');

    // 6. 绘制火花与烟尘微粒
    this.updateAndDrawParticles(ctx, dt);

    ctx.restore();

    // 7. 倒计时与胜负 HUD 浮层
    this.drawStatusOverlay(ctx, state);
  }

  /**
   * 桌面环境背景
   */
  drawBackground(ctx, state) {
    ctx.fillStyle = '#0a0d16';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // 悬空深渊幽暗放射柔光
    const ambientGrad = ctx.createRadialGradient(
      ARENA_CX, ARENA_CY, 80,
      ARENA_CX, ARENA_CY, 380
    );
    if (state.levelConfig.act === 5) {
      // 熔岩深渊红光
      ambientGrad.addColorStop(0, 'rgba(255, 71, 87, 0.12)');
      ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else {
      ambientGrad.addColorStop(0, 'rgba(46, 56, 78, 0.25)');
      ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }
    ctx.fillStyle = ambientGrad;
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  }

  /**
   * 悬空微缩撞车擂台
   */
  drawArenaPlatform(ctx, state) {
    const R = state.arenaRadius;
    const rimDepth = 22;

    ctx.save();

    // 1. 擂台投射到底层深渊的阴影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.arc(ARENA_CX, ARENA_CY + rimDepth + 12, R, 0, Math.PI * 2);
    ctx.fill();

    // 2. 擂台悬崖圆柱立体侧边 (Beveled Cylinder Rim)
    for (let d = rimDepth; d >= 1; d--) {
      ctx.fillStyle = (d % 2 === 0) ? '#1f2533' : '#272f40';
      ctx.beginPath();
      ctx.arc(ARENA_CX, ARENA_CY + d, R, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. 擂台顶面材质
    const topGrad = ctx.createRadialGradient(
      ARENA_CX - R * 0.3, ARENA_CY - R * 0.3, 10,
      ARENA_CX, ARENA_CY, R
    );

    if (state.levelConfig.act === 2) {
      // 裂纹浮冰台
      topGrad.addColorStop(0, '#a5c4d4');
      topGrad.addColorStop(0.8, '#598392');
      topGrad.addColorStop(1, '#344e5b');
    } else if (state.levelConfig.act === 4) {
      // 蒸汽齿轮台
      topGrad.addColorStop(0, '#594a3c');
      topGrad.addColorStop(1, '#332920');
    } else if (state.levelConfig.act === 5) {
      // 熔岩黑曜石台
      topGrad.addColorStop(0, '#2b2326');
      topGrad.addColorStop(1, '#181214');
    } else {
      // 标准水泥防滑擂台
      topGrad.addColorStop(0, '#3a445d');
      topGrad.addColorStop(1, '#232938');
    }

    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.arc(ARENA_CX, ARENA_CY, R, 0, Math.PI * 2);
    ctx.fill();

    // 4. 边缘防滑金属轮廓边框
    let edgeStrokeColor = '#f5ba31';
    let edgeWidth = 3.5;
    // 缩圈预警闪烁
    if (state.roundTime > state.shrinkDelay) {
      const flash = Math.sin(this.animTime * 12) * 0.5 + 0.5;
      edgeStrokeColor = `rgba(255, 71, 87, ${0.5 + flash * 0.5})`;
      edgeWidth = 5;
    }

    ctx.strokeStyle = edgeStrokeColor;
    ctx.lineWidth = edgeWidth;
    ctx.stroke();

    // 5. 内部同心战斗虚线圈
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(ARENA_CX, ARENA_CY, R * 0.65, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 轮胎漂移轨迹拖尾
   */
  drawSkidMarks(ctx, state) {
    ctx.save();
    for (const id of ['red', 'blue']) {
      const car = state.cars[id];
      for (const sm of car.skidMarks) {
        ctx.fillStyle = `rgba(10, 14, 22, ${sm.alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(sm.x, sm.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * 弹球柱机关 (Act 3 Pegs)
   */
  drawPegs(ctx, state) {
    if (!state.pegs || state.pegs.length === 0) return;

    ctx.save();
    for (const peg of state.pegs) {
      const r = peg.r || 18;

      // 弹性立柱阴影
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.arc(peg.x, peg.y + 6, r, 0, Math.PI * 2);
      ctx.fill();

      // 弹力橡胶柱体
      ctx.fillStyle = '#ff9f43';
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, r, 0, Math.PI * 2);
      ctx.fill();

      // 金属顶盖与反光
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(peg.x - r * 0.25, peg.y - r * 0.25, r * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // 外圈金边
      ctx.strokeStyle = '#f5ba31';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * 微型撞车单体绘制 (软胶车身 + 金属保险杠 + 车灯与尾焰)
   */
  drawCar(ctx, car, bodyColor, bumperColor, helmetColor) {
    ctx.save();
    ctx.translate(car.x, car.y);

    if (car.fallen) {
      // 跌入深渊旋转缩小坠落特写
      const t = car.fallTimer;
      const scale = Math.max(0.05, 1.0 - t * 0.85);
      ctx.scale(scale, scale);
      ctx.rotate(car.angle + t * 9);
    } else {
      ctx.rotate(car.angle);
    }

    // 1. 车身投影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.beginPath();
    ctx.roundRect(-16, -11 + 4, 32, 22, 7);
    ctx.fill();

    // 2. 喷射尾焰 (冲刺时在车后喷发橙黄烈焰)
    if (car.thrusting && !car.fallen) {
      ctx.save();
      const flameLen = 14 + Math.sin(this.animTime * 28) * 6;
      ctx.fillStyle = '#ff9f43';
      ctx.beginPath();
      ctx.moveTo(-16, -5);
      ctx.lineTo(-16 - flameLen, 0);
      ctx.lineTo(-16, 5);
      ctx.closePath();
      ctx.fill();

      // 核心白热焰心
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-16, -2);
      ctx.lineTo(-16 - flameLen * 0.5, 0);
      ctx.lineTo(-16, 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 3. 软胶车身外壳 (长 32px, 宽 22px, 圆角)
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.roundRect(-16, -11, 32, 22, 8);
    ctx.fill();

    // 4. 金属防撞保险杠 (前端圆弧突出)
    ctx.strokeStyle = bumperColor;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(6, 0, 13, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();

    // 5. 驾驶舱黑色防风玻璃罩
    ctx.fillStyle = '#1e2433';
    ctx.beginPath();
    ctx.roundRect(-8, -7, 16, 14, 5);
    ctx.fill();

    // 6. 驾驶员软胶头盔
    ctx.fillStyle = helmetColor;
    ctx.beginPath();
    ctx.arc(-1, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // 7. 车前大灯光锥 (松手自旋时如雷达般扫射)
    if (!car.fallen) {
      ctx.fillStyle = 'rgba(255, 234, 167, 0.2)';
      ctx.beginPath();
      ctx.moveTo(14, -6);
      ctx.lineTo(55, -22);
      ctx.lineTo(55, 22);
      ctx.lineTo(14, 6);
      ctx.closePath();
      ctx.fill();

      // 双前车灯珠
      ctx.fillStyle = '#ffeaa7';
      ctx.beginPath();
      ctx.arc(14, -6, 2.5, 0, Math.PI * 2);
      ctx.arc(14, 6, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * 粒子更新与绘制
   */
  updateAndDrawParticles(ctx, dt) {
    // 1. 火花粒子
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. 急刹白烟微粒
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const p = this.smoke[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.smoke.splice(i, 1);
        continue;
      }
      const alpha = (p.life / p.maxLife) * 0.45;
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * 倒计时与胜负定格 HUD 浮层
   */
  drawStatusOverlay(ctx, state) {
    const cx = ARENA_CX;
    const cy = ARENA_CY - 20;

    if (state.status === 'countdown') {
      const sec = Math.ceil(state.countdownTimer);
      const text = sec > 0 ? String(sec) : t('hud.go', this.lang);

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 14;

      ctx.font = '900 68px sans-serif';
      ctx.fillStyle = sec > 0 ? '#f5ba31' : '#2ed573';
      ctx.fillText(text, cx, cy);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.strokeText(text, cx, cy);
      ctx.restore();
    } else if (state.status === 'round_end') {
      const isRed = state.roundWinner === 'red';
      const text = isRed ? t('win.titleRed', this.lang) : t('win.titleBlue', this.lang);

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 18;

      ctx.font = '900 46px sans-serif';
      ctx.fillStyle = isRed ? '#ff4757' : '#1e90ff';
      ctx.fillText(text, cx, cy);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeText(text, cx, cy);
      ctx.restore();
    }
  }

  /**
   * 绘制暂停全屏遮罩
   */
  drawPauseOverlay(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(11, 15, 25, 0.72)';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    const cx = ARENA_WIDTH / 2;
    const cy = ARENA_HEIGHT / 2;

    ctx.fillStyle = '#182030';
    ctx.strokeStyle = '#f5ba31';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - 140, cy - 60, 280, 120, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f5ba31';
    ctx.fillRect(cx - 16, cy - 38, 9, 26);
    ctx.fillRect(cx + 7, cy - 38, 9, 26);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('hud.paused', this.lang), cx, cy + 10);

    ctx.fillStyle = '#8c9cb8';
    ctx.font = '12px sans-serif';
    ctx.fillText(t('hud.pausedTip', this.lang), cx, cy + 34);

    ctx.restore();
  }
}
