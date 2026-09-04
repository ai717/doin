// render：唯一的 canvas 绘制层。只读引擎 state，绝不改规则数据；
// 粒子/ Miner 摆动帧/爪口开合这类纯视觉状态由本模块自己持有。

import { CANVAS, ORIGIN, caughtItem } from "./engine.mjs";

const MINER = Object.freeze({ x: ORIGIN.x, y: 46 });
const GROUND_Y = 52;
const SOIL_TOP = 58;

class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  push(particle) {
    this.particles.push(particle);
  }

  emitSparkle(x, y, count = 3) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      this.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1.5 + Math.random() * 2,
        color: "#facc15",
        alpha: 1,
        life: 0.03,
      });
    }
  }

  emitElectric(x, y) {
    for (let i = 0; i < 2; i += 1) {
      this.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        radius: 2 + Math.random() * 2,
        color: "#fef08a",
        alpha: 1,
        life: 0.06,
      });
    }
  }

  emitDirt(x, y) {
    if (Math.random() > 0.4) return;
    this.push({
      x: x + (Math.random() - 0.5) * 12,
      y: y + (Math.random() - 0.5) * 12,
      vx: (Math.random() - 0.5) * 0.8,
      vy: 0.5 + Math.random(),
      radius: 1 + Math.random() * 2,
      color: "#78350f",
      alpha: 0.8,
      life: 0.04,
    });
  }

  emitExplosion(x, y, count = 35) {
    const colors = ["#ef4444", "#f97316", "#fbbf24", "#71717a"];
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      this.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        life: 0.02 + Math.random() * 0.02,
      });
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.life;
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawPolygon(ctx, shape) {
  ctx.beginPath();
  shape.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
  ctx.closePath();
}

function drawItem(ctx, item) {
  ctx.save();
  ctx.translate(item.x, item.y);

  if (item.type === "GOLD") {
    ctx.fillStyle = "#eab308";
    ctx.strokeStyle = "#ca8a04";
    ctx.lineWidth = 2.5;
    drawPolygon(ctx, item.shape);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.arc(-item.radius * 0.3, -item.radius * 0.3, item.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.type === "DIAMOND") {
    ctx.fillStyle = item.creature ? "#f43f5e" : "#67e8f9";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -item.radius);
    ctx.lineTo(item.radius, 0);
    ctx.lineTo(0, item.radius);
    ctx.lineTo(-item.radius, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (item.creature) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(-3, -2, 2, 2);
      ctx.fillRect(2, -2, 2, 2);
    }
  } else if (item.type === "BAG") {
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.arc(0, 2, item.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b45309";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", 0, 2);
  } else if (item.type === "TNT") {
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(-item.radius, -item.radius, item.radius * 2, item.radius * 2);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("TNT", 0, 0);
  } else {
    ctx.fillStyle = "#78716c";
    ctx.strokeStyle = "#57534e";
    ctx.lineWidth = 2.5;
    drawPolygon(ctx, item.shape);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function drawMiner(ctx, frame, state, pullWeight) {
  ctx.save();
  ctx.translate(MINER.x, MINER.y);

  // 矿车
  ctx.fillStyle = "#475569";
  ctx.fillRect(-26, -8, 52, 16);
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(-16, 8, 6, 0, Math.PI * 2);
  ctx.arc(16, 8, 6, 0, Math.PI * 2);
  ctx.fill();

  if (state === "PULL") ctx.translate(0, Math.sin(frame * 20) * (pullWeight * 0.8));

  // 身体
  ctx.fillStyle = "#dc2626";
  ctx.fillRect(-12, -26, 24, 20);

  // 脸 + 胡子
  ctx.fillStyle = "#fed7aa";
  ctx.beginPath();
  ctx.arc(0, -34, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, -31, 6, 0, Math.PI);
  ctx.fill();

  // 安全帽
  ctx.fillStyle = "#eab308";
  ctx.beginPath();
  ctx.arc(0, -37, 11, Math.PI, 0, false);
  ctx.fill();
  ctx.fillRect(-14, -37, 28, 4);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, -38, 3, 0, Math.PI * 2);
  ctx.fill();

  // 手臂：拉拽时交替摇动，庆祝时上举
  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (state === "PULL") {
    const handX = Math.cos(frame * 10) * 8;
    const handY = Math.sin(frame * 10) * 8 - 14;
    ctx.moveTo(-8, -20);
    ctx.lineTo(handX, handY);
    ctx.moveTo(8, -20);
    ctx.lineTo(handX, handY);
  } else if (state === "CELEBRATE") {
    ctx.moveTo(-10, -20);
    ctx.lineTo(-18, -38);
    ctx.moveTo(10, -20);
    ctx.lineTo(18, -38);
  } else {
    ctx.moveTo(-10, -20);
    ctx.lineTo(0, -12);
    ctx.moveTo(10, -20);
    ctx.lineTo(0, -12);
  }
  ctx.stroke();

  ctx.restore();
}

export function createRenderer(ctx) {
  const particles = new ParticleSystem();
  let minerFrame = 0;
  let jaw = 0.5;

  function drawHook(state) {
    const hook = state.hook;
    const pulling = hook.state === "RETRACTING";
    const hasItem = hook.caughtId !== null;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ORIGIN.x, GROUND_Y);
    if (pulling) {
      // 重载时绳索轻微抖动
      const midX = (ORIGIN.x + hook.x) / 2 + (Math.random() - 0.5) * 2;
      const midY = (GROUND_Y + hook.y) / 2 + (Math.random() - 0.5) * 2;
      ctx.quadraticCurveTo(midX, midY, hook.x, hook.y);
    } else {
      ctx.lineTo(hook.x, hook.y);
    }
    ctx.strokeStyle = state.potion ? "#facc15" : "#94a3b8";
    ctx.lineWidth = state.potion ? 3.5 : 2.5;
    ctx.stroke();

    ctx.translate(hook.x, hook.y);
    ctx.rotate(hook.angle - Math.PI / 2);

    ctx.fillStyle = state.potion ? "#ca8a04" : "#64748b";
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    jaw += ((hasItem ? 0.15 : 0.45) - jaw) * 0.2;

    ctx.strokeStyle = state.potion ? "#fef08a" : "#e2e8f0";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(-6, 8, 12, -Math.PI / 2 - jaw, 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(6, 8, 12, Math.PI - 0.2, Math.PI * 1.5 + jaw);
    ctx.stroke();
    ctx.restore();
  }

  function drawBackground() {
    ctx.clearRect(0, 0, CANVAS.width, CANVAS.height);
    ctx.fillStyle = "#65a30d";
    ctx.fillRect(0, GROUND_Y, CANVAS.width, 6);
    const grad = ctx.createLinearGradient(0, SOIL_TOP, 0, CANVAS.height);
    grad.addColorStop(0, "#78350f");
    grad.addColorStop(0.35, "#451a03");
    grad.addColorStop(1, "#1c1917");
    ctx.fillStyle = grad;
    ctx.fillRect(0, SOIL_TOP, CANVAS.width, CANVAS.height - SOIL_TOP);
  }

  return {
    // 事件驱动的爆发特效（爆炸）由 main.mjs 转发到这里。
    explode(x, y, count = 45) {
      particles.emitExplosion(x, y, count);
    },

    // 回收拉拽时的扬尘；喝了生力水额外放电光。
    reelDirt(x, y, boosted = false) {
      particles.emitDirt(x, y);
      if (boosted) particles.emitElectric(x, y);
    },

    draw(state, fx = {}) {
      drawBackground();

      for (const item of state.items) {
        if (item.collected) continue;
        drawItem(ctx, item);
        if ((item.type === "GOLD" || item.type === "DIAMOND") && Math.random() < 0.04) {
          particles.emitSparkle(item.x, item.y, 2);
        }
      }

      drawHook(state);

      let minerState = "IDLE";
      if (state.hook.state === "SHOOTING") minerState = "SHOOT";
      if (state.hook.state === "RETRACTING") minerState = state.hook.caughtId !== null ? "PULL" : "IDLE";
      if (fx.celebrating) minerState = "CELEBRATE";
      const carried = caughtItem(state);
      minerFrame += 0.05;
      drawMiner(ctx, minerFrame, minerState, carried ? carried.weight : 1);

      particles.update();
      particles.draw(ctx);
    },
  };
}
