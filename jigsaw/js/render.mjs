// filepath: games/jigsaw/js/render.mjs
// Canvas 渲染层：唯一持有画布上下文的模块。只读 game 的 state，从不修改规则状态。
// 一张离屏艺术图按 n×n 切片绘制；交换用 120ms ease-out 补间；尊重 prefers-reduced-motion。

import { artworkRecipe, renderArtwork } from "./artwork.mjs";
import { pieceAt, isLocked } from "./engine.mjs";

const TWEEN_MS = 120;
const ART_MIN = 512;
const ART_MAX = 1024;

const COLORS = {
  board: "#E8E2D8",
  boardEdge: "#D8D0C2",
  grid: "#D8D0C2",
  locked: "#2A9D8F",
  accent: "#2A9D8F",
  hover: "#2A9D8F",
  gold: "#D4A84B",
  shadow: "rgba(60, 40, 20, 0.18)",
  focus: "#2A2118",
};

function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

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

function prefersReducedMotion() {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}

export function createRenderer(canvas, options = {}) {
  if (!canvas || typeof canvas.getContext !== "function") return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  let n = 3;
  let level = null;
  let state = null;
  let art = null;
  let artPixels = 0;

  let selected = null;
  let cursor = null;
  let drag = null;
  let hover = null;
  let preview = false;
  let hint = null;
  let shake = null;
  let burst = null;

  let offsets = null;
  let spins = null;
  let anim = null;
  let rafId = 0;
  let size = 320;
  let disposed = false;

  const reducedMotion = options.reducedMotion === true || prefersReducedMotion();

  // ---------- 尺寸与艺术图 ----------

  function measure() {
    let css = 0;
    try {
      if (typeof canvas.getBoundingClientRect === "function") {
        css = Math.round(canvas.getBoundingClientRect().width);
      }
    } catch {
      css = 0;
    }
    if (!css) css = Math.round(canvas.clientWidth || 0);
    return css > 0 ? css : size;
  }

  function ensureArtwork() {
    if (!level) return;
    const dpr = Math.min(2.5, Math.max(1, (typeof window !== "undefined" && window.devicePixelRatio) || 1));
    const target = Math.round(Math.min(ART_MAX, Math.max(ART_MIN, size * dpr)));
    if (art && artPixels === target && art.dataset.seed === String(level.seed)) return;
    if (typeof document === "undefined" || !document.createElement) return;
    const off = document.createElement("canvas");
    off.width = target;
    off.height = target;
    const offCtx = typeof off.getContext === "function" ? off.getContext("2d") : null;
    if (!offCtx) return;
    renderArtwork(offCtx, target, artworkRecipe(level.seed, level.art ?? {}));
    off.dataset.seed = String(level.seed);
    art = off;
    artPixels = target;
  }

  function resize() {
    const next = measure();
    const dpr = Math.min(2.5, Math.max(1, (typeof window !== "undefined" && window.devicePixelRatio) || 1));
    size = next;
    const backing = Math.max(1, Math.round(size * dpr));
    if (canvas.width !== backing || canvas.height !== backing) {
      canvas.width = backing;
      canvas.height = backing;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ensureArtwork();
    render();
  }

  function metrics() {
    return { size, cell: size / n, n };
  }

  /** 画布坐标 -> 格坐标；越界返回 null */
  function cellAt(clientX, clientY) {
    if (typeof canvas.getBoundingClientRect !== "function") return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const scale = size / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;
    if (x < 0 || y < 0 || x >= size || y >= size) return null;
    const cell = size / n;
    return {
      r: Math.min(n - 1, Math.max(0, Math.floor(y / cell))),
      c: Math.min(n - 1, Math.max(0, Math.floor(x / cell))),
    };
  }

  // ---------- 补间 ----------

  function computeOffsets(prev, next) {
    const total = next.n * next.n;
    const nextOffsets = new Float32Array(total * 2);
    const nextSpins = new Float32Array(total);
    if (!prev || prev.n !== next.n) return { nextOffsets, nextSpins };

    const where = new Map();
    for (let r = 0; r < next.n; r++) {
      for (let c = 0; c < next.n; c++) {
        const piece = prev.grid[r][c];
        where.set(piece.r * next.n + piece.c, { r, c });
      }
    }
    for (let r = 0; r < next.n; r++) {
      for (let c = 0; c < next.n; c++) {
        const piece = next.grid[r][c];
        const from = where.get(piece.r * next.n + piece.c);
        if (!from) continue;
        const i = r * next.n + c;
        nextOffsets[i * 2] = from.c - c;
        nextOffsets[i * 2 + 1] = from.r - r;
        if (from.r !== r || from.c !== c) nextSpins[i] = 1;
      }
    }
    return { nextOffsets, nextSpins };
  }

  function startTween(duration) {
    if (reducedMotion || duration <= 0) {
      anim = null;
      return;
    }
    anim = { t0: typeof performance !== "undefined" ? performance.now() : Date.now(), dur: duration };
    requestFrame();
  }

  function animProgress() {
    if (!anim) return 1;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const raw = clamp01((now - anim.t0) / anim.dur);
    if (raw >= 1) {
      anim = null;
      return 1;
    }
    requestFrame();
    return easeOut(raw);
  }

  function requestFrame() {
    if (disposed || rafId) return;
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return;
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      render();
    });
  }

  // ---------- 绘制 ----------

  function drawBackdrop() {
    ctx.fillStyle = COLORS.board;
    roundRect(ctx, 0, 0, size, size, Math.max(4, size * 0.022));
    ctx.fill();
  }

  function drawSlices(p) {
    if (!art) return;
    const cell = size / n;
    const slice = artPixels / n;
    const gap = Math.max(0.5, cell * 0.012);

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const index = r * n + c;
        if (drag && drag.cell.r === r && drag.cell.c === c) continue;

        const ox = offsets ? offsets[index * 2] * cell * (1 - p) : 0;
        const oy = offsets ? offsets[index * 2 + 1] * cell * (1 - p) : 0;
        const spin = spins ? spins[index] * (1 - p) : 0;

        const x = c * cell + ox;
        const y = r * cell + oy;
        const w = cell - gap;
        const h = cell - gap;

        // 关键：格子 (r,c) 显示的是"当前放在这一格的那块碎片"的图案，
        // 而那块碎片的内容来自它在完整艺术图里的原位 —— 不是这一格自己的位置。
        // 取错成 (c,r) 自己的位置，棋盘就会永远渲染成完整未打乱的图。
        const piece = pieceAt(state, r, c) || { r, c };
        const srcX = piece.c * slice;
        const srcY = piece.r * slice;

        if (spin > 0.001) {
          ctx.save();
          ctx.globalAlpha = 1 - spin * 0.35;
          ctx.translate(x + w / 2, y + h / 2);
          ctx.rotate(spin * 0.55);
          ctx.scale(1 + spin * 0.1, 1 + spin * 0.1);
          ctx.translate(-(w / 2), -(h / 2));
          ctx.drawImage(art, srcX, srcY, slice, slice, 0, 0, w, h);
          ctx.restore();
        } else {
          ctx.drawImage(art, srcX, srcY, slice, slice, x, y, w, h);
        }

        if (state && isLocked(state, r, c)) {
          ctx.save();
          roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, Math.max(1, cell * 0.06));
          ctx.lineWidth = Math.max(1.5, cell * 0.028);
          ctx.strokeStyle = COLORS.locked;
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  function drawHighlights() {
    const cell = size / n;

    if (hover && !(drag && drag.cell.r === hover.r && drag.cell.c === hover.c)) {
      ctx.save();
      roundRect(ctx, hover.c * cell + 1, hover.r * cell + 1, cell - 2, cell - 2, Math.max(2, cell * 0.08));
      ctx.lineWidth = Math.max(2, cell * 0.04);
      ctx.strokeStyle = COLORS.hover;
      ctx.setLineDash([Math.max(4, cell * 0.14), Math.max(3, cell * 0.09)]);
      ctx.stroke();
      ctx.restore();
    }

    if (selected) {
      ctx.save();
      roundRect(ctx, selected.c * cell + 1, selected.r * cell + 1, cell - 2, cell - 2, Math.max(2, cell * 0.08));
      ctx.lineWidth = Math.max(2.5, cell * 0.05);
      ctx.strokeStyle = COLORS.accent;
      ctx.stroke();
      ctx.restore();
    }

    if (cursor && canvas === (typeof document !== "undefined" ? document.activeElement : null)) {
      ctx.save();
      roundRect(ctx, cursor.c * cell + 2, cursor.r * cell + 2, cell - 4, cell - 4, Math.max(2, cell * 0.08));
      ctx.lineWidth = Math.max(2, cell * 0.035);
      ctx.strokeStyle = COLORS.focus;
      ctx.setLineDash([Math.max(3, cell * 0.1), Math.max(3, cell * 0.1)]);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawDragged() {
    if (!drag || !art) return;
    const cell = size / n;
    const slice = artPixels / n;
    const w = cell * 1.05;
    const x = drag.x - w / 2;
    const y = drag.y - w / 2;

    ctx.save();
    ctx.shadowColor = COLORS.shadow;
    ctx.shadowBlur = cell * 0.35;
    ctx.shadowOffsetY = cell * 0.08;
    roundRect(ctx, x, y, w, w, Math.max(2, cell * 0.08));
    ctx.clip();
    // 同 drawSlices：取被拖那块碎片的"原位"图案，不是它所在格自己的位置
    const dragged = pieceAt(state, drag.cell.r, drag.cell.c) || drag.cell;
    ctx.drawImage(art, dragged.c * slice, dragged.r * slice, slice, slice, x, y, w, w);
    ctx.restore();

    ctx.save();
    roundRect(ctx, x, y, w, w, Math.max(2, cell * 0.08));
    ctx.lineWidth = Math.max(1.5, cell * 0.02);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.stroke();
    ctx.restore();
  }

  function drawShake() {
    if (!shake) return;
    const cell = size / n;
    const elapsed = (typeof performance !== "undefined" ? performance.now() : Date.now()) - shake.t0;
    if (elapsed > 260) {
      shake = null;
      return;
    }
    const amp = cell * 0.05 * Math.sin(elapsed / 22) * (1 - elapsed / 260);
    ctx.save();
    roundRect(ctx, shake.cell.c * cell + amp, shake.cell.r * cell, cell - 2, cell - 2, Math.max(2, cell * 0.08));
    ctx.lineWidth = Math.max(2, cell * 0.05);
    ctx.strokeStyle = COLORS.gold;
    ctx.stroke();
    ctx.restore();
    requestFrame();
  }

  function drawHint() {
    if (!hint || preview || !state) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now > hint.until) {
      hint = null;
      return;
    }
    const cell = size / n;
    const fromX = (hint.from.c + 0.5) * cell;
    const fromY = (hint.from.r + 0.5) * cell;
    const toX = (hint.to.c + 0.5) * cell;
    const toY = (hint.to.r + 0.5) * cell;

    ctx.save();
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = Math.max(2, cell * 0.045);
    ctx.lineCap = "round";
    ctx.setLineDash([Math.max(5, cell * 0.16), Math.max(4, cell * 0.12)]);
    ctx.lineDashOffset = -((now / 45) % 1000);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    ctx.setLineDash([]);

    const angle = Math.atan2(toY - fromY, toX - fromX);
    const head = Math.max(6, cell * 0.2);
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - Math.cos(angle - 0.5) * head, toY - Math.sin(angle - 0.5) * head);
    ctx.lineTo(toX - Math.cos(angle + 0.5) * head, toY - Math.sin(angle + 0.5) * head);
    ctx.closePath();
    ctx.fillStyle = COLORS.accent;
    ctx.fill();
    ctx.restore();
    requestFrame();
  }

  function drawFullPicture(pulse) {
    if (!art) return;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.drawImage(art, 0, 0, size, size);
    ctx.restore();
    ctx.save();
    const glow = 0.5 + 0.5 * Math.sin(((typeof performance !== "undefined" ? performance.now() : Date.now()) / 260) % (Math.PI * 2));
    ctx.lineWidth = Math.max(3, size * 0.012);
    ctx.strokeStyle = COLORS.gold;
    ctx.globalAlpha = 0.45 + glow * 0.55;
    roundRect(ctx, 1.5, 1.5, size - 3, size - 3, Math.max(4, size * 0.022));
    ctx.stroke();
    ctx.restore();
    requestFrame();
  }

  function render() {
    if (disposed) return;
    ctx.save();
    ctx.clearRect(0, 0, size, size);
    drawBackdrop();

    const p = animProgress();

    if (preview) {
      drawFullPicture(1);
      ctx.restore();
      return;
    }
    if (burst) {
      drawFullPicture(clamp01(1 - burst.spin * 0.15));
      ctx.restore();
      return;
    }

    ctx.save();
    roundRect(ctx, 0, 0, size, size, Math.max(4, size * 0.022));
    ctx.clip();
    drawSlices(p);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = COLORS.boardEdge;
    ctx.lineWidth = 2;
    roundRect(ctx, 1, 1, size - 2, size - 2, Math.max(4, size * 0.022));
    ctx.stroke();
    ctx.restore();

    drawHighlights();
    drawHint();
    drawDragged();
    drawShake();
    ctx.restore();
  }

  // ---------- 对外接口 ----------

  const api = {
    mount() {
      resize();
      if (typeof ResizeObserver === "function" && typeof document !== "undefined") {
        const observer = new ResizeObserver(() => resize());
        observer.observe(canvas);
        api._observer = observer;
      }
      if (typeof window !== "undefined" && window.addEventListener) {
        window.addEventListener("resize", resize);
      }
      return api;
    },

    dispose() {
      disposed = true;
      if (rafId && typeof window !== "undefined" && window.cancelAnimationFrame) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = 0;
      if (api._observer && typeof api._observer.disconnect === "function") api._observer.disconnect();
      api._observer = null;
      art = null;
    },

    metrics,

    cellAt,

    setLevel(next) {
      level = next;
      n = next && Number.isInteger(next.n) ? next.n : 3;
      art = null;
      artPixels = 0;
      offsets = null;
      spins = null;
      anim = null;
      selected = null;
      cursor = null;
      drag = null;
      hover = null;
      preview = false;
      hint = null;
      shake = null;
      burst = null;
      resize();
      return api;
    },

    /** kind: "init"（不补间）| "swap" | "shuffle" */
    setState(next, kind = "swap") {
      const prev = state;
      state = next;
      if (!next) {
        render();
        return api;
      }
      const computed = computeOffsets(prev, next);
      offsets = computed.nextOffsets;
      spins = kind === "shuffle" ? computed.nextSpins : new Float32Array(next.n * next.n);
      if (kind === "init") {
        offsets = null;
        spins = null;
        anim = null;
        render();
      } else {
        startTween(kind === "shuffle" ? 260 : TWEEN_MS);
        render();
      }
      return api;
    },

    setSelected(cell) {
      selected = cell ? { r: cell.r, c: cell.c } : null;
      render();
      return api;
    },

    setCursor(cell) {
      cursor = cell ? { r: cell.r, c: cell.c } : null;
      render();
      return api;
    },

    setDrag(next) {
      drag = next ? { cell: { r: next.cell.r, c: next.cell.c }, x: next.x, y: next.y } : null;
      render();
      return api;
    },

    setHover(cell) {
      hover = cell ? { r: cell.r, c: cell.c } : null;
      render();
      return api;
    },

    setPreview(value) {
      preview = value === true;
      render();
      return api;
    },

    setShake(cell) {
      shake = cell ? { cell: { r: cell.r, c: cell.c }, t0: typeof performance !== "undefined" ? performance.now() : Date.now() } : null;
      requestFrame();
      return api;
    },

    /** 新手引导：第 1 关开场在"该交换的两块"之间画虚线箭头 */
    setHint(from, to, durationMs = 3000) {
      if (!from || !to) {
        hint = null;
      } else {
        hint = {
          from: { r: from.r, c: from.c },
          to: { r: to.r, c: to.c },
          until: (typeof performance !== "undefined" ? performance.now() : Date.now()) + durationMs,
        };
      }
      requestFrame();
      return api;
    },

    /** 通关：整图淡入 + 金边脉冲 */
    playWin() {
      burst = { spin: 0 };
      requestFrame();
      return api;
    },

    clearWin() {
      burst = null;
      render();
      return api;
    },

    /** 第 1 关引导用：找到"属于 (0,0) 的那块"当前所在格 */
    findPieceCell(target) {
      if (!state) return null;
      for (let r = 0; r < state.n; r++) {
        for (let c = 0; c < state.n; c++) {
          const piece = pieceAt(state, r, c);
          if (piece && piece.r === target.r && piece.c === target.c) return { r, c };
        }
      }
      return null;
    },

    render,
    get size() {
      return size;
    },
    /** 只读：当前是否处于"减少动效"降级（供验收脚本断言，不要在游戏逻辑里读它） */
    get reducedMotion() {
      return reducedMotion;
    },
  };

  return api;
}
