// score.mjs — 计分与格式化唯一口径（DOM-free）
// Cat Cafe 是放置类，没有"得分"概念；这里聚焦格式化与显示钳制。

/**
 * 格式化金币显示：
 * - < 1,000：原样 + 千分位
 * - 1,000 ~ 999,999：保留 1 位小数 + K
 * - 1,000,000 ~ 999,999,999：保留 1 位小数 + M
 * - ≥ 1,000,000,000：保留 1 位小数 + B
 * 负数钳制为 0 显示
 */
export function formatCoins(value) {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  if (n < 1000) {
    return n.toLocaleString("en-US");
  }
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${trimDecimal(k)}K`;
  }
  if (n < 1_000_000_000) {
    const m = n / 1_000_000;
    return `${trimDecimal(m)}M`;
  }
  const b = n / 1_000_000_000;
  return `${trimDecimal(b)}B`;
}

/**
 * 去掉无意义的小数尾零（12.0 → 12，12.30 → 12.3）
 */
function trimDecimal(n) {
  const fixed = n.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}

/**
 * 格式化星标数量
 */
export function formatStars(value) {
  return formatCoins(value);
}

/**
 * 格式化百分比：0.5 → "+50%"，0.03 → "+3%"
 */
export function formatPercent(value, withSign = true) {
  const pct = Math.round((Number(value) || 0) * 100);
  if (withSign) {
    return `+${pct}%`;
  }
  return `${pct}%`;
}

/**
 * 格式化出杯数（千分位）
 */
export function formatBowls(value) {
  return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString("en-US");
}

/**
 * 钳制得分 ≥ 0（Cat Cafe 永远不能让金币变负）
 */
export function clampScore(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

/**
 * 计算总览数字（用于 HUD 摘要）
 */
export function summary(state) {
  const numStage = Number(state.stage);
  return {
    coins: clampScore(state.coins),
    stars: clampScore(state.stars),
    bowls: clampScore(state.bowlsServed),
    totalEarned: clampScore(state.totalCoinsEarned),
    stage: Number.isFinite(numStage) ? Math.max(0, Math.floor(numStage)) : 0,
  };
}