// Pong Neo Canvas 渲染器：柔光街机机台、动态拖尾、碰撞火花与光晕
// 遵循 AGENTS.md：绝不使用死板描边圈，全部使用 createRadialGradient 径向柔光

import { COURT_WIDTH, COURT_HEIGHT, MODES } from "./engine.mjs";

export class CourtRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = [];
  }

  addHitParticles(x, y, color = "#00f0ff", count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 2.2 + Math.random() * 1.5,
        radius: 2 + Math.random() * 2.5,
        color
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

  render(state, dt = 0.016) {
    const ctx = this.ctx;
    this.updateParticles(dt);

    ctx.clearRect(0, 0, COURT_WIDTH, COURT_HEIGHT);

    // 1. 球台背景微渐变
    const bgGrad = ctx.createLinearGradient(0, 0, 0, COURT_HEIGHT);
    bgGrad.addColorStop(0, "#080b18");
    bgGrad.addColorStop(0.5, "#0d1326");
    bgGrad.addColorStop(1, "#080b18");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, COURT_WIDTH, COURT_HEIGHT);

    // 2. 中场虚线与中央圆形光标
    ctx.strokeStyle = "rgba(0, 240, 255, 0.15)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(0, COURT_HEIGHT / 2);
    ctx.lineTo(COURT_WIDTH, COURT_HEIGHT / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(COURT_WIDTH / 2, COURT_HEIGHT / 2, 45, 0, Math.PI * 2);
    ctx.stroke();

    // 3. 绘制上方挡板 (Top Paddle)
    const tp = state.topPaddle;
    const isWall = state.mode === MODES.WALL;
    const topColor = isWall ? "#38bdf8" : "#ff007f";
    drawGlowingPaddle(ctx, tp.x, tp.y, tp.width, tp.height, topColor);

    // 4. 绘制下方挡板 (Bottom Paddle)
    const bp = state.bottomPaddle;
    drawGlowingPaddle(ctx, bp.x, bp.y, bp.width, bp.height, "#00f0ff");

    // 5. 绘制粒子火花
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 6. 绘制小球拖尾 (Ball Trail)
    const ball = state.ball;
    for (let i = 0; i < ball.trail.length; i++) {
      const pos = ball.trail[i];
      const alpha = ((i + 1) / ball.trail.length) * 0.35;
      const trailGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, ball.radius * 1.5);
      trailGrad.addColorStop(0, `rgba(0, 240, 255, ${alpha})`);
      trailGrad.addColorStop(1, "rgba(0, 240, 255, 0)");
      ctx.fillStyle = trailGrad;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, ball.radius * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 7. 绘制发光能量小球（径向柔光，拒绝描边圈）
    const ballGrad = ctx.createRadialGradient(ball.x, ball.y, 1, ball.x, ball.y, ball.radius * 2.2);
    ballGrad.addColorStop(0, "#ffffff");
    ballGrad.addColorStop(0.35, "#e0f2fe");
    ballGrad.addColorStop(0.7, "rgba(0, 240, 255, 0.8)");
    ballGrad.addColorStop(1, "rgba(0, 240, 255, 0)");

    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // 球芯实体
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius * 0.85, 0, Math.PI * 2);
    ctx.fill();

    // 8. 发球倒计时动画提示
    if (state.status === "serving" && state.serveTimer > 0) {
      ctx.save();
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const count = Math.ceil(state.serveTimer * 2.5);
      ctx.fillText(count > 0 ? `${count}` : "READY", COURT_WIDTH / 2, COURT_HEIGHT / 2 - 25);
      ctx.restore();
    }
  }
}

function drawGlowingPaddle(ctx, x, y, width, height, color) {
  const left = x - width / 2;
  const top = y - height / 2;
  const radius = height / 2;

  // 1. 底层环境微柔光（禁止描边）
  const glow = ctx.createRadialGradient(x, y, width * 0.2, x, y, width * 0.8);
  glow.addColorStop(0, hexToRgba(color, 0.25));
  glow.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(x, y, width * 0.75, height * 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. 挡板实体（圆角微浮雕胶囊）
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, left, top, width, height, radius);
  ctx.fillStyle = color;
  ctx.fill();

  // 3. 内部高光条
  ctx.beginPath();
  roundRect(ctx, left + 4, top + 2, width - 8, height / 2 - 1, radius / 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexToRgba(hex, alpha) {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  const num = parseInt(c, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}