// Canvas 2D renderer. The background and the clean object are cached offscreen;
// the grime and wet film are rebuilt in small ImageData buffers each frame.
// Water is a full emitter: fixed gun at the top right -> layered conical stream
// -> rolling highlights -> impact ring -> ballistic droplets. No external assets.

import { GRID_W, GRID_H } from "./engine.mjs";
import { objectPath, drawObject } from "./art.mjs";

const TAU = Math.PI * 2;
const MAX_PARTICLES = 320;
const STAIN_W = GRID_W * 2;
const STAIN_H = GRID_H * 2;

const DUST = [168, 160, 146];
const GREASE = [92, 62, 38];
const STUBBORN = [38, 34, 30];

function hashNoise(i) {
  let h = (i * 374761393 + 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function createUI(canvas) {
  const ctx = canvas.getContext("2d");
  let width = 1;
  let height = 1;
  let dpr = 1;
  let rect = { x: 0, y: 0, w: 1, h: 1 };
  let bgCache = null;
  let baseCache = null;
  let cacheKey = "";
  let stainCanvas = null;
  let stainCtx = null;
  let stainImage = null;
  let wetCanvas = null;
  let wetCtx = null;
  let wetImage = null;
  let wet = new Float32Array(GRID_W * GRID_H);
  let particles = [];
  let pointer = null;
  let trail = [];
  let spray = false;
  let tool = "tool_jet";
  let nozzle = "narrow";
  let reduced = false;
  let clock = 0;

  function resize() {
    const box = canvas.getBoundingClientRect();
    dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    width = Math.max(1, Math.round(box.width));
    height = Math.max(1, Math.round(box.height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const padX = Math.max(26, width * 0.10);
    const padTop = Math.max(20, height * 0.08);
    const padBottom = Math.max(24, height * 0.08);
    const availW = width - padX * 2;
    const availH = height - padTop - padBottom;
    const shapeAspect = 1.6;
    let w = availW;
    let h = w / shapeAspect;
    if (h > availH) { h = availH; w = h * shapeAspect; }
    rect = { x: (width - w) / 2, y: padTop + (availH - h) / 2, w, h };
    bgCache = null;
    baseCache = null;
    cacheKey = "";
    try {
      reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    } catch (error) { reduced = false; }
  }

  function pointerToNorm(clientX, clientY) {
    const box = canvas.getBoundingClientRect();
    return {
      x: (clientX - box.left - rect.x) / rect.w,
      y: (clientY - box.top - rect.y) / rect.h,
    };
  }

  function paintBackground() {
    if (bgCache) return bgCache;
    const off = document.createElement("canvas");
    off.width = Math.max(1, Math.round(width * dpr));
    off.height = Math.max(1, Math.round(height * dpr));
    const c = off.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    const wall = c.createLinearGradient(0, 0, 0, height);
    wall.addColorStop(0, "#c6edf4");
    wall.addColorStop(0.60, "#93ccd8");
    wall.addColorStop(1, "#5c9cad");
    c.fillStyle = wall;
    c.fillRect(0, 0, width, height);

    const tile = Math.max(34, width / 16);
    c.strokeStyle = "rgba(255,255,255,0.24)";
    c.lineWidth = 1;
    for (let x = 0; x <= width; x += tile) {
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, height); c.stroke();
    }
    for (let y = 0; y <= height; y += tile) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(width, y); c.stroke();
    }

    for (const cx of [0.2, 0.8]) {
      const glow = c.createRadialGradient(width * cx, -height * 0.1, 0, width * cx, -height * 0.1, height * 0.9);
      glow.addColorStop(0, "rgba(255,255,255,0.46)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = glow;
      c.fillRect(0, 0, width, height);
    }

    const ledgeY = rect.y + rect.h + Math.min(22, height * 0.03);
    const ledge = c.createLinearGradient(0, ledgeY - 6, 0, height);
    ledge.addColorStop(0, "#edf6f7");
    ledge.addColorStop(1, "#9db9bd");
    c.fillStyle = ledge;
    c.fillRect(0, ledgeY, width, height - ledgeY);
    c.strokeStyle = "rgba(40,70,78,0.26)";
    c.beginPath(); c.moveTo(0, ledgeY); c.lineTo(width, ledgeY); c.stroke();

    bgCache = off;
    return off;
  }

  function paintBase(snapshot) {
    const key = `${snapshot.levelId}|${Math.round(width)}x${Math.round(height)}`;
    if (baseCache && cacheKey === key) return baseCache;
    const off = document.createElement("canvas");
    off.width = Math.max(1, Math.round(width * dpr));
    off.height = Math.max(1, Math.round(height * dpr));
    const c = off.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const shape = snapshot.level?.shape ?? "sedan";
    const base = snapshot.state?.base ?? "#5aa9e6";
    drawObject(c, shape, rect, base);
    baseCache = off;
    cacheKey = key;
    return off;
  }

  function ensureLayers() {
    if (stainCanvas) return;
    stainCanvas = document.createElement("canvas");
    stainCanvas.width = STAIN_W; stainCanvas.height = STAIN_H;
    stainCtx = stainCanvas.getContext("2d");
    stainImage = stainCtx.createImageData(STAIN_W, STAIN_H);
    wetCanvas = document.createElement("canvas");
    wetCanvas.width = STAIN_W; wetCanvas.height = STAIN_H;
    wetCtx = wetCanvas.getContext("2d");
    wetImage = wetCtx.createImageData(STAIN_W, STAIN_H);
  }

  function paintGrime(state) {
    ensureLayers();
    const data = stainImage.data;
    const wetData = wetImage.data;
    const scaleX = GRID_W / STAIN_W;
    const scaleY = GRID_H / STAIN_H;
    for (let sy = 0; sy < STAIN_H; sy += 1) {
      const gy = Math.min(GRID_H - 1, Math.floor(sy * scaleY));
      for (let sx = 0; sx < STAIN_W; sx += 1) {
        const gx = Math.min(GRID_W - 1, Math.floor(sx * scaleX));
        const i = gy * GRID_W + gx;
        const p = (sy * STAIN_W + sx) * 4;
        const grain = 0.91 + hashNoise(sy * STAIN_W + sx) * 0.18;
        if (!state.mask[i]) { data[p + 3] = 0; wetData[p + 3] = 0; continue; }
        const d = state.dust[i];
        const g = state.grease[i];
        const s = state.stubborn[i];
        const total = d + g + s;
        const foam = state.foam[i];
        if (total <= 0.0001 && foam <= 0.0001) { data[p + 3] = 0; } else {
          let r = 0; let gr = 0; let b = 0;
          if (total > 0) {
            const wd = d * 0.7;
            const wg = g * 1.25;
            const ws = s * 1.9;
            const weight = wd + wg + ws;
            r = (DUST[0] * wd + GREASE[0] * wg + STUBBORN[0] * ws) / weight;
            gr = (DUST[1] * wd + GREASE[1] * wg + STUBBORN[1] * ws) / weight;
            b = (DUST[2] * wd + GREASE[2] * wg + STUBBORN[2] * ws) / weight;
            r *= grain; gr *= grain; b *= grain;
          }
          if (foam > 0) {
            const f = Math.min(0.92, foam * 0.85);
            r += (248 - r) * f;
            gr += (252 - gr) * f;
            b += (255 - b) * f;
          }
          data[p] = Math.max(0, Math.min(255, r));
          data[p + 1] = Math.max(0, Math.min(255, gr));
          data[p + 2] = Math.max(0, Math.min(255, b));
          data[p + 3] = Math.max(0, Math.min(255, Math.round((Math.min(1, total * 1.15) + foam * 0.34) * 255)));
        }

        // Wet film: a bright, noisy sheen that decays after the jet passes.
        const w = wet[i];
        if (w <= 0.002) { wetData[p + 3] = 0; continue; }
        const sparkle = hashNoise((sy * STAIN_W + sx) ^ 0x5f3a);
        const sheen = w * (0.42 + sparkle * 0.58);
        wetData[p] = 236; wetData[p + 1] = 250; wetData[p + 2] = 255;
        wetData[p + 3] = Math.round(Math.min(1, sheen) * 190);
      }
    }
    stainCtx.putImageData(stainImage, 0, 0);
    wetCtx.putImageData(wetImage, 0, 0);
  }

  function updateWet(dt) {
    const decay = Math.exp(-dt * 0.85);
    for (let i = 0; i < wet.length; i += 1) wet[i] *= decay;
    if (spray && pointer) {
      const gx = Math.floor(pointer.x * GRID_W);
      const gy = Math.floor(pointer.y * GRID_H);
      const radius = nozzle === "wide" ? 3 : 2;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const x = gx + dx; const y = gy + dy;
          if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) continue;
          if (dx * dx + dy * dy > radius * radius) continue;
          const i = y * GRID_W + x;
          wet[i] = Math.min(1, wet[i] + dt * (dx === 0 && dy === 0 ? 7 : 3));
        }
      }
    }
    if (spray && pointer && !reduced) {
      trail.push({ x: pointer.x, y: pointer.y, life: 0 });
      if (trail.length > 8) trail.shift();
    }
    for (const t of trail) t.life += dt;
    trail = trail.filter((t) => t.life < 0.28);
  }

  function gunPoint() {
    return { x: width - Math.min(52, width * 0.09), y: Math.min(38, height * 0.10) };
  }

  function jetColor() {
    if (tool === "tool_foam") return { core: "rgba(255,255,255,0.94)", mid: "rgba(238,250,255,0.55)", mist: "rgba(226,246,255,0.20)" };
    if (tool === "tool_brush") return { core: "rgba(226,206,170,0.80)", mid: "rgba(210,190,150,0.40)", mist: "rgba(190,170,130,0.14)" };
    if (tool === "tool_squeegee") return { core: "rgba(232,252,255,0.86)", mid: "rgba(196,238,250,0.46)", mist: "rgba(180,228,242,0.16)" };
    return { core: "rgba(226,248,255,0.92)", mid: "rgba(178,232,255,0.58)", mist: "rgba(150,218,246,0.22)" };
  }

  function drawStream(c, from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < 6) return;
    const angle = Math.atan2(dy, dx);
    const wide = nozzle === "wide";
    const startW = wide ? 5 : 1.7;
    const endW = wide ? 25 : 10;
    const tone = jetColor();
    const bend = Math.min(28, len * 0.08);

    c.save();
    c.translate(from.x, from.y);
    c.rotate(angle);

    const cone = (halfStart, halfEnd, fill, alpha) => {
      c.globalAlpha = alpha;
      c.beginPath();
      c.moveTo(0, -halfStart);
      c.quadraticCurveTo(len * 0.5, -halfEnd * 0.75 - bend * 0.25, len, -halfEnd);
      c.lineTo(len, halfEnd);
      c.quadraticCurveTo(len * 0.5, halfEnd * 0.75 + bend * 0.25, 0, halfStart);
      c.closePath();
      c.fillStyle = fill;
      c.fill();
    };
    cone(endW * 1.6, endW * 1.8, tone.mist, 0.85);
    cone(startW * 3, endW * 1.05, tone.mid, 0.75);
    cone(startW, endW * 0.30, tone.core, 0.85);

    // Rolling bright segments make the stream read as moving water.
    if (!reduced) {
      const phase = (clock * (tool === "tool_foam" ? 1.5 : 3.2)) % 1;
      c.globalAlpha = 0.48;
      for (let i = 0; i < 7; i += 1) {
        const p = (i / 7 + phase) % 1;
        const x = p * len;
        const half = startW + (endW - startW) * p * 0.42;
        c.fillStyle = tone.core;
        c.fillRect(x, -half * 0.34, Math.max(2, len * 0.018), Math.max(1, half * 0.68));
      }
    }
    c.globalAlpha = 1;
    c.restore();
  }

  function drawGun(c, from, to) {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    c.save();
    c.translate(from.x, from.y);
    c.rotate(angle);
    c.shadowColor = "rgba(8,30,38,0.35)";
    c.shadowBlur = 8;
    c.shadowOffsetY = 3;
    c.fillStyle = "#3d5560";
    c.beginPath(); c.roundRect(-20, -8, 22, 16, 5); c.fill();
    c.fillStyle = "#d8e8ec";
    c.beginPath(); c.roundRect(-2, -5, 13, 10, 3); c.fill();
    c.fillStyle = "#8fa7af";
    c.fillRect(9, -3, 6, 6);
    c.shadowColor = "transparent";
    c.fillStyle = "rgba(255,255,255,0.55)";
    c.fillRect(-17, -6, 15, 2);
    c.restore();
  }

  function drawImpact(c, to) {
    const phase = (clock * 4.2) % 1;
    const baseR = nozzle === "wide" ? 26 : 14;
    const tone = jetColor();
    for (let i = 0; i < 3; i += 1) {
      const p = (phase + i / 3) % 1;
      const r = baseR * (0.35 + p * 1.1);
      c.globalAlpha = (1 - p) * 0.55;
      c.strokeStyle = tone.core;
      c.lineWidth = Math.max(1, 3 - p * 2);
      c.beginPath(); c.ellipse(to.x, to.y, r, r * 0.45, 0, 0, TAU); c.stroke();
    }
    c.globalAlpha = 0.75;
    const hot = c.createRadialGradient(to.x, to.y, 0, to.x, to.y, baseR);
    hot.addColorStop(0, tone.core);
    hot.addColorStop(0.5, tone.mid);
    hot.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = hot;
    c.beginPath(); c.ellipse(to.x, to.y, baseR, baseR * 0.55, 0, 0, TAU); c.fill();
    c.globalAlpha = 1;
  }

  function emitWater(from, to) {
    const perFrame = reduced ? 2 : tool === "tool_foam" ? 8 : nozzle === "wide" ? 12 : 8;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / len;
    const uy = dy / len;
    for (let i = 0; i < perFrame; i += 1) {
      if (particles.length >= MAX_PARTICLES) break;
      // Some droplets fly along the jet; the rest burst off the impact point.
      const onPath = !reduced && i % 3 === 0;
      const ox = onPath ? from.x + dx * (0.3 + Math.random() * 0.6) : to.x;
      const oy = onPath ? from.y + dy * (0.3 + Math.random() * 0.6) : to.y;
      const splash = !onPath;
      const spread = splash ? 130 : 34;
      particles.push({
        x: ox + (Math.random() - 0.5) * (splash ? 14 : 8),
        y: oy + (Math.random() - 0.5) * (splash ? 10 : 8),
        vx: onPath ? ux * 260 + (Math.random() - 0.5) * 40 : (Math.random() - 0.5) * spread,
        vy: onPath ? uy * 260 + (Math.random() - 0.5) * 40 : -40 - Math.random() * 120,
        life: 0,
        max: 0.26 + Math.random() * 0.36,
        size: tool === "tool_foam" ? 2.4 + Math.random() * 3.4 : 1.1 + Math.random() * 2.1,
        foam: tool === "tool_foam",
        grain: tool === "tool_brush",
      });
    }
  }

  function emitSparkles(cells) {
    const count = reduced ? 2 : 5;
    for (const cell of cells) {
      const gx = cell % GRID_W;
      const gy = Math.floor(cell / GRID_W);
      const px = rect.x + ((gx + 0.5) / GRID_W) * rect.w;
      const py = rect.y + ((gy + 0.5) / GRID_H) * rect.h;
      for (let k = 0; k < count; k += 1) {
        if (particles.length >= MAX_PARTICLES) break;
        const angle = (k / count) * TAU + Math.random() * 0.6;
        const speed = 30 + Math.random() * 60;
        particles.push({
          x: px, y: py,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 40,
          life: 0, max: 0.42 + Math.random() * 0.3,
          size: 1.6 + Math.random() * 2.4,
          sparkle: true,
        });
      }
    }
  }

  function updateParticles(dt) {
    const step = Math.min(0.05, Math.max(0, dt));
    particles = particles.filter((p) => {
      p.life += step;
      if (p.life >= p.max) return false;
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.vy += (p.foam ? 90 : 420) * step;
      p.vx *= 1 - (p.foam ? 2.2 : 0.9) * step;
      return true;
    });
  }

  function drawParticles(c) {
    for (const p of particles) {
      const fade = Math.max(0, 1 - p.life / p.max);
      c.globalAlpha = fade * (p.sparkle ? 1 : 0.88);
      if (p.foam) {
        c.fillStyle = "rgba(255,255,255,0.92)";
        c.beginPath(); c.arc(p.x, p.y, p.size, 0, TAU); c.fill();
        c.strokeStyle = "rgba(196,232,244,0.7)"; c.lineWidth = 1; c.stroke();
      } else if (p.grain) {
        c.fillStyle = "rgba(122,88,52,0.8)";
        c.fillRect(p.x, p.y, p.size, p.size);
      } else {
        const speed = Math.hypot(p.vx, p.vy);
        const stretch = Math.min(2.6, 1 + speed / 260);
        c.save();
        c.translate(p.x, p.y);
        c.rotate(Math.atan2(p.vy, p.vx));
        c.fillStyle = p.sparkle ? "rgba(255,255,255,0.96)" : "rgba(218,246,255,0.9)";
        c.beginPath(); c.ellipse(0, 0, p.size * stretch, p.size * 0.72, 0, 0, TAU); c.fill();
        c.restore();
      }
    }
    c.globalAlpha = 1;
  }

  function render(snapshot, dt) {
    const state = snapshot.state;
    if (!state) return;
    const step = Math.min(0.05, Math.max(0, dt ?? 0.016));
    clock += step;
    tool = snapshot.tool;
    nozzle = snapshot.nozzle;
    spray = Boolean(snapshot.sprayActive);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(paintBackground(), 0, 0, width, height);
    ctx.drawImage(paintBase(snapshot), 0, 0, width, height);

    paintGrime(state);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    objectPath(ctx, snapshot.level?.shape ?? "sedan", rect);
    ctx.clip();
    ctx.drawImage(stainCanvas, rect.x, rect.y, rect.w, rect.h);
    ctx.drawImage(wetCanvas, rect.x, rect.y, rect.w, rect.h);
    ctx.restore();

    updateWet(step);
    for (const t of trail) {
      const x = rect.x + t.x * rect.w;
      const y = rect.y + t.y * rect.h;
      ctx.globalAlpha = (1 - t.life / 0.28) * 0.22;
      ctx.fillStyle = "rgba(214,244,255,0.9)";
      ctx.beginPath(); ctx.arc(x, y, nozzle === "wide" ? 16 : 9, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (spray && pointer) {
      const from = gunPoint();
      const to = { x: rect.x + pointer.x * rect.w, y: rect.y + pointer.y * rect.h };
      emitWater(from, to);
      drawStream(ctx, from, to);
      drawImpact(ctx, to);
      drawGun(ctx, from, to);
    }
    updateParticles(step);
    drawParticles(ctx);

    ctx.strokeStyle = "rgba(255,255,255,0.58)";
    ctx.lineWidth = 3;
    ctx.strokeRect(rect.x - 8, rect.y - 8, rect.w + 16, rect.h + 16);
  }

  function setPointer(norm) {
    pointer = norm ? { x: norm.x, y: norm.y } : null;
    if (!pointer) trail = [];
  }

  function clearParticles() {
    particles = [];
    trail = [];
    wet.fill(0);
  }

  return { resize, render, pointerToNorm, emitSparkles, setPointer, clearParticles, get rect() { return { ...rect }; } };
}
