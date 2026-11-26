// Procedural vector art for every washable object. The grime grid is built from
// SHAPES in engine.mjs, so the visible outline here follows the same normalized
// points: the painted silhouette is softened with quadratic corners but never
// pushed outside the washable mask. Details are layered inside a clip so the
// dirt and the clean paint stay registered to the same pixels.

import { SHAPES } from "./engine.mjs";

const TAU = Math.PI * 2;

// Vehicle specs use normalized coordinates. `body` walks the same corner points
// as SHAPES, so bezier softening only cuts corners inward.
const VEHICLES = {
  sedan: {
    body: [[0.06, 0.56], [0.14, 0.43], [0.36, 0.34], [0.62, 0.34], [0.79, 0.45], [0.93, 0.51], [0.95, 0.65], [0.86, 0.69], [0.13, 0.69], [0.05, 0.65]],
    wheels: [[0.26, 0.69, 0.072], [0.75, 0.69, 0.072]],
    glass: [0.34, 0.42, 0.45, 0.36, 0.58, 0.36, 0.68, 0.44, 0.68, 0.45, 0.34, 0.45],
    pillars: [[0.51, 0.36, 0.51, 0.45]],
    belt: 0.48, doors: [0.52, 0.74], mirror: [0.35, 0.445],
    front: [0.89, 0.535], rear: [0.09, 0.56], grille: [0.905, 0.575, 0.045, 0.05],
  },
  suv: {
    body: [[0.07, 0.40], [0.14, 0.23], [0.82, 0.23], [0.92, 0.34], [0.95, 0.61], [0.87, 0.68], [0.12, 0.68], [0.05, 0.60]],
    wheels: [[0.25, 0.68, 0.076], [0.77, 0.68, 0.076]],
    glass: [0.19, 0.33, 0.30, 0.26, 0.76, 0.26, 0.76, 0.36, 0.19, 0.36],
    pillars: [[0.48, 0.26, 0.48, 0.36]],
    belt: 0.40, doors: [0.48, 0.75], mirror: [0.26, 0.375],
    front: [0.90, 0.45], rear: [0.09, 0.44], grille: [0.90, 0.49, 0.045, 0.06],
  },
  van: {
    body: [[0.05, 0.34], [0.11, 0.20], [0.84, 0.20], [0.95, 0.30], [0.96, 0.64], [0.89, 0.69], [0.10, 0.69], [0.04, 0.63]],
    wheels: [[0.24, 0.69, 0.076], [0.78, 0.69, 0.076]],
    glass: [0.14, 0.31, 0.18, 0.24, 0.42, 0.24, 0.42, 0.33, 0.14, 0.33],
    pillars: [[0.30, 0.24, 0.30, 0.33], [0.56, 0.24, 0.56, 0.33]],
    belt: 0.37, doors: [0.45, 0.72], mirror: [0.155, 0.35],
    front: [0.91, 0.41], rear: [0.09, 0.40], grille: [0.91, 0.46, 0.04, 0.07],
  },
  sports: {
    body: [[0.04, 0.59], [0.20, 0.47], [0.39, 0.39], [0.58, 0.39], [0.75, 0.50], [0.94, 0.57], [0.96, 0.65], [0.86, 0.69], [0.14, 0.69], [0.03, 0.65]],
    wheels: [[0.27, 0.69, 0.068], [0.74, 0.69, 0.068]],
    glass: [0.36, 0.45, 0.44, 0.41, 0.57, 0.41, 0.68, 0.48, 0.36, 0.48],
    pillars: [],
    belt: 0.52, doors: [0.53], mirror: [0.36, 0.465],
    front: [0.90, 0.595], rear: [0.08, 0.60], grille: [0.90, 0.615, 0.04, 0.04],
  },
  pickup: {
    body: [[0.04, 0.43], [0.18, 0.31], [0.40, 0.31], [0.49, 0.42], [0.96, 0.42], [0.96, 0.63], [0.88, 0.68], [0.10, 0.68], [0.03, 0.62]],
    wheels: [[0.25, 0.68, 0.076], [0.77, 0.68, 0.076]],
    glass: [0.20, 0.40, 0.28, 0.34, 0.40, 0.34, 0.46, 0.42, 0.20, 0.42],
    pillars: [],
    belt: 0.45, doors: [0.46], mirror: [0.24, 0.415],
    front: [0.92, 0.48], rear: [0.07, 0.48], grille: [0.92, 0.52, 0.04, 0.06],
  },
  bus: {
    body: [[0.03, 0.24], [0.10, 0.16], [0.90, 0.16], [0.97, 0.25], [0.97, 0.63], [0.90, 0.70], [0.10, 0.70], [0.03, 0.63]],
    wheels: [[0.23, 0.70, 0.077], [0.79, 0.70, 0.077]],
    glass: [0.12, 0.37, 0.88, 0.37, 0.88, 0.24, 0.12, 0.24],
    pillars: [[0.25, 0.24, 0.25, 0.37], [0.40, 0.24, 0.40, 0.37], [0.55, 0.24, 0.55, 0.37], [0.70, 0.24, 0.70, 0.37]],
    belt: 0.41, doors: [0.48], mirror: [0.085, 0.345],
    front: [0.93, 0.47], rear: [0.07, 0.47], grille: [0.93, 0.51, 0.035, 0.06],
  },
};

function hexToRgb(hex) {
  const value = String(hex).replace("#", "");
  const n = parseInt(value.length === 3 ? value.split("").map((c) => c + c).join("") : value, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function shade(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (v) => Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount));
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

function line(c, x1, y1, x2, y2, color, width) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
}

function polygon(c, pts, rect) {
  c.beginPath();
  c.moveTo(rect.x + pts[0] * rect.w, rect.y + pts[1] * rect.h);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(rect.x + pts[i] * rect.w, rect.y + pts[i + 1] * rect.h);
  c.closePath();
}

function roundedBody(c, pts, rect) {
  const at = (i) => ({ x: rect.x + pts[i][0] * rect.w, y: rect.y + pts[i][1] * rect.h });
  const n = pts.length;
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const first = mid(at(n - 1), at(0));
  c.beginPath();
  c.moveTo(first.x, first.y);
  for (let i = 0; i < n; i += 1) {
    const cur = at(i);
    const next = at((i + 1) % n);
    const m = mid(cur, next);
    c.quadraticCurveTo(cur.x, cur.y, m.x, m.y);
  }
  c.closePath();
}

function drawWheel(c, cx, cy, r, rect) {
  const x = rect.x + cx * rect.w;
  const y = rect.y + cy * rect.h;
  const rad = r * rect.w;

  c.beginPath(); c.arc(x, y, rad * 1.12, 0, TAU);
  const arch = c.createRadialGradient(x, y - rad * 0.2, rad * 0.4, x, y, rad * 1.12);
  arch.addColorStop(0, "rgba(8,16,20,0.55)");
  arch.addColorStop(1, "rgba(8,16,20,0)");
  c.fillStyle = arch; c.fill();

  c.beginPath(); c.arc(x, y, rad, 0, TAU);
  const tire = c.createLinearGradient(x - rad, y - rad, x + rad, y + rad);
  tire.addColorStop(0, "#3b4449");
  tire.addColorStop(0.5, "#171d20");
  tire.addColorStop(1, "#0d1214");
  c.fillStyle = tire; c.fill();
  c.strokeStyle = "rgba(255,255,255,0.18)"; c.lineWidth = Math.max(1, rad * 0.1); c.stroke();

  c.beginPath(); c.arc(x, y, rad * 0.62, 0, TAU);
  const rim = c.createLinearGradient(x - rad, y - rad, x + rad, y + rad);
  rim.addColorStop(0, "#f3f8fa");
  rim.addColorStop(0.45, "#a9b8bd");
  rim.addColorStop(1, "#5f6d72");
  c.fillStyle = rim; c.fill();

  c.save();
  c.translate(x, y);
  for (let k = 0; k < 5; k += 1) {
    c.rotate(TAU / 5);
    c.beginPath();
    c.moveTo(-rad * 0.09, -rad * 0.12);
    c.lineTo(rad * 0.09, -rad * 0.12);
    c.lineTo(rad * 0.045, -rad * 0.55);
    c.lineTo(-rad * 0.045, -rad * 0.55);
    c.closePath();
    c.fillStyle = "rgba(36,48,54,0.85)"; c.fill();
  }
  c.restore();

  c.beginPath(); c.arc(x, y, rad * 0.17, 0, TAU);
  c.fillStyle = "#dbe5e8"; c.fill();
  c.beginPath(); c.arc(x, y, rad * 0.075, 0, TAU);
  c.fillStyle = "#36444a"; c.fill();

  c.beginPath();
  c.arc(x, y, rad * 0.88, Math.PI * 1.05, Math.PI * 1.65);
  c.strokeStyle = "rgba(255,255,255,0.22)"; c.lineWidth = Math.max(1, rad * 0.08); c.stroke();
}

function drawVehicle(c, shape, rect, base) {
  const spec = VEHICLES[shape] ?? VEHICLES.sedan;
  const px = (v) => rect.x + v * rect.w;
  const py = (v) => rect.y + v * rect.h;

  // Ground contact shadow sits outside the body, before the paint.
  const shadow = c.createRadialGradient(rect.x + rect.w * 0.5, py(0.74), rect.w * 0.08, rect.x + rect.w * 0.5, py(0.74), rect.w * 0.5);
  shadow.addColorStop(0, "rgba(12,30,36,0.38)");
  shadow.addColorStop(1, "rgba(12,30,36,0)");
  c.save();
  c.translate(rect.x + rect.w * 0.5, py(0.74));
  c.scale(1, rect.h / rect.w);
  c.translate(-(rect.x + rect.w * 0.5), -py(0.74));
  c.fillStyle = shadow;
  c.beginPath(); c.ellipse(rect.x + rect.w * 0.5, py(0.74), rect.w * 0.46, rect.w * 0.14, 0, 0, TAU); c.fill();
  c.restore();

  c.save();
  c.shadowColor = "rgba(14,34,42,0.4)";
  c.shadowBlur = rect.w * 0.035;
  c.shadowOffsetY = rect.h * 0.025;
  roundedBody(c, spec.body, rect);
  const paint = c.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  paint.addColorStop(0, shade(base, 0.42));
  paint.addColorStop(0.20, shade(base, 0.17));
  paint.addColorStop(0.52, base);
  paint.addColorStop(0.80, shade(base, -0.24));
  paint.addColorStop(1, shade(base, -0.44));
  c.fillStyle = paint; c.fill();
  c.restore();

  c.save();
  roundedBody(c, spec.body, rect);
  c.clip();

  // Environment reflection sweeping the upper panel.
  const reflection = c.createLinearGradient(rect.x, rect.y, rect.x + rect.w * 0.7, rect.y + rect.h * 0.7);
  reflection.addColorStop(0, "rgba(255,255,255,0.40)");
  reflection.addColorStop(0.28, "rgba(255,255,255,0.11)");
  reflection.addColorStop(0.55, "rgba(255,255,255,0)");
  c.fillStyle = reflection;
  c.fillRect(rect.x, rect.y, rect.w, rect.h);

  // Belt line: shadow above, highlight below.
  line(c, px(0.04), py(spec.belt), px(0.96), py(spec.belt), "rgba(8,20,26,0.14)", Math.max(1, rect.h * 0.008));
  line(c, px(0.04), py(spec.belt + 0.012), px(0.96), py(spec.belt + 0.012), "rgba(255,255,255,0.28)", Math.max(1, rect.h * 0.008));

  // Glass: tinted pane with a diagonal highlight.
  polygon(c, spec.glass, rect);
  const glass = c.createLinearGradient(0, py(0.24), 0, py(0.48));
  glass.addColorStop(0, "rgba(22,48,62,0.90)");
  glass.addColorStop(1, "rgba(78,116,132,0.82)");
  c.fillStyle = glass; c.fill();
  c.strokeStyle = "rgba(226,244,250,0.58)"; c.lineWidth = Math.max(1, rect.w * 0.003); c.stroke();
  c.save();
  polygon(c, spec.glass, rect); c.clip();
  const glare = c.createLinearGradient(px(0.30), py(0.24), px(0.62), py(0.48));
  glare.addColorStop(0, "rgba(255,255,255,0.30)");
  glare.addColorStop(0.45, "rgba(255,255,255,0.06)");
  glare.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = glare; c.fillRect(rect.x, rect.y, rect.w, rect.h);
  c.restore();
  for (const [x1, y1, x2, y2] of spec.pillars) {
    line(c, px(x1), py(y1), px(x2), py(y2), "rgba(12,28,36,0.62)", Math.max(1.5, rect.w * 0.009));
  }

  // Panel gaps and handles.
  for (const x of spec.doors) {
    line(c, px(x), py(spec.belt + 0.02), px(x), py(0.665), "rgba(10,22,28,0.34)", Math.max(1, rect.w * 0.0035));
  }
  for (const x of spec.doors) {
    c.fillStyle = "rgba(236,248,252,0.62)";
    c.fillRect(px(x - 0.035), py(spec.belt + 0.045), rect.w * 0.032, Math.max(2, rect.h * 0.012));
  }

  // Mirror.
  if (spec.mirror) {
    const mx = px(spec.mirror[0]); const my = py(spec.mirror[1]);
    line(c, mx, my, mx + rect.w * 0.012, my + rect.h * 0.012, shade(base, -0.42), Math.max(1, rect.w * 0.006));
    c.beginPath(); c.ellipse(mx, my, rect.w * 0.021, rect.h * 0.022, -0.3, 0, TAU);
    c.fillStyle = shade(base, -0.32); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 1.2; c.stroke();
    c.beginPath(); c.ellipse(mx + rect.w * 0.002, my - rect.h * 0.002, rect.w * 0.011, rect.h * 0.012, -0.3, 0, TAU);
    c.fillStyle = "rgba(198,228,240,0.92)"; c.fill();
  }

  // Lamp clusters with a soft glow.
  for (const [pos, warm] of [[spec.front, true], [spec.rear, false]]) {
    const x = px(pos[0]); const y = py(pos[1]);
    const glow = c.createRadialGradient(x, y, 0, x, y, rect.w * 0.045);
    glow.addColorStop(0, warm ? "rgba(255,246,196,0.62)" : "rgba(255,94,74,0.48)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = glow; c.fillRect(x - rect.w * 0.05, y - rect.h * 0.1, rect.w * 0.1, rect.h * 0.2);
    c.beginPath(); c.ellipse(x, y, rect.w * 0.034, rect.h * 0.028, 0, 0, TAU);
    c.fillStyle = "rgba(228,240,244,0.92)"; c.fill();
    c.beginPath(); c.ellipse(x, y, rect.w * 0.026, rect.h * 0.021, 0, 0, TAU);
    c.fillStyle = warm ? "#fff6cf" : "#ed5347"; c.fill();
    c.strokeStyle = "rgba(20,30,34,0.45)"; c.lineWidth = 1; c.stroke();
    if (warm) {
      c.beginPath(); c.arc(x + rect.w * 0.004, y - rect.h * 0.004, rect.w * 0.008, 0, TAU);
      c.fillStyle = "rgba(255,255,255,0.95)"; c.fill();
    }
  }

  // Front grille slats and lower bumper.
  if (spec.grille) {
    const [gx, gy, gw, gh] = spec.grille;
    c.fillStyle = "rgba(16,26,30,0.72)";
    c.fillRect(px(gx), py(gy), rect.w * gw, rect.h * gh);
    for (let i = 1; i < 4; i += 1) {
      line(c, px(gx + (gw * i) / 4), py(gy), px(gx + (gw * i) / 4), py(gy + gh), "rgba(200,216,220,0.45)", Math.max(1, rect.w * 0.002));
    }
  }
  c.fillStyle = "rgba(12,22,26,0.24)";
  c.fillRect(rect.x, py(0.655), rect.w, rect.h * 0.035);

  // Wheel arches first, then the wheels on top.
  for (const [wx, wy, wr] of spec.wheels) {
    const x = px(wx); const y = py(wy); const rad = wr * rect.w;
    c.beginPath(); c.arc(x, y, rad * 1.16, Math.PI, TAU);
    c.lineTo(x + rad * 1.16, y);
    c.fillStyle = "rgba(8,16,20,0.62)"; c.fill();
  }
  c.restore();

  for (const [wx, wy, wr] of spec.wheels) drawWheel(c, wx, wy, wr, rect);
}

function drawSofa(c, rect, base) {
  const px = (v) => rect.x + v * rect.w;
  const py = (v) => rect.y + v * rect.h;
  const cloth = c.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  cloth.addColorStop(0, shade(base, 0.30));
  cloth.addColorStop(0.55, base);
  cloth.addColorStop(1, shade(base, -0.30));
  const round = (x, y, w, h, r) => {
    c.beginPath(); c.roundRect(px(x), py(y), rect.w * w, rect.h * h, Math.min(rect.w * w, rect.h * h) * r);
  };
  for (const foot of [0.12, 0.88]) {
    c.fillStyle = "rgba(62,38,24,0.95)";
    c.fillRect(px(foot - 0.02), py(0.72), rect.w * 0.04, rect.h * 0.08);
  }
  round(0.09, 0.26, 0.82, 0.31, 0.22); c.fillStyle = cloth; c.fill();
  c.strokeStyle = "rgba(255,255,255,0.22)"; c.lineWidth = 2; c.stroke();
  round(0.07, 0.49, 0.86, 0.24, 0.18); c.fillStyle = shade(base, -0.08); c.fill(); c.stroke();
  for (const split of [0.37, 0.63]) {
    line(c, px(split), py(0.29), px(split), py(0.71), "rgba(30,16,10,0.24)", Math.max(1, rect.w * 0.004));
  }
  round(0.04, 0.42, 0.10, 0.31, 0.35); c.fillStyle = shade(base, -0.16); c.fill(); c.stroke();
  round(0.86, 0.42, 0.10, 0.31, 0.35); c.fillStyle = shade(base, -0.16); c.fill(); c.stroke();
  for (const [x, y] of [[0.24, 0.37], [0.76, 0.37]]) {
    round(x - 0.09, y - 0.07, 0.18, 0.16, 0.22);
    c.fillStyle = shade(base, 0.18); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.34)"; c.lineWidth = 1.5; c.stroke();
  }
}

function drawStove(c, rect, base) {
  const px = (v) => rect.x + v * rect.w;
  const py = (v) => rect.y + v * rect.h;
  const steel = c.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  steel.addColorStop(0, shade(base, 0.34));
  steel.addColorStop(0.42, base);
  steel.addColorStop(1, shade(base, -0.36));
  c.beginPath(); c.roundRect(px(0.10), py(0.24), rect.w * 0.80, rect.h * 0.54, rect.h * 0.03);
  c.fillStyle = steel; c.fill();
  c.strokeStyle = "rgba(255,255,255,0.38)"; c.lineWidth = 2; c.stroke();
  for (const [x, y] of [[0.30, 0.40], [0.70, 0.40], [0.30, 0.62], [0.70, 0.62]]) {
    c.beginPath(); c.arc(px(x), py(y), rect.w * 0.085, 0, TAU);
    c.fillStyle = "rgba(18,24,28,0.78)"; c.fill();
    c.beginPath(); c.arc(px(x), py(y), rect.w * 0.055, 0, TAU);
    c.strokeStyle = "rgba(196,212,218,0.72)"; c.lineWidth = Math.max(1.5, rect.w * 0.006); c.stroke();
    for (let k = 0; k < 4; k += 1) {
      const a = (k / 4) * TAU + 0.4;
      line(c, px(x) + Math.cos(a) * rect.w * 0.02, py(y) + Math.sin(a) * rect.h * 0.03,
        px(x) + Math.cos(a) * rect.w * 0.07, py(y) + Math.sin(a) * rect.h * 0.10,
        "rgba(178,194,200,0.55)", Math.max(1, rect.w * 0.005));
    }
  }
  c.beginPath(); c.roundRect(px(0.16), py(0.70), rect.w * 0.68, rect.h * 0.05, rect.h * 0.015);
  c.fillStyle = "rgba(28,38,44,0.85)"; c.fill();
  line(c, px(0.22), py(0.70), px(0.78), py(0.70), "rgba(240,250,252,0.7)", Math.max(1.5, rect.h * 0.012));
  for (const x of [0.44, 0.56]) {
    c.beginPath(); c.arc(px(x), py(0.28), rect.w * 0.016, 0, TAU);
    c.fillStyle = "#dbe6ea"; c.fill();
  }
}

function drawCarpet(c, rect, base) {
  const px = (v) => rect.x + v * rect.w;
  const py = (v) => rect.y + v * rect.h;
  const weave = c.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  weave.addColorStop(0, shade(base, 0.28));
  weave.addColorStop(1, shade(base, -0.28));
  c.beginPath(); c.roundRect(px(0.07), py(0.22), rect.w * 0.86, rect.h * 0.58, rect.h * 0.03);
  c.fillStyle = weave; c.fill();
  c.save();
  c.clip();
  c.strokeStyle = "rgba(255,255,255,0.09)"; c.lineWidth = 1;
  for (let i = 0; i < 30; i += 1) {
    const y = py(0.22 + (i / 30) * 0.58);
    line(c, px(0.07), y, px(0.93), y, "rgba(255,255,255,0.07)", 1);
  }
  c.strokeStyle = "rgba(255,255,255,0.36)"; c.lineWidth = Math.max(1.5, rect.w * 0.004);
  c.strokeRect(px(0.13), py(0.30), rect.w * 0.74, rect.h * 0.42);
  polygon(c, [0.50, 0.34, 0.66, 0.51, 0.50, 0.68, 0.34, 0.51], rect);
  c.strokeStyle = "rgba(255,255,255,0.30)"; c.stroke();
  c.restore();
  c.strokeStyle = "rgba(226,236,238,0.62)"; c.lineWidth = Math.max(1, rect.w * 0.003);
  for (let i = 0; i < 22; i += 1) {
    const x = px(0.09 + (i / 21) * 0.82);
    line(c, x, py(0.215), x - rect.w * 0.006, py(0.18), "rgba(236,244,246,0.55)", 1);
    line(c, x, py(0.805), x - rect.w * 0.006, py(0.84), "rgba(236,244,246,0.55)", 1);
  }
}

function drawBathtub(c, rect, base) {
  const px = (v) => rect.x + v * rect.w;
  const py = (v) => rect.y + v * rect.h;
  const shell = c.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  shell.addColorStop(0, "#ffffff");
  shell.addColorStop(0.5, shade(base, 0.16));
  shell.addColorStop(1, shade(base, -0.32));
  c.beginPath();
  c.moveTo(px(0.10), py(0.39)); c.lineTo(px(0.90), py(0.39));
  c.quadraticCurveTo(px(0.94), py(0.52), px(0.86), py(0.69));
  c.lineTo(px(0.14), py(0.69));
  c.quadraticCurveTo(px(0.06), py(0.52), px(0.10), py(0.39));
  c.closePath();
  c.fillStyle = shell; c.fill();
  c.strokeStyle = "rgba(255,255,255,0.7)"; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.ellipse(px(0.50), py(0.45), rect.w * 0.33, rect.h * 0.09, 0, 0, TAU);
  const water = c.createLinearGradient(0, py(0.36), 0, py(0.55));
  water.addColorStop(0, "rgba(120,206,234,0.92)");
  water.addColorStop(1, "rgba(48,134,170,0.92)");
  c.fillStyle = water; c.fill();
  c.strokeStyle = "rgba(255,255,255,0.72)"; c.lineWidth = 1.6; c.stroke();
  c.beginPath(); c.ellipse(px(0.42), py(0.42), rect.w * 0.12, rect.h * 0.022, -0.1, 0, TAU);
  c.fillStyle = "rgba(255,255,255,0.38)"; c.fill();
  line(c, px(0.90), py(0.30), px(0.90), py(0.40), "#c9d7dc", Math.max(2, rect.w * 0.009));
  line(c, px(0.90), py(0.31), px(0.83), py(0.31), "#c9d7dc", Math.max(2, rect.w * 0.009));
  c.beginPath(); c.arc(px(0.83), py(0.325), rect.w * 0.012, 0, TAU);
  c.fillStyle = "#e6f0f2"; c.fill();
  for (const x of [0.20, 0.80]) {
    c.fillStyle = "rgba(190,204,210,0.9)";
    c.fillRect(px(x - 0.025), py(0.68), rect.w * 0.05, rect.h * 0.06);
  }
}

function drawTable(c, rect, base) {
  const px = (v) => rect.x + v * rect.w;
  const py = (v) => rect.y + v * rect.h;
  const wood = c.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  wood.addColorStop(0, shade(base, 0.32));
  wood.addColorStop(1, shade(base, -0.30));
  for (const [x, w] of [[0.13, 0.11], [0.76, 0.11]]) {
    c.fillStyle = shade(base, -0.34);
    c.fillRect(px(x), py(0.44), rect.w * w, rect.h * 0.35);
    c.fillStyle = "rgba(255,255,255,0.16)";
    c.fillRect(px(x), py(0.44), rect.w * w * 0.28, rect.h * 0.35);
  }
  c.beginPath(); c.roundRect(px(0.05), py(0.31), rect.w * 0.90, rect.h * 0.15, rect.h * 0.025);
  c.fillStyle = wood; c.fill();
  c.save(); c.clip();
  for (let i = 0; i < 7; i += 1) {
    const y = py(0.32 + i * 0.02);
    line(c, px(0.05), y, px(0.95), y, "rgba(60,34,18,0.10)", Math.max(1, rect.h * 0.006));
  }
  c.restore();
  line(c, px(0.06), py(0.325), px(0.94), py(0.325), "rgba(255,255,255,0.42)", Math.max(1.5, rect.h * 0.012));
}

function drawWindow(c, rect, base) {
  const px = (v) => rect.x + v * rect.w;
  const py = (v) => rect.y + v * rect.h;
  const sky = c.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  sky.addColorStop(0, "#cfeaf5");
  sky.addColorStop(0.6, shade(base, 0.28));
  sky.addColorStop(1, shade(base, -0.18));
  c.fillStyle = sky; c.fillRect(px(0.12), py(0.14), rect.w * 0.76, rect.h * 0.72);
  c.save();
  c.beginPath(); c.rect(px(0.12), py(0.14), rect.w * 0.76, rect.h * 0.72); c.clip();
  const glare = c.createLinearGradient(px(0.16), py(0.14), px(0.72), py(0.82));
  glare.addColorStop(0, "rgba(255,255,255,0.62)");
  glare.addColorStop(0.35, "rgba(255,255,255,0.12)");
  glare.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = glare; c.fillRect(rect.x, rect.y, rect.w, rect.h);
  c.restore();
  c.strokeStyle = shade(base, -0.42); c.lineWidth = Math.max(3, rect.w * 0.022);
  c.strokeRect(px(0.12), py(0.14), rect.w * 0.76, rect.h * 0.72);
  line(c, px(0.50), py(0.14), px(0.50), py(0.86), shade(base, -0.42), Math.max(2, rect.w * 0.012));
  line(c, px(0.12), py(0.50), px(0.88), py(0.50), shade(base, -0.42), Math.max(2, rect.w * 0.012));
  line(c, px(0.14), py(0.16), px(0.14), py(0.84), "rgba(255,255,255,0.5)", Math.max(1, rect.w * 0.005));
}

// Path used by the renderer to clip grime; must match the engine's washable mask.
export function objectPath(c, shape, rect) {
  c.beginPath();
  for (const prim of SHAPES[shape] ?? SHAPES.sedan) {
    if (prim.kind === "rect") {
      c.rect(rect.x + prim.x * rect.w, rect.y + prim.y * rect.h, prim.w * rect.w, prim.h * rect.h);
    } else if (prim.kind === "ellipse") {
      c.moveTo(rect.x + (prim.cx + prim.rx) * rect.w, rect.y + prim.cy * rect.h);
      c.ellipse(rect.x + prim.cx * rect.w, rect.y + prim.cy * rect.h, prim.rx * rect.w, prim.ry * rect.h, 0, 0, TAU);
    } else {
      c.moveTo(rect.x + prim.pts[0][0] * rect.w, rect.y + prim.pts[0][1] * rect.h);
      for (let i = 1; i < prim.pts.length; i += 1) {
        c.lineTo(rect.x + prim.pts[i][0] * rect.w, rect.y + prim.pts[i][1] * rect.h);
      }
      c.closePath();
    }
  }
}

export function drawObject(c, shape, rect, base) {
  if (VEHICLES[shape]) { drawVehicle(c, shape, rect, base); return; }
  if (shape === "sofa") drawSofa(c, rect, base);
  else if (shape === "stove") drawStove(c, rect, base);
  else if (shape === "carpet") drawCarpet(c, rect, base);
  else if (shape === "bathtub") drawBathtub(c, rect, base);
  else if (shape === "table") drawTable(c, rect, base);
  else if (shape === "window") drawWindow(c, rect, base);
  else drawCarpet(c, rect, base);
}
