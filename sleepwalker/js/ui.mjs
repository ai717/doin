/**
 * @file games/sleepwalker/js/ui.mjs
 * 负责微缩剧场 Canvas 2.5D 视窗绘制与视觉动效。
 * 包含夜空景深、微缩街景、软胶条纹睡衣小人、柔光呼吸机关、打呼噜浮动粒子与礼花。
 */

import { STAGE_WIDTH, STAGE_HEIGHT } from './engine.mjs';
import { t } from './i18n.mjs';

export class DioramaRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hoveredGadgetId = null;
    this.animTime = 0;
    this.particles = [];
    this.zzzParticles = [];
    this.rewindEffectTimer = 0;
    this.lang = 'zh';

    // 初始化微缩背景星光点
    this.stars = [];
    for (let i = 0; i < 48; i++) {
      this.stars.push({
        x: Math.random() * STAGE_WIDTH,
        y: Math.random() * (STAGE_HEIGHT * 0.6),
        r: Math.random() * 1.5 + 0.5,
        twinkleSpeed: Math.random() * 2 + 1,
        phase: Math.random() * Math.PI * 2,
      });
    }

    this.setupResolution();
  }

  setupResolution() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = STAGE_WIDTH * dpr;
    this.canvas.height = STAGE_HEIGHT * dpr;
    this.ctx.scale(dpr, dpr);
  }

  setHoveredGadget(gadgetId) {
    this.hoveredGadgetId = gadgetId;
  }

  setLanguage(lang) {
    this.lang = lang === 'en' ? 'en' : 'zh';
  }

  triggerRewindEffect() {
    this.rewindEffectTimer = 0.35;
  }

  /**
   * 产出 Zzz 浮动泡泡
   */
  spawnZzz(x, y) {
    this.zzzParticles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 8 + 6,
      vy: -18 - Math.random() * 8,
      alpha: 0.9,
      size: 10 + Math.random() * 4,
      char: Math.random() > 0.4 ? 'z' : 'Z',
    });
  }

  /**
   * 产出通关欢庆金星粒子
   */
  spawnConfetti(x, y) {
    const colors = ['#f1c40f', '#e67e22', '#e74c3c', '#9b59b6', '#3498db', '#2ecc71', '#ffffff'];
    for (let i = 0; i < 36; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 180 + 60;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        r: Math.random() * 3 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1.5,
        maxLife: 1.5,
      });
    }
  }

  /**
   * 主渲染循环
   */
  render(state, dt = 0.016) {
    this.animTime += dt;
    const ctx = this.ctx;

    ctx.save();
    ctx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

    // 1. 远景：月光夜空渐变与微弱星云
    this.drawSky(ctx, state);

    // 2. 远景：城市/游乐场/工地剪影与微缩远山
    this.drawSilhouette(ctx, state);

    // 3. 中景：静态平台与建筑地基
    this.drawPlatforms(ctx, state);

    // 4. 场景交互机关 (带呼吸光晕)
    this.drawGadgets(ctx, state);

    // 5. 危险物 (恶犬、排气蒸汽等)
    this.drawHazards(ctx, state);

    // 6. 终点：温暖软床/吊床/太空舱
    this.drawBed(ctx, state);

    // 7. 收集物：梦境金泡泡
    this.drawBubbles(ctx, state);

    // 8. 主角：梦游先生 (软胶睡衣、睡帽晃动、表情)
    this.drawSleepwalker(ctx, state);

    // 9. 前景粒子系统 (Zzz 呼吸字符与过关礼花)
    this.updateAndDrawParticles(ctx, dt);

    // 10. 时光倒带视觉涟漪
    if (this.rewindEffectTimer > 0) {
      this.rewindEffectTimer -= dt;
      this.drawRewindOverlay(ctx);
    }

    // 11. 新手引导手势指示 (Level 1)
    this.drawTutorialPointer(ctx, state);

    // 12. 暂停中半透明遮罩
    if (state.isPaused) {
      this.drawPauseOverlay(ctx, state);
    }

    ctx.restore();
  }

  /**
   * 绘制夜空、星光与皎洁弯月
   */
  drawSky(ctx, state) {
    const act = Math.ceil(state.levelId / 4.5);
    let topColor = '#0b101d';
    let btmColor = '#1a233a';

    if (act === 2) {
      // 狂欢游乐场紫夜
      topColor = '#150c26';
      btmColor = '#2d184a';
    } else if (act === 3) {
      // 工地铁锈夜
      topColor = '#0d131a';
      btmColor = '#1d2630';
    } else if (act === 4) {
      // 动物园深林夜
      topColor = '#081716';
      btmColor = '#132d2c';
    } else if (act === 5) {
      // 未来大都会赛博深蓝
      topColor = '#070b1a';
      btmColor = '#161e38';
    }

    const grad = ctx.createLinearGradient(0, 0, 0, STAGE_HEIGHT);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, btmColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

    // 绘制微闪星辰
    for (const s of this.stars) {
      const alpha = 0.4 + 0.5 * Math.sin(this.animTime * s.twinkleSpeed + s.phase);
      ctx.fillStyle = `rgba(255, 245, 190, ${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 绘制金色月牙 (柔和倾斜，无交叉自交伪影)
    ctx.save();
    ctx.translate(STAGE_WIDTH - 120, 80);
    ctx.rotate(-0.35); // 优雅微倾斜

    // 月亮柔和环境外光晕
    const moonGlow = ctx.createRadialGradient(-6, 0, 8, -6, 0, 58);
    moonGlow.addColorStop(0, 'rgba(255, 238, 140, 0.38)');
    moonGlow.addColorStop(0.5, 'rgba(255, 220, 100, 0.12)');
    moonGlow.addColorStop(1, 'rgba(255, 220, 100, 0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(-6, 0, 58, 0, Math.PI * 2);
    ctx.fill();

    // 月牙主体：外弧为完美的半圆弧线，内弧为顺滑贝塞尔曲线，两端优雅收拢于锐角尖峰
    ctx.beginPath();
    ctx.arc(0, 0, 25, 1.5 * Math.PI, 0.5 * Math.PI, true);
    ctx.bezierCurveTo(-11, 16, -11, -16, 0, -25);
    ctx.closePath();

    // 渐变质感填充
    const moonGrad = ctx.createLinearGradient(-25, -25, 10, 25);
    moonGrad.addColorStop(0, '#fff8b8');
    moonGrad.addColorStop(0.6, '#fcd24f');
    moonGrad.addColorStop(1, '#e59e19');
    ctx.fillStyle = moonGrad;
    ctx.fill();

    // 月牙微光边缘
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 绘制微缩背景剪影
   */
  drawSilhouette(ctx, state) {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 15, 28, 0.45)';
    // 简易城市屋脊线剪影
    ctx.beginPath();
    ctx.moveTo(0, STAGE_HEIGHT);
    ctx.lineTo(0, 380);
    ctx.lineTo(80, 360);
    ctx.lineTo(130, 390);
    ctx.lineTo(240, 340);
    ctx.lineTo(310, 370);
    ctx.lineTo(440, 330);
    ctx.lineTo(520, 360);
    ctx.lineTo(640, 320);
    ctx.lineTo(760, 360);
    ctx.lineTo(STAGE_WIDTH, 340);
    ctx.lineTo(STAGE_WIDTH, STAGE_HEIGHT);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * 绘制静态建筑、砖瓦与钢架平台
   */
  drawPlatforms(ctx, state) {
    for (const p of state.platforms) {
      ctx.save();
      const x = p.x;
      const y = p.y;
      const w = p.w;
      const h = p.h || 16;

      // 平台实体立体浮雕 (深石色/红木/金属)
      let topColor = '#3a445d';
      let frontColor = '#242b3d';
      let rimColor = '#5c6b8c';

      if (p.type === 'roof') {
        topColor = '#7a3939';
        frontColor = '#4a2020';
        rimColor = '#a84d4d';
      } else if (p.type === 'girder' || p.type === 'scaffold') {
        topColor = '#c48227';
        frontColor = '#7d4f10';
        rimColor = '#f5b041';
      } else if (p.type === 'wood' || p.type === 'carnival') {
        topColor = '#8d5524';
        frontColor = '#5c3614';
        rimColor = '#b87333';
      } else if (p.type === 'neon' || p.type === 'cyber' || p.type === 'space') {
        topColor = '#1d3557';
        frontColor = '#0f1d30';
        rimColor = '#457b9d';
      }

      // 平台前立面
      ctx.fillStyle = frontColor;
      ctx.fillRect(x, y + 4, w, h + 10);

      // 平台顶面受光面
      ctx.fillStyle = topColor;
      ctx.fillRect(x, y, w, 6);

      // 平台高光金边饰线
      ctx.fillStyle = rimColor;
      ctx.fillRect(x, y, w, 2);

      // 砖瓦/铆钉小细节纹理
      if (p.type === 'girder') {
        ctx.fillStyle = '#f5b041';
        for (let rx = x + 12; rx < x + w - 10; rx += 24) {
          ctx.beginPath();
          ctx.arc(rx, y + 8, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }
  }

  /**
   * 绘制可互动的场景机关（带柔和呼吸微光圈）
   */
  drawGadgets(ctx, state) {
    const breath = 0.5 + 0.5 * Math.sin(this.animTime * 3);

    for (const id in state.gadgets) {
      const g = state.gadgets[id];
      const isHovered = (this.hoveredGadgetId === g.id);
      const isBlinking = !g.triggered && state.status === 'playing';

      ctx.save();

      // 1. 无边界径向柔光高亮圈 (取代生硬硬边描边圈)
      if (isBlinking || isHovered) {
        const glowRadius = Math.max(g.w, g.h) * 0.8 + (isHovered ? 14 : breath * 8);
        const glowX = g.x + g.w / 2;
        const glowY = g.y + g.h / 2;

        const radial = ctx.createRadialGradient(glowX, glowY, 4, glowX, glowY, glowRadius);
        if (isHovered) {
          radial.addColorStop(0, 'rgba(255, 234, 167, 0.45)');
          radial.addColorStop(0.5, 'rgba(253, 203, 110, 0.2)');
          radial.addColorStop(1, 'rgba(253, 203, 110, 0)');
        } else {
          radial.addColorStop(0, `rgba(255, 234, 167, ${0.15 + breath * 0.15})`);
          radial.addColorStop(0.6, `rgba(253, 203, 110, ${0.08 + breath * 0.08})`);
          radial.addColorStop(1, 'rgba(253, 203, 110, 0)');
        }
        ctx.fillStyle = radial;
        ctx.beginPath();
        ctx.arc(glowX, glowY, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. 根据机关类型绘制实体
      if (g.type === 'timed' && g.id.includes('manhole')) {
        // 下水道井盖
        const isClosed = g.active;
        if (isClosed) {
          // 盖上状态：形成结实铸铁圆盘
          ctx.fillStyle = '#4a5568';
          ctx.beginPath();
          ctx.roundRect(g.x, g.y, g.w, 10, 4);
          ctx.fill();
          ctx.strokeStyle = '#cbd5e0';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // 蒸汽倒计时指示条
          const remainPct = Math.max(0, g.timer / g.duration);
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(g.x + 4, g.y + 3, (g.w - 8) * remainPct, 3);
        } else {
          // 洞口打开：深黑洞口带冒出的热蒸汽微粒
          ctx.fillStyle = '#111827';
          ctx.fillRect(g.x + 6, g.y, g.w - 12, 18);
          // 冒出蒸汽
          ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
          const steamY = g.y - 10 - ((this.animTime * 40) % 30);
          ctx.beginPath();
          ctx.arc(g.x + g.w * 0.5, steamY, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (g.type === 'spring' || g.props?.isBouncy) {
        // 遮阳蓬 / 弹簧跳板
        const bounceScale = g.active ? 1.25 : 1.0;
        ctx.save();
        ctx.translate(g.x + g.w / 2, g.y + g.h / 2);
        ctx.scale(1, bounceScale);

        // 红白/黄蓝相间波浪雨棚
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.roundRect(-g.w / 2, -g.h / 2, g.w, g.h, 6);
        ctx.fill();

        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(-g.w / 4, -g.h / 2, g.w / 2, g.h);

        // 弹簧小支架
        ctx.strokeStyle = '#bdc3c7';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-g.w / 3, g.h / 2);
        ctx.lineTo(-g.w / 3, g.h / 2 + 10);
        ctx.moveTo(g.w / 3, g.h / 2);
        ctx.lineTo(g.w / 3, g.h / 2 + 10);
        ctx.stroke();
        ctx.restore();
      } else if (g.type === 'fan' || g.props?.isWind) {
        // 排气风机 / 反重力光束发射端
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.roundRect(g.x, g.y, g.w, g.h, 4);
        ctx.fill();

        // 旋转风叶
        ctx.save();
        ctx.translate(g.x + g.w / 2, g.y + g.h / 2);
        if (g.active) {
          ctx.rotate(this.animTime * 12);
        }
        ctx.fillStyle = '#bdc3c7';
        for (let a = 0; a < 4; a++) {
          ctx.rotate(Math.PI / 2);
          ctx.fillRect(-2, -12, 4, 12);
        }
        ctx.restore();

        // 活跃时的向上气流光柱
        if (g.active) {
          const windGrad = ctx.createLinearGradient(0, g.y, 0, g.y - 180);
          windGrad.addColorStop(0, 'rgba(100, 220, 255, 0.35)');
          windGrad.addColorStop(1, 'rgba(100, 220, 255, 0)');
          ctx.fillStyle = windGrad;
          ctx.fillRect(g.x, g.y - 180, g.w, 180);
        }
      } else if (g.type === 'distract') {
        // 骨头食盆 (引开恶犬)
        ctx.fillStyle = '#95a5a6';
        ctx.beginPath();
        ctx.arc(g.x + g.w / 2, g.y + g.h / 2 + 6, 16, 0, Math.PI, false);
        ctx.fill();

        // 骨头
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(g.x + 8, g.y + 4, g.w - 16, 8, 4);
        ctx.fill();
        ctx.arc(g.x + 8, g.y + 4, 4, 0, Math.PI * 2);
        ctx.arc(g.x + 8, g.y + 12, 4, 0, Math.PI * 2);
        ctx.arc(g.x + g.w - 8, g.y + 4, 4, 0, Math.PI * 2);
        ctx.arc(g.x + g.w - 8, g.y + 12, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 通用机械横梁/翻板
        const isPlatActive = g.active;
        ctx.fillStyle = isPlatActive ? '#2ecc71' : '#e67e22';
        ctx.beginPath();
        ctx.roundRect(g.x, g.y, g.w, g.h, 4);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  /**
   * 绘制危险物 (恶犬等)
   */
  drawHazards(ctx, state) {
    for (const h of state.hazards) {
      ctx.save();
      let isActive = true;
      if (h.linkedGadgetId && state.gadgets[h.linkedGadgetId]?.active) {
        isActive = false; // 被引开
      }

      if (h.type === 'dog') {
        // 斗牛犬
        const hx = h.x;
        const hy = h.y;
        ctx.fillStyle = isActive ? '#5c3a21' : '#8d6e63';
        // 犬身
        ctx.beginPath();
        ctx.ellipse(hx + 20, hy + 18, 18, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        // 犬头
        ctx.beginPath();
        ctx.ellipse(hx + 8, hy + 10, 10, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // 红色项圈
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(hx + 12, hy + 10, 4, 8);

        if (isActive) {
          // 恶狠狠睁眼 + 警告小叹号
          ctx.fillStyle = '#f1c40f';
          ctx.beginPath();
          ctx.arc(hx + 6, hy + 8, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#e74c3c';
          ctx.font = 'bold 14px sans-serif';
          ctx.fillText('!', hx + 12, hy - 4);
        } else {
          // 埋头欢快啃骨头
          ctx.fillStyle = '#ffffff';
          ctx.font = '10px sans-serif';
          ctx.fillText('nom~', hx + 16, hy - 2);
        }
      }
      ctx.restore();
    }
  }

  /**
   * 绘制终点：温暖软床
   */
  drawBed(ctx, state) {
    const bed = state.bed;
    ctx.save();
    const bx = bed.x;
    const by = bed.y;
    const bw = bed.w;
    const bh = bed.h;

    // 床架红木微浮雕
    ctx.fillStyle = '#4a2c11';
    ctx.beginPath();
    ctx.roundRect(bx - 4, by, 8, bh + 8, 3); // 床头立柱
    ctx.roundRect(bx + bw - 4, by + 4, 8, bh + 4, 3); // 床尾立柱
    ctx.fill();

    // 软绵绵白床垫
    ctx.fillStyle = '#ecf0f1';
    ctx.beginPath();
    ctx.roundRect(bx, by + 8, bw, bh - 6, 4);
    ctx.fill();

    // 蓬松的大棉被 (暖浅蓝色)
    ctx.fillStyle = '#3498db';
    ctx.beginPath();
    ctx.roundRect(bx + 14, by + 10, bw - 14, bh - 8, 4);
    ctx.fill();

    // 蓬松白枕头
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(bx + 2, by + 4, 16, 12, 4);
    ctx.fill();

    ctx.restore();
  }

  /**
   * 绘制 3 颗梦境金泡泡
   */
  drawBubbles(ctx, state) {
    for (const b of state.bubbles) {
      if (b.collected) continue;

      ctx.save();
      // 轻微上下漂浮
      const bobY = b.y + Math.sin(this.animTime * 3 + b.id) * 4;

      // 晶莹金色光晕
      const rad = ctx.createRadialGradient(b.x, bobY, 2, b.x, bobY, b.r + 6);
      rad.addColorStop(0, 'rgba(255, 234, 167, 0.9)');
      rad.addColorStop(0.5, 'rgba(253, 203, 110, 0.5)');
      rad.addColorStop(1, 'rgba(253, 203, 110, 0)');
      ctx.fillStyle = rad;
      ctx.beginPath();
      ctx.arc(b.x, bobY, b.r + 6, 0, Math.PI * 2);
      ctx.fill();

      // 金泡泡球体外壳
      ctx.fillStyle = 'rgba(254, 211, 48, 0.75)';
      ctx.beginPath();
      ctx.arc(b.x, bobY, b.r, 0, Math.PI * 2);
      ctx.fill();

      // 水晶高光
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x - 4, bobY - 4, b.r * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // 内嵌金色小星星
      ctx.fillStyle = '#b7791f';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', b.x, bobY + 1);

      ctx.restore();
    }
  }

  /**
   * 绘制主角：梦游先生 (经典红白条纹软胶睡衣与晃动长睡帽)
   */
  drawSleepwalker(ctx, state) {
    const walker = state.walker;
    ctx.save();

    // 脚底中心坐标 (x, y)
    ctx.translate(walker.x, walker.y);
    ctx.scale(walker.facing, 1);

    // 步态轻柔起伏
    const bob = Math.sin(walker.bobPhase || 0) * 2;

    if (walker.state === 'sleep') {
      // 倒在床上安然入梦
      ctx.translate(0, -6);
      ctx.rotate(-Math.PI / 2);
    } else if (walker.state === 'panic') {
      // 惊吓跌落扑腾
      ctx.translate(0, -20);
      ctx.rotate(Math.sin(this.animTime * 18) * 0.35);
    } else {
      ctx.translate(0, bob - 2);
    }

    // 1. 脚部软拖鞋
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.roundRect(-8, -4, 8, 4, 2);
    ctx.roundRect(2, -4, 8, 4, 2);
    ctx.fill();

    // 2. 红白条纹睡衣躯干 (3D 软胶微浮雕)
    const bodyW = 18;
    const bodyH = 20;
    const bodyX = -bodyW / 2;
    const bodyY = -bodyH - 4;

    ctx.fillStyle = '#e74c3c'; // 红色底
    ctx.beginPath();
    ctx.roundRect(bodyX, bodyY, bodyW, bodyH, 5);
    ctx.fill();

    // 白色条纹
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bodyX, bodyY + 4, bodyW, 3);
    ctx.fillRect(bodyX, bodyY + 11, bodyW, 3);

    // 3. 头部与脸庞
    const headR = 8;
    const headX = 0;
    const headY = bodyY - headR;

    ctx.fillStyle = '#ffd3b6'; // 温暖肤色
    ctx.beginPath();
    ctx.arc(headX, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    // 4. 面部神情 (安详熟睡闭眼 vs 惊恐瞪眼)
    if (walker.state === 'panic') {
      // 惊恐瞪大双眼
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(headX + 2, headY - 1, 3, 0, Math.PI * 2);
      ctx.arc(headX + 7, headY - 1, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(headX + 3, headY - 1, 1.5, 0, Math.PI * 2);
      ctx.arc(headX + 8, headY - 1, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // 张大惊呼的“O”嘴
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.ellipse(headX + 5, headY + 4, 3, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 祥和安逸微笑闭眼
      ctx.strokeStyle = '#5a3d28';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(headX + 4, headY - 1, 2.5, 0.1 * Math.PI, 0.9 * Math.PI, false);
      ctx.stroke();

      // 腮红
      ctx.fillStyle = 'rgba(231, 76, 60, 0.35)';
      ctx.beginPath();
      ctx.arc(headX + 5, headY + 3, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. 招牌长睡帽 (随风甩动带有白色软绒球)
    const capSway = (walker.state === 'panic')
      ? Math.sin(this.animTime * 20) * 18 - 25 // 惊叫时睡帽直竖飞起
      : -12 + Math.sin(this.animTime * 4) * 4;

    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.moveTo(headX - 6, headY - 4);
    ctx.lineTo(headX + 7, headY - 4);
    ctx.quadraticCurveTo(headX - 10, headY - 22, headX - 16 + capSway * 0.4, headY - 18 + capSway);
    ctx.closePath();
    ctx.fill();

    // 睡帽白色绒毛球
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(headX - 16 + capSway * 0.4, headY - 18 + capSway, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // 周期性产出 Zzz 浮动气泡
    if (walker.state === 'walk' && Math.random() < 0.04) {
      this.spawnZzz(walker.x + 8 * walker.facing, walker.y - 36);
    }

    ctx.restore();
  }

  /**
   * 更新并绘制所有前景微粒与 Zzz
   */
  updateAndDrawParticles(ctx, dt) {
    // 1. Zzz 气泡
    for (let i = this.zzzParticles.length - 1; i >= 0; i--) {
      const p = this.zzzParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= dt * 0.4;
      if (p.alpha <= 0) {
        this.zzzParticles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.fillStyle = `rgba(255, 234, 167, ${p.alpha})`;
      ctx.font = `bold ${p.size}px sans-serif`;
      ctx.fillText(p.char, p.x, p.y);
      ctx.restore();
    }

    // 2. 欢庆礼花彩色粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt; // 重力微下坠
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
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
  }

  /**
   * 绘制 5 秒时光倒带滤镜涟漪
   */
  drawRewindOverlay(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(74, 144, 226, 0.18)';
    ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

    // 磁带倒带扫描线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let y = 0; y < STAGE_HEIGHT; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(STAGE_WIDTH, y);
      ctx.stroke();
    }

    // 居中倒带提示徽标
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('<< REWIND 5s', STAGE_WIDTH / 2, 60);
    ctx.restore();
  }

  /**
   * 绘制第 1 关新手引导手指与气泡提示
   */
  drawTutorialPointer(ctx, state) {
    if (state.levelId === 1 && state.status === 'playing') {
      const g = state.gadgets['g_manhole_1'];
      if (g && !g.active) {
        ctx.save();
        const floatY = Math.sin(this.animTime * 5) * 6;
        const targetX = g.x + g.w / 2;
        const targetY = g.y - 32 + floatY;

        // 脉冲波纹光圈
        const pulseR = 26 + Math.sin(this.animTime * 4) * 8;
        ctx.strokeStyle = 'rgba(245, 186, 49, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(targetX, g.y + g.h / 2, pulseR, 0, Math.PI * 2);
        ctx.stroke();

        // 提示气泡胶囊
        const tipText = t('hud.tutorialTap', this.lang);
        ctx.font = 'bold 12px sans-serif';
        const textW = ctx.measureText(tipText).width;
        const bubbleW = textW + 20;
        const bubbleH = 26;

        ctx.fillStyle = 'rgba(13, 17, 26, 0.92)';
        ctx.strokeStyle = '#f5ba31';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(targetX - bubbleW / 2, targetY - 30, bubbleW, bubbleH, 13);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fce277';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tipText, targetX, targetY - 17);

        // 手指图标
        ctx.font = '22px sans-serif';
        ctx.fillText('👇', targetX, targetY + 8);

        ctx.restore();
      }
    }
  }

  /**
   * 绘制游戏暂停遮罩与指引卡片
   */
  drawPauseOverlay(ctx, state) {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 14, 23, 0.7)';
    ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

    const cx = STAGE_WIDTH / 2;
    const cy = STAGE_HEIGHT / 2;

    // 暂停面板背景
    ctx.fillStyle = '#141c2b';
    ctx.strokeStyle = '#f5ba31';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - 150, cy - 65, 300, 130, 16);
    ctx.fill();
    ctx.stroke();

    // 暂停双竖线图标
    ctx.fillStyle = '#f5ba31';
    ctx.fillRect(cx - 18, cy - 42, 10, 28);
    ctx.fillRect(cx + 8, cy - 42, 10, 28);

    // 标题
    const pausedTitle = t('hud.paused', this.lang);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pausedTitle, cx, cy + 8);

    // 提示
    const pausedTip = t('hud.pausedTip', this.lang);
    ctx.fillStyle = '#8c9cb8';
    ctx.font = '12px sans-serif';
    ctx.fillText(pausedTip, cx, cy + 34);

    ctx.restore();
  }
}
