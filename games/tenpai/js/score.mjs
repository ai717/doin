/**
 * Scoring, Accuracy and Dan Rank evaluation for Tenpai King · Wait Finder (雀神听牌王 · 听牌速判)
 * Pure logic, DOM-free.
 */

import { GAME_CONSTANTS, DAN_RANKS } from './data.mjs';

/**
 * Evaluate score for an answered question.
 * @param {Array<string>} userPicks - Tiles clicked by player
 * @param {string|null} userTarget - Designated primary / best-fan tile
 * @param {object} levelConfig - Current level configuration
 * @param {number} remainingSec - Time remaining on timer
 * @param {number} currentStreak - Current consecutive correct answers
 */
export function evaluateAnswer(userPicks, userTarget, levelConfig, remainingSec = 0, currentStreak = 0) {
  const actualWaits = new Set(levelConfig.waits);
  const userPickSet = new Set(userPicks);

  let correctCount = 0;
  let wrongCount = 0;

  userPicks.forEach(p => {
    if (actualWaits.has(p)) {
      correctCount += 1;
    } else {
      wrongCount += 1;
    }
  });

  const missedCount = actualWaits.size - correctCount;
  const isPerfectWaits = (correctCount === actualWaits.size) && (wrongCount === 0);

  // 1. Wait finding score (0 - 60)
  const waitRatio = actualWaits.size > 0 ? (correctCount / actualWaits.size) : 0;
  let waitScore = Math.round(waitRatio * GAME_CONSTANTS.FIND_ALL_WEIGHT);
  waitScore = Math.max(0, waitScore - wrongCount * 15);

  // 2. Best fan selection score (0 - 40)
  let fanScore = 0;
  let targetDetail = null;
  if (userTarget && actualWaits.has(userTarget)) {
    targetDetail = levelConfig.waitDetails.find(d => d.tileId === userTarget);
    if (targetDetail) {
      if (targetDetail.fan >= levelConfig.maxFan) {
        fanScore = GAME_CONSTANTS.BEST_FAN_WEIGHT; // 40
      } else {
        const ratio = levelConfig.maxFan > 0 ? (targetDetail.fan / levelConfig.maxFan) : 0;
        fanScore = Math.round(ratio * GAME_CONSTANTS.BEST_FAN_WEIGHT);
      }
    }
  } else if (isPerfectWaits && userPicks.length === 1) {
    // If only 1 wait existed and player found it, award full fan score
    fanScore = GAME_CONSTANTS.BEST_FAN_WEIGHT;
  }

  // 3. Speed bonus
  const speedBonus = remainingSec > 0 ? Math.round(remainingSec * 1.5) : 0;

  // Base raw score
  let rawScore = waitScore + fanScore;

  // 4. Streak bonus
  const streakPct = Math.min(
    GAME_CONSTANTS.MAX_STREAK_BONUS_PERCENT,
    currentStreak * GAME_CONSTANTS.STREAK_BONUS_PERCENT
  );
  const streakBonus = isPerfectWaits ? Math.round(rawScore * (streakPct / 100)) : 0;

  const totalScore = rawScore + speedBonus + streakBonus;
  const isPassed = correctCount > 0 && wrongCount <= 1;

  return {
    isPassed,
    isPerfect: isPerfectWaits && (fanScore >= GAME_CONSTANTS.BEST_FAN_WEIGHT),
    waitScore,
    fanScore,
    speedBonus,
    streakBonus,
    totalScore,
    correctCount,
    wrongCount,
    missedCount,
    userPicks,
    userTarget,
    actualWaits: levelConfig.waits,
    bestWait: levelConfig.bestWait,
    maxFan: levelConfig.maxFan
  };
}

/**
 * Determine Dan rank from total career score.
 */
export function getDanRank(totalScore) {
  let matchedRank = DAN_RANKS[0];
  for (let i = DAN_RANKS.length - 1; i >= 0; i--) {
    if (totalScore >= DAN_RANKS[i].minScore) {
      matchedRank = DAN_RANKS[i];
      break;
    }
  }
  return matchedRank;
}
