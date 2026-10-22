// 深海合珠 bubble-merge · 计分唯一口径（纯函数，UI 不得自算）
// 三角数制 + 连锁 ×1.5 倍率 + 戳破奖励，对齐 Suika 验证过的数值。

export const POP_BONUS = 100;

// 合成出第 level 级泡泡的基础分：三角数 level*(level+1)/2。
// 算例：T(2)=3、T(5)=15、T(10)=55。
export function triangular(level) {
  const n = Math.trunc(Number(level));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return (n * (n + 1)) / 2;
}

// 单次合并得分 = 三角数 × 连锁倍率（chainIndex 从 0 起，每多一级 ×1.5）。
// 算例：L3(chain0)=6、L4(chain1)=round(10×1.5)=15、L5(chain2)=round(15×2.25)=34。
export function mergeScore(level, chainIndex = 0) {
  const ci = Math.trunc(Number(chainIndex));
  const k = Number.isFinite(ci) && ci > 0 ? ci : 0;
  return Math.round(triangular(level) * Math.pow(1.5, k));
}

// 戳破终极泡泡 L10 的固定奖励（爆分 + 清场双收益）。
export function popScore() {
  return POP_BONUS;
}

export function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

export function isBetterScore(candidate, current) {
  return clampScore(candidate) > clampScore(current);
}
