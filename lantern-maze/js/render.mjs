// render.mjs —— 唯一碰 canvas 的层：纸巷夜色的静态屏风 + 光尘/灯灯/影魅/粒子/夜雾/天亮反转。
// 不改动 state（只读），不参与判定；一切视觉口径来自 engine 的只读查询。

import {
  DIRS,
  NONE,
  WALL,
  DOOR,
  HOUSE,
  DOT,
  PEARL,
  charAt,
  isWalkableTile,
  entPos,
  dotAt,
  visionRadius,
  SPAWN,
  FRUIT,
} from "./engine.mjs";

export const TILE = 28;

export const PALETTE = {
  red: "#ff5b4a",
  pink: "#ff9ecb",
  cyan: "#48e0d6",
  orange: "#ffb14e",
  violet: "#b58cff",
  lime: "#a6e85a",
  gray: "#b9c2d2",
};

const NIGHT = {
  sky0: "#0b1026",
  sky1: "#141d3f",
  wall0: "#2b3a72",
  wall1: "#151d40",
  wallEdge: "rgba(255, 214, 150, 0.22)",
  dot: "#ffd98a",
  pearl: "#fff4d2",
  player: "#ffcf6b",
  fog: "6, 10, 26",
  dawn: "255, 196, 104",
};

const DAWN = {
  wall0: "#e8c48a",
  wall1: "#a5702f",
  wallEdge: "rgba(255, 255, 255, 0.5)",
  dot: "#7a4b13",
  pearl: "#fffaf0",
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixRgb(c1, c2, t) {
  return [Math.round(lerp(c1[0], c2[0], t)), Math.round(lerp(c1[1], c2[1], t)), Math.round(lerp(c1[2], c2[2], t))];
}

function rgbStr(c, a = 1) {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}

const NIGHT_RGB = [11, 16, 38];
const DAWN_RGB = [86, 58, 16];

function rounded(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** 墙体邻接：判断某格某向是否也是墙，用于把屏风连成整片 */
function solidAt(layout, x, y) {
  const ch = charAt(layout, x, y);
  return !isWalkableTile(ch) && ch !== HOUSE && ch !== DOOR;
}

export function createRenderer(canvas, { reducedMotion = false } = {}) {
  const ctx = canvas ? canvas.getContext("2d") : null;
  let layoutKey = "";
  let staticLayer = null;
  let dpr = 1;
  let W = 0;
  let H = 0;
  let particles = [];
  let shakeMs = 0;
  let shakeAmp = 0;
  let flashMs = 0;
  let time = 0;
  const motes = [];

  function resize() {
    if (!canvas || !ctx) return;
    dpr = Math.max(1, Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1));
    const rect = typeof canvas.getBoundingClientRect === "function" ? canvas.getBoundingClientRect() : null;
    const cssW = rect?.width || canvas.clientWidth || 532;
    const cssH = rect?.height || canvas.clientHeight || 588;
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    W = cssW;
    H = cssH;
  }

  function tileSize(layout) {
    return Math.max(6, Math.floor(Math.min(W / layout.width, H / layout.height)));
  }

  /** 屏风墙预渲染：只在巷子换了的时候重画 */
  function buildStatic(layout, ts) {
    const c = typeof document !== "undefined" ? document.createElement("canvas") : null;
    if (!c) return null;
    c.width = layout.width * ts;
    c.height = layout.height * ts;
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    for (let y = 0; y < layout.height; y += 1) {
      for (let x = 0; x < layout.width; x += 1) {
        const ch = charAt(layout, x, y);
        if (ch === HOUSE || ch === DOOR) {
          g.fillStyle = ch === DOOR ? "rgba(255, 214, 150, 0.5)" : "rgba(30, 42, 84, 0.92)";
          const pad = ch === DOOR ? ts * 0.3 : ts * 0.06;
          rounded(g, x * ts + pad, y * ts + pad * (ch === DOOR ? 2 : 1), ts - pad * 2, ts - pad * 2, ts * 0.18);
          g.fill();
          continue;
        }
        if (!solidAt(layout, x, y)) continue;
        const grad = g.createLinearGradient(0, y * ts, 0, y * ts + ts);
        grad.addColorStop(0, NIGHT.wall0);
        grad.addColorStop(1, NIGHT.wall1);
        g.fillStyle = grad;
        const up = solidAt(layout, x, y - 1);
        const dn = solidAt(layout, x, y + 1);
        const lf = solidAt(layout, x - 1, y);
        const rt = solidAt(layout, x + 1, y);
        const inset = ts * 0.08;
        rounded(
          g,
          x * ts + (lf ? 0 : inset),
          y * ts + (up ? 0 : inset),
          ts - (lf ? 0 : inset) - (rt ? 0 : inset),
          ts - (up ? 0 : inset) - (dn ? 0 : inset),
          ts * 0.22
        );
        g.fill();
        if (!up) {
          g.strokeStyle = NIGHT.wallEdge;
          g.lineWidth = Math.max(1, ts * 0.06);
          g.beginPath();
          g.moveTo(x * ts + (lf ? 0 : inset) + 1, y * ts + inset + g.lineWidth / 2);
          g.lineTo(x * ts + ts - (rt ? 0 : inset) - 1, y * ts + inset + g.lineWidth / 2);
          g.stroke();
        }
      }
    }
    return c;
  }

  // -------------------------------------------------------------- 粒子

  function push(p) {
    if (particles.length > 260) return;
    particles.push(p);
  }

  function burst(x, y, { color = NIGHT.dot, count = 6, speed = 40, life = 420, size = 2.2 } = {}) {
    if (reducedMotion) return;
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random());
      push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, r: size * (0.6 + Math.random() * 0.8) });
    }
  }

  function ring(x, y, { color = "#fff1cf", life = 520, grow = 340 } = {}) {
    push({ x, y, ring: true, life, max: life, color, grow });
  }

  function quake(ms, amp = 5) {
    if (reducedMotion) {
      flashMs = Math.max(flashMs, 160);
      return;
    }
    shakeMs = Math.max(shakeMs, ms);
    shakeAmp = Math.max(shakeAmp, amp);
  }

  function flare(ms = 220) {
    flashMs = Math.max(flashMs, ms);
  }

  /** 事件 → 视觉反馈（由 main 转发 engine 事件） */
  function fx(type, state, payload) {
    if (!state) return;
    const ts = lastTs;
    const L = state.layout;
    const off = origin(L, ts);
    const px = (v) => off.x + v * ts;
    const pp = entPos(state, state.player);
    if (type === "dot") burst(px(pp.x), px(pp.y), { count: 2, speed: 26, life: 260, size: 1.6, color: NIGHT.dot });
    else if (type === "pearl") {
      burst(px(pp.x), px(pp.y), { count: 18, speed: 90, life: 620, size: 3, color: NIGHT.pearl });
      ring(px(pp.x), px(pp.y), { life: 620, grow: 520 });
      quake(180, 4);
    } else if (type === "eatGhost") {
      const g = state.ghosts.find((x) => x.id === payload?.id);
      const gp = g ? entPos(state, g) : pp;
      burst(px(gp.x), px(gp.y), { count: 14, speed: 80, life: 520, size: 2.6, color: "#8fb2ff" });
      ring(px(gp.x), px(gp.y), { color: "#cfe0ff", life: 460, grow: 380 });
    } else if (type === "caught") {
      burst(px(pp.x), px(pp.y), { count: 20, speed: 110, life: 700, size: 3, color: "#ffd98a" });
      quake(420, 8);
    } else if (type === "dash") {
      ring(px(pp.x), px(pp.y), { color: "#fff2d0", life: 400, grow: 620 });
    } else if (type === "fright") {
      flare(260);
    } else if (type === "frightWarn") {
      flare(150);
    } else if (type === "cleared") {
      for (let i = 0; i < 5; i += 1) {
        const t = L.pearlTiles[i % Math.max(1, L.pearlTiles.length)] ?? L.spawn ?? { x: 1, y: 1 };
        burst(px(t.x + 0.5), px(t.y + 0.5), { count: 12, speed: 120, life: 900, size: 3, color: "#ffe6ad" });
      }
    } else if (type === "round" || type === "release") {
      const g = state.ghosts.find((x) => x.id === (payload?.id ?? 0)) ?? state.ghosts[0];
      if (g) ring(px(entPos(state, g).x), px(entPos(state, g).y), { color: "#9fb6ff", life: 420, grow: 260 });
    }
  }

  function stepParticles(dtSec) {
    for (const p of particles) {
      p.life -= dtSec * 1000;
      if (p.ring) continue;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  // -------------------------------------------------------------- 实体

  function origin(layout, ts) {
    return { x: Math.round((W - layout.width * ts) / 2), y: Math.round((H - layout.height * ts) / 2) };
  }

  function drawDust(layout, state, ts, off, dawnT) {
    const base = dawnT > 0.5 ? DAWN.dot : NIGHT.dot;
    const color = rgbStr(mixRgb([255, 217, 138], [122, 75, 19], dawnT));
    for (let y = 0; y < layout.height; y += 1) {
      for (let x = 0; x < layout.width; x += 1) {
        const v = dotAt(state, x, y);
        if (!v) continue;
        const cx = off.x + (x + 0.5) * ts;
        const cy = off.y + (y + 0.5) * ts;
        if (v === 2) {
          const pulse = reducedMotion ? 1 : 0.82 + Math.sin(time / 220 + x + y) * 0.18;
          const r = ts * 0.26 * pulse;
          const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3.1);
          glow.addColorStop(0, rgbStr(mixRgb([255, 244, 210], [255, 255, 255], dawnT), 0.95));
          glow.addColorStop(1, rgbStr(mixRgb([255, 244, 210], [255, 255, 255], dawnT), 0));
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(cx, cy, r * 3.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = NIGHT.pearl;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = color || base;
          ctx.beginPath();
          ctx.arc(cx, cy, ts * 0.09, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    void state;
  }

  function drawPlayer(state, ts, off, dawnT) {
    const p = entPos(state, state.player);
    const cx = off.x + p.x * ts;
    const cy = off.y + p.y * ts;
    const r = ts * 0.44;
    const dying = state.status === "dying";
    const t = dying ? 1 - Math.max(0, state.statusMs) / 1150 : 0;
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * (2.6 + (state.dashMs > 0 ? 1.4 : 0)));
    halo.addColorStop(0, rgbStr(mixRgb([255, 214, 130], [255, 255, 240], dawnT * 0.5), 0.55 * (1 - t * 0.7)));
    halo.addColorStop(1, "rgba(255, 210, 130, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, r * (2.6 + (state.dashMs > 0 ? 1.4 : 0)), 0, Math.PI * 2);
    ctx.fill();

    const d = state.player.dirIdx === NONE ? DIRS[3] : DIRS[state.player.dirIdx];
    const chomp = reducedMotion ? 0.34 : 0.18 + Math.abs(Math.sin(state.player.prog * Math.PI * 2)) * 0.42;
    const ang = Math.atan2(d.y, d.x);
    const body = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.15, cx, cy, r);
    body.addColorStop(0, "#fff6dd");
    body.addColorStop(0.55, NIGHT.player);
    body.addColorStop(1, "#d98b1f");
    ctx.fillStyle = body;
    ctx.globalAlpha = 1 - t * 0.85;
    ctx.beginPath();
    ctx.arc(cx, cy, r * (1 - t * 0.35), ang + chomp, ang - chomp + Math.PI * 2);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    // 眼睛：永远最亮的那个小球，加一只眼就够辨认朝向
    ctx.fillStyle = "#20140b";
    const ex = cx + Math.cos(ang - 1.1) * r * 0.42;
    const ey = cy + Math.sin(ang - 1.1) * r * 0.42;
    ctx.beginPath();
    ctx.arc(ex, ey, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }

  function ghostBody(cx, cy, r, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    const grad = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, rgbStr(mixRgb([10, 14, 34], [255, 255, 255], 0.05), 0.92));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.1, r, Math.PI, 0);
    ctx.lineTo(cx + r, cy + r * 0.72);
    const humps = 4;
    for (let i = humps; i > 0; i -= 1) {
      const x0 = cx - r + (2 * r * (i - 0.5)) / humps;
      const wob = reducedMotion ? 0 : Math.sin(time / 160 + i) * r * 0.08;
      ctx.quadraticCurveTo(x0 + r / humps, cy + r * 0.5 + wob, x0 - r / humps + r / humps, cy + r * 0.72);
      ctx.quadraticCurveTo(x0 - r / humps, cy + r * 0.72, x0 - r / humps, cy + r * 0.72);
    }
    ctx.lineTo(cx - r, cy - r * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function ghostEyes(cx, cy, r, dir, scared, blink) {
    const dx = dir === NONE ? 0 : DIRS[dir].x;
    const dy = dir === NONE ? 0 : DIRS[dir].y;
    const offx = r * 0.3;
    for (const s of [-1, 1]) {
      const ex = cx + s * r * 0.36;
      const ey = cy - r * 0.12;
      if (scared) {
        ctx.strokeStyle = "#f2f6ff";
        ctx.lineWidth = Math.max(1.2, r * 0.14);
        ctx.beginPath();
        ctx.moveTo(ex - offx * 0.3, ey - offx * 0.3);
        ctx.lineTo(ex + offx * 0.3, ey + offx * 0.3);
        ctx.moveTo(ex + offx * 0.3, ey - offx * 0.3);
        ctx.lineTo(ex - offx * 0.3, ey + offx * 0.3);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = "#f7fbff";
      ctx.beginPath();
      ctx.ellipse(ex, ey, r * 0.24, r * (blink ? 0.06 : 0.26), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1b2350";
      ctx.beginPath();
      ctx.arc(ex + dx * r * 0.1, ey + dy * r * 0.1, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function ghostMark(state, g, cx, cy, r, ts, off) {
    // 色盲友好：每种脾性有自己的形状线索，不只靠颜色
    const col = PALETTE[g.color] ?? "#ff5b4a";
    if (g.beh === "ambush") {
      const d = g.dirIdx === NONE ? DIRS[1] : DIRS[g.dirIdx];
      ctx.setLineDash([r * 0.3, r * 0.35]);
      ctx.strokeStyle = rgbStr([255, 158, 203], 0.55);
      ctx.lineWidth = Math.max(1, r * 0.16);
      ctx.beginPath();
      ctx.moveTo(cx + d.x * r * 1.4, cy + d.y * r * 1.4);
      ctx.lineTo(cx + d.x * r * 3.2, cy + d.y * r * 3.2);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    if (g.beh === "chaser" || g.beh === "dart") {
      const d = g.dirIdx === NONE ? DIRS[3] : DIRS[g.dirIdx];
      ctx.strokeStyle = rgbStr([255, 255, 255], g.beh === "dart" ? 0.4 : 0.24);
      ctx.lineWidth = Math.max(1, r * 0.12);
      for (const s of [-0.4, 0.4]) {
        ctx.beginPath();
        ctx.moveTo(cx - d.x * r * 1.1 + -d.y * s * r, cy - d.y * r * 1.1 + d.x * s * r);
        ctx.lineTo(cx - d.x * r * 2.4 + -d.y * s * r, cy - d.y * r * 2.4 + d.x * s * r);
        ctx.stroke();
      }
      return;
    }
    if (g.beh === "flanker") {
      ctx.strokeStyle = rgbStr([72, 224, 214], 0.5);
      ctx.lineWidth = Math.max(1, r * 0.14);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.5, time / 300, time / 300 + Math.PI * 0.8);
      ctx.stroke();
      return;
    }
    if (g.beh === "patrol") {
      ctx.fillStyle = rgbStr([166, 232, 90], 0.7);
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * Math.PI * 2 + time / 700;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r * 1.6, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    void col;
    void state;
    void ts;
    void off;
  }

  function drawGhosts(state, ts, off, dawnT) {
    const fright = state.frightMs > 0;
    const flashing = fright && state.frightMs <= (state.cfg.frightFlashMs ?? 1500);
    for (const g of state.ghosts) {
      const p = entPos(state, g);
      const cx = off.x + p.x * ts;
      const cy = off.y + p.y * ts + (g.st === "house" && !reducedMotion ? Math.sin(g.bob) * ts * 0.08 : 0);
      const r = ts * 0.44;
      if (g.st === "eyes") {
        ghostEyes(cx, cy, r, g.dirIdx, false, false);
        continue;
      }
      let color = PALETTE[g.color] ?? PALETTE.red;
      let alpha = g.silent ? 0.62 : 1;
      if (fright) {
        const warn = flashing && Math.floor(state.frightMs / 130) % 2 === 0;
        color = warn ? "#f4f7ff" : "#4257d6";
      }
      const blink = g.beh === "dither" && !reducedMotion && Math.floor(time / 1400 + g.id) % 6 === 0;
      ctx.save();
      ctx.shadowColor = rgbStr(mixRgb([90, 120, 255], [255, 190, 90], dawnT), 0.5);
      ctx.shadowBlur = ts * 0.5;
      ghostBody(cx, cy, r, color, alpha);
      ctx.restore();
      if (fright) {
        ctx.strokeStyle = "#e8eeff";
        ctx.lineWidth = Math.max(1, r * 0.12);
        ctx.beginPath();
        for (let i = 0; i <= 4; i += 1) {
          const mx = cx - r * 0.55 + (i * r * 1.1) / 4;
          const my = cy + r * 0.34 + (i % 2 ? -1 : 1) * r * 0.12;
          if (i === 0) ctx.moveTo(mx, my);
          else ctx.lineTo(mx, my);
        }
        ctx.stroke();
        ghostEyes(cx, cy, r, g.dirIdx, true, false);
        continue;
      }
      ghostEyes(cx, cy, r, g.dirIdx, false, blink);
      ghostMark(state, g, cx, cy, r, ts, off);
    }
  }

  function drawFruit(state, ts, off) {
    if (!state.fruit) return;
    const f = state.fruit;
    const cx = off.x + (f.x + 0.5) * ts;
    const cy = off.y + (f.y + 0.5) * ts;
    const r = ts * (reducedMotion ? 0.32 : 0.3 + Math.sin(time / 240) * 0.05);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.6);
    glow.addColorStop(0, "rgba(255, 228, 168, 0.8)");
    glow.addColorStop(1, "rgba(255, 170, 60, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffbe57";
    rounded(ctx, cx - r, cy - r, r * 2, r * 2, r * 0.6);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 244, 214, 0.85)";
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.stroke();
  }

  function drawParticles(ts, off) {
    for (const p of particles) {
      const a = Math.max(0, p.life / p.max);
      if (p.ring) {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = a * 0.7;
        ctx.lineWidth = Math.max(1, ts * 0.1 * a);
        ctx.beginPath();
        ctx.arc(p.x, p.y, (1 - a) * (p.grow ?? 300) * (ts / TILE), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.fillStyle = p.color;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * a + 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    void off;
  }

  function drawFog(state, ts, off, dawnT) {
    const L = state.layout;
    const p = entPos(state, state.player);
    const cx = off.x + p.x * ts;
    const cy = off.y + p.y * ts;
    const vr = visionRadius(state) * ts;
    const inner = Math.max(ts, vr * 0.32);
    const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, Math.max(inner + ts, vr));
    const shade = mixRgb(NIGHT_RGB, DAWN_RGB, dawnT * 0.4);
    grad.addColorStop(0, rgbStr(shade, 0));
    grad.addColorStop(0.62, rgbStr(shade, 0.55));
    grad.addColorStop(1, rgbStr(shade, 0.97));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    void L;
  }

  function drawMotes(dtSec, ts, off, layout) {
    if (reducedMotion) return;
    if (!motes.length) {
      for (let i = 0; i < 22; i += 1) {
        motes.push({ x: Math.random() * W, y: Math.random() * H, v: 6 + Math.random() * 16, ph: Math.random() * 6.28, r: 1 + Math.random() * 1.6 });
      }
    }
    for (const m of motes) {
      m.y -= m.v * dtSec;
      m.x += Math.sin(time / 900 + m.ph) * 8 * dtSec;
      if (m.y < -6) {
        m.y = H + 6;
        m.x = Math.random() * W;
      }
      const a = 0.16 + Math.abs(Math.sin(time / 700 + m.ph)) * 0.34;
      ctx.fillStyle = `rgba(255, 226, 160, ${a})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    void ts;
    void off;
    void layout;
  }

  let lastTs = TILE;

  /** 一帧：state 只读 */
  function draw(state, dtMs = 16.7) {
    if (!ctx || !state) return;
    const dtSec = Math.min(0.05, dtMs / 1000);
    time += dtMs;
    resize();
    const L = state.layout;
    const ts = tileSize(L);
    lastTs = ts;
    const off = origin(L, ts);
    const key = `${L.width}x${L.height}x${L.rows.join("").length}x${ts}`;
    if (key !== layoutKey || !staticLayer) {
      staticLayer = buildStatic(L, ts);
      layoutKey = key;
    }

    const fright = state.frightMs > 0;
    const dawnT = fright ? Math.min(1, 0.35 + (state.frightMs / Math.max(1, state.cfg.frightMs)) * 0.65) : 0;
    const sky = mixRgb(NIGHT_RGB, DAWN_RGB, dawnT * 0.75);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    let sx = 0;
    let sy = 0;
    if (shakeMs > 0) {
      shakeMs -= dtMs;
      sx = (Math.random() - 0.5) * shakeAmp;
      sy = (Math.random() - 0.5) * shakeAmp;
      if (shakeMs <= 0) shakeAmp = 0;
    }
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, rgbStr(mixRgb(sky, [22, 32, 72], 0.35)));
    bg.addColorStop(1, rgbStr(sky));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(sx, sy);
    if (staticLayer) ctx.drawImage(staticLayer, off.x, off.y);
    drawDust(L, state, ts, off, dawnT);
    drawFruit(state, ts, off);
    stepParticles(dtSec);
    drawParticles(ts, off);
    if (state.status !== "lost") drawGhosts(state, ts, off, dawnT);
    drawPlayer(state, ts, off, dawnT);
    drawMotes(dtSec, ts, off, L);
    if (L && state.cfg.fog) drawFog(state, ts, off, dawnT);
    ctx.restore();

    // 巷口外的暖色呼吸光晕（贴画布边缘，不侵入广告安全区）
    const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.72);
    vig.addColorStop(0, "rgba(255, 200, 120, 0.05)");
    vig.addColorStop(1, rgbStr(mixRgb([2, 4, 12], [40, 22, 4], dawnT), 0.55));
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    if (flashMs > 0) {
      flashMs -= dtMs;
      ctx.fillStyle = `rgba(255, 246, 224, ${Math.min(0.55, flashMs / 260)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function reset() {
    particles = [];
    shakeMs = 0;
    shakeAmp = 0;
    flashMs = 0;
  }

  return { draw, fx, resize, reset, burst, ring, quake, flare, get particles() { return particles.length; } };
}

// ---------------------------------------------------------------- 工坊纸巷台

/**
 * 编辑台绘制：平面纸样 + 笔刷语义 + 问题瓦片红框。
 * @param {HTMLCanvasElement} canvas
 */
export function drawBench(canvas, { rows, problems = [], hover = null, grid = true, reducedMotion = false, locale = "zh" }) {
  const g = canvas ? canvas.getContext("2d") : null;
  if (!g || !rows || !rows.length) return { ts: TILE, ox: 0, oy: 0, width: 0, height: 0 };
  const height = rows.length;
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const rect = typeof canvas.getBoundingClientRect === "function" ? canvas.getBoundingClientRect() : null;
  const dpr = Math.max(1, Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1));
  const cssW = rect?.width || canvas.clientWidth || 460;
  const cssH = rect?.height || canvas.clientHeight || 500;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  const ts = Math.max(8, Math.floor(Math.min(cssW / width, cssH / height)));
  const ox = Math.round((cssW - width * ts) / 2);
  const oy = Math.round((cssH - height * ts) / 2);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, cssW, cssH);
  const bad = new Set();
  for (const p of problems) for (const t of p.tiles ?? []) bad.add(`${t.x},${t.y}`);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const ch = rows[y]?.[x] ?? WALL;
      const px = ox + x * ts;
      const py = oy + y * ts;
      const walk = isWalkableTile(ch);
      g.fillStyle = ch === WALL || ch === " " ? "#1a2447" : ch === HOUSE ? "#243059" : "#e9dfc6";
      g.fillRect(px, py, ts, ts);
      if (walk && ch !== HOUSE) {
        g.fillStyle = "rgba(40, 30, 10, 0.12)";
        if (ch === DOT) g.fillRect(px + ts * 0.44, py + ts * 0.44, ts * 0.12, ts * 0.12);
        if (ch === PEARL) {
          g.fillStyle = "#c78b1c";
          g.beginPath();
          g.arc(px + ts / 2, py + ts / 2, ts * 0.3, 0, Math.PI * 2);
          g.fill();
        }
        if (ch === SPAWN) {
          g.fillStyle = "#e0a418";
          g.beginPath();
          g.arc(px + ts / 2, py + ts / 2, ts * 0.34, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "#3b2405";
          g.fillRect(px + ts * 0.62, py + ts * 0.34, ts * 0.12, ts * 0.12);
        }
        if (ch === FRUIT) {
          g.fillStyle = "#d4622a";
          rounded(g, px + ts * 0.26, py + ts * 0.26, ts * 0.48, ts * 0.48, ts * 0.16);
          g.fill();
        }
        if (ch === DOOR) {
          g.fillStyle = "#f3d38b";
          g.fillRect(px, py + ts * 0.3, ts, ts * 0.4);
        }
      }
      if (grid) {
        g.strokeStyle = "rgba(255, 255, 255, 0.05)";
        g.lineWidth = 1;
        g.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);
      }
      if (bad.has(`${x},${y}`)) {
        g.strokeStyle = reducedMotion ? "#ff8b6b" : `rgba(255, 92, 66, ${0.55 + Math.sin(Date.now() / 220) * 0.35})`;
        g.lineWidth = Math.max(1.6, ts * 0.12);
        g.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
      }
    }
  }
  if (hover && hover.x >= 0 && hover.y >= 0 && hover.x < width && hover.y < height) {
    g.strokeStyle = "#ffe1a8";
    g.lineWidth = Math.max(1.4, ts * 0.1);
    g.strokeRect(ox + hover.x * ts + 1, oy + hover.y * ts + 1, ts - 2, ts - 2);
  }
  void locale;
  return { ts, ox, oy, width, height };
}
