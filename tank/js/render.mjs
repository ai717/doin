// Tank Assault - Canvas 2D sand table renderer.
// The tray draws the battlefield only: terrain models, tanks, shells, particles and the
// telegraph of bounce traces. Every readout, gauge and key lives in semantic DOM (ui.mjs).
import { GRID, TANK_SIZE, CELL, DIR, DX, DY, ENEMY_TYPES } from "./levels.mjs";

const SAND = "#cbb187";
const SAND_DARK = "#a98d63";
const SAND_EDGE = "#8d7448";

const BRICK = { top: "#d06a45", face: "#a94c30", dark: "#7c3521", mortar: "#e0b48c" };
const STEEL = { top: "#bcc7d1", face: "#93a1ae", dark: "#69757f", rivet: "#dde4ea" };
const TREE = { leaf: "#4e7d46", leafDark: "#376033" };
const WATER = { body: "#3f9fc4", gloss: "#a6dcef" };
const ICE = { body: "#cfe7ee", gloss: "#f0fafd" };
const BASE = { brass: "#c9a34c", brassDark: "#8a6a26", dead: "#6b5f52" };

const PLAYER_SKIN = { body: "#6f8a4e", top: "#8aa861", tread: "#39432e", gun: "#576c40" };

const ENEMY_SKIN = {
  scout: { body: "#c2a24e", top: "#d8bb69", tread: "#6b5a24" },
  standard: { body: "#8f99a4", top: "#a8b1ba", tread: "#5a626b" },
  rapid: { body: "#c97f3c", top: "#e09a55", tread: "#7c4d22" },
  armor: { body: "#6f6083", top: "#87779c", tread: "#463d55" },
  sapper: { body: "#4a8270", top: "#5f9c88", tread: "#2d5145" },
  sniper: { body: "#ab4b47", top: "#c56a65", tread: "#6b2c2a" },
};

function skinFor(type) {
  return ENEMY_SKIN[type] ?? ENEMY_SKIN.standard;
}

function withAlpha(hex, alpha) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export class Renderer {
  constructor(canvas = null) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.state = null;
    this.particles = [];
    this.traces = [];
    this.rings = [];
    this.flash = 0;
    this.shakeT = 0;
    this.shakeMag = 0;
    this.size = 544;
    this.dpr = 1;
    this.hints = true;
    this.t = 0;
    this.reduced = false;
    try {
      this.reduced = Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    } catch {
      this.reduced = false;
    }
    this.sandTile = null;
  }

  attach(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.resize();
    return this.ctx;
  }

  /* ------------------------------------------------------------------ sizing */

  resize() {
    if (!this.canvas) return 0;
    const rect = this.canvas.getBoundingClientRect?.();
    const css = Math.max(160, Math.round(rect?.width || this.canvas.clientWidth || 544));
    this.dpr = Math.min(2.5, Math.max(1, globalThis.devicePixelRatio || 1));
    this.size = css;
    const px = Math.round(css * this.dpr);
    if (this.canvas.width !== px || this.canvas.height !== px) {
      this.canvas.width = px;
      this.canvas.height = px;
    }
    return px;
  }

  get unit() {
    return (this.size * this.dpr) / GRID;
  }

  /* --------------------------------------------------------------- lifecycle */

  setState(state) {
    this.state = state;
    this.terrainKey = null;
    this.terrainLayer = null;
    this.canopyLayer = null;
    this.particles.length = 0;
    this.traces.length = 0;
    this.rings.length = 0;
    this.flash = 0;
    this.shakeT = 0;
  }

  shake(px) {
    if (this.reduced) return;
    this.shakeMag = Math.max(this.shakeMag, px);
    this.shakeT = Math.max(this.shakeT, 0.22);
  }

  /* ----------------------------------------------------------------- effects */

  handleEvents(events) {
    if (!Array.isArray(events)) return;
    for (const ev of events) {
      switch (ev.type) {
        case "shot":
          if (ev.owner === "player") {
            this.spark(ev.x, ev.y, "#ffe6a8", 5, 60);
            this.shake(1);
          }
          break;
        case "destroy":
          this.debris(ev.c + 0.5, ev.r + 0.5, ev.was === CELL.STEEL ? STEEL.top : BRICK.top);
          break;
        case "hit":
          this.spark(ev.x + 1, ev.y + 1, "#ffd489", 7, 90);
          break;
        case "kill":
          this.boom(ev.x + 1, ev.y + 1, ev.kind);
          this.shake(2);
          break;
        case "playerDown":
          this.boom(ev.x + 1, ev.y + 1, "player");
          this.shake(3);
          break;
        case "ricochet":
          this.trace(ev);
          this.spark(ev.x, ev.y, "#eaf6ff", 9, 130);
          break;
        case "spent":
          this.spark(ev.x, ev.y, ev.steel ? "#cfe0ea" : "#e6c9a0", 4, 50);
          break;
        case "baseHit":
          this.flash = 0.7;
          this.shake(3);
          this.boom(ev.x + 1, ev.y + 1, "base");
          break;
        case "pickup":
          this.ring(ev.x + 1, ev.y + 1, "#ffdf8a");
          break;
        case "barrage":
          this.ring(ev.x, ev.y, "#ffb066");
          this.shake(2);
          break;
        case "spawn":
          this.ring(ev.x + 1, ev.y + 1, "#ffffff");
          break;
        default:
          break;
      }
    }
  }

  spark(x, y, color, count, speed) {
    if (this.reduced) return;
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v * 0.01,
        vy: Math.sin(a) * v * 0.01,
        life: 0.22 + Math.random() * 0.2,
        max: 0.42,
        r: 0.06 + Math.random() * 0.08,
        color,
      });
    }
  }

  debris(x, y, color) {
    if (this.reduced) return;
    for (let i = 0; i < 8; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 90;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v * 0.01,
        vy: Math.sin(a) * v * 0.01 - 0.03,
        life: 0.4 + Math.random() * 0.3,
        max: 0.7,
        r: 0.08 + Math.random() * 0.1,
        color,
      });
    }
  }

  boom(x, y, kind) {
    if (this.reduced) return;
    const warm = kind === "player" || kind === "base";
    this.spark(x, y, warm ? "#ffb15c" : "#ffd489", 16, 160);
    for (let i = 0; i < 7; i += 1) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 0.8,
        y: y + (Math.random() - 0.5) * 0.8,
        vx: (Math.random() - 0.5) * 0.06,
        vy: -0.05 - Math.random() * 0.06,
        life: 0.5 + Math.random() * 0.5,
        max: 1,
        r: 0.3 + Math.random() * 0.35,
        color: "#6d6157",
        smoke: true,
      });
    }
    this.rings.push({ x, y, r: 0.2, max: 2.2, life: 0.35, maxLife: 0.35, color: warm ? "#ff9a4d" : "#ffe3a0" });
  }

  ring(x, y, color) {
    this.rings.push({ x, y, r: 0.2, max: 1.6, life: 0.3, maxLife: 0.3, color });
  }

  // A bounce leaves a 0.25 s dashed ghost of where the shell actually went.
  trace(ev) {
    if (ev.mode === "deflect" || ev.mode === "bounce") {
      this.traces.push({ x: ev.x, y: ev.y, dir: ev.dir, life: 0.25, max: 0.25 });
    }
  }

  /* -------------------------------------------------------------------- step */

  update(dtMs) {
    const dt = Math.min(0.05, Math.max(0, Number(dtMs) / 1000 || 0));
    this.t += dt;
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      if (p.smoke) p.vy -= 0.002 * dt * 60;
      else p.vy += 0.006 * dt * 60;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
    for (let i = this.traces.length - 1; i >= 0; i -= 1) {
      this.traces[i].life -= dt;
      if (this.traces[i].life <= 0) this.traces.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i -= 1) {
      const r = this.rings[i];
      r.life -= dt;
      r.r += (r.max - r.r) * Math.min(1, dt * 8);
      if (r.life <= 0) this.rings.splice(i, 1);
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      if (this.shakeT <= 0) this.shakeMag = 0;
    }
  }

  /* -------------------------------------------------------------------- draw */

  draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const px = this.size * this.dpr;
    ctx.clearRect(0, 0, px, px);
    ctx.save();
    if (this.shakeT > 0 && this.shakeMag > 0) {
      const m = this.shakeMag * this.dpr;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    this.drawSand(ctx, px);
    if (this.state) {
      this.drawTerrain(ctx);
      this.drawBase(ctx);
      this.drawDrops(ctx);
      this.drawTanks(ctx);
      this.drawCanopy(ctx);
      this.drawShells(ctx);
      this.drawTraces(ctx);
      this.drawAimLines(ctx);
    }
    this.drawRings(ctx);
    this.drawParticles(ctx);
    ctx.restore();
    if (this.flash > 0) {
      ctx.fillStyle = withAlpha("#ff3b30", Math.min(0.5, this.flash * 0.6));
      ctx.fillRect(0, 0, px, px);
    }
  }

  // The sand grain never changes, so it is baked once per canvas size instead of
  // being re-painted thousands of times per second.
  buildSand(px) {
    if (typeof document === "undefined") return null;
    const off = document.createElement("canvas");
    off.width = px;
    off.height = px;
    const c = off.getContext?.("2d");
    if (!c) return null;
    const g = c.createLinearGradient(0, 0, 0, px);
    g.addColorStop(0, SAND);
    g.addColorStop(1, SAND_DARK);
    c.fillStyle = g;
    c.fillRect(0, 0, px, px);
    c.fillStyle = withAlpha("#8a6f45", 0.16);
    const step = Math.max(4, Math.round(this.unit));
    for (let y = 0; y < px; y += step) {
      for (let x = ((y / step) % 2) * (step / 2); x < px; x += step) {
        c.fillRect(x, y, Math.max(1, this.dpr), Math.max(1, this.dpr));
      }
    }
    this.sandTile = off;
    this.sandTileSize = px;
    return off;
  }

  drawSand(ctx, px) {
    if (!this.sandTile || this.sandTileSize !== px) {
      if (!this.buildSand(px)) {
        ctx.fillStyle = SAND;
        ctx.fillRect(0, 0, px, px);
      }
    }
    if (this.sandTile) ctx.drawImage(this.sandTile, 0, 0);
    // sunken tray: inner shadow along the four walls
    const inset = this.unit * 0.9;
    const edges = [
      [0, 0, px, inset, 0, 1],
      [0, px - inset, px, inset, 0, -1],
      [0, 0, inset, px, 1, 0],
      [px - inset, 0, inset, px, -1, 0],
    ];
    for (const [x, y, w, h, ,] of edges) {
      const gg = ctx.createLinearGradient(x, y, x + (w > h ? w : 0), y + (h > w ? h : 0));
      gg.addColorStop(0, withAlpha("#5d4a2e", 0.34));
      gg.addColorStop(1, "rgba(93,74,46,0)");
      ctx.fillStyle = gg;
      ctx.fillRect(x, y, w, h);
    }
    ctx.strokeStyle = withAlpha(SAND_EDGE, 0.5);
    ctx.lineWidth = Math.max(1, this.dpr);
    ctx.strokeRect(0.5, 0.5, px - 1, px - 1);
  }

  // Each terrain piece reads as a model on the tray: lit top face, darker side, cast
  // shadow. Static pieces are baked into a layer and only rebuilt when the grid changes.
  drawTerrain(ctx) {
    const st = this.state;
    const px = this.size * this.dpr;
    const key = `${px}|${st.levelId}|${st.grid.join("")}`;
    if (!this.terrainLayer || this.terrainKey !== key) {
      this.buildTerrain(px, key);
      this.buildCanopy(px);
    }
    if (this.terrainLayer) ctx.drawImage(this.terrainLayer, 0, 0);
    else this.paintTerrain(ctx);
    // water keeps breathing, so it is painted live
    const u = this.unit;
    for (let r = 0; r < GRID; r += 1) {
      for (let c = 0; c < GRID; c += 1) {
        if (st.grid[r * GRID + c] === CELL.WATER) this.drawWater(ctx, c * u, r * u, u);
      }
    }
  }

  buildTerrain(px, key) {
    if (typeof document === "undefined") return;
    const off = document.createElement("canvas");
    off.width = px;
    off.height = px;
    const c = off.getContext?.("2d");
    if (!c) return;
    this.paintTerrain(c, true);
    this.terrainLayer = off;
    this.terrainKey = key;
  }

  paintTerrain(ctx) {
    const st = this.state;
    const u = this.unit;
    for (let r = 0; r < GRID; r += 1) {
      for (let c = 0; c < GRID; c += 1) {
        const v = st.grid[r * GRID + c];
        if (v === CELL.EMPTY || v === CELL.WATER) continue;
        const x = c * u;
        const y = r * u;
        if (v === CELL.BRICK) this.drawBrick(ctx, x, y, u);
        else if (v === CELL.STEEL) this.drawSteel(ctx, x, y, u);
        else if (v === CELL.ICE) this.drawIce(ctx, x, y, u);
      }
    }
  }

  // Bushes float above whatever drives under them, so the canopy is its own baked layer.
  buildCanopy(px) {
    if (typeof document === "undefined") return;
    const off = document.createElement("canvas");
    off.width = px;
    off.height = px;
    const c = off.getContext?.("2d");
    if (!c) return;
    const st = this.state;
    const u = this.unit;
    for (let r = 0; r < GRID; r += 1) {
      for (let c2 = 0; c2 < GRID; c2 += 1) {
        if (st.grid[r * GRID + c2] === CELL.TREE) this.drawTree(c, c2 * u, r * u, u);
      }
    }
    this.canopyLayer = off;
  }

  drawCanopy(ctx) {
    if (this.canopyLayer) ctx.drawImage(this.canopyLayer, 0, 0);
  }

  drawBrick(ctx, x, y, u) {
    ctx.fillStyle = withAlpha("#5d4a2e", 0.35);
    ctx.fillRect(x + u * 0.12, y + u * 0.18, u, u);
    ctx.fillStyle = BRICK.face;
    ctx.fillRect(x, y, u, u);
    ctx.fillStyle = BRICK.top;
    ctx.fillRect(x, y, u, u * 0.34);
    ctx.fillStyle = BRICK.dark;
    ctx.fillRect(x, y + u * 0.78, u, u * 0.22);
    ctx.fillStyle = BRICK.mortar;
    ctx.fillRect(x + u * 0.42, y + u * 0.34, Math.max(1, u * 0.08), u * 0.44);
  }

  drawSteel(ctx, x, y, u) {
    ctx.fillStyle = withAlpha("#3f4a55", 0.4);
    ctx.fillRect(x + u * 0.1, y + u * 0.16, u, u);
    const g = ctx.createLinearGradient(x, y, x + u, y + u);
    g.addColorStop(0, STEEL.top);
    g.addColorStop(0.55, STEEL.face);
    g.addColorStop(1, STEEL.dark);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, u, u);
    ctx.fillStyle = STEEL.rivet;
    const rr = Math.max(0.6, u * 0.09);
    for (const [dx, dy] of [
      [0.22, 0.22],
      [0.78, 0.22],
      [0.22, 0.78],
      [0.78, 0.78],
    ]) {
      ctx.beginPath();
      ctx.arc(x + u * dx, y + u * dy, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawWater(ctx, x, y, u) {
    ctx.fillStyle = withAlpha(WATER.body, 0.82);
    ctx.fillRect(x, y, u, u);
    ctx.fillStyle = withAlpha(WATER.gloss, 0.5);
    const band = (this.t * 0.5) % 1;
    ctx.fillRect(x, y + u * band * 0.7, u, Math.max(1, u * 0.12));
  }

  drawIce(ctx, x, y, u) {
    ctx.fillStyle = ICE.body;
    ctx.fillRect(x, y, u, u);
    ctx.strokeStyle = withAlpha(ICE.gloss, 0.9);
    ctx.lineWidth = Math.max(1, u * 0.08);
    ctx.beginPath();
    ctx.moveTo(x + u * 0.15, y + u * 0.75);
    ctx.lineTo(x + u * 0.45, y + u * 0.35);
    ctx.lineTo(x + u * 0.85, y + u * 0.55);
    ctx.stroke();
  }

  drawTree(ctx, x, y, u) {
    ctx.fillStyle = TREE.leafDark;
    ctx.beginPath();
    ctx.arc(x + u * 0.5, y + u * 0.55, u * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = TREE.leaf;
    for (const [dx, dy, rr] of [
      [0.32, 0.34, 0.26],
      [0.68, 0.36, 0.24],
      [0.5, 0.66, 0.28],
    ]) {
      ctx.beginPath();
      ctx.arc(x + u * dx, y + u * dy, u * rr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBase(ctx) {
    const st = this.state;
    const u = this.unit;
    const b = st.base;
    const x = b.hx * u;
    const y = b.hy * u;
    const w = TANK_SIZE * u;
    const dead = b.hp <= 0;
    const cx = x + w / 2;
    const cy = y + w / 2;

    ctx.fillStyle = withAlpha("#3b3026", 0.4);
    ctx.fillRect(x + u * 0.12, y + u * 0.2, w, w);

    const g = ctx.createRadialGradient(cx - w * 0.2, cy - w * 0.25, w * 0.1, cx, cy, w * 0.8);
    if (dead) {
      g.addColorStop(0, BASE.dead);
      g.addColorStop(1, "#3f362e");
    } else {
      g.addColorStop(0, "#f0d58a");
      g.addColorStop(0.6, BASE.brass);
      g.addColorStop(1, BASE.brassDark);
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.46, 0, Math.PI * 2);
    ctx.fill();

    if (!dead) {
      // eagle chevron
      ctx.fillStyle = "#6b4f1c";
      ctx.beginPath();
      ctx.moveTo(cx, cy - w * 0.24);
      ctx.lineTo(cx + w * 0.22, cy + w * 0.06);
      ctx.lineTo(cx, cy + w * 0.02);
      ctx.lineTo(cx - w * 0.22, cy + w * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.24, cy + w * 0.18);
      ctx.lineTo(cx + w * 0.24, cy + w * 0.18);
      ctx.lineTo(cx, cy + w * 0.3);
      ctx.closePath();
      ctx.fill();
      // three rivets = the three points of structure
      for (let i = 0; i < b.maxHp; i += 1) {
        const a = -Math.PI / 2 + (i - 1) * 0.9;
        const rx = cx + Math.cos(a) * w * 0.58;
        const ry = cy + Math.sin(a) * w * 0.58;
        ctx.fillStyle = i < b.hp ? "#ffe9a8" : "#5c5346";
        ctx.beginPath();
        ctx.arc(rx, ry, Math.max(1.2, u * 0.14), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawDrops(ctx) {
    const st = this.state;
    const u = this.unit;
    for (const d of st.drops) {
      const x = d.hx * u;
      const y = d.hy * u;
      const w = TANK_SIZE * u;
      const blink = d.ttl < 5 && Math.floor(d.ttl * 6) % 2 === 0;
      if (blink) continue;
      const glow = 0.35 + 0.25 * Math.sin(this.t * 6);
      ctx.fillStyle = withAlpha("#ffdf8a", glow * 0.5);
      ctx.beginPath();
      ctx.arc(x + w / 2, y + w / 2, w * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8d6b2f";
      ctx.fillRect(x + w * 0.1, y + w * 0.1, w * 0.8, w * 0.8);
      ctx.fillStyle = "#f4d98d";
      ctx.fillRect(x + w * 0.18, y + w * 0.18, w * 0.64, w * 0.64);
      this.drawDropGlyph(ctx, d.kind, x, y, w);
    }
  }

  drawDropGlyph(ctx, kind, x, y, w) {
    const cx = x + w / 2;
    const cy = y + w / 2;
    ctx.fillStyle = "#7a4c1f";
    ctx.strokeStyle = "#7a4c1f";
    ctx.lineWidth = Math.max(1, w * 0.09);
    if (kind === "star") {
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? w * 0.3 : w * 0.14;
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else if (kind === "helmet" || kind === "clock") {
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.24, 0, Math.PI * 2);
      ctx.stroke();
      if (kind === "clock") {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy - w * 0.18);
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + w * 0.12, cy + w * 0.06);
        ctx.stroke();
      }
    } else if (kind === "grenade") {
      ctx.beginPath();
      ctx.arc(cx, cy + w * 0.06, w * 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "shovel") {
      ctx.fillRect(cx - w * 0.06, cy - w * 0.26, w * 0.12, w * 0.34);
      ctx.fillRect(cx - w * 0.16, cy + w * 0.06, w * 0.32, w * 0.16);
    } else {
      ctx.beginPath();
      ctx.moveTo(cx, cy - w * 0.26);
      ctx.lineTo(cx + w * 0.2, cy);
      ctx.lineTo(cx, cy + w * 0.26);
      ctx.lineTo(cx - w * 0.2, cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawTanks(ctx) {
    const st = this.state;
    const u = this.unit;
    for (const e of st.enemies) {
      const spec = ENEMY_TYPES[e.type] ?? ENEMY_TYPES.standard;
      this.drawTank(ctx, e, skinFor(e.type), u, {
        spawn: e.spawnT > 0,
        hpRatio: Math.max(0, e.hp / spec.hp),
        flashBonus: e.bonus,
      });
    }
    const p = st.player;
    if (p.alive) {
      this.drawTank(ctx, p, PLAYER_SKIN, u, {
        spawn: false,
        hpRatio: 1,
        player: true,
        star: p.star,
        blink: p.graceT > 0 && Math.floor(p.graceT * 8) % 2 === 0,
        shield: p.shieldT > 0,
      });
    }
  }

  drawTank(ctx, ent, skin, u, opts = {}) {
    const x = ent.x * u;
    const y = ent.y * u;
    const w = TANK_SIZE * u;
    if (opts.spawn) {
      const k = 0.4 + 0.6 * Math.abs(Math.sin(this.t * 18));
      ctx.fillStyle = withAlpha("#ffffff", 0.5 * k);
      ctx.beginPath();
      ctx.arc(x + w / 2, y + w / 2, w * 0.75, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (opts.blink && Math.floor(this.t * 12) % 2 === 0) return;

    ctx.fillStyle = withAlpha("#3b3026", 0.42);
    ctx.fillRect(x + u * 0.14, y + u * 0.22, w, w);

    // treads
    ctx.fillStyle = skin.tread;
    ctx.fillRect(x, y + u * 0.1, u * 0.5, w - u * 0.2);
    ctx.fillRect(x + w - u * 0.5, y + u * 0.1, u * 0.5, w - u * 0.2);

    // hull
    const g = ctx.createLinearGradient(x, y, x + w, y + w);
    g.addColorStop(0, skin.top);
    g.addColorStop(1, skin.body);
    ctx.fillStyle = g;
    ctx.fillRect(x + u * 0.42, y + u * 0.42, w - u * 0.84, w - u * 0.84);

    // turret + barrel
    const cx = x + w / 2;
    const cy = y + w / 2;
    // the barrel is drawn pointing up and rotated, so it always matches the heading
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((ent.dir * Math.PI) / 2);
    ctx.fillStyle = skin.tread;
    ctx.fillRect(-u * 0.15, -w * 0.5, u * 0.3, w * 0.55);
    ctx.restore();
    ctx.fillStyle = skin.top;
    ctx.beginPath();
    ctx.arc(cx, cy, u * 0.42, 0, Math.PI * 2);
    ctx.fill();

    // armour darkens as it takes damage
    if (opts.hpRatio !== undefined && opts.hpRatio < 1) {
      ctx.fillStyle = withAlpha("#ffffff", 0.16 + 0.34 * (1 - opts.hpRatio));
      ctx.fillRect(x + u * 0.42, y + u * 0.42, w - u * 0.84, w - u * 0.84);
    }
    if (opts.flashBonus) {
      ctx.strokeStyle = withAlpha("#ffdf8a", 0.6 + 0.3 * Math.sin(this.t * 8));
      ctx.lineWidth = Math.max(1, u * 0.1);
      ctx.strokeRect(x + u * 0.3, y + u * 0.3, w - u * 0.6, w - u * 0.6);
    }
    if (opts.star) {
      ctx.fillStyle = "#ffe9a8";
      for (let i = 0; i < opts.star; i += 1) {
        ctx.beginPath();
        ctx.arc(x + u * 0.5 + i * u * 0.34, y + w - u * 0.16, Math.max(1, u * 0.1), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (opts.shield) {
      ctx.strokeStyle = withAlpha("#8fe3ff", 0.75);
      ctx.lineWidth = Math.max(1, u * 0.14);
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.66, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawShells(ctx) {
    const st = this.state;
    const u = this.unit;
    for (const s of st.shells) {
      const x = s.x * u;
      const y = s.y * u;
      const r = Math.max(1.4, u * 0.2);
      const color = s.owner === "player" ? "#fff3c4" : "#ffd0c0";
      ctx.fillStyle = withAlpha(color, 0.35);
      ctx.beginPath();
      ctx.arc(x - DX[s.dir] * u * 0.5, y - DY[s.dir] * u * 0.5, r * 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.bounced ? "#bfefff" : color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = withAlpha("#ffffff", 0.8);
      ctx.beginPath();
      ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (this.hints) this.drawBounceHints(ctx);
  }

  // With hints on, a player shell shows where it will deflect before it gets there.
  drawBounceHints(ctx) {
    const st = this.state;
    const u = this.unit;
    for (const s of st.shells) {
      if (s.owner !== "player" || s.bounced) continue;
      const path = this.predictBounce(s);
      if (!path) continue;
      ctx.save();
      ctx.setLineDash([Math.max(2, u * 0.25), Math.max(2, u * 0.25)]);
      ctx.strokeStyle = withAlpha("#bfefff", 0.55);
      ctx.lineWidth = Math.max(1, u * 0.1);
      ctx.beginPath();
      ctx.moveTo(path.x * u, path.y * u);
      ctx.lineTo((path.x + DX[path.dir] * path.len) * u, (path.y + DY[path.dir] * path.len) * u);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Walks the shell forward; returns the deflection point, the new heading and the free run.
  predictBounce(s) {
    const st = this.state;
    let c = Math.floor(s.x);
    let r = Math.floor(s.y);
    let dir = s.dir;
    for (let step = 0; step < 60; step += 1) {
      const nc = c + DX[dir];
      const nr = r + DY[dir];
      if (nc < 0 || nc >= GRID || nr < 0 || nr >= GRID) return null;
      const v = st.grid[nr * GRID + nc];
      if (v === CELL.BRICK) return null;
      if (v === CELL.STEEL) {
        const horiz = dir === DIR.LEFT || dir === DIR.RIGHT;
        const a = horiz ? { c: nc, r: nr - 1 } : { c: nc - 1, r: nr };
        const b = horiz ? { c: nc, r: nr + 1 } : { c: nc + 1, r: nr };
        const openA = free(st, a.c, a.r);
        const openB = free(st, b.c, b.r);
        let nd;
        if (!openA && !openB) return null;
        if (openA && openB) nd = (dir + 2) % 4;
        else nd = horiz ? (openA ? DIR.UP : DIR.DOWN) : openA ? DIR.LEFT : DIR.RIGHT;
        return { x: nc + 0.5, y: nr + 0.5, dir: nd, len: this.freeRun(nc, nr, nd) };
      }
      c = nc;
      r = nr;
    }
    return null;
  }

  freeRun(c, r, dir) {
    const st = this.state;
    for (let i = 1; i <= 20; i += 1) {
      const nc = c + DX[dir] * i;
      const nr = r + DY[dir] * i;
      if (nc < 0 || nc >= GRID || nr < 0 || nr >= GRID) return i;
      const v = st.grid[nr * GRID + nc];
      if (v === CELL.BRICK || v === CELL.STEEL) return i;
    }
    return 20;
  }

  drawTraces(ctx) {
    const u = this.unit;
    for (const tr of this.traces) {
      const k = tr.life / tr.max;
      ctx.save();
      ctx.setLineDash([Math.max(2, u * 0.3), Math.max(2, u * 0.2)]);
      ctx.strokeStyle = withAlpha("#dff4ff", 0.7 * k);
      ctx.lineWidth = Math.max(1, u * 0.12);
      ctx.beginPath();
      ctx.moveTo(tr.x * u, tr.y * u);
      ctx.lineTo((tr.x + DX[tr.dir] * 3) * u, (tr.y + DY[tr.dir] * 3) * u);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawAimLines(ctx) {
    const st = this.state;
    const u = this.unit;
    for (const e of st.enemies) {
      if (!e.aiming || e.spawnT > 0) continue;
      const x = (e.x + 1) * u;
      const y = (e.y + 1) * u;
      const k = e.aimT > 0 ? Math.min(1, e.aimT / 0.5) : 0.4;
      ctx.strokeStyle = withAlpha("#ff5a4a", 0.25 + 0.45 * k);
      ctx.lineWidth = Math.max(1, u * 0.07);
      ctx.setLineDash([u * 0.4, u * 0.3]);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + DX[e.dir] * u * 26, y + DY[e.dir] * u * 26);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawRings(ctx) {
    const u = this.unit;
    for (const r of this.rings) {
      const k = r.life / r.maxLife;
      ctx.strokeStyle = withAlpha(r.color, 0.6 * k);
      ctx.lineWidth = Math.max(1, u * 0.12);
      ctx.beginPath();
      ctx.arc(r.x * u, r.y * u, r.r * u, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawParticles(ctx) {
    const u = this.unit;
    for (const p of this.particles) {
      const k = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.smoke ? withAlpha(p.color, 0.35 * k) : withAlpha(p.color, Math.min(1, k * 1.4));
      ctx.beginPath();
      ctx.arc(p.x * u, p.y * u, Math.max(0.5, p.r * u), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function free(state, c, r) {
  if (c < 0 || c >= GRID || r < 0 || r >= GRID) return false;
  const v = state.grid[r * GRID + c];
  return v === CELL.EMPTY || v === CELL.TREE || v === CELL.WATER || v === CELL.ICE;
}
