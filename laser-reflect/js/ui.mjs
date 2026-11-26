// ui.mjs：唯一碰 DOM 的渲染层。
// 用 CSS Grid 渲染盘面格子，每个元件用内联 SVG 绘制；光路用覆盖的 SVG 层绘制。
import { trace, EMITTER, MIRROR, SPLITTER, FILTER, SPECTRO, TARGET, WALL, WHITE, RED, GREEN, BLUE } from "./engine.mjs";

// 颜色映射（光束 + 靶）
const BEAM_COLOR = {
  white: "#eef6ff",
  red: "#ff4d5e",
  green: "#37e08a",
  blue: "#4d9bff",
};

const TARGET_GLOW = {
  white: "rgba(238,246,255,0.9)",
  red: "rgba(255,77,94,0.9)",
  green: "rgba(55,224,138,0.9)",
  blue: "rgba(77,155,255,0.9)",
};

export function mountUI(refs, handlers, t) {
  const boardEl = refs.board;
  const raysLayer = refs.raysLayer; // SVG 覆盖层

  // 当前渲染所需的几何信息
  let cellSize = 0;
  let rows = 0;
  let cols = 0;
  let boardLeft = 0; // board 相对 board-wrap 的偏移（用于光路坐标）
  let boardTop = 0;
  const GAP = 3;

  function layout(rowsCount, colsCount) {
    const wrapRect = boardEl.parentElement.getBoundingClientRect();
    const pad = 6;
    const availW = Math.max(80, wrapRect.width - pad * 2);
    const availH = Math.max(80, wrapRect.height - pad * 2);
    cellSize = Math.floor(Math.min((availW - GAP * (colsCount - 1)) / colsCount, (availH - GAP * (rowsCount - 1)) / rowsCount));
    cellSize = Math.max(22, Math.min(cellSize, 64)); // 上限防巨格
    const gridW = cellSize * colsCount + GAP * (colsCount - 1);
    const gridH = cellSize * rowsCount + GAP * (rowsCount - 1);
    boardLeft = Math.round((wrapRect.width - gridW) / 2);
    boardTop = Math.round((wrapRect.height - gridH) / 2);
  }

  // 中心点坐标（相对 board-wrap，即光路 SVG 坐标系）
  function cellCenter(r, c) {
    return {
      x: boardLeft + c * (cellSize + GAP) + cellSize / 2,
      y: boardTop + r * (cellSize + GAP) + cellSize / 2,
    };
  }

  function render(view) {
    rows = view.rows;
    cols = view.cols;
    layout(rows, cols);

    // 换关：旋转累积角全部清零（新盘面不做"凭空拧 90°"的动画）
    if (view.levelIndex !== lastLevelIndex) {
      rotAccum.clear();
      pendingFlips.length = 0;
      lastLevelIndex = view.levelIndex;
    }

    // 清空并重建格子
    boardEl.innerHTML = "";
    boardEl.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
    boardEl.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;
    boardEl.style.gap = `${GAP}px`;
    // board 绝对定位，与光路 SVG 坐标系对齐
    boardEl.style.position = "absolute";
    boardEl.style.left = `${boardLeft}px`;
    boardEl.style.top = `${boardTop}px`;

    const traceResult = trace({ rows, cols, par: view.par, cells: view.cells });
    const litSet = traceResult.lit;
    const litTargets = traceResult.litTargets;

    // 胜利瞬间：board 加 .win，靶点 pop 动画播两轮，填满延迟结算的视觉空档
    boardEl.classList.toggle("win", !!view.solved);

    let targetIdx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.style.width = `${cellSize}px`;
        cell.style.height = `${cellSize}px`;
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        const key = `${r},${c}`;
        if (litSet.has(key)) cell.classList.add("lit");

        const piece = view.cells.find((x) => x.r === r && x.c === c);
        if (piece) {
          cell.appendChild(renderPiece(piece, litTargets, targetIdx));
          cell.dataset.type = piece.type;
          if (piece.type === TARGET) targetIdx++;
        }
        boardEl.appendChild(cell);
      }
    }

    // flush 旋转动画：元素已入 DOM，先回弹起点再转到位（transition 生效）
    for (const f of pendingFlips) {
      f.el.style.transform = `rotate(${f.from}deg)`;
      void f.el.offsetWidth; // 强制 reflow，记录起始帧
      f.el.style.transform = `rotate(${f.to}deg)`;
    }
    pendingFlips.length = 0;

    // 绘制光路
    renderRays(traceResult);
  }

  // 旋转累积角度（跨渲染保留，让镜子始终朝同一方向转 90°，而不是 0↔90 来回甩）
  const rotAccum = new Map(); // "r,c" -> { base, deg }
  const pendingFlips = []; // 本轮渲染需要做旋转动画的元件
  let lastLevelIndex = null;

  function renderPiece(piece, litTargets, targetIdx) {
    const wrap = document.createElement("span");
    wrap.className = `piece piece-${piece.type}`;

    if (piece.type === MIRROR || piece.type === SPLITTER) {
      wrap.classList.add("rotatable");
      const key = piece.r + "," + piece.c;
      const base = (piece.mirror ?? 0) * 90;
      let st = rotAccum.get(key);
      if (!st) {
        st = { base, deg: base, changed: false };
      } else if (st.base !== base) {
        st.deg += 90; // 永远顺时针转 90°，视觉上是"拧了一下旋钮"
        st.base = base;
        st.changed = true;
      }
      rotAccum.set(key, st);
      if (st.changed) {
        pendingFlips.push({ el: wrap, from: st.deg - 90, to: st.deg });
        st.changed = false;
      } else {
        wrap.style.transform = `rotate(${st.deg}deg)`;
      }
      wrap.innerHTML = mirrorSvg(piece.type === SPLITTER);
      return wrap;
    }
    if (piece.type === EMITTER) {
      wrap.innerHTML = emitterSvg(piece.dir);
      return wrap;
    }
    if (piece.type === SPECTRO) {
      wrap.innerHTML = spectroSvg();
      return wrap;
    }
    if (piece.type === FILTER) {
      wrap.innerHTML = filterSvg(piece.color);
      return wrap;
    }
    if (piece.type === TARGET) {
      // 被同色光点亮：加 hit 类（CSS 延迟到光抵达才 pop），辉光颜色走 --hit-color 变量
      if (litTargets.has(targetIdx)) {
        wrap.classList.add("hit");
        wrap.style.setProperty("--hit-color", BEAM_COLOR[piece.targetColor] ?? "#fff");
      }
      wrap.innerHTML = targetSvg(piece.targetColor);
      return wrap;
    }
    if (piece.type === WALL) {
      wrap.innerHTML = wallSvg();
      return wrap;
    }
    return wrap;
  }

  // 镜子 SVG（"/" 型，通过 CSS transform 旋转 90° 切换 "\"）
  function mirrorSvg(splitter) {
    const line = splitter
      ? `<line x1="30" y1="8" x2="2" y2="30" stroke="rgba(255,255,255,0.85)" stroke-width="3"/>
         <line x1="2" y1="2" x2="30" y2="30" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>`
      : `<line x1="30" y1="8" x2="2" y2="30" stroke="rgba(255,255,255,0.9)" stroke-width="3.5"/>`;
    return `<svg viewBox="0 0 32 32" class="piece-svg"><rect x="1" y="1" width="30" height="30" rx="4" fill="rgba(120,160,220,0.18)" stroke="rgba(160,200,255,0.5)" stroke-width="1.5"/>${line}</svg>`;
  }

  function emitterSvg(dir) {
    // 发射器：发光圆点 + 指向箭头（dir: 0=N,1=E,2=S,3=W）
    const arrow = {
      0: `<line x1="16" y1="16" x2="16" y2="4" stroke="#eef6ff" stroke-width="3"/><path d="M11 9 L16 4 L21 9" fill="none" stroke="#eef6ff" stroke-width="2.5"/>`,
      1: `<line x1="16" y1="16" x2="28" y2="16" stroke="#eef6ff" stroke-width="3"/><path d="M23 11 L28 16 L23 21" fill="none" stroke="#eef6ff" stroke-width="2.5"/>`,
      2: `<line x1="16" y1="16" x2="16" y2="28" stroke="#eef6ff" stroke-width="3"/><path d="M11 23 L16 28 L21 23" fill="none" stroke="#eef6ff" stroke-width="2.5"/>`,
      3: `<line x1="16" y1="16" x2="4" y2="16" stroke="#eef6ff" stroke-width="3"/><path d="M9 11 L4 16 L9 21" fill="none" stroke="#eef6ff" stroke-width="2.5"/>`,
    }[dir];
    return `<svg viewBox="0 0 32 32" class="piece-svg"><circle cx="16" cy="16" r="5" fill="#eef6ff"/><circle cx="16" cy="16" r="9" fill="none" stroke="rgba(238,246,255,0.4)" stroke-width="1.5"/>${arrow}</svg>`;
  }

  function spectroSvg() {
    // 分色棱镜：三角形，白光入口 + RGB 出口
    return `<svg viewBox="0 0 32 32" class="piece-svg"><path d="M16 4 L27 27 L5 27 Z" fill="rgba(220,230,255,0.2)" stroke="rgba(180,210,255,0.7)" stroke-width="1.5"/><path d="M16 4 L9 27" stroke="rgba(255,77,94,0.7)" stroke-width="1.2"/><path d="M16 4 L16 27" stroke="rgba(55,224,138,0.7)" stroke-width="1.2"/><path d="M16 4 L23 27" stroke="rgba(77,155,255,0.7)" stroke-width="1.2"/></svg>`;
  }

  function filterSvg(color) {
    const c = BEAM_COLOR[color] ?? "#fff";
    return `<svg viewBox="0 0 32 32" class="piece-svg"><rect x="6" y="6" width="20" height="20" rx="3" fill="none" stroke="${c}" stroke-width="3"/><circle cx="16" cy="16" r="3" fill="${c}"/></svg>`;
  }

  function targetSvg(targetColor) {
    const c = BEAM_COLOR[targetColor] ?? "#fff";
    // 外环常显；内芯是"感光核"，默认熄灭，被同色光命中后充能点亮（CSS .target-core）
    return `<svg viewBox="0 0 32 32" class="piece-svg"><circle cx="16" cy="16" r="11" fill="none" stroke="${c}" stroke-width="2.5"/><circle class="target-core" cx="16" cy="16" r="5" fill="${c}"/></svg>`;
  }

  function wallSvg() {
    return `<svg viewBox="0 0 32 32" class="piece-svg"><rect x="2" y="2" width="28" height="28" rx="3" fill="rgba(60,70,90,0.55)" stroke="rgba(90,105,130,0.6)" stroke-width="1.5"/></svg>`;
  }

  function renderRays(traceResult) {
    if (!raysLayer) return;
    const wrap = boardEl.parentElement;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    raysLayer.setAttribute("width", w);
    raysLayer.setAttribute("height", h);
    raysLayer.setAttribute("viewBox", `0 0 ${w} ${h}`);

    let svg = "";
    for (const ray of traceResult.rays) {
      if (ray.cells.length < 2) continue;
      const color = BEAM_COLOR[ray.color] ?? "#fff";
      const pts = ray.cells.map((cell) => cellCenter(cell.r, cell.c));

      // 像素长度 → 流入时长（≈480px/s，短段不至于一闪而过）
      let len = 0;
      for (let i = 1; i < pts.length; i++) {
        len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      }
      const drawDur = Math.max(0.18, Math.min(0.55, len / 480)).toFixed(2);

      let d = "";
      for (const p of pts) {
        d += (d === "" ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1) + " ";
      }
      const common = `d="${d}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;

      // 光晕（宽、淡）→ 主光束 → 白色能量流动亮段 → 抵达冲击波
      svg += `<path class="beam-glow" pathLength="1" ${common} stroke="${color}" stroke-width="9" opacity="0.25" style="animation-duration:${drawDur}s"/>`;
      svg += `<path class="beam-main" pathLength="1" ${common} stroke="${color}" stroke-width="3" opacity="0.95" style="animation-duration:${drawDur}s"/>`;
      svg += `<path class="ray-flow" ${common} stroke="#ffffff" stroke-width="1.6" opacity="0.85" stroke-dasharray="9 15" style="animation-delay:${drawDur}s"/>`;
      const end = pts[pts.length - 1];
      const r = Math.max(6, cellSize * 0.3).toFixed(1);
      svg += `<circle class="ray-impact" cx="${end.x.toFixed(1)}" cy="${end.y.toFixed(1)}" r="${r}" fill="none" stroke="${color}" stroke-width="2.5" style="animation-delay:${drawDur}s"/>`;
    }
    raysLayer.innerHTML = svg;
  }

  // 事件委托：点击元件旋转
  boardEl.addEventListener("click", (evt) => {
    const cell = evt.target.closest(".cell");
    if (!cell) return;
    const piece = cell.querySelector(".piece.rotatable");
    if (!piece) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    if (handlers.onRotate) handlers.onRotate(r, c);
  });

  return { render, layout };
}
