// 泡泡射手 · 计分唯一口径（UI 不得自算分）

export const POP_PER_BUBBLE = 10;
export const DROP_BASE = 20;
export const DROP_CAP = 10;          // 连锁坠落翻倍封顶档位
export const PRO_BONUS = 1.15;

const COMBO_TABLE = [1, 1, 1.2, 1.5, 2, 2.5, 3];

export function popScore(count) {
  return Math.max(0, Math.floor(count)) * POP_PER_BUBBLE;
}

// 经典几何级数：第 1 颗 20 分，之后每颗翻倍（封顶避免数值爆炸）
export function dropScore(count) {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return 0;
  const step = Math.min(n, DROP_CAP);
  return DROP_BASE * Math.pow(2, step - 1);
}

export function comboMultiplier(streak) {
  const s = Math.max(0, Math.floor(streak));
  return COMBO_TABLE[Math.min(s, COMBO_TABLE.length - 1)] ?? 3;
}

export function shotScore({ popped = 0, dropped = 0, streak = 1, pro = false } = {}) {
  const base = popScore(popped) + dropScore(dropped);
  const mult = comboMultiplier(streak) * (pro ? PRO_BONUS : 1);
  return Math.round(base * mult);
}

export function starsFor(shots, target) {
  const s = Math.max(0, Math.floor(shots));
  const t = Math.max(1, Math.floor(target));
  if (s <= t) return 3;
  if (s <= t + 4) return 2;
  return 1;
}

export function chainSize(popped, dropped) {
  return Math.max(0, popped) + Math.max(0, dropped);
}

export function isAvalanche(chain) {
  return chain >= 5;
}
