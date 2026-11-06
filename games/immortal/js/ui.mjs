/**
 * Immortal Box (摸鱼开箱修仙传) - Canvas 2D Sanctuary & Cauldron Renderer
 * Taoist sanctuary, 3-legged bronze cauldron, sacred fire & loot beams.
 */

export class SanctuaryRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;

    this.particles = [];
    this.cauldronShake = 0;
    this.lootBeamAlpha = 0;
    this.lootColor = '#ffeaa7';
    this.time = 0;
  }

  triggerOpen(color = '#ffeaa7') {
    this.cauldronShake = 12;
    this.lootBeamAlpha = 1.0;
    this.lootColor = color;

    // Burst golden sparks
    const count = 24;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      this.particles.push({
        x: this.width * 0.5,
        y: this.height * 0.55,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.5,
        size: 3 + Math.random() * 4,
        life: 1.0,
        decay: 0.02 + Math.random() * 0.02,
        color
      });
    }
  }

  update() {
    this.time += 0.03;
    if (this.cauldronShake > 0) {
      this.cauldronShake -= 0.8;
    }
    if (this.lootBeamAlpha > 0) {
      this.lootBeamAlpha -= 0.03;
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render() {
    this.update();
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Celestial Cavern / Mountain Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#0c141d');
    bgGrad.addColorStop(0.6, '#18202a');
    bgGrad.addColorStop(1, '#080d14');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Distant mountain ridge silhouette
    ctx.fillStyle = 'rgba(24, 40, 52, 0.4)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.7);
    ctx.bezierCurveTo(w * 0.3, h * 0.45, w * 0.6, h * 0.6, w, h * 0.5);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // 2. Floating Taoist Meditation Silhouette (Left)
    const taoistX = 90;
    const taoistY = h * 0.58 + Math.sin(this.time) * 4;
    this.drawTaoist(ctx, taoistX, taoistY);

    // 3. Loot Beam (shoots from cauldron when opening)
    if (this.lootBeamAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = Math.min(1.0, this.lootBeamAlpha);
      const beamGrad = ctx.createLinearGradient(w * 0.5, h * 0.55, w * 0.5, 0);
      beamGrad.addColorStop(0, this.lootColor);
      beamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(w * 0.5 - 25, h * 0.55);
      ctx.lineTo(w * 0.5 + 25, h * 0.55);
      ctx.lineTo(w * 0.5 + 50, 0);
      ctx.lineTo(w * 0.5 - 50, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 4. Central Bronze Cauldron (With slight shake)
    let cX = w * 0.5;
    let cY = h * 0.62;
    if (this.cauldronShake > 0) {
      cX += (Math.random() - 0.5) * this.cauldronShake;
      cY += (Math.random() - 0.5) * this.cauldronShake;
    }
    this.drawCauldron(ctx, cX, cY);

    // 5. Draw Particles
    this.drawParticles(ctx);
  }

  drawTaoist(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);

    // Subtle blue Qi aura ring
    ctx.strokeStyle = 'rgba(116, 185, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.stroke();

    // Lotus seat
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.ellipse(0, 20, 32, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Taoist body silhouette
    ctx.fillStyle = '#dfe6e9';
    // Head
    ctx.beginPath();
    ctx.arc(0, -18, 9, 0, Math.PI * 2);
    ctx.fill();
    // Topknot hair bun
    ctx.beginPath();
    ctx.arc(0, -28, 4, 0, Math.PI * 2);
    ctx.fill();
    // Robe / Torso
    ctx.beginPath();
    ctx.moveTo(-16, 18);
    ctx.lineTo(16, 18);
    ctx.lineTo(10, -8);
    ctx.lineTo(-10, -8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  drawCauldron(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);

    // Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 34, 55, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3 Legs
    ctx.fillStyle = '#5a4933';
    ctx.beginPath();
    ctx.moveTo(-35, 15);
    ctx.lineTo(-44, 38);
    ctx.lineTo(-28, 38);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(35, 15);
    ctx.lineTo(44, 38);
    ctx.lineTo(28, 38);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-6, 20);
    ctx.lineTo(6, 20);
    ctx.lineTo(0, 42);
    ctx.closePath();
    ctx.fill();

    // Cauldron Belly
    const cGrad = ctx.createLinearGradient(-45, -15, 45, 25);
    cGrad.addColorStop(0, '#b8a17e');
    cGrad.addColorStop(0.5, '#7b684e');
    cGrad.addColorStop(1, '#443522');
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.roundRect(-46, -10, 92, 36, 14);
    ctx.fill();

    // Handles
    ctx.strokeStyle = '#b8a17e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(-46, 5, 8, Math.PI * 0.5, Math.PI * 1.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(46, 5, 8, Math.PI * 1.5, Math.PI * 0.5);
    ctx.stroke();

    // Cauldron Rim Oval
    ctx.fillStyle = '#9b8260';
    ctx.beginPath();
    ctx.ellipse(0, -10, 46, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cauldron Inner Dark Opening
    ctx.fillStyle = '#2c1e10';
    ctx.beginPath();
    ctx.ellipse(0, -10, 38, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pure Yang Rising Sacred Fire
    const fireFlicker = Math.sin(this.time * 6) * 3;
    const fireGrad = ctx.createRadialGradient(0, -14, 2, 0, -14, 22);
    fireGrad.addColorStop(0, '#ffffff');
    fireGrad.addColorStop(0.4, '#ffeaa7');
    fireGrad.addColorStop(0.8, '#ff7675');
    fireGrad.addColorStop(1, 'rgba(255, 118, 117, 0)');
    ctx.fillStyle = fireGrad;
    ctx.beginPath();
    ctx.ellipse(0, -18 + fireFlicker, 22, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawParticles(ctx) {
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }
}
