// filepath: games/ice-slide/js/score.mjs
// 唯一计分口径：星级制（PRD §3.2 拍板）——★★★ = 步数等于最优 par（完美通关）；
// ★★ = 步数不超过二星门槛；★ = 通关。不做百分制、不做无尽冲分。
// 二星门槛细化（PRD 只写"≤ 最优解 × 1.3"）：小 par 关 floor(par×1.3) 会等于 par 本身，
// 导致二星档消失（要么完美要么一星）。故取 par + max(1, floor(par×0.3))——
// 与 1.3 倍量级一致，且保证任何 par 下二星档非空。
// UI 与 storage 都只读这里的常量与函数，绝不自算。

export const MAX_STARS = 3;
export const TWO_STAR_GRACE = 0.3;

/** 二星门槛步数：约 par × 1.3，但至少比 par 宽 1 步 */
export function twoStarThreshold(par) {
  const p = Number.isFinite(par) ? Math.max(1, Math.floor(par)) : 1;
  return p + Math.max(1, Math.floor(p * TWO_STAR_GRACE));
}

/** 按用步数与最优 par 评星：3 = 完美，2 = 接近最优，1 = 通关 */
export function starsFor(moves, par) {
  const m = Number.isFinite(moves) ? Math.max(0, Math.floor(moves)) : 0;
  const p = Number.isFinite(par) ? Math.max(1, Math.floor(par)) : 1;
  if (m <= p) return 3;
  if (m <= twoStarThreshold(p)) return 2;
  return 1;
}

/** 星级门槛步数（UI 展示"再走 N 步可拿二/三星"用） */
export function nextStarThreshold(par) {
  const p = Number.isFinite(par) ? Math.max(1, Math.floor(par)) : 1;
  return { three: p, two: twoStarThreshold(p) };
}

/** 毫秒 -> mm:ss（HUD 与结算计时唯一口径） */
export function formatTime(ms) {
  const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
