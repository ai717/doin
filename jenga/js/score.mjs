// 叠叠乐 · 计分唯一口径（UI 不得自算分）
//
// 契约来源 PRD §3.2.4-5：
//   - 连续成功「抽 + 叠」连击 +1，第 n 次成功倍率 ×3^n，基础分 10/块 → 单次得分 10 × 3^n
//   - 极限封顶 3^18 = 387,420,489（「封神金标」触发线）
//   - 塔倒或换手 → 连击清零、倍率归 1
//   - 三星：★达成目标 / ★★未判危次数 ≥ par / ★★★出现过 ×27 或封神

export const BASE_PER_BLOCK = 10;
export const STREAK_CAP = 18;
export const MAX_MULTIPLIER = 3 ** STREAK_CAP; // 387,420,489
export const TRIPLE_STREAK = 3; // ×27 倍：三星门槛之一
export const WARN_DANGER = 0.55; // danger ≥ 此值算「判危」，消耗一次容错额度
export const TOTAL_CAP = Number.MAX_SAFE_INTEGER; // 累加防御上限（正常局到不了）

// 连击档位：把任意 streak 折到第 [0, 18] 区间，负数/小数一律向下取整。
export function streakTier(streak) {
  const n = Number.isFinite(streak) ? Math.floor(streak) : 0;
  return Math.min(Math.max(n, 0), STREAK_CAP);
}

// 第 n 次成功的倍率。注意 n=0（连击清零态）→ 1，符合「倍率归 1」。
export function multiplierFor(streak) {
  return 3 ** streakTier(streak);
}

// 单次成功落位的得分：恒为「10 × 3 的幂次」，且 ≤ 10 × 3^18。
export function blockScore(streak) {
  return BASE_PER_BLOCK * multiplierFor(streak);
}

// 累加总分的防御：任何情况下不让总分越过安全整数。
export function addScore(total, gain) {
  const t = Number.isFinite(total) ? total : 0;
  const g = Number.isFinite(gain) ? gain : 0;
  return Math.min(t + g, TOTAL_CAP);
}

export function isTripling(streak) {
  return streakTier(streak) >= TRIPLE_STREAK;
}

// 封神金标：连击打到第 18 次（×3^18）。封神是**终身成就**，一旦拿到不再因清零撤销。
export function isSpire(streak) {
  return streakTier(streak) >= STREAK_CAP;
}

// 判危：danger 越过 WARN_DANGER 的那次操作算「吃掉一次容错额度」。
export function isBrink(danger) {
  const d = Number.isFinite(danger) ? danger : 0;
  return d >= WARN_DANGER;
}

// 记分黑板 / 工具槽用的倍率表（n 从 0 起）。
export function multiplierTable() {
  const table = [];
  let mult = 1;
  for (let n = 0; n <= STREAK_CAP; n += 1) {
    table.push({ streak: n, mult, score: BASE_PER_BLOCK * mult });
    mult *= 3;
  }
  return table;
}

// 三星评级。规则按顺序叠加，缺一不可：
//   ★    达成关卡目标（否则直接 0 星）
//   ★★   未判危次数 cleanMoves ≥ par（剩余容错够）
//   ★★★  本关出现过 ×27（连击 ≥ 3）或封神金标
export function rateRun({ goalMet = false, cleanMoves = 0, par = 0, bestStreak = 0, spire = false } = {}) {
  if (!goalMet) return 0;
  const clean = Math.max(0, Math.floor(cleanMoves));
  const need = Math.max(0, Math.floor(par));
  let stars = 1;
  if (clean >= need) stars += 1;
  if (spire || isTripling(bestStreak)) stars += 1;
  return Math.min(Math.max(stars, 0), 3);
}
