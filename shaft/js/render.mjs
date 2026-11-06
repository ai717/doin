// render.mjs — Canvas 2D 竖井机台渲染层（唯一碰画布的层）。
// 题材：深陷地壳的微缩矿坑竖井，铸铁包边、黄铜刻度、随深度渐变的地质光晕。

import { VIEW_W, VIEW_H, CEILING_H, PLAYER_W, PLAYER_H, WALL_L, WALL_R, PLATFORM_H } from "./engine.mjs";

/* ============================================================
 * 1 · 地质色板（纯函数，可单测）
 * ==========================================================*/
export const ZONES = [
  { depth: 0, top: "#1b2836", bottom: "#0b1017", rock: "#36465c", accent: "#8fb9e3", mist: "#a3c7e6" },
  { depth: 22, top: "#2b1a15", bottom: "#120b09", rock: "#4b3027", accent: "#d9784f", mist: "#e39a72" },
  { depth: 44, top: "#241f17", bottom: "#0d0b08", rock: "#54422c", accent: "#e0a84e", mist: "#f0c678" },
  { depth: 66, top: "#12242e", bottom: "#060d12", rock: "#25414d", accent: "#54d6c8", mist: "#8ce8df" },
  { depth: 88, top: "#2b1013", bottom: "#0d0405", rock: "#4c2220", accent: "#ff7a3c", mist: "#ffab63" },
];

export const PLATFORM_COLORS = {
  normal: { base: "#4f6379", light: "#8fa6bd", dark: "#28323f", edge: "#c9dcee" },
  spring: { base: "#c9a227", light: "#f6dd6a", dark: "#7d5f12", edge: "#fff0a8" },
  spike: { base: "#8f282d", light: "#c95358", dark: "#430f12", edge: "#ffc9c9" },
  conveyorL: { base: "#b06b27", light: "#efa84f", dark: "#60340d", edge: "#ffd29a" },
  conveyorR: { base: "#b06b27", light: "#efa84f", dark: "#60340d", edge: "#ffd29a" },
  crumble: { base: "#358086", light: "#63e0d3", dark: "#143a3d", edge: "#c8fff8" },
  goal: { base: "#a87a1b", light: "#ffd66b", dark: "#523704", edge: "#fff3bd" },
  start: { base: "#4f6379", light: "#8fa6bd", dark: "#28323f", edge: "#c9dcee" },
};

export function zoneIndexForDepth(depth) {
  const d = Math.max(0, Number(depth) || 0);
  for (let i = ZONES.length - 1; i >= 0; i -= 1) {
    if (d >= ZONES[i].depth) return i;
  }
  return 0;
}

function hexToRgb(hex) {
  const value = String(hex).replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const n = parseInt(full, 16);
  if (!Number.isFinite(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(rgb) {
  return `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

export function mixColor(a, b, t) {
  const k = Math.max(0, Math.min(1, Number(t) || 0));
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(ca.map((v, i) => v + (cb[i] - v) * k));
}

export function zonePalette(depth) {
  const d = Math.max(0, Number(depth) || 0);
  const index = zoneIndexForDepth(d);
  const current = ZONES[index];
  const next = ZONES[Math.min(ZONES.length - 1, index + 1)];
  const span = next.depth - current.depth;
  if (span <= 0) return { ...current };
  const t = Math.max(0, Math.min(1, (d - current.depth) / span));
  return {
    top: mixColor(current.top, next.top, t),
    bottom: mixColor(current.bottom, next.bottom, t),
    rock: mixColor(current.rock, next.rock, t),
    accent: mixColor(current.accent, next.accent, t),
    mist: mixColor(current.mist, next.mist, t),
  };
}

/* ============================================================
 * 2 · 渲染器
 * ==========================================================*/
function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
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

export function createRenderer(canvas, options = {}) {
  if (!canvas || typeof canvas.getContext !== "function") {
    return {
      resize() {},
      draw() {},
      onEvent() {},
      setReducedMotion() {},
      get camera() {
        return { scale: 1 };
      },
    };
  }
  const ctx = canvas.getContext("2d");
  let scale = 1;
  let rt = 0;
  let reducedMotion = !!options.reducedMotion;
  let shake = 0;
  let flash = 0;
  let glow = 0;
  let particles = [];
  let particleRng = mulberryMix(0x5a17ce);

  function mulberryMix(seed) {
    let a = seed >>> 0;
    return function rng() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function resize() {
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const width = canvas.clientWidth || VIEW_W;
    const height = canvas.clientHeight || VIEW_H;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    scale = canvas.width / VIEW_W;
  }

  function spawn(x, y, count, kind, palette) {
    if (reducedMotion) return;
    for (let i = 0; i < count; i += 1) {
      const angle = particleRng() * Math.PI * 2;
      const speed = 30 + particleRng() * (kind === "spark" ? 260 : 130);
      const life = kind === "spark" ? 0.28 + particleRng() * 0.35 : 0.45 + particleRng() * 0.5;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (kind === "dust" ? 20 : 0),
        life,
        max: life,
        size: kind === "shard" ? 2 + particleRng() * 4 : 1.5 + particleRng() * 2.6,
        color: palette || "#cfe3f5",
        kind,
        rot: particleRng() * Math.PI,
        spin: (particleRng() - 0.5) * 8,
      });
    }
    if (particles.length > 220) particles.splice(0, particles.length - 220);
  }

  function onEvent(event) {
    if (!event) return;
    switch (event.type) {
      case "land":
        if (event.platformType === "spike") return;
        spawn(event.x, event.y - 4, reducedMotion ? 0 : 5, "dust", "#9fb4c9");
        break;
      case "heal":
        spawn(event.x, event.y - 16, 8, "spark", "#ffe08a");
        glow = Math.max(glow, 0.5);
        break;
      case "spike":
        spawn(event.x, event.y - 6, 12, "spark", "#ff6b6b");
        shake = Math.max(shake, reducedMotion ? 0 : 6);
        flash = 0.55;
        break;
      case "spring":
        spawn(event.x, event.y - 6, 10, "spark", "#ffe066");
        glow = Math.max(glow, 0.4);
        break;
      case "crumble":
        spawn(event.x, event.y - 4, 9, "shard", "#b7f7ef");
        break;
      case "collapse":
        spawn(event.x, event.y - 4, 14, "shard", "#57d4c7");
        shake = Math.max(shake, reducedMotion ? 0 : 4);
        break;
      case "conveyor":
        spawn(event.x, event.y - 4, 6, "spark", "#ffc178");
        break;
      case "ceiling":
        flash = Math.max(flash, 0.5);
        shake = Math.max(shake, reducedMotion ? 0 : 5);
        break;
      case "overheat":
        spawn(VIEW_W / 2, VIEW_H * 0.5, 18, "spark", "#ff8a5c");
        glow = 1;
        flash = Math.max(flash, 0.3);
        break;
      case "win":
        spawn(event.x || VIEW_W / 2, (event.y || 300), 26, "spark", "#ffe9a3");
        glow = 1;
        break;
      case "lose":
        shake = Math.max(shake, reducedMotion ? 0 : 7);
        break;
      default:
        break;
    }
  }

  function drawBackground(state, pal) {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, pal.top);
    grad.addColorStop(1, pal.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // 远处岩层剪影：随滚屏缓慢上移，制造纵深
    const drift = (state.scrollY * 0.28) % 240;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = pal.rock;
    for (let i = -1; i < 4; i += 1) {
      const y = i * 240 + drift;
      const w = 150 + ((i + 3) % 3) * 40;
      ctx.beginPath();
      ctx.moveTo(-40, y + 120);
      ctx.quadraticCurveTo(60, y + 40, w, y + 96);
      ctx.quadraticCurveTo(w + 70, y + 150, VIEW_W + 40, y + 100);
      ctx.lineTo(VIEW_W + 40, y + 260);
      ctx.lineTo(-40, y + 260);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 中央纵深雾气
    const mist = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.55, 40, VIEW_W / 2, VIEW_H * 0.55, VIEW_W * 0.8);
    mist.addColorStop(0, `${pal.mist}22`);
    mist.addColorStop(1, "#00000000");
    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  function drawWalls(state, pal) {
    const scroll = state.scrollY;
    const rail = (x, dir) => {
      const grad = ctx.createLinearGradient(x, 0, x + dir * 18, 0);
      grad.addColorStop(0, "#000000aa");
      grad.addColorStop(1, "#00000000");
      ctx.fillStyle = grad;
      ctx.fillRect(dir > 0 ? 0 : VIEW_W - 18, 0, 18, VIEW_H);

      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      for (let y = -120; y < VIEW_H + 120; y += 110) {
        const yy = ((y - (scroll % 110)) + VIEW_H + 120) % (VIEW_H + 240) - 120;
        ctx.beginPath();
        ctx.moveTo(x, yy);
        ctx.lineTo(x + dir * 14, yy + 8);
        ctx.stroke();
      }
      ctx.restore();
    };

    rail(WALL_L, -1);
    rail(WALL_R, 1);

    // 铆钉
    ctx.fillStyle = "rgba(200, 220, 255, 0.16)";
    for (let y = -60; y < VIEW_H + 60; y += 132) {
      const yy = y + (scroll * 0.9) % 132;
      ctx.beginPath();
      ctx.arc(WALL_L - 6, yy, 2.2, 0, Math.PI * 2);
      ctx.arc(WALL_R + 6, yy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 井壁黄铜灯带
    ctx.save();
    ctx.globalAlpha = 0.25;
    const lamp = ctx.createLinearGradient(WALL_L, 0, WALL_L + 6, 0);
    lamp.addColorStop(0, pal.accent);
    lamp.addColorStop(1, "#00000000");
    ctx.fillStyle = lamp;
    ctx.fillRect(WALL_L - 2, 0, 6, VIEW_H);
    const lamp2 = ctx.createLinearGradient(WALL_R - 6, 0, WALL_R, 0);
    lamp2.addColorStop(0, "#00000000");
    lamp2.addColorStop(1, pal.accent);
    ctx.fillStyle = lamp2;
    ctx.fillRect(WALL_R - 4, 0, 6, VIEW_H);
    ctx.restore();

    // 井壁齿轮：随滚屏缓缓上移，强化升降机房的机械感
    const gears = [
      { x: WALL_L + 9, y: 70, size: 9 },
      { x: WALL_R - 9, y: 360, size: 11 },
      { x: WALL_L + 9, y: 560, size: 7 },
    ];
    for (const gear of gears) {
      const yy = VIEW_H + 80 - ((gear.y + scroll * 0.5) % (VIEW_H + 160));
      ctx.save();
      ctx.translate(gear.x, yy);
      ctx.rotate((reducedMotion ? 0 : rt * 0.5) + gear.y);
      ctx.fillStyle = "rgba(10, 14, 19, 0.9)";
      ctx.strokeStyle = "rgba(201, 151, 79, 0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, gear.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(201, 151, 79, 0.22)";
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        ctx.save();
        ctx.rotate(a);
        ctx.fillRect(gear.size - 1, -1.4, 3.2, 2.8);
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, gear.size * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawCeiling(state) {
    const beam = ctx.createLinearGradient(0, 0, 0, CEILING_H);
    beam.addColorStop(0, "#45505e");
    beam.addColorStop(0.5, "#252c36");
    beam.addColorStop(1, "#141920");
    ctx.fillStyle = beam;
    ctx.fillRect(0, 0, VIEW_W, 26);

    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(0, 24, VIEW_W, 2);

    const near = state.player.y - state.scrollY - PLAYER_H < CEILING_H + 40;
    const pulse = near ? 0.55 + Math.sin(rt * 14) * 0.25 : 0.18;
    const osc = reducedMotion ? 0 : Math.sin(rt * 2.4) * 1.6;

    for (let x = 14; x < VIEW_W - 8; x += 26) {
      const h = 16 + ((x * 7) % 9) + osc;
      const grad = ctx.createLinearGradient(x, 26, x + 12, 26 + h);
      grad.addColorStop(0, "#9aa6b5");
      grad.addColorStop(1, "#4a5563");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x - 7, 26);
      ctx.lineTo(x + 7, 26);
      ctx.lineTo(x, 26 + h);
      ctx.closePath();
      ctx.fill();
    }

    ctx.save();
    ctx.globalAlpha = pulse;
    const glow = ctx.createLinearGradient(0, CEILING_H - 6, 0, CEILING_H + 34);
    glow.addColorStop(0, "#ff6b5e88");
    glow.addColorStop(1, "#00000000");
    ctx.fillStyle = glow;
    ctx.fillRect(0, CEILING_H - 6, VIEW_W, 40);
    ctx.restore();
  }

  function drawPlatform(state, platform, pal) {
    const screenY = platform.worldY - state.scrollY;
    if (screenY < -40 || screenY > VIEW_H + 50) return;
    const colors = PLATFORM_COLORS[platform.type] || PLATFORM_COLORS.normal;
    const x = platform.x - platform.width / 2;
    const w = platform.width;
    const h = PLATFORM_H;

    ctx.save();
    if (platform.breaking) {
      const total = 0.25;
      const p = Math.max(0, Math.min(1, 1 - platform.breakTimer / total));
      ctx.translate(platform.x, screenY + h / 2);
      ctx.rotate((platform.dir || 1) * p * 0.35);
      ctx.globalAlpha = 1 - p * 0.35;
      ctx.translate(-platform.x, -(screenY + h / 2));
    }
    if (platform.broken) {
      ctx.globalAlpha = 0.35;
    }

    // 底部投影与题材光晕
    const halo = ctx.createRadialGradient(platform.x, screenY + h, 4, platform.x, screenY + h, w * 0.8);
    halo.addColorStop(0, `${colors.edge}33`);
    halo.addColorStop(1, "#00000000");
    ctx.fillStyle = halo;
    ctx.fillRect(x - 20, screenY, w + 40, 46);

    const body = ctx.createLinearGradient(0, screenY, 0, screenY + h);
    body.addColorStop(0, colors.light);
    body.addColorStop(0.45, colors.base);
    body.addColorStop(1, colors.dark);
    ctx.fillStyle = body;
    roundRect(ctx, x, screenY, w, h, 5);
    ctx.fill();

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = colors.edge;
    ctx.lineWidth = 1;
    roundRect(ctx, x + 0.5, screenY + 0.5, w - 1, h - 1, 5);
    ctx.stroke();
    ctx.restore();

    // 板底暗影，让跳板从深渊里“浮”出来
    const under = ctx.createLinearGradient(0, screenY + h, 0, screenY + h + 12);
    under.addColorStop(0, "rgba(0,0,0,0.45)");
    under.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = under;
    ctx.fillRect(x + 2, screenY + h, w - 4, 12);

    // 顶面高光
    ctx.fillStyle = colors.edge;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(x + 5, screenY + 1.5, w - 10, 1.6);
    ctx.globalAlpha = 1;

    // 侧铆钉
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.arc(x + 7, screenY + h / 2, 2.4, 0, Math.PI * 2);
    ctx.arc(x + w - 7, screenY + h / 2, 2.4, 0, Math.PI * 2);
    ctx.fill();

    if (platform.type === "spring") {
      ctx.strokeStyle = colors.edge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 5; i += 1) {
        const sx = x + 12 + (w - 24) * (i / 5);
        ctx.lineTo(sx, screenY - 7 + (i % 2 === 0 ? 0 : -5));
      }
      ctx.stroke();
    } else if (platform.type === "spike") {
      ctx.fillStyle = "#e8eef6";
      const step = 14;
      for (let sx = x + 6; sx < x + w - 6; sx += step) {
        ctx.beginPath();
        ctx.moveTo(sx, screenY + 1);
        ctx.lineTo(sx + 5, screenY - 9);
        ctx.lineTo(sx + 10, screenY + 1);
        ctx.closePath();
        ctx.fill();
      }
    } else if (platform.type === "conveyorL" || platform.type === "conveyorR") {
      const offset = reducedMotion ? 0 : (rt * 90 * platform.dir) % 22;
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, x + 4, screenY + 3, w - 8, h - 6, 3);
      ctx.clip();
      ctx.strokeStyle = colors.edge;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 4;
      for (let sx = x - 24 + offset; sx < x + w + 24; sx += 22) {
        ctx.beginPath();
        ctx.moveTo(sx, screenY - 2);
        ctx.lineTo(sx + 12, screenY + h + 2);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = colors.edge;
      const dir = platform.dir || 1;
      ctx.beginPath();
      ctx.moveTo(platform.x - dir * 10, screenY - 10);
      ctx.lineTo(platform.x + dir * 10, screenY - 14);
      ctx.lineTo(platform.x + dir * 10, screenY - 6);
      ctx.closePath();
      ctx.fill();
    } else if (platform.type === "crumble") {
      ctx.strokeStyle = "rgba(190, 255, 248, 0.55)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i += 1) {
        const cx = x + w * (0.25 + i * 0.25);
        ctx.beginPath();
        ctx.moveTo(cx - 6, screenY + 2);
        ctx.lineTo(cx + 2, screenY + h / 2);
        ctx.lineTo(cx - 4, screenY + h - 2);
        ctx.stroke();
      }
    } else if (platform.type === "goal") {
      const pulse = reducedMotion ? 0.5 : 0.4 + Math.sin(rt * 3) * 0.25;
      ctx.save();
      ctx.globalAlpha = pulse;
      const beam = ctx.createLinearGradient(0, screenY - 46, 0, screenY);
      beam.addColorStop(0, "#ffe9a300");
      beam.addColorStop(1, "#ffe9a366");
      ctx.fillStyle = beam;
      ctx.fillRect(x + 24, screenY - 46, w - 48, 46);
      ctx.restore();

      ctx.fillStyle = "#ffe9a3";
      ctx.globalAlpha = 0.9;
      roundRect(ctx, platform.x - 16, screenY + 2, 32, 9, 3);
      ctx.fill();

      ctx.strokeStyle = "#fff3c4";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(platform.x, screenY - 4);
      ctx.lineTo(platform.x + 9, screenY + 1);
      ctx.lineTo(platform.x + 6, screenY + 9);
      ctx.lineTo(platform.x, screenY + 13);
      ctx.lineTo(platform.x - 6, screenY + 9);
      ctx.lineTo(platform.x - 9, screenY + 1);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayer(state, pal) {
    const p = state.player;
    const sY = p.y - state.scrollY;
    const x = p.x;
    const squashX = Math.max(0.6, Math.min(1.5, p.squashX));
    const squashY = Math.max(0.6, Math.min(1.5, p.squashY));
    const ART = 1.18;
    const w = PLAYER_W * squashX * ART;
    const h = PLAYER_H * squashY * ART;
    const feet = sY;
    const facing = p.facing >= 0 ? 1 : -1;
    const speed = Math.abs(p.vx);
    const walk = p.grounded !== null && p.grounded !== undefined ? Math.sin(rt * 16) * Math.min(1, speed / MOVE_DISPLAY) : 0;
    const tilt = p.grounded === null ? Math.max(-0.22, Math.min(0.22, p.vx / 1600)) : 0;

    // 流风线
    if (!reducedMotion && (p.vy > 260 || p.dive)) {
      ctx.save();
      ctx.strokeStyle = `${pal.mist}55`;
      ctx.lineWidth = 1.4;
      const strength = Math.min(1, p.vy / 700);
      for (let i = 0; i < 7; i += 1) {
        const lx = x - w / 2 - 6 - ((i * 17 + rt * 40) % 42);
        const ly = feet - h - ((i * 31 + rt * 160) % (h + 40));
        ctx.globalAlpha = 0.15 + strength * 0.45;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly + 10 + strength * 14);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 地面阴影
    if (p.grounded !== null && p.grounded !== undefined) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.ellipse(x, feet + 2, w * 0.62, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, feet);
    ctx.rotate(tilt);

    // 围巾（速度越快飘得越远）
    const scarf = Math.min(1, (speed + Math.abs(p.vy) * 0.4) / 240);
    ctx.fillStyle = "#d4553f";
    ctx.beginPath();
    ctx.moveTo(facing * -2, -h * 0.62);
    ctx.quadraticCurveTo(facing * -16 - scarf * 10, -h * 0.52 + walk * 3, facing * -22 - scarf * 14, -h * 0.3);
    ctx.quadraticCurveTo(facing * -14, -h * 0.42, facing * -2, -h * 0.5);
    ctx.closePath();
    ctx.fill();

    // 双腿
    ctx.strokeStyle = "#27313f";
    ctx.lineWidth = 4.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-3, -h * 0.32);
    ctx.lineTo(-4 + walk * 2.4, -1);
    ctx.moveTo(3, -h * 0.32);
    ctx.lineTo(4 - walk * 2.4, -1);
    ctx.stroke();

    // 靴子
    ctx.fillStyle = "#151b24";
    roundRect(ctx, -4 + walk * 2.4 - 4, -4, 9, 4.4, 2);
    ctx.fill();
    roundRect(ctx, 4 - walk * 2.4 - 4, -4, 9, 4.4, 2);
    ctx.fill();

    // 躯干（矿工工装）
    const body = ctx.createLinearGradient(-w / 2, -h * 0.75, w / 2, -h * 0.3);
    body.addColorStop(0, "#5f7a93");
    body.addColorStop(1, "#33465a");
    ctx.fillStyle = body;
    roundRect(ctx, -w / 2, -h * 0.72, w, h * 0.44, 5);
    ctx.fill();

    // 反光背带
    ctx.fillStyle = "#e0a84e";
    ctx.fillRect(-w / 2 + 3, -h * 0.7, 2.4, h * 0.36);
    ctx.fillRect(w / 2 - 5.4, -h * 0.7, 2.4, h * 0.36);

    // 背包
    ctx.fillStyle = "#2b3542";
    roundRect(ctx, facing * -w / 2 - 5, -h * 0.64, 6, h * 0.28, 2.5);
    ctx.fill();

    // 头与安全帽
    ctx.fillStyle = "#e8c9a0";
    ctx.beginPath();
    ctx.arc(0, -h * 0.82, 6.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#d8a33c";
    ctx.beginPath();
    ctx.arc(0, -h * 0.9, 7.4, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-8.5, -h * 0.9, 17, 2.4);

    // 帽灯与光晕
    const lampX = facing * 5.4;
    const lampY = -h * 0.91;
    ctx.fillStyle = "#fff5c9";
    ctx.beginPath();
    ctx.arc(lampX, lampY, 2.4, 0, Math.PI * 2);
    ctx.fill();
    if (!reducedMotion) {
      const glowGrad = ctx.createRadialGradient(lampX, lampY, 1, lampX, lampY, 26);
      glowGrad.addColorStop(0, "#fff3c455");
      glowGrad.addColorStop(1, "#fff3c400");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(lampX - 26, lampY - 26, 52, 52);
    }

    // 眼睛
    ctx.fillStyle = "#1a212b";
    ctx.beginPath();
    ctx.arc(facing * 2.6, -h * 0.82, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // 受伤红闪
    if (p.hurt > 0) {
      ctx.globalAlpha = Math.min(1, p.hurt * 1.5);
      ctx.fillStyle = "#ff4d4d";
      roundRect(ctx, -w / 2, -h, w, h, 5);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  const MOVE_DISPLAY = 236;

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      particle.life -= dt;
      if (particle.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += (particle.kind === "dust" ? 120 : 420) * dt;
      particle.vx *= 0.985;
      particle.rot += particle.spin * dt;
      const alpha = Math.max(0, particle.life / particle.max);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      if (particle.kind === "shard") {
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rot);
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.6);
      } else if (particle.kind === "spark") {
        ctx.fillRect(particle.x, particle.y, particle.size * 1.2, particle.size * 2.4);
      } else {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawAmbient(dt, pal) {
    if (reducedMotion) return;
    if (particleRng() < dt * 2.2) {
      spawn(20 + particleRng() * (VIEW_W - 40), VIEW_H - 10, 1, "dust", `${pal.mist}66`);
    }
  }

  function draw(state, dt) {
    const step = Math.max(0, Math.min(0.05, Number(dt) || 0));
    rt += step;
    const pal = state ? zonePalette(state.depth) : zonePalette(0);

    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    const shakeAmp = reducedMotion ? 0 : shake;
    if (shakeAmp > 0.1) {
      ctx.translate((particleRng() - 0.5) * shakeAmp, (particleRng() - 0.5) * shakeAmp);
    }
    shake = Math.max(0, shake - step * 26);

    drawBackground(state || { scrollY: 0 }, pal);
    drawWalls(state || { scrollY: 0 }, pal);

    if (state) {
      const list = state.platforms.filter(
        (platform) => platform.worldY - state.scrollY > -40 && platform.worldY - state.scrollY < VIEW_H + 50
      );
      list.sort((a, b) => a.worldY - b.worldY);
      for (const platform of list) drawPlatform(state, platform, pal);
      drawPlayer(state, pal);
    }

    drawParticles(step);
    drawAmbient(step, pal);
    if (state) drawCeiling(state);

    // 井底深渊雾与速度线
    const fog = ctx.createLinearGradient(0, VIEW_H - 120, 0, VIEW_H);
    fog.addColorStop(0, "#00000000");
    fog.addColorStop(1, "#000000cc");
    ctx.fillStyle = fog;
    ctx.fillRect(0, VIEW_H - 120, VIEW_W, 120);

    if (state && !reducedMotion && state.player.vy > 320) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.35, state.player.vy / 1600);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      for (let i = 0; i < 10; i += 1) {
        const lx = 30 + ((i * 43 + rt * 120) % (VIEW_W - 60));
        const ly = ((i * 71 + rt * 340) % VIEW_H);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly + 26);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 无尽深渊 100 层后：地心红温
    if (state && state.overheated) {
      const pulse = reducedMotion ? 0.16 : 0.14 + Math.sin(rt * 2.2) * 0.05;
      const heat = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.55, VIEW_W * 0.18, VIEW_W / 2, VIEW_H * 0.55, VIEW_W * 0.85);
      heat.addColorStop(0, "#ff5a2e00");
      heat.addColorStop(1, `rgba(255, 78, 34, ${pulse.toFixed(3)})`);
      ctx.fillStyle = heat;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    // 受伤与顶刺红闪
    flash = Math.max(0, flash - step * 2.4);
    if (flash > 0.01) {
      ctx.save();
      const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.25, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.8);
      grad.addColorStop(0, "#ff2f2f00");
      grad.addColorStop(1, `#ff2f2f${Math.round(flash * 90).toString(16).padStart(2, "0")}`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.restore();
    }
    if (glow > 0) {
      glow = Math.max(0, glow - step * 1.4);
      ctx.save();
      const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.6, 10, VIEW_W / 2, VIEW_H * 0.6, VIEW_W);
      grad.addColorStop(0, `#ffe9a3${Math.round(glow * 40).toString(16).padStart(2, "0")}`);
      grad.addColorStop(1, "#ffe9a300");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.restore();
    }

    ctx.restore();
  }

  return {
    resize,
    draw,
    onEvent,
    setReducedMotion(value) {
      reducedMotion = !!value;
      if (reducedMotion) particles = [];
    },
    get camera() {
      return { scale, width: VIEW_W, height: VIEW_H };
    },
  };
}
