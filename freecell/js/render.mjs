export class FreeCellRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.layout = {};
    this.particles = [];
  }

  resize() {
    const parent = this.canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    const width = Math.max(340, Math.floor(rect.width));
    const height = Math.max(460, Math.floor(rect.height));

    this.canvas.width = Math.floor(width * this.dpr);
    this.canvas.height = Math.floor(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.computeLayout(width, height);
  }

  computeLayout(w, h) {
    const padding = Math.max(8, Math.min(16, w * 0.02));
    const gap = Math.max(4, Math.min(10, w * 0.012));
    const availableWidth = w - padding * 2 - gap * 7;
    const cardWidth = Math.floor(availableWidth / 8);
    const cardHeight = Math.floor(cardWidth * 1.42);

    const topY = padding;
    const bottomY = topY + cardHeight + Math.max(12, h * 0.024);

    const cellPositions = [];
    for (let i = 0; i < 4; i++) {
      cellPositions.push({
        x: padding + i * (cardWidth + gap),
        y: topY,
        w: cardWidth,
        h: cardHeight
      });
    }

    const foundationPositions = [];
    for (let i = 0; i < 4; i++) {
      foundationPositions.push({
        x: padding + (i + 4) * (cardWidth + gap),
        y: topY,
        w: cardWidth,
        h: cardHeight
      });
    }

    const cascadePositions = [];
    for (let i = 0; i < 8; i++) {
      cascadePositions.push({
        x: padding + i * (cardWidth + gap),
        y: bottomY,
        w: cardWidth,
        h: cardHeight
      });
    }

    const cardVerticalOverlap = Math.max(16, Math.min(cardHeight * 0.32, (h - bottomY - cardHeight) / 18));

    this.layout = {
      w,
      h,
      cardWidth,
      cardHeight,
      cellPositions,
      foundationPositions,
      cascadePositions,
      cardVerticalOverlap
    };
  }

  getCardAtPosition(clientX, clientY, engine) {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    for (let i = 0; i < 4; i++) {
      const pos = this.layout.cellPositions[i];
      if (this.isPointInside(x, y, pos)) {
        if (engine.cells[i]) {
          return { type: 'cell', index: i, card: engine.cells[i], count: 1 };
        }
        return { type: 'empty-cell', index: i };
      }
    }

    for (let i = 0; i < 4; i++) {
      const pos = this.layout.foundationPositions[i];
      if (this.isPointInside(x, y, pos)) {
        const top = engine.getFoundationTop(i);
        return { type: 'foundation', index: i, card: top };
      }
    }

    for (let c = 7; c >= 0; c--) {
      const col = engine.cascades[c];
      const basePos = this.layout.cascadePositions[c];

      if (col.length === 0) {
        if (this.isPointInside(x, y, basePos)) {
          return { type: 'empty-cascade', index: c };
        }
        continue;
      }

      for (let k = col.length - 1; k >= 0; k--) {
        const cardY = basePos.y + k * this.layout.cardVerticalOverlap;
        const isLast = k === col.length - 1;
        const hitH = isLast ? this.layout.cardHeight : this.layout.cardVerticalOverlap;

        if (x >= basePos.x && x <= basePos.x + this.layout.cardWidth && y >= cardY && y <= cardY + hitH) {
          return {
            type: 'cascade',
            index: c,
            cardIndex: k,
            card: col[k],
            count: col.length - k
          };
        }
      }
    }

    return null;
  }

  isPointInside(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  drawRoundedRect(ctx, x, y, w, h, radius) {
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

  drawSlot(pos, label = '') {
    const { ctx } = this;
    ctx.save();
    this.drawRoundedRect(ctx, pos.x, pos.y, pos.w, pos.h, 6);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (label) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.font = `600 ${Math.floor(pos.w * 0.32)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, pos.x + pos.w / 2, pos.y + pos.h / 2);
    }
    ctx.restore();
  }

  getRankString(rank) {
    switch (rank) {
      case 1: return 'A';
      case 11: return 'J';
      case 12: return 'Q';
      case 13: return 'K';
      default: return String(rank);
    }
  }

  drawSuitVector(ctx, suit, cx, cy, size, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.translate(cx, cy);
    const s = size / 32;
    ctx.scale(s, s);

    ctx.beginPath();
    if (suit === 'hearts') {
      ctx.moveTo(0, 4);
      ctx.bezierCurveTo(-14, -12, -18, 6, 0, 16);
      ctx.bezierCurveTo(18, 6, 14, -12, 0, 4);
    } else if (suit === 'diamonds') {
      ctx.moveTo(0, -15);
      ctx.lineTo(11, 0);
      ctx.lineTo(0, 15);
      ctx.lineTo(-11, 0);
      ctx.closePath();
    } else if (suit === 'spades') {
      ctx.moveTo(0, -15);
      ctx.bezierCurveTo(15, -2, 14, 8, 3, 9);
      ctx.lineTo(5, 14);
      ctx.lineTo(-5, 14);
      ctx.lineTo(-3, 9);
      ctx.bezierCurveTo(-14, 8, -15, -2, 0, -15);
    } else if (suit === 'clubs') {
      ctx.arc(0, -5, 6.2, 0, Math.PI * 2);
      ctx.arc(-7, 4, 6.2, 0, Math.PI * 2);
      ctx.arc(7, 4, 6.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2, 4);
      ctx.lineTo(5, 14);
      ctx.lineTo(-5, 14);
      ctx.lineTo(-2, 4);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }

  drawCard(card, x, y, isSelected = false, isHinted = false) {
    if (!card) return;
    const { ctx } = this;
    const w = this.layout.cardWidth;
    const h = this.layout.cardHeight;
    const radius = 6;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = isSelected ? 14 : 5;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = isSelected ? 5 : 2;

    this.drawRoundedRect(ctx, x, y, w, h, radius);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    ctx.save();
    this.drawRoundedRect(ctx, x, y, w, h, radius);
    if (isSelected) {
      ctx.strokeStyle = '#ecc94b';
      ctx.lineWidth = 3;
    } else if (isHinted) {
      ctx.strokeStyle = '#38b2ac';
      ctx.lineWidth = 3;
    } else {
      ctx.strokeStyle = '#cbd5e0';
      ctx.lineWidth = 1;
    }
    ctx.stroke();

    const rankStr = this.getRankString(card.rank);
    const fontColor = card.color === 'red' ? '#e53e3e' : '#1a202c';

    ctx.fillStyle = fontColor;
    const fontSize = Math.max(11, Math.floor(w * 0.23));
    ctx.font = `700 ${fontSize}px system-ui`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const p = Math.max(3, Math.floor(w * 0.08));
    ctx.fillText(rankStr, x + p, y + p);

    const cornerSuitSize = Math.floor(fontSize * 0.9);
    this.drawSuitVector(ctx, card.suit, x + p + cornerSuitSize / 2, y + p + fontSize * 1.5, cornerSuitSize, fontColor);

    const centerSuitSize = Math.floor(w * 0.42);
    this.drawSuitVector(ctx, card.suit, x + w / 2, y + h / 2 + 2, centerSuitSize, fontColor);

    ctx.restore();
  }

  spawnVictoryParticles() {
    if (this.particles.length > 150) return;
    const colors = ['#ecc94b', '#f56565', '#48bb78', '#4299e1', '#ed64a6', '#faf089'];
    for (let i = 0; i < 40; i++) {
      this.particles.push({
        x: Math.random() * this.layout.w,
        y: -10,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 5 + 3,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.1,
        life: 1.0
      });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vr;
      p.life -= dt * 0.2;

      if (p.y > this.layout.h + 20 || p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  drawParticles() {
    const { ctx } = this;
    for (const p of this.particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
  }

  render(engine, state) {
    const { ctx } = this;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    ctx.clearRect(0, 0, this.layout.w, this.layout.h);

    for (let i = 0; i < 4; i++) {
      this.drawSlot(this.layout.cellPositions[i], 'C');
      const card = engine.cells[i];
      if (card && (!state.drag || state.drag.source.type !== 'cell' || state.drag.source.index !== i)) {
        const isSelected = state.selected && state.selected.type === 'cell' && state.selected.index === i;
        const isHinted = state.hint && state.hint.from.type === 'cell' && state.hint.from.index === i;
        this.drawCard(card, this.layout.cellPositions[i].x, this.layout.cellPositions[i].y, isSelected, isHinted);
      }
    }

    for (let i = 0; i < 4; i++) {
      const suitName = ['♠', '♥', '♦', '♣'][i];
      this.drawSlot(this.layout.foundationPositions[i], suitName);
      const top = engine.getFoundationTop(i);
      if (top) {
        this.drawCard(top, this.layout.foundationPositions[i].x, this.layout.foundationPositions[i].y, false, false);
      }
    }

    for (let c = 0; c < 8; c++) {
      const pos = this.layout.cascadePositions[c];
      this.drawSlot(pos);

      const col = engine.cascades[c];
      for (let k = 0; k < col.length; k++) {
        if (
          state.drag &&
          state.drag.source.type === 'cascade' &&
          state.drag.source.index === c &&
          k >= state.drag.source.cardIndex
        ) {
          continue;
        }

        const card = col[k];
        const cardY = pos.y + k * this.layout.cardVerticalOverlap;
        const isSelected =
          state.selected &&
          state.selected.type === 'cascade' &&
          state.selected.index === c &&
          k >= state.selected.cardIndex;
        const isHinted =
          state.hint &&
          state.hint.from.type === 'cascade' &&
          state.hint.from.index === c &&
          k === col.length - (state.hint.count || 1);

        this.drawCard(card, pos.x, cardY, isSelected, isHinted);
      }
    }

    if (state.drag && state.drag.cards) {
      for (let i = 0; i < state.drag.cards.length; i++) {
        const card = state.drag.cards[i];
        const dx = state.drag.currentX - state.drag.offsetX;
        const dy = state.drag.currentY - state.drag.offsetY + i * this.layout.cardVerticalOverlap;
        this.drawCard(card, dx, dy, true, false);
      }
    }

    if (engine.isWon) {
      this.drawParticles();
    }

    ctx.restore();
  }
}
