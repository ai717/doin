// filepath: games/bubble-bloom/js/render.mjs

// Canvas 2D 渲染层：只读 engine state，负责玻璃舱、彩泡、粒子与特效。
// 所有 HUD / 按钮 / 文本仍留在语义化 DOM（见 ui.mjs）。

import { tierColor } from "./palette.mjs?v=79c518024932";
import {
  DROP_Y,
  FLOOR_Y,
  TIER_COUNT,
  WARN_GRACE,
  WARN_Y,
  WORLD,
  tierRadius
} from "./engine.mjs?v=79c518024932";

const TAU = Math.PI * 2;

function hexA(hex, alpha) {
  const value = String(hex).replace("#", "");
  const full = value.length === 3 ? value.replace(/./g, (c) => c + c) : value;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const gg = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${gg},${b},${alpha})`;
}

function roundRect(g, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rad, y);
  g.lineTo(x + w - rad, y);
  g.quadraticCurveTo(x + w, y, x + w, y + rad);
  g.lineTo(x + w, y + h - rad);
  g.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  g.lineTo(x + rad, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - rad);
  g.lineTo(x, y + rad);
  g.quadraticCurveTo(x, y, x + rad, y);
  g.closePath();
}

function paintBubble(g, cx, cy, r, tier) {
  const c = tierColor(tier);

  const glow = g.createRadialGradient(cx, cy, r * 0.62, cx, cy, r * 1.08);
  glow.addColorStop(0, hexA(c.lite, 0));
  glow.addColorStop(0.8, hexA(c.lite, 0.2));
  glow.addColorStop(1, hexA(c.lite, 0));
  g.fillStyle = glow;
  g.beginPath();
  g.arc(cx, cy, r * 1.08, 0, TAU);
  g.fill();

  const body = g.createRadialGradient(cx - r * 0.34, cy - r * 0.38, r * 0.1, cx, cy, r);
  body.addColorStop(0, c.lite);
  body.addColorStop(0.46, c.base);
  body.addColorStop(1, c.deep);
  g.fillStyle = body;
  g.beginPath();
  g.arc(cx, cy, r, 0, TAU);
  g.fill();

  const rings = Math.min(tier - 1, 6);
  for (let i = 0; i < rings; i += 1) {
    const rr = r * (0.86 - i * 0.11);
    if (rr <= r * 0.2) break;
    g.strokeStyle = `rgba(255,255,255,${(0.28 - i * 0.03).toFixed(3)})`;
    g.lineWidth = Math.max(0.6, r * 0.028);
    g.beginPath();
    g.arc(cx, cy, rr, 0, TAU);
    g.stroke();
  }

  const sides = Math.min(tier + 2, 10);
  const cr = r * 0.26;
  g.fillStyle = "rgba(255,255,255,0.82)";
  g.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = -Math.PI / 2 + (i / sides) * TAU;
    const px = cx + Math.cos(a) * cr;
    const py = cy + Math.sin(a) * cr;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();

  if (tier >= TIER_COUNT) {
    const hues = ["#FF8FB1", "#8FFFC8", "#8FC8FF"];
    for (let i = 0; i < 3; i += 1) {
      g.save();
      g.globalAlpha = 0.52;
      g.strokeStyle = hues[i];
      g.lineWidth = Math.max(1.2, r * 0.06);
      g.beginPath();
      g.arc(cx, cy, r * (0.74 - i * 0.14), Math.PI * 0.15 + i * 0.55, Math.PI * 0.15 + i * 0.55 + Math.PI * 1.05);
      g.stroke();
      g.restore();
    }
  }

  const lw = Math.max(0.8, r * 0.055);
  g.strokeStyle = "rgba(255,255,255,0.5)";
  g.lineWidth = lw;
  g.beginPath();
  g.arc(cx, cy, r - lw / 2, 0, TAU);
  g.stroke();

  g.fillStyle = "rgba(255,255,255,0.55)";
  g.beginPath();
  g.ellipse(cx - r * 0.34, cy - r * 0.4, r * 0.2, r * 0.13, -0.6, 0, TAU);
  g.fill();

  g.fillStyle = hexA(c.lite, 0.26);
  g.beginPath();
  g.ellipse(cx + r * 0.28, cy + r * 0.42, r * 0.26, r * 0.12, 0.5, 0, TAU);
  g.fill();
}

export function createRenderer(options) {
  const opts = options || {};
  const board = opts.board;
  const currentCanvas = opts.current || null;
  const nextCanvas = opts.next || null;

  const g = board ? board.getContext("2d") : null;
  const sprites = new Map();
  let reduced = false;
  let bw = 1;
  let bh = 1;
  let dpr = 1;
  let scale = 1;
  let offX = 0;
  let offY = 0;
  let motes = [];
  const particles = [];
  const flashes = [];
  let shake = 0;
  let clock = 0;

  try {
    if (typeof window !== "undefined" && window.matchMedia) {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
  } catch (error) {
    reduced = false;
  }

  function spriteFor(tier) {
    if (sprites.has(tier)) return sprites.get(tier);
    const r = 108;
    const ss = 2.4;
    const size = Math.max(8, Math.ceil(r * 2 * ss));
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const cg = canvas.getContext("2d");
    if (cg) paintBubble(cg, size / 2, size / 2, size / 2 - 2, tier);
    sprites.set(tier, canvas);
    return canvas;
  }

  function buildMotes() {
    motes = [];
    if (reduced) return;
    const count = 26;
    for (let i = 0; i < count; i += 1) {
      motes.push({
        x: Math.random() * WORLD.width,
        y: Math.random() * WORLD.height,
        r: 1 + Math.random() * 2.4,
        vy: -(6 + Math.random() * 18),
        vx: (Math.random() - 0.5) * 6,
        a: 0.08 + Math.random() * 0.22
      });
    }
  }

  function sizeCanvas(canvas, cssW, cssH) {
    const ratio = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(cssW * ratio));
    const h = Math.max(1, Math.round(cssH * ratio));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    return ratio;
  }

  function resize() {
    if (!board || !g) return;
    const rect = board.getBoundingClientRect();
    const cssW = Math.max(1, rect.width || board.clientWidth || 1);
    const cssH = Math.max(1, rect.height || board.clientHeight || 1);
    dpr = sizeCanvas(board, cssW, cssH);
    bw = cssW;
    bh = cssH;
    scale = Math.min(cssW / WORLD.width, cssH / WORLD.height);
    offX = (cssW - WORLD.width * scale) / 2;
    offY = (cssH - WORLD.height * scale) / 2;
    buildMotes();
    if (currentCanvas) sizeCanvas(currentCanvas, currentCanvas.clientWidth || 120, currentCanvas.clientHeight || 58);
    if (nextCanvas) sizeCanvas(nextCanvas, nextCanvas.clientWidth || 120, nextCanvas.clientHeight || 58);
  }

  function spawnBurst(x, y, tier, count, power) {
    if (reduced) return;
    const c = tierColor(tier);
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * TAU;
      const speed = (40 + Math.random() * 190) * (power || 1);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 40,
        life: 0.42 + Math.random() * 0.5,
        max: 0.92,
        r: 1.4 + Math.random() * 3.2,
        color: Math.random() < 0.5 ? c.lite : c.base
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += 520 * dt;
      p.vx *= 0.98;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = flashes.length - 1; i >= 0; i -= 1) {
      flashes[i].life -= dt;
      if (flashes[i].life <= 0) flashes.splice(i, 1);
    }
  }

  function handleEvents(events) {
    for (let i = 0; i < events.length; i += 1) {
      const ev = events[i];
      if (ev.type === "merge") {
        spawnBurst(ev.x, ev.y, ev.tier, 12 + Math.min(ev.chain, 4) * 4, 1);
        flashes.push({ x: ev.x, y: ev.y, r: 10 + ev.tier * 5, life: 0.34, max: 0.34, tier: ev.tier });
        if (!reduced && ev.chain >= 2) shake = Math.max(shake, 1.6 + ev.chain * 0.8);
      } else if (ev.type === "bloom") {
        spawnBurst(ev.x, ev.y, TIER_COUNT, 90, 1.9);
        flashes.push({ x: ev.x, y: ev.y, r: 220, life: 0.8, max: 0.8, tier: TIER_COUNT });
        if (!reduced) shake = Math.max(shake, 9);
      } else if (ev.type === "drop") {
        flashes.push({ x: ev.x, y: DROP_Y, r: 18, life: 0.18, max: 0.18, tier: ev.tier });
      }
    }
  }

  function drawBackdrop() {
    const grad = g.createLinearGradient(0, 0, 0, bh);
    grad.addColorStop(0, "#11294A");
    grad.addColorStop(0.52, "#0B1C36");
    grad.addColorStop(1, "#071325");
    g.fillStyle = grad;
    g.fillRect(0, 0, bw, bh);

    const rg = g.createRadialGradient(bw * 0.5, bh * 0.26, 8, bw * 0.5, bh * 0.26, bw * 1.05);
    rg.addColorStop(0, "rgba(96,178,236,0.18)");
    rg.addColorStop(1, "rgba(96,178,236,0)");
    g.fillStyle = rg;
    g.fillRect(0, 0, bw, bh);
  }

  function drawMotes(dt) {
    if (!motes.length) return;
    for (let i = 0; i < motes.length; i += 1) {
      const m = motes[i];
      if (!reduced) {
        m.y += m.vy * dt;
        m.x += m.vx * dt;
        if (m.y < -6) {
          m.y = WORLD.height + 6;
          m.x = Math.random() * WORLD.width;
        }
        if (m.x < -6) m.x = WORLD.width + 6;
        if (m.x > WORLD.width + 6) m.x = -6;
      }
      g.fillStyle = `rgba(190,225,255,${m.a})`;
      g.beginPath();
      g.arc(m.x, m.y, m.r, 0, TAU);
      g.fill();
    }
  }

  function drawWarnLine(state) {
    const danger = state.danger;
    const ratio = Math.min(1, state.overTime / WARN_GRACE);
    const pulse = reduced ? 0.7 : 0.55 + 0.45 * Math.sin(clock * 6);
    if (danger) {
      g.strokeStyle = `rgba(255,122,107,${(0.35 + 0.5 * ratio * pulse).toFixed(3)})`;
      g.lineWidth = 2.4;
      const glow = g.createLinearGradient(0, WARN_Y - 26, 0, WARN_Y + 8);
      glow.addColorStop(0, `rgba(255,90,80,${(0.22 * ratio + 0.06).toFixed(3)})`);
      glow.addColorStop(1, "rgba(255,90,80,0)");
      g.fillStyle = glow;
      g.fillRect(0, WARN_Y - 26, WORLD.width, 34);
    } else {
      g.strokeStyle = "rgba(183,121,60,0.5)";
      g.lineWidth = 1.6;
    }
    g.setLineDash([11, 9]);
    g.beginPath();
    g.moveTo(0, WARN_Y);
    g.lineTo(WORLD.width, WARN_Y);
    g.stroke();
    g.setLineDash([]);
  }

  function drawRail(state) {
    g.strokeStyle = "rgba(183,121,60,0.55)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(10, 16);
    g.lineTo(WORLD.width - 10, 16);
    g.stroke();

    g.strokeStyle = "rgba(231,184,114,0.28)";
    g.lineWidth = 1;
    for (let y = 120; y < FLOOR_Y; y += 60) {
      g.beginPath();
      g.moveTo(4, y);
      g.lineTo(16, y);
      g.stroke();
      g.beginPath();
      g.moveTo(WORLD.width - 16, y);
      g.lineTo(WORLD.width - 4, y);
      g.stroke();
    }
  }

  function drawGuide(state) {
    if (state.phase !== "playing" || !state.current) return;
    const tier = state.current;
    const radius = tierRadius(tier);
    g.save();
    g.globalAlpha = 0.22;
    g.strokeStyle = "#9FD8FF";
    g.lineWidth = 1.4;
    g.setLineDash([6, 10]);
    g.beginPath();
    g.moveTo(state.aimX, DROP_Y + radius);
    g.lineTo(state.aimX, FLOOR_Y);
    g.stroke();
    g.setLineDash([]);
    g.restore();

    g.save();
    g.globalAlpha = 0.5;
    const sprite = spriteFor(tier);
    g.drawImage(sprite, state.aimX - radius, DROP_Y - radius, radius * 2, radius * 2);
    g.restore();

    g.strokeStyle = "rgba(231,184,114,0.7)";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(state.aimX, 16);
    g.lineTo(state.aimX, DROP_Y - radius);
    g.stroke();
  }

  function drawBubbles(state) {
    const list = state.bubbles;
    for (let i = 0; i < list.length; i += 1) {
      const b = list[i];
      const sprite = spriteFor(b.tier);
      let radius = b.r;
      let alpha = 1;
      if (b.merging) {
        const grow = reduced ? 1.12 : 1 + 0.18 * Math.abs(Math.sin(clock * 14));
        radius = b.r * grow;
        alpha = 0.92;
      }
      g.save();
      g.globalAlpha = alpha;
      g.drawImage(sprite, b.x - radius, b.y - radius, radius * 2, radius * 2);
      g.restore();
    }
  }

  function drawFlashes() {
    for (let i = 0; i < flashes.length; i += 1) {
      const f = flashes[i];
      const k = Math.max(0, f.life / f.max);
      const radius = f.r * (1.6 - k * 0.6);
      const c = tierColor(f.tier);
      const grad = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, radius);
      grad.addColorStop(0, hexA(c.lite, 0.5 * k));
      grad.addColorStop(0.6, hexA(c.base, 0.22 * k));
      grad.addColorStop(1, hexA(c.base, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(f.x, f.y, radius, 0, TAU);
      g.fill();
    }
  }

  function drawParticles() {
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      const k = Math.max(0, p.life / p.max);
      g.globalAlpha = k;
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(p.x, p.y, p.r * k + 0.4, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  function drawGlass() {
    g.save();
    roundRect(g, 1, 1, bw - 2, bh - 2, 17);
    g.strokeStyle = "rgba(190,225,255,0.24)";
    g.lineWidth = 2;
    g.stroke();

    g.strokeStyle = "rgba(255,255,255,0.07)";
    g.lineWidth = Math.max(10, bw * 0.03);
    roundRect(g, 8, 10, bw - 16, bh - 20, 12);
    g.stroke();

    const streak = g.createLinearGradient(bw * 0.1, 0, bw * 0.45, bh);
    streak.addColorStop(0, "rgba(255,255,255,0.09)");
    streak.addColorStop(0.5, "rgba(255,255,255,0.02)");
    streak.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = streak;
    g.beginPath();
    g.moveTo(bw * 0.12, bh);
    g.lineTo(bw * 0.34, bh);
    g.lineTo(bw * 0.62, 0);
    g.lineTo(bw * 0.44, 0);
    g.closePath();
    g.fill();

    g.strokeStyle = "rgba(231,184,114,0.5)";
    g.lineWidth = 2.4;
    const c = Math.min(26, bw * 0.08);
    const corners = [
      [2, 2, 1, 1],
      [bw - 2, 2, -1, 1],
      [2, bh - 2, 1, -1],
      [bw - 2, bh - 2, -1, -1]
    ];
    for (let i = 0; i < corners.length; i += 1) {
      const [x, y, sx, sy] = corners[i];
      g.beginPath();
      g.moveTo(x + sx * c, y);
      g.lineTo(x, y);
      g.lineTo(x, y + sy * c);
      g.stroke();
    }
    g.restore();
  }

  function render(state, dt) {
    if (!g || !state) return;
    const delta = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), 0.1);
    clock += delta;
    updateParticles(delta);

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, bw, bh);

    g.save();
    roundRect(g, 0, 0, bw, bh, 18);
    g.clip();
    drawBackdrop();

    g.save();
    if (shake > 0 && !reduced) {
      g.translate((Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake);
      shake = Math.max(0, shake - delta * 26);
    }
    g.translate(offX, offY);
    g.scale(scale, scale);

    drawMotes(delta);
    drawWarnLine(state);
    drawRail(state);
    drawBubbles(state);
    drawFlashes();
    drawParticles();
    drawGuide(state);

    g.restore();
    drawGlass();
    g.restore();
  }

  function drawSpecimen(canvas, tier) {
    if (!canvas || !tier) return;
    const cg = canvas.getContext("2d");
    if (!cg) return;
    sizeCanvas(canvas, canvas.clientWidth || 120, canvas.clientHeight || 58);
    const w = canvas.width;
    const h = canvas.height;
    cg.setTransform(1, 0, 0, 1, 0, 0);
    cg.clearRect(0, 0, w, h);
    const radius = Math.min(w, h) * 0.44;
    paintBubble(cg, w / 2, h / 2, radius, tier);
  }

  function reset() {
    particles.length = 0;
    flashes.length = 0;
    shake = 0;
  }

  return {
    resize,
    render,
    reset,
    handleEvents,
    drawSpecimen,
    isReduced() {
      return reduced;
    }
  };
}
