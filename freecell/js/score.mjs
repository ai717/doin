export class ScoreCalculator {
  static calculateMoveScore(isFoundationMove, isUndo = false) {
    if (isUndo) {
      return -50;
    }
    if (isFoundationMove) {
      return 100;
    }
    return 0;
  }

  static finalizeGameScore(currentScore, seconds, moves) {
    const safeScore = Math.max(0, currentScore);
    const timePenalty = Math.floor(seconds * 2);
    const movesPenalty = Math.max(0, (moves - 52) * 5);
    const bonus = 5000;
    
    return Math.max(100, safeScore + bonus - timePenalty - movesPenalty);
  }
}
