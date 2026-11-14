// 霓虹弹珠台 · Canvas 渲染层（唯一碰 Canvas 的层）
// 美学红线：主体（弹珠/挡板/机关/砖块）一律用径向柔光渐隐托出，严禁描边圈。
// 粒子系统由事件驱动，舞台氛围：暗夜霓虹弹珠机。

import { W, H, CX, APRON_Y, CENTER_GAP_HALF, OUTLANE_W, FLIPPER_LEN, FLIPPER_PIVOT_DX, FLIPPER_PIVOT_Y } from "./engine.mjs";

const TIER_COLORS = {
  G: { fill: "rgba(125,227,255,0.92)", core: "rgba(230,250,255,0.95)", glow: "rgba(125,227,255,0.5)", shard: "#8fe8ff" },
  S: { fill: "rgba(184,199,217,0.92)", core: "rgba(228,236,246,0.95)", glow: "rgba(160,180,210,0.45)", shard: "#c8d6e8" },
  A: { fill: "rgba(255,215,106,0.92)", core: "rgba(255,244,200,0.95)", glow: "rgba(255,200,90,0.55)", shard: "#ffd76a" }
};

export class PinballRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = [];
    this.shake = 0;
    this.flash = 0;
    this.time = 0;
  }

  feed(events) {
    for (const ev of events) {
      if (ev.type === "brick_broken") this.spawnShards(ev.x, ev.y, TIER_COLORS[ev.tier].shard, 9 + Math.floor(Math.random() * 4));
      else if (ev.type === "bumper") this.spawnShards(ev.x, ev.y, "#ff8ad4", 7);
      else if (ev.type === "sling") this.spawnShards(ev.x, ev.y, "#8fe8ff", 6);
      else if (ev.type === "spinner") this.spawnShards(ev.x, ev.y, "#c9a4ff", 6);
      else if (ev.type === "target_down") this.spawnShards(ev.x, ev.y, "#ffb36a", 6);
      else if (ev.type === "flipper_hit") this.spawnShards(ev.side === "R" ? CX + FLIPPER_PIVOT_DX : CX - FLIPPER_PIVOT_DX, FLIPPER_PIVOT_Y - 40, "#7ef0c0", 4);
      else if (ev.type === "drain") this.spawnShards(ev.x, ev.y, "#7a5bd6", 8);
      else if (ev.type === "storm_row") this.spawnShards(CX, 80, "#8fe8ff", 18);
      else if (ev.type === "nudge") this.shake = Math.min(this.shake + 6, 12);
      else if (ev.type === "stage_clear") { this.spawnShards(CX, H / 2, "#ffe27a", 30); this.flash = 0.5; }
      else if (ev.type === "stage_fail" || ev.type === "game_over") this.flash = 0.3;
      else if (ev.type === "effect" && ev.effect === "multiball") { this.spawnShards(CX, H - 150, "#c9a4ff", 16); }
    }
  }

  spawnShards(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 240;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 80,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        size: 2 + Math.random() * 3.5,
        color
      });
    }
    if (this.particles.length > 420) this.particles.splice(0, this.particles.length - 420);
  }

  // 每个渲染帧更新粒子与屏幕震动
  tick(dt) {
    this.time += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 14);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.vy += 620 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  render(state) {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    this.drawBackground(ctx, state);
    this.drawCabinet(ctx);
    this.drawLanes(ctx, state);
    this.drawBricks(ctx, state);
    this.drawMechanisms(ctx, state);
    this.drawFlippers(ctx, state);
    this.drawBalls(ctx, state);
    this.drawParticles(ctx);
    if (state.frenzyTimer > 0) this.drawFrenzyOverlay(ctx, state);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,235,180,${this.flash * 0.4})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    ctx.restore();
  }

  drawBackground(ctx, state) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#241040");
    g.addColorStop(0.55, "#1c0d36");
    g.addColorStop(1, "#150a2b");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 景深光晕微动
    const pulse = Math.sin(this.time * 0.8) * 0.5 + 0.5;
    const glow = ctx.createRadialGradient(CX, H * 0.32, 40, CX, H * 0.32, 340);
    glow.addColorStop(0, `rgba(140,90,255,${0.16 + pulse * 0.08})`);
    glow.addColorStop(1, "rgba(140,90,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    // 悬浮霓虹粒子（氛围）
    for (let i = 0; i < 26; i++) {
      const sx = ((i * 137) % W);
      const sy = ((i * 331) % H);
      const r = 1 + (i % 3);
      const a = 0.05 + 0.08 * Math.sin(this.time * 1.2 + i);
      const pg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 4);
      pg.addColorStop(0, `rgba(160,190,255,${a})`);
      pg.addColorStop(1, "rgba(160,190,255,0)");
      ctx.fillStyle = pg;
      ctx.fillRect(sx - r * 4, sy - r * 4, r * 8, r * 8);
    }
  }

  drawCabinet(ctx) {
    // 霓虹管机台边框（柔和光晕，不描球体）
    const rail = ctx.createLinearGradient(0, 0, W, 0);
    rail.addColorStop(0, "rgba(90,220,255,0.5)");
    rail.addColorStop(0.5, "rgba(160,120,255,0.5)");
    rail.addColorStop(1, "rgba(90,220,255,0.5)");
    ctx.fillStyle = rail;
    ctx.fillRect(3, 3, W - 6, 6);
    ctx.fillRect(3, H - 9, W - 6, 6);
    ctx.fillStyle = "rgba(90,220,255,0.35)";
    ctx.fillRect(3, 3, 6, H - 6);
    ctx.fillRect(W - 9, 3, 6, H - 6);
    // 裙边
    ctx.fillStyle = "rgba(40,18,74,0.9)";
    ctx.fillRect(0, APRON_Y - 2, W, 20);
    ctx.fillStyle = "rgba(140,90,255,0.18)";
    ctx.fillRect(0, APRON_Y - 2, W, 3);
  }

  drawLanes(ctx, state) {
    const roll = state.mechs.rollovers;
    if (!roll) return;
    for (const [x1, x2] of [roll.left, roll.right]) {
      const g = ctx.createLinearGradient(0, roll.y - 6, 0, roll.y + 6);
      g.addColorStop(0, "rgba(90,220,255,0)");
      g.addColorStop(0.5, "rgba(90,220,255,0.55)");
      g.addColorStop(1, "rgba(90,220,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x1, roll.y - 5, x2 - x1, 10);
    }
  }

  drawBricks(ctx, state) {
    for (const b of state.bricks) {
      if (b.hp <= 0) continue;
      const c = TIER_COLORS[b.tier];
      const flash = b.flash > 0;
      const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      if (flash) {
        g.addColorStop(0, "rgba(255,255,255,0.95)");
        g.addColorStop(1, c.fill);
      } else {
        g.addColorStop(0, c.core);
        g.addColorStop(0.45, c.fill);
        g.addColorStop(1, c.fill);
      }
      ctx.fillStyle = g;
      roundRect(ctx, b.x, b.y, b.w, b.h, 3);
      ctx.fill();
      // 径向柔光托出（禁描边圈）
      if (b.hp > 1 || flash) {
        const glow = ctx.createRadialGradient(b.x + b.w / 2, b.y + b.h / 2, 2, b.x + b.w / 2, b.y + b.h / 2, b.w * 0.75);
        glow.addColorStop(0, flash ? "rgba(255,255,255,0.35)" : c.glow);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
      }
    }
  }

  drawMechanisms(ctx, state) {
    // 弹跳缓冲
    for (const b of state.mechs.bumpers) {
      const pulse = b.flash > 0 ? 1 : 0.55 + 0.25 * Math.sin(this.time * 3 + b.x);
      if (state.frenzyTimer > 0) this.drawGlowCircle(b.x, b.y, b.r * 1.9, `rgba(255,120,200,${0.4 + pulse * 0.25})`);
      else this.drawGlowCircle(b.x, b.y, b.r * 1.6, `rgba(255,120,200,${0.22 + pulse * 0.2})`);
      ctx.fillStyle = b.flash > 0 ? "rgba(255,190,230,0.95)" : "rgba(255,110,190,0.85)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r - 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // 侧弹射器（点燃时高亮）
    for (const s of state.mechs.slings) {
      const ignited = state.combo >= 5;
      const pulse = s.flash > 0 ? 1 : 0.5 + 0.2 * Math.sin(this.time * 4 + s.x);
      this.drawGlowCircle(s.x, s.y, s.r * 1.8, ignited ? `rgba(90,235,255,${0.45 + pulse * 0.3})` : `rgba(90,220,255,${0.2 + pulse * 0.15})`);
      ctx.fillStyle = ignited ? "rgba(140,245,255,0.95)" : "rgba(70,200,240,0.85)";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r - 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // 可翻倒靶
    for (const t of state.mechs.targets) {
      if (t.down) continue;
      const g = ctx.createLinearGradient(t.x, t.y, t.x, t.y + t.h);
      g.addColorStop(0, "rgba(255,210,150,0.95)");
      g.addColorStop(1, "rgba(255,140,80,0.9)");
      ctx.fillStyle = g;
      roundRect(ctx, t.x, t.y, t.w, t.h, 3);
      ctx.fill();
      if (t.flash > 0) this.drawGlowCircle(t.x + t.w / 2, t.y + t.h / 2, 26, "rgba(255,180,110,0.5)");
    }
    // 转盘
    if (state.mechs.spinner) {
      const s = state.mechs.spinner;
      this.drawGlowCircle(s.x, s.y, s.r * 1.7, `rgba(201,164,255,${s.flash > 0 ? 0.5 : 0.25})`);
      ctx.fillStyle = "rgba(201,164,255,0.8)";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r - 4, 0, Math.PI * 2);
      ctx.fill();
      // 扇叶（旋转示意）
      const rot = this.time * 6;
      ctx.fillStyle = "rgba(240,230,255,0.9)";
      for (let k = 0; k < 4; k++) {
        const a = rot + (k * Math.PI) / 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r - 8, a, a + 0.5);
        ctx.arc(s.x, s.y, 3, a + 0.5, a, true);
        ctx.fill();
      }
    }
    // 斜坡通道
    if (state.mechs.ramp) {
      const r = state.mechs.ramp;
      const g = ctx.createLinearGradient(r.p1.x, r.p1.y, r.p2.x, r.p2.y);
      g.addColorStop(0, "rgba(60,200,190,0.8)");
      g.addColorStop(1, "rgba(90,220,255,0.85)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(r.p1.x, r.p1.y);
      ctx.lineTo(r.p2.x, r.p2.y);
      ctx.stroke();
      this.drawGlowCircle(r.zone.x, r.zone.y, 24, `rgba(120,255,220,${0.3 + 0.2 * Math.sin(this.time * 5)})`);
    }
  }

  drawFlippers(ctx, state) {
    for (const f of state.flippers) {
      const len = f.len;
      const ca = Math.cos(f.angle), sa = Math.sin(f.angle);
      const ax = f.pivot.x, ay = f.pivot.y;
      const bx = f.side === "L" ? ax + len * ca : ax - len * ca;
      const by = ay + len * sa;
      // 挡板本体（软胶渐变，无描边圈）
      const g = ctx.createLinearGradient(ax, ay, bx, by);
      g.addColorStop(0, "rgba(126,240,192,0.9)");
      g.addColorStop(0.6, "rgba(86,214,160,0.92)");
      g.addColorStop(1, "rgba(56,180,132,0.95)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      // 高光条
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ax + 2, ay - 3);
      ctx.lineTo(bx + 2, by - 3);
      ctx.stroke();
      // 板尖柔光（弹射瞬间亮起）
      if (f.pressed || state.flipperBoostTimer > 0) {
        this.drawGlowCircle(bx, by, 26, `rgba(126,240,192,${f.pressed ? 0.4 : 0.3})`);
      }
    }
  }

  drawBalls(ctx, state) {
    for (const ball of state.balls) {
      // 拖尾（多段渐隐柔光）
      for (let i = 0; i < ball.trail.length; i++) {
        const t = ball.trail[i];
        const a = (i / ball.trail.length) * 0.22;
        this.drawGlowCircle(t.x, t.y, ball.radius + 3, `rgba(140,230,255,${a})`);
      }
      const core = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, ball.radius * 2.1);
      core.addColorStop(0, "rgba(255,255,255,0.95)");
      core.addColorStop(0.4, "rgba(190,245,255,0.9)");
      core.addColorStop(1, "rgba(90,200,255,0)");
      ctx.fillStyle = core;
      ctx.fillRect(ball.x - ball.radius * 2.1, ball.y - ball.radius * 2.1, ball.radius * 4.2, ball.radius * 4.2);
      // 球体本体（径向高光，无描边）
      const body = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, ball.radius);
      body.addColorStop(0, "#ffffff");
      body.addColorStop(0.75, "#c9f3ff");
      body.addColorStop(1, "#7fd8ff");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    // 待发状态：发射台脉冲提示
    if (state.status === "serving" && state.balls.length === 0) {
      const pulse = 0.35 + 0.2 * Math.sin(this.time * 5);
      this.drawGlowCircle(CX, H - 150, 22, `rgba(126,240,192,${pulse})`);
    }
    // 救球罩：发射区护盾
    if (state.ballSave) {
      const pulse = 0.3 + 0.15 * Math.sin(this.time * 4);
      this.drawGlowCircle(CX, H - 150, 44, `rgba(120,255,220,${pulse})`);
      this.drawGlowCircle(CX, H - 150, 30, `rgba(120,255,220,${pulse * 0.8})`);
    }
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.size)) continue;
      const a = Math.max(0, p.life / p.maxLife);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.4);
      g.addColorStop(0, p.color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawFrenzyOverlay(ctx, state) {
    const a = 0.08 + 0.05 * Math.sin(this.time * 9);
    const g = ctx.createRadialGradient(CX, H / 2, 40, CX, H / 2, 420);
    g.addColorStop(0, `rgba(255,120,200,${a * 2})`);
    g.addColorStop(1, "rgba(255,120,200,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  drawGlowCircle(x, y, r, color) {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
