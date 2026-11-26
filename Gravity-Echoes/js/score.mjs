export const MAX_SINGLE_GAME_SCORE = 9999999;

export class ScoreSystem {
  constructor(initialScore = 0) {
    this.score = this._clamp(initialScore);
    this.streak = 0;
    this.maxStreak = 0;
  }

  _clamp(val) {
    if (!Number.isFinite(val) || val < 0) return 0;
    return Math.min(Math.floor(val), MAX_SINGLE_GAME_SCORE);
  }

  reset() {
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    return this.score;
  }

  addBrickBreak(tier = 1, isOverdrive = false, comboMultiplier = 1) {
    const base = 50 * tier;
    const overdriveBonus = isOverdrive ? 2.5 : 1.0;
    const streakBonus = Math.min(1 + this.streak * 0.05, 3.0);
    const added = Math.floor(base * overdriveBonus * streakBonus * comboMultiplier);
    this.score = this._clamp(this.score + added);
    this.streak++;
    if (this.streak > this.maxStreak) this.maxStreak = this.streak;
    return added;
  }

  addSectorClearBonus(sectorIndex) {
    const bonus = 1000 * Math.max(1, sectorIndex);
    this.score = this._clamp(this.score + bonus);
    return bonus;
  }

  resetStreak() {
    this.streak = 0;
  }

  getScore() {
    return this.score;
  }

  getStreak() {
    return this.streak;
  }
}
