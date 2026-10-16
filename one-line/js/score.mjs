/**
 * 评分与星级换算规则：
 * 1. 完美路线的步数是固定的：走遍 N 个格子恰好需要 N-1 次前进
 * 2. 多余步数 extra = forwardCount - (targetCount - 1)。回退本身不计罚，
 *    但重走一遍会自然累积多余步数 —— 这是既公平又刷不掉的指標
 * 3. 3 星 = 零多余步数 + 未用过提示 + 耗时达标；2 星 = 多余步数 ≤ 3；其余 1 星
 */
export function extraForwardCount({ targetCount, forwardCount }) {
  if (targetCount <= 0) return 0;
  return Math.max(0, forwardCount - (targetCount - 1));
}

export function calculateStars({ targetCount, forwardCount, hintCount = 0, elapsedTimeSeconds = 0 }) {
  if (targetCount <= 0) return 0;
  if (forwardCount < targetCount - 1) return 0;

  const extra = extraForwardCount({ targetCount, forwardCount });
  const timeThreshold = Math.max(12, targetCount * 2.5);

  if (extra === 0 && hintCount === 0 && elapsedTimeSeconds <= timeThreshold) {
    return 3;
  }
  if (extra <= 3) {
    return 2;
  }
  return 1;
}

export function formatSeconds(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const remS = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(m)}:${pad(remS)}`;
}
