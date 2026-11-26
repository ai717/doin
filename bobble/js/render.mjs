// 泡泡射手 · Canvas 渲染层（唯一绘制层：极光冰窟舞台 / 软胶冰泡 / 反弹预测线）

import {
  R,
  D,
  TOP_Y,
  DEATH_Y,
  CANNON_X,
  CANNON_Y,
  WALL_L,
  WALL_R,
  ROW_H,
  STAGE_W,
  STAGE_H,
  EMPTY,
  CRYSTAL,
  PRISM,
  cellX,
  cellY
} from "./engine.mjs";

export const BUBBLE_COLORS = [
  { base: "#3fb8ef", light: "#a7ecff", dark: "#1668a8" },   // 冰蓝
  { base: "#43e0a4", light: "#b6ffe0", dark: "#128a63" },   // 极光绿
  { base: "#ff9057", light: "#ffd0b0", dark: "#b24a1e" },   // 珊瑚橙
  { base: "#b28cff", light: "#e2d3ff", dark: "#5f3fb0" },   // 紫晶
  { base: "#ffcf4d", light: "#fff0b8", dark: "#b3861a" },   // 柠黄
  { base: "#ff7ba8", light: "#ffc9dc", dark: "#b03a68" }    // 玫粉
];

const SYMBOLS = ["circle", "triangle", "square", "star", "ring", "cross"];

export class BobbleRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.scale = 1;
    this.dpr = 1;
    this.time = 0;
    this.shake = 0;
    this.pressAnim = 0;
    this.particles = [];
    this.falling = [];
    this.pops = [];
    this.assist = false;
    this.particlesBg = Array.from({ length: 26 }, (_, i) => ({
      x: Math.random() * STAGE_W,
      y: Math.random() * STAGE_H,
      r: 1 + Math.random() * 2.6,
      v: 8 + Math.random() * 22,
      a: 0.12 + Math.random() * 0.3
    }));
    this.resize();
  }

  setAssist(on) {
    this.assist = Boolean(on);
  }

  resize() {
    const canvas = this.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width || STAGE_W;
    const cssH = rect.height || STAGE_H;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * this.dpr);
    canvas.height = Math.round(cssH * this.dpr);
    this.scale = cssW / STAGE_W;
    this.cssW = cssW;
    this.cssH = cssH;
  }

  toLogical(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = rect.width ? STAGE_W / rect.width : 1;
    const sy = rect.height ? STAGE_H / rect.height : 1;
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
  }

  feed(events, state) {
    for (const ev of events) {
      if (ev.type === "pop" && ev.cells) {
        for (let i = 0; i < ev.cells.length; i += 1) {
          const [r, c] = ev.cells[i];
          this.spawnPop(r, c, state?.board?.[r]?.parity ?? 0, ev.color ?? 0);
        }
        this.shake = Math.max(this.shake, Math.min(6, 2 + ev.popped));
      } else if (ev.type === "drop" && ev.cells) {
        for (let i = 0; i < ev.cells.length; i += 1) {
          const [r, c] = ev.cells[i];
          this.spawnFall(r, c, state?.board?.[r]?.parity ?? 0, (ev.colors?.[i] ?? 0));
        }
        this.shake = Math.max(this.shake, Math.min(9, 3 + ev.dropped * 0.6));
      } else if (ev.type === "avalanche") {
        this.shake = Math.max(this.shake, 12);
      } else if (ev.type === "press") {
        this.shake = Math.max(this.shake, 8);
        this.pressAnim = 0.36;
      } else if (ev.type === "pick") {
        this.shake = Math.max(this.shake, 7);
        for (const [r, c] of ev.cleared ?? []) this.spawnPop(r, c, state?.board?.[r]?.parity ?? 0, 0);
      } else if (ev.type === "lose") {
        this.shake = Math.max(this.shake, 12);
      }
    }
  }

  spawnPop(row, col, parity, color) {
    const x = cellX(parity, col);
    const y = cellY(row);
    for (let i = 0; i < 7; i += 1) {
      const a = (Math.PI * 2 * i) / 7 + Math.random();
      const sp = 60 + Math.random() * 130;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0.4 + Math.random() * 0.35,
        age: 0,
        r: 1.6 + Math.random() * 2.6,
        color: "#dff6ff"
      });
    }
    this.pops.push({ x, y, age: 0, life: 0.28 });
  }

  spawnFall(row, col, parity, color) {
    this.falling.push({
      x: cellX(parity, col),
      y: cellY(row),
      vx: (Math.random() - 0.5) * 90,
      vy: -40 - Math.random() * 60,
      rot: 0,
      vr: (Math.random() - 0.5) * 6,
      color,
      life: 1.6
    });
  }

  tick(dt) {
    this.time += dt;
    for (const p of this.particlesBg) {
      p.y -= p.v * dt;
      if (p.y < -8) {
        p.y = STAGE_H + 8;
        p.x = Math.random() * STAGE_W;
      }
    }
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 620 * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
    for (const p of this.pops) p.age += dt;
    this.pops = this.pops.filter((p) => p.age < p.life);
    for (const f of this.falling) {
      f.vy += 1500 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
      f.life -= dt;
    }
    this.falling = this.falling.filter((f) => f.life > 0 && f.y < STAGE_H + 60);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
    if (this.pressAnim > 0) this.pressAnim = Math.max(0, this.pressAnim - dt);
  }

  render(state) {
    const ctx = this.ctx;
    if (!ctx || !state) return;
    const s = this.scale;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    ctx.save();
    ctx.scale(s, s);
    const shakeX = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    ctx.translate(shakeX, shakeY);

    this.drawBackground();
    this.drawWalls();
    this.drawFreezeLine(state);
    const offset = this.pressAnim > 0 ? -(ROW_H * this.pressAnim) / 0.36 : 0;
    this.drawBoard(state, offset);
    this.drawFalling();
    this.drawParticles();
    this.drawAim(state);
    this.drawCannon(state);
    this.drawFlight(state);
    ctx.restore();
  }

  drawBackground() {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, STAGE_H);
    g.addColorStop(0, "#0d2144");
    g.addColorStop(0.45, "#123357");
    g.addColorStop(1, "#0a1830");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);

    // 极光帷幕（缓慢流动）
    for (let i = 0; i < 3; i += 1) {
      const phase = this.time * (0.16 + i * 0.05) + i * 2.1;
      const grad = ctx.createLinearGradient(0, 40 + i * 40, STAGE_W, 200 + i * 60);
      const alpha = 0.12 - i * 0.025;
      grad.addColorStop(0, `rgba(80, 255, 200, ${alpha})`);
      grad.addColorStop(0.5, `rgba(120, 160, 255, ${alpha * 0.8})`);
      grad.addColorStop(1, `rgba(200, 120, 255, ${alpha * 0.6})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 60 + i * 50);
      for (let x = 0; x <= STAGE_W; x += 20) {
        const y = 90 + i * 70 + Math.sin(x / 62 + phase) * 26 + Math.sin(x / 23 + phase * 1.7) * 8;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(STAGE_W, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
    }

    // 漂浮冰晶微粒
    for (const p of this.particlesBg) {
      ctx.fillStyle = `rgba(210, 240, 255, ${p.a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawWalls() {
    const ctx = this.ctx;
    for (const side of [0, 1]) {
      const x = side ? WALL_R : 0;
      const g = ctx.createLinearGradient(x, 0, x + (side ? 12 : 12), 0);
      g.addColorStop(0, "rgba(150, 220, 255, 0.30)");
      g.addColorStop(1, "rgba(120, 200, 255, 0.05)");
      ctx.fillStyle = g;
      ctx.fillRect(side ? x : 0, TOP_Y, 12, DEATH_Y - TOP_Y + 10);
    }
    // 冰盖
    const sheet = ctx.createLinearGradient(0, 0, 0, TOP_Y + 14);
    sheet.addColorStop(0, "#8fd8ff");
    sheet.addColorStop(1, "rgba(150, 220, 255, 0.15)");
    ctx.fillStyle = sheet;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(STAGE_W, 0);
    ctx.lineTo(STAGE_W, TOP_Y + 4);
    for (let x = STAGE_W; x >= 0; x -= 18) {
      ctx.lineTo(x, TOP_Y + (Math.sin(x / 15) * 3 + 2));
    }
    ctx.closePath();
    ctx.fill();
  }

  drawFreezeLine(state) {
    const ctx = this.ctx;
    const lowest = state.board ? this.lowestRow(state.board) : 0;
    const danger = Math.max(0, Math.min(1, (lowest - 8) / 5));
    const g = ctx.createLinearGradient(0, DEATH_Y - 26, 0, DEATH_Y + 8);
    g.addColorStop(0, "rgba(255, 90, 130, 0)");
    g.addColorStop(0.7, `rgba(255, 90, 130, ${0.18 + danger * 0.45})`);
    g.addColorStop(1, "rgba(255, 90, 130, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(WALL_L, DEATH_Y - 26, WALL_R - WALL_L, 34);
    // 霜纹自两侧蔓延（径向柔光，禁用描边圈）
    if (danger > 0.05) {
      const spread = danger * (WALL_R - WALL_L) * 0.5;
      const rg = ctx.createLinearGradient(WALL_L, DEATH_Y, WALL_L + spread, DEATH_Y);
      rg.addColorStop(0, `rgba(255, 230, 240, ${0.35 * danger})`);
      rg.addColorStop(1, "rgba(255, 230, 240, 0)");
      ctx.fillStyle = rg;
      ctx.fillRect(WALL_L, DEATH_Y - 4, spread, 6);
      const rg2 = ctx.createLinearGradient(WALL_R, DEATH_Y, WALL_R - spread, DEATH_Y);
      rg2.addColorStop(0, `rgba(255, 230, 240, ${0.35 * danger})`);
      rg2.addColorStop(1, "rgba(255, 230, 240, 0)");
      ctx.fillStyle = rg2;
      ctx.fillRect(WALL_R - spread, DEATH_Y - 4, spread, 6);
    }
  }

  lowestRow(board) {
    let low = -1;
    for (let r = 0; r < board.length; r += 1) {
      if (board[r].cells.some((v) => v !== EMPTY)) low = r;
    }
    return low;
  }

  drawBoard(state, offset) {
    const ctx = this.ctx;
    for (let r = 0; r < state.board.length; r += 1) {
      const row = state.board[r];
      for (let c = 0; c < row.cells.length; c += 1) {
        const v = row.cells[c];
        if (v === EMPTY) continue;
        const x = cellX(row.parity, c);
        const y = cellY(r) + offset;
        if (y > STAGE_H + D) continue;
        this.drawBubble(x, y, v, 1);
      }
    }
  }

  drawBubble(x, y, color, alpha = 1, radius = R) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (color === CRYSTAL) {
      const g = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.4, radius * 0.15, x, y, radius);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.5, "#cfefff");
      g.addColorStop(1, "#6fb6d8");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x - radius * 0.5, y + radius * 0.3);
      ctx.lineTo(x, y - radius * 0.55);
      ctx.lineTo(x + radius * 0.5, y + radius * 0.3);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (color === PRISM) {
      const g = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
      g.addColorStop(0, "#ff9ad5");
      g.addColorStop(0.35, "#8fd8ff");
      g.addColorStop(0.7, "#a6ffcf");
      g.addColorStop(1, "#ffe08a");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      this.bubbleGloss(x, y, radius);
      ctx.restore();
      return;
    }
    const pal = BUBBLE_COLORS[color % BUBBLE_COLORS.length];
    const g = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.42, radius * 0.12, x, y, radius * 1.02);
    g.addColorStop(0, pal.light);
    g.addColorStop(0.42, pal.base);
    g.addColorStop(1, pal.dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    // 底部内发光（软胶通透感）
    const inner = ctx.createRadialGradient(x + radius * 0.18, y + radius * 0.35, radius * 0.1, x, y, radius * 0.95);
    inner.addColorStop(0, "rgba(255,255,255,0.35)");
    inner.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.94, 0, Math.PI * 2);
    ctx.fill();
    this.bubbleGloss(x, y, radius);
    if (this.assist) this.drawSymbol(x, y, radius, color);
    ctx.restore();
  }

  bubbleGloss(x, y, radius) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.ellipse(x - radius * 0.34, y - radius * 0.42, radius * 0.2, radius * 0.13, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(x + radius * 0.3, y + radius * 0.34, radius * 0.14, radius * 0.08, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawSymbol(x, y, radius, color) {
    const ctx = this.ctx;
    const kind = SYMBOLS[color % SYMBOLS.length];
    ctx.strokeStyle = "rgba(12, 28, 48, 0.55)";
    ctx.fillStyle = "rgba(12, 28, 48, 0.55)";
    ctx.lineWidth = 1.6;
    const s = radius * 0.42;
    ctx.beginPath();
    if (kind === "circle") {
      ctx.arc(x, y, s, 0, Math.PI * 2);
    } else if (kind === "triangle") {
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s, y + s * 0.8);
      ctx.lineTo(x - s, y + s * 0.8);
      ctx.closePath();
    } else if (kind === "square") {
      ctx.rect(x - s * 0.8, y - s * 0.8, s * 1.6, s * 1.6);
    } else if (kind === "star") {
      for (let i = 0; i < 10; i += 1) {
        const rr = i % 2 ? s * 0.45 : s;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const px = x + Math.cos(a) * rr;
        const py = y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (kind === "ring") {
      ctx.arc(x, y, s * 0.75, 0, Math.PI * 2);
    } else {
      ctx.moveTo(x - s, y - s);
      ctx.lineTo(x + s, y + s);
      ctx.moveTo(x + s, y - s);
      ctx.lineTo(x - s, y + s);
    }
    ctx.stroke();
  }

  drawAim(state) {
    if (state.status !== "aim") return;
    const ctx = this.ctx;
    const path = state.preview ?? null;
    if (!path) return;
    ctx.save();
    for (const p of path.dots ?? []) {
      ctx.fillStyle = "rgba(190, 240, 255, 0.7)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (path.land && state.aimTier !== "pro") {
      const [r, c] = path.land;
      const x = cellX(state.board[r].parity, c);
      const y = cellY(r);
      this.drawBubble(x, y, state.pickArmed ? PRISM : state.loaded, 0.42);
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, R * 0.9, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCannon(state) {
    const ctx = this.ctx;
    const angle = state.angle ?? 0;
    ctx.save();
    ctx.translate(CANNON_X, CANNON_Y);
    // 基座
    const base = ctx.createLinearGradient(0, -18, 0, 30);
    base.addColorStop(0, "#d7b26a");
    base.addColorStop(1, "#7c5a24");
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.moveTo(-34, 30);
    ctx.lineTo(-20, -6);
    ctx.lineTo(20, -6);
    ctx.lineTo(34, 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(-22, -6, 44, 4);
    // 炮管
    ctx.rotate(angle);
    const barrel = ctx.createLinearGradient(-9, 0, 9, 0);
    barrel.addColorStop(0, "#9ad4f2");
    barrel.addColorStop(0.5, "#e8f8ff");
    barrel.addColorStop(1, "#6ea9c8");
    ctx.fillStyle = barrel;
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(-7, -44);
    ctx.lineTo(7, -44);
    ctx.lineTo(9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 装填口与待发射泡
    const mx = CANNON_X + Math.sin(angle) * 26;
    const my = CANNON_Y - Math.cos(angle) * 26;
    this.drawBubble(mx, my, state.pickArmed ? PRISM : state.loaded, 1, R * 0.92);
    this.drawBubble(CANNON_X + 62, CANNON_Y + 6, state.next ?? 0, 0.95, R * 0.62);
    ctx.save();
    ctx.fillStyle = "rgba(200, 230, 255, 0.45)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("NEXT", CANNON_X + 62, CANNON_Y + 30);
    ctx.restore();
  }

  drawFlight(state) {
    const f = state.flight;
    if (!f) return;
    const ctx = this.ctx;
    ctx.save();
    const grad = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, 22);
    grad.addColorStop(0, "rgba(200, 245, 255, 0.55)");
    grad.addColorStop(1, "rgba(200, 245, 255, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    this.drawBubble(f.x, f.y, f.pick ? PRISM : f.color, 1);
  }

  drawParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const alpha = 1 - p.age / p.life;
      ctx.fillStyle = `rgba(223, 246, 255, ${alpha * 0.9})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of this.pops) {
      const k = p.age / p.life;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2.4 * (1 - k);
      ctx.beginPath();
      ctx.arc(p.x, p.y, R * (0.5 + k * 0.9), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawFalling() {
    for (const f of this.falling) {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 0.6));
      this.ctx.translate(f.x, f.y);
      this.ctx.rotate(f.rot);
      this.drawBubble(0, 0, f.color, 1);
      this.ctx.restore();
    }
  }
}
