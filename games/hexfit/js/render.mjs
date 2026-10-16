// render.mjs —— Canvas 蜂巢棋盘渲染：pointy-top 六边网格、蜜蜡块、三轴满行高亮、蜜流粒子。纯绘制，不碰逻辑。
import { RADIUS, allCells, allRows, cellKey, inBoard, shapeCenteredCells } from "./engine.mjs";

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
    // 系数需为大六边形木框（外扩约 1 个格距）预留空间，防止边框被画布裁切
    size = Math.floor(Math.min(maxW / (wBySize + 2.2), maxH / (hBySize + 2.2)) * 0.98);
    cx = logicalW / 2;
    cy = logicalH / 2;
  }

  function cellAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const [q, r] = pixelToHex(px, py, size, cx, cy);
    if (Math.abs(q) <= RADIUS && Math.abs(r) <= RADIUS && Math.abs(q + r) <= RADIUS) return [q, r];
    // 盘外/边缘外半侧：就近吸附盘内格；离盘过远（悬停侧栏/留白）则不显示预览
    let best = null;
    let bestD = Infinity;
    for (const [cq, cr] of allCells()) {
      const [x, y] = hexToPixel(cq, cr, size, cx, cy);
      const d = (x - px) * (x - px) + (y - py) * (y - py);
      if (d < bestD) {
        bestD = d;
        best = [cq, cr];
      }
    }
    const lim = size * 1.6;
    if (!best || bestD > lim * lim) return null;
    return best;
  }

  /** 蜂巢托盘：pointy-top 小格拼成的盘区外轮廓是顶点朝左右的大六边形 */
  function drawBoardTray() {
    // 6 个角格中心方向（东/东南/西南/西/西北/东北），外扩留木框宽度
    const corners = [
      [RADIUS, 0], [0, RADIUS], [-RADIUS, RADIUS],
      [-RADIUS, 0], [0, -RADIUS], [RADIUS, -RADIUS],
    ];
    const pad = size * 0.78;
    const pts = corners.map(([q, r]) => {
      const [x, y] = hexToPixel(q, r, size, cx, cy);
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy) || 1;
      return [x + (dx / d) * pad, y + (dy / d) * pad];
    });
    const trayPath = () => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
    };
    ctx.save();
    // 托盘投影
    ctx.shadowColor = "rgba(30, 14, 2, 0.45)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 5;
    trayPath();
    ctx.fillStyle = "#5a3410";
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    // 盘面：内凹深琥珀
    trayPath();
    const grad = ctx.createRadialGradient(cx, cy - size * 2, size * 2, cx, cy, SQRT3 * RADIUS * size + size * 3);
    grad.addColorStop(0, "#7a4a18");
    grad.addColorStop(1, "#4a2a0a");
    ctx.fillStyle = grad;
    ctx.fill();
    // 木框粗描边 + 内侧高光线
    trayPath();
    ctx.lineWidth = Math.max(4, size * 0.22);
    ctx.strokeStyle = "#3d2208";
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(222, 166, 84, 0.45)";
    ctx.stroke();
    ctx.restore();
  }

  function render(view, opts = {}) {
    if (!view) return;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, logicalW, logicalH);

    const hover = opts.hoverCell; // [q, r] or null
    const current = view.current;

    // 蜂巢托盘：半径 R 区域的大六边形木框，明确棋盘边界（盘内可放 / 盘外不可放）
    drawBoardTray();

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
        // 空蜂房凹腔：内暗外亮的凹陷质感，保证每格与棋盘轮廓清晰可辨
        const cav = ctx.createRadialGradient(x, y + size * 0.12, size * 0.1, x, y, size * 0.95);
        cav.addColorStop(0, "rgba(62, 36, 10, 0.5)");
        cav.addColorStop(1, "rgba(122, 78, 26, 0.28)");
        ctx.fillStyle = cav;
      }
      ctx.fill();
      ctx.lineWidth = occupied ? 1.2 : 1;
      ctx.strokeStyle = occupied ? "rgba(90, 50, 10, 0.55)" : "rgba(168, 116, 48, 0.5)";
      ctx.stroke();
    }

    // 快满行预提示：只剩 1 空格的行，在该空格上打琥珀柔光（同类六边消除标配）
    for (const row of allRows()) {
      const emptyKeys = row.filter((k) => !view.occupied[k]);
      if (emptyKeys.length !== 1) continue;
      const [q, r] = emptyKeys[0].split(",").map(Number);
      const [x, y] = hexToPixel(q, r, size, cx, cy);
      const grad = ctx.createRadialGradient(x, y, size * 0.1, x, y, size * 0.95);
      grad.addColorStop(0, "rgba(255, 200, 80, 0.38)");
      grad.addColorStop(1, "rgba(255, 200, 80, 0)");
      ctx.fillStyle = grad;
      hexPath(ctx, x, y, size * 0.95);
      ctx.fill();
    }

    // 悬停预览块（跟手锚定：光标格即块体真实格；越界/冲突格就地画红叉，不隐藏不瞬移）
    if (hover && current) {
      const cells = shapeCenteredCells(current.shapeId, current.rotation);
      const allOk = cells.every(([dq, dr]) => {
        const qq = hover[0] + dq;
        const rr = hover[1] + dr;
        return inBoard(qq, rr) && !view.occupied[cellKey(qq, rr)];
      });
      ctx.save();
      for (const [dq, dr] of cells) {
        const qq = hover[0] + dq;
        const rr = hover[1] + dr;
        const cellOk = inBoard(qq, rr) && !view.occupied[cellKey(qq, rr)];
        const [x, y] = hexToPixel(qq, rr, size, cx, cy);
        const fill = cellOk
          ? (allOk ? "rgba(255, 240, 180, 0.72)" : "rgba(255, 226, 150, 0.6)")
          : "rgba(220, 70, 55, 0.5)";
        const stroke = cellOk
          ? (allOk ? "rgba(255, 255, 240, 0.98)" : "rgba(255, 230, 170, 0.9)")
          : "rgba(255, 110, 95, 0.95)";
        ctx.shadowColor = cellOk ? "rgba(255, 215, 100, 0.85)" : "rgba(255, 80, 60, 0.85)";
        ctx.shadowBlur = cellOk ? 12 : 8;
        hexPath(ctx, x, y, size * 0.88);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = stroke;
        ctx.stroke();
        // 越界 / 冲突：红叉明示"这一格不行（出盘或被占）"
        if (!cellOk) {
          const a = size * 0.3;
          ctx.beginPath();
          ctx.moveTo(x - a, y - a); ctx.lineTo(x + a, y + a);
          ctx.moveTo(x + a, y - a); ctx.lineTo(x - a, y + a);
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.strokeStyle = "rgba(120, 20, 10, 0.9)";
          ctx.stroke();
        }
        // 锚点格（光标正下方）额外标芯
        if (dq === 0 && dr === 0) {
          hexPath(ctx, x, y, size * 0.42);
          ctx.fillStyle = cellOk ? "rgba(255, 255, 255, 0.85)" : "rgba(255, 240, 235, 0.8)";
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // 消除浮字（view.events，stepFrame 确定性衰减，上浮渐隐）
    if (view.events && view.events.length) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const ev of view.events) {
        if (ev.type !== "pop") continue;
        const [x, y] = hexToPixel(ev.q, ev.r, size, cx, cy);
        const prog = 1 - Math.max(0, Math.min(1, ev.t / 0.9));
        ctx.globalAlpha = 1 - prog;
        ctx.font = `700 ${Math.round(size * 0.9)}px system-ui, sans-serif`;
        ctx.strokeStyle = "rgba(255, 248, 225, 0.92)";
        ctx.lineWidth = 3;
        const yy = y - prog * size * 1.6;
        ctx.strokeText(ev.text, x, yy);
        ctx.fillStyle = "#8a4b00";
        ctx.fillText(ev.text, x, yy);
      }
      ctx.restore();
    }

    ctx.restore();
  }

  return { syncSize, cellAt, render, getSize: () => size };
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
