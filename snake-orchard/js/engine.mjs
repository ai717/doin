export const DIRECTIONS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 }
};

export const OPPOSITES = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT'
};

export function createPseudoRandom(seed = 123456789) {
  let s = Math.floor(seed) % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export class Engine {
  constructor(options = {}) {
    this.gridWidth = options.gridWidth || 20;
    this.gridHeight = options.gridHeight || 20;
    this.prng = typeof options.random === 'function' ? options.random : Math.random;
    this.reset();
  }

  reset() {
    const midX = Math.floor(this.gridWidth / 2);
    const midY = Math.floor(this.gridHeight / 2);

    this.snake = [
      { x: midX, y: midY },
      { x: midX - 1, y: midY },
      { x: midX - 2, y: midY }
    ];
    this.direction = 'RIGHT';
    this.pendingDirection = 'RIGHT';
    this.isDead = false;
    this.lastEvent = null; // 'eat_normal' | 'eat_special' | 'die' | null
    this.normalFruit = null;
    this.specialFruit = null;
    this.specialTimer = 0;

    this.spawnNormalFruit();
    return this.getState();
  }

  setDirection(newDir) {
    if (!DIRECTIONS[newDir] || this.isDead) return false;
    if (newDir === OPPOSITES[this.direction]) return false;
    this.pendingDirection = newDir;
    return true;
  }

  spawnNormalFruit() {
    const occupied = new Set();
    for (const segment of this.snake) {
      occupied.add(`${segment.x},${segment.y}`);
    }
    if (this.specialFruit) {
      occupied.add(`${this.specialFruit.x},${this.specialFruit.y}`);
    }

    const available = [];
    for (let x = 0; x < this.gridWidth; x++) {
      for (let y = 0; y < this.gridHeight; y++) {
        if (!occupied.has(`${x},${y}`)) {
          available.push({ x, y });
        }
      }
    }

    if (available.length === 0) {
      this.normalFruit = null;
      return;
    }
    const idx = Math.floor(this.prng() * available.length);
    this.normalFruit = { ...available[idx], type: 'normal' };
  }

  spawnSpecialFruit() {
    if (this.specialFruit) return;
    const occupied = new Set();
    for (const segment of this.snake) {
      occupied.add(`${segment.x},${segment.y}`);
    }
    if (this.normalFruit) {
      occupied.add(`${this.normalFruit.x},${this.normalFruit.y}`);
    }

    const available = [];
    for (let x = 0; x < this.gridWidth; x++) {
      for (let y = 0; y < this.gridHeight; y++) {
        if (!occupied.has(`${x},${y}`)) {
          available.push({ x, y });
        }
      }
    }

    if (available.length === 0) return;
    const idx = Math.floor(this.prng() * available.length);
    this.specialFruit = { ...available[idx], type: 'special' };
    this.specialTimer = 8.0;
  }

  step(dt = 0) {
    if (this.isDead) {
      this.lastEvent = null;
      return this.getState();
    }

    this.direction = this.pendingDirection;
    const moveVector = DIRECTIONS[this.direction];
    const head = this.snake[0];
    const newHead = { x: head.x + moveVector.x, y: head.y + moveVector.y };

    // 边界碰撞
    if (
      newHead.x < 0 ||
      newHead.x >= this.gridWidth ||
      newHead.y < 0 ||
      newHead.y >= this.gridHeight
    ) {
      this.isDead = true;
      this.lastEvent = 'die';
      return this.getState();
    }

    // 蛇身自碰撞判定
    const willEatFruit =
      (this.normalFruit && newHead.x === this.normalFruit.x && newHead.y === this.normalFruit.y) ||
      (this.specialFruit && newHead.x === this.specialFruit.x && newHead.y === this.specialFruit.y);

    const bodyToCheck = willEatFruit ? this.snake : this.snake.slice(0, -1);
    for (const segment of bodyToCheck) {
      if (segment.x === newHead.x && segment.y === newHead.y) {
        this.isDead = true;
        this.lastEvent = 'die';
        return this.getState();
      }
    }

    this.snake.unshift(newHead);

    if (this.normalFruit && newHead.x === this.normalFruit.x && newHead.y === this.normalFruit.y) {
      this.lastEvent = 'eat_normal';
      this.spawnNormalFruit();
      if (!this.specialFruit && this.prng() < 0.25) {
        this.spawnSpecialFruit();
      }
    } else if (this.specialFruit && newHead.x === this.specialFruit.x && newHead.y === this.specialFruit.y) {
      this.lastEvent = 'eat_special';
      this.specialFruit = null;
      this.specialTimer = 0;
    } else {
      this.snake.pop();
      this.lastEvent = null;
    }

    if (this.specialFruit && dt > 0) {
      this.specialTimer -= dt;
      if (this.specialTimer <= 0) {
        this.specialFruit = null;
        this.specialTimer = 0;
      }
    }

    return this.getState();
  }

  getState() {
    return {
      snake: this.snake.map((p) => ({ ...p })),
      direction: this.direction,
      gridWidth: this.gridWidth,
      gridHeight: this.gridHeight,
      isDead: this.isDead,
      lastEvent: this.lastEvent,
      normalFruit: this.normalFruit ? { ...this.normalFruit } : null,
      specialFruit: this.specialFruit ? { ...this.specialFruit } : null,
      specialTimer: this.specialTimer
    };
  }
}
