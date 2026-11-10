// Canvas 2D 渲染：博物馆地层剖面、软胶化石、气泵与粒子。
// 只读引擎状态，绝不修改规则数据；粒子/飘字属于纯视觉层。

import {
  CELL, COLS, FIELD_H, FIELD_W, FIELD_X, FIELD_Y, HEIGHT, ROCK_STEP_TIME,
  ROWS, SKY_ROW, STATUS_LOST, STATUS_WON, WIDTH, flameCells,
} from "./engine.mjs";
import { strings } from "./i18n.mjs";

const FRAME_X = FIELD_X - 14;
const FRAME_Y = 2;
const FRAME_W = FIELD_W + 28;
const FRAME_H = FIELD_Y + FIELD_H + 8;

const THEMES = [
  {
    sky: ["#bfe9f7", "#eef8e9"], grass: "#4c9d68", top: "#e2c292", mid: "#c99a61", bottom: "#a9794a",
    rim: "#f4dcaa", tunnel: "#3b2517", mineral: "#8c6a45", glow: "rgba(255, 222, 150, 0.18)",
  },
  {
    sky: ["#f6dfc8", "#f9eddc"], grass: "#a06a44", top: "#d18b5d", mid: "#b66643", bottom: "#8d4c32",
    rim: "#f2c79a", tunnel: "#301b12", mineral: "#7b402a", glow: "rgba(255, 176, 120, 0.16)",
  },
  {
    sky: ["#d9d2bb", "#efe7d3"], grass: "#6f7d4b", top: "#aa7d53", mid: "#845b3a", bottom: "#5d3f29",
    rim: "#d9b27c", tunnel: "#251810", mineral: "#6e4a30", glow: "rgba(226, 189, 126, 0.16)",
  },
  {
    sky: ["#c6d8ce", "#e3ece2"], grass: "#4c7a68", top: "#6f887b", mid: "#526a61", bottom: "#394d47",
    rim: "#b8ccbe", tunnel: "#19251f", mineral: "#41564d", glow: "rgba(150, 220, 190, 0.14)",
  },
  {
    sky: ["#cfc5e6", "#e8e1f4"], grass: "#6a5f8c", top: "#705f98", mid: "#504473", bottom: "#342b51",
    rim: "#c6b9e8", tunnel: "#171227", mineral: "#4b3f6f", glow: "rgba(180, 150, 255, 0.18)",
  },
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

function hash(col, row, seed = 0) {
  let h = Math.imul(col + 1, 374761393) ^ Math.imul(row + 7, 668265263) ^ Math.imul(seed + 1, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mix(a, b, t) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(r1 + (r2 - r1) * k)}, ${Math.round(g1 + (g2 - g1) * k)}, ${Math.round(b1 + (b2 - b1) * k)})`;
}

function cellCenter(col, row) {
  return {
    x: FIELD_X + col * CELL + CELL / 2,
    y: row === SKY_ROW ? FIELD_Y - CELL / 2 + 4 : FIELD_Y + row * CELL + CELL / 2,
  };
}

export function createRenderer(canvas, options = {}) {
  const ctx = canvas.getContext("2d");
  let locale = options.locale ?? "zh";
  let t = strings(locale);
  let scale = 1;
  let particles = [];
  let toasts = [];
  let lastLevel = null;
  let lastChapter = 1;
  let shake = 0;
  let flash = 0;
  let time = 0;
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
    toasts = [];
    shake = 0;
    flash = 0;
    lastLevel = null;
  }

  function spawn(x, y, color, count = 6, speed = 120, size = 3, life = 0.8, gravity = 280) {
    if (reducedMotion) count = Math.min(3, count);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const magnitude = speed * (0.3 + Math.random() * 0.9);
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * magnitude,
        vy: Math.sin(angle) * magnitude - 40,
        life: life * (0.6 + Math.random() * 0.7),
        maxLife: life,
        color,
        size: size * (0.6 + Math.random() * 0.9),
        gravity,
        square: Math.random() < 0.3,
      });
    }
  }

  function pushToast(text, x, y, color = "#ffe7a8") {
    toasts.push({ text, x, y, life: 1.6, maxLife: 1.6, color });
  }

  function addEvents(events) {
    for (const event of events ?? []) {
      const center = cellCenter(event.col ?? 0, event.row ?? 0);
      if (event.type === "dig") {
        const theme = THEMES[lastChapter - 1] ?? THEMES[0];
        spawn(center.x, center.y, theme.rim, 4, 90, 2.4, 0.5, 240);
      } else if (event.type === "fossil") {
        spawn(center.x, center.y, "#ffd66e", 16, 150, 3, 1, 180);
        pushToast(t.fossilToast, center.x, center.y - 16, "#ffe6a8");
        shake = Math.max(shake, 1.5);
      } else if (event.type === "pump-hit") {
        spawn(center.x, center.y, "#f7f0d8", 6, 110, 2.6, 0.45, 120);
      } else if (event.type === "burst") {
        const color = event.monsterType === "fygar" ? "#9adf7a" : "#ff7f7f";
        spawn(center.x, center.y, color, 20, 210, 3.6, 0.9, 260);
        spawn(center.x, center.y, "#ffe3b0", 8, 140, 2.6, 0.7, 180);
        pushToast(t.burstToast, center.x, center.y - 18, "#ffe0a0");
        if (!reducedMotion) shake = Math.max(shake, 4);
      } else if (event.type === "rock-fall") {
        spawn(center.x, center.y + CELL / 2, "#b9a488", 8, 70, 2.4, 0.8, 120);
      } else if (event.type === "rock-shatter") {
        spawn(center.x, center.y, "#b9a488", 22, 200, 3.4, 1, 280);
        if (!reducedMotion) shake = Math.max(shake, 7);
      } else if (event.type === "rock-kill") {
        spawn(center.x, center.y, "#d9c3a0", 14, 170, 3, 0.9, 260);
        pushToast(t.crushedToast, center.x, center.y - 18, "#ffc98a");
        if (!reducedMotion) shake = Math.max(shake, 5);
      } else if (event.type === "flame") {
        spawn(center.x, center.y, "#ff9b45", 12, 170, 3, 0.6, -60);
      } else if (event.type === "death") {
        spawn(center.x, center.y, "#ffb2a0", 14, 150, 3, 0.8, 220);
        flash = 1;
        if (!reducedMotion) shake = Math.max(shake, 6);
      } else if (event.type === "won") {
        spawn(FIELD_X + FIELD_W / 2, FIELD_Y + FIELD_H / 2, "#ffe6a8", 26, 220, 3.4, 1.4, 100);
      }
    }
  }

  function update(dt) {
    time += dt;
    shake = Math.max(0, shake - dt * 22);
    flash = Math.max(0, flash - dt * 2.4);
    for (const particle of particles) {
      particle.life -= dt;
      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.99;
    }
    particles = particles.filter((particle) => particle.life > 0);
    for (const toast of toasts) toast.life -= dt;
    toasts = toasts.filter((toast) => toast.life > 0);
  }

  function drawBackdrop() {
    const wall = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    wall.addColorStop(0, "#1a1510");
    wall.addColorStop(0.55, "#120e0a");
    wall.addColorStop(1, "#080605");
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const glow = ctx.createRadialGradient(WIDTH / 2, 80, 40, WIDTH / 2, 220, 520);
    glow.addColorStop(0, "rgba(255, 213, 150, 0.09)");
    glow.addColorStop(1, "rgba(255, 213, 150, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 26; i += 1) {
      const x = (i * 137 + Math.sin(time * 0.2 + i) * 18) % WIDTH;
      const y = (i * 89 + Math.cos(time * 0.16 + i * 1.7) * 14 + HEIGHT) % HEIGHT;
      ctx.fillStyle = i % 3 === 0 ? "#d7b87a" : "#8f7a58";
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + (i % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFrame(theme) {
    const brass = ctx.createLinearGradient(0, FRAME_Y, 0, FRAME_Y + FRAME_H);
    brass.addColorStop(0, "#f3dfb4");
    brass.addColorStop(0.18, "#d8b169");
    brass.addColorStop(0.55, "#a37c2f");
    brass.addColorStop(0.82, "#6f4f17");
    brass.addColorStop(1, "#c7a35c");
    ctx.fillStyle = brass;
    roundRect(ctx, FRAME_X, FRAME_Y, FRAME_W, FRAME_H, 16);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 240, 200, 0.5)";
    ctx.lineWidth = 1.2;
    roundRect(ctx, FRAME_X + 2, FRAME_Y + 2, FRAME_W - 4, FRAME_H - 4, 15);
    ctx.stroke();

    const inner = ctx.createLinearGradient(0, FRAME_Y + 10, 0, FRAME_Y + FRAME_H);
    inner.addColorStop(0, "#1c1610");
    inner.addColorStop(1, "#0b0806");
    ctx.fillStyle = inner;
    roundRect(ctx, FIELD_X - 6, FRAME_Y + 8, FIELD_W + 12, FRAME_H - 16, 9);
    ctx.fill();

    ctx.strokeStyle = theme.glow;
    ctx.lineWidth = 1;
    roundRect(ctx, FIELD_X - 2, FIELD_Y - 8, FIELD_W + 4, FIELD_H + 16, 7);
    ctx.stroke();

    for (const [x, y] of [
      [FRAME_X + 12, FRAME_Y + 12],
      [FRAME_X + FRAME_W - 12, FRAME_Y + 12],
      [FRAME_X + 12, FRAME_Y + FRAME_H - 12],
      [FRAME_X + FRAME_W - 12, FRAME_Y + FRAME_H - 12],
    ]) {
      const rivet = ctx.createRadialGradient(x - 1, y - 1, 0.5, x, y, 4.2);
      rivet.addColorStop(0, "#fff0c8");
      rivet.addColorStop(0.5, "#c69c4c");
      rivet.addColorStop(1, "#5f4310");
      ctx.fillStyle = rivet;
      ctx.beginPath();
      ctx.arc(x, y, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSky(theme) {
    const sky = ctx.createLinearGradient(0, FRAME_Y + 10, 0, FIELD_Y);
    sky.addColorStop(0, theme.sky[0]);
    sky.addColorStop(1, theme.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(FIELD_X, FRAME_Y + 10, FIELD_W, FIELD_Y - FRAME_Y - 10);

    const sunX = FIELD_X + FIELD_W - 74;
    const sunY = FIELD_Y - 18;
    const sun = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 26);
    sun.addColorStop(0, "rgba(255, 246, 208, 0.95)");
    sun.addColorStop(0.4, "rgba(255, 226, 150, 0.55)");
    sun.addColorStop(1, "rgba(255, 214, 130, 0)");
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.38)";
    for (const [x, y, w] of [[FIELD_X + 58, FIELD_Y - 30, 54], [FIELD_X + 104, FIELD_Y - 26, 32], [FIELD_X + 408, FIELD_Y - 34, 46]]) {
      ctx.beginPath();
      ctx.ellipse(x, y, w / 2, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = theme.grass;
    ctx.fillRect(FIELD_X, FIELD_Y - 5, FIELD_W, 5);
    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    ctx.fillRect(FIELD_X, FIELD_Y - 5, FIELD_W, 1.4);
    for (let col = 0; col < COLS; col += 1) {
      const x = FIELD_X + col * CELL;
      const sway = Math.sin(time * 1.3 + col) * 1.1;
      ctx.strokeStyle = theme.grass;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x + 6, FIELD_Y - 3);
      ctx.quadraticCurveTo(x + 8 + sway, FIELD_Y - 11, x + 10 + sway, FIELD_Y - 15);
      ctx.moveTo(x + 22, FIELD_Y - 3);
      ctx.quadraticCurveTo(x + 20 - sway, FIELD_Y - 10, x + 18 - sway, FIELD_Y - 13);
      ctx.stroke();
    }
  }

  function drawFossilIcon(x, y, variant, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#f6e3ad";
    ctx.fillStyle = "rgba(255, 238, 190, 0.55)";
    ctx.lineWidth = 1.4;
    if (variant === 0) {
      ctx.beginPath();
      ctx.ellipse(x, y, 8, 5.2, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath();
        ctx.moveTo(x + i * 2.6, y - 4.4);
        ctx.lineTo(x + i * 2.2, y + 4.4);
        ctx.stroke();
      }
    } else if (variant === 1) {
      ctx.beginPath();
      for (let i = 0; i < 26; i += 1) {
        const angle = i * 0.34;
        const radius = 1.6 + i * 0.3;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(x, y, 4.6, 8, 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 2.5, y + 8);
      ctx.quadraticCurveTo(x + 6, y + 12, x + 3, y + 14);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGrid(state, theme) {
    for (let row = 0; row < ROWS; row += 1) {
      const dirt = mix(theme.top, theme.bottom, row / (ROWS - 1));
      const dirtDeep = mix(theme.mid, theme.bottom, row / (ROWS - 1));
      for (let col = 0; col < COLS; col += 1) {
        const x = FIELD_X + col * CELL;
        const y = FIELD_Y + row * CELL;
        if (state.grid[row][col] === 1) {
          const tunnel = ctx.createLinearGradient(0, y, 0, y + CELL);
          tunnel.addColorStop(0, "#160f0a");
          tunnel.addColorStop(0.45, theme.tunnel);
          tunnel.addColorStop(1, "#1a120c");
          ctx.fillStyle = tunnel;
          ctx.fillRect(x, y, CELL, CELL);

          ctx.strokeStyle = "rgba(255, 228, 180, 0.09)";
          ctx.lineWidth = 1;
          if (row === 0 || state.grid[row - 1][col] === 1) {
            ctx.beginPath();
            ctx.moveTo(x + 1, y + 1.5);
            ctx.lineTo(x + CELL - 1, y + 1.5);
            ctx.stroke();
          }
          if (col === 0 || state.grid[row][col - 1] === 1) {
            ctx.beginPath();
            ctx.moveTo(x + 1.5, y + 2);
            ctx.lineTo(x + 1.5, y + CELL - 2);
            ctx.stroke();
          }
        } else {
          ctx.fillStyle = row % 3 === 0 ? dirt : dirtDeep;
          ctx.fillRect(x, y, CELL, CELL);

          const speckCount = 2 + Math.floor(hash(col, row, 3) * 3);
          for (let i = 0; i < speckCount; i += 1) {
            const px = x + 3 + hash(col, row, i + 10) * (CELL - 6);
            const py = y + 3 + hash(col, row, i + 20) * (CELL - 6);
            ctx.fillStyle = i % 2 === 0 ? "rgba(70, 46, 26, 0.22)" : "rgba(255, 240, 205, 0.14)";
            ctx.beginPath();
            ctx.arc(px, py, 0.7 + hash(col, row, i + 30) * 1.4, 0, Math.PI * 2);
            ctx.fill();
          }

          if (hash(col, row, 7) > 0.86) {
            ctx.fillStyle = theme.mineral;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.ellipse(x + 10 + hash(col, row, 8) * 16, y + 10 + hash(col, row, 9) * 14, 4.6, 2.8, hash(col, row, 10) * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }
      ctx.strokeStyle = "rgba(40, 24, 12, 0.20)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(FIELD_X, FIELD_Y + (row + 1) * CELL - 0.5);
      ctx.lineTo(FIELD_X + FIELD_W, FIELD_Y + (row + 1) * CELL - 0.5);
      ctx.stroke();
    }

    for (const fossil of state.fossils) {
      if (fossil.got) continue;
      if (!state.grid[fossil.row] || state.grid[fossil.row][fossil.col] !== 0) continue;
      const center = cellCenter(fossil.col, fossil.row);
      drawFossilIcon(center.x, center.y, Number(fossil.id.slice(1)) % 3, 0.9);
    }
  }

  function drawRock(rock, theme) {
    if (rock.shattered) return;
    const x = FIELD_X + rock.col * CELL;
    const y = FIELD_Y + rock.row * CELL;
    let offset = 0;
    let wobble = 0;
    if (rock.falling) offset = Math.min(1, rock.fallTimer / ROCK_STEP_TIME) * CELL;
    else if (rock.shake > 0 && !reducedMotion) wobble = Math.sin(time * 46) * 1.8;

    const cx = x + CELL / 2 + wobble;
    const cy = y + CELL / 2 + offset;
    const radius = CELL * 0.44;

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
    ctx.beginPath();
    ctx.ellipse(cx, y + CELL - 2, radius * 0.9, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.45, 2, cx, cy, radius);
    body.addColorStop(0, "#b9c0c2");
    body.addColorStop(0.5, "#7f8789");
    body.addColorStop(1, "#464d50");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy + radius * 0.25);
    ctx.quadraticCurveTo(cx - radius * 1.05, cy - radius * 0.55, cx - radius * 0.3, cy - radius * 0.92);
    ctx.quadraticCurveTo(cx + radius * 0.5, cy - radius * 1.05, cx + radius * 0.95, cy - radius * 0.3);
    ctx.quadraticCurveTo(cx + radius * 1.1, cy + radius * 0.55, cx + radius * 0.35, cy + radius * 0.92);
    ctx.quadraticCurveTo(cx - radius * 0.45, cy + radius * 1.02, cx - radius, cy + radius * 0.25);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(40, 44, 46, 0.65)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.5, cy - radius * 0.35);
    ctx.lineTo(cx - radius * 0.1, cy - radius * 0.05);
    ctx.lineTo(cx + radius * 0.25, cy - radius * 0.3);
    ctx.moveTo(cx + radius * 0.1, cy + radius * 0.1);
    ctx.lineTo(cx + radius * 0.4, cy + radius * 0.4);
    ctx.stroke();

    ctx.fillStyle = "rgba(124, 158, 92, 0.55)";
    ctx.beginPath();
    ctx.ellipse(cx + radius * 0.4, cy + radius * 0.5, 4.2, 2.2, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (rock.shake > 0) {
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(time * 30) * 0.25;
      ctx.strokeStyle = "#ffcf7a";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFlames(state, monster) {
    for (const cell of flameCells(state, monster)) {
      const center = cellCenter(cell.col, cell.row);
      const gradient = ctx.createRadialGradient(center.x, center.y, 2, center.x, center.y, CELL * 0.62);
      gradient.addColorStop(0, "rgba(255, 246, 180, 0.95)");
      gradient.addColorStop(0.45, "rgba(255, 150, 55, 0.8)");
      gradient.addColorStop(1, "rgba(214, 60, 20, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(center.x, center.y, CELL * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPooka(monster) {
    const center = cellCenter(monster.col, monster.row);
    const scale = 1 + Math.min(2, monster.inflation) * 0.16;
    const radius = 12.4 * scale;
    ctx.save();
    if (monster.ghosting) ctx.globalAlpha = 0.5;
    ctx.translate(center.x, center.y);

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 13, radius * 0.85, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();

    if (monster.ghosting) {
      ctx.strokeStyle = "rgba(160, 240, 255, 0.7)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    const body = ctx.createRadialGradient(-radius * 0.35, -radius * 0.4, 2, 0, 0, radius);
    body.addColorStop(0, "#ffb0a0");
    body.addColorStop(0.45, "#ef5f57");
    body.addColorStop(1, "#9e2426");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f3efe2";
    ctx.beginPath();
    ctx.arc(0, -2, radius * 0.72, Math.PI * 1.12, Math.PI * 1.88);
    ctx.lineTo(radius * 0.55, -radius * 0.8);
    ctx.lineTo(-radius * 0.55, -radius * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#3b2b24";
    ctx.beginPath();
    ctx.arc(-4.2, -3.4, 2.2, 0, Math.PI * 2);
    ctx.arc(4.2, -3.4, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff7dd";
    ctx.beginPath();
    ctx.arc(-4.8, -4.1, 0.75, 0, Math.PI * 2);
    ctx.arc(3.6, -4.1, 0.75, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#7b1c1e";
    ctx.beginPath();
    ctx.ellipse(-radius * 0.55, radius * 0.72, 4, 2.4, -0.3, 0, Math.PI * 2);
    ctx.ellipse(radius * 0.55, radius * 0.72, 4, 2.4, 0.3, 0, Math.PI * 2);
    ctx.fill();

    if (monster.inflation > 0) {
      ctx.strokeStyle = "rgba(255, 236, 200, 0.7)";
      ctx.lineWidth = 1;
      for (let i = 0; i < monster.inflation; i += 1) {
        ctx.beginPath();
        ctx.arc(0, 0, radius * (0.5 + i * 0.18), -0.6, 0.5);
        ctx.stroke();
      }
    }
    if (monster.hitFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.7, monster.hitFlash * 4)})`;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFygar(monster) {
    const center = cellCenter(monster.col, monster.row);
    const scale = 1 + Math.min(2, monster.inflation) * 0.14;
    const flip = monster.dir === "left" ? -1 : 1;
    ctx.save();
    if (monster.ghosting) ctx.globalAlpha = 0.5;
    ctx.translate(center.x, center.y);
    ctx.scale(flip * scale, scale);

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 13, 13, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createRadialGradient(-4, -5, 2, 0, 0, 16);
    body.addColorStop(0, "#c8f08a");
    body.addColorStop(0.5, "#6cbb52");
    body.addColorStop(1, "#2f6b35");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(-1, 1, 12.4, 11.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f2d16b";
    ctx.beginPath();
    ctx.ellipse(1, 5, 7.6, 5.4, 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#3f7a3c";
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-9 + i * 4.4, -7.4);
      ctx.lineTo(-6.8 + i * 4.4, -13.4);
      ctx.lineTo(-4.6 + i * 4.4, -6.8);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = "#2d6336";
    ctx.beginPath();
    ctx.moveTo(-10, 7);
    ctx.quadraticCurveTo(-18, 12, -15, 3);
    ctx.quadraticCurveTo(-12, 6, -8, 5);
    ctx.fill();

    ctx.fillStyle = "#3d7c40";
    ctx.beginPath();
    ctx.ellipse(10, -3, 6.4, 4.8, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f6f1d8";
    ctx.beginPath();
    ctx.arc(7.4, -5, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a2118";
    ctx.beginPath();
    ctx.arc(8, -5.2, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff6d9";
    ctx.beginPath();
    ctx.arc(8.5, -5.8, 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f4e9c8";
    ctx.beginPath();
    ctx.moveTo(13.2, -0.8);
    ctx.lineTo(17.4, 0.4);
    ctx.lineTo(13.4, 1.8);
    ctx.closePath();
    ctx.fill();

    if (monster.charge > 0) {
      ctx.strokeStyle = "rgba(255, 170, 70, 0.8)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, 15 + Math.sin(time * 24) * 1.4, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (monster.inflation > 0) {
      ctx.strokeStyle = "rgba(255, 240, 200, 0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 9 + monster.inflation * 2.4, -0.4, 0.8);
      ctx.stroke();
    }
    if (monster.hitFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.65, monster.hitFlash * 4)})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer(state) {
    const player = state.player;
    const center = cellCenter(player.col, player.row);
    const flip = player.dir === "left" ? -1 : 1;
    const moving = Boolean(player.inputDir);
    const bob = moving ? Math.sin(time * 18) * 1.2 : Math.sin(time * 3) * 0.6;
    const alpha = player.invuln > 0 ? (Math.sin(time * 26) > 0 ? 0.35 : 1) : 1;

    if (state.hook) {
      const dirMap = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      const [dx, dy] = dirMap[state.hook.dir] ?? [0, 1];
      const length = Math.min(3, Math.max(1, state.hook.length)) * CELL - 10;
      ctx.save();
      ctx.strokeStyle = "#e9d39a";
      ctx.lineWidth = 2.6;
      ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = -time * 40;
      ctx.beginPath();
      ctx.moveTo(center.x + dx * 10, center.y + dy * 10);
      ctx.lineTo(center.x + dx * length, center.y + dy * length);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#fff2c4";
      ctx.beginPath();
      ctx.arc(center.x + dx * length, center.y + dy * length, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(center.x, center.y + bob);

    ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
    ctx.beginPath();
    ctx.ellipse(0, 13, 10.4, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.scale(flip, 1);

    ctx.fillStyle = "#3f6d94";
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-6.4, 1, 12.8, 9.4, 3) : ctx.rect(-6.4, 1, 12.8, 9.4);
    ctx.fill();

    ctx.fillStyle = "#e7c68f";
    ctx.beginPath();
    ctx.ellipse(-4.8, 11, 3.4, 2.2, 0, 0, Math.PI * 2);
    ctx.ellipse(4.8, 11, 3.4, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#c9a36a";
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-7, -6.4, 14, 9.6, 4) : ctx.rect(-7, -6.4, 14, 9.6);
    ctx.fill();

    ctx.fillStyle = "#f0d6a2";
    ctx.beginPath();
    ctx.arc(0, -7.6, 6.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#caa15f";
    ctx.beginPath();
    ctx.arc(0, -9.2, 7.5, Math.PI, Math.PI * 2);
    ctx.lineTo(7.5, -8.2);
    ctx.quadraticCurveTo(0, -10.4, -7.5, -8.2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#3a2a20";
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-5.2, -8.6, 10.4, 3.6, 2) : ctx.rect(-5.2, -8.6, 10.4, 3.6);
    ctx.fill();
    ctx.fillStyle = "#bde8f2";
    ctx.beginPath();
    ctx.arc(-2.4, -6.9, 1.25, 0, Math.PI * 2);
    ctx.arc(2.4, -6.9, 1.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff6d8";
    ctx.beginPath();
    ctx.arc(-2.8, -7.3, 0.42, 0, Math.PI * 2);
    ctx.arc(2.0, -7.3, 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#d5b375";
    ctx.beginPath();
    ctx.ellipse(-7.4, -0.6, 2.6, 4.2, -0.4, 0, Math.PI * 2);
    ctx.ellipse(7.4, -0.6, 2.6, 4.2, 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#a8843f";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(8.4, 0);
    ctx.lineTo(12.2, 3.4);
    ctx.stroke();
    ctx.fillStyle = "#e0bd6f";
    ctx.fillRect(11.2, 2.4, 5.4, 3.4);
    ctx.fillStyle = "#8f6a2c";
    ctx.fillRect(13.4, 5.8, 1.4, 4.2);
    ctx.restore();
    ctx.restore();
  }

  function drawParticles() {
    for (const particle of particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      if (particle.square) {
        ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
      } else {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawToasts() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const toast of toasts) {
      const alpha = Math.max(0, Math.min(1, toast.life / (toast.maxLife * 0.6)));
      ctx.globalAlpha = alpha;
      ctx.font = '700 15px "Trebuchet MS", system-ui, sans-serif';
      ctx.fillStyle = "rgba(20, 12, 6, 0.65)";
      ctx.fillText(toast.text, toast.x + 1, toast.y - (1 - toast.life / toast.maxLife) * 22 + 1);
      ctx.fillStyle = toast.color;
      ctx.fillText(toast.text, toast.x, toast.y - (1 - toast.life / toast.maxLife) * 22);
    }
    ctx.globalAlpha = 1;
  }

  function drawVignette() {
    const vignette = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.28, WIDTH / 2, HEIGHT / 2, HEIGHT * 0.85);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.55)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function draw(view, extras = {}) {
    if (!canvas || !view?.state) return;
    if (!canvas.width) resize();
    const state = view.state;
    if (lastLevel !== state.levelId) {
      lastLevel = state.levelId;
      lastChapter = state.chapter;
      particles = [];
      toasts = [];
      shake = 0;
      flash = 0;
    }

    const dt = Math.min(0.05, Math.max(0, extras.dt ?? 1 / 60));
    update(dt);

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawBackdrop();

    const theme = THEMES[Math.max(0, Math.min(THEMES.length - 1, state.chapter - 1))];
    ctx.save();
    if (shake > 0 && !reducedMotion) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    drawFrame(theme);
    ctx.save();
    roundRect(ctx, FIELD_X, FRAME_Y + 8, FIELD_W, FIELD_Y + FIELD_H - FRAME_Y - 8, 5);
    ctx.clip();
    drawSky(theme);
    drawGrid(state, theme);
    for (const rock of state.rocks) drawRock(rock, theme);
    for (const monster of state.monsters) {
      if (!monster.alive) continue;
      if (monster.type === "fygar") {
        drawFlames(state, monster);
        drawFygar(monster);
      } else {
        drawPooka(monster);
      }
    }
    drawPlayer(state);
    ctx.restore();

    ctx.save();
    const glass = ctx.createLinearGradient(FIELD_X, FIELD_Y, FIELD_X + FIELD_W, FIELD_Y + FIELD_H);
    glass.addColorStop(0, "rgba(255, 255, 255, 0.055)");
    glass.addColorStop(0.35, "rgba(255, 255, 255, 0)");
    glass.addColorStop(1, "rgba(255, 255, 255, 0.025)");
    ctx.fillStyle = glass;
    roundRect(ctx, FIELD_X, FIELD_Y, FIELD_W, FIELD_H, 5);
    ctx.fill();
    ctx.restore();

    drawParticles();
    drawToasts();
    ctx.restore();

    drawVignette();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 110, 80, ${Math.min(0.28, flash * 0.28)})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    if (state.status === STATUS_WON) {
      ctx.fillStyle = "rgba(255, 226, 160, 0.06)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    } else if (state.status === STATUS_LOST) {
      ctx.fillStyle = "rgba(40, 10, 8, 0.14)";
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
