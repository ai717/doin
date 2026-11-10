// Canvas 2D 渲染：光圈科技测试舱、亚克力地砖、蓝橙/紫绿传送门、能量箱与测试员。
// 只读引擎状态，不修改规则数据；粒子与光晕属于纯视觉层。

import {
  CELL, COLS, FIELD_H, FIELD_W, FIELD_X, FIELD_Y, HEIGHT, PORTAL_COLORS, ROWS,
  WIDTH, boxAt, goalAt,
} from "./engine.mjs";
import { strings } from "./i18n.mjs";

const FRAME_X = FIELD_X - 14;
const FRAME_Y = FIELD_Y - 14;
const FRAME_W = FIELD_W + 28;
const FRAME_H = FIELD_H + 28;

const PAIR_COLOR = {
  A: ["#00a8ff", "#e84118"],
  B: ["#a55eea", "#2ed573"],
};

const THEMES = [
  { wall: "#11151d", tileA: "#303847", tileB: "#29303c", rim: "#4a5668", accent: "#00a8ff", glow: "rgba(0, 168, 255, 0.16)" },
  { wall: "#1b1713", tileA: "#3a342c", tileB: "#322d26", rim: "#544838", accent: "#e84118", glow: "rgba(255, 140, 70, 0.14)" },
  { wall: "#161a21", tileA: "#343048", tileB: "#2d2a3e", rim: "#4c4462", accent: "#a55eea", glow: "rgba(165, 94, 234, 0.14)" },
  { wall: "#181712", tileA: "#39382e", tileB: "#313026", rim: "#53503e", accent: "#f6b93b", glow: "rgba(246, 185, 59, 0.13)" },
  { wall: "#121420", tileA: "#30334a", tileB: "#292c41", rim: "#454a6c", accent: "#7d8cff", glow: "rgba(125, 140, 255, 0.17)" },
];

const DIR_ANGLE = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

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

function cellX(col) {
  return FIELD_X + col * CELL;
}

function cellY(row) {
  return FIELD_Y + row * CELL;
}

function centerX(col) {
  return cellX(col) + CELL / 2;
}

function centerY(row) {
  return cellY(row) + CELL / 2;
}

export function createRenderer(canvas, options = {}) {
  const ctx = canvas.getContext("2d");
  let locale = options.locale ?? "zh";
  let t = strings(locale);
  let scale = 1;
  let time = 0;
  let particles = [];
  let rings = [];
  let flash = 0;
  let shake = 0;
  let solvedBloom = 0;
  let lastLevel = null;
  let reducedMotion = false;

  try {
    reducedMotion = Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  } catch {
    reducedMotion = false;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || WIDTH;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const height = width * (HEIGHT / WIDTH);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    scale = (width / WIDTH) * dpr;
  }

  function setLocale(next) {
    locale = next;
    t = strings(locale);
  }

  function reset() {
    particles = [];
    rings = [];
    flash = 0;
    shake = 0;
    solvedBloom = 0;
    lastLevel = null;
  }

  function spawn(x, y, color, count = 8, speed = 140, size = 2.8, life = 0.7, gravity = 60) {
    if (reducedMotion) count = Math.min(3, count);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const magnitude = speed * (0.3 + Math.random() * 0.9);
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * magnitude,
        vy: Math.sin(angle) * magnitude,
        life: life * (0.6 + Math.random() * 0.7),
        maxLife: life,
        color,
        size: size * (0.6 + Math.random() * 0.9),
        gravity,
      });
    }
  }

  function addEvents(events) {
    for (const event of events ?? []) {
      if (!event || !event.type) continue;
      if (event.type === "push" && event.to) {
        spawn(centerX(event.to.col), centerY(event.to.row), "#8ad8ff", 7, 90, 2.2, 0.5, 190);
      } else if (event.type === "portal") {
        const colors = PAIR_COLOR[event.pair] ?? PAIR_COLOR.A;
        if (event.from) spawn(centerX(event.from.col), centerY(event.from.row), colors[0], 18, 190, 3, 0.8, 20);
        if (event.to) {
          spawn(centerX(event.to.col), centerY(event.to.row), colors[1], 22, 210, 3.2, 0.9, 20);
          rings.push({ x: centerX(event.to.col), y: centerY(event.to.row), color: colors[1], life: 0.55, maxLife: 0.55 });
        }
        if (!reducedMotion) flash = Math.max(flash, 0.35);
      } else if (event.type === "blocked") {
        shake = Math.max(shake, 2.4);
      } else if (event.type === "solved") {
        spawn(FIELD_X + FIELD_W / 2, FIELD_Y + FIELD_H / 2, "#2ed573", 30, 240, 3.4, 1.4, 20);
        solvedBloom = 1;
        if (!reducedMotion) shake = Math.max(shake, 4);
      } else if (event.type === "undo") {
        spawn(FIELD_X + FIELD_W / 2, FIELD_Y + FIELD_H / 2, "#7d8cff", 10, 130, 2.4, 0.6, 10);
      }
    }
  }

  function update(dt) {
    time += dt;
    flash = Math.max(0, flash - dt * 2.2);
    shake = Math.max(0, shake - dt * 24);
    solvedBloom = Math.max(0, solvedBloom - dt * 0.55);
    for (const particle of particles) {
      particle.life -= dt;
      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.985;
      particle.vy *= 0.99;
    }
    particles = particles.filter((particle) => particle.life > 0);
    for (const ring of rings) ring.life -= dt;
    rings = rings.filter((ring) => ring.life > 0);
  }

  function drawBackdrop(theme) {
    const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, "#1b1e26");
    bg.addColorStop(0.55, "#12151c");
    bg.addColorStop(1, "#0b0d12");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const glow = ctx.createRadialGradient(WIDTH / 2, 90, 20, WIDTH / 2, 260, 520);
    glow.addColorStop(0, theme.glow);
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = theme.rim;
    ctx.lineWidth = 1;
    for (let x = 20; x < WIDTH; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
      ctx.stroke();
    }
    for (let y = 16; y < HEIGHT; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 24; i += 1) {
      const x = (i * 149 + Math.sin(time * 0.2 + i) * 20) % WIDTH;
      const y = (i * 97 + Math.cos(time * 0.17 + i * 1.4) * 16 + HEIGHT) % HEIGHT;
      ctx.fillStyle = i % 4 === 0 ? "#8ad8ff" : "#7d8cff";
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + (i % 3) * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFrame(theme) {
    const metal = ctx.createLinearGradient(0, FRAME_Y, 0, FRAME_Y + FRAME_H);
    metal.addColorStop(0, "#4b5262");
    metal.addColorStop(0.15, "#2c323d");
    metal.addColorStop(0.6, "#1b1f27");
    metal.addColorStop(1, "#3a414f");
    ctx.fillStyle = metal;
    roundRect(ctx, FRAME_X, FRAME_Y, FRAME_W, FRAME_H, 16);
    ctx.fill();

    ctx.strokeStyle = "rgba(160, 190, 220, 0.28)";
    ctx.lineWidth = 1.2;
    roundRect(ctx, FRAME_X + 2, FRAME_Y + 2, FRAME_W - 4, FRAME_H - 4, 15);
    ctx.stroke();

    ctx.fillStyle = "#0a0c11";
    roundRect(ctx, FIELD_X - 4, FIELD_Y - 4, FIELD_W + 8, FIELD_H + 8, 7);
    ctx.fill();

    ctx.strokeStyle = theme.accent;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    roundRect(ctx, FIELD_X - 2, FIELD_Y - 2, FIELD_W + 4, FIELD_H + 4, 6);
    ctx.stroke();
    ctx.globalAlpha = 1;

    for (const [x, y] of [
      [FRAME_X + 12, FRAME_Y + 12],
      [FRAME_X + FRAME_W - 12, FRAME_Y + 12],
      [FRAME_X + 12, FRAME_Y + FRAME_H - 12],
      [FRAME_X + FRAME_W - 12, FRAME_Y + FRAME_H - 12],
    ]) {
      const screw = ctx.createRadialGradient(x - 1, y - 1, 0.5, x, y, 4.4);
      screw.addColorStop(0, "#cfd8e6");
      screw.addColorStop(0.5, "#6c7789");
      screw.addColorStop(1, "#2a303a");
      ctx.fillStyle = screw;
      ctx.beginPath();
      ctx.arc(x, y, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(10, 12, 16, 0.8)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 2.4, y);
      ctx.lineTo(x + 2.4, y);
      ctx.stroke();
    }
  }

  function drawWall(state, theme, col, row) {
    const x = cellX(col);
    const y = cellY(row);
    ctx.fillStyle = theme.wall;
    ctx.fillRect(x, y, CELL, CELL);

    ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
    ctx.fillRect(x, y, CELL, 3);
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(x, y + CELL - 4, CELL, 4);

    ctx.strokeStyle = "rgba(120, 145, 175, 0.12)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4.5, y + 4.5, CELL - 9, CELL - 9);
    ctx.fillStyle = "rgba(140, 165, 195, 0.1)";
    ctx.fillRect(x + 9, y + 9, 3, 3);
    ctx.fillRect(x + CELL - 12, y + 9, 3, 3);
    ctx.fillRect(x + 9, y + CELL - 12, 3, 3);
    ctx.fillRect(x + CELL - 12, y + CELL - 12, 3, 3);
  }

  function drawFloor(state, theme, col, row) {
    const x = cellX(col);
    const y = cellY(row);
    const even = (col + row) % 2 === 0;
    const gradient = ctx.createLinearGradient(x, y, x + CELL, y + CELL);
    gradient.addColorStop(0, even ? theme.tileA : theme.tileB);
    gradient.addColorStop(1, even ? theme.tileB : theme.tileA);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, CELL, CELL);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.055)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, y + CELL - 1);
    ctx.lineTo(x + 0.5, y + 0.5);
    ctx.lineTo(x + CELL - 1, y + 0.5);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.moveTo(x + CELL - 0.5, y + 1);
    ctx.lineTo(x + CELL - 0.5, y + CELL - 0.5);
    ctx.lineTo(x + 1, y + CELL - 0.5);
    ctx.stroke();

    if ((col * 7 + row * 11) % 5 === 0) {
      ctx.strokeStyle = "rgba(160, 200, 240, 0.055)";
      ctx.beginPath();
      ctx.moveTo(x + 8, y + CELL - 8);
      ctx.lineTo(x + CELL - 8, y + 8);
      ctx.stroke();
    }
  }

  function drawGoal(goal, occupied, theme) {
    const x = cellX(goal.col) + 7;
    const y = cellY(goal.row) + 7;
    const size = CELL - 14;
    const pulse = reducedMotion ? 0.6 : 0.45 + Math.sin(time * 3 + goal.col + goal.row) * 0.18;
    ctx.save();
    const glow = ctx.createRadialGradient(x + size / 2, y + size / 2, 2, x + size / 2, y + size / 2, size * 0.72);
    glow.addColorStop(0, occupied ? "rgba(46, 213, 115, 0.35)" : `rgba(46, 213, 115, ${0.12 + pulse * 0.12})`);
    glow.addColorStop(1, "rgba(46, 213, 115, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 8, y - 8, size + 16, size + 16);

    ctx.fillStyle = occupied ? "rgba(46, 213, 115, 0.14)" : `rgba(46, 213, 115, ${0.04 + pulse * 0.04})`;
    ctx.fillRect(x + 4, y + 4, size - 8, size - 8);

    ctx.strokeStyle = occupied ? "#66ffa6" : `rgba(46, 213, 115, ${0.45 + pulse * 0.35})`;
    ctx.lineWidth = occupied ? 2.2 : 1.6;
    const arm = 10;
    ctx.beginPath();
    ctx.moveTo(x, y + arm);
    ctx.lineTo(x, y);
    ctx.lineTo(x + arm, y);
    ctx.moveTo(x + size - arm, y);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x + size, y + arm);
    ctx.moveTo(x, y + size - arm);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x + arm, y + size);
    ctx.moveTo(x + size - arm, y + size);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x + size, y + size - arm);
    ctx.stroke();

    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = `rgba(46, 213, 115, ${0.3 + pulse * 0.2})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 10, y + 10, size - 20, size - 20);
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawPortal(portal) {
    const color = PORTAL_COLORS[portal.color] ?? "#00a8ff";
    const delta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[portal.side];
    const cx = centerX(portal.col) + delta[0] * (CELL / 2 - 1);
    const cy = centerY(portal.row) + delta[1] * (CELL / 2 - 1);
    const vertical = portal.side === "left" || portal.side === "right";
    const rx = vertical ? 7 : CELL * 0.38;
    const ry = vertical ? CELL * 0.38 : 7;
    const pulse = reducedMotion ? 1 : 0.82 + Math.sin(time * 4 + portal.index * 1.7) * 0.16;

    ctx.save();
    ctx.translate(cx, cy);

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.14 * pulse;
    ctx.beginPath();
    ctx.ellipse(0, 0, CELL * 0.62, CELL * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.shadowColor = color;
    ctx.shadowBlur = 18 * pulse;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.72, ry * 0.72, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(6, 9, 14, 0.86)";
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.54, ry * 0.54, 0, 0, Math.PI * 2);
    ctx.fill();

    if (!reducedMotion) {
      const swirl = time * 1.8 + portal.index;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i += 1) {
        const offset = swirl + i * 2.1;
        ctx.beginPath();
        ctx.ellipse(Math.cos(offset) * rx * 0.2, Math.sin(offset) * ry * 0.2, rx * 0.34, ry * 0.34, offset * 0.2, 0, Math.PI * 1.5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function drawBox(state, box) {
    const cx = centerX(box.col);
    const cy = centerY(box.row);
    const size = CELL - 12;
    const half = size / 2;
    const occupied = goalAt(state, box.col, box.row);
    const pulse = reducedMotion ? 0.7 : 0.55 + Math.sin(time * 2.6 + box.col) * 0.16;

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + half + 3, half * 0.9, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();

    const metal = ctx.createLinearGradient(cx - half, cy - half, cx + half, cy + half);
    metal.addColorStop(0, "#aab4c2");
    metal.addColorStop(0.28, "#77828f");
    metal.addColorStop(0.62, "#5b6572");
    metal.addColorStop(1, "#3d4652");
    ctx.fillStyle = metal;
    roundRect(ctx, cx - half, cy - half, size, size, 7);
    ctx.fill();

    ctx.strokeStyle = "rgba(220, 235, 250, 0.45)";
    ctx.lineWidth = 1.2;
    roundRect(ctx, cx - half + 1, cy - half + 1, size - 2, size - 2, 6);
    ctx.stroke();

    ctx.fillStyle = "rgba(20, 24, 30, 0.55)";
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.beginPath();
      ctx.arc(cx + sx * (half - 6), cy + sy * (half - 6), 2.1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = occupied ? "#2ed573" : "#7fd8ff";
    ctx.shadowColor = occupied ? "#2ed573" : "#00a8ff";
    ctx.shadowBlur = 10 * pulse;
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(cx - half + 9, cy);
    ctx.lineTo(cx + half - 9, cy);
    ctx.moveTo(cx, cy - half + 9);
    ctx.lineTo(cx, cy + half - 9);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = occupied ? "#2ed573" : "#bdefff";
    ctx.beginPath();
    ctx.arc(cx, cy, 3.4, 0, Math.PI * 2);
    ctx.fill();

    if (occupied) {
      ctx.strokeStyle = "rgba(46, 213, 115, 0.8)";
      ctx.lineWidth = 2;
      roundRect(ctx, cx - half - 2, cy - half - 2, size + 4, size + 4, 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayer(state) {
    const player = state.player;
    const cx = centerX(player.col);
    const cy = centerY(player.row);
    const angle = DIR_ANGLE[player.dir] ?? Math.PI / 2;

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 12, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const aura = ctx.createRadialGradient(cx, cy, 2, cx, cy, 27);
    aura.addColorStop(0, "rgba(255, 190, 90, 0.18)");
    aura.addColorStop(1, "rgba(255, 190, 90, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, cy, 27, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(cx, cy);
    ctx.rotate(angle);

    ctx.fillStyle = "#e58e26";
    roundRect(ctx, -8.5, -9.5, 17, 19, 6.5);
    ctx.fill();
    ctx.fillStyle = "#c47015";
    roundRect(ctx, -5.5, -2, 11, 8, 2.5);
    ctx.fill();

    ctx.fillStyle = "#f6e0c2";
    ctx.beginPath();
    ctx.arc(0, -2.4, 6.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4a3424";
    ctx.beginPath();
    ctx.arc(-1.2, -5.2, 5.2, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();

    ctx.fillStyle = "#eef7ff";
    roundRect(ctx, 5.5, -2.6, 9.4, 5.2, 2);
    ctx.fill();
    ctx.fillStyle = "#00a8ff";
    ctx.shadowColor = "#00a8ff";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(14.2, 0, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#2c3542";
    roundRect(ctx, -8, 7.2, 6.2, 4.6, 2);
    ctx.fill();
    roundRect(ctx, 1.8, 7.2, 6.2, 4.6, 2);
    ctx.fill();

    ctx.restore();
  }

  function drawParticles() {
    for (const particle of particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawRings() {
    for (const ring of rings) {
      const progress = 1 - ring.life / ring.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.max(0, ring.life / ring.maxLife) * 0.7;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, 8 + progress * 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawVignette() {
    const vignette = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.3, WIDTH / 2, HEIGHT / 2, HEIGHT * 0.85);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.52)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function draw(view, extras = {}) {
    if (!canvas || !view?.state) return;
    if (!canvas.width) resize();
    const state = view.state;
    if (lastLevel !== state.levelId) {
      lastLevel = state.levelId;
      particles = [];
      rings = [];
      flash = 0;
      shake = 0;
      solvedBloom = 0;
    }

    const dt = Math.min(0.05, Math.max(0, extras.dt ?? 1 / 60));
    update(dt);

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    const theme = THEMES[Math.max(0, Math.min(THEMES.length - 1, state.chapter - 1))];
    drawBackdrop(theme);

    ctx.save();
    if (shake > 0 && !reducedMotion) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    drawFrame(theme);

    ctx.save();
    roundRect(ctx, FIELD_X, FIELD_Y, FIELD_W, FIELD_H, 5);
    ctx.clip();

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        if (state.grid[row][col] === 0) drawWall(state, theme, col, row);
        else drawFloor(state, theme, col, row);
      }
    }

    for (const goal of state.goals) {
      drawGoal(goal, Boolean(boxAt(state, goal.col, goal.row)), theme);
    }
    for (const portal of state.portals) drawPortal(portal);
    for (const box of state.boxes) drawBox(state, box);
    drawPlayer(state);

    const glass = ctx.createLinearGradient(FIELD_X, FIELD_Y, FIELD_X + FIELD_W, FIELD_Y + FIELD_H);
    glass.addColorStop(0, "rgba(255, 255, 255, 0.05)");
    glass.addColorStop(0.32, "rgba(255, 255, 255, 0)");
    glass.addColorStop(0.7, "rgba(255, 255, 255, 0)");
    glass.addColorStop(1, "rgba(255, 255, 255, 0.025)");
    ctx.fillStyle = glass;
    ctx.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);

    drawParticles();
    drawRings();
    ctx.restore();

    if (flash > 0) {
      ctx.fillStyle = `rgba(180, 230, 255, ${Math.min(0.18, flash * 0.5)})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    if (solvedBloom > 0 || state.solved) {
      const bloom = state.solved ? 0.12 + (reducedMotion ? 0 : Math.sin(time * 2.4) * 0.03) : solvedBloom * 0.18;
      ctx.fillStyle = `rgba(46, 213, 115, ${Math.max(0.04, bloom * 0.5)})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    ctx.restore();

    drawVignette();

    if (state.solved) {
      ctx.fillStyle = `rgba(46, 213, 115, ${reducedMotion ? 0.05 : 0.05 + Math.sin(time * 2) * 0.015})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
  }

  resize();

  return {
    resize,
    setLocale,
    addEvents,
    draw,
    reset,
    get scale() {
      return scale;
    },
  };
}
