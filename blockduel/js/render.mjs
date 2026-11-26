// 双子赛博机台的 Canvas 2D 渲染层：双矩阵、随机体预览、垃圾警戒柱、
// 中轴激光管道与对轰粒子。唯一允许触碰 Canvas 的文件。

const W = 840;
const H = 560;
const CELL = 24;
const BOARD_W = CELL * 10;
const BOARD_H = CELL * 20;
const TOP = 56;

const GEO = {
  w: W,
  h: H,
  cell: CELL,
  top: TOP,
  boardW: BOARD_W,
  boardH: BOARD_H,
  p1: { boardX: 88, gaugeX: 336, panelX: 12 },
  p2: { boardX: 512, gaugeX: 484, panelX: 760 },
  conduitX: 364,
  conduitW: 112,
};

const THEME = {
  0: { main: "#ff4757", deep: "#7f1220", soft: "rgba(255,71,87,0.22)" },
  1: { main: "#3b9dff", deep: "#123a78", soft: "rgba(59,157,255,0.22)" },
};

const STONE = "#4a4b52";

function rgba(hex, alpha) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function mix(hex, target, amount) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const tr = target === "white" ? 255 : 0;
  const t = amount;
  const nr = Math.round(r + (tr - r) * t);
  const ng = Math.round(g + (tr - g) * t);
  const nb = Math.round(b + (tr - b) * t);
  return `rgb(${nr},${ng},${nb})`;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function block(ctx, x, y, size, color, alpha = 1, glow = 0) {
  const inset = 1.5;
  const w = size - inset * 2;
  const base = color === "G" ? STONE : color;
  ctx.globalAlpha = alpha;
  if (glow > 0) {
    ctx.shadowColor = rgba(base.startsWith("#") ? base : "#ffffff", 0.75);
    ctx.shadowBlur = glow;
  }
  const grad = ctx.createLinearGradient(x, y, x, y + size);
  grad.addColorStop(0, mix(base.startsWith("#") ? base : "#4a4b52", "white", 0.34));
  grad.addColorStop(0.55, base.startsWith("#") ? base : "#4a4b52");
  grad.addColorStop(1, mix(base.startsWith("#") ? base : "#4a4b52", "black", 0.28));
  ctx.fillStyle = grad;
  roundRect(ctx, x + inset, y + inset, w, w, 4);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";

  ctx.fillStyle = "rgba(255,255,255,0.22)";
  roundRect(ctx, x + inset + 2, y + inset + 2, w - 4, size * 0.3, 3);
  ctx.fill();

  if (color === "G") {
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 5);
    ctx.lineTo(x + size - 8, y + size - 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + size - 7, y + 7);
    ctx.lineTo(x + 9, y + size - 7);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(0,0,0,0.36)";
  ctx.lineWidth = 1;
  roundRect(ctx, x + inset, y + inset, w, w, 4);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function pieceBounds(cells) {
  let minX = 9;
  let maxX = 0;
  let minY = 9;
  let maxY = 0;
  for (const [x, y] of cells) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function previewPiece(ctx, cells, centerX, centerY, cellSize, color) {
  const b = pieceBounds(cells);
  const ox = centerX - (b.w * cellSize) / 2 - b.minX * cellSize;
  const oy = centerY - (b.h * cellSize) / 2 - b.minY * cellSize;
  for (const [x, y] of cells) {
    block(ctx, ox + x * cellSize, oy + y * cellSize, cellSize, color, 1, 0);
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let scale = 1;
  let time = 0;
  let reduced = false;
  const fx = {
    lasers: [],
    particles: [],
    shocks: [],
    shake: [0, 0],
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(280, rect.width || W);
    const cssH = cssW * (H / W);
    const dpr = Math.min(2, (typeof devicePixelRatio === "number" && devicePixelRatio) || 1);
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    scale = canvas.width / W;
  }

  function addLaser(from) {
    fx.lasers.push({ from, t: 0, dur: reduced ? 0.12 : 0.46, arrived: false });
  }

  function addImpact(side, rows = 1) {
    const x = side === 0 ? GEO.p1.boardX + BOARD_W / 2 : GEO.p2.boardX + BOARD_W / 2;
    fx.shocks.push({ x, y: TOP + BOARD_H - 16, t: 0, dur: 0.55, color: THEME[side].main });
    fx.shake[side] = Math.min(10, 4 + rows * 1.2);
  }

  function burst(side, count = 18, hue = null) {
    const color = hue ?? THEME[side].main;
    const x = side === 0 ? GEO.p1.boardX + BOARD_W : GEO.p2.boardX;
    const y = TOP + BOARD_H - 22;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.random() * Math.PI) - Math.PI / 2;
      const speed = 80 + Math.random() * 260;
      fx.particles.push({
        x: x + (side === 0 ? 6 : -6),
        y,
        vx: (side === 0 ? -1 : 1) * Math.abs(Math.cos(angle)) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0.35 + Math.random() * 0.5,
        max: 0.85,
        size: 1.5 + Math.random() * 2.6,
        color,
      });
    }
  }

  function clearFx() {
    fx.lasers.length = 0;
    fx.particles.length = 0;
    fx.shocks.length = 0;
    fx.shake = [0, 0];
  }

  function drawBackdrop() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0c0f17");
    grad.addColorStop(0.6, "#080b12");
    grad.addColorStop(1, "#06080d");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const glowL = ctx.createRadialGradient(210, 300, 20, 210, 300, 300);
    glowL.addColorStop(0, "rgba(255,71,87,0.11)");
    glowL.addColorStop(1, "rgba(255,71,87,0)");
    ctx.fillStyle = glowL;
    ctx.fillRect(0, 0, W, H);
    const glowR = ctx.createRadialGradient(630, 300, 20, 630, 300, 300);
    glowR.addColorStop(0, "rgba(59,157,255,0.11)");
    glowR.addColorStop(1, "rgba(59,157,255,0)");
    ctx.fillStyle = glowR;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(255,255,255,0.028)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 21) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += 21) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    const vignette = ctx.createRadialGradient(W / 2, H / 2, 220, W / 2, H / 2, 560);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  function drawConduit() {
    const x = GEO.conduitX;
    const w = GEO.conduitW;
    ctx.fillStyle = "rgba(10,14,22,0.82)";
    roundRect(ctx, x, TOP + 8, w, BOARD_H + 18, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(120,190,255,0.14)";
    ctx.lineWidth = 1;
    roundRect(ctx, x, TOP + 8, w, BOARD_H + 18, 16);
    ctx.stroke();

    const flow = ctx.createLinearGradient(x, TOP, x + w, TOP + BOARD_H);
    flow.addColorStop(0, "rgba(255,71,87,0.16)");
    flow.addColorStop(0.5, "rgba(150,120,255,0.10)");
    flow.addColorStop(1, "rgba(59,157,255,0.16)");
    ctx.fillStyle = flow;
    ctx.fillRect(x + 6, TOP + 20, w - 12, BOARD_H - 6);

    const mid = x + w / 2;
    ctx.save();
    ctx.translate(mid, TOP + 250);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(-14, -14, 28, 28);
    ctx.fillStyle = THEME[0].main;
    ctx.fillRect(-14, -14, 14, 28);
    ctx.fillStyle = THEME[1].main;
    ctx.fillRect(0, -14, 14, 28);
    ctx.restore();

    for (let i = 0; i < 7; i += 1) {
      const offset = ((time * 90) + i * 46) % (BOARD_H + 10);
      const y = TOP + 18 + offset;
      const side = i % 2 === 0 ? THEME[0].main : THEME[1].main;
      ctx.strokeStyle = rgba(side.startsWith("#") ? side : "#ffffff", 0.28);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mid - 18, y);
      ctx.lineTo(mid + 18, y);
      ctx.stroke();
    }
  }

  function drawGarbageGauge(side, board, labels) {
    const theme = THEME[side];
    const x = side === 0 ? GEO.p1.gaugeX : GEO.p2.gaugeX;
    const slot = 22;
    const gap = 2;
    const count = Math.min(20, board.pending ?? 0);

    ctx.fillStyle = "rgba(8,10,16,0.9)";
    roundRect(ctx, x, TOP, 20, BOARD_H, 10);
    ctx.fill();
    ctx.strokeStyle = rgba(theme.main, 0.32);
    ctx.lineWidth = 1;
    roundRect(ctx, x, TOP, 20, BOARD_H, 10);
    ctx.stroke();

    for (let i = 0; i < 20; i += 1) {
      const y = TOP + BOARD_H - (i + 1) * (slot + gap) + gap;
      const filled = i < count;
      const danger = (board.pendingTimer ?? 0) < 0.5 && count >= 6;
      const pulse = danger ? 0.55 + Math.sin(time * 22) * 0.35 : 1;
      ctx.fillStyle = filled
        ? rgba(i >= 16 ? "#ff2d55" : i >= 10 ? "#ff7a45" : theme.main, 0.92 * pulse)
        : "rgba(255,255,255,0.05)";
      roundRect(ctx, x + 3, y, 14, slot, 4);
      ctx.fill();
    }

    const cap = Math.max(0, count);
    if (cap > 0) {
      const y = TOP + BOARD_H - cap * (slot + gap) + gap - 4;
      ctx.fillStyle = THEME[side].main;
      ctx.fillRect(x - 2, y, 24, 2);
    }

    if (labels?.garbage) {
      ctx.save();
      // 左板标签向左展开、右板标签向右收边，避免英文 GARBAGE 压到板头队名。
      ctx.translate(side === 0 ? x : x + 22, TOP - 12);
      ctx.fillStyle = "rgba(255,255,255,0.42)";
      ctx.font = "600 9px system-ui, sans-serif";
      ctx.textAlign = side === 0 ? "left" : "right";
      ctx.fillText(labels.garbage, 0, 0);
      ctx.restore();
    }
  }

  function drawBoard(side, board, labels) {
    const theme = THEME[side];
    const bx = side === 0 ? GEO.p1.boardX : GEO.p2.boardX;
    const shake = reduced ? 0 : fx.shake[side];
    ctx.save();
    if (shake > 0.4) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    ctx.fillStyle = "rgba(4,6,10,0.94)";
    roundRect(ctx, bx - 8, TOP - 8, BOARD_W + 16, BOARD_H + 16, 12);
    ctx.fill();
    ctx.strokeStyle = rgba(theme.main, 0.55);
    ctx.lineWidth = 2;
    roundRect(ctx, bx - 8, TOP - 8, BOARD_W + 16, BOARD_H + 16, 12);
    ctx.stroke();
    ctx.strokeStyle = rgba(theme.main, 0.18);
    ctx.lineWidth = 5;
    roundRect(ctx, bx - 12, TOP - 12, BOARD_W + 24, BOARD_H + 24, 15);
    ctx.stroke();

    const inner = ctx.createLinearGradient(bx, TOP, bx, TOP + BOARD_H);
    inner.addColorStop(0, "rgba(18,23,36,0.9)");
    inner.addColorStop(1, "rgba(8,11,18,0.96)");
    ctx.fillStyle = inner;
    ctx.fillRect(bx, TOP, BOARD_W, BOARD_H);

    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let x = 1; x < 10; x += 1) {
      ctx.beginPath();
      ctx.moveTo(bx + x * CELL, TOP);
      ctx.lineTo(bx + x * CELL, TOP + BOARD_H);
      ctx.stroke();
    }
    for (let y = 1; y < 20; y += 1) {
      ctx.beginPath();
      ctx.moveTo(bx, TOP + y * CELL);
      ctx.lineTo(bx + BOARD_W, TOP + y * CELL);
      ctx.stroke();
    }

    const grid = board.grid;
    for (let y = 0; y < grid.length; y += 1) {
      const row = grid[y];
      for (let x = 0; x < row.length; x += 1) {
        const value = row[x];
        if (!value) continue;
        block(ctx, bx + x * CELL, TOP + y * CELL, CELL, value, 1, 0);
      }
    }

    if (board.ghost) {
      const ghostColor = board.active ? colorOf(board.active.type) : theme.main;
      for (const [cx, cy] of ghostCells(board.ghost)) {
        const x = bx + cx * CELL;
        const y = TOP + cy * CELL;
        if (cy < 0) continue;
        ctx.strokeStyle = rgba(ghostColor, 0.5);
        ctx.lineWidth = 1.5;
        roundRect(ctx, x + 3, y + 3, CELL - 6, CELL - 6, 4);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        roundRect(ctx, x + 3, y + 3, CELL - 6, CELL - 6, 4);
        ctx.fill();
      }
    }

    if (board.active) {
      const color = colorOf(board.active.type);
      for (const [cx, cy] of ghostCells(board.active)) {
        const x = bx + cx * CELL;
        const y = TOP + cy * CELL;
        if (cy < 0 || cy >= 20) continue;
        block(ctx, x, y, CELL, color, 1, 12);
      }
    }

    if (labels?.player) {
      ctx.fillStyle = rgba(theme.main, 0.85);
      ctx.font = "700 11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(labels.player, bx + 2, TOP - 16);
    }
    if (labels?.ai) {
      ctx.fillStyle = "rgba(255,255,255,0.42)";
      ctx.font = "600 10px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(labels.ai, bx + BOARD_W - 2, TOP - 16);
    }
    ctx.restore();

    const height = stackHeight(grid);
    if (height >= 16) {
      const warn = 0.25 + (height - 15) * 0.12;
      ctx.fillStyle = `rgba(255,45,85,${Math.min(0.55, warn)})`;
      ctx.fillRect(bx, TOP, BOARD_W, 3);
    }
  }

  function drawPanels(side, board, labels) {
    const theme = THEME[side];
    const px = side === 0 ? GEO.p1.panelX : GEO.p2.panelX;
    const pw = 68;

    ctx.fillStyle = "rgba(9,12,19,0.86)";
    roundRect(ctx, px, TOP, pw, 84, 10);
    ctx.fill();
    ctx.strokeStyle = rgba(theme.main, 0.28);
    ctx.lineWidth = 1;
    roundRect(ctx, px, TOP, pw, 84, 10);
    ctx.stroke();

    if (labels?.hold) {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "600 9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(labels.hold, px + pw / 2, TOP + 14);
    }
    if (board.hold) {
      const cells = pieceCells(board.hold, 0);
      previewPiece(ctx, cells, px + pw / 2, TOP + 52, 12, colorOf(board.hold));
      if (board.holdUsed) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        roundRect(ctx, px + 2, TOP + 20, pw - 4, 62, 8);
        ctx.fill();
      }
    }

    ctx.fillStyle = "rgba(9,12,19,0.86)";
    roundRect(ctx, px, TOP + 96, pw, 292, 10);
    ctx.fill();
    ctx.strokeStyle = rgba(theme.main, 0.22);
    ctx.lineWidth = 1;
    roundRect(ctx, px, TOP + 96, pw, 292, 10);
    ctx.stroke();

    if (labels?.next) {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "600 9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(labels.next, px + pw / 2, TOP + 110);
    }
    const queue = board.queue ?? [];
    for (let i = 0; i < Math.min(4, queue.length); i += 1) {
      const type = queue[i];
      const cells = pieceCells(type, 0);
      const cy = TOP + 142 + i * 70;
      if (i === 0) {
        ctx.fillStyle = rgba(theme.main, 0.08);
        roundRect(ctx, px + 4, cy - 24, pw - 8, 52, 8);
        ctx.fill();
      }
      previewPiece(ctx, cells, px + pw / 2, cy, 11, colorOf(type));
    }
  }

  function updateFx(dt) {
    time += dt;
    for (let i = fx.lasers.length - 1; i >= 0; i -= 1) {
      const laser = fx.lasers[i];
      laser.t += dt;
      if (laser.t >= laser.dur) {
        fx.lasers.splice(i, 1);
        continue;
      }
      if (!laser.arrived && laser.t / laser.dur > 0.82) {
        laser.arrived = true;
        burst(1 - laser.from, 22, THEME[1 - laser.from].main);
        addImpact(1 - laser.from, 2);
      }
    }
    for (let i = fx.particles.length - 1; i >= 0; i -= 1) {
      const p = fx.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        fx.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
    }
    for (let i = fx.shocks.length - 1; i >= 0; i -= 1) {
      const s = fx.shocks[i];
      s.t += dt;
      if (s.t >= s.dur) fx.shocks.splice(i, 1);
    }
    fx.shake[0] *= Math.pow(0.001, dt);
    fx.shake[1] *= Math.pow(0.001, dt);
  }

  function drawFx() {
    for (const laser of fx.lasers) {
      const fromX = laser.from === 0 ? GEO.p1.boardX + BOARD_W - 4 : GEO.p2.boardX + 4;
      const toX = laser.from === 0 ? GEO.p2.boardX + 4 : GEO.p1.boardX + BOARD_W - 4;
      const y = TOP + BOARD_H - 26;
      const progress = Math.min(1, laser.t / laser.dur);
      const head = fromX + (toX - fromX) * progress;
      const tail = fromX + (head - fromX) * 0.72;
      const color = THEME[laser.from].main;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const beam = ctx.createLinearGradient(tail, y, head, y);
      beam.addColorStop(0, rgba(color, 0));
      beam.addColorStop(0.6, rgba(color, 0.5));
      beam.addColorStop(1, rgba("#ffffff", 0.95));
      ctx.strokeStyle = beam;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(tail, y);
      ctx.lineTo(head, y);
      ctx.stroke();
      ctx.strokeStyle = rgba(color, 0.85);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tail, y);
      ctx.lineTo(head, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.arc(head, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const p of fx.particles) {
      const alpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = rgba(p.color, alpha);
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    for (const s of fx.shocks) {
      const progress = s.t / s.dur;
      ctx.strokeStyle = rgba(s.color, Math.max(0, 1 - progress));
      ctx.lineWidth = 3 * (1 - progress) + 1;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 20 + progress * 120, 8 + progress * 40, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function draw(snapshot, dt, view = {}) {
    reduced = Boolean(view.reduceMotion);
    resizeIfNeeded();
    updateFx(dt);
    if (reduced) {
      fx.shake[0] = 0;
      fx.shake[1] = 0;
    }
    const s = scale;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawBackdrop();
    drawConduit();
    const boards = snapshot.boards ?? [];
    const labels = view.labels ?? {};
    for (let side = 0; side < 2; side += 1) {
      const board = boards[side];
      if (!board) continue;
      drawGarbageGauge(side, board, { garbage: labels.garbage });
      drawBoard(side, board, {
        player: side === 0 ? labels.p1 : labels.p2,
        ai: board.isAi ? labels.ai : "",
      });
      drawPanels(side, board, { hold: labels.hold, next: labels.next });
    }
    drawFx();

    if (snapshot.phase === "series_end") {
      const tint = THEME[snapshot.winner ?? 0].main;
      ctx.fillStyle = rgba(tint, 0.06);
      ctx.fillRect(0, 0, W, H);
    }
  }

  function resizeIfNeeded() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(2, (typeof devicePixelRatio === "number" && devicePixelRatio) || 1);
    const targetW = Math.round(rect.width * dpr);
    if (Math.abs(canvas.width - targetW) > 2) resize();
  }

  resize();
  return { resize, draw, addLaser, addImpact, burst, clearFx, geometry: GEO };
}

function colorOf(type) {
  const map = {
    I: "#22d3ee",
    J: "#3b6cf6",
    L: "#f59e0b",
    O: "#facc15",
    S: "#34d399",
    T: "#a855f7",
    Z: "#f43f5e",
  };
  return map[type] ?? "#ffffff";
}

function pieceCells(type, rot) {
  const shapes = {
    I: [
      [[0, 1], [1, 1], [2, 1], [3, 1]],
      [[2, 0], [2, 1], [2, 2], [2, 3]],
      [[0, 2], [1, 2], [2, 2], [3, 2]],
      [[1, 0], [1, 1], [1, 2], [1, 3]],
    ],
    J: [
      [[0, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [2, 2]],
      [[0, 0], [1, 0], [1, 1], [1, 2]],
    ],
    L: [
      [[2, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [0, 2]],
      [[1, 0], [0, 1], [1, 1], [1, 2]],
    ],
    O: [
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
    ],
    S: [
      [[1, 0], [2, 0], [0, 1], [1, 1]],
      [[1, 0], [1, 1], [2, 1], [2, 2]],
      [[1, 1], [2, 1], [0, 2], [1, 2]],
      [[0, 0], [0, 1], [1, 1], [1, 2]],
    ],
    T: [
      [[0, 1], [1, 1], [2, 1], [1, 0]],
      [[1, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [1, 2]],
      [[1, 0], [0, 1], [1, 1], [1, 2]],
    ],
    Z: [
      [[0, 0], [1, 0], [1, 1], [2, 1]],
      [[2, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [1, 2], [2, 2]],
      [[0, 0], [1, 0], [0, 1], [1, 2]],
    ],
  };
  return (shapes[type] ?? shapes.O)[((rot % 4) + 4) % 4];
}

function ghostCells(piece) {
  return pieceCells(piece.type, piece.rot).map(([x, y]) => [piece.x + x, piece.y + y]);
}

function stackHeight(grid) {
  for (let y = 0; y < grid.length; y += 1) {
    if (grid[y].some((cell) => cell !== 0)) return grid.length - y;
  }
  return 0;
}
