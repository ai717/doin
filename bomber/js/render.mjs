// Bomber - Canvas 2D sandbox stage. Owns particles and all drawing.
// The board is drawn as chunky toy blocks (face + top bevel + bottom shade),
// which gives the diorama depth without any CSS transform on the canvas.
import { TILE_HARD, TILE_SOFT, TILE_CRACK, flameCells } from "./engine.mjs";

const GRASS_A = "#7ecb6c";
const GRASS_B = "#75c264";
const HARD_FACE = "#5c6b7a";
const HARD_TOP = "#8496a6";
const HARD_SIDE = "#3f4b57";
const SOFT_FACE = "#e2914f";
const SOFT_TOP = "#f7b578";
const SOFT_SIDE = "#b1652f";
const CRACK_FACE = "#8ea3b8";
const CRACK_TOP = "#bcccdb";
const CRACK_SIDE = "#61768a";

const POWER_COLORS = {
  fire: "#ff8a3d",
  bomb: "#40404e",
  speed: "#ffd93d",
  kick: "#4cd97b",
  remote: "#4db8ff",
  pierce: "#b06bff",
  shield: "#7be0ff",
  curse: "#8f8f9c",
};

const ENEMY_COLORS = {
  balloon: "#ff8fb1",
  chaser: "#ff7a4d",
  evader: "#7bd3ff",
  ghost: "#cbb8ff",
  armored: "#9aa7b5",
  boss: "#b06bff",
  target: "#ffe066",
};

const SKINS = [
  { body: "#f5f8ff", trim: "#3f7bd8", shoe: "#2f3b57" },
  { body: "#ffe0b8", trim: "#e0653f", shoe: "#7a3b26" },
  { body: "#d7f5e3", trim: "#2f9e6b", shoe: "#1f5f45" },
  { body: "#e8dcff", trim: "#7a5bd8", shoe: "#46317a" },
  { body: "#ffe9f2", trim: "#d84f95", shoe: "#7a2b52" },
  { body: "#fff4c2", trim: "#c9922f", shoe: "#6f5220" },
];

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
    this.state = null;
    this.cell = 40;
    this.dpr = 1;
    this.particles = [];
    this.rings = [];
    this.shake = 0;
    this.skin = 0;
    this.assist = true;
    this.time = 0;
  }

  attach(state) {
    this.state = state;
    this.particles = [];
    this.rings = [];
    this.resize();
  }

  resize() {
    const state = this.state;
    if (!state || !this.canvas) return;
    const holder = (this.canvas.closest && this.canvas.closest(".sandbox")) || this.canvas.parentElement;
    const holderW = holder && holder.clientWidth > 120 ? holder.clientWidth - 28 : (globalThis.innerWidth || 900) - 80;
    const availW = holderW;
    // the frame has no intrinsic height before the canvas is sized, so budget
    // the vertical space from the viewport instead of the parent box
    const viewportH = globalThis.innerHeight || 820;
    const heightBudget = Math.max(240, viewportH * (viewportH <= 820 ? 0.42 : 0.5));
    const cell = Math.max(20, Math.min(52, Math.floor(Math.min(availW / state.cols, heightBudget / state.rows))));
    this.cell = cell;
    this.dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const w = state.cols * cell;
    const h = state.rows * cell;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    if (this.ctx) this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  screenToCell(clientX, clientY) {
    if (!this.state || !this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * this.state.cols);
    const y = Math.floor(((clientY - rect.top) / rect.height) * this.state.rows);
    if (x < 0 || y < 0 || x >= this.state.cols || y >= this.state.rows) return null;
    return [x, y];
  }

  handleEvents(events) {
    for (const event of events) {
      if (event.type === "brick" || event.type === "crack") {
        this.spawnDebris(event.cx, event.cy, event.type === "crack" ? CRACK_FACE : SOFT_FACE);
      } else if (event.type === "explode") {
        this.spawnBlast(event.cx, event.cy);
        this.shake = Math.min(9, this.shake + 6);
      } else if (event.type === "kill") {
        this.spawnPuff(event.cx, event.cy, ENEMY_COLORS[event.enemy] ?? "#ff8fb1");
      } else if (event.type === "death") {
        this.shake = 12;
      }
    }
  }

  spawnDebris(cx, cy, color) {
    for (let i = 0; i < 7; i++) {
      this.particles.push({
        x: (cx + 0.5 + (Math.random() - 0.5) * 0.6) * this.cell,
        y: (cy + 0.5 + (Math.random() - 0.5) * 0.6) * this.cell,
        vx: (Math.random() - 0.5) * 90,
        vy: -60 - Math.random() * 90,
        size: 3 + Math.random() * 4,
        life: 0.7,
        max: 0.7,
        color,
        gravity: 320,
      });
    }
  }

  spawnBlast(cx, cy) {
    this.rings.push({ x: (cx + 0.5) * this.cell, y: (cy + 0.5) * this.cell, r: this.cell * 0.3, life: 0.42, max: 0.42 });
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.3;
      const speed = 90 + Math.random() * 120;
      this.particles.push({
        x: (cx + 0.5) * this.cell,
        y: (cy + 0.5) * this.cell,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        size: 3 + Math.random() * 3,
        life: 0.45,
        max: 0.45,
        color: i % 3 === 0 ? "#fff3c4" : "#ff8a2b",
        gravity: 90,
      });
    }
  }

  spawnPuff(cx, cy, color) {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 110;
      this.particles.push({
        x: (cx + 0.5) * this.cell,
        y: (cy + 0.5) * this.cell,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        size: 3 + Math.random() * 4,
        life: 0.6,
        max: 0.6,
        color,
        gravity: 40,
      });
    }
  }

  update(dtMs) {
    const dt = Math.min(0.05, dtMs / 1000);
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 26);
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const r of this.rings) {
      r.life -= dt;
      r.r += dt * this.cell * 3.4;
    }
    this.rings = this.rings.filter((r) => r.life > 0);
  }

  draw() {
    const ctx = this.ctx;
    const state = this.state;
    if (!ctx || !state) return;
    const cell = this.cell;
    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    ctx.clearRect(0, 0, state.cols * cell, state.rows * cell);
    this.drawGround(ctx, state, cell);
    this.drawDanger(ctx, state, cell);
    this.drawTiles(ctx, state, cell);
    this.drawExit(ctx, state, cell);
    this.drawItems(ctx, state, cell);
    this.drawBombs(ctx, state, cell);
    this.drawEnemies(ctx, state, cell);
    this.drawPlayer(ctx, state, cell);
    this.drawFlames(ctx, state, cell);
    this.drawParticles(ctx);
    ctx.restore();
  }

  drawGround(ctx, state, cell) {
    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? GRASS_A : GRASS_B;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let y = 1; y < state.rows; y += 2) {
      for (let x = 1; x < state.cols; x += 2) {
        ctx.fillRect(x * cell + cell * 0.3, y * cell + cell * 0.3, cell * 0.4, cell * 0.4);
      }
    }
  }

  drawDanger(ctx, state, cell) {
    if (!this.assist) return;
    const pulse = 0.2 + 0.14 * Math.sin(this.time * 9);
    for (const bomb of state.bombs) {
      // A quiet footprint from the moment the bomb lands - the player needs to
      // see his own kill zone while there is still time to walk out of it.
      const imminent = bomb.waiting || bomb.fuse <= 42;
      const cells = flameCells(state.tiles, state.cols, state.rows, bomb.cx, bomb.cy, bomb.range, bomb.pierce);
      ctx.fillStyle = `rgba(255,138,43,${(imminent ? pulse : 0.1).toFixed(3)})`;
      for (const [cx, cy] of cells) {
        roundRect(ctx, cx * cell + 2, cy * cell + 2, cell - 4, cell - 4, 6);
        ctx.fill();
      }
      if (imminent) {
        ctx.strokeStyle = `rgba(255,196,80,${(pulse * 1.6).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.4, cell * 0.05);
        for (const [cx, cy] of cells) {
          roundRect(ctx, cx * cell + 2, cy * cell + 2, cell - 4, cell - 4, 6);
          ctx.stroke();
        }
      }
    }
  }

  drawTiles(ctx, state, cell) {
    const bevel = Math.max(3, cell * 0.14);
    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        const tile = state.tiles[y][x];
        if (tile === 0) continue;
        const px = x * cell;
        const py = y * cell;
        let face = SOFT_FACE;
        let top = SOFT_TOP;
        let side = SOFT_SIDE;
        if (tile === TILE_HARD) {
          face = HARD_FACE;
          top = HARD_TOP;
          side = HARD_SIDE;
        } else if (tile === TILE_CRACK) {
          face = CRACK_FACE;
          top = CRACK_TOP;
          side = CRACK_SIDE;
        }
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        roundRect(ctx, px + 2, py + cell * 0.18, cell - 4, cell - 2, 7);
        ctx.fill();
        ctx.fillStyle = face;
        roundRect(ctx, px + 2, py + 2, cell - 4, cell - 4, 7);
        ctx.fill();
        ctx.fillStyle = top;
        roundRect(ctx, px + 2, py + 2, cell - 4, bevel, 5);
        ctx.fill();
        ctx.fillStyle = side;
        roundRect(ctx, px + 2, py + cell - 2 - bevel * 0.8, cell - 4, bevel * 0.8, 4);
        ctx.fill();
        if (tile === TILE_SOFT) {
          ctx.strokeStyle = "rgba(255,255,255,0.25)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px + 4, py + cell * 0.52);
          ctx.lineTo(px + cell - 4, py + cell * 0.52);
          ctx.moveTo(px + cell * 0.5, py + 4);
          ctx.lineTo(px + cell * 0.5, py + cell * 0.52);
          ctx.moveTo(px + cell * 0.28, py + cell * 0.52);
          ctx.lineTo(px + cell * 0.28, py + cell - 4);
          ctx.moveTo(px + cell * 0.74, py + cell * 0.52);
          ctx.lineTo(px + cell * 0.74, py + cell - 4);
          ctx.stroke();
        } else if (tile === TILE_CRACK) {
          ctx.strokeStyle = state.tileHp[y][x] <= 1 ? "rgba(255,120,90,0.9)" : "rgba(255,255,255,0.35)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px + cell * 0.24, py + cell * 0.24);
          ctx.lineTo(px + cell * 0.76, py + cell * 0.76);
          ctx.moveTo(px + cell * 0.76, py + cell * 0.24);
          ctx.lineTo(px + cell * 0.24, py + cell * 0.76);
          ctx.stroke();
        }
      }
    }
  }

  drawExit(ctx, state, cell) {
    const exit = state.exit;
    if (!exit || !exit.revealed) return;
    const px = exit.cx * cell;
    const py = exit.cy * cell;
    const glow = 0.5 + 0.3 * Math.sin(this.time * 4);
    ctx.save();
    ctx.fillStyle = `rgba(255,212,94,${glow.toFixed(2)})`;
    roundRect(ctx, px + 1, py + 1, cell - 2, cell - 2, 8);
    ctx.fill();
    ctx.fillStyle = "#3b2f2a";
    roundRect(ctx, px + cell * 0.2, py + cell * 0.14, cell * 0.6, cell * 0.78, 6);
    ctx.fill();
    ctx.fillStyle = "#ffd45e";
    ctx.fillRect(px + cell * 0.34, py + cell * 0.3, cell * 0.32, cell * 0.5);
    ctx.restore();
  }

  drawItems(ctx, state, cell) {
    for (const item of state.powerups) {
      if (item.hidden || item.burned || item.taken) continue;
      const px = item.cx * cell;
      const py = item.cy * cell;
      const bob = Math.sin(this.time * 3 + item.cx) * cell * 0.05;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(px + cell * 0.5, py + cell * 0.78, cell * 0.26, cell * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(0, bob);
      ctx.fillStyle = POWER_COLORS[item.kind] ?? "#ffffff";
      roundRect(ctx, px + cell * 0.16, py + cell * 0.16, cell * 0.68, cell * 0.68, 8);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      roundRect(ctx, px + cell * 0.22, py + cell * 0.2, cell * 0.56, cell * 0.2, 6);
      ctx.fill();
      this.drawItemGlyph(ctx, item.kind, px + cell * 0.5, py + cell * 0.55, cell * 0.34);
      ctx.restore();
    }
  }

  drawItemGlyph(ctx, kind, cx, cy, size) {
    ctx.save();
    ctx.strokeStyle = "rgba(30,26,24,0.85)";
    ctx.fillStyle = "rgba(30,26,24,0.85)";
    ctx.lineWidth = Math.max(1.5, size * 0.14);
    ctx.lineCap = "round";
    switch (kind) {
      case "fire":
        ctx.beginPath();
        ctx.moveTo(cx, cy - size * 0.55);
        ctx.quadraticCurveTo(cx + size * 0.5, cy - size * 0.05, cx, cy + size * 0.55);
        ctx.quadraticCurveTo(cx - size * 0.5, cy - size * 0.05, cx, cy - size * 0.55);
        ctx.fill();
        break;
      case "bomb":
        ctx.beginPath();
        ctx.arc(cx, cy + size * 0.15, size * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + size * 0.1, cy - size * 0.3);
        ctx.quadraticCurveTo(cx + size * 0.5, cy - size * 0.6, cx + size * 0.42, cy - size * 0.85);
        ctx.stroke();
        break;
      case "speed":
        for (let i = 0; i < 2; i++) {
          const ox = cx - size * 0.45 + i * size * 0.45;
          ctx.beginPath();
          ctx.moveTo(ox, cy - size * 0.45);
          ctx.lineTo(ox + size * 0.42, cy);
          ctx.lineTo(ox, cy + size * 0.45);
          ctx.stroke();
        }
        break;
      case "kick":
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.5, cy + size * 0.4);
        ctx.lineTo(cx + size * 0.5, cy + size * 0.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + size * 0.1, cy - size * 0.5);
        ctx.lineTo(cx + size * 0.55, cy + size * 0.05);
        ctx.lineTo(cx + size * 0.1, cy + size * 0.05);
        ctx.fill();
        break;
      case "remote":
        ctx.beginPath();
        ctx.moveTo(cx + size * 0.15, cy - size * 0.55);
        ctx.lineTo(cx - size * 0.3, cy + size * 0.05);
        ctx.lineTo(cx + size * 0.05, cy + size * 0.05);
        ctx.lineTo(cx - size * 0.15, cy + size * 0.55);
        ctx.lineTo(cx + size * 0.35, cy - size * 0.05);
        ctx.lineTo(cx, cy - size * 0.05);
        ctx.closePath();
        ctx.fill();
        break;
      case "pierce":
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.55, cy);
        ctx.lineTo(cx + size * 0.55, cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + size * 0.2, cy - size * 0.35);
        ctx.lineTo(cx + size * 0.6, cy);
        ctx.lineTo(cx + size * 0.2, cy + size * 0.35);
        ctx.fill();
        break;
      case "shield":
        ctx.beginPath();
        ctx.moveTo(cx, cy - size * 0.55);
        ctx.lineTo(cx + size * 0.45, cy - size * 0.25);
        ctx.lineTo(cx + size * 0.35, cy + size * 0.4);
        ctx.lineTo(cx, cy + size * 0.58);
        ctx.lineTo(cx - size * 0.35, cy + size * 0.4);
        ctx.lineTo(cx - size * 0.45, cy - size * 0.25);
        ctx.closePath();
        ctx.fill();
        break;
      default:
        ctx.beginPath();
        ctx.arc(cx, cy - size * 0.05, size * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx - size * 0.16, cy - size * 0.1, size * 0.1, 0, Math.PI * 2);
        ctx.arc(cx + size * 0.16, cy - size * 0.1, size * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = "#f4f4f8";
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  drawBombs(ctx, state, cell) {
    for (const bomb of state.bombs) {
      const px = (bomb.cx + 0.5) * cell;
      const py = (bomb.cy + 0.5) * cell;
      const urgency = bomb.waiting ? 0.2 : 1 - Math.max(0, bomb.fuse) / 150;
      const pulse = 1 + Math.sin(this.time * (4 + urgency * 14)) * (0.05 + urgency * 0.09);
      const r = cell * 0.33 * pulse;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(px, py + cell * 0.3, r * 0.95, r * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      const grad = ctx.createRadialGradient(px - r * 0.35, py - r * 0.4, r * 0.15, px, py, r);
      grad.addColorStop(0, "#5a5a6b");
      grad.addColorStop(0.55, "#2c2c36");
      grad.addColorStop(1, "#1b1b22");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = bomb.waiting ? "#7be0ff" : "#f7c948";
      ctx.lineWidth = Math.max(1.6, cell * 0.05);
      ctx.beginPath();
      ctx.moveTo(px + r * 0.45, py - r * 0.72);
      ctx.quadraticCurveTo(px + r * 1.15, py - r * 1.5, px + r * 0.7, py - r * 1.85);
      ctx.stroke();
      const sparkR = cell * (0.06 + 0.03 * Math.sin(this.time * 22));
      ctx.fillStyle = "#fff1a8";
      ctx.beginPath();
      ctx.arc(px + r * 0.7, py - r * 1.85, sparkR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,180,60,0.35)";
      ctx.beginPath();
      ctx.arc(px + r * 0.7, py - r * 1.85, sparkR * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawFlames(ctx, state, cell) {
    for (const flame of state.flames) {
      const life = flame.ttl / 30;
      const px = flame.cx * cell;
      const py = flame.cy * cell;
      const flick = 0.85 + 0.15 * Math.sin(this.time * 24 + flame.cx + flame.cy);
      ctx.save();
      ctx.globalAlpha = Math.min(1, life * 1.4);
      const grad = ctx.createRadialGradient(
        px + cell * 0.5,
        py + cell * 0.5,
        cell * 0.05,
        px + cell * 0.5,
        py + cell * 0.5,
        cell * 0.62 * flick
      );
      grad.addColorStop(0, "#fffbe6");
      grad.addColorStop(0.45, "#ffc247");
      grad.addColorStop(1, "rgba(255,106,43,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(px - cell * 0.1, py - cell * 0.1, cell * 1.2, cell * 1.2);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      roundRect(ctx, px + cell * 0.28, py + cell * 0.28, cell * 0.44, cell * 0.44, 6);
      ctx.fill();
      ctx.restore();
    }
  }

  drawEnemies(ctx, state, cell) {
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      const px = enemy.x * cell;
      const py = enemy.y * cell;
      const color = ENEMY_COLORS[enemy.type] ?? "#ff8fb1";
      const bob = Math.sin(this.time * 3 + enemy.id) * cell * 0.05;
      ctx.save();
      if (enemy.type === "ghost") ctx.globalAlpha = 0.6;
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(px, py + cell * 0.32, cell * 0.24, cell * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(0, bob);
      if (enemy.type === "target") {
        ctx.lineWidth = Math.max(2, cell * 0.06);
        ctx.strokeStyle = "#c98f13";
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, cell * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(px, py, cell * 0.16, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const r = cell * (enemy.type === "boss" ? 0.42 : 0.31);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(px, py, r, r * 1.06, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath();
        ctx.ellipse(px - r * 0.3, py - r * 0.4, r * 0.28, r * 0.2, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(60,40,50,0.5)";
        ctx.lineWidth = Math.max(1, cell * 0.03);
        ctx.beginPath();
        ctx.moveTo(px, py + r * 1.05);
        ctx.quadraticCurveTo(px + r * 0.3, py + r * 1.6, px - r * 0.1, py + r * 1.9);
        ctx.stroke();
        ctx.fillStyle = "#2b2436";
        ctx.beginPath();
        ctx.arc(px - r * 0.32, py - r * 0.05, Math.max(1.4, cell * 0.055), 0, Math.PI * 2);
        ctx.arc(px + r * 0.32, py - r * 0.05, Math.max(1.4, cell * 0.055), 0, Math.PI * 2);
        ctx.fill();
        if (enemy.type === "armored" || enemy.type === "boss") {
          ctx.fillStyle = enemy.hp < enemy.maxHp ? "#ff9d6e" : "#c8d2dd";
          ctx.beginPath();
          ctx.ellipse(px, py - r * 0.55, r * 0.85, r * 0.42, 0, Math.PI, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  drawPlayer(ctx, state, cell) {
    const p = state.player;
    if (!p.alive) return;
    const skin = SKINS[this.skin % SKINS.length];
    const px = p.x * cell;
    const py = p.y * cell;
    const squash = 1 + Math.sin(this.time * 12) * 0.03;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.26)";
    ctx.beginPath();
    ctx.ellipse(px, py + cell * 0.34, cell * 0.26, cell * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    if (p.invuln > 0 && Math.floor(this.time * 12) % 2 === 0) ctx.globalAlpha = 0.45;
    const bodyR = cell * 0.3;
    ctx.fillStyle = skin.body;
    ctx.beginPath();
    ctx.ellipse(px, py + cell * 0.05, bodyR, bodyR * squash, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.trim;
    roundRect(ctx, px - bodyR * 0.95, py + cell * 0.02, bodyR * 1.9, bodyR * 0.7, 4);
    ctx.fill();
    ctx.fillStyle = skin.body;
    ctx.beginPath();
    ctx.arc(px, py - cell * 0.18, bodyR * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2436";
    ctx.beginPath();
    ctx.arc(px - bodyR * 0.26, py - cell * 0.2, Math.max(1.5, cell * 0.05), 0, Math.PI * 2);
    ctx.arc(px + bodyR * 0.26, py - cell * 0.2, Math.max(1.5, cell * 0.05), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.shoe;
    roundRect(ctx, px - bodyR * 0.7, py + cell * 0.24, bodyR * 0.5, bodyR * 0.3, 3);
    roundRect(ctx, px + bodyR * 0.2, py + cell * 0.24, bodyR * 0.5, bodyR * 0.3, 3);
    ctx.fill();
    if (p.shield > 0) {
      ctx.strokeStyle = "rgba(123,224,255,0.9)";
      ctx.lineWidth = Math.max(2, cell * 0.06);
      ctx.beginPath();
      ctx.arc(px, py, cell * 0.44, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p.curse) {
      ctx.fillStyle = "rgba(150,110,220,0.85)";
      ctx.beginPath();
      ctx.arc(px + bodyR * 0.9, py - cell * 0.34, cell * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.max);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      ctx.globalAlpha = Math.max(0, r.life / r.max) * 0.7;
      ctx.strokeStyle = "#ffe9a8";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
