// render.mjs — 唯一碰 Canvas 的层。
//
// 美术基线（策划案 §4）：
//   · 明亮珊瑚礁 + 软胶玩具鱼：鱼身用径向/线性渐变做出“软塑料”的圆润感，永远带一枚高光。
//   · 水域上下三段式渐变（浅青绿 → 中碧蓝 → 深宝蓝）+ 顶部斜射光柱 + 缓慢上浮的气泡串。
//   · 可读性设计（不是装饰）：可食目标身后铺暖绿柔光、危险目标身后铺呼吸式珊瑚红凶光、同级无标记；
//     **一律不描轮廓圈** —— 圈会把满屏的鱼变成一堆救生圈，辨识度靠明暗与呼吸节奏，不靠边界线。
//     玩家自己的鱼永远最亮（暖光托底 + 身体自带辉光），在深渊里也一眼可辨。
//   · 海藻丛遮蔽内部：鱼身画在海藻之下，只有“危险警示光”穿透海藻 —— 视野可以被遮，
//     危险提示不能被遮（可读性红线）。
//   · 深渊无尽里屏幕随深度变暗，最后只剩玩家身上那束探照光，但玩家本体永不被黑暗吞掉。
//   · 运动特效：游动气泡尾迹、冲刺速度线、吃鱼吸入粒子、水面焦散光斑 —— 全是无边界的光，不是线条。
//
// 本模块只读 state，不写 state；动画时钟统一取 state.time，暂停即冻结。

import { STATUS, radiusForTier, playerRadius } from "./engine.mjs";

export const WORLD_WIDTH = 1200;

const FONT_ARCADE = '"Bahnschrift", "DIN Alternate", "Impact", "Arial Narrow", sans-serif';

// 各鱼种的软胶配色：body 背 / belly 白肚 / fin 鳍 / accent 花纹
const SKIN = {
  guppy: { body: "#7fdcff", belly: "#eafcff", fin: "#4fc2e8", accent: "#3aa8d4", shape: "oval", pattern: "dot" },
  sardine: { body: "#cfe6f2", belly: "#ffffff", fin: "#9dc4d8", accent: "#7ea6bd", shape: "oval", pattern: "stripe" },
  clown: { body: "#ff9a3c", belly: "#ffe7c8", fin: "#fff3dd", accent: "#f6f0e4", shape: "oval", pattern: "band" },
  tang: { body: "#ffd45c", belly: "#fff3cc", fin: "#f0a63c", accent: "#2f6fa8", shape: "oval", pattern: "wedge" },
  puffer: { body: "#cfae70", belly: "#f7ecd4", fin: "#a5834a", accent: "#8a6a38", shape: "round", pattern: "spike" },
  poison: { body: "#8fd45c", belly: "#e6ffcc", fin: "#5fa83c", accent: "#3f7a24", shape: "oval", pattern: "venom" },
  grouper: { body: "#7f9c74", belly: "#e2ebda", fin: "#5d7752", accent: "#4a6342", shape: "oval", pattern: "spot" },
  shark: { body: "#7d95a8", belly: "#eaf1f6", fin: "#5b7488", accent: "#42607a", shape: "shark", pattern: "shark" },
  orca: { body: "#2f3846", belly: "#f4f9fc", fin: "#1b2129", accent: "#f4f9fc", shape: "shark", pattern: "orca" },
  barracuda: { body: "#a3bac8", belly: "#eef5f9", fin: "#7b93a3", accent: "#5d7d8d", shape: "long", pattern: "bar" },
};

const WATER_RAMPS = {
  1: ["#9ff2e4", "#43c0d4", "#1a6f9e", "#0f5178"],
  2: ["#a8ecc4", "#3fb59c", "#1d6f80", "#0d4a63"],
  3: ["#cfc0ff", "#6f7fd8", "#2f4a99", "#1b2566"],
  4: ["#9fe4ea", "#2f8fbc", "#134f7c", "#082c4c"],
  5: ["#a8dcf5", "#4a63b8", "#1e2470", "#0b0f36"],
  0: ["#8fd0e8", "#2f6fae", "#123a6b", "#050f2c"],
};

const POWER_STYLE = {
  pearl: { core: "#fff6df", halo: "rgba(255,214,140,0.85)" },
  lightning: { core: "#fffbe0", halo: "rgba(255,238,120,0.9)" },
  frenzy: { core: "#ffd0b0", halo: "rgba(255,120,80,0.9)" },
  shoal: { core: "#dcffe8", halo: "rgba(120,240,170,0.9)" },
  heart: { core: "#ffe0ea", halo: "rgba(255,120,160,0.9)" },
};

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// roundRect 兜底：老浏览器没有 ctx.roundRect 时退化为基础圆角路径。
function roundRectPath(c, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  if (typeof c.roundRect === "function") {
    c.beginPath();
    c.roundRect(x, y, w, h, rad);
    return;
  }
  c.beginPath();
  c.moveTo(x + rad, y);
  c.lineTo(x + w - rad, y);
  c.quadraticCurveTo(x + w, y, x + w, y + rad);
  c.lineTo(x + w, y + h - rad);
  c.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  c.lineTo(x + rad, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - rad);
  c.lineTo(x, y + rad);
  c.quadraticCurveTo(x, y, x + rad, y);
  c.closePath();
}

export function createRenderer(canvas, options = {}) {
  const ctx = canvas.getContext("2d");
  let cssWidth = 0;
  let cssHeight = 0;
  let scale = 1;
  let dpr = 1;
  let waterCache = null;
  let reduced = Boolean(options.reducedMotion);
  const particles = [];
  const rings = [];
  const bubbles = [];
  const streaks = [];
  let trailAcc = 0;
  let streakAcc = 0;

  // 柔光：无边界的光晕，只靠明暗把主体从背景里“托”出来。
  // 刻意不用 stroke —— 描边不论多柔都会读成“一个圈”，满屏的鱼就成了满屏的救生圈。
  function backGlow(x, y, radius, inner, mid) {
    const g = ctx.createRadialGradient(x, y, radius * 0.16, x, y, radius);
    g.addColorStop(0, inner);
    g.addColorStop(0.5, mid);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  // 纯视觉的确定性伪随机（与模拟无关，但保证同一局重放画面一致）
  let fxSeed = 0x9e3779b9;
  function fxRandom() {
    fxSeed = (fxSeed + 0x6d2b79f5) >>> 0;
    let t = fxSeed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function resize(width, height, ratio = 1) {
    const nextW = Math.max(1, Math.round(width));
    const nextH = Math.max(1, Math.round(height));
    dpr = Math.min(2.5, Math.max(1, Number(ratio) || 1));
    cssWidth = nextW;
    cssHeight = nextH;
    canvas.width = Math.round(nextW * dpr);
    canvas.height = Math.round(nextH * dpr);
    scale = nextW / WORLD_WIDTH;
    waterCache = null;
    return { width: nextW, height: nextH, scale, worldHeight: Math.round(nextH / scale) };
  }

  function setReducedMotion(value) {
    reduced = Boolean(value);
  }

  // ---------- 环境 ----------
  function waterGradient(zone, worldHeight) {
    if (waterCache && waterCache.height === worldHeight && waterCache.zone === zone) return waterCache.grad;
    const ramp = WATER_RAMPS[zone] ?? WATER_RAMPS[1];
    const grad = ctx.createLinearGradient(0, 0, 0, worldHeight);
    grad.addColorStop(0, ramp[0]);
    grad.addColorStop(0.28, ramp[1]);
    grad.addColorStop(0.66, ramp[2]);
    grad.addColorStop(1, ramp[3]);
    waterCache = { height: worldHeight, zone, grad };
    return grad;
  }

  function drawWater(state, worldHeight, time) {
    const zone = state.mode === "abyss" ? 0 : state.level?.zone ?? 1;
    ctx.fillStyle = waterGradient(zone, worldHeight);
    ctx.fillRect(0, 0, WORLD_WIDTH, worldHeight);

    if (state.mode !== "abyss") {
      const shafts = [
        [0.14, 150, 0.15, 1],
        [0.46, 96, 0.11, 2],
        [0.78, 175, 0.09, 3],
      ];
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const [x, width, alpha, k] of shafts) {
        const drift = reduced ? 0 : Math.sin(time * 0.22 + k * 1.7) * 26;
        const g = ctx.createLinearGradient(0, 0, 0, worldHeight * 0.9);
        g.addColorStop(0, `rgba(255,251,226,${alpha})`);
        g.addColorStop(0.55, `rgba(255,251,226,${alpha * 0.34})`);
        g.addColorStop(1, "rgba(255,251,226,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(WORLD_WIDTH * x + drift, -20);
        ctx.lineTo(WORLD_WIDTH * x + width + drift, -20);
        ctx.lineTo(WORLD_WIDTH * x + width * 2.1 + drift + 90, worldHeight * 0.94);
        ctx.lineTo(WORLD_WIDTH * x - width * 0.5 + drift - 60, worldHeight * 0.94);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // 水面焦散：几团缓慢游走的柔光斑，让整片水“在动”。深渊里画面要留给黑暗，不铺。
    if (state.mode !== "abyss") {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 4; i += 1) {
        const t = time * 0.08 + i * 1.9;
        const cx = WORLD_WIDTH * (0.14 + i * 0.24) + (reduced ? 0 : Math.sin(t) * 92);
        const cy = worldHeight * (0.16 + ((i * 0.29) % 0.68)) + (reduced ? 0 : Math.cos(t * 0.8) * 58);
        const rr = 150 + i * 46;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
        g.addColorStop(0, "rgba(255,252,228,0.05)");
        g.addColorStop(0.6, "rgba(240,255,246,0.018)");
        g.addColorStop(1, "rgba(255,252,228,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 上浮气泡串（确定性：位置只由索引与 time 推出）
    const count = state.mode === "abyss" ? 14 : 22;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < count; i += 1) {
      const seedX = ((i * 137) % 97) / 97;
      const speed = 0.16 + (((i * 53) % 41) / 41) * 0.2;
      const radius = 2 + (((i * 29) % 31) / 31) * 4.2;
      const span = worldHeight + 90;
      const y = worldHeight + 40 - ((time * speed * 100 + i * 71) % span);
      const x = seedX * WORLD_WIDTH + (reduced ? 0 : Math.sin(time * 0.7 + i) * 16);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSeabed(state, worldHeight) {
    const sand = state.level?.sand ?? "#f2d9a8";
    const base = worldHeight - 46;
    const zone = state.level?.zone ?? 1;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, worldHeight);
    for (let x = 0; x <= WORLD_WIDTH; x += 40) {
      ctx.lineTo(x, base + Math.sin(x * 0.011 + zone) * 9);
    }
    ctx.lineTo(WORLD_WIDTH, worldHeight);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, base - 12, 0, worldHeight);
    g.addColorStop(0, sand);
    g.addColorStop(1, "rgba(16,48,70,0.8)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  function drawKelp(state, time) {
    for (const patch of state.kelp ?? []) {
      ctx.save();
      // 半透明雾团：穿行其间能看个大概，但看不清里面有什么
      const g = ctx.createRadialGradient(patch.x, patch.y, patch.r * 0.12, patch.x, patch.y, patch.r);
      g.addColorStop(0, "rgba(20,92,70,0.9)");
      g.addColorStop(0.62, "rgba(18,80,62,0.72)");
      g.addColorStop(1, "rgba(14,64,50,0)");
      ctx.beginPath();
      ctx.arc(patch.x, patch.y, patch.r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(patch.x, patch.y, patch.r * 0.96, 0, Math.PI * 2);
      ctx.clip();
      ctx.lineCap = "round";
      for (let i = 0; i < 7; i += 1) {
        const sway = reduced ? 0 : Math.sin(time * 1.1 + patch.phase + i * 0.9) * 14;
        const bx = patch.x - patch.r * 0.8 + (i / 6) * patch.r * 1.6;
        ctx.beginPath();
        ctx.moveTo(bx, patch.y + patch.r);
        ctx.quadraticCurveTo(bx + sway, patch.y + patch.r * 0.2, bx + sway * 1.8, patch.y - patch.r * 0.95);
        ctx.strokeStyle = i % 2 ? "rgba(74,178,122,0.66)" : "rgba(48,140,98,0.6)";
        ctx.lineWidth = 7;
        ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
    }
  }

  // ---------- 危险物 ----------
  function drawHazards(state, time) {
    for (const hazard of state.hazards ?? []) {
      if (hazard.dead) continue;
      ctx.save();
      ctx.translate(hazard.x, hazard.y);
      if (hazard.kind === "jelly") drawJelly(time, hazard);
      else if (hazard.kind === "urchin") drawUrchin(time, hazard);
      else if (hazard.kind === "mine") drawMine(time, hazard);
      else if (hazard.kind === "net") drawNet(hazard);
      else if (hazard.kind === "chest") drawChest(hazard);
      ctx.restore();
    }
  }

  function drawJelly(time, hazard) {
    const pulse = reduced ? 1 : 1 + Math.sin(time * 2.2 + hazard.phase) * 0.09;
    // 原来这里是一块 solid fill 的圆盘 → 边缘是硬的，读起来就是"水母外面套了个圈"。
    // 换成径向渐隐的光，远了几乎看不见，近了才有压迫感。
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const haloR = hazard.r * 1.7 * pulse;
    const halo = ctx.createRadialGradient(0, 0, hazard.r * 0.4, 0, 0, haloR);
    halo.addColorStop(0, "rgba(211,168,255,0.28)");
    halo.addColorStop(0.62, "rgba(196,150,250,0.1)");
    halo.addColorStop(1, "rgba(211,168,255,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, haloR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "#b98ff0";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    for (let i = 0; i < 6; i += 1) {
      const t = -1 + (i / 5) * 2;
      const sway = reduced ? 0 : Math.sin(time * 3 + i * 1.3 + hazard.phase) * 8;
      ctx.beginPath();
      ctx.moveTo(t * hazard.r * 0.7, hazard.r * 0.35);
      ctx.quadraticCurveTo(t * hazard.r * 0.8 + sway, hazard.r * 1.1, t * hazard.r * 0.5 + sway * 1.6, hazard.r * 1.75);
      ctx.stroke();
    }
    const g = ctx.createLinearGradient(0, -hazard.r * pulse, 0, hazard.r * 0.5);
    g.addColorStop(0, "#f0dcff");
    g.addColorStop(0.55, "#d3a8ff");
    g.addColorStop(1, "#8f6ec4");
    ctx.beginPath();
    ctx.moveTo(-hazard.r * pulse, hazard.r * 0.24);
    ctx.ellipse(0, 0, hazard.r * pulse, hazard.r * 0.78 * pulse, 0, Math.PI, 0);
    ctx.lineTo(hazard.r * pulse, hazard.r * 0.24);
    ctx.quadraticCurveTo(0, hazard.r * 0.62, -hazard.r * pulse, hazard.r * 0.24);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-hazard.r * 0.3, -hazard.r * 0.32, hazard.r * 0.24, hazard.r * 0.15, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fill();
  }

  function drawUrchin(time, hazard) {
    const spin = reduced ? 0 : Math.sin(time * 0.6 + hazard.phase) * 0.05;
    ctx.strokeStyle = "#2b2233";
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    for (let i = 0; i < 14; i += 1) {
      const a = (i / 14) * Math.PI * 2 + spin;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * hazard.r * 0.7, Math.sin(a) * hazard.r * 0.7);
      ctx.lineTo(Math.cos(a) * hazard.r * 1.32, Math.sin(a) * hazard.r * 1.32);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(-hazard.r * 0.3, -hazard.r * 0.35, hazard.r * 0.1, 0, 0, hazard.r);
    g.addColorStop(0, "#7a6890");
    g.addColorStop(1, "#4a3a5c");
    ctx.beginPath();
    ctx.arc(0, 0, hazard.r * 0.74, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-hazard.r * 0.22, -hazard.r * 0.26, hazard.r * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = "#8c6ad0";
    ctx.fill();
  }

  function drawMine(time, hazard) {
    ctx.strokeStyle = "#8f9aa6";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * hazard.r * 0.8, Math.sin(a) * hazard.r * 0.8);
      ctx.lineTo(Math.cos(a) * hazard.r * 1.42, Math.sin(a) * hazard.r * 1.42);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(-hazard.r * 0.3, -hazard.r * 0.35, hazard.r * 0.1, 0, 0, hazard.r);
    g.addColorStop(0, "#6d7883");
    g.addColorStop(1, "#3d4650");
    ctx.beginPath();
    ctx.arc(0, 0, hazard.r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, hazard.r * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = "#8f9aa6";
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = reduced ? 0.7 : 0.35 + 0.65 * Math.abs(Math.sin(time * 3.4 + hazard.phase));
    ctx.beginPath();
    ctx.arc(0, 0, hazard.r * 0.17, 0, Math.PI * 2);
    ctx.fillStyle = "#ff5c5c";
    ctx.fill();
    ctx.restore();
  }

  function drawNet(hazard) {
    ctx.strokeStyle = "#e3cf9c";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, hazard.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.lineWidth = 1.5;
    for (let i = -3; i <= 3; i += 1) {
      const offset = (i / 3) * hazard.r;
      const half = Math.sqrt(Math.max(0, hazard.r * hazard.r - offset * offset));
      ctx.beginPath();
      ctx.moveTo(offset, -half);
      ctx.lineTo(offset, half);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-half, offset);
      ctx.lineTo(half, offset);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawChest(hazard) {
    const s = hazard.r * 1.5;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.42)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = "#a9763f";
    roundRectPath(ctx, -s / 2, -s * 0.36, s, s * 0.78, 6);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#7c5228";
    roundRectPath(ctx, -s / 2, -s * 0.36, s, s * 0.24, 5);
    ctx.fill();
    ctx.fillStyle = "#d9a24a";
    ctx.fillRect(-s * 0.1, -s * 0.4, s * 0.2, s * 0.86);
    ctx.beginPath();
    ctx.arc(0, -s * 0.02, s * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = "#ffe7ae";
    ctx.fill();
  }

  // ---------- 增益泡泡 ----------
  function drawPowers(state, time) {
    for (const power of state.powers ?? []) {
      if (power.dead) continue;
      const st = POWER_STYLE[power.power] ?? POWER_STYLE.pearl;
      const pulse = reduced ? 1 : 1 + Math.sin(time * 3 + power.phase) * 0.12;
      ctx.save();
      ctx.translate(power.x, power.y);
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, power.r * 1.7 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = st.halo;
      ctx.fill();
      ctx.restore();
      const g = ctx.createRadialGradient(-power.r * 0.3, -power.r * 0.35, power.r * 0.12, 0, 0, power.r);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.5, st.core);
      g.addColorStop(1, st.halo);
      ctx.beginPath();
      ctx.arc(0, 0, power.r * pulse, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-power.r * 0.32, -power.r * 0.34, power.r * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();
      if (power.power === "pearl") {
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, power.r * 0.52, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ---------- 鱼 ----------
  function fishBodyPath(shape, rx, ry) {
    ctx.beginPath();
    if (shape === "long") {
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    } else if (shape === "shark") {
      ctx.moveTo(rx, 0);
      ctx.quadraticCurveTo(rx * 0.35, -ry, -rx * 0.62, -ry * 0.66);
      ctx.quadraticCurveTo(-rx * 0.95, -ry * 0.26, -rx * 0.95, 0);
      ctx.quadraticCurveTo(-rx * 0.95, ry * 0.26, -rx * 0.62, ry * 0.66);
      ctx.quadraticCurveTo(rx * 0.35, ry, rx, 0);
    } else if (shape === "round") {
      ctx.ellipse(0, 0, rx * 0.95, ry * 1.12, 0, 0, Math.PI * 2);
    } else {
      ctx.moveTo(rx, 0);
      ctx.quadraticCurveTo(rx * 0.1, -ry, -rx * 0.7, -ry * 0.56);
      ctx.quadraticCurveTo(-rx * 0.94, 0, -rx * 0.7, ry * 0.56);
      ctx.quadraticCurveTo(rx * 0.1, ry, rx, 0);
    }
  }

  function drawFish(entity, time) {
    const skin = SKIN[entity.species] ?? SKIN.guppy;
    const r = entity.r;
    const rx = r * (skin.shape === "long" ? 1.5 : 1.12);
    const ry = r * (skin.shape === "long" ? 0.5 : skin.shape === "round" ? 0.94 : 0.78);
    const wobble = reduced ? 0 : Math.sin(time * (5 + entity.tier * 0.6) + (entity.phase ?? 0)) * 0.05;
    const stunned = entity.stun > 0;

    ctx.save();
    ctx.translate(entity.x, entity.y);
    ctx.scale(entity.facing ?? 1, 1);
    if (stunned) ctx.rotate(0.16);
    if (wobble) ctx.rotate(wobble);

    // 水下投影
    ctx.save();
    ctx.globalAlpha = 0.26;
    ctx.fillStyle = "#02203a";
    ctx.beginPath();
    ctx.ellipse(-r * 0.1, ry * 0.74, rx * 0.84, ry * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 尾鳍
    ctx.beginPath();
    ctx.moveTo(-rx * 0.72, 0);
    ctx.quadraticCurveTo(-rx * 1.28, -ry * 1.34, -rx * 1.5, -ry * 0.5);
    ctx.quadraticCurveTo(-rx * 1.18, 0, -rx * 1.5, ry * 0.5);
    ctx.quadraticCurveTo(-rx * 1.28, ry * 1.34, -rx * 0.72, 0);
    ctx.fillStyle = skin.fin;
    ctx.fill();

    // 背鳍
    ctx.beginPath();
    ctx.moveTo(rx * 0.28, -ry * 0.72);
    ctx.quadraticCurveTo(-rx * 0.1, -ry * 1.68, -rx * 0.6, -ry * 0.6);
    ctx.closePath();
    ctx.fillStyle = skin.fin;
    ctx.fill();

    // 身体：上背色 → 白肚，软胶玩具的核心观感
    fishBodyPath(skin.shape, rx, ry);
    const g = ctx.createLinearGradient(0, -ry, 0, ry);
    g.addColorStop(0, skin.body);
    g.addColorStop(0.56, skin.body);
    g.addColorStop(0.64, skin.belly);
    g.addColorStop(1, skin.belly);
    ctx.fillStyle = g;
    ctx.fill();

    // 花纹
    ctx.save();
    fishBodyPath(skin.shape, rx, ry);
    ctx.clip();
    ctx.fillStyle = skin.accent;
    if (skin.pattern === "band") {
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.ellipse(rx * (0.52 - i * 0.5), 0, rx * 0.1, ry * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (skin.pattern === "stripe") {
      ctx.globalAlpha = 0.5;
      ctx.fillRect(-rx, -ry * 0.16, rx * 2, ry * 0.16);
    } else if (skin.pattern === "wedge") {
      ctx.beginPath();
      ctx.moveTo(rx * 0.66, -ry);
      ctx.lineTo(-rx * 0.1, -ry);
      ctx.lineTo(-rx * 0.7, ry * 1.1);
      ctx.lineTo(-rx * 0.16, ry * 1.1);
      ctx.closePath();
      ctx.fill();
    } else if (skin.pattern === "spot") {
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        ctx.arc(-rx * 0.5 + i * rx * 0.34, (i % 2 ? 0.34 : -0.3) * ry, r * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (skin.pattern === "dot") {
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(-rx * 0.3 + i * rx * 0.3, -ry * 0.34, r * 0.13, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (skin.pattern === "orca") {
      ctx.beginPath();
      ctx.ellipse(rx * 0.42, -ry * 0.5, rx * 0.24, ry * 0.34, -0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (skin.pattern === "shark") {
      ctx.globalAlpha = 0.38;
      ctx.beginPath();
      ctx.moveTo(rx * 0.9, -ry * 0.1);
      ctx.lineTo(rx * 0.2, ry * 0.9);
      ctx.lineTo(rx * 0.1, -ry * 0.9);
      ctx.closePath();
      ctx.fill();
    } else if (skin.pattern === "venom") {
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        ctx.ellipse(-rx * 0.7 + i * rx * 0.42, 0, rx * 0.07, ry * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (skin.pattern === "spike") {
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * rx * 0.84, Math.sin(a) * ry * 0.84, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (skin.pattern === "bar") {
      ctx.globalAlpha = 0.4;
      for (let i = 0; i < 5; i += 1) {
        ctx.fillRect(-rx * 0.8 + i * rx * 0.36, -ry, rx * 0.08, ry * 2);
      }
    }
    ctx.restore();

    // 嘴
    ctx.beginPath();
    ctx.moveTo(rx * 0.98, ry * 0.12);
    ctx.lineTo(rx * 0.6, ry * 0.02);
    ctx.lineTo(rx * 0.98, -ry * 0.16);
    ctx.closePath();
    ctx.fillStyle = "rgba(30,20,14,0.42)";
    ctx.fill();

    // 眼睛
    const eyeX = rx * (skin.shape === "shark" ? 0.52 : 0.6);
    const eyeY = -ry * (skin.shape === "long" ? 0.12 : 0.24);
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, Math.max(2.4, r * 0.15), 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeX + r * 0.05, eyeY, Math.max(1.2, r * 0.075), 0, Math.PI * 2);
    ctx.fillStyle = "#1d1522";
    ctx.fill();

    // 软胶高光
    ctx.beginPath();
    ctx.ellipse(-rx * 0.16, -ry * 0.5, rx * 0.34, ry * 0.19, -0.24, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();

    ctx.restore();
  }

  function relationOf(entity, playerTier) {
    if (entity.elite) return "hunter";
    if (entity.tier > playerTier) return "hunter";
    if (entity.tier < playerTier) return "prey";
    return "peer";
  }

  // 可食 / 危险的可读性：身后铺柔光 —— 暖绿 = 能吃，呼吸的珊瑚红 = 会吃你，同级不标。
  // 危险目标用呼吸节奏（不只靠颜色）区分，因为去掉描边后颜色是唯一色相线索。
  function drawMark(entity, playerTier, time) {
    const relation = relationOf(entity, playerTier);
    if (relation === "peer") return;
    const r = entity.r;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (relation === "prey") {
      backGlow(entity.x, entity.y, r * 2.05, "rgba(150,255,150,0.2)", "rgba(110,240,150,0.055)");
    } else {
      const pulse = reduced ? 0.6 : 0.58 + 0.42 * Math.sin(time * 4.4 + entity.x * 0.02 + entity.y * 0.013);
      backGlow(entity.x, entity.y, r * 2.3 + pulse * 6, `rgba(255,80,56,${0.16 + pulse * 0.2})`, "rgba(255,64,44,0.05)");
    }
    ctx.restore();
  }

  // 头顶阶数：只标“同级及以上”——这才是有决策价值的信息，铺满全屏反而更看不清。
  function drawTierTag(entity, playerTier) {
    if (entity.tier < playerTier) return;
    const text = String(entity.tier);
    const y = entity.y - entity.r * 1.24 - 6;
    const size = Math.round(entity.r * 0.5 + 7);
    ctx.save();
    ctx.font = `700 ${size}px ${FONT_ARCADE}`;
    const w = Math.max(17, ctx.measureText(text).width + 12);
    roundRectPath(ctx, entity.x - w / 2, y - size * 0.68, w, size * 1.3, 7);
    ctx.fillStyle = entity.elite ? "rgba(200,48,32,0.9)" : "rgba(10,32,52,0.74)";
    ctx.fill();
    ctx.fillStyle = "#fff4dd";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, entity.x, y);
    ctx.restore();
  }

  function playerSprite(state) {
    const p = state.player;
    return {
      species: "clown",
      tier: p.tier,
      x: p.x,
      y: p.y,
      r: radiusForTier(p.tier),
      facing: p.facing,
      phase: 0,
      stun: 0,
    };
  }

  function drawShoal(state, time) {
    for (const follower of state.shoal ?? []) {
      // 随行鱼用一层极淡的绿光托底表示“这是你的”，不描边。
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      backGlow(follower.x, follower.y, follower.r * 1.95, "rgba(140,255,190,0.15)", "rgba(120,240,170,0.04)");
      ctx.restore();
      drawFish(
        {
          species: follower.species,
          tier: follower.tier,
          x: follower.x,
          y: follower.y,
          r: follower.r,
          facing: follower.facing,
          phase: 0,
          stun: 0,
        },
        time,
      );
    }
  }

  function drawPlayer(state, time) {
    const p = state.player;
    const blink = p.invuln > 0 && !reduced && Math.floor(time * 12) % 2 === 0;
    const pr = playerRadius(state);

    // 玩家永远最亮：身后一层暖光把自己托在深水里。
    // 这层柔光替代了原来的高亮轮廓圈 —— 深水可辨性靠“比周围亮”，不靠画一个框。
    const beat = reduced ? 0.72 : 0.72 + 0.28 * Math.sin(time * 3);
    const boost = state.frenzy > 0 ? 1.45 : 1;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    backGlow(
      p.x,
      p.y,
      pr * (2.5 + beat * 0.35),
      `rgba(255,222,140,${(0.13 + beat * 0.1) * boost})`,
      "rgba(255,196,90,0.05)",
    );
    ctx.restore();

    ctx.save();
    if (blink) ctx.globalAlpha = 0.4;
    ctx.shadowColor = "rgba(255,214,120,0.9)";
    ctx.shadowBlur = 20;
    drawFish(playerSprite(state), time);
    ctx.restore();
  }

  // ---------- 粒子 / 光环 ----------
  function spawnBurst(x, y, color, count, spread) {
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2 + fxRandom() * 0.5;
      const speed = spread * (0.45 + fxRandom() * 0.85);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0.52,
        max: 0.52,
        color,
        size: 2 + fxRandom() * 3,
      });
    }
  }

  // 吃鱼的“吸入感”：粒子从猎物位置朝玩家嘴里收，而不是原地炸开。
  function spawnSuction(x, y, player) {
    const dx = player.x - x;
    const dy = player.y - y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    for (let i = 0; i < 5; i += 1) {
      const turn = (fxRandom() - 0.5) * 0.9;
      const nx = ux * Math.cos(turn) - uy * Math.sin(turn);
      const ny = ux * Math.sin(turn) + uy * Math.cos(turn);
      const speed = 160 + fxRandom() * 190;
      particles.push({
        x,
        y,
        vx: nx * speed,
        vy: ny * speed,
        life: 0.3,
        max: 0.3,
        color: "rgba(228,255,208,0.95)",
        size: 1.6 + fxRandom() * 2.2,
      });
    }
  }

  // 运动特效：气泡尾迹 + 冲刺速度线。都只在「真在玩」的时候生成 ——
  // 暂停时速度不为零，若不看状态会在暂停画面上继续冒泡。
  function updateTrail(state, dt) {
    const p = state.player;
    const speed = Math.hypot(p.vx, p.vy);
    const live = state.status === STATUS.playing && !reduced;

    if (live && speed > 55) {
      trailAcc += dt * (speed * 0.08 + (p.sprinting ? 2.1 : 0));
      while (trailAcc >= 1) {
        trailAcc -= 1;
        const b = {
          x: p.x - p.vx * 0.05 + (fxRandom() - 0.5) * 10,
          y: p.y - p.vy * 0.05 + (fxRandom() - 0.5) * 10,
          r: 1.5 + fxRandom() * 2.8,
          vx: -p.vx * 0.06 + (fxRandom() - 0.5) * 16,
          vy: -p.vy * 0.06 - 14 - fxRandom() * 26,
          life: 0.5 + fxRandom() * 0.5,
        };
        b.max = b.life;
        bubbles.push(b);
      }
    } else {
      trailAcc = 0;
    }

    if (live && p.sprinting && speed > 150) {
      streakAcc += dt * (16 + speed * 0.05);
      const ang = Math.atan2(p.vy, p.vx);
      const rgb = state.frenzy > 0 ? [255, 198, 122] : [216, 246, 255];
      while (streakAcc >= 1) {
        streakAcc -= 1;
        const spread = (fxRandom() - 0.5) * 1.6;
        streaks.push({
          x: p.x - p.vx * 0.06,
          y: p.y - p.vy * 0.06,
          dx: Math.cos(ang + spread),
          dy: Math.sin(ang + spread),
          len: 30 + fxRandom() * 70,
          life: 0.26,
          max: 0.26,
          rgb,
        });
      }
    } else {
      streakAcc = 0;
    }

    for (let i = bubbles.length - 1; i >= 0; i -= 1) {
      const b = bubbles[i];
      b.life -= dt;
      if (b.life <= 0) {
        bubbles.splice(i, 1);
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= 0.96;
      b.vy *= 0.97;
    }
    for (let i = streaks.length - 1; i >= 0; i -= 1) {
      streaks[i].life -= dt;
      if (streaks[i].life <= 0) streaks.splice(i, 1);
    }
  }

  function updateEffects(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
    for (let i = rings.length - 1; i >= 0; i -= 1) {
      const ring = rings[i];
      ring.life -= dt;
      if (ring.life <= 0) rings.splice(i, 1);
    }
  }

  function drawEffects() {
    for (const p of particles) {
      ctx.globalAlpha = clamp01(p.life / p.max);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    for (const ring of rings) {
      const progress = 1 - ring.life / ring.max;
      ctx.globalAlpha = clamp01(1 - progress) * 0.9;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.from + (ring.to - ring.from) * progress, 0, Math.PI * 2);
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = ring.width;
      ctx.stroke();
    }

    // 尾迹气泡：半透明白 + 一枚高光点，向上飘散
    for (const b of bubbles) {
      const a = clamp01(b.life / b.max);
      const r = b.r * (0.62 + 0.38 * a);
      ctx.globalAlpha = a * 0.42;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.globalAlpha = a * 0.8;
      ctx.beginPath();
      ctx.arc(b.x - r * 0.32, b.y - r * 0.34, Math.max(0.6, r * 0.3), 0, Math.PI * 2);
      ctx.fillStyle = "#e2f7ff";
      ctx.fill();
    }

    // 冲刺速度线：从鱼身后沿航向反方向拉出，命中的一瞬间最亮最长
    ctx.lineCap = "round";
    for (const s of streaks) {
      const a = clamp01(s.life / s.max);
      const len = s.len * (1.12 - a * 0.3);
      ctx.globalAlpha = a * 0.5;
      ctx.strokeStyle = `rgba(${s.rgb[0]},${s.rgb[1]},${s.rgb[2]},1)`;
      ctx.lineWidth = 1.4 + a * 2.4;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + s.dx * len, s.y + s.dy * len);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.globalAlpha = 1;
  }

  function consumeEvents(events, player) {
    for (const event of events ?? []) {
      switch (event.type) {
        case "eat":
          spawnBurst(event.x, event.y, "rgba(190,255,170,0.9)", 6, 80);
          spawnSuction(event.x, event.y, player);
          break;
        case "combo":
          spawnBurst(player.x, player.y, "rgba(255,222,140,0.9)", 3 + Math.min(7, event.combo), 118);
          break;
        case "graze":
          spawnBurst(event.x, event.y, "rgba(255,255,255,0.8)", 5, 74);
          break;
        case "grow":
          rings.push({ x: player.x, y: player.y, from: 22, to: 168, life: 0.6, max: 0.6, color: "rgba(255,246,214,0.95)", width: 5 });
          spawnBurst(player.x, player.y, "rgba(255,250,224,0.95)", 12, 190);
          break;
        case "frenzy":
          rings.push({ x: player.x, y: player.y, from: 30, to: 340, life: 0.52, max: 0.52, color: "rgba(255,192,112,0.95)", width: 7 });
          spawnBurst(player.x, player.y, "rgba(255,172,92,0.95)", 18, 300);
          break;
        case "bitten":
          spawnBurst(event.x, event.y, "rgba(255,120,96,0.95)", 16, 210);
          break;
        case "spike":
          spawnBurst(event.x, event.y, "rgba(200,150,255,0.9)", 10, 140);
          break;
        case "boom":
        case "defuse":
          spawnBurst(event.x, event.y, "rgba(255,190,110,0.95)", 22, 250);
          break;
        case "subdue":
          spawnBurst(event.x, event.y, "rgba(255,240,180,1)", 30, 290);
          break;
        case "tail":
          spawnBurst(event.x, event.y, "rgba(255,220,120,0.95)", 12, 165);
          break;
        case "power":
        case "chest":
          spawnBurst(event.x, event.y, "rgba(255,240,200,0.95)", 10, 130);
          break;
        case "saved":
          spawnBurst(event.x, event.y, "rgba(150,255,200,0.95)", 12, 150);
          break;
        case "pressureFull":
          spawnBurst(player.x, player.y, "rgba(255,96,88,0.9)", 14, 200);
          break;
        default:
          break;
      }
    }
  }

  // ---------- 主绘制 ----------
  function draw(state, view = {}) {
    if (!cssWidth || !cssHeight || !state?.player) return;
    const time = view.time ?? state.time ?? 0;
    const dt = Math.min(0.05, Math.max(0, view.dt ?? 1 / 60));
    const worldHeight = state.world?.height ?? Math.round(cssHeight / scale);
    const playerTier = state.player.tier;

    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.clearRect(0, 0, WORLD_WIDTH, worldHeight);

    drawWater(state, worldHeight, time);
    if (state.mode !== "abyss") drawSeabed(state, worldHeight);
    drawHazards(state, time);

    const fish = (state.entities ?? []).filter((entity) => !entity.dead);
    // 小的在后、大的在前，玩家永远在最前 —— 层次就是食物链
    for (const entity of fish) if (entity.tier < playerTier) drawFish(entity, time);
    for (const entity of fish) if (entity.tier >= playerTier && !entity.elite) drawFish(entity, time);
    for (const entity of fish) if (entity.elite) drawFish(entity, time);
    drawPowers(state, time);
    drawShoal(state, time);

    // 海藻：盖在鱼身上形成“看不清里面”的迷雾，但危险警示纹会重新画在它之上
    drawKelp(state, time);

    drawPlayer(state, time);

    for (const entity of fish) drawMark(entity, playerTier, time);
    for (const entity of fish) drawTierTag(entity, playerTier);

    consumeEvents(view.events, state.player);
    updateTrail(state, dt);
    updateEffects(dt);
    drawEffects();

    // 危险感知暗角（不改变物理，只收窄视野）
    const danger = clamp01(state.danger ?? 0);
    const depthDark = state.mode === "abyss" ? clamp01(state.abyss?.light ?? 0) : 0;
    if (danger > 0.01 || depthDark > 0.01) {
      const vign = Math.max(danger * 0.45, depthDark * 0.95);
      ctx.save();
      const g = ctx.createRadialGradient(
        state.player.x,
        state.player.y,
        96,
        state.player.x,
        state.player.y,
        Math.max(WORLD_WIDTH, worldHeight) * 0.8,
      );
      g.addColorStop(0, "rgba(2,16,32,0)");
      g.addColorStop(1, `rgba(2,14,28,${vign})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, WORLD_WIDTH, worldHeight);
      ctx.restore();
    }

    if (state.frenzy > 0) {
      const pulse = reduced ? 0.6 : 0.5 + 0.5 * Math.sin(time * 6);
      ctx.save();
      const g = ctx.createRadialGradient(
        WORLD_WIDTH / 2,
        worldHeight / 2,
        Math.min(WORLD_WIDTH, worldHeight) * 0.24,
        WORLD_WIDTH / 2,
        worldHeight / 2,
        WORLD_WIDTH * 0.72,
      );
      g.addColorStop(0, "rgba(255,140,80,0)");
      g.addColorStop(1, `rgba(255,120,60,${0.15 + pulse * 0.14})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, WORLD_WIDTH, worldHeight);
      ctx.restore();
    }

    if (state.pressure >= 1) {
      const pulse = reduced ? 0.4 : 0.3 + 0.3 * Math.sin(time * 6);
      ctx.fillStyle = `rgba(255,70,70,${pulse * 0.2})`;
      ctx.fillRect(0, 0, WORLD_WIDTH, worldHeight);
    }

    if (state.player.poison > 0) {
      ctx.fillStyle = "rgba(150,220,90,0.12)";
      ctx.fillRect(0, 0, WORLD_WIDTH, worldHeight);
    }

    if (state.player.snare > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(227,207,156,0.75)";
      ctx.lineWidth = 1.6;
      const cx = state.player.x;
      const cy = state.player.y;
      const rr = playerRadius(state) * 1.75;
      for (let i = -3; i <= 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(cx + (i / 3) * rr, cy - rr);
        ctx.lineTo(cx + (i / 3) * rr, cy + rr);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - rr, cy + (i / 3) * rr);
        ctx.lineTo(cx + rr, cy + (i / 3) * rr);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  return {
    resize,
    setReducedMotion,
    draw,
    clearEffects() {
      particles.length = 0;
      rings.length = 0;
      bubbles.length = 0;
      streaks.length = 0;
      trailAcc = 0;
      streakAcc = 0;
    },
    get scale() {
      return scale;
    },
  };
}
