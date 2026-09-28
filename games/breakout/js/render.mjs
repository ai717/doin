// render.mjs — Canvas 渲染层，唯一碰 DOM/Canvas 的层。
// 负责绘制舞台、砖块、球、底板、Boss、激光与粒子。

import {
  FIELD_W,
  FIELD_H,
  PADDLE_Y,
  PADDLE_H,
  BALL_R,
  BRICK_W,
  BRICK_H,
  BRICK_LEFT,
  BRICK_TOP,
  BRICK_GAP,
} from "./engine.mjs";
import { BRICK_HP } from "./levels.mjs";

const BRICK_COLORS = {
  1: { fill: "#3a7bd5", glow: "#5b9dff", stroke: "#7db8ff" },
  2: { fill: "#2e9e6b", glow: "#46c98a", stroke: "#6ee0a6" },
  3: { fill: "#d4882a", glow: "#ffb04a", stroke: "#ffd27a" },
  4: { fill: "#8a3fc4", glow: "#b066e6", stroke: "#d4a3ff" },
  5: { fill: "#5a6473", glow: "#8a95a6", stroke: "#aeb6c2" },
  6: { fill: "#c43a3a", glow: "#ff5a5a", stroke: "#ff8a8a" },
  7: { fill: "#d4a82a", glow: "#ffd24a", stroke: "#ffe98a" },
};

export function createRenderer(canvas, options = {}) {
  const ctx = canvas.getContext("2d");
  let dpr = Math.max(1, Math.min(3, options.dpr ?? (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1)));
  let reducedMotion = Boolean(options.reducedMotion);
  const particles = [];
  const floaters = [];
  let lastBgTime = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    dpr = Math.max(1, Math.min(3, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawnParticles(x, y, color, count = 6) {
    if (reducedMotion) return;
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0.4 + Math.random() * 0.3,
        max: 0.6,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function spawnFloater(x, y, text, color) {
    floaters.push({ x, y, text, color, life: 0.9, max: 0.9 });
  }

  function handleEvent(event) {
    switch (event.type) {
      case "brickBreak": {
        const c = BRICK_COLORS[event.brickType] || BRICK_COLORS[1];
        spawnParticles(event.x, event.y, c.glow, 8);
        break;
      }
      case "explosion":
        spawnParticles(event.x, event.y, "#ff7a3a", 18);
        break;
      case "bossHit":
        spawnParticles(event.x, event.y, "#ffcc33", 4);
        break;
      case "bossDown":
        spawnParticles(event.x, event.y, "#ffd24a", 30);
        break;
      case "multiball":
        spawnParticles(event.x, event.y, "#4dd0e1", 10);
        break;
      default:
        break;
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
      p.life -= dt;
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      if (particles[i].life <= 0) particles.splice(i, 1);
    }
    for (const f of floaters) {
      f.y -= 30 * dt;
      f.life -= dt;
    }
    for (let i = floaters.length - 1; i >= 0; i -= 1) {
      if (floaters[i].life <= 0) floaters.splice(i, 1);
    }
  }

  function drawBackground(dt) {
    lastBgTime += dt;
    const grad = ctx.createRadialGradient(FIELD_W / 2, FIELD_H * 0.3, 40, FIELD_W / 2, FIELD_H / 2, FIELD_W);
    grad.addColorStop(0, "#1a0b2e");
    grad.addColorStop(0.6, "#0f0620");
    grad.addColorStop(1, "#06020e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);

    // 漂浮符文微粒
    ctx.save();
    for (let i = 0; i < 18; i += 1) {
      const x = (i * 73 + lastBgTime * 8) % FIELD_W;
      const y = (i * 137 + Math.sin(lastBgTime * 0.5 + i) * 20) % FIELD_H;
      ctx.globalAlpha = 0.08 + 0.04 * Math.sin(lastBgTime + i);
      ctx.fillStyle = i % 2 ? "#d4af37" : "#8a5cf0";
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 顶部符文光带
    const topGrad = ctx.createLinearGradient(0, 0, 0, 40);
    topGrad.addColorStop(0, "rgba(212,175,55,0.18)");
    topGrad.addColorStop(1, "rgba(212,175,55,0)");
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, FIELD_W, 40);
  }

  function drawBricks(state) {
    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      const c = BRICK_COLORS[brick.type] || BRICK_COLORS[1];
      const x = brick.x;
      const y = brick.y;
      // 径向柔光背景
      const glow = ctx.createRadialGradient(x + BRICK_W / 2, y + BRICK_H / 2, 2, x + BRICK_W / 2, y + BRICK_H / 2, BRICK_W);
      glow.addColorStop(0, c.glow + "55");
      glow.addColorStop(1, c.glow + "00");
      ctx.fillStyle = glow;
      ctx.fillRect(x - 6, y - 6, BRICK_W + 12, BRICK_H + 12);

      // 砖体
      ctx.fillStyle = c.fill;
      ctx.fillRect(x, y, BRICK_W, BRICK_H);
      // 顶部高光
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(x, y, BRICK_W, 3);
      // 边框
      ctx.strokeStyle = c.stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, BRICK_W - 1, BRICK_H - 1);

      // 多血量指示
      if (brick.maxHp > 1 && brick.type !== 5) {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = "bold 12px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(brick.hp), x + BRICK_W / 2, y + BRICK_H / 2);
      }
      // 钢砖纹理
      if (brick.type === 5) {
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.beginPath();
        ctx.moveTo(x + 4, y + BRICK_H / 2);
        ctx.lineTo(x + BRICK_W - 4, y + BRICK_H / 2);
        ctx.stroke();
      }
    }
  }

  function drawBall(state, ball) {
    // 拖尾
    if (!reducedMotion) {
      const trail = ctx.createRadialGradient(ball.x, ball.y, 1, ball.x, ball.y, ball.r * 3);
      trail.addColorStop(0, "rgba(255,180,80,0.5)");
      trail.addColorStop(1, "rgba(255,180,80,0)");
      ctx.fillStyle = trail;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // 球体
    const grad = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, ball.r);
    grad.addColorStop(0, "#fff3c4");
    grad.addColorStop(0.5, "#ffb04a");
    grad.addColorStop(1, "#c43a0a");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    // 高光
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.arc(ball.x - 2.5, ball.y - 2.5, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPaddle(state) {
    const p = state.paddle;
    const x = p.x - p.w / 2;
    const y = PADDLE_Y;
    // 柔光
    const glow = ctx.createRadialGradient(p.x, y + PADDLE_H / 2, 2, p.x, y + PADDLE_H / 2, p.w);
    glow.addColorStop(0, "rgba(212,175,55,0.4)");
    glow.addColorStop(1, "rgba(212,175,55,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 10, y - 8, p.w + 20, PADDLE_H + 16);
    // 底板主体
    const grad = ctx.createLinearGradient(x, y, x, y + PADDLE_H);
    grad.addColorStop(0, "#ffe9a8");
    grad.addColorStop(0.5, "#d4af37");
    grad.addColorStop(1, "#8a6a1a");
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, p.w, PADDLE_H, 6);
    ctx.fill();
    // 符文刻线
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + PADDLE_H / 2);
    ctx.lineTo(x + p.w - 8, y + PADDLE_H / 2);
    ctx.stroke();
  }

  function drawBoss(state) {
    const boss = state.boss;
    if (!boss) return;
    const { x, y, radius } = boss;
    // 外层光环
    const glow = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 2);
    glow.addColorStop(0, "rgba(212,55,55,0.4)");
    glow.addColorStop(1, "rgba(212,55,55,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2, 0, Math.PI * 2);
    ctx.fill();
    // Boss 主体
    const grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 4, x, y, radius);
    grad.addColorStop(0, "#ff7a7a");
    grad.addColorStop(0.6, boss.hitFlash > 0 ? "#ffffff" : "#b02020");
    grad.addColorStop(1, "#5a0a0a");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    // 符文环
    ctx.strokeStyle = "#ffd24a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    // 血条
    const barW = radius * 2;
    const barH = 6;
    const barX = x - radius;
    const barY = y - radius - 14;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = "#ff4a4a";
    ctx.fillRect(barX, barY, barW * (boss.hp / boss.maxHp), barH);
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
  }

  function drawLasers(state) {
    for (const laser of state.lasers) {
      ctx.strokeStyle = "#ff3d7f";
      ctx.lineWidth = laser.w;
      ctx.shadowColor = "#ff3d7f";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(laser.x, laser.y);
      ctx.lineTo(laser.x, laser.y + 16);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.max);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const f of floaters) {
      const alpha = Math.max(0, f.life / f.max);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = f.color;
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function draw(state, dt) {
    updateParticles(dt);
    ctx.clearRect(0, 0, FIELD_W, FIELD_H);
    drawBackground(dt);
    drawBricks(state);
    drawBoss(state);
    drawLasers(state);
    for (const ball of state.balls) drawBall(state, ball);
    drawPaddle(state);
    drawParticles();
  }

  function clear() {
    particles.length = 0;
    floaters.length = 0;
    ctx.clearRect(0, 0, FIELD_W, FIELD_H);
  }

  function particleCount() {
    return particles.length;
  }

  function setReducedMotion(value) {
    reducedMotion = Boolean(value);
  }

  resize();
  return { draw, clear, resize, handleEvent, particleCount, setReducedMotion };
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
