// render：唯一的 Canvas 2D 绘制层。只读 engine state，绝不改规则数据。
// 自持：DPR / ResizeObserver / contain 缩放、粒子、涟漪、光斑漂移、shake、指针反算。
// 泡泡、水缸、瞄准线、安全线、特效都画在这里；HUD / 按钮 / 文本留在 DOM 层。

import {
  DROP_Y,
  LEVEL_STYLE,
  MAX_LEVEL,
  SAFETY_Y,
  WALL,
  WORLD,
  levelRadius,
} from "./engine.mjs?v=79c518024932";

const TAU = Math.PI * 2;

function hexToRgba(hex, alpha) {
  const h = String(hex).replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16);
  if (!Number.isFinite(num)) return `rgba(255,255,255,${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  const view = { scale: 1, dpr: 1 };

  const particles = [];
  const ripples = [];
  let shake = 0;
  let clock = 0;

  function resize() {
    const parent = canvas.parentElement;
    const wrapW = parent ? parent.clientWidth : canvas.clientWidth;
    const wrapH = parent ? parent.clientHeight : canvas.clientHeight;
    if (!wrapW || !wrapH) return;
    const fit = Math.min(wrapW / WORLD.width, wrapH / WORLD.height);
    const cssW = Math.max(1, Math.floor(WORLD.width * fit));
    const cssH = Math.max(1, Math.floor(WORLD.height * fit));
    const dpr = Math.min(2, (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    view.scale = canvas.width / WORLD.width;
    view.dpr = dpr;
  }

  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: WORLD.width / 2, y: DROP_Y };
    return {
      x: ((clientX - rect.left) / rect.width) * WORLD.width,
      y: ((clientY - rect.top) / rect.height) * WORLD.height,
    };
  }

  function drawBackground(reduced) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    g.addColorStop(0, "#155a72");
    g.addColorStop(0.42, "#0e3b4d");
    g.addColorStop(1, "#082735");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    // 水下光柱：缓慢漂移的柔光斑（reduced-motion 时定格）。
    const t = reduced ? 0 : clock;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const blobs = [
      { x: 0.28 + Math.sin(t * 0.18) * 0.06, y: 0.2 + Math.cos(t * 0.14) * 0.05, r: 0.5, c: "rgba(111,227,225,0.10)" },
      { x: 0.74 + Math.cos(t * 0.16) * 0.06, y: 0.3 + Math.sin(t * 0.12) * 0.06, r: 0.46, c: "rgba(179,157,219,0.10)" },
      { x: 0.5 + Math.sin(t * 0.1 + 1.2) * 0.1, y: 0.66 + Math.cos(t * 0.13) * 0.05, r: 0.6, c: "rgba(27,79,114,0.16)" },
    ];
    for (const b of blobs) {
      const cx = b.x * WORLD.width;
      const cy = b.y * WORLD.height;
      const rr = b.r * WORLD.width;
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      rg.addColorStop(0, b.c);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
    }
    ctx.restore();

    // 暗角
    const v = ctx.createRadialGradient(
      WORLD.width / 2, WORLD.height * 0.46, WORLD.height * 0.24,
      WORLD.width / 2, WORLD.height * 0.5, WORLD.height * 0.78,
    );
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(2,12,18,0.5)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }

  function drawTank() {
    ctx.save();
    // 玻璃壁（左 / 右 / 底）
    ctx.fillStyle = "rgba(190,240,255,0.07)";
    ctx.fillRect(0, 0, WALL, WORLD.height);
    ctx.fillRect(WORLD.width - WALL, 0, WALL, WORLD.height);
    ctx.fillRect(0, WORLD.height - WALL, WORLD.width, WALL);
    // 内壁高光
    ctx.strokeStyle = "rgba(234,251,255,0.18)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(WALL, 0);
    ctx.lineTo(WALL, WORLD.height - WALL);
    ctx.lineTo(WORLD.width - WALL, WORLD.height - WALL);
    ctx.lineTo(WORLD.width - WALL, 0);
    ctx.stroke();
    // 左侧竖向反光条
    const streak = ctx.createLinearGradient(WALL, 0, WALL + 26, 0);
    streak.addColorStop(0, "rgba(234,251,255,0.12)");
    streak.addColorStop(1, "rgba(234,251,255,0)");
    ctx.fillStyle = streak;
    ctx.fillRect(WALL, 0, 26, WORLD.height - WALL);
    ctx.restore();
  }

  function drawSafetyLine(state, reduced) {
    const danger = state.dangerTime > 0;
    const pulse = reduced ? 0.6 : 0.5 + 0.5 * Math.sin(clock * (danger ? 14 : 3));
    ctx.save();
    ctx.lineWidth = danger ? 3 : 2;
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = danger ? `rgba(255,90,90,${0.55 + pulse * 0.45})` : "rgba(159,230,255,0.4)";
    ctx.beginPath();
    ctx.moveTo(WALL, SAFETY_Y);
    ctx.lineTo(WORLD.width - WALL, SAFETY_Y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (danger) {
      const glow = ctx.createLinearGradient(0, SAFETY_Y - 46, 0, SAFETY_Y);
      glow.addColorStop(0, "rgba(255,80,80,0)");
      glow.addColorStop(1, `rgba(255,80,80,${0.16 + pulse * 0.16})`);
      ctx.fillStyle = glow;
      ctx.fillRect(WALL, SAFETY_Y - 46, WORLD.width - WALL * 2, 46);
    }
    ctx.restore();
  }

  function landingY(state, aimX, r) {
    let best = WORLD.height - WALL - r;
    for (const b of state.bubbles) {
      const dx = b.x - aimX;
      const reach = b.r + r;
      if (Math.abs(dx) >= reach) continue;
      const dy = Math.sqrt(Math.max(0, reach * reach - dx * dx));
      const contactY = b.y - dy;
      if (contactY < best) best = contactY;
    }
    return best;
  }

  function drawAim(state, reduced) {
    const r = levelRadius(state.current);
    const aimX = state.aimX;
    const landY = landingY(state, aimX, r);
    const breathe = reduced ? 1 : 1 + Math.sin(clock * 4) * 0.08;
    ctx.save();
    // 虚线轨迹
    ctx.setLineDash([6, 9]);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "rgba(234,251,255,0.34)";
    ctx.beginPath();
    ctx.moveTo(aimX, DROP_Y);
    ctx.lineTo(aimX, landY);
    ctx.stroke();
    ctx.setLineDash([]);
    // 落点光圈
    ctx.strokeStyle = "rgba(111,227,225,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(aimX, landY, r * 0.92 * breathe, 0, TAU);
    ctx.stroke();
    // 待丢泡泡（悬挂）
    drawBubble({ level: state.current, x: aimX, y: DROP_Y, r, squash: 0 }, reduced, 0.92);
    ctx.restore();
  }

  function drawBubble(b, reduced, alphaScale = 1) {
    const style = LEVEL_STYLE[b.level - 1] || LEVEL_STYLE[0];
    const r = b.r;
    ctx.save();
    ctx.translate(b.x, b.y);
    const sq = reduced ? 0 : b.squash || 0;
    if (sq > 0.002) ctx.scale(1 + sq * 0.16, 1 - sq * 0.16);
    ctx.globalAlpha = alphaScale;

    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.34, r * 0.08, 0, 0, r);
    if (style.iris) {
      g.addColorStop(0, "rgba(255,255,255,0.96)");
      g.addColorStop(0.28, "rgba(255,158,181,0.62)");
      g.addColorStop(0.52, "rgba(111,227,225,0.56)");
      g.addColorStop(0.76, "rgba(179,157,219,0.62)");
      g.addColorStop(1, "rgba(255,214,107,0.55)");
    } else {
      g.addColorStop(0, "rgba(255,255,255,0.9)");
      g.addColorStop(0.34, hexToRgba(style.glow, style.alpha));
      g.addColorStop(0.74, hexToRgba(style.color, style.alpha + 0.14));
      g.addColorStop(1, hexToRgba(style.color, 0.86));
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();

    if (style.iris) {
      ctx.shadowColor = "rgba(255,255,255,0.65)";
      ctx.shadowBlur = 20;
    }
    ctx.lineWidth = Math.max(1, r * 0.055);
    ctx.strokeStyle = style.iris ? "rgba(255,255,255,0.8)" : hexToRgba(style.glow, 0.46);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 顶部高光
    ctx.fillStyle = "rgba(255,255,255,0.66)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.38, r * 0.25, r * 0.16, -0.5, 0, TAU);
    ctx.fill();
    // 底部反光
    ctx.fillStyle = hexToRgba(style.glow, 0.16);
    ctx.beginPath();
    ctx.ellipse(r * 0.18, r * 0.42, r * 0.32, r * 0.15, 0.4, 0, TAU);
    ctx.fill();

    if (b.level === MAX_LEVEL) {
      ctx.strokeStyle = "rgba(255,255,255,0.32)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r + 3.5, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function emitBurst(x, y, level) {
    const style = LEVEL_STYLE[(level || MAX_LEVEL) - 1] || LEVEL_STYLE[MAX_LEVEL - 1];
    const colors = style.iris
      ? ["#ff9eb5", "#6fe3e1", "#ffd66b", "#b39ddb", "#ffffff"]
      : [style.color, style.glow, "#ffffff"];
    const count = level >= MAX_LEVEL ? 64 : 22;
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * TAU;
      const sp = (level >= MAX_LEVEL ? 130 : 70) * (0.4 + Math.random());
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        r: 1.6 + Math.random() * (level >= MAX_LEVEL ? 4.5 : 2.6),
        color: colors[(Math.random() * colors.length) | 0],
        life: 0,
        maxLife: 0.5 + Math.random() * 0.5,
        grav: 220,
      });
    }
    ripples.push({ x, y, r: (levelRadius(level) || 30) * 0.6, maxR: (levelRadius(level) || 30) * (level >= MAX_LEVEL ? 4.4 : 2.6), life: 0, maxLife: level >= MAX_LEVEL ? 0.7 : 0.45, color: style.glow, wide: level >= MAX_LEVEL });
    if (level >= MAX_LEVEL) {
      for (let i = 0; i < 26; i += 1) {
        const a = Math.random() * TAU;
        const sp = 60 + Math.random() * 220;
        particles.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          r: 1 + Math.random() * 2.2, color: "#ffe6a3",
          life: 0, maxLife: 0.6 + Math.random() * 0.6, grav: 40, spark: true,
        });
      }
    }
  }

  function emitRipple(x, y, level) {
    const style = LEVEL_STYLE[(level || 1) - 1] || LEVEL_STYLE[0];
    ripples.push({ x, y, r: levelRadius(level) * 0.5, maxR: levelRadius(level) * 2.1, life: 0, maxLife: 0.42, color: style.glow, wide: false });
  }

  function emitSplash(x, y, level) {
    const style = LEVEL_STYLE[(level || 1) - 1] || LEVEL_STYLE[0];
    for (let i = 0; i < 7; i += 1) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
      const sp = 50 + Math.random() * 90;
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 1.2 + Math.random() * 2, color: style.glow,
        life: 0, maxLife: 0.36 + Math.random() * 0.3, grav: 260,
      });
    }
  }

  function updateFx(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = ripples.length - 1; i >= 0; i -= 1) {
      const r = ripples[i];
      r.life += dt;
      if (r.life >= r.maxLife) ripples.splice(i, 1);
    }
  }

  function drawFx() {
    ctx.save();
    for (const r of ripples) {
      const k = r.life / r.maxLife;
      const rad = r.r + (r.maxR - r.r) * (1 - Math.pow(1 - k, 2));
      ctx.globalAlpha = (1 - k) * 0.6;
      ctx.strokeStyle = hexToRgba(r.color, 1);
      ctx.lineWidth = (r.wide ? 5 : 2.6) * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, TAU);
      ctx.stroke();
    }
    for (const p of particles) {
      const k = p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.fillStyle = p.color;
      if (p.spark) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 - k * 0.5), 0, TAU);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 - k * 0.4), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function clearFx() {
    particles.length = 0;
    ripples.length = 0;
    shake = 0;
  }

  function draw(state, fx = {}) {
    const dt = Math.min(0.05, Number(fx.dt) || 0.016);
    const reduced = !!fx.reduced;
    if (!reduced) clock += dt;
    // 降级模式不推进特效寿命；若仍保留粒子/涟漪，它们会停在初始半径永不消失、
    // 随每次 drop/merge 越积越多成残影。故降级时直接清空且不绘制。
    if (reduced) {
      particles.length = 0;
      ripples.length = 0;
      shake = 0;
    } else {
      updateFx(dt);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let ox = 0;
    let oy = 0;
    if (!reduced && shake > 0.05) {
      ox = (Math.random() - 0.5) * shake;
      oy = (Math.random() - 0.5) * shake;
      shake *= 0.86;
    } else {
      shake = 0;
    }
    const s = view.scale;
    ctx.setTransform(s, 0, 0, s, ox * s, oy * s);

    drawBackground(reduced);
    drawTank();
    drawSafetyLine(state, reduced);

    for (const b of state.bubbles) drawBubble(b, reduced, 1);

    if (state.status === "playing" && !state.paused) drawAim(state, reduced);

    if (!reduced) drawFx();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => resize());
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    else ro.observe(canvas);
  }
  resize();

  return {
    resize,
    toWorld,
    draw,
    burst: emitBurst,
    ripple: emitRipple,
    splash: emitSplash,
    setShake(mag) {
      shake = Math.max(shake, Math.min(14, Number(mag) || 0));
    },
    clearFx,
  };
}
