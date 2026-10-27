// Canvas 渲染层：红木棋桌 + 木浮雕棋子。唯一碰 Canvas 的模块（DOM 由 ui.mjs 负责）。
// 纯绘制：不修改 state，只读取。光效强度来自 state.fx（stepFrame 衰减）。
// 所有文本经 i18n t() 取词——语言热更新时仅重绘当前帧。

import { COLS, ROWS, idx, rowOf, colOf, sideOf, typeOf, RED } from "./engine.mjs";
import { t } from "./i18n.mjs";

// 炮位/兵位星标（经典棋盘角落刻痕）
const STAR_POINTS = [
  [2, 1], [2, 7], [7, 1], [7, 7],
  [3, 0], [3, 2], [3, 4], [3, 6], [3, 8],
  [6, 0], [6, 2], [6, 4], [6, 6], [6, 8],
];

export function computeMetrics(canvas) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  // 布局未就绪（塌陷/隐藏）时 cs=0：调用方以 cs<=0 短路跳过绘制，命中检测除零同样短路。
  const cs = width > 0 && height > 0 ? Math.min(width / (COLS + 1.2), height / (ROWS + 1.4)) : 0;
  const ox = (width - (COLS - 1) * cs) / 2;
  const oy = (height - (ROWS - 1) * cs) / 2;
  return { width, height, cs, ox, oy };
}

export function cellToPixel(metrics, index) {
  return {
    x: metrics.ox + colOf(index) * metrics.cs,
    y: metrics.oy + rowOf(index) * metrics.cs,
  };
}

// 命中检测：返回最近交叉点索引，超出半径 0.46 格视为未命中。
export function pixelToCell(metrics, x, y) {
  const col = Math.round((x - metrics.ox) / metrics.cs);
  const row = Math.round((y - metrics.oy) / metrics.cs);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return -1;
  const px = metrics.ox + col * metrics.cs;
  const py = metrics.oy + row * metrics.cs;
  const dist = Math.hypot(x - px, y - py);
  if (dist > metrics.cs * 0.46) return -1;
  return idx(row, col);
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ─── 红木棋桌与棋盘 ───────────────────────────────────────────────
function drawTable(ctx, metrics) {
  const { width, height } = metrics;
  const table = ctx.createRadialGradient(width / 2, height * 0.42, 20, width / 2, height / 2, Math.max(width, height) * 0.75);
  table.addColorStop(0, "#4a2c1c");
  table.addColorStop(0.55, "#3a2013");
  table.addColorStop(1, "#22110a");
  ctx.fillStyle = table;
  ctx.fillRect(0, 0, width, height);

  // 木纹（确定性正弦纹理，无随机）
  ctx.save();
  ctx.globalAlpha = 0.055;
  ctx.strokeStyle = "#c9a06a";
  for (let i = 0; i < 26; i += 1) {
    const yBase = (height / 26) * i + 4;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 14) {
      const y = yBase + Math.sin(x * 0.014 + i * 1.7) * 3.2 + Math.sin(x * 0.05 + i) * 1.1;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = i % 5 === 0 ? 1.6 : 0.8;
    ctx.stroke();
  }
  ctx.restore();
}

function drawBoardFrame(ctx, metrics) {
  const { cs, ox, oy } = metrics;
  const pad = cs * 0.62;
  const x = ox - pad;
  const y = oy - pad;
  const w = (COLS - 1) * cs + pad * 2;
  const h = (ROWS - 1) * cs + pad * 2;

  // 外框（棋盘木板）
  const wood = ctx.createLinearGradient(x, y, x, y + h);
  wood.addColorStop(0, "#d8ab72");
  wood.addColorStop(0.5, "#c8965c");
  wood.addColorStop(1, "#b07f4a");
  ctx.fillStyle = wood;
  roundRectPath(ctx, x, y, w, h, cs * 0.24);
  ctx.fill();

  // 板面高光与投影
  ctx.strokeStyle = "rgba(255, 226, 178, 0.5)";
  ctx.lineWidth = Math.max(1, cs * 0.035);
  roundRectPath(ctx, x + ctx.lineWidth * 0.6, y + ctx.lineWidth * 0.6, w - ctx.lineWidth * 1.2, h - ctx.lineWidth * 1.2, cs * 0.2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(46, 24, 10, 0.55)";
  ctx.lineWidth = Math.max(1.5, cs * 0.06);
  roundRectPath(ctx, x + cs * 0.1, y + cs * 0.1, w - cs * 0.2, h - cs * 0.2, cs * 0.16);
  ctx.stroke();
}

function drawGrid(ctx, metrics) {
  const { cs, ox, oy } = metrics;
  const left = ox;
  const right = ox + (COLS - 1) * cs;
  const top = oy;
  const bottom = oy + (ROWS - 1) * cs;
  const riverTop = oy + 4 * cs;
  const riverBottom = oy + 5 * cs;

  ctx.strokeStyle = "#54301a";
  ctx.lineWidth = Math.max(1, cs * 0.028);

  // 横线（10 条）
  for (let row = 0; row < ROWS; row += 1) {
    const y = oy + row * cs;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }
  // 竖线（河界断开，仅边线贯通）
  for (let col = 0; col < COLS; col += 1) {
    const x = ox + col * cs;
    if (col === 0 || col === COLS - 1) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, riverTop);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, riverBottom);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }
  }
  // 九宫斜线
  for (const [r0, r1] of [[0, 2], [7, 9]]) {
    ctx.beginPath();
    ctx.moveTo(ox + 3 * cs, oy + r0 * cs);
    ctx.lineTo(ox + 5 * cs, oy + r1 * cs);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ox + 5 * cs, oy + r0 * cs);
    ctx.lineTo(ox + 3 * cs, oy + r1 * cs);
    ctx.stroke();
  }
  // 外围加粗边线
  ctx.lineWidth = Math.max(1.4, cs * 0.045);
  ctx.strokeRect(left, top, (COLS - 1) * cs, (ROWS - 1) * cs);

  // 炮兵位星标
  ctx.lineWidth = Math.max(1, cs * 0.025);
  const tick = cs * 0.14;
  for (const [row, col] of STAR_POINTS) {
    const x = ox + col * cs;
    const y = oy + row * cs;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (col === 0 && sx < 0) continue;
      if (col === COLS - 1 && sx > 0) continue;
      ctx.beginPath();
      ctx.moveTo(x + sx * tick * 0.55, y + sy * tick * 0.55);
      ctx.lineTo(x + sx * tick * 0.55, y + sy * tick);
      ctx.lineTo(x + sx * tick, y + sy * tick);
      ctx.stroke();
    }
  }
}

function drawRiver(ctx, metrics) {
  const { cs, ox, oy } = metrics;
  const y = oy + 4.5 * cs;
  ctx.save();
  ctx.fillStyle = "rgba(70, 38, 18, 0.55)";
  ctx.font = `italic ${Math.round(cs * 0.42)}px "STKaiti", "KaiTi", "SimSun", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const chu = t("riverChu");
  const han = t("riverHan");
  const chuX = ox + 2 * cs;
  const hanX = ox + 6 * cs;
  ctx.fillText(chu, chuX, y);
  ctx.fillText(han, hanX, y);
  ctx.restore();
}

// ─── 棋子（木浮雕圆棋）────────────────────────────────────────────
function pieceGlyph(piece) {
  const side = sideOf(piece);
  const type = typeOf(piece);
  return t(side === RED ? `piece_red_${type}` : `piece_black_${type}`);
}

function drawPiece(ctx, metrics, index, piece, scale = 1) {
  const { cs } = metrics;
  const { x, y } = cellToPixel(metrics, index);
  const radius = cs * 0.435 * scale;
  const isRed = sideOf(piece) === RED;

  ctx.save();
  // 投影
  ctx.beginPath();
  ctx.arc(x + radius * 0.08, y + radius * 0.16, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(15, 6, 2, 0.42)";
  ctx.fill();

  // 主体木色
  const body = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.4, radius * 0.15, x, y, radius);
  if (isRed) {
    body.addColorStop(0, "#d9705f");
    body.addColorStop(0.55, "#b8433a");
    body.addColorStop(1, "#7e241d");
  } else {
    body.addColorStop(0, "#5c4a3a");
    body.addColorStop(0.55, "#3d3128");
    body.addColorStop(1, "#1c1410");
  }
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  // 环线（内圈刻线）
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.82, 0, Math.PI * 2);
  ctx.strokeStyle = isRed ? "rgba(255, 214, 190, 0.4)" : "rgba(216, 190, 150, 0.32)";
  ctx.lineWidth = Math.max(1, radius * 0.06);
  ctx.stroke();

  // 字
  ctx.fillStyle = isRed ? "#ffe9d8" : "#e8d9b8";
  ctx.font = `600 ${Math.round(radius * 1.08)}px "STKaiti", "KaiTi", "SimSun", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(pieceGlyph(piece), x, y + radius * 0.06);
  ctx.restore();
}

function softGlow(ctx, x, y, radius, color, alpha) {
  const grad = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─── 主绘制 ───────────────────────────────────────────────────────
export function draw(canvas, state, view = {}) {
  const ctx = canvas.getContext("2d");
  const metrics = computeMetrics(canvas);
  if (metrics.cs <= 0) return; // 布局塌陷时跳过本帧，待布局恢复后重绘
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== metrics.width * dpr || canvas.height !== metrics.height * dpr) {
    canvas.width = metrics.width * dpr;
    canvas.height = metrics.height * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, metrics.width, metrics.height);

  drawTable(ctx, metrics);
  drawBoardFrame(ctx, metrics);
  drawGrid(ctx, metrics);
  drawRiver(ctx, metrics);

  const fx = state.fx;
  const { cs } = metrics;

  // 上一步落点高亮
  if (state.lastMove) {
    for (const cell of [state.lastMove.from, state.lastMove.to]) {
      const { x, y } = cellToPixel(metrics, cell);
      softGlow(ctx, x, y, cs * 0.52, "rgba(255, 208, 130, 0.85)", 0.28 * Math.min(1, fx.moveFlash + 0.35));
    }
  }

  // 合法落点柔光
  for (const target of view.legalTargets ?? []) {
    const { x, y } = cellToPixel(metrics, target);
    softGlow(ctx, x, y, cs * 0.42, "rgba(126, 245, 178, 0.9)", 0.6);
    ctx.beginPath();
    ctx.arc(x, y, cs * 0.085, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(150, 255, 195, 0.9)";
    ctx.fill();
  }

  // 提示首着（棋谱卡开关）
  if (view.hint) {
    for (const cell of [view.hint.from, view.hint.to]) {
      const { x, y } = cellToPixel(metrics, cell);
      softGlow(ctx, x, y, cs * 0.5, "rgba(120, 200, 255, 0.9)", 0.5);
    }
  }

  // 将军红晕
  if (view.checkIndex >= 0) {
    const { x, y } = cellToPixel(metrics, view.checkIndex);
    softGlow(ctx, x, y, cs * 0.75, "rgba(255, 80, 60, 0.95)", 0.35 + 0.4 * Math.min(1, fx.checkFlash));
  }

  // 吃子闪白
  if (fx.captureFlash > 0 && state.lastMove) {
    const { x, y } = cellToPixel(metrics, state.lastMove.to);
    softGlow(ctx, x, y, cs * 0.6, "rgba(255, 245, 220, 0.95)", 0.5 * fx.captureFlash);
  }

  // 棋子（拖动中的子最后画并跟随指针）
  const dragging = view.dragging ?? null;
  for (let i = 0; i < state.board.length; i += 1) {
    const piece = state.board[i];
    if (piece === 0) continue;
    if (dragging && dragging.from === i) continue;
    drawPiece(ctx, metrics, i, piece);
  }

  // 选中柔光（无边界径向，禁硬描边）
  if (view.selected >= 0) {
    const { x, y } = cellToPixel(metrics, view.selected);
    softGlow(ctx, x, y, cs * 0.62, "rgba(255, 219, 148, 0.95)", 0.55);
  }

  // 键盘光标（呼吸微光）
  if (typeof view.cursor === "number" && view.cursor >= 0) {
    const { x, y } = cellToPixel(metrics, view.cursor);
    softGlow(ctx, x, y, cs * 0.4, "rgba(255, 236, 190, 0.8)", 0.22);
  }

  if (dragging && dragging.from >= 0) {
    const piece = state.board[dragging.from];
    if (piece !== 0) {
      const radius = cs * 0.435;
      ctx.save();
      ctx.beginPath();
      ctx.arc(dragging.x, dragging.y, radius, 0, Math.PI * 2);
      const body = ctx.createRadialGradient(dragging.x - radius * 0.3, dragging.y - radius * 0.35, radius * 0.15, dragging.x, dragging.y, radius);
      if (sideOf(piece) === RED) {
        body.addColorStop(0, "#d9705f");
        body.addColorStop(1, "#7e241d");
      } else {
        body.addColorStop(0, "#5c4a3a");
        body.addColorStop(1, "#1c1410");
      }
      ctx.fillStyle = body;
      ctx.fill();
      ctx.fillStyle = sideOf(piece) === RED ? "#ffe9d8" : "#e8d9b8";
      ctx.font = `600 ${Math.round(radius * 1.08)}px "STKaiti", "KaiTi", "SimSun", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pieceGlyph(piece), dragging.x, dragging.y + radius * 0.06);
      ctx.restore();
    }
  }
}
