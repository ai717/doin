// Canvas 2D renderer: wooden cutting board, height-map soap bar, falling curls, blade.
// Static board is cached offscreen; only the bar/particles/blade redraw each frame.

import { GRID_W, GRID_H } from "./soaps.mjs";
import { CORE_EXPOSE_DEPTH } from "./engine.mjs";

const TAU = Math.PI * 2;
const MAX_PARTICLES = 140;

function hexToRgb(hex) {
  const value = String(hex).replace("#", "");
  const n = parseInt(value.length === 3 ? value.split("").map((c) => c + c).join("") : value, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mix(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `rgb(${Math.round(ca.r + (cb.r - ca.r) * t)},${Math.round(ca.g + (cb.g - ca.g) * t)},${Math.round(ca.b + (cb.b - ca.b) * t)})`;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function createUI(canvas) {
  const ctx = canvas.getContext("2d");
  let width = 1;
  let height = 1;
  let dpr = 1;
  let boardCache = null;
  let particles = [];
  let geometry = null;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    computeGeometry();
    boardCache = null;
  }

  function computeGeometry() {
    const padX = Math.max(18, width * 0.09);
    const padTop = Math.max(24, height * 0.14);
    const padBottom = Math.max(34, height * 0.16);
    const cellW = (width - padX * 2) / GRID_W;
    const cellH = (height - padTop - padBottom) / GRID_H;
    geometry = { padX, padTop, padBottom, cellW, cellH };
  }

  function cellCenter(x, y) {
    const g = geometry;
    return { x: g.padX + (x + 0.5) * g.cellW, y: g.padTop + (y + 0.5) * g.cellH };
  }

  function pointerToCell(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return {
      x: (x - geometry.padX) / geometry.cellW - 0.5,
      y: (y - geometry.padTop) / geometry.cellH - 0.5,
      px: x,
      py: y,
    };
  }

  function paintBoard() {
    if (boardCache) return boardCache;
    const off = document.createElement("canvas");
    off.width = Math.max(1, Math.round(width * dpr));
    off.height = Math.max(1, Math.round(height * dpr));
    const c = off.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grad = c.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, "#3a2a21");
    grad.addColorStop(0.5, "#5a4130");
    grad.addColorStop(1, "#38271e");
    c.fillStyle = grad;
    c.fillRect(0, 0, width, height);
    const plank = Math.max(46, height / 5);
    for (let y = 0; y < height; y += plank) {
      c.fillStyle = "rgba(0,0,0,0.10)";
      c.fillRect(0, y, width, 2);
      c.fillStyle = "rgba(255,225,190,0.045)";
      c.fillRect(0, y + 3, width, 1);
      for (let i = 0; i < 6; i += 1) {
        const gx = ((i * 97 + y * 31) % Math.max(1, width - 40)) + 20;
        c.strokeStyle = "rgba(0,0,0,0.055)";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(gx, y + 6);
        c.bezierCurveTo(gx + 12, y + plank * 0.3, gx - 10, y + plank * 0.7, gx + 6, y + plank - 6);
        c.stroke();
      }
    }
    const glow = c.createRadialGradient(width / 2, height * 0.4, 10, width / 2, height * 0.4, Math.max(width, height) * 0.62);
    glow.addColorStop(0, "rgba(255,238,214,0.10)");
    glow.addColorStop(1, "rgba(0,0,0,0.18)");
    c.fillStyle = glow;
    c.fillRect(0, 0, width, height);
    boardCache = off;
    return off;
  }

  function spawnChips(chips, view) {
    if (!chips || !chips.length) return;
    const def = view.soap;
    for (const chip of chips) {
      if (particles.length >= MAX_PARTICLES) particles.shift();
      const center = cellCenter(chip.x, chip.y);
      const scatter = chip.scatter ?? 0.5;
      particles.push({
        x: center.x + (scatter - 0.5) * geometry.cellW * 0.6,
        y: center.y + (Math.random() - 0.5) * geometry.cellH * 0.4,
        vx: (scatter - 0.5) * 52 + (Math.random() - 0.5) * 26,
        vy: -30 - Math.random() * 46 - chip.depth * 18,
        rot: Math.random() * TAU,
        spin: (Math.random() - 0.5) * 7,
        life: 1,
        style: chip.style,
        size: Math.max(4, Math.min(geometry.cellW, geometry.cellH) * (0.25 + chip.depth * 0.22)),
        tint: def.tint,
        accent: def.accent,
        settled: false,
      });
    }
  }

  function stepParticles(dt) {
    const step = Math.min(0.05, dt);
    for (const p of particles) {
      if (p.settled) {
        p.life -= step * 0.35;
        continue;
      }
      p.vy += 420 * step;
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.rot += p.spin * step;
      if (p.y > height - geometry.padBottom * 0.35) {
        p.y = height - geometry.padBottom * 0.35;
        p.vy = 0;
        p.vx *= 0.4;
        p.settled = true;
      }
    }
    particles = particles.filter((p) => p.life > 0);
  }

  function drawSoap(view) {
    const g = geometry;
    const state = view.state;
    const def = view.soap;
    const layers = Math.max(1, state.layers);
    const shadow = ctx.createLinearGradient(0, g.padTop - 10, 0, g.padTop + GRID_H * g.cellH + 20);
    shadow.addColorStop(0, "rgba(0,0,0,0.32)");
    shadow.addColorStop(1, "rgba(0,0,0,0.05)");
    ctx.fillStyle = shadow;
    roundRect(ctx, g.padX - 8, g.padTop - 6, GRID_W * g.cellW + 16, GRID_H * g.cellH + 14, 18);
    ctx.fill();

    for (let y = 0; y < GRID_H; y += 1) {
      for (let x = 0; x < GRID_W; x += 1) {
        const index = y * GRID_W + x;
        const depth = state.cells[index];
        if (depth <= 0.02) continue;
        const ratio = Math.max(0, Math.min(1, depth / layers));
        const px = g.padX + x * g.cellW;
        const py = g.padTop + y * g.cellH;
        const lift = ratio * Math.min(9, g.cellH * 0.16);
        const isCore = state.core[index] === 1 && depth <= CORE_EXPOSE_DEPTH;

        ctx.fillStyle = mix("#000000", def.accent, 0.28 + ratio * 0.2);
        roundRect(ctx, px + 1, py + 3 + lift * 0.5, g.cellW - 2, g.cellH - 2, Math.min(7, g.cellW * 0.16));
        ctx.fill();

        const face = isCore ? mix(def.accent, "#fff4d6", 0.42) : mix(def.tint, "#ffffff", 0.06 + ratio * 0.30);
        ctx.fillStyle = face;
        roundRect(ctx, px + 1, py + 1 - lift, g.cellW - 2, g.cellH - 3, Math.min(7, g.cellW * 0.16));
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.20)";
        roundRect(ctx, px + 3, py + 2 - lift, g.cellW - 6, Math.max(1, g.cellH * 0.12), 2);
        ctx.fill();

        if (isCore) {
          ctx.strokeStyle = "rgba(255,248,214,0.55)";
          ctx.lineWidth = 1;
          roundRect(ctx, px + 2, py + 2 - lift, g.cellW - 4, g.cellH - 5, 5);
          ctx.stroke();
        }
      }
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      if (p.style === "flake") {
        ctx.fillStyle = mix(p.tint, "#ffffff", 0.2);
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
      } else {
        ctx.fillStyle = mix(p.tint, "#ffffff", 0.34);
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.5, 0.2, Math.PI * 1.55);
        ctx.lineTo(p.size * 0.36, p.size * 0.42);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawBlade(pointer, view, cutting) {
    if (!pointer || !pointer.visible) return;
    const x = pointer.px;
    const y = pointer.py;
    const angle = Number.isFinite(pointer.angle) ? pointer.angle : -0.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const len = Math.max(34, Math.min(64, width * 0.09));
    if (cutting) {
      const glow = ctx.createRadialGradient(-len * 0.2, 0, 2, -len * 0.2, 0, len * 0.7);
      glow.addColorStop(0, "rgba(255,255,255,0.30)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(-len, -len * 0.7, len * 2, len * 1.4);
    }
    ctx.fillStyle = view.toolId === "tool_scraper" ? "#8b6a48" : "#6d4c34";
    roundRect(ctx, -len * 0.12, -5, len * 0.52, 10, 4);
    ctx.fill();
    const steel = ctx.createLinearGradient(0, -6, 0, 6);
    steel.addColorStop(0, "#f4f7fa");
    steel.addColorStop(0.5, "#b9c3cc");
    steel.addColorStop(1, "#79848e");
    ctx.fillStyle = steel;
    ctx.beginPath();
    ctx.moveTo(len * 0.4, -6);
    ctx.lineTo(len, -2.5);
    ctx.lineTo(len, 2.5);
    ctx.lineTo(len * 0.4, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function draw(view, pointer, cutting, dt = 0) {
    if (!geometry) computeGeometry();
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(paintBoard(), 0, 0, width, height);
    drawSoap(view);
    if (!view.paused) stepParticles(dt);
    drawParticles();
    drawBlade(pointer, view, cutting && !view.paused);
  }

  function clearParticles() {
    particles = [];
  }

  resize();
  return { resize, draw, spawnChips, clearParticles, pointerToCell, cellCenter, get geometry() { return geometry; } };
}
