// render.mjs: 唯一绘制层 —— Canvas 2D 绘制铁盒内的糖果世界（物理状态只读，绝不改状态）

import { WORLD, CANDY_R, STAR_R, ropeGeometry, ropeAnchor } from "./engine.mjs";

const TAU = Math.PI * 2;

const THEMES = {
  tin: {
    inner: ["#59232b", "#23101a"],
    glow: "rgba(242,180,69,0.20)",
    velvet: "#3b1620",
    accent: "#e9d8a6",
    rope: "#a8442a",
    trim: "#c9963f",
  },
  wrapper: {
    inner: ["#4a2740", "#1f1020"],
    glow: "rgba(240,140,170,0.18)",
    velvet: "#3a1730",
    accent: "#f6d6e2",
    rope: "#b24a5e",
    trim: "#d9a3b8",
  },
  bubble: {
    inner: ["#16404d", "#071620"],
    glow: "rgba(127,216,232,0.18)",
    velvet: "#0f2a35",
    accent: "#d5f3f8",
    rope: "#3f7f92",
    trim: "#7fd8e8",
  },
  wind: {
    inner: ["#3a3519", "#14130a"],
    glow: "rgba(227,210,103,0.16)",
    velvet: "#2b280f",
    accent: "#f4eeb8",
    rope: "#9a7a3a",
    trim: "#e3d267",
  },
  night: {
    inner: ["#2e2350", "#110b24"],
    glow: "rgba(179,157,219,0.18)",
    velvet: "#1d1533",
    accent: "#e5dcf7",
    rope: "#7a5aa8",
    trim: "#b39ddb",
  },
};

export function themeOf(name) {
  return THEMES[name] ?? THEMES.tin;
}

/** 粒子系统：切绳火花、收星、胜利喷发、气泡破裂 */
function createParticles() {
  const list = [];
  return {
    list,
    spawn(opts) {
      if (list.length > 420) return;
      list.push({
        x: opts.x,
        y: opts.y,
        vx: opts.vx ?? 0,
        vy: opts.vy ?? 0,
        life: opts.life ?? 0.6,
        age: 0,
        r: opts.r ?? 3,
        color: opts.color ?? "#f2b445",
        gravity: opts.gravity ?? 900,
        shape: opts.shape ?? "dot",
        spin: opts.spin ?? 0,
        rot: opts.rot ?? 0,
      });
    },
    burst(x, y, n, opts = {}) {
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * TAU;
        const s = (opts.speed ?? 160) * (0.4 + Math.random() * 0.8);
        this.spawn({
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - (opts.lift ?? 0),
          life: (opts.life ?? 0.6) * (0.6 + Math.random() * 0.7),
          r: (opts.r ?? 3) * (0.6 + Math.random() * 0.9),
          color: Array.isArray(opts.color)
            ? opts.color[(Math.random() * opts.color.length) | 0]
            : opts.color,
          gravity: opts.gravity ?? 900,
          shape: opts.shape ?? "dot",
          spin: (Math.random() - 0.5) * 12,
        });
      }
    },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const p = list[i];
        p.age += dt;
        if (p.age >= p.life) {
          list.splice(i, 1);
          continue;
        }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
      }
    },
    clear() {
      list.length = 0;
    },
  };
}

function starPath(ctx, x, y, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.46;
    const a = rot + (i / 10) * TAU - Math.PI / 2;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function createRenderer({ canvas, reduceMotion = false }) {
  const ctx = canvas.getContext("2d");
  const particles = createParticles();
  let dpr = 1;
  let scale = 1;
  let t0 = 0;
  let time = 0;
  let themeName = "tin";

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, rect.width);
    const cssH = Math.max(1, rect.height || (cssW * WORLD.h) / WORLD.w);
    dpr = Math.min(2, (typeof devicePixelRatio === "number" ? devicePixelRatio : 1) || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    scale = Math.min(cssW / WORLD.w, cssH / WORLD.h);
  }

  /** 屏幕坐标 → 世界坐标 */
  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width || 1;
    const cssH = rect.height || 1;
    const offX = (cssW - WORLD.w * scale) / 2;
    const offY = (cssH - WORLD.h * scale) / 2;
    return {
      x: (clientX - rect.left - offX) / scale,
      y: (clientY - rect.top - offY) / scale,
    };
  }

  function setTheme(name) {
    themeName = name in THEMES ? name : "tin";
  }

  // ---- 背景与盒内空间 ----
  function drawBackdrop(th) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.h);
    g.addColorStop(0, th.inner[0]);
    g.addColorStop(1, th.inner[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);

    // 顶部暖光晕
    const glow = ctx.createRadialGradient(WORLD.w * 0.5, -40, 20, WORLD.w * 0.5, -40, WORLD.h * 1.05);
    glow.addColorStop(0, th.glow);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);

    // 绒布细纹
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD.w; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.h);
      ctx.stroke();
    }
    ctx.restore();

    // 暗角
    const vig = ctx.createRadialGradient(
      WORLD.w / 2,
      WORLD.h / 2,
      WORLD.h * 0.35,
      WORLD.w / 2,
      WORLD.h / 2,
      WORLD.h * 0.95
    );
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  }

  function drawWalls(walls) {
    for (const w of walls) {
      ctx.save();
      ctx.strokeStyle = "#6d5b3f";
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawSpikes(spikes) {
    for (const s of spikes) {
      const dx = s.x2 - s.x1;
      const dy = s.y2 - s.y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const step = 18;
      const n = Math.max(1, Math.floor(len / step));
      const h = 20;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < n; i += 1) {
        const a = i / n;
        const b = (i + 0.5) / n;
        const c = (i + 1) / n;
        const ax = s.x1 + dx * a;
        const ay = s.y1 + dy * a;
        const bx = s.x1 + dx * b + nx * h;
        const by = s.y1 + dy * b + ny * h;
        const cx = s.x1 + dx * c;
        const cy = s.y1 + dy * c;
        if (i === 0) ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.lineTo(cx, cy);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(s.x1, s.y1, s.x1 + nx * h, s.y1 + ny * h);
      g.addColorStop(0, "#4a4a52");
      g.addColorStop(1, "#d7dbe2");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawCushion(c, th) {
    const ang = Math.atan2(c.dy, c.dx);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(ang);
    // 风箱体
    ctx.fillStyle = "#5a4a2e";
    ctx.strokeStyle = "#2c2416";
    ctx.lineWidth = 2;
    roundRect(ctx, -26, -26, 40, 52, 8);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 2;
    for (let i = -18; i <= 18; i += 12) {
      ctx.beginPath();
      ctx.moveTo(i, -22);
      ctx.lineTo(i, 22);
      ctx.stroke();
    }
    // 喷口
    ctx.fillStyle = "#c9963f";
    roundRect(ctx, 12, -12, 12, 24, 4);
    ctx.fill();
    ctx.strokeStyle = "#6b4d1c";
    ctx.stroke();
    ctx.restore();

    if (c.active > 0) {
      const k = c.active / 0.5;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k) * 0.55;
      const g = ctx.createLinearGradient(c.x, c.y, c.x + c.dx * 0.6 * c.range, c.y + c.dy * 0.6 * c.range);
      g.addColorStop(0, "rgba(255,255,255,0.5)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      const spread = 60 + (1 - k) * 30;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + c.dx * c.range - c.dy * spread, c.y + c.dy * c.range + c.dx * spread);
      ctx.lineTo(c.x + c.dx * c.range + c.dy * spread, c.y + c.dy * c.range - c.dx * spread);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function roundRect(ctx2, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx2.beginPath();
    ctx2.moveTo(x + rr, y);
    ctx2.arcTo(x + w, y, x + w, y + h, rr);
    ctx2.arcTo(x + w, y + h, x, y + h, rr);
    ctx2.arcTo(x, y + h, x, y, rr);
    ctx2.arcTo(x, y, x + w, y, rr);
    ctx2.closePath();
  }

  function drawBubble(b, timeSec) {
    if (!b.alive) return;
    const pulse = 1 + Math.sin(timeSec * 2 + b.x) * 0.02;
    const r = b.r * pulse;
    ctx.save();
    const g = ctx.createRadialGradient(b.x - r * 0.3, b.y - r * 0.35, r * 0.1, b.x, b.y, r);
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(0.55, "rgba(190,235,245,0.18)");
    g.addColorStop(1, "rgba(150,215,235,0.30)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r * 0.78, -2.5, -1.5);
    ctx.stroke();
    ctx.restore();
  }

  function drawRope(state, rope, th) {
    if (rope.cut || !rope.active) {
      if (rope.rail) drawRail(rope, th);
      return;
    }
    const geo = ropeGeometry(state, rope);
    const mx = (geo.ax + geo.bx) / 2;
    const my = (geo.ay + geo.by) / 2 + geo.sag;
    ctx.save();
    ctx.lineCap = "round";
    // 绳影
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(geo.ax, geo.ay + 2);
    ctx.quadraticCurveTo(mx, my + 2, geo.bx, geo.by);
    ctx.stroke();
    const stretched = rope.elastic && geo.tension > 6;
    ctx.strokeStyle = stretched ? "#d9633a" : th.rope;
    ctx.lineWidth = rope.elastic ? 4 : 5;
    ctx.beginPath();
    ctx.moveTo(geo.ax, geo.ay);
    ctx.quadraticCurveTo(mx, my, geo.bx, geo.by);
    ctx.stroke();
    // 绳纹
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(geo.ax, geo.ay - 1);
    ctx.quadraticCurveTo(mx, my - 1, geo.bx, geo.by);
    ctx.stroke();
    // 锚点钉
    ctx.fillStyle = "#e8dcc0";
    ctx.beginPath();
    ctx.arc(geo.ax, geo.ay, rope.rail ? 8 : 5.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#6b5a3a";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    if (rope.rail) drawRail(rope, th);
  }

  function drawRail(rope, th) {
    if (!rope.rail) return;
    const { from, to, t } = rope.rail;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
    ctx.stroke();
    ctx.strokeStyle = th.trim;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
    ctx.stroke();
    const a = ropeAnchor(rope);
    ctx.fillStyle = "#f5ead0";
    ctx.beginPath();
    ctx.arc(a.x, a.y, 9, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#7a6534";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawStars(state, timeSec) {
    for (const s of state.stars) {
      if (s.taken) continue;
      const bob = Math.sin(timeSec * 2.4 + s.x * 0.03) * 3;
      const rot = timeSec * 0.6 + s.x * 0.01;
      ctx.save();
      ctx.shadowColor = "rgba(255,214,102,0.85)";
      ctx.shadowBlur = 16;
      const g = ctx.createLinearGradient(s.x, s.y - STAR_R, s.x, s.y + STAR_R);
      g.addColorStop(0, "#fff3c4");
      g.addColorStop(1, "#f0a92e");
      ctx.fillStyle = g;
      starPath(ctx, s.x, s.y + bob, STAR_R, rot);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(150,88,20,0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawCandy(c, attached, timeSec) {
    ctx.save();
    if (attached) {
      ctx.globalAlpha = 0.95;
    }
    // 糖纸扭结
    const ang = Math.atan2(c.vy, c.vx || 0.001);
    ctx.fillStyle = "#fff2d0";
    ctx.strokeStyle = "#c98a3c";
    ctx.lineWidth = 1.5;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(ang + side * Math.PI * 0.62);
      ctx.beginPath();
      ctx.moveTo(CANDY_R * 0.9, 0);
      ctx.lineTo(CANDY_R * 1.75, -7);
      ctx.lineTo(CANDY_R * 1.75, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // 糖体
    const g = ctx.createRadialGradient(c.x - 6, c.y - 7, 2, c.x, c.y, CANDY_R * 1.15);
    g.addColorStop(0, "#ffe9a8");
    g.addColorStop(0.6, "#f2b445");
    g.addColorStop(1, "#c47a1c");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, CANDY_R, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(120,62,10,0.55)";
    ctx.lineWidth = 2;
    ctx.stroke();
    // 螺旋高光
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, CANDY_R * 0.55, timeSec * 1.5, timeSec * 1.5 + 2.2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.arc(c.x - 5, c.y - 6, 3.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /** 小怪兽糯糯：蜜色圆滚小兽，眼睛盯着糖，嘴随距离张开 */
  function drawNuoNuo(m, candy, timeSec, mood) {
    const d = Math.hypot(candy.x - m.x, candy.y - m.y);
    const openness = Math.max(0, Math.min(1, 1 - (d - m.r) / 260));
    const breathe = Math.sin(timeSec * 1.8) * 2;
    const r = m.r * (1 + breathe / 60);
    ctx.save();
    // 身子
    const g = ctx.createRadialGradient(m.x - r * 0.3, m.y - r * 0.4, r * 0.15, m.x, m.y, r * 1.2);
    g.addColorStop(0, "#8fdc86");
    g.addColorStop(0.65, "#5fb45c");
    g.addColorStop(1, "#357a3a");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(m.x, m.y + 2, r, r * 0.94, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(30,70,32,0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
    // 呆毛
    ctx.strokeStyle = "#357a3a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(m.x - 4, m.y - r * 0.9);
    ctx.quadraticCurveTo(m.x - 12, m.y - r * 1.5, m.x - 3, m.y - r * 1.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(m.x + 5, m.y - r * 0.9);
    ctx.quadraticCurveTo(m.x + 14, m.y - r * 1.45, m.x + 6, m.y - r * 1.5);
    ctx.stroke();
    // 耳朵
    ctx.fillStyle = "#4fa24d";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(m.x + side * r * 0.78, m.y - r * 0.62, r * 0.24, r * 0.3, side * 0.5, 0, TAU);
      ctx.fill();
    }
    // 眼睛（追着糖看）
    const look = Math.atan2(candy.y - m.y, candy.x - m.x);
    for (const side of [-1, 1]) {
      const ex = m.x + side * r * 0.34;
      const ey = m.y - r * 0.24;
      ctx.fillStyle = "#fdfdf6";
      ctx.beginPath();
      ctx.ellipse(ex, ey, r * 0.28, r * 0.31, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(40,60,40,0.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const px = ex + Math.cos(look) * r * 0.09;
      const py = ey + Math.sin(look) * r * 0.09 + (mood === "happy" ? -1 : 0);
      ctx.fillStyle = "#22301f";
      ctx.beginPath();
      ctx.arc(px, py, r * 0.14, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(px - 2, py - 2.5, r * 0.05, 0, TAU);
      ctx.fill();
    }
    // 嘴
    const mw = r * (0.3 + openness * 0.55);
    const mh = r * (0.16 + openness * 0.5);
    ctx.fillStyle = "#5a1f28";
    ctx.beginPath();
    ctx.ellipse(m.x, m.y + r * 0.36, mw, mh, 0, 0, TAU);
    ctx.fill();
    // 舌头
    ctx.fillStyle = "#e2707f";
    ctx.beginPath();
    ctx.ellipse(m.x, m.y + r * 0.36 + mh * 0.45, mw * 0.6, mh * 0.42, 0, 0, TAU);
    ctx.fill();
    // 腮红
    ctx.fillStyle = "rgba(233,110,130,0.35)";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(m.x + side * r * 0.66, m.y + r * 0.18, r * 0.16, r * 0.1, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawTrail(trail) {
    if (!trail || trail.length < 2) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let pass = 0; pass < 2; pass += 1) {
      ctx.beginPath();
      for (let i = 0; i < trail.length; i += 1) {
        const p = trail[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = pass === 0 ? "rgba(255,255,255,0.35)" : "rgba(255,236,190,0.95)";
      ctx.lineWidth = pass === 0 ? 9 : 3.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles.list) {
      const k = 1 - p.age / p.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, k));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === "star") {
        starPath(ctx, 0, 0, p.r * 1.6, 0);
        ctx.fill();
      } else if (p.shape === "shard") {
        ctx.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /** 事件 → 粒子特效 */
  function fx(event, state) {
    if (!state) return;
    switch (event.type) {
      case "cut": {
        const x = event.x ?? state.candy.x;
        const y = event.y ?? state.candy.y;
        particles.burst(x, y, 10, {
          color: ["#f6e3ae", "#e8b768", "#c98a3c"],
          speed: 190,
          life: 0.45,
          r: 2.6,
          shape: "shard",
        });
        break;
      }
      case "star": {
        const s = state.stars[event.index];
        if (s) {
          particles.burst(s.x, s.y, 16, {
            color: ["#fff3c4", "#f7c85c", "#f0a92e"],
            speed: 220,
            life: 0.7,
            r: 2.6,
            shape: "star",
            gravity: 380,
          });
        }
        break;
      }
      case "pop": {
        particles.burst(event.x ?? state.candy.x, event.y ?? state.candy.y, 14, {
          color: ["#dff6fb", "#a9dcea", "#ffffff"],
          speed: 200,
          life: 0.5,
          r: 3,
        });
        break;
      }
      case "capture": {
        particles.burst(state.candy.x, state.candy.y, 10, {
          color: ["#dff6fb", "#a9dcea"],
          speed: 120,
          life: 0.5,
          r: 2.4,
          gravity: -120,
        });
        break;
      }
      case "bounce": {
        particles.burst(event.x, event.y, 6, {
          color: ["#e8dcc0", "#c9963f"],
          speed: 120,
          life: 0.35,
          r: 2,
        });
        break;
      }
      case "puff": {
        const c = state.cushions[event.index];
        if (c) {
          particles.burst(c.x, c.y, 12, {
            color: ["#ffffff", "#f4eeb8"],
            speed: 260,
            life: 0.5,
            r: 2.2,
            gravity: 40,
          });
        }
        break;
      }
      case "win": {
        const m = state.monster;
        particles.burst(m.x, m.y, 40, {
          color: ["#fff3c4", "#f7c85c", "#8fdc86", "#f2b445"],
          speed: 300,
          life: 1,
          r: 3,
          gravity: 700,
        });
        break;
      }
      case "lose": {
        particles.burst(state.candy.x, state.candy.y, 18, {
          color: ["#c9c2b4", "#8d8577"],
          speed: 150,
          life: 0.7,
          r: 2.6,
        });
        break;
      }
      default:
        break;
    }
  }

  function draw(snapshot, trail, dt) {
    const state = snapshot.state;
    const th = themeOf(themeName);
    if (!t0) t0 = performance.now();
    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    time = reduceMotion ? 0 : (nowMs - t0) / 1000;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const offX = (canvas.width / dpr - WORLD.w * scale) / 2;
    const offY = (canvas.height / dpr - WORLD.h * scale) / 2;
    ctx.translate(offX, offY);
    ctx.scale(scale, scale);

    drawBackdrop(th);

    if (!state) {
      particles.update(dt);
      drawParticles();
      return;
    }

    drawWalls(state.walls);
    drawSpikes(state.spikes);
    for (const c of state.cushions) drawCushion(c, th);
    for (const b of state.bubbles) if (b.alive) drawBubble(b, time);
    for (const rope of state.ropes) drawRope(state, rope, th);
    drawStars(state, time);
    drawNuoNuo(state.monster, state.candy, time, state.status === "won" ? "happy" : "idle");
    drawCandy(state.candy, state.attached >= 0, time);
    drawTrail(trail);
    particles.update(dt);
    drawParticles();
  }

  return {
    resize,
    toWorld,
    setTheme,
    draw,
    fx,
    particles,
    clearFx: () => particles.clear(),
  };
}
