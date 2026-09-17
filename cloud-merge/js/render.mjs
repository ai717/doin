// render.mjs: Canvas 2D 蓝天云海与蓬松云朵高质感渲染器。
// 负责所有图形绘制、粒子喷发、天气效果与瞄准线。
// 采用深邃高对比晴空，让白色棉花云与彩虹云极具立体感与视觉冲击力。

import {
  WORLD,
  WALL,
  SAFETY_Y,
  DROP_Y,
  levelRadius,
  CLOUD_DEFS,
  MAX_LEVEL,
} from "./engine.mjs?v=35ad794d8cf9";

export class CloudRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = [];
    this.rainbowAnims = [];
    this.isEn = false;
    this.bgClouds = [
      { x: 50, y: 180, r: 44, speed: 5 },
      { x: 320, y: 290, r: 66, speed: 3.5 },
      { x: 110, y: 470, r: 52, speed: 4 },
      { x: 370, y: 560, r: 48, speed: 6 },
    ];
  }

  setLocale(locale) {
    this.isEn = locale === "en";
  }

  addMergePuff(x, y, level) {
    const count = 12 + level * 2;
    const def = CLOUD_DEFS[Math.min(level - 1, CLOUD_DEFS.length - 1)];
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 90;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 25,
        radius: 5 + Math.random() * 9,
        color: def ? def.glow : "#FFFFFF",
        alpha: 0.95,
        life: 0.5 + Math.random() * 0.35,
        maxLife: 0.85,
      });
    }
  }

  addRainSplash(x, y) {
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI * 0.2 - Math.random() * Math.PI * 0.6;
      const speed = 70 + Math.random() * 110;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2.5 + Math.random() * 3.5,
        color: "#93C5FD",
        alpha: 0.95,
        life: 0.45,
        maxLife: 0.45,
      });
    }
  }

  addRainbowCelebration(x, y) {
    this.rainbowAnims.push({
      x,
      y,
      progress: 0,
      duration: 1.3,
    });
    for (let i = 0; i < 42; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 200;
      const colors = ["#F43F5E", "#FB923C", "#FACC15", "#4ADE80", "#38BDF8", "#818CF8", "#C084FC"];
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        radius: 3.5 + Math.random() * 6,
        color: colors[i % colors.length],
        alpha: 1.0,
        life: 0.9 + Math.random() * 0.5,
        maxLife: 1.4,
      });
    }
  }

  render(state, dt = 0.016) {
    const ctx = this.ctx;
    const width = WORLD.width;
    const height = WORLD.height;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // 1. 绘制高对比深邃晴空背景
    this.drawSkyBackground(ctx, state, dt);

    // 2. 绘制漂移的透光背景云影
    this.drawBackgroundClouds(ctx, dt);

    // 3. 绘制安全预警线
    this.drawSafetyLine(ctx, state);

    // 4. 绘制降雨流
    if (state.rainActiveUntil > state.timeElapsed) {
      this.drawRainStream(ctx, state);
    }

    // 5. 绘制所有场上云朵
    for (let i = 0; i < state.clouds.length; i += 1) {
      this.drawCloud(ctx, state.clouds[i], state.timeElapsed);
    }

    // 6. 绘制粒子
    this.updateAndDrawParticles(ctx, dt);

    // 7. 绘制彩虹收集特效
    this.updateAndDrawRainbows(ctx, dt);

    // 8. 绘制瞄准引导线与待投掷云朵
    if (state.status !== "over") {
      this.drawAimGuide(ctx, state);
    }

    ctx.restore();
  }

  drawSkyBackground(ctx, state, dt) {
    const grad = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    if (state.isDanger) {
      // 变暗暴风雨预警色
      grad.addColorStop(0, "#1E1B4B");
      grad.addColorStop(0.35, "#312E81");
      grad.addColorStop(0.75, "#4338CA");
      grad.addColorStop(1, "#374151");
    } else {
      // 深邃高对比蔚蓝天幕：纯白云朵在上面立体分明、清爽纯净
      grad.addColorStop(0, "#0C4A6E");    // 天顶深海蓝
      grad.addColorStop(0.3, "#0284C7");  // 湛蓝晴空
      grad.addColorStop(0.7, "#38BDF8");  // 明朗蔚蓝
      grad.addColorStop(1, "#7DD3FC");    // 天际透光蓝
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    // 左右容器侧壁（深邃晶莹边框）
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(0, 0, WALL, WORLD.height);
    ctx.fillRect(WORLD.width - WALL, 0, WALL, WORLD.height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(WALL - 1.5, 0, 1.5, WORLD.height);
    ctx.fillRect(WORLD.width - WALL, 0, 1.5, WORLD.height);

    // 底部白色棉花云托底
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(12, 74, 110, 0.45)";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(0, WORLD.height - WALL);
    for (let x = 0; x <= WORLD.width; x += 38) {
      ctx.arc(x, WORLD.height - WALL + 4, 24, Math.PI, 0, false);
    }
    ctx.lineTo(WORLD.width, WORLD.height);
    ctx.lineTo(0, WORLD.height);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  drawBackgroundClouds(ctx, dt) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    for (const bc of this.bgClouds) {
      bc.x += bc.speed * dt;
      if (bc.x > WORLD.width + bc.r * 2) {
        bc.x = -bc.r * 2;
      }
      ctx.beginPath();
      ctx.arc(bc.x, bc.y, bc.r * 0.7, 0, Math.PI * 2);
      ctx.arc(bc.x + bc.r * 0.4, bc.y - bc.r * 0.2, bc.r * 0.8, 0, Math.PI * 2);
      ctx.arc(bc.x + bc.r * 0.9, bc.y, bc.r * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawSafetyLine(ctx, state) {
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = state.isDanger ? "#EF4444" : "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = state.isDanger ? 3.5 : 2;
    ctx.shadowColor = state.isDanger ? "#EF4444" : "rgba(255, 255, 255, 0.8)";
    ctx.shadowBlur = state.isDanger ? 12 : 4;
    ctx.moveTo(WALL, SAFETY_Y);
    ctx.lineTo(WORLD.width - WALL, SAFETY_Y);
    ctx.stroke();
    ctx.restore();
  }

  drawCloud(ctx, cloud, time) {
    const { x, y, radius, level } = cloud;
    const def = CLOUD_DEFS[Math.min(level - 1, CLOUD_DEFS.length - 1)];

    ctx.save();
    ctx.translate(x, y);

    // 立体下沉柔和阴影，让白云在蓝天中自然悬浮
    ctx.shadowColor = "rgba(5, 30, 60, 0.38)";
    ctx.shadowBlur = Math.min(18, 6 + level * 1.4);
    ctx.shadowOffsetY = 4 + level * 0.5;

    // 彩虹云额外环形霓虹彩光
    if (level === MAX_LEVEL) {
      const rainbowGrad = ctx.createRadialGradient(0, 0, radius * 0.7, 0, 0, radius * 1.4);
      rainbowGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
      rainbowGrad.addColorStop(0.4, "rgba(244, 114, 182, 0.5)");
      rainbowGrad.addColorStop(0.7, "rgba(250, 204, 21, 0.5)");
      rainbowGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = rainbowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 绘制蓬松云朵（多球复合拟真模型）
    ctx.fillStyle = def.color;
    ctx.beginPath();

    const lobes = 6;
    const lobeRadius = radius * 0.54;
    const centerRadius = radius * 0.46;

    for (let i = 0; i < lobes; i += 1) {
      const angle = (i / lobes) * Math.PI * 2;
      const lx = Math.cos(angle) * centerRadius;
      const ly = Math.sin(angle) * (centerRadius * 0.85);
      ctx.arc(lx, ly, lobeRadius, 0, Math.PI * 2);
    }
    ctx.arc(0, 0, radius * 0.65, 0, Math.PI * 2);
    ctx.fill();

    // 清晰立体外描边
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = level >= 8 ? "rgba(255, 255, 255, 0.65)" : "rgba(255, 255, 255, 0.95)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 绘制生动表情或特色元素
    this.drawCloudDecor(ctx, level, radius, time);

    // 如果是 L10 彩虹云，绘制“点击收集”小角标
    if (level === MAX_LEVEL) {
      const pulse = 1 + Math.sin(time * 6) * 0.12;
      ctx.save();
      ctx.scale(pulse, pulse);
      ctx.fillStyle = "#F43F5E";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#FFFFFF";
      ctx.shadowBlur = 6;
      ctx.fillText("🌈 点我放晴", 0, -radius * 0.88);
      ctx.restore();
    }

    ctx.restore();
  }

  drawCloudDecor(ctx, level, radius, time) {
    // 眼睛与微笑（黑深色在白云上对比鲜明，雷暴云上用亮米白）
    const eyeOffsetX = radius * 0.28;
    const eyeOffsetY = -radius * 0.05;
    const eyeR = Math.max(2.2, radius * 0.075);

    ctx.fillStyle = level >= 8 ? "#F8FAFC" : "#1E293B";
    ctx.beginPath();
    ctx.arc(-eyeOffsetX, eyeOffsetY, eyeR, 0, Math.PI * 2);
    ctx.arc(eyeOffsetX, eyeOffsetY, eyeR, 0, Math.PI * 2);
    ctx.fill();

    // 嘴巴
    ctx.strokeStyle = level >= 8 ? "#F8FAFC" : "#1E293B";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, eyeOffsetY + eyeR + 2, radius * 0.14, 0.15 * Math.PI, 0.85 * Math.PI, false);
    ctx.stroke();

    // 粉扑扑的腮红
    ctx.fillStyle = "rgba(244, 114, 182, 0.55)";
    ctx.beginPath();
    ctx.arc(-eyeOffsetX - eyeR - 2.5, eyeOffsetY + 4, eyeR * 1.3, 0, Math.PI * 2);
    ctx.arc(eyeOffsetX + eyeR + 2.5, eyeOffsetY + 4, eyeR * 1.3, 0, Math.PI * 2);
    ctx.fill();

    // 特殊天气挂件
    if (level === 5 || level === 6 || level === 7) {
      // 雨滴
      ctx.fillStyle = "#38BDF8";
      ctx.font = `${Math.round(radius * 0.36)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("💧", 0, radius * 0.5);
    } else if (level === 8) {
      // 雷电
      ctx.fillStyle = "#FACC15";
      ctx.font = `${Math.round(radius * 0.44)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("⚡", 0, radius * 0.5);
    } else if (level === 9) {
      // 雪花
      ctx.fillStyle = "#E0F2FE";
      ctx.font = `${Math.round(radius * 0.42)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("❄️", 0, radius * 0.5);
    }
  }

  drawRainStream(ctx, state) {
    const sx = state.rainSourceX;
    const sy = state.rainSourceY;
    const width = 84;

    ctx.save();
    ctx.strokeStyle = "#93C5FD";
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 20; i += 1) {
      const rx = sx - width / 2 + Math.random() * width;
      const ry = sy + 30 + Math.random() * (WORLD.height - sy - 30);
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 5, ry + 18);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawAimGuide(ctx, state) {
    const aimX = state.aimX;
    const level = state.currentDrop;
    const r = levelRadius(level);

    ctx.save();

    // 垂直瞄准虚线（高亮白色）
    ctx.beginPath();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#38BDF8";
    ctx.shadowBlur = 6;
    ctx.moveTo(aimX, DROP_Y + r);
    ctx.lineTo(aimX, WORLD.height - WALL);
    ctx.stroke();

    // 顶部待释放云朵预览
    const ghost = {
      x: aimX,
      y: DROP_Y,
      radius: r,
      level,
    };
    this.drawCloud(ctx, ghost, state.timeElapsed);

    ctx.restore();
  }

  updateAndDrawParticles(ctx, dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, p.life / p.maxLife);

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  updateAndDrawRainbows(ctx, dt) {
    for (let i = this.rainbowAnims.length - 1; i >= 0; i -= 1) {
      const anim = this.rainbowAnims[i];
      anim.progress += dt / anim.duration;
      if (anim.progress >= 1) {
        this.rainbowAnims.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.sin(anim.progress * Math.PI) * 0.95;

      // 绘制横跨天穹的绚烂七色彩虹拱门
      const colors = ["#F43F5E", "#FB923C", "#FACC15", "#4ADE80", "#38BDF8", "#818CF8", "#C084FC"];
      const cx = WORLD.width / 2;
      const cy = WORLD.height * 0.72;
      const baseR = 145;

      for (let c = 0; c < colors.length; c += 1) {
        ctx.strokeStyle = colors[c];
        ctx.lineWidth = 7;
        ctx.shadowColor = colors[c];
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(cx, cy, baseR + c * 7, Math.PI, 0, false);
        ctx.stroke();
      }

      ctx.restore();
    }
  }
}
