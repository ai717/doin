export const GAME_STATES = {
  READY: 'READY',
  PLAYING: 'PLAYING',
  DRAFTING: 'DRAFTING',
  PAUSED: 'PAUSED',
  GAMEOVER: 'GAMEOVER',
  VICTORY: 'VICTORY'
};

export const AVAILABLE_RELICS = [
  { id: 'relic_quantum_twin', icon: '♊' },
  { id: 'relic_singularity_whip', icon: '⚡' },
  { id: 'relic_event_horizon', icon: '👁️' },
  { id: 'relic_chronos_buffer', icon: '🛡️' },
  { id: 'relic_pulsar_spark', icon: '✨' },
  { id: 'relic_graviton_overdrive', icon: '🪐' }
];

export class PhysicsEngine {
  constructor(width = 800, height = 600, randomFn = Math.random) {
    this.width = width;
    this.height = height;
    this.random = randomFn;
    this.resetWorld();
  }

  setDimensions(w, h) {
    const oldW = this.width;
    this.width = w;
    this.height = h;

    // 重新居中底板
    const ratio = w / (oldW || w);
    this.paddle.x = Math.max(0, Math.min(this.width - this.paddle.w, this.paddle.x * ratio));
    this.paddle.y = this.height - 46;
  }

  resetWorld() {
    this.state = GAME_STATES.READY;
    this.sector = 1;
    this.maxSectors = 5;
    this.lives = 3;       // 全局储备装甲生命：3条
    this.maxLives = 3;
    this.resonance = 0;
    this.maxResonance = 100;
    this.isOverdrive = false;
    this.overdriveTimer = 0;

    const basePaddleW = Math.max(90, Math.min(130, this.width * 0.18));
    this.paddle = {
      x: this.width / 2 - basePaddleW / 2,
      y: this.height - 46,
      w: basePaddleW,
      baseW: basePaddleW,
      h: 14,
      targetX: this.width / 2 - basePaddleW / 2
    };

    this.balls = [];
    this.bricks = [];
    this.singularities = [];
    this.particles = [];
    this.projectiles = [];
    this.activeRelics = new Set();
    this.draftPool = [];
    this.combo = 1;
    this.events = [];
  }

  setRandom(fn) {
    this.random = fn;
  }

  applyRelicEffects() {
    let widthMod = 1.0;
    if (this.activeRelics.has('relic_chronos_buffer')) widthMod += 0.22;
    if (this.activeRelics.has('relic_graviton_overdrive')) widthMod -= 0.15;
    const centerX = this.paddle.x + this.paddle.w / 2;
    this.paddle.w = Math.max(60, Math.floor(this.paddle.baseW * widthMod));
    this.paddle.x = Math.max(0, Math.min(this.width - this.paddle.w, centerX - this.paddle.w / 2));
  }

  spawnBall(isSub = false) {
    const ball = {
      x: this.paddle.x + this.paddle.w / 2,
      y: this.paddle.y - 12,
      vx: (this.random() - 0.5) * 4,
      vy: -7.5 - (this.sector * 0.35),
      r: isSub ? 5 : 7,
      baseR: isSub ? 5 : 7,
      isSub: isSub,
      stuckToPaddle: !isSub
    };
    this.balls.push(ball);
    return ball;
  }

  launchBall() {
    let launched = false;
    this.balls.forEach(b => {
      if (b.stuckToPaddle) {
        b.stuckToPaddle = false;
        b.vy = -7.5 - (this.sector * 0.35);
        b.vx = (this.random() - 0.5) * 4.5;
        launched = true;
      }
    });
    return launched;
  }

  loadSector(sectorIndex) {
    this.sector = sectorIndex;
    this.bricks = [];
    this.singularities = [];
    this.balls = [];
    this.projectiles = [];
    this.particles = [];

    // 平滑难度梯度配置
    // Sector 1: 无黑洞，单层敲击，纯热身
    // Sector 2: 1 个温和奇点（中央偏上）
    // Sector 3: 1 个动态奇点 + 部分双层砖
    // Sector 4: 2 个左右双星奇点
    // Sector 5: 最终星环共振，三层核心装甲砖
    const cols = Math.max(8, Math.min(12, Math.floor(this.width / 65)));
    const rows = 3 + Math.min(sectorIndex, 4);
    const sideMargin = 30;
    const brickW = (this.width - sideMargin * 2) / cols;
    const brickH = 22;
    const startY = 60;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // 在奇点附近预留弧线通道，确保弹道可穿透
        if (sectorIndex >= 2 && r >= 2 && (c === Math.floor(cols / 2) || c === Math.floor(cols / 2) - 1)) {
          continue;
        }

        // 阶梯生命值
        let hp = 1;
        if (sectorIndex >= 3 && r === 0) hp = 2;
        if (sectorIndex >= 5 && (r === 0 || r === 1)) hp = 3;

        this.bricks.push({
          id: `b_${r}_${c}`,
          x: sideMargin + c * brickW,
          y: startY + r * (brickH + 8),
          w: brickW - 6,
          h: brickH,
          hp: hp,
          maxHp: hp,
          tier: hp
        });
      }
    }

    // 引力场奇点配置
    if (sectorIndex === 2 || sectorIndex === 3) {
      this.singularities.push({
        x: this.width / 2,
        y: startY + rows * (brickH + 8) + 45,
        mass: 1200 + sectorIndex * 200,
        r: 13,
        pulse: 0
      });
    } else if (sectorIndex >= 4) {
      this.singularities.push({
        x: this.width * 0.28,
        y: startY + rows * (brickH + 8) + 35,
        mass: 1100,
        r: 11,
        pulse: 0
      });
      this.singularities.push({
        x: this.width * 0.72,
        y: startY + rows * (brickH + 8) + 35,
        mass: 1100,
        r: 11,
        pulse: 0
      });
    }

    this.spawnBall(false);
    if (this.activeRelics.has('relic_quantum_twin')) {
      const sub = this.spawnBall(true);
      sub.stuckToPaddle = false;
      sub.y -= 25;
    }
    this.applyRelicEffects();
  }

  setPaddlePosition(targetCenterX) {
    if (this.state === GAME_STATES.GAMEOVER || this.state === GAME_STATES.VICTORY) return;
    const halfW = this.paddle.w / 2;
    // 限制在游戏宽度范围内
    const clampedCenter = Math.max(halfW, Math.min(this.width - halfW, targetCenterX));
    this.paddle.x = clampedCenter - halfW;

    this.balls.forEach(b => {
      if (b.stuckToPaddle) {
        b.x = clampedCenter;
      }
    });
  }

  movePaddleDelta(deltaX) {
    this.setPaddlePosition(this.paddle.x + this.paddle.w / 2 + deltaX);
  }

  step(dt) {
    this.events = [];
    if (this.state !== GAME_STATES.PLAYING) return this.events;

    // 超载计时
    if (this.isOverdrive) {
      this.overdriveTimer -= dt;
      if (this.overdriveTimer <= 0) {
        this.isOverdrive = false;
        this.resonance = 0;
      }
    }

    // 奇点引力波脉动
    this.singularities.forEach(s => {
      s.pulse = (s.pulse + dt * 4) % (Math.PI * 2);
    });

    // 追踪星尘弹推进
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.life -= dt;
      for (const brick of this.bricks) {
        if (p.x > brick.x && p.x < brick.x + brick.w && p.y > brick.y && p.y < brick.y + brick.h) {
          brick.hp -= 1;
          p.life = 0;
          this.events.push({ type: 'BRICK_HIT', brick, destroyed: brick.hp <= 0 });
          this.createSparks(p.x, p.y, '#fbbf24', 4);
          break;
        }
      }
      if (p.life <= 0 || p.y < 0 || p.x < 0 || p.x > this.width) {
        this.projectiles.splice(i, 1);
      }
    }

    // 弹球物理计算
    for (let bi = this.balls.length - 1; bi >= 0; bi--) {
      const b = this.balls[bi];
      if (b.stuckToPaddle) continue;

      // 叠加奇点万有引力
      this.singularities.forEach(s => {
        const dx = s.x - b.x;
        const dy = s.y - b.y;
        const distSq = Math.max(dx * dx + dy * dy, 500);
        const dist = Math.sqrt(distSq);
        const force = (s.mass / distSq) * dt * 60;
        b.vx += (dx / dist) * force;
        b.vy += (dy / dist) * force;

        if (dist < s.r + b.r + 18 && this.activeRelics.has('relic_pulsar_spark') && this.random() < 0.1) {
          this.firePulsarDarts(b.x, b.y);
          this.events.push({ type: 'WARP' });
        }
      });

      // 速度限幅，保证弹珠既不会龟速也不会瞬移穿墙
      const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      const minSpeed = 6.2;
      const maxSpeed = this.isOverdrive ? 14.5 : 10.8;
      if (speed < minSpeed) {
        const factor = minSpeed / (speed || 1);
        b.vx *= factor;
        b.vy *= factor;
      } else if (speed > maxSpeed) {
        const factor = maxSpeed / speed;
        b.vx *= factor;
        b.vy *= factor;
      }

      b.x += b.vx * dt * 60;
      b.y += b.vy * dt * 60;

      // 边缘墙壁弹性碰撞
      if (b.x - b.r <= 0) {
        b.x = b.r;
        b.vx = Math.abs(b.vx);
        this.createSparks(b.x, b.y, '#38bdf8', 3);
      } else if (b.x + b.r >= this.width) {
        b.x = this.width - b.r;
        b.vx = -Math.abs(b.vx);
        this.createSparks(b.x, b.y, '#38bdf8', 3);
      }

      // 天花板碰撞
      if (b.y - b.r <= 0) {
        b.y = b.r;
        b.vy = Math.abs(b.vy);
        this.createSparks(b.x, b.y, '#38bdf8', 3);
      }

      // 底板反弹碰撞检测
      if (
        b.vy > 0 &&
        b.y + b.r >= this.paddle.y &&
        b.y - b.r <= this.paddle.y + this.paddle.h &&
        b.x >= this.paddle.x - 6 &&
        b.x <= this.paddle.x + this.paddle.w + 6
      ) {
        b.y = this.paddle.y - b.r;
        const hitOffset = (b.x - (this.paddle.x + this.paddle.w / 2)) / (this.paddle.w / 2); // -1 到 1
        const sweetSpot = Math.abs(hitOffset) < 0.28;

        const maxAngle = (Math.PI / 180) * 65;
        const angle = hitOffset * maxAngle;
        const curSpeed = Math.sqrt(b.vx * b.vx + b.vy * b.vy) * (sweetSpot ? 1.06 : 1.0);
        b.vx = curSpeed * Math.sin(angle);
        b.vy = -Math.abs(curSpeed * Math.cos(angle));

        // 中心甜点蓄力
        const resonanceGain = sweetSpot ? 25 : 8;
        const threshold = this.activeRelics.has('relic_event_horizon') ? 70 : 100;
        this.resonance = Math.min(threshold, this.resonance + resonanceGain);

        if (this.resonance >= threshold && !this.isOverdrive) {
          this.isOverdrive = true;
          this.overdriveTimer = 6.0;
          this.events.push({ type: 'OVERDRIVE_START' });
        }

        if (this.activeRelics.has('relic_singularity_whip')) {
          this.triggerRepulsorWhip(this.paddle.x + this.paddle.w / 2, this.paddle.y);
        }

        this.events.push({ type: 'PADDLE_HIT', sweetSpot });
        this.createSparks(b.x, b.y, sweetSpot ? '#c084fc' : '#2dd4bf', sweetSpot ? 12 : 6);
      }

      // 砖块碰撞
      for (let k = this.bricks.length - 1; k >= 0; k--) {
        const brick = this.bricks[k];
        if (this.checkBallBrickCollision(b, brick)) {
          const dmg = this.activeRelics.has('relic_graviton_overdrive') ? 2 : 1;
          brick.hp -= dmg;
          const destroyed = brick.hp <= 0;

          this.events.push({
            type: 'BRICK_HIT',
            brick,
            destroyed,
            isOverdrive: this.isOverdrive
          });

          this.createSparks(brick.x + brick.w / 2, brick.y + brick.h / 2, destroyed ? '#38bdf8' : '#cbd5e1', 6);

          if (!this.isOverdrive) {
            break;
          }
        }
      }

      // 球滑落出底界
      if (b.y - b.r > this.height) {
        this.balls.splice(bi, 1);
        this.createSparks(b.x, this.height - 10, '#f43f5e', 14);
      }
    }

    // 滤除粉碎砖块
    this.bricks = this.bricks.filter(b => b.hp > 0);

    // 检查是否丢失全部球
    if (this.balls.length === 0) {
      this.lives -= 1;
      this.events.push({ type: 'LIFE_LOST', remainingLives: this.lives });
      if (this.lives <= 0) {
        this.state = GAME_STATES.GAMEOVER;
        this.events.push({ type: 'GAME_OVER' });
      } else {
        this.spawnBall(false);
        if (this.activeRelics.has('relic_quantum_twin')) {
          const sub = this.spawnBall(true);
          sub.stuckToPaddle = false;
          sub.y -= 25;
        }
        this.isOverdrive = false;
        this.resonance = 0;
      }
    }

    // 检查通关与生命修复奖励
    if (this.bricks.length === 0 && this.state === GAME_STATES.PLAYING) {
      if (this.sector >= this.maxSectors) {
        this.state = GAME_STATES.VICTORY;
        this.events.push({ type: 'VICTORY' });
      } else {
        // 通关修复机制：回复 1 点装甲生命（最多 3 点）
        if (this.lives < this.maxLives) {
          this.lives += 1;
        }
        this.state = GAME_STATES.DRAFTING;
        this.prepareDraftChoices();
        this.events.push({ type: 'SECTOR_CLEARED', sector: this.sector });
      }
    }

    // 粒子模拟
    for (let pIdx = this.particles.length - 1; pIdx >= 0; pIdx--) {
      const p = this.particles[pIdx];
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.alpha -= dt * 1.8;
      if (p.alpha <= 0) {
        this.particles.splice(pIdx, 1);
      }
    }

    return this.events;
  }

  checkBallBrickCollision(ball, brick) {
    const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
    const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
    const distX = ball.x - closestX;
    const distY = ball.y - closestY;
    const distSq = distX * distX + distY * distY;

    if (distSq < ball.r * ball.r) {
      if (!this.isOverdrive) {
        const overlapX = ball.r - Math.abs(distX);
        const overlapY = ball.r - Math.abs(distY);
        if (overlapX < overlapY) {
          ball.vx = distX > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
        } else {
          ball.vy = distY > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
        }
      }
      return true;
    }
    return false;
  }

  triggerRepulsorWhip(x, y) {
    const shockRange = 170;
    this.bricks.forEach(brick => {
      const bx = brick.x + brick.w / 2;
      const by = brick.y + brick.h / 2;
      const d = Math.hypot(bx - x, by - y);
      if (d < shockRange) {
        brick.hp -= 1;
        this.events.push({ type: 'BRICK_HIT', brick, destroyed: brick.hp <= 0 });
        this.createSparks(bx, by, '#2dd4bf', 4);
      }
    });
  }

  firePulsarDarts(x, y) {
    for (let i = 0; i < 3; i++) {
      const ang = -Math.PI / 2 + (i - 1) * 0.42;
      this.projectiles.push({
        x,
        y,
        vx: Math.cos(ang) * 9.5,
        vy: Math.sin(ang) * 9.5,
        life: 1.2
      });
    }
  }

  createSparks(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2;
      const speed = 1.2 + this.random() * 4.2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1.0,
        color,
        size: 2 + this.random() * 2.5
      });
    }
  }

  prepareDraftChoices() {
    const unowned = AVAILABLE_RELICS.filter(r => !this.activeRelics.has(r.id));
    const pool = [...unowned];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.draftPool = pool.slice(0, 3);
  }

  selectRelic(relicId) {
    if (this.state !== GAME_STATES.DRAFTING) return false;
    this.activeRelics.add(relicId);
    this.applyRelicEffects();
    this.loadSector(this.sector + 1);
    this.state = GAME_STATES.PLAYING;
    return true;
  }
}
