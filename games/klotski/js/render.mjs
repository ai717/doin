// filepath: games/klotski/js/render.mjs
// Canvas 渲染层：棋盘、方块、拖拽/滑动补间、出口光效、粒子与氛围浮尘。
// 规范：devicePixelRatio 缩放（上限 3）、ResizeObserver 自适应、dt 上限 0.1s、
// prefers-reduced-motion 降级、脏帧渲染（无动画无粒子时不重绘）。

import { COLS, ROWS, EXIT_R, EXIT_C, KIND, occupancy, maxSlide, mulberry32, textureSeeds } from "./engine.mjs";

const MAX_DPR = 2; // 3 倍屏下像素量是 2 倍的 2.25 倍，收益极低，统一封顶
const PAD = 10;
const MOVE_MS = 120;
const AMBIENT_FPS = 20; // 只有氛围浮尘在动时的重绘频率
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Source Han Sans SC", "Noto Sans CJK SC", Arial, sans-serif';

const PALETTE = {
  [KIND.CAOCAO]: { top: "#e0574f", mid: "#c3272b", bottom: "#8d1c1f", edge: "#f0b96a", label: "#fff2dd" },
  [KIND.GUANYU]: { top: "#4fa392", mid: "#2f7d6b", bottom: "#1e5449", edge: "#cfe6dc", label: "#f2fff9" },
  [KIND.GENERAL]: { top: "#6b7fb0", mid: "#445a8c", bottom: "#2b3a5e", edge: "#c9d6f2", label: "#f4f8ff" },
  [KIND.SOLDIER]: { top: "#f6eeda", mid: "#e4d6b4", bottom: "#bda87c", edge: "#8a7550", label: "#4a3c26" },
};

// 默认刻字（中文兜底）。多语言由 i18n 通过 labelMap 覆盖，见 setLabelMap()。
const LABELS = {
  [KIND.CAOCAO]: "曹操",
  [KIND.GUANYU]: "关羽",
  [KIND.GENERAL]: "将",
  [KIND.SOLDIER]: "兵",
};

/** 标签的候选行组合：多行优先（方块够高时更醒目），再退回单行 */
function labelLineOptions(text) {
  const raw = String(text == null ? "" : text).trim();
  if (!raw) return [];
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const mid = Math.ceil(words.length / 2);
    return [[words.slice(0, mid).join(" "), words.slice(mid).join(" ")], [raw]];
  }
  return [[raw]];
}

/**
 * 自适应排版：在 maxW × maxH 内取尽可能大的字号。
 * 返回 { size, lines }；完全放不下时返回 null，由调用方兜底。
 */
function fitLabel(ctx, text, baseSize, maxW, maxH) {
  if (typeof ctx.measureText !== "function") return null;
  const minSize = Math.max(10, Math.round(baseSize * 0.5));
  const start = Math.max(minSize, Math.round(baseSize));
  for (const lines of labelLineOptions(text)) {
    for (let size = start; size >= minSize; size -= 1) {
      ctx.font = `600 ${size}px ${FONT}`;
      let widest = 0;
      for (const line of lines) widest = Math.max(widest, ctx.measureText(line).width);
      if (widest <= maxW && size * 1.12 * lines.length <= maxH) return { size, lines };
    }
  }
  return null;
}

function prefersReduced() {
  try {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function easeOut(t) {
  const p = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - p, 3);
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
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
  const ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
  if (!ctx) {
    // 环境不支持 Canvas 时返回一个全空实现，保证逻辑层不被打断
    return {
      ok: false,
      mount() {},
      destroy() {},
      resize() {},
      setState() {},
      setLevel() {},
      setSelected() {},
      setLabels() {},
      setDrag() {},
      burst() {},
      invalidate() {},
      cellAt: () => null,
      pieceAt: () => null,
      metrics: () => ({ cell: 0, ox: 0, oy: 0, width: 0, height: 0 }),
    };
  }

  let state = null;
  let levelId = "";
  let selectedId = null;
  let showLabels = options.labels !== false;
  let labelMap = options.labelMap || null;
  let drag = null;
  let reduce = prefersReduced();

  let cssW = 0;
  let cssH = 0;
  let dpr = 1;
  let cell = 0;
  let ox = 0;
  let oy = 0;

  const anims = new Map(); // id -> { fromR, fromC, t, dur }
  const particles = [];
  const motes = [];
  const seeds = { value: [] };

  let raf = 0;
  let last = 0;
  let dirty = true;
  let flash = 0; // 通关闪光 0..1
  let ambientAcc = 0;

  // 背景（木盘 + 网格）离屏缓存：只在尺寸/关卡变化时重绘
  let bg = null;
  let bgDirty = true;

  function refreshSeeds() {
    seeds.value = textureSeeds(levelId || "klotski", 12);
    motes.length = 0;
    if (reduce) return;
    const rand = mulberry32(seeds.value[0] ?? 1);
    for (let i = 0; i < 14; i++) {
      motes.push({
        x: rand(),
        y: rand(),
        r: 0.6 + rand() * 1.6,
        vx: (rand() - 0.5) * 0.006,
        vy: -0.004 - rand() * 0.008,
        a: 0.05 + rand() * 0.12,
      });
    }
  }

  function measure() {
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: cssW, height: cssH };
    const w = Math.max(1, Math.floor(rect.width || canvas.clientWidth || 0));
    const h = Math.max(1, Math.floor(rect.height || canvas.clientHeight || 0));
    dpr = Math.min(MAX_DPR, Math.max(1, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1));
    cssW = w;
    cssH = h;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const innerW = Math.max(1, w - PAD * 2);
    const innerH = Math.max(1, h - PAD * 2);
    cell = Math.max(8, Math.floor(Math.min(innerW / COLS, innerH / ROWS)));
    ox = Math.round((w - cell * COLS) / 2);
    oy = Math.round((h - cell * ROWS) / 2);
    bg = null;
    bgDirty = true;
    dirty = true;
  }

  function pieceRect(piece, r, c) {
    return {
      x: ox + c * cell,
      y: oy + r * cell,
      w: piece.w * cell,
      h: piece.h * cell,
    };
  }

  function renderPos(piece) {
    let r = piece.r;
    let c = piece.c;
    const anim = anims.get(piece.id);
    if (anim && anim.t < 1) {
      const k = easeOut(anim.t);
      r = anim.fromR + (piece.r - anim.fromR) * k;
      c = anim.fromC + (piece.c - anim.fromC) * k;
    } else if (anim) {
      anims.delete(piece.id);
    }
    if (drag && drag.id === piece.id) {
      if (drag.axis === "x") c += drag.offset;
      else r += drag.offset;
    }
    return { r, c };
  }

  function drawBoard(g) {
    const w = cell * COLS;
    const h = cell * ROWS;

    g.save();
    // 外框：墨色木盘 + 鎏金描边
    roundRect(ctx, ox - 6, oy - 6, w + 12, h + 12, 14);
    const shell = g.createLinearGradient(ox, oy - 6, ox, oy + h + 6);
    shell.addColorStop(0, "#2a2119");
    shell.addColorStop(1, "#191410");
    g.fillStyle = shell;
    g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = "rgba(212,162,76,0.55)";
    g.stroke();

    // 内底
    roundRect(g, ox, oy, w, h, 8);
    const inner = g.createLinearGradient(ox, oy, ox, oy + h);
    inner.addColorStop(0, "#1b1611");
    inner.addColorStop(1, "#120f0d");
    g.fillStyle = inner;
    g.fill();

    // 网格
    g.strokeStyle = "rgba(212,162,76,0.13)";
    g.lineWidth = 1;
    g.beginPath();
    for (let c = 1; c < COLS; c++) {
      g.moveTo(ox + c * cell + 0.5, oy);
      g.lineTo(ox + c * cell + 0.5, oy + h);
    }
    for (let r = 1; r < ROWS; r++) {
      g.moveTo(ox, oy + r * cell + 0.5);
      g.lineTo(ox + w, oy + r * cell + 0.5);
    }
    g.stroke();
    g.restore();
  }

  function drawExit() {
    const x = ox + EXIT_C * cell;
    const y = oy + (EXIT_R + 2) * cell;
    const w = cell * 2;
    const glow = 0.25 + 0.2 * Math.sin(flash * Math.PI) + (reduce ? 0 : 0.06 * Math.sin(Date.now() / 420));
    ctx.save();
    const g = ctx.createLinearGradient(x, y - 10, x, y + 22);
    g.addColorStop(0, "rgba(232,195,122,0)");
    g.addColorStop(1, `rgba(232,195,122,${Math.max(0, glow).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(x, y - 10, w, 32);

    ctx.strokeStyle = "rgba(232,195,122,0.75)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 1);
    ctx.lineTo(x + w - 4, y + 1);
    ctx.stroke();
    ctx.setLineDash([]);

    // 向下的箭头
    ctx.fillStyle = "rgba(232,195,122,0.8)";
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 7, y + 7);
    ctx.lineTo(x + w / 2 + 7, y + 7);
    ctx.lineTo(x + w / 2, y + 16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** 中式回纹角：四角对称的直角折线，给方块加"印玺/砖雕"的装饰感 */
  function drawFretCorners(g, x, y, w, h, color, alpha, unit) {
    const s = Math.max(2, unit);
    g.save();
    g.globalAlpha = alpha;
    g.strokeStyle = color;
    g.lineWidth = Math.max(1, s * 0.2);
    g.lineCap = "butt";
    g.beginPath();
    const corners = [
      [x, y, 1, 1],
      [x + w, y, -1, 1],
      [x, y + h, 1, -1],
      [x + w, y + h, -1, -1],
    ];
    for (const [cx, cy, sx, sy] of corners) {
      g.moveTo(cx + sx * s * 2.6, cy + sy * s * 0.8);
      g.lineTo(cx + sx * s * 2.6, cy + sy * s * 2.6);
      g.lineTo(cx + sx * s * 0.8, cy + sy * s * 2.6);
    }
    g.stroke();
    g.restore();
  }

  /** 每类方块的专属纹理：曹操回纹 / 关羽偃月 / 将铠甲竖纹 / 兵铜钱 */
  function drawPieceTexture(g, kind, x, y, w, h) {
    const ink = "rgba(0,0,0,0.24)";
    const lift = "rgba(255,255,255,0.22)";
    const unit = Math.min(w, h) * 0.075;
    g.save();
    if (kind === KIND.CAOCAO) {
      drawFretCorners(g, x, y, w, h, "#ffe9c0", 0.5, unit);
      g.strokeStyle = "rgba(255,233,192,0.26)";
      g.lineWidth = Math.max(1, Math.min(w, h) * 0.012);
      g.beginPath();
      g.moveTo(x + w * 0.22, y + h * 0.17);
      g.lineTo(x + w * 0.78, y + h * 0.17);
      g.moveTo(x + w * 0.22, y + h * 0.83);
      g.lineTo(x + w * 0.78, y + h * 0.83);
      g.stroke();
    } else if (kind === KIND.GUANYU) {
      // 偃月刀：一道横贯的弯月弧 + 刀背暗线
      g.strokeStyle = lift;
      g.lineWidth = Math.max(1.4, Math.min(w, h) * 0.1);
      g.beginPath();
      g.moveTo(x + w * 0.08, y + h * 0.8);
      g.quadraticCurveTo(x + w * 0.5, y + h * 0.12, x + w * 0.92, y + h * 0.8);
      g.stroke();
      g.strokeStyle = ink;
      g.lineWidth = Math.max(1, Math.min(w, h) * 0.04);
      g.beginPath();
      g.moveTo(x + w * 0.12, y + h * 0.93);
      g.quadraticCurveTo(x + w * 0.5, y + h * 0.32, x + w * 0.88, y + h * 0.93);
      g.stroke();
    } else if (kind === KIND.GENERAL) {
      // 铠甲竖纹：暗线 + 亮线成对，模拟甲片
      g.lineWidth = Math.max(1, Math.min(w, h) * 0.045);
      for (const [offset, color] of [[0, ink], [Math.min(w, h) * 0.05, lift]]) {
        g.strokeStyle = color;
        g.beginPath();
        for (let i = 1; i <= 3; i++) {
          const px = x + (w * i) / 4 + offset;
          g.moveTo(px, y + h * 0.18);
          g.lineTo(px, y + h * 0.82);
        }
        g.stroke();
      }
    } else {
      // 兵：铜钱（外圆内方），字落在方孔上
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) * 0.34;
      g.strokeStyle = ink;
      g.lineWidth = Math.max(1.2, Math.min(w, h) * 0.075);
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
      const q = r * 0.42;
      g.strokeRect(cx - q, cy - q, q * 2, q * 2);
    }
    g.restore();
  }

  function drawPiece(piece, r, c) {
    const rect = pieceRect(piece, r, c);
    const pad = Math.max(2, Math.round(cell * 0.07));
    const x = rect.x + pad;
    const y = rect.y + pad;
    const w = rect.w - pad * 2;
    const h = rect.h - pad * 2;
    const skin = PALETTE[piece.kind] || PALETTE[KIND.SOLDIER];
    const radius = Math.max(6, Math.round(cell * 0.18));
    const selected = piece.id === selectedId;

    ctx.save();
    // 投影
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = selected ? 18 : 10;
    ctx.shadowOffsetY = selected ? 5 : 3;

    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, skin.top);
    grad.addColorStop(0.55, skin.mid);
    grad.addColorStop(1, skin.bottom);
    roundRect(ctx, x, y, w, h, radius);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 面内：斜向高光 + 左侧反光 + 底部厚度 + 专属纹理
    ctx.save();
    roundRect(ctx, x, y, w, h, radius);
    ctx.clip();

    const gloss = ctx.createLinearGradient(x, y, x + w * 0.6, y + h * 0.75);
    gloss.addColorStop(0, "rgba(255,255,255,0.26)");
    gloss.addColorStop(0.45, "rgba(255,255,255,0.06)");
    gloss.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gloss;
    ctx.fillRect(x, y, w, h);

    const sideLight = ctx.createLinearGradient(x, y, x + w * 0.22, y);
    sideLight.addColorStop(0, "rgba(255,255,255,0.2)");
    sideLight.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sideLight;
    ctx.fillRect(x, y, w * 0.22, h);

    const thickness = ctx.createLinearGradient(x, y + h * 0.6, x, y + h);
    thickness.addColorStop(0, "rgba(0,0,0,0)");
    thickness.addColorStop(1, "rgba(0,0,0,0.32)");
    ctx.fillStyle = thickness;
    ctx.fillRect(x, y + h * 0.6, w, h * 0.4);

    drawPieceTexture(ctx, piece.kind, x, y, w, h);
    ctx.restore();

    // 描边
    roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, radius);
    ctx.lineWidth = selected ? 2.6 : 1.2;
    ctx.strokeStyle = selected ? "#f7dda6" : skin.edge;
    ctx.globalAlpha = selected ? 1 : 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 内框（中式回纹感的细线）
    roundRect(ctx, x + 5, y + 5, w - 10, h - 10, Math.max(3, radius - 4));
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.stroke();

    // 选中：外圈鎏金环
    if (selected) {
      roundRect(ctx, x - 2.5, y - 2.5, w + 5, h + 5, radius + 2);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = "rgba(244,215,154,0.7)";
      ctx.stroke();
    }

    // 文字：先描深色边再填充，做出凹刻感；按方块尺寸自适应字号/换行
    const text = (labelMap && labelMap[piece.kind]) || LABELS[piece.kind] || "";
    if (showLabels && text) {
      const base =
        piece.kind === KIND.CAOCAO ? cell * 0.42 : piece.kind === KIND.SOLDIER ? cell * 0.3 : cell * 0.34;
      const fitted = fitLabel(ctx, text, base, w * 0.84, h * 0.8);
      const size = fitted ? fitted.size : Math.max(10, Math.round(base * 0.5));
      const lines = fitted ? fitted.lines : [String(text).trim()];
      const lineH = size * 1.12;
      ctx.font = `600 ${size}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = piece.kind === KIND.SOLDIER ? 0.85 : 0.96;
      const tx = x + w / 2;
      const ty = y + h / 2 + 1 - ((lines.length - 1) * lineH) / 2;
      ctx.lineWidth = Math.max(2, size * 0.14);
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.fillStyle = skin.label;
      for (let i = 0; i < lines.length; i++) {
        const ly = ty + i * lineH;
        ctx.strokeText(lines[i], tx, ly);
        ctx.fillText(lines[i], tx, ly);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawParticles() {
    if (!particles.length) return;
    ctx.save();
    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.max);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + alpha * 0.8), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMotes() {
    if (reduce || !motes.length) return;
    const w = cell * COLS;
    const h = cell * ROWS;
    ctx.save();
    for (const m of motes) {
      ctx.globalAlpha = m.a;
      ctx.fillStyle = "#e8c37a";
      ctx.beginPath();
      ctx.arc(ox + m.x * w, oy + m.y * h, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 背景层只在尺寸/关卡变化时重绘一次，之后每帧只做一次 drawImage */
  function ensureBg() {
    if (bg && !bgDirty) return bg;
    if (!bg) {
      bg = typeof document !== "undefined" && document.createElement ? document.createElement("canvas") : null;
    }
    if (!bg || !canvas.width || !canvas.height) return null;
    bg.width = canvas.width;
    bg.height = canvas.height;
    const g = bg.getContext("2d");
    if (!g) return null;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cssW, cssH);
    drawBoard(g);
    bgDirty = false;
    return bg;
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const layer = ensureBg();
    if (layer) ctx.drawImage(layer, 0, 0, cssW, cssH);
    else drawBoard(ctx);
    drawMotes();
    if (state) {
      for (const piece of state.pieces) {
        const pos = renderPos(piece);
        drawPiece(piece, pos.r, pos.c);
      }
    }
    drawExit();
    drawParticles();
    if (flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.sin(flash * Math.PI)) * 0.18;
      ctx.fillStyle = "#ffe9b8";
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.restore();
    }
  }

  /** 返回 { active: 需要满帧重绘, ambient: 只有氛围动画在动 } */
  function step(dt) {
    let active = false;
    let ambient = false;

    for (const [id, anim] of anims) {
      anim.t += dt * 1000 / (anim.dur || MOVE_MS);
      if (anim.t >= 1) {
        anim.t = 1;
        anims.delete(id);
      }
      active = true;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 620 * dt;
      active = true;
    }

    if (!reduce && motes.length) {
      for (const m of motes) {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        if (m.y < -0.05) {
          m.y = 1.05;
          m.x = (m.x + 0.37) % 1;
        }
        if (m.x < -0.05) m.x = 1.05;
        if (m.x > 1.05) m.x = -0.05;
      }
      ambient = true;
    }

    if (flash > 0) {
      flash = Math.max(0, flash - dt * 0.9);
      active = true;
    }

    return { active, ambient };
  }

  function frame(now) {
    raf = 0;
    // dt 上限 0.1s：切标签页回来时不会把动画一次性推完
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)) || 0;
    last = now;
    const { active, ambient } = step(dt);

    if (active || dirty) {
      dirty = false;
      ambientAcc = 0;
      draw();
    } else if (ambient) {
      // 只剩氛围浮尘时降频重绘，省电
      ambientAcc += dt;
      if (ambientAcc >= 1 / AMBIENT_FPS) {
        ambientAcc = 0;
        draw();
      }
    }

    if (active || dirty || ambient) {
      raf = requestAnimationFrame(frame);
    }
  }

  function schedule() {
    if (raf) return;
    if (typeof requestAnimationFrame !== "function") {
      draw();
      return;
    }
    last = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    raf = requestAnimationFrame(frame);
  }

  let observer = null;
  function onResize() {
    measure();
    schedule();
  }

  return {
    ok: true,

    mount() {
      measure();
      refreshSeeds();
      if (typeof ResizeObserver === "function" && canvas.parentElement) {
        observer = new ResizeObserver(onResize);
        observer.observe(canvas.parentElement);
      }
      if (typeof window !== "undefined" && window.addEventListener) {
        window.addEventListener("resize", onResize);
        window.addEventListener("orientationchange", onResize);
      }
      // 切到后台就停帧，回到前台再补一帧，避免空转耗电
      if (typeof document !== "undefined" && document.addEventListener) {
        document.addEventListener("visibilitychange", () => {
          if (document.hidden) {
            if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
            raf = 0;
          } else {
            dirty = true;
            schedule();
          }
        });
      }
      if (typeof window !== "undefined" && window.matchMedia) {
        try {
          const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
          const onChange = (event) => {
            reduce = !!event.matches;
            refreshSeeds();
            dirty = true;
            schedule();
          };
          if (mq.addEventListener) mq.addEventListener("change", onChange);
          else if (mq.addListener) mq.addListener(onChange);
        } catch {
          /* 老浏览器忽略 */
        }
      }
      schedule();
    },

    destroy() {
      if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
      raf = 0;
      if (observer && observer.disconnect) observer.disconnect();
      observer = null;
    },

    resize: onResize,

    invalidate() {
      dirty = true;
      schedule();
    },

    setLevel(id) {
      levelId = String(id || "");
      bgDirty = true;
      refreshSeeds();
      anims.clear();
      drag = null;
      dirty = true;
      schedule();
    },

    setLabels(value) {
      showLabels = value !== false;
      dirty = true;
      schedule();
    },

    /** 覆盖棋子刻字，形如 { caocao: "Cao Cao", ... }；传 null 回落内置中文表 */
    setLabelMap(map) {
      labelMap = map || null;
      dirty = true;
      schedule();
    },

    setSelected(id) {
      if (selectedId === id) return;
      selectedId = id;
      dirty = true;
      schedule();
    },

    /** 同步引擎状态；位置变化的方块自动获得补间动画 */
    setState(next) {
      const prev = state;
      state = next;
      if (prev && next) {
        const before = new Map(prev.pieces.map((piece) => [piece.id, piece]));
        for (const piece of next.pieces) {
          const old = before.get(piece.id);
          if (!old) continue;
          if (old.r !== piece.r || old.c !== piece.c) {
            anims.set(piece.id, {
              fromR: old.r,
              fromC: old.c,
              t: reduce ? 1 : 0,
              dur: MOVE_MS,
            });
          }
        }
      }
      dirty = true;
      schedule();
    },

    setDrag(next) {
      drag = next;
      dirty = true;
      schedule();
    },

    /** 通关金色礼花 */
    burst(cells) {
      flash = 1;
      if (reduce) {
        dirty = true;
        schedule();
        return;
      }
      const list = Array.isArray(cells) && cells.length ? cells : [{ r: EXIT_R, c: EXIT_C }];
      const rand = mulberry32((seeds.value[1] ?? 7) + particles.length);
      for (const spot of list) {
        const cx = ox + (spot.c + 0.5) * cell;
        const cy = oy + (spot.r + 0.5) * cell;
        const count = spot.big ? 26 : 12;
        for (let i = 0; i < count; i++) {
          const angle = -Math.PI / 2 + (rand() - 0.5) * 2.4;
          const speed = 90 + rand() * 220;
          particles.push({
            x: cx + (rand() - 0.5) * cell,
            y: cy + (rand() - 0.5) * cell,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.5 + rand() * 0.6,
            max: 1.1,
            size: 1.4 + rand() * 2.6,
            color: rand() > 0.4 ? "#e8c37a" : rand() > 0.5 ? "#d9524b" : "#f2e8d5",
          });
        }
      }
      dirty = true;
      schedule();
    },

    /** 屏幕坐标 -> 格子坐标（越界返回 null） */
    cellAt(clientX, clientY) {
      const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
      if (!rect) return null;
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const c = Math.floor((x - ox) / cell);
      const r = Math.floor((y - oy) / cell);
      if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return null;
      return { r, c };
    },

    /** 屏幕坐标 -> 方块 id */
    pieceAt(clientX, clientY) {
      if (!state) return null;
      const spot = this.cellAt(clientX, clientY);
      if (!spot) return null;
      const grid = occupancy(state);
      return grid[spot.r * COLS + spot.c];
    },

    /** 该方块在某方向最多能滑几格（给拖拽夹取用） */
    slideRange(id, dir) {
      if (!state) return 0;
      return maxSlide(state, id, dir);
    },

    metrics() {
      return { cell, ox, oy, width: cell * COLS, height: cell * ROWS };
    },
  };
}
