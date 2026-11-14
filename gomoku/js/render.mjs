// 棋盘 Canvas 渲染层：木纹棋盘、墨色软胶棋石、AI 思考光环、威胁线柔光、正解路线回放、键盘光标。
// 所有高亮用 createRadialGradient 由内到外渐隐到 rgba(...,0)，严禁描边圈。
// 木纹底板与网格预渲染至离线 Canvas，彻底消除 Math.random 带来的每帧噪点抖动。

import { BLACK, EMPTY, WHITE, SIZE, rc } from "./engine.mjs";

const CELL = 40; // 每格 40px
const PADDING = 24; // 边距
const BOARD_PX = (SIZE - 1) * CELL + PADDING * 2; // 14*40+48 = 608

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  canvas.width = BOARD_PX;
  canvas.height = BOARD_PX;

  let lastMove = -1;
  let winLine = null;
  let candidates = [];
  let wrongMove = -1;
  let wrongTimer = 0;
  let thinking = false;
  let cursor = -1; // 键盘焦点光标位置
  let solutionPath = null; // 残局正解路径

  function cellToPixel(row, col) {
    return [PADDING + col * CELL, PADDING + row * CELL];
  }

  function pixelToCell(px, py) {
    const col = Math.round((px - PADDING) / CELL);
    const row = Math.round((py - PADDING) / CELL);
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return -1;
    return row * SIZE + col;
  }

  // ── 离线底板预渲染（彻底消除木纹闪烁）────────────────
  const bgCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (bgCanvas) {
    bgCanvas.width = BOARD_PX;
    bgCanvas.height = BOARD_PX;
    const bgCtx = bgCanvas.getContext("2d");
    buildStaticBoard(bgCtx);
  }

  function buildStaticBoard(bCtx) {
    // 1. 木纹渐变底色
    const grad = bCtx.createLinearGradient(0, 0, BOARD_PX, BOARD_PX);
    grad.addColorStop(0, "#d4a574");
    grad.addColorStop(0.5, "#c89668");
    grad.addColorStop(1, "#b88858");
    bCtx.fillStyle = grad;
    bCtx.fillRect(0, 0, BOARD_PX, BOARD_PX);

    // 2. 确定性木纹细线（用固定伪随机种子，绝不闪动）
    let seed = 12345;
    const lcg = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    bCtx.strokeStyle = "rgba(120, 70, 30, 0.08)";
    bCtx.lineWidth = 1;
    for (let i = 0; i < 36; i += 1) {
      const y = lcg() * BOARD_PX;
      bCtx.beginPath();
      bCtx.moveTo(0, y);
      bCtx.bezierCurveTo(
        BOARD_PX * 0.3, y + (lcg() * 8 - 4),
        BOARD_PX * 0.7, y + (lcg() * 8 - 4),
        BOARD_PX, y + (lcg() * 6 - 3)
      );
      bCtx.stroke();
    }

    // 3. 棋盘网格
    bCtx.strokeStyle = "rgba(60, 30, 10, 0.65)";
    bCtx.lineWidth = 1;
    for (let i = 0; i < SIZE; i += 1) {
      const p = PADDING + i * CELL;
      // 横线
      bCtx.beginPath();
      bCtx.moveTo(PADDING, p);
      bCtx.lineTo(PADDING + (SIZE - 1) * CELL, p);
      bCtx.stroke();
      // 竖线
      bCtx.beginPath();
      bCtx.moveTo(p, PADDING);
      bCtx.lineTo(p, PADDING + (SIZE - 1) * CELL);
      bCtx.stroke();
    }

    // 4. 五处星位
    const stars = [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]];
    bCtx.fillStyle = "rgba(60, 30, 10, 0.75)";
    for (const [r, c] of stars) {
      const [px, py] = cellToPixel(r, c);
      bCtx.beginPath();
      bCtx.arc(px, py, 3.5, 0, Math.PI * 2);
      bCtx.fill();
    }
  }

  function drawStone(row, col, player, isLast = false) {
    const [px, py] = cellToPixel(row, col);
    const r = CELL * 0.42;

    // 阴影
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.arc(px + 1, py + 2, r, 0, Math.PI * 2);
    ctx.fill();

    // 棋石本体
    const grad = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r);
    if (player === BLACK) {
      grad.addColorStop(0, "#5a5a5a");
      grad.addColorStop(0.4, "#2a2a2a");
      grad.addColorStop(1, "#0a0a0a");
    } else {
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.6, "#f4ead4");
      grad.addColorStop(1, "#c8b890");
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();

    // 高光
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.beginPath();
    ctx.arc(px - r * 0.35, py - r * 0.4, r * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // 最后落子标记（中心微小圆点，不用外轮廓描边圈）
    if (isLast) {
      ctx.fillStyle = player === BLACK ? "rgba(255, 200, 80, 0.9)" : "rgba(192, 64, 32, 0.9)";
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCandidates() {
    if (!candidates || candidates.length === 0) return;
    const maxScore = Math.max(...candidates.map((c) => Math.abs(c.score)), 1);
    const nowTime = typeof performance !== "undefined" ? performance.now() : Date.now();
    const breath = Math.sin(nowTime / 240) * 0.15 + 0.85;

    for (const c of candidates) {
      const [r, col] = rc(c.move);
      const [px, py] = cellToPixel(r, col);
      const intensity = Math.min(1, Math.abs(c.score) / maxScore);
      const rad = CELL * 0.22 * breath;

      // 径向柔光光晕（由内到外渐隐到 rgba 0，不打 stroke 描边）
      const grad = ctx.createRadialGradient(px, py, 0, px, py, rad * 2);
      grad.addColorStop(0, `rgba(255, 200, 80, ${(0.6 + intensity * 0.4) * breath})`);
      grad.addColorStop(0.5, `rgba(255, 180, 60, ${(0.3 + intensity * 0.2) * breath})`);
      grad.addColorStop(1, "rgba(255, 180, 60, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, rad * 2, 0, Math.PI * 2);
      ctx.fill();

      // 中心定音点
      ctx.fillStyle = `rgba(255, 230, 120, ${0.85 * breath})`;
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCursor() {
    if (cursor < 0 || cursor >= SIZE * SIZE) return;
    const [r, c] = rc(cursor);
    const [px, py] = cellToPixel(r, c);

    // 准星角标（四个 L 形微高光角标，不打封闭圆圈）
    const len = 6;
    const off = 14;
    ctx.strokeStyle = "rgba(212, 160, 32, 0.9)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    // 左上
    ctx.beginPath();
    ctx.moveTo(px - off, py - off + len);
    ctx.lineTo(px - off, py - off);
    ctx.lineTo(px - off + len, py - off);
    ctx.stroke();

    // 右上
    ctx.beginPath();
    ctx.moveTo(px + off - len, py - off);
    ctx.lineTo(px + off, py - off);
    ctx.lineTo(px + off, py - off + len);
    ctx.stroke();

    // 左下
    ctx.beginPath();
    ctx.moveTo(px - off, py + off - len);
    ctx.lineTo(px - off, py + off);
    ctx.lineTo(px - off + len, py + off);
    ctx.stroke();

    // 右下
    ctx.beginPath();
    ctx.moveTo(px + off - len, py + off);
    ctx.lineTo(px + off, py + off);
    ctx.lineTo(px + off, py + off - len);
    ctx.stroke();
  }

  function drawWrongHint() {
    if (wrongMove < 0) return;
    const [r, c] = rc(wrongMove);
    const [px, py] = cellToPixel(r, c);
    const t = wrongTimer;
    if (t <= 0) { wrongMove = -1; return; }
    const grad = ctx.createRadialGradient(px, py, 0, px, py, CELL * 0.8);
    grad.addColorStop(0, `rgba(192, 64, 32, ${0.4 * t})`);
    grad.addColorStop(1, "rgba(192, 64, 32, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, CELL * 0.8, 0, Math.PI * 2);
    ctx.fill();
    wrongTimer -= 0.02;
  }

  function drawWinLine() {
    if (!winLine || winLine.length < 5) return;
    const [r0, c0] = rc(winLine[0]);
    const [r1, c1] = rc(winLine[winLine.length - 1]);
    const [x0, y0] = cellToPixel(r0, c0);
    const [x1, y1] = cellToPixel(r1, c1);

    // 沿连线渐隐到 rgba(...,0)，不描硬边
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, "rgba(255, 200, 80, 0.8)");
    grad.addColorStop(0.5, "rgba(255, 220, 100, 0.9)");
    grad.addColorStop(1, "rgba(255, 200, 80, 0.8)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    // 柔光叠加
    for (const idx of winLine) {
      const [r, c] = rc(idx);
      const [px, py] = cellToPixel(r, c);
      const rg = ctx.createRadialGradient(px, py, 0, px, py, CELL * 0.6);
      rg.addColorStop(0, "rgba(255, 220, 100, 0.5)");
      rg.addColorStop(1, "rgba(255, 220, 100, 0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(px, py, CELL * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSolution() {
    if (!solutionPath || solutionPath.length === 0) return;

    // 绘制连线流动光带
    if (solutionPath.length > 1) {
      ctx.beginPath();
      const [sr0, sc0] = rc(solutionPath[0]);
      const [sx0, sy0] = cellToPixel(sr0, sc0);
      ctx.moveTo(sx0, sy0);
      for (let i = 1; i < solutionPath.length; i += 1) {
        const [sr, sc] = rc(solutionPath[i]);
        const [sx, sy] = cellToPixel(sr, sc);
        ctx.lineTo(sx, sy);
      }
      ctx.strokeStyle = "rgba(232, 160, 80, 0.6)";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 标记每一步序号与柔光光斑
    for (let step = 0; step < solutionPath.length; step += 1) {
      const idx = solutionPath[step];
      const [r, c] = rc(idx);
      const [px, py] = cellToPixel(r, c);

      // 径向柔光
      const rg = ctx.createRadialGradient(px, py, 0, px, py, CELL * 0.45);
      rg.addColorStop(0, "rgba(212, 160, 32, 0.85)");
      rg.addColorStop(0.7, "rgba(212, 160, 32, 0.5)");
      rg.addColorStop(1, "rgba(212, 160, 32, 0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(px, py, CELL * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // 步骤文字
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(step + 1), px, py);
    }
  }

  function render(board, opts = {}) {
    ctx.clearRect(0, 0, BOARD_PX, BOARD_PX);

    // 绘制缓存木纹底板
    if (bgCanvas) {
      ctx.drawImage(bgCanvas, 0, 0);
    } else {
      buildStaticBoard(ctx);
    }

    // 思考中候选点
    if (opts.thinking) drawCandidates();

    // 棋子绘制
    for (let i = 0; i < board.length; i += 1) {
      if (board[i] === EMPTY) continue;
      const [r, c] = rc(i);
      drawStone(r, c, board[i], i === lastMove);
    }

    // 错着动画
    drawWrongHint();

    // 获胜连线
    if (opts.winLine) drawWinLine();

    // 正解回放
    if (solutionPath) drawSolution();

    // 键盘光标
    drawCursor();

    if (opts.candidates && opts.candidates.length) {
      candidates = opts.candidates;
      drawCandidates();
    }
  }

  function setLastMove(index) { lastMove = index; }
  function setWinLine(line) { winLine = line; }
  function setCandidates(list) { candidates = list || []; }
  function clearCandidates() { candidates = []; }
  function showWrong(index) { wrongMove = index; wrongTimer = 1; }
  function setThinking(v) { thinking = v; }
  function setCursor(idx) { cursor = idx; }
  function setSolution(path) { solutionPath = path; }

  function hitTest(px, py) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (px - rect.left) * scaleX;
    const y = (py - rect.top) * scaleY;
    return pixelToCell(x, y);
  }

  return {
    render,
    setLastMove,
    setWinLine,
    setCandidates,
    clearCandidates,
    showWrong,
    setThinking,
    setCursor,
    setSolution,
    hitTest,
    getBoardPx: () => BOARD_PX,
  };
}
