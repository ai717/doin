// filepath: games/jigsaw/js/artwork.mjs
// 程序化抽象艺术图：同一 seed 必得同一张图（确定性），零外链图库、零版权素材。
// 配方（recipe）用 0..1 归一化坐标描述，可在任意尺寸渲染 —— 棋盘切片与选关缩略图共用同一份配方。
// 只有 createArtworkCanvas 会碰 document；配方生成与绘制逻辑本身可被 node:test 直接验证。

import { mulberry32, hashString } from "./engine.mjs";

/** 棋盘切片用的默认离屏分辨率 */
export const ART_SIZE = 512;

const clamp01 = (value) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);
const round4 = (value) => Math.round(value * 10000) / 10000;
const round3 = (value) => Math.round(value * 1000) / 1000;

/** hsla 字符串；色相环内归一化，避免负数或 >360 的取值 */
export function hsla(hue, sat, light, alpha = 1) {
  const h = ((Math.round(hue) % 360) + 360) % 360;
  const s = Math.round(Math.min(100, Math.max(0, sat)));
  const l = Math.round(Math.min(100, Math.max(0, light)));
  const a = Math.round(clamp01(alpha) * 1000) / 1000;
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

/**
 * 由 seed 生成艺术图配方。
 * @param {number|string} seed
 * @param {{detail?: number, contrast?: number}} [options]
 *   detail  0 = 少量大色块（易辨认），1 = 多层细腻纹理（大师章）
 *   contrast 0 = 柔和低对比，1 = 硬边高对比（切片后仍能看出视觉锚点）
 *   两者都直接服务于"切片后还能不能辨认"：contrast 决定底色明暗跨度，
 *   detail 决定几何特征的数量（网格铺开，保证每格附近都有锚点）。
 */
export function artworkRecipe(seed, options = {}) {
  const rng = mulberry32(hashString(`jigsaw-art:${seed}`));
  const detail = clamp01(options.detail ?? 0.5);
  const contrast = clamp01(options.contrast ?? 0.5);

  const baseHue = Math.round(rng() * 360);
  // 色相跨度同样由 contrast 决定。拼图最有效的辨认线索其实是"色相不同"——
  // 相邻格一个偏青一个偏绿，比"亮度差 5"好认得多；同时 PRD §5 无障碍也要求
  // "图案不依赖单一色相"。所以高对比章用更大的色相跨度，柔和章才收敛。
  const spread = 18 + Math.round(contrast * 62 + rng() * 20);
  // 底色明暗跨度由 contrast 决定：低对比章保持"柔和渐变"，高对比章把明暗拉开。
  // 这条很关键 —— 切片成 n×n 后，每格的平均亮度互不相同，玩家能靠"明暗走向"排序定位；
  // 否则整张图就是一大片同色，格子之间无法区分（PRD §3.3 第 1 章"高对比渐变"、
  // §8 风险 3"抽象图切片后没有明显特征"）。
  const lightSpan = 14 + contrast * 46; // 14 .. 60
  const lightTop = 84;
  const stops = [];
  for (let i = 0; i < 3; i++) {
    const offset = i === 0 ? -spread : i === 1 ? 0 : spread;
    // 第 1 停靠最亮、第 3 停靠最暗，中间停在其间抖动 —— 保证整图始终有方向性明暗
    const t = i === 0 ? 0 : i === 2 ? 1 : 0.2 + rng() * 0.6;
    stops.push({
      hue: Math.round(baseHue + offset),
      sat: round3(58 + rng() * 24),
      light: round3(Math.max(0, lightTop - t * lightSpan)),
    });
  }
  const bg = { angle: Math.round(rng() * 360), stops };

  // 中层：3–14 个半透明几何块（柔光圆 / 多边形），数量随 detail 上升。
  // 位置用"抖动网格"而非纯随机：纯随机会让特征全挤在一角，剩下的格子完全空白，
  // 5×5 时玩家只能瞎试。网格 + 抖动保证特征铺满画面，每格附近都有视觉锚点。
  const shapeCount = 3 + Math.round(detail * 9 + rng() * 1.6);
  // 列数强制取偶数：奇数列时中间列的中心恰好落在画布中线 0.5 上，抖动会让它随机
  // 跨到另一侧，四个象限就未必都有特征。
  const cols = 2 * Math.max(1, Math.round(Math.sqrt(shapeCount) / 2));
  const rows = Math.ceil(shapeCount / cols);
  const jitter = 0.32 / cols;
  // 取位顺序按"四角 → 边中 → 内部"：这样任意 shapeCount ≥ 4 都必然覆盖四个象限，
  // 低细节章（形状少）也会把特征铺在画面四角，而不是挤在一角、留下大片空白格。
  const slots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      slots.push({ r, c, rank: (r === 0 || r === rows - 1 ? 0 : 1) + (c === 0 || c === cols - 1 ? 0 : 1) });
    }
  }
  slots.sort((a, b) => a.rank - b.rank);
  const shapes = [];
  for (let i = 0; i < shapeCount; i++) {
    const big = rng() < 0.4;
    const radius = big ? 0.24 + rng() * 0.16 : 0.1 + rng() * 0.12;
    const hue = baseHue + (rng() < 0.55 ? 1 : -1) * (18 + rng() * 150);
    const alpha = 0.2 + rng() * (0.14 + contrast * 0.22);
    const gx = (slots[i].c + 0.5) / cols;
    const gy = (slots[i].r + 0.5) / rows;
    shapes.push({
      kind: rng() < 0.55 ? "circle" : "polygon",
      x: round4(clamp01(gx + (rng() * 2 - 1) * jitter)),
      y: round4(clamp01(gy + (rng() * 2 - 1) * jitter)),
      r: round4(radius),
      sides: 3 + Math.floor(rng() * 5),
      rot: round4(rng() * Math.PI * 2),
      hue: Math.round(hue),
      sat: round3(48 + rng() * 34),
      light: round3((contrast > 0.55 ? 38 : 50) + rng() * 26),
      alpha: round3(alpha),
    });
  }

  // 上层：2–4 条柔和弧线
  const strokeCount = 2 + Math.round(detail * 2 + rng());
  const strokes = [];
  for (let i = 0; i < strokeCount; i++) {
    strokes.push({
      x: round4(0.1 + rng() * 0.8),
      y: round4(0.1 + rng() * 0.8),
      r: round4(0.16 + rng() * 0.34),
      from: round4(rng() * Math.PI * 2),
      to: round4(Math.PI * (0.6 + rng() * 1.1)),
      hue: Math.round(baseHue + (rng() < 0.5 ? 1 : -1) * (30 + rng() * 120)),
      sat: round3(44 + rng() * 34),
      light: round3(28 + rng() * 30),
      alpha: round3(0.12 + rng() * 0.2),
      width: round4(0.008 + rng() * 0.03),
    });
  }

  // 细噪点：数量随 detail 上升，给"细腻纹理"章一点颗粒感
  const grainCount = Math.round(30 + detail * 170);
  const points = [];
  for (let i = 0; i < grainCount; i++) {
    points.push({ x: round4(rng()), y: round4(rng()), r: round4(0.002 + rng() * 0.008) });
  }

  return {
    seed: String(seed),
    detail: round3(detail),
    contrast: round3(contrast),
    bg,
    shapes,
    strokes,
    grain: { alpha: round3(0.02 + detail * 0.06), points },
  };
}

/** 配方指纹：同 seed ⇒ 同指纹，不同 seed ⇒ 几乎必然不同。测试与缓存键都用它。 */
export function recipeHash(recipe) {
  return hashString(JSON.stringify(recipe)).toString(16).padStart(8, "0");
}

/** 归一化坐标 -> 线性渐变端点（沿配方角度穿过画布中心） */
function gradientEnds(size, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const cx = size / 2;
  const cy = size / 2;
  // 把画布四角投影到渐变方向取极值：任何角度下画布都完整落在渐变范围内，
  // 三个停靠的明暗差才不会被"只用到中间一段"白白浪费掉。
  let min = Infinity;
  let max = -Infinity;
  for (const [px, py] of [[0, 0], [size, 0], [0, size], [size, size]]) {
    const t = (px - cx) * dx + (py - cy) * dy;
    if (t < min) min = t;
    if (t > max) max = t;
  }
  return [cx + dx * min, cy + dy * min, cx + dx * max, cy + dy * max];
}

/**
 * 把配方画到任意 2D 上下文上（棋盘切片与缩略图共用）。
 * 不依赖 ctx.filter —— 柔光用径向渐变实现，保证各浏览器一致。
 */
export function renderArtwork(ctx, size, recipe) {
  if (!ctx || !recipe || !Number.isFinite(size) || size <= 0) return false;
  const s = size;
  ctx.save();
  ctx.clearRect(0, 0, s, s);

  const ends = gradientEnds(s, recipe.bg.angle);
  const grad = ctx.createLinearGradient(ends[0], ends[1], ends[2], ends[3]);
  const stops = recipe.bg.stops;
  stops.forEach((stop, index) => {
    grad.addColorStop(stops.length === 1 ? 0 : index / (stops.length - 1), hsla(stop.hue, stop.sat, stop.light, 1));
  });
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  for (const shape of recipe.shapes) {
    const x = shape.x * s;
    const y = shape.y * s;
    const radius = shape.r * s;
    if (shape.kind === "circle") {
      const rg = ctx.createRadialGradient(x, y, radius * 0.08, x, y, radius);
      rg.addColorStop(0, hsla(shape.hue, shape.sat, shape.light, shape.alpha));
      rg.addColorStop(0.72, hsla(shape.hue, shape.sat, shape.light, shape.alpha * 0.55));
      rg.addColorStop(1, hsla(shape.hue, shape.sat, shape.light, 0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(shape.rot);
      ctx.beginPath();
      const sides = Math.max(3, shape.sides | 0);
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = hsla(shape.hue, shape.sat, shape.light, shape.alpha);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.lineCap = "round";
  for (const stroke of recipe.strokes) {
    ctx.beginPath();
    ctx.arc(stroke.x * s, stroke.y * s, stroke.r * s, stroke.from, stroke.from + stroke.to);
    ctx.lineWidth = Math.max(1, stroke.width * s);
    ctx.strokeStyle = hsla(stroke.hue, stroke.sat, stroke.light, stroke.alpha);
    ctx.stroke();
  }

  const grainHue = recipe.bg.stops[1] ? recipe.bg.stops[1].hue : 40;
  ctx.fillStyle = hsla(grainHue, 26, 97, recipe.grain.alpha);
  for (const point of recipe.grain.points) {
    ctx.beginPath();
    ctx.arc(point.x * s, point.y * s, Math.max(0.5, point.r * s), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  return true;
}

/**
 * 生成离屏艺术图画布。需要 document；无 DOM 环境（node:test）返回 null，
 * 此时用 artworkRecipe + recipeHash 做确定性验证即可。
 */
export function createArtworkCanvas(seed, size = ART_SIZE, options = {}) {
  if (typeof document === "undefined" || !document.createElement) return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
  if (!ctx) return null;
  renderArtwork(ctx, size, artworkRecipe(seed, options));
  return canvas;
}
