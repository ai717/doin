// 计分唯一口径。UI 不得自算分，永不显示得分 > 总分。
//
// 残局闯关：星级 = 3（步数 ≤ par 且无 Ctl+Z 悔棋记录）/ 2（≤ par+2）/ 1（胜）。
// 对战：胜负记录 + 连胜 + 击败档位徽章（badge 存储键 = ai 档位 key）。
// 对战不产积分，残局以星级为进度反馈（平台惯例：行星/分数而非抽象积分）。

export const MODE_CAMPAIGN = "campaign";
export const MODE_AI = "ai";
export const MODE_2P = "2p";

export const MAX_UNDO_PER_DUEL = 3;

// 残局星级。moves = 红方实际用步数；par = 求解器最优步数；undoUsed = 本关是否用过悔棋（残局禁用，恒 false）。
export function campaignStars(moves, par, undoUsed = false) {
  if (moves <= 0 || par <= 0) return 0;
  if (moves <= par && !undoUsed) return 3;
  if (moves <= par + 2) return 2;
  return 1;
}

// 连胜推进：win=true 连胜+1，否则清零（和棋清零）。
export function nextStreak(streak, win) {
  return win ? streak + 1 : 0;
}

// 击败某档 AI → 解锁该档徽章。
export function badgeKeyForTier(tierKey) {
  return `badge_${tierKey}`;
}

// 纸质记分簿摘要（渲染层直接消费的口径）。
export function duelSummary(record) {
  const wins = record?.wins ?? 0;
  const losses = record?.losses ?? 0;
  const draws = record?.draws ?? 0;
  const streak = record?.streak ?? 0;
  const bestStreak = Math.max(record?.bestStreak ?? 0, streak);
  const badges = record?.badges ?? {};
  return { wins, losses, draws, streak, bestStreak, badges, total: wins + losses + draws };
}
