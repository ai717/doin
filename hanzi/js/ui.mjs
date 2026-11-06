/**
 * Glyph Craft (字灵拆拆乐) - Canvas 2D Ink Wash Scroll Renderer
 * Song Dynasty Xuan Paper aesthetic, ink diffusion, seal stamps, obstacles & traveler.
 */

import { OBSTACLE_TYPES } from './data.mjs';
import { t } from './i18n.mjs';

export class InkWorldRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.particles = [];
    this.heroAnimX = null;
    this.heroAnimY = null;
    this.hoverObstacleId = null;
    this.sliceLine = null; // { startX, startY, endX, endY }
  }

  setHoverObstacle(id) {
    this.hoverObstacleId = id;
  }

  setSliceLine(line) {
    this.sliceLine = line;
  }

  addReactionParticles(x, y, type) {
    const count = 16;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (type === 'fire_burn' ? 1.5 : 0),
        life: 1.0,
        decay: 0.02 + Math.random() * 0.03,
        size: 3 + Math.random() * 5,
        type
      });
    }
  }

  updateParticles() {
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

  render(state, lang = 'zh') {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Xuan Paper Background (Warm Gradient with subtle fibers)
    const paperGrad = ctx.createLinearGradient(0, 0, w, h);
    paperGrad.addColorStop(0, '#f9f6f0');
    paperGrad.addColorStop(0.5, '#f4efe6');
    paperGrad.addColorStop(1, '#e9dfce');
    ctx.fillStyle = paperGrad;
    ctx.fillRect(0, 0, w, h);

    // Faint fiber grain border
    ctx.strokeStyle = 'rgba(74, 52, 33, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(6, 6, w - 12, h - 12);

    // 2. Distant Song Mountains (Teal & Pine Ink)
    ctx.save();
    ctx.fillStyle = 'rgba(30, 80, 70, 0.09)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.65);
    ctx.bezierCurveTo(w * 0.2, h * 0.35, w * 0.4, h * 0.5, w * 0.6, h * 0.3);
    ctx.bezierCurveTo(w * 0.8, h * 0.2, w * 0.9, h * 0.45, w, h * 0.55);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // Secondary mid-ground hills
    ctx.fillStyle = 'rgba(45, 52, 54, 0.07)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.75);
    ctx.bezierCurveTo(w * 0.25, h * 0.55, w * 0.5, h * 0.7, w * 0.75, h * 0.5);
    ctx.bezierCurveTo(w * 0.85, h * 0.45, w * 0.95, h * 0.65, w, h * 0.7);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 3. Ground / River Pathway
    ctx.save();
    ctx.fillStyle = 'rgba(80, 60, 45, 0.08)';
    ctx.fillRect(20, h * 0.72, w - 40, 20);
    ctx.restore();

    // 4. Destination: Cinnabar Master Seal (Goal Red Seal)
    const goalX = w - 55;
    const goalY = h * 0.55;
    ctx.save();
    ctx.fillStyle = state.won ? 'rgba(238, 82, 83, 0.95)' : 'rgba(238, 82, 83, 0.4)';
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(goalX - 22, goalY - 22, 44, 44, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "Songti SC", "SimSun", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u901A', goalX, goalY);

    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'rgba(238, 82, 83, 0.85)';
    ctx.fillText('GOAL', goalX, goalY + 32);
    ctx.restore();

    // 5. Draw Obstacles
    state.obstacles.forEach(obs => {
      this.drawObstacle(ctx, obs, lang);
    });

    // 6. Draw Traveler / Paper Boat
    if (this.heroAnimX === null) this.heroAnimX = state.hero.x;
    if (this.heroAnimY === null) this.heroAnimY = state.hero.y;
    this.heroAnimX += (state.hero.x - this.heroAnimX) * 0.12;
    this.heroAnimY += (state.hero.y - this.heroAnimY) * 0.12;

    this.drawHero(ctx, this.heroAnimX, this.heroAnimY, state.won);

    // 7. Draw Reaction Particles
    this.updateParticles();
    this.drawParticles(ctx);

    // 8. Draw Slice Cut Line (if swiping)
    if (this.sliceLine) {
      ctx.save();
      ctx.strokeStyle = '#ff4757';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(this.sliceLine.startX, this.sliceLine.startY);
      ctx.lineTo(this.sliceLine.endX, this.sliceLine.endY);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawObstacle(ctx, obs, lang) {
    const isHovered = this.hoverObstacleId === obs.id;
    ctx.save();
    ctx.translate(obs.x, obs.y);

    if (obs.resolved) {
      // Cleared state with faded ink calligraphy
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#2ed573';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2d3436';
      ctx.font = '12px "Songti SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', 0, 0);
      ctx.restore();
      return;
    }

    // Hover or active halo
    if (isHovered) {
      ctx.save();
      ctx.strokeStyle = '#ffa502';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Obstacle body based on type
    switch (obs.type) {
      case OBSTACLE_TYPES.WOOD_BARRIER: {
        // Wooden logs
        ctx.fillStyle = '#8b572a';
        ctx.fillRect(-22, -8, 44, 16);
        ctx.fillStyle = '#6b3e18';
        ctx.fillRect(-20, -6, 40, 12);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u6728', 0, 0);
        break;
      }

      case OBSTACLE_TYPES.FOREST_BLOCK: {
        // Triple trees Forest
        ctx.fillStyle = '#27ae60';
        ctx.beginPath();
        ctx.arc(-10, -5, 14, 0, Math.PI * 2);
        ctx.arc(10, -5, 14, 0, Math.PI * 2);
        ctx.arc(0, -16, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u68EE', 0, -8);
        break;
      }

      case OBSTACLE_TYPES.DRY_CANAL: {
        // Dry canal ditch
        ctx.fillStyle = '#dcdde1';
        ctx.fillRect(-26, -10, 52, 20);
        ctx.strokeStyle = '#718093';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-26, -10, 52, 20);
        ctx.fillStyle = '#2f3640';
        ctx.font = '13px "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u6E20', 0, 0);
        break;
      }

      case OBSTACLE_TYPES.DEEP_RAVINE: {
        // Deep ravine gap
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-24, -14, 48, 28);
        ctx.fillStyle = '#dfe6e9';
        ctx.font = '14px "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u58D1', 0, 0);
        break;
      }

      case OBSTACLE_TYPES.RUSHING_RIVER: {
        // Rushing blue river
        ctx.fillStyle = '#0984e3';
        ctx.fillRect(-26, -12, 52, 24);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u5DDD', 0, 0);
        break;
      }

      case OBSTACLE_TYPES.DARK_CAVERN: {
        // Dark misty cavern
        ctx.fillStyle = '#2f3542';
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f1f2f6';
        ctx.font = 'bold 14px "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u5E7D', 0, 0);
        break;
      }

      case OBSTACLE_TYPES.THICK_FROST: {
        // Thick frost crystals
        ctx.fillStyle = '#70a1ff';
        ctx.beginPath();
        ctx.moveTo(0, -22);
        ctx.lineTo(16, 0);
        ctx.lineTo(0, 22);
        ctx.lineTo(-16, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u971C', 0, 0);
        break;
      }

      case OBSTACLE_TYPES.MOUNTAIN_PASS: {
        // Twin peaks
        ctx.fillStyle = '#57606f';
        ctx.beginPath();
        ctx.moveTo(-24, 16);
        ctx.lineTo(-12, -18);
        ctx.lineTo(0, 16);
        ctx.lineTo(12, -18);
        ctx.lineTo(24, 16);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u5C71', 0, 0);
        break;
      }

      case OBSTACLE_TYPES.ABYSS_PIT: {
        // Pit
        ctx.fillStyle = '#1e272e';
        ctx.beginPath();
        ctx.ellipse(0, 0, 24, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d2dae2';
        ctx.font = '12px "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u5751', 0, 0);
        break;
      }

      case OBSTACLE_TYPES.RAGING_FIRE: {
        // Wildfire
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(0, 2, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u706B', 0, 0);
        break;
      }

      case OBSTACLE_TYPES.IRON_GATE: {
        // Bronze iron gate
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(-20, -18, 40, 36);
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 2;
        ctx.strokeRect(-18, -16, 36, 32);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u9501', 0, 0);
        break;
      }

      case OBSTACLE_TYPES.MUD_SWAMP: {
        // Swamp
        ctx.fillStyle = '#535c68';
        ctx.fillRect(-24, -10, 48, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = '13px "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u6CBC', 0, 0);
        break;
      }

      default: {
        ctx.fillStyle = '#747d8c';
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    // Name label beneath obstacle
    ctx.fillStyle = '#2f3542';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t(obs.nameKey, lang), 0, 26);

    ctx.restore();
  }

  drawHero(ctx, x, y, hasWon) {
    ctx.save();
    ctx.translate(x, y);

    // Cute paper traveler boat / bird
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Paper origami boat
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2f3542';
    ctx.lineWidth = 1.5;

    // Bottom hull
    ctx.beginPath();
    ctx.moveTo(-18, 4);
    ctx.lineTo(18, 4);
    ctx.lineTo(12, 12);
    ctx.lineTo(-12, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sail
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(0, -16);
    ctx.lineTo(12, 4);
    ctx.closePath();
    ctx.fillStyle = hasWon ? '#2ed573' : '#3498db';
    ctx.fill();
    ctx.stroke();

    // Flag atop
    if (hasWon) {
      ctx.fillStyle = '#ff4757';
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(-8, -12);
      ctx.lineTo(0, -8);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  drawParticles(ctx) {
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      if (p.type === 'fire_burn') {
        ctx.fillStyle = '#ff4757';
      } else if (p.type === 'water_flow') {
        ctx.fillStyle = '#1e90ff';
      } else {
        ctx.fillStyle = '#ffa502';
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  getObstacleAt(canvasX, canvasY, obstacles) {
    for (const obs of obstacles) {
      if (obs.resolved) continue;
      const dx = canvasX - obs.x;
      const dy = canvasY - obs.y;
      if (Math.hypot(dx, dy) <= 32) {
        return obs;
      }
    }
    return null;
  }
}
