// render.mjs - canvas painter for the diorama stage.
// Everything is drawn from the level data plus the controller snapshot; no
// game rules live here.

const W = 840;
const H = 560;

const PALETTES = {
  1: {
    wallTop: "#3d2b25",
    wall: "#2f2220",
    stripe: "rgba(255, 214, 160, 0.05)",
    trim: "#6d4a31",
    floor: "#201614",
    floorLine: "rgba(255, 210, 160, 0.06)",
    glow: "rgba(255, 186, 96, 0.12)",
    accent: "#e0b062",
  },
  2: {
    wallTop: "#16323a",
    wall: "#10232a",
    stripe: "rgba(150, 240, 224, 0.05)",
    trim: "#2f6d6a",
    floor: "#0c191d",
    floorLine: "rgba(150, 240, 224, 0.08)",
    glow: "rgba(110, 230, 210, 0.12)",
    accent: "#78dfc9",
  },
  3: {
    wallTop: "#43251f",
    wall: "#2e1a17",
    stripe: "rgba(255, 190, 140, 0.04)",
    trim: "#8a4632",
    floor: "#1d100e",
    floorLine: "rgba(255, 190, 140, 0.06)",
    glow: "rgba(255, 150, 90, 0.12)",
    accent: "#e8a063",
  },
  4: {
    wallTop: "#1b2547",
    wall: "#121a33",
    stripe: "rgba(150, 190, 255, 0.05)",
    trim: "#33487c",
    floor: "#0b1020",
    floorLine: "rgba(150, 190, 255, 0.08)",
    glow: "rgba(120, 170, 255, 0.12)",
    accent: "#8fb8ff",
  },
  5: {
    wallTop: "#3a2130",
    wall: "#26141f",
    stripe: "rgba(255, 220, 150, 0.05)",
    trim: "#8d6a30",
    floor: "#180d14",
    floorLine: "rgba(255, 220, 150, 0.08)",
    glow: "rgba(255, 200, 110, 0.12)",
    accent: "#f0c96a",
  },
};

const LOOT_SHAPES = {
  pie: "round",
  donut: "ring",
  ring: "ring",
  crown: "crown",
  gold: "bars",
  sapphire: "gem",
  key: "key",
  mask: "mask",
  goblet: "goblet",
  boots: "boots",
  watch: "watch",
  cat: "cat",
  statue: "statue",
  violin: "violin",
  codex: "book",
  tiara: "crown",
  painting: "frame",
  mona: "frame",
  ledger: "book",
  diamond: "gem",
};

export function paletteFor(chapter) {
  return PALETTES[chapter] ?? PALETTES[1];
}

function rr(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function polyline(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
}

function drawRoom(ctx, palette, chapter, time) {
  const wallBottom = 382;
  const grad = ctx.createLinearGradient(0, 0, 0, wallBottom);
  grad.addColorStop(0, palette.wallTop);
  grad.addColorStop(1, palette.wall);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, wallBottom);

  // Wallpaper stripes.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, wallBottom);
  ctx.clip();
  for (let x = -20; x < W + 40; x += 46) {
    ctx.fillStyle = palette.stripe;
    ctx.fillRect(x, 0, 18, wallBottom);
  }
  // Vertical damask flecks.
  ctx.fillStyle = "rgba(255,255,255,0.035)";
  for (let x = 30; x < W; x += 92) {
    for (let y = 54; y < wallBottom - 40; y += 104) {
      ctx.beginPath();
      ctx.ellipse(x, y, 7, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Crown moulding + wainscot.
  ctx.fillStyle = palette.trim;
  ctx.fillRect(0, 0, W, 14);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 14, W, 5);
  ctx.fillStyle = palette.trim;
  ctx.fillRect(0, wallBottom - 58, W, 58);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, wallBottom - 58, W, 4);
  for (let x = 24; x < W; x += 74) {
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(x, wallBottom - 48, 46, 34);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(x + 3, wallBottom - 45, 40, 3);
  }

  // Floor with soft perspective lines.
  const floorGrad = ctx.createLinearGradient(0, wallBottom, 0, H);
  floorGrad.addColorStop(0, palette.floor);
  floorGrad.addColorStop(1, "#0a0709");
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, wallBottom, W, H - wallBottom);
  ctx.strokeStyle = palette.floorLine;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i += 1) {
    const x = (i / 10) * W;
    ctx.beginPath();
    ctx.moveTo(x, wallBottom);
    ctx.lineTo(W / 2 + (x - W / 2) * 2.4, H);
    ctx.stroke();
  }
  for (let i = 1; i <= 4; i += 1) {
    const y = wallBottom + Math.pow(i / 4, 1.8) * (H - wallBottom);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Warm ambient pool of light from the upper left.
  const glow = ctx.createRadialGradient(180, 90, 30, 180, 90, 520);
  glow.addColorStop(0, palette.glow);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Chapter set dressing.
  if (chapter === 1) {
    // Kitchen window with moonlight.
    ctx.fillStyle = "rgba(120, 170, 210, 0.10)";
    rr(ctx, 640, 70, 140, 130, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(210, 230, 255, 0.18)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(710, 70);
    ctx.lineTo(710, 200);
    ctx.moveTo(640, 135);
    ctx.lineTo(780, 135);
    ctx.stroke();
    // Hanging copper pots.
    for (let i = 0; i < 3; i += 1) {
      const x = 96 + i * 62;
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 18);
      ctx.lineTo(x, 58 + i * 6);
      ctx.stroke();
      const potGrad = ctx.createRadialGradient(x - 6, 62 + i * 6, 2, x, 70 + i * 6, 22);
      potGrad.addColorStop(0, "#c98b52");
      potGrad.addColorStop(1, "#6b3d22");
      ctx.fillStyle = potGrad;
      ctx.beginPath();
      ctx.ellipse(x, 68 + i * 6, 20, 15, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (chapter === 2) {
    // Vault door.
    ctx.fillStyle = "#1b2c30";
    rr(ctx, 676, 96, 132, 250, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(120, 220, 205, 0.35)";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = "rgba(120, 220, 205, 0.22)";
    ctx.beginPath();
    ctx.arc(742, 220, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(10, 30, 30, 0.8)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(742, 220, 22, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(742, 220);
      ctx.lineTo(742 + Math.cos((i * Math.PI) / 2) * 20, 220 + Math.sin((i * Math.PI) / 2) * 20);
      ctx.stroke();
    }
  } else if (chapter === 3) {
    // Kennel wire panel + coat rack.
    ctx.strokeStyle = "rgba(220, 160, 110, 0.22)";
    ctx.lineWidth = 2;
    for (let x = 60; x < 200; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, 60);
      ctx.lineTo(x, 240);
      ctx.stroke();
    }
    for (let y = 60; y < 240; y += 18) {
      ctx.beginPath();
      ctx.moveTo(60, y);
      ctx.lineTo(182, y);
      ctx.stroke();
    }
    // Basket.
    ctx.fillStyle = "rgba(120, 70, 40, 0.55)";
    ctx.beginPath();
    ctx.ellipse(590, 500, 96, 34, 0, Math.PI, 0);
    ctx.fill();
  } else if (chapter === 4) {
    // Tech gallery: glowing panel grid.
    for (let x = 60; x < 800; x += 120) {
      ctx.fillStyle = "rgba(120, 170, 255, 0.05)";
      rr(ctx, x, 60, 86, 120, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(140, 190, 255, 0.14)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(140, 190, 255, 0.10)";
    ctx.fillRect(0, 330, W, 3);
  } else {
    // Louvre: gilded frames + a chandelier.
    [[120, 70, 130, 96], [500, 64, 160, 110]].forEach(([x, y, w, h]) => {
      ctx.fillStyle = "rgba(20, 12, 18, 0.55)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(240, 200, 110, 0.55)";
      ctx.lineWidth = 5;
      ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = "rgba(240, 200, 110, 0.22)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 9, y + 9, w - 18, h - 18);
    });
    const chand = ctx.createRadialGradient(400, 40, 4, 400, 40, 120);
    chand.addColorStop(0, "rgba(255, 226, 150, 0.30)");
    chand.addColorStop(1, "rgba(255, 226, 150, 0)");
    ctx.fillStyle = chand;
    ctx.beginPath();
    ctx.arc(400, 40, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(240, 200, 110, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(400, 0);
    ctx.lineTo(400, 40);
    ctx.stroke();
  }

  // Dust motes drifting in the light.
  for (let i = 0; i < 26; i += 1) {
    const seed = i * 97.31;
    const x = ((seed * 3.7) % W + Math.sin(time * 0.25 + i) * 14 + W) % W;
    const y = ((seed * 5.3 + time * 9 + i * 13) % (H - 40)) + 20;
    const alpha = 0.05 + 0.05 * Math.sin(time * 0.9 + i);
    ctx.fillStyle = `rgba(255, 238, 200, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPillar(ctx, peg, palette) {
  const { x, y, r } = peg;
  const top = y - r * 1.15;
  const bottom = y + r * 1.15;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x + 6, bottom + 8, r * 1.05, r * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createLinearGradient(x - r, 0, x + r, 0);
  body.addColorStop(0, "#6f5b46");
  body.addColorStop(0.28, "#e8dfcb");
  body.addColorStop(0.55, "#fbf6e8");
  body.addColorStop(0.82, "#b6a68c");
  body.addColorStop(1, "#63523f");
  ctx.fillStyle = body;
  rr(ctx, x - r * 0.92, top, r * 1.84, bottom - top, r * 0.28);
  ctx.fill();

  // Fluting.
  ctx.strokeStyle = "rgba(90, 74, 56, 0.28)";
  ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i += 1) {
    const fx = x + (i / 2.6) * r * 0.8;
    ctx.beginPath();
    ctx.moveTo(fx, top + 10);
    ctx.lineTo(fx, bottom - 8);
    ctx.stroke();
  }

  // Cap and base.
  ctx.fillStyle = "#f4ecd8";
  ctx.beginPath();
  ctx.ellipse(x, top + 2, r * 0.96, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(60, 46, 34, 0.28)";
  ctx.beginPath();
  ctx.ellipse(x, top + 8, r * 0.9, r * 0.22, 0, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = palette.trim;
  rr(ctx, x - r * 1.06, bottom - 6, r * 2.12, r * 0.34, 4);
  ctx.fill();
  ctx.restore();
}

function drawLaser(ctx, a, b, time, active) {
  if (!active) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(255, 56, 56, 0.85)";
  ctx.shadowBlur = 18;
  ctx.strokeStyle = "rgba(255, 70, 70, 0.32)";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.strokeStyle = "#ff5a5a";
  ctx.lineWidth = 3.2;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255, 230, 230, 0.95)";
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // Emitter beads.
  for (const p of [a, b]) {
    ctx.fillStyle = "#2a1214";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff6b6b";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.4 + Math.sin(time * 6) * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWire(ctx, wire, active) {
  if (!active) return;
  const { x, y, w, h } = wire;
  ctx.save();
  ctx.fillStyle = "rgba(30, 20, 24, 0.55)";
  rr(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(180, 190, 200, 0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = "rgba(160, 200, 220, 0.28)";
  ctx.lineWidth = 1;
  for (let i = -h; i < w; i += 12) {
    ctx.beginPath();
    ctx.moveTo(x + Math.max(0, i), y + Math.max(0, -i));
    ctx.lineTo(x + Math.min(w, i + h), y + Math.min(h, h + i));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + Math.min(w, i + h), y + Math.max(0, -i));
    ctx.lineTo(x + Math.max(0, i), y + Math.min(h, h + i));
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(120, 220, 255, 0.20)";
  rr(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.restore();
}

function drawDog(ctx, dog, time) {
  const { x, y, r } = dog;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(x + 8, y + r * 0.72, r * 0.95, r * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body.
  const body = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  body.addColorStop(0, "#8d6a4c");
  body.addColorStop(1, "#553520");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.18, r * 0.88, r * 0.56, -0.08, 0, Math.PI * 2);
  ctx.fill();

  // Head.
  ctx.fillStyle = "#7c5a3f";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.52, y - r * 0.24, r * 0.46, r * 0.4, -0.15, 0, Math.PI * 2);
  ctx.fill();
  // Ears.
  ctx.fillStyle = "#4b2f1d";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.72, y - r * 0.5, r * 0.19, r * 0.3, 0.5, 0, Math.PI * 2);
  ctx.fill();
  // Snout + closed eyes.
  ctx.fillStyle = "#c9a882";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.78, y - r * 0.14, r * 0.2, r * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(20, 12, 8, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x - r * 0.56, y - r * 0.3, r * 0.09, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // Tail.
  ctx.strokeStyle = "#6b4a30";
  ctx.lineWidth = r * 0.16;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + r * 0.8, y + r * 0.1);
  ctx.quadraticCurveTo(x + r * 1.15, y - r * 0.12, x + r * 0.98, y - r * 0.42);
  ctx.stroke();

  // Snore bubbles.
  for (let i = 0; i < 3; i += 1) {
    const phase = (time * 0.8 + i * 0.5) % 1;
    const bx = x - r * 0.95 - i * 9;
    const by = y - r * 0.7 - phase * 34;
    ctx.fillStyle = `rgba(220, 235, 255, ${(0.35 * (1 - phase)).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(bx, by, 2.6 + i * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSpotlight(ctx, spot, time, active) {
  if (!active) return;
  const angle = spot.__angle;
  const spread = spot.spread ?? 0.3;
  const length = spot.length ?? 280;
  ctx.save();
  const grad = ctx.createRadialGradient(spot.x, spot.y, 8, spot.x, spot.y, length);
  grad.addColorStop(0, "rgba(255, 244, 200, 0.42)");
  grad.addColorStop(0.45, "rgba(255, 226, 150, 0.16)");
  grad.addColorStop(1, "rgba(255, 210, 120, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(spot.x, spot.y);
  ctx.arc(spot.x, spot.y, length, angle - spread, angle + spread);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 236, 170, 0.22)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(spot.x, spot.y);
  ctx.lineTo(spot.x + Math.cos(angle - spread) * length, spot.y + Math.sin(angle - spread) * length);
  ctx.moveTo(spot.x, spot.y);
  ctx.lineTo(spot.x + Math.cos(angle + spread) * length, spot.y + Math.sin(angle + spread) * length);
  ctx.stroke();

  // Lamp can.
  ctx.fillStyle = "#243247";
  rr(ctx, spot.x - 16, spot.y - 10, 32, 22, 6);
  ctx.fill();
  ctx.fillStyle = "#ffe9a8";
  ctx.beginPath();
  ctx.arc(spot.x + Math.cos(angle) * 10, spot.y + Math.sin(angle) * 10, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLoot(ctx, target, time, palette) {
  const { x, y } = target;
  const pulse = 0.5 + 0.5 * Math.sin(time * 2.4);
  const halo = ctx.createRadialGradient(x, y, 4, x, y, 62);
  halo.addColorStop(0, `rgba(255, 226, 130, ${0.34 + pulse * 0.16})`);
  halo.addColorStop(0.5, `rgba(255, 200, 90, ${0.12 + pulse * 0.06})`);
  halo.addColorStop(1, "rgba(255, 190, 60, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, 62, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#ffd86b";
  ctx.strokeStyle = "rgba(120, 70, 10, 0.65)";
  ctx.lineWidth = 2.4;
  const shape = LOOT_SHAPES[target.key] ?? "gem";
  if (shape === "round") {
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(150, 90, 20, 0.5)";
    ctx.beginPath();
    ctx.moveTo(-12, -6);
    ctx.lineTo(12, -6);
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.stroke();
  } else if (shape === "ring") {
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#ffd86b";
    ctx.stroke();
    ctx.fillStyle = "#8fe6ff";
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(7, -14);
    ctx.lineTo(0, -6);
    ctx.lineTo(-7, -14);
    ctx.closePath();
    ctx.fill();
  } else if (shape === "crown") {
    ctx.beginPath();
    ctx.moveTo(-19, 10);
    ctx.lineTo(-19, -8);
    ctx.lineTo(-9, 2);
    ctx.lineTo(0, -14);
    ctx.lineTo(9, 2);
    ctx.lineTo(19, -8);
    ctx.lineTo(19, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (shape === "book") {
    ctx.fillStyle = "#e7c979";
    rr(ctx, -18, -14, 36, 28, 3);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(90, 60, 20, 0.5)";
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(0, 14);
    ctx.stroke();
  } else if (shape === "frame") {
    ctx.fillStyle = "#d9b45c";
    rr(ctx, -22, -17, 44, 34, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(40, 30, 40, 0.75)";
    rr(ctx, -15, -11, 30, 22, 2);
    ctx.fill();
  } else if (shape === "bars") {
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i % 2 ? "#f6d06a" : "#e2b44c";
      rr(ctx, -18, -10 + i * 8, 36, 7, 2);
      ctx.fill();
    }
  } else if (shape === "key") {
    ctx.strokeStyle = "#ffd86b";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(-10, -6, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(14, 14);
    ctx.moveTo(7, 7);
    ctx.lineTo(13, 2);
    ctx.stroke();
  } else if (shape === "watch") {
    ctx.fillStyle = "#f4d071";
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(70, 45, 10, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -9);
    ctx.moveTo(0, 0);
    ctx.lineTo(6, 4);
    ctx.stroke();
  } else if (shape === "mask") {
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(70, 40, 10, 0.75)";
    ctx.beginPath();
    ctx.ellipse(-6, -4, 4, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(6, -4, 4, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === "goblet") {
    ctx.beginPath();
    ctx.moveTo(-12, -14);
    ctx.lineTo(12, -14);
    ctx.lineTo(7, 2);
    ctx.lineTo(-7, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-3, 2, 6, 12);
    ctx.fillRect(-10, 14, 20, 4);
  } else if (shape === "cat") {
    ctx.beginPath();
    ctx.ellipse(0, 4, 15, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.lineTo(-13, -18);
    ctx.lineTo(-3, -10);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(10, -6);
    ctx.lineTo(13, -18);
    ctx.lineTo(3, -10);
    ctx.closePath();
    ctx.fill();
  } else if (shape === "statue") {
    ctx.beginPath();
    ctx.arc(0, -10, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-7, -2, 14, 16);
    ctx.fillRect(-12, 14, 24, 5);
  } else if (shape === "boots") {
    ctx.beginPath();
    ctx.moveTo(-10, -16);
    ctx.lineTo(4, -16);
    ctx.lineTo(4, 6);
    ctx.lineTo(14, 6);
    ctx.lineTo(14, 16);
    ctx.lineTo(-10, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // gem
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(16, -2);
    ctx.lineTo(0, 18);
    ctx.lineTo(-16, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(-6, 0);
    ctx.lineTo(0, 18);
    ctx.moveTo(0, -18);
    ctx.lineTo(6, 0);
    ctx.lineTo(0, 18);
    ctx.stroke();
  }
  ctx.restore();

  // Floating sparkles.
  for (let i = 0; i < 5; i += 1) {
    const a = time * 0.9 + (i * Math.PI * 2) / 5;
    const rad = 34 + Math.sin(time * 1.7 + i) * 6;
    const sx = x + Math.cos(a) * rad;
    const sy = y + Math.sin(a) * rad * 0.8;
    const size = 2.4 + Math.sin(time * 3 + i) * 1.2;
    ctx.fillStyle = `rgba(255, 240, 170, ${0.3 + 0.3 * Math.sin(time * 3 + i)})`;
    ctx.beginPath();
    ctx.moveTo(sx, sy - size);
    ctx.lineTo(sx + size, sy);
    ctx.lineTo(sx, sy + size);
    ctx.lineTo(sx - size, sy);
    ctx.closePath();
    ctx.fill();
  }
}

function drawLever(ctx, lever, on, time) {
  const { x, y } = lever;
  ctx.save();
  ctx.fillStyle = on ? "rgba(90, 220, 160, 0.16)" : "rgba(255, 90, 90, 0.12)";
  ctx.beginPath();
  ctx.arc(x, y, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2b2b33";
  rr(ctx, x - 15, y - 17, 30, 34, 6);
  ctx.fill();
  ctx.strokeStyle = on ? "#63e0a5" : "#ff8080";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = on ? "#63e0a5" : "#ff8080";
  ctx.beginPath();
  ctx.arc(x, y + (on ? 5 : -5), 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#d8dbe4";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y - (on ? 6 : -6));
  ctx.lineTo(x + (on ? 9 : -9), y + (on ? 12 : 8));
  ctx.stroke();
  if (!on) {
    ctx.strokeStyle = `rgba(255, 110, 110, ${0.25 + 0.2 * Math.sin(time * 3)})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, y, 24 + Math.sin(time * 3) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function strokeArm(ctx, points, width, colorOuter, colorInner) {
  if (points.length < 2) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.save();
  ctx.translate(2, 4);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = width + 2;
  polyline(ctx, points);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = colorOuter;
  ctx.lineWidth = width + 5;
  polyline(ctx, points);
  ctx.stroke();

  ctx.strokeStyle = colorInner;
  ctx.lineWidth = width;
  polyline(ctx, points);
  ctx.stroke();

  ctx.save();
  ctx.translate(0, -width * 0.22);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = Math.max(1.5, width * 0.22);
  polyline(ctx, points);
  ctx.stroke();
  ctx.restore();
}

function drawGlove(ctx, hand, angle, scale = 1) {
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(angle * 0.35);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(2, 6, 17, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  const grad = ctx.createRadialGradient(-5, -6, 2, 0, 0, 22);
  grad.addColorStop(0, "#ff8a80");
  grad.addColorStop(0.55, "#e8453c");
  grad.addColorStop(1, "#a8241f");
  ctx.fillStyle = grad;
  rr(ctx, -15, -14, 30, 28, 12);
  ctx.fill();
  // Thumb.
  ctx.beginPath();
  ctx.ellipse(-13, 4, 7, 9, 0.5, 0, Math.PI * 2);
  ctx.fill();
  // Cuff.
  ctx.fillStyle = "#f6e9d8";
  rr(ctx, 10, -9, 8, 18, 3);
  ctx.fill();
  ctx.strokeStyle = "rgba(120, 30, 20, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-4, -9);
  ctx.quadraticCurveTo(2, 0, -4, 9);
  ctx.stroke();
  ctx.restore();
}

function drawThief(ctx, origin, look, time) {
  const { x, y } = origin;
  ctx.save();
  // Window / vent the thief leans out of.
  ctx.fillStyle = "rgba(8, 6, 10, 0.85)";
  rr(ctx, x - 44, y - 96, 78, 190, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(210, 170, 120, 0.35)";
  ctx.lineWidth = 5;
  ctx.stroke();

  const bob = Math.sin(time * 1.6) * 3;
  // Torso.
  const coat = ctx.createLinearGradient(x - 30, y - 40, x + 30, y + 60);
  coat.addColorStop(0, "#2c2f3a");
  coat.addColorStop(1, "#15171d");
  ctx.fillStyle = coat;
  rr(ctx, x - 26, y - 34 + bob, 44, 96, 16);
  ctx.fill();
  // Striped shirt.
  ctx.save();
  rr(ctx, x - 20, y - 26 + bob, 32, 60, 10);
  ctx.clip();
  ctx.fillStyle = "#f3ece0";
  ctx.fillRect(x - 22, y - 30 + bob, 40, 70);
  ctx.fillStyle = "#1c1d22";
  for (let i = 0; i < 6; i += 1) ctx.fillRect(x - 22, y - 30 + bob + i * 11, 40, 5);
  ctx.restore();

  // Head.
  const skin = ctx.createRadialGradient(x - 8, y - 60 + bob, 3, x - 2, y - 54 + bob, 24);
  skin.addColorStop(0, "#ffe0c2");
  skin.addColorStop(1, "#d7a37c");
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(x - 2, y - 54 + bob, 21, 23, 0, 0, Math.PI * 2);
  ctx.fill();
  // Mask.
  ctx.fillStyle = "#15161c";
  ctx.beginPath();
  ctx.ellipse(x - 2, y - 60 + bob, 21, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eyes.
  const blink = Math.sin(time * 2.3) > 0.97 ? 0.25 : 1;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(x - 9, y - 58 + bob, 4.4, 4.4 * blink, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 6, y - 58 + bob, 4.4, 4.4 * blink, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#20222a";
  const lookX = Math.max(-1.6, Math.min(1.6, (look.x - x) / 180));
  ctx.beginPath();
  ctx.arc(x - 9 + lookX, y - 57 + bob, 2, 0, Math.PI * 2);
  ctx.arc(x + 6 + lookX, y - 57 + bob, 2, 0, Math.PI * 2);
  ctx.fill();
  // Grin.
  ctx.strokeStyle = "rgba(90, 40, 30, 0.75)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x - 2, y - 46 + bob, 8, 0.35, Math.PI - 0.35);
  ctx.stroke();
  // Top hat.
  ctx.fillStyle = "#12131a";
  rr(ctx, x - 26, y - 78 + bob, 48, 6, 3);
  ctx.fill();
  rr(ctx, x - 15, y - 106 + bob, 30, 30, 4);
  ctx.fill();
  ctx.fillStyle = "rgba(220, 60, 60, 0.8)";
  ctx.fillRect(x - 15, y - 86 + bob, 30, 5);

  ctx.restore();
}

function drawEffects(ctx, snap, fx, time) {
  const { x, y } = snap.hand;
  if (snap.phase === "shock") {
    const t = fx.shockT ?? 0;
    const flicker = 0.4 + 0.6 * Math.abs(Math.sin(t * 26));
    ctx.save();
    ctx.strokeStyle = `rgba(255, 240, 150, ${flicker})`;
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 + t * 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const r1 = 22 + Math.sin(t * 20 + i) * 8;
      const r2 = 40 + Math.sin(t * 16 + i * 2) * 10;
      ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
      ctx.lineTo(x + Math.cos(a + 0.25) * r2, y + Math.sin(a + 0.25) * r2);
      ctx.stroke();
    }
    ctx.restore();

    // Smoke puffs.
    for (let i = 0; i < 5; i += 1) {
      const p = ((t * 0.6 + i * 0.2) % 1);
      ctx.fillStyle = `rgba(40, 40, 46, ${(0.35 * (1 - p)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x + Math.sin(i * 2.1) * 18, y - 18 - p * 46, 8 + p * 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (snap.phase === "retract" || snap.phase === "won") {
    const p = Math.min(1, (fx.grabT ?? 0) / 0.9);
    if (p < 1) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 222, 130, ${0.5 * (1 - p)})`;
      ctx.lineWidth = 3 + 6 * (1 - p);
      ctx.beginPath();
      ctx.arc(x, y, 18 + p * 70, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2 + p * 2;
        const rad = 16 + p * 60;
        ctx.fillStyle = `rgba(255, 236, 170, ${0.7 * (1 - p)})`;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * rad, y + Math.sin(a) * rad, 3 * (1 - p) + 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Alarm glow when the cord is close to something lethal.
  if (snap.alarm === 2 && snap.phase === "aim") {
    const a = 0.16 + 0.1 * Math.sin(time * 12);
    ctx.fillStyle = `rgba(255, 70, 70, ${a.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

export function drawStage(ctx, snap, options = {}) {
  const { time = 0, effects = {}, locale = "zh" } = options;
  const level = snap.level;
  const palette = paletteFor(level?.chapter ?? 1);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (effects.shake) {
    ctx.translate((Math.random() - 0.5) * effects.shake, (Math.random() - 0.5) * effects.shake);
  }

  drawRoom(ctx, palette, level?.chapter ?? 1, time);

  // Levers behind pillars.
  for (const lever of level?.levers ?? []) {
    drawLever(ctx, lever, Boolean(snap.levers?.[lever.group]), time);
  }

  for (const peg of level?.pegs ?? []) drawPillar(ctx, peg, palette);

  const shapes = options.hazards ?? null;
  for (const laser of shapes?.lasers ?? []) drawLaser(ctx, laser.a, laser.b, time, true);
  for (const wire of shapes?.wires ?? []) drawWire(ctx, wire.rect, true);
  for (const dog of level?.dogs ?? []) drawDog(ctx, dog, time);
  for (const spot of shapes?.wedges ?? []) drawSpotlight(ctx, spot.source ? { ...spot.source, __angle: spot.angle } : spot, time, true);

  if (level?.target) drawLoot(ctx, level.target, time, palette);

  // Arm.
  const path = snap.path ?? [];
  if (path.length > 1) {
    const tail = path[path.length - 1];
    const prev = path[path.length - 2];
    const angle = Math.atan2(tail.y - prev.y, tail.x - prev.x);
    strokeArm(ctx, path, 13, "#7a1a15", "#c9342b");
    drawGlove(ctx, snap.hand, angle, snap.phase === "retract" ? 1.05 : 1);
  }

  if (level?.origin) drawThief(ctx, level.origin, snap.hand, time);

  drawEffects(ctx, snap, effects, time);
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let scale = 1;

  function resize() {
    const dpr = Math.min(2.5, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width || W;
    const cssHeight = (cssWidth * H) / W;
    scale = cssWidth / W;
    canvas.width = Math.round(W * scale * dpr);
    canvas.height = Math.round(H * scale * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    return { cssWidth, cssHeight };
  }

  function toStage(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || W;
    const factor = W / width;
    return { x: (clientX - rect.left) * factor, y: (clientY - rect.top) * factor };
  }

  return {
    ctx,
    resize,
    toStage,
    draw(snap, options) {
      drawStage(ctx, snap, options);
    },
    get scale() {
      return scale;
    },
  };
}

export const STAGE_SIZE = { width: W, height: H };
