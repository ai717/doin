// render.mjs —— Canvas 蜂巢棋盘渲染：pointy-top 六边网格、蜜蜡块、三轴满行高亮、蜜流粒子。纯绘制，不碰逻辑。
import { RADIUS, allCells, cellKey, parseKey } from "./engine.mjs";

const SQRT3 = Math.sqrt(3);

/** pointy-top 六边形像素坐标（axial q,r -> x,y） */
export function hexToPixel(q, r, size, cx, cy) {
  const x = size * SQRT3 * (q + r / 2) + cx;
  const y = size * 1.5 * r + cy;
  return [x, y];
}

/** 像素坐标反查最近格 */
export function pixelToHex(px, py, size, cx, cy) {
  const x = (px - cx) / size;
  const y = (py - cy) / size;
  const q = (SQRT3 / 3 * x - 1 / 3 * y);
  const r = (2 / 3 * y);
  return hexRound(q, r);
}

function hexRound(q, r) {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return [rq, rr];
}

/** 画单个六边形路径 */
function hexPath(ctx, x, y, size) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = Math.PI / 180 * (60 * i - 30);
    const hx = x + size * Math.cos(angle);
    const hy = y + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
}

const HONEY_COLORS = [
  "#f6c84a", // 浅蜜黄
  "#e8a93b", // 琥珀
  "#d98f2a", // 深蜜橙
  "#c97422", // 焦糖
  "#b85d1c", // 深琥珀
  "#a04715", // 焦蜜
];

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let size = 22;
  let cx = 0;
  let cy = 0;
  let dpr = 1;
  let logicalW = 0;
  let logicalH = 0;

  function syncSize() {
    const rect = canvas.getBoundingClientRect();
    logicalW = Math.max(200, Math.round(rect.width));
    logicalH = Math.max(200, Math.round(rect.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(logicalW * dpr);
    canvas.height = Math.round(logicalH * dpr);
    // 根据画布大小自适应 hex size
    const maxW = logicalW;
    const maxH = logicalH;
    // 点顶六边网格半径 4 的包围盒
    const wBySize = (RADIUS * 2 + 1) * SQRT3;
    const hBySize = (RADIUS * 2 + 1) * 1.5 + 0.5;
    size = Math.floor(Math.min(maxW / wBySize, maxH / hBySize) * 0.92);
    cx = logicalW / 2;
    cy = logicalH / 2;
  }

  function cellAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const [q, r] = pixelToHex(px, py, size, cx, cy);
    if (Math.abs(q) > RADIUS || Math.abs(r) > RADIUS || Math.abs(q + r) > RADIUS) return null;
    return [q, r];
  }

  function render(view, opts = {}) {
    if (!view) return;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, logicalW, logicalH);

    const hover = opts.hoverCell; // [q, r] or null
    const current = view.current;
    const hoverValid = hover && current && canPlaceShape(view, current, hover[0], hover[1]);

    // 背景蜂巢格
    for (const [q, r] of allCells()) {
      const [x, y] = hexToPixel(q, r, size, cx, cy);
      const key = cellKey(q, r);
      const occupied = view.occupied[key];

      // 格底
      hexPath(ctx, x, y, size * 0.96);
      if (occupied) {
        const grad = ctx.createRadialGradient(x - size * 0.2, y - size * 0.2, size * 0.1, x, y, size);
        const colorIdx = ((q * 7 + r * 13) % HONEY_COLORS.length + HONEY_COLORS.length) % HONEY_COLORS.length;
        grad.addColorStop(0, lighten(HONEY_COLORS[colorIdx], 0.25));
        grad.addColorStop(1, HONEY_COLORS[colorIdx]);
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = "rgba(120, 80, 30, 0.12)";
      }
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = occupied ? "rgba(90, 50, 10, 0.5)" : "rgba(120, 80, 30, 0.25)";
      ctx.stroke();

      // 放置预览
      if (hover && current && !occupied) {
        const cells = shapeCellOffsets(current);
        const isAnchor = cells.some(([dq, dr]) => dq === 0 && dr === 0);
        // 预览绘制由外层统一处理
      }
    }

    // 悬停预览块
    if (hover && current) {
      const cells = shapeCellOffsets(current);
      const allOk = cells.every(([dq, dr]) => {
        const qq = hover[0] + dq;
        const rr = hover[1] + dr;
        if (Math.abs(qq) > RADIUS || Math.abs(rr) > RADIUS || Math.abs(qq + rr) > RADIUS) return false;
        return !view.occupied[cellKey(qq, rr)];
      });
      const fill = allOk ? "rgba(255, 240, 180, 0.72)" : "rgba(255, 120, 110, 0.55)";
      const stroke = allOk ? "rgba(255, 255, 240, 0.98)" : "rgba(255, 200, 190, 0.95)";
      ctx.save();
      ctx.shadowColor = allOk ? "rgba(255, 215, 100, 0.9)" : "rgba(255, 90, 70, 0.8)";
      ctx.shadowBlur = allOk ? 12 : 10;
      for (const [dq, dr] of cells) {
        const qq = hover[0] + dq;
        const rr = hover[1] + dr;
        if (Math.abs(qq) > RADIUS || Math.abs(rr) > RADIUS || Math.abs(qq + rr) > RADIUS) continue;
        const [x, y] = hexToPixel(qq, rr, size, cx, cy);
        hexPath(ctx, x, y, size * 0.88);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = stroke;
        ctx.stroke();
        // 锚点格（光标正下方）额外标芯
        if (dq === 0 && dr === 0) {
          hexPath(ctx, x, y, size * 0.42);
          ctx.fillStyle = allOk ? "rgba(255, 255, 255, 0.85)" : "rgba(255, 240, 235, 0.8)";
          ctx.fill();
        }
      }
      ctx.restore();
    }

    ctx.restore();
  }

  return { syncSize, cellAt, render, getSize: () => size };
}

function shapeCellOffsets(current) {
  // 简单实现：与 engine shapeCells 一致的旋转
  const { shapeId, rotation } = current;
  const shapes = {
    mono: [[0, 0]],
    domino: [[0, 0], [1, 0]],
    "tri-line": [[0, 0], [1, 0], [2, 0]],
    "tri-bend": [[0, 0], [1, 0], [1, -1]],
    "tetro-line": [[0, 0], [1, 0], [2, 0], [3, 0]],
    "tetro-square": [[0, 0], [1, 0], [0, 1], [1, 1]],
    "tetro-bend": [[0, 0], [1, 0], [2, 0], [2, -1]],
    "tetro-t": [[0, 0], [1, 0], [2, 0], [1, -1]],
    "pento-cluster": [[0, 0], [1, 0], [1, -1], [0, 1], [-1, 1]],
    "pento-line": [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
    "pento-y": [[0, 0], [1, 0], [2, 0], [1, -1], [1, 1]],
    "pento-z": [[0, 0], [1, 0], [1, -1], [2, -1], [2, -2]],
  };
  let cells = (shapes[shapeId] || [[0, 0]]).map((c) => [c[0], c[1]]);
  const rot = ((rotation % 6) + 6) % 6;
  for (let i = 0; i < rot; i += 1) cells = cells.map(([q, r]) => [-r, q + r]);
  const minQ = Math.min(...cells.map((c) => c[0]));
  const minR = Math.min(...cells.map((c) => c[1]));
  return cells.map(([q, r]) => [q - minQ, r - minR]);
}

function canPlaceShape(view, current, q, r) {
  const cells = shapeCellOffsets(current);
  for (const [dq, dr] of cells) {
    const qq = q + dq;
    const rr = r + dr;
    if (Math.abs(qq) > RADIUS || Math.abs(rr) > RADIUS || Math.abs(qq + rr) > RADIUS) return false;
    if (view.occupied[cellKey(qq, rr)]) return false;
  }
  return true;
}

function lighten(hex, amt) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lr = Math.min(255, Math.round(r + (255 - r) * amt));
  const lg = Math.min(255, Math.round(g + (255 - g) * amt));
  const lb = Math.min(255, Math.round(b + (255 - b) * amt));
  return `rgb(${lr},${lg},${lb})`;
}
