// 记忆对决 · 评分与星级计算 (DOM-free, Storage-free)
// 评价指标：胜负判定、净胜对数差、剩余 SP 资源、翻查失误惩罚、通关星级 (1-3 星)

export function calculateDuelStars(state) {
  if (!state || !state.players) return 0;
  const player = state.players.player;
  const opponent = state.players.opponent;

  // 未分出胜负
  if (state.winner !== "player") {
    return 0;
  }

  const netPairs = player.pairs - opponent.pairs;
  const remainingSp = player.sp;
  const mistakes = player.mistakes;

  // 3 星判定：净胜 ≥ 2 对，且 SP 剩余 ≥ 2，且失误 ≤ 2 次
  if (netPairs >= 2 && remainingSp >= 2 && mistakes <= 2) {
    return 3;
  }

  // 2 星判定：净胜 ≥ 1 对，且 SP 剩余 ≥ 1，或失误 ≤ 3 次
  if (netPairs >= 1 && (remainingSp >= 1 || mistakes <= 3)) {
    return 2;
  }

  // 1 星判定：只要赢下对局即可得 1 星兜底
  return 1;
}

export function calculatePuzzleStars(state, starsCriteria) {
  if (!state || state.winner !== "player") return 0;
  if (!starsCriteria) return 1;

  const { maxSteps = 3, minSp = 0 } = starsCriteria;
  const turns = state.turnCount;
  const remainingSp = state.players.player.sp;

  if (turns <= maxSteps && remainingSp >= minSp) {
    return 3;
  }
  if (turns <= maxSteps + 2) {
    return 2;
  }
  return 1;
}

export function calculateSummary(state) {
  const player = state.players.player;
  const opponent = state.players.opponent;
  const netPairs = player.pairs - opponent.pairs;
  return {
    winner: state.winner,
    winReason: state.winReason,
    playerPairs: player.pairs,
    opponentPairs: opponent.pairs,
    playerLocked: player.lockedPairs,
    opponentLocked: opponent.lockedPairs,
    playerLoose: player.looseCards,
    opponentLoose: opponent.looseCards,
    playerSp: player.sp,
    opponentSp: opponent.sp,
    mistakes: player.mistakes,
    turnCount: state.turnCount,
    netPairs,
  };
}
