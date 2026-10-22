// render.mjs —— Canvas 2D 舞台渲染：8×8 拼块板 + 三块队列 + 拖放预览 + 爆破演出。
// 纯视图层：只读 view 快照与 UI 预览状态绘制，绝不改游戏状态。
// 视窗隐喻：深夜游戏厅霓虹积木展示柜——糖果色软胶拼块、玻璃网格、彩纸粒子。

import { GRID, QUEUE_SIZE, pieceCells, grabCell, pieceColor } from "./engine.mjs";

// 糖果霓虹色板（索引对齐 engine PIECES 的 color 字段，1 基）
export const CANDY = {
  1: "#ff7ba9",
  2: "#ffd166",
  3: "#8bf1a8",
  4: "#5ad8ff",
  5: "#b78bff",
  6: "#ff9d6b",
  7: "#6be2c8",
  8: "#ff6b7a",
  9: "#c9f56b",
  10: "#ff8fd8",
  11: "#7fc4ff",
};

const SOCKET = "rgba(10, 16, 30, 0.82)";
const SOCKET_EDGE = "rgba(94, 234, 255, 0.14)";
const NEON = "#4df3ff";
const MAGENTA = "#ff4dd2";

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** 画一颗软胶积木：平涂面 + 上下倒角 + 柔光投影 */
function drawBlock(ctx, x, y, size, color, options = {}) {
  const { alpha = 1, glow = 0, dim = false } = options;
  const pad = Math.max(1, size * 0.06);
  const bx = x + pad;
  const by = y + pad;
  const bs = size - pad * 2;
  const r = Math.max(2, bs * 0.2);

  ctx.save();
  ctx.globalAlpha = alpha;

  if (glow > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.55 * glow;
  }

  // 投影
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  roundRect(ctx, bx + bs * 0.04, by + bs * 0.08, bs, bs, r);
  ctx.fill();

  // 平涂面
  ctx.shadowBlur = 0;
  ctx.fillStyle = dim ? "rgba(120, 130, 150, 0.5)" : color;
  roundRect(ctx, bx, by, bs, bs, r);
  ctx.fill();

  if (!dim) {
    // 上倒角（柔和明暗晕）
    const bevel = ctx.createLinearGradient(0, by, 0, by + bs * 0.34);
    bevel.addColorStop(0, "rgba(255, 255, 255, 0.5)");
    bevel.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = bevel;
    roundRect(ctx, bx, by, bs, bs * 0.42, r);
    ctx.fill();
    // 下倒角
    const shade = ctx.createLinearGradient(0, by + bs * 0.62, 0, by + bs);
    shade.addColorStop(0, "rgba(0, 0, 0, 0)");
    shade.addColorStop(1, "rgba(0, 0, 0, 0.34)");
    ctx.fillStyle = shade;
    roundRect(ctx, bx, by + bs * 0.58, bs, bs * 0.42, r);
    ctx.fill();
    // 高光点
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.beginPath();
    ctx.ellipse(bx + bs * 0.3, by + bs * 0.24, bs * 0.1, bs * 0.06, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let layout = { width: 0, height: 0, pad: 14, queueH: 92, board: { x: 0, y: 0, size: 0, cell: 0 }, slots: [] };
  let snapAnim = 0; // 落子吸附动画剩余时间（渲染本地，不影响确定性）
  let lastSnapKey = "";

  function computeLayout() {
    const dpr = Math.min(2.5, globalThis.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(240, rect.width || canvas.clientWidth || 320);
    const height = Math.max(320, rect.height || canvas.clientHeight || 480);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pad = 14;
    const queueH = Math.min(96, Math.max(64, height * 0.2));
    const avail = Math.min(width - pad * 2, height - queueH - pad * 3);
    const size = Math.max(160, avail);
    const boardX = (width - size) / 2;
    const boardY = pad + queueH + pad;
    const cell = size / GRID;

    const slotGap = 10;
    const slotW = Math.min(110, (width - pad * 2 - slotGap * (QUEUE_SIZE - 1)) / QUEUE_SIZE);
    const slotH = queueH - 8;
    const slots = [];
    const totalW = slotW * QUEUE_SIZE + slotGap * (QUEUE_SIZE - 1);
    const startX = (width - totalW) / 2;
    for (let i = 0; i < QUEUE_SIZE; i += 1) {
      slots.push({ x: startX + i * (slotW + slotGap), y: pad + 4, w: slotW, h: slotH, slot: i });
    }
    layout = { width, height, pad, queueH, board: { x: boardX, y: boardY, size, cell }, slots };
  }

  function syncSize() {
    computeLayout();
  }

  /** 指针坐标 → 命中区域（队列槽 / 棋盘格） */
  function hitTest(x, y) {
    for (const s of layout.slots) {
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return { type: "queue", slot: s.slot };
    }
    const { x: bx, y: by, size, cell } = layout.board;
    if (x >= bx && x <= bx + size && y >= by && y <= by + size) {
      const col = Math.floor((x - bx) / cell);
      const row = Math.floor((y - by) / cell);
      if (row >= 0 && row < GRID && col >= 0 && col < GRID) return { type: "board", row, col };
    }
    return null;
  }

  /**
   * 光标格 → 放置锚点。锚点必须在引擎坐标系（pieceCells，原点归一）里表达：
   * 取质心最近的格作「抓手」，光标落在它上面，锚点 = 光标 - 抓手偏移。
   * 这样 preview 画的格子与 applyIntent 真实落子的格子永远是同一套。
   */
  function anchorFor(pieceId, rotation, row, col) {
    const [gr, gc] = grabCell(pieceId, rotation);
    return { row: row - gr, col: col - gc };
  }

  function drawBoardFrame() {
    const { x, y, size, cell } = layout.board;
    // 柜内底板
    ctx.fillStyle = "rgba(6, 10, 20, 0.72)";
    roundRect(ctx, x - 8, y - 8, size + 16, size + 16, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(77, 243, 255, 0.22)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, x - 8, y - 8, size + 16, size + 16, 18);
    ctx.stroke();

    // 网格插座
    for (let r = 0; r < GRID; r += 1) {
      for (let c = 0; c < GRID; c += 1) {
        const cx = x + c * cell;
        const cy = y + r * cell;
        ctx.fillStyle = SOCKET;
        roundRect(ctx, cx + 1.5, cy + 1.5, cell - 3, cell - 3, Math.max(3, cell * 0.16));
        ctx.fill();
        ctx.strokeStyle = SOCKET_EDGE;
        ctx.lineWidth = 1;
        roundRect(ctx, cx + 1.5, cy + 1.5, cell - 3, cell - 3, Math.max(3, cell * 0.16));
        ctx.stroke();
      }
    }
  }

  function drawPlaced(view) {
    const { x, y, cell } = layout.board;
    for (let r = 0; r < GRID; r += 1) {
      for (let c = 0; c < GRID; c += 1) {
        const colorIdx = view.board[r * GRID + c];
        if (colorIdx === 0) continue;
        drawBlock(ctx, x + c * cell, y + r * cell, cell, CANDY[colorIdx] ?? NEON);
      }
    }
  }

  function drawQueue(view, ui) {
    for (const s of layout.slots) {
      const pieceId = view.queue[s.slot];
      const selected = ui.selected === s.slot;
      // 槽位托盘
      ctx.save();
      ctx.fillStyle = selected ? "rgba(77, 243, 255, 0.14)" : "rgba(12, 18, 34, 0.7)";
      roundRect(ctx, s.x, s.y, s.w, s.h, 12);
      ctx.fill();
      ctx.strokeStyle = selected ? NEON : "rgba(94, 234, 255, 0.2)";
      ctx.lineWidth = selected ? 2 : 1;
      if (selected) {
        ctx.shadowColor = NEON;
        ctx.shadowBlur = 14;
      }
      roundRect(ctx, s.x, s.y, s.w, s.h, 12);
      ctx.stroke();
      ctx.restore();

      if (!pieceId) continue;
      const cells = pieceCells(pieceId, ui.rotations[s.slot] ?? 0);
      const maxR = Math.max(...cells.map((c) => c[0]));
      const maxC = Math.max(...cells.map((c) => c[1]));
      const pieceW = (maxC + 1);
      const pieceH = (maxR + 1);
      const cellSize = Math.min((s.w - 18) / pieceW, (s.h - 18) / pieceH);
      const offX = s.x + (s.w - pieceW * cellSize) / 2;
      const offY = s.y + (s.h - pieceH * cellSize) / 2;
      for (const [dr, dc] of cells) {
        drawBlock(ctx, offX + dc * cellSize, offY + dr * cellSize, cellSize, CANDY[pieceColor(pieceId)] ?? NEON, {
          alpha: selected ? 1 : 0.92,
          glow: selected ? 0.5 : 0,
        });
      }
    }
  }

  /** 拖放/键盘预览：柔光合法位、变暗非法位、将消行列高亮 */
  function drawGhost(view, ui) {
    if (ui.selected === null || ui.selected === undefined) return;
    const pieceId = view.queue[ui.selected];
    if (!pieceId) return;
    const rotation = ui.rotations[ui.selected] ?? 0;
    const cursor = ui.cursor;
    if (!cursor) return;
    const anchor = anchorFor(pieceId, rotation, cursor.row, cursor.col);
    const cells = pieceCells(pieceId, rotation);
    const { x, y, cell } = layout.board;

    // 合法性
    let legal = true;
    for (const [dr, dc] of cells) {
      const r = anchor.row + dr;
      const c = anchor.col + dc;
      if (r < 0 || r >= GRID || c < 0 || c >= GRID || view.board[r * GRID + c] !== 0) legal = false;
    }

    if (legal) {
      // 将消行列预览（霓虹描边）
      const rowCnt = new Array(GRID).fill(0);
      const colCnt = new Array(GRID).fill(0);
      for (let r = 0; r < GRID; r += 1) {
        for (let c = 0; c < GRID; c += 1) if (view.board[r * GRID + c] !== 0) { rowCnt[r] += 1; colCnt[c] += 1; }
      }
      for (const [dr, dc] of cells) {
        rowCnt[anchor.row + dr] += 1;
        colCnt[anchor.col + dc] += 1;
      }
      ctx.save();
      ctx.strokeStyle = "rgba(255, 79, 216, 0.85)";
      ctx.lineWidth = 2;
      ctx.shadowColor = MAGENTA;
      ctx.shadowBlur = 10;
      for (let r = 0; r < GRID; r += 1) {
        if (rowCnt[r] !== GRID) continue;
        ctx.strokeRect(x + 1, y + r * cell + 1, cell * GRID - 2, cell - 2);
      }
      for (let c = 0; c < GRID; c += 1) {
        if (colCnt[c] !== GRID) continue;
        ctx.strokeRect(x + c * cell + 1, y + 1, cell - 2, cell * GRID - 2);
      }
      ctx.restore();
    }

    const color = CANDY[pieceColor(pieceId)] ?? NEON;
    for (const [dr, dc] of cells) {
      const r = anchor.row + dr;
      const c = anchor.col + dc;
      if (r < 0 || r >= GRID || c < 0 || c >= GRID) continue;
      drawBlock(ctx, x + c * cell, y + r * cell, cell, color, {
        alpha: legal ? 0.62 : 0.28,
        glow: legal ? 0.9 : 0,
        dim: !legal,
      });
      if (legal) {
        // 合法位无边界径向柔光
        const cx = x + c * cell + cell / 2;
        const cy = y + r * cell + cell / 2;
        const radial = ctx.createRadialGradient(cx, cy, cell * 0.2, cx, cy, cell * 0.72);
        radial.addColorStop(0, "rgba(77, 243, 255, 0.28)");
        radial.addColorStop(1, "rgba(77, 243, 255, 0)");
        ctx.fillStyle = radial;
        ctx.fillRect(x + c * cell, y + r * cell, cell, cell);
      }
    }
  }

  function drawEvents(view) {
    const { x, y, cell } = layout.board;
    for (const e of view.events) {
      if (e.kind === "clear") {
        const alpha = Math.max(0, Math.min(1, e.t / 0.55));
        ctx.save();
        ctx.globalAlpha = alpha * 0.85;
        const flash = e.cross
          ? "rgba(255, 79, 216, 0.5)"
          : "rgba(77, 243, 255, 0.42)";
        ctx.fillStyle = flash;
        for (const r of e.rows) ctx.fillRect(x, y + r * cell, cell * GRID, cell);
        for (const c of e.cols) ctx.fillRect(x + c * cell, y, cell, cell * GRID);
        ctx.restore();

        // 玻璃碎渣（沿消除带）
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(220, 250, 255, 0.9)";
        for (const r of e.rows) {
          for (let i = 0; i < 8; i += 1) {
            const shard = (i * 37 + r * 11) % 8;
            ctx.fillRect(x + shard * cell + cell * 0.3, y + r * cell + cell * 0.3, cell * 0.22, cell * 0.22);
          }
        }
        for (const c of e.cols) {
          for (let i = 0; i < 8; i += 1) {
            const shard = (i * 29 + c * 13) % 8;
            ctx.fillRect(x + c * cell + cell * 0.3, y + shard * cell + cell * 0.3, cell * 0.22, cell * 0.22);
          }
        }
        ctx.restore();

        // 飘分
        const gain = e.gain;
        let cx = x + cell * GRID / 2;
        let cy = y + cell * GRID / 2;
        const lines = e.rows.length + e.cols.length;
        if (lines === 1) {
          const only = e.rows.length ? e.rows[0] : -1;
          if (only >= 0) cy = y + only * cell + cell / 2;
          else cx = x + e.cols[0] * cell + cell / 2;
        }
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `700 ${Math.round(cell * 0.5)}px ui-monospace, Menlo, Consolas, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = e.cross ? MAGENTA : NEON;
        ctx.shadowBlur = 12;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`+${gain}`, cx, cy - (1 - alpha) * cell * 1.4);
        if (e.cross) {
          ctx.font = `700 ${Math.round(cell * 0.3)}px ui-monospace, Menlo, Consolas, monospace`;
          ctx.fillStyle = MAGENTA;
          ctx.fillText("CROSS", cx, cy + cell * 0.5);
        }
        ctx.restore();
      }
    }
  }

  function drawParticles(view) {
    const { x, y, cell } = layout.board;
    for (const p of view.particles) {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x + p.x * cell, y + p.y * cell);
      ctx.rotate(p.rot);
      ctx.fillStyle = CANDY[p.color] ?? NEON;
      const s = Math.max(2, p.size * cell);
      ctx.fillRect(-s / 2, -s / 2, s, s * 0.66);
      ctx.restore();
    }
  }

  function drawSnap(view, dt) {
    // 落子吸附微光（渲染本地计时，与引擎确定性无关）
    if (view.lastPlaced) {
      const key = `${view.piecesPlaced}`;
      if (key !== lastSnapKey) {
        lastSnapKey = key;
        snapAnim = 0.18;
      }
    }
    if (snapAnim <= 0 || !view.lastPlaced) return;
    snapAnim = Math.max(0, snapAnim - dt);
    const { x, y, cell } = layout.board;
    const t = snapAnim / 0.18;
    ctx.save();
    ctx.globalAlpha = t * 0.5;
    for (const [dr, dc] of view.lastPlaced.cells) {
      const r = view.lastPlaced.row + dr;
      const c = view.lastPlaced.col + dc;
      if (r < 0 || r >= GRID || c < 0 || c >= GRID) continue;
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, x + c * cell + 2, y + r * cell + 2, cell - 4, cell - 4, Math.max(3, cell * 0.16));
      ctx.fill();
    }
    ctx.restore();
  }

  function render(view, ui, dt = 0.016) {
    if (!view) return;
    ctx.clearRect(0, 0, layout.width, layout.height);
    drawBoardFrame();
    drawPlaced(view);
    drawGhost(view, ui);
    drawSnap(view, dt);
    drawParticles(view);
    drawEvents(view);
    drawQueue(view, ui);
  }

  syncSize();
  return { syncSize, render, hitTest, anchorFor, layout: () => layout };
}
