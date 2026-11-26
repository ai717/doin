// 倒退贪吃蛇 Uncoil · Canvas 舞台绘制（唯一碰 Canvas 的层）
//
// 糖果软糖亮场：蜜桃粉 / 薰衣草紫 / 奶油黄环境，蛇身是一条彩虹软糖。
// 「空间松弛」在亮场里靠三条通道表达（暗场才靠明暗）：
//   1. 糖霜浓度 —— 舞台内边距随蜕皮进度收拢
//   2. 网格底纹亮度 —— 越接近完成越通透
//   3. 背景彩带饱和度 —— 越接近完成越鲜活

import { mulberry32, PELLET } from "./engine.mjs";

const TWO_PI = Math.PI * 2;

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

export class UncoilRenderer {
  constructor(canvas, seed = 20260928) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.level = null;
    this.view = null;
    this.anim = null;
    this.particles = [];
    this.reduced = false;
    this.progress = 0;
    this.time = 0;
    this.dpr = 1;
    this.width = canvas ? canvas.width : 480;
    this.height = canvas ? canvas.height : 480;
    this.motes = this.buildMotes(mulberry32(seed));
  }

  buildMotes(rng) {
    const out = [];
    for (let i = 0; i < 22; i += 1) {
      out.push({
        x: rng(),
        y: rng(),
        r: 1.2 + rng() * 2.6,
        speed: 0.012 + rng() * 0.02,
        phase: rng() * TWO_PI,
        sway: 6 + rng() * 14
      });
    }
    return out;
  }

  setReduced(reduced) {
    this.reduced = !!reduced;
  }

  setLevel(level) {
    this.level = level;
    this.anim = null;
    this.particles.length = 0;
  }

  setView(state, progress = 0) {
    this.view = state;
    this.progress = progress;
  }

  // 播放一次移动：prev/next 均为 engine state，action 来自 step()
  playMove(prev, next, action) {
    const dur = this.reduced ? 1 : action && action.ate ? 190 : 130;
    this.anim = {
      t: 0,
      dur,
      prev: prev.snake.map((p) => ({ ...p })),
      next: next.snake.map((p) => ({ ...p })),
      shed: action && action.ate ? action.ate.shed.map((p) => ({ ...p })) : [],
      teleport: !!(action && action.teleport),
      atePos: action && action.ate ? { ...action.ate.pos } : null
    };
    this.view = next;
    if (action && action.ate && action.ate.shed.length) {
      this.spawnShed(action.ate.shed);
    }
  }

  spawnShed(cells) {
    const rng = mulberry32(cells.length * 977 + 17);
    for (const c of cells) {
      for (let i = 0; i < 3; i += 1) {
        this.particles.push({
          r: c.r,
          c: c.c,
          ox: (rng() - 0.5) * 0.7,
          oy: (rng() - 0.5) * 0.7,
          vx: (rng() - 0.5) * 1.5,
          vy: -0.6 - rng() * 1.1,
          life: 1,
          decay: this.reduced ? 4 : 0.9 + rng() * 0.5,
          hue: 300 + rng() * 120,
          size: 0.14 + rng() * 0.16
        });
      }
    }
  }

  tick(dtMs) {
    this.time += dtMs;
    const dt = dtMs / 1000;
    if (this.anim) {
      this.anim.t += dtMs;
      if (this.anim.t >= this.anim.dur) this.anim = null;
    }
    for (const p of this.particles) {
      p.life -= dt * p.decay;
      p.ox += p.vx * dt;
      p.oy += p.vy * dt;
      p.vy += dt * 1.1;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  // ---------- 布局 ----------
  layout() {
    const lv = this.level;
    if (!lv) return { cell: 24, ox: 0, oy: 0, w: this.width, h: this.height };
    // 糖霜通道：蜕皮越接近完成，舞台内边距收得越紧，盘面看起来越"松开"
    const pad = lerp(22, 9, this.progress);
    const availW = Math.max(40, this.width - pad * 2);
    const availH = Math.max(40, this.height - pad * 2);
    const cell = Math.max(6, Math.floor(Math.min(availW / lv.cols, availH / lv.rows)));
    const w = cell * lv.cols;
    const h = cell * lv.rows;
    return { cell, ox: (this.width - w) / 2, oy: (this.height - h) / 2, w, h, pad };
  }

  cellAt(x, y) {
    const lv = this.level;
    if (!lv) return null;
    const { cell, ox, oy } = this.layout();
    const c = Math.floor((x - ox) / cell);
    const r = Math.floor((y - oy) / cell);
    if (r < 0 || c < 0 || r >= lv.rows || c >= lv.cols) return null;
    return { r, c };
  }

  resize(width, height, dpr = 1) {
    this.width = Math.max(120, Math.floor(width));
    this.height = Math.max(120, Math.floor(height));
    this.dpr = dpr;
    if (this.canvas) {
      this.canvas.width = Math.floor(this.width * dpr);
      this.canvas.height = Math.floor(this.height * dpr);
    }
  }

  // ---------- 绘制 ----------
  draw() {
    const ctx = this.ctx;
    if (!ctx || !this.level || !this.view) return;
    const lv = this.level;
    ctx.save();
    if (this.dpr && this.dpr !== 1) ctx.scale(this.dpr, this.dpr);
    this.drawBackdrop(ctx);
    const { cell, ox, oy, w, h } = this.layout();
    this.drawStage(ctx, ox, oy, w, h);
    this.drawGrid(ctx, ox, oy, cell);
    this.drawWalls(ctx, ox, oy, cell);
    this.drawPortals(ctx, ox, oy, cell);
    this.drawPellet(ctx, ox, oy, cell);
    this.drawSnake(ctx, ox, oy, cell);
    this.drawParticles(ctx, ox, oy, cell);
    ctx.restore();
  }

  drawBackdrop(ctx) {
    const g = ctx.createLinearGradient(0, 0, this.width, this.height);
    const sat = Math.round(lerp(72, 92, this.progress));
    g.addColorStop(0, `hsl(16, ${sat}%, 92%)`);       // 蜜桃粉
    g.addColorStop(0.52, `hsl(272, ${sat - 18}%, 90%)`); // 薰衣草紫
    g.addColorStop(1, `hsl(46, ${sat + 4}%, 90%)`);    // 奶油黄
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);

    // 漂浮微粒（糖霜屑）
    for (const m of this.motes) {
      const y = ((m.y - this.time * m.speed * 0.001) % 1 + 1) % 1;
      const x = m.x + Math.sin(this.time * 0.0006 + m.phase) * (m.sway / this.width);
      ctx.beginPath();
      ctx.arc(x * this.width, y * this.height, m.r, 0, TWO_PI);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fill();
    }
  }

  drawStage(ctx, ox, oy, w, h) {
    const glow = lerp(0.18, 0.42, this.progress);
    ctx.save();
    ctx.shadowColor = `rgba(255, 138, 180, ${0.22 + glow * 0.25})`;
    ctx.shadowBlur = lerp(16, 34, this.progress);
    roundRectPath(ctx, ox - 6, oy - 6, w + 12, h + 12, 22);
    ctx.fillStyle = "rgba(255, 253, 250, 0.94)";
    ctx.fill();
    ctx.restore();
  }

  drawGrid(ctx, ox, oy, cell) {
    const lv = this.level;
    const light = lerp(0.06, 0.16, this.progress); // 网格底纹亮度通道
    ctx.save();
    ctx.strokeStyle = `rgba(120, 92, 140, ${light})`;
    ctx.lineWidth = 1;
    for (let r = 0; r <= lv.rows; r += 1) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + r * cell);
      ctx.lineTo(ox + lv.cols * cell, oy + r * cell);
      ctx.stroke();
    }
    for (let c = 0; c <= lv.cols; c += 1) {
      ctx.beginPath();
      ctx.moveTo(ox + c * cell, oy);
      ctx.lineTo(ox + c * cell, oy + lv.rows * cell);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawWalls(ctx, ox, oy, cell) {
    const set = this.view.wallSet;
    if (!set || !set.size) return;
    for (const idx of set) {
      const r = Math.floor(idx / this.level.cols);
      const c = idx % this.level.cols;
      const x = ox + c * cell;
      const y = oy + r * cell;
      roundRectPath(ctx, x + 1.5, y + 1.5, cell - 3, cell - 3, cell * 0.22);
      ctx.fillStyle = "#7b5a48";           // 可可棕岩层：哑光无发光
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(x + 3, y + 3, cell - 6, Math.max(1.5, cell * 0.14));
    }
  }

  drawPortals(ctx, ox, oy, cell) {
    const seen = new Set();
    for (const [a, b] of this.level.portals || []) {
      for (const p of [a, b]) {
        const k = p.r * this.level.cols + p.c;
        if (seen.has(k)) continue;
        seen.add(k);
        const x = ox + p.c * cell + cell / 2;
        const y = oy + p.r * cell + cell / 2;
        const spin = this.time * 0.0016;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(spin);
        ctx.strokeStyle = "rgba(90, 190, 235, 0.95)";
        ctx.lineWidth = Math.max(1.5, cell * 0.08);
        ctx.beginPath();
        ctx.arc(0, 0, cell * 0.34, 0.2, Math.PI * 1.35);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, cell * 0.22, Math.PI * 1.2, TWO_PI * 0.95);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawPellet(ctx, ox, oy, cell) {
    const p = this.view.pellets[this.view.pelletIndex];
    if (!p) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 0.005);
    const x = ox + p.c * cell + cell / 2;
    const y = oy + p.r * cell + cell / 2;
    const mega = p.kind === PELLET.MEGA;
    const base = cell * (mega ? 0.34 : 0.28);

    // 柔光托底（无边界径向渐变 —— 不用硬边描边圈）
    const g = ctx.createRadialGradient(x, y, 0, x, y, cell * 1.1);
    g.addColorStop(0, mega ? "rgba(255,179,71,0.55)" : "rgba(232,62,104,0.5)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, cell * 1.1, 0, TWO_PI);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, base + pulse * cell * 0.04, 0, TWO_PI);
    ctx.fillStyle = mega ? "#ffb347" : "#e83e68";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - base * 0.3, y - base * 0.34, base * 0.28, 0, TWO_PI);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fill();

    if (mega) {
      ctx.strokeStyle = "rgba(255,179,71,0.7)";
      ctx.lineWidth = Math.max(1.2, cell * 0.06);
      ctx.beginPath();
      ctx.arc(x, y, base + cell * 0.16 + pulse * cell * 0.06, 0, TWO_PI);
      ctx.stroke();
    }
  }

  // 蛇身插值点：anim 存在时做补间，否则直接用稳定态
  snakePoints() {
    const view = this.view;
    const a = this.anim;
    if (!a) return view.snake.map((p) => ({ ...p }));
    const p = easeOutCubic(Math.min(1, a.t / a.dur));
    const out = [];
    const n = a.next.length;
    for (let i = 0; i < n; i += 1) {
      const from = a.prev[i] ?? a.prev[a.prev.length - 1] ?? a.next[i];
      const to = a.next[i];
      if (a.teleport && i === 0) {
        out.push(p < 0.5 ? { ...from } : { ...to });
        continue;
      }
      out.push({ r: lerp(from.r, to.r, p), c: lerp(from.c, to.c, p) });
    }
    // 脱落节：从旧位置向外飘散并淡出
    for (let i = n; i < a.prev.length; i += 1) {
      const from = a.prev[i];
      const dirR = from.r - (a.next[n - 1]?.r ?? from.r);
      const dirC = from.c - (a.next[n - 1]?.c ?? from.c);
      out.push({ r: from.r + dirR * p * 0.6, c: from.c + dirC * p * 0.6, ghost: 1 - p });
    }
    return out;
  }

  drawSnake(ctx, ox, oy, cell) {
    const pts = this.snakePoints();
    if (!pts.length) return;
    const cx = (p) => ox + p.c * cell + cell / 2;
    const cy = (p) => oy + p.r * cell + cell / 2;
    const total = Math.max(1, pts.length - 1);
    const stuck = this.view.status === "entombed";

    // 先画一圈柔和光晕（软糖的次表面散射错觉）
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stuck ? "rgba(150,150,160,0.28)" : "rgba(255,150,190,0.3)";
    ctx.lineWidth = cell * 0.98;
    ctx.beginPath();
    ctx.moveTo(cx(pts[0]), cy(pts[0]));
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(cx(pts[i]), cy(pts[i]));
    ctx.stroke();
    ctx.restore();

    // 主体：逐段独立着色（彩虹软糖），圆角关节由 lineJoin 提供
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const w = cell * 0.78;
    for (let i = pts.length - 1; i >= 0; i -= 1) {
      const a = pts[i];
      const b = pts[i - 1] ?? a;
      const seg = i === 0 ? null : { a: b, b: a };
      const alpha = a.ghost !== undefined ? Math.max(0, a.ghost) : 1;
      if (alpha <= 0.02) continue;
      const hue = stuck ? 0 : (i / total) * 300 + 12;
      const sat = stuck ? 6 : 88;
      const lit = stuck ? 62 : 64 - (i / total) * 6;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = `hsl(${hue}, ${sat}%, ${lit}%)`;
      ctx.lineWidth = w * (1 - (i / total) * 0.22); // 头粗尾细
      ctx.beginPath();
      if (seg) {
        ctx.moveTo(cx(seg.a), cy(seg.a));
        ctx.lineTo(cx(seg.b), cy(seg.b));
      } else {
        ctx.moveTo(cx(a), cy(a));
        ctx.lineTo(cx(a) + 0.01, cy(a));
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // 头部：高光 + 眼睛
    const h = pts[0];
    const hx = cx(h);
    const hy = cy(h);
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.arc(hx - cell * 0.12, hy - cell * 0.14, cell * 0.14, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = stuck ? "#6b6b74" : "#3a2740";
    const eye = Math.max(0.8, cell * 0.07);
    ctx.beginPath();
    ctx.arc(hx + cell * 0.1, hy - cell * 0.08, eye, 0, TWO_PI);
    ctx.arc(hx + cell * 0.1, hy + cell * 0.12, eye, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  }

  drawParticles(ctx, ox, oy, cell) {
    for (const p of this.particles) {
      const x = ox + (p.c + 0.5 + p.ox) * cell;
      const y = oy + (p.r + 0.5 + p.oy) * cell;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = `hsl(${p.hue % 360}, 90%, 64%)`;
      ctx.beginPath();
      ctx.arc(x, y, cell * p.size * p.life, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }
  }
}
