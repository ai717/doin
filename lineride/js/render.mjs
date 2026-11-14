// render：Canvas 渲染层，唯一碰 Canvas 的地方。
// 负责绘制轨道线、小人、UI 元素、背景等。

import { CONTACT_THRESHOLD, LINE_TYPES } from "./engine.mjs";

// 颜色定义
const COLORS = {
  normal: "#4A90D9",
  normalGlow: "rgba(74,144,217,0.25)",
  boost: "#E8734A",
  boostGlow: "rgba(232,115,74,0.25)",
  slow: "#6BC4A6",
  slowGlow: "rgba(107,196,166,0.25)",
  scenery: "rgba(255,255,255,0.35)",
  sceneryGlow: "rgba(255,255,255,0.08)",
  rider: "#E84A5F",
  riderScarf: "#E84A5F",
  riderHat: "#4A5FE8",
  riderSled: "#4A90D9",
  startFlag: "#FFD700",
  finishFlag: "#4ADE80",
  finishFlagRing: "rgba(74,222,128,0.35)",
  star: "#FFD700",
  starUncollected: "rgba(255,215,0,0.3)",
  spark: "#FFD700",
  inkBarBg: "rgba(255,255,255,0.1)",
  inkBarFill: "rgba(74,144,217,0.6)",
  grid: "rgba(255,255,255,0.04)",
  canvasBg: "#0f1923",
};

export function createRenderer(ctx) {
  const canvas = ctx.canvas;
  let particles = [];
  let stars = []; // 背景星星

  // 初始化背景星星
  function initStars() {
    stars = [];
    for (let i = 0; i < 60; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: 0.5 + Math.random() * 1.5,
        twinkle: Math.random() * Math.PI * 2,
        speed: 0.005 + Math.random() * 0.015,
      });
    }
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initStars();
  }

  // 视口变换
  function applyView(state) {
    ctx.save();
    ctx.translate(canvas.width / (2 * (window.devicePixelRatio || 1)), canvas.height / (2 * (window.devicePixelRatio || 1)));
    ctx.scale(state.viewScale, state.viewScale);
    ctx.translate(-state.viewOffset.x, -state.viewOffset.y);
  }

  function restoreView() {
    ctx.restore();
  }

  // 绘制背景
  function drawBackground(state) {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    // 极光渐变
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#1a1a3e");
    grad.addColorStop(0.3, "#1a1040");
    grad.addColorStop(0.6, "#2d1b69");
    grad.addColorStop(1, "#0d1b2a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 极光光带
    const time = (Date.now() / 1000) % 20;
    const auroraGrad = ctx.createLinearGradient(0, h * 0.2, 0, h * 0.5);
    auroraGrad.addColorStop(0, "rgba(80,200,120,0)");
    auroraGrad.addColorStop(0.3, `rgba(80,200,120,${0.08 + Math.sin(time * 0.7) * 0.03})`);
    auroraGrad.addColorStop(0.5, `rgba(100,180,220,${0.06 + Math.cos(time * 0.5) * 0.02})`);
    auroraGrad.addColorStop(0.7, "rgba(60,100,180,0)");
    ctx.fillStyle = auroraGrad;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.15);
    ctx.bezierCurveTo(w * 0.3, h * 0.12, w * 0.5, h * 0.35, w, h * 0.1);
    ctx.lineTo(w, h * 0.55);
    ctx.bezierCurveTo(w * 0.5, h * 0.5, w * 0.3, h * 0.25, 0, h * 0.35);
    ctx.closePath();
    ctx.fill();

    // 背景星星
    for (const s of stars) {
      s.twinkle += s.speed;
      const alpha = 0.3 + Math.sin(s.twinkle) * 0.3;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 底部松林剪影
    ctx.fillStyle = "#0a1520";
    ctx.beginPath();
    for (let x = 0; x < w + 100; x += 80) {
      const treeH = 60 + Math.sin(x * 0.02) * 30;
      ctx.moveTo(x, h);
      ctx.lineTo(x + 20, h - treeH);
      ctx.lineTo(x + 40, h);
    }
    ctx.fill();
  }

  // 画网格：铺满整个可视视口（视口中心 = viewOffset）
  function drawGrid(state) {
    const gs = 50;
    const dpr = window.devicePixelRatio || 1;
    const s = state.viewScale;
    const vw = canvas.width / (dpr * s);  // 可见世界宽
    const vh = canvas.height / (dpr * s); // 可见世界高
    const left = state.viewOffset.x - vw / 2;
    const top = state.viewOffset.y - vh / 2;
    const right = left + vw;
    const bottom = top + vh;
    const startX = Math.floor(left / gs) * gs;
    const startY = Math.floor(top / gs) * gs;

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let x = startX; x <= right + gs; x += gs) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }
    for (let y = startY; y <= bottom + gs; y += gs) {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }
  }

  // 绘制线段：按线型批量描边（曲线细分后段数很多，逐段 shadowBlur 会拖垮帧率）
  function drawLines(state) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const type of LINE_TYPES) {
      const segs = state.lines.filter(s => s.type === type);
      if (segs.length === 0) continue;
      const core = type === "scenery" ? 1.5 : 3;

      ctx.beginPath();
      for (const s of segs) {
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
      }
      // 外层柔光
      ctx.strokeStyle = COLORS[type + "Glow"] || COLORS.normalGlow;
      ctx.lineWidth = core + 5;
      ctx.stroke();
      // 内层实线
      ctx.strokeStyle = COLORS[type] || COLORS.normal;
      ctx.lineWidth = core;
      ctx.stroke();
    }
  }

  // 落笔点提示：一笔刚按下、还没有成段时给一个圆点
  function drawStrokeTip(state) {
    const st = state.stroke;
    if (!st) return;
    const p = st.points[st.points.length - 1];
    ctx.fillStyle = COLORS[st.type] || COLORS.normal;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 绘制小人
  function drawRider(state) {
    if (!state.riderAlive) return;
    const { x, y, angle, onTrack } = state.rider;
    const cos = Math.cos(angle), sin = Math.sin(angle);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // 雪橇
    ctx.fillStyle = COLORS.riderSled;
    ctx.fillRect(-12, 0, 24, 4);
    // 雪橇滑轨
    ctx.fillStyle = "#BBB";
    ctx.fillRect(-14, 4, 28, 2);

    // 身体（坐姿Q版）
    ctx.fillStyle = "#3B5998";
    ctx.beginPath();
    ctx.ellipse(0, -10, 6, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 头
    ctx.fillStyle = "#FFDAB9";
    ctx.beginPath();
    ctx.arc(0, -20, 6, 0, Math.PI * 2);
    ctx.fill();

    // 护耳帽
    ctx.fillStyle = COLORS.riderHat;
    ctx.beginPath();
    ctx.arc(0, -22, 7, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-8, -24, 16, 4);

    // 毛球
    ctx.fillStyle = "#FFF";
    ctx.beginPath();
    ctx.arc(0, -28, 2, 0, Math.PI * 2);
    ctx.fill();

    // 围巾
    ctx.fillStyle = COLORS.riderScarf;
    ctx.fillRect(-5, -15, 10, 3);
    // 围巾飘动
    ctx.fillStyle = COLORS.riderScarf;
    ctx.beginPath();
    ctx.moveTo(5, -15);
    ctx.lineTo(14, -12);
    ctx.lineTo(12, -8);
    ctx.lineTo(5, -14);
    ctx.closePath();
    ctx.fill();

    // 眼睛
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(2, -21, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 脸颊红晕
    ctx.fillStyle = "rgba(255,150,150,0.5)";
    ctx.beginPath();
    ctx.arc(4, -19, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 高速火花粒子
    const speed = Math.sqrt(state.rider.vx ** 2 + state.rider.vy ** 2);
    if (onTrack && speed > 300) {
      const sparkChance = Math.min((speed - 300) / 1500, 1);
      if (Math.random() < sparkChance * 0.5) {
        particles.push({
          x: x - cos * 12 + (Math.random() - 0.5) * 6,
          y: y - sin * 12 + 4 + (Math.random() - 0.5) * 3,
          vx: (Math.random() - 0.5) * 40,
          vy: -Math.random() * 60,
          life: 0.3 + Math.random() * 0.3,
          size: 1 + Math.random() * 2,
        });
      }
    }
  }

  // 绘制星标
  function drawStar(sx, sy, collected, r = 8) {
    if (collected) {
      ctx.fillStyle = COLORS.star;
      ctx.shadowColor = "rgba(255,215,0,0.5)";
      ctx.shadowBlur = 8;
    } else {
      ctx.fillStyle = COLORS.starUncollected;
      ctx.shadowBlur = 0;
    }
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const or = i === 0 ? r : r * 0.4;
      if (i === 0) ctx.moveTo(sx + Math.cos(angle) * r, sy + Math.sin(angle) * r);
      else ctx.lineTo(sx + Math.cos(angle) * r, sy + Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // 绘制旗帜
  function drawFlag(fx, fy, color, text) {
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(fx - 1.5, fy - 25, 3, 25);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(fx + 1.5, fy - 25);
    ctx.lineTo(fx + 16, fy - 20);
    ctx.lineTo(fx + 1.5, fy - 14);
    ctx.closePath();
    ctx.fill();
    if (text) {
      ctx.fillStyle = "#FFF";
      ctx.font = "7px sans-serif";
      ctx.fillText(text, fx + 3, fy - 16);
    }
  }

  // 更新与绘制火花粒子
  function drawParticles(dt) {
    ctx.fillStyle = "#FFD700";
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = p.life / 0.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // 通关纸屑粒子
  function drawConfetti(state) {
    // 简单纸屑效果：通关后从终点飘出
    if (!state.events.some(e => e.type === "finished")) return;
    // 简化实现
    const fx = state.finishMarker?.x || 0;
    const fy = state.finishMarker?.y || 0;
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(fx, fy, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,215,0,0.3)";
    ctx.beginPath();
    ctx.arc(fx, fy, 25, 0, Math.PI * 2);
    ctx.fill();
  }

  // 主渲染
  function render(state, dt = 1 / 60) {
    resize();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground(state);

    applyView(state);

    drawGrid(state);

    // 绘制所有线段
    drawLines(state);
    drawStrokeTip(state);

    // 星标
    for (const s of state.stars) {
      drawStar(s.x, s.y, s.collected);
    }

    // 起点旗帜
    if (state.startMarker) {
      drawFlag(state.startMarker.x, state.startMarker.y, COLORS.startFlag, "START");
    }

    // 终点旗帜
    if (state.finishMarker) {
      drawFlag(state.finishMarker.x, state.finishMarker.y, COLORS.finishFlag, "GOAL");
    }

    // 小人
    drawRider(state);

    // 粒子
    drawParticles(dt);

    // 通关效果
    drawConfetti(state);

    restoreView();
  }

  return { render, resize };
}