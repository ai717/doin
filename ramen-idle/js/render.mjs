// render.mjs — Canvas visual atmosphere: steam particles, lanterns, stars, ambient glow

export class AtmosphereRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.particles = [];
    this.steamParticles = [];
    this.animId = null;
    this.lastTime = performance.now();
    this.reducedMotion = false;

    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.reducedMotion = mediaQuery.matches;
      mediaQuery.addEventListener?.("change", (e) => {
        this.reducedMotion = e.matches;
      });
      window.addEventListener("resize", () => this.resize());
      this.resize();
    }
  }

  resize() {
    if (!this.canvas || !this.ctx) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Initialize stars
    if (this.particles.length === 0) {
      for (let i = 0; i < 28; i++) {
        this.particles.push({
          x: Math.random() * this.width,
          y: Math.random() * (this.height * 0.45),
          radius: Math.random() * 1.5 + 0.5,
          alpha: Math.random() * 0.7 + 0.3,
          twinkleSpeed: Math.random() * 0.003 + 0.001,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  spawnSteam(x, y, count = 2) {
    if (this.reducedMotion || !this.ctx) return;
    for (let i = 0; i < count; i++) {
      this.steamParticles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -(Math.random() * 0.8 + 0.6),
        radius: Math.random() * 4 + 4,
        maxRadius: Math.random() * 14 + 12,
        alpha: 0.35,
        decay: Math.random() * 0.006 + 0.004,
      });
    }
  }

  spawnFloatingYen(x, y, text) {
    if (!this.ctx) return;
    this.steamParticles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -1.2,
      text,
      alpha: 1.0,
      decay: 0.02,
      isText: true,
    });
  }

  start() {
    if (this.animId) return;
    const loop = (now) => {
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;
      this.draw(dt);
      this.animId = requestAnimationFrame(loop);
    };
    this.lastTime = performance.now();
    this.animId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  draw(dt) {
    if (!this.ctx || !this.width || !this.height) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // Subtle twinkling stars
    const now = performance.now();
    for (const p of this.particles) {
      const a = p.alpha + Math.sin(now * p.twinkleSpeed + p.phase) * 0.25;
      ctx.fillStyle = `rgba(240, 245, 255, ${Math.max(0.1, Math.min(1, a))})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Warm radial lantern ambient glows
    const drawLanternGlow = (gx, gy, radius, r, g, b, alpha) => {
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
      grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${alpha * 0.4})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(gx, gy, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const pulse = Math.sin(now * 0.002) * 0.03;
    drawLanternGlow(w * 0.18, 50, 90, 255, 160, 60, 0.18 + pulse);
    drawLanternGlow(w * 0.82, 50, 90, 255, 160, 60, 0.18 - pulse);

    // Update and draw steam and floating text
    for (let i = this.steamParticles.length - 1; i >= 0; i--) {
      const p = this.steamParticles[i];
      p.x += p.vx || 0;
      p.y += p.vy || 0;
      p.alpha -= p.decay || 0.01;

      if (p.alpha <= 0) {
        this.steamParticles.splice(i, 1);
        continue;
      }

      if (p.isText) {
        ctx.font = "bold 15px monospace, sans-serif";
        ctx.fillStyle = `rgba(255, 215, 0, ${p.alpha})`;
        ctx.textAlign = "center";
        ctx.fillText(p.text, p.x, p.y);
      } else {
        p.radius += (p.maxRadius - p.radius) * 0.03;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        grad.addColorStop(0, `rgba(250, 250, 255, ${p.alpha * 0.8})`);
        grad.addColorStop(0.6, `rgba(240, 240, 250, ${p.alpha * 0.4})`);
        grad.addColorStop(1, `rgba(240, 240, 250, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
