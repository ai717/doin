// 森林冰火人 · Canvas 舞台渲染（唯一碰 Canvas 的层）
// 沉浸神庙舞台：环境渐变、景深光晕、萤火/水汽粒子
// 角色高亮一律使用无边界径向渐隐柔光 + 呼吸脉动，严禁描边圈

import { T, KINDS, TILE, CW, CH, FROZEN_DURATION } from "./engine.mjs";

export const VIEW_COLS = 24;
export const VIEW_ROWS = 14;

const FIRE = "#ff7043";
const FIRE_DEEP = "#d84315";
const ICE = "#4fc3f7";
const ICE_DEEP = "#0277bd";
const GOLD = "#ffd54f";
const GOO = "#66bb6a";

export class ForestStageRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cell = canvas.width / VIEW_COLS; // 逻辑分辨率下 cell
    this.particles = [];
    this.ambient = [];
    this.seedAmbient();
    this.time = 0;
  }

  seedAmbient() {
    this.ambient = [];
    for (let i = 0; i < 36; i++) {
      this.ambient.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        r: 0.8 + Math.random() * 1.6,
        warm: Math.random() < 0.5,
        speed: 2 + Math.random() * 6,
        drift: (Math.random() - 0.5) * 3,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  addParticles(x, y, color, count = 8, spread = 1) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = (0.5 + Math.random() * 2.4) * spread;
      this.particles.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 1.2,
        life: 0.4 + Math.random() * 0.5,
        max: 0.9,
        color,
        size: 1.2 + Math.random() * 2.2
      });
    }
  }

  stepParticles(dt) {
    const keep = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.vy += 0.18 * dt * 60;
      keep.push(p);
    }
    this.particles = keep;
  }

  // ---- 背景 ----
  drawBackdrop(dt) {
    const { ctx, canvas } = this;
    this.time += dt;

    // 环境渐变：深林绿 → 墨蓝
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, "#0b2e22");
    g.addColorStop(0.55, "#0d2530");
    g.addColorStop(1, "#081a24");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 景深光晕（径向渐隐，微动）
    const glow1 = ctx.createRadialGradient(
      canvas.width * 0.3 + Math.sin(this.time * 0.4) * 10,
      canvas.height * 0.25,
      20,
      canvas.width * 0.3,
      canvas.height * 0.25,
      canvas.width * 0.55
    );
    glow1.addColorStop(0, "rgba(255,150,60,0.08)");
    glow1.addColorStop(1, "rgba(255,150,60,0)");
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const glow2 = ctx.createRadialGradient(
      canvas.width * 0.72 + Math.sin(this.time * 0.35 + 2) * 10,
      canvas.height * 0.3,
      20,
      canvas.width * 0.72,
      canvas.height * 0.3,
      canvas.width * 0.55
    );
    glow2.addColorStop(0, "rgba(80,180,255,0.08)");
    glow2.addColorStop(1, "rgba(80,180,255,0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 萤火 / 水汽粒子
    for (const a of this.ambient) {
      a.y -= a.speed * dt;
      a.x += a.drift * dt;
      if (a.y < -4) {
        a.y = canvas.height + 4;
        a.x = Math.random() * canvas.width;
      }
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 2 + a.phase);
      ctx.fillStyle = a.warm ? `rgba(255,190,90,${0.16 + 0.2 * pulse})` : `rgba(140,210,255,${0.14 + 0.18 * pulse})`;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r * (0.7 + 0.5 * pulse), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- 地图 ----
  drawTile(row, col, t, state) {
    const { ctx } = this;
    const x = col * this.cell;
    const y = row * this.cell;
    const s = this.cell;

    if (t === T.SOLID) {
      ctx.fillStyle = "#1f3a35";
      ctx.fillRect(x, y, s, s);
      // 石纹高光
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(x, y, s, 2);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(x, y + s - 2, s, 2);
    } else if (t === T.ONEWAY) {
      ctx.fillStyle = "rgba(120,200,170,0.5)";
      ctx.fillRect(x + 1, y + s * 0.62, s - 2, s * 0.3);
      ctx.fillStyle = "rgba(160,255,220,0.35)";
      ctx.fillRect(x + 1, y + s * 0.62, s - 2, 3);
    } else if (t === T.MAGMA) {
      // 流动熔岩
      const wave = Math.sin(this.time * 3 + col * 1.3 + row) * 0.3;
      ctx.fillStyle = "#7a1f0d";
      ctx.fillRect(x, y, s, s);
      const g = ctx.createLinearGradient(0, y, 0, y + s);
      g.addColorStop(0, `rgba(255,140,40,${0.7 + wave * 0.15})`);
      g.addColorStop(1, "rgba(190,60,10,0.85)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.55);
      for (let i = 0; i <= 4; i++) {
        ctx.lineTo(x + (i * s) / 4, y + s * (0.55 + Math.sin(this.time * 4 + col * 2 + i) * 0.12));
      }
      ctx.lineTo(x + s, y + s);
      ctx.lineTo(x, y + s);
      ctx.closePath();
      ctx.fill();
    } else if (t === T.WATER) {
      const wave = Math.sin(this.time * 2 + col * 1.1) * 0.25;
      ctx.fillStyle = "#0a3d63";
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = `rgba(70,170,255,${0.45 + wave * 0.12})`;
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.5);
      for (let i = 0; i <= 4; i++) {
        ctx.lineTo(x + (i * s) / 4, y + s * (0.5 + Math.sin(this.time * 2.4 + col * 1.7 + i * 0.8) * 0.08));
      }
      ctx.lineTo(x + s, y + s);
      ctx.lineTo(x, y + s);
      ctx.closePath();
      ctx.fill();
    } else if (t === T.GOO) {
      ctx.fillStyle = "#1d4a22";
      ctx.fillRect(x, y, s, s);
      const g = ctx.createLinearGradient(0, y, 0, y + s);
      g.addColorStop(0, "#5cbf67");
      g.addColorStop(1, "#2f7d3a");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x + s / 2, y + s * 0.6, s * 0.42, s * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      // 毒泡
      const bub = Math.sin(this.time * 5 + col * 2.4) > 0.4;
      if (bub) {
        ctx.fillStyle = "rgba(220,255,160,0.7)";
        ctx.beginPath();
        ctx.arc(x + s * 0.35, y + s * 0.4, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (t === T.ICE) {
      ctx.fillStyle = "#9bd8f2";
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(x + 2, y + 2, s * 0.4, 3);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(x + s * 0.5, y + s * 0.5, 2, s * 0.3);
    } else if (t === T.VINE) {
      ctx.fillStyle = "#1c5a2a";
      ctx.fillRect(x, y, s, s);
      // 藤蔓茎
      ctx.strokeStyle = "#3c9a4e";
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const bx = x + 6 + i * 9;
        ctx.moveTo(bx, y);
        ctx.quadraticCurveTo(bx + 3 + Math.sin(this.time * 2 + i) * 1.5, y + s * 0.5, bx + 1, y + s);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(80,180,90,0.5)";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(x + 5 + i * 7, y + 5 + (i % 2) * 8, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawMap(state) {
    for (let r = 0; r < state.h; r++) {
      for (let c = 0; c < state.w; c++) {
        const t = state.map[r][c];
        if (t !== T.EMPTY) this.drawTile(r, c, t, state);
      }
    }
  }

  // ---- 机关 ----
  drawDoor(d) {
    const { ctx } = this;
    const x = d.x * this.cell;
    const topY = (d.y - 2.4) * this.cell;
    const h = 2.5 * this.cell;
    const col = d.color === "red" ? "#e57373" : d.color === "blue" ? "#4fc3f7" : "#cfd8dc";
    const open = d.open;

    ctx.fillStyle = open ? "rgba(255,255,255,0.06)" : `${col}22`;
    ctx.fillRect(x - 0.5 * this.cell + 2, topY, this.cell - 4, h);
    // 门框
    ctx.fillStyle = open ? "rgba(255,255,255,0.35)" : col;
    ctx.fillRect(x - 0.5 * this.cell, topY, 3, h);
    ctx.fillRect(x + 0.5 * this.cell - 3, topY, 3, h);
    // 门中光泽线
    if (open) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(x - 0.3 * this.cell, topY + 4, 0.6 * this.cell, 2.4);
    } else {
      const glow = ctx.createRadialGradient(x, topY + h / 2, 2, x, topY + h / 2, this.cell * 0.9);
      glow.addColorStop(0, col + "66");
      glow.addColorStop(1, col + "00");
      ctx.fillStyle = glow;
      ctx.fillRect(x - this.cell * 0.9, topY, this.cell * 1.8, h);
    }
  }

  drawButton(b) {
    const { ctx } = this;
    const x = b.x * this.cell;
    const y = b.y * this.cell;
    const r = this.cell * 0.32;
    const pressed = b.pressed;
    ctx.fillStyle = pressed ? "#ffb74d" : "#e0a35c";
    ctx.beginPath();
    ctx.ellipse(x, y - (pressed ? 2 : 0), r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (pressed) {
      const g = ctx.createRadialGradient(x, y - 2, 1, x, y - 2, r * 2.2);
      g.addColorStop(0, "rgba(255,200,110,0.5)");
      g.addColorStop(1, "rgba(255,200,110,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y - 2, r * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawSyncPair(pair) {
    const { ctx } = this;
    const a = pair.a;
    const b = pair.b;
    const active = pair.active;
    const col = active ? "#a5d6a7" : "#78909c";

    // 两板连线
    ctx.strokeStyle = active ? "rgba(165,214,167,0.7)" : "rgba(120,144,156,0.25)";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(a.x * this.cell, a.y * this.cell);
    ctx.lineTo(b.x * this.cell, b.y * this.cell);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const p of [a, b]) {
      const x = p.x * this.cell;
      const y = p.y * this.cell;
      ctx.fillStyle = active ? col : "rgba(120,144,156,0.5)";
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-this.cell * 0.24, -this.cell * 0.24, this.cell * 0.48, this.cell * 0.48);
      ctx.restore();
      if (active) {
        const g = ctx.createRadialGradient(x, y, 1, x, y, this.cell * 0.8);
        g.addColorStop(0, "rgba(165,214,167,0.55)");
        g.addColorStop(1, "rgba(165,214,167,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, this.cell * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawPortal(p) {
    const { ctx } = this;
    const x = p.x * this.cell;
    const y = (p.y - 0.5) * this.cell;
    const r = this.cell * 0.42 + Math.sin(this.time * 3 + p.id) * 1.5;
    const g = ctx.createRadialGradient(x, y, 1, x, y, r * 2);
    g.addColorStop(0, "rgba(200,120,255,0.85)");
    g.addColorStop(0.6, "rgba(140,80,220,0.4)");
    g.addColorStop(1, "rgba(140,80,220,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2, 0, Math.PI * 2);
    ctx.fill();
    // 漩涡环
    ctx.strokeStyle = "rgba(220,180,255,0.9)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(x, y, r * 0.5 + i * r * 0.35, this.time * (i ? -1.6 : 1.6) + p.id, this.time * (i ? -1.6 : 1.6) + p.id + 3.6);
      ctx.stroke();
    }
  }

  drawFreezeSpot(z, state) {
    const { ctx } = this;
    const x = z.x * this.cell;
    const y = z.y * this.cell;
    const frozen = z.frozenUntil > state.elapsed;
    ctx.fillStyle = frozen ? "rgba(190,240,255,0.8)" : "rgba(150,220,255,0.45)";
    // 雪花
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.time * (frozen ? 1.2 : 0.4));
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(0, 7);
      ctx.moveTo(0, -3);
      ctx.lineTo(-4, -6);
      ctx.moveTo(0, -3);
      ctx.lineTo(4, -6);
      ctx.stroke();
    }
    ctx.restore();
    if (frozen) {
      const g = ctx.createRadialGradient(x, y, 1, x, y, this.cell * 1.1);
      g.addColorStop(0, "rgba(190,240,255,0.5)");
      g.addColorStop(1, "rgba(190,240,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, this.cell * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawCrate(cr) {
    const { ctx } = this;
    const x = (cr.x - 0.45) * this.cell;
    const y = (cr.y - 0.9) * this.cell;
    const s = 0.9 * this.cell;
    ctx.fillStyle = "#8d6e63";
    ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = "#5d4037";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + s, y + s);
    ctx.moveTo(x + s, y);
    ctx.lineTo(x, y + s);
    ctx.stroke();
  }

  drawMover(m) {
    const { ctx } = this;
    const x = (m.curX - 0.45) * this.cell;
    const y = (m.curY - 0.3) * this.cell;
    const w = 0.9 * this.cell;
    const h = 0.35 * this.cell;
    ctx.fillStyle = "#78909c";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(x + 2, y + 2, w - 4, 3);
    // 光点
    const g = ctx.createRadialGradient(m.curX * this.cell, y + h / 2, 1, m.curX * this.cell, y + h / 2, this.cell * 0.7);
    g.addColorStop(0, "rgba(140,200,255,0.5)");
    g.addColorStop(1, "rgba(140,200,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(m.curX * this.cell, y + h / 2, this.cell * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  drawExit(ex, kind, reached) {
    const { ctx } = this;
    const x = ex.x * this.cell;
    const baseY = ex.y * this.cell;
    const col = kind === KINDS.FIRE ? "#ff8a65" : "#81d4fa";
    const h = 2.6 * this.cell;
    const pulse = reached ? 0.9 : 0.5 + 0.3 * Math.sin(this.time * 2.4);

    const g = ctx.createLinearGradient(0, baseY - h, 0, baseY);
    g.addColorStop(0, `${col}00`);
    g.addColorStop(1, `${col}${Math.round(pulse * 180).toString(16).padStart(2, "0")}`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 0.45 * this.cell, baseY);
    ctx.quadraticCurveTo(x - 0.35 * this.cell, baseY - h * 0.5, x, baseY - h);
    ctx.quadraticCurveTo(x + 0.35 * this.cell, baseY - h * 0.5, x + 0.45 * this.cell, baseY);
    ctx.closePath();
    ctx.fill();

    // 底部光斑
    const spot = ctx.createRadialGradient(x, baseY, 1, x, baseY, this.cell * 0.7);
    spot.addColorStop(0, `${col}aa`);
    spot.addColorStop(1, `${col}00`);
    ctx.fillStyle = spot;
    ctx.beginPath();
    ctx.arc(x, baseY, this.cell * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  drawGem(gem, taken) {
    const { ctx } = this;
    const x = gem.x * this.cell;
    const y = gem.y * this.cell;
    const col = gem.kind === "red" ? "#ff5252" : gem.kind === "blue" ? "#40c4ff" : GOLD;
    if (taken) {
      // 已收集：残余微光
      ctx.fillStyle = col + "22";
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const pulse = 0.75 + 0.25 * Math.sin(this.time * 4 + gem.x * 2);
    const g = ctx.createRadialGradient(x, y, 0.5, x, y, this.cell * 0.5);
    g.addColorStop(0, col);
    g.addColorStop(1, `${col}00`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, this.cell * 0.5 * pulse, 0, Math.PI * 2);
    ctx.fill();
    // 宝石主体（菱形，无描边）
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-3.2, -3.2, 6.4, 6.4);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ---- 角色（径向渐隐柔光 + 呼吸脉动，无描边）----
  drawActor(actor, elapsed, isFocused) {
    const { ctx } = this;
    const x = actor.x * this.cell;
    const y = actor.y * this.cell;
    const kind = actor.kind;
    const col = kind === KINDS.FIRE ? FIRE : ICE;
    const deep = kind === KINDS.FIRE ? FIRE_DEEP : ICE_DEEP;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * (kind === KINDS.FIRE ? 5 : 3.4) + (kind === KINDS.FIRE ? 0 : 2));

    // 主柔光（径向渐隐，禁止描边圈）
    const glowR = this.cell * (1.05 + pulse * 0.25) * (isFocused ? 1.25 : 1);
    const g = ctx.createRadialGradient(x, y - this.cell * 0.45, 1, x, y - this.cell * 0.45, glowR);
    g.addColorStop(0, `${col}${isFocused ? "99" : "66"}`);
    g.addColorStop(1, `${col}00`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y - this.cell * 0.45, glowR, 0, Math.PI * 2);
    ctx.fill();

    const w = CW * this.cell;
    const h = CH * this.cell;
    const bx = x - w / 2;
    const by = y - h;

    // 身体（胶囊形）
    ctx.fillStyle = deep;
    ctx.beginPath();
    ctx.roundRect(bx, by + h * 0.28, w, h * 0.72, 6);
    ctx.fill();

    // 头（圆形）
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, by + h * 0.24, w * 0.42, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = "#102027";
    const eyeY = by + h * 0.22;
    ctx.beginPath();
    ctx.arc(x - w * 0.14, eyeY, 2.2, 0, Math.PI * 2);
    ctx.arc(x + w * 0.14, eyeY, 2.2, 0, Math.PI * 2);
    ctx.fill();

    if (kind === KINDS.FIRE) {
      // 火焰苗（无描边，脉动）
      const fy = by + h * 0.24;
      const fh = 7 + pulse * 5;
      ctx.fillStyle = `rgba(255,190,80,${0.55 + pulse * 0.35})`;
      ctx.beginPath();
      ctx.moveTo(x - 4, fy - 2);
      ctx.quadraticCurveTo(x - 2, fy - fh, x, fy - fh * 0.55);
      ctx.quadraticCurveTo(x + 2, fy - fh * 0.3, x + 4, fy - 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,200,${0.5 + pulse * 0.3})`;
      ctx.beginPath();
      ctx.moveTo(x - 2, fy - 2);
      ctx.quadraticCurveTo(x, fy - fh * 0.6, x + 2, fy - 2);
      ctx.closePath();
      ctx.fill();
    } else {
      // 头顶水珠（呼吸）
      const dy = by + h * 0.24;
      const dr = 2.4 + pulse * 1.2;
      const dg = ctx.createRadialGradient(x, dy - dr, 0.5, x, dy - dr, dr * 2);
      dg.addColorStop(0, "rgba(220,250,255,0.9)");
      dg.addColorStop(1, "rgba(220,250,255,0)");
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(x, dy - dr, dr * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e1f7ff";
      ctx.beginPath();
      ctx.arc(x, dy - dr, dr * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 冰冻光效（ice 技能蓄力时整圈冷光淡入淡出）
    if (actor.freezeGlow) {
      const fg = ctx.createRadialGradient(x, y - h * 0.5, 1, x, y - h * 0.5, this.cell * 1.2);
      fg.addColorStop(0, `rgba(190,240,255,${0.5 * actor.freezeGlow})`);
      fg.addColorStop(1, "rgba(190,240,255,0)");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(x, y - h * 0.5, this.cell * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawFrozenBridge(state) {
    const { ctx } = this;
    for (const z of state.freezeSpots) {
      if (z.frozenUntil > state.elapsed) {
        const x = z.x * this.cell;
        const y = z.y * this.cell;
        ctx.fillStyle = "rgba(190,235,255,0.85)";
        ctx.fillRect(x - this.cell * 0.5, y - this.cell * 0.1, this.cell, this.cell * 0.2);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillRect(x - this.cell * 0.5, y - this.cell * 0.08, this.cell, 3);
      }
    }
  }

  // ---- 主渲染 ----
  render(state, dt, opts = {}) {
    const { ctx } = this;
    this.stepParticles(dt);
    this.drawBackdrop(dt);
    this.drawFrozenBridge(state);
    this.drawMap(state);

    for (const p of state.portals) this.drawPortal(p);
    for (const z of state.freezeSpots) this.drawFreezeSpot(z, state);
    for (const cr of state.crates) this.drawCrate(cr);
    for (const m of state.movers) this.drawMover(m);
    for (const b of state.buttons) this.drawButton(b);
    for (const pair of state.syncPairs) this.drawSyncPair(pair);
    for (const d of state.doors) this.drawDoor(d);
    for (const g of state.gems) this.drawGem(g, g.taken);

    this.drawExit(state.fireExit, KINDS.FIRE, Math.abs(state.fire.x - state.fireExit.x) < 0.6);
    this.drawExit(state.iceExit, KINDS.ICE, Math.abs(state.ice.x - state.iceExit.x) < 0.6);

    const focused = opts.focused ?? null;
    this.drawActor(state.fire, state.elapsed, focused === KINDS.FIRE);
    this.drawActor(state.ice, state.elapsed, focused === KINDS.ICE);

    // 粒子层
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 火人燃烧中的藤墙高亮（火苗粒子）
    for (const b of state.burning) {
      const bx = (b.col + 0.5) * this.cell;
      const by = (b.row + 0.5) * this.cell;
      this.addParticles(bx, by, "rgba(255,170,60,0.9)", 1, 0.5);
    }

    // 关底暗角
    const vignette = ctx.createRadialGradient(
      this.canvas.width / 2, this.canvas.height / 2, this.canvas.width * 0.3,
      this.canvas.width / 2, this.canvas.height / 2, this.canvas.width * 0.75
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,10,12,0.55)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
