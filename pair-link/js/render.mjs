// Canvas 2D 特效层：折线路径、折线点亮、琉璃粒子、棋盘边缘暖光、洗牌扫光。
// 只读 engine state；只画视觉，不碰规则。DOM 层负责棋盘与全部可读文本。

import { COLS, ROWS } from "./engine.mjs";

const LINE_DURATION = 90; // 每段点亮时长（ms）
const CORNER_PAUSE = 60; // 两折路径的拐角停顿（ms）
const LINE_HOLD = 180; // 画完后停留（ms）
const LINE_FADE = 260; // 淡出时长（ms）
const PARTICLE_LIFE = 420;
const GLOW_DURATION = 500;

function prefersReducedMotion() {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
  } catch {
    return false;
  }
}

export function createRenderer(canvas, boardEl) {
  const ctx = canvas && typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let lastTs = 0;
  let state = null;
  let observer = null;

  /** @type {Array<object>} */
  let effects = [];

  function measure() {
    if (!boardEl || !canvas) return;
    const rect = boardEl.getBoundingClientRect();
    const nextWidth = Math.max(0, Math.round(rect.width));
    const nextHeight = Math.max(0, Math.round(rect.height));
    const ratio = Math.min(2, Math.max(1, (typeof window !== "undefined" && window.devicePixelRatio) || 1));
    width = nextWidth;
    height = nextHeight;
    dpr = ratio;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function cellSize() {
    return { w: width / COLS, h: height / ROWS };
  }

  function centerOf(cell) {
    const { w, h } = cellSize();
    return { x: (cell.c + 0.5) * w, y: (cell.r + 0.5) * h };
  }

  function midpointOf(cells) {
    const first = centerOf(cells[0]);
    const last = centerOf(cells[cells.length - 1]);
    return { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 };
  }

  function ensureLoop() {
    if (raf || !ctx) return;
    lastTs = 0;
    raf = requestAnimationFrame(loop);
  }

  function loop(ts) {
    const dt = lastTs ? Math.min(100, ts - lastTs) : 16;
    lastTs = ts;

    for (let i = effects.length - 1; i >= 0; i -= 1) {
      const effect = effects[i];
      effect.t += dt;
      if (effect.t >= effect.dur) effects.splice(i, 1);
    }

    draw();
    if (effects.length > 0) {
      raf = requestAnimationFrame(loop);
    } else {
      raf = 0;
      lastTs = 0;
    }
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (width === 0 || height === 0) return;
    for (let i = 0; i < effects.length; i += 1) {
      const effect = effects[i];
      if (effect.kind === "link") drawLink(effect);
      else if (effect.kind === "particles") drawParticles(effect);
      else if (effect.kind === "glow") drawGlow(effect);
      else if (effect.kind === "sweep") drawSweep(effect);
    }
  }

  function drawLink(effect) {
    const cells = effect.cells;
    const points = cells.map(centerOf);
    const segments = points.length - 1;
    const { w } = cellSize();
    const lineWidth = Math.max(3, w * 0.13);

    // 计算当前已点亮进度（含拐角停顿）
    const perSegment = LINE_DURATION + (effect.folds > 0 ? CORNER_PAUSE : 0);
    const totalLine = segments * perSegment;
    const t = effect.t;
    let drawn = 0;
    if (t >= totalLine + LINE_HOLD) {
      drawn = segments;
    } else {
      drawn = Math.min(segments, t / perSegment);
    }

    let alpha = 1;
    if (t > totalLine + LINE_HOLD) {
      alpha = Math.max(0, 1 - (t - totalLine - LINE_HOLD) / LINE_FADE);
    }
    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let s = 0; s < segments; s += 1) {
      const local = Math.max(0, Math.min(1, drawn - s));
      if (local <= 0) break;
      const a = points[s];
      const b = points[s + 1];
      const ex = a.x + (b.x - a.x) * local;
      const ey = a.y + (b.y - a.y) * local;

      // 外发光
      ctx.strokeStyle = "rgba(232, 183, 104, 0.42)";
      ctx.lineWidth = lineWidth * 2.4;
      ctx.shadowColor = "rgba(255, 216, 150, 0.85)";
      ctx.shadowBlur = lineWidth * 3;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // 主体铜线
      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      grad.addColorStop(0, "#ffe9c0");
      grad.addColorStop(0.5, "#e8b768");
      grad.addColorStop(1, "#c9863f");
      ctx.strokeStyle = grad;
      ctx.lineWidth = lineWidth;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    // 拐角铜光
    ctx.shadowBlur = 0;
    for (let s = 1; s < points.length - 1; s += 1) {
      if (drawn < s + 1) break;
      ctx.fillStyle = "#fff3d9";
      ctx.beginPath();
      ctx.arc(points[s].x, points[s].y, lineWidth * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawParticles(effect) {
    const progress = Math.min(1, effect.t / effect.dur);
    const ease = 1 - Math.pow(1 - progress, 3);
    ctx.save();
    for (let i = 0; i < effect.particles.length; i += 1) {
      const p = effect.particles[i];
      const x = p.x0 + (p.x1 - p.x0) * ease + p.bow * Math.sin(Math.PI * progress) * Math.cos(p.angle);
      const y = p.y0 + (p.y1 - p.y0) * ease + p.bow * Math.sin(Math.PI * progress) * Math.sin(p.angle);
      const alpha = Math.max(0, 1 - progress);
      const size = p.size * (1 - progress * 0.55);
      ctx.globalAlpha = alpha;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, size * 2.6);
      grad.addColorStop(0, "rgba(255, 244, 224, 0.98)");
      grad.addColorStop(0.45, "rgba(232, 183, 104, 0.8)");
      grad.addColorStop(1, "rgba(201, 134, 63, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, size * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGlow(effect) {
    const progress = Math.min(1, effect.t / effect.dur);
    const alpha = Math.sin(Math.PI * progress) * 0.85;
    const pad = 3;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#e8b768";
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(232, 183, 104, 0.9)";
    ctx.shadowBlur = 22;
    const radius = 18;
    ctx.beginPath();
    ctx.moveTo(pad + radius, pad);
    ctx.lineTo(width - pad - radius, pad);
    ctx.quadraticCurveTo(width - pad, pad, width - pad, pad + radius);
    ctx.lineTo(width - pad, height - pad - radius);
    ctx.quadraticCurveTo(width - pad, height - pad, width - pad - radius, height - pad);
    ctx.lineTo(pad + radius, height - pad);
    ctx.quadraticCurveTo(pad, height - pad, pad, height - pad - radius);
    ctx.lineTo(pad, pad + radius);
    ctx.quadraticCurveTo(pad, pad, pad + radius, pad);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawSweep(effect) {
    const progress = Math.min(1, effect.t / effect.dur);
    const y = progress * height;
    const band = Math.max(24, height * 0.14);
    const grad = ctx.createLinearGradient(0, y - band, 0, y + band);
    grad.addColorStop(0, "rgba(232, 183, 104, 0)");
    grad.addColorStop(0.5, "rgba(232, 183, 104, 0.28)");
    grad.addColorStop(1, "rgba(232, 183, 104, 0)");
    ctx.save();
    ctx.globalAlpha = Math.sin(Math.PI * progress);
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - band, width, band * 2);
    ctx.restore();
  }

  function push(effect) {
    if (!ctx || width === 0) return;
    effects.push(effect);
    ensureLoop();
  }

  /** 折线按折数依次点亮；返回动画总时长（ms）。 */
  function playLink(cells, folds) {
    if (!ctx || !Array.isArray(cells) || cells.length < 2) return 0;
    if (prefersReducedMotion()) return 0;
    const segments = cells.length - 1;
    const total = segments * (LINE_DURATION + (folds > 0 ? CORNER_PAUSE : 0)) + LINE_HOLD + LINE_FADE;
    push({ kind: "link", cells, folds: folds || 0, t: 0, dur: total });
    return total;
  }

  /** 两枚瓷片碎成琉璃粒子，向折线中点收束。 */
  function playClear(cells) {
    if (!ctx || !Array.isArray(cells) || cells.length < 2) return 0;
    if (prefersReducedMotion()) return 0;
    const target = midpointOf(cells);
    const { w, h } = cellSize();
    const particles = [];
    const ends = [cells[0], cells[cells.length - 1]];
    for (let e = 0; e < ends.length; e += 1) {
      const origin = centerOf(ends[e]);
      const count = 8;
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        particles.push({
          x0: origin.x + Math.cos(angle) * w * 0.18,
          y0: origin.y + Math.sin(angle) * h * 0.18,
          x1: target.x,
          y1: target.y,
          angle,
          bow: w * (0.35 + Math.random() * 0.5),
          size: w * (0.07 + Math.random() * 0.06)
        });
      }
    }
    push({ kind: "particles", particles, t: 0, dur: PARTICLE_LIFE });
    return PARTICLE_LIFE;
  }

  /** 连击 ≥3：棋盘边缘一圈暖光。 */
  function playBoardGlow() {
    if (!ctx) return 0;
    if (prefersReducedMotion()) return 0;
    push({ kind: "glow", t: 0, dur: GLOW_DURATION });
    return GLOW_DURATION;
  }

  /** 洗牌扫光。 */
  function playShuffle() {
    if (!ctx) return 0;
    if (prefersReducedMotion()) return 0;
    push({ kind: "sweep", t: 0, dur: 420 });
    return 420;
  }

  function setState(next) {
    state = next;
  }

  function resize() {
    measure();
    draw();
  }

  function destroy() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    effects = [];
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  measure();

  if (typeof ResizeObserver === "function" && boardEl) {
    observer = new ResizeObserver(() => {
      measure();
      draw();
    });
    observer.observe(boardEl);
  } else if (typeof window !== "undefined") {
    window.addEventListener("resize", resize);
  }

  return {
    setState,
    playLink,
    playClear,
    playBoardGlow,
    playShuffle,
    resize,
    destroy,
    getState: () => state
  };
}
