// 割绳子 Canvas 2D 物理舞台高保真自绘引擎
// 虚拟画布尺寸：640 × 800
import { STAGE_WIDTH, STAGE_HEIGHT } from "./engine.mjs";

export class StageRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dpr = 1;
    this.candyRotation = 0;
    this.particles = [];
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(rect.width * this.dpr);
    this.canvas.height = Math.floor(rect.height * this.dpr);
  }

  addSpark(x, y, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 2.0 + Math.random() * 2.5,
        color: Math.random() > 0.4 ? "#FFE866" : "#60EFFF"
      });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(state, bladeTrail = [], dt = 1 / 60) {
    const ctx = this.ctx;
    if (!ctx) return;

    this.updateParticles(dt);

    const scaleX = this.canvas.width / STAGE_WIDTH;
    const scaleY = this.canvas.height / STAGE_HEIGHT;

    ctx.save();
    ctx.scale(scaleX, scaleY);

    // 1. 绘制微缩瓦楞纸盒场景背景
    this.drawBackground(ctx);

    if (!state) {
      ctx.restore();
      return;
    }

    // 2. 绘制尖刺陷阱
    this.drawSpikes(ctx, state.spikes);

    // 3. 绘制吹气皮囊
    this.drawBellows(ctx, state.bellows);

    // 4. 绘制收集星星
    this.drawStars(ctx, state.stars, state.timeElapsed);

    // 5. 绘制浮空气泡（未被糖果捕获的空泡泡）
    for (const b of state.bubbles) {
      if (!b.popped && !b.captured) {
        this.drawBubble(ctx, b.x, b.y, b.r, state.timeElapsed);
      }
    }

    // 6. 绘制绿色软胶小怪兽 Nommy
    this.drawNommy(ctx, state.nommy, state.candy, state.timeElapsed);

    // 7. 绘制绳索
    this.drawRopes(ctx, state.ropes);

    // 8. 绘制糖果（若在气泡中，附加半透明晶莹气泡外壳）
    this.drawCandy(ctx, state.candy, dt);

    // 9. 绘制粒子火花
    this.drawParticles(ctx);

    // 10. 绘制刀光拖尾轨迹
    this.drawBladeTrail(ctx, bladeTrail);

    ctx.restore();
  }

  drawBackground(ctx) {
    // 瓦楞纸箱暖色内壁渐变
    const grad = ctx.createRadialGradient(
      STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.4, 80,
      STAGE_WIDTH * 0.5, STAGE_HEIGHT * 0.5, 480
    );
    grad.addColorStop(0, "#FAF2DD");
    grad.addColorStop(0.65, "#ECDABA");
    grad.addColorStop(1, "#CEB894");

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

    // 瓦楞纸折痕与微纹理线条
    ctx.save();
    ctx.strokeStyle = "rgba(180, 150, 110, 0.12)";
    ctx.lineWidth = 2;
    for (let y = 20; y < STAGE_HEIGHT; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(STAGE_WIDTH, y);
      ctx.stroke();
    }

    // 箱体内边框立体阴影
    ctx.strokeStyle = "rgba(90, 65, 35, 0.25)";
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, STAGE_WIDTH - 14, STAGE_HEIGHT - 14);

    ctx.strokeStyle = "rgba(70, 50, 25, 0.4)";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, STAGE_WIDTH - 4, STAGE_HEIGHT - 4);
    ctx.restore();
  }

  drawSpikes(ctx, spikes) {
    for (const sp of spikes) {
      ctx.save();
      ctx.translate(sp.x, sp.y);

      const numTeeth = Math.max(3, Math.floor(sp.w / 16));
      const step = sp.w / numTeeth;
      const left = -sp.w / 2;

      // 尖刺底座木条
      ctx.fillStyle = "#5A3E26";
      ctx.beginPath();
      ctx.roundRect(left, -sp.h / 2, sp.w, sp.h, 4);
      ctx.fill();

      // 尖锐铁刺
      ctx.fillStyle = "#8E9EAA";
      ctx.strokeStyle = "#4A5560";
      ctx.lineWidth = 1.5;

      for (let i = 0; i < numTeeth; i++) {
        const x1 = left + i * step;
        const x2 = x1 + step;
        const xm = x1 + step * 0.5;
        const ym = -sp.h / 2 - 14;

        ctx.beginPath();
        ctx.moveTo(x1, -sp.h / 2);
        ctx.lineTo(xm, ym);
        ctx.lineTo(x2, -sp.h / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 锋刃反光
        ctx.beginPath();
        ctx.moveTo(xm, ym);
        ctx.lineTo(xm, -sp.h / 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  drawBellows(ctx, bellows) {
    for (const bel of bellows) {
      ctx.save();
      ctx.translate(bel.x, bel.y);
      ctx.rotate(bel.angle);

      // 气囊风纹扩散波
      if (bel.puffAnim > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(100, 200, 255, ${bel.puffAnim * 0.7})`;
        ctx.lineWidth = 3;
        for (let i = 1; i <= 3; i++) {
          const r = 35 + (1 - bel.puffAnim) * 50 * i;
          ctx.beginPath();
          ctx.arc(0, 0, r, -Math.PI / 4, Math.PI / 4);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 皮囊手柄与风嘴
      ctx.fillStyle = "#D4A359";
      ctx.fillRect(15, -6, 20, 12);

      // 皮囊风箱圆盘
      const scalePuff = 1.0 - bel.puffAnim * 0.22;
      ctx.scale(scalePuff, 1.0);

      ctx.fillStyle = "#8C4A28";
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#5C2F15";
      ctx.stroke();

      // 金属加固铆钉
      ctx.fillStyle = "#E8C87A";
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  drawStars(ctx, stars, time) {
    for (const star of stars) {
      if (star.collected) continue;
      ctx.save();

      // 柔和上下轻浮动
      const floatY = Math.sin(time * 3 + star.x) * 4;
      ctx.translate(star.x, star.y + floatY);

      // 柔和外发光
      const glowGrad = ctx.createRadialGradient(0, 0, 6, 0, 0, 26);
      glowGrad.addColorStop(0, "rgba(255, 230, 80, 0.5)");
      glowGrad.addColorStop(1, "rgba(255, 230, 80, 0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();

      // 五角星绘制
      ctx.fillStyle = "#FFD700";
      ctx.strokeStyle = "#E59400";
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      const spikes = 5;
      const outerR = star.r;
      const innerR = star.r * 0.48;
      let rot = -Math.PI / 2;
      const step = Math.PI / spikes;

      for (let i = 0; i < spikes; i++) {
        let x = Math.cos(rot) * outerR;
        let y = Math.sin(rot) * outerR;
        ctx.lineTo(x, y);
        rot += step;
        x = Math.cos(rot) * innerR;
        y = Math.sin(rot) * innerR;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 星星微光高光
      ctx.fillStyle = "#FFF9D2";
      ctx.beginPath();
      ctx.arc(-3, -4, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  drawBubble(ctx, x, y, r, time) {
    ctx.save();
    ctx.translate(x, y);

    // 泡泡轻微晃动变形
    const wobble = Math.sin(time * 4) * 0.04;
    ctx.scale(1 + wobble, 1 - wobble);

    // 渐变球体
    const bGrad = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
    bGrad.addColorStop(0, "rgba(255, 255, 255, 0.7)");
    bGrad.addColorStop(0.3, "rgba(180, 240, 255, 0.35)");
    bGrad.addColorStop(0.85, "rgba(90, 190, 255, 0.45)");
    bGrad.addColorStop(1, "rgba(40, 140, 255, 0.65)");

    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(160, 230, 255, 0.75)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 弧形高光
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.35, r * 0.35, r * 0.18, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawNommy(ctx, nommy, candy, time) {
    ctx.save();
    ctx.translate(nommy.x, nommy.y);

    // 1. 脚部软胶
    ctx.fillStyle = "#63A42C";
    ctx.beginPath();
    ctx.ellipse(-22, 28, 14, 8, 0, 0, Math.PI * 2);
    ctx.ellipse(22, 28, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. 软胶绿色身躯
    const bodyGrad = ctx.createRadialGradient(-10, -10, 10, 0, 0, 42);
    bodyGrad.addColorStop(0, "#A1E648");
    bodyGrad.addColorStop(0.75, "#78C236");
    bodyGrad.addColorStop(1, "#529420");

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 4, 38, 32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#43781A";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 3. 大白眼睛与跟随眼球
    const eyeDist = 18;
    const eyeR = 12;
    [-eyeDist, eyeDist].forEach((eyeX) => {
      const eyeY = -18;
      ctx.save();
      // 眼白
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#43781A";
      ctx.lineWidth = 2;
      ctx.stroke();

      // 瞳孔注视糖果方向
      const dx = candy.x - (nommy.x + eyeX);
      const dy = candy.y - (nommy.y + eyeY);
      const angle = Math.atan2(dy, dx);
      const pupilOffset = Math.min(5, Math.hypot(dx, dy) / 40);

      const px = eyeX + Math.cos(angle) * pupilOffset;
      const py = eyeY + Math.sin(angle) * pupilOffset;

      ctx.fillStyle = "#1E2A12";
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();

      // 瞳孔反光
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(px - 2, py - 2, 2, 0, Math.PI * 2);
      ctx.fill();

      // 委屈难过时耷拉眉毛
      if (nommy.state === "sad") {
        ctx.strokeStyle = "#385C14";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(eyeX - 8, eyeY - 14);
        ctx.lineTo(eyeX + 8, eyeY - 10);
        ctx.stroke();
      }
      ctx.restore();
    });

    // 4. 嘴巴动画（张大等待 / 吧唧咀嚼）
    const mouthY = -2;
    const openH = nommy.mouthOpen * 20;

    if (nommy.state === "eating") {
      // 咀嚼闭眼笑脸
      ctx.strokeStyle = "#3A1A10";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, mouthY, 14, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    } else if (nommy.mouthOpen > 0.05) {
      // 张开大嘴
      ctx.fillStyle = "#5A1A1A";
      ctx.beginPath();
      ctx.ellipse(0, mouthY, 24, Math.max(6, openH), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#3A1010";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 红色小舌头
      ctx.fillStyle = "#E85D75";
      ctx.beginPath();
      ctx.arc(0, mouthY + openH * 0.4, 10, 0, Math.PI);
      ctx.fill();

      // 上下两颗萌门牙
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.roundRect(-8, mouthY - openH * 0.75, 6, 6, 2);
      ctx.roundRect(2, mouthY - openH * 0.75, 6, 6, 2);
      ctx.fill();
    } else {
      // 萌萌微张或微笑
      ctx.strokeStyle = "#3A1A10";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, mouthY - 4, 12, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawRopes(ctx, ropes) {
    for (const rope of ropes) {
      // 1. 图钉锚点
      ctx.save();
      ctx.translate(rope.anchor.x, rope.anchor.y);
      ctx.fillStyle = "#7A4E2D";
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#4A2B14";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 图钉中心高光
      ctx.fillStyle = "#E4B889";
      ctx.beginPath();
      ctx.arc(-2, -2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. 绳体
      const parts = rope.particles;
      if (!parts || parts.length < 2) continue;

      ctx.save();
      ctx.strokeStyle = "#8A6642";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(parts[0].x, parts[0].y);
      for (let i = 1; i < parts.length; i++) {
        ctx.lineTo(parts[i].x, parts[i].y);
      }
      ctx.stroke();

      // 绳索麻绳双绞纹高光线
      ctx.strokeStyle = "#BFA37E";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(parts[0].x, parts[0].y);
      for (let i = 1; i < parts.length; i++) {
        ctx.lineTo(parts[i].x, parts[i].y);
      }
      ctx.stroke();

      ctx.restore();
    }
  }

  drawCandy(ctx, candy, dt) {
    ctx.save();
    ctx.translate(candy.x, candy.y);

    // 旋转角速度
    this.candyRotation += (candy.vx * 0.005 + 0.02);
    ctx.rotate(this.candyRotation);

    const r = candy.r;

    // 糖果阴影
    ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    // 红白/黄相间旋涡糖
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r);
    grad.addColorStop(0, "#FFE066");
    grad.addColorStop(0.5, "#FF4444");
    grad.addColorStop(0.9, "#C91818");
    grad.addColorStop(1, "#8F0D0D");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // 旋涡糖纹
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#FFE885";
    ctx.lineWidth = 3.5;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.65, a, a + Math.PI / 3);
      ctx.stroke();
    }

    // 晶莹高光反光
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.35, r * 0.35, r * 0.18, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 若糖果包裹在气泡中，附加气泡外罩
    if (candy.inBubble) {
      this.drawBubble(ctx, candy.x, candy.y, r + 14, 0);
    }
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5 * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawBladeTrail(ctx, trail) {
    if (!trail || trail.length < 2) return;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let i = 0; i < trail.length - 1; i++) {
      const p1 = trail[i];
      const p2 = trail[i + 1];
      const life = p1.life || 1.0;

      ctx.strokeStyle = `rgba(110, 245, 255, ${life * 0.85})`;
      ctx.lineWidth = Math.max(1, life * 7);

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // 内芯白光
      ctx.strokeStyle = `rgba(255, 255, 255, ${life})`;
      ctx.lineWidth = Math.max(1, life * 3);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}
