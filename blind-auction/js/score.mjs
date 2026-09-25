// 盲盒竞拍 · 计分唯一口径（DOM-free）
// 评级与趣味徽章（捡漏王 / 接盘侠 / 铁公鸡 / 抬轿人）只能在此计算，UI 不得自算。

import { humanIndex } from "./engine.mjs";

export const RATING_ORDER = ["C", "B", "A", "S"];

// 终局评级：S（第一且资产 ≥ 初始 × 1.8）/ A（第一）/ B（第二）/ C（第三、四）
export function computeRating(state) {
  if (!state || !state.result) return null;
  const human = humanIndex(state);
  if (human < 0) return null;
  const rankPos = state.result.rank.indexOf(human);
  const asset = state.result.assets.find((a) => a.i === human)?.asset ?? 0;
  const initial = state.players[human].initialCash || 1;
  if (rankPos === 0) return asset >= initial * 1.8 ? "S" : "A";
  if (rankPos === 1) return "B";
  return "C";
}

// 趣味徽章（从对局日志提取，返回 badge id 数组）
export function computeBadges(state) {
  if (!state) return [];
  const human = humanIndex(state);
  if (human < 0) return [];
  const badges = new Set();
  let humanWins = 0;
  let bestRatio = -Infinity;
  let worstProfit = Infinity;
  let secondCount = 0;
  let sedanOpponentLost = false;
  for (const entry of state.log) {
    if (entry.t === "open" && entry.winner === human) {
      humanWins += 1;
      if (entry.profit > 0) {
        bestRatio = Math.max(bestRatio, entry.profit / entry.trueValue);
      }
      if (entry.profit < 0) {
        worstProfit = Math.min(worstProfit, entry.profit);
      }
    }
    if (entry.t === "resolve") {
      const ranked = entry.bids
        .map((amount, i) => ({ i, amount }))
        .sort((a, b) => b.amount - a.amount || a.i - b.i);
      if (ranked.length > 1 && ranked[1].i === human) {
        secondCount += 1;
        if (ranked[0].i !== human) sedanOpponentLost = true;
      }
    }
  }
  if (humanWins > 0 && bestRatio >= 0.5) badges.add("snip");       // 捡漏王：低于真值一半拿下
  if (humanWins > 0 && worstProfit <= -3000) badges.add("bag");    // 接盘侠：单箱亏 ≥ $3,000
  if (humanWins === 0 && (state.players[human].cash >= state.players[human].initialCash)) {
    badges.add("tight");                                           // 铁公鸡：零买入且没乱花
  }
  if (secondCount >= 2 && sedanOpponentLost) badges.add("sedan");  // 抬轿人：≥2 次第二且让对手接盘
  return [...badges];
}

// 统计落账：仅在此更新战绩，坏输入回默认。
export function applyOutcome(stats, outcome) {
  const base = stats && typeof stats === "object" ? stats : {};
  const next = {
    gamesPlayed: Math.max(0, Number(base.gamesPlayed) || 0) + 1,
    bestAsset: Math.max(0, Number(base.bestAsset) || 0, Number(outcome?.asset) || 0),
    bestRating: base.bestRating && RATING_ORDER.indexOf(base.bestRating) > RATING_ORDER.indexOf(outcome?.rating)
      ? base.bestRating
      : (outcome?.rating && RATING_ORDER.includes(outcome.rating) ? outcome.rating : null),
    badges: Array.isArray(base.badges) ? [...new Set([...base.badges, ...(Array.isArray(outcome?.badges) ? outcome.badges : [])])] : [],
  };
  return next;
}
