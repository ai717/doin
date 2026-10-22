export class ScoreManager {
  constructor(initialBest = 0) {
    this.score = 0;
    this.bestScore = Math.max(0, Math.floor(initialBest));
    this.applesCount = 0;
    this.combo = 0;
    this.lastEatTime = 0;
  }

  reset() {
    this.score = 0;
    this.applesCount = 0;
    this.combo = 0;
    this.lastEatTime = 0;
  }

  addAppleScore(type = 'normal', currentTime = 0) {
    this.applesCount += 1;
    if (currentTime > 0 && currentTime - this.lastEatTime < 3.0) {
      this.combo += 1;
    } else {
      this.combo = 1;
    }
    this.lastEatTime = currentTime;

    const base = type === 'special' ? 50 : 10;
    const bonus = Math.min(this.combo - 1, 5) * 5;
    const gained = base + bonus;

    this.score += gained;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
    }
    return { gained, combo: this.combo, total: this.score };
  }

  getSnapshot() {
    return {
      score: this.score,
      bestScore: this.bestScore,
      applesCount: this.applesCount,
      combo: Math.max(1, this.combo)
    };
  }
}
