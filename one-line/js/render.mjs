/* filepath: games/one-line/js/render.mjs */

// 每次点击提示向前揭示的格数（不是一次性铺满全解）
const HINT_STEP = 4;

// 已走过格子的填充色（与轨迹线同色）
const PATH_COLOR = '#00f2fe';
// 小格子放不下整只猫，改用简洁守护石
const MIN_CELL_FOR_ANIMAL = 24;

// 系统开启"减弱动态效果"时，画布侧的粒子/呼吸/充能动画一并降级
function prefersReducedMotion() {
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  } catch {
    // 环境不支持时按正常动效处理
  }
  return false;
}

export class OneLineRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.gridBounds = { x: 0, y: 0, width: 0, height: 0, cellSize: 0, gap: 0 };
    this.particles = [];
    this.sparks = [];

    this.surgeProgress = 0;
    this.isSurging = false;
    this.animalTimer = 0;
    this.hintEnd = -1;
    // "r,c" -> 0..1 填色弹入进度，回退时自动移除
    this.fillT = new Map();
  }

  /** 换关 / 重置时清空填色动画，避免沿用上一局的进度 */
  resetFillAnimation() {
    this.fillT.clear();
  }

  resize(width, height) {
    if (!width || !height || width <= 0 || height <= 0) return;
    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.canvas.width = Math.floor(width * this.dpr);
    this.canvas.height = Math.floor(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  hitTest(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const { x: gx, y: gy, cellSize, gap } = this.gridBounds;
    if (cellSize <= 0) return null;

    const col = Math.floor((x - gx) / (cellSize + gap));
    const row = Math.floor((y - gy) / (cellSize + gap));

    const cellLeft = gx + col * (cellSize + gap);
    const cellTop = gy + row * (cellSize + gap);

    if (x >= cellLeft && x <= cellLeft + cellSize && y >= cellTop && y <= cellTop + cellSize) {
      return { r: row, c: col };
    }
    return null;
  }

  updateLayout(state) {
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    if (w <= 0 || h <= 0) return;

    const padding = 20;
    const maxGridW = Math.max(10, w - padding * 2);
    const maxGridH = Math.max(10, h - padding * 2);

    const cols = state.cols;
    const rows = state.rows;

    const gap = Math.max(4, Math.floor(9 - Math.max(cols, rows) * 0.35));
    const cellW = (maxGridW - (cols - 1) * gap) / cols;
    const cellH = (maxGridH - (rows - 1) * gap) / rows;
    const cellSize = Math.max(16, Math.floor(Math.min(cellW, cellH, 84)));

    const totalW = cols * cellSize + (cols - 1) * gap;
    const totalH = rows * cellSize + (rows - 1) * gap;

    this.gridBounds = {
      x: Math.floor((w - totalW) / 2),
      y: Math.floor((h - totalH) / 2),
      width: totalW,
      height: totalH,
      cellSize,
      gap
    };
  }

  startElectricitySurge() {
    this.isSurging = true;
    this.surgeProgress = 0;
  }

  /** 从当前笔头再向前揭示 HINT_STEP 格真解 */
  revealHint(headIdx, lastIdx) {
    this.hintEnd = Math.min(lastIdx, Math.max(this.hintEnd, headIdx) + HINT_STEP);
  }

  clearHint() {
    this.hintEnd = -1;
  }

  triggerVictoryConfetti() {
    if (prefersReducedMotion()) return;

    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const colors = ['#00f2fe', '#4facfe', '#ffcf33', '#ff2a70', '#00e676', '#9d4edd'];

    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 5 + 2) * this.dpr;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.5 * this.dpr,
        size: (Math.random() * 5 + 3) * this.dpr,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1.0,
        decay: Math.random() * 0.015 + 0.01
      });
    }
  }

  drawGuardianAnimal(ctx, cx, cy, size, t) {
    const breath = Math.sin(t * 3) * 1.5;
    const isBlink = (Math.floor(t * 1.2) % 4 === 0) && (t % 1 < 0.15);

    ctx.save();
    // 保护能量环
    ctx.fillStyle = 'rgba(157, 78, 221, 0.15)';
    ctx.strokeStyle = 'rgba(157, 78, 221, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.44 + breath * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 身体
    const headR = size * 0.28;
    ctx.fillStyle = '#2c234a';
    ctx.beginPath();
    ctx.arc(cx, cy + 2 + breath, headR, 0, Math.PI * 2);
    ctx.fill();

    // 耳朵
    ctx.fillStyle = '#ff758c';
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.8, cy - headR * 0.3 + breath);
    ctx.lineTo(cx - headR * 0.4, cy - headR * 1.1 + breath);
    ctx.lineTo(cx - headR * 0.1, cy - headR * 0.6 + breath);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + headR * 0.8, cy - headR * 0.3 + breath);
    ctx.lineTo(cx + headR * 0.4, cy - headR * 1.1 + breath);
    ctx.lineTo(cx + headR * 0.1, cy - headR * 0.6 + breath);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#ffcf33';
    if (isBlink) {
      ctx.fillRect(cx - headR * 0.5, cy + breath, headR * 0.35, 2);
      ctx.fillRect(cx + headR * 0.15, cy + breath, headR * 0.35, 2);
    } else {
      ctx.beginPath();
      ctx.arc(cx - headR * 0.35, cy + breath, headR * 0.14, 0, Math.PI * 2);
      ctx.arc(cx + headR * 0.35, cy + breath, headR * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }

    // 鼻
    ctx.fillStyle = '#ff2a70';
    ctx.beginPath();
    ctx.arc(cx, cy + headR * 0.35 + breath, headR * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  render(state, dt = 0.016) {
    if (!this.canvas.width || !this.canvas.height) return;
    const reduceMotion = prefersReducedMotion();
    if (!reduceMotion) this.animalTimer += dt;
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    ctx.clearRect(0, 0, w, h);

    this.updateLayout(state);
    const { x: gx, y: gy, cellSize, gap } = this.gridBounds;
    if (cellSize <= 0) {
      ctx.restore();
      return;
    }

    // 1. 绘制底格与守护小动物
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cx = gx + c * (cellSize + gap);
        const cy = gy + r * (cellSize + gap);

        if (state.grid[r][c] === 0) {
          if (cellSize < MIN_CELL_FOR_ANIMAL) {
            this.drawGuardianBlock(ctx, cx + cellSize / 2, cy + cellSize / 2, cellSize);
          } else {
            this.drawGuardianAnimal(ctx, cx + cellSize / 2, cy + cellSize / 2, cellSize, this.animalTimer);
          }
        } else {
          ctx.fillStyle = '#14182b';
          ctx.strokeStyle = '#242c4b';
          ctx.lineWidth = 1.5;
          this.drawRoundedRect(ctx, cx, cy, cellSize, cellSize, Math.max(4, cellSize * 0.18));
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    // 2. 已走路径：细线 + 节点圆点，不再整格填充
    const nodeRadius = cellSize * 0.38;
    const lineWidth = cellSize * 0.32;
    const filled = new Set();
    const nodes = [];

    for (let i = 0; i < state.path.length; i++) {
      const [r, c] = state.path[i];
      const key = `${r},${c}`;
      filled.add(key);
      nodes.push({
        key,
        px: gx + c * (cellSize + gap) + cellSize / 2,
        py: gy + r * (cellSize + gap) + cellSize / 2
      });
    }

    // 回退掉的格子要从动画表里摘掉，下次再走才能重新弹入
    if (this.fillT.size > filled.size) {
      for (const k of this.fillT.keys()) {
        if (!filled.has(k)) this.fillT.delete(k);
      }
    }

    // 画连线：圆角细线，视觉上比填充块精致
    if (nodes.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = PATH_COLOR;
      ctx.shadowColor = 'rgba(0, 242, 254, 0.35)';
      ctx.shadowBlur = Math.max(4, cellSize * 0.15);
      ctx.beginPath();
      for (let i = 0; i < nodes.length; i++) {
        if (i === 0) ctx.moveTo(nodes[i].px, nodes[i].py);
        else ctx.lineTo(nodes[i].px, nodes[i].py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 节点圆点动画（覆盖线端，避免接头变方）
    for (let i = 0; i < nodes.length; i++) {
      const { key, px, py } = nodes[i];
      let t = this.fillT.get(key);
      if (t === undefined) t = reduceMotion ? 1 : 0;
      if (t < 1) {
        t = Math.min(1, t + dt * 7);
        this.fillT.set(key, t);
      }
      const eased = 1 - Math.pow(1 - t, 3);
      const rNode = nodeRadius * (0.5 + 0.5 * eased);

      ctx.globalAlpha = 0.8 + 0.2 * eased;
      ctx.fillStyle = PATH_COLOR;
      ctx.beginPath();
      ctx.arc(px, py, rNode, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 3. 提示：只画从笔头起已揭示的那一小段真解
    const headIdx = state.path.length - 1;
    if (this.hintEnd > headIdx && state.solution && state.solution.length > 1) {
      const endIdx = Math.min(this.hintEnd, state.solution.length - 1);
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 207, 51, 0.55)';
      ctx.lineWidth = Math.max(2, cellSize * 0.1);
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      for (let i = headIdx; i <= endIdx; i++) {
        const [r, c] = state.solution[i];
        const px = gx + c * (cellSize + gap) + cellSize / 2;
        const py = gy + r * (cellSize + gap) + cellSize / 2;
        if (i === headIdx) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 5. 通关电流贯穿
    if (this.isSurging && state.path.length > 1) {
      this.surgeProgress = reduceMotion ? 1 : this.surgeProgress + dt * 1.35;
      const clampedP = Math.min(1.0, this.surgeProgress);
      const totalLen = state.path.length - 1;
      const headIdx = Math.floor(clampedP * totalLen);

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = Math.max(5, cellSize * 0.35);

      ctx.beginPath();
      for (let i = 0; i <= headIdx; i++) {
        const [r, c] = state.path[i];
        const px = gx + c * (cellSize + gap) + cellSize / 2;
        const py = gy + r * (cellSize + gap) + cellSize / 2;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      if (headIdx < state.path.length) {
        const [hr, hc] = state.path[headIdx];
        const hx = gx + hc * (cellSize + gap) + cellSize / 2;
        const hy = gy + hr * (cellSize + gap) + cellSize / 2;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(hx, hy, cellSize * 0.28, 0, Math.PI * 2);
        ctx.fill();

        if (!reduceMotion) {
          for (let s = 0; s < 3; s++) {
            this.sparks.push({
              x: hx,
              y: hy,
              vx: (Math.random() - 0.5) * 8,
              vy: (Math.random() - 0.5) * 8,
              life: 1.0,
              decay: 0.05
            });
          }
        }
      }
      ctx.restore();
    }

    // 6. 起点与笔头标记（中间节点不再画点，填色本身就是进度）
    if (state.path.length > 0) {
      const [sr, sc] = state.path[0];
      const sx = gx + sc * (cellSize + gap) + cellSize / 2;
      const sy = gy + sr * (cellSize + gap) + cellSize / 2;
      ctx.fillStyle = '#ffcf33';
      ctx.beginPath();
      ctx.arc(sx, sy, cellSize * 0.2, 0, Math.PI * 2);
      ctx.fill();

      const [hr, hc] = state.path[state.path.length - 1];
      const hx = gx + hc * (cellSize + gap) + cellSize / 2;
      const hy = gy + hr * (cellSize + gap) + cellSize / 2;
      const pulse = reduceMotion ? 0 : Math.sin(this.animalTimer * 5) * cellSize * 0.03;

      ctx.strokeStyle = state.status === 'deadend' ? '#ff2a70' : '#ffffff';
      ctx.lineWidth = Math.max(2, cellSize * 0.08);
      ctx.beginPath();
      ctx.arc(hx, hy, cellSize * 0.3 + pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** 小格子版的守护者：一块发光守护石 + 爪印，避免 12×12 时糊成一团 */
  drawGuardianBlock(ctx, cx, cy, size) {
    const s = size * 0.82;
    ctx.save();
    ctx.fillStyle = 'rgba(157, 78, 221, 0.24)';
    ctx.strokeStyle = 'rgba(157, 78, 221, 0.5)';
    ctx.lineWidth = Math.max(1, size * 0.05);
    this.drawRoundedRect(ctx, cx - s / 2, cy - s / 2, s, s, s * 0.26);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 117, 140, 0.8)';
    ctx.beginPath();
    ctx.arc(cx, cy + s * 0.14, s * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - s * 0.19, cy - s * 0.1, s * 0.075, 0, Math.PI * 2);
    ctx.arc(cx + s * 0.19, cy - s * 0.1, s * 0.075, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}
