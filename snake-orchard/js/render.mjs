export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.dpr = 1;
    this.logicalWidth = 600;
    this.logicalHeight = 600;
    this.currentTheme = 'light';
    this.setupDpr();
  }

  setTheme(theme) {
    this.currentTheme = theme === 'dark' ? 'dark' : 'light';
  }

  setupDpr() {
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(this.logicalWidth * this.dpr);
    this.canvas.height = Math.floor(this.logicalHeight * this.dpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
  }

  emitFruitParticles(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.2;
      const speed = 45 + Math.random() * 75;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 3,
        alpha: 1.0,
        color
      });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= dt * 2.2;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(state, dt = 0) {
    this.updateParticles(dt);
    const ctx = this.ctx;
    const w = this.logicalWidth;
    const h = this.logicalHeight;
    const cellW = w / state.gridWidth;
    const cellH = h / state.gridHeight;

    const isDark = this.currentTheme === 'dark';

    // 背景与网格自适应主题着色
    ctx.fillStyle = isDark ? '#0b1120' : '#1e293b';
    ctx.fillRect(0, 0, w, h);

    const gridColor = isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.035)';
    for (let x = 0; x < state.gridWidth; x++) {
      for (let y = 0; y < state.gridHeight; y++) {
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = gridColor;
          ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
        }
      }
    }

    // 绘制普通苹果
    if (state.normalFruit) {
      const cx = state.normalFruit.x * cellW + cellW / 2;
      const cy = state.normalFruit.y * cellH + cellH / 2;
      const radius = cellW * 0.38;

      ctx.save();
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // 果实叶片
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.ellipse(cx + radius * 0.4, cy - radius * 0.8, radius * 0.4, radius * 0.2, 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 绘制星星果
    if (state.specialFruit) {
      const cx = state.specialFruit.x * cellW + cellW / 2;
      const cy = state.specialFruit.y * cellH + cellH / 2;
      const radius = cellW * 0.44;

      ctx.save();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 绘制贪吃蛇
    const snake = state.snake;
    for (let i = snake.length - 1; i >= 0; i--) {
      const segment = snake[i];
      const cx = segment.x * cellW + cellW / 2;
      const cy = segment.y * cellH + cellH / 2;
      const radius = cellW * 0.42;

      ctx.save();
      if (i === 0) {
        ctx.fillStyle = '#34d399';
      } else {
        const ratio = i / Math.max(snake.length, 1);
        ctx.fillStyle = ratio % 2 < 1 ? '#10b981' : '#059669';
      }

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // 头部蛇眼
      if (i === 0) {
        ctx.fillStyle = '#090d16';
        let ex1 = cx - 4, ey1 = cy - 4, ex2 = cx + 4, ey2 = cy - 4;
        if (state.direction === 'DOWN') {
          ex1 = cx - 4; ey1 = cy + 4; ex2 = cx + 4; ey2 = cy + 4;
        } else if (state.direction === 'LEFT') {
          ex1 = cx - 4; ey1 = cy - 4; ex2 = cx - 4; ey2 = cy + 4;
        } else if (state.direction === 'RIGHT') {
          ex1 = cx + 4; ey1 = cy - 4; ex2 = cx + 4; ey2 = cy + 4;
        }
        ctx.beginPath();
        ctx.arc(ex1, ey1, 2.6, 0, Math.PI * 2);
        ctx.arc(ex2, ey2, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 粒子渲染
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
