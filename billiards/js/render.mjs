// Canvas stage: walnut rails, brass pockets, emerald felt, balls and felt trails.
// Only this layer touches the 2D context; everything above it stays semantic DOM.

import {
  TABLE_W, TABLE_H, BALL_R, POCKETS, FOOT_SPOT_X,
  HEAD_STRING_X, CENTER_Y, traceShot,
} from "./engine.mjs";
import { pocketPoint } from "./tables.mjs";

export const RAIL_PAD = 3;
export const VIEW_W = TABLE_W + RAIL_PAD * 2;
export const VIEW_H = TABLE_H + RAIL_PAD * 2;

const COLORS = {
  1: ["#f3c234", "#a97b12"],
  2: ["#3b74e0", "#1d3f86"],
  3: ["#e14b3c", "#8e241b"],
  4: ["#8a4fc0", "#4d2570"],
  5: ["#f08a2c", "#9c4b10"],
  6: ["#2ea25c", "#155c31"],
  7: ["#a8403a", "#5d1f1b"],
  8: ["#20212a", "#08080c"],
  9: ["#f3c234", "#a97b12"],
  10: ["#3b74e0", "#1d3f86"],
  11: ["#e14b3c", "#8e241b"],
  12: ["#8a4fc0", "#4d2570"],
  13: ["#f08a2c", "#9c4b10"],
  14: ["#2ea25c", "#155c31"],
  15: ["#a8403a", "#5d1f1b"],
};

function feltTile(seed = 20250810) {
  const perUnit = 7;
  const w = Math.round(TABLE_W * perUnit);
  const h = Math.round(TABLE_H * perUnit);
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const c = off.getContext("2d");
  const base = c.createRadialGradient(w * 0.5, h * 0.42, w * 0.05, w * 0.5, h * 0.5, w * 0.62);
  base.addColorStop(0, "#1f7a55");
  base.addColorStop(0.55, "#175f43");
  base.addColorStop(1, "#0d4230");
  c.fillStyle = base;
  c.fillRect(0, 0, w, h);
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  c.globalAlpha = 0.06;
  for (let i = 0; i < 26000; i += 1) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 1 + rand() * 2.4;
    const ang = rand() * Math.PI;
    c.strokeStyle = rand() > 0.5 ? "#2c8f66" : "#0b3a2a";
    c.lineWidth = rand() > 0.8 ? 1.4 : 0.7;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    c.stroke();
  }
  c.globalAlpha = 1;
  return off;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let felt = null;
  let dpr = 1;
  let scale = 1;
  let ox = 0;
  let oy = 0;
  let cssW = 0;
  let cssH = 0;
  const trails = new Map();
  const dust = [];
  const sparks = [];
  const rings = [];
  const confetti = [];
  let landFlashes = [];
  let walletShake = 0;
  let reduced = false;

  function ensureFelt() {
    if (!felt) felt = feltTile();
    return felt;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(120, rect.width || canvas.clientWidth || 600);
    const h = Math.max(60, rect.height || canvas.clientHeight || 300);
    dpr = Math.min(2.5, globalThis.devicePixelRatio || 1);
    cssW = w;
    cssH = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    scale = Math.min(w / VIEW_W, h / VIEW_H);
    ox = (w - VIEW_W * scale) / 2;
    oy = (h - VIEW_H * scale) / 2;
    if (dust.length === 0) {
      for (let i = 0; i < 46; i += 1) {
        dust.push({
          x: Math.random() * VIEW_W,
          y: Math.random() * VIEW_H,
          r: 0.3 + Math.random() * 0.9,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.22,
          a: 0.1 + Math.random() * 0.22,
        });
      }
    }
  }

  // The view origin sits at (-RAIL_PAD, -RAIL_PAD): world (0,0) is the felt's
  // top-left corner, and the wood rail surrounds it on all four sides.
  function px(x) { return ox + (x + RAIL_PAD) * scale; }
  function py(y) { return oy + (y + RAIL_PAD) * scale; }
  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - ox) / scale - RAIL_PAD;
    const y = (clientY - rect.top - oy) / scale - RAIL_PAD;
    return { x, y };
  }

  function clearTrails() {
    trails.clear();
  }

  function noteHit(kind, payload) {
    if (kind === "spark") sparks.push(payload);
    if (kind === "flash") landFlashes.push(payload);
    if (kind === "shake") walletShake = Math.max(walletShake, payload ?? 1);
    if (kind === "pot") {
      const { x, y } = payload;
      rings.push({ x, y, life: 1 });
      landFlashes.push({ x, y, life: 1 });
      if (reduced) return;
      const n = 14;
      for (let i = 0; i < n; i += 1) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
        const sp = 3.5 + Math.random() * 6.5;
        sparks.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp * 0.6,
          life: 0.6 + Math.random() * 0.5,
        });
      }
    }
    if (kind === "celebrate") {
      if (reduced) return;
      rings.push({ x: TABLE_W / 2, y: TABLE_H / 2, life: 1 });
      const colors = ["#e9c777", "#7fe0b0", "#f6f1e0", "#e66a55", "#8fc7ff"];
      for (let i = 0; i < 110; i += 1) {
        confetti.push({
          x: Math.random() * TABLE_W,
          y: -1.5 + Math.random() * TABLE_H * 0.35,
          vx: (Math.random() - 0.5) * 2.2,
          vy: 1.2 + Math.random() * 2.2,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 7,
          w: 0.45 + Math.random() * 0.5,
          h: 0.22 + Math.random() * 0.3,
          color: colors[i % colors.length],
          life: 1,
        });
      }
    }
  }

  function advanceFx(dt) {
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const s = sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt * 1.6;
      if (s.life <= 0) sparks.splice(i, 1);
    }
    for (let i = landFlashes.length - 1; i >= 0; i -= 1) {
      const f = landFlashes[i];
      f.life -= dt * 2.2;
      if (f.life <= 0) landFlashes.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; i -= 1) {
      rings[i].life -= dt * 1.5;
      if (rings[i].life <= 0) rings.splice(i, 1);
    }
    for (let i = confetti.length - 1; i >= 0; i -= 1) {
      const c = confetti[i];
      c.vy += dt * 1.1;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
      c.life -= dt * 0.22;
      if (c.life <= 0 || c.y > TABLE_H + 3) confetti.splice(i, 1);
    }
    for (const [, list] of trails) {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        list[i].life -= dt * 0.9;
        if (list[i].life <= 0) list.splice(i, 1);
      }
    }
    walletShake = Math.max(0, walletShake - dt * 3.2);
    if (reduced) return;
    for (const d of dust) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.x < 0) d.x += VIEW_W;
      if (d.x > VIEW_W) d.x -= VIEW_W;
      if (d.y < 0) d.y += VIEW_H;
      if (d.y > VIEW_H) d.y -= VIEW_H;
    }
  }

  function setReduced(value) {
    reduced = Boolean(value);
  }

  function sampleTrails(balls, dt) {
    for (const b of balls) {
      if (b.potted) continue;
      const speed = Math.hypot(b.vx, b.vy);
      if (speed < 1.2) continue;
      let list = trails.get(b.id);
      if (!list) {
        list = [];
        trails.set(b.id, list);
      }
      if (list.length > 90) list.shift();
      list.push({ x: b.x, y: b.y, life: 1 });
    }
    void dt;
  }

  function drawFrame() {
    const w = cssW;
    const h = cssH;
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    // walnut body
    const body = ctx.createLinearGradient(0, 0, 0, h);
    body.addColorStop(0, "#4b2c1c");
    body.addColorStop(0.45, "#6d4227");
    body.addColorStop(1, "#38200f");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, Math.min(18, h * 0.05));
    ctx.fill();
    // bevel light on the wood
    ctx.strokeStyle = "rgba(255,214,158,0.30)";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // diamond sight markers on the wood
    ctx.fillStyle = "rgba(233, 199, 128, 0.85)";
    for (let i = 1; i <= 7; i += 1) {
      if (i === 4) continue;
      const x = ((TABLE_W * i) / 8);
      diamondMark(x, -RAIL_PAD * 0.5);
      diamondMark(x, TABLE_H + RAIL_PAD * 0.5);
    }
    for (let i = 1; i <= 3; i += 1) {
      const y = (TABLE_H * i) / 4;
      diamondMark(-RAIL_PAD * 0.5, y);
      diamondMark(TABLE_W + RAIL_PAD * 0.5, y);
    }

    // pockets are cut INTO the rail: draw them under the felt so only the
    // outer half shows as a dark notch instead of a sticker on the cloth.
    drawPockets();

    // felt panel
    const fx = px(-RAIL_PAD + RAIL_PAD);
    const fy = py(0);
    const fw = TABLE_W * scale;
    const fh = TABLE_H * scale;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(px(0), py(0), fw, fh, scale * 0.6);
    ctx.clip();
    const tile = ensureFelt();
    ctx.drawImage(tile, px(0), py(0), fw, fh);
    // lamp pool of light
    const lamp = ctx.createRadialGradient(px(TABLE_W * 0.5), py(TABLE_H * 0.42), scale * 2, px(TABLE_W * 0.5), py(TABLE_H * 0.45), scale * 34);
    lamp.addColorStop(0, "rgba(255, 214, 150, 0.20)");
    lamp.addColorStop(0.55, "rgba(255, 205, 130, 0.07)");
    lamp.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = lamp;
    ctx.fillRect(px(0), py(0), fw, fh);
    void fx;
    void fy;
    ctx.restore();

    // felt inner cushion shadow
    ctx.strokeStyle = "rgba(6, 30, 22, 0.55)";
    ctx.lineWidth = Math.max(1, scale * 0.22);
    ctx.beginPath();
    ctx.roundRect(px(0), py(0), fw, fh, scale * 0.6);
    ctx.stroke();
  }

  function diamondMark(x, y) {
    const r = scale * 0.17;
    ctx.save();
    ctx.translate(px(x), py(y));
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }

  // All six pockets share one visual radius so the table reads professional.
  const POCKET_R = 1.45;
  const POCKET_INSET = 0.18;

  function drawPockets() {
    const r = POCKET_R * scale;
    for (const p of POCKETS) {
      const cy = p.kind === "corner"
        ? p.y
        : (p.y <= TABLE_H / 2 ? -POCKET_INSET : TABLE_H + POCKET_INSET);
      const cx = p.x;
      const g = ctx.createRadialGradient(px(cx), py(cy), r * 0.2, px(cx), py(cy), r);
      g.addColorStop(0, "#04070a");
      g.addColorStop(0.78, "#0b1016");
      g.addColorStop(1, "#222c36");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px(cx), py(cy), r, 0, Math.PI * 2);
      ctx.fill();
      // brass collar: outer ring plus a faint inner highlight arc
      ctx.strokeStyle = "rgba(226, 183, 96, 0.7)";
      ctx.lineWidth = Math.max(1, scale * 0.08);
      ctx.beginPath();
      ctx.arc(px(cx), py(cy), r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 231, 170, 0.22)";
      ctx.lineWidth = Math.max(1, scale * 0.05);
      ctx.beginPath();
      ctx.arc(px(cx), py(cy), r * 0.72, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  }

  function drawHeadString() {
    ctx.strokeStyle = "rgba(255,255,255,0.13)";
    ctx.lineWidth = Math.max(1, scale * 0.05);
    ctx.beginPath();
    ctx.moveTo(px(HEAD_STRING_X), py(0));
    ctx.lineTo(px(HEAD_STRING_X), py(TABLE_H));
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.beginPath();
    ctx.arc(px(FOOT_SPOT_X), py(CENTER_Y), scale * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTrails() {
    if (trails.size === 0) return;
    ctx.save();
    // keep streaks on the cloth: never spill over rails or pockets
    ctx.beginPath();
    ctx.roundRect(px(0), py(0), TABLE_W * scale, TABLE_H * scale, scale * 0.6);
    ctx.clip();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [, list] of trails) {
      for (let i = 1; i < list.length; i += 1) {
        const a = list[i - 1];
        const b = list[i];
        const life = (a.life + b.life) / 2;
        ctx.strokeStyle = `rgba(214, 236, 220, ${0.17 * life})`;
        ctx.lineWidth = Math.max(0.5, scale * 0.32 * life);
        ctx.beginPath();
        ctx.moveTo(px(a.x), py(a.y));
        ctx.lineTo(px(b.x), py(b.y));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function ballColors(ball) {
    if (ball.kind === "cue") return ["#f6f3ea", "#c9c3b2"];
    return COLORS[ball.number] ?? ["#cccccc", "#888888"];
  }

  function drawBall(ball, opts = {}) {
    const cx = px(ball.x);
    const cy = py(ball.y);
    const r = BALL_R * scale;
    if (opts.ghost) {
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.setLineDash([scale * 0.22, scale * 0.22]);
      ctx.lineWidth = Math.max(1, scale * 0.06);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    // contact shadow
    ctx.fillStyle = "rgba(4, 18, 12, 0.42)";
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.18, cy + r * 0.3, r * 1.02, r * 0.86, 0, 0, Math.PI * 2);
    ctx.fill();

    const [light, dark] = ballColors(ball);
    const body = ctx.createRadialGradient(cx - r * 0.34, cy - r * 0.4, r * 0.12, cx, cy, r * 1.06);
    body.addColorStop(0, "#ffffff");
    body.addColorStop(0.22, light);
    body.addColorStop(0.82, light);
    body.addColorStop(1, dark);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    if (ball.kind === "stripe") {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = light;
      ctx.fillRect(cx - r, cy - r * 0.62, r * 2, r * 1.24);
      const band = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
      band.addColorStop(0, dark);
      band.addColorStop(0.5, light);
      band.addColorStop(1, dark);
      ctx.fillStyle = band;
      ctx.fillRect(cx - r, cy - r * 0.62, r * 2, r * 1.24);
      ctx.restore();
    }

    // number pip
    if (ball.number > 0) {
      ctx.fillStyle = "#fbf7ef";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ball.number === 8 ? "#14151b" : "#22242c";
      ctx.font = `600 ${Math.round(r * 0.72)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(ball.number), cx, cy + r * 0.03);
    }

    // specular highlight, no hard outline
    const spec = ctx.createRadialGradient(cx - r * 0.36, cy - r * 0.42, 0, cx - r * 0.36, cy - r * 0.42, r * 0.62);
    spec.addColorStop(0, "rgba(255,255,255,0.75)");
    spec.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = spec;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    if (opts.glow) {
      const halo = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.4);
      halo.addColorStop(0, opts.glowColor ?? "rgba(255, 216, 138, 0.34)");
      halo.addColorStop(1, "rgba(255, 216, 138, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTip(ball, spin) {
    if (!spin || spin === "center") return;
    const offset = {
      follow: [0, -0.3],
      draw: [0, 0.3],
      side: [0.28, 0],
    }[spin];
    if (!offset) return;
    const ang = 0;
    const cx = px(ball.x) + offset[0] * scale;
    const cy = py(ball.y) + offset[1] * scale;
    void ang;
    ctx.fillStyle = "rgba(255, 226, 150, 0.9)";
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1.2, scale * 0.12), 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAim(view) {
    const { aim, phase, assist, targetIds, cue } = view;
    if (!cue || cue.potted) return;
    if (phase !== "aim" && phase !== "placing") return;
    if (!assist) return;
    const hit = traceShot(view.world, aim.angle, { maxDist: 240 });
    const endX = hit ? hit.x : cue.x + Math.cos(aim.angle) * 6;
    const endY = hit ? hit.y : cue.y + Math.sin(aim.angle) * 6;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 240, 205, 0.5)";
    ctx.setLineDash([scale * 0.4, scale * 0.36]);
    ctx.lineWidth = Math.max(1, scale * 0.06);
    ctx.beginPath();
    ctx.moveTo(px(cue.x), py(cue.y));
    ctx.lineTo(px(endX), py(endY));
    ctx.stroke();
    ctx.restore();

    if (hit && hit.type === "ball") {
      drawBall({ x: hit.x, y: hit.y, number: 0, kind: "cue" }, { ghost: true });
      if (targetIds?.has(hit.ball.id)) {
        drawPocketPath(hit.ball, cue);
      }
    }
  }

  function drawPocketPath(target, cue) {
    const dir = Math.atan2(cue.y - target.y, cue.x - target.x);
    const nx = Math.cos(dir);
    const ny = Math.sin(dir);
    let best = null;
    for (const p of POCKETS) {
      const point = pocketPoint(p);
      const vx = point.x - target.x;
      const vy = point.y - target.y;
      const len = Math.hypot(vx, vy) || 1;
      // Only highlight pockets the object ball is driven toward: the cue has to
      // sit behind it, so the pot direction and the cue direction oppose.
      const cos = (vx / len) * nx + (vy / len) * ny;
      if (cos > -0.9) continue;
      if (!best || len < best.len) best = { tx: point.x, ty: point.y, len };
    }
    if (!best) return;
    ctx.save();
    ctx.strokeStyle = "rgba(226, 183, 96, 0.34)";
    ctx.setLineDash([scale * 0.5, scale * 0.5]);
    ctx.lineWidth = Math.max(1, scale * 0.07);
    ctx.beginPath();
    ctx.moveTo(px(target.x), py(target.y));
    ctx.lineTo(px(best.tx), py(best.ty));
    ctx.stroke();
    ctx.restore();
  }

  function drawCue(view) {
    const { aim, phase, pull, cue } = view;
    if (!cue || cue.potted) return;
    if (phase !== "aim" && phase !== "placing") return;
    const back = 0.8 + pull * 5.5;
    const len = 15;
    const cx = cue.x - Math.cos(aim.angle) * (BALL_R * 2 + back);
    const cy = cue.y - Math.sin(aim.angle) * (BALL_R * 2 + back);
    const ex = cx - Math.cos(aim.angle) * len;
    const ey = cy - Math.sin(aim.angle) * len;
    const grad = ctx.createLinearGradient(px(cx), py(cy), px(ex), py(ey));
    grad.addColorStop(0, "#f0d9a8");
    grad.addColorStop(0.18, "#d9a95f");
    grad.addColorStop(1, "#6b3f21");
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(2, scale * 0.34);
    ctx.beginPath();
    ctx.moveTo(px(cx), py(cy));
    ctx.lineTo(px(ex), py(ey));
    ctx.stroke();
    // ferrule
    ctx.strokeStyle = "rgba(38, 44, 56, 0.9)";
    ctx.lineWidth = Math.max(2, scale * 0.36);
    ctx.beginPath();
    ctx.moveTo(px(cx), py(cy));
    ctx.lineTo(px(cx + Math.cos(aim.angle) * 0.5), py(cy + Math.sin(aim.angle) * 0.5));
    ctx.stroke();
    ctx.restore();
  }

  function drawFx() {
    for (const f of landFlashes) {
      const r = BALL_R * scale * (2.4 - f.life * 1.2);
      const g = ctx.createRadialGradient(px(f.x), py(f.y), 0, px(f.x), py(f.y), Math.max(1, r));
      g.addColorStop(0, `rgba(255, 232, 176, ${0.42 * f.life})`);
      g.addColorStop(1, "rgba(255, 232, 176, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px(f.x), py(f.y), Math.max(1, r), 0, Math.PI * 2);
      ctx.fill();
    }
    for (const s of sparks) {
      ctx.fillStyle = `rgba(255, 214, 140, ${Math.max(0, s.life)})`;
      ctx.beginPath();
      ctx.arc(px(s.x), py(s.y), Math.max(0.6, scale * 0.09 * s.life), 0, Math.PI * 2);
      ctx.fill();
    }
    // pot / celebration shockwave rings
    for (const r of rings) {
      const radius = (0.5 + (1 - r.life) * 2.6) * scale;
      ctx.strokeStyle = `rgba(233, 199, 128, ${0.75 * r.life})`;
      ctx.lineWidth = Math.max(1, scale * 0.14 * r.life);
      ctx.beginPath();
      ctx.arc(px(r.x), py(r.y), radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 240, 205, ${0.35 * r.life})`;
      ctx.lineWidth = Math.max(1, scale * 0.07 * r.life);
      ctx.beginPath();
      ctx.arc(px(r.x), py(r.y), radius * 0.62, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const d of dust) {
      ctx.fillStyle = `rgba(255, 228, 176, ${d.a})`;
      ctx.beginPath();
      ctx.arc(px(d.x - RAIL_PAD), py(d.y - RAIL_PAD), Math.max(0.5, scale * d.r * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawConfetti() {
    if (confetti.length === 0) return;
    for (const c of confetti) {
      ctx.save();
      ctx.translate(px(c.x), py(c.y));
      ctx.rotate(c.rot);
      ctx.globalAlpha = Math.min(1, c.life * 1.7);
      ctx.fillStyle = c.color;
      const w = c.w * scale;
      const h = c.h * scale;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function draw(view, dt = 1 / 60) {
    advanceFx(dt);
    sampleTrails(view.world.balls, dt);
    if (walletShake > 0) {
      const k = walletShake * 0.35;
      ctx.save();
      ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    }
    drawFrame();
    drawHeadString();
    drawTrails();
    drawFx();

    const legal = view.targetIds ?? new Set();
    const moving = view.world.balls.filter((b) => !b.potted).sort((a, b) => a.id - b.id);
    for (const b of moving) {
      drawBall(b, { glow: legal.has(b.id) && view.phase === "aim" });
    }
    drawAim(view);
    drawTip(view.cue, view.spinPreview ? view.aim.spin : null);
    drawCue(view);
    drawConfetti();
    if (walletShake > 0) ctx.restore();
  }

  return { resize, draw, clearTrails, noteHit, toWorld, setReduced, size: () => ({ w: cssW, h: cssH, scale }) };
}
