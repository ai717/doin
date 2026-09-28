export const MAX_SCORE = 9999999;
export const BASE_POINT = 40;

export class ScoreManager {
  constructor(initial = 0) {
    this.currentScore = Math.max(0, Math.min(MAX_SCORE, Math.floor(initial)));
  }

  getScore() {
    return this.currentScore;
  }

  reset() {
    this.currentScore = 0;
    return 0;
  }

  addPoints(points) {
    this.currentScore = Math.min(MAX_SCORE, this.currentScore + points);
    return points;
  }

  calculateMatchScore(clearedCount, combo = 1, specialMultiplier = 1) {
    if (clearedCount <= 0) return 0;
    const comboFactor = 1 + (combo - 1) * 0.4;
    const earned = Math.floor(clearedCount * BASE_POINT * comboFactor * specialMultiplier);
    return this.addPoints(earned);
  }

  calculateBonusMovesScore(leftMoves) {
    if (leftMoves <= 0) return 0;
    const bonus = leftMoves * 120;
    return this.addPoints(bonus);
  }

  calculateStars(score, starThresholds = [1000, 2000, 3000]) {
    if (score >= starThresholds[2]) return 3;
    if (score >= starThresholds[1]) return 2;
    if (score >= starThresholds[0]) return 1;
    return 0;
  }
}
