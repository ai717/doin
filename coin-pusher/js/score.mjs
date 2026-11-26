// 推币机 · 计分唯一口径（纯函数，DOM-free）
// UI 与渲染层一律不得自算分，只允许读 engine 已算好的 state.score / state.cascadeMult。

export const COIN_VALUES = { norm: 10, gold: 50, gem: 100, tower: 0 };

export const JACKPOT_DOUBLINGS = 18;
export const JACKPOT_MULT = 2 ** JACKPOT_DOUBLINGS;
export const JACKPOT_CASCADE = JACKPOT_DOUBLINGS + 1;

// 连锁窗口 = 上一枚落袋到下一枚落袋的最大间隔。
// 台面满载时落袋是持续细流（平均间隔约 0.18s），窗口若给到 1.5s 连锁永不中断、
// 倍率恒在 2^18 封顶——分数会飙到十亿量级，完全失真。
// 收紧到 0.25s 后，只有"同一波推落"的币才算连锁，倍率回到街机量级。
export const CASCADE_WINDOW = 0.25;

// 四档常规档位（每 4 枚连锁升一档），四档后进入"疯狂翻倍"直至 2^18 金卡封顶。
export const CASCADE_TIERS = [
  { key: "tier1", upto: 4 },
  { key: "tier2", upto: 8 },
  { key: "tier3", upto: 12 },
  { key: "tier4", upto: 16 },
  { key: "tierMad", upto: Infinity }
];

// 边缘连锁翻倍：波内第 m 枚得 base × 2^(m-1)，封顶 2^18 = 262144。
export function cascadeMult(count) {
  if (count <= 0) return 1;
  return 2 ** Math.min(count - 1, JACKPOT_DOUBLINGS);
}

export function coinValue(kind, doubleActive) {
  const base = COIN_VALUES[kind] ?? 0;
  return doubleActive ? base * 2 : base;
}

export function cascadeTierKey(count) {
  const tier = CASCADE_TIERS.find((entry) => count <= entry.upto);
  return (tier ?? CASCADE_TIERS[CASCADE_TIERS.length - 1]).key;
}

export function isJackpot(mult) {
  return mult >= JACKPOT_MULT;
}

// 分数显示：千分位，避免长串数字难以读数
export function formatScore(value) {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatMult(value) {
  const n = Math.max(1, Math.floor(Number(value) || 1));
  return `×${formatScore(n)}`;
}
